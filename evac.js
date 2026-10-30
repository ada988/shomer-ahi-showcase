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
function ico(n, s){ return W.Icon ? W.Icon(n, s) : ''; }
function esc(s){ return W.escapeHtml(s); }
function app(){ return document.getElementById('app'); }
function casualties(){ return W._incidentCasualties || []; }
function byId(id){ return casualties().filter(function(c){ return c._docId === id; })[0]; }
function vehicles(){ return W._mciVehicles; }
function veh(id){ return vehicles().filter(function(v){ return v.id === id; })[0]; }
function hhmm(ms){ var d = new Date(ms); return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }
function mmss(sec){ sec = Math.max(0, Math.round(sec)); return String(Math.floor(sec / 60)).padStart(2,'0') + ':' + String(sec % 60).padStart(2,'0'); }

var HOSPITALS = [
  { id:'h1', en:'City Trauma Center',      he:'מרכז טראומה עירוני',   eta:12, ready:true,  trauma:true },
  { id:'h2', en:'North General Hospital',  he:'בית חולים כללי צפון',  eta:18, ready:true,  trauma:false },
  { id:'h3', en:'Burns & Children Center', he:'מרכז כוויות וילדים',   eta:25, ready:false, trauma:true }
];
var STATUS = [
  { v:'enroute',    icon:'navigation', en:'COMING TO SCENE',  he:'בדרך לזירה' },
  { v:'arrived',    icon:'map-pin',    en:'AT SCENE · LOADING', he:'בזירה · העמסה' },
  { v:'evacuating', icon:'ambulance',  en:'DEPARTED · TO HOSPITAL', he:'יצא · לבית חולים' },
  { v:'athospital', icon:'hospital',   en:'AT HOSPITAL', he:'בבית חולים' }
];
var state = { driver:false, view:null, picker:null };

// ── Helpers ────────────────────────────────────────────────────
function name(v){ return v.name || (L('AMBULANCE ','אמבולנס ') + (vehicles().indexOf(v) + 1)); }
function rushPlan(){
  var c = casualties().filter(function(x){ return x.triageColor === 'red' && !W.isCasualtyAssignedToVehicle(x); })[0];
  if (!c) return null;
  var rank = { arrived:0, enroute:1 };
  var v = vehicles().filter(function(x){ return (x.status === 'arrived' || x.status === 'enroute') && used(x).litters < (x.litter || 0); })
    .sort(function(a, b){ return (rank[a.status] || 9) - (rank[b.status] || 9); })[0];
  return v ? { c:c, v:v } : null;
}
function used(v){ var s = 0, l = 0; (v.casualties || []).forEach(function(i){ if (i && i.pos === 'litter') l++; else s++; }); return { seats:s, litters:l }; }
function hospital(v){ return HOSPITALS.filter(function(h){ return h.id === v.hospitalId; })[0]; }
function remaining(v){ return v.etaMinutes != null && v.etaStartAt ? v.etaMinutes * 60 - (Date.now() - v.etaStartAt) / 1000 : null; }
function etaText(v){ var r = remaining(v); if (r == null) return '—'; return r <= 0 ? L('ARRIVING','מגיע') : mmss(r); }
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
  el.innerHTML = '<span>' + msg + '</span>' + (fn ? '<button>' + L('UNDO','בטל') + '</button>' : '');
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
  vehicles().push({ id:'v_a2', type:'אמבולנס', typeKey:'', name:'', seats:4, litter:2, status:'evacuating', destination:'', hospitalId:'h1', casualties:[{ docId:'demo_c3', pos:'litter' }, { docId:'demo_c4', pos:'seat' }], etaMinutes:12, etaStartAt:now - 3 * 60000, _alertedOneMin:false });
}

