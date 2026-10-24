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
['newCasualty','editCasualty'].forEach(function(n){ var o = w[n]; if (typeof o !== 'function') return; w[n] = function(){ resetUndo(); return o.apply(this, arguments); }; });
var _ocf = w.closeCasualtyForm;
if (typeof _ocf === 'function') w.closeCasualtyForm = function(){ return Promise.resolve(_ocf.apply(this, arguments)).then(function(r){ resetUndo(); return r; }); };

// Vitals sanity: impossible numbers are rejected, not saved.
var _avr = w.addVitalsReading;
if (typeof _avr === 'function') w.addVitalsReading = function(){
  var i = w._casualtyVitalsInput || {}, lim = { pulse:[20,300], rr:[1,80], spo2:[30,100], bpSys:[30,300], bpDia:[10,200], temp:[25,45], etco2:[5,100] }, bad = false;
  Object.keys(lim).forEach(function(k){ var v = parseFloat(i[k]); if (i[k] !== '' && i[k] != null && !isNaN(v) && (v < lim[k][0] || v > lim[k][1])){ bad = true; i[k] = ''; } });
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
  red:    { c:'#e5242b', en:'URGENT', he:'דחוף',  shape:'oct' },
  yellow: { c:'#ffd400', en:'DELAYED',   he:'דחוי',   shape:'tri' },
  green:  { c:'#19c37d', en:'NOT URGENT', he:'לא דחוף',     shape:'circ' },
  gray:   { c:'#b4bbc8', en:'WAITING', he:'ממתין', shape:'hex' },
  black:  { c:'#000000', en:'DECEASED (DOCTOR)', he:'חלל (רופא)',   shape:'sqx' }
};
var NONE = { c:'#6b7078', en:'NOT TRIAGED', he:'טרם סווג', shape:'circ' };
function tg(color){ return TG[color] || NONE; }
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
  var t = tg(color), key = (color && TG[color]) ? color : 'none';
  return '<span class="tchip t-' + key + (big ? ' lg' : '') + '" role="img" aria-label="' + esc(tgWord(color)) + '">' + shapeSvg(t.shape, big ? 26 : 22) + '<span>' + esc(tgWord(color)) + '</span></span>';
}
w.TriageUI = { tg: tg, chip: chip, shapeSvg: shapeSvg, word: tgWord, TG: TG };

// ── Tabs ───────────────────────────────────────────────────────
var TABS = [
  { id:'status',     icon:'layout-dashboard', en:'Home',       he:'בית' },
  { id:'casualties', icon:'users',            en:'Casualties', he:'נפגעים' },
  { id:'evac',       icon:'ambulance',        en:'Evacuate',   he:'פינוי' },
  { id:'bracelets',  icon:'qr-code',          en:'Wristbands', he:'צמידים' }
];
function activeTab(){ return w._casualtyEditMode ? 'casualties' : w._incidentTab; }
function renderTabbar(){
  var bar = document.getElementById('incident-tabs'); if (!bar) return;
  var n = (w._incidentCasualties || []).length, a = activeTab();
  bar.setAttribute('role', 'tablist');
  bar.innerHTML = TABS.map(function(t){
    var on = a === t.id;
    return '<button role="tab" aria-selected="' + on + '" class="' + (on ? 'on' : '') + '" data-tab="' + t.id + '" onclick="Demo.tab(\'' + t.id + '\')">'
      + ico(t.icon, 30) + '<span>' + L(t.en, t.he) + '</span>' + (t.id === 'casualties' && n ? '<i class="badge" style="display:flex">' + n + '</i>' : '') + '</button>';
  }).join('');
}

