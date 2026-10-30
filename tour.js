/* 60-second guided tour (8 steps): navigates the real app and spotlights the real controls. */
(function(){
'use strict';
var W = window;
function lang(){ return (W.ShowcaseI18n && W.ShowcaseI18n.lang) || 'en'; }
function L(en, he){ return lang() === 'he' ? he : en; }
function ico(n, s){ return W.Icon ? W.Icon(n, s) : ''; }

function ensureForm(){ return W._casualtyEditMode ? Promise.resolve() : W.Demo.go('casualty'); }

var STEPS = [
  { pre: function(){ W.Bracelet.close(true); return W.Demo.tab('status'); }, target:'.ov-tiles', pos:'bottom',
    en:['A live mass-casualty scene','Casualties from a bus-stop attack. Each block is a triage group: shape, word and colour.'],
    he:['זירת אר״ן חיה','נפגעי פיגוע בתחנת אוטובוס. כל בלוק הוא קבוצת מיון: צורה, מילה וצבע.'] },
  { pre: function(){ return W.Demo.tab('status').then(function(){ W.Quick.open(); }); }, target:'.qt-yn', pos:'top',
    en:['Quick triage in seconds','Big YES and NO buttons, one question at a time. A colour in seconds.'],
    he:['מיון מהיר תוך שניות','כפתורי כן ולא גדולים, שאלה אחת בכל פעם. צבע תוך שניות.'] },
  { pre: function(){ if (W.Quick) W.Quick.close(); return W.Demo.go('casualty'); }, target:'.f-id', pos:'bottom', scroll:'start',
    en:['One patient: the full Form 101','Casualty 1 is in shock. Their number, triage and wristband on one strip.'],
    he:['נפגע אחד: טופס 101 מלא','נפגע 1 בהלם. המספר, המיון והצמיד בשורה אחת.'] },
  { pre: ensureForm, target:'.xc-tabs', pos:'bottom', scroll:'center',
    en:['X-CARE, step by step','The IDF 2026 protocol as big rows. Tap a row to tick it, tap the button to act: tourniquet, blood, TXA. Every time is recorded.'],
    he:['X-CARE שלב אחר שלב','פרוטוקול צה״ל 2026 כשורות גדולות. לוחצים על שורה לסימון, ועל הכפתור לביצוע: חוסם עורקים, דם, TXA. כל זמן נרשם.'] },
  { pre: ensureForm, target:'[data-tour=handoff]', pos:'top', scroll:'center',
    en:['Hand off in one tap','A short report with the time-critical items first, a radio script, or a printable Form 101.'],
    he:['העברה בלחיצה','דוח קצר עם הפריטים הקריטיים קודם, תסריט רדיו או טופס 101 להדפסה.'] },
  { pre: function(){ W.Evac.close(); return W.Demo.tab('evac'); }, target:'.next-out, .ev-road', pos:'bottom',
    en:['Load and go','Who goes next, on which ambulance, where, how long. One tap.'],
    he:['העמסה ויציאה','מי יוצא, באיזה אמבולנס, לאן, תוך כמה זמן. לחיצה אחת.'] },
  { pre: function(){ W.Evac && W.Evac.close(); return W.Demo.tab('bracelets'); }, target:'.bt-band .brc2, .bt-band', pos:'bottom',
    en:['A wristband for every casualty','The QR code carries the record. Print it and fasten it to the casualty.'],
    he:['צמיד לכל נפגע','קוד ה-QR נושא את התיק. מדפיסים וחוברים לנפגע.'] },
  { pre: function(){ W.Bracelet.viewCard('demo_c1'); }, target:'.cc-banner', pos:'bottom',
    en:['Anyone can scan it','Any phone camera: triage, what was done and when. No app, no login, no network.'],
    he:['כל אחד יכול לסרוק','כל מצלמת טלפון: מיון, מה בוצע ומתי. בלי אפליקציה, בלי התחברות, בלי רשת.'] }
];

var i = 0, root = null, spot = null, card = null;
function app(){ return document.getElementById('app'); }

function rectIn(el){
  var a = app().getBoundingClientRect(), r = el.getBoundingClientRect();
  return { x: r.left - a.left, y: r.top - a.top, w: r.width, h: r.height, aw: a.width, ah: a.height };
}
function clean(){ if (W.Bracelet) W.Bracelet.close(true); if (W.Evac) W.Evac.close(); if (W.Demo && W.Demo.closeOverlays) W.Demo.closeOverlays(); }
var tok = 0;
function find(sel){ return (document.querySelector('.bo') && document.querySelector('.bo ' + sel)) || document.querySelector(sel); }
function show(n){
  i = Math.max(0, Math.min(STEPS.length - 1, n));
  var s = STEPS[i], my = ++tok;
  clean();
  if (card) card.style.opacity = '.6';
  var go = s.pre ? s.pre() : null;
  var after = function(){
    var tries = 0;
    (function attempt(){
      if (my !== tok || !root) return;
      var t = s.target ? find(s.target) : null;
      if (!t && s.target && tries++ < 8) return setTimeout(attempt, 100);
      if (t){
        var sc = document.getElementById('incident-content');
        if (sc && sc.contains(t)){
          var cr = sc.getBoundingClientRect(), tr = t.getBoundingClientRect();
          sc.scrollTop += s.scroll === 'start' ? tr.top - cr.top - 60 : tr.top - cr.top - (cr.height - tr.height) / 2;
        }
      }
      setTimeout(function(){ if (my === tok && root){ card.style.opacity = ''; draw(find(s.target || '#none'), s); } }, 360);
    })();
  };
  if (go && go.then) go.then(after); else setTimeout(after, 60);
}
function draw(t, s){
  if (!root) return;
  var txt = lang() === 'he' ? s.he : s.en;
  if (t){
    var r = rectIn(t), pad = 6;
    if (r.h > r.ah * .5) r.h = r.ah * .5;   // very tall targets: highlight the top part only
    spot.style.display = 'block';
    spot.style.left = (r.x - pad) + 'px'; spot.style.top = (r.y - pad) + 'px';
    spot.style.width = (r.w + pad * 2) + 'px'; spot.style.height = (r.h + pad * 2) + 'px';
    var below = r.y + r.h / 2 < r.ah / 2;
    card.className = 'tour-card' + (below ? '' : ' top');
    // Put the card on the opposite half of the screen from the spotlight.
    card.style.top = below ? 'auto' : '62px'; card.style.bottom = below ? '70px' : 'auto';
  } else { spot.style.display = 'none'; card.className = 'tour-card'; card.style.top = 'auto'; card.style.bottom = '70px'; }
  var last = i === STEPS.length - 1;
  card.innerHTML = '<div class="tour-step">' + L('Step ','שלב ') + (i + 1) + ' / ' + STEPS.length + '</div><h5>' + txt[0] + '</h5><p>' + txt[1] + '</p>'
    + '<div class="tour-prog">' + STEPS.map(function(_, k){ return '<i class="' + (k <= i ? 'on' : '') + '"></i>'; }).join('') + '</div>'
    + '<div class="tour-nav"><button class="skip" onclick="Tour.stop()">' + W.Icon('x', 22) + L('Skip tour','דלג') + '</button>'
    + (i > 0 ? '<button class="xbtn" onclick="Tour.go(' + (i - 1) + ')">' + W.Icon(document.documentElement.dir === 'rtl' ? 'arrow-right' : 'arrow-left', 22) + L('Back','הקודם') + '</button>' : '')
    + '<button class="xbtn xbtn-primary" onclick="' + (last ? 'Tour.finish()' : 'Tour.go(' + (i + 1) + ')') + '">' + (last ? W.Icon('check', 22) + L('Try it yourself','נסו בעצמכם') : L('Next','הבא') + W.Icon(document.documentElement.dir === 'rtl' ? 'arrow-left' : 'arrow-right', 22)) + '</button></div>';
  // A tall target must not run underneath the card: trim the highlight to the part that stays visible.
  if (t && spot.style.display !== 'none'){
    var a = app().getBoundingClientRect(), cr = card.getBoundingClientRect(), cTop = cr.top - a.top, cBot = cr.bottom - a.top, sTop = parseFloat(spot.style.top), sH = parseFloat(spot.style.height);
    if (card.style.top === 'auto'){ if (sTop < cTop && sTop + sH > cTop - 8) spot.style.height = Math.max(60, cTop - 8 - sTop) + 'px'; }
    else if (sTop < cBot + 8 && sTop + sH > cBot + 8){ var nt = cBot + 8; spot.style.top = nt + 'px'; spot.style.height = Math.max(60, sTop + sH - nt) + 'px'; }
  }
  if (!card.hasAttribute('tabindex')) card.setAttribute('tabindex', '-1');
  try { card.focus({ preventScroll:true, focusVisible:false }); } catch(e){ card.focus({ preventScroll:true }); }
}
function start(){
  stop(true);
  root = document.createElement('div'); root.className = 'tour-dim no-polish'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Guided tour');
  spot = document.createElement('div'); spot.className = 'tour-spot'; root.appendChild(spot);
  card = document.createElement('div'); card.className = 'tour-card'; card.style.pointerEvents = 'auto';
  app().appendChild(root); app().appendChild(card);
  card.style.zIndex = 100030; root.style.zIndex = 100020;
  document.addEventListener('keydown', onKey, true);
  show(0);
}
function stop(silent){
  document.removeEventListener('keydown', onKey, true);
  if (!silent) clean();
  if (root){ root.remove(); root = null; }
  if (card){ card.remove(); card = null; }
}
function finish(){ stop(); W.Bracelet.close(true); W.Demo.tab('status'); }
function onKey(e){
  if (e.key === 'Escape'){ stop(); e.stopPropagation(); }
  var rtl = document.documentElement.dir === 'rtl', fwd = rtl ? 'ArrowLeft' : 'ArrowRight', back = rtl ? 'ArrowRight' : 'ArrowLeft';
  if (e.key === fwd && i < STEPS.length - 1){ show(i + 1); }
  else if (e.key === back && i > 0){ show(i - 1); }
}
W.addEventListener('resize', function(){ if (root) show(i); });
W.Tour = { start: start, stop: stop, go: show, finish: finish, active: function(){ return !!root; }, redraw: function(){ if (root) show(i); } };
})();
