/* FIELD PANEL — the first thing on a casualty card. Built for a gloved, stressed medic:
   one-tap triage, one-tap tourniquet with automatic time, MARCH tiles with words, big-number vitals + keypad,
   one-tap "give now" drugs with an 8-second UNDO. Calls the existing engine functions; adds no new clinical logic. */
(function(){
'use strict';
var W = window;
// Lucide icons missing from ui-icons.js (ISC), drawn with the same Icon() wrapper
(function(){
  var X = {
    'pencil':'<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    'person-standing':'<circle cx="12" cy="5" r="1"/><path d="m9 20 3-6 3 6"/><path d="m6 8 6 2 6-2"/><path d="M12 10v4"/>',
    'trash-2':'<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    'skip-forward':'<path d="M5 4l10 8-10 8z"/><path d="M19 5v14"/>',
    'save':'<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
    'ear':'<path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0"/><path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4"/>',
    'eye-off':'<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
    'message-circle':'<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    'audio-lines':'<path d="M2 10v3"/><path d="M6 6v11"/><path d="M10 3v18"/><path d="M14 8v7"/><path d="M18 5v13"/><path d="M22 10v3"/>',
    'mic-off':'<path d="M12 19v3"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M16.95 16.95A7 7 0 0 1 5 12v-2"/><path d="M18.89 13.23A7 7 0 0 0 19 12v-2"/><path d="m2 2 20 20"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/>',
    'thumbs-up':'<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>',
    'minimize-2':'<path d="m14 10 7-7"/><path d="M20 10h-6V4"/><path d="m3 21 7-7"/><path d="M4 14h6v6"/>',
    'maximize-2':'<path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/><path d="M9 21H3v-6"/>',
    'dot':'<circle cx="12" cy="12" r="2.5" fill="currentColor"/><circle cx="12" cy="12" r="9"/>',
    'chevrons-down':'<path d="m7 6 5 5 5-5"/><path d="m7 13 5 5 5-5"/>',
    'heart-handshake':'<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>'
  };
  var base = W.Icon; if (!base || base.__ext) return;
  var ext = function(n, size, cls){
    if (!X[n] || (base.has && base.has(n))) return base(n, size, cls);
    size = size || 18;
    return '<svg class="ui-i' + (cls ? ' ' + cls : '') + '" style="width:' + size + 'px;height:' + size + 'px" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + X[n] + '</svg>';
  };
  ext.has = function(n){ return !!X[n] || (base.has ? base.has(n) : false); }; ext.__ext = true; W.Icon = ext;
})();
// "Waiting" is one category (black colour, square shape): any record still marked gray is shown and treated as black
W.normTriage = function(c){ var col = typeof c === 'string' ? c : (c && c.triageColor); return col === 'gray' ? 'black' : col; };
// Engine strings added for this panel (handoff injury line with exact wound points)
(function(d){ if (W.ShowcaseI18n && W.ShowcaseI18n.extend) W.ShowcaseI18n.extend(d); else if (W.SHOWCASE_DICT) Object.assign(W.SHOWCASE_DICT, d); })({ 'נקודות מסומנות':'marked points', 'נקודה מסומנת':'marked point', 'פציעה':'injury', 'נקז חזה':'Chest tube', 'בחרו טיפול, ואז לחצו על הגוף':'Pick one, then tap the body', 'עכשיו לחצו על הגוף':'Now tap the body',
  // recommendations are worded as suspicion, never as a diagnosis
  'חשד להלם עמוק (':'Suspected deep shock (', 'חשד להלם עמוק':'Suspected deep shock',
  'חשד להלם עמוק (קריטריון 2026) — דם מלא ראשון; הימנע מאינטובציה ואופיואידים':'Suspected deep shock (2026 criterion) — whole blood first; avoid intubation and opioids',
  'חשד להלם עמוק — מומלץ: דם מלא ראשון':'Suspected deep shock — whole blood first',
  '⚠ חשד להלם עמוק — הימנע מאינטובציה (RSI) אם אפשר. שקול NPA/OPA + BMV + פינוי דחוף.':'⚠ Suspected deep shock — avoid intubation (RSI) if possible. Consider NPA/OPA + BMV + urgent evacuation.' });
function lang(){ return (W.ShowcaseI18n && W.ShowcaseI18n.lang) || 'en'; }
function L(en, he){ return lang() === 'he' ? he : en; }
function ico(n, s){ return W.Icon ? W.Icon(n, s) : ''; }
function esc(s){ return W.escapeHtml(s); }
function hhmm(iso){ var d = new Date(iso); return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }
function minsAgo(iso){ return Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)); }
function app(){ return document.getElementById('app'); }

var TRI = [['red','URGENT','דחוף'], ['yellow','DELAYED','עדיפות שנייה'], ['green','NOT URGENT','לא דחוף'], ['black','WAITING','ממתין']];   // one category: black colour, square, named Waiting
var EVAC = { red:'immediate', yellow:'urgent', green:'routine', gray:'expectant', black:'' };
if (W.ShowcaseI18n && W.ShowcaseI18n.extend){ var _td = {}; TRI.forEach(function(t){ _td['טריאז׳ — ' + t[2]] = 'Triage — ' + t[1]; }); _td['הלם — קטמין קו ראשון; מורפין 2mg בלבד; ללא Actiq / פנטניל'] = 'Shock: ketamine first line; morphine 2 mg only; no Actiq or fentanyl'; _td['מורפין 2mg IV (הלם)'] = 'Morphine 2 mg IV (shock)'; _td['הערכה חוזרת: ללא החמרה, הולכת'] = 'Reassessment: no deterioration, walking'; _td['אדום — דחוף'] = 'Red — URGENT'; _td['צהוב — דחוי'] = 'Yellow — DELAYED'; _td['ירוק — לא דחוף'] = 'Green — NOT URGENT'; _td['אפור — ממתין'] = 'Gray — WAITING'; _td['שחור — ללא סימני חיים'] = 'Black — WAITING'; _td['שחור — ממתין'] = 'Black — WAITING'; W.ShowcaseI18n.extend(_td); }
var SITES = [['r_upper_arm','Right arm','יד ימין'], ['l_upper_arm','Left arm','יד שמאל'], ['r_thigh','Right leg (thigh)','רגל ימין (ירך)'], ['l_thigh','Left leg (thigh)','רגל שמאל (ירך)'], ['r_shin','Right lower leg','שוק ימין'], ['l_shin','Left lower leg','שוק שמאל']];
var GIVE = [
  { key:'txa',  drug:'TXA',          dose:'1g',    route:'IV', en:'TXA',        he:'TXA',     sub:'1 g IV',    subHe:'1 גרם IV' },
  { key:'ket',  drug:'קטמין',        dose:'25mg',  route:'IV', en:'Ketamine',   he:'קטמין',   sub:'25 mg IV',  subHe:'25 מ״ג IV' },
  { key:'cef',  drug:'צפטריאקסון',   dose:'2g',    route:'IV', en:'Ceftriaxone',he:'צפטריאקסון', sub:'2 g IV', subHe:'2 גרם IV' },
  { key:'blood',fluid:true, type:'דם מלא', vol:500, en:'Whole blood',        he:'דם מלא',  sub:'500 mL',    subHe:'500 מ״ל' }
];
var MARCH = [['M','x','Bleeding','דימום'], ['A','a','Airway','נתיב אוויר'], ['R','b','Breathing','נשימה'], ['C','c','Circulation','מחזור דם'], ['H','e','Cold / head','קור / ראש'], ['P','e','Pain','כאב']];

var ACCESS = [['ivr','IV right arm','יד ימין','Peripheral line','קו פריפרי'], ['ivl','IV left arm','יד שמאל','Peripheral line','קו פריפרי'], ['ioh','IO humerus','IO הומרוס','Bone needle, upper arm','מחט גרמית, זרוע'], ['iot','IO tibia','IO טיביה','Bone needle, shin','מחט גרמית, שוק']];
// One label for an access site, whatever spelling it was stored with ("יד R", "יד ימין", "IO hum-L", "IO הומרוס")
W.accessLabel = function(site){
  var s0 = String(site || ''), io = /^IO\b/i.test(s0), side = /(\bR\b|-R\b|ימין)/.test(s0) ? 'R' : /(\bL\b|-L\b|שמאל)/.test(s0) ? 'L' : '';
  var where = io ? (/hum|הומרוס/i.test(s0) ? ['humerus','הומרוס'] : /tib|טיביה/i.test(s0) ? ['tibia','טיביה'] : ['bone','עצם']) : (/AC/.test(s0) ? ['elbow','מרפק'] : /EJ/.test(s0) ? ['neck vein','וריד צוואר'] : ['arm','יד']);
  var sd = side === 'R' ? ['right ','ימין'] : side === 'L' ? ['left ','שמאל'] : ['',''];
  return io ? L('IO · ' + sd[0] + where[0], 'IO · ' + where[1] + (sd[1] ? ' ' + sd[1] : '')) : L('IV · ' + sd[0] + where[0], 'IV · ' + where[1] + (sd[1] ? ' ' + sd[1] : ''));
};
var IVONLY = { txa:1, blood:1, hart:1, ket:1, mor:1, cef:1, met:1, mid:1 };
function hasAccess(){ return (((W._casualtyXABCDE || {}).c || {}).ivAccess || []).length > 0; }
// What the top undo step would remove, in words: compare the snapshot with the record now.
function lastChange(snap){
  var tr = function(x){ return W.ShowcaseI18n ? W.ShowcaseI18n.tr(String(x)) : String(x); };
  try {
    var o = JSON.parse(snap), X = W._casualtyXABCDE || {}, ox = o.xabcde || {};
    var m = (X.e || {}).medications || [], om = (ox.e || {}).medications || [];
    if (m.length > om.length){ var d = m[m.length - 1]; return { drug:true, label:esc(tr(d.drug || d.name || '')) + ' ' + esc(String(d.dose || '')) + ', ' + hhmm(d.time) }; }
    var f = (X.c || {}).fluids || [], of = (ox.c || {}).fluids || [];
    if (f.length > of.length){ var q = f[f.length - 1]; return { drug:true, label:esc(tr(q.type || '')) + ' ' + (q.volume || q.vol || '') + ' mL, ' + hhmm(q.time) }; }
    var t = W._casualtyTimeline || [], ot = o.timeline || [];
    if (t.length > ot.length){ var a = t[t.length - 1]; return { label:esc(tr(a.action || a.text || '')) }; }
  } catch (e) {}
  return { label:L('the last action','הפעולה האחרונה') };
}
function ctx(){ return { x: (W._casualtyXABCDE || {}).x || {}, e: (W._casualtyXABCDE || {}).e || {}, vitals: W._casualtyVitals || [] }; }
function lastMed(re){ var m = ((ctx().e.medications) || []).filter(function(x){ return re.test(x.drug || x.name || ''); }); return m.length ? m[m.length - 1] : null; }
function vehicleOf(){ var c = (W._incidentCasualties || []).filter(function(x){ return x._docId === W._casualtyEditId; })[0]; return c && W.findVehicleForCasualty ? W.findVehicleForCasualty(c) : null; }

