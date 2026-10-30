/* FIELD PANEL — the first thing on a casualty card. Built for a gloved, stressed medic:
   one-tap triage, one-tap tourniquet with automatic time, MARCH tiles with words, big-number vitals + keypad,
   one-tap "give now" drugs with an 8-second UNDO. Calls the existing engine functions; adds no new clinical logic. */
(function(){
'use strict';
var W = window;
function lang(){ return (W.ShowcaseI18n && W.ShowcaseI18n.lang) || 'en'; }
function L(en, he){ return lang() === 'he' ? he : en; }
function ico(n, s){ return W.Icon ? W.Icon(n, s) : ''; }
function esc(s){ return W.escapeHtml(s); }
function hhmm(iso){ var d = new Date(iso); return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }
function minsAgo(iso){ return Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)); }
function app(){ return document.getElementById('app'); }

var TRI = [['red','URGENT','דחוף'], ['green','NOT URGENT','לא דחוף'], ['gray','WAITING','ממתין'], ['yellow','DELAYED','עדיפות שנייה'], ['black','NO SIGNS OF LIFE','ללא סימני חיים']];
var EVAC = { red:'immediate', yellow:'urgent', green:'routine', gray:'expectant', black:'' };
if (W.ShowcaseI18n && W.ShowcaseI18n.extend){ var _td = {}; TRI.forEach(function(t){ _td['טריאז׳ — ' + t[2]] = 'Triage — ' + t[1]; }); _td['הלם — קטמין קו ראשון; מורפין 2mg בלבד; ללא Actiq / פנטניל'] = 'Shock: ketamine first line; morphine 2 mg only; no Actiq or fentanyl'; _td['מורפין 2mg IV (הלם)'] = 'Morphine 2 mg IV (shock)'; _td['הערכה חוזרת: ללא החמרה, הולכת'] = 'Reassessment: no deterioration, walking'; _td['אדום — דחוף'] = 'Red — URGENT'; _td['צהוב — דחוי'] = 'Yellow — DELAYED'; _td['ירוק — לא דחוף'] = 'Green — NOT URGENT'; _td['אפור — ממתין'] = 'Gray — WAITING'; _td['שחור — ללא סימני חיים'] = 'Black — NO SIGNS OF LIFE'; W.ShowcaseI18n.extend(_td); }
var SITES = [['r_upper_arm','RIGHT ARM','יד ימין'], ['l_upper_arm','LEFT ARM','יד שמאל'], ['r_thigh','RIGHT LEG (THIGH)','רגל ימין (ירך)'], ['l_thigh','LEFT LEG (THIGH)','רגל שמאל (ירך)'], ['r_shin','RIGHT LOWER LEG','שוק ימין'], ['l_shin','LEFT LOWER LEG','שוק שמאל']];
var GIVE = [
  { key:'txa',  drug:'TXA',          dose:'1g',    route:'IV', en:'TXA',        he:'TXA',     sub:'1 g IV',    subHe:'1 גרם IV' },
  { key:'ket',  drug:'קטמין',        dose:'25mg',  route:'IV', en:'KETAMINE',   he:'קטמין',   sub:'25 mg IV',  subHe:'25 מ״ג IV' },
  { key:'cef',  drug:'צפטריאקסון',   dose:'2g',    route:'IV', en:'CEFTRIAXONE',he:'צפטריאקסון', sub:'2 g IV', subHe:'2 גרם IV' },
  { key:'blood',fluid:true, type:'דם מלא', vol:500, en:'WHOLE BLOOD',        he:'דם מלא',  sub:'500 mL',    subHe:'500 מ״ל' }
];
var MARCH = [['M','x','BLEEDING','דימום'], ['A','a','AIRWAY','נתיב אוויר'], ['R','b','BREATHING','נשימה'], ['C','c','CIRCULATION','מחזור דם'], ['H','e','COLD / HEAD','קור / ראש'], ['P','e','PAIN','כאב']];

function ctx(){ return { x: (W._casualtyXABCDE || {}).x || {}, e: (W._casualtyXABCDE || {}).e || {}, vitals: W._casualtyVitals || [] }; }
function lastMed(re){ var m = ((ctx().e.medications) || []).filter(function(x){ return re.test(x.drug || x.name || ''); }); return m.length ? m[m.length - 1] : null; }
function vehicleOf(){ var c = (W._incidentCasualties || []).filter(function(x){ return x._docId === W._casualtyEditId; })[0]; return c && W.findVehicleForCasualty ? W.findVehicleForCasualty(c) : null; }

// ── Undo toast (8 s, big) ──────────────────────────────────────
var undoTimer = null;
function undoToast(msg, fn){
  var old = document.getElementById('undo-toast'); if (old) old.remove();
  var el = document.createElement('div'); el.id = 'undo-toast'; el.className = 'undo-toast no-polish'; el.setAttribute('role', 'status');
  el.innerHTML = '<span>' + msg + '</span>' + (fn ? '<button>' + L('UNDO','בטל') + '</button>' : '');
  if (fn) el.querySelector('button').onclick = function(){ fn(); el.remove(); };
  else el.onclick = function(){ el.remove(); };
  app().appendChild(el); clearTimeout(undoTimer); undoTimer = setTimeout(function(){ el.remove(); }, 8000);
  if (navigator.vibrate) navigator.vibrate(25);
}
function snapshot(){ if (W.pushMedHistory) W.pushMedHistory(); }
function doUndo(){ if (W.medUndo) W.medUndo(); }

