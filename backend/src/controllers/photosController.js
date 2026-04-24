'use strict';

const { v4: uuidv4 } = require('uuid');
const path = require('path');
const supabase = require('../services/supabase');
const ghlOutbound = require('../services/ghlOutbound');
const logger          = require('../utils/logger');
const { logActivity } = require('../utils/logger');

// NOTE: The Supabase Storage bucket `job-photos` must be created in the
// Supabase dashboard before uploads will work. It should be set to public
// so that getPublicUrl() returns a usable URL.

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const ALLOWED_PHOTO_TYPES = new Set(['before', 'after', 'damage', 'item', 'other']);

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

// ---------------------------------------------------------------------------
// Helper: verify the requesting crew member is assigned to the job.
// Returns the job row on success, or sends a 403/404 response and returns null.
// ---------------------------------------------------------------------------
async function verifyCrewAssignment(req, res, jobId) {
  const crewUserId = req.user.userId;

  const { data: job, error } = await supabase
    .from('mh_pwa_jobs')
    .select('id, ghl_contact_id, status')
    .eq('id', jobId)
    .single();

  if (error || !job) {
    res.status(404).json({ error: 'Job not found' });
    return null;
  }

  // Check the crew_assignments join table (or a direct crew_user_id column)
  // to confirm this crew member is assigned to the job.
  const { data: assignment, error: assignErr } = await supabase
    .from('mh_pwa_job_crew_assignments')
    .select('id')
    .eq('job_id', jobId)
    .eq('crew_user_id', crewUserId)
    .maybeSingle();

  if (assignErr) {
    logger.error(`verifyCrewAssignment DB error: ${assignErr.message}`);
    res.status(500).json({ error: 'Internal server error' });
    return null;
  }

  if (!assignment) {
    res.status(403).json({ error: 'You are not assigned to this job' });
    return null;
  }

  return job;
}

// ---------------------------------------------------------------------------
// POST /jobs/:jobId/photos
// ---------------------------------------------------------------------------
async function uploadPhoto(req, res) {
  const { jobId }  = req.params;
  const crewUserId = req.user.userId;
  const locationId = req.user.locationId;
  const photoType  = req.body?.photoType ?? 'other';

  // Validate photoType
  if (!ALLOWED_PHOTO_TYPES.has(photoType)) {
    return res.status(400).json({
      error: `Invalid photoType. Must be one of: ${[...ALLOWED_PHOTO_TYPES].join(', ')}`,
    });
  }

  // Multer already ran — check the file is present
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Double-check mime type (multer filter also does this, belt-and-suspenders)
  if (!ALLOWED_MIME_TYPES.has(req.file.mimetype)) {
    return res.status(400).json({ error: 'File must be an image (jpeg, png, webp, heic)' });
  }

  // Double-check size
  if (req.file.size > MAX_FILE_SIZE) {
    return res.status(400).json({ error: 'File exceeds the 25 MB limit' });
  }

  try {
    // Verify assignment
    const job = await verifyCrewAssignment(req, res, jobId);
    if (!job) return; // response already sent

    // Build the storage path
    const timestamp = Date.now();
    const uid = uuidv4();
    const ext = path.extname(req.file.originalname).toLowerCase() || `.${req.file.mimetype.split('/')[1]}`;
    const storagePath = `jobs/${jobId}/${crewUserId}/${timestamp}-${uid}${ext}`;

    logger.info(`uploadPhoto: uploading to storage path ${storagePath} (${req.file.size} bytes, ${req.file.mimetype})`);

    // Upload buffer to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('job-photos')
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      logger.error(`Supabase storage upload error for job ${jobId}: ${JSON.stringify(uploadError)}`);
      return res.status(500).json({ error: 'Failed to upload photo to storage', detail: uploadError.message });
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('job-photos')
      .getPublicUrl(storagePath);

    const publicUrl = urlData?.publicUrl;
    logger.info(`uploadPhoto: storage success, publicUrl=${publicUrl}`);

    // Insert record into job_photos table
    const { data: photoRecord, error: insertError } = await supabase
      .from('mh_pwa_job_photos')
      .insert({
        job_id: jobId,
        crew_user_id: crewUserId,
        photo_type: photoType,
        storage_path: storagePath,
        public_url: publicUrl,
      })
      .select('id, public_url, photo_type, uploaded_at')
      .single();

    if (insertError) {
      logger.error(`job_photos insert error for job ${jobId}: ${JSON.stringify(insertError)}`);
      return res.status(500).json({ error: 'Failed to save photo record', detail: insertError.message });
    }

    // Fire-and-forget: push photo URL to GHL
    if (job.ghl_contact_id && locationId) {
      ghlOutbound
        .pushPhotoUrl(job.ghl_contact_id, publicUrl, photoType, jobId, locationId)
        .catch((err) => logger.error(`GHL pushPhotoUrl fire-and-forget failed: ${err.message}`));
    }

    logActivity('job', 'photo_uploaded', { userId: crewUserId, locationId, jobId, photoType, photoId: photoRecord.id });
    return res.status(201).json({
      id: photoRecord.id,
      publicUrl: photoRecord.public_url,
      photoType: photoRecord.photo_type,
      uploadedAt: photoRecord.uploaded_at,
    });
  } catch (err) {
    logger.error(`uploadPhoto unexpected exception for job ${jobId}: ${err.message}`, { stack: err.stack });
    return res.status(500).json({ error: 'Failed to upload photo', detail: err.message });
  }
}

