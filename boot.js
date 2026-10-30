/* Boot + safety net. Kept as an external file (not inline) so the page can forbid inline <script> elements in its Content-Security-Policy.
   The safety net never swallows an error: it is logged and still reaches the console / test runners. It only adds a calm message for the medic. */
(function () {
  'use strict';
  function he() { try { return (window.ShowcaseI18n && window.ShowcaseI18n.lang) === 'he'; } catch (e) { return false; } }
  var lastNote = 0;
  function note() {
    var now = Date.now(); if (now - lastNote < 8000) return; lastNote = now;
    try {
      var m = document.getElementById('tst-m'), t = document.getElementById('tst');
      if (!m || !t) return;
      m.textContent = he() ? 'משהו השתבש. הנתונים נשמרו במסך. אפשר להמשיך, או לאפס את הדמו מהתפריט.' : 'Something went wrong. Your data is still on screen. Carry on, or reset the demo from the menu.';
      t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('on'); }, 6000);
    } catch (e) { /* the notice itself must never throw */ }
  }
  window.addEventListener('error', function (ev) { if (ev && ev.target && ev.target !== window) return; note(); });   // script errors only, not resource 404s
  window.addEventListener('unhandledrejection', function () { note(); });

  // If the first render failed completely, show a plain message with a reload button instead of an empty screen.
  function blankGuard() {
    var c = document.getElementById('incident-content');
    if (!c || c.firstElementChild) return;
    var d = document.createElement('div'); d.className = 'boot-fail'; d.setAttribute('role', 'alert');
    d.style.cssText = 'padding:24px;font:600 18px/1.4 Inter,Heebo,system-ui,sans-serif;color:#fff;text-align:center';
    var p = document.createElement('p'); p.textContent = he() ? 'האפליקציה לא נטענה. נסו לרענן.' : 'The app did not load. Please reload.';
    var b = document.createElement('button'); b.className = 'xbtn xbtn-primary'; b.textContent = he() ? 'רענון' : 'RELOAD';
    b.style.cssText = 'margin-top:16px;min-height:56px;min-width:160px;font-size:18px'; b.addEventListener('click', function () { location.reload(); });
    d.appendChild(p); d.appendChild(b); c.appendChild(d);
  }

  window.addEventListener('DOMContentLoaded', function () {
    try { Demo.boot(); } finally { Disclaimer.gate(); }   // an error in boot still propagates, but the medical notice is never skipped
    setTimeout(blankGuard, 1500);
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(function (e) { console.warn('Offline mode unavailable:', e && e.message); });
    // when a new version takes over, reload once so nobody keeps looking at the previous build
    var hadCtrl = !!navigator.serviceWorker.controller, reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (hadCtrl && !reloaded) { reloaded = true; location.reload(); } });
  }
})();

// Privacy: the browser's Web Speech API streams microphone audio to the browser vendor's cloud (Chrome -> Google). A medical demo must not
// send voice anywhere, so dictation is switched off here. (The mic button stays so the layout is unchanged; it explains why it is off.)
window.startSpeechNote = function () {
  var he = (window.ShowcaseI18n && window.ShowcaseI18n.lang) === 'he';
  if (window.toast) window.toast(he ? 'הקלדה קולית כבויה בדמו: היא שולחת שמע לענן של הדפדפן.' : 'Voice dictation is off in this demo: browsers send the audio to a cloud service.');
};