// ── Fleet board ────────────────────────────────────────────────
function seatCounter(v, kind){
  var u = used(v), total = kind === 'litter' ? v.litter : v.seats, n = kind === 'litter' ? u.litters : u.seats;
  var label = kind === 'litter' ? L('LITTERS','אלונקות') : L('SEATS','מושבים');
  return '<div class="ev-cap"><small>' + label + '</small><div><button aria-label="-" onclick="Evac.cap(\'' + v.id + '\',\'' + kind + '\',-1)">−</button><b class="' + (n > total ? 'over' : '') + '">' + n + ' / ' + total + '</b><button aria-label="+" onclick="Evac.cap(\'' + v.id + '\',\'' + kind + '\',1)">+</button></div></div>';
}
function onboardRow(c, v){
  var t = tq(c), tqMin = t ? Math.max(0, Math.round((Date.now() - Date.parse(t.time)) / 60000)) : null;
  return '<div class="ev-pt">' + W.TriageUI.chip(c.triageColor) + '<span><b>' + esc(T(c.name)) + '</b>' + (c.formLevel === 'quick' ? '<small>' + L('QUICK TRIAGE','מיון מהיר') + '</small>' : '') + (tqMin != null ? '<small>' + L('TOURNIQUET ','חוסם עורקים ') + tqMin + L(' MIN',' ד׳') + '</small>' : '') + '</span>'
    + (v.status !== 'evacuating' ? '<button class="ev-rm" onclick="Evac.remove(\'' + v.id + '\',\'' + esc(c._docId) + '\')">' + L('REMOVE','הסר') + '</button>' : '') + '</div>';
}
function transportCard(v){
  var h = hospital(v), r = remaining(v), cls = r != null && r <= 60 ? 'now' : r != null && r <= 180 ? 'soon' : '';
  var m = sorted(members(v));
  return '<section class="ev-road"><div class="ev-road-h">' + ico('ambulance', 30) + '<b>' + name(v) + '</b><em>' + L('ON THE ROAD','בדרך') + '</em></div>'
    + '<div class="ev-eta ' + cls + '"><small>' + L('ARRIVES IN','מגיע בעוד') + '</small><b>' + etaText(v) + '</b><span>' + (h ? esc(L(h.en, h.he)) : L('Hospital not chosen','לא נבחר בית חולים')) + '</span></div>'
    + '<div class="ev-pts">' + m.map(function(c){ return onboardRow(c, v); }).join('') + '</div>'
    + '<button class="xbtn xbtn-primary" onclick="Evac.open(\'' + v.id + '\')">' + ico('navigation', 28) + L('OPEN TRANSPORT SCREEN','פתח מסך הובלה') + '</button></section>';
}
function fleetCard(v){
  var u = used(v), m = sorted(members(v));
  var h = '<section class="ev-card"><div class="ev-card-h"><b>' + name(v) + '</b></div>';
  // status — 4 plain words, 2x2
  h += '<div class="ev-h">' + L('STATUS','סטטוס') + '</div><div class="ev-status">' + STATUS.map(function(s){
    var on = v.status === s.v;
    return '<button class="' + (on ? 'on' : '') + '" aria-pressed="' + on + '" onclick="Evac.status(\'' + v.id + '\',\'' + s.v + '\')">' + ico(s.icon, 28) + '<span>' + L(s.en, s.he) + '</span></button>';
  }).join('') + '</div>';
  // capacity
  h += '<div class="ev-caps">' + seatCounter(v, 'litter') + seatCounter(v, 'seat') + '</div>';
  // on board
  h += '<div class="ev-h">' + L('ON BOARD','על הסיפון') + ' (' + m.length + ')</div>';
  h += m.length ? '<div class="ev-pts">' + m.map(function(c){ return onboardRow(c, v); }).join('') + '</div>' : '<p class="ev-empty">' + L('Nobody on board yet.','אין עדיין נפגעים על הסיפון.') + '</p>';
  h += '<button class="xbtn xbtn-primary ev-assign" onclick="Evac.assign(\'' + v.id + '\')">' + ico('plus', 28) + L('ASSIGN A CASUALTY','שייך נפגע') + '</button>';
  // hospital
  h += '<div class="ev-h">' + L('HOSPITAL','בית חולים') + '</div><div class="ev-hosp">' + HOSPITALS.map(function(x){
    var on = v.hospitalId === x.id;
    return '<button class="' + (on ? 'on' : '') + '" aria-pressed="' + on + '" onclick="Evac.hospital(\'' + v.id + '\',\'' + x.id + '\')"><b>' + esc(L(x.en, x.he)) + '</b><span>' + x.eta + L(' MIN',' ד׳') + (x.trauma ? ' · ' + L('TRAUMA','טראומה') : '') + ' · <strong class="' + (x.ready ? 'rdy' : 'busy') + '">' + (x.ready ? L('READY','מוכן') : L('BUSY','עמוס')) + '</strong></span></button>';
  }).join('') + '</div>';
  // ETA
  h += '<div class="ev-h">' + L('TIME TO ARRIVE (MIN)','זמן הגעה (דק׳)') + '</div><div class="ev-eta-set"><button onclick="Evac.eta(\'' + v.id + '\',-1)">−1</button><b>' + (v.etaMinutes != null ? etaText(v) : '—') + '</b><button onclick="Evac.eta(\'' + v.id + '\',1)">+1</button></div>'
    + '<div class="ev-presets">' + [5, 10, 15, 20, 30].map(function(n){ return '<button onclick="Evac.etaSet(\'' + v.id + '\',' + n + ')">' + n + '</button>'; }).join('') + '</div>';
  return h + '</section>';
}
function render(){
  var vs = vehicles();
  if (state.view){ var tv = veh(state.view); if (tv && tv.status === 'evacuating') return renderTransport(tv); state.view = null; }   // the transport screen only exists for a vehicle on the road (UNDO of DEPARTED must not strand it)
  var road = vs.filter(function(v){ return v.status === 'evacuating'; }), fleet = vs.filter(function(v){ return v.status !== 'evacuating' && v.status !== 'athospital'; }), done = vs.filter(function(v){ return v.status === 'athospital'; });
  var h = '<div class="pl-head"><div><h2>' + L('Evacuate','פינוי') + '</h2><p>' + L('Who is on which ambulance, and when they arrive.','מי על איזה אמבולנס, ומתי יגיעו.') + '</p></div></div>';
  var waiting = casualties().filter(function(c){ return c.triageColor === 'red' && !W.isCasualtyAssignedToVehicle(c); }).length;
  if (waiting) h += '<div class="b-alert ev-alert">' + ico('triangle-alert', 30) + '<span>' + L(waiting + ' URGENT ' + (waiting > 1 ? 'CASUALTIES' : 'CASUALTY') + ' STILL ON SCENE', waiting + ' נפגעים דחופים עדיין בזירה') + '</span></div>';
  var rp = rushPlan();
  if (rp) h += '<button class="ev-rush" onclick="Evac.rush()">' + ico('ambulance', 34) + '<span><b>' + L('LOAD AND GO','העמסה ויציאה') + '</b><small>' + esc(T(rp.c.name)) + L(' on ',' על ') + name(rp.v) + L(' · nearest trauma center',' · מרכז הטראומה הקרוב') + '</small></span></button>';
  road.forEach(function(v){ h += transportCard(v); });
  fleet.forEach(function(v){ h += fleetCard(v); });
  done.forEach(function(v){ h += '<section class="ev-card done"><b>' + name(v) + '</b><span>' + L('AT HOSPITAL — handed over','בבית חולים — נמסרו') + ' (' + (v.casualties || []).length + ')</span></section>'; });
  h += '<button class="xbtn xbtn-lg ev-addveh" onclick="Evac.addVehicle()">' + ico('plus', 28) + L('ADD AN AMBULANCE','הוספת אמבולנס') + '</button>';
  h += '<button class="xbtn xbtn-lg" onclick="show9LineOverlay()">' + ico('radio', 28) + L('REQUEST MEDEVAC (9-LINE)','בקשת פינוי (9 שורות)') + '</button>';
  return h;
}

