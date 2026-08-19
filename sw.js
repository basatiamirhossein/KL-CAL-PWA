const CACHE='kabirtool-pwa-v1';
const ASSETS=['./','./index.html','./manifest.webmanifest','./favicon.png','./apple-touch-icon-120.png','./apple-touch-icon-152.png','./apple-touch-icon-167.png','./apple-touch-icon-180.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(x=>{let copy=x.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return x}).catch(()=>caches.match('./index.html'))))});