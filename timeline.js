/* Form 101 TIMELINE: every action with its time, newest first, colour-coded by X-CARE step (letter + colour + word).
   Add a free-text note, show all, delete a wrong entry (UNDO brings it back). Reads the engine's _casualtyTimeline. */
(function(){
'use strict';
var W = window, Field = W.Field;
var IDS = { hemorrhage:['Bleeding','דימום'], penetrating:['Penetrating','חודר'], fracture:['Fracture','שבר'], burn:['Burn','כוויה'], tourniquet:['Tourniquet','חוסם עורקים'],
  pressureDressing:['Pressure dressing','תחבושת לחץ'], hemostatic:['Hemostatic gauze','גזה המוסטטית'], woundPacking:['Wound packing','אריזת פצע'], bandage:['Dressing','חבישה'],
  splint:['Splint','קיבוע'], pelvicBinder:['Pelvic binder','מקבע אגן'], tubeThora:['Chest tube','נקז חזה'], custom:['Other','אחר'] };
function isDrug(e){ return (e.category === 'e' || e.category === 'c') && /(\bmg\b|\bg IV\b|\bmcg\b|TXA|קטמין|מורפין|פנטניל|צפטריאקסון|מטרונידזול|אקמול|אופטלגין|\bIV\b|\bIM\b|\bPO\b)/i.test(String(e.action || '')) && !/נוזלים|fluids|דם מלא|whole blood/i.test(String(e.action || '')); }
function lang(){ return (W.ShowcaseI18n && W.ShowcaseI18n.lang) || 'en'; }
function L(en, he){ return lang() === 'he' ? he : en; }
function ico(n, s){ return W.Icon ? W.Icon(n, s) : ''; }
function esc(s){ return W.escapeHtml ? W.escapeHtml(s) : String(s == null ? '' : s); }
function T(s){ return W.ShowcaseI18n ? W.ShowcaseI18n.tr(s) : s; }
function hm(t){ var d = new Date(t); return isNaN(d) ? '--:--' : String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }

// category -> [letter, css class, EN word, HE word]
var CAT = {
  x:['X','xc-x','BLEEDING','דימום'], c:['C','xc-c','CIRCULATION','מחזור דם'], a:['A','xc-a','AIRWAY','נתיב אוויר'],
  b:['R','xc-r','BREATHING','נשימה'], d:['C','xc-c','CONSCIOUSNESS','הכרה'], e:['E','xc-e','CARE','טיפול'],
  injury:['!','tl-inj','INJURY','פציעה'], triage:['T','tl-tri','TRIAGE','מיון'], vitals:['V','tl-vit','VITALS','מדדים'],
  treatment:['+','xc-e','TREATMENT','טיפול'], exam:['?','tl-vit','EXAM','בדיקה'], note:['N','tl-note','NOTE','הערה'], drug:['Rx','tl-drug','DRUG','תרופה']
};
Field._tlAll = false;
function list(){
  var tl = W._casualtyTimeline || [];
  return tl.map(function(e, i){ return { e:e, i:i, t:Date.parse(e.time) || 0 }; }).sort(function(a, b){ return b.t - a.t || b.i - a.i; });
}
Field.timelineHtml = function(){
  var all = list(), show = Field._tlAll ? all : all.slice(0, 8), now = Date.now();
  var h = '<section class="fs tl" id="fs-time"><h2 class="fs-h">' + L('Timeline','ציר זמן') + '<small>' + L(all.length + ' entries · newest first · every time is recorded','' + all.length + ' רשומות · החדש למעלה · כל זמן נרשם') + '</small></h2>'
    + '<button class="xbtn tl-add" onclick="Field.tlNote()">' + ico('plus', 26) + L('ADD A NOTE','הוספת הערה') + '</button>';
  if (!all.length) return h + '<p class="tl-empty">' + L('Nothing recorded yet. Every action you take appears here with its time.','עדיין לא נרשם דבר. כל פעולה מופיעה כאן עם השעה.') + '</p></section>';
  h += '<ol class="tl-list">';
  show.forEach(function(r){
    var e = r.e, c = (isDrug(e) && CAT.drug) || CAT[e.category] || ['•','tl-vit', String(e.category || '').toUpperCase().slice(0, 12), String(e.category || '')];
    var mins = r.t ? Math.max(0, Math.round((now - r.t) / 60000)) : null;
    var note = e.category === 'note', text = note ? String(e.action || '') : T(String(e.action || '')), det = e.details ? (IDS[e.details] ? L(IDS[e.details][0], IDS[e.details][1]) : T(String(e.details))) : '';
    h += '<li class="tl-i"><div class="tl-when"><b dir="ltr">' + hm(e.time) + '</b><small>' + (mins == null ? '' : mins < 1 ? L('now','עכשיו') : mins < 60 ? mins + L(' min',' דק׳') : Math.floor(mins / 60) + L(' h ',' ש׳ ') + (mins % 60) + L(' min',' דק׳')) + '</small></div>'
      + '<div class="tl-what ' + c[1] + '"><span class="tl-chip"><b>' + c[0] + '</b>' + L(c[2], c[3]) + '</span><p' + (note ? ' class="no-tr" dir="auto"' : '') + '>' + esc(text) + (det ? '<small>' + esc(det) + '</small>' : '') + '</p></div>'
      + '<button class="tl-del" onclick="Field.tlDel(' + r.i + ')" aria-label="' + L('Delete this entry','מחיקת הרשומה') + '">' + ico('x', 22) + '<span>' + L('DELETE','מחק') + '</span></button></li>';
  });
  h += '</ol>';
  if (all.length > 8) h += '<button class="xbtn tl-more" onclick="Field.tlAll()">' + (Field._tlAll ? L('SHOW LESS','הצג פחות') : L('SHOW ALL ' + all.length,'הצג את כל ' + all.length)) + '</button>';
  return h + '</section>';
};
Field.tlAll = function(){ Field._tlAll = !Field._tlAll; W.MedHost.renderIncidentPage(); };
Field.tlDel = function(i){
  var tl = W._casualtyTimeline || [], e = tl[i]; if (!e) return;
  var X = W._casualtyXABCDE || {}, et = Date.parse(e.time), act = String(e.action || ''), linked = '';
  var near = function(r){ return Math.abs(Date.parse(r.time) - et) < 90000; };
  if (W.pushMedHistory) W.pushMedHistory();
  W._medPushLock = true;
  try {
    var meds = (X.e || {}).medications || [], mi = meds.findIndex(function(m){ var nm = String(m.drug || m.name || ''); return nm && act.indexOf(nm) >= 0 && near(m); });
    if (mi >= 0){ linked = String(meds[mi].drug || meds[mi].name); meds.splice(mi, 1); }
    var fl = (X.c || {}).fluids || [], fi = fl.findIndex(function(m){ return m.type && act.indexOf(m.type) >= 0 && near(m); });
    if (!linked && fi >= 0){ linked = fl[fi].type; fl.splice(fi, 1); }
    var tq = (X.x || {}).tourniquets || [], ti = tq.findIndex(function(m){ return /ח"ע|חוסם/.test(act) && near(m); });
    if (!linked && ti >= 0){ linked = 'TQ'; tq.splice(ti, 1); }
  } finally { Promise.resolve().then(function(){ W._medPushLock = false; }); }
  if (W.deleteTimelineEntry) W.deleteTimelineEntry(i); else { if (W.pushMedHistory) W.pushMedHistory(); tl.splice(i, 1); W.MedHost.triggerAutoSave(); W.MedHost.renderIncidentPage(); }
  if (Field.toast) Field.toast(L('Deleted: ','נמחק: ') + esc(T(String(e.action || '')).slice(0, 40)) + (linked ? L(' (and its record)',' (וגם הרשומה)') : ''), function(){ W.medUndo(); });
};
Field.tlNote = function(){
  var old = document.getElementById('tl-sheet'); if (old) old.remove();
  var el = document.createElement('div'); el.id = 'tl-sheet'; el.className = 'sheet-wrap no-polish';
  el.innerHTML = '<div class="sheet-dim" onclick="Field.tlNoteClose()"></div><div class="sheet tl-sheet" role="dialog" aria-label="' + L('Add a note','הוספת הערה') + '"><div class="sheet-grab"></div><h3>' + L('ADD A NOTE TO THE TIMELINE','הערה לציר הזמן') + '</h3>'
    + '<textarea id="tl-note" class="no-tr" dir="auto" maxlength="300" rows="4" placeholder="' + L('What happened, what you did, what you saw','מה קרה, מה עשיתם, מה ראיתם') + '"></textarea>'
    + '<div class="btn-row"><button class="xbtn" onclick="Field.tlNoteClose()">' + L('CANCEL','ביטול') + '</button><button class="xbtn xbtn-primary" onclick="Field.tlNoteSave()">' + L('SAVE NOTE','שמירת הערה') + '</button></div></div>';
  (document.getElementById('app') || document.body).appendChild(el);
  setTimeout(function(){ var ta = document.getElementById('tl-note'); if (ta) ta.focus(); }, 60);
};
Field.tlNoteClose = function(){ var s = document.getElementById('tl-sheet'); if (s) s.remove(); };
Field.tlNoteSave = function(){
  var ta = document.getElementById('tl-note'); var txt = ta ? ta.value : '';
  txt = String(txt).replace(/[\u0000-\u001f\u202a-\u202e\u2066-\u2069]/g, ' ').trim().slice(0, 300);
  Field.tlNoteClose(); if (!txt) return;
  if (W.addTimestampedAction) W.addTimestampedAction('note', txt, '');
  W.MedHost.renderIncidentPage();
  if (Field.toast) Field.toast(L('Note added','הערה נוספה'), function(){ W.medUndo(); });
};
})();
