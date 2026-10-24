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

var TRI = [['red','IMMEDIATE','מיידי'], ['yellow','DELAYED','דחוי'], ['green','MINOR','קל'], ['gray','EXPECTANT','ציפייה'], ['black','DECEASED','נפטר']];
var EVAC = { red:'immediate', yellow:'urgent', green:'routine', gray:'expectant', black:'' };
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
  return '<div class="f-quick"><span class="f-qi">' + ico('zap', 30) + '</span><span><b>' + L('QUICK TRIAGE RECORD','רשומת מיון מהיר') + '</b><small>' + L('Only the triage colour was recorded. Complete the full Form 101 when you have time to give care.','נרשם רק צבע המיון. השלימו את טופס 101 המלא כשיש זמן לטיפול.') + '</small></span><button onclick="Field.upgrade()">' + L('START FULL FORM 101','התחילו טופס 101 מלא') + '</button></div>';
}
function html(){
  var c = ctx(), tqs = c.x.tourniquets || [], cur = W._casualtyTriageColor, h = quickBanner() + (Field.nextHtml ? Field.nextHtml() : '');
  // 1 · triage
  h += '<div class="f-h">' + L('TRIAGE','מיון') + '</div><div class="f-tri">';
  TRI.forEach(function(t){
    var on = cur === t[0], T = W.TriageUI.tg(t[0]);
    h += '<button class="f-tbtn t-' + t[0] + (on ? ' on' : '') + '" aria-pressed="' + on + '" onclick="Field.triage(\'' + t[0] + '\')">' + W.TriageUI.shapeSvg(T.shape, 32) + '<b>' + L(t[1], t[2]) + '</b>' + (on ? '<i>' + ico('check', 22) + L('SET','נקבע') + '</i>' : '') + '</button>';
  });
  h += '</div>';
  h += (Field.xcareHtml ? Field.xcareHtml() : '');
  // 2 · clocks
  var tq0 = tqs[0], txa = lastMed(/^TXA/i), lv = c.vitals.length ? c.vitals[c.vitals.length - 1] : null, veh = vehicleOf();
  var tile = function(label, big, sub, cls){ return '<div class="f-clock ' + (cls || '') + '"><small>' + label + '</small><b>' + big + '</b><span>' + sub + '</span></div>'; };
  h += '<div class="f-clocks">'
    + (tq0 ? tile(L('TOURNIQUET ON','חוסם עורקים'), minsAgo(tq0.time) + '<u>' + L('MIN','ד׳') + '</u>', L('since ','מאז ') + hhmm(tq0.time), minsAgo(tq0.time) >= 120 ? 'bad' : 'warn') : tile(L('TOURNIQUET','חוסם עורקים'), L('NONE','אין'), L('none applied','לא הונח'), ''))
    + (txa ? tile('TXA', minsAgo(txa.time) + '<u>' + L('MIN','ד׳') + '</u>', L('given ','ניתן ') + hhmm(txa.time), 'ok') : tile('TXA', L('NOT GIVEN','לא ניתן'), L('3-hour window','חלון 3 שעות'), ''))
    + (lv ? tile(L('LAST VITALS','מדדים אחרונים'), minsAgo(lv.time) + '<u>' + L('MIN AGO','ד׳ לפני') + '</u>', L('logged ','נרשם ') + hhmm(lv.time), minsAgo(lv.time) > 10 ? 'warn' : '') : tile(L('VITALS','מדדים'), L('NONE','אין'), L('not measured','לא נמדדו'), 'warn'))
    + (veh ? tile(L('AMBULANCE','אמבולנס'), (W.Evac ? W.Evac.etaText(veh) : '—'), L('on board','על הסיפון'), 'ok') : tile(L('AMBULANCE','אמבולנס'), L('NOT YET','עדיין לא'), L('not assigned','לא שויך'), ''))
    + '</div>';
  // 3 · tourniquet
  h += '<button class="f-tq" onclick="Field.tq()">' + ico('timer', 34) + '<span>' + (tqs.length ? L('ANOTHER TOURNIQUET','חוסם עורקים נוסף') : L('TOURNIQUET ON','חוסם עורקים הונח')) + '</span></button>';
  if (tqs.length){
    h += '<div class="f-tqlist">' + tqs.map(function(q, i){ var nm = W.bodyLabelOut ? W.bodyLabelOut(q.site) : ((W.BODY_LABELS || {})[q.site] || q.site); return '<div class="f-tqrow"><span><b>' + esc(W.ShowcaseI18n ? W.ShowcaseI18n.tr(nm) : nm) + '</b><small>' + L('on at ','הונח ב-') + hhmm(q.time) + '</small></span><strong>' + minsAgo(q.time) + ' ' + L('MIN','ד׳') + '</strong></div>'; }).join('') + '</div>';
  }
  // 5 · vitals
  var v = lv || {};
  var num = function(x){ return x == null ? '—' : x; };
  h += '<div class="f-h">' + L('VITALS — TAP TO ENTER','מדדים — לחצו להזנה') + '</div><div class="f-vit">'
    + vt('HR', num(v.pulse), '/min', 0, v.pulse > 120 || (v.pulse != null && v.pulse < 50))
    + vt('BP', v.bpSys ? v.bpSys + '/' + (v.bpDia || '–') : '—', '', 1, v.bpSys && v.bpSys < 90)
    + vt('SpO₂', num(v.spo2), '%', 3, v.spo2 != null && v.spo2 < 92)
    + vt(L('BREATHS','נשימות'), num(v.rr), '/min', 4, v.rr != null && (v.rr > 30 || v.rr < 10))
    + '</div>'
    + '<div class="f-tapbar"><button onclick="Field.tapStart(\'pulse\')">' + ico('heart-pulse', 30) + '<span>' + L('TAP THE HEARTBEAT','הקישו את הדופק') + '</span></button><button onclick="Field.tapStart(\'rr\')">' + ico('wind', 30) + '<span>' + L('TAP THE BREATHS','הקישו את הנשימות') + '</span></button></div>';
  // 6 · give now
  h += '<div class="f-h">' + L('GIVE NOW — ONE TAP, TIME IS RECORDED','לתת עכשיו — לחיצה אחת, הזמן נרשם') + '</div><div class="f-give">';
  GIVE.forEach(function(g){
    var m = g.fluid ? null : lastMed(new RegExp('^' + g.drug)), fl = g.fluid ? ((W._casualtyXABCDE.c || {}).fluids || []).filter(function(f){ return f.type === g.type; }).slice(-1)[0] : null, t = (m || fl) ? (m || fl).time : null;
    h += '<button class="f-g' + (t ? ' given' : '') + '" onclick="Field.give(\'' + g.key + '\')"><b>' + L(g.en, g.he) + '</b><span>' + L(g.sub, g.subHe) + '</span>' + (t ? '<i>' + ico('check', 20) + L('GIVEN ','ניתן ') + hhmm(t) + '</i>' : '') + '</button>';
  });
  h += '</div><button class="xbtn f-more" onclick="Field.march(\'e\')">' + L('MORE DRUGS AND FLUIDS','עוד תרופות ונוזלים') + '</button>';
  return '<section class="field" id="field" data-tour="field">' + h + '</section>';
}
function vt(label, val, unit, idx, bad){
  return '<button class="f-v' + (bad ? ' bad' : '') + '" onclick="Field.keypad(' + idx + ')"><small>' + label + '</small><b>' + val + '</b><span>' + unit + '</span></button>';
}