// ── Home ───────────────────────────────────────────────────────
function unassigned(c){ return !w.isCasualtyAssignedToVehicle(c); }
function renderOverview(){
  var a = w._incidentData || {}, list = w._incidentCasualties || [];
  var count = function(c){ return list.filter(function(x){ return x.triageColor === c; }).length; };
  var waitingReds = list.filter(function(x){ return x.triageColor === 'red' && unassigned(x); });
  var alertHtml = waitingReds.length
    ? '<button class="ov-alert" onclick="Demo.openCasualty(\'' + esc(waitingReds[0]._docId) + '\')">' + ico('triangle-alert', 32)
      + '<span><b>' + L(waitingReds.length + ' URGENT ' + (waitingReds.length > 1 ? 'CASUALTIES' : 'CASUALTY') + ' WAITING FOR EVACUATION', waitingReds.length + ' נפגעים דחופים ממתינים לפינוי') + '</b><small>' + L('Tap to open the first one','לחצו לפתיחת הראשון') + '</small></span></button>'
    : '';
  var tiles = ['red','yellow','green','black'].map(function(c){
    var t = tg(c);
    return '<button class="ov-tile t-' + c + '" onclick="Demo.filter(\'' + c + '\')">' + shapeSvg(t.shape, 30) + '<b>' + count(c) + '</b><span>' + tgWord(c) + '</span></button>';
  }).join('');
  var go = function(icon, title, sub, fn, primary){
    return '<button class="go' + (primary ? ' primary' : '') + '" onclick="' + fn + '"><span class="gi">' + ico(icon, 28) + '</span><span><b>' + title + '</b><small>' + sub + '</small></span><span class="chev">' + ico(lang()==='he' ? 'chevron-left' : 'chevron-right', 28) + '</span></button>';
  };
  var mins = a.timestamp && a.timestamp.toDate ? Math.max(1, Math.round((Date.now() - a.timestamp.toDate().getTime()) / 60000)) : 18;
  return '<div class="ov-hero"><div class="eyebrow">' + L('LIVE SCENARIO','תרחיש חי') + '</div>'
    + '<h2>' + L('Bus-stop attack · ' + list.length + ' casualties','פיגוע בתחנת אוטובוס · ' + list.length + ' נפגעים') + '</h2>'
    + '<p>' + L('You are the first medic on scene, ' + mins + ' minutes in. Everyone is triaged.','אתם החובש הראשון בזירה, ' + mins + ' דקות מתחילת האירוע. כולם מוינו.') + '</p></div>'
    + alertHtml
    + '<div class="ov-tiles">' + tiles + '</div>'
    + '<div class="sec-label">' + L('HOW MANY PATIENTS?','כמה נפגעים?') + '</div>'
    + '<div class="ov-choose">'
    +   '<button class="ch full" onclick="Demo.newFull()"><span class="ch-i">' + ico('file-text', 34) + '</span><b>' + L('ONE PATIENT','נפגע אחד') + '</b><strong>' + L('FULL FORM 101','טופס 101 מלא') + '</strong><small>' + L('The complete care record: body map, vitals, every drug and time.','תיק הטיפול המלא: מפת גוף, מדדים, כל תרופה וזמן.') + '</small></button>'
    +   '<button class="ch quick" onclick="Quick.open()"><span class="ch-i">' + ico('zap', 34) + '</span><b>' + L('MANY CASUALTIES','נפגעים רבים') + '</b><strong>' + L('QUICK TRIAGE','מיון מהיר') + '</strong><small>' + L('A colour for each casualty in seconds. Open the full form 101 later.','צבע לכל נפגע תוך שניות. את טופס 101 המלא פותחים אחר כך.') + '</small></button>'
    + '</div>'
    + '<div class="sec-label">' + L('OTHER','אחר') + '</div>'
    + go('file-text', L('Open a sample casualty card','פתחו כרטיס נפגע לדוגמה'), L('Casualty A: a complete Form 101','נפגע א׳: טופס 101 מלא'), "Demo.go('casualty')")
    + go('ambulance', L('Evacuate','פינוי'), L('Ambulances, who is on board, time to hospital','אמבולנסים, מי על הסיפון, זמן לבית חולים'), "Demo.tab('evac')")
    + go('scan-line', L('Scan a wristband','סריקת צמיד'), L('The QR code carries the patient’s record','קוד ה-QR נושא את תיק הנפגע'), "Demo.go('scan')")
    + go('play', L('Take the guided tour','סיור מודרך'), L('About 90 seconds, thirteen short steps','כ-90 שניות, שלושה עשר שלבים קצרים'), 'Tour.start()')
    + '<div class="sec-label">' + L('INCIDENT','אירוע') + '</div>'
    + '<dl class="kv">'
    +   '<div><dt>' + L('Location','מיקום') + '</dt><dd>' + esc(T(a.location || '')) + '</dd></div>'
    +   '<div><dt>' + L('What happened','נסיבות') + '</dt><dd>' + esc(T(a.circumstances || '')) + '</dd></div>'
    +   '<div><dt>' + L('Environment','סביבה') + '</dt><dd>' + esc(T(a.environment || '')) + '</dd></div>'
    +   '<div><dt>' + L('Threat status','סטטוס איום') + '</dt><dd>' + esc(T(a.threats || '')) + '</dd></div>'
    + '</dl>';
}

