/* Showcase shell — wires shared/medical-forms.js to an in-memory demo and renders the app.
   No Firebase, no login. State lives in memory and resets on reload.
   Loaded AFTER shared/*.js, host.ported.js, disclaimer.js and bracelet.js (so overrides below win). */
(function(){
'use strict';
var w = window;
function lang(){ return (w.ShowcaseI18n && w.ShowcaseI18n.lang) || 'en'; }
function L(en, he){ return lang() === 'he' ? he : en; }
function T(s){ return w.ShowcaseI18n ? w.ShowcaseI18n.tr(s) : s; }
function ico(n, s, c){ return w.Icon ? w.Icon(n, s, c) : ''; }
function esc(s){ return w.escapeHtml(s); }

// ── Globals the ported beta code expects ───────────────────────
w.S = { mode:'military', personnel:[], opsRoomPhone:'', teamId:'demo' };
w.curUser = { uid:'demo', displayName:'חובש דמו' };
w.curTeamId = 'demo';
w.FB = null;
w._incidentTabBeforeEdit = null;
w._gcsDetailOpen = false;
w._vehiclePickerMode = null;
w._mciEvacOpen = false; w._mciResourcesOpen = false; w._mciPriorityOpen = false;
w._mciRefreshInterval = null; w._mciVehiclePicker = null;
w._mciInited_saltAutoOpen = false;
w._archiveForm101 = function(){};
w._hasConsent = function(){ return true; };          // no legal gate in the demo
w._canWriteCloud = function(){ return false; };      // everything is local
w.isManagerLocal = function(){ return false; };
w.openIncidentSetup = function(){};
w.endIncident = function(){ toast(L('Demo: the incident stays open','בדמו האירוע נשאר פתוח')); };

// In-memory casualty store replaces the localStorage-backed offline store.
var _store = [];
w._readOfflineCasualties = function(){ return _store.slice(); };
w._writeOfflineCasualties = function(list){ _store = list; };

// Undo history belongs to ONE open casualty (otherwise UNDO on B could restore A's data).
function resetUndo(){ if (w._medUndoStack) w._medUndoStack.length = 0; w._medRedoStack = []; }
// Where the list/board was scrolled when a casualty was opened: BACK returns to exactly that place.
var _place = null;
function rememberPlace(){
  if (w._casualtyEditMode) return;
  var c = document.getElementById('incident-content');
  _place = c ? { tab: w._incidentTab, cas: w._casView, y: c.scrollTop } : null;
}
['newCasualty','editCasualty','editCasualtyById'].forEach(function(n){ var o = w[n]; if (typeof o !== 'function') return; w[n] = function(){ rememberPlace(); resetUndo(); return o.apply(this, arguments); }; });
var _ocf = w.closeCasualtyForm;
if (typeof _ocf === 'function') w.closeCasualtyForm = function(){ return Promise.resolve(_ocf.apply(this, arguments)).then(function(r){ resetUndo(); return r; }); };

// Vitals sanity: impossible numbers are rejected, not saved.
var _avr = w.addVitalsReading;
if (typeof _avr === 'function') w.addVitalsReading = function(){
  var i = w._casualtyVitalsInput || {}, lim = { pulse:[20,300], rr:[1,80], spo2:[30,100], bpSys:[30,300], bpDia:[10,200], temp:[25,45], etco2:[5,100] }, bad = false;
  Object.keys(lim).forEach(function(k){ var v = parseFloat(i[k]); if (i[k] !== '' && i[k] != null && !/^\d{1,4}([.]\d{1,2})?$/.test(String(i[k]).trim())){ bad = true; i[k] = ''; return; } if (i[k] !== '' && i[k] != null && !isNaN(v) && !(v === 0 && (k === 'pulse' || k === 'rr')) && (v < lim[k][0] || v > lim[k][1])){ bad = true; i[k] = ''; } });
  if (bad){ w.toast(L('Check the numbers — one value is not possible','בדקו את המספרים — אחד הערכים אינו אפשרי'), false); return; }
  return _avr.apply(this, arguments);
};

// ── Toast ──────────────────────────────────────────────────────
function toast(msg){ if (w.SA && w.SA.toast) w.SA.toast(msg, { undo:false, duration:5000 }); }
w.toast = toast; w.doUndo = function(){};
w.setIncidentTab = function(t){ w._incidentTab = t; w.renderIncidentPage(); };

// ── MedHost wiring ─────────────────────────────────────────────
Object.assign(w.MedHost, {
  renderIncidentPage: function(){ w.renderIncidentPage(); },
  triggerAutoSave:    function(){ w.triggerAutoSave(); },
  save:               function(){},
  toast:              toast,
  getDb:              function(){ return null; },
  getAlertId:         function(){ return w._incidentAlertId; },
  getTeamId:          function(){ return 'demo'; }
});

// ── Triage language: SHAPE + WORD + COLOUR, always ─────────────
var TG = {
  red:    { c:'#d01a20', en:'URGENT', he:'דחוף',  shape:'oct' },
  yellow: { c:'#ffd400', en:'DELAYED',   he:'עדיפות שנייה',   shape:'tri' },
  green:  { c:'#19c37d', en:'NOT URGENT', he:'לא דחוף',     shape:'circ' },
  gray:   { c:'#b4bbc8', en:'WAITING', he:'ממתין', shape:'hex' },
  black:  { c:'#000000', en:'WAITING', he:'ממתין',   shape:'sqx' }
};
var NONE = { c:'#6b7078', en:'NOT TRIAGED', he:'טרם סווג', shape:'circ' };
function tg(color){ return TG[color === 'gray' ? 'black' : color] || NONE; }
function tgWord(color){ var t = tg(color); return L(t.en, t.he); }
function shapeSvg(shape, size){
  var s = size || 24, p = {
    oct:'<path d="M8 2h8l6 6v8l-6 6H8l-6-6V8z"/>',
    tri:'<path d="M12 2.5l10.5 18.5H1.5z"/>',
    circ:'<circle cx="12" cy="12" r="10"/>',
    hex:'<path d="M12 1.5l9.5 5.2v10.6L12 22.5l-9.5-5.2V6.7z"/>',
    sqx:'<rect x="2.5" y="2.5" width="19" height="19" rx="3"/><path d="M8 8l8 8M16 8l-8 8" stroke="#fff" stroke-width="2.6" stroke-linecap="round" fill="none"/>'
  }[shape] || '';
  return '<svg class="tshape" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="width:' + s + 'px;height:' + s + 'px">' + p + '</svg>';
}
function chip(color, big){
  if (color === 'gray') color = 'black';
  var t = tg(color), key = (color && TG[color]) ? color : 'none';
  return '<span class="tchip t-' + key + (big ? ' lg' : '') + '" role="img" aria-label="' + esc(tgWord(color)) + '">' + shapeSvg(t.shape, big ? 26 : 22) + '<span>' + esc(tgWord(color)) + '</span></span>';
}
// One category, named "Waiting" (clinical owner): black colour, square shape. A record still marked gray is shown and counted as black.
delete TG.gray;
if (!w.normTriage) w.normTriage = function(c){ var t = c && c.triageColor; return t === 'gray' ? 'black' : t; };
function normAll(){ (w._incidentCasualties || []).forEach(function(c){ if (c && c.triageColor === 'gray') c.triageColor = 'black'; }); }
w.TriageUI = { tg: tg, chip: chip, shapeSvg: shapeSvg, word: tgWord, TG: TG };

// ── Tabs ───────────────────────────────────────────────────────
var TABS = [
  { id:'status',     icon:'layout-dashboard', en:'Home',       he:'בית' },
  { id:'casualties', icon:'users',            en:'Patients',   he:'נפגעים' },
  { id:'evac',       icon:'ambulance',        en:'Evacuate',   he:'פינוי' },
  { id:'bracelets',  icon:'qr-code',          en:'Wristbands', he:'צמידים', short:['Bands','צמידים'] }
];
function activeTab(){ return w._casualtyEditMode ? 'casualties' : w._incidentTab; }
function renderTabbar(){
  var bar = document.getElementById('incident-tabs'); if (!bar) return;
  var n = (w._incidentCasualties || []).length, a = activeTab();
  bar.removeAttribute('role');   // a plain nav landmark: these buttons switch screens, they are not an ARIA tab set
  bar.innerHTML = TABS.map(function(t){
    var on = a === t.id;
    return '<button aria-label="' + L(t.en, t.he) + '"' + (on ? ' aria-current="page"' : '') + ' class="' + (on ? 'on' : '') + '" data-tab="' + t.id + '" onclick="Demo.tab(\'' + t.id + '\')">'
      + ico(t.icon, 30) + (t.short ? '<span class="tl">' + L(t.en, t.he) + '</span><span class="ts" aria-hidden="true">' + L(t.short[0], t.short[1]) + '</span>' : '<span>' + L(t.en, t.he) + '</span>') + (t.id === 'casualties' && n ? '<i class="badge" style="display:flex">' + n + '</i>' : '') + '</button>';
  }).join('');
}

// ── Due now: across every casualty, what needs a hand right now. Facts from the record, phrased as checks, never as a diagnosis. ──
function minsSince(iso){ var t = Date.parse(iso); return isNaN(t) ? null : Math.floor((Date.now() - t) / 60000); }
function dueItems(){
  var out = [];
  (w._incidentCasualties || []).forEach(function(c){
    if (c.triageColor === 'black' || (w.findVehicleForCasualty && (w.findVehicleForCasualty(c) || {}).status === 'athospital')) return;
    var x = (c.xabcde || {}).x || {}, e = (c.xabcde || {}).e || {};
    (x.tourniquets || []).forEach(function(t){ var m = minsSince(t.time); if (m != null && m >= 120) out.push({ c:c, icon:'timer', task:L('Check tourniquet','בדיקת חוסם עורקים'), det:L('On for ' + Math.floor(m / 60) + ' h ' + (m % 60) + ' min','מונח ' + Math.floor(m / 60) + ' ש׳ ' + (m % 60) + ' ד׳'), m:m, lvl:2 }); });
    var k = (e.medications || []).filter(function(d){ return /קטמין|ketamine/i.test(d.drug || d.name || ''); }).sort(function(a, b){ return Date.parse(a.time) - Date.parse(b.time); }).pop();
    if (k){ var km = minsSince(k.time); if (km != null && km >= 45) out.push({ c:c, icon:'syringe', task:L('Reassess pain','הערכת כאב חוזרת'), det:L('Ketamine given','ניתן קטמין'), m:km, lvl:1 }); }
    if (c.triageColor === 'red' && !(c.vitalsHistory || []).length) out.push({ c:c, icon:'activity', task:L('Take vitals','מדידת מדדים'), det:L('Urgent · none recorded','דחוף · לא נמדדו'), m:null, lvl:1 });
  });
  var rank = { red:0, yellow:1, green:2 };
  function R(i){ var k = i.c.triageColor; return k in rank ? rank[k] : 3; }
  return out.sort(function(a, b){ return (b.lvl - a.lvl) || (R(a) - R(b)) || ((b.m || 0) - (a.m || 0)); });
}
function dueStrip(){
  var d = dueItems(); if (!d.length) return '';
  var fwd = lang() === 'he' ? 'chevron-left' : 'chevron-right';
  return '<div class="due-h"><span class="sec-label">' + L('Due now','לטיפול עכשיו') + '</span><span class="due-n">' + d.length + '</span></div><div class="due">' + d.slice(0, 4).map(function(i){
    var col = i.c.triageColor || 'none', t = tg(col) || {}, num = w.casNum ? w.casNum(i.c) : '';
    var lab = (w.casLabel ? w.casLabel(i.c) : '') + ' · ' + tgWord(col) + ' · ' + i.task + ' · ' + i.det + (i.m != null ? ' · ' + i.m + ' ' + L('min','דק׳') : '');
    return '<button class="due-r' + (i.lvl > 1 ? ' hi' : '') + '" onclick="Demo.openCasualty(\'' + esc(i.c._docId) + '\')" aria-label="' + esc(lab) + '">'
      + '<span class="due-id t-' + col + '">' + (t.shape ? shapeSvg(t.shape, 16) : '') + '<b>' + num + '</b></span>'
      + '<span class="due-t"><b>' + ico(i.icon, 22) + i.task + '</b><small>' + i.det + '</small></span>'
      + (i.m != null ? '<span class="due-m"><b>' + i.m + '</b><small>' + L('min','דק׳') + '</small></span>' : '')
      + ico(fwd, 22) + '</button>';
  }).join('') + (d.length > 4 ? '<p class="due-more">' + L('+' + (d.length - 4) + ' more','+' + (d.length - 4) + ' נוספים') + '</p>' : '') + '</div>';
}

w.dueItems = dueItems;

// ── Home ───────────────────────────────────────────────────────
function unassigned(c){ return !w.isCasualtyAssignedToVehicle(c); }
function renderOverview(){
  var a = w._incidentData || {}, list = w._incidentCasualties || [];
  var count = function(c){ return list.filter(function(x){ return x.triageColor === c; }).length; };
  var waitingReds = list.filter(function(x){ return x.triageColor === 'red' && unassigned(x); });
  var alertHtml = waitingReds.length
    ? '<button class="ov-alert" onclick="Demo.openCasualty(\'' + esc(waitingReds[0]._docId) + '\')">' + ico('triangle-alert', 32)
      + '<span><b>' + (waitingReds.length === 1 ? (w.casBadge ? w.casBadge(waitingReds[0]) + ' ' : '') + L((w.casLabel ? w.casLabel(waitingReds[0]) : 'Casualty') + ' · urgent, waiting for evacuation', (w.casLabel ? w.casLabel(waitingReds[0]) : 'נפגע') + ' · דחוף, ממתין לפינוי') : L(waitingReds.length + ' urgent casualties waiting for evacuation', waitingReds.length + ' נפגעים דחופים ממתינים לפינוי')) + '</b><small>' + (waitingReds.length === 1 ? L('Open Form 101','פתיחת טופס 101') : L('Tap to open the first one','לחצו לפתיחת הראשון')) + '</small></span>' + ico(lang()==='he' ? 'chevron-left' : 'chevron-right', 28) + '</button>'
    : '';
  var prev = w._ovCounts || {}; w._ovCounts = {};
  var tiles = ['red','yellow','green','black'].map(function(c){
    var t = tg(c), n = count(c), bump = prev[c] != null && prev[c] !== n; w._ovCounts[c] = n;
    return '<button class="ov-tile t-' + c + (bump ? ' bump' : '') + '" onclick="Demo.filter(\'' + c + '\')">' + shapeSvg(t.shape, 30) + '<b>' + count(c) + '</b><span>' + tgWord(c) + '</span></button>';
  }).join('');
  var go = function(icon, title, sub, fn, primary){
    return '<button class="go' + (primary ? ' primary' : '') + '" onclick="' + fn + '"><span class="gi">' + ico(icon, 28) + '</span><span><b>' + title + '</b><small>' + sub + '</small></span><span class="chev">' + ico(lang()==='he' ? 'chevron-left' : 'chevron-right', 28) + '</span></button>';
  };
  var mins = a.timestamp && a.timestamp.toDate ? Math.max(1, Math.round((Date.now() - a.timestamp.toDate().getTime()) / 60000)) : 18;
  return '<div class="ov-hero"><div class="eyebrow"><i class="live-dot" aria-hidden="true"></i>' + L('Live · ' + mins + ' min','חי · ' + mins + ' דק׳') + '</div>'
    + '<h2>' + L('Bus-stop attack · ' + list.length + ' casualties','פיגוע בתחנת אוטובוס · ' + list.length + ' נפגעים') + '</h2></div>'
    + '<button class="ov-demo" onclick="Disclaimer.open()">' + ico('triangle-alert', 24) + '<span>' + L('Demo · fictional patients · not for real use','דמו · נפגעים בדויים · לא לשימוש אמיתי') + '</span></button>'
    + '<div class="sec-label">' + L('New casualty','נפגע חדש') + '</div>'
    + '<div class="ov-choose">'
    +   '<button class="ch full" onclick="Demo.newFull()"><span class="ch-i">' + ico('file-text', 34) + '</span><b>' + L('One patient','נפגע אחד') + '</b><strong>' + L('Full Form 101','טופס 101 מלא') + '</strong><small>' + L('Body map, vitals, drugs, times','מפת גוף, מדדים, תרופות, זמנים') + '</small></button>'
    +   '<button class="ch quick" onclick="Quick.open()"><span class="ch-i">' + ico('zap', 34) + '</span><b>' + L('Many casualties','נפגעים רבים') + '</b><strong>' + L('Quick triage','מיון מהיר') + '</strong><small>' + L('A colour in seconds','צבע תוך שניות') + '</small></button>'
    + '</div>'
    + alertHtml
    + dueStrip()
    + '<div class="sec-label">' + L('On scene now','בזירה עכשיו') + '</div>'
    + '<div class="ov-tiles">' + tiles + '</div>'
    + '<div class="sec-label">' + L('Wristbands','צמידים') + '</div>'
    + go('scan-line', L('Scan a wristband','סריקת צמיד'), L('Read any casualty’s record','קריאת תיק של כל נפגע'), "Demo.go('scan')")
    + '<div class="sec-label">' + L('Incident','אירוע') + '</div>'
    + '<dl class="kv">'
    +   '<div><dt>' + L('Location','מיקום') + '</dt><dd>' + esc(T(a.location || '')) + '</dd></div>'
    +   '<div><dt>' + L('What happened','נסיבות') + '</dt><dd>' + esc(T(a.circumstances || '')) + '</dd></div>'
    +   '<div><dt>' + L('Environment','סביבה') + '</dt><dd>' + esc(T(a.environment || '')) + '</dd></div>'
    +   '<div><dt>' + L('Threat status','סטטוס איום') + '</dt><dd>' + esc(T(a.threats || '')) + '</dd></div>'
    + '</dl>';
}

function lvl(c){ return c.formLevel === 'quick' ? '<span class="lvl quick">' + ico('zap', 20) + L('Quick triage — tap to complete the full form','מיון מהיר — לחצו להשלמת הטופס המלא') + '</span>' : '<span class="lvl full">' + ico('file-text', 20) + L('Full Form 101','טופס 101 מלא') + '</span>'; }
w.levelOf = function(c){ return c && c.formLevel === 'quick' ? 'quick' : 'full'; };
// ── Casualty list (+ command board) ────────────────────────────
function flag(label, bad){ return bad ? ' <u class="flag">' + label + '</u>' : ''; }
function renderPatients(){
  var order = { red:0, yellow:1, green:2, gray:3, black:4 };
  var all = (w._incidentCasualties || []).slice().sort(function(a, b){
    return (order[a.triageColor] != null ? order[a.triageColor] : 9) - (order[b.triageColor] != null ? order[b.triageColor] : 9) || ((w.casNum && w.casNum(a)) || 0) - ((w.casNum && w.casNum(b)) || 0);
  });
  var f = w._plFilter, list = f ? all.filter(function(c){ return c.triageColor === f; }) : all;
  var h = '<div class="seg-tabs" role="tablist"><button class="on" role="tab" onclick="Demo.casView(\'list\')">' + ico('list-checks', 22) + L('List','רשימה') + '</button>'
    + '<button role="tab" onclick="Demo.casView(\'board\')">' + ico('layout-dashboard', 22) + L('Board','לוח פיקוד') + '</button></div>';
  h += '<div class="pl-head"><div><h2>' + L('Patients','נפגעים') + '</h2><p>' + L('Most urgent first','הדחוף ביותר ראשון') + '</p></div></div>';
  if (f) h += '<button class="filter-bar" onclick="Demo.filter(null)">' + chip(f) + '<span>' + L('Showing only these','מוצגים רק אלה') + '</span><b>' + L('Show all','הצג הכל') + '</b></button>';
  h += '<div class="add-split"><button class="ch full" onclick="Demo.newFull()">' + ico('file-text', 30) + '<b>' + L('One patient','נפגע אחד') + '</b><small>' + L('Full Form 101','טופס 101 מלא') + '</small></button><button class="ch quick" onclick="Quick.open()">' + ico('zap', 30) + '<b>' + L('Many casualties','נפגעים רבים') + '</b><small>' + L('Quick triage','מיון מהיר') + '</small></button></div><div class="pl">';
  list.forEach(function(c){
    var x = c.xabcde || {}, v = (w.latestVitals ? w.latestVitals(c.vitalsHistory || []) : (c.vitalsHistory || []).slice(-1)[0]) || {};
    var tq = (x.x && x.x.tourniquets || [])[0];
    var tqMin = tq ? Math.max(0, Math.round((Date.now() - Date.parse(tq.time)) / 60000)) : null;
    var inj = (c.injuries || []).slice(0, 3).map(function(i){ return esc(T(w.bodyLabelOut ? w.bodyLabelOut(i.region) : ((w.BODY_LABELS || {})[i.region] || i.region))); }).join(' · ');
    var onVeh = !unassigned(c);
    h += '<button class="pl-card" onclick="editCasualtyById(\'' + esc(c._docId) + '\')">' + chip(c.triageColor, true)
      + '<span class="pl-main"><b>' + (w.casBadge ? w.casBadge(c) + ' ' : '') + esc(String(T(c.name)).split(' — ')[0]) + (w.casTag ? w.casTag(c) : '') + (w.casDesc && w.casDesc(c) ? ' <small class="cdesc">' + esc(w.casDesc(c)) + '</small>' : '') + '</b>' + lvl(c)
      + '<span class="pl-sub">' + (inj || L('No injuries marked','לא סומנו פציעות')) + '</span>'
      + '<span class="pl-vit">'
      + (v.pulse === 0 ? '<em><i>' + L('No pulse','אין דופק') + '</i></em>' : v.pulse != null ? '<em>HR <i>' + v.pulse + '</i>' + flag(L('High','גבוה'), v.pulse > 120) + '</em>' : '')
      + (v.bpSys ? '<em>BP <i>' + v.bpSys + '/' + (v.bpDia || '–') + '</i>' + flag(L('Low','נמוך'), v.bpSys < 90) + flag(L('High','גבוה'), v.bpSys >= 180) + staleAt(v, 'bp') + '</em>' : '')
      + (v.spo2 ? '<em>SpO₂ <i>' + v.spo2 + '</i>' + flag(L('Low','נמוך'), v.spo2 < 92) + '</em>' : '')
      + (tqMin != null ? '<em class="warn">' + ico('timer', 22) + L('Tourniquet ','חוסם עורקים ') + '<i>' + tqMin + L(' min',' ד׳') + '</i></em>' : '')
      + (onVeh ? '<em class="ok">' + ico('ambulance', 22) + ((w.findVehicleForCasualty(c) || {}).status === 'athospital' ? L('At hospital','בבית חולים') : L('On ambulance','באמבולנס')) + '</em>' : '')
      + '</span></span><span class="chev">' + ico(lang()==='he' ? 'chevron-left' : 'chevron-right', 28) + '</span></button>';
  });
  if (!list.length) h += '<p class="empty">' + L('No casualties in this group.','אין נפגעים בקבוצה זו.') + '</p>';
  return h + '</div>';
}

// ── Command board ──────────────────────────────────────────────
// Who needs what right now: one next action, four scene numbers, the same triage tiles as Home,
// a search row that stays on screen, and one card per casualty (same card language as the list).
var AVPU = { A:['Alert','ער'], V:['Responds to voice','מגיב לקול'], P:['Responds to pain','מגיב לכאב'], U:['Unresponsive','לא מגיב'] };
function minsSinceTs(t){ var d = t && t.toDate ? t.toDate() : (t ? new Date(t) : null); return d && !isNaN(d) ? Math.max(0, Math.round((Date.now() - d.getTime()) / 60000)) : null; }
// a value older than the newest reading shows its own time
function staleAt(v, k){ var t = v && v._t && v._t[k]; if (!t || !v.time || String(t) === String(v.time)) return ''; var d = new Date(t); return isNaN(d) ? '' : ' <small class="stale" dir="ltr">' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + '</small>'; }
function lastVit(c){ var v = (w.latestVitals ? w.latestVitals(c.vitalsHistory || []) : (c.vitalsHistory || []).slice(-1)[0]) || {}; return { _t: v._t || {}, time: v.time, pulse: v.pulse != null ? v.pulse : c.pulse, bpSys: v.bpSys != null ? v.bpSys : c.bpSys, bpDia: v.bpDia != null ? v.bpDia : c.bpDia, spo2: v.spo2 != null ? v.spo2 : c.spo2, rr: v.rr != null ? v.rr : c.rr, avpu: v.avpu || c.avpu || (((c.xabcde || {}).d || {}).avpu) || '' }; }
function openTq(c){ var t = (((c.xabcde || {}).x || {}).tourniquets || []).filter(function(q){ return !q.released && !q.removed; })[0]; return t ? Math.max(0, Math.round((Date.now() - Date.parse(t.time)) / 60000)) : null; }
function renderBoard(){
  var order = { red:0, yellow:1, green:2, gray:3, black:4 };
  var all = (w._incidentCasualties || []).slice().sort(function(a, b){ return (order[a.triageColor] != null ? order[a.triageColor] : 9) - (order[b.triageColor] != null ? order[b.triageColor] : 9) || ((w.casNum && w.casNum(a)) || 0) - ((w.casNum && w.casNum(b)) || 0); });
  var f = w._bdFilter, q = String(w._bdQuery || '').trim().toLowerCase().replace(/^#\s*$/, '');   // a lone # shows everyone
  var serial = function(c){ return w.Bracelet && w.Bracelet.serialFor ? w.Bracelet.serialFor(c) : ''; };
  var qn = /^#?\s*(\d+)$/.exec(q);
  var list = all.filter(function(c){ return (!f || c.triageColor === f) && (!q || (qn ? ((w.casNum && w.casNum(c) === +qn[1]) || (qn[1].length >= 3 && c.tagId && c.tagId.slice(3) === ('000' + qn[1]).slice(-4))) : (String(T(c.name)) + ' ' + c.name + ' ' + serial(c) + ' ' + (c.tagId || '')).toLowerCase().indexOf(q) >= 0)); });
  var h = '<div class="seg-tabs" role="tablist"><button role="tab" aria-selected="false" onclick="Demo.casView(\'list\')">' + ico('list-checks', 22) + L('List','רשימה') + '</button><button class="on" role="tab" aria-selected="true" onclick="Demo.casView(\'board\')">' + ico('layout-dashboard', 22) + L('Board','לוח פיקוד') + '</button></div>';
  // next action
  var next = all.filter(function(c){ return (c.triageColor === 'red' || c.triageColor === 'yellow') && unassigned(c); })[0];
  if (next) h += '<button class="bd-next" onclick="Demo.tab(\'evac\')">' + chip(next.triageColor, true) + '<span><small>' + L('Next action','הפעולה הבאה') + '</small><b>' + (w.casBadge ? w.casBadge(next) + ' ' : '') + esc(String(T(next.name)).split(' — ')[0]) + L(' needs an ambulance',' צריך אמבולנס') + '</b></span><em>' + ico('ambulance', 26) + L('Assign','שיבוץ') + '</em></button>';
  else h += '<div class="bd-next ok">' + ico('check-check', 28) + '<span><small>' + L('Next action','הפעולה הבאה') + '</small><b>' + L('Every urgent casualty is on an ambulance','כל הנפגעים הדחופים באמבולנס') + '</b></span></div>';
  // scene numbers
  var tqs = all.map(openTq).filter(function(x){ return x != null; }), lowBp = all.filter(function(c){ var v = lastVit(c); return c.triageColor !== 'black' && v.bpSys != null && v.bpSys < 90; }).length;
  var onAmb = all.filter(function(c){ return !unassigned(c); }).length, onScene = all.filter(function(c){ return unassigned(c) && c.triageColor !== 'black'; }).length;
  var stat = function(icon, n, label, sub, warn){ return '<div class="bd-stat' + (warn ? ' warn' : '') + '">' + ico(icon, 26) + '<b>' + n + '</b><span>' + label + (sub ? '<small>' + sub + '</small>' : '') + '</span></div>'; };
  h += '<div class="bd-stats">'
    + stat('timer', tqs.length, L('Tourniquets on','חוסמי עורקים'), tqs.length ? L('longest ' + Math.max.apply(null, tqs) + ' min','הארוך ' + Math.max.apply(null, tqs) + ' דק׳') : '', tqs.some(function(m){ return m >= 60; }))
    + stat('heart-pulse', lowBp, L('Blood pressure under 90','לחץ דם מתחת 90'), '', lowBp > 0)
    + stat('users', onScene, L('Still on scene','עדיין בזירה'), '', false)
    + stat('ambulance', onAmb, L('On an ambulance','באמבולנס'), '', false)
    + '</div>';
  // triage tiles: the Home component, here they filter the board
  var count = function(c){ return all.filter(function(x){ return x.triageColor === c; }).length; };
  h += '<div class="ov-tiles bd-tiles">' + ['red','yellow','green','black'].map(function(c){ var t = tg(c); return '<button class="ov-tile t-' + c + (f === c ? ' on' : '') + '" aria-pressed="' + (f === c) + '" onclick="Demo.bdFilter(\'' + c + '\')">' + shapeSvg(t.shape, 30) + '<b>' + count(c) + '</b><span>' + tgWord(c) + '</span></button>'; }).join('') + '</div>';
  // search row (sticky)
  h += '<div class="bd-search"><label>' + ico('search', 24) + '<input type="search" enterkeyhint="search" autocomplete="off" placeholder="' + esc(L('Number or tag','מספר או תג')) + '" aria-label="' + esc(L('Find a casualty by number or wristband code','חיפוש נפגע לפי מספר או קוד צמיד')) + '" oninput="Demo.bdSearch(this.value)"></label>'
    + '<button onclick="Demo.go(\'scan\')">' + ico('scan-line', 24) + '<span>' + L('Scan','סריקה') + '</span></button></div>';
  if (f || q) h += '<button class="filter-bar" onclick="Demo.bdFilter(null);Demo.bdSearch(\'\', true)">' + (f ? chip(f) : ico('search', 22)) + '<span>' + L(list.length + ' of ' + all.length + ' shown', 'מוצגים ' + list.length + ' מתוך ' + all.length) + '</span><b>' + L('Show all','הצג הכל') + '</b></button>';
  // rows: one line per casualty (default from 6 casualties up) · cards: the full card
  var rows = w._bdRows != null ? w._bdRows : all.length >= 6;
  h += '<div class="bd-view" role="group" aria-label="' + L('Layout','תצוגה') + '"><button class="' + (rows ? 'on' : '') + '" aria-pressed="' + rows + '" onclick="Demo.bdRows(true)">' + ico('list-checks', 22) + L('Rows','שורות') + '</button><button class="' + (rows ? '' : 'on') + '" aria-pressed="' + !rows + '" onclick="Demo.bdRows(false)">' + ico('layers', 22) + L('Cards','כרטיסים') + '</button></div>';
  h += '<div class="bd-list' + (rows ? ' rows' : '') + '">';
  list.forEach(function(c){
    if (rows){
      var rv = lastVit(c), rt = openTq(c), rn = String(T(c.name)).split(' — ')[0], bits = [];
      if (rt != null) bits.push('<span class="' + (rt >= 60 ? 'bad' : 'warn') + '">' + ico('timer', 20) + rt + L(' min',' דק׳') + '</span>');
      if (c.triageColor !== 'black'){
        if (rv.pulse === 0) bits.push('<span class="bad">' + ico('heart-pulse', 20) + L('No pulse','אין דופק') + '</span>');
        else if (rv.bpSys != null && rv.bpSys < 90) bits.push('<span class="bad">' + ico('heart-pulse', 20) + L('BP ','ל״ד ') + rv.bpSys + '</span>');
        else if (rv.spo2 != null && rv.spo2 < 92) bits.push('<span class="bad">' + ico('wind', 20) + 'SpO₂ ' + rv.spo2 + '%</span>');
        else if (rv.pulse != null && rv.pulse > 120) bits.push('<span class="warn">' + ico('heart-pulse', 20) + L('HR ','דופק ') + rv.pulse + '</span>');
      }
      h += '<button class="bd-row" onclick="editCasualtyById(\'' + esc(c._docId) + '\')">' + chip(c.triageColor) + '<b>' + (w.casBadge ? w.casBadge(c) + ' ' : '') + esc(rn) + (w.casTag ? w.casTag(c) : '') + '</b><span class="bd-row-v">' + bits.slice(0, 2).join('') + '</span>' + ico(lang() === 'he' ? 'chevron-left' : 'chevron-right', 22) + '</button>';
      return;
    }
    var v = lastVit(c), tq = openTq(c), veh = w.findVehicleForCasualty ? w.findVehicleForCasualty(c) : null, age = minsSinceTs(c.timestamp), dead = c.triageColor === 'black';
    var name = String(T(c.name)).split(' — '), inj = (c.injuries || []).slice(0, 3).map(function(i){ return esc(T(w.bodyLabelOut ? w.bodyLabelOut(i.region) : ((w.BODY_LABELS || {})[i.region] || i.region))); }).join(' · ');
    var vit = function(lbl, val, flagTxt){ return '<em><small>' + lbl + '</small><i>' + val + '</i>' + (flagTxt ? '<u>' + flagTxt + '</u>' : '') + '</em>'; };
    var vits = dead ? '' : (v.pulse === 0 ? vit(L('Pulse','דופק'), L('None','אין'), '') : v.pulse != null ? vit(L('Heart rate','דופק'), v.pulse, v.pulse > 120 ? L('High','גבוה') : '') : '')
      + (v.bpSys ? vit(L('Blood pressure','לחץ דם'), v.bpSys + '/' + (v.bpDia || '–'), v.bpSys < 90 ? L('Low','נמוך') : '') : '')
      + (v.spo2 ? vit('SpO₂', v.spo2 + '%', v.spo2 < 92 ? L('Low','נמוך') : '') : '')
      + (v.rr ? vit(L('Breathing','נשימה'), v.rr + '/' + L('min','דק׳'), v.rr > 24 ? L('High','גבוה') : '') : '');
    var tags = '';
    if (c.formLevel === 'quick') tags += '<span class="bd-tag">' + ico('zap', 20) + L('Quick triage','מיון מהיר') + '</span>';
    if (v.avpu && AVPU[v.avpu] && !dead) tags += '<span class="bd-tag">' + ico('brain', 20) + L(AVPU[v.avpu][0], AVPU[v.avpu][1]) + '</span>';
    if (tq != null) tags += '<span class="bd-tag' + (tq >= 60 ? ' bad' : ' warn') + '">' + ico('timer', 20) + L('Tourniquet ' + tq + ' min','חוסם עורקים ' + tq + ' דק׳') + '</span>';
    if (veh) tags += '<span class="bd-tag ok">' + ico('ambulance', 20) + (veh.status === 'athospital' ? L('At hospital','בבית חולים') : L('On ambulance','באמבולנס')) + '</span>';
    else if (!dead) tags += '<span class="bd-tag">' + ico('map-pin', 20) + L('On scene','בזירה') + '</span>';
    if (serial(c)) tags += '<span class="bd-tag code">' + ico('qr-code', 20) + '<bdi>' + esc(serial(c)) + '</bdi></span>';
    h += '<button class="bd-card t-' + (c.triageColor || 'none') + '" onclick="editCasualtyById(\'' + esc(c._docId) + '\')">'
      + '<span class="bd-top">' + chip(c.triageColor, true) + (age != null ? '<span class="bd-age">' + ico('clock', 20) + L(age + ' min',age + ' דק׳') + '</span>' : '') + '</span>'
      + '<b class="bd-name">' + (w.casBadge ? w.casBadge(c, true) + ' ' : '') + esc(name[0]) + (w.casTag ? w.casTag(c) : '') + ((w.casDesc && w.casDesc(c)) ? '<small>' + esc(w.casDesc(c)) + '</small>' : '') + '</b>'
      + (vits ? '<span class="bd-vits">' + vits + '</span>' : '')
      + '<span class="bd-inj">' + (inj || L('No injuries marked','לא סומנו פציעות')) + '</span>'
      + '<span class="bd-tags">' + tags + '</span>'
      + '<span class="bd-open">' + L('Open Form 101','פתיחת טופס 101') + ico(lang() === 'he' ? 'chevron-left' : 'chevron-right', 24) + '</span></button>';
  });
  if (!list.length) h += '<p class="empty">' + L('No casualty matches.','אין נפגע מתאים.') + '</p>';
  return h + '</div>';
}

// ── App bar ────────────────────────────────────────────────────
var MARK = 'shared/logo-shield.svg';
function renderBar(){
  var back = document.getElementById('app-back'), mark = document.getElementById('app-mark'),
      title = document.getElementById('app-title'), sub = document.getElementById('app-sub'), mb = document.getElementById('menu-btn');
  if (!back) return;
  var pill = document.getElementById('beta-pill'), tabs = document.getElementById('incident-tabs'), skip = document.querySelector('.skip-link');
  if (pill && !pill.querySelector('.bp-w')) pill.innerHTML = ico('triangle-alert', 20) + '<b class="bp-w">' + L('Beta','בטא') + '</b><span>· ' + L('demo','דמו') + '</span>';
  else if (pill){ pill.querySelector('.bp-w').textContent = L('Beta','בטא'); pill.querySelector('span').textContent = '· ' + L('demo','דמו'); }
  if (pill) pill.setAttribute('aria-label', L('Important notice: early beta demo, do not use on real patients','הודעה חשובה: דמו בטא מוקדמת, אין להשתמש בנפגעים אמיתיים'));
  if (tabs) tabs.setAttribute('aria-label', L('Sections','מקטעים'));
  if (skip) skip.textContent = L('Skip to content','דלג לתוכן');
  back.innerHTML = ico(lang()==='he' ? 'arrow-right' : 'arrow-left', 26) + '<span>' + L('Back','חזרה') + '</span>';
  back.setAttribute('aria-label', L('Back','חזרה'));
  mb.innerHTML = ico('menu', 26) + '<span>' + L('Menu','תפריט') + '</span>';
  mb.setAttribute('aria-label', L('Menu','תפריט'));
  document.body.classList.toggle('in-form', !!w._casualtyEditMode);
  if (w._casualtyEditMode){
    var name = (w._casualtyName || '').trim() || L('New casualty','נפגע חדש');
    back.hidden = false; mark.hidden = true; mb.hidden = true;
    title.textContent = String(T(name)).split(' — ')[0];
    sub.textContent = tgWord(w._casualtyTriageColor);
  } else {
    back.hidden = true; mark.hidden = false; mb.hidden = false;
    if (mark.getAttribute('src') !== MARK) mark.setAttribute('src', MARK);
    title.textContent = L('Shomer Ahi','שומר אחי');
    sub.textContent = '';
  }
  var base = L('Shomer Ahi — early beta demo (not for clinical use)','שומר אחי — דמו בטא מוקדמת (לא לשימוש קליני)');
  document.title = w._casualtyEditMode ? title.textContent + ' · ' + base : base;
}

// ── Page render ────────────────────────────────────────────────
// New markup is built off-screen, translated + polished, then DIFFED into the live DOM. The engine re-renders
// the form every second (timers) and on every tap; a diff keeps scroll position, focus, typed text and open
// sections exactly where the user left them.
function syncAttrs(x, y){
  var i, n, v;
  for (i = 0; i < y.attributes.length; i++){ n = y.attributes[i].name; v = y.attributes[i].value; if (x.getAttribute(n) !== v && !(n === 'open' && x.tagName === 'DETAILS')) x.setAttribute(n, v); }
  for (i = x.attributes.length - 1; i >= 0; i--){ n = x.attributes[i].name; if (!y.hasAttribute(n) && !(n === 'open' && x.tagName === 'DETAILS') && n !== 'data-enh') x.removeAttribute(n); }
}
function morph(a, b){
  var an = [].slice.call(a.childNodes), bn = [].slice.call(b.childNodes), m = Math.min(an.length, bn.length), i, x, y;
  for (i = 0; i < m; i++){
    x = an[i]; y = bn[i];
    if (x.nodeType !== y.nodeType || (x.nodeType === 1 && x.tagName !== y.tagName)){ if (x.parentNode === a) a.replaceChild(y.cloneNode(true), x); continue; }
    if (x.nodeType === 3 || x.nodeType === 8){ if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue; continue; }
    if (x.nodeType === 1){
      syncAttrs(x, y);
      var focused = x === document.activeElement;
      if (x.tagName === 'INPUT' || x.tagName === 'SELECT'){ if (!focused && x.value !== y.value && y.hasAttribute('value')) x.value = y.getAttribute('value'); continue; }
      if (x.tagName === 'TEXTAREA'){ if (!focused && x.value !== y.value) x.value = y.value; continue; }
      if (x.tagName === 'svg' || x.namespaceURI === 'http://www.w3.org/2000/svg'){ if (x.outerHTML !== y.outerHTML && x.parentNode === a) a.replaceChild(y.cloneNode(true), x); continue; }
      morph(x, y);
    }
  }
  while (a.childNodes.length > bn.length) a.removeChild(a.lastChild);
  for (i = m; i < bn.length; i++) a.appendChild(bn[i].cloneNode(true));
}
// Re-entrancy guard: replacing a focused input fires blur handlers that ask for another render while this one is mid-diff.
var _rendering = false, _again = false;
w.renderIncidentPage = function(){
  normAll();
  if (_rendering){ _again = true; return; }
  _rendering = true;
  try { renderNow(); } finally { _rendering = false; }
  if (_again){ _again = false; w.renderIncidentPage(); }
};
function renderNow(){
  var c = document.getElementById('incident-content');
  if (!c || !w._incidentData) return;
  // The engine board's own "Evac" mode is replaced by the Evacuate tab.
  if (!w._casualtyEditMode && w._incidentTab === 'casualties' && w._casView === 'board' && w._mciMode === 'evac'){ w._mciMode = 'manage'; w._incidentTab = 'evac'; }
  var tabNow = activeTab(), html, view;
  if (w._casualtyEditMode){ html = w.renderIncidentCasualties(); view = 'form'; }
  else if (tabNow === 'casualties' && w._casView === 'board'){ html = renderBoard(); view = 'board'; }
  else if (tabNow === 'casualties'){ html = renderPatients(); view = 'casualties'; }
  else if (tabNow === 'evac'){ html = w.Evac ? w.Evac.render() : ''; view = 'evac'; }
  else if (tabNow === 'bracelets'){ html = w.Bracelet.renderTab(); view = 'bracelets'; }
  else { html = renderOverview(); view = 'status'; }
  var tmp = document.createElement('div'); tmp.innerHTML = html;
  if (view === 'form' && w.FormUI) w.FormUI.enhance(tmp);
  else if (view === 'mci' && w.BoardUI) w.BoardUI.enhance(tmp);
  if (w.ShowcaseI18n) w.ShowcaseI18n.apply(tmp);
  if (w.Polish) w.Polish.apply(tmp);
  if (c.dataset.view === view && c.firstChild) morph(c, tmp);
  else { c.textContent = ''; while (tmp.firstChild) c.appendChild(tmp.firstChild); c.scrollTop = 0; if (w.FormUI) w.FormUI.cur = 'field'; }
  if (c.dataset.view && c.dataset.view !== view){ c.style.pointerEvents = 'none'; setTimeout(function(){ c.style.pointerEvents = ''; }, 380); }
  if (_place && view !== 'form'){ if (_place.tab === w._incidentTab && _place.cas === w._casView) c.scrollTop = _place.y; _place = null; }
  c.dataset.view = view;
  if (view === 'form' && w.FormUI) w.FormUI.bind(c);
  renderTabbar(); renderBar();
}

// ── Demo controller ────────────────────────────────────────────
w._casView = 'list'; w._plFilter = null;
function closeOverlays(keepQuick){
  // a note being typed survives a language switch: the sheet is reopened in the new language with the same text
  var note = document.getElementById('tl-note'), draft = (keepQuick === true && note) ? { t: note.value, i: w.Field ? w.Field._tlEditIdx : null } : null;
  ['f-kp','f-sheet','fs-sheet','menu-sheet','undo-toast','ev-assign-sheet','ev-rush-sheet','ev-pre-sheet','ev-arrive-sheet','f-tap','qt','medevac-overlay','tl-sheet','tl-row-sheet','tl-time','bz-sheet','dose-sheet','rec-alert'].forEach(function(id){ if (id === 'qt' && keepQuick === true) return; var e = document.getElementById(id); if (e) e.remove(); });
  var bm = document.querySelector('#app > #body-tap-overlay'); if (bm) bm.remove();
  if (keepQuick !== true){
    ['help-sheet','pwa-sheet','ev-busy-sheet','tour-rec'].forEach(function(id){ var e = document.getElementById(id); if (e) e.remove(); });
    if (w.Bracelet && document.querySelector('.bo')) w.Bracelet.close(true);   // wristband view, card and scanner (stops the camera)
  }
  if (keepQuick !== true) w._selectedRegion = null;
  if (w.Field){ w.Field._k = null; w.Field._tt = null; }
  if (draft && w.Field && w.Field.tlNote) setTimeout(function(){ w.Field.tlNote(draft.i); var ta = document.getElementById('tl-note'); if (ta) ta.value = draft.t; }, 0);
}
var Demo = w.Demo = {
  closeOverlays: closeOverlays,
  tab: function(id){
    closeOverlays();
    if (w._casualtyEditMode){ w._incidentTabBeforeEdit = null; return w.closeCasualtyForm().then(function(){ return Demo.tab(id); }); }
    w._incidentTab = id; if (id === 'casualties') w._plFilter = null; w.renderIncidentPage();
    var c = document.getElementById('incident-content'); c.scrollTop = 0;
    return Promise.resolve();
  },
  bdFilter: function(c){ w._bdFilter = (c && w._bdFilter !== c) ? c : null; w.renderIncidentPage(); },
  bdRows: function(on){ w._bdRows = !!on; w.renderIncidentPage(); },
  bdSearch: function(v, clear){
    var tg = w.Bracelet && w.Bracelet.parseTag && w.Bracelet.parseTag(v || '');   // a scanned or typed tag opens that casualty straight away
    if (tg && !clear){ w._bdQuery = ''; return w.Bracelet.openTag(tg); }
    w._bdQuery = v || ''; if (clear){ var i = document.querySelector('.bd-search input'); if (i) i.value = ''; } w.renderIncidentPage(); },
  casView: function(v){ w._casView = v; if (v === 'board') w._mciMode = 'manage'; w.renderIncidentPage(); var c = document.getElementById('incident-content'); c.scrollTop = 0; },
  filter: function(color){ w._plFilter = color; w._casView = 'list'; w._incidentTab = 'casualties'; w.renderIncidentPage(); document.getElementById('incident-content').scrollTop = 0; },
  newFull: function(){ closeOverlays(); w._incidentTabBeforeEdit = w._incidentTab; w.newCasualty(); },
  openCasualty: function(id){ closeOverlays(); if (w.Tour && w.Tour.active && w.Tour.active()) w.Tour.stop(true); w._incidentTab = 'casualties'; w.editCasualtyById(id); },
  back: function(){ closeOverlays(); if (w._casualtyEditMode) w.closeCasualtyForm(); },
  go: function(where){
    closeOverlays();
    var run = function(){
      if (where === 'casualty'){ w._incidentTab = 'casualties'; w.editCasualtyById('demo_c1'); }
      else if (where === 'mci'){ w._incidentTab = 'casualties'; w._casView = 'board'; w._mciMode = 'manage'; w.renderIncidentPage(); }
      else if (where === 'scan'){ w._incidentTab = 'bracelets'; w.renderIncidentPage(); w.Bracelet.scan(); }
      var c = document.getElementById('incident-content'); if (c && where !== 'casualty') c.scrollTop = 0;
    };
    if (w._casualtyEditMode && where !== 'casualty') return w.closeCasualtyForm().then(run);
    if (w._casualtyEditMode && where === 'casualty'){ var c0 = document.getElementById('incident-content'); if (c0) c0.scrollTop = 0; return Promise.resolve(); }
    run(); return Promise.resolve();
  },
  // ── Delete a casualty: confirm first ("Keep" is the big default), then Undo restores it everywhere. Numbers are never reused. ──
  deleteAsk: function(id){
    var c = (w._incidentCasualties || []).filter(function(x){ return x._docId === id; })[0]; if (!c) return;
    var app = document.getElementById('app'); var old = document.getElementById('del-sheet'); if (old) old.remove();
    var lab = w.casLabel ? w.casLabel(c) : esc(T(c.name)), veh = (w._mciVehicles || []).filter(function(v){ return (v.casualties || []).indexOf(id) >= 0; })[0];
    var s = document.createElement('div'); s.id = 'del-sheet'; s.className = 'sheet-wrap no-polish';
    s.innerHTML = '<div class="sheet-dim" onclick="Demo.deleteClose()"></div><div class="sheet del-sheet" role="alertdialog" aria-modal="true" aria-labelledby="del-t"><div class="sheet-grab"></div>'
      + '<h3 id="del-t">' + ico('trash-2', 28) + L('Delete this casualty?','למחוק את הנפגע?') + '</h3>'
      + '<div class="del-who">' + (w.casBadge ? w.casBadge(c, true) : '') + '<b>' + esc(lab) + '</b>' + chip(c.triageColor) + (c.tagId ? '<span class="del-tag">' + ico('tag', 22) + '<bdi dir="ltr">' + esc(c.tagId) + '</bdi></span>' : '') + '</div>'
      + '<p class="sheet-p">' + L('The whole record is removed: treatments, timeline and tag link.','כל התיק יימחק: טיפולים, ציר זמן וקישור לתג.') + (veh ? ' ' + L('It also comes off ','הוא גם יורד מ') + esc(T(veh.name || veh.type || '')) + '.' : '') + ' ' + L('You can undo right after.','אפשר לבטל מיד אחרי.') + '</p>'
      + '<div class="del-b"><button class="xbtn xbtn-primary" data-autofocus onclick="Demo.deleteClose()">' + ico('x', 24) + L('Keep','להשאיר') + '</button>'
      + '<button class="xbtn del-go" onclick="Demo.deleteDo(\'' + esc(id) + '\')">' + ico('trash-2', 24) + L('Delete','מחיקה') + '</button></div></div>';
    app.appendChild(s);
    var k = s.querySelector('[data-autofocus]'); if (k) setTimeout(function(){ k.focus({ preventScroll:true }); }, 30);
  },
  // ── Casualty history: every casualty on this scene, including deleted ones (they can be restored) ──
  history: function(){
    var old = document.getElementById('hist-sheet'); if (old) old.remove();
    var live = (w._incidentCasualties || []).map(function(c){ return { c:c, n:w.casNum ? w.casNum(c) : 0, del:null }; });
    var gone = (w._casArchive || []).map(function(a){ return { c:a.rec, n:a.num, del:a }; });
    var all = live.concat(gone).sort(function(a, b){ return (a.n || 0) - (b.n || 0); });
    var hhmm = function(t){ var d = new Date(t); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); };
    var s = document.createElement('div'); s.id = 'hist-sheet'; s.className = 'sheet-wrap no-polish';
    s.innerHTML = '<div class="sheet-dim" onclick="Demo.historyClose()"></div><div class="sheet hist" role="dialog" aria-modal="true" aria-labelledby="hist-t"><div class="sheet-grab"></div>'
      + '<div class="hist-top"><h3 id="hist-t">' + ico('layers', 26) + L('Casualty history','היסטוריית נפגעים') + '</h3><button class="xbtn" onclick="Demo.historyClose()">' + ico('x', 22) + L('Close','סגירה') + '</button></div>'
      + '<p class="sheet-p">' + L(live.length + ' on scene · ' + gone.length + ' deleted', live.length + ' באירוע · ' + gone.length + ' נמחקו') + '</p><div class="hist-l">'
      + all.map(function(r){
          var lab = L('Casualty ','נפגע ') + (r.n || '?');
          var st = r.del ? '<span class="hist-st del">' + ico('trash-2', 22) + L('Deleted ','נמחק ') + hhmm(r.del.at) + '</span>'
                         : (r.c.evacStatus === 'evacuated' ? '<span class="hist-st">' + ico('hospital', 22) + L('Evacuated','פונה') + '</span>' : '<span class="hist-st">' + ico('map-pin', 22) + L('On scene','בזירה') + '</span>');
          var act = r.del ? '<button class="xbtn" onclick="Demo.restore(' + (w._casArchive || []).indexOf(r.del) + ')">' + ico('undo-2', 22) + L('Restore','שחזור') + '</button>'
                          : '<button class="xbtn" onclick="Demo.historyClose();Demo.openCasualty(\'' + esc(r.c._docId) + '\')">' + ico('file-text', 22) + L('Open','פתיחה') + '</button>';
          return '<div class="hist-r' + (r.del ? ' is-del' : '') + '">' + (w.casBadge ? w.casBadge(r.n) : '') + '<span class="hist-m"><b>' + lab + '</b>' + chip(r.c.triageColor) + st + '</span>' + act + '</div>';
        }).join('')
      + '</div></div>';
    document.getElementById('app').appendChild(s);
  },
  historyClose: function(){ var s = document.getElementById('hist-sheet'); if (s) s.remove(); },
  restore: function(i){
    var a = (w._casArchive || [])[i]; if (!a) return;
    var now = w._readOfflineCasualties(); now.push(a.rec); w._writeOfflineCasualties(now);
    w._casArchive.splice(i, 1); w._refreshMergedCasualties(); w.renderIncidentPage();
    toast(L('Restored: Casualty ','שוחזר: נפגע ') + (a.num || '')); Demo.history();
  },
  // long press on a casualty row in the Patients list / board: Open or Delete
  casActions: function(id){
    var c = (w._incidentCasualties || []).filter(function(x){ return x._docId === id; })[0]; if (!c) return;
    var old = document.getElementById('cas-act'); if (old) old.remove();
    var s = document.createElement('div'); s.id = 'cas-act'; s.className = 'sheet-wrap no-polish';
    s.innerHTML = '<div class="sheet-dim" onclick="Demo.casActClose()"></div><div class="sheet cas-act" role="dialog" aria-modal="true" aria-labelledby="ca-t"><div class="sheet-grab"></div>'
      + '<div class="del-who" id="ca-t">' + (w.casBadge ? w.casBadge(c, true) : '') + '<b>' + esc(w.casLabel ? w.casLabel(c) : '') + '</b>' + chip(c.triageColor) + '</div>'
      + '<div class="ca-b"><button class="xbtn xbtn-primary" onclick="Demo.casActClose();Demo.openCasualty(\'' + esc(id) + '\')">' + ico('file-text', 24) + L('Open Form 101','פתיחת טופס 101') + '</button>'
      + '<button class="xbtn del-go" onclick="Demo.casActClose();Demo.deleteAsk(\'' + esc(id) + '\')">' + ico('trash-2', 24) + L('Delete…','מחיקה…') + '</button>'
      + '<button class="xbtn" onclick="Demo.casActClose()">' + ico('x', 24) + L('Cancel','ביטול') + '</button></div></div>';
    document.getElementById('app').appendChild(s);
  },
  casActClose: function(){ var s = document.getElementById('cas-act'); if (s) s.remove(); },
  deleteClose: function(){ var s = document.getElementById('del-sheet'); if (s) s.remove(); },
  deleteDo: function(id){
    Demo.deleteClose();
    var list = w._readOfflineCasualties(), idx = -1, rec = null;
    list.forEach(function(x, i){ if (x._docId === id){ idx = i; rec = x; } });
    if (!rec) return;
    var cas = (w._incidentCasualties || []).filter(function(x){ return x._docId === id; })[0], lab = w.casLabel ? w.casLabel(cas || rec) : '';
    var seats = (w._mciVehicles || []).map(function(v){ var p = (v.casualties || []).indexOf(id); return p >= 0 ? [v, p] : null; }).filter(Boolean);
    var arch = { rec:JSON.parse(JSON.stringify(rec)), at:Date.now(), num:w.casNum ? w.casNum(cas || rec) : null };
    var finish = function(){
      w._casArchive = w._casArchive || []; w._casArchive.push(arch);
      w._writeOfflineCasualties(list.filter(function(x){ return x._docId !== id; }));
      seats.forEach(function(sp){ sp[0].casualties.splice(sp[0].casualties.indexOf(id), 1); });
      if (w._mciExpandedCard === id) w._mciExpandedCard = null;
      w._refreshMergedCasualties(); w.renderIncidentPage();
      var old = document.getElementById('undo-toast'); if (old) old.remove();
      var el = document.createElement('div'); el.id = 'undo-toast'; el.className = 'undo-toast no-polish'; el.setAttribute('role', 'status');
      el.innerHTML = '<span>' + esc(L('Deleted: ','נמחק: ') + lab) + '</span><button>' + ico('undo-2', 24) + L('Undo','בטל') + '</button>';
      el.querySelector('button').onclick = function(){
        var now = w._readOfflineCasualties(); now.splice(Math.min(idx, now.length), 0, rec); w._writeOfflineCasualties(now);
        w._casArchive = (w._casArchive || []).filter(function(a){ return a !== arch; });
        seats.forEach(function(sp){ if (sp[0].casualties.indexOf(id) < 0) sp[0].casualties.splice(Math.min(sp[1], sp[0].casualties.length), 0, id); });
        w._refreshMergedCasualties(); w.renderIncidentPage(); el.remove(); toast(L('Restored: ','שוחזר: ') + lab);
      };
      document.getElementById('app').appendChild(el); setTimeout(function(){ el.remove(); }, 8000);
    };
    // if this casualty's form is open, close it first, then delete
    if (w._casualtyEditMode && w._casualtyEditId === id){ w._incidentTab = 'casualties'; return Promise.resolve(w.closeCasualtyForm()).then(finish); }
    finish();
  },
  menu: function(){
    var app = document.getElementById('app'); if (document.getElementById('menu-sheet')) return;
    var s = document.createElement('div'); s.id = 'menu-sheet'; s.className = 'sheet-wrap no-polish';
    var row = function(icon, title, sub, fn){ return '<button class="sheet-row" onclick="' + fn + '"><span class="gi">' + ico(icon, 28) + '</span><span><b>' + title + '</b><small>' + sub + '</small></span></button>'; };
    s.innerHTML = '<div class="sheet-dim" onclick="Demo.closeMenu()"></div><div class="sheet" role="dialog" aria-label="' + L('Menu','תפריט') + '"><div class="sheet-grab"></div><div class="menu-head"><h3>' + L('Menu','תפריט') + '</h3><button class="xbtn menu-x" onclick="Demo.closeMenu()">' + ico('x', 24) + L('Close','סגירה') + '</button></div>'
      + '<div class="lang-pick"><button class="' + (lang() === 'en' ? 'on' : '') + '" onclick="ShowcaseI18n.setLang(\'en\');Demo.closeMenu()">' + ico('languages', 22) + 'English</button><button class="' + (lang() === 'he' ? 'on' : '') + '" onclick="ShowcaseI18n.setLang(\'he\');Demo.closeMenu()">' + ico('languages', 22) + 'עברית</button></div>'
      + row('circle-help', L('How to use','איך משתמשים'), L('Every screen explained, step by step','כל מסך מוסבר, שלב אחר שלב'), 'Demo.closeMenu();Help.open()')
      + row('layers', L('Casualty history','היסטוריית נפגעים'), L('Everyone on this scene, deleted ones too','כל הנפגעים באירוע, גם שנמחקו'), 'Demo.closeMenu();Demo.history()')
      + row('play', L('Guided tour','סיור מודרך'), L('About 60 seconds, 11 steps','כ-60 שניות, 11 שלבים'), 'Demo.closeMenu();Tour.start()')
      + row('triangle-alert', L('Important notice','הודעה חשובה'), L('Early beta. Do not use on real patients.','בטא מוקדמת. אין להשתמש בנפגעים אמיתיים.'), 'Demo.closeMenu();Disclaimer.open()')
      + row('rotate-ccw', L('Reset demo','איפוס הדמו'), L('Restore the original six casualties','החזרת ששת הנפגעים המקוריים'), 'Demo.closeMenu();Demo.reset()')
      + '</div>';
    app.appendChild(s);
  },
  closeMenu: function(){ var s = document.getElementById('menu-sheet'); if (s) s.remove(); },
  reset: function(){
    if (w.Tour && w.Tour.active && w.Tour.active()) w.Tour.stop(true);
    closeOverlays(); resetUndo(); seed(); if (w.Evac) w.Evac.reset();
    if (w.resetCasNum) w.resetCasNum();                                     // numbering starts again after the six demo casualties
    if (w._clearRedoseTimers) try { w._clearRedoseTimers(); } catch (e) {}   // no repeat-dose alert for a drug that is gone
    w._bdFilter = null; w._bdRows = undefined; w._bdQuery = '';
    w._incidentTab = 'status'; w._casView = 'list'; w._plFilter = null; w.renderIncidentPage(); toast(L('Demo reset','הדמו אופס')); },
  boot: function(){
    seed(); w._incidentTab = 'status';
    renderSide(); w.ShowcaseI18n.setLang(w.ShowcaseI18n.lang);
    var q = new URLSearchParams(location.search), t = q.get('tab');
    if (t === 'mci'){ w._incidentTab = 'casualties'; w._casView = 'board'; w.renderIncidentPage(); }
    else if (t && TABS.some(function(x){ return x.id === t; })){ w._incidentTab = t; w.renderIncidentPage(); }
    w.Bracelet.route();
    if (q.get('tour') === '1') setTimeout(function(){ if (w.Tour) w.Tour.start(); }, 400);
  }
};

function seed(){
  var D = w.SHOWCASE_DEMO;
  w._incidentAlertId = 'demo_alert';
  w._incidentData = D.incident;
  _store = D.casualties.map(function(c){
    var o = Object.assign({}, JSON.parse(JSON.stringify(c)), { timestamp:c.timestamp });
    o.bracelet = { serial: w.Bracelet.serialFor(c) };
    return o;
  });
  w._cloudCasualties = [];
  w._mciInited = true; w._mciVehicles.length = 0; w._mciExpandedCard = null;
  if (w.Evac) w.Evac.seed(); else [['אמבולנס',4,2],['אמבולנס',4,2]].forEach(function(v, i){ w._mciVehicles.push({ id:'v_demo' + i, type:v[0], seats:v[1], litter:v[2], status:'enroute', destination:'', casualties:[], etaMinutes:null, etaStartAt:null, _alertedOneMin:false }); });
  w._refreshMergedCasualties();
}
Demo.seed = seed;

// ── Desktop side panel ─────────────────────────────────────────
function renderSide(){
  var f = document.getElementById('facts'), q = document.getElementById('phone-qr');
  if (f){
    var items = [
      ['list-checks', L('Follows the IDF 2026 X-CARE protocol step by step: bleeding first, then circulation, airway, breathing, evacuation','עוקב אחר פרוטוקול X-CARE של צה״ל (2026) שלב אחר שלב: קודם דימום, אחר כך מחזור דם, נתיב אוויר, נשימה, פינוי')],
      ['zap', L('Mass casualties: a colour for each casualty in seconds, then the full Form 101 when there is time','אר״ן: צבע לכל נפגע תוך שניות, ואת טופס 101 המלא כשיש זמן')],
      ['ambulance', L('Evacuation board with live ambulance ETAs and a pre-alert for the hospital','לוח פינוי עם זמני הגעה חיים של אמבולנסים והתרעה מוקדמת לבית החולים')],
      ['qr-code', L('The record travels on the casualty: a QR wristband any phone camera can read, offline','התיק נוסע עם הנפגע: צמיד QR שכל מצלמת טלפון קוראת, גם בלי רשת')],
      ['smartphone', L('Built for gloves and stress: huge targets, words on every icon, works as an installed phone app','בנוי לכפפות וללחץ: יעדי מגע ענקיים, מילה ליד כל סמל, עובד כאפליקציה מותקנת')]
    ];
    f.innerHTML = items.map(function(i){ return '<li>' + ico(i[0], 22) + '<span>' + i[1] + '</span></li>'; }).join('');
  }
  if (q && w.qrcode){
    // the wow on a laptop: scan Casualty 1's wristband with your own phone camera
    var c0 = (w._incidentCasualties || [])[0], url = c0 && w.Bracelet ? w.Bracelet.linkFor(c0) : 'https://ada988.github.io/shomer-ahi-showcase/';
    var qq; try { qq = w.qrcode(0, 'L'); qq.addData(url); qq.make(); } catch (e) { return; }
    var n = qq.getModuleCount(), d = '';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qq.isDark(r, c)) d += 'M' + (c + 3) + ' ' + (r + 3) + 'h1v1h-1z';
    q.innerHTML = '<svg class="qr" viewBox="0 0 ' + (n + 6) + ' ' + (n + 6) + '" shape-rendering="crispEdges" role="img" aria-label="' + L('Wristband QR of Casualty 1','QR של צמיד נפגע 1') + '"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '"/></svg>'
      + '<p><b>' + L('Point your phone camera here','כוונו את מצלמת הטלפון לכאן') + '</b>' + L('Casualty 1’s wristband. The record opens on your phone: no app, no login, no network.','הצמיד של נפגע 1. התיק נפתח בטלפון: בלי אפליקציה, בלי התחברות, בלי רשת.') + '</p>';
  }
}
Demo.renderSide = renderSide;
document.addEventListener('DOMContentLoaded', function(){
  var s = w.ShowcaseI18n; if (!s) return;
  var orig = s.setLang; s.setLang = function(l){ orig(l); renderSide(); };
});

// (top-bar collapse lives in appbar.js)

// ── Keep engine overlays inside the device frame ───────────────
new MutationObserver(function(list){
  var app = document.getElementById('app'); if (!app) return;
  list.forEach(function(m){ m.addedNodes.forEach(function(n){
    if (n.nodeType === 1 && n.parentNode === document.body && !n.matches('.stage,script,link,style,.skip-link')){ app.appendChild(n); if (n.id === 'radio-overlay' && w.Disclaimer){ var d = document.createElement('div'); d.className = 'overlay-warn'; d.textContent = w.Disclaimer.short(); n.appendChild(d); } }
  }); });
}).observe(document.body, { childList:true });

document.addEventListener('input', function(e){
  if (e.target && e.target.id === 'cas-name'){ var t = document.getElementById('app-title'); if (t) t.textContent = e.target.value.trim() || L('New casualty','נפגע חדש'); var em = document.querySelector('.f-id-t em'); if (em) em.textContent = e.target.value.trim() || L('No name yet','עדיין ללא שם'); }
});

// ── Modal behaviour for every overlay/sheet: focus moves in, Tab stays inside (background is inert), Esc closes, focus returns ──
var OVERLAY = '#help-sheet,#f-kp,#f-sheet,#fs-sheet,#tl-sheet,#tl-row-sheet,#tl-time,#dose-sheet,#bz-sheet,#menu-sheet,#ev-assign-sheet,#ev-rush-sheet,#ev-pre-sheet,#ev-arrive-sheet,#ev-busy-sheet,#pwa-sheet,#f-tap,#radio-overlay,#qt,.bo,.dn,#dz-sf,#dz-rb,#del-sheet,#cas-act,#hist-sheet';
var _ret = null;
function topOverlay(){ var l = document.querySelectorAll(OVERLAY); return l.length ? l[l.length - 1] : null; }
// a sheet removed and re-added in the same moment (re-rendered after a tap) is the same sheet: remember its identity and scroll
function sheetKey(n){ return n && n.nodeType === 1 ? (n.id || '') + '|' + (n.className || '') : ''; }
function scrollerOf(n){ var c = n.querySelector('.sheet,.f-proc,.f-gcs,[class*="-body"],.bo-body') || n; return c; }
function syncModal(list){
  var top = topOverlay(), app = document.getElementById('app'); if (!app) return;
  var gone = {};
  (list || []).forEach(function(m){ [].forEach.call(m.removedNodes || [], function(n){ if (n.nodeType === 1){ var sc = scrollerOf(n); gone[sheetKey(n)] = { y:sc.scrollTop || 0, cls:sc.className }; if (n.id) gone['#' + n.id] = gone[sheetKey(n)]; } }); });
  if (top && !top.__fx){ var was = gone[sheetKey(top)] || (top.id && gone['#' + top.id]);
    if (was){ top.classList.add('instant'); top.__swap = true; var sc2 = scrollerOf(top); if (sc2 && sc2.className === was.cls) sc2.scrollTop = was.y; } }
  var bg = [].slice.call(app.children).filter(function(c){ return !c.matches(OVERLAY + ',.tr-dim,.tr-card,#tour-rec,#rec-alert,.undo-toast,.tst,.skip-link'); });   // an alert can always be tapped or closed
  bg.forEach(function(c){ if (top) c.setAttribute('inert', ''); else c.removeAttribute('inert'); });
  if (top){
    if (!_ret) _ret = document.activeElement;
    var sw = top.id === 'f-sheet' && w._fsSwap && Date.now() - w._fsSwap.t < 60 ? w._fsSwap : null;
    if (sw && !top.__fx){   // the same form sheet rebuilt after a tap: no open animation, no tap guard, same scroll position
      top.classList.add('instant'); var si = top.querySelector('.sheet'); if (si && si.className === sw.cls) si.scrollTop = sw.y; w._fsSwap = null;
    }
    if (!top.__fx){ if (!sw && !top.__swap) armTap(); top.__fx = true; top.setAttribute('role', top.getAttribute('role') || 'dialog'); top.setAttribute('aria-modal', 'true'); if (!top.getAttribute('aria-label')) top.setAttribute('aria-label', (top.querySelector('h3,.bo-title,h2') || {}).textContent || 'Dialog'); var f = top.querySelector('[data-autofocus]'); if (!f){ f = top.querySelector('[role=dialog]') || top; if (!f.hasAttribute('tabindex')) f.setAttribute('tabindex', '-1'); } setTimeout(function(){ try { f.focus({ preventScroll:true, focusVisible:false }); } catch(e){ f.focus(); } }, 20); }
  } else {
    // return focus only if it was lost with the overlay (not if the user already moved on, e.g. to a row on the desktop page)
    var act = document.activeElement, lost = !act || act === document.body || (app.contains(act) && act.offsetParent === null);
    if (_ret && lost && _ret.isConnected && _ret.offsetParent !== null && app.contains(_ret)){ try { _ret.focus({ preventScroll:true }); } catch(e){} }
    else if (lost && _ret && !document.querySelector('.tr-card')){ var c = document.getElementById('incident-content'); if (c){ if (!c.hasAttribute('tabindex')) c.setAttribute('tabindex', '-1'); try { c.focus({ preventScroll:true, focusVisible:false }); } catch(e){ c.focus(); } } }
    _ret = null;
  }
}
// ── Double-tap guard: when a tap opens a sheet or a new step, a second tap at the same spot within 450 ms is ignored,
// so a confirm button or the next question that appears under the finger is never pressed by accident. Keyboard clicks are not affected.
var _tap = { x:-1e4, y:-1e4, t:0, armed:0 };
function armTap(){ _tap.armed = Date.now(); }
w.armTap = armTap;
document.addEventListener('click', function(e){
  if (!e.isTrusted || e.detail === 0) return;
  var app = document.getElementById('app'); if (!app || !app.contains(e.target)) return;
  var now = Date.now();
  if (_tap.armed >= _tap.t && now - _tap.armed < 450 && Math.abs(e.clientX - _tap.x) < 72 && Math.abs(e.clientY - _tap.y) < 72){ e.stopPropagation(); e.preventDefault(); return; }
  _tap.x = e.clientX; _tap.y = e.clientY; _tap.t = now;
}, true);
new MutationObserver(syncModal).observe(document.getElementById('app'), { childList:true });
document.addEventListener('keydown', function(e){
  if (e.key !== 'Escape') return;
  if (document.querySelector('.tr-card')) return;             // tour handles its own Esc
  var bm = document.getElementById('body-tap-overlay');       // body-map menu lives inside the page: close it through its own state
  if (bm && !topOverlay()){ w._selectedRegion = null; w._bodyMenuStep = 0; w.MedHost.renderIncidentPage(); return; }
  var t = topOverlay(); if (!t) return;
  if (t.classList.contains('dn')){ if (t.getAttribute('role') !== 'alertdialog' && w.Disclaimer) w.Disclaimer.close(); return; }   // the first-visit gate is dismissed only with its button; the re-opened notice closes with Esc
  if (t.id === 'qt' && w.Quick){ w.Quick.close(); return; }
  if (t.id === 'f-tap' && w.Field){ w.Field.tapClose(); return; }
  if (t.id === 'radio-overlay' && w.closeRadioReadout){ w.closeRadioReadout(); return; }
  if (t.id === 'bz-sheet' && w.BodyZoom){ w.BodyZoom.close(); return; }        // body zoom first, then (next Esc) its menu
  if (t.id === 'dz-sf' && w.Field && w.Field.doseSafetyClose){ w.Field.doseSafetyClose(); return; }
  if (t.id === 'dz-rb' && w.Field && w.Field.doseRbClose){ w.Field.doseRbClose(); return; }
  if (t.id === 'dose-sheet' && w.Field && w.Field.doseClose){ if (document.getElementById('dz-rb') && w.Field.doseRbClose) w.Field.doseRbClose(); else w.Field.doseClose(); return; }
  if (t.classList.contains('bo') && w.Bracelet){ w.Bracelet.close(); return; }
  var d = t.querySelector('.sheet-dim'), x = t.querySelector('.bo-x');
  if (d) d.click(); else if (x) x.click(); else t.remove();
});

// Tab wraps inside the open overlay (inert background would otherwise hand focus to the browser chrome)
document.addEventListener('keydown', function(e){
  if (e.key !== 'Tab' || document.querySelector('.tr-card')) return;   // the tour keeps focus in its own card
  var t = topOverlay(); if (!t) return;
  var f = [].slice.call(t.querySelectorAll('button,a[href],input,select,textarea,summary,[tabindex]:not([tabindex="-1"])')).filter(function(x){ return !x.disabled && x.offsetParent !== null; });
  if (!f.length) return;
  var first = f[0], last = f[f.length - 1], act = document.activeElement;
  if (!t.contains(act)){ e.preventDefault(); first.focus(); }
  else if (e.shiftKey && act === first){ e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && act === last){ e.preventDefault(); first.focus(); }
});

// ── Keyboard: make clickable non-buttons operable ──────────────
document.addEventListener('keydown', function(e){
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role=button][onclick]:not(button):not([onkeydown])')){ e.preventDefault(); e.target.click(); }
});

