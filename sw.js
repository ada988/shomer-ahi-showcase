/* Offline shell. Install is tolerant (one missing file never blocks the worker), and files are served
   stale-while-revalidate so a deployed update shows up on the next load instead of staying cached forever. */
const CACHE = 'shomer-showcase-v7';
const ASSETS = ['./', 'index.html', 'app.css', 'ui.css', 'form.css', 'disclaimer.css', 'stress.css', 'field.css', 'chrome.css', 'shared/medical-forms.css',
  'shared/core.js', 'shared/icons.js', 'shared/medical-forms.js', 'host.ported.js', 'ui-icons.js', 'i18n-dict.js', 'i18n.js', 'scenario.js',
  'disclaimer.js', 'bracelet.js', 'enhance.js', 'field.js', 'next.js', 'quick.js', 'xcare.js', 'swipe.js', 'xcare.css', 'evac.js', 'shell.js', 'polish.js', 'tour.js',
  'vendor/qrcode.min.js', 'vendor/jsQR.min.js', 'shared/logo-shield.svg', 'manifest.webmanifest'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== CACHE).map(n => caches.delete(n)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r && r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