// ---------------------------------------------------------------------------
// GET /jobs/:jobId/photos
// ---------------------------------------------------------------------------
async function getPhotos(req, res) {
  const { jobId } = req.params;

  // Verify assignment
  const job = await verifyCrewAssignment(req, res, jobId);
  if (!job) return;

  const { data: photos, error } = await supabase
    .from('mh_pwa_job_photos')
    .select('id, public_url, photo_type, uploaded_at, crew_user_id')
    .eq('job_id', jobId)
    .order('uploaded_at', { ascending: false });

  if (error) {
    logger.error(`getPhotos DB error for job ${jobId}: ${error.message}`);
    return res.status(500).json({ error: 'Failed to fetch photos' });
  }

  const normalised = (photos ?? []).map((p) => ({
    id: p.id,
    publicUrl: p.public_url,
    photoType: p.photo_type,
    uploadedAt: p.uploaded_at,
    crewUserId: p.crew_user_id,
  }));

  return res.json({ photos: normalised });
}

// ---------------------------------------------------------------------------
// DELETE /jobs/:jobId/photos/:photoId
// ---------------------------------------------------------------------------
async function deletePhoto(req, res) {
  const { jobId, photoId } = req.params;
  const crewUserId = req.user.userId;
  const locationId = req.user.locationId;

  // Fetch the photo and verify ownership
  const { data: photo, error: fetchError } = await supabase
    .from('mh_pwa_job_photos')
    .select('id, storage_path, crew_user_id, job_id')
    .eq('id', photoId)
    .eq('job_id', jobId)
    .single();

  if (fetchError || !photo) {
    return res.status(404).json({ error: 'Photo not found' });
  }

  if (photo.crew_user_id !== crewUserId) {
    return res.status(403).json({ error: 'You can only delete your own photos' });
  }

  // Delete from Supabase Storage
  const { error: storageError } = await supabase.storage
    .from('job-photos')
    .remove([photo.storage_path]);

  if (storageError) {
    // Log but continue — we still want to remove the DB record
    logger.error(`Storage delete error for photo ${photoId}: ${storageError.message}`);
  }

  // Delete from DB
  const { error: dbError } = await supabase
    .from('mh_pwa_job_photos')
    .delete()
    .eq('id', photoId);

  if (dbError) {
    logger.error(`job_photos delete error for photo ${photoId}: ${dbError.message}`);
    return res.status(500).json({ error: 'Failed to delete photo record' });
  }

  logActivity('job', 'photo_deleted', { userId: crewUserId, locationId, jobId, photoId });
  return res.status(204).send();
}

module.exports = { uploadPhoto, getPhotos, deletePhoto };
