const CACHE = 'my-doing-v0.12.1-2026-11-07';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-512-maskable.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // API calls, fonts: straight to network
  // inbox.json: network first, never cached
  if (url.pathname.endsWith('/inbox.json') || url.pathname.endsWith('/version.txt')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"tasks":[]}', {headers: {'content-type': 'application/json'}})));
    return;
  }
  // navigations (including share-target URLs with query strings) -> app shell, network first so updates arrive
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(r => { caches.open(CACHE).then(c => c.put('./index.html', r.clone())); return r; }).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(e.request, {ignoreSearch: true}).then(r => r || fetch(e.request).then(res => { caches.open(CACHE).then(c => c.put(e.request, res.clone())); return res; })));
});