// ── Transport screen ───────────────────────────────────────────
function renderTransport(v){
  var h = '', r = remaining(v), cls = r != null && r <= 60 ? 'now' : r != null && r <= 180 ? 'soon' : '', m = sorted(members(v)), hosp = hospital(v);
  var counts = {}; m.forEach(function(c){ counts[c.triageColor] = (counts[c.triageColor] || 0) + 1; });
  h += '<div class="tp-top"><button class="xbtn" onclick="Evac.close()">' + ico(lang() === 'he' ? 'arrow-right' : 'arrow-left', 28) + L('BACK','חזרה') + '</button><b>' + name(v) + '</b><button class="xbtn' + (state.driver ? ' on' : '') + '" aria-pressed="' + state.driver + '" onclick="Evac.driver()">' + L('DRIVER VIEW','תצוגת נהג') + '</button></div>';
  h += '<div class="tp-eta ' + cls + '"><small>' + L('ARRIVE IN','הגעה בעוד') + '</small><b>' + etaText(v) + '</b><span>' + (hosp ? esc(L(hosp.en, hosp.he)) : L('Choose a hospital','בחרו בית חולים')) + '</span>'
    + '<div class="tp-step"><button onclick="Evac.eta(\'' + v.id + '\',-1)">−1</button><button onclick="Evac.eta(\'' + v.id + '\',1)">+1</button><button onclick="Evac.eta(\'' + v.id + '\',5)">+5</button></div></div>';
  if (state.driver){
    var sirens = counts.red ? L('YES — URGENT ON BOARD','כן — דחוף על הסיפון') : L('NO','לא');
    h += '<div class="tp-driver"><div><small>' + L('ON BOARD','על הסיפון') + '</small><b>' + m.length + '</b></div><div><small>' + L('URGENT','דחוף') + '</small><b>' + (counts.red || 0) + '</b></div><div><small>' + L('DELAYED','דחוי') + '</small><b>' + (counts.yellow || 0) + '</b></div></div>'
      + '<div class="tp-siren ' + (counts.red ? 'yes' : '') + '"><small>' + L('FAST TRANSPORT','הובלה מהירה') + '</small><b>' + sirens + '</b></div>';
  } else {
    h += '<div class="ev-h">' + L('ON BOARD','על הסיפון') + ' (' + m.length + ')</div><div class="tp-pts">' + m.map(function(c){
      var x = tq(c), mins = x ? Math.max(0, Math.round((Date.now() - Date.parse(x.time)) / 60000)) : null, lv = (c.vitalsHistory || []).slice(-1)[0] || {};
      return '<button class="tp-pt" onclick="Evac.openCasualty(\'' + esc(c._docId) + '\')">' + W.TriageUI.chip(c.triageColor, true) + '<span class="tp-pn"><b>' + esc(T(c.name)) + '</b>'
        + (mins != null ? '<em>' + L('TOURNIQUET ON ','חוסם עורקים ') + mins + L(' MIN',' ד׳') + '</em>' : '')
        + '<span class="tp-v">' + (lv.pulse != null ? 'HR <i>' + lv.pulse + '</i> ' : '') + (lv.bpSys ? 'BP <i>' + lv.bpSys + '/' + (lv.bpDia || '–') + '</i> ' : '') + (lv.spo2 ? 'SpO₂ <i>' + lv.spo2 + '</i>' : '') + '</span></span></button>';
    }).join('') + '</div>';
    h += '<div class="ev-h">' + L('HOSPITAL','בית חולים') + '</div><div class="ev-hosp">' + HOSPITALS.map(function(x){
      var on = v.hospitalId === x.id;
      return '<button class="' + (on ? 'on' : '') + '" onclick="Evac.hospital(\'' + v.id + '\',\'' + x.id + '\')"><b>' + esc(L(x.en, x.he)) + '</b><span>' + x.eta + L(' MIN',' ד׳') + ' · <strong class="' + (x.ready ? 'rdy' : 'busy') + '">' + (x.ready ? L('READY','מוכן') : L('BUSY','עמוס')) + '</strong></span></button>';
    }).join('') + '</div>';
  }
  h += '<div class="tp-actions"><button class="xbtn" onclick="Evac.prealert(\'' + v.id + '\')">' + ico('radio', 28) + L('PRE-ALERT','התראה מקדימה') + '</button>'
    + '<button class="xbtn xbtn-primary" onclick="Evac.arrive(\'' + v.id + '\')">' + ico('hospital', 28) + L('ARRIVED AT HOSPITAL','הגענו לבית החולים') + '</button></div>';
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
      + '<span><b>' + esc(T(c.name)) + '</b><small>' + (pos ? (pos === 'litter' ? L('goes on a LITTER','על אלונקה') : L('goes in a SEAT','במושב')) : L('NO SPACE LEFT','אין מקום')) + (c.formLevel === 'quick' ? ' · ' + L('QUICK TRIAGE','מיון מהיר') : '') + '</small></span></button>';
  }).join('');
  sheet('ev-assign-sheet', '<h3>' + L('ASSIGN TO ','שיוך ל-') + name(v) + '</h3><p class="sheet-p">' + L(litterFree + ' litter(s) and ' + seatFree + ' seat(s) free', litterFree + ' אלונקות ו-' + seatFree + ' מושבים פנויים') + '</p>'
    + (rows || '<p class="ev-empty">' + L('Everyone is already assigned.','כולם כבר משויכים.') + '</p>') + '<button class="xbtn f-cancel" onclick="Evac.closeSheet(\'ev-assign-sheet\')">' + L('CLOSE','סגור') + '</button>');
}

