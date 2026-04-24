import { useState, useEffect, useRef } from 'react';

const STORAGE_KEY        = 'mh_pwa_install_dismissed';
export const SNOOZE_DAYS = 3;
const SNOOZE_MS          = SNOOZE_DAYS * 24 * 60 * 60 * 1000;

function isInstalled() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function detectPlatform() {
  const ua = navigator.userAgent;
  const isIos     = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  // iOS must be Safari (Chrome on iOS doesn't support PWA install)
  const isIosSafari = isIos && /safari/i.test(ua) && !/crios|fxios/i.test(ua);
  return { isIos, isIosSafari, isAndroid };
}

function isDismissed() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const { dismissedAt } = JSON.parse(raw);
    return Date.now() - dismissedAt < SNOOZE_MS;
  } catch {
    return false;
  }
}

function saveDismiss() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ dismissedAt: Date.now() }));
  } catch {
    // ignore
  }
}

/**
 * usePwaInstall
 *
 * Returns everything the banner needs:
 *   show         — whether to render the banner at all
 *   platform     — 'ios' | 'android' | null
 *   canPrompt    — Android native install prompt is available
 *   promptInstall() — trigger native Android prompt
 *   dismiss()    — snooze for 3 days
 */
export default function usePwaInstall() {
  const [show,      setShow]      = useState(false);
  const [platform,  setPlatform]  = useState(null);
  const [canPrompt, setCanPrompt] = useState(false);
  const deferredPrompt            = useRef(null);

  useEffect(() => {
    if (isInstalled() || isDismissed()) return;

    const { isIosSafari, isAndroid } = detectPlatform();

    if (isIosSafari) {
      setPlatform('ios');
      setShow(true);
    } else if (isAndroid) {
      setPlatform('android');
      // Android: wait for beforeinstallprompt — may fire immediately or not at all
      const handler = (e) => {
        e.preventDefault();
        deferredPrompt.current = e;
        setCanPrompt(true);
        setShow(true);
      };
      window.addEventListener('beforeinstallprompt', handler);

      // Show manual instructions after 1.5s if prompt hasn't fired
      const fallback = setTimeout(() => {
        if (!deferredPrompt.current) setShow(true);
      }, 1500);

      return () => {
        window.removeEventListener('beforeinstallprompt', handler);
        clearTimeout(fallback);
      };
    }
  }, []);

  async function promptInstall() {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    deferredPrompt.current = null;
    setCanPrompt(false);
    if (outcome === 'accepted') {
      setShow(false);
    } else {
      dismiss();
    }
  }

  function dismiss() {
    saveDismiss();
    setShow(false);
  }

  return { show, platform, canPrompt, promptInstall, dismiss };
}
