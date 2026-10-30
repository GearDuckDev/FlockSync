export const registerServiceWorker = (): void => {
  if (!import.meta.env?.PROD || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service workers require HTTPS or localhost; plain HTTP LAN access degrades gracefully.
    });
  });
};
