import api from './api.js';

/**
 * Admin-specific API calls.
 * All routes require admin role — the backend enforces this via JWT middleware.
 */

/** GET /admin/pipelines → { pipelines, currentPipelineId } */
export async function getPipelines() {
  const res = await api.get('/admin/pipelines');
  return res.data;
}

/** POST /admin/pipeline → { ok } */
export async function setPipeline(pipelineId) {
  const res = await api.post('/admin/pipeline', { pipelineId });
  return res.data;
}

/** GET /admin/stages → { stages, pipelineId } */
export async function getStages() {
  const res = await api.get('/admin/stages');
  return res.data;
}

/** POST /admin/stages → { ok, updated }
 *  @param {Array<{ stageId: string, jobStatus: string }>} mappings
 */
export async function setStages(mappings) {
  const res = await api.post('/admin/stages', { mappings });
  return res.data;
}

/** GET /admin/crew → { crew } */
export async function getCrew() {
  const res = await api.get('/admin/crew');
  return res.data;
}

/** PATCH /admin/crew/:id → { ok, member }
 *  @param {string} id
 *  @param {{ isActive?: boolean, role?: string }} updates
 */
export async function updateCrewMember(id, updates) {
  const res = await api.patch(`/admin/crew/${id}`, updates);
  return res.data;
}

/** POST /admin/sync-jobs → { ok, synced } */
export async function syncJobs() {
  const res = await api.post('/admin/sync-jobs');
  return res.data;
}

/** POST /admin/sync-crew → { ok, synced } */
export async function syncCrew() {
  const res = await api.post('/admin/sync-crew');
  return res.data;
}

/** POST /admin/sync-location → { ok, name, timezone } */
export async function syncLocation() {
  const res = await api.post('/admin/sync-location');
  return res.data;
}

/** POST /admin/sync-stages → { ok, synced } */
export async function syncStages() {
  const res = await api.post('/admin/sync-stages');
  return res.data;
}

/** POST /admin/refresh-fields → { ok } */
export async function refreshFields() {
  const res = await api.post('/admin/refresh-fields');
  return res.data;
}

/** POST /admin/provision-fields → { ok, created, existing, failed } */
export async function provisionFields() {
  const res = await api.post('/admin/provision-fields');
  return res.data;
}

/** GET /admin/invoice-settings → { taxEnabled, taxName, taxRate, taxCalculation } */
export async function getInvoiceSettings() {
  const res = await api.get('/admin/invoice-settings');
  return res.data;
}

/** PATCH /admin/invoice-settings → { ok } */
export async function updateInvoiceSettings(settings) {
  const res = await api.patch('/admin/invoice-settings', settings);
  return res.data;
}

/** GET /admin/jobs → { jobs }
 *  @param {string} [status] optional status filter
 */
export async function getAdminJobs(status) {
  const params = status ? { status } : {};
  const res = await api.get('/admin/jobs', { params });
  return res.data;
}

/** GET /admin/notification-settings → { crewJobAssigned, adminStatusChanged, ... } */
export async function getNotificationSettings() {
  const res = await api.get('/admin/notification-settings');
  return res.data;
}

/** PATCH /admin/notification-settings → { ok } */
export async function updateNotificationSettings(settings) {
  const res = await api.patch('/admin/notification-settings', settings);
  return res.data;
}

/** GET /admin/crew-locations → { drivers } */
export async function getCrewLocations() {
  const res = await api.get('/admin/crew-locations');
  return res.data;
}
