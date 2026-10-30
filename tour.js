/* Guided tour: walks the real app, one screen per step, and spotlights the real control.
   Lives inside #app, so it works full-screen on a phone and inside the scaled desktop phone (rects are divided by the scale). */
(function(){
'use strict';
var W = window;
function lang(){ return (W.ShowcaseI18n && W.ShowcaseI18n.lang) || 'en'; }
function L(en, he){ return lang() === 'he' ? he : en; }
function ico(n, s){ return W.Icon ? W.Icon(n, s) : ''; }
function rtl(){ return document.documentElement.dir === 'rtl'; }
function app(){ return document.getElementById('app'); }

function home(){ return W.Demo.tab('status'); }
function form(){ return W.Demo.go('casualty'); }
function later(fn, ms){ return new Promise(function(res){ setTimeout(function(){ res(fn && fn()); }, ms || 0); }); }

// A sample of the alert the form raises after an action, so the step can show it without faking a tap.
function demoAlert(){
  var a = document.createElement('div'); a.id = 'tour-rec'; a.className = 'rec-alert next in no-polish no-tr';
  var ab = document.querySelector('.appbar'), r = app().getBoundingClientRect(), s = scale();
  a.style.top = ((ab ? (ab.getBoundingClientRect().bottom - r.top) / s : 72) + 8) + 'px';
  a.innerHTML = '<div class="rec-go"><span class="rec-i">' + ico('droplet', 30) + '</span><span class="rec-t"><b>' + L('Suspected shock — IV and blood','חשד להלם — עירוי ודם') + '</b><small>' + L('Tap for the full recommendation','לחצו להמלצה המלאה') + '</small></span></div>';
  app().appendChild(a);
}
function dropDemo(){ var a = document.getElementById('tour-rec'); if (a) a.remove(); }

var STEPS = [
  { icon:'layout-dashboard', pre: home, target:'.ov-tiles',
    en:['The scene at a glance','Every casualty counted by triage group: colour, shape and word.'],
    he:['כל הזירה במבט','כל הנפגעים לפי קבוצת מיון: צבע, צורה ומילה.'] },
  { icon:'zap', pre: function(){ return home().then(function(){ W.Quick.open(); }); }, target:'.qt-yn',
    en:['Quick triage','One question at a time. YES is always blue, NO always grey, in the same place.'],
    he:['מיון מהיר','שאלה אחת בכל פעם. כן תמיד כחול, לא תמיד אפור, באותו מקום.'] },
  { icon:'file-text', pre: form, target:'.f-id',
    en:['Casualty 1: Form 101','A number, never a name. Triage and wristband on one strip.'],
    he:['נפגע 1: טופס 101','מספר, אף פעם לא שם. מיון וצמיד בשורה אחת.'] },
  { icon:'list-checks', pre: form, target:'.xc-list, .xc-tabs',
    en:['X-CARE in order','The next step from the IDF book. Rows tick themselves from what you record.'],
    he:['X-CARE לפי הסדר','הצעד הבא לפי ספר צה״ל. השורות מסומנות לבד לפי מה שתיעדת.'] },
  { icon:'clock', pre: form, target:'#fs-time',
    en:['Automatic timeline','Every treatment, drug and vital is logged with its time. Tap a row to edit it.'],
    he:['ציר זמן אוטומטי','כל טיפול, תרופה ומדד נרשמים עם השעה. לחיצה על שורה לעריכה.'] },
  { icon:'syringe', pre: function(){ return form().then(function(){ W.Field.doseOpen('now'); }); }, target:'.dz-dec', off:96,
    en:['Dose calculator','Reads the findings, then: give now, changed dose, do not give. Every syringe is drawn.'],
    he:['מחשבון מינונים','קורא את הממצאים, ואז: לתת עכשיו, מינון משתנה, לא לתת. כל מזרק מצויר.'] },
  { icon:'triangle-alert', pre: function(){ return form().then(function(){ return later(demoAlert, 60); }); }, target:'#tour-rec', leave: dropDemo,
    en:['Alerts after each action','New findings pop up as “Suspected…”, never a diagnosis. Tap for the full advice.'],
    he:['התראה אחרי כל פעולה','ממצא חדש קופץ כ״חשד ל…״, אף פעם לא אבחנה. לחיצה להמלצה המלאה.'] },
  { icon:'ambulance', pre: function(){ if (W.Evac) W.Evac.close(); return W.Demo.tab('evac'); }, target:'.next-out, .ev-road',
    en:['Evacuation','Who goes next, on which ambulance, to which hospital, and when it arrives.'],
    he:['פינוי','מי יוצא הבא, באיזה אמבולנס, לאיזה בית חולים, ומתי מגיע.'] },
  { icon:'qr-code', pre: function(){ return W.Demo.tab('bracelets'); }, target:'.bt-band',
    en:['A wristband for every casualty','The whole record is inside the QR code.'],
    he:['צמיד לכל נפגע','כל התיק נמצא בתוך קוד ה-QR.'] },
  { icon:'scan-line', pre: function(){ return W.Demo.tab('bracelets').then(function(){ W.Bracelet.viewCard('demo_c1'); }); }, target:'.cc-banner, .bo .cc-name, .bo',
    en:['Any phone can read it','At the hospital door: triage, what was done and when. No app, no network.'],
    he:['כל טלפון קורא','בפתח בית החולים: מיון, מה בוצע ומתי. בלי אפליקציה, בלי רשת.'] },
  { icon:'circle-help', pre: home, target:'#menu-btn',
    en:['That’s the tour','Every screen is explained step by step in Menu → How to use.'],
    he:['זה הסיור','כל מסך מוסבר שלב אחר שלב בתפריט ← איך משתמשים.'] }
];

var i = 0, root = null, spot = null, card = null, tok = 0;
function scale(){ var a = app(); return a && a.offsetWidth ? (a.getBoundingClientRect().width / a.offsetWidth) || 1 : 1; }
function rectIn(el){
  var a = app().getBoundingClientRect(), r = el.getBoundingClientRect(), s = scale();
  return { x:(r.left - a.left) / s, y:(r.top - a.top) / s, w:r.width / s, h:r.height / s, aw:a.width / s, ah:a.height / s };
}
function visible(el){ var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
function find(sel){
  var top = document.querySelector('.bo') || document.querySelector('.dz-wrap') || document.getElementById('qt');
  var list = sel.split(',').map(function(x){ return x.trim(); });
  for (var k = 0; k < list.length; k++){
    var el = (top && top.querySelector(list[k])) || document.querySelector(list[k]);
    if (el && visible(el)) return el;
  }
  return null;
}
function clean(){
  dropDemo();
  if (W.Quick && document.getElementById('qt')) W.Quick.close();
  if (W.Bracelet) W.Bracelet.close(true);
  if (W.Evac) W.Evac.close();
  if (W.Demo && W.Demo.closeOverlays) W.Demo.closeOverlays();
}
// bring the target into view by scrolling its own scroller only (never the page around the desktop phone)
function reveal(t, off){
  var p = t.parentElement;
  while (p && p !== app()){
    var cs = getComputedStyle(p);
    if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 4){
      var pr = p.getBoundingClientRect(), tr = t.getBoundingClientRect(), s = scale();
      var th = tr.height / s, tall = th > p.clientHeight * .4;
      // tall targets: show their start; short ones: about a third of the way down
      var jb = p.querySelector(':scope > .jb, .jb'), sticky = jb && visible(jb) && getComputedStyle(jb).position === 'sticky' ? jb.offsetHeight : 0;
      var want = (tr.top - pr.top) / s - sticky - (tall ? (off || 12) : Math.max(16, (p.clientHeight - sticky - th) * .3));
      p.scrollTop += want;
      return;
    }
    p = p.parentElement;
  }
}
// sticky jump tabs at the top of the form scroller: targets must sit below them
function stickyBottom(t){
  var sc = document.getElementById('incident-content'), jb = document.querySelector('#incident-content .jb');
  if (!sc || !jb || !sc.contains(t) || !visible(jb)) return 0;
  var a = app().getBoundingClientRect(), r = jb.getBoundingClientRect();
  return (r.bottom - a.top) / scale();
}
function wait(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

function show(n){
  if (!root) return;
  var prev = STEPS[i]; if (prev && prev.leave) prev.leave();
  i = Math.max(0, Math.min(STEPS.length - 1, n));
  var s = STEPS[i], my = ++tok;
  card.classList.add('busy');
  clean();
  Promise.resolve(s.pre ? s.pre() : null).then(function(){
    var tries = 0;
    return (function look(){
      if (my !== tok) return null;
      var t = find(s.target);
      if (t || tries++ > 25) return t;
      return wait(80).then(look);
    })();
  }).then(function(t){
    if (my !== tok || !root) return;
    if (t) reveal(t, s.off);
    return wait(260).then(function(){ if (my === tok && root) draw(t ? find(s.target) : null, s); });
  }).catch(function(e){ console.error(e); if (my === tok && root) draw(null, s); });
}

function draw(t, s){
  var txt = lang() === 'he' ? s.he : s.en, last = i === STEPS.length - 1, A = app(), sc = scale();
  var aw = A.offsetWidth, ah = A.offsetHeight;
  var tab = document.getElementById('incident-tabs'), bar = document.querySelector('.appbar');
  var cardH;
  card.innerHTML = '<div class="tr-head"><span class="tr-ic">' + ico(s.icon, 26) + '</span><span class="tr-count"><bdi dir="ltr">' + (i + 1) + ' / ' + STEPS.length + '</bdi></span>'
    + '<button class="tr-skip" onclick="Tour.stop()">' + ico('x', 22) + '<span>' + L('Skip','דלג') + '</span></button></div>'
    + '<h5>' + txt[0] + '</h5><p>' + txt[1] + '</p>'
    + '<div class="tr-dots" aria-hidden="true">' + STEPS.map(function(_, k){ return '<i class="' + (k === i ? 'on' : k < i ? 'done' : '') + '"></i>'; }).join('') + '</div>'
    + '<div class="tr-nav">'
    + (i > 0 ? '<button class="tr-back" onclick="Tour.go(' + (i - 1) + ')">' + ico(rtl() ? 'arrow-right' : 'arrow-left', 24) + '<span>' + L('Back','הקודם') + '</span></button>' : '')
    + '<button class="tr-next" onclick="' + (last ? 'Tour.finish()' : 'Tour.go(' + (i + 1) + ')') + '">' + (last ? ico('check', 24) + '<span>' + L('Done','סיום') + '</span>' : '<span>' + L('Next','הבא') + '</span>' + ico(rtl() ? 'arrow-left' : 'arrow-right', 24)) + '</button></div>';
  card.classList.remove('busy');
  card.style.top = card.style.bottom = '';
  cardH = card.offsetHeight;
  var topLimit = t ? Math.max(8, stickyBottom(t) + 4) : 8, botLimit = ah - 8;
  if (t){
    var r = rectIn(t), pad = 8, br = parseFloat(getComputedStyle(t).borderTopLeftRadius) || 12;
    var x = Math.max(4, r.x - pad), y = r.y - pad, w = Math.min(aw - 8, r.w + pad * 2), h = r.h + pad * 2;
    if (x + w > aw - 4) w = aw - 4 - x;
    // keep the spotlight on screen and below the form's sticky tabs
    var sb = stickyBottom(t), floor = Math.max(4, sb ? sb + 4 : 4);
    if (y < floor){ h += y - floor; y = floor; }
    if (y + h > ah - 4) h = ah - 4 - y;
    var above = y - topLimit, below = botLimit - (y + h);
    var gap = 12, place;
    if (below >= cardH + gap) place = 'below';
    else if (above >= cardH + gap) place = 'above';
    else {
      // not enough room either side: put the card on the larger side and trim the spotlight so they never overlap
      place = (below >= above || h > ah * .4) ? 'below' : 'above';
      if (place === 'below'){ var cut = (y + h) - (botLimit - cardH - gap); h = Math.max(56, h - cut); }
      else { var cut2 = (topLimit + cardH + gap) - y; y += cut2; h = Math.max(56, h - cut2); }
    }
    spot.style.display = 'block';
    spot.style.left = x + 'px'; spot.style.top = y + 'px'; spot.style.width = w + 'px'; spot.style.height = h + 'px';
    spot.style.borderRadius = Math.min(28, br + 6) + 'px';
    if (place === 'below') card.style.top = Math.min(botLimit - cardH, y + h + gap) + 'px';
    else card.style.top = Math.max(topLimit, y - gap - cardH) + 'px';
    root.classList.remove('nospot');
  } else {
    spot.style.display = 'none'; root.classList.add('nospot');
    card.style.top = Math.max(topLimit, (ah - cardH) / 2) + 'px';
  }
  var nx = card.querySelector('.tr-next');
  try { nx.focus({ preventScroll:true, focusVisible:false }); } catch (e) { nx.focus({ preventScroll:true }); }
}

function start(at){
  stop(true);
  if (W.Help && W.Help.close) W.Help.close();
  root = document.createElement('div'); root.className = 'tr-dim no-polish no-tr'; root.setAttribute('aria-hidden', 'true');
  spot = document.createElement('div'); spot.className = 'tr-spot'; root.appendChild(spot);
  card = document.createElement('div'); card.className = 'tr-card no-polish no-tr'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-label', L('Guided tour','סיור מודרך')); card.setAttribute('aria-live', 'polite');
  app().appendChild(root); app().appendChild(card);
  document.addEventListener('keydown', onKey, true);
  i = 0; show(at || 0);
}
function stop(silent){
  document.removeEventListener('keydown', onKey, true);
  tok++;
  if (root){ root.remove(); root = null; }
  if (card){ card.remove(); card = null; }
  if (!silent) clean();
}
function finish(){ stop(); home(); }
function onKey(e){
  if (!root) return;
  var fwd = rtl() ? 'ArrowLeft' : 'ArrowRight', back = rtl() ? 'ArrowRight' : 'ArrowLeft';
  if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); stop(); }
  else if (e.key === fwd){ e.preventDefault(); if (i < STEPS.length - 1) show(i + 1); else finish(); }
  else if (e.key === back && i > 0){ e.preventDefault(); show(i - 1); }
  else if (e.key === 'Tab'){ // keep focus in the card
    var f = card.querySelectorAll('button'); if (!f.length) return;
    var first = f[0], lastB = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first){ e.preventDefault(); lastB.focus(); }
    else if (!e.shiftKey && document.activeElement === lastB){ e.preventDefault(); first.focus(); }
  }
}
var rz = null;
W.addEventListener('resize', function(){ if (!root) return; clearTimeout(rz); rz = setTimeout(function(){ var t = find(STEPS[i].target); draw(t, STEPS[i]); }, 150); });
W.Tour = { start: start, stop: stop, go: show, finish: finish, active: function(){ return !!root; }, redraw: function(){ if (root) show(i); },
  steps: function(){ return STEPS.length; }, step: function(){ return i; } };
})();
