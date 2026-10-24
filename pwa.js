/* Install as a phone app. Android/desktop Chrome: real install prompt. iPhone/iPad: step-by-step "Add to Home Screen" sheet.
   Offers itself once in a bottom banner and always in the menu. Hidden when already running as an installed app. */
(function(){
'use strict';
var W = window, deferred = null, KEY = 'sa_pwa_dismissed';
function lang(){ return (W.ShowcaseI18n && W.ShowcaseI18n.lang) || 'en'; }
function L(en, he){ return lang() === 'he' ? he : en; }
function ico(n, s){ return W.Icon ? W.Icon(n, s) : ''; }
var standalone = (W.matchMedia && W.matchMedia('(display-mode: standalone)').matches) || W.navigator.standalone === true;
var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
var mobile = W.matchMedia && W.matchMedia('(max-width: 900px)').matches;
function get(k){ try { return localStorage.getItem(k); } catch (e) { return null; } }
function set(k, v){ try { localStorage.setItem(k, v); } catch (e) {} }
if (standalone) document.documentElement.classList.add('is-app');

W.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); deferred = e; schedule(); });
W.addEventListener('appinstalled', function(){ deferred = null; remove(); set(KEY, '1'); });

function remove(){ var b = document.getElementById('pwa-bar'); if (b) b.remove(); var s = document.getElementById('pwa-sheet'); if (s) s.remove(); }
function iosSheet(){
  remove();
  var s = document.createElement('div'); s.id = 'pwa-sheet'; s.className = 'sheet-wrap no-polish';
  s.innerHTML = '<div class="sheet-dim" onclick="PWA.close()"></div><div class="sheet" role="dialog" aria-label="' + L('Install the app','התקנת האפליקציה') + '"><div class="sheet-grab"></div><h3>' + L('Install on your phone','התקנה בטלפון') + '</h3>'
    + '<ol class="pwa-steps">'
    + '<li><b>1</b><span>' + (ios ? L('Tap the Share button in Safari (square with an arrow).','לחצו על כפתור השיתוף ב-Safari (ריבוע עם חץ).') : L('Open the browser menu (three dots).','פתחו את תפריט הדפדפן (שלוש נקודות).')) + '</span></li>'
    + '<li><b>2</b><span>' + (ios ? L('Choose “Add to Home Screen”.','בחרו “הוסף למסך הבית”.') : L('Choose “Install app” or “Add to Home screen”.','בחרו “התקן אפליקציה” או “הוסף למסך הבית”.')) + '</span></li>'
    + '<li><b>3</b><span>' + L('Open it from the icon. It runs full screen, even without a network.','פתחו מהסמל. היא רצה במסך מלא, גם בלי רשת.') + '</span></li></ol>'
    + '<button class="xbtn xbtn-primary pwa-ok" onclick="PWA.close()">' + L('GOT IT','הבנתי') + '</button></div>';
  (document.getElementById('app') || document.body).appendChild(s);
}
function install(){
  if (deferred){ var d = deferred; deferred = null; d.prompt(); d.userChoice.finally(function(){ remove(); }); }
  else iosSheet();
}
function bar(){
  if (standalone || get(KEY) || document.getElementById('pwa-bar') || !mobile) return;
  var b = document.createElement('div'); b.id = 'pwa-bar'; b.className = 'pwa-bar no-polish'; b.setAttribute('role', 'region'); b.setAttribute('aria-label', L('Install the app','התקנת האפליקציה'));
  b.innerHTML = '<span class="pwa-i">' + ico('smartphone', 30) + '</span><span class="pwa-t"><b>' + L('Install as an app','התקנה כאפליקציה') + '</b><small>' + L('Full screen, works offline','מסך מלא, עובד בלי רשת') + '</small></span><button class="pwa-go" onclick="PWA.install()">' + L('INSTALL','התקן') + '</button><button class="pwa-x" aria-label="' + L('Not now','לא עכשיו') + '" onclick="PWA.dismiss()">' + ico('x', 24) + '</button>';
  (document.getElementById('app') || document.body).appendChild(b);
}
var timer = null;
function schedule(){ clearTimeout(timer); timer = setTimeout(bar, 4000); }
// iOS never fires beforeinstallprompt, so offer the instructions after a short while
if (!standalone && mobile && ios) schedule();
else if (!standalone && mobile) timer = setTimeout(function(){ if (!deferred) return; bar(); }, 8000);

W.PWA = {
  install: install,
  dismiss: function(){ set(KEY, '1'); remove(); },
  close: function(){ var s = document.getElementById('pwa-sheet'); if (s) s.remove(); },
  standalone: standalone
};

// menu row (added whenever the menu opens; not shown inside the installed app)
(function wait(){
  if (!W.Demo || !W.Demo.menu){ return setTimeout(wait, 200); }
  var orig = W.Demo.menu;
  W.Demo.menu = function(){
    orig.apply(this, arguments);
    if (standalone) return;
    var sheet = document.querySelector('#menu-sheet .sheet'); if (!sheet || sheet.querySelector('.pwa-row')) return;
    var r = document.createElement('button'); r.className = 'sheet-row pwa-row';
    r.innerHTML = '<span class="gi">' + ico('smartphone', 28) + '</span><span><b>' + L('Install as an app','התקנה כאפליקציה') + '</b><small>' + L('Add to your home screen. Full screen, offline.','הוספה למסך הבית. מסך מלא, גם בלי רשת.') + '</small></span>';
    r.onclick = function(){ W.Demo.closeMenu(); install(); };
    var h3 = sheet.querySelector('.lang-pick'); sheet.insertBefore(r, h3 ? h3.nextSibling : null);
  };
})();
})();
// shortcut deep link: ?quick=1 opens quick triage right away
(function(){
  if (!/[?&]quick=1/.test(location.search)) return;
  var n = 0, t = setInterval(function(){ if (window.Quick && window._incidentCasualties && window._incidentCasualties.length){ clearInterval(t); setTimeout(function(){ window.Quick.open(); }, 400); } else if (++n > 40) clearInterval(t); }, 150);
})();
// A new service worker takes over after a deploy: reload once so old and new files never mix
(function(){
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  var had = !!navigator.serviceWorker.controller, done = false;
  navigator.serviceWorker.addEventListener('controllerchange', function(){ if (!had || done) return; done = true; location.reload(); });
  navigator.serviceWorker.getRegistration().then(function(r){ if (r) r.update(); }).catch(function(){});
})();
