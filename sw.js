/* Offline shell. Install is tolerant (one missing file never blocks the worker), and files are served
   network-first so a deployed update shows up immediately; the cache is only the offline fallback. */
const CACHE = 'shomer-showcase-36312826';
const ASSETS = ['./', 'index.html', 'app.bundle.css', 'app.bundle.js', 'manifest.webmanifest', 'shared/logo-shield.svg', 'vendor/jsQR.min.js', 'og.png', 'fonts/fonts.css', 'fonts/heebo-hebrew.woff2', 'fonts/heebo-latin-ext.woff2', 'fonts/heebo-latin.woff2', 'fonts/inter-latin.woff2', 'fonts/OFL.txt', 'icons/apple-touch-icon.png', 'icons/favicon-32.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(a => c.add(new Request(a, { cache: 'reload' })).catch(() => null)))).then(() => self.skipWaiting()));   // install straight from the network, never a stale HTTP-cache copy
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== CACHE).map(n => caches.delete(n)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, u = new URL(req.url);
  // Same-origin GET only. Cross-origin, POST and anything else is left to the browser untouched.
  if (req.method !== 'GET' || u.origin !== location.origin) return;
  // Never cache URLs that carry a query string (a crafted ?x=random link must not grow or poison the cache);
  // a navigation falls back to the cached app shell instead.
  const nav = req.mode === 'navigate', ver = /^\?v=[0-9a-z]+$/i.test(u.search), cacheable = !u.search || ver;
  // versioned assets (?v=N) are stored under their plain path, so the offline copy is found whatever the version
  const key = ver ? u.origin + u.pathname : req;
  e.respondWith(caches.open(CACHE).then(async c => {
    try {
      const r = await fetch(req, { cache: 'no-cache' });
      // only complete, successful, same-origin ("basic") responses are stored; errors, redirects, partial and opaque ones are not
      if (cacheable && r && r.status === 200 && r.type === 'basic') c.put(key, r.clone()).catch(() => null);
      return r;
    } catch (err) {
      const hit = (await c.match(req, { ignoreSearch: true })) || (nav ? (await c.match('./')) || (await c.match('index.html')) : null);
      if (hit) return hit;
      throw err;
    }
  }));
});
