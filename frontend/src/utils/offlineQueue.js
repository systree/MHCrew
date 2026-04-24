/**
 * offlineQueue.js
 *
 * A lightweight offline action queue backed by localStorage.
 * Queued actions are replayed when connectivity is restored.
 *
 * Supported action types:
 *   'STATUS_UPDATE'  — job status change (jobsApi.updateStatus)
 *   'LOCATION_LOG'   — location ping (locationsApi.log)
 *   'PHOTO_UPLOAD'   — intentionally NOT supported; binary data cannot be
 *                      stored in localStorage. Callers should surface an error
 *                      toast instead of calling enqueueAction with this type.
 *
 * Action shape:
 *   {
 *     id:         string   — crypto.randomUUID()
 *     type:       string   — one of the types above
 *     payload:    object   — type-specific data
 *     createdAt:  number   — Date.now() at enqueue time
 *     attempts:   number   — flush attempts so far (incremented on failure)
 *   }
 */

const QUEUE_KEY = 'mh_offline_queue';

// ------------------------------------------------------------------ //
//  Internal helpers                                                    //
// ------------------------------------------------------------------ //

/** Read the raw array from localStorage; returns [] on any error. */
function readRaw() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Persist the array back to localStorage; silently swallows quota errors. */
function writeRaw(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage quota exceeded — not much we can do
    console.warn('[offlineQueue] localStorage write failed (quota?)');
  }
}

// ------------------------------------------------------------------ //
//  Public API                                                          //
// ------------------------------------------------------------------ //

/**
 * enqueueAction
 *
 * Adds a new action to the tail of the queue.
 * PHOTO_UPLOAD is rejected with a console warning — callers must handle
 * that case by showing an error toast to the user.
 *
 * @param {{ type: string, payload: object }} action
 * @returns {string} The generated action id, or null if rejected.
 */
export function enqueueAction(action) {
  if (action.type === 'PHOTO_UPLOAD') {
    console.warn(
      '[offlineQueue] PHOTO_UPLOAD cannot be queued offline — binary data ' +
      'is too large for localStorage. Show an error toast instead.'
    );
    return null;
  }

  const entry = {
    id:        crypto.randomUUID(),
    type:      action.type,
    payload:   action.payload ?? {},
    createdAt: Date.now(),
    attempts:  0,
  };

  const queue = readRaw();
  queue.push(entry);
  writeRaw(queue);

  console.debug(`[offlineQueue] Enqueued ${entry.type} (id=${entry.id}). Queue length: ${queue.length}`);
  return entry.id;
}

/**
 * getQueue
 *
 * Returns a shallow copy of all queued actions in insertion order.
 *
 * @returns {Array<object>}
 */
export function getQueue() {
  return readRaw();
}

/**
 * dequeueAction
 *
 * Removes a single action by id. No-ops if the id is not found.
 *
 * @param {string} id
 */
export function dequeueAction(id) {
  const queue = readRaw().filter((item) => item.id !== id);
  writeRaw(queue);
}

/**
 * clearQueue
 *
 * Removes all queued actions.
 */
export function clearQueue() {
  writeRaw([]);
}

/**
 * getQueueLength
 *
 * Returns the current number of queued actions without deserialising them.
 *
 * @returns {number}
 */
export function getQueueLength() {
  return readRaw().length;
}

/**
 * incrementAttempts
 *
 * Increments the attempts counter for a specific action.
 * Used by useSyncQueue to track retry depth.
 *
 * @param {string} id
 */
export function incrementAttempts(id) {
  const queue = readRaw().map((item) =>
    item.id === id ? { ...item, attempts: item.attempts + 1 } : item
  );
  writeRaw(queue);
}
