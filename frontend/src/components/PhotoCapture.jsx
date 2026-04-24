import React, { useState, useEffect, useRef, useCallback } from 'react';
import { photosApi } from '../services/api.js';

/**
 * PhotoCapture
 *
 * Self-contained photo capture and gallery component.
 * Props: { jobId }
 *
 * NOTE: The Supabase Storage bucket `job-photos` must be created and set
 * to public in the Supabase dashboard before uploads will work.
 */

const PHOTO_TYPES = [
  { value: 'before',  label: 'Before'  },
  { value: 'after',   label: 'After'   },
  { value: 'damage',  label: 'Damage'  },
  { value: 'item',    label: 'Item'    },
  { value: 'other',   label: 'Other'   },
];

/** Rough "time ago" formatter — no dependencies */
function timeAgo(isoString) {
  if (!isoString) return '';
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60)       return 'just now';
  if (diff < 3600)     return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)    return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function PhotoCapture({ jobId }) {
  const [photos, setPhotos]               = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [loadError, setLoadError]         = useState('');

  const [selectedFile, setSelectedFile]   = useState(null);
  const [previewUrl, setPreviewUrl]       = useState('');
  const [selectedType, setSelectedType]   = useState('before');

  const [isUploading, setIsUploading]     = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError]     = useState('');

  const [lightboxUrl, setLightboxUrl]     = useState('');
  const [deleteTarget, setDeleteTarget]   = useState(null); // { id, jobId }
  const [isDeleting, setIsDeleting]       = useState(false);

  const cameraInputRef  = useRef(null);
  const galleryInputRef = useRef(null);

  // ---------- Load existing photos on mount ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingPhotos(true);
      setLoadError('');
      try {
        const { data } = await photosApi.getPhotos(jobId);
        if (!cancelled) setPhotos(data?.photos ?? []);
      } catch (err) {
        if (!cancelled)
          setLoadError(err.response?.data?.error ?? 'Failed to load photos.');
      } finally {
        if (!cancelled) setLoadingPhotos(false);
      }
    })();
    return () => { cancelled = true; };
  }, [jobId]);

  // ---------- File selection ----------
  const handleFileSelected = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Revoke previous object URL to avoid memory leaks
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setUploadError('');
    setUploadProgress(0);

    // Reset the input so the same file can be re-selected after clearing
    e.target.value = '';
  }, [previewUrl]);

  const clearSelection = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl('');
    setUploadError('');
    setUploadProgress(0);
  }, [previewUrl]);

  // ---------- Upload ----------
  const handleUpload = useCallback(async () => {
    if (!selectedFile || isUploading) return;

    setIsUploading(true);
    setUploadError('');
    setUploadProgress(0);

    try {
      const { data } = await photosApi.upload(
        jobId,
        selectedFile,
        selectedType,
        (pct) => setUploadProgress(pct)
      );

      // Optimistic add to gallery
      setPhotos((prev) => [
        {
          id: data.id,
          publicUrl: data.publicUrl,
          photoType: data.photoType,
          uploadedAt: data.uploadedAt,
        },
        ...prev,
      ]);

      clearSelection();
    } catch (err) {
      setUploadError(err.response?.data?.error ?? 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, isUploading, jobId, selectedType, clearSelection]);

  // ---------- Delete ----------
  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      await photosApi.deletePhoto(deleteTarget.jobId, deleteTarget.id);
      setPhotos((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      // Keep dialog open and show nothing — a future enhancement could surface this
      console.error('Delete failed:', err);
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, isDeleting]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ---- Capture Section ---- */}
      <div style={sectionStyle}>
        <p style={sectionTitleStyle}>Photos</p>

        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Photo type selector */}
          <div className="photo-type-pills" role="group" aria-label="Photo type">
            {PHOTO_TYPES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setSelectedType(value)}
                style={{
                  ...pillStyle,
                  backgroundColor: selectedType === value
                    ? 'var(--color-primary)'
                    : 'var(--color-surface-2)',
                  color: selectedType === value ? '#fff' : 'var(--color-text-muted)',
                  border: selectedType === value
                    ? '1.5px solid var(--color-primary)'
                    : '1.5px solid var(--color-border)',
                }}
                aria-pressed={selectedType === value}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Hidden file inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleFileSelected}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileSelected}
          />

          {/* Capture / Gallery buttons */}
          {!selectedFile && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => cameraInputRef.current?.click()}
                style={{ flex: 1, padding: '12px 8px', fontSize: 'var(--font-size-sm)' }}
              >
                {cameraIcon} Take Photo
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => galleryInputRef.current?.click()}
                style={{ flex: 1, padding: '12px 8px', fontSize: 'var(--font-size-sm)' }}
              >
                {galleryIcon} From Gallery
              </button>
            </div>
          )}

          {/* Preview + upload */}
          {selectedFile && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--color-surface-2)' }}>
                <img
                  src={previewUrl}
                  alt="Preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <button
                  type="button"
                  onClick={clearSelection}
                  aria-label="Remove selected photo"
                  style={clearBtnStyle}
                >
                  {closeIcon}
                </button>
              </div>

              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                {selectedFile.name} &middot; {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB &middot; Type: <strong style={{ color: 'var(--color-text)' }}>{selectedType}</strong>
              </p>

              {/* Progress bar */}
              {isUploading && (
                <div className="upload-progress" role="progressbar" aria-valuenow={uploadProgress} aria-valuemin={0} aria-valuemax={100}>
                  <div className="upload-progress-bar" style={{ width: `${uploadProgress}%` }} />
                  <span className="upload-progress-label">{uploadProgress}%</span>
                </div>
              )}

              {uploadError && (
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--status-cancelled)' }}>
                  {uploadError}
                </p>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={clearSelection}
                  disabled={isUploading}
                  style={{ flex: 1, padding: '12px 8px', fontSize: 'var(--font-size-sm)' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleUpload}
                  disabled={isUploading}
                  style={{ flex: 1, padding: '12px 8px', fontSize: 'var(--font-size-sm)' }}
                >
                  {isUploading
                    ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                    : <>{uploadIcon} Upload</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---- Gallery Section ---- */}
      <div style={sectionStyle}>
        <p style={sectionTitleStyle}>Uploaded Photos</p>
        <div style={{ padding: '12px 16px' }}>
          {loadingPhotos ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <span className="spinner" />
            </div>
          ) : loadError ? (
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--status-cancelled)', textAlign: 'center', padding: '12px 0' }}>
              {loadError}
            </p>
          ) : photos.length === 0 ? (
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', textAlign: 'center', padding: '16px 0', lineHeight: 1.6 }}>
              No photos yet — capture before/after photos for this job
            </p>
          ) : (
            <div className="photo-grid">
              {photos.map((photo) => (
                <div key={photo.id} className="photo-thumb">
                  <img
                    src={photo.publicUrl}
                    alt={`${photo.photoType} photo`}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                    onClick={() => setLightboxUrl(photo.publicUrl)}
                  />
                  <span className="photo-type-label">{photo.photoType}</span>
                  <button
                    type="button"
                    className="photo-delete-btn"
                    aria-label={`Delete ${photo.photoType} photo`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget({ id: photo.id, jobId });
                    }}
                  >
                    {trashIcon}
                  </button>
                  <span style={{ position: 'absolute', bottom: 28, right: 6, fontSize: 10, color: 'rgba(255,255,255,0.7)', pointerEvents: 'none' }}>
                    {timeAgo(photo.uploadedAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---- Lightbox ---- */}
      {lightboxUrl && (
        <div
          className="photo-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Photo full view"
          onClick={() => setLightboxUrl('')}
        >
          <img
            src={lightboxUrl}
            alt="Full size"
            style={{ maxWidth: '95vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 'var(--radius-md)' }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            aria-label="Close"
            style={lightboxCloseBtnStyle}
            onClick={() => setLightboxUrl('')}
          >
            {closeIcon}
          </button>
        </div>
      )}

      {/* ---- Delete Confirm Dialog ---- */}
      {deleteTarget && (
        <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label="Confirm delete">
          <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
            <p style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: 'var(--color-text)', marginBottom: 8 }}>
              Delete photo?
            </p>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 20 }}>
              This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1 }}
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ flex: 1, backgroundColor: 'var(--status-cancelled)', borderColor: 'var(--status-cancelled)' }}
                disabled={isDeleting}
                onClick={confirmDelete}
              >
                {isDeleting
                  ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Sub-styles ---- */

const sectionStyle = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  overflow: 'hidden',
};

const sectionTitleStyle = {
  fontSize: 'var(--font-size-xs)',
  fontWeight: 700,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  padding: '10px 16px 8px',
  borderBottom: '1px solid var(--color-border)',
};

const pillStyle = {
  flexShrink: 0,
  padding: '7px 14px',
  borderRadius: 'var(--radius-full)',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background-color var(--transition-fast), color var(--transition-fast)',
  whiteSpace: 'nowrap',
};

const clearBtnStyle = {
  position: 'absolute',
  top: 6,
  right: 6,
  background: 'rgba(0,0,0,0.6)',
  border: 'none',
  borderRadius: 'var(--radius-full)',
  width: 28,
  height: 28,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff',
  cursor: 'pointer',
  padding: 0,
};

const lightboxCloseBtnStyle = {
  position: 'fixed',
  top: 16,
  right: 16,
  background: 'rgba(0,0,0,0.7)',
  border: 'none',
  borderRadius: 'var(--radius-full)',
  width: 36,
  height: 36,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff',
  cursor: 'pointer',
  padding: 0,
  zIndex: 10001,
};

const dialogStyle = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  padding: '24px',
  width: 'min(320px, 90vw)',
};

/* ---- Icons (inline SVG) ---- */

const cameraIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }}>
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const galleryIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

const uploadIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }}>
    <polyline points="16 16 12 12 8 16" />
    <line x1="12" y1="12" x2="12" y2="21" />
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
  </svg>
);

const trashIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const closeIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
