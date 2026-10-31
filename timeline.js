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
  x:['X','xc-x','Bleeding','דימום'], c:['C','xc-c','Circulation','מחזור דם'], a:['A','xc-a','Airway','נתיב אוויר'],
  b:['R','xc-r','Breathing','נשימה'], d:['C','xc-c','Consciousness','הכרה'], e:['E','xc-e','Care','טיפול'],
  injury:['!','tl-inj','Injury','פציעה'], triage:['T','tl-tri','Triage','מיון'], vitals:['V','tl-vit','Vitals','מדדים'],
  treatment:['+','xc-e','Treatment','טיפול'], exam:['?','tl-vit','Exam','בדיקה'], note:['N','tl-note','Note','הערה'], drug:['Rx','tl-drug','Drug','תרופה']
};
// Entry text for display only (the stored record is unchanged).
function disp(a){
  var s = String(a || ''), fm = /^נוזלים: (\d+(?:\.\d+)?)\s*ml (.+)$/.exec(s), am = /^(?:גישה ורידית|גישה גרמית \(IO\)): (.+)$/.exec(s);
  if (am && W.accessLabel) return L('Access: ','גישה: ') + W.accessLabel(am[1]);
  if (fm) return L(T(fm[2]) + ' ' + fm[1] + ' mL', fm[2] + ' ' + fm[1] + ' מ״ל');
  if (lang() !== 'he') return T(s);
  s = s.replace(/\(greater trochanters?\)/g, '(בגובה הטרוכנטרים)').replace(/^GCS EYE:/, 'GCS עיניים:').replace(/^GCS VERBAL:/, 'GCS דיבור:').replace(/^GCS MOTOR:/, 'GCS תנועה:').replace(/^ח"ע\b/, 'חוסם עורקים').replace(/(\d+)L\/דק׳/g, '$1 ליטר לדקה').replace(/מסכת NRB/g, 'מסכת העשרה').replace(/דרך BVM/g, 'דרך מפוח (BVM)');
  return W.outLR ? W.outLR(s) : s;
}
Field._tlAll = false;
function list(){
  var tl = W._casualtyTimeline || [];
  return tl.map(function(e, i){ return { e:e, i:i, t:Date.parse(e.time) || 0 }; }).sort(function(a, b){ return b.t - a.t || b.i - a.i; });
}
Field.timelineHtml = function(){
  var all = list(), show = Field._tlAll ? all : all.slice(0, 8), now = Date.now();
  var h = '<section class="fs tl" id="fs-time"><h2 class="fs-h">' + L('Timeline','ציר זמן') + '<small>' + L(all.length + (all.length === 1 ? ' entry' : ' entries') + ' · newest first','' + all.length + ' רשומות · החדש למעלה') + '</small></h2>'
    + '<button class="xbtn tl-add" onclick="Field.tlNote()">' + ico('plus', 26) + L('Add a note','הוספת הערה') + '</button>';
  if (!all.length) return h + '<p class="tl-empty">' + L('Nothing recorded yet. Every action you take appears here with its time.','עדיין לא נרשם דבר. כל פעולה מופיעה כאן עם השעה.') + '</p></section>';
  h += '<ol class="tl-list">';
  show.forEach(function(r){
    var e = r.e, c = (isDrug(e) && CAT.drug) || (/מקבע אגן/.test(String(e.action || '')) && CAT.c) || CAT[e.category] || ['•','tl-vit', String(e.category || '').toUpperCase().slice(0, 12), String(e.category || '')];
    var mins = r.t ? Math.max(0, Math.round((now - r.t) / 60000)) : null;
    var note = e.category === 'note', text = note ? String(e.action || '') : disp(e.action), det = e.details ? (IDS[e.details] ? L(IDS[e.details][0], IDS[e.details][1]) : T(String(e.details))) : '';
    var ago = mins == null ? '' : mins < 1 ? L('now','עכשיו') : mins < 60 ? L(mins + ' min ago','לפני ' + mins + ' דק׳') : L(Math.floor(mins / 60) + ' h ' + (mins % 60) + ' min ago','לפני ' + Math.floor(mins / 60) + ' ש׳ ' + (mins % 60) + ' דק׳');
    h += '<li class="tl-i"><button class="tl-row" onclick="Field.tlOpen(' + r.i + ')" aria-label="' + esc(L('Entry at ' + hm(e.time) + ': open to edit or delete','רשומה ב-' + hm(e.time) + ': פתיחה לעריכה או מחיקה')) + '">'
      + '<span class="tl-when"><b dir="ltr">' + hm(e.time) + '</b><small>' + (e.editedFrom ? L('edited, was ','נערך, היה ') + '<bdi dir="ltr">' + hm(e.editedFrom) + '</bdi>' : ago) + '</small></span>'
      + '<span class="tl-what"><span class="tl-chip ' + c[1] + '"><b>' + c[0] + '</b>' + L(c[2], c[3]) + '</span><span class="tl-txt' + (note ? ' no-tr" dir="auto' : '') + '">' + esc(text) + (det ? '<small>' + esc(det) + '</small>' : '') + '</span></span>'
      + '<span class="tl-go" aria-hidden="true">' + ico(lang() === 'he' ? 'chevron-left' : 'chevron-right', 26) + '</span></button></li>';
  });
  h += '</ol>';
  if (all.length > 8) h += '<button class="xbtn tl-more" onclick="Field.tlAll()">' + ico(Field._tlAll ? 'chevron-down' : 'chevrons-down', 24) + (Field._tlAll ? L('Show less','הצג פחות') : L('Show all ' + all.length,'הצג את כל ' + all.length)) + '</button>';
  return h + '</section>';
};
// A sheet acts only on the casualty it was opened for, and only while that form is open
function caseKey(){ return W._casualtyEditMode ? String(W._casualtyEditId || W._casualtyName || '') : null; }
function alive(){ var ok = Field._tlCas != null && Field._tlCas === caseKey(); if (!ok){ Field.tlRowClose(); var t = document.getElementById('tl-time'); if (t) t.remove(); } return ok; }
// Tap a row: a sheet with the entry and its actions (edit a note, delete). Delete is undoable.
Field.tlOpen = function(i){
  var e = (W._casualtyTimeline || [])[i]; if (!e || !W._casualtyEditMode) return;
  Field._tlCas = caseKey();
  Field.tlRowClose();
  var note = e.category === 'note', text = note ? String(e.action || '') : disp(e.action);
  var el = document.createElement('div'); el.id = 'tl-row-sheet'; el.className = 'sheet-wrap no-polish';
  el.innerHTML = '<div class="sheet-dim" onclick="Field.tlRowClose()"></div><div class="sheet tl-sheet tl-rs" role="dialog" aria-label="' + L('Timeline entry','רשומה בציר הזמן') + '"><div class="sheet-grab"></div>'
    + '<p class="tl-rs-t"><b dir="ltr">' + hm(e.time) + '</b></p><p class="tl-rs-x' + (note ? ' no-tr" dir="auto' : '') + '">' + esc(text) + '</p>'
    + (e.audit && e.audit.length ? '<p class="tl-rs-n">' + e.audit.map(function(a){ return typeof a === 'string' ? esc(a) : L('Time edited ','השעה שונתה ') + '<bdi dir="ltr">' + hm(a.f) + ' → ' + hm(a.t) + '</bdi>'; }).join('<br>') + '</p>' : '')
    + '<div class="tl-rs-b"><button class="xbtn" onclick="Field.tlTime(' + i + ')">' + ico('clock', 24) + L('Edit time','עריכת שעה') + '</button>' + (note ? '<button class="xbtn" onclick="Field.tlEdit(' + i + ')">' + ico('file-text', 24) + L('Edit note','עריכת הערה') + '</button>' : '')
    + '<button class="xbtn tl-rs-del" onclick="Field.tlRowClose();Field.tlDel(' + i + ')">' + ico('x', 24) + L('Delete entry','מחיקת הרשומה') + '</button>'
    + '<button class="xbtn" onclick="Field.tlRowClose()">' + ico('x', 24) + L('Close','סגור') + '</button></div>'
    + (note ? '' : '<p class="tl-rs-n">' + L('Deleting also removes its record (drug, fluid, tourniquet or wound mark). UNDO brings it back.','מחיקה מסירה גם את הרשומה הקשורה (תרופה, נוזל, חוסם או סימון פציעה). ביטול מחזיר אותה.') + '</p>')
    + '</div>';
  (document.getElementById('app') || document.body).appendChild(el);
};
// ── Edit the time of an entry. The linked record moves with it (drug, fluid, tourniquet, IV, airway, injury time), so every
// clock that reads it (tourniquet minutes, repeat-dose timers, 24 h totals, TXA window, order of this list) follows.
function hmT(t){ var d = new Date(t); return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }
Field.tlTime = function(i, t){
  var e = (W._casualtyTimeline || [])[i]; if (!e || !W._casualtyEditMode) return;
  Field._tlCas = caseKey();
  var orig = Date.parse(e.time); Field._tt = { i:i, t: t != null ? t : orig, orig:orig, warned:false };
  Field.tlRowClose(); Field._ttDraw();
};
Field._ttDraw = function(msg, bad){
  var T0 = Field._tt; if (!T0) return; var old = document.getElementById('tl-time'); if (old) old.remove();
  var step = function(m, lbl){ return '<button class="xbtn" onclick="Field.tlTimeStep(' + m + ')">' + ico(m < 0 ? 'minus' : 'plus', 22) + '<b dir="ltr">' + Math.abs(m) + '</b>' + L('min','דק׳') + '</button>'; };
  var el = document.createElement('div'); el.id = 'tl-time'; el.className = 'sheet-wrap no-polish';
  el.innerHTML = '<div class="sheet-dim" onclick="Field.tlTimeClose()"></div><div class="sheet tl-sheet tl-tt" role="dialog" aria-modal="true" aria-labelledby="tl-tt-t"><div class="sheet-grab"></div>'
    + '<h3 id="tl-tt-t">' + ico('clock', 26) + L('Edit time','עריכת שעה') + '</h3>'
    + '<p class="tl-tt-big"><b dir="ltr">' + hmT(T0.t) + '</b>' + (T0.t !== T0.orig ? '<small>' + L('was ','היה ') + '<bdi dir="ltr">' + hmT(T0.orig) + '</bdi></small>' : '') + '</p>'
    + '<div class="tl-tt-steps" dir="ltr">' + step(-5) + step(-1) + step(1) + step(5) + '</div>'
    + '<div class="tl-tt-row"><button class="xbtn" onclick="Field.tlTimeNow()">' + ico('timer-reset', 22) + L('Now','עכשיו') + '</button>'
    + '<label class="tl-tt-ex">' + ico('keyboard', 22) + '<span>' + L('Exact time','שעה מדויקת') + '</span><input type="time" value="' + hmT(T0.t) + '" onchange="Field.tlTimeExact(this.value)"></label></div>'
    + (msg ? '<p class="tl-tt-msg' + (bad ? ' bad' : '') + '" role="alert">' + ico('triangle-alert', 22) + '<span>' + msg + '</span></p>' : '')
    + '<div class="tl-rs-b"><button class="xbtn" onclick="Field.tlTimeClose()">' + ico('x', 24) + L('Cancel','ביטול') + '</button><button class="xbtn xbtn-primary" onclick="Field.tlTimeSave()">' + ico('check', 26) + (T0.warned ? L('Save anyway','לשמור בכל זאת') : L('Save time','שמירת השעה')) + '</button></div></div>';
  (document.getElementById('app') || document.body).appendChild(el);
};
Field.tlTimeClose = function(){ var s = document.getElementById('tl-time'); if (s) s.remove(); Field._tt = null; };
Field.tlTimeStep = function(m){ var T0 = Field._tt; if (!T0) return; T0.t += m * 60000; T0.warned = false; Field._ttDraw(); };
Field.tlTimeNow = function(){ var T0 = Field._tt; if (!T0) return; var d = new Date(); d.setSeconds(0, 0); T0.t = d.getTime(); T0.warned = false; Field._ttDraw(); };
Field.tlTimeExact = function(v){
  var T0 = Field._tt, m = /^(\d{1,2}):(\d{2})$/.exec(v || ''); if (!T0 || !m) return;
  var d = new Date(T0.t); d.setHours(+m[1], +m[2], 0, 0); if (d.getTime() > Date.now() + 60000) d.setDate(d.getDate() - 1);
  T0.t = d.getTime(); T0.warned = false; Field._ttDraw();
};
Field.tlTimeSave = function(){
  var T0 = Field._tt; if (!T0) return; if (!alive()) return Field.tlTimeClose(); var tl = W._casualtyTimeline || [], e = tl[T0.i]; if (!e) return Field.tlTimeClose();
  if (T0.t > Date.now() + 60000) return Field._ttDraw(L('That is in the future. Pick a time up to now.','זו שעה עתידית. בחרו שעה עד עכשיו.'), true);
  var X = W._casualtyXABCDE || {}, inj = Date.parse((X.e || {}).timeOfInjury), act = String(e.action || ''), isInj = /^שעת פציעה /.test(act);
  if (!isInj && !isNaN(inj) && T0.t < inj && !T0.warned){ T0.warned = true; return Field._ttDraw(L('This is before the injury time (' + hmT(inj) + '). Check it.','זה לפני שעת הפציעה (' + hmT(inj) + '). בדקו.'), false); }
  if (T0.t === T0.orig) return Field.tlTimeClose();
  var iso = new Date(T0.t).toISOString(), near = function(r){ return r && Math.abs(Date.parse(r.time) - T0.orig) < 90000; }, moved = '';
  if (W.pushMedHistory) W.pushMedHistory();
  W._medPushLock = true;
  try {
    var move = function(arr, test){ var r = (arr || []).filter(function(x){ return near(x) && (!test || test(x)); })[0]; if (r){ r.time = iso; return true; } return false; };
    var meds = (X.e || {}).medications || [];
    if (move(meds, function(m){ var nm = String(m.drug || m.name || ''); return nm && act.indexOf(nm) >= 0; })) moved = 'drug';
    else if (move((X.c || {}).fluids, function(f){ return f.type && act.indexOf(f.type) >= 0; })) moved = 'fluid';
    else if (/ח"ע|חוסם/.test(act) && move((X.x || {}).tourniquets)){ moved = 'tq'; (W._casualtyTreatments || []).forEach(function(b){ if (b.type === 'tourniquet' && near(b)) b.time = iso; }); }
    else if (/גישה ורידית|IO/.test(act) && move((X.c || {}).ivAccess)) moved = 'iv';
    else if (e.category === 'a' && move((X.a || {}).interventions)) moved = 'airway';
    else if (isInj && X.e){ X.e.timeOfInjury = iso; e.action = 'שעת פציעה ' + hmT(T0.t); moved = 'injury'; }
    else if (move((X.e || {}).procedures)) moved = 'proc';
    if (!e.editedFrom) e.editedFrom = new Date(T0.orig).toISOString();
    e.audit = (e.audit || []).concat([{ f:new Date(T0.orig).toISOString(), t:iso }]);   // words are added on display, in the reader's language
    e.time = new Date(T0.t);
  } finally { Promise.resolve().then(function(){ W._medPushLock = false; }); }
  Field.tlTimeClose();
  if (W._rehydrateRedoses) try { W._rehydrateRedoses(); } catch (x) {}   // repeat-dose reminder follows the new time
  if (W.MedHost.triggerAutoSave) W.MedHost.triggerAutoSave();
  W.MedHost.renderIncidentPage();
  if (Field.toast) Field.toast(L('Time changed ','השעה שונתה ') + '<bdi dir="ltr">' + hmT(T0.orig) + ' → ' + hmT(T0.t) + '</bdi>', function(){ W.medUndo(); W.MedHost.renderIncidentPage(); });
};
Field.tlRowClose = function(){ var s = document.getElementById('tl-row-sheet'); if (s) s.remove(); };
Field.tlEdit = function(i){
  if (!alive()) return; var e = (W._casualtyTimeline || [])[i]; if (!e) return;
  Field.tlRowClose(); Field.tlNote(i);
};
Field.tlAll = function(){ Field._tlAll = !Field._tlAll; W.MedHost.renderIncidentPage(); };
// One delete path: other screens (body-map treatment list) delete through the timeline so the linked record goes too
Field.tlDelLinked = function(i){ Field._tlCas = caseKey(); Field.tlDel(i); };
Field.tlDel = function(i){
  if (!alive()) return; var tl = W._casualtyTimeline || [], e = tl[i]; if (!e) return;
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
  if (W._rehydrateRedoses) try { W._rehydrateRedoses(); } catch (x) {}
  if (W.deleteTimelineEntry) W.deleteTimelineEntry(i); else { if (W.pushMedHistory) W.pushMedHistory(); tl.splice(i, 1); W.MedHost.triggerAutoSave(); W.MedHost.renderIncidentPage(); }
  if (Field.toast) Field.toast(L('Deleted: ','נמחק: ') + esc(T(String(e.action || '')).slice(0, 40)) + (linked ? L(' (and its record)',' (וגם הרשומה)') : ''), function(){ W.medUndo(); });
};
Field.tlNote = function(editIdx){
  Field._tlEditIdx = (typeof editIdx === 'number') ? editIdx : null;
  var old = document.getElementById('tl-sheet'); if (old) old.remove();
  var el = document.createElement('div'); el.id = 'tl-sheet'; el.className = 'sheet-wrap no-polish';
  el.innerHTML = '<div class="sheet-dim" onclick="Field.tlNoteClose()"></div><div class="sheet tl-sheet" role="dialog" aria-label="' + L('Add a note','הוספת הערה') + '"><div class="sheet-grab"></div><h3>' + (Field._tlEditIdx != null ? L('Edit note','עריכת הערה') : L('Add a note to the timeline','הערה לציר הזמן')) + '</h3>'
    + '<textarea id="tl-note" class="no-tr" dir="auto" maxlength="300" rows="4" placeholder="' + L('What happened, what you did, what you saw','מה קרה, מה עשיתם, מה ראיתם') + '"></textarea>'
    + '<div class="btn-row"><button class="xbtn" onclick="Field.tlNoteClose()">' + L('Cancel','ביטול') + '</button><button class="xbtn xbtn-primary" onclick="Field.tlNoteSave()">' + L('Save note','שמירת הערה') + '</button></div></div>';
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
