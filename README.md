# Shomer Ahi — Showcase

A login-free, static demo of the medical half of Shomer Ahi, built to be understood in under a minute:

- **Form 101** digital casualty card: body map, vitals with trends, MARCH-ordered care log, medication prep sheets, decision support (shock, TBI, drug time windows), MIST+ / radio handoff and a printable record.
- **Two ways to start:** ONE PATIENT opens the full Form 101; MANY CASUALTIES opens QUICK TRIAGE (the book's S-A-B-C steps as yes/no questions: URGENT, NOT URGENT or WAITING in seconds). A quick record can be upgraded to a full Form 101 later. Every record is labelled FULL or QUICK.
- **Field panel** with big buttons for gloved hands: triage colour, tourniquet clock, MARCH tiles, vitals keypad, GIVE NOW drugs with undo, adaptive WHAT TO DO NEXT, and tap-to-measure heart rate and breathing.
- **Evacuation board** (ambulances, hospitals, ETA countdown, driver view, pre-alert text) and a command board with triage colours.
- **QR wristbands**: each casualty gets a printable bracelet whose QR code carries a compact copy of their record. Scan it (in-app camera scanner, or any phone camera when deployed) and the record opens — no server, no network.
- **60-second guided tour**, English / Hebrew switch (RTL aware), installable and offline after the first load.

**EARLY BETA. DO NOT USE.** Not a medical device, not for combat or clinical use. Recommendations are produced by code from measurements and can be wrong; only medical professionals may apply medical recommendations. All patients are fictional. A notice is shown on first visit and the BETA badge in the top bar reopens it. Clinical logic was reviewed against the IDF Trauma and Operational Medicine Book (Jan 2026) by AI, not signed off by a clinician; Hebrew-to-English translations are unreviewed. The folder is self-contained: nothing in `beta/`, `magen/` or the root app is modified.

## Run locally
```
cd showcase
python -m http.server 8080      # then open http://localhost:8080/
```
The camera scanner needs `localhost` or HTTPS. On a phone, open the deployed URL (the desktop page shows a QR for it).

## Install as a phone app
The site is an installable PWA (manifest, PNG icons, service worker, standalone full screen, offline after first load).
- **Android / Chrome:** an INSTALL banner appears, or Menu > Install as an app.
- **iPhone / iPad (Safari):** Share > Add to Home Screen (the app shows the steps).
The service worker is network-first, so a new deploy shows up on the next load; the cache is only the offline fallback. Bump `CACHE` in `sw.js` when adding files.

## Deploy
- **Vercel:** import the repo, set *Root Directory* to `showcase`, preset *Other*, no build step (`vercel.json` included).
- **GitHub Pages:** serve the `showcase/` folder from a public repo or a Pages workflow (Pages is disabled on private repos on the free plan).

Deep links: `?tab=mci|casualties|bracelets`, `?tour=1`. A scanned bracelet opens `…/#b=<serial>.<payload>`.

## Layout
| File | Purpose |
|---|---|
| `index.html`, `app.css`, `ui.css`, `form.css`, `stress.css`, `field.css`, `chrome.css`, `disclaimer.css` | Shell and design system. `stress.css` holds the size floors (targets 48px+, text 16px+, icons 24px+) |
| `shell.js` | Demo host: in-memory store, 4 tabs, overview, lists, app bar auto-hide, controller |
| `field.js`, `next.js` | Field panel, drugs, keypad, undo; adaptive next steps and tap-to-measure |
| `quick.js` | Quick triage (mass casualty) |
| `evac.js` | Evacuation board, transport screen, ETA |
| `enhance.js`, `polish.js` | Reorganise the engine form; flatten decoration, emoji to icons, a11y |
| `bracelet.js` | QR payload, bracelet design, print, camera scanner, scan card |
| `disclaimer.js` | First-visit notice and warnings on prints/copies |
| `tour.js`, `scenario.js` | 13-step tour; fictional bus-stop incident, 6 casualties |
| `i18n.js`, `i18n-dict.js` | Display-layer Hebrew to English |
| `shared/` | **Copy** of the engine with medical fixes. It has diverged from `../shared/` |
| `host.ported.js` | Generated from `beta/app.js` by `tools/port.sh` |
| `vendor/`, `ui-icons.js` | qrcode-generator (MIT), jsQR (Apache-2.0); Lucide icons (ISC) |
| `sw.js`, `manifest.webmanifest`, `vercel.json`, `boot.js` | Offline cache, install metadata, security headers, boot and error safety net |

## Security and privacy
- **No data leaves the device.** No analytics, no remote scripts, fonts are self-hosted (`fonts/`, SIL OFL), nothing is sent anywhere. The only outbound link is the user-tapped WhatsApp share (`wa.me`, opened with `noopener,noreferrer`). Browser voice dictation is disabled because browsers stream the audio to a cloud service.
- **Content-Security-Policy** is set as a `<meta>` in `index.html` (GitHub Pages cannot send headers) and as real headers in `vercel.json`. `frame-ancestors`, HSTS, COOP/CORP and `X-Frame-Options` only work as headers; on GitHub Pages they cannot be set.
- **Residual risk:** the engine uses inline `onclick` handlers, so `script-src-attr` and `style-src` must keep `'unsafe-inline'`. Inline `<script>` elements, remote scripts, frames, objects and `<base>` are blocked.
- **Wristband links and QR codes are untrusted input.** `bracelet.js` caps size (6000 chars), accepts only the base64url alphabet, and runs every decoded field through a strict schema (`csnap`: enums, bounded numbers, bounded and sanitised strings). A card decoded from a link or QR is labelled UNVERIFIED and is never saved to the casualty list. The QR data is not encrypted or signed.
- **Vendor integrity (SHA-256):** `vendor/qrcode.min.js` 164fc2c1c9eaf0a03aa8dfdb855e82e41a5c6922fbad8bb3238116207e26bef7, `vendor/jsQR.min.js` bc40c8a15196236b2314db0856f72ca0b49980cd5413b8c852a7349f5fee0859. Both are served from the same origin.
- **Service worker** caches only same-origin, complete (200, basic) GET responses without a query string; errors and opaque responses are never cached.

## Gotchas
Class names `.ic .cc .btn .seg .dot .skip` collide with the engine CSS; the showcase uses `.ui-i .ccard .xbtn .lang-seg .sdot .skip-link`. The engine keys on Hebrew text, so new UI strings use `L(en, he)`.
