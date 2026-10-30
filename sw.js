/* Offline shell. Install is tolerant (one missing file never blocks the worker), and files are served
   network-first so a deployed update shows up immediately; the cache is only the offline fallback. */
const CACHE = 'shomer-showcase-v18';
const ASSETS = ['./', 'index.html', 'app.css', 'ui.css', 'form.css', 'disclaimer.css', 'stress.css', 'field.css', 'chrome.css', 'shared/medical-forms.css',
  'shared/core.js', 'shared/icons.js', 'shared/medical-forms.js', 'host.ported.js', 'ui-icons.js', 'i18n-dict.js', 'i18n.js', 'scenario.js',
  'disclaimer.js', 'bracelet.js', 'enhance.js', 'field.js', 'next.js', 'quick.js', 'xcare.js', 'timeline.js', 'swipe.js', 'pwa.js', 'appbar.js', 'xcare.css', 'pwa.css', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png', 'evac.js', 'shell.js', 'polish.js', 'tour.js',
  'vendor/qrcode.min.js', 'vendor/jsQR.min.js', 'shared/logo-shield.svg', 'manifest.webmanifest',
  'boot.js', 'fonts/fonts.css', 'fonts/inter-latin.woff2', 'fonts/heebo-latin.woff2', 'fonts/heebo-latin-ext.woff2', 'fonts/heebo-hebrew.woff2'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => null)))).then(() => self.skipWaiting()));
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
  const nav = req.mode === 'navigate', cacheable = !u.search;
  e.respondWith(caches.open(CACHE).then(async c => {
    try {
      const r = await fetch(req, { cache: 'no-cache' });
      // only complete, successful, same-origin ("basic") responses are stored; errors, redirects, partial and opaque ones are not
      if (cacheable && r && r.status === 200 && r.type === 'basic') c.put(req, r.clone()).catch(() => null);
      return r;
    } catch (err) {
      const hit = (await c.match(req, { ignoreSearch: true })) || (nav ? (await c.match('./')) || (await c.match('index.html')) : null);
      if (hit) return hit;
      throw err;
    }
  }));
});
