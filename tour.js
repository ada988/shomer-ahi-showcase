/* 60-second guided tour: navigates the real app and spotlights the real controls. */
(function(){
'use strict';
var W = window;
function lang(){ return (W.ShowcaseI18n && W.ShowcaseI18n.lang) || 'en'; }
function L(en, he){ return lang() === 'he' ? he : en; }
function ico(n, s){ return W.Icon ? W.Icon(n, s) : ''; }

function ensureForm(){ return W._casualtyEditMode ? Promise.resolve() : W.Demo.go('casualty'); }

var STEPS = [
  { pre: function(){ W.Bracelet.close(true); return W.Demo.tab('status'); }, target:'.ov-tiles', pos:'bottom',
    en:['A live scenario','Six casualties from a bus-stop attack. Every colour block is a triage group — tap one to see who is in it.'],
    he:['תרחיש חי','שישה נפגעי פיגוע בתחנת אוטובוס. כל בלוק צבע הוא קבוצת מיון — לחצו לראות מי בה.'] },
  { pre: function(){ return W.Demo.tab('status'); }, target:'.ov-choose', pos:'bottom', scroll:'center',
    en:['Two ways to start','One patient: the full Form 101. Many casualties: quick triage, a colour in seconds. A quick record can be completed as a full Form 101 later.'],
    he:['שתי דרכי התחלה','נפגע אחד: טופס 101 מלא. נפגעים רבים: מיון מהיר, צבע תוך שניות. את הרשומה המהירה אפשר להשלים אחר כך לטופס 101 מלא.'] },
  { pre: function(){ return W.Demo.go('mci'); }, target:'.mci-card', pos:'top',
    en:['The command board','Sorted by priority, with vitals, a running tourniquet clock and what has been done. Tap a card to expand it.'],
    he:['לוח הפיקוד','ממוין לפי עדיפות, עם מדדים, שעון חוסם עורקים ומה שבוצע. לחצו על כרטיס להרחבה.'] },
  { pre: ensureForm, target:'.f-tri', pos:'bottom', scroll:'start',
    en:['One tap sets triage','Huge colour buttons with a shape and a word. The whole app updates at once.'],
    he:['לחיצה אחת קובעת מיון','כפתורי צבע ענקיים עם צורה ומילה. כל האפליקציה מתעדכנת מיד.'] },
  { pre: ensureForm, target:'.f-tq', pos:'top', scroll:'center',
    en:['Tourniquet with automatic time','Tap, choose the limb. The time is recorded and the clock starts. Undo for 8 seconds.'],
    he:['חוסם עורקים עם זמן אוטומטי','לוחצים, בוחרים איבר. הזמן נרשם והשעון מתחיל. ביטול למשך 8 שניות.'] },
  { pre: ensureForm, target:'.f-vit', pos:'top', scroll:'center',
    en:['Vitals in big numbers','Tap a number to open a keypad with huge keys. Red means out of range.'],
    he:['מדדים במספרים גדולים','לוחצים על מספר לפתיחת מקלדת עם מקשים ענקיים. אדום = חריג.'] },
  { pre: ensureForm, target:'.xc-tabs', pos:'bottom', scroll:'center',
    en:['X-CARE, step by step','Primary and secondary survey. Tap a row to tick it, tap the big button to do it: tourniquet, blood, TXA, ketamine, antibiotic. Times are recorded for the handoff.'],
    he:['X-CARE שלב אחר שלב','סקר ראשוני ושניוני. לוחצים על שורה לסימון, ועל הכפתור הגדול לביצוע: חוסם עורקים, דם, TXA, קטמין, אנטיביוטיקה. הזמנים נרשמים להעברה.'] },
  { pre: ensureForm, target:'[data-tour=bodymap]', pos:'top', scroll:'center',
    en:['Body map','Tap a region to mark a wound or a treatment. Each action is saved with a timestamp.'],
    he:['מפת גוף','לחצו על אזור לסימון פציעה או טיפול. כל פעולה נשמרת עם חותמת זמן.'] },
  { pre: ensureForm, target:'[data-tour=handoff]', pos:'top', scroll:'center',
    en:['Hand off in one tap','A short report with the time-critical items first, a radio script, or a printable Form 101.'],
    he:['העברה בלחיצה','דוח קצר עם הפריטים הקריטיים בזמן קודם, תסריט רדיו או טופס 101 להדפסה.'] },
  { pre: function(){ W.Evac.close(); return W.Demo.tab('evac'); }, target:'.ev-road', pos:'bottom',
    en:['Evacuation on the road','Who is on the ambulance, the hospital, and a live arrival countdown.'],
    he:['פינוי בדרך','מי באמבולנס, לאיזה בית חולים, וספירה לאחור חיה להגעה.'] },
  { pre: function(){ return W.Demo.tab('evac').then(function(){ W.Evac.open('v_a2'); }); }, target:'.tp-eta', pos:'bottom',
    en:['Transport screen','Built for a moving vehicle: giant countdown, big buttons, and a driver view with no controls.'],
    he:['מסך הובלה','בנוי לרכב נוסע: ספירה לאחור ענקית, כפתורים גדולים ותצוגת נהג בלי פקדים.'] },
  { pre: function(){ W.Evac && W.Evac.close(); return W.Demo.tab('bracelets'); }, target:'.bt-item .brc2', pos:'bottom',
    en:['A wristband for every casualty','The QR code carries the medical summary. Print it and attach it to the casualty.'],
    he:['צמיד לכל נפגע','קוד ה-QR נושא את תמצית המידע הרפואי. מדפיסים וחוברים לנפגע.'] },
  { pre: function(){ W.Bracelet.viewCard('demo_c1'); }, target:'.cc-banner', pos:'bottom',
    en:['Anyone can scan it','A phone camera is enough: triage, what was done and when — even with no network.'],
    he:['כל אחד יכול לסרוק','מצלמת טלפון מספיקה: מיון, מה בוצע ומתי — גם בלי רשת.'] }
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
    + '<div class="tour-nav"><button class="skip" onclick="Tour.stop()">' + L('Skip tour','דלג') + '</button>'
    + (i > 0 ? '<button class="xbtn" onclick="Tour.go(' + (i - 1) + ')">' + L('Back','הקודם') + '</button>' : '')
    + '<button class="xbtn xbtn-primary" onclick="' + (last ? 'Tour.finish()' : 'Tour.go(' + (i + 1) + ')') + '">' + (last ? L('Try it yourself','נסו בעצמכם') : L('Next','הבא')) + '</button></div>';
  var nb = card.querySelector('.xbtn-primary'); if (nb) nb.focus({ preventScroll:true });
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
  else if (e.key === 'ArrowRight' && i < STEPS.length - 1){ show(i + 1); }
  else if (e.key === 'ArrowLeft' && i > 0){ show(i - 1); }
}
W.addEventListener('resize', function(){ if (root) show(i); });
W.Tour = { start: start, stop: stop, go: show, finish: finish, active: function(){ return !!root; }, redraw: function(){ if (root) show(i); } };
})();
