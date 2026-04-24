import { useState, useEffect } from 'react';

/**
 * useOnlineStatus
 *
 * Returns a boolean indicating whether the device currently has network
 * connectivity. Subscribes to the browser's `online` and `offline` events
 * so the value updates reactively without polling.
 *
 * @returns {boolean} isOnline
 */
export default function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