function lvl(c){ return c.formLevel === 'quick' ? '<span class="lvl quick">' + ico('zap', 20) + L('QUICK TRIAGE — tap to complete the full form','מיון מהיר — לחצו להשלמת הטופס המלא') + '</span>' : '<span class="lvl full">' + ico('file-text', 20) + L('FULL FORM 101','טופס 101 מלא') + '</span>'; }
w.levelOf = function(c){ return c && c.formLevel === 'quick' ? 'quick' : 'full'; };
// ── Casualty list (+ command board) ────────────────────────────
function flag(label, bad){ return bad ? ' <u class="flag">' + label + '</u>' : ''; }
function renderPatients(){
  var order = { red:0, yellow:1, green:2, gray:3, black:4 };
  var all = (w._incidentCasualties || []).slice().sort(function(a, b){
    return (order[a.triageColor] != null ? order[a.triageColor] : 9) - (order[b.triageColor] != null ? order[b.triageColor] : 9);
  });
  var f = w._plFilter, list = f ? all.filter(function(c){ return c.triageColor === f; }) : all;
  var h = '<div class="seg-tabs" role="tablist"><button class="on" role="tab" onclick="Demo.casView(\'list\')">' + L('List','רשימה') + '</button>'
    + '<button role="tab" onclick="Demo.casView(\'board\')">' + L('Command board','לוח פיקוד') + '</button></div>';
  h += '<div class="pl-head"><div><h2>' + L('Casualties','נפגעים') + '</h2><p>' + L('Most urgent first. Tap one to open the card.','הדחוף ביותר ראשון. לחצו לפתיחת הכרטיס.') + '</p></div></div>';
  if (f) h += '<button class="filter-bar" onclick="Demo.filter(null)">' + chip(f) + '<span>' + L('Showing only these','מוצגים רק אלה') + '</span><b>' + L('SHOW ALL','הצג הכל') + '</b></button>';
  h += '<div class="add-split"><button class="ch full" onclick="Demo.newFull()">' + ico('file-text', 30) + '<b>' + L('ONE PATIENT','נפגע אחד') + '</b><small>' + L('Full Form 101','טופס 101 מלא') + '</small></button><button class="ch quick" onclick="Quick.open()">' + ico('zap', 30) + '<b>' + L('MANY CASUALTIES','נפגעים רבים') + '</b><small>' + L('Quick triage','מיון מהיר') + '</small></button></div><div class="pl">';
  list.forEach(function(c){
    var x = c.xabcde || {}, v = (c.vitalsHistory || []).slice(-1)[0] || {};
    var tq = (x.x && x.x.tourniquets || [])[0];
    var tqMin = tq ? Math.max(0, Math.round((Date.now() - Date.parse(tq.time)) / 60000)) : null;
    var inj = (c.injuries || []).slice(0, 3).map(function(i){ return esc(T(w.bodyLabelOut ? w.bodyLabelOut(i.region) : ((w.BODY_LABELS || {})[i.region] || i.region))); }).join(' · ');
    var onVeh = !unassigned(c);
    h += '<button class="pl-card" onclick="editCasualtyById(\'' + esc(c._docId) + '\')">' + chip(c.triageColor, true)
      + '<span class="pl-main"><b>' + esc(T(c.name)) + '</b>' + lvl(c)
      + '<span class="pl-sub">' + (inj || L('No injuries marked','לא סומנו פציעות')) + '</span>'
      + '<span class="pl-vit">'
      + (v.pulse != null ? '<em>HR <i>' + v.pulse + '</i>' + flag(L('HIGH','גבוה'), v.pulse > 120) + '</em>' : '')
      + (v.bpSys ? '<em>BP <i>' + v.bpSys + '/' + (v.bpDia || '–') + '</i>' + flag(L('LOW','נמוך'), v.bpSys < 90) + '</em>' : '')
      + (v.spo2 ? '<em>SpO₂ <i>' + v.spo2 + '</i>' + flag(L('LOW','נמוך'), v.spo2 < 92) + '</em>' : '')
      + (tqMin != null ? '<em class="warn">' + ico('timer', 22) + L('TOURNIQUET ','חוסם עורקים ') + '<i>' + tqMin + L(' MIN',' ד׳') + '</i></em>' : '')
      + (onVeh ? '<em class="ok">' + ico('ambulance', 22) + L('ON AMBULANCE','באמבולנס') + '</em>' : '')
      + '</span></span><span class="chev">' + ico(lang()==='he' ? 'chevron-left' : 'chevron-right', 28) + '</span></button>';
  });
  if (!list.length) h += '<p class="empty">' + L('No casualties in this group.','אין נפגעים בקבוצה זו.') + '</p>';
  return h + '</div>';
}

