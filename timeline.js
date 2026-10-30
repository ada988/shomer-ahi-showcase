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
// Entry text for display only (the stored record is unchanged).
function disp(a){
  var s = String(a || ''), fm = /^נוזלים: (\d+(?:\.\d+)?)\s*ml (.+)$/.exec(s);
  if (fm) return L(T(fm[2]) + ' ' + fm[1] + ' mL', fm[2] + ' ' + fm[1] + ' מ״ל');
  if (lang() !== 'he') return T(s);
  s = s.replace(/^ח"ע\b/, 'חוסם עורקים').replace(/(\d+)L\/דק׳/g, '$1 ליטר לדקה').replace(/מסכת NRB/g, 'מסכת העשרה').replace(/דרך BVM/g, 'דרך מפוח (BVM)');
  return W.outLR ? W.outLR(s) : s;
}
Field._tlAll = false;
function list(){
  var tl = W._casualtyTimeline || [];
  return tl.map(function(e, i){ return { e:e, i:i, t:Date.parse(e.time) || 0 }; }).sort(function(a, b){ return b.t - a.t || b.i - a.i; });
}
Field.timelineHtml = function(){
  var all = list(), show = Field._tlAll ? all : all.slice(0, 8), now = Date.now();
  var h = '<section class="fs tl" id="fs-time"><h2 class="fs-h">' + L('Timeline','ציר זמן') + '<small>' + L(all.length + (all.length === 1 ? ' entry' : ' entries') + ' · newest first · every time is recorded','' + all.length + ' רשומות · החדש למעלה · כל זמן נרשם') + '</small></h2>'
    + '<button class="xbtn tl-add" onclick="Field.tlNote()">' + ico('plus', 26) + L('ADD A NOTE','הוספת הערה') + '</button>';
  if (!all.length) return h + '<p class="tl-empty">' + L('Nothing recorded yet. Every action you take appears here with its time.','עדיין לא נרשם דבר. כל פעולה מופיעה כאן עם השעה.') + '</p></section>';
  h += '<ol class="tl-list">';
  show.forEach(function(r){
    var e = r.e, c = (isDrug(e) && CAT.drug) || (/מקבע אגן/.test(String(e.action || '')) && CAT.c) || CAT[e.category] || ['•','tl-vit', String(e.category || '').toUpperCase().slice(0, 12), String(e.category || '')];
    var mins = r.t ? Math.max(0, Math.round((now - r.t) / 60000)) : null;
    var note = e.category === 'note', text = note ? String(e.action || '') : disp(e.action), det = e.details ? (IDS[e.details] ? L(IDS[e.details][0], IDS[e.details][1]) : T(String(e.details))) : '';
    var ago = mins == null ? '' : mins < 1 ? L('now','עכשיו') : mins < 60 ? L(mins + ' min ago','לפני ' + mins + ' דק׳') : L(Math.floor(mins / 60) + ' h ' + (mins % 60) + ' min ago','לפני ' + Math.floor(mins / 60) + ' ש׳ ' + (mins % 60) + ' דק׳');
    h += '<li class="tl-i"><button class="tl-row" onclick="Field.tlOpen(' + r.i + ')" aria-label="' + esc(L('Entry at ' + hm(e.time) + ': open to edit or delete','רשומה ב-' + hm(e.time) + ': פתיחה לעריכה או מחיקה')) + '">'
      + '<span class="tl-when"><b dir="ltr">' + hm(e.time) + '</b><small>' + ago + '</small></span>'
      + '<span class="tl-what"><span class="tl-chip ' + c[1] + '"><b>' + c[0] + '</b>' + L(c[2], c[3]) + '</span><span class="tl-txt' + (note ? ' no-tr" dir="auto' : '') + '">' + esc(text) + (det ? '<small>' + esc(det) + '</small>' : '') + '</span></span>'
      + '<span class="tl-go" aria-hidden="true">' + ico(lang() === 'he' ? 'chevron-left' : 'chevron-right', 26) + '</span></button></li>';
  });
  h += '</ol>';
  if (all.length > 8) h += '<button class="xbtn tl-more" onclick="Field.tlAll()">' + (Field._tlAll ? L('SHOW LESS','הצג פחות') : L('SHOW ALL ' + all.length,'הצג את כל ' + all.length)) + '</button>';
  return h + '</section>';
};
// Tap a row: a sheet with the entry and its actions (edit a note, delete). Delete is undoable.
Field.tlOpen = function(i){
  var e = (W._casualtyTimeline || [])[i]; if (!e) return;
  Field.tlRowClose();
  var note = e.category === 'note', text = note ? String(e.action || '') : disp(e.action);
  var el = document.createElement('div'); el.id = 'tl-row-sheet'; el.className = 'sheet-wrap no-polish';
  el.innerHTML = '<div class="sheet-dim" onclick="Field.tlRowClose()"></div><div class="sheet tl-sheet tl-rs" role="dialog" aria-label="' + L('Timeline entry','רשומה בציר הזמן') + '"><div class="sheet-grab"></div>'
    + '<p class="tl-rs-t"><b dir="ltr">' + hm(e.time) + '</b></p><p class="tl-rs-x' + (note ? ' no-tr" dir="auto' : '') + '">' + esc(text) + '</p>'
    + '<div class="tl-rs-b">' + (note ? '<button class="xbtn" onclick="Field.tlEdit(' + i + ')">' + ico('file-text', 24) + L('EDIT NOTE','עריכת הערה') + '</button>' : '')
    + '<button class="xbtn tl-rs-del" onclick="Field.tlRowClose();Field.tlDel(' + i + ')">' + ico('x', 24) + L('DELETE ENTRY','מחיקת הרשומה') + '</button>'
    + '<button class="xbtn" onclick="Field.tlRowClose()">' + L('CLOSE','סגור') + '</button></div>'
    + (note ? '' : '<p class="tl-rs-n">' + L('Deleting also removes its record (drug, fluid, tourniquet or wound mark). UNDO brings it back.','מחיקה מסירה גם את הרשומה הקשורה (תרופה, נוזל, חוסם או סימון פציעה). ביטול מחזיר אותה.') + '</p>')
    + '</div>';
  (document.getElementById('app') || document.body).appendChild(el);
};
Field.tlRowClose = function(){ var s = document.getElementById('tl-row-sheet'); if (s) s.remove(); };
Field.tlEdit = function(i){
  var e = (W._casualtyTimeline || [])[i]; if (!e) return;
  Field.tlRowClose(); Field.tlNote(i);
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
    if (!linked && ti >= 0){ var site = tq[ti].site; linked = 'TQ'; tq.splice(ti, 1); var bt = W._casualtyTreatments || [], bi = bt.findIndex(function(b){ return b.type === 'tourniquet' && b.region === site; }); if (bi >= 0) bt.splice(bi, 1); }
    if (!linked && /^שעת פציעה /.test(act) && X.e){ X.e.timeOfInjury = null; linked = 'time'; }
    if (!linked && e.category === 'injury' && e.details){ var inj = W._casualtyInjuries || [], ii = inj.findIndex(function(j){ return j.type === e.details && act.indexOf(W.BODY_LABELS ? (W.BODY_LABELS[j.region] || '') : '') >= 0; }); if (ii >= 0){ inj.splice(ii, 1); linked = 'injury'; } }
    if (!linked && e.details && /^טיפול /.test(act)){ var bt2 = W._casualtyTreatments || [], b2 = bt2.findIndex(function(b){ return b.type === e.details && act.indexOf(W.BODY_LABELS ? (W.BODY_LABELS[b.region] || '') : '') >= 0; }); if (b2 >= 0){ bt2.splice(b2, 1); linked = 'treatment'; } }
  } finally { Promise.resolve().then(function(){ W._medPushLock = false; }); }
  if (W.deleteTimelineEntry) W.deleteTimelineEntry(i); else { if (W.pushMedHistory) W.pushMedHistory(); tl.splice(i, 1); W.MedHost.triggerAutoSave(); W.MedHost.renderIncidentPage(); }
  if (Field.toast) Field.toast(L('Deleted: ','נמחק: ') + esc(T(String(e.action || '')).slice(0, 40)) + (linked ? L(' (and its record)',' (וגם הרשומה)') : ''), function(){ W.medUndo(); });
};
Field.tlNote = function(editIdx){
  Field._tlEditIdx = (typeof editIdx === 'number') ? editIdx : null;
  var old = document.getElementById('tl-sheet'); if (old) old.remove();
  var el = document.createElement('div'); el.id = 'tl-sheet'; el.className = 'sheet-wrap no-polish';
  el.innerHTML = '<div class="sheet-dim" onclick="Field.tlNoteClose()"></div><div class="sheet tl-sheet" role="dialog" aria-label="' + L('Add a note','הוספת הערה') + '"><div class="sheet-grab"></div><h3>' + (Field._tlEditIdx != null ? L('Edit note','עריכת הערה') : L('Add a note to the timeline','הערה לציר הזמן')) + '</h3>'
    + '<textarea id="tl-note" class="no-tr" dir="auto" maxlength="300" rows="4" placeholder="' + L('What happened, what you did, what you saw','מה קרה, מה עשיתם, מה ראיתם') + '"></textarea>'
    + '<div class="btn-row"><button class="xbtn" onclick="Field.tlNoteClose()">' + L('CANCEL','ביטול') + '</button><button class="xbtn xbtn-primary" onclick="Field.tlNoteSave()">' + L('SAVE NOTE','שמירת הערה') + '</button></div></div>';
  (document.getElementById('app') || document.body).appendChild(el);
  var ed = Field._tlEditIdx != null ? (W._casualtyTimeline || [])[Field._tlEditIdx] : null; if (ed){ var ta0 = el.querySelector('#tl-note'); ta0.value = String(ed.action || ''); }
  setTimeout(function(){ var ta = document.getElementById('tl-note'); if (ta) ta.focus(); }, 60);
};
Field.tlNoteClose = function(){ var s = document.getElementById('tl-sheet'); if (s) s.remove(); };
Field.tlNoteSave = function(){
  var ta = document.getElementById('tl-note'); var txt = ta ? ta.value : '';
  txt = String(txt).replace(/[\u0000-\u001f\u202a-\u202e\u2066-\u2069]/g, ' ').trim().slice(0, 300);
  Field.tlNoteClose(); if (!txt){ if (Field.toast) Field.toast(L('Empty note, nothing saved','הערה ריקה, לא נשמר דבר'), null); return; }
  var ei = Field._tlEditIdx; Field._tlEditIdx = null;
  var ed = ei != null ? (W._casualtyTimeline || [])[ei] : null;
  if (ed){ if (W.pushMedHistory) W.pushMedHistory(); ed.action = txt; if (W.MedHost.triggerAutoSave) W.MedHost.triggerAutoSave(); W.MedHost.renderIncidentPage(); if (Field.toast) Field.toast(L('Note changed','ההערה עודכנה'), function(){ W.medUndo(); }); return; }
  if (W.addTimestampedAction) W.addTimestampedAction('note', txt, '');
  W.MedHost.renderIncidentPage();
  if (Field.toast) Field.toast(L('Note added','הערה נוספה'), function(){ W.medUndo(); });
};
})();
