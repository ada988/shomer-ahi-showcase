# Shomer Ahi

A digital casualty card (IDF Form 101) for combat medics and paramedics, built as an offline-first web app.

**Live demo:** https://ada988.github.io/shomer-ahi-showcase/ — no login, fictional casualties.

> **Early beta, for demonstration only.** Not a medical device and not for clinical or operational use. All casualties are fictional. Suggestions are produced by software from the values entered and can be wrong; only a qualified medical professional makes medical decisions. Clinical rules follow the IDF Trauma and Operational Medicine Book (January 2026) but have not been validated or signed off by a clinician.

## What it does

- **Form 101 on a phone.** Triage, injury time, vitals, GCS and pupils, body map with wound marking, procedures (airway, breathing, circulation) and IV/IO access.
- **X-CARE guidance.** The next step in the book's order, ticked automatically from what is recorded.
- **Automatic treatment timeline.** Every action is logged with its time; times can be edited, and every action can be undone.
- **Dose calculator.** Weight- and age-based doses from the IDF trauma book, dilution and syringe drawn to the exact volume, per-drug warnings, a read-back step before anything is recorded, and repeat timers. It reads the casualty's findings and lists what to give, what changes and what not to give.
- **Mass-casualty mode.** Quick triage as yes/no questions, a command board, and an evacuation board with ambulances, hospitals and arrival times.
- **Handoff.** A MIST report, and a QR wristband that carries the record itself: any phone camera can read it, with no app, server or network. Pre-printed tags can be linked to a casualty.
- **Built for stress.** Targets of at least 48 px (main actions 56–64 px), text of at least 16 px, an icon and a word on every button, colour never used alone, a guard against accidental double taps.
- **English and Hebrew** (full right-to-left), installable, and working offline after the first visit.

## Run locally

```
python -m http.server 8080
# then open http://localhost:8080/
```

The camera scanner needs `localhost` or HTTPS.

## How it is built

Plain HTML, CSS and JavaScript with no framework and no build step for development. The published site bundles the stylesheets and scripts into `app.bundle.css` and `app.bundle.js`.

| Area | Files |
|---|---|
| App shell, home, lists, board, menu | `shell.js`, `appbar.js`, `swipe.js`, `home.css`, `board.css`, `chrome.css` |
| Form 101 | `field.js`, `xcare.js`, `timeline.js`, `next.js`, `recommend.js`, `bodyzoom.js`, `enhance.js`, `form.css`, `field.css`, `form-field.css`, `xcare.css`, `recommend.css`, `bodyzoom.css` |
| Clinical engine | `shared/medical-forms.js`, `shared/medical-forms.css`, `host.ported.js` |
| Dose calculator | `dose.js`, `dose.css` |
| Quick triage, evacuation | `quick.js`, `evac.js`, `evac.css` |
| Wristbands, tags, QR, scanner | `bracelet.js`, `wristbands.css` |
| Tour, help, notice | `tour.js`, `help.js`, `disclaimer.js`, `tour.css`, `help.css`, `disclaimer.css` |
| Demo scenario | `scenario.js` (six fictional casualties; clocks are relative to page load) |
| Design system | `app.css` (base tokens), `ui.css`, `stress.css` (glove-sized targets, loaded last), `motion.css`, `polish.js`, `ui-icons.js`, `shared/icons.js` |
| Languages | `i18n.js`, `i18n-dict.js` |
| Desktop page | `landing.js`, `landing.css` |
| Offline and install | `sw.js`, `manifest.webmanifest`, `pwa.js`, `pwa.css`, `boot.js` |
| Third-party | `vendor/` (qrcode-generator, MIT; jsQR, Apache-2.0), Lucide icons (ISC), Inter and Heebo fonts (SIL OFL 1.1). Licence texts: `vendor/LICENSES.txt`, `fonts/OFL.txt` |

## Privacy and security

- No accounts, no analytics, no remote scripts; fonts are self-hosted and nothing is sent anywhere.
- A strict Content-Security-Policy (set in a meta tag, since GitHub Pages cannot send headers) blocks remote scripts, frames and objects.
- Data read from a wristband link or QR code is treated as untrusted: size-capped, schema-validated and labelled unverified. The QR data is not encrypted.
- Browser voice dictation is disabled, because browsers send the audio to a cloud service.

## Licence

Copyright © 2026 Adam Weisman. All rights reserved; see `LICENSE`. Third-party components keep their own licences.
