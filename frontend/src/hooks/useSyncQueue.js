/**
 * useSyncQueue
 *
 * Flushes the offline action queue whenever connectivity is restored.
 *
 * - Listens for the online → offline → online transition via useOnlineStatus.
 * - Processes queued actions sequentially (one at a time) to avoid
 *   overwhelming the server when reconnecting after a long outage.
 * - On success:  dequeues the action.
 * - On failure:  increments the attempts counter; after 3 failed attempts the
 *               action is dropped (give-up policy).
 * - Fires exactly once per online event, not on every render.
 *
 * @returns {{ queueLength: number, isSyncing: boolean }}
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import useOnlineStatus from './useOnlineStatus.js';
import {
  getQueue,
  dequeueAction,
  incrementAttempts,
  getQueueLength,
} from '../utils/offlineQueue.js';
import { jobsApi, locationsApi } from '../services/api.js';

const MAX_ATTEMPTS = 3;

export function useSyncQueue() {
  const isOnline   = useOnlineStatus();
  const [isSyncing,   setIsSyncing]   = useState(false);
  const [queueLength, setQueueLength] = useState(() => getQueueLength());

  // Track previous online state so we only flush on the false → true edge,
  // not on every render while the user is already online.
  const prevOnlineRef = useRef(isOnline);

  // Stable flush function — recreated only when isOnline changes.
  const flush = useCallback(async () => {
    const queue = getQueue();
    if (queue.length === 0) return;

    setIsSyncing(true);

    let succeeded = 0;
    let failed    = 0;

    for (const action of queue) {
      try {
        await dispatchAction(action);
        dequeueAction(action.id);
        succeeded++;
      } catch (err) {
        console.warn(`[useSyncQueue] Action ${action.id} (${action.type}) failed:`, err?.message ?? err);
        incrementAttempts(action.id);

        // Re-read the updated action to get the current attempts count
        const updated = getQueue().find((a) => a.id === action.id);
        if (updated && updated.attempts >= MAX_ATTEMPTS) {
          console.warn(
            `[useSyncQueue] Giving up on action ${action.id} after ${MAX_ATTEMPTS} attempts.`
          );
          dequeueAction(action.id);
        }
        failed++;
      }
    }

    console.info(
      `[useSyncQueue] Sync complete — ${succeeded} succeeded, ${failed} failed.`
    );

    // Update the reactive queue length after the flush.
    setQueueLength(getQueueLength());
    setIsSyncing(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh the displayed queue length whenever online state changes so the
  // banner always reflects what's actually stored.
  useEffect(() => {
    setQueueLength(getQueueLength());
  }, [isOnline]);

  // Only trigger a flush on the offline → online edge.
  useEffect(() => {
    const wasOffline = prevOnlineRef.current === false;
    prevOnlineRef.current = isOnline;

    if (isOnline && wasOffline) {
      flush();
    }
  }, [isOnline, flush]);

  return { queueLength, isSyncing };
}

// ------------------------------------------------------------------ //
//  Internal: route an action to the correct API call                  //
// ------------------------------------------------------------------ //

async function dispatchAction(action) {
  const { type, payload } = action;

  switch (type) {
    case 'STATUS_UPDATE': {
      const { jobId, status, notes, cancellationReason } = payload;
      await jobsApi.updateStatus(jobId, status, notes, cancellationReason);
      break;
    }

    case 'LOCATION_LOG': {
      const { jobId, locationData } = payload;
      await locationsApi.log(jobId, locationData);
      break;
    }

    default:
      // Unknown type — log and skip rather than crash.
      console.warn(`[useSyncQueue] Unknown action type "${type}" — skipping.`);
      break;
  }
}