// ── Phone BACK button / browser back: closes the top layer, then the form, then returns Home — it never throws the user out mid-casualty ──
// One guard history entry is added after the first touch (browsers ignore entries made without a user gesture); every BACK that was used
// to close something puts it back. On Home with nothing open the guard is left spent, so the next BACK leaves the page as usual.
var _guard = false;
function backStep(){
  if (document.querySelector('.tr-card')){ w.Tour.stop(); return true; }
  if (document.querySelector('.dn[role=alertdialog]')) return true;               // the first-visit notice can only be acknowledged
  if (document.getElementById('body-tap-overlay') || topOverlay()){ document.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true })); return true; }
  if (w._casualtyEditMode){ Demo.back(); return true; }
  if (w.Evac && w.Evac.state.view && w._incidentTab === 'evac'){ w.Evac.close(); return true; }
  if (w._incidentTab === 'casualties' && w._casView === 'board'){ Demo.casView('list'); return true; }
  if (w._incidentTab !== 'status'){ Demo.tab('status'); return true; }
  return false;
}
function armGuard(){ if (_guard) return; _guard = true; try { history.pushState({ sc:1 }, ''); } catch(e){} }
document.addEventListener('pointerdown', armGuard, true);
document.addEventListener('keydown', armGuard, true);
w.addEventListener('popstate', function(){
  if (!_guard) return;
  if (backStep()){ try { history.pushState({ sc:1 }, ''); } catch(e){} } else _guard = false;
});
})();

