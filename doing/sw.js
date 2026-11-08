const CACHE = 'my-doing-v0.22-2026-11-08';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-512-maskable.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Web Share Target (POST): stash what was shared (text and/or a .vcf contact) and bounce to the app
  if (e.request.method === 'POST' && url.pathname.endsWith('/share')) {
    e.respondWith((async () => {
      try {
        const fd = await e.request.formData();
        const files = fd.getAll('files');
        let vcf = '';
        for (const f of files) { if (f && f.text) vcf += await f.text() + '\n'; }
        const payload = { title: fd.get('title') || '', text: fd.get('text') || '', url: fd.get('url') || '', vcf, at: Date.now() };
        const c = await caches.open('share-inbox');
        await c.put('./__shared', new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json' } }));
      } catch (err) {}
      return Response.redirect('./?shared=1', 303);
    })());
    return;
  }
  if (e.request.method !== 'GET') return;
  if (url.origin !== location.origin) return; // API calls, fonts: straight to network
  // inbox.json: network first, never cached
  if (url.pathname.endsWith('/inbox.json') || url.pathname.endsWith('/version.txt') || url.pathname.endsWith('/backup.json') || url.pathname.endsWith('/outbox.json')) {
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
