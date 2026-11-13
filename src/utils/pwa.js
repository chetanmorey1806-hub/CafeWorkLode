import { useEffect, useState } from 'react';

/** Captures the browser's "Add to Home screen" prompt so we can show our own Install button. */
let deferred = null;
const listeners = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    listeners.forEach((l) => l(true));
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l(false));
  });
}

export function useInstallPrompt() {
  const [can, setCan] = useState(!!deferred);
  useEffect(() => {
    listeners.add(setCan);
    return () => listeners.delete(setCan);
  }, []);
  const install = async () => {
    if (!deferred) return false;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    setCan(false);
    return outcome === 'accepted';
  };
  return { canInstall: can, install };
}

/** Same-browser sync channel (works without any server). */
export const SYNC_CHANNEL = 'soffity-sync';
export const STAFF_STORE_KEY = 'cafe-software-v1';
