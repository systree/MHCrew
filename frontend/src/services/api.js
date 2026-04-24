import axios from 'axios';

/**
 * Central Axios instance for all API communication.
 *
 * Base URL is read from the VITE_API_URL environment variable so it can be
 * overridden per environment without touching the code:
 *
 *   .env.development  →  VITE_API_URL=http://localhost:8000
 *   .env.production   →  VITE_API_URL=https://api.moverhero.com.au
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

/* ------------------------------------------------------------------ */
/*  Request interceptor — attach JWT token from localStorage           */
/* ------------------------------------------------------------------ */

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('mh_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/* ------------------------------------------------------------------ */
/*  Response interceptor — handle 401 Unauthorised globally           */
/* ------------------------------------------------------------------ */

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear stored credentials
      localStorage.removeItem('mh_token');
      localStorage.removeItem('mh-auth'); // Zustand persist key

      // Redirect to login — use window.location so we don't need the
      // React Router context here (this module is framework-agnostic).
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }

    return Promise.reject(error);
  }
);

export default api;

/* ------------------------------------------------------------------ */
/*  Typed endpoint helpers                                              */
/* ------------------------------------------------------------------ */

/** Auth */
export const authApi = {
  sendOtp:     (phone)       => api.post('/auth/send-otp',  { phone }),
  verifyOtp:   (phone, token) => api.post('/auth/verify-otp', { phone, token }),
  setupPin:    (pin)          => api.post('/auth/setup-pin', { pin }),
  loginWithPin:(phone, pin)   => api.post('/auth/login-pin', { phone, pin }),
  getMe:       ()             => api.get('/auth/me'),
};

/** Jobs */
export const jobsApi = {
  getMyJobs:    (tab = 'upcoming')                          => api.get('/jobs', { params: { tab } }),
  getJobById:   (id)                                        => api.get(`/jobs/${id}`),
  updateStatus: (id, status, notes, cancellationReason)     =>
    api.patch(`/jobs/${id}/status`, { status, notes, cancellationReason }),
};

/** Photos */
export const photosApi = {
  upload: (jobId, file, photoType, onUploadProgress) => {
    const formData = new FormData();
    formData.append('photo', file);
    formData.append('photoType', photoType);
    return api.post(`/jobs/${jobId}/photos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => onUploadProgress(Math.round((e.loaded * 100) / e.total)),
    });
  },
  getPhotos:   (jobId)          => api.get(`/jobs/${jobId}/photos`),
  deletePhoto: (jobId, photoId) => api.delete(`/jobs/${jobId}/photos/${photoId}`),
};

/** Locations */
export const locationsApi = {
  log:          (jobId, data) => api.post(`/jobs/${jobId}/locations`, data),
  getLocations: (jobId)       => api.get(`/jobs/${jobId}/locations`),
};

/** Invoices */
export const invoicesApi = {
  getInvoices:   (jobId)              => api.get(`/jobs/${jobId}/invoices`),
  createInvoice: (jobId, data)        => api.post(`/jobs/${jobId}/invoices`, data),
  sendInvoice:   (jobId, invoiceId)   => api.post(`/jobs/${jobId}/invoices/${invoiceId}/send`),
  deleteInvoice: (jobId, invoiceId)   => api.delete(`/jobs/${jobId}/invoices/${invoiceId}`),
};

/** Timesheets */
export const timesheetApi = {
  clockIn:       (jobId)               => api.post(`/jobs/${jobId}/timesheets/clock-in`),
  clockOut:      (jobId, breakMinutes) => api.post(`/jobs/${jobId}/timesheets/clock-out`, { breakMinutes }),
  endBreak:      (jobId, breakMinutes) => api.post(`/jobs/${jobId}/timesheets/break-end`, { breakMinutes }),
  getTimesheets: (jobId)               => api.get(`/jobs/${jobId}/timesheets`),
};
