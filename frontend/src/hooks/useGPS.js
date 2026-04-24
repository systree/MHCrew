import { useState, useEffect, useRef, useCallback } from 'react';
import { locationsApi } from '../services/api.js';
import useOnlineStatus from './useOnlineStatus.js';

// Statuses where location tracking is active
const ACTIVE_STATUSES    = ['enroute', 'arrived', 'in_progress'];
// Statuses where periodic interval tracking runs
const INTERVAL_STATUSES  = ['enroute', 'in_progress'];
// Terminal statuses — no tracking
const TERMINAL_STATUSES  = ['completed', 'cancelled'];

const INTERVAL_MS        = 10 * 60 * 1000; // 10 minutes

const GEO_OPTIONS = {
  enableHighAccuracy: false, // battery-efficient
  timeout:            10_000,
  maximumAge:         30_000,
};

function queueKey(jobId) {
  return `gps_queue_${jobId}`;
}

function readQueue(jobId) {
  try {
    const raw = localStorage.getItem(queueKey(jobId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(jobId, queue) {
  try {
    localStorage.setItem(queueKey(jobId), JSON.stringify(queue));
  } catch {
    // localStorage full or unavailable — swallow silently
  }
}

function enqueue(jobId, entry) {
  const queue = readQueue(jobId);
  queue.push(entry);
  writeQueue(jobId, queue);
}

function clearQueue(jobId) {
  try {
    localStorage.removeItem(queueKey(jobId));
  } catch {
    // swallow
  }
}

/**
 * useGPS
 *
 * Manages GPS location capture for a specific job. Handles:
 *   - Permission negotiation
 *   - Automatic captures on status changes (enroute / arrived / in_progress)
 *   - 10-minute interval captures while enroute or in_progress
 *   - Offline queue (localStorage) flushed when connectivity is restored
 *
 * @param {string|number|null} jobId
 * @param {string|null}        jobStatus
 */
export function useGPS(jobId, jobStatus) {
  const [permissionStatus, setPermissionStatus] = useState('unknown');
  const [lastLocation, setLastLocation]         = useState(null);

  const isOnline        = useOnlineStatus();
  const prevStatusRef   = useRef(null);
  const intervalRef     = useRef(null);
  const isFlushing      = useRef(false);

  // ---------------------------------------------------------------------------
  // Core: get current position as a Promise
  // ---------------------------------------------------------------------------
  const getCurrentPosition = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new DOMException('Geolocation unavailable', 'NOT_SUPPORTED'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, GEO_OPTIONS);
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Permission bootstrap — request once on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!navigator.geolocation) {
      setPermissionStatus('unavailable');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      () => setPermissionStatus('granted'),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionStatus('denied');
        } else {
          // Timeout / unavailable on first probe — still potentially usable
          setPermissionStatus('granted');
        }
      },
      GEO_OPTIONS
    );
  }, []); // run once

  // ---------------------------------------------------------------------------
  // Flush offline queue when we come back online
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isOnline || !jobId || isFlushing.current) return;

    const queue = readQueue(jobId);
    if (queue.length === 0) return;

    isFlushing.current = true;

    (async () => {
      const remaining = [];
      for (const entry of queue) {
        try {
          await locationsApi.log(jobId, entry);
        } catch {
          // Keep failed entries for next flush attempt
          remaining.push(entry);
        }
      }
      if (remaining.length > 0) {
        writeQueue(jobId, remaining);
      } else {
        clearQueue(jobId);
      }
      isFlushing.current = false;
    })();
  }, [isOnline, jobId]);

  // ---------------------------------------------------------------------------
  // captureLocation — the core capture function
  // ---------------------------------------------------------------------------
  const captureLocation = useCallback(
    async (triggerEvent) => {
      // Privacy guard — only capture for active, non-terminal statuses
      if (!jobId) return null;
      if (!jobStatus || TERMINAL_STATUSES.includes(jobStatus)) return null;
      if (!ACTIVE_STATUSES.includes(jobStatus)) return null;

      if (permissionStatus === 'denied' || permissionStatus === 'unavailable') {
        return null;
      }

      let position;
      try {
        position = await getCurrentPosition();
        setPermissionStatus('granted');
      } catch (err) {
        // PERMISSION_DENIED
        if (err.code === 1) setPermissionStatus('denied');
        // POSITION_UNAVAILABLE (2) or TIMEOUT (3) — silent, don't change status
        return null;
      }

      const { latitude, longitude, accuracy } = position.coords;
      const payload = { latitude, longitude, accuracy, triggerEvent };

      const locationSnapshot = { latitude, longitude, timestamp: new Date().toISOString() };
      setLastLocation(locationSnapshot);

      if (!isOnline) {
        // Queue for later
        enqueue(jobId, payload);
        return locationSnapshot;
      }

      try {
        await locationsApi.log(jobId, payload);
      } catch {
        // Network error despite isOnline — queue as fallback
        enqueue(jobId, payload);
      }

      return locationSnapshot;
    },
    [jobId, jobStatus, permissionStatus, isOnline, getCurrentPosition]
  );

  // ---------------------------------------------------------------------------
  // Automatic status-change captures
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = jobStatus;

    if (!jobStatus || !jobId) return;

    if (jobStatus === 'enroute'     && prev !== 'enroute')     captureLocation('enroute');
    if (jobStatus === 'arrived'     && prev !== 'arrived')     captureLocation('arrived');
    if (jobStatus === 'in_progress' && prev !== 'in_progress') captureLocation('in_transit');
  }, [jobStatus, jobId, captureLocation]);

  // ---------------------------------------------------------------------------
  // Interval tracking — every 10 minutes while enroute or in_progress,
  // but only when the tab is visible
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const shouldTrack = jobId && INTERVAL_STATUSES.includes(jobStatus);

    if (!shouldTrack) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Only tick when tab is visible
    const tick = () => {
      if (document.visibilityState === 'visible') {
        captureLocation('interval');
      }
    };

    intervalRef.current = setInterval(tick, INTERVAL_MS);

    // Pause/resume interval based on tab visibility
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        // Tab became visible again — restart interval
        if (!intervalRef.current) {
          intervalRef.current = setInterval(tick, INTERVAL_MS);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [jobId, jobStatus, captureLocation]);

  return {
    permissionStatus,
    lastLocation,
    captureLocation,
  };
}
