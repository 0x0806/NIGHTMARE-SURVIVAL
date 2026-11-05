/* Offline support. Code (pages, scripts, styles) is network-first so updates arrive immediately;
   fonts and icons are cache-first. Bump CACHE when the asset list changes. */
const CACHE = 'nightmare-v5';
const ASSETS = ['./', 'index.html', 'style.css', 'script.js', 'js/view3d.js', 'vendor/three.module.min.js', 'vendor/three.core.min.js', 'manifest.webmanifest', 'favicon.svg', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'fonts/IMFellEnglishSC.woff2', 'fonts/SpecialElite.woff2'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const isCode = !url.pathname.includes('/vendor/') && (req.mode === 'navigate' || /\.(html|js|css|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/'));
  e.respondWith(caches.open(CACHE).then(async (c) => {
    if (isCode) {
      try { const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; }
      catch (err) { return (await c.match(req, { ignoreSearch: true })) || (await c.match('index.html')); }
    }
    return (await c.match(req)) || fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; });
  }));
});
