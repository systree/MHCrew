'use strict';

const { Router } = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const { uploadPhoto, getPhotos, deletePhoto } = require('../controllers/photosController');

// ---------------------------------------------------------------------------
// Multer — memory storage, 10 MB limit, images only
// ---------------------------------------------------------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB — phones shoot large HEIC/RAW files
  },
  fileFilter(_req, file, cb) {
    const ALLOWED = new Set([
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
    ]);
    if (ALLOWED.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are accepted (jpeg, png, webp, heic)'), false);
    }
  },
});

// This router is mounted at /jobs in routes/index.js.
// Route paths are relative to that mount point.
const router = Router({ mergeParams: true });

// POST   /jobs/:jobId/photos         — upload a photo
// The multerErrorHandler sits between multer and the controller so MulterErrors
// (file too large, wrong type) return a clean JSON 400 instead of a 500.
function multerErrorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File is too large. Maximum size is 25 MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
}
router.post('/:jobId/photos', auth, upload.single('photo'), multerErrorHandler, uploadPhoto);

// GET    /jobs/:jobId/photos         — list all photos for a job
router.get('/:jobId/photos', auth, getPhotos);

// DELETE /jobs/:jobId/photos/:photoId — delete a photo
router.delete('/:jobId/photos/:photoId', auth, deletePhoto);

module.exports = router;