// ── Long press (about 0.55 s) on a casualty row in the Patients list or board opens Open / Delete. Moving the finger cancels it, so scrolling still works. ──
(function(){
  var t = null, sx = 0, sy = 0, el = null, fired = false, SEL = '#incident-content .pl-card, #incident-content .bd-row, #incident-content .bd-card';
  function idOf(n){ var m = /editCasualtyById\('([^']+)'\)/.exec(n.getAttribute('onclick') || ''); return m ? m[1] : null; }
  function stop(){ clearTimeout(t); t = null; if (el) el.classList.remove('lp-hold'); el = null; }
  document.addEventListener('pointerdown', function(e){
    var b = e.target.closest && e.target.closest(SEL); if (!b || !idOf(b)) return;
    fired = false; el = b; sx = e.clientX; sy = e.clientY; b.classList.add('lp-hold');
    t = setTimeout(function(){ var id = idOf(b); fired = true; stop(); if (navigator.vibrate) navigator.vibrate(30); window.Demo.casActions(id); }, 550);
  }, true);
  document.addEventListener('pointermove', function(e){ if (t && (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10)) stop(); }, true);
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function(n){ document.addEventListener(n, function(){ if (t) stop(); }, true); });
  // the click that ends a long press must not also open the form
  document.addEventListener('click', function(e){ if (fired){ fired = false; e.stopPropagation(); e.preventDefault(); } }, true);
  document.addEventListener('contextmenu', function(e){ if (e.target.closest && e.target.closest(SEL)) e.preventDefault(); }, true);
})();