// ── Panel markup ───────────────────────────────────────────────
function quickBanner(){
  var c = (W._incidentCasualties || []).filter(function(x){ return x._docId === W._casualtyEditId; })[0];
  if (!c || c.formLevel !== 'quick') return '';
  return '<div class="f-quick"><span class="f-qi">' + ico('zap', 30) + '</span><span><b>' + L('STARTED AS QUICK TRIAGE','נפתח כמיון מהיר') + '</b><small>' + L('Everything below is the full Form 101. Fill it in as you treat, then mark it complete.','כל מה שלמטה הוא טופס 101 המלא. מלאו תוך כדי טיפול, ואז סמנו כמלא.') + '</small></span><button onclick="Field.upgrade()">' + L('MARK AS FULL FORM 101','סמנו כטופס 101 מלא') + '</button></div>';
}
function idStrip(){
  var c = (W._incidentCasualties || []).filter(function(x){ return x._docId === W._casualtyEditId; })[0];
  var col = W._casualtyTriageColor, tg = col ? W.TriageUI.tg(col) : null;
  var dark = col === 'yellow' || col === 'gray';
  var X = W._casualtyXABCDE || {}, e = X.e || {};
  var who = [e.ageYears != null ? e.ageYears + L(' y',' שנים') : '', e.sex === 'M' || e.sex === 'male' ? L('Male','זכר') : (e.sex === 'F' || e.sex === 'female' ? L('Female','נקבה') : ''), e.weightKg ? e.weightKg + L(' kg',' ק״ג') : ''].filter(Boolean).join(' · ');
  var serial = c && W.Bracelet ? W.Bracelet.serialFor(c) : '';
  var live = (W._casualtyName || '').trim(), name = live ? esc(W.ShowcaseI18n ? W.ShowcaseI18n.tr(live) : live) : L('No name yet','עדיין ללא שם');
  return '<div class="f-id' + (dark ? ' dark' : '') + '" style="--tg:' + (tg ? tg.c : '#3a3f4a') + '">'
    + '<span class="f-id-i">' + (tg ? W.TriageUI.shapeSvg(tg.shape, 44) : ico('circle-help', 44)) + '</span>'
    + '<span class="f-id-t"><b>' + (tg ? L(tg.en, tg.he) : L('NOT TRIAGED','טרם סווג')) + '</b><em>' + name + '</em>' + (who && !/\d/.test(name) ? '<small>' + who + '</small>' : '') + '</span>'
    + (serial ? '<button class="f-id-b" onclick="Bracelet.open(\'' + esc(c._docId) + '\')" aria-label="' + L('Wristband','צמיד') + '"><small>' + L('NO.','מס׳') + '</small><b dir="ltr">' + esc(serial) + '</b><span>' + ico('qr-code', 24) + L('WRISTBAND','צמיד') + '</span></button>' : '')
    + '</div>';
}
function shockHtml(){
  var ctx = W.buildCasualtyContext ? W.buildCasualtyContext() : {};
  if (!ctx.deepShock && !ctx.shock) return '';
  return '<div class="f-shock" role="alert">' + ico('triangle-alert', 30) + '<span><b>' + (ctx.deepShock ? L('DEEP SHOCK','הלם עמוק') : L('SIGNS OF SHOCK','סימני הלם')) + '</b><small>' + L('Whole blood first, TXA within 3 h of injury, keep warm, evacuate now.','קודם דם מלא, TXA תוך 3 שעות מהפציעה, חימום, פינוי עכשיו.') + '</small></span></div>';
}
function html(){
  var c = ctx(), tqs = c.x.tourniquets || [], cur = W._casualtyTriageColor, h = idStrip() + quickBanner();
  // 1 · triage
  h += '<div class="f-h">' + L('SET TRIAGE','קביעת מיון') + '</div><div class="f-tri">';
  TRI.forEach(function(t){
    var on = cur === t[0], T = W.TriageUI.tg(t[0]);
    h += '<button class="f-tbtn t-' + t[0] + (on ? ' on' : '') + '" aria-pressed="' + on + '" onclick="Field.triage(\'' + t[0] + '\')">' + W.TriageUI.shapeSvg(T.shape, 32) + '<b>' + L(t[1], t[2]) + '</b>' + (on ? '<i>' + ico('check', 22) + L('SET','נקבע') + '</i>' : '') + '</button>';
  });
  h += '</div>';
  h += shockHtml() + injuryHtml();
  h += (Field.xcareHtml ? Field.xcareHtml() : '');
  var top = h; h = '';
  // 2 · clocks
  var tq0 = tqs[0], txa = lastMed(/^TXA/i), lv = c.vitals.length ? c.vitals[c.vitals.length - 1] : null, veh = vehicleOf();
  var tile = function(label, big, sub, cls){ return '<div class="f-clock ' + (cls || '') + '"><small>' + label + '</small><b>' + big + '</b><span>' + sub + '</span></div>'; };
  h += '<div class="f-clocks">'
    + (tq0 ? tile(L('TOURNIQUET ON','חוסם עורקים'), minsAgo(tq0.time) + '<u>' + L('MIN','ד׳') + '</u>', L('since ','מאז ') + hhmm(tq0.time), minsAgo(tq0.time) >= 120 ? 'bad' : 'warn') : tile(L('TOURNIQUET','חוסם עורקים'), L('NONE','אין'), L('none applied','לא הונח'), ''))
    + (txa ? tile('TXA', minsAgo(txa.time) + '<u>' + L('MIN','ד׳') + '</u>', L('given ','ניתן ') + hhmm(txa.time), 'ok') : (function(){ var ii = injuryInfo(); return !ii ? tile('TXA', L('NOT GIVEN','לא ניתן'), L('set time of injury','קבעו שעת פציעה'), 'warn') : ii.left > 0 ? tile('TXA', ii.left + '<u>' + L('MIN LEFT','דק׳ נותרו') + '</u>', L('of the 3-hour window','מחלון 3 השעות'), ii.left <= 30 ? 'bad' : 'warn') : tile('TXA', L('WINDOW CLOSED','החלון נסגר'), L('over 3 h since injury','מעל 3 שעות מהפציעה'), ''); })())
    + (lv ? tile(L('LAST VITALS','מדדים אחרונים'), minsAgo(lv.time) + '<u>' + L('MIN AGO','ד׳ לפני') + '</u>', L('logged ','נרשם ') + hhmm(lv.time), minsAgo(lv.time) > 10 ? 'warn' : '') : tile(L('VITALS','מדדים'), L('NONE','אין'), L('not measured','לא נמדדו'), 'warn'))
    + (veh ? tile(L('AMBULANCE','אמבולנס'), (W.Evac ? W.Evac.etaText(veh) : '—'), L('on board','על הסיפון'), 'ok') : tile(L('AMBULANCE','אמבולנס'), L('NOT YET','עדיין לא'), L('not assigned','לא שויך'), ''))
    + '</div>';
  // 3 · tourniquet
  h += '<button class="f-tq" onclick="Field.tq()">' + ico('timer', 34) + '<span>' + (tqs.length ? L('ANOTHER TOURNIQUET','חוסם עורקים נוסף') : L('TOURNIQUET ON','חוסם עורקים הונח')) + '</span></button>';
  if (tqs.length){
    h += '<div class="f-tqlist">' + tqs.map(function(q, i){ var nm = W.bodyLabelOut ? W.bodyLabelOut(q.site) : ((W.BODY_LABELS || {})[q.site] || q.site); return '<div class="f-tqrow"><span><b>' + esc(W.ShowcaseI18n ? W.ShowcaseI18n.tr(nm) : nm) + '</b><small>' + L('on at ','הונח ב-') + hhmm(q.time) + '</small></span><strong>' + minsAgo(q.time) + ' ' + L('MIN','ד׳') + '</strong></div>'; }).join('') + '</div>';
  }
  // 5 · vitals
  var v = { pulse:lastVal('pulse'), bpSys:lastVal('bpSys'), bpDia:lastVal('bpDia'), spo2:lastVal('spo2'), rr:lastVal('rr') };
  var num = function(x){ return x == null ? '—' : x; };
  h += '<div class="f-h">' + L('VITALS — TAP TO ENTER','מדדים — לחצו להזנה') + '</div><div class="f-vit">'
    + vt('HR', num(v.pulse), '/min', 0, v.pulse > 120 || (v.pulse != null && v.pulse < 50))
    + vt('BP', v.bpSys ? v.bpSys + '/' + (v.bpDia || '–') : '—', '', 1, v.bpSys && v.bpSys < 90)
    + vt('SpO₂', num(v.spo2), '%', 3, v.spo2 != null && v.spo2 < 92)
    + vt(L('BREATHS','נשימות'), num(v.rr), '/min', 4, v.rr != null && (v.rr > 30 || v.rr < 10))
    + '</div>'
    + '<div class="f-tapbar"><button onclick="Field.tapStart(\'pulse\')">' + ico('heart-pulse', 30) + '<span>' + L('TAP THE HEARTBEAT','הקישו את הדופק') + '</span></button><button onclick="Field.tapStart(\'rr\')">' + ico('wind', 30) + '<span>' + L('TAP THE BREATHS','הקישו את הנשימות') + '</span></button></div>';
  return '<section class="field" id="field" data-tour="field">' + top + '</section><section class="field fmon" id="fs-more"><div class="fs-h-wrap"><h2 class="fs-h">' + L('Monitor','ניטור') + '<small>' + L('Clocks, tourniquet, vitals','שעונים, חוסם עורקים, מדדים') + '</small></h2></div>' + h + '</section>';
}
function vt(label, val, unit, idx, bad){
  return '<button class="f-v' + (bad ? ' bad' : '') + '" onclick="Field.keypad(' + idx + ')"><small>' + label + '</small><b>' + val + '</b><span>' + unit + '</span></button>';
}