// ── App bar ────────────────────────────────────────────────────
function renderBar(){
  var back = document.getElementById('app-back'), mark = document.getElementById('app-mark'),
      title = document.getElementById('app-title'), sub = document.getElementById('app-sub'), mb = document.getElementById('menu-btn');
  if (!back) return;
  back.innerHTML = ico(lang()==='he' ? 'arrow-right' : 'arrow-left', 26) + '<span>' + L('Back','חזרה') + '</span>';
  back.setAttribute('aria-label', L('Back','חזרה'));
  mb.innerHTML = ico('menu', 26) + '<span>' + L('Menu','תפריט') + '</span>';
  mb.setAttribute('aria-label', L('Menu','תפריט'));
  document.body.classList.toggle('in-form', !!w._casualtyEditMode);
  if (w._casualtyEditMode){
    var name = (w._casualtyName || '').trim() || L('New casualty','נפגע חדש');
    back.hidden = false; mark.hidden = true; mb.hidden = true;
    title.textContent = T(name);
    sub.textContent = tgWord(w._casualtyTriageColor);
  } else {
    back.hidden = true; mark.hidden = false; mb.hidden = false;
    title.textContent = L('Shomer Ahi','שומר אחי');
    sub.textContent = '';
  }
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
    if (x.nodeType !== y.nodeType || (x.nodeType === 1 && x.tagName !== y.tagName)){ a.replaceChild(y.cloneNode(true), x); continue; }
    if (x.nodeType === 3 || x.nodeType === 8){ if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue; continue; }
    if (x.nodeType === 1){
      syncAttrs(x, y);
      var focused = x === document.activeElement;
      if (x.tagName === 'INPUT' || x.tagName === 'SELECT'){ if (!focused && x.value !== y.value && y.hasAttribute('value')) x.value = y.getAttribute('value'); continue; }
      if (x.tagName === 'TEXTAREA'){ if (!focused && x.value !== y.value) x.value = y.value; continue; }
      if (x.tagName === 'svg' || x.namespaceURI === 'http://www.w3.org/2000/svg'){ if (x.outerHTML !== y.outerHTML) a.replaceChild(y.cloneNode(true), x); continue; }
      morph(x, y);
    }
  }
  while (a.childNodes.length > bn.length) a.removeChild(a.lastChild);
  for (i = m; i < bn.length; i++) a.appendChild(bn[i].cloneNode(true));
}
w.renderIncidentPage = function(){
  var c = document.getElementById('incident-content');
  if (!c || !w._incidentData) return;
  // The engine board's own "Evac" mode is replaced by the Evacuate tab.
  if (!w._casualtyEditMode && w._incidentTab === 'casualties' && w._casView === 'board' && w._mciMode === 'evac'){ w._mciMode = 'manage'; w._incidentTab = 'evac'; }
  var tabNow = activeTab(), html, view;
  if (w._casualtyEditMode){ html = w.renderIncidentCasualties(); view = 'form'; }
  else if (tabNow === 'casualties' && w._casView === 'board'){ html = '<div class="seg-tabs" role="tablist"><button role="tab" onclick="Demo.casView(\'list\')">' + L('List','רשימה') + '</button><button class="on" role="tab" onclick="Demo.casView(\'board\')">' + L('Command board','לוח פיקוד') + '</button></div>' + w.renderMCIDashboard(); view = 'mci'; }
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
  c.dataset.view = view;
  if (view === 'form' && w.FormUI) w.FormUI.bind(c);
  renderTabbar(); renderBar();
};

