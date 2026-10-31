/* EVACUATE: fleet board + TRANSPORT screen for use in a moving vehicle.
   Replaces the engine's small-control evacuation board. Uses the engine's `_mciVehicles` array so the
   rest of the app (casualty list, handoff, "on ambulance" flags) stays consistent.
   Rules: 4 plain statuses, capacity checks, hospital buttons (no typing), live ETA countdown, huge targets. */
(function(){
'use strict';
var W = window;
function lang(){ return (W.ShowcaseI18n && W.ShowcaseI18n.lang) || 'en'; }
function L(en, he){ return lang() === 'he' ? he : en; }
function T(s){ return W.ShowcaseI18n ? W.ShowcaseI18n.tr(s) : s; }
var EXTRA = { bed:'<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>',
  armchair:'<path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/><path d="M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"/><path d="M5 18v2"/><path d="M19 18v2"/>' };
function ico(n, s){
  if (EXTRA[n]){ s = s || 18; return '<svg class="ui-i" style="width:' + s + 'px;height:' + s + 'px" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + EXTRA[n] + '</svg>'; }
  return W.Icon ? W.Icon(n, s) : '';
}
function esc(s){ return W.escapeHtml(s); }
function app(){ return document.getElementById('app'); }
function casualties(){ return W._incidentCasualties || []; }
function byId(id){ return casualties().filter(function(c){ return c._docId === id; })[0]; }
function vehicles(){ return W._mciVehicles; }
function veh(id){ return vehicles().filter(function(v){ return v.id === id; })[0]; }
function hhmm(ms){ var d = new Date(ms); return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }
function mmss(sec){ sec = Math.max(0, Math.round(sec)); return String(Math.floor(sec / 60)).padStart(2,'0') + ':' + String(sec % 60).padStart(2,'0'); }

var HOSPITALS = [
  { id:'h1', en:'City Trauma Center',      he:'מרכז טראומה עירוני',   eta:12, ready:true,  trauma:true,  level:'A' },
  { id:'h2', en:'North General Hospital',  he:'בית חולים כללי צפון',  eta:18, ready:true,  trauma:false, level:'B' },
  { id:'h3', en:'Burns & Children Center', he:'מרכז כוויות וילדים',   eta:25, ready:false, trauma:true,  level:'A' }
];
var STATUS = [
  { v:'enroute',    icon:'navigation', en:'Coming to scene',  he:'בדרך לזירה', chip:'Coming', chipHe:'בדרך' },
  { v:'arrived',    icon:'map-pin',    en:'At scene · loading', he:'בזירה · העמסה', chip:'At scene', chipHe:'בזירה' },
  { v:'evacuating', icon:'ambulance',  en:'Departed · to hospital', he:'יצא · לבית חולים', chip:'To hospital', chipHe:'לבית חולים' },
  { v:'athospital', icon:'hospital',   en:'At hospital', he:'בבית חולים', chip:'At hospital', chipHe:'בבית חולים' }
];
var state = { driver:false, view:null, picker:null, manage:{} };

// ── Helpers ────────────────────────────────────────────────────
function name(v){ return v.name || (L('Ambulance ','אמבולנס ') + (vehicles().indexOf(v) + 1)); }
function rushPlan(){
  var c = casualties().filter(function(x){ return x.triageColor === 'red' && !W.isCasualtyAssignedToVehicle(x); })[0];
  if (!c) return null;
  var rank = { arrived:0, enroute:1 };
  var v = vehicles().filter(function(x){ return (x.status === 'arrived' || x.status === 'enroute') && used(x).litters < (x.litter || 0); })
    .sort(function(a, b){ return (rank[a.status] || 9) - (rank[b.status] || 9); })[0];
  return v ? { c:c, v:v } : null;
}
// an ambulance still driving to the scene: say when it gets there, so nobody thinks it leaves now
function sceneLeg(v){ var r = v.status === 'enroute' ? remaining(v) : null; if (r == null || r <= 0) return ''; return '<i dir="auto">' + L('at scene in ' + Math.max(1, Math.ceil(r / 60)) + ' min','בזירה בעוד ' + Math.max(1, Math.ceil(r / 60)) + ' דק׳') + '</i>'; }
function used(v){ var s = 0, l = 0; (v.casualties || []).forEach(function(i){ if (i && i.pos === 'litter') l++; else s++; }); return { seats:s, litters:l }; }
// trauma level of a hospital as a chip: shield icon + "Level A" (word and icon, never colour alone)
function lvlChip(x){ return x && x.level ? '<em class="hlv hlv-' + x.level.toLowerCase() + '">' + ico(x.level === 'A' ? 'shield' : 'hospital', 22) + L('Level ','רמה ') + x.level + '</em>' : ''; }
function hospital(v){ return HOSPITALS.filter(function(h){ return h.id === v.hospitalId; })[0]; }
function remaining(v){ return v.etaMinutes != null && v.etaStartAt ? v.etaMinutes * 60 - (Date.now() - v.etaStartAt) / 1000 : null; }
function etaMin(r){ if (r == null) return '—'; if (r <= 0) return L('Arriving now','מגיע עכשיו'); var m = Math.max(1, Math.ceil(r / 60)); return m + '<small>' + L(' min',' דק׳') + '</small>'; }
function etaText(v){ var r = remaining(v); if (r == null) return '—'; return r <= 0 ? L('Arriving','מגיע') : mmss(r); }
function etaWords(v){ var r = remaining(v); if (r == null) return '—'; if (r <= 0) return L('arriving now','מגיע עכשיו'); var mn = Math.max(1, Math.ceil(r / 60)), at = new Date(Date.now() + r * 1000); return L(mn + ' min (about ' + String(at.getHours()).padStart(2,'0') + ':' + String(at.getMinutes()).padStart(2,'0') + ')', mn + ' דק׳ (בערך ' + String(at.getHours()).padStart(2,'0') + ':' + String(at.getMinutes()).padStart(2,'0') + ')'); }
function members(v){ return (v.casualties || []).map(function(i){ return byId(i.docId); }).filter(Boolean); }
// The command board counts a casualty as Evacuated once the ambulance is at the hospital. Returns what to restore on UNDO.
function markEvacuated(v, on){
  var prev = {};
  members(v).forEach(function(c){ prev[c._docId] = c.evacStatus || ''; W._upsertOfflineCasualty({ _docId:c._docId, evacStatus: on ? 'evacuated' : '' }); });
  return prev;
}
function restoreEvac(prev){ Object.keys(prev).forEach(function(k){ W._upsertOfflineCasualty({ _docId:k, evacStatus:prev[k] }); }); }
var ORDER = { red:0, yellow:1, green:2, gray:3, black:4 };
function sorted(list){ return list.slice().sort(function(a, b){ return (ORDER[a.triageColor] != null ? ORDER[a.triageColor] : 9) - (ORDER[b.triageColor] != null ? ORDER[b.triageColor] : 9); }); }
function tq(c){ var x = (c.xabcde || {}).x || {}; return (x.tourniquets || [])[0]; }

function undoToast(msg, fn){
  var old = document.getElementById('undo-toast'); if (old) old.remove();
  var el = document.createElement('div'); el.id = 'undo-toast'; el.className = 'undo-toast no-polish'; el.setAttribute('role', 'status');
  el.innerHTML = '<span>' + msg + '</span>' + (fn ? '<button>' + ico('undo-2', 24) + L('Undo','בטל') + '</button>' : '');
  if (fn) el.querySelector('button').onclick = function(){ fn(); el.remove(); };
  app().appendChild(el); setTimeout(function(){ el.remove(); }, 8000);
  if (navigator.vibrate) navigator.vibrate(25);
}
function rerender(){ W.renderIncidentPage(); }
// Arrival alerts have their own banner so they never replace a pending UNDO.
function etaToast(msg){
  var old = document.getElementById('eta-toast'); if (old) old.remove();
  var el = document.createElement('button'); el.id = 'eta-toast'; el.className = 'eta-toast no-polish'; el.setAttribute('role', 'alert'); el.textContent = msg;
  el.onclick = function(){ el.remove(); }; app().appendChild(el); setTimeout(function(){ el.remove(); }, 10000);
  if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
}

// ── Seed ───────────────────────────────────────────────────────
function seed(){
  var now = Date.now();
  vehicles().length = 0;
  vehicles().push({ id:'v_a1', type:'אמבולנס', typeKey:'', name:'', seats:4, litter:2, status:'arrived', destination:'', hospitalId:null, casualties:[], etaMinutes:null, etaStartAt:null, _alertedOneMin:false });
  vehicles().push({ id:'v_a2', type:'אמבולנס', typeKey:'', name:'', seats:4, litter:2, status:'evacuating', destination:'', hospitalId:'h1', casualties:[{ docId:'demo_c2', pos:'litter' }, { docId:'demo_c3', pos:'litter' }], etaMinutes:12, etaStartAt:now - 3 * 60000, _alertedOneMin:false });
}

// ── Ambulance cards ────────────────────────────────────────────
// One component for every ambulance: header (icon, name, status chip), the arrival time, who is on board, one primary action.
// The controls (status, litters and seats, hospital, arrival time) sit behind "Manage ambulance N".
function seatCounter(v, kind){
  var u = used(v), total = kind === 'litter' ? v.litter : v.seats, n = kind === 'litter' ? u.litters : u.seats;
  var label = kind === 'litter' ? L('Litters','אלונקות') : L('Seats','מושבים');
  return '<div class="ev-cap"><small>' + label + '</small><div><button aria-label="' + L('Fewer ','פחות ') + label + '" onclick="Evac.cap(\'' + v.id + '\',\'' + kind + '\',-1)">' + ico('minus', 26) + '</button><b class="' + (n > total ? 'over' : '') + '">' + n + ' / ' + total + '</b><button aria-label="' + L('More ','יותר ') + label + '" onclick="Evac.cap(\'' + v.id + '\',\'' + kind + '\',1)">' + ico('plus', 26) + '</button></div></div>';
}
function onboardRow(c, v){
  var t = tq(c), tqMin = t ? Math.max(0, Math.round((Date.now() - Date.parse(t.time)) / 60000)) : null;
  return '<div class="ev-pt">' + W.TriageUI.chip(c.triageColor) + '<span><b>' + (W.casBadge ? W.casBadge(c) + ' ' : '') + esc(String(T(c.name)).split(' — ')[0]) + (W.casTag ? W.casTag(c) : '') + '</b>' + (c.formLevel === 'quick' ? '<small class="amb-q">' + ico('zap', 22) + L('Quick triage','מיון מהיר') + '</small>' : '') + (tqMin != null ? '<small class="amb-tq">' + ico('timer', 22) + L('Tourniquet on ' + tqMin + ' min','חוסם עורקים ' + tqMin + ' ד׳') + '</small>' : '') + '</span>'
    + (v.status !== 'evacuating' ? '<button class="ev-rm" onclick="Evac.remove(\'' + v.id + '\',\'' + esc(c._docId) + '\')">' + ico('x', 22) + L('Remove','הסר') + '</button>' : '') + '</div>';
}
function statusOf(v){ return STATUS.filter(function(s){ return s.v === v.status; })[0] || STATUS[0]; }
function statusChip(v){ var s = statusOf(v); return '<span class="amb-chip st-' + s.v + '">' + ico(s.icon, 22) + L(s.chip, s.chipHe) + '</span>'; }
function capLine(v){ var u = used(v); return '<p class="amb-cap">' + ico('users', 22) + '<span>' + L('Litters ' + u.litters + ' of ' + v.litter + ' · Seats ' + u.seats + ' of ' + v.seats, 'אלונקות ' + u.litters + ' מתוך ' + v.litter + ' · מושבים ' + u.seats + ' מתוך ' + v.seats) + '</span></p>'; }
function etaBlock(v){
  var h = hospital(v), r = remaining(v), cls = r != null && r <= 60 ? 'now' : r != null && r <= 180 ? 'soon' : '';
  if (v.status === 'evacuating' || r != null) return '<div class="ev-eta amb-eta ' + cls + '"><small>' + (v.status === 'evacuating' ? L('Arrives at hospital in','מגיע לבית החולים בעוד') : L('Arrives at scene in','מגיע לזירה בעוד')) + '</small>' + (r != null && r <= 0 ? '<b class="w">' + L('Arriving now','מגיע עכשיו') + '</b>' : '<b dir="ltr">' + etaText(v) + '</b>') + '<span>' + (h ? ico('hospital', 22) + esc(L(h.en, h.he)) : L('Hospital not chosen yet','עדיין לא נבחר בית חולים')) + '</span></div>';
  return '<div class="amb-eta amb-eta-none">' + ico('clock', 24) + '<span>' + (v.status === 'arrived' ? L('At the scene now. Load, then choose a hospital.','בזירה עכשיו. העמיסו ובחרו בית חולים.') : L('No arrival time set','לא נקבע זמן הגעה')) + (h ? ' · ' + esc(L(h.en, h.he)) : '') + '</span></div>';
}
function manageBody(v){
  var h = '<div class="amb-manage-body">';
  h += '<div class="ev-h">' + L('Status','סטטוס') + '</div><div class="ev-status">' + STATUS.map(function(s){
    var on = v.status === s.v;
    return '<button class="' + (on ? 'on' : '') + '" aria-pressed="' + on + '" onclick="Evac.status(\'' + v.id + '\',\'' + s.v + '\')">' + ico(s.icon, 28) + '<span>' + L(s.en, s.he) + '</span>' + (on ? ico('check', 22) : '') + '</button>';
  }).join('') + '</div>';
  h += '<div class="ev-caps">' + seatCounter(v, 'litter') + seatCounter(v, 'seat') + '</div>';
  h += '<div class="ev-h">' + L('Hospital','בית חולים') + '</div><div class="ev-hosp">' + HOSPITALS.map(function(x){
    var on = v.hospitalId === x.id;
    return '<button class="' + (on ? 'on' : '') + '" aria-pressed="' + on + '" onclick="Evac.hospital(\'' + v.id + '\',\'' + x.id + '\')"><b>' + ico(on ? 'check' : 'hospital', 22) + esc(L(x.en, x.he)) + '</b><span>' + lvlChip(x) + x.eta + L(' min',' ד׳') + ' · <strong class="' + (x.ready ? 'rdy' : 'busy') + '">' + (x.ready ? L('Ready','מוכן') : L('Busy','עמוס')) + '</strong></span></button>';
  }).join('') + '</div>';
  h += '<div class="ev-h">' + L('Time to arrive (min)','זמן הגעה (דק׳)') + '</div><div class="ev-eta-set"><button aria-label="' + L('One minute less','דקה פחות') + '" onclick="Evac.eta(\'' + v.id + '\',-1)">' + ico('minus', 22) + '1</button><b dir="ltr">' + (v.etaMinutes != null ? etaText(v) : '—') + '</b><button aria-label="' + L('One minute more','דקה יותר') + '" onclick="Evac.eta(\'' + v.id + '\',1)">' + ico('plus', 22) + '1</button></div>'
    + '<div class="ev-presets">' + [5, 10, 15, 20, 30].map(function(n){ return '<button aria-label="' + n + L(' minutes',' דקות') + '" onclick="Evac.etaSet(\'' + v.id + '\',' + n + ')">' + n + '</button>'; }).join('') + '</div>';
  return h + '</div>';
}
function ambCard(v){
  var m = sorted(members(v)), road = v.status === 'evacuating', done = v.status === 'athospital', open = !!state.manage[v.id], st = statusOf(v), hs = hospital(v), u = used(v);
  // status is a filled header band (icon + word), never a side line
  var h = '<section class="amb st-' + st.v + (road ? ' ev-road' : done ? ' done' : ' ev-card') + '">'
    + '<div class="amb-band">' + ico(st.icon, 26) + '<span>' + L(st.chip, st.chipHe) + '</span><b>' + name(v) + '</b></div>';
  if (done) return h + '<p class="amb-done">' + ico('check-check', 26) + '<span>' + L((v.casualties || []).length + ' handed over', (v.casualties || []).length + ' נמסרו') + (hs ? ' · ' + esc(L(hs.en, hs.he)) : '') + '</span></p></section>';
  var r = remaining(v), cls = r != null && r <= 60 ? 'now' : r != null && r <= 180 ? 'soon' : '';
  // the big number is a countdown, so it always carries its label and the clock time it lands on
  if (road || r != null) h += '<div class="amb-eta2 ' + cls + '"><small>' + ico('clock', 24) + (road ? L('Arrives at hospital in','מגיע לבית החולים בעוד') : L('Arrives at scene in','מגיע לזירה בעוד')) + '</small><b>' + etaMin(r) + '</b>' + (r != null && r > 0 ? '<em>' + L('about ','בערך ') + hhmm(Date.now() + r * 1000) + '</em>' : '') + '<span>' + ico('hospital', 26) + (hs ? esc(L(hs.en, hs.he)) : L('No hospital yet','אין בית חולים')) + '</span></div>';
  h += '<div class="amb-load">'
    + '<span class="amb-slot' + (u.litters >= v.litter ? ' full' : '') + '">' + ico('bed', 24) + '<b dir="ltr">' + u.litters + '/' + v.litter + '</b>' + L('litters','אלונקות') + '</span>'
    + '<span class="amb-slot' + (u.seats >= v.seats ? ' full' : '') + '">' + ico('armchair', 24) + '<b dir="ltr">' + u.seats + '/' + v.seats + '</b>' + L('seats','מושבים') + '</span></div>';
  if (m.length) h += '<div class="ev-pts">' + m.map(function(c){ return onboardRow(c, v); }).join('') + '</div>';
  if (road) h += '<button class="xbtn xbtn-primary amb-go" onclick="Evac.open(\'' + v.id + '\')">' + ico('navigation', 28) + L('Transport screen','מסך הובלה') + '</button>';
  else {
    h += '<button class="xbtn xbtn-primary ev-assign amb-go" onclick="Evac.assign(\'' + v.id + '\')">' + ico('plus', 28) + L('Load a casualty','העמסת נפגע') + '</button>';
    h += '<button class="amb-manage" aria-expanded="' + open + '" onclick="Evac.manage(\'' + v.id + '\')">' + ico('list-checks', 26) + '<span>' + L('Status, hospital, time','סטטוס, בית חולים, זמן') + '</span>' + ico(open ? 'chevron-down' : (lang() === 'he' ? 'chevron-left' : 'chevron-right'), 26) + '</button>';
    if (open) h += manageBody(v);
  }
  return h + '</section>';
}
function render(){
  var vs = vehicles();
  if (state.view){ var tv = veh(state.view); if (tv && tv.status === 'evacuating') return renderTransport(tv); state.view = null; }   // the transport screen only exists for a vehicle on the road (UNDO of DEPARTED must not strand it)
  var road = vs.filter(function(v){ return v.status === 'evacuating'; }), fleet = vs.filter(function(v){ return v.status !== 'evacuating' && v.status !== 'athospital'; }), done = vs.filter(function(v){ return v.status === 'athospital'; });
  var all = casualties(), onScene = all.filter(function(c){ return c.triageColor !== 'black' && !W.isCasualtyAssignedToVehicle(c); }).length;
  var moving = road.reduce(function(n, v){ return n + (v.casualties || []).length; }, 0), arrived = done.reduce(function(n, v){ return n + (v.casualties || []).length; }, 0);
  var h = '<h2 class="ev-title">' + L('Evacuate','פינוי') + '</h2>'
    + '<div class="ev-flow">'
    + '<span>' + ico('map-pin', 26) + '<b>' + onScene + '</b>' + L('on scene','בזירה') + '</span>'
    + '<span>' + ico('ambulance', 26) + '<b>' + moving + '</b>' + L('on the way','בדרך') + '</span>'
    + '<span>' + ico('hospital', 26) + '<b>' + arrived + '</b>' + L('at hospital','בבית חולים') + '</span></div>';
  // NEXT OUT: who, which ambulance, where, how long. Read at a glance, one button.
  var waiting = all.filter(function(c){ return c.triageColor === 'red' && !W.isCasualtyAssignedToVehicle(c); });
  var rp = rushPlan();
  if (waiting.length){
    var hq = (HOSPITALS.filter(function(x){ return x.ready && x.level === 'A'; }).sort(function(a, b){ return a.eta - b.eta; })[0] || HOSPITALS.filter(function(x){ return x.ready && x.trauma; }).sort(function(a, b){ return a.eta - b.eta; })[0] || HOSPITALS[0]);
    var who = rp ? rp.c : waiting[0];
    h += '<div class="amb-banner next-out" role="status">'
      + '<div class="no-head"><span class="no-tag">' + W.TriageUI.shapeSvg('oct', 22) + W.TriageUI.word('red') + '</span><span>' + L('Next out','הבא לפינוי') + '</span>' + (waiting.length > 1 ? '<em>' + L('+' + (waiting.length - 1) + ' more urgent','+' + (waiting.length - 1) + ' דחופים נוספים') + '</em>' : '') + '</div>'
      + '<div class="no-route">'
      +   '<div>' + ico('users', 30) + '<b>' + (W.casBadge ? W.casBadge(who) + ' ' : '') + esc(String(T(who.name)).split(' — ')[0]) + (W.casTag ? W.casTag(who) : '') + '</b></div>'
      +   (rp ? '<div>' + ico('ambulance', 30) + '<b>' + name(rp.v) + '</b>' + sceneLeg(rp.v) + '</div>'
              + '<div>' + ico('hospital', 30) + '<b>' + esc(L(hq.en, hq.he)) + lvlChip(hq) + '</b><i dir="ltr">' + hq.eta + L(' min',' ד׳') + '</i></div>'
            : '<div class="no-none">' + ico('triangle-alert', 30) + '<b>' + L('No free litter','אין אלונקה פנויה') + '</b></div>')
      + '</div>'
      + (rp ? '<button class="xbtn xbtn-primary ev-rush" onclick="Evac.rushAsk()">' + ico('ambulance', 30) + '<span><b>' + L('Load and go','העמסה ויציאה') + '</b></span></button>'
            : '<button class="xbtn xbtn-primary ev-rush ev-rush-add" onclick="Evac.addVehicle()">' + ico('plus', 30) + '<span><b>' + L('Add an ambulance','הוספת אמבולנס') + '</b></span></button>')
      + '</div>';
  }
  road.forEach(function(v){ h += ambCard(v); });
  fleet.forEach(function(v){ h += ambCard(v); });
  done.forEach(function(v){ h += ambCard(v); });
  h += '<div class="ev-more"><button class="xbtn xbtn-lg ev-addveh" onclick="Evac.addVehicle()">' + ico('plus', 28) + L('Ambulance','אמבולנס') + '</button>';
  h += '<button class="xbtn xbtn-lg" onclick="show9LineOverlay()">' + ico('radio', 28) + L('MEDEVAC 9-line','בקשת פינוי') + '</button></div>';
  return h;
}

// ── Transport screen ───────────────────────────────────────────
function renderTransport(v){
  var h = '', r = remaining(v), cls = r != null && r <= 60 ? 'now' : r != null && r <= 180 ? 'soon' : '', m = sorted(members(v)), hosp = hospital(v);
  var counts = {}; m.forEach(function(c){ counts[c.triageColor] = (counts[c.triageColor] || 0) + 1; });
  h += '<div class="tp-top"><button class="xbtn" onclick="Evac.close()">' + ico(lang() === 'he' ? 'arrow-right' : 'arrow-left', 28) + L('Back','חזרה') + '</button><b>' + name(v) + '</b><button class="xbtn' + (state.driver ? ' on' : '') + '" aria-pressed="' + state.driver + '" onclick="Evac.driver()">' + ico('navigation', 26) + L('Driver view','תצוגת נהג') + '</button></div>';
  h += '<div class="tp-eta ' + cls + '">' + (remaining(v) != null && remaining(v) <= 0 ? '<small>' + L('Time is up','הזמן עבר') + '</small><b class="w">' + L('Arriving now','מגיע עכשיו') + '</b>' : '<small>' + L('Arrives in','מגיע בעוד') + '</small><b dir="ltr">' + etaText(v) + '</b>') + '<span>' + (hosp ? esc(L(hosp.en, hosp.he)) : L('Choose a hospital','בחרו בית חולים')) + '</span>'
    + '<div class="tp-step"><button onclick="Evac.eta(\'' + v.id + '\',-1)">' + ico('minus', 22) + '1</button><button onclick="Evac.eta(\'' + v.id + '\',1)">' + ico('plus', 22) + '1</button><button onclick="Evac.eta(\'' + v.id + '\',5)">' + ico('plus', 22) + '5</button></div></div>';
  if (state.driver){
    var sirens = counts.red ? L('Yes: urgent on board','כן: דחוף על הסיפון') : L('No','לא');
    h += '<div class="tp-driver"><div><small>' + L('On board','על הסיפון') + '</small><b>' + m.length + '</b></div><div><small>' + L('URGENT','דחוף') + '</small><b>' + (counts.red || 0) + '</b></div><div><small>' + L('DELAYED','עדיפות שנייה') + '</small><b>' + (counts.yellow || 0) + '</b></div></div>'
      + '<div class="tp-siren ' + (counts.red ? 'yes' : '') + '"><small>' + L('Fast transport','הובלה מהירה') + '</small><b>' + sirens + '</b></div>';
  } else {
    h += '<div class="ev-h">' + L('On board','על הסיפון') + ' (' + m.length + ')</div><div class="tp-pts">' + m.map(function(c){
      var x = tq(c), mins = x ? Math.max(0, Math.round((Date.now() - Date.parse(x.time)) / 60000)) : null, lv = (W.latestVitals ? W.latestVitals(c.vitalsHistory || []) : (c.vitalsHistory || []).slice(-1)[0]) || {};
      return '<button class="tp-pt" onclick="Evac.openCasualty(\'' + esc(c._docId) + '\')">' + W.TriageUI.chip(c.triageColor, true) + '<span class="tp-pn"><b>' + (W.casBadge ? W.casBadge(c) + ' ' : '') + esc(String(T(c.name)).split(' — ')[0]) + '</b>'
        + (mins != null ? '<em>' + L('Tourniquet on ','חוסם עורקים ') + mins + L(' min',' ד׳') + '</em>' : '')
        + '<span class="tp-v">' + (lv.pulse != null ? '<em>HR <i>' + lv.pulse + '</i></em> ' : '') + (lv.bpSys ? '<em>BP <i>' + lv.bpSys + '/' + (lv.bpDia || '–') + '</i></em> ' : '') + (lv.spo2 ? '<em>SpO₂ <i>' + lv.spo2 + '</i></em>' : '') + '</span></span></button>';
    }).join('') + '</div>';
    h += '<div class="ev-h">' + L('Hospital','בית חולים') + '</div><div class="ev-hosp">' + HOSPITALS.map(function(x){
      var on = v.hospitalId === x.id;
      return '<button class="' + (on ? 'on' : '') + '" onclick="Evac.hospital(\'' + v.id + '\',\'' + x.id + '\')"><b>' + ico(on ? 'check' : 'hospital', 22) + esc(L(x.en, x.he)) + '</b><span>' + lvlChip(x) + x.eta + L(' min',' ד׳') + ' · <strong class="' + (x.ready ? 'rdy' : 'busy') + '">' + (x.ready ? L('Ready','מוכן') : L('Busy','עמוס')) + '</strong></span></button>';
    }).join('') + '</div>';
  }
  h += '<div class="tp-actions"><button class="xbtn" onclick="Evac.prealert(\'' + v.id + '\')">' + ico('radio', 28) + L('Pre-alert','התראה מקדימה') + '</button>'
    + '<button class="xbtn xbtn-primary" onclick="Evac.arrive(\'' + v.id + '\')">' + ico('hospital', 28) + L('Arrived at hospital','הגענו לבית החולים') + '</button></div>';
  return '<div class="tp">' + h + '</div>';
}

// ── Sheets ─────────────────────────────────────────────────────
function sheet(id, inner){
  var old = document.getElementById(id); if (old) old.remove();
  var el = document.createElement('div'); el.id = id; el.className = 'sheet-wrap no-polish';
  el.innerHTML = '<div class="sheet-dim" onclick="Evac.closeSheet(\'' + id + '\')"></div><div class="sheet" role="dialog">' + '<div class="sheet-grab"></div>' + inner + '</div>';
  app().appendChild(el); return el;
}
function assignSheet(v){
  var u = used(v), litterFree = v.litter - u.litters, seatFree = v.seats - u.seats;
  var avail = sorted(casualties().filter(function(c){ return c.triageColor !== 'black' && !W.isCasualtyAssignedToVehicle(c); }));
  var rows = avail.map(function(c){
    var needLitter = c.triageColor === 'red' || !!tq(c), full = litterFree <= 0 && seatFree <= 0;
    var pos = needLitter && litterFree > 0 ? 'litter' : (seatFree > 0 ? 'seat' : (litterFree > 0 ? 'litter' : null));
    return '<button class="sheet-row" ' + (pos ? '' : 'disabled') + ' onclick="Evac.doAssign(\'' + v.id + '\',\'' + esc(c._docId) + '\',\'' + pos + '\')">' + W.TriageUI.chip(c.triageColor)
      + '<span><b>' + (W.casBadge ? W.casBadge(c) + ' ' : '') + esc(String(T(c.name)).split(' — ')[0]) + '</b><small>' + (pos ? (pos === 'litter' ? L('Goes on a litter','על אלונקה') : L('Goes in a seat','במושב')) : L('No space left','אין מקום')) + (c.formLevel === 'quick' ? ' · ' + L('Quick triage','מיון מהיר') : '') + '</small></span></button>';
  }).join('');
  sheet('ev-assign-sheet', '<h3>' + L('Assign to ','שיוך ל-') + name(v) + '</h3><p class="sheet-p">' + L(litterFree + ' litter(s) and ' + seatFree + ' seat(s) free', litterFree + ' אלונקות ו-' + seatFree + ' מושבים פנויים') + '</p>'
    + (rows || '<p class="ev-empty">' + L('Everyone is already assigned.','כולם כבר משויכים.') + '</p>') + '<button class="xbtn f-cancel" onclick="Evac.closeSheet(\'ev-assign-sheet\')">' + ico('x', 24) + L('Close','סגור') + '</button>');
}

// ── Public API ─────────────────────────────────────────────────
var Evac = {
  seed: seed, render: render, etaText: etaText, state: state,
  reset: function(){ state.view = null; state.driver = false; },
  open: function(id){ var ot = document.getElementById('undo-toast'); if (ot) ot.remove(); state.view = id; rerender(); var c = document.getElementById('incident-content'); if (c) c.scrollTop = 0; },
  close: function(){ var ot = document.getElementById('undo-toast'); if (ot) ot.remove(); state.view = null; rerender(); },
  driver: function(){ var ot = document.getElementById('undo-toast'); if (ot) ot.remove(); state.driver = !state.driver; rerender(); },
  closeSheet: function(id){ var s = document.getElementById(id); if (s) s.remove(); },
  cap: function(id, kind, d){ var v = veh(id); if (!v) return; var k = kind === 'litter' ? 'litter' : 'seats', u = used(v), inUse = kind === 'litter' ? u.litters : u.seats; v[k] = Math.max(inUse, Math.min(12, (v[k] || 0) + d)); rerender(); },   // never fewer places than casualties already on board
  status: function(id, s){
    var v = veh(id); if (!v) return;
    if (s === 'evacuating'){
      if (!(v.casualties || []).length){ undoToast(L('Assign a casualty first','שייכו נפגע קודם')); return; }
      if (!v.hospitalId){ undoToast(L('Choose a hospital first','בחרו בית חולים קודם')); return; }
      if (v.etaMinutes == null){ var h = hospital(v); v.etaMinutes = h ? h.eta : 15; }
      v.etaStartAt = Date.now();
    }
    var prev = v.status, prevEta = [v.etaMinutes, v.etaStartAt], prevEv = (s === 'athospital' || prev === 'athospital') ? markEvacuated(v, s === 'athospital') : null; v.status = s; if (s === 'enroute') v._alertedOneMin = false;
    rerender();
    undoToast(L('Status: ', 'סטטוס: ') + L(STATUS.filter(function(x){ return x.v === s; })[0].en, STATUS.filter(function(x){ return x.v === s; })[0].he), function(){ v.status = prev; v.etaMinutes = prevEta[0]; v.etaStartAt = prevEta[1]; if (prevEv) restoreEvac(prevEv); rerender(); });
    if (s === 'evacuating') setTimeout(function(){ state.view = id; rerender(); var c = document.getElementById('incident-content'); if (c) c.scrollTop = 0; }, 250);   // not Evac.open: that would remove the undo toast
  },
  hospital: function(id, hid){ var v = veh(id); if (!v) return; var ot = document.getElementById('undo-toast'); if (ot) ot.remove(); var hh = HOSPITALS.filter(function(x){ return x.id === hid; })[0]; if (hh && !hh.ready && arguments[2] !== true){ sheet('ev-busy-sheet', '<h3>' + ico('triangle-alert', 28) + L(hh.en + ' is busy','' + hh.he + ' עמוס') + '</h3><p class="ev-busy-p">' + L('Send casualties there anyway?','לשלוח לשם נפגעים בכל זאת?') + '</p>'
      + '<button class="xbtn xbtn-primary" onclick="Evac.closeSheet(\'ev-busy-sheet\');Evac.hospital(\'' + id + '\',\'' + hid + '\',true)">' + ico('check', 26) + L('Send anyway','לשלוח בכל זאת') + '</button>'
      + '<button class="xbtn" onclick="Evac.closeSheet(\'ev-busy-sheet\')">' + ico('x', 26) + L('Choose another','לבחור אחר') + '</button>'); return; }
    v.hospitalId = hid; var h = hospital(v); v.destination = h ? h.he : ''; if (v.status !== 'evacuating' && h) { v.etaMinutes = h.eta; v.etaStartAt = null; } rerender(); },
  eta: function(id, d){
    var v = veh(id); if (!v) return;
    var r = remaining(v); var newMin = Math.max(1, Math.round(((r != null ? r : (v.etaMinutes || 10) * 60) / 60) + d));
    v.etaMinutes = newMin; v.etaStartAt = Date.now(); v._a2 = v._a1 = false; rerender();
  },
  etaSet: function(id, n){ var v = veh(id); if (!v) return; v.etaMinutes = n; v.etaStartAt = Date.now(); v._a2 = v._a1 = false; rerender(); },
  assign: function(id){ var v = veh(id); if (v) assignSheet(v); },
  manage: function(id){ state.manage[id] = !state.manage[id]; rerender(); },
  // One tap: put the most urgent casualty still on scene on the best ambulance, pick the nearest ready trauma centre, depart.
  rushAsk: function(){
    var rp = rushPlan(); if (!rp) return;
    var h = (HOSPITALS.filter(function(x){ return x.ready && x.level === 'A'; }).sort(function(a, b){ return a.eta - b.eta; })[0] || HOSPITALS.filter(function(x){ return x.ready && x.trauma; }).sort(function(a, b){ return a.eta - b.eta; })[0] || HOSPITALS[0]);
    sheet('ev-rush-sheet', '<h3>' + L('Load and go?','העמסה ויציאה?') + '</h3>'
      + '<div class="rs-who">' + W.TriageUI.chip(rp.c.triageColor) + '<b>' + (W.casBadge ? W.casBadge(rp.c) + ' ' : '') + esc(String(T(rp.c.name)).split(' — ')[0]) + (W.casTag ? W.casTag(rp.c) : '') + '</b></div>'
      + '<div class="no-route rs-route"><div>' + ico('ambulance', 30) + '<b>' + name(rp.v) + '</b>' + sceneLeg(rp.v) + '</div><div>' + ico('hospital', 30) + '<b>' + esc(L(h.en, h.he)) + lvlChip(h) + '</b><i dir="ltr">' + h.eta + L(' min',' ד׳') + '</i></div></div>'
      + '<button class="xbtn xbtn-primary rs-go" onclick="Evac.closeSheet(\'ev-rush-sheet\');Evac.rush()">' + ico('check', 30) + L('Confirm · load and go','אישור · העמסה ויציאה') + '</button>'
      + '<button class="xbtn rs-other" onclick="Evac.closeSheet(\'ev-rush-sheet\');Evac.assign(\'' + rp.v.id + '\')">' + ico('users', 26) + L('Choose another casualty','בחירת נפגע אחר') + '</button>');
  },
  rush: function(){
    var rp = rushPlan(); if (!rp) return;
    var v = rp.v, c = rp.c, before = { cas:v.casualties.slice(), status:v.status, hid:v.hospitalId, dest:v.destination, eta:v.etaMinutes, at:v.etaStartAt };
    var h = (HOSPITALS.filter(function(x){ return x.ready && x.level === 'A'; }).sort(function(a, b){ return a.eta - b.eta; })[0] || HOSPITALS.filter(function(x){ return x.ready && x.trauma; }).sort(function(a, b){ return a.eta - b.eta; })[0] || HOSPITALS[0]);
    v.casualties.push({ docId:c._docId, name:c.name, pos:'litter' });
    var toScene = v.status === 'enroute' ? remaining(v) : null;
    if (toScene != null && toScene > 0){
      // the ambulance is still driving to the scene: the casualty is booked on it, it departs only after it arrives
      v.hospitalId = h.id; v.destination = h.he; rerender();
      var mn = Math.max(1, Math.ceil(toScene / 60));
      undoToast(esc(T(c.name)) + L(' booked on ' + name(v) + ': at the scene in ' + mn + ' min, then ' + h.eta + ' min to ',' שובץ ב' + name(v) + ': בזירה בעוד ' + mn + ' דק׳, ואז ' + h.eta + ' דק׳ ל-') + L(h.en, h.he), function(){ v.casualties = before.cas; v.hospitalId = before.hid; v.destination = before.dest; rerender(); });
      return;
    }
    v.hospitalId = h.id; v.destination = h.he; v.etaMinutes = h.eta; v.etaStartAt = Date.now(); v._a2 = v._a1 = false; v.status = 'evacuating';
    state.view = v.id; rerender();
    var cc = document.getElementById('incident-content'); if (cc) cc.scrollTop = 0;
    undoToast(esc(T(c.name)) + L(' is on the road to ',' בדרך ל-') + L(h.en, h.he), function(){ v.casualties = before.cas; v.status = before.status; v.hospitalId = before.hid; v.destination = before.dest; v.etaMinutes = before.eta; v.etaStartAt = before.at; state.view = null; rerender(); });
  },
  doAssign: function(id, docId, pos){
    var v = veh(id), c = byId(docId); if (!v || !c) return;
    Evac.closeSheet('ev-assign-sheet');
    v.casualties.push({ docId:docId, name:c.name, pos:pos });
    rerender();
    undoToast(esc(T(c.name)) + L(' → ',' ← ') + name(v), function(){ v.casualties = v.casualties.filter(function(i){ return i.docId !== docId; }); rerender(); });
  },
  remove: function(id, docId){
    var v = veh(id); if (!v) return; var item = (v.casualties || []).filter(function(i){ return i.docId === docId; })[0];
    v.casualties = v.casualties.filter(function(i){ return i.docId !== docId; }); rerender();
    undoToast(L('Removed from ','הוסר מ-') + name(v), function(){ v.casualties.push(item); rerender(); });
  },
  addVehicle: function(){
    var n = vehicles().length + 1;
    vehicles().push({ id:'v_' + Date.now().toString(36), type:'אמבולנס', typeKey:'', name:'', seats:4, litter:2, status:'enroute', destination:'', hospitalId:null, casualties:[], etaMinutes:8, etaStartAt:Date.now(), _alertedOneMin:false });
    rerender(); undoToast(L('Ambulance ' + n + ' added','אמבולנס ' + n + ' נוסף'));
  },
  openCasualty: function(docId){ W._incidentTab = 'evac'; W.editCasualtyById(docId); },
  prealert: function(id){
    var v = veh(id); if (!v) return; var h = hospital(v), m = sorted(members(v));
    var lines = m.map(function(c, i){
      var S = W.Bracelet ? W.Bracelet.snapshot(c) : {}, t = (S.tq && S.tq[0]) ? ' · TQ ' + hhmm(S.tq[0][1] * 1000) : '', lv = S.v || [];
      return '• ' + W.TriageUI.word(c.triageColor) + ' — ' + T(c.name) + t + (lv[0] != null ? ' · HR ' + lv[0] : '') + (lv[1] ? ' · BP ' + lv[1] + '/' + (lv[2] || '–') : '') + (lv[3] != null ? ' · SpO₂ ' + lv[3] : '');
    });
    var text = L('PRE-ALERT — ' + name(v) + ' → ' + (h ? h.en + (h.level ? ' (Level ' + h.level + ')' : '') : '?') + ' — ETA ' + etaWords(v) + ' — ' + m.length + (m.length === 1 ? ' casualty' : ' casualties'), 'התראה מקדימה — ' + name(v) + ' ← ' + (h ? h.he + (h.level ? ' (רמה ' + h.level + ')' : '') : '?') + ' — ETA ' + etaWords(v) + ' — ' + m.length + ' נפגעים') + '\n' + lines.join('\n');
    Evac._pre = text;
    sheet('ev-pre-sheet', '<h3>' + L('Pre-alert to hospital','התראה מקדימה לבית החולים') + '</h3><pre class="mist" dir="auto">' + esc(text) + '</pre><p class="mist-warn">' + esc(W.Disclaimer ? W.Disclaimer.short() : '') + '</p>'
      + '<div class="btn-row"><button class="xbtn" onclick="Evac.closeSheet(\'ev-pre-sheet\')">' + ico('x', 26) + L('Close','סגור') + '</button><button class="xbtn xbtn-primary" onclick="Evac.copyPre();Evac.closeSheet(\'ev-pre-sheet\')">' + ico('copy', 26) + L('Copy','העתק') + '</button></div>');
  },
  copyPre: function(){ try { navigator.clipboard.writeText(Evac._pre).catch(function(){ undoToast(L('Copy blocked by the browser','ההעתקה נחסמה בדפדפן')); }); } catch (x) { undoToast(L('Copy blocked by the browser','ההעתקה נחסמה בדפדפן')); } },
  arrive: function(id){
    sheet('ev-arrive-sheet', '<h3>' + L('ARRIVED AT THE HOSPITAL?','הגעתם לבית החולים?') + '</h3><p class="sheet-p">' + L('This hands the casualties over and closes the transport.','פעולה זו מעבירה את הנפגעים ומסיימת את ההובלה.') + '</p>'
      + '<div class="btn-row"><button class="xbtn" onclick="Evac.closeSheet(\'ev-arrive-sheet\')">' + L('Not yet','עדיין לא') + '</button><button class="xbtn xbtn-primary" onclick="Evac.doArrive(\'' + id + '\')">' + L('YES, HAND OVER','כן, מסרנו') + '</button></div>');
  },
  doArrive: function(id){ Evac.closeSheet('ev-arrive-sheet'); var v = veh(id); if (!v) return; var prev = v.status, prevEv = markEvacuated(v, true);
    v.status = 'athospital'; state.view = null; rerender(); undoToast(L('Handed over at hospital','נמסרו בבית החולים'), function(){ v.status = prev; restoreEvac(prevEv); state.view = prev === 'evacuating' ? id : null; rerender(); }); }
};
W.Evac = Evac;

var _slowTick = 0;
// Live clock: the Evacuate tab re-renders every second, the lists every 15 s; ETA alerts at 2 min and 1 min.
setInterval(function(){
  vehicles().forEach(function(v){
    if (v.status !== 'evacuating') return; var r = remaining(v); if (r == null) return;
    if (r <= 120 && !v._a2){ v._a2 = true; etaToast(name(v) + L(' — 2 MINUTES TO ARRIVAL',' — שתי דקות להגעה')); }
    if (r <= 60 && !v._a1){ v._a1 = true; etaToast(name(v) + L(' — 1 MINUTE TO ARRIVAL',' — דקה להגעה')); }
  });
  if (W._casualtyEditMode || !W.renderIncidentPage) return;
  if (W._incidentTab === 'evac') W.renderIncidentPage();
  else if ((W._incidentTab === 'status' || W._incidentTab === 'casualties') && ++_slowTick % 15 === 0) W.renderIncidentPage();   // tourniquet minutes and vitals ages must not freeze on the lists
}, 1000);
})();