// ── Undo toast (8 s, big) ──────────────────────────────────────
var undoTimer = null;
function undoToast(msg, fn){
  var old = document.getElementById('undo-toast'); if (old) old.remove();
  var el = document.createElement('div'); el.id = 'undo-toast'; el.className = 'undo-toast no-polish'; el.setAttribute('role', 'status');
  el.innerHTML = '<span>' + msg + '</span>' + (fn ? '<button>' + ico('undo-2', 24) + '<span>' + L('Undo','בטל') + '</span></button>' : '');
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
  return '<div class="f-quick"><span class="f-qi">' + ico('zap', 30) + '</span><span><b>' + L('Started as quick triage','נפתח כמיון מהיר') + '</b><small>' + L('Everything below is the full Form 101. Fill it in as you treat, then mark it complete.','כל מה שלמטה הוא טופס 101 המלא. מלאו תוך כדי טיפול, ואז סמנו כמלא.') + '</small></span><button onclick="Field.upgrade()">' + L('Mark as full Form 101','סמנו כטופס 101 מלא') + '</button></div>';
}
function idStrip(){
  var c = (W._incidentCasualties || []).filter(function(x){ return x._docId === W._casualtyEditId; })[0];
  var col = W._casualtyTriageColor, tg = col ? W.TriageUI.tg(col) : null;
  var dark = col === 'yellow' || col === 'gray';
  var X = W._casualtyXABCDE || {}, e = X.e || {};
  var who = [e.ageYears != null ? e.ageYears + L(' y',' שנים') : '', e.sex === 'M' || e.sex === 'male' ? L('Male','זכר') : (e.sex === 'F' || e.sex === 'female' ? L('Female','נקבה') : ''), e.weightKg ? e.weightKg + L(' kg',' ק״ג') : ''].filter(Boolean).join(' · ');
  var serial = c && W.Bracelet ? W.Bracelet.serialFor(c) : '';
  var live = (W._casualtyName || '').trim(), name = live ? esc(W.ShowcaseI18n ? W.ShowcaseI18n.tr(live) : live) : L('No name yet','עדיין ללא שם');
  var parts = String(name).split(' — '), sub = parts.slice(1).join(' — ') || who;
  // One compact row: who this is + their wristband. The triage selector right below carries the triage state.
  return '<div class="f-id' + (live ? '' : ' noname') + '">'
    + (W.casBadge ? W.casBadge({ name: W._casualtyName }, true) : '') + '<span class="f-id-t"><b>' + parts[0] + '</b><button class="f-id-who" onclick="Field.editWho()" aria-label="' + L('Edit age, sex and weight','עריכת גיל, מין ומשקל') + '">' + (who || L('Age · sex · weight','גיל · מין · משקל'))
    + (e.weightKg ? '' : '<u>' + L('Add weight','הוסיפו משקל') + '</u>') + ico('pencil', 20) + '</button></span>'
    + (c && c.tagId ? '<button class="f-id-b f-id-tag" onclick="Bracelet.open(\'' + esc(c._docId) + '\')" aria-label="' + L('Tag ','תג ') + esc(c.tagId) + '">' + ico('tag', 26) + '<b dir="ltr">' + esc(c.tagId) + '</b></button>'
       : '<button class="f-id-b f-id-link" onclick="Bracelet.linkForm()">' + ico('scan-line', 26) + '<b>' + L('Scan tag','סריקת תג') + '</b></button>')
    + '</div>';
}
function shockHtml(){
  var ctx = W.buildCasualtyContext ? W.buildCasualtyContext() : {};
  if ((!ctx.deepShock && !ctx.shock) || W._casualtyTriageColor === 'black') return '';
  var ii = injuryInfo(), txaTxt = lastMed(/^TXA/i) ? L('TXA given', 'TXA ניתן') : (ii && ii.left <= 0) ? L('TXA window closed', 'חלון TXA נסגר') : L('TXA within 3 h of injury', 'TXA תוך 3 שעות מהפציעה');
  return '<div class="f-shock" role="alert">' + ico('triangle-alert', 30) + '<span><b>' + (ctx.deepShock ? L('Suspected deep shock','חשד להלם עמוק') : L('Signs of shock','סימני הלם')) + '</b><small>' + L('Whole blood first · ' + txaTxt + ' · keep warm · evacuate now.','קודם דם מלא · ' + txaTxt + ' · חימום · פינוי עכשיו.') + '</small></span></div>';
}
function html(){
  if (W._casualtyTriageColor === 'gray') W._casualtyTriageColor = 'black';   // gray and black are one category: Waiting
  (W._incidentCasualties || []).forEach(function(k){ if (k.triageColor === 'gray') k.triageColor = 'black'; });
  var c = ctx(), tqs = c.x.tourniquets || [], cur = W._casualtyTriageColor, h = idStrip() + quickBanner();
  // 1 · triage
  var tbtn = function(t){
    var on = cur === t[0], T = W.TriageUI.tg(t[0]);
    return '<button class="f-tbtn t-' + t[0] + (on ? ' on' : '') + '" aria-pressed="' + on + '" onclick="Field.triage(\'' + t[0] + '\')"><span class="f-tsh">' + W.TriageUI.shapeSvg(T.shape, 30) + '</span><b>' + L(t[1], t[2]) + '</b>' + (on ? '<i>' + ico('check', 22) + L('Set','נקבע') + '</i>' : '') + '</button>';
  };
  h += '<div class="f-trig' + (cur ? ' has' : '') + '" role="group" aria-label="' + L('Triage','מיון') + '"><div class="f-h">' + L('Triage','מיון') + '</div>'
    + '<div class="f-tri">' + TRI.slice(0, 3).map(tbtn).join('') + '</div><div class="f-tri f-tri3">' + tbtn(TRI[3]) + '</div></div>';
  if (cur === 'black') h += '<p class="f-dead">' + L('Only a doctor declares death. In a mass-casualty event, treat everyone with signs of life first.','רק רופא קובע מוות. באר״ן מטפלים קודם בכל מי שיש לו סימני חיים.') + '</p>';
  h += shockHtml() + injuryHtml() + accessHtml() + '<div class="f-duo"><button class="f-gcs-b" onclick="Field.gcsSheet()">' + ico('eye', 26) + '<span><b>' + L('GCS and pupils','GCS ואישונים') + '</b><small>' + gcsLine() + '</small></span></button>'
    + '<button class="f-gcs-b f-proc-e" onclick="Field.procSheet()">' + ico('list-checks', 26) + '<span><b>' + L('Procedures','פעולות') + '</b><small>' + procLine() + '</small></span></button></div>';
  // X-CARE stays reachable after "Waiting" (folded), in case the call was wrong
  if (cur !== 'black') h += (Field.xcareHtml ? Field.xcareHtml() : '');
  else h += '<details class="f-xc-fold"><summary>' + L('X-CARE checklist','רשימת X-CARE') + '</summary>' + (Field.xcareHtml ? Field.xcareHtml() : '') + '</details>';
  h += (Field.doseHtml ? Field.doseHtml() : '');
  var top = h; h = '';
  // 2 · clocks
  var tq0 = tqs[0], txa = lastMed(/^TXA/i), lv = c.vitals.length ? c.vitals[c.vitals.length - 1] : null, veh = vehicleOf();
  var tile = function(label, big, sub, cls){ return '<div class="f-clock ' + (cls || '') + '"><small>' + label + '</small><b>' + big + '</b><span>' + sub + '</span></div>'; };
  h += '<div class="f-clocks">'
    + (tq0 ? tile(L('Tourniquet on','חוסם עורקים'), minsAgo(tq0.time) + '<u>' + L('min','ד׳') + '</u>', L('since ','מאז ') + hhmm(tq0.time), minsAgo(tq0.time) >= 120 ? 'bad' : 'warn') : tile(L('Tourniquet','חוסם עורקים'), L('None','אין'), L('none applied','לא הונח'), ''))
    + (cur === 'black' ? '' : txa ? tile('TXA', minsAgo(txa.time) + '<u>' + L('min','ד׳') + '</u>', L('given ','ניתן ') + hhmm(txa.time), 'ok') : (function(){ var ii = injuryInfo(); return !ii ? tile('TXA', L('Not given','לא ניתן'), L('set time of injury','קבעו שעת פציעה'), 'warn') : ii.left > 0 ? tile('TXA', ii.left + '<u>' + L('min left','דק׳ נותרו') + '</u>', L('of the 3-hour window','מחלון 3 השעות'), ii.left <= 30 ? 'bad' : 'warn') : tile('TXA', L('Window closed','החלון נסגר'), L('over 3 h since injury','מעל 3 שעות מהפציעה'), ''); })())
    + (lv ? tile(L('Last vitals','מדדים אחרונים'), minsAgo(lv.time) + '<u>' + L('min ago','ד׳ לפני') + '</u>', L('logged ','נרשם ') + hhmm(lv.time), minsAgo(lv.time) > 10 ? 'warn' : '') : tile(L('Vitals','מדדים'), L('None','אין'), L('not measured','לא נמדדו'), 'warn'))
    + (veh ? tile(L('Ambulance','אמבולנס'), (W.Evac ? W.Evac.etaText(veh) : '—'), L('on board','על הסיפון'), 'ok') : tile(L('Ambulance','אמבולנס'), L('Not yet','עדיין לא'), L('not assigned','לא שויך'), ''))
    + '</div>';
  // 3 · tourniquet
  h += '<button class="f-tq" onclick="Field.tq()">' + ico('timer', 34) + '<span>' + (tqs.length ? L('Another tourniquet','חוסם עורקים נוסף') : L('Add tourniquet','הוספת חוסם עורקים')) + '</span></button>';
  if (tqs.length){
    h += '<div class="f-tqlist">' + tqs.map(function(q, i){ var nm = W.bodyLabelOut ? W.bodyLabelOut(q.site) : ((W.BODY_LABELS || {})[q.site] || q.site); return '<div class="f-tqrow"><span><b>' + esc(W.ShowcaseI18n ? W.ShowcaseI18n.tr(nm) : nm) + '</b><small>' + L('on at ','הונח ב-') + hhmm(q.time) + '</small></span><strong>' + minsAgo(q.time) + ' ' + L('min','ד׳') + '</strong></div>'; }).join('') + '</div>';
  }
  // 5 · vitals
  // latest value per field; BP is one pair from one reading (never a new top number with an old bottom one)
  var v = (W.latestVitals ? W.latestVitals(W._casualtyVitals || []) : null) || { pulse:lastVal('pulse'), bpSys:lastVal('bpSys'), bpDia:lastVal('bpDia'), spo2:lastVal('spo2'), rr:lastVal('rr') };
  var num = function(x){ return x == null ? '—' : x; };
  h += '<div class="f-h">' + L('Vitals','מדדים') + '</div><div class="f-vit">'
    + vt('HR', num(v.pulse), L('/min','/דק׳'), 0, v.pulse > 120 || (v.pulse != null && v.pulse < 50), v.pulse > 120 ? L('High','גבוה') : L('Low','נמוך'))
    + vt('BP', v.bpSys ? v.bpSys + '/' + (v.bpDia || '–') : '—', '', 1, v.bpSys && (v.bpSys < 90 || v.bpSys >= 180), v.bpSys >= 180 ? L('High','גבוה') : L('Low','נמוך'))
    + vt('SpO₂', num(v.spo2), '%', 3, v.spo2 != null && v.spo2 < 92, L('Low','נמוך'))
    + vt(L('Breaths','נשימות'), num(v.rr), L('/min','/דק׳'), 4, v.rr != null && (v.rr > 24 || v.rr < 10), v.rr > 24 ? L('High','גבוה') : L('Low','נמוך'))
    + '</div>'
    + '<div class="f-tapbar"><button onclick="Field.tapStart(\'pulse\')">' + ico('heart-pulse', 30) + '<span>' + L('Tap the heartbeat','הקישו את הדופק') + '</span></button><button onclick="Field.tapStart(\'rr\')">' + ico('wind', 30) + '<span>' + L('Tap the breaths','הקישו את הנשימות') + '</span></button></div>';
  // 6 · finish: link this record to the tag on the casualty
  var me = (W._incidentCasualties || []).filter(function(x){ return x._docId === W._casualtyEditId; })[0];
  h += me && me.tagId
    ? '<div class="f-taglink done">' + ico('tag', 30) + '<span><b>' + L('Linked to tag','מקושר לתג') + ' <bdi dir="ltr">' + esc(me.tagId) + '</bdi></b><small>' + L('Scanning this tag opens this record.','סריקת התג פותחת את התיק הזה.') + '</small></span><button class="xbtn" onclick="Bracelet.linkForm()">' + ico('scan-line', 24) + L('Change','החלפה') + '</button></div>'
    : '<button class="f-taglink" onclick="Bracelet.linkForm()">' + ico('scan-line', 34) + '<span><b>' + L('Link to tag','קישור לתג') + '</b><small>' + L('Done? Scan the tag on the casualty.','סיימתם? סרקו את התג שעל הנפגע.') + '</small></span></button>';
  return '<section class="field" id="field" data-tour="field">' + top + '</section><section class="field fmon" id="fs-more"><div class="fs-h-wrap"><h2 class="fs-h">' + L('Monitor','ניטור') + '</h2></div>' + h + '</section>';
}
function vt(label, val, unit, idx, bad, word){
  return '<button class="f-v' + (bad ? ' bad' : '') + '" onclick="Field.keypad(' + idx + ')">' + ico('keyboard', 22, 'f-v-k') + '<small>' + label + (bad && word ? ' <em>' + word + '</em>' : '') + '</small><b>' + val + '</b><span>' + unit + '</span></button>';
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
  var ii = injuryInfo(), txaG = lastMed(/^TXA/i);
  if (!ii && !Field._injEdit)
    return '<div class="f-inj unset"><button class="f-inj-now" onclick="Field.setInjury(\'now\')">' + ico('clock', 30) + '<span>' + L('Injury time: set to now','שעת פציעה: עכשיו') + '</span></button>'
      + '<button class="f-inj-ed" onclick="Field.injEdit(1)">' + ico('keyboard', 22) + L('Exact time','שעה מדויקת') + '</button></div>';
  var chip = '';
  if (txaG) chip = '<span class="f-txa ok">' + ico('check', 22) + L('TXA given ' + hm(Date.parse(txaG.time)), 'TXA ניתן ' + hm(Date.parse(txaG.time))) + '</span>';
  else if (ii && ii.left <= 0) chip = '<span class="f-txa bad">' + ico('triangle-alert', 22) + L('TXA window closed','חלון TXA נסגר') + '</span>';
  else if (ii) chip = '<span class="f-txa' + (ii.left <= 60 ? ' warn' : '') + '">' + ico(ii.left <= 60 ? 'triangle-alert' : 'timer', 22) + L('TXA window: ' + (ii.left >= 60 ? Math.floor(ii.left / 60) + ' h ' : '') + (ii.left % 60) + ' min left', 'חלון TXA: נותרו ' + (ii.left >= 60 ? Math.floor(ii.left / 60) + ' ש׳ ' : '') + (ii.left % 60) + ' דק׳') + '</span>';
  var edit = Field._injEdit || !ii;
  return '<div class="f-inj' + (ii && ii.left <= 0 ? ' late' : '') + '"><div class="f-inj-h">' + L('Injury time','שעת פציעה') + '</div>'
    + (edit
      ? '<div class="f-inj-r"><input id="pat-inj" type="time" aria-label="' + L('Injury time','שעת פציעה') + '" value="' + (ii ? hm(ii.t) : '') + '" onchange="Field.setInjury(this.value);Field.injEdit(0)"><button class="xbtn" onclick="Field.injEdit(0)">' + L('Done','סיום') + '</button></div>'
      : '<div class="f-inj-v"><span class="f-inj-t"><b dir="ltr">' + hm(ii.t) + '</b><small>' + L(ii.mins + ' min ago','לפני ' + ii.mins + ' דק׳') + '</small></span>'
        + '<button class="f-inj-ed" onclick="Field.injEdit(1)">' + ico('keyboard', 22) + L('Edit','עריכה') + '</button></div>'
        + '<div class="f-inj-steps"><button class="f-inj-st" onclick="Field.injStep(-5)" aria-label="' + L('5 minutes earlier','5 דקות מוקדם יותר') + '">' + ico('minus', 24) + '<b dir="ltr">5</b>' + L('min','דק׳') + '</button>'
        + '<button class="f-inj-st" onclick="Field.injStep(5)" aria-label="' + L('5 minutes later','5 דקות מאוחר יותר') + '">' + ico('plus', 24) + '<b dir="ltr">5</b>' + L('min','דק׳') + '</button></div>')
    + chip + '</div>';
}
function accessHtml(){
  var a = ((W._casualtyXABCDE || {}).c || {}).ivAccess || [], tr = function(x){ return W.ShowcaseI18n ? W.ShowcaseI18n.tr(String(x)) : String(x); };
  if (!a.length) return '<button class="f-acc none" onclick="Field.accessSheet()">' + ico('syringe', 26) + '<span><b>' + L('Record IV / IO access','תיעוד גישה ורידית / IO') + '</b><small>' + L('Needed before IV drugs and blood','נדרש לפני תרופות לווריד ודם') + '</small></span></button>';
  var last = a[a.length - 1];
  return '<div class="f-acc"><span class="f-acc-t">' + ico('check', 24) + '<span><b>' + esc(W.accessLabel(last.site)) + (a.length > 1 ? ' +' + (a.length - 1) : '') + '</b><small dir="ltr">' + hhmm(last.time) + '</small></span></span><button onclick="Field.accessSheet()">' + ico('plus', 22) + '<span>' + L('Add','הוספה') + '</span></button></div>';
}
function gcsLine(){
  var d = ((W._casualtyXABCDE || {}).d) || {}, p = d.pupils || {}, out = [];
  if (d.gcs) out.push('GCS ' + d.gcs + '/15');
  var pw = function(q, en, he){ if (!q || q.size == null) return ''; return L(en, he) + ' ' + (q.size >= 6 ? L('wide','מורחב') : q.size <= 2 ? L('pinpoint','מצומצם') : L('normal','תקין')) + (q.reactive === false ? L(', no reaction',', לא מגיב') : ''); };
  [pw(p.right, 'R', 'ימין'), pw(p.left, 'L', 'שמאל')].forEach(function(x){ if (x) out.push(x); });
  return out.length ? out.join(' · ') : L('Not checked yet','עדיין לא נבדק');
}
function patientHtml(){
  var e = ctx().e, sx = e.sex === 'M' || e.sex === 'male' ? 'M' : (e.sex === 'F' || e.sex === 'female' ? 'F' : '');
  var v = function(x){ return x == null || x === '' ? '' : esc(String(x)); };
  return '<div class="f-pat"><div class="f-pat-f"><label for="pat-age">' + L('Age (years)','גיל (שנים)') + '</label><input id="pat-age" data-k="age" class="fi" type="number" inputmode="numeric" min="0" max="120" placeholder="—" value="' + v(e.ageYears) + '" oninput="Field.patIn(this.dataset.k,this.value)" onchange="Field.patDone(this.dataset.k,this.value)"></div>'
    + '<div class="f-pat-f"><label for="pat-wt">' + L('Weight (kg)','משקל (ק״ג)') + '</label><input id="pat-wt" data-k="wt" class="fi" type="number" inputmode="decimal" min="1" max="250" placeholder="—" value="' + v(e.weightKg) + '" oninput="Field.patIn(this.dataset.k,this.value)" onchange="Field.patDone(this.dataset.k,this.value)"></div>'
    + '<div class="f-pat-sex" role="group" aria-label="' + L('Sex','מין') + '"><button class="' + (sx === 'M' ? 'on' : '') + '" aria-pressed="' + (sx === 'M') + '" onclick="Field.setSex(this.dataset.s)" data-s="M">' + (sx === 'M' ? ico('check', 24) : '') + L('Male','זכר') + '</button><button class="' + (sx === 'F' ? 'on' : '') + '" aria-pressed="' + (sx === 'F') + '" onclick="Field.setSex(this.dataset.s)" data-s="F">' + (sx === 'F' ? ico('check', 24) : '') + L('Female','נקבה') + '</button></div></div>';
}
// A new casualty gets the next number at once: the number is the identity, never a name
if (typeof W.newCasualty === 'function' && !W.newCasualty.__num){
  var _nc = W.newCasualty;
  W.newCasualty = function(){ var r = _nc.apply(this, arguments);
    // pupils start as "not checked" (the engine default reads as two normal pupils that nobody examined)
    var d0 = W._casualtyEditMode && W._casualtyXABCDE && W._casualtyXABCDE.d; if (d0) d0.pupils = { left:{ size:null, reactive:null }, right:{ size:null, reactive:null } };
    if (W._casualtyEditMode && !String(W._casualtyName || '').trim() && W.nextCasNum){ W._casualtyName = 'נפגע ' + W.nextCasNum(); if (W.MedHost && W.MedHost.renderIncidentPage) W.MedHost.renderIncidentPage(); } return r; };
  W.newCasualty.__num = true;
}
// ── Procedures: one sheet, grouped by X-CARE letter. Each item writes to the field the engine already has
// (airway interventions, breathing entries, pelvic binder, hypothermia, IV/IO, body treatments); items the engine
// has no field for go to e.procedures. Everything is also a timeline line, so MIST, undo and the wristband see it.
// The IDF book has no needle decompression and no chest seal (open chest wound = 3-side dressing): not offered.
function aIv(type){ return ((((W._casualtyXABCDE || {}).a || {}).interventions) || []).filter(function(i){ return i.type === type; }); }
function lastT(arr){ var x = arr[arr.length - 1]; return x ? x.time : null; }
function eProc(k){ return ((((W._casualtyXABCDE || {}).e || {}).procedures) || []).filter(function(p){ return p.k === k; }); }
function bodyTx(t){ return (W._casualtyTreatments || []).filter(function(x){ return x.type === t; }); }
var PROC = [
  { g:'A', items:[
    { k:'npa', i:'wind', en:'AW / NPA', he:'AW / נתיב אף', air:'NPA' },
    { k:'opa', i:'wind', en:'OPA', he:'OPA', air:'OPA' },
    { k:'rec', i:'rotate-ccw', en:'Recovery position', he:'תנוחת התאוששות', air:'תנוחת התאוששות' },
    { k:'suc', i:'droplet', en:'Suction', he:'שאיבת הפרשות', air:'שאיבת הפרשות' },
    { k:'sga', i:'wind', en:'Supraglottic (i-gel / LMA)', he:'נתיב על-גלוטי (i-gel)', air:'SGA (i-gel)' },
    { k:'int', i:'stethoscope', en:'Intubation', he:'אינטובציה', sheet:'int' },
    { k:'cric', i:'target', en:'Cricothyrotomy', he:'קוניוטומיה', sheet:'cric' } ]},
  { g:'R', items:[
    { k:'o2', i:'wind', en:'Oxygen', he:'חמצן' },
    { k:'bvm', i:'wind', en:'BVM ventilation', he:'הנשמה במפוח (BVM)' },
    { k:'ct', i:'wind', en:'Chest tube', he:'נקז חזה', side:1 },
    { k:'tsd', i:'bandage', en:'3-side dressing (open chest wound)', he:'חבישה משלושה צדדים (פצע חזה פתוח)', side:1, proc:1 } ]},
  { g:'C', items:[
    { k:'iv', i:'syringe', en:'IV / IO access', he:'גישה ורידית / IO' },
    { k:'pb', i:'shield', en:'Pelvic binder', he:'מקבע אגן' },
    { k:'wp', i:'package', en:'Wound packing', he:'אריזת פצע', body:'woundPacking' },
    { k:'sp', i:'bone', en:'Splint', he:'קיבוע', body:'splint' } ]},
  { g:'E', items:[
    { k:'hpmk', i:'thermometer', en:'HPMK warming kit', he:'ערכת חימום HPMK', hypo:'HPMK' },
    { k:'blk', i:'thermometer', en:'Blanket', he:'שמיכה', hypo:'blanket' },
    { k:'eye', i:'eye', en:'Eye shield', he:'מגן עין', proc:1 },
    { k:'burn', i:'flame', en:'Burn dressing', he:'חבישת כוויה', proc:1 },
    { k:'spine', i:'shield', en:'Spinal immobilisation', he:'קיבוע עמוד שדרה', proc:1 },
    { k:'cpr', i:'heart-pulse', en:'CPR', he:'החייאה (CPR)', proc:1 } ]}
];
function procDone(it){
  var X0 = W._casualtyXABCDE || {}, b = X0.b || {}, e = X0.e || {}, c = X0.c || {};
  if (it.air) return lastT(aIv(it.air));
  if (it.k === 'int') return lastT(aIv('אינטובציה'));
  if (it.k === 'cric') return lastT(aIv('נתיב כירורגי'));
  if (it.k === 'o2') return b.oxygen ? (b.o2StartTime || true) : null;
  if (it.k === 'bvm') return b.bvm ? (b.bvm.time || true) : null;
  if (it.k === 'ct') return b.tubeThora ? (b.tubeThora.time || true) : null;
  if (it.k === 'iv') return lastT(c.ivAccess || []);
  if (it.k === 'pb') return e.pelvicBinder ? (e.pelvicBinder.time || true) : null;
  if (it.body) return lastT(bodyTx(it.body)) || (bodyTx(it.body).length ? true : null);
  if (it.hypo) return e.hypothermiaPrevention === it.hypo ? true : null;
  if (it.k === 'spine' && (X0.a || {}).cervicalCollar) return true;
  return lastT(eProc(it.k));
}
function procWhen(t){ return t === true ? L('done','בוצע') : (t ? hhmm(t) : ''); }
function procItem(k){ var f = null; PROC.forEach(function(g){ g.items.forEach(function(i){ if (i.k === k) f = i; }); }); return f; }
function isChild(){ var e = ctx().e; return e.ageYears != null ? Number(e.ageYears) < 12 : !!(W.isPedsMode && W.isPedsMode()); }
// compact summary for the form: the procedures recorded so far
function procLine(){
  var out = [];
  PROC.forEach(function(g){ g.items.forEach(function(it){ if (it.k !== 'iv' && procDone(it)) out.push(L(it.en, it.he).replace(/ \(.*\)$/, '')); }); });
  var n = aIv('אינטובציה'); if (n.length){ var ok = n.some(function(x){ return x.outcome === 'success'; }); out = out.map(function(x){ return x === L('Intubation','אינטובציה') ? x + (ok ? L(' (success)',' (הצליח)') : L(' (failed)',' (נכשל)')) : x; }); }
  return out.length ? out.join(' · ') : L('None recorded','לא תועדו');
}
// Deleting a treatment from the body-map list removes the same record as deleting it from the timeline (tourniquet clock,
// handoff, X-CARE all follow) and gets the same named undo.
if (typeof W.removeTreatmentFromBody === 'function' && !W.removeTreatmentFromBody.__one){
  var _rt = W.removeTreatmentFromBody;
  W.removeTreatmentFromBody = function(idx){
    var t = (W._casualtyTreatments || [])[idx]; if (!t) return;
    var tl = W._casualtyTimeline || [], X0 = W._casualtyXABCDE || {}, i = -1, lab = (W.BODY_LABELS || {})[t.region] || '';
    if (t.type === 'tourniquet'){
      var q = ((X0.x || {}).tourniquets || []).filter(function(r){ return r.site === t.region; })[0], qt = q ? Date.parse(q.time) : NaN;
      if (!isNaN(qt)) i = tl.findIndex(function(e){ return /ח"ע|חוסם/.test(String(e.action || '')) && Math.abs(Date.parse(e.time) - qt) < 90000; });
    } else i = tl.findIndex(function(e){ return e.details === t.type && /^טיפול /.test(String(e.action || '')) && String(e.action).indexOf(lab) >= 0; });
    if (i >= 0 && Field.tlDelLinked) return Field.tlDelLinked(i);
    // no timeline line (older record): remove the pin and its matching X record together, still undoable
    snapshot(); W._medPushLock = true; Promise.resolve().then(function(){ W._medPushLock = false; });
    var arr = { tourniquet:'tourniquets', pressureDressing:'pressureDressings', hemostatic:'hemostatic', woundPacking:'woundPacking' }[t.type];
    if (arr && X0.x && X0.x[arr]){ var k = X0.x[arr].findIndex(function(r){ return r.site === t.region; }); if (k >= 0) X0.x[arr].splice(k, 1); }
    _rt.call(this, idx);
    undoToast(L('Deleted: ','נמחק: ') + esc(W.ShowcaseI18n ? W.ShowcaseI18n.tr((W._txHe ? W._txHe(t.type) : t.type) + ' — ' + lab) : lab), doUndo);
  };
  W.removeTreatmentFromBody.__one = true;
}
var Field = {
  html: html,
  patientHtml: patientHtml,
  injuryInfo: injuryInfo,
  setInjury: function(val){
    var X = W._casualtyXABCDE; if (!X) return; X.e = X.e || {};
    var d = new Date();
    if (val === 'now') d.setSeconds(0, 0);
    else if (val instanceof Date) d = val;
    else { var m = /^(\d{1,2}):(\d{2})$/.exec(val || ''); if (!m) return; d.setHours(+m[1], +m[2], 0, 0); }
    // never in the future (a later clock time is not silently turned into "yesterday")
    if (d.getTime() > Date.now() + 60000){ render(); return undoToast(L('Injury time cannot be in the future. Now is ' + hm(Date.now()) + '.','שעת הפציעה לא יכולה להיות בעתיד. עכשיו ' + hm(Date.now()) + '.'), null); }
    // the injury happens before any treatment: say so if the new time is later than the first one
    var Xt = W._casualtyXABCDE || {}, first = [].concat(((Xt.x || {}).tourniquets) || [], ((Xt.e || {}).medications) || [], ((Xt.c || {}).fluids) || [], ((Xt.c || {}).ivAccess) || []).map(function(r){ return Date.parse(r.time); }).filter(function(t){ return !isNaN(t); }).sort(function(a, b){ return a - b; })[0];
    var late = first != null && d.getTime() > first + 60000;
    snapshot();
    X.e.timeOfInjury = d.toISOString();
    var tl0 = W._casualtyTimeline || []; for (var j = tl0.length - 1; j >= 0; j--){ if (/^שעת פציעה /.test(String(tl0[j].action || ''))) tl0.splice(j, 1); }
    if (W.addTimestampedAction) W.addTimestampedAction('injury', 'שעת פציעה ' + hm(d.getTime()), '');
    W.MedHost.triggerAutoSave(); render();
    undoToast(late ? L('Injury ' + hm(d.getTime()) + ' is after the first treatment (' + hm(first) + '). Check it.','פציעה ' + hm(d.getTime()) + ' אחרי הטיפול הראשון (' + hm(first) + '). בדקו.') : L('Time of injury: ' + hm(d.getTime()), 'שעת פציעה: ' + hm(d.getTime())), doUndo);
  },
  editWho: function(){
    var e = ctx().e; if (W.FormUI && W.FormUI.jump) W.FormUI.jump('fs-record');
    setTimeout(function(){ var i = document.getElementById(e.weightKg ? 'pat-age' : 'pat-wt'); if (i) { i.focus({ preventScroll:true }); i.scrollIntoView({ block:'center' }); } }, 400);
  },
  procSheet: function(){
    Field.closeSheet();
    var el = document.createElement('div'); el.id = 'f-sheet'; el.className = 'sheet-wrap no-polish';
    var COLS = { A:'xc-a', R:'xc-r', C:'xc-c', E:'xc-e' }, NAMES = { A:['Airway','נתיב אוויר'], R:['Breathing','נשימה'], C:['Circulation','מחזור דם'], E:['Everything else','כל השאר'] };
    var h = '<div class="sheet-dim" onclick="Field.closeSheet()"></div><div class="sheet f-proc" role="dialog" aria-modal="true" aria-labelledby="f-proc-t"><div class="f-proc-top"><h3 id="f-proc-t">' + ico('list-checks', 26) + L('Procedures','פעולות') + '</h3><button class="xbtn" onclick="Field.closeSheet()">' + ico('x', 24) + L('Close','סגירה') + '</button></div>';
    PROC.forEach(function(g){
      h += '<section class="f-proc-g ' + COLS[g.g] + '"><h4><span class="xc-let">' + g.g + '</span>' + L(NAMES[g.g][0], NAMES[g.g][1]) + '</h4><div class="f-proc-l">';
      g.items.forEach(function(it){
        var t = procDone(it), blocked = it.k === 'cric' && isChild();
        h += '<button class="f-proc-b' + (t ? ' done' : '') + (blocked ? ' blocked' : '') + '" onclick="Field.proc(\'' + it.k + '\')"' + (blocked ? ' aria-disabled="true"' : '') + '>' + ico(t ? 'check' : it.i, 26)
          + '<span><b>' + L(it.en, it.he) + '</b>' + (blocked ? '<small>' + L('Not under age 12','לא מתחת לגיל 12') + '</small>' : t ? '<small>' + procWhen(t) + '</small>' : '') + '</span></button>';
      });
      h += '</div></section>';
    });
    el.innerHTML = h + '</div>';
    app().appendChild(el);
  },
  proc: function(k, a1, a2){
    var it = procItem(k); if (!it) return;
    var X0 = W._casualtyXABCDE; if (!X0) return;
    var now = new Date().toISOString(), done = function(msg){ W.MedHost.triggerAutoSave(); render(); undoToast(msg, doUndo); };
    var name = L(it.en, it.he);
    if (it.sheet === 'int') return Field.intSheet();
    if (it.sheet === 'cric'){ if (isChild()) return undoToast(L('Cricothyrotomy is not done under age 12 (IDF trauma book).','קוניוטומיה לא מבוצעת מתחת לגיל 12 (ספר הטראומה צה״ל).'), null); return Field.cricSheet(); }
    if (it.side && !a1) return Field.sideSheet(k);
    if (it.k === 'iv') return Field.accessSheet();
    if (it.body){ Field.closeSheet(); if (W.startTreatmentPlacement) W.startTreatmentPlacement(it.body); if (W.FormUI && W.FormUI.jump) W.FormUI.jump('fs-body'); return undoToast(L(name + ': now tap the body','' + name + ': עכשיו לחצו על הגוף'), null); }
    snapshot();
    var sideHe = a1 === 'R' ? ' ימין' : a1 === 'L' ? ' שמאל' : '', sideEn = a1 === 'R' ? ' right' : a1 === 'L' ? ' left' : '';
    if (it.air){ X0.a = X0.a || { status:'', interventions:[] }; X0.a.interventions = X0.a.interventions || []; X0.a.interventions.push({ type:it.air, time:now }); W.addTimestampedAction('a', it.air === 'NPA' ? 'NPA (AW)' : it.air, ''); }
    else if (it.k === 'o2'){ X0.b.oxygen = true; X0.b.o2Lpm = X0.b.o2Lpm || 15; X0.b.o2StartTime = X0.b.o2StartTime || now; W.addTimestampedAction('b', 'חמצן ' + X0.b.o2Lpm + ' L/min', ''); }
    else if (it.k === 'bvm'){ X0.b.bvm = { time:now }; W.addTimestampedAction('b', 'הנשמה במפוח (BVM)', ''); }
    else if (it.k === 'ct'){ X0.b.tubeThora = { side:a1, time:now, outcome:'success' }; W.addTimestampedAction('b', 'נקז חזה' + sideHe, ''); if (W.autoPlaceTreatment) try { W.autoPlaceTreatment(a1 === 'L' ? 'chest_l' : 'chest_r', 'tubeThora'); } catch (e) {} }
    else if (it.k === 'pb'){ if (!(X0.e || {}).pelvicBinder){ X0.e.pelvicBinder = { site:'greater trochanter', time:now }; W.addTimestampedAction('e', 'מקבע אגן (בגובה הטרוכנטרים)', ''); } }
    else if (it.hypo){ X0.e.hypothermiaPrevention = it.hypo; W.addTimestampedAction('e', 'מניעת היפותרמיה: ' + (it.hypo === 'HPMK' ? 'HPMK' : 'שמיכה'), ''); }
    else { X0.e.procedures = X0.e.procedures || []; X0.e.procedures.push({ k:it.k, label:it.he, side:a1 || '', time:now }); W.addTimestampedAction(it.k === 'tsd' ? 'b' : 'e', it.he + sideHe, ''); }
    Field.closeSheet();
    done(L(name + sideEn + ' recorded, ' + hhmm(now), name + sideHe + ' תועד, ' + hhmm(now)));
  },
  sideSheet: function(k){
    var it = procItem(k); Field.closeSheet();
    var el = document.createElement('div'); el.id = 'f-sheet'; el.className = 'sheet-wrap no-polish';
    el.innerHTML = '<div class="sheet-dim" onclick="Field.closeSheet()"></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="f-side-t"><div class="sheet-grab"></div><h3 id="f-side-t">' + L(it.en, it.he) + ': ' + L('which side?','איזה צד?') + '</h3>'
      + '<div class="f-acc-g"><button onclick="Field.proc(\'' + k + '\',\'R\')">' + ico('arrow-' + (lang() === 'he' ? 'right' : 'left'), 24) + '<b>' + L('Right','ימין') + '</b><small>' + L("Casualty's right",'ימין של הנפגע') + '</small></button><button onclick="Field.proc(\'' + k + '\',\'L\')">' + ico('arrow-' + (lang() === 'he' ? 'left' : 'right'), 24) + '<b>' + L('Left','שמאל') + '</b><small>' + L("Casualty's left",'שמאל של הנפגע') + '</small></button></div>'
      + '<button class="xbtn f-cancel" onclick="Field.procSheet()">' + ico('x', 24) + L('Back','חזרה') + '</button></div>';
    app().appendChild(el);
  },
  // Intubation: each attempt is its own record (time + result); success may add tube size and how it was confirmed
  intSheet: function(){
    Field.closeSheet();
    var tries = aIv('אינטובציה'), n = tries.length + 1, S0 = Field._int || (Field._int = { size:null, conf:{} });
    var el = document.createElement('div'); el.id = 'f-sheet'; el.className = 'sheet-wrap no-polish';
    el.innerHTML = '<div class="sheet-dim" onclick="Field.closeSheet()"></div><div class="sheet f-int" role="dialog" aria-modal="true" aria-labelledby="f-int-t"><div class="sheet-grab"></div>'
      + '<h3 id="f-int-t">' + ico('stethoscope', 26) + L('Intubation','אינטובציה') + ' · ' + L('attempt ','ניסיון ') + '<b dir="ltr">' + n + '</b></h3>'
      + (tries.length ? '<ul class="f-int-l">' + tries.map(function(t){ return '<li>' + ico(t.outcome === 'success' ? 'check' : 'x', 22) + L('Attempt ','ניסיון ') + (t.attempts || '') + ' · ' + hhmm(t.time) + ' · ' + (t.outcome === 'success' ? L('success','הצליח') : L('failed','נכשל')) + (t.tubeSize ? ' · ' + t.tubeSize + ' mm' : '') + '</li>'; }).join('') + '</ul>' : '')
      + '<p class="f-int-h">' + L('Tube size (optional)','גודל טובוס (לא חובה)') + '</p><div class="f-int-c" dir="ltr">' + [6.5, 7, 7.5, 8].map(function(z){ return '<button class="' + (S0.size === z ? 'on' : '') + '" aria-pressed="' + (S0.size === z) + '" onclick="Field._int.size=' + (S0.size === z ? 'null' : z) + ';Field.intSheet()">' + z + '</button>'; }).join('') + '</div>'
      + '<p class="f-int-h">' + L('Confirmed by (optional)','אומת באמצעות (לא חובה)') + '</p><div class="f-int-c">' + [['etco2','ETCO₂','ETCO₂'], ['ausc','Listening (both lungs)','האזנה (שתי ריאות)']].map(function(o){ var on = !!S0.conf[o[0]]; return '<button class="' + (on ? 'on' : '') + '" aria-pressed="' + on + '" onclick="Field._int.conf.' + o[0] + '=' + !on + ';Field.intSheet()">' + L(o[1], o[2]) + '</button>'; }).join('') + '</div>'
      + '<div class="f-acc-g"><button class="f-int-fail" onclick="Field.intRec(false)">' + ico('x', 26) + '<b>' + L('Failed','נכשל') + '</b><small>' + L('Record attempt ' + n,'תיעוד ניסיון ' + n) + '</small></button><button class="f-int-ok" onclick="Field.intRec(true)">' + ico('check', 26) + '<b>' + L('Success','הצליח') + '</b><small>' + L('Record attempt ' + n,'תיעוד ניסיון ' + n) + '</small></button></div>'
      + '<button class="xbtn f-cancel" onclick="Field._int=null;Field.procSheet()">' + ico('arrow-' + (lang() === 'he' ? 'right' : 'left'), 24) + L('Back','חזרה') + '</button></div>';
    app().appendChild(el);
  },
  intRec: function(ok){
    var X0 = W._casualtyXABCDE; if (!X0) return; var S0 = Field._int || { conf:{} }, n = aIv('אינטובציה').length + 1, now = new Date().toISOString();
    snapshot();
    var conf = Object.keys(S0.conf || {}).filter(function(k){ return S0.conf[k]; }).map(function(k){ return k === 'etco2' ? 'ETCO2' : 'האזנה'; });
    X0.a.interventions = X0.a.interventions || [];
    X0.a.interventions.push({ type:'אינטובציה', time:now, attempts:n, outcome: ok ? 'success' : 'fail', tubeSize: ok ? S0.size : null, confirm: ok ? conf : [] });
    W.addTimestampedAction('a', 'אינטובציה — ניסיון ' + n + (ok ? ': הצליח' + ((S0.size || conf.length) ? ' (' + [S0.size ? S0.size + 'mm' : ''].concat(conf).filter(Boolean).join(' + ') + ')' : '') : ': נכשל'), '');
    Field._int = null; W.MedHost.triggerAutoSave(); render();
    if (ok) Field.closeSheet(); else Field.intSheet();
    undoToast(L('Intubation attempt ' + n + (ok ? ': success' : ': failed'), 'אינטובציה ניסיון ' + n + (ok ? ': הצליח' : ': נכשל')), doUndo);
  },
  cricSheet: function(){
    Field.closeSheet();
    var el = document.createElement('div'); el.id = 'f-sheet'; el.className = 'sheet-wrap no-polish';
    el.innerHTML = '<div class="sheet-dim" onclick="Field.closeSheet()"></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="f-cric-t"><div class="sheet-grab"></div><h3 id="f-cric-t">' + ico('target', 26) + L('Cricothyrotomy','קוניוטומיה') + '</h3>'
      + '<div class="f-acc-g"><button onclick="Field.cricRec(\'surgical\')">' + ico('target', 24) + '<b>' + L('Surgical','כירורגית') + '</b><small>' + L('Scalpel, tube','להב, טובוס') + '</small></button><button onclick="Field.cricRec(\'needle\')">' + ico('syringe', 24) + '<b>' + L('Needle','מחט') + '</b><small>' + L('Cannula','קנולה') + '</small></button></div>'
      + '<button class="xbtn f-cancel" onclick="Field.procSheet()">' + ico('arrow-' + (lang() === 'he' ? 'right' : 'left'), 24) + L('Back','חזרה') + '</button></div>';
    app().appendChild(el);
  },
  cricRec: function(m){
    var X0 = W._casualtyXABCDE; if (!X0) return; var now = new Date().toISOString();
    snapshot();
    X0.a.interventions = X0.a.interventions || [];
    X0.a.interventions.push({ type:'נתיב כירורגי', time:now, method:m, outcome:'success' });
    W.addTimestampedAction('a', 'נתיב כירורגי — ' + (m === 'needle' ? 'מחט' : 'כירורגי'), '');
    W.MedHost.triggerAutoSave(); render(); Field.closeSheet();
    undoToast(L('Cricothyrotomy (' + (m === 'needle' ? 'needle' : 'surgical') + ') recorded, ' + hhmm(now), 'קוניוטומיה (' + (m === 'needle' ? 'מחט' : 'כירורגית') + ') תועדה, ' + hhmm(now)), doUndo);
  },
  injEdit: function(on){ Field._injEdit = !!on; render(); if (on) setTimeout(function(){ var i = document.getElementById('pat-inj'); if (i) i.focus(); }, 60); },
  injStep: function(delta){
    var ii = injuryInfo(); if (!ii) return;
    var d = new Date(Math.min(Date.now(), ii.t + delta * 60000)); d.setSeconds(0, 0);
    Field.setInjury(d);
  },
  // Age / weight: nothing is written while typing. On commit (blur / Done) a valid value is saved through the engine
  // (which re-estimates an estimated weight from the age); an invalid one is refused and the previous value stays.
  patIn: function(k, val){ Field._patPend = true; },
  patDone: function(k, val){
    Field._patPend = false;
    var e = ctx().e, raw = String(val == null ? '' : val).trim(), n = parseFloat(raw);
    var cur = k === 'age' ? e.ageYears : e.weightKg;
    if (raw === '') return;
    if (isNaN(n) || (k === 'age' ? (n < 0 || n > 120) : (n < 1 || n > 250))){
      render();   // the field shows the last valid value again
      return undoToast(k === 'age' ? L('Age must be 0 to 120. Kept: ' + (cur != null ? cur : '—'),'הגיל חייב להיות 0 עד 120. נשאר: ' + (cur != null ? cur : '—')) : L('Weight must be 1 to 250 kg. Kept: ' + (cur != null ? cur + ' kg' : '—'),'המשקל חייב להיות 1 עד 250 ק״ג. נשאר: ' + (cur != null ? cur + ' ק״ג' : '—')), null);
    }
    if (k === 'age') n = n < 2 ? Math.round(n * 10) / 10 : Math.floor(n);
    if (cur === n && (k !== 'wt' || !e.weightEst)) return;   // same value committed again: no empty UNDO step
    snapshot();
    W._medPushLock = true; Promise.resolve().then(function(){ W._medPushLock = false; });   // one undo step for this edit
    if (k === 'age') W._setPatientAge(n); else W._setPatientWeight(n);
  },
  setSex: function(s){
    var X = W._casualtyXABCDE; if (!X) return; snapshot(); X.e = X.e || {};
    X.e.sex = (X.e.sex === s) ? '' : s;
    W.MedHost.triggerAutoSave(); render();
  },
  triage: function(color, sure){
    if (color === 'black' && !sure && W._casualtyTriageColor !== 'black') return Field.blackSheet();
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
    el.innerHTML = '<div class="sheet-dim" onclick="Field.closeSheet()"></div><div class="sheet" role="dialog" aria-label="Tourniquet"><div class="sheet-grab"></div><h3>' + L('Where is the tourniquet?','איפה חוסם העורקים?') + '</h3><p class="sheet-p">' + L('The time is recorded automatically.','הזמן נרשם אוטומטית.') + '</p><div class="f-sites">'
      + SITES.map(function(s){ return '<button onclick="Field.tqSite(\'' + s[0] + '\')">' + ico('map-pin', 24) + L(s[1], s[2]) + '</button>'; }).join('')
      + '</div><button class="xbtn f-cancel" onclick="Field.closeSheet()">' + ico('x', 24) + L('Cancel','ביטול') + '</button></div>';
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
    var e = ctx().e, peds = e.ageYears != null ? Number(e.ageYears) < 12 : (W.isPedsMode && W.isPedsMode());
    if (!peds) return { dose:g.dose, vol:g.vol, sub:g.sub, subHe:g.subHe };
    var kg = e.weightKg || (e.ageYears != null && W._broselowWeight ? W._broselowWeight(e.ageYears) : null);
    if (!kg) return null;
    var note = (e.weightKg && !e.weightEst) ? '' : '~';
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
      var k = last(/^קטמין|ketamine/i); if (k && mins(k.time) < 45) out.push(L('Ketamine was given ' + mins(k.time) + ' min ago. Repeat only after 45 min.', 'קטמין ניתן לפני ' + mins(k.time) + ' דקות. מנה חוזרת רק אחרי 45 דקות.'));
    } else if (g.key === 'cef'){
      var c = last(/צפטריאקסון|ceftriaxone/i); if (c && mins(c.time) < 12 * 60) out.push(L('Ceftriaxone was already given at ' + hhmm(c.time) + '.', 'צפטריאקסון כבר ניתן ב-' + hhmm(c.time) + '.'));
      if (fl.some(function(f){ return /הרטמן|Ringer/i.test(f.type || ''); })) out.push(L('Ringer in the line. Never mix with ceftriaxone. Flush the line first.', 'הרטמן בקו. לעולם לא לערבב עם צפטריאקסון. שטפו את הקו קודם.'));
    } else if (g.fluid){
      var f = fl.filter(function(x){ return x.type === g.type; }).slice(-1)[0]; if (f && mins(f.time) < 5) out.push(L('Blood was given ' + mins(f.time) + ' min ago. Reassess shock before the next unit.', 'דם ניתן לפני ' + mins(f.time) + ' דקות. העריכו הלם מחדש לפני המנה הבאה.'));
    }
    return out;
  },
  // One tap never records a drug: every "give" opens the dose calculator read-back for that drug (five rights,
  // syringe, warnings), and IV/IO drugs first ask for recorded access.
  give: function(key){
    var id = { txa:'txa', ket:'ket', cef:'cef', blood:'blood' }[key] || key;
    var tab = { txa:'shock', blood:'shock', hart:'shock', ket:'pain', mor:'pain', cef:'abx', met:'abx' }[id] || 'now';
    if (IVONLY[id] && !hasAccess()) return Field.accessSheet(function(){ Field.give(key); }, id);
    if (!Field.doseOpen || !Field.doseCheck) return;
    Field.closeSheet(); Field.doseOpen(tab); Field.doseCheck(id);
  },
  accessSheet: function(then, id){
    Field._afterAccess = then || null;
    Field.closeSheet();
    var ut = document.getElementById('undo-toast'); if (ut) ut.remove();
    var el = document.createElement('div'); el.id = 'f-sheet'; el.className = 'sheet-wrap no-polish';
    el.innerHTML = '<div class="sheet-dim" onclick="Field.closeSheet()"></div><div class="sheet f-acc-sheet" role="dialog" aria-modal="true" aria-labelledby="f-acc-t"><div class="sheet-grab"></div>'
      + '<h3 id="f-acc-t">' + L('Record IV / IO access','תיעוד גישה ורידית / IO') + '</h3>'
      + (then ? '<p class="sheet-p f-warn">' + ico('triangle-alert', 24) + '<b>' + L('This goes IV or IO. No access is recorded yet.','זה ניתן לווריד או IO. עדיין לא תועדה גישה.') + '</b></p>' : '')
      + '<div class="f-acc-g">' + ACCESS.map(function(a){ return '<button onclick="Field.access(\'' + a[0] + '\')">' + ico(a[0].charAt(0) === 'i' && a[0].charAt(1) === 'o' ? 'target' : 'syringe', 24) + '<b>' + L(a[1], a[2]) + '</b><small>' + L(a[3], a[4]) + '</small></button>'; }).join('') + '</div>'
      + '<button class="xbtn f-cancel" onclick="Field.closeSheet()">' + ico('x', 24) + L('Cancel','ביטול') + '</button></div>';
    app().appendChild(el);
  },
  access: function(k){
    var a = ACCESS.filter(function(x){ return x[0] === k; })[0]; if (!a || !W.addIVAccess) return;
    var then = Field._afterAccess; Field._afterAccess = null; Field.closeSheet();
    snapshot();
    var X1 = W._casualtyXABCDE; X1.c = X1.c || {}; X1.c.ivAccess = X1.c.ivAccess || []; X1.c.ivAccess.push({ site:a[2], time:new Date().toISOString() });
    if (W.addTimestampedAction) W.addTimestampedAction('c', (a[0].charAt(1) === 'o' ? 'גישה גרמית (IO): ' : 'גישה ורידית: ') + a[2], '');
    if (W.MedHost && W.MedHost.triggerAutoSave) W.MedHost.triggerAutoSave();
    render();
    undoToast(L('Recorded: ','תועד: ') + esc(W.accessLabel(a[2])) + ', ' + hhmm(new Date().toISOString()), doUndo);
    if (then) setTimeout(then, 60);
  },
  // GCS and pupils, quick entry
  // GCS and pupils, quick entry. Best answer first; every option = colour (good → bad) + icon + number + word.
  gcsSheet: function(){
    var prevS = document.querySelector('#f-sheet .f-gcs'), keepY = prevS ? prevS.scrollTop : 0;
    Field.closeSheet();
    var d = ((W._casualtyXABCDE || {}).d) || {}, g = d.gcsDetail || {}, p = d.pupils || {};
    var tone = function(v, max){ var f = (v - 1) / (max - 1); return f >= 0.999 ? 'g-ok' : f >= 0.5 ? 'g-mid' : f > 0 ? 'g-low' : 'g-bad'; };
    var row = function(key, en, he, opts){
      var max = opts.length;
      return '<div class="f-gcs-r"><span>' + L(en, he) + (g[key] ? ' <b dir="ltr">' + g[key] + '/' + max + '</b>' : '') + '</span><div class="f-gcs-o">'
        + opts.map(function(o, k){ var v = max - k, on = g[key] === v;
            return '<button class="' + tone(v, max) + (on ? ' on' : '') + '" aria-pressed="' + on + '" onclick="Field.gcs(\'' + key + '\',' + v + ')">' + ico(o[0], 26) + '<b dir="ltr">' + v + '</b><span>' + L(o[1], o[2]) + '</span>' + (on ? ico('check', 22, 'g-chk') : '') + '</button>'; }).join('')
        + '</div></div>';
    };
    var tot = (g.eye && g.verbal && g.motor) ? g.eye + g.verbal + g.motor : d.gcs || null;
    var band = tot == null ? '' : tot >= 13 ? '<span class="g-band g-ok">' + ico('check', 22) + L('Mild','קל') + '</span>' : tot >= 9 ? '<span class="g-band g-mid">' + ico('triangle-alert', 22) + L('Moderate','בינוני') + '</span>'
      : '<span class="g-band g-bad">' + ico('wind', 22) + L('Severe · Airway at risk','קשה · נתיב אוויר בסיכון') + '</span>';
    var pup = function(side, en, he){
      var q = p[side] || {}, cur = q.size == null ? '' : q.size >= 6 ? 'big' : q.size <= 2 ? 'small' : 'n';
      var opt = [['n','eye','Normal','תקין',''], ['big','circle','Wide','מורחב','warn'], ['small','dot','Pinpoint','מצומצם','warn']];
      return '<div class="f-gcs-r"><span>' + L(en, he) + '</span><div class="f-pup">' + opt.map(function(o){ var on = cur === o[0]; return '<button class="' + o[4] + (on ? ' on' : '') + '" aria-pressed="' + on + '" onclick="Field.pupil(\'' + side + '\',\'' + o[0] + '\')">' + ico(o[1], 26) + '<span>' + L(o[2], o[3]) + '</span>' + (on ? ico('check', 22, 'g-chk') : '') + '</button>'; }).join('')
        + '<button class="warn' + (q.reactive === false ? ' on' : '') + '" aria-pressed="' + (q.reactive === false) + '" onclick="Field.pupil(\'' + side + '\',\'fixed\')">' + ico('eye-off', 26) + '<span>' + L('No light reaction','לא מגיב לאור') + '</span>' + (q.reactive === false ? ico('check', 22, 'g-chk') : '') + '</button></div></div>';
    };
    var el = document.createElement('div'); el.id = 'f-sheet'; el.className = 'sheet-wrap no-polish';
    el.innerHTML = '<div class="sheet-dim" onclick="Field.closeSheet()"></div><div class="sheet f-gcs" role="dialog" aria-modal="true" aria-labelledby="f-gcs-t"><div class="sheet-grab"></div>'
      + '<div class="g-top"><h3 id="f-gcs-t">GCS</h3><b class="g-tot" dir="ltr">' + (tot == null ? '—' : tot) + '<small>/15</small></b>' + band + '</div>'
      + row('eye', 'Eyes', 'עיניים', [['eye','Open by themselves','פקוחות מעצמן'], ['ear','Open to voice','נפתחות לקול'], ['zap','Open to pain','נפתחות לכאב'], ['eye-off','None','אין']])
      + row('verbal', 'Voice', 'דיבור', [['message-circle','Talks, oriented','מדבר, מתמצא'], ['circle-help','Confused','מבולבל'], ['volume-2','Words only','מילים בלבד'], ['audio-lines','Sounds only','קולות בלבד'], ['mic-off','None','אין']])
      + row('motor', 'Movement', 'תנועה', [['thumbs-up','Obeys','מציית לפקודה'], ['target','Points to pain','ממקם כאב'], ['arrow-left','Pulls away','נסוג מכאב'], ['minimize-2','Bends (flexion)','כיפוף לא תקין'], ['maximize-2','Stretches (extension)','יישור לא תקין'], ['x','None','אין']])
      + '<h3>' + L('Pupils','אישונים') + '</h3>' + pup('right', 'Right eye', 'עין ימין') + pup('left', 'Left eye', 'עין שמאל')
      + '<button class="xbtn xbtn-primary" onclick="Field.closeSheet()">' + ico('check', 26) + L('Done','סיום') + '</button></div>';
    app().appendChild(el);
    var nS = el.querySelector('.f-gcs'); if (nS && keepY) nS.scrollTop = keepY;
  },
  gcs: function(key, v){ snapshot(); if (W.setGCSComponent) W.setGCSComponent(key, v); W.MedHost.triggerAutoSave(); Field.gcsSheet(); },
  pupil: function(side, k){
    var d = (W._casualtyXABCDE || {}).d; if (!d) return; snapshot();
    d.pupils = d.pupils || { left:{}, right:{} }; var q = d.pupils[side] = d.pupils[side] || {};
    if (k === 'fixed') q.reactive = q.reactive === false ? true : false;
    else { q.size = { n:4, big:7, small:2 }[k]; if (q.reactive == null) q.reactive = true; }
    if (W.addTimestampedAction) W.addTimestampedAction('d', (side === 'left' ? 'אישון שמאל ' : 'אישון ימין ') + (q.size != null ? q.size + 'mm' : '') + (q.reactive === false ? ' לא מגיב לאור' : ' מגיב לאור'), '');
    W.MedHost.triggerAutoSave(); render(); Field.gcsSheet();
  },
  // Waiting is never one tap: show the last vitals and ask
  blackSheet: function(){
    Field.closeSheet();
    var v = (W._casualtyVitals || []).slice(-1)[0], vt = v ? [v.pulse != null ? L('HR ','דופק ') + v.pulse : '', v.bp ? L('BP ','ל״ד ') + v.bp : '', v.rr != null ? L('Breaths ','נשימות ') + v.rr : '', v.spo2 != null ? 'SpO₂ ' + v.spo2 + '%' : ''].filter(Boolean).join(' · ') : '';
    var alive = v && ((v.pulse > 0) || (v.rr > 0));
    var el = document.createElement('div'); el.id = 'f-sheet'; el.className = 'sheet-wrap no-polish';
    el.innerHTML = '<div class="sheet-dim" onclick="Field.closeSheet()"></div><div class="sheet f-black" role="alertdialog" aria-modal="true" aria-labelledby="f-black-t"><div class="sheet-grab"></div>'
      + '<h3 id="f-black-t">' + L('Move to “Waiting”?','להעביר ל״ממתין״?') + '</h3>'
      + (v ? '<p class="f-black-v' + (alive ? ' alive' : '') + '">' + (alive ? ico('triangle-alert', 26) : ico('activity', 26)) + '<span><b>' + L('Last vitals ' + minsAgo(v.time) + ' min ago','מדדים אחרונים לפני ' + minsAgo(v.time) + ' דק׳') + '</b><bdi>' + vt + '</bdi></span></p>' : '<p class="f-black-v">' + L('No vitals recorded.','לא נרשמו מדדים.') + '</p>')
      + '<p class="sheet-p">' + L('Treatment is held for others. Check breathing and pulse again first.','הטיפול נדחה לטובת אחרים. בדקו שוב נשימה ודופק קודם.') + '</p>'
      + '<button class="xbtn xbtn-primary" onclick="Field.closeSheet()">' + ico('heart-pulse', 26) + L('Cancel — keep treating','ביטול — ממשיכים לטפל') + '</button>'
      + '<button class="xbtn f-black-ok" onclick="Field.closeSheet();Field.triage(\'black\',true)">' + ico('check', 24) + L('Confirm: Waiting','אישור: ממתין') + '</button></div>';
    app().appendChild(el);
  },
  undo: function(sure){
    var st = W._medUndoStack || []; if (!st.length) return undoToast(L('Nothing to undo','אין מה לבטל'), null);
    var info = lastChange(st[st.length - 1]);
    if (info.drug && !sure){
      Field.closeSheet();
      var el = document.createElement('div'); el.id = 'f-sheet'; el.className = 'sheet-wrap no-polish';
      el.innerHTML = '<div class="sheet-dim" onclick="Field.closeSheet()"></div><div class="sheet" role="alertdialog" aria-modal="true" aria-labelledby="f-undo-t"><div class="sheet-grab"></div>'
        + '<h3 id="f-undo-t">' + L('Undo this drug?','לבטל את התרופה?') + '</h3><p class="f-undo-x">' + info.label + '</p>'
        + '<p class="sheet-p">' + L('It will be removed from the record.','היא תוסר מהתיק.') + '</p>'
        + '<button class="xbtn xbtn-primary" onclick="Field.closeSheet()">' + ico('check', 26) + L('Keep it','להשאיר') + '</button>'
        + '<button class="xbtn f-undo-ok" onclick="Field.closeSheet();Field.undo(true)">' + ico('undo-2', 24) + L('Undo','בטל') + '</button></div>';
      return app().appendChild(el);
    }
    doUndo();
    undoToast(L('Undone: ','בוטל: ') + info.label, null);
  },
  upgrade: function(){ var c = (W._incidentCasualties || []).filter(function(x){ return x._docId === W._casualtyEditId; })[0]; if (!c) return; W._upsertOfflineCasualty({ _docId:c._docId, formLevel:'full' }); undoToast(L('Now a FULL Form 101','כעת טופס 101 מלא'), null); render(); },

  // ── Vitals keypad ────────────────────────────────────────────
  _k: null,
  keypad: function(idx){
    var fields = [
      { k:'pulse', en:'Heart rate', he:'דופק', unit:'/min', min:20, max:300 },
      { k:'bpSys', en:'Blood pressure — top number', he:'לחץ דם — מספר עליון', unit:'mmHg', min:30, max:300 },
      { k:'bpDia', en:'Blood pressure — bottom number', he:'לחץ דם — מספר תחתון', unit:'mmHg', min:10, max:200 },
      { k:'spo2',  en:'Oxygen (SpO₂)', he:'חמצן (SpO₂)', unit:'%', min:30, max:100 },
      { k:'rr',    en:'Breaths per minute', he:'נשימות בדקה', unit:'/min', min:1, max:80 }
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
      + '<div class="kp-val" dir="ltr"><b>' + (cur === '' ? '—' : cur) + '</b><span>' + f.unit + '</span></div>'
      + '<div class="kp-hint' + (K.err ? ' bad' : '') + '" role="status">' + (K.err || L('Allowed: ' + f.min + ' to ' + f.max + (f.k === 'pulse' || f.k === 'rr' ? ', or 0 for none' : ''), 'טווח מותר: ' + f.min + ' עד ' + f.max + (f.k === 'pulse' || f.k === 'rr' ? ', או 0 אם אין' : ''))) + '</div>'
      + '<div class="kp-keys" dir="ltr">' + keys.map(function(k){ return '<button class="' + (k === 'OK' ? 'ok' : k === '⌫' ? 'del' : '') + '" onclick="Field.kpKey(\'' + k + '\')">' + (k === 'OK' ? (last ? ico('check', 26) + L('Save','שמור') : ico(lang() === 'he' ? 'arrow-left' : 'arrow-right', 26) + L('Next','הבא')) : (k === '⌫' ? '<span class="kp-del">' + ico(lang() === 'he' ? 'arrow-right' : 'arrow-left', 26) + L('Delete','מחק') + '</span>' : k)) + '</button>'; }).join('') + '</div>'
      + (lastVal(f.k) != null ? '<button class="xbtn kp-same" onclick="Field.kpSame()">' + ico('copy', 24) + L('Same as last: ','כמו הקודם: ') + lastVal(f.k) + '</button>' : '') + '<div class="kp-row"><button class="xbtn" onclick="Field.kpSkip()">' + ico('skip-forward', 24) + L('Skip','דלג') + '</button><button class="xbtn xbtn-primary" onclick="Field.kpSave()">' + ico('save', 26) + L('Save now','שמור עכשיו') + '</button></div></div>';
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
    else { var cur0 = K.v[f.k] === '0' ? '' : K.v[f.k]; if (cur0.length >= 3){ K.err = L('3 digits at most. Delete to change it.','עד 3 ספרות. מחקו כדי לשנות.'); if (navigator.vibrate) navigator.vibrate([30, 40, 30]); } else K.v[f.k] = cur0 + k; }
    if (navigator.vibrate) navigator.vibrate(8);
    Field._kpDraw();
  },
  kpSame: function(){ var K = Field._k; if (!K) return; var f0 = K.f[K.i], lv0 = lastVal(f0.k); if (lv0 != null){ K.v[f0.k] = String(lv0); if (K.i < K.f.length - 1) K.i++; Field._kpDraw(); } },
  kpSkip: function(){ var K = Field._k; if (!K) return; K.err = ''; if (K.i === K.f.length - 1) return Field.kpSave(); K.i++; Field._kpDraw(); },
  kpClose: function(){ var s = document.getElementById('f-kp'); if (s) s.remove(); Field._k = null; },
  kpSave: function(){
    var K = Field._k; if (!K) return; var v = K.v;
    for (var ci = 0; ci < K.f.length; ci++){ var msg = Field._kpCheck(ci); if (msg){ K.i = ci; K.err = msg; if (navigator.vibrate) navigator.vibrate([30, 40, 30]); return Field._kpDraw(); } }
    if ((v.bpSys === '') !== (v.bpDia === '')){ K.i = v.bpSys === '' ? 1 : 2; K.err = L('Blood pressure needs both numbers, or skip both.','לחץ דם צריך את שני המספרים, או לדלג על שניהם.'); if (navigator.vibrate) navigator.vibrate([30, 40, 30]); return Field._kpDraw(); }
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