// ── Demo controller ────────────────────────────────────────────
w._casView = 'list'; w._plFilter = null;
function closeOverlays(){
  ['f-kp','f-sheet','fs-sheet','menu-sheet','undo-toast','ev-assign-sheet','ev-pre-sheet','ev-arrive-sheet','f-tap','qt'].forEach(function(id){ var e = document.getElementById(id); if (e) e.remove(); });
  if (w.Field) w.Field._k = null;
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
  casView: function(v){ w._casView = v; if (v === 'board') w._mciMode = 'manage'; w.renderIncidentPage(); var c = document.getElementById('incident-content'); c.scrollTop = 0; },
  filter: function(color){ w._plFilter = color; w._casView = 'list'; w._incidentTab = 'casualties'; w.renderIncidentPage(); document.getElementById('incident-content').scrollTop = 0; },
  newFull: function(){ closeOverlays(); w._incidentTab = 'casualties'; w.newCasualty(); },
  openCasualty: function(id){ w._incidentTab = 'casualties'; w.editCasualtyById(id); },
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
  menu: function(){
    var app = document.getElementById('app'); if (document.getElementById('menu-sheet')) return;
    var s = document.createElement('div'); s.id = 'menu-sheet'; s.className = 'sheet-wrap no-polish';
    var row = function(icon, title, sub, fn){ return '<button class="sheet-row" onclick="' + fn + '"><span class="gi">' + ico(icon, 28) + '</span><span><b>' + title + '</b><small>' + sub + '</small></span></button>'; };
    s.innerHTML = '<div class="sheet-dim" onclick="Demo.closeMenu()"></div><div class="sheet" role="dialog" aria-label="' + L('Menu','תפריט') + '"><div class="sheet-grab"></div><h3>' + L('Menu','תפריט') + '</h3>'
      + '<div class="lang-pick"><button class="' + (lang() === 'en' ? 'on' : '') + '" onclick="ShowcaseI18n.setLang(\'en\');Demo.closeMenu()">ENGLISH</button><button class="' + (lang() === 'he' ? 'on' : '') + '" onclick="ShowcaseI18n.setLang(\'he\');Demo.closeMenu()">עברית</button></div>'
      + row('play', L('Guided tour','סיור מודרך'), L('About 90 seconds, thirteen steps','כ-90 שניות, שלושה עשר שלבים'), 'Demo.closeMenu();Tour.start()')
      + row('triangle-alert', L('Important notice','הודעה חשובה'), L('Early beta. Do not use on real patients.','בטא מוקדמת. אין להשתמש בנפגעים אמיתיים.'), 'Demo.closeMenu();Disclaimer.open()')
      + row('rotate-ccw', L('Reset demo','איפוס הדמו'), L('Restore the original six casualties','החזרת ששת הנפגעים המקוריים'), 'Demo.closeMenu();Demo.reset()')
      + '</div>';
    app.appendChild(s);
  },
  closeMenu: function(){ var s = document.getElementById('menu-sheet'); if (s) s.remove(); },
  reset: function(){ closeOverlays(); resetUndo(); seed(); if (w.Evac) w.Evac.reset(); w._incidentTab = 'status'; w._casView = 'list'; w._plFilter = null; w.renderIncidentPage(); toast(L('Demo reset','הדמו אופס')); },
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
      ['file-text', L('Form 101 on a phone: body map, vitals, interventions with timestamps','טופס 101 בטלפון: מפת גוף, מדדים, התערבויות עם חותמות זמן')],
      ['activity', L('Decision support that follows MARCH and flags shock, TBI and drug time windows','תמיכה בהחלטות לפי MARCH שמתריעה על הלם, TBI וחלונות תרופות')],
      ['ambulance', L('Evacuation board and a driver-proof Transport screen with a live ETA','לוח פינוי ומסך הובלה ברור לנהג עם ETA חי')],
      ['qr-code', L('QR wristbands carry the record, so any responder can read it, even offline','צמידי QR נושאים את התיק, וכל מגיב יכול לקרוא אותו, גם בלי רשת')]
    ];
    f.innerHTML = items.map(function(i){ return '<li>' + ico(i[0], 22) + '<span>' + i[1] + '</span></li>'; }).join('');
  }
  if (q && w.qrcode){
    var url = location.href.split('#')[0].split('?')[0];
    var qq = w.qrcode(0, 'M'); qq.addData(url); qq.make();
    var n = qq.getModuleCount(), d = '';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qq.isDark(r, c)) d += 'M' + (c + 2) + ' ' + (r + 2) + 'h1v1h-1z';
    q.innerHTML = '<svg class="qr" viewBox="0 0 ' + (n + 4) + ' ' + (n + 4) + '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '"/></svg>'
      + '<p><b>' + L('Open it on your phone','פתחו בטלפון') + '</b>' + L('Scan to try the touch experience.','סרקו כדי לנסות במגע.') + '</p>';
  }
}
document.addEventListener('DOMContentLoaded', function(){
  var s = w.ShowcaseI18n; if (!s) return;
  var orig = s.setLang; s.setLang = function(l){ orig(l); renderSide(); };
});

