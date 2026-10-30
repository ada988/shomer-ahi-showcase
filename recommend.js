/* RECOMMENDATION ALERTS for Form 101.
   Whenever an action in the form makes a NEW recommendation appear in "What to do next" (next.js), a short alert drops in
   under the app bar: icon + a few words, worded as a suspicion, never a diagnosis. One at a time, newest wins, no repeats
   while the same recommendation stays open. Tapping it opens the full recommendation and flashes it. The undo toast lives
   at the bottom, so the two never overlap. */
(function(){
'use strict';
var W = window;
function lang(){ return (W.ShowcaseI18n && W.ShowcaseI18n.lang) || 'en'; }
function L(en, he){ return lang() === 'he' ? he : en; }
function ico(n, s){ return W.Icon ? W.Icon(n, s) : ''; }

// next.js item id (its priority) -> [icon, EN, HE]. Items not listed here never pop up (timers, admin, the child dose card).
var SHORT = {
  '1':   ['droplet', 'Bleeding not controlled — tourniquet', 'דימום לא נשלט — חוסם עורקים'],
  '2':   ['wind', 'Suspected airway risk — open the airway', 'חשד לסיכון בנתיב אוויר — פתחו נתיב'],
  '3':   ['wind', 'Suspected tension pneumothorax — check the chest', 'חשד לחזה אוויר בלחץ — בדקו את החזה'],
  '4':   ['droplet', 'Suspected shock — IV and blood', 'חשד להלם — עירוי ודם'],
  '5':   ['syringe', 'Bleeding risk — give TXA', 'סיכון לדימום — תנו TXA'],
  '5.2': ['brain', 'Suspected head injury — protect the brain', 'חשד לפגיעת ראש — הגנה על המוח'],
  '5.3': ['eye', 'Eye wound — rigid shield', 'פגיעת עין — מגן קשיח'],
  '5.5': ['droplet', 'Suspected crush injury — start saline', 'חשד לפגיעת מעיכה — התחילו סליין'],
  '6':   ['bandage', 'Suspected pelvic fracture — pelvic binder', 'חשד לשבר באגן — מקבע אגן'],
  '9':   ['pill', 'Pain 5 or more — pain relief', 'כאב 5 ומעלה — שיכוך כאב'],
  '10':  ['pill', 'Penetrating wound — antibiotic', 'פצע חודר — אנטיביוטיקה']
};
var caseId = null, seen = {}, shown = null, hideT = null, deb = null, settle = 0, lastAct = 0, lastLang = null;
// Alerts answer the medic's own actions only. A real (trusted) tap, key or field change arms them for a few seconds;
// opening a form, switching casualty or language, timers and defaults never do.
['pointerup','keydown','change'].forEach(function(n){ document.addEventListener(n, function(e){ if (e.isTrusted) lastAct = Date.now(); }, true); });

function el(){
  var a = document.getElementById('rec-alert');
  if (!a) {
    var app = document.getElementById('app'); if (!app) return null;
    a = document.createElement('div'); a.id = 'rec-alert'; a.className = 'rec-alert'; a.setAttribute('role', 'alert'); a.hidden = true;
    app.appendChild(a);
  }
  return a;
}
function draw(){
  var a = el(); if (!a || !shown) return;
  var s = SHORT[shown.id];
  a.className = 'rec-alert ' + (shown.k || 'next');
  a.innerHTML = '<button class="rec-go" onclick="Recommend.open()"><span class="rec-i">' + ico(s[0], 30) + '</span><span class="rec-t"><b>' + (W.casBadge ? W.casBadge({ name: W._casualtyName }) + ' ' : '') + L(s[1], s[2]) + '</b><small>' + L('Suggestion · tap for details','הצעה · לחצו לפרטים') + '</small></span></button>'
    + '<button class="rec-x" onclick="Recommend.dismiss()" aria-label="' + L('Dismiss','סגירה') + '">' + ico('x', 26) + '<span>' + L('Close','סגור') + '</span></button>';
}
function show(it){
  shown = it; var a = el(); if (!a) return;
  var app = document.getElementById('app'), ab = document.querySelector('.appbar');
  var top = ab && app ? ab.getBoundingClientRect().bottom - app.getBoundingClientRect().top : 72;
  a.style.top = (Math.max(0, top) + 8) + 'px';
  draw(); a.hidden = false; a.classList.remove('in'); void a.offsetWidth; a.classList.add('in');
  if (navigator.vibrate) try { navigator.vibrate([40, 60, 40]); } catch (e) {}
  clearTimeout(hideT); hideT = setTimeout(hide, 20000);
}
function hide(){ var a = document.getElementById('rec-alert'); if (a) a.hidden = true; shown = null; clearTimeout(hideT); }

function check(){
  if (!W._casualtyEditMode || !W.Field || !W.Field.nextItems) { caseId = null; seen = {}; hide(); return; }
  var list = W.Field.nextItems().filter(function(i){ return i.id && SHORT[i.id]; }), now = {};
  list.forEach(function(i){ now[i.id] = true; });
  var t = Date.now();
  if (W._casualtyEditId !== caseId || lang() !== lastLang) { caseId = W._casualtyEditId; lastLang = lang(); settle = t + 1500; hide(); }
  if (t < settle) { seen = now; return; }       // the form is still opening: whatever is there now is the baseline
  var fresh = list.filter(function(i){ return !seen[i.id]; });
  seen = now;
  if (shown && !now[shown.id]) hide();          // done: the alert goes away with the recommendation
  if (fresh.length && t - lastAct < 4000) show(fresh[0]);              // list is sorted most urgent first
  else if (shown) draw();                         // keeps the language in step
}
function schedule(){ clearTimeout(deb); deb = setTimeout(check, 180); }

W.Recommend = {
  check: check,
  dismiss: hide,
  open: function(){
    var id = shown && shown.id; hide(); if (!id) return;
    var find = function(){ return document.querySelector('#fs-now .f-n[data-rid="' + id + '"]'); };
    if (W.FormUI) { W.FormUI.open = W.FormUI.open || {}; W.FormUI.open.sug = true; }
    if (!find() && W.Field) { W.Field._allNext = true; if (W.MedHost && W.MedHost.renderIncidentPage) W.MedHost.renderIncidentPage(); else if (W.renderIncidentPage) W.renderIncidentPage(); }
    var f = document.getElementById('fs-now'); if (f) f.setAttribute('open', '');
    var row = find(); if (!row) return;
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    row.classList.remove('rec-flash'); void row.offsetWidth; row.classList.add('rec-flash');
    setTimeout(function(){ row.classList.remove('rec-flash'); }, 2600);
  }
};

function boot(){
  var c = document.getElementById('incident-content'); if (!c) return;
  new MutationObserver(schedule).observe(c, { childList: true, subtree: true });
  schedule();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
