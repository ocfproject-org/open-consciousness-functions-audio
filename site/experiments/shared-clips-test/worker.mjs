// Retire the historical preview registration at its existing script URL.
// No fetch handler: ordinary playback and the site's root worker are unaffected.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => {
  event.waitUntil(self.registration.unregister());
});