function lastVal(k){ var v = (W._casualtyVitals || []).slice(-1)[0]; return v && v[k] != null ? v[k] : null; }
// ── Actions ────────────────────────────────────────────────────
function render(){ W.MedHost.renderIncidentPage(); }
var Field = {
  html: html,
  triage: function(color){
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
  give: function(key){
    var g = GIVE.filter(function(x){ return x.key === key; })[0]; if (!g) return;
    snapshot();
    var X = W._casualtyXABCDE, nMed = (X.e.medications || []).length, nFl = (X.c.fluids || []).length;
    if (g.fluid) W.addFluidEntry(g.type, g.vol); else W.addMedication(g.drug, g.dose, g.route);
    if ((X.e.medications || []).length === nMed && (X.c.fluids || []).length === nFl){ if (W._medUndoStack) W._medUndoStack.pop(); return; }
    undoToast(L(g.en + ' ' + g.sub + ' — given ' + hhmm(new Date().toISOString()), g.he + ' ' + g.subHe + ' — ניתן ' + hhmm(new Date().toISOString())), doUndo);
  },
  undo: function(){ doUndo(); },
  upgrade: function(){ var c = (W._incidentCasualties || []).filter(function(x){ return x._docId === W._casualtyEditId; })[0]; if (!c) return; W._upsertOfflineCasualty({ _docId:c._docId, formLevel:'full' }); undoToast(L('Now a FULL Form 101','כעת טופס 101 מלא'), null); render(); },

  // ── Vitals keypad ────────────────────────────────────────────
  _k: null,
  keypad: function(idx){
    var fields = [
      { k:'pulse', en:'HEART RATE', he:'דופק', unit:'/min', max:300 },
      { k:'bpSys', en:'BLOOD PRESSURE — TOP NUMBER', he:'לחץ דם — מספר עליון', unit:'mmHg', max:300 },
      { k:'bpDia', en:'BLOOD PRESSURE — BOTTOM NUMBER', he:'לחץ דם — מספר תחתון', unit:'mmHg', max:200 },
      { k:'spo2',  en:'OXYGEN (SpO₂)', he:'חמצן (SpO₂)', unit:'%', max:100 },
      { k:'rr',    en:'BREATHS PER MINUTE', he:'נשימות בדקה', unit:'/min', max:80 }
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
      + '<div class="kp-step">' + (K.i + 1) + ' / ' + K.f.length + '</div>'
      + '<div class="kp-label">' + L(f.en, f.he) + '</div>'
      + '<div class="kp-val"><b>' + (cur === '' ? '—' : cur) + '</b><span>' + f.unit + '</span></div>'
      + '<div class="kp-keys">' + keys.map(function(k){ return '<button class="' + (k === 'OK' ? 'ok' : k === '⌫' ? 'del' : '') + '" onclick="Field.kpKey(\'' + k + '\')">' + (k === 'OK' ? (last ? L('SAVE','שמור') : L('NEXT','הבא')) : (k === '⌫' ? ico('undo-2', 30) : k)) + '</button>'; }).join('') + '</div>'
      + (lastVal(f.k) != null ? '<button class="xbtn kp-same" onclick="Field.kpSame()">' + L('SAME AS LAST: ','כמו הקודם: ') + lastVal(f.k) + '</button>' : '') + '<div class="kp-row"><button class="xbtn" onclick="Field.kpSkip()">' + L('SKIP','דלג') + '</button><button class="xbtn xbtn-primary" onclick="Field.kpSave()">' + L('SAVE NOW','שמור עכשיו') + '</button></div></div>';
  },
  kpKey: function(k){
    var K = Field._k; if (!K) return; var f = K.f[K.i];
    if (k === '⌫'){ K.v[f.k] = K.v[f.k].slice(0, -1); }
    else if (k === 'OK'){ if (K.i === K.f.length - 1) return Field.kpSave(); K.i++; }
    else { var nv = (K.v[f.k] + k).slice(0, 3); if (parseInt(nv, 10) <= f.max) K.v[f.k] = nv; }
    if (navigator.vibrate) navigator.vibrate(8);
    Field._kpDraw();
  },
  kpSame: function(){ var K = Field._k; if (!K) return; var f0 = K.f[K.i], lv0 = lastVal(f0.k); if (lv0 != null){ K.v[f0.k] = String(lv0); if (K.i < K.f.length - 1) K.i++; Field._kpDraw(); } },
  kpSkip: function(){ var K = Field._k; if (!K) return; if (K.i === K.f.length - 1) return Field.kpSave(); K.i++; Field._kpDraw(); },
  kpClose: function(){ var s = document.getElementById('f-kp'); if (s) s.remove(); Field._k = null; },
  kpSave: function(){
    var K = Field._k; if (!K) return; var v = K.v;
    var any = v.pulse || v.bpSys || v.bpDia || v.spo2 || v.rr;
    Field.kpClose();
    if (!any) return;
    snapshot();
    var vi0 = W._casualtyVitalsInput || {}, pick = function(a, b){ return a !== '' && a != null ? a : (b || ''); };
    W._casualtyVitalsInput = { pulse:pick(v.pulse, vi0.pulse), rr:pick(v.rr, vi0.rr), spo2:pick(v.spo2, vi0.spo2), bpSys:pick(v.bpSys, vi0.bpSys), bpDia:pick(v.bpDia, vi0.bpDia), temp:vi0.temp || '', etco2:vi0.etco2 || '', radialPulse:vi0.radialPulse || '' };
    W.addVitalsReading();
    undoToast(L('Vitals saved', 'מדדים נשמרו'), doUndo);
  }
};
Field.toast = undoToast;
W.Field = Field;
})();
