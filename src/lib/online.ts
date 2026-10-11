/** Web: call back with true/false when the connection comes and goes (browser online/offline events). */
export function watchOnline(cb: (online: boolean) => void) {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return () => {};
  const on = () => cb(true);
  const off = () => cb(false);
  cb(navigator.onLine !== false);
  window.addEventListener('online', on);
  window.addEventListener('offline', off);
  return () => {
    window.removeEventListener('online', on);
    window.removeEventListener('offline', off);
  };
}
