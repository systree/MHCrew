import { useState, useEffect, useCallback, useRef } from 'react';
import { jobsApi } from '../services/api.js';
import { enqueueAction } from '../utils/offlineQueue.js';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function cacheKey(tab) { return `mh_jobs_cache_${tab}`; }

/** Read from localStorage cache — validates data shape before returning */
function readCache(tab) {
  try {
    const raw = localStorage.getItem(cacheKey(tab));
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL) return null;
    if (!Array.isArray(data)) return null;
    if (data.length > 0 && !('scheduled_date' in data[0])) return null;
    return data;
  } catch {
    return null;
  }
}

/** Write to localStorage cache */
function writeCache(tab, data) {
  try {
    localStorage.setItem(cacheKey(tab), JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // localStorage quota — not critical
  }
}

/**
 * useJobs
 *
 * Fetches the crew member's job list and caches it locally so the app
 * remains usable offline. Stale data is shown immediately while a fresh
 * fetch runs in the background (stale-while-revalidate pattern).
 *
 * @returns {{
 *   jobs:              object[],
 *   loading:           boolean,
 *   error:             string|null,
 *   refresh:           () => void,
 *   updateJobStatus:   (jobId: string, status: string, notes?: string, cancellationReason?: string) => Promise<object>,
 * }}
 */
export default function useJobs(tab = 'upcoming') {
  const [jobs, setJobs]       = useState(() => readCache(tab) ?? []);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // Keep a stable ref so fetchJobs never re-creates on param change
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;

  const fetchJobs = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError(null);
    try {
      const { data } = await jobsApi.getMyJobs(tab);
      const list = data?.jobs ?? data ?? [];
      setJobs(list);
      writeCache(tab, list);
    } catch (err) {
      const cached = readCache(tab);
      if (cached) {
        setJobs(cached);
      }
      setError(
        err.response?.data?.message ??
          'Could not fetch jobs. Showing cached data.'
      );
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    const cached = readCache(tab);
    if (cached) {
      setJobs(cached);
      fetchJobs(false); // background revalidation — cache is valid, no spinner
    } else {
      fetchJobs(true);
    }
  }, [fetchJobs, tab]);

  /**
   * updateJobStatus
   *
   * Optimistically updates the job in local state, then:
   *   - If ONLINE:  calls the API immediately; rolls back on failure.
   *   - If OFFLINE: enqueues the action for later sync and returns
   *                 { queued: true } so the caller can show a toast like
   *                 "Saved offline — will sync when reconnected".
   *
   * In both cases the optimistic update is applied immediately so the UI
   * always reflects the intended state.
   */
  const updateJobStatus = useCallback(
    async (jobId, status, notes, cancellationReason) => {
      // Snapshot current list for rollback (online path only)
      const snapshot = jobsRef.current;

      // Always apply optimistic update so the UI feels responsive.
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                status,
                ...(notes !== undefined ? { notes } : {}),
                ...(cancellationReason !== undefined
                  ? { cancellation_reason: cancellationReason }
                  : {}),
              }
            : j
        )
      );

      // --- Offline path ---
      if (!navigator.onLine) {
        enqueueAction({
          type:    'STATUS_UPDATE',
          payload: { jobId, status, notes, cancellationReason },
        });

        // Keep the local cache in sync with the optimistic state so
        // the stale-while-revalidate read on next load shows the right status.
        writeCache(tab,
          jobsRef.current.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  status,
                  ...(notes !== undefined ? { notes } : {}),
                  ...(cancellationReason !== undefined
                    ? { cancellation_reason: cancellationReason }
                    : {}),
                }
              : j
          )
        );

        return { queued: true };
      }

      // --- Online path ---
      try {
        const { data } = await jobsApi.updateStatus(jobId, status, notes, cancellationReason);
        const updatedJob = data?.job ?? data;

        // Replace optimistic entry with the authoritative server record
        setJobs((prev) =>
          prev.map((j) => (j.id === jobId ? { ...j, ...updatedJob } : j))
        );

        // Keep cache in sync
        writeCache(tab,
          jobsRef.current.map((j) => (j.id === jobId ? { ...j, ...updatedJob } : j))
        );

        return updatedJob;
      } catch (err) {
        // Roll back to the snapshot on failure
        setJobs(snapshot);
        throw err;
      }
    },
    [tab]
  );

  return {
    jobs,
    loading,
    error,
    refresh: () => fetchJobs(true),
    updateJobStatus,
  };
}