// ── Public API ─────────────────────────────────────────────────
var Evac = {
  seed: seed, render: render, etaText: etaText, state: state,
  reset: function(){ state.view = null; state.driver = false; },
  open: function(id){ state.view = id; rerender(); var c = document.getElementById('incident-content'); if (c) c.scrollTop = 0; },
  close: function(){ state.view = null; rerender(); },
  driver: function(){ state.driver = !state.driver; rerender(); },
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
    if (s === 'evacuating') setTimeout(function(){ Evac.open(id); }, 250);
  },
  hospital: function(id, hid){ var v = veh(id); if (!v) return; var ot = document.getElementById('undo-toast'); if (ot) ot.remove(); var hh = HOSPITALS.filter(function(x){ return x.id === hid; })[0]; if (hh && !hh.ready && !window.confirm(L(hh.en + ' is BUSY. Send casualties there anyway?', hh.he + ' עמוס. לשלוח לשם בכל זאת?'))) return; v.hospitalId = hid; var h = hospital(v); v.destination = h ? h.he : ''; if (v.status !== 'evacuating' && h) { v.etaMinutes = h.eta; v.etaStartAt = null; } rerender(); },
  eta: function(id, d){
    var v = veh(id); if (!v) return;
    var r = remaining(v); var newMin = Math.max(1, Math.round(((r != null ? r : (v.etaMinutes || 10) * 60) / 60) + d));
    v.etaMinutes = newMin; v.etaStartAt = Date.now(); v._a2 = v._a1 = false; rerender();
  },
  etaSet: function(id, n){ var v = veh(id); if (!v) return; v.etaMinutes = n; v.etaStartAt = Date.now(); v._a2 = v._a1 = false; rerender(); },
  assign: function(id){ var v = veh(id); if (v) assignSheet(v); },
  // One tap: put the most urgent casualty still on scene on the best ambulance, pick the nearest ready trauma centre, depart.
  rush: function(){
    var rp = rushPlan(); if (!rp) return;
    var v = rp.v, c = rp.c, before = { cas:v.casualties.slice(), status:v.status, hid:v.hospitalId, dest:v.destination, eta:v.etaMinutes, at:v.etaStartAt };
    var h = HOSPITALS.filter(function(x){ return x.ready && x.trauma; }).sort(function(a, b){ return a.eta - b.eta; })[0] || HOSPITALS[0];
    v.casualties.push({ docId:c._docId, name:c.name, pos:'litter' });
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
      return (i + 1) + '. ' + W.TriageUI.word(c.triageColor) + ' — ' + T(c.name) + t + (lv[0] != null ? ' · HR ' + lv[0] : '') + (lv[1] ? ' · BP ' + lv[1] + '/' + (lv[2] || '–') : '') + (lv[3] != null ? ' · SpO₂ ' + lv[3] : '');
    });
    var text = L('PRE-ALERT — ' + name(v) + ' → ' + (h ? h.en : '?') + ' — ETA ' + etaText(v) + ' — ' + m.length + (m.length === 1 ? ' casualty' : ' casualties'), 'התראה מקדימה — ' + name(v) + ' ← ' + (h ? h.he : '?') + ' — ETA ' + etaText(v) + ' — ' + m.length + ' נפגעים') + '\n' + lines.join('\n');
    Evac._pre = text;
    sheet('ev-pre-sheet', '<h3>' + L('PRE-ALERT TO HOSPITAL','התראה מקדימה לבית החולים') + '</h3><pre class="mist" dir="auto">' + esc(text) + '</pre><p class="mist-warn">' + esc(W.Disclaimer ? W.Disclaimer.short() : '') + '</p>'
      + '<div class="btn-row"><button class="xbtn" onclick="Evac.closeSheet(\'ev-pre-sheet\')">' + L('CLOSE','סגור') + '</button><button class="xbtn xbtn-primary" onclick="Evac.copyPre();Evac.closeSheet(\'ev-pre-sheet\')">' + ico('copy', 26) + L('COPY','העתק') + '</button></div>');
  },
  copyPre: function(){ try { navigator.clipboard.writeText(Evac._pre).catch(function(){ undoToast(L('Copy blocked by the browser','ההעתקה נחסמה בדפדפן')); }); } catch (x) { undoToast(L('Copy blocked by the browser','ההעתקה נחסמה בדפדפן')); } },
  arrive: function(id){
    sheet('ev-arrive-sheet', '<h3>' + L('ARRIVED AT THE HOSPITAL?','הגעתם לבית החולים?') + '</h3><p class="sheet-p">' + L('This hands the casualties over and closes the transport.','פעולה זו מעבירה את הנפגעים ומסיימת את ההובלה.') + '</p>'
      + '<div class="btn-row"><button class="xbtn" onclick="Evac.closeSheet(\'ev-arrive-sheet\')">' + L('NOT YET','עדיין לא') + '</button><button class="xbtn xbtn-primary" onclick="Evac.doArrive(\'' + id + '\')">' + L('YES, HAND OVER','כן, מסרנו') + '</button></div>');
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
