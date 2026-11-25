/* Rollback: no fetch listener. Existing clients also fall back to the real origin. */
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 await self.clients.claim();
 await self.registration.unregister();
})()));