// latest MEASURED value of one vital (a later reading of only the pulse keeps the last BP on screen)
function lastVal(k){ var r = W._casualtyVitals || []; for (var i = r.length - 1; i >= 0; i--){ var x = r[i] && r[i][k]; if (x != null && x !== '') return x; } return null; }
// ── Actions ────────────────────────────────────────────────────
function render(){ W.MedHost.renderIncidentPage(); }
function injuryInfo(){
  var e = ctx().e, t = e.timeOfInjury ? Date.parse(e.timeOfInjury) : NaN;
  if (isNaN(t)) return null;
  var mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  return { t:t, mins:mins, left:180 - mins };
}
function hm(t){ var d = new Date(t); return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }
function injuryHtml(){
  var ii = injuryInfo(), val = ii ? hm(ii.t) : '';
  var txaG = lastMed(/^TXA/i);
  var note = txaG ? L('TXA given at ' + hm(Date.parse(txaG.time)) + (ii ? ' · injury ' + ii.mins + ' min ago' : ''), 'TXA ניתן ב-' + hm(Date.parse(txaG.time)) + (ii ? ' · פציעה לפני ' + ii.mins + ' דק׳' : '')) : !ii ? L('Needed for the TXA 3-hour window','נדרש לחלון TXA של 3 שעות')
    : ii.left > 0 ? L(ii.mins + ' min ago · TXA window: ' + ii.left + ' min left', 'לפני ' + ii.mins + ' דק׳ · חלון TXA: נותרו ' + ii.left + ' דק׳')
    : L(ii.mins + ' min ago · TXA window closed (over 3 h)', 'לפני ' + ii.mins + ' דק׳ · חלון TXA נסגר (מעל 3 שעות)');
  return '<div class="f-inj' + (ii && ii.left <= 0 ? ' late' : !ii ? ' unset' : '') + '"><label for="pat-inj">' + L('TIME OF INJURY','שעת הפציעה') + '</label>'
    + '<div class="f-inj-r"><input id="pat-inj" type="time" value="' + val + '" onchange="Field.setInjury(this.value)">'
    + '<button class="xbtn" onclick="Field.setInjury(\'now\')">' + L('NOW','עכשיו') + '</button></div><small>' + note + '</small></div>';
}
function patientHtml(){
  var e = ctx().e, sx = e.sex === 'M' || e.sex === 'male' ? 'M' : (e.sex === 'F' || e.sex === 'female' ? 'F' : '');
  var v = function(x){ return x == null || x === '' ? '' : esc(String(x)); };
  return '<div class="f-pat"><div class="f-pat-f"><label for="pat-age">' + L('AGE (YEARS)','גיל (שנים)') + '</label><input id="pat-age" data-k="age" class="fi" type="number" inputmode="numeric" min="0" max="120" placeholder="—" value="' + v(e.ageYears) + '" oninput="Field.patIn(this.dataset.k,this.value)" onchange="Field.patDone(this.dataset.k,this.value)"></div>'
    + '<div class="f-pat-f"><label for="pat-wt">' + L('WEIGHT (KG)','משקל (ק״ג)') + '</label><input id="pat-wt" data-k="wt" class="fi" type="number" inputmode="decimal" min="1" max="250" placeholder="—" value="' + v(e.weightKg) + '" oninput="Field.patIn(this.dataset.k,this.value)" onchange="Field.patDone(this.dataset.k,this.value)"></div>'
    + '<div class="f-pat-sex" role="group" aria-label="' + L('Sex','מין') + '"><button class="' + (sx === 'M' ? 'on' : '') + '" aria-pressed="' + (sx === 'M') + '" onclick="Field.setSex(this.dataset.s)" data-s="M">' + (sx === 'M' ? ico('check', 24) : '') + L('MALE','זכר') + '</button><button class="' + (sx === 'F' ? 'on' : '') + '" aria-pressed="' + (sx === 'F') + '" onclick="Field.setSex(this.dataset.s)" data-s="F">' + (sx === 'F' ? ico('check', 24) : '') + L('FEMALE','נקבה') + '</button></div></div>';
}
var Field = {
  html: html,
  patientHtml: patientHtml,
  injuryInfo: injuryInfo,
  setInjury: function(val){
    var X = W._casualtyXABCDE; if (!X) return; X.e = X.e || {};
    var d = new Date();
    if (val === 'now') d.setSeconds(0, 0);
    else { var m = /^(\d{1,2}):(\d{2})$/.exec(val || ''); if (!m) return; d.setHours(+m[1], +m[2], 0, 0); if (d.getTime() > Date.now() + 60000) d.setDate(d.getDate() - 1); }
    snapshot();
    X.e.timeOfInjury = d.toISOString();
    if (W.addTimestampedAction) W.addTimestampedAction('injury', 'שעת פציעה ' + hm(d.getTime()), '');
    W.MedHost.triggerAutoSave(); render();
    undoToast(L('Time of injury: ' + hm(d.getTime()), 'שעת פציעה: ' + hm(d.getTime())), doUndo);
  },
  patIn: function(k, val){
    var X = W._casualtyXABCDE; if (!X) return; X.e = X.e || {}; var n = parseFloat(val);
    if (!Field._patPend){ snapshot(); Field._patPend = true; }   // UNDO must return to the value from BEFORE the first keystroke
    if (k === 'age') X.e.ageYears = (!isNaN(n) && n >= 0 && n <= 120) ? Math.floor(n) : null;
    else X.e.weightKg = (!isNaN(n) && n >= 1 && n <= 250) ? n : null;
    W.MedHost.triggerAutoSave();
  },
  patDone: function(k, val){
    var had = Field._patPend; Field._patPend = false;
    // The undo step for this edit was taken before the first keystroke; stop the engine adding a second one that already contains the new value.
    var hold = function(){ W._medPushLock = true; Promise.resolve().then(function(){ W._medPushLock = false; }); };
    var n = parseFloat(val); if (isNaN(n)) return;
    var pd = Field._pd = (Field._pd && Field._pd.c === W._casualtyXABCDE) ? Field._pd : { c: W._casualtyXABCDE };
    if (pd[k] === n) return;   // the same value committed again (blur after change): no empty UNDO step
    pd[k] = n;
    if (k === 'age'){ if (n < 0 || n > 120){ undoToast(L('Age must be 0 to 120','הגיל חייב להיות 0 עד 120'), null); return; } if (had) hold(); else snapshot(); W._setPatientAge(Math.floor(n)); }
    else { if (n < 1 || n > 250){ undoToast(L('Weight must be 1 to 250 kg','המשקל חייב להיות 1 עד 250 ק״ג'), null); return; } if (had) hold(); else snapshot(); W._setPatientWeight(n); }
  },
  setSex: function(s){
    var X = W._casualtyXABCDE; if (!X) return; snapshot(); X.e = X.e || {};
    X.e.sex = (X.e.sex === s) ? '' : s;
    W.MedHost.triggerAutoSave(); render();
  },
  triage: function(color){
    if (W._casualtyTriageColor === color){ var T0 = W.TriageUI.tg(color); undoToast(L('Already set: ' + T0.en, 'כבר נקבע: ' + T0.he), null); return; }
    snapshot();
    W._casualtyTriageColor = color; W._casualtyEvacPriority = EVAC[color] || '';
    var T = W.TriageUI.tg(color);
    if (W.addTimestampedAction) W.addTimestampedAction('triage', 'טריאז׳ — ' + T.he, '');
    W.MedHost.triggerAutoSave(); render();
    undoToast(L('Triage set: ' + T.en, 'מיון נקבע: ' + T.he), doUndo);
  },
  tq: function(){
    var ut = document.getElementById('undo-toast'); if (ut) ut.remove();
    var el = document.createElement('div'); el.id = 'f-sheet'; el.className = 'sheet-wrap no-polish';
    el.innerHTML = '<div class="sheet-dim" onclick="Field.closeSheet()"></div><div class="sheet" role="dialog" aria-label="Tourniquet"><div class="sheet-grab"></div><h3>' + L('WHERE IS THE TOURNIQUET?','איפה חוסם העורקים?') + '</h3><p class="sheet-p">' + L('The time is recorded automatically.','הזמן נרשם אוטומטית.') + '</p><div class="f-sites">'
      + SITES.map(function(s){ return '<button onclick="Field.tqSite(\'' + s[0] + '\')">' + L(s[1], s[2]) + '</button>'; }).join('')
      + '</div><button class="xbtn f-cancel" onclick="Field.closeSheet()">' + L('CANCEL','ביטול') + '</button></div>';
    app().appendChild(el);
  },
  tqSite: function(site){
    Field.closeSheet(); snapshot();
    W.addTourniquetEntry(site);
    var s = SITES.filter(function(x){ return x[0] === site; })[0];
    undoToast(L('Tourniquet ON — ' + (s ? s[1] : site) + ' — ' + hhmm(new Date().toISOString()), 'חוסם עורקים הונח — ' + (s ? s[2] : site) + ' — ' + hhmm(new Date().toISOString())), doUndo);
  },
  closeSheet: function(){ var s = document.getElementById('f-sheet'); if (s) s.remove(); },
  march: function(tab){
    W._casualtyActiveTab = tab; render();
    setTimeout(function(){ if (W.FormUI) W.FormUI.jump('fs-care'); }, 60);
  },
  // Doses come from the IDF protocol: adult TXA 1 g, ketamine 25 mg IV, blood 500 mL; child TXA 15 mg/kg (max 1 g), ketamine 0.3 mg/kg, fluid 20 mL/kg (max 500 mL).
  dosing: function(g){
    var e = ctx().e, peds = W.isPedsMode && W.isPedsMode();
    if (!peds) return { dose:g.dose, vol:g.vol, sub:g.sub, subHe:g.subHe };
    var kg = e.weightKg || (e.ageYears != null && W._broselowWeight ? W._broselowWeight(e.ageYears) : null);
    if (!kg) return null;
    var note = e.weightKg ? '' : '~';
    if (g.key === 'txa'){ var mg = Math.min(1000, Math.round(15 * kg)); return { dose:mg + 'mg', sub:mg + ' mg IV (15 mg/kg, ' + note + kg + ' kg)', subHe:mg + ' מ״ג IV (15 מ״ג/ק״ג, ' + note + kg + ' ק״ג)' }; }
    if (g.key === 'ket'){ var k = Math.round(0.3 * kg * 10) / 10; return { dose:k + 'mg', sub:k + ' mg IV (0.3 mg/kg, ' + note + kg + ' kg)', subHe:k + ' מ״ג IV (0.3 מ״ג/ק״ג, ' + note + kg + ' ק״ג)' }; }
    if (g.key === 'blood'){ var ml = Math.min(500, Math.round(20 * kg)); return { vol:ml, sub:ml + ' mL (20 mL/kg, ' + note + kg + ' kg)', subHe:ml + ' מ״ל (20 מ״ל/ק״ג, ' + note + kg + ' ק״ג)' }; }
    if (g.key === 'cef'){ var c = Math.min(2000, Math.round(100 * kg / 50) * 50); return { dose:c + 'mg', sub:c + ' mg IV (' + note + kg + ' kg)', subHe:c + ' מ״ג IV (' + note + kg + ' ק״ג)' }; }
    return { dose:g.dose, vol:g.vol, sub:g.sub, subHe:g.subHe };
  },
  // Things the medic should see before a repeat or an out-of-window dose. Returns plain sentences in the display language.
  warn: function(g){
    var X = W._casualtyXABCDE || {}, meds = (X.e || {}).medications || [], fl = (X.c || {}).fluids || [], now = Date.now(), out = [];
    var mins = function(t){ return Math.round((now - new Date(t).getTime()) / 60000); };
    var last = function(re){ var m = meds.filter(function(x){ return re.test(x.drug || x.name || ''); }); return m.length ? m[m.length - 1] : null; };
    if (g.key === 'txa'){
      var t = last(/^TXA/i), inj = (W._casualtyTimeline || []).filter(function(x){ return x.category === 'injury'; })[0], e0 = (X.e || {}).timeOfInjury;
      if (t) out.push(L('TXA was already given ' + mins(t.time) + ' min ago. One dose only.', 'TXA כבר ניתן לפני ' + mins(t.time) + ' דקות. מנה אחת בלבד.'));
      var it = e0 || (inj && inj.time);
      if (it && mins(it) > 180) out.push(L('More than 3 hours since injury. TXA gives no benefit now.', 'עברו יותר מ-3 שעות מהפציעה. אין יתרון ל-TXA.'));
      if (fl.some(function(f){ return /דם|פלזמה|כדוריות/.test(f.type || ''); })) out.push(L('Blood in the line. Flush 10 mL saline between TXA and blood.', 'דם בקו. שטפו 10 מ״ל מלח בין TXA לדם.'));
    } else if (g.key === 'ket'){
      var k = last(/^קטמין|ketamine/i); if (k && mins(k.time) < 20) out.push(L('Ketamine was given ' + mins(k.time) + ' min ago. Repeat only after 20 min.', 'קטמין ניתן לפני ' + mins(k.time) + ' דקות. מנה חוזרת רק אחרי 20 דקות.'));
    } else if (g.key === 'cef'){
      var c = last(/צפטריאקסון|ceftriaxone/i); if (c && mins(c.time) < 12 * 60) out.push(L('Ceftriaxone was already given at ' + hhmm(c.time) + '.', 'צפטריאקסון כבר ניתן ב-' + hhmm(c.time) + '.'));
      if (fl.some(function(f){ return /הרטמן|Ringer/i.test(f.type || ''); })) out.push(L('Ringer in the line. Never mix with ceftriaxone. Flush the line first.', 'הרטמן בקו. לעולם לא לערבב עם צפטריאקסון. שטפו את הקו קודם.'));
    } else if (g.fluid){
      var f = fl.filter(function(x){ return x.type === g.type; }).slice(-1)[0]; if (f && mins(f.time) < 5) out.push(L('Blood was given ' + mins(f.time) + ' min ago. Reassess shock before the next unit.', 'דם ניתן לפני ' + mins(f.time) + ' דקות. העריכו הלם מחדש לפני המנה הבאה.'));
    }
    return out;
  },
  give: function(key, ok){
    var g = GIVE.filter(function(x){ return x.key === key; })[0]; if (!g) return;
    var d = Field.dosing(g);
    if (!d){ undoToast(L('Child: enter weight or age first (Record section).','ילד: הזינו משקל או גיל קודם (באזור התיק).'), null); return; }
    var w = ok ? [] : Field.warn(g);
    if (w.length){
      Field.closeSheet();
      var el = document.createElement('div'); el.id = 'f-sheet'; el.className = 'sheet-wrap no-polish';
      el.innerHTML = '<div class="sheet-dim" onclick="Field.closeSheet()"></div><div class="sheet" role="dialog" aria-label="' + L('Check before giving','בדקו לפני מתן') + '"><div class="sheet-grab"></div><h3>' + L(g.en + ': CHECK FIRST', g.he + ': בדקו קודם') + '</h3>'
        + w.map(function(t){ return '<p class="sheet-p f-warn"><b>' + esc(t) + '</b></p>'; }).join('')
        + '<button class="xbtn f-cancel" onclick="Field.closeSheet()">' + L('CANCEL','ביטול') + '</button><button class="xbtn xbtn-primary" onclick="Field.closeSheet();Field.give(\'' + key + '\', true)">' + (w.every(function(t){ return /flush|שטפו/i.test(t); }) ? L('FLUSHED — GIVE','נשטף — תנו') : L('GIVE ANYWAY','תנו בכל זאת')) + '</button></div>';
      app().appendChild(el); return;
    }
    snapshot();
    var X = W._casualtyXABCDE, nMed = (X.e.medications || []).length, nFl = (X.c.fluids || []).length;
    W._fieldConfirmed = true;
    try { if (g.fluid) W.addFluidEntry(g.type, d.vol); else W.addMedication(g.drug, d.dose, g.route); } finally { W._fieldConfirmed = false; }
    if ((X.e.medications || []).length === nMed && (X.c.fluids || []).length === nFl){ if (W._medUndoStack) W._medUndoStack.pop(); return; }
    undoToast(L(g.en + ' ' + d.sub + ' — given ' + hhmm(new Date().toISOString()), g.he + ' ' + d.subHe + ' — ניתן ' + hhmm(new Date().toISOString())), doUndo);
  },
  undo: function(){ var had = (W._medUndoStack || []).length; doUndo(); undoToast(had ? L('Undone: the last action was reversed','בוטל: הפעולה האחרונה הוחזרה') : L('Nothing to undo','אין מה לבטל'), null); },
  upgrade: function(){ var c = (W._incidentCasualties || []).filter(function(x){ return x._docId === W._casualtyEditId; })[0]; if (!c) return; W._upsertOfflineCasualty({ _docId:c._docId, formLevel:'full' }); undoToast(L('Now a FULL Form 101','כעת טופס 101 מלא'), null); render(); },

  // ── Vitals keypad ────────────────────────────────────────────
  _k: null,
  keypad: function(idx){
    var fields = [
      { k:'pulse', en:'HEART RATE', he:'דופק', unit:'/min', min:20, max:300 },
      { k:'bpSys', en:'BLOOD PRESSURE — TOP NUMBER', he:'לחץ דם — מספר עליון', unit:'mmHg', min:30, max:300 },
      { k:'bpDia', en:'BLOOD PRESSURE — BOTTOM NUMBER', he:'לחץ דם — מספר תחתון', unit:'mmHg', min:10, max:200 },
      { k:'spo2',  en:'OXYGEN (SpO₂)', he:'חמצן (SpO₂)', unit:'%', min:30, max:100 },
      { k:'rr',    en:'BREATHS PER MINUTE', he:'נשימות בדקה', unit:'/min', min:1, max:80 }
    ];
    var vi = (W._casualtyVitalsInput = W._casualtyVitalsInput || {});
    Field._k = { f: fields, i: idx === 1 ? 1 : idx, v: { pulse:'', bpSys:'', bpDia:'', spo2:'', rr:'' } };
    // BP tile starts at the top number; the SpO2/RR tiles map to fields 3/4
    if (idx === 3) Field._k.i = 3; if (idx === 4) Field._k.i = 4;
    Field._kpDraw(true);
  },
  _kpDraw: function(create){
    var K = Field._k; if (!K) return;
    var ut = document.getElementById('undo-toast'); if (ut) ut.remove();
    var f = K.f[K.i], cur = K.v[f.k], last = K.i === K.f.length - 1;
    var keys = ['1','2','3','4','5','6','7','8','9','⌫','0','OK'];
    var sheet = document.getElementById('f-kp');
    if (!sheet){ sheet = document.createElement('div'); sheet.id = 'f-kp'; sheet.className = 'sheet-wrap no-polish'; app().appendChild(sheet); }
    sheet.innerHTML = '<div class="sheet-dim" onclick="Field.kpClose()"></div><div class="sheet kp" role="dialog" aria-label="' + L('Vitals keypad','מקלדת מדדים') + '"><div class="sheet-grab"></div>'
      + '<div class="kp-step" dir="ltr">' + (K.i + 1) + ' / ' + K.f.length + '</div>'
      + '<div class="kp-label">' + L(f.en, f.he) + '</div>'
      + '<div class="kp-val"><b>' + (cur === '' ? '—' : cur) + '</b><span>' + f.unit + '</span></div>'
      + '<div class="kp-hint' + (K.err ? ' bad' : '') + '" role="status">' + (K.err || L('Allowed: ' + f.min + ' to ' + f.max + (f.k === 'pulse' || f.k === 'rr' ? ', or 0 for none' : ''), 'טווח מותר: ' + f.min + ' עד ' + f.max + (f.k === 'pulse' || f.k === 'rr' ? ', או 0 אם אין' : ''))) + '</div>'
      + '<div class="kp-keys">' + keys.map(function(k){ return '<button class="' + (k === 'OK' ? 'ok' : k === '⌫' ? 'del' : '') + '" onclick="Field.kpKey(\'' + k + '\')">' + (k === 'OK' ? (last ? L('SAVE','שמור') : L('NEXT','הבא')) : (k === '⌫' ? '<span class="kp-del">' + ico(lang() === 'he' ? 'arrow-right' : 'arrow-left', 26) + L('DELETE','מחק') + '</span>' : k)) + '</button>'; }).join('') + '</div>'
      + (lastVal(f.k) != null ? '<button class="xbtn kp-same" onclick="Field.kpSame()">' + L('SAME AS LAST: ','כמו הקודם: ') + lastVal(f.k) + '</button>' : '') + '<div class="kp-row"><button class="xbtn" onclick="Field.kpSkip()">' + L('SKIP','דלג') + '</button><button class="xbtn xbtn-primary" onclick="Field.kpSave()">' + L('SAVE NOW','שמור עכשיו') + '</button></div></div>';
  },
  // Returns '' when the field is fine, otherwise a sentence saying why not.
  _kpCheck: function(i){
    var K = Field._k, f = K.f[i], v = K.v[f.k]; if (v === '') return '';
    var n = parseInt(v, 10);
    if (n === 0 && (f.k === 'pulse' || f.k === 'rr')) return '';   // 0 = no pulse / not breathing: a real finding that must be recordable
    if (n < f.min || n > f.max) return L('Not possible. Allowed: ' + f.min + ' to ' + f.max, 'לא אפשרי. טווח מותר: ' + f.min + ' עד ' + f.max);
    if (f.k === 'bpDia' && K.v.bpSys !== '' && n >= parseInt(K.v.bpSys, 10)) return L('Bottom number must be lower than the top number', 'המספר התחתון חייב להיות נמוך מהעליון');
    if (f.k === 'bpSys' && K.v.bpDia !== '' && n <= parseInt(K.v.bpDia, 10)) return L('Top number must be higher than the bottom number', 'המספר העליון חייב להיות גבוה מהתחתון');
    return '';
  },
  kpKey: function(k){
    var K = Field._k; if (!K) return; var f = K.f[K.i]; K.err = '';
    if (k === '⌫'){ K.v[f.k] = K.v[f.k].slice(0, -1); }
    else if (k === 'OK'){ K.err = Field._kpCheck(K.i); if (K.err){ if (navigator.vibrate) navigator.vibrate([30, 40, 30]); return Field._kpDraw(); } if (K.i === K.f.length - 1) return Field.kpSave(); K.i++; }
    else { var nv = ((K.v[f.k] === '0' ? '' : K.v[f.k]) + k).slice(0, 3); if (parseInt(nv, 10) <= f.max) K.v[f.k] = nv; }
    if (navigator.vibrate) navigator.vibrate(8);
    Field._kpDraw();
  },
  kpSame: function(){ var K = Field._k; if (!K) return; var f0 = K.f[K.i], lv0 = lastVal(f0.k); if (lv0 != null){ K.v[f0.k] = String(lv0); if (K.i < K.f.length - 1) K.i++; Field._kpDraw(); } },
  kpSkip: function(){ var K = Field._k; if (!K) return; K.err = ''; if (K.i === K.f.length - 1) return Field.kpSave(); K.i++; Field._kpDraw(); },
  kpClose: function(){ var s = document.getElementById('f-kp'); if (s) s.remove(); Field._k = null; },
  kpSave: function(){
    var K = Field._k; if (!K) return; var v = K.v;
    for (var ci = 0; ci < K.f.length; ci++){ var msg = Field._kpCheck(ci); if (msg){ K.i = ci; K.err = msg; if (navigator.vibrate) navigator.vibrate([30, 40, 30]); return Field._kpDraw(); } }
    var any = v.pulse || v.bpSys || v.bpDia || v.spo2 || v.rr;
    Field.kpClose();
    if (!any) return;
    snapshot();
    var vi0 = W._casualtyVitalsInput || {}, pick = function(a, b){ return a !== '' && a != null ? a : (b || ''); };
    W._casualtyVitalsInput = { pulse:v.pulse || '', rr:v.rr || '', spo2:v.spo2 || '', bpSys:v.bpSys || '', bpDia:v.bpDia || '', temp:'', etco2:'', radialPulse:'' };
    W.addVitalsReading();
    undoToast(L('Vitals saved', 'מדדים נשמרו'), doUndo);
  }
};
Field.toast = undoToast;
W.Field = Field;
})();