// ── The top bar slides away while reading down the page and returns on scroll up ──
(function(){
  var lastY = 0, lock = 0;
  function bind(){
    var c = document.getElementById('incident-content'), bar = document.querySelector('.appbar'); if (!c || !bar) return;
    c.addEventListener('scroll', function(){
      var y = c.scrollTop, d = y - lastY, now = Date.now(); if (now < lock || Math.abs(d) < 12) return;
      if (d > 0 && y > 110 && !bar.classList.contains('hide')){ bar.classList.add('hide'); lock = now + 350; }
      else if ((d < 0 || y < 40) && bar.classList.contains('hide')){ bar.classList.remove('hide'); lock = now + 350; }
      lastY = y;
    }, { passive:true });
    var seenView = c.dataset.view;
    new MutationObserver(function(){ if (c.dataset.view !== seenView){ seenView = c.dataset.view; bar.classList.remove('hide'); lastY = 0; } }).observe(c, { attributes:true, attributeFilter:['data-view'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
})();

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
var OVERLAY = '#f-kp,#f-sheet,#fs-sheet,#menu-sheet,#ev-assign-sheet,#ev-pre-sheet,#ev-arrive-sheet,.bo,.dn';
var _ret = null;
function topOverlay(){ var l = document.querySelectorAll(OVERLAY); return l.length ? l[l.length - 1] : null; }
function syncModal(){
  var top = topOverlay(), app = document.getElementById('app'); if (!app) return;
  var bg = [].slice.call(app.children).filter(function(c){ return !c.matches(OVERLAY + ',.tour-dim,.tour-card,.undo-toast,.tst,.skip-link'); });
  bg.forEach(function(c){ if (top) c.setAttribute('inert', ''); else c.removeAttribute('inert'); });
  if (top){
    if (!_ret) _ret = document.activeElement;
    if (!top.__fx){ top.__fx = true; top.setAttribute('role', top.getAttribute('role') || 'dialog'); top.setAttribute('aria-modal', 'true'); if (!top.getAttribute('aria-label')) top.setAttribute('aria-label', (top.querySelector('h3,.bo-title,h2') || {}).textContent || 'Dialog'); var f = top.querySelector('[data-autofocus],.sheet button,.bo-x,button,input'); if (f) setTimeout(function(){ f.focus({ preventScroll:true }); }, 20); }
  } else if (_ret){ try { _ret.focus({ preventScroll:true }); } catch(e){} _ret = null; }
}
new MutationObserver(syncModal).observe(document.getElementById('app'), { childList:true });
document.addEventListener('keydown', function(e){
  if (e.key !== 'Escape') return;
  if (document.querySelector('.tour-card')) return;           // tour handles its own Esc
  var t = topOverlay(); if (!t || t.classList.contains('dn')) return;   // the safety notice is dismissed with its button
  var d = t.querySelector('.sheet-dim'), x = t.querySelector('.bo-x');
  if (d) d.click(); else if (x) x.click(); else t.remove();
});

// ── Keyboard: make clickable non-buttons operable ──────────────
document.addEventListener('keydown', function(e){
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role=button][onclick]:not(button):not([onkeydown])')){ e.preventDefault(); e.target.click(); }
});
})();
