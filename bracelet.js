/* Casualty bracelets: QR payload, bracelet design, print sheet, camera scanner, scan-result card.
   The QR carries a compact snapshot of the casualty itself (not just an ID), so a scan works
   offline and on any device — exactly the property that matters in the field. */
(function(){
'use strict';
var W = window;

// Demo casualty → pre-allocated bracelet serial (same pool the full app prints from).
var SERIALS = { demo_c1:'JFU-PQJ', demo_c2:'TSH-H69', demo_c3:'KQB-E6F', demo_c4:'QFC-4LE', demo_c5:'GC9-YQD', demo_c6:'G4J-BNN' };

function lang(){ return (W.ShowcaseI18n && W.ShowcaseI18n.lang) || 'en'; }
function L(en, he){ return lang() === 'he' ? he : en; }
function T(s){ return (W.ShowcaseI18n && s != null) ? W.ShowcaseI18n.tr(s) : s; }
function esc(s){ return W.escapeHtml ? W.escapeHtml(s) : String(s == null ? '' : s); }
function ico(n, s, c){ return W.Icon ? W.Icon(n, s, c) : ''; }
function hhmm(sec){ if (sec == null || !isFinite(sec)) return '--:--'; var d = new Date(sec * 1000); return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }
function ago(sec){ var m = Math.max(0, Math.round((Date.now()/1000 - sec) / 60)); if (m < 1) return L('just now','זה עתה'); if (m < 60) return m + L(' min ago',' ד׳ לפני'); return Math.floor(m/60) + L(' h ',' ש׳ ') + (m%60) + L(' min ago',' ד׳ לפני'); }

var TRIAGE = {
  red:    { c:'#cc1820', en:'URGENT', he:'דחוף', code:'T1', sh:'oct', tx:'#fff' },
  yellow: { c:'#ffd400', en:'DELAYED', he:'עדיפות שנייה', code:'T2', sh:'tri', tx:'#111' },
  green:  { c:'#19c37d', en:'NOT URGENT', he:'לא דחוף', code:'T3', sh:'circ', tx:'#06140d' },
  gray:   { c:'#b4bbc8', en:'WAITING', he:'ממתין', code:'T4', sh:'hex', tx:'#111' },
  black:  { c:'#000000', en:'WAITING', he:'ממתין', code:'T0', sh:'sqx', tx:'#fff' }
};
TRIAGE.gray = TRIAGE.black;   // one category, "Waiting"; old gray records read as black
function own(o, k){ return Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined; }
function triageOf(t){ return own(TRIAGE, t) || { c:'#6b7078', en:'NOT TRIAGED', he:'טרם סווג', code:'—', sh:'circ', tx:'#fff' }; }

// ── Serial assignment ──────────────────────────────────────────
function serialFor(c){
  if (!c) return '';
  if (c.braceletSerial) return c.braceletSerial;
  if (SERIALS[c._docId]) return SERIALS[c._docId];
  var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', h = 2166136261, id = String(c._docId || c.name || Math.random());
  for (var i = 0; i < id.length; i++){ h ^= id.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  var s = ''; for (var k = 0; k < 6; k++){ s += A[h % A.length]; h = Math.imul(h ^ (h >>> 7), 2654435761) >>> 0; }
  return s.slice(0,3) + '-' + s.slice(3);
}

// ── Snapshot (what the QR carries) ─────────────────────────────
function sec(iso){ var t = Date.parse(iso); return isNaN(t) ? null : Math.round(t / 1000); }
// null / undefined / '' / NaN = not measured. 0 is a real value (no pulse, apnoea) and must survive the round trip.
function hv(x){ return x !== null && x !== undefined && x !== '' && !(typeof x === 'number' && isNaN(x)); }
function nn(x){ return hv(x) ? x : null; }
// Body-map treatments only store a clock string ("15:49"): read it as "today", or yesterday if that would be in the future.
function clockSec(str){
  var m = /^(\d{1,2}):(\d{2})/.exec(String(str || '')); if (!m) return null;
  var d = new Date(); d.setHours(+m[1], +m[2], 0, 0);
  var s = Math.round(d.getTime() / 1000);
  return s > Date.now() / 1000 + 600 ? s - 86400 : s;
}
var BT_TYPES = ['chestSeal', 'splint', 'bandage', 'custom'];
function snapshot(c){
  var x = c.xabcde || c.xcare || {}, e = x.e || {}, xx = x.x || {}, a = x.a || {}, b = x.b || {}, cc = x.c || {}, d = x.d || {};
  var v = (W.latestVitals ? W.latestVitals(c.vitalsHistory || []) : (c.vitalsHistory || []).slice(-1)[0]) || {};   // latest value per field
  var sys = nn(v.bpSys), dia = nn(v.bpDia);
  if (sys == null && v.bp){ var pm = String(v.bp).match(/^(\d+)\/(\d+)?/); if (pm){ sys = +pm[1]; dia = pm[2] ? +pm[2] : null; } }
  var g = d.gcsDetail, pu = d.pupils || {};
  var pup = function(p){ return p && (hv(p.size) || p.reactive != null) ? [nn(p.size), p.reactive === true ? 1 : p.reactive === false ? 0 : null] : null; };
  var side = function(o){ return o ? [o.side || '', sec(o.time)] : null; };
  var s = {
    s: serialFor(c), n: String(c.name || '').slice(0, 60), t: c.triageColor || '', m: c.moi || '', p: c.evacPriority || '',
    ag: nn(e.ageYears), wt: nn(e.weightKg), sx: e.sex || '',
    inj: (c.injuries || []).map(function(i){ return [i.region, i.type]; }),
    tq: (xx.tourniquets || []).map(function(q){ return [q.site, sec(q.time)]; }),
    hm: (xx.hemostatic || []).map(function(q){ return [q.site || '', sec(q.time)]; }),
    pd: (xx.pressureDressings || []).map(function(q){ return [q.site || '', sec(q.time)]; }),
    wp: (xx.woundPacking || []).map(function(q){ return [q.site || '', sec(q.time)]; }),
    aw: [a.status || '', (a.interventions || []).map(function(i){ var t = i.type || i.label || ''; return t === 'אינטובציה' && i.outcome ? t + (i.outcome === 'success' ? ' (הצליח)' : ' (נכשל)') : t === 'נתיב כירורגי' && i.method ? t + (i.method === 'needle' ? ' (מחט)' : ' (כירורגי)') : t; }).slice(-8)],
    tt: side(b.tubeThora), nd: side(b.needleDecompression),
    ox: (b.oxygen || hv(b.o2Lpm)) ? 1 : 0, o2: nn(b.o2Lpm), bv: b.bvm ? (sec(b.bvm.time) || sec(new Date().toISOString())) : null,
    pb: e.pelvicBinder ? (sec(e.pelvicBinder.time) || sec(new Date().toISOString())) : null,
    bt: (c.treatments || []).filter(function(t){ return BT_TYPES.indexOf(t.type) >= 0; }).map(function(t){ return [t.type, t.region, clockSec(t.time)]; }),
    iv: (cc.ivAccess || []).map(function(i){ return [i.site, sec(i.time)]; }),
    fl: (cc.fluids || []).map(function(f){ return [f.type, f.volume, sec(f.time)]; }),
    md: (e.medications || []).map(function(m){ return [m.drug || m.name, m.dose, m.route, sec(m.time)]; }),
    hy: e.hypothermiaPrevention || '',
    av: d.avpu || '', g: nn(d.gcs), gd: (g && hv(g.eye) && hv(g.verbal) && hv(g.motor)) ? [g.eye, g.verbal, g.motor] : null,
    pu: [pup(pu.left), pup(pu.right)],
    v: [nn(v.pulse), sys, dia, nn(v.spo2), nn(v.rr), nn(v.temp), sec(v.time || v.t), nn(v.etco2), v.radialPulse || ''],
    pc: cc.pulseCharacter || '', cr: nn(cc.capRefill),
    al: e.allergies || '', np: e.npo ? 1 : 0, lo: (e.lastOral && e.lastOral !== 'לא ידוע') ? e.lastOral : '', ti: sec(e.timeOfInjury), pg: e.pregnant === true ? 1 : e.pregnant === false ? 0 : null,
    ep: e.evacPlan || '', ps: nn(c.painScore), nl: sec(e.noSignsOfLifeAt), an: e.anticoag || '',
    pr: (e.procedures || []).map(function(q){ return [q.label + (q.side === 'R' ? ' ימין' : q.side === 'L' ? ' שמאל' : ''), sec(q.time), q.k === 'tsd' ? 'R' : 'E']; }).slice(-12),
    t0: Math.round(Date.now() / 1000)
  };
  return s;
}
function b64u(str){
  var bytes = new TextEncoder().encode(str), bin = '';
  bytes.forEach(function(b){ bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function unb64u(s){
  s = s.replace(/-/g,'+').replace(/_/g,'/'); while (s.length % 4) s += '=';
  var bin = atob(s), bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// ── Compact wire format (keeps the QR small enough to scan from a printed strip) ──
// Positional JSON array, element 0 = format version. v2 (current) adds consciousness details, airway / chest / pelvic
// interventions, allergies / NPO / time of injury and indexes drug, IV-site, fluid, pulse and hypothermia codes.
// v1 payloads (older printed bracelets / links) still decode: unpack() dispatches on a[0].
var TRI_IDS = ['', 'red', 'yellow', 'green', 'gray', 'black'], EVAC_IDS = ['', 'immediate', 'urgent', 'routine', 'expectant'], AW_IDS = ['', 'clear', 'obstructed', 'compromised'];
var AVPU_IDS = ['', 'A', 'V', 'P', 'U'], PC_IDS = ['', 'strong', 'weak', 'absent', 'normal'], HY_IDS = ['', 'HPMK', 'blanket'], RP_IDS = ['', 'strong', 'weak', 'absent', 'present', 'normal'];
var AWI_IDS = ['NPA', 'OPA', 'SGA (i-gel)', 'אינטובציה', 'נתיב כירורגי', 'הרמת סנטר', 'הרמת לסת', 'תנוחת התאוששות', 'שאיבת הפרשות'];
var IVS_IDS = ['יד R', 'יד L', 'AC R', 'AC L', 'EJ R', 'EJ L', 'IO hum-R', 'IO hum-L', 'IO tib-R', 'IO tib-L'];
var FL_IDS = ['דם מלא', 'פלזמה/FFP', 'כדוריות', 'טרומבוציטים', 'הרטמן', 'NaCl 0.9%'], RT_IDS = ['IV', 'IM', 'IN', 'IO', 'PO', 'Buccal'];
var SX_IDS = ['', 'M', 'F'], SIDE_IDS = ['L', 'R'], BTY_IDS = BT_TYPES, NKDA = 'ללא אלרגיות ידועות';
function regIds(){ return Object.keys(W.BODY_LABELS || {}); }
function moiIds(){ return (W.MOI_TYPES || []).map(function(x){ return x.id; }); }
function medNames(){ var M = (typeof MED_PRESETS !== 'undefined') ? MED_PRESETS : (W.MED_PRESETS || []); return M.map(function(x){ return x.name; }); }
var INJ_IDS = ['hemorrhage', 'penetrating', 'fracture', 'burn'];
function idx(arr, v){ var i = arr.indexOf(v); return i < 0 ? v : i; }
function at(arr, v){ return typeof v === 'number' ? (arr[v] != null ? arr[v] : '') : v; }
function trim(a){ while (a.length && (a[a.length - 1] === null || a[a.length - 1] === undefined)) a.pop(); return a.length ? a : null; }
function pack(s){
  var t0m = Math.floor(s.t0 / 60), mn = function(x){ return x == null ? null : Math.max(0, t0m - Math.floor(x / 60)); }, R = regIds(), M = medNames();
  var list = function(a){ return (a || []).map(function(r){ return [idx(R, r[0]), mn(r[1])]; }); };
  var v = s.v || [], aw = s.aw || ['', []];
  var sd = function(o){ return o ? [idx(SIDE_IDS, o[0]), mn(o[1])] : null; };
  var x = trim([
    idx(SX_IDS, s.sx || ''), s.al === NKDA ? 1 : (s.al && s.al !== 'לא ידוע' ? s.al : 0), s.np ? 1 : 0, (s.lo && s.lo !== 'לא ידוע') ? s.lo : null, mn(s.ti), s.pg,
    s.gd, trim((s.pu || []).map(function(p){ return p ? [p[0], p[1]] : 0; })),
    s.bv != null ? mn(s.bv) : null, sd(s.nd), s.pb != null ? mn(s.pb) : null,
    (s.bt || []).length ? s.bt.map(function(b){ return [idx(BTY_IDS, b[0]), idx(R, b[1]), mn(b[2])]; }) : null,
    s.ep || null, s.ps, mn(s.nl), s.o2, sd(s.tt), s.an || null,
    (s.pr || []).length ? s.pr.map(function(q){ return [q[0], mn(q[1]), q[2]]; }) : null
  ]);
  return [2, s.s, s.n, idx(TRI_IDS, s.t), idx(moiIds(), s.m), idx(EVAC_IDS, s.p), s.ag, s.wt, s.g, idx(AVPU_IDS, s.av), idx(AW_IDS, aw[0]),
    (aw[1] || []).length ? aw[1].map(function(i){ return idx(AWI_IDS, i); }) : 0, s.ox ? 1 : 0, idx(HY_IDS, s.hy || ''), idx(PC_IDS, s.pc || ''), s.cr,
    [v[0], v[1], v[2], v[3], v[4], v[5], mn(v[6]), v[7], idx(RP_IDS, v[8] || '')], t0m.toString(36),
    (s.inj || []).map(function(i){ return [idx(R, i[0]), idx(INJ_IDS, i[1])]; }), list(s.tq), list(s.hm), list(s.pd), list(s.wp),
    (s.iv || []).map(function(i){ return [idx(IVS_IDS, i[0]), mn(i[1])]; }), (s.fl || []).map(function(f){ return [idx(FL_IDS, f[0]), f[1], mn(f[2])]; }),
    (s.md || []).map(function(m){ return [idx(M, m[0]), m[1], idx(RT_IDS, m[2]), mn(m[3])]; }), x];
}
function unpack(a){ return a[0] === 2 ? unpackV2(a) : unpackV1(a); }
function unpackV2(a){
  var t0m = parseInt(a[17], 36), t0 = t0m * 60, R = regIds(), M = medNames(), ab = function(m){ return m == null ? null : (t0m - m) * 60; };
  var list = function(x){ return (x || []).map(function(r){ return [at(R, r[0]), ab(r[1])]; }); };
  var v = a[16] || [], x = a[26] || [], one = function(q){ return q === 0 || q == null ? null : q; };
  var sd = function(o){ return o ? [at(SIDE_IDS, o[0]), ab(o[1])] : null; };
  var al = x[1], pu = x[7] || [];
  return { s:a[1], n:a[2], t:at(TRI_IDS, a[3]), m:at(moiIds(), a[4]), p:at(EVAC_IDS, a[5]), ag:nn(a[6]), wt:nn(a[7]), g:nn(a[8]), av:at(AVPU_IDS, a[9]),
    aw:[at(AW_IDS, a[10]), a[11] ? a[11].map(function(i){ return at(AWI_IDS, i); }) : []], ox:a[12] ? 1 : 0, hy:at(HY_IDS, a[13]), pc:at(PC_IDS, a[14]), cr:nn(a[15]),
    v:[nn(v[0]), nn(v[1]), nn(v[2]), nn(v[3]), nn(v[4]), nn(v[5]), ab(v[6]), nn(v[7]), at(RP_IDS, v[8])], t0:t0,
    sx:at(SX_IDS, x[0] || ''), al:al === 1 ? NKDA : (al ? al : ''), np:x[2] ? 1 : 0, lo:x[3] || '', ti:ab(x[4]), pg:x[5] == null ? null : x[5],
    gd:x[6] || null, pu:[one(pu[0]) , one(pu[1])], bv:ab(x[8]), nd:sd(x[9]), pb:ab(x[10]),
    bt:(x[11] || []).map(function(b){ return [at(BTY_IDS, b[0]), at(R, b[1]), ab(b[2])]; }), ep:x[12] || '', ps:nn(x[13]), nl:ab(x[14]), o2:nn(x[15]), tt:sd(x[16]), an:x[17] || '', pr:(x[18] || []).map(function(q){ return [q[0], ab(q[1]), q[2]]; }),
    inj:(a[18] || []).map(function(i){ return [at(R, i[0]), at(INJ_IDS, i[1])]; }), tq:list(a[19]), hm:list(a[20]), pd:list(a[21]), wp:list(a[22]),
    iv:(a[23] || []).map(function(i){ return [at(IVS_IDS, i[0]), ab(i[1])]; }), fl:(a[24] || []).map(function(f){ return [at(FL_IDS, f[0]), f[1], ab(f[2])]; }),
    md:(a[25] || []).map(function(m){ return [at(M, m[0]), m[1], at(RT_IDS, m[2]), ab(m[3])]; }) };
}
function unpackV1(a){
  var t0 = parseInt(a[18], 36) * 60, R = regIds(), M = medNames(), ab = function(m){ return m == null ? null : t0 - m * 60; };
  var list = function(x){ return (x || []).map(function(r){ return [at(R, r[0]), ab(r[1])]; }); };
  var v = a[17] || [];
  return { s:a[1], n:a[2], t:at(TRI_IDS, a[3]), m:at(moiIds(), a[4]), p:at(EVAC_IDS, a[5]), ag:a[6], wt:a[7], g:a[8], av:a[9], aw:[at(AW_IDS, a[10]), a[11] || []], tt:a[12] ? ['', null] : null, ox:a[13], hy:a[14], pc:a[15], cr:a[16],
    v:[v[0], v[1], v[2], v[3], v[4], v[5], ab(v[6])], t0:t0,
    inj:(a[19] || []).map(function(i){ return [at(R, i[0]), at(INJ_IDS, i[1])]; }), tq:list(a[20]), hm:list(a[21]), pd:list(a[22]), wp:list(a[23]),
    iv:(a[24] || []).map(function(i){ return [i[0], ab(i[1])]; }), fl:(a[25] || []).map(function(f){ return [f[0], f[1], ab(f[2])]; }),
    md:(a[26] || []).map(function(m){ return [at(M, m[0]), m[1], m[2], ab(m[3])]; }), sx:'', al:'', np:0, lo:'', ti:null, pg:null, gd:null, pu:[null, null], bv:null, nd:null, pb:null, bt:[], ep:'', ps:null, nl:null, o2:null, an:'' };
}
function encodeSnap(s){ return b64u(JSON.stringify(pack(s))); }
// ── Untrusted-input hardening ───────────────────────────────────
// A wristband link or QR is attacker-controlled. Everything decoded from it is clamped to a strict schema before it reaches
// the card renderer: whitelisted enums, bounded numbers, bounded strings (control / bidi characters stripped), bounded lists.
var MAX_PAYLOAD = 6000, MAX_JSON = 16000, BAD_CH = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]/g;
function cstr(x, max){ if (typeof x === 'number' && isFinite(x)) x = String(x); return typeof x === 'string' ? x.replace(BAD_CH, '').slice(0, max) : ''; }
function cnum(x, lo, hi){ if (typeof x === 'string' && /^-?\d+(\.\d+)?$/.test(x)) x = +x; return (typeof x === 'number' && isFinite(x) && x >= lo && x <= hi) ? x : null; }
function cenum(x, list){ return (typeof x === 'string' && list.indexOf(x) >= 0) ? x : ''; }
function carr(x, max){ return Array.isArray(x) ? x.slice(0, max) : []; }
function ctime(x){ return cnum(x, 0, 4102444800); }
function clist(x, max){ return carr(x, max).map(function(r){ r = Array.isArray(r) ? r : []; return [cstr(r[0], 24), ctime(r[1])]; }); }
function csnap(d){
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  var serial = cstr(d.s, 7).toUpperCase(); if (!/^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(serial)) return null;
  var v = carr(d.v, 9), aw = Array.isArray(d.aw) ? d.aw : ['', []], gd = Array.isArray(d.gd) ? d.gd : null, pu = carr(d.pu, 2);
  var pupil = function(p){ return Array.isArray(p) ? [cnum(p[0], 0, 12), (p[1] === 1 || p[1] === 0) ? p[1] : null] : null; };
  var side = function(o){ return Array.isArray(o) ? [cstr(o[0], 2), ctime(o[1])] : null; };
  var tt = Array.isArray(d.tt) ? side(d.tt) : (d.tt ? ['', null] : null);
  return {
    _u: 1, s: serial, n: cstr(d.n, 60), t: cenum(d.t, TRI_IDS), m: cstr(d.m, 30), p: cenum(d.p, EVAC_IDS),
    ag: cnum(d.ag, 0, 150), wt: cnum(d.wt, 0, 400), g: cnum(d.g, 3, 15), av: cstr(d.av, 8),
    aw: [cstr(aw[0], 20), carr(aw[1], 8).map(function(i){ return cstr(i, 40); })],
    ox: d.ox ? 1 : 0, hy: cstr(d.hy, 40), pc: cstr(d.pc, 20), cr: cnum(d.cr, 0, 30),
    v: [cnum(v[0], 0, 400), cnum(v[1], 0, 400), cnum(v[2], 0, 400), cnum(v[3], 0, 100), cnum(v[4], 0, 120), cnum(v[5], 15, 50), ctime(v[6]), cnum(v[7], 0, 150), cstr(v[8], 20)],
    t0: ctime(d.t0) || 0, sx: cstr(d.sx, 8), al: cstr(d.al, 80), np: d.np ? 1 : 0, lo: cstr(d.lo, 40), ti: ctime(d.ti),
    pg: (d.pg === 1 || d.pg === 0) ? d.pg : null,
    gd: gd ? [cnum(gd[0], 1, 4), cnum(gd[1], 1, 5), cnum(gd[2], 1, 6)] : null, pu: [pupil(pu[0]), pupil(pu[1])],
    bv: ctime(d.bv), nd: side(d.nd), pb: ctime(d.pb), tt: tt,
    bt: carr(d.bt, 20).map(function(b){ b = Array.isArray(b) ? b : []; return [cstr(b[0], 20), cstr(b[1], 24), ctime(b[2])]; }),
    pr: carr(d.pr, 12).map(function(q){ q = Array.isArray(q) ? q : []; return [cstr(q[0], 40), ctime(q[1]), cenum(q[2], ['A','R','C','E'])]; }),
    ep: cstr(d.ep, 120), ps: cnum(d.ps, 0, 10), nl: ctime(d.nl), o2: cnum(d.o2, 0, 60), an: cstr(d.an, 60),
    inj: carr(d.inj, 30).map(function(i){ i = Array.isArray(i) ? i : []; return [cstr(i[0], 24), cstr(i[1], 20)]; }),
    tq: clist(d.tq, 20), hm: clist(d.hm, 20), pd: clist(d.pd, 20), wp: clist(d.wp, 20),
    iv: carr(d.iv, 20).map(function(i){ i = Array.isArray(i) ? i : []; return [cstr(i[0], 24), ctime(i[1])]; }),
    fl: carr(d.fl, 30).map(function(f){ f = Array.isArray(f) ? f : []; return [cstr(f[0], 40), cnum(f[1], 0, 20000), ctime(f[2])]; }),
    md: carr(d.md, 40).map(function(m){ m = Array.isArray(m) ? m : []; return [cstr(m[0], 40), cstr(m[1], 20), cstr(m[2], 12), ctime(m[3])]; })
  };
}
function decodeSnap(txt){
  txt = String(txt || '');
  if (txt.length > MAX_PAYLOAD || !/^[A-Za-z0-9_\-]+$/.test(txt)) throw new Error('payload size or alphabet');
  var js = unb64u(txt);
  if (js.length > MAX_JSON) throw new Error('payload too large');
  var a = JSON.parse(js);
  var d = csnap(Array.isArray(a) ? unpack(a) : a);
  if (!d) throw new Error('payload schema');
  return d;
}
function baseUrl(){ return /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname) ? 'https://ada988.github.io/shomer-ahi-showcase/' : location.origin + location.pathname; }
function linkFor(c){ var s = snapshot(c); return baseUrl() + '#b=' + s.s + '.' + encodeSnap(s); }
function parseScan(text){
  text = String(text || '').slice(0, 20000).trim();
  var m = text.match(/#?b=([A-Z0-9]{3}-[A-Z0-9]{3})(?:\.([A-Za-z0-9_\-]+))?/i);
  if (m){
    var rest = text.slice(m.index + m[0].length); if (rest && !/^[\s&?#]/.test(rest)) return null;   // junk glued to the serial or payload: not one of our links
    // A link that carries a payload is only ever shown from that payload. A payload that fails validation is rejected, never swapped for a local record.
    if (m[2]){ try { var d = decodeSnap(m[2]); return (d && d.s === m[1].toUpperCase()) ? d : null; } catch(e){ return null; } }
    return lookupSerial(m[1]);
  }
  text = text.replace(/\s+/g, '');
  if (/^[A-Z0-9]{3}-?[A-Z0-9]{3}$/i.test(text)){
    var t = text.toUpperCase().replace(/^(.{3})-?(.{3})$/, '$1-$2');
    return lookupSerial(t);
  }
  return null;
}
function lookupSerial(serial){
  serial = serial.toUpperCase();
  var list = W._incidentCasualties || [];
  for (var i = 0; i < list.length; i++) if (serialFor(list[i]) === serial) return snapshot(list[i]);
  return null;
}

// ── QR rendering ───────────────────────────────────────────────
function qrSvg(text, px){
  var q; try { q = W.qrcode(0, 'L'); q.addData(text); q.make(); } catch (e) { return '<div class="qr-fail" role="img" aria-label="QR">QR too large</div>'; }
  var n = q.getModuleCount(), quiet = 3, size = n + quiet * 2, d = '';
  for (var r = 0; r < n; r++){
    var run = -1;
    for (var c = 0; c <= n; c++){
      var on = c < n && q.isDark(r, c);
      if (on && run < 0) run = c;
      if (!on && run >= 0){ d += 'M' + (run + quiet) + ' ' + (r + quiet) + 'h' + (c - run) + 'v1h-' + (c - run) + 'z'; run = -1; }
    }
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" class="qr" viewBox="0 0 ' + size + ' ' + size + '" width="' + (px || 160) + '" height="' + (px || 160) + '" shape-rendering="crispEdges" role="img" aria-label="QR code">'
    + '<rect width="' + size + '" height="' + size + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
}

// ── Bracelet design ────────────────────────────────────────────
var BRC_CSS = '.brc-list .b2-grid,.brc-list .b2-foot{display:none}.brc-list .b2-qr svg{width:9em;height:9em}.brc-list .b2-main{gap:.3em}.brc2{font-size:16px;display:flex;flex-direction:column;background:#fff;color:#111;border:3px solid #111;border-radius:.9em;overflow:hidden;font-family:Inter,Heebo,Arial,sans-serif;width:100%}'
  + '.b2-tri{display:flex;align-items:center;gap:.6em;padding:.55em .9em;background:var(--tg);color:var(--tgt,#fff)}.b2-tri svg{width:2.3em;height:2.3em;flex:none;min-width:2.3em;min-height:2.3em}'
  + '.b2-num{display:grid;place-items:center;min-width:1.7em;height:1.7em;padding:0 .2em;border-radius:.3em;background:#fff;color:#000;font-size:2.2em;font-weight:900;line-height:1;box-shadow:0 0 0 .08em #000}'
  + '.b2-tri b{font-size:1.65em;font-weight:900;line-height:1;letter-spacing:.02em;flex:1}.b2-tri i{font-style:normal;font-weight:900;font-size:1.2em;border:.14em solid currentColor;border-radius:.3em;padding:.04em .4em}'
  + '.b2-main{padding:.7em .9em;display:flex;flex-direction:column;gap:.5em;flex:1;min-width:0}'
  + '.b2-top{display:flex;justify-content:space-between;align-items:center;gap:.5em;font-size:.875em;font-weight:800;color:#444;letter-spacing:.05em}.b2-top em{font-style:normal;background:#ffd400;color:#000;border:2px solid #000;border-radius:.3em;padding:0 .5em;font-weight:900}'
  + '.b2-no{display:flex;align-items:baseline;gap:.5em}.b2-no small{font-weight:900;font-size:.875em;color:#444}.b2-no b{font:900 2.3em ui-monospace,Menlo,Consolas,monospace;letter-spacing:.04em;line-height:1}'
  + '.b2-who{font-weight:800;font-size:1.05em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  + '.b2-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.4em}'
  + '.b2-box{border:2px solid #111;border-radius:.5em;padding:.3em .5em;min-height:3.5em;display:flex;flex-direction:column;min-width:0}.b2-box small{font-size:.875em;font-weight:900;letter-spacing:.05em;color:#444}'
  + '.b2-box b{font-size:1.4em;font-weight:900;font-variant-numeric:tabular-nums;line-height:1.1;white-space:nowrap}.b2-box span{font-size:.875em;font-weight:700;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  + '.b2-box.blank{background:repeating-linear-gradient(0deg,#fff 0,#fff 1.1em,#cfd3da 1.1em,#cfd3da calc(1.1em + 1px)) no-repeat 0 1.5em/100% calc(100% - 1.5em)}.b2-box.blank small{background:#fff}.b2-box.set{background:#fff6cc}'
  + '.b2-qr{display:flex;flex-direction:column;align-items:center;gap:.3em;padding:.7em;border-top:3px dashed #111}.b2-qr svg{width:11em;height:11em}.b2-qr small{font-weight:900;font-size:.875em;letter-spacing:.05em;text-align:center}'
  + '.b2-foot{font-size:.875em;font-weight:700;color:#444;line-height:1.25}'
  + '.b2-no{background:#111;color:#fff;border-radius:.5em;padding:.25em .6em;justify-content:space-between}.b2-no small{color:#ffd400}.b2-no b{font-size:2.5em}'
  + '.b2-qr{background:#f3f4f6}.b2-qr svg{background:#fff;border:3px solid var(--tg);border-radius:.4em;padding:.2em}'
  + '.b2-stub{display:none}'
  + '.brc-print .b2-stub{display:flex;flex-direction:column;align-items:center;justify-content:space-between;width:17mm;padding:2mm 1mm;border-inline-start:.5mm dashed #111;background:var(--tg);color:var(--tgt,#fff);text-align:center}'
  + '.b2-stub b{font:900 1.15em ui-monospace,Menlo,Consolas,monospace;writing-mode:vertical-rl;transform:rotate(180deg);letter-spacing:.06em}.b2-stub span{font-size:.7em;font-weight:900;line-height:1.1}'
  + '.brc-print .b2-no{padding:.3mm 2mm}.brc-print .b2-no b{font-size:2.3em}.brc-print .b2-qr{background:#fff}'
  + '.brc-print{flex-direction:row;width:170mm;height:58mm;font-size:8.5pt;border-width:.6mm;border-radius:3mm}.brc-print .b2-tri{flex-direction:column;justify-content:center;text-align:center;width:27mm;padding:2mm;gap:1.5mm}'
  + '.brc-print .b2-tri svg{width:11mm;height:11mm;min-width:0;min-height:0}.brc-print .b2-tri b{font-size:1.35em;flex:none}.brc-print .b2-tri i{font-size:1em}'
  + '.brc-print .b2-main{padding:2mm 3mm;gap:1.2mm}.brc-print .b2-top{font-size:.8em}.brc-print .b2-no b{font-size:2.6em}.brc-print .b2-who{font-size:1em}.brc-print .b2-box{min-height:11mm;padding:.8mm 1.6mm;border-width:.35mm}.brc-print .b2-box small{font-size:.8em}.brc-print .b2-box b{font-size:1.35em}.brc-print .b2-box span{font-size:.8em}.brc-print .b2-foot{font-size:.72em}'
  + '.brc-print .b2-qr{border-top:0;border-inline-start:.5mm dashed #111;padding:2mm;width:44mm;justify-content:center}.brc-print .b2-qr svg{width:37mm;height:37mm}.brc-print .b2-qr small{font-size:.75em}';
function ensureBrcCss(){ if (document.getElementById('brc2-css')) return; var st = document.createElement('style'); st.id = 'brc2-css'; st.textContent = BRC_CSS; document.head.appendChild(st); }
function braceletHtml(c, opts){
  opts = opts || {}; ensureBrcCss();
  var s = snapshot(c), tg = triageOf(s.t), url = baseUrl() + '#b=' + s.s + '.' + encodeSnap(s), sh = W.TriageUI ? W.TriageUI.shapeSvg(tg.sh, 40) : '';
  var tq = s.tq[0], meds = s.md.slice(-3);
  var nm = T(s.n) || L('Unnamed casualty','נפגע ללא שם'), no = W.casNum ? W.casNum({ name: s.n }) : null;
  var who = /\d/.test(nm) ? nm : [nm, s.ag != null ? s.ag + L(' y',' שנים') : '', (s.sx === 'M' || s.sx === 'male') ? L('M','ז') : (s.sx === 'F' || s.sx === 'female') ? L('F','נ') : ''].filter(Boolean).join(' · ');
  return '<div class="brc2' + (opts.print ? ' brc-print' : '') + (opts.list ? ' brc-list' : '') + '" style="--tg:' + tg.c + ';--tgt:' + tg.tx + '">'
    + '<div class="b2-tri">' + (no ? '<strong class="b2-num" dir="ltr">' + no + '</strong>' : '') + sh + '<b>' + esc(L(tg.en, tg.he)) + '</b></div>'
    + '<div class="b2-main">'
    +   '<div class="b2-top"><span>' + L('SHOMER AHI · CASUALTY ID','שומר אחי · זיהוי נפגע') + '</span><em>' + L('DEMO','דמו') + '</em></div>'
    +   '<div class="b2-no"><small>' + L('NO.','מס׳') + '</small><b dir="ltr">' + esc(s.s) + '</b></div>'
    +   '<div class="b2-who">' + esc(who) + '</div>'
    +   '<div class="b2-grid">'
    +     (tq ? '<div class="b2-box set"><small>' + L('TQ','חוסם') + '</small><b>' + hhmm(tq[1]) + '</b><span>' + esc(regionName(tq[0])) + '</span></div>' : '<div class="b2-box blank"><small>' + L('TQ','חוסם') + '</small><b>__ : __</b></div>')
    +     (meds.length ? '<div class="b2-box set"><small>' + L('DRUGS','תרופות') + '</small>' + meds.map(function(m){ return '<span><b style="font-size:1em">' + hhmm(m[3]) + '</b> ' + esc(T(m[0])) + '</span>'; }).join('') + '</div>' : '<div class="b2-box blank"><small>' + L('DRUGS + TIME','תרופות + שעה') + '</small></div>')
    +     (evacCat(s) ? '<div class="b2-box set"><small>' + L('EVAC','פינוי') + '</small><span>' + esc(evacCat(s)) + '</span></div>' : '<div class="b2-box blank"><small>' + L('EVAC ORDER','סדר פינוי') + '</small></div>')
    +   '</div>'
    +   '<div class="b2-grid">'
    +     '<div class="b2-box ' + (s.np ? 'set' : 'blank') + '"><small>' + L('NIL BY MOUTH','צום') + '</small><b>' + (s.np ? L('YES','כן') : '☐') + '</b></div>'
    +     '<div class="b2-box ' + (s.al ? 'set' : 'blank') + '"><small>' + L('ALLERGY','אלרגיה') + '</small>' + (s.al ? '<span>' + esc(String(T(s.al)).slice(0, 60)) + '</span>' : '') + '</div>'
    +     '<div class="b2-box blank"><small>' + L('BLOOD TYPE','סוג דם') + '</small></div>'
    +   '</div>'
    +   '<div class="b2-foot">' + L('DEMO. NOT FOR CLINICAL USE. Fictional data.','דמו. לא לשימוש קליני. נתונים בדויים.') + '</div>'
    + '</div>'
    + '<div class="b2-qr">' + qrSvg(url, opts.print ? 140 : 176) + '<small>' + L('SCAN WITH ANY PHONE CAMERA','סרקו בכל מצלמת טלפון') + '</small></div>'
    + '<div class="b2-stub"><span>' + L('TEAR OFF · KEEP WITH STRETCHER','גזרו · הצמידו לאלונקה') + '</span><b dir="ltr">' + (no ? '#' + no + ' · ' : '') + esc(s.s) + '</b><span>' + esc(L(tg.en, tg.he)) + '</span></div>'
    + '</div>';
}

// ── Scan-result casualty card ──────────────────────────────────
// Order = what a receiving medic needs first: banner -> time-critical box -> airway/breathing/chest/pelvis strip
// -> consciousness + pupils -> vitals -> drugs with times -> compact context rows -> evacuation.
function regionName(id){ var ok = W.BODY_LABELS && Object.prototype.hasOwnProperty.call(W.BODY_LABELS, id); return T(ok ? (W.bodyLabelOut ? W.bodyLabelOut(id) : W.BODY_LABELS[id]) : String(id == null ? '' : id).replace(/[^\w .\-]/g, '').slice(0, 24)); }
function injType(t){ var m = { hemorrhage:['Bleeding','דימום'], penetrating:['Penetrating','חודר'], fracture:['Fracture','שבר'], burn:['Burn','כוויה'] }; return own(m, t) ? L(m[t][0], m[t][1]) : esc(t); }
function moiName(id){ var m = (W.MOI_TYPES || []).filter(function(x){ return x.id === id; })[0]; return m ? T(m.label) : esc(id || ''); }
// NATO evacuation categories: Urgent <=1 h, Priority <=4 h, Routine <=24 h. An explicit evacPriority wins, otherwise derived from the triage colour.
function evacCat(s){
  var byP = { immediate:['Urgent ≤1 h','דחוף ≤שעה'], urgent:['Priority ≤4 h','בעדיפות ≤4 שעות'], routine:['Routine ≤24 h','שגרתי ≤24 שעות'], expectant:['Evacuate last','פינוי אחרון'] };
  var byT = { red:'immediate', yellow:'urgent', green:'routine', gray:'expectant' };
  var k = s.p || own(byT, s.t); return own(byP, k) ? L(byP[k][0], byP[k][1]) : '';
}
var ANALGESICS = ['קטמין', 'מורפין', 'פנטניל', 'Actiq OTFC', 'אופטלגין', 'פרצטמול', 'אקמול'], ANTIBIOTICS = ['צפטריאקסון', 'מטרונידזול', 'Ertapenem'], BLOOD = ['דם מלא', 'פלזמה/FFP', 'כדוריות', 'טרומבוציטים'];
function minsAgo(t){ return t == null ? null : Math.max(0, Math.round((Date.now() / 1000 - t) / 60)); }
function sideName(sd){ return sd === 'R' ? L('Right','ימין') : sd === 'L' ? L('Left','שמאל') : ''; }
function airwayName(st){ var m = { clear:['Clear','פתוח'], compromised:['At risk','בסיכון'], obstructed:['Obstructed','חסום'] }; return own(m, st) ? L(m[st][0], m[st][1]) : T(st); }
function hypoName(h){ var m = { HPMK:['HPMK (hypothermia prevention kit)','HPMK (ערכת מניעת היפותרמיה)'], blanket:['Blanket','שמיכה'] }; return own(m, h) ? L(m[h][0], m[h][1]) : T(h); }
function pupilTxt(p, sd){ if (!p) return ''; return sd + ' ' + (p[0] != null ? esc(String(p[0])) + ' mm ' : '') + (p[1] === 1 ? L('reactive','מגיב לאור') : p[1] === 0 ? L('fixed','קבוע') : ''); }
function timeAgoHtml(t){ var m = minsAgo(t); return hhmm(t) + ' · ' + m + L(' min ago',' ד׳ לפני'); }
function cr(letter, text, tm){ return '<li><b class="cc-m">' + letter + '</b><span>' + esc(text) + '</span>' + (tm ? '<time>' + tm + '</time>' : '') + '</li>'; }
function hm(t){ return t ? hhmm(t) : ''; }

function cardHtml(s, opts){
  opts = opts || {};
  var tg = triageOf(s.t), h = '', black = s.t === 'black', v = s.v || [], now = Date.now() / 1000;
  var tt = Array.isArray(s.tt) ? s.tt : (s.tt ? ['', null] : null), meds = s.md || [], fl = s.fl || [];
  // one notice line, then how old this copy is: the band holds the record as it was when printed, nothing after
  h += '<div class="cc-demo' + (s._u ? ' cc-untrusted' : '') + '" role="note">' + ico('triangle-alert', 20) + '<span>' + (s._u ? L('Demo · fictional patient · unverified QR data, confirm with the casualty','דמו · נפגע בדוי · נתוני QR לא מאומתים, אמתו מול הנפגע') : L('Demo · fictional patient · not for clinical use','דמו · נפגע בדוי · לא לשימוש קליני')) + '</span></div>';
  var age = s.t0 ? Math.max(0, Math.round((now - s.t0) / 60)) : null;
  if (age != null && (s._u || age >= 1)) h += '<div class="cc-asof">' + ico('clock', 20) + '<span>' + L('Record as of ' + hhmm(s.t0) + ' (' + age + ' min ago) · later care not included','התיק נכון ל-' + hhmm(s.t0) + ' (לפני ' + age + ' ד׳) · טיפול מאוחר יותר לא כלול') + '</span></div>';
  // 1. Banner: triage + evacuation category + serial
  var ev = evacCat(s);
  h += '<div class="cc-banner" style="--tg:' + tg.c + '"><div><div class="cc-tri">' + L(tg.en, tg.he) + '</div>' + (ev ? '<div class="cc-sub">' + L('Evacuation: ','פינוי: ') + ev + '</div>' : '') + '</div><div class="cc-serial">' + esc(s.s) + '</div></div>';
  h += '<div class="cc-id"><div class="cc-name">' + (W.casBadge ? W.casBadge({ name: s.n }, true) + ' ' : '') + esc(String(T(s.n) || L('Unnamed casualty','נפגע ללא שם')).split(' — ')[0]) + '</div></div>';

  // 2. Time-critical box: tourniquet clock + minutes, then key drug / blood times
  var tc = [];
  (s.tq || []).forEach(function(q){
    tc.push('<b>' + L('Tourniquet','חוסם עורקים') + '</b> — ' + esc(regionName(q[0])) + ' · ' + hhmm(q[1]) + ' · <b data-tq="' + (+q[1] || 0) + '">' + (minsAgo(q[1]) == null ? '?' : minsAgo(q[1])) + L(' min',' ד׳') + '</b>');
  });
  var keyT = [];
  meds.forEach(function(m){ if (m[0] === 'TXA') keyT.push('TXA ' + hm(m[3])); });
  fl.forEach(function(f){ if (BLOOD.indexOf(f[0]) >= 0) keyT.push(T(f[0]) + ' ' + hm(f[2])); });
  meds.forEach(function(m){ if (ANALGESICS.indexOf(m[0]) >= 0) keyT.push(T(m[0]) + ' ' + hm(m[3])); });
  meds.forEach(function(m){ if (ANTIBIOTICS.indexOf(m[0]) >= 0) keyT.push(T(m[0]) + ' ' + hm(m[3])); });
  if (keyT.length) tc.push(keyT.join(' · '));
  if (black){
    h += '<div class="cc-alert">' + ico('timer', 18) + '<div><div class="cc-alert-t">' + L('Waiting','ממתין') + '</div><div class="cc-alert-d">'
      + (s.nl ? L('Since ','מאז ') + '<b>' + hhmm(s.nl) + '</b> · ' : '') + L('Reassess when resources allow · death is pronounced by a physician','הערכה חוזרת כשיתפנו משאבים · קביעת מוות ע״י רופא') + '</div></div></div>';
  } else if (tc.length){
    h += '<div class="cc-alert" style="font-size:15px">' + ico('timer', 20) + '<div><div class="cc-alert-t" style="font-size:15px">' + L('Time-critical','זמן קריטי') + '</div><div class="cc-alert-d" style="font-size:15px;line-height:1.55">' + tc.join('<br>') + '</div></div></div>';
  }

  // 3. Airway / breathing / chest / pelvis strip
  var ab = '';
  (s.hm || []).forEach(function(q){ ab += cr('X', (q[0] === 'pelvis' ? L('Hemostatic packing — groin','אריזה המוסטטית — מפשעה') : L('Hemostatic','המוסטטי') + (q[0] ? ' — ' + regionName(q[0]) : '')), hm(q[1])); });
  (s.pd || []).forEach(function(q){ ab += cr('X', L('Pressure dressing','תחבושת לחץ') + (q[0] ? ' — ' + regionName(q[0]) : ''), hm(q[1])); });
  (s.wp || []).forEach(function(q){ ab += cr('X', L('Wound packing','אריזת פצע') + (q[0] ? ' — ' + regionName(q[0]) : ''), hm(q[1])); });
  if ((s.aw && s.aw[0]) || (s.aw && s.aw[1] && s.aw[1].length)){
    ab += cr('A', L('Airway','נתיב אוויר') + ': ' + (s.aw[0] ? airwayName(s.aw[0]) : '') + (s.aw[1] && s.aw[1].length ? ' · ' + s.aw[1].map(T).join(', ') : ''), '');
  }
  if (s.bv) ab += cr('R', L('Assisted ventilation (BVM)','הנשמה בסיוע (BVM)') + (s.o2 ? ' · O₂ ' + s.o2 + L(' L/min',' ליטר לדקה') : ''), hm(s.bv));
  else if (s.ox) ab += cr('R', L('Oxygen','חמצן') + (s.o2 ? ' ' + s.o2 + L(' L/min',' ליטר לדקה') : ''), '');
  (s.bt || []).forEach(function(b){
    if (b[0] === 'chestSeal') ab += cr('R', L('Chest seal','אטם חזה') + ' — ' + regionName(b[1]), hm(b[2]));
  });
  if (s.nd) ab += cr('R', L('Needle decompression','דקירת מחט') + (s.nd[0] ? ' — ' + sideName(s.nd[0]) : ''), hm(s.nd[1]));
  if (tt) ab += cr('R', L('Chest tube','נקז חזה') + (tt[0] ? ' — ' + sideName(tt[0]) : ''), hm(tt[1]));
  if (s.pb) ab += cr('C', L('Pelvic binder — do not remove','מקבע אגן — אל תסיר'), hm(s.pb));
  (s.pr || []).forEach(function(q){ ab += cr(q[2] || 'E', T(q[0]), hm(q[1])); });
  (s.iv || []).forEach(function(i){ ab += cr('C', L('IV/IO access','גישה ורידית/IO') + ' — ' + T(W.outLR ? W.outLR(i[0]) : i[0]), hm(i[1])); });
  (s.bt || []).forEach(function(b){
    if (b[0] === 'splint' || b[0] === 'bandage') ab += cr('E', (b[0] === 'splint' ? L('Splint','קיבוע שבר') : L('Dressing','חבישה')) + ' — ' + regionName(b[1]), hm(b[2]));
  });
  if (ab) h += '<section class="cc-sec"><h3>' + L('X-CARE · care given','X-CARE · טיפול שניתן') + '</h3><ul class="cc-care">' + ab + '</ul></section>';

  // 4. Consciousness + pupils
  var cons = [];
  if (s.av) cons.push('AVPU <b>' + esc(s.av) + '</b>');
  if (hv(s.g)) cons.push('GCS <b>' + esc(String(s.g)) + '</b>' + (s.gd ? ' (E' + esc(String(s.gd[0])) + ' V' + esc(String(s.gd[1])) + ' M' + esc(String(s.gd[2])) + ')' : ''));
  var pl = pupilTxt((s.pu || [])[0], L('L','ש')), pr = pupilTxt((s.pu || [])[1], L('R','י'));
  if (pl || pr) cons.push(L('Pupils','אישונים') + ': ' + [pl, pr].filter(Boolean).join(' · '));
  if (cons.length) h += '<section class="cc-sec"><h3>' + L('Consciousness','הכרה') + '</h3><div class="cc-line" style="margin-top:0;font-size:15px">' + cons.join(' · ') + '</div></section>';

  // 5. Vitals (0 is a value: no pulse / not breathing)
  var cell = function(label, val, unit, note){ return '<div class="cc-vit"><div class="cc-vl">' + label + '</div><div class="cc-vv">' + (hv(val) ? esc(String(val)) : '—') + '<small>' + (hv(val) ? unit : '') + '</small></div>' + (note ? '<div class="cc-vl" style="color:var(--re-hi)">' + note + '</div>' : '') + '</div>'; };
  var bp = hv(v[1]) ? v[1] + '/' + (hv(v[2]) ? v[2] : '–') : null;
  var vit = [ cell('HR', v[0], '/min', v[0] === 0 ? L('No pulse','אין דופק') : ''), cell('BP', bp, '', ''), cell('SpO₂', v[3], '%', ''), cell('RR', v[4], '/min', v[4] === 0 ? L('Not breathing','אין נשימה') : ''), cell(L('Temp','חום'), v[5], '°C', '') ];
  if (hv(v[7])) vit.push(cell('EtCO₂', v[7], 'mmHg', ''));
  h += '<section class="cc-sec"><h3>' + L('Last vitals','סימנים חיוניים אחרונים') + (v[6] ? ' <span>' + ago(v[6]) + '</span>' : '') + '</h3><div class="cc-vitals">' + vit.join('') + '</div>';
  var vl = [];
  if (hv(v[0]) && hv(v[1]) && v[1] > 0){ var si = v[0] / v[1]; vl.push(L('Shock index','מדד הלם') + ' <b>' + si.toFixed(2) + '</b>' + (si > 1 ? ' ⚠' : '')); }
  if (s.pc) vl.push(L('Radial pulse','דופק רדיאלי') + ': ' + esc(T(own({ strong:'חזק', weak:'חלש', absent:'אין', normal:'תקין' }, s.pc) || s.pc)));
  if (hv(s.cr)) vl.push('CRT ' + esc(String(s.cr)) + 's');
  if (vl.length) h += '<div class="cc-line">' + vl.join(' · ') + '</div>';
  h += '</section>';

  // 6. Drugs, blood and fluids with clock times (chronological)
  var dr = [];
  meds.forEach(function(m){ dr.push([m[3], 'Rx', T(m[0]) + ' ' + m[1] + ' ' + T(m[2])]); });
  fl.forEach(function(f){ dr.push([f[2], 'C', T(f[0]) + ' ' + f[1] + ' ml']); });
  dr.sort(function(a, b){ return (a[0] || 0) - (b[0] || 0); });
  if (dr.length) h += '<section class="cc-sec"><h3>' + L('Drugs · blood · fluids','תרופות · דם · נוזלים') + '</h3><ul class="cc-care">' + dr.map(function(r){ return cr(r[1], r[2], hm(r[0])); }).join('') + '</ul></section>';

  // 7. Compact context rows
  var cx = '';
  var rw = function(label, val){ return val ? '<li><span>' + label + '</span><em>' + val + '</em></li>' : ''; };
  var who = [hv(s.ag) ? esc(String(s.ag)) + L(' y',' שנים') : '', s.sx === 'M' ? L('Male','זכר') : s.sx === 'F' ? L('Female','נקבה') : '', s.wt ? esc(String(s.wt)) + ' ' + L('kg','ק״ג') : ''].filter(Boolean).join(' · ');
  cx += rw(L('Mechanism','מנגנון'), s.m ? moiName(s.m) : '');
  if (s.ti) cx += rw(L('Time of injury','שעת פציעה'), timeAgoHtml(s.ti));
  cx += rw(L('Allergies','אלרגיות'), s.al ? esc(T(s.al)) : L('Unknown','לא ידוע'));
  if (s.np || s.lo) cx += rw(L('NPO · last oral intake','צום · אכילה אחרונה'), (s.np ? 'NPO' : '') + (s.np && s.lo ? ' · ' : '') + (s.lo ? esc(T(s.lo)) : ''));
  cx += rw(L('Age · sex · weight','גיל · מין · משקל'), who);
  if (s.sx === 'F' && hv(s.ag) && s.ag >= 12 && s.ag <= 50) cx += rw(L('Pregnancy','היריון'), s.pg === 1 ? L('Pregnant','בהיריון') : s.pg === 0 ? L('Not pregnant','לא בהיריון') : L('Unknown','לא ידוע'));
  if (s.an) cx += rw(L('Anticoagulants','נוגדי קרישה'), esc(T(s.an)));
  var lastAn = null; meds.forEach(function(m){ if (ANALGESICS.indexOf(m[0]) >= 0 && m[3] && (!lastAn || m[3] > lastAn[3])) lastAn = m; });
  if (hv(s.ps) || lastAn) cx += rw(L('Pain · last analgesic','כאב · משכך אחרון'), (hv(s.ps) ? esc(String(s.ps)) + '/10' : '') + (hv(s.ps) && lastAn ? ' · ' : '') + (lastAn ? T(lastAn[0]) + ' ' + hm(lastAn[3]) : ''));
  if (s.hy) cx += rw(L('Hypothermia prevention','מניעת היפותרמיה'), esc(hypoName(s.hy)));
  if (cx) h += '<section class="cc-sec"><h3>' + L('Context','הקשר') + '</h3><ul class="cc-list">' + cx + '</ul></section>';
  if (s.inj && s.inj.length){
    h += '<section class="cc-sec"><h3>' + L('Injuries','פציעות') + '</h3><ul class="cc-list">'
      + s.inj.map(function(i){ return '<li><span>' + esc(regionName(i[0])) + '</span><em>' + injType(i[1]) + '</em></li>'; }).join('') + '</ul></section>';
  }

  // 8. Evacuation
  if (ev || s.ep) h += '<section class="cc-sec"><h3>' + L('Evacuation','פינוי') + '</h3><div class="cc-line" style="margin-top:0;font-size:15px">' + (ev ? '<b>' + ev + '</b>' : '') + (ev && s.ep ? ' · ' : '') + (s.ep ? esc(T(s.ep)) : '') + '</div></section>';
  h += '<div class="cc-note">' + ico('wifi-off', 14) + '<span>' + L('Decoded from the QR itself — no network or server needed. The QR data is not encrypted.','פוענח מתוך ה-QR עצמו — ללא רשת או שרת. נתוני ה-QR אינם מוצפנים.') + '</span></div>';
  return h;
}

// ── Overlay shell ──────────────────────────────────────────────
var overlay = null, stopScan = null, last = null, redo = null;
function mount(inner, cls, again){
  close(true);
  redo = again || null;   // how to draw this view again (language switch)
  overlay = document.createElement('div');
  overlay.className = 'bo ' + (cls || '');
  overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = inner;
  document.body.appendChild(overlay);
  document.body.classList.add('bo-open');
  if (W.ShowcaseI18n && lang() === 'en') W.ShowcaseI18n.apply(overlay);
  var f = overlay.querySelector('[data-autofocus]'); if (f) setTimeout(function(){ f.focus(); }, 30);
}
function close(silent){
  clearInterval(W.__cardTick); scanMode = null;
  if (stopScan){ try { stopScan(); } catch(e){} stopScan = null; }
  if (overlay){ overlay.remove(); overlay = null; }
  redo = null;
  document.body.classList.remove('bo-open');
  if (!silent && /#b=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
}
function topbar(title, back){
  return '<header class="bo-top"><button class="bo-x" onclick="Bracelet.close()" aria-label="' + L('Close','סגור') + '">' + ico(back ? (document.documentElement.dir === 'rtl' ? 'arrow-right' : 'arrow-left') : 'x', 24) + '<span>' + (back ? L('Back','חזרה') : L('Close','סגור')) + '</span></button><div class="bo-title">' + title + '</div><button class="beta-pill" onclick="Disclaimer.open()" aria-label="' + L('Important notice: early beta demo, do not use on real patients','הודעה חשובה: דמו בטא מוקדמת, אין להשתמש בנפגעים אמיתיים') + '">' + ico('triangle-alert', 20) + '<b>' + L('Beta','בטא') + '</b><span>· ' + L('demo','דמו') + '</span></button></header>';
}

function showCard(s, src){
  last = s;
  mount(topbar(L('Casualty card','כרטיס נפגע'), true)
    + '<div class="bo-body"><div class="ccard">' + cardHtml(s) + '</div>'
    + '<div class="bo-actions">'
    + (s._u ? '<button class="xbtn bo-take" onclick="Bracelet.take()">' + ico('file-text', 22) + L('Continue on my device (unverified)','המשך במכשיר שלי (לא מאומת)') + '</button>' : '')
    + '<button class="xbtn" onclick="Bracelet.scan()">' + ico('scan-line', 18) + L('Scan another','סרוק נוסף') + '</button>'
    + '<button class="xbtn xbtn-primary" onclick="Bracelet.close()">' + ico('check', 22) + L('Done','סיום') + '</button></div></div>', 'bo-card', function(){ showCard(s, src); });
  clearInterval(W.__cardTick);
  var tick = W.__cardTick = setInterval(function(){
    if (!overlay) return clearInterval(tick);
    overlay.querySelectorAll('[data-tq]').forEach(function(b){ var m = Math.max(0, Math.round((Date.now()/1000 - (+b.getAttribute('data-tq'))) / 60)); b.textContent = m + L(' min',' ד׳'); });
  }, 20000);
}

function showBracelet(docId){
  var c = (W._incidentCasualties || []).filter(function(x){ return x._docId === docId; })[0];
  if (!c) return;
  var link = linkFor(c);
  mount(topbar(L('Wristband','צמיד')) + '<div class="bo-body">'
    + '<div class="bo-hint">' + L('This is the wristband as it prints. The QR carries the casualty’s medical summary — scan it with any phone camera.','כך הצמיד נראה בהדפסה. ה-QR נושא את תמצית המידע הרפואי — סרוק בכל מצלמת טלפון.') + '</div>'
    + braceletHtml(c)
    + '<p class="bo-hint">' + L('Scan the QR on the wristband with any phone camera to open this record.','סרקו את ה-QR שעל הצמיד בכל מצלמת טלפון כדי לפתוח את התיק.') + '</p>'
    + '<div class="bo-actions">'
    + '<button class="xbtn" onclick="Bracelet.viewCard(\'' + esc(docId) + '\')">' + ico('eye', 18) + L('Preview scan result','תצוגת תוצאת סריקה') + '</button>'
    + '<button class="xbtn" onclick="Bracelet.copy(\'' + esc(docId) + '\')">' + ico('link', 18) + L('Copy link','העתק קישור') + '</button>'
    + '<button class="xbtn xbtn-primary" onclick="Bracelet.print(\'' + esc(docId) + '\')">' + ico('printer', 18) + L('Print','הדפס') + '</button></div></div>', 'bo-brc', function(){ showBracelet(docId); });
}
function viewCard(docId){
  var c = (W._incidentCasualties || []).filter(function(x){ return x._docId === docId; })[0];
  if (c) showCard(snapshot(c));
}
function copy(docId){
  var c = (W._incidentCasualties || []).filter(function(x){ return x._docId === docId; })[0];
  if (!c) return;
  var url = linkFor(c);
  (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function(){ W.toast(L('Link copied','הקישור הועתק'), false); }, function(){ W.prompt(L('Copy this link','העתק את הקישור'), url); });
}

// ── Print sheet ────────────────────────────────────────────────
function print(docId){
  var list = docId ? (W._incidentCasualties || []).filter(function(x){ return x._docId === docId; }) : (W._incidentCasualties || []);
  if (!list.length) return;
  var he = lang() === 'he';
  var html = '<!DOCTYPE html><html lang="' + (he ? 'he' : 'en') + '" dir="' + (he ? 'rtl' : 'ltr') + '"><head><meta charset="UTF-8"><title>' + L('Casualty wristbands','צמידי נפגעים') + '</title>'
    + '<style>' + printCss() + '</style></head><body>'
    + '<div class="bar"><div><b>' + L('Casualty wristbands','צמידי נפגעים') + '</b><span>' + L('Print at 100% on A4. Cut along the dashed line, fold over the strap, secure.','הדפס ב-100% על A4. גזור לאורך הקו המקווקו, קפל סביב הרצועה, הדק.') + '</span></div>'
    + '<button onclick="window.print()">' + L('Print / Save as PDF','הדפס / שמור כ-PDF') + '</button></div>'
    + '<div class="sheet">' + list.map(function(c){ return braceletHtml(c, { print:true }); }).join('') + '</div></body></html>';
  var w = W.open('', '_blank');
  if (!w){ W.toast(L('Allow pop-ups to print','אפשר חלונות קופצים כדי להדפיס'), false); return; }
  w.document.open(); w.document.write(html); w.document.close();
  try { w.opener = null; } catch (e) {}
}
function printCss(){
  return '*{box-sizing:border-box;margin:0}body{font-family:Inter,Heebo,Arial,sans-serif;background:#eceff3;color:#111;padding:20px}'
    + '.bar{max-width:210mm;margin:0 auto 14px;background:#fff;border-radius:10px;padding:14px 16px;display:flex;gap:14px;align-items:center;justify-content:space-between}'
    + '.bar b{display:block;font-size:15px}.bar span{font-size:12px;color:#555}.bar button{background:#111;color:#fff;border:0;border-radius:8px;padding:11px 18px;font:600 14px inherit;cursor:pointer}'
    + '.sheet{max-width:210mm;margin:0 auto;background:#fff;padding:10mm;display:grid;grid-template-columns:1fr;gap:6mm;justify-items:center}'
    + brcCss() + '.brc2{outline:1px dashed #888;outline-offset:2mm;break-inside:avoid}'
    + '@media print{body{background:#fff;padding:0}.bar{display:none}.sheet{padding:8mm;max-width:none}@page{size:A4;margin:0}}';
}
function brcCss(){ return BRC_CSS; }

// ── Scanner ────────────────────────────────────────────────────
function loadJsQR(){
  return new Promise(function(res, rej){
    if (W.jsQR) return res();
    var s = document.createElement('script'); s.src = 'vendor/jsQR.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });
}
function scan(){
  scanMode = null;
  var samples = (W._incidentCasualties || []).map(function(c){ var tg = triageOf(c.triageColor); return '<button class="bs-sample" onclick="Bracelet.open(\'' + esc(c._docId) + '\')">' + W.TriageUI.chip(c.triageColor) + (W.casBadge ? W.casBadge(c) : '') + '<code>' + serialFor(c) + '</code><span class="bs-nm">' + esc(String(T(c.name)).split(' — ')[0]) + '</span></button>'; }).join('');
  mount(topbar(L('Scan a wristband','סריקת צמיד')) + '<div class="bo-body">'
    + '<div class="bs-view" id="bs-view"><video id="bs-video" playsinline muted></video><div class="bs-frame"></div><div class="bs-msg" id="bs-msg">' + L('Starting camera…','מפעיל מצלמה…') + '</div></div>'
    + '<div class="bs-or">' + L('Or tap a sample wristband:','או בחרו צמיד לדוגמה:') + '</div>'
    + '<div class="bs-samples">' + samples + '</div>'
    + '<div class="bs-or">' + L('Or a casualty tag:','או תג נפגע:') + '</div><div class="bs-samples bs-tags">' + tagSamples(false) + '</div>'
    + '<form class="bs-manual" onsubmit="return Bracelet.manual(this)"><input name="c" placeholder="' + L('Number (#4), tag (SA-0427) or code','מספר (#4), תג (SA-0427) או קוד') + '" autocomplete="off" autocapitalize="characters" spellcheck="false"><button class="xbtn">' + ico('search', 24) + L('Open','פתח') + '</button></form></div>', 'bo-scan', function(){ scan(); });
  startCamera();
}
function startCamera(){
  var video = document.getElementById('bs-video'), msg = document.getElementById('bs-msg');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ msg.textContent = L('Camera not available in this browser','המצלמה אינה זמינה בדפדפן זה'); return; }
  var stream, alive = true, det = null, canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently:true });
  stopScan = function(){ alive = false; if (stream) stream.getTracks().forEach(function(t){ t.stop(); }); try { video.srcObject = null; } catch (e) {} };
  navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:'environment' }, width:{ ideal:1280 } }, audio:false }).then(function(st){
    if (!alive){ st.getTracks().forEach(function(t){ t.stop(); }); return; }
    stream = st; video.srcObject = st; try { var pp = video.play(); if (pp && pp.catch) pp.catch(function(){}); } catch(e){}   // closing the scanner while play() is pending must not raise
    msg.textContent = L('Point the camera at a wristband QR code','כוון את המצלמה אל קוד ה-QR של הצמיד');
    if ('BarcodeDetector' in W){ try { det = new BarcodeDetector({ formats:['qr_code'] }); } catch(e){ det = null; } }
    var ready = det ? Promise.resolve() : loadJsQR();
    ready.then(function(){
      (function tick(){
        if (!alive) return;
        if (video.readyState >= 2){
          var p;
          if (det){ p = det.detect(video).then(function(r){ return r[0] ? r[0].rawValue : null; }).catch(function(){ return null; }); }
          else {
            canvas.width = video.videoWidth; canvas.height = video.videoHeight; ctx.drawImage(video, 0, 0);
            var img = ctx.getImageData(0, 0, canvas.width, canvas.height), r = W.jsQR(img.data, img.width, img.height, { inversionAttempts:'dontInvert' });
            p = Promise.resolve(r ? r.data : null);
          }
          p.then(function(txt){
            if (!alive) return;
            if (txt){ alive = false; if (handle(txt)) return; alive = true; msg.textContent = scanMode ? L('That is not a casualty tag — try again','זה לא תג נפגע — נסו שוב') : L('Not a Shomer Ahi wristband — try again','זה לא צמיד של שומר אחי — נסה שוב'); }
            setTimeout(tick, 120);
          });
        } else setTimeout(tick, 120);
      })();
    }, function(){ alive = false; stopScan(); msg.textContent = L('The scanner could not load. Type the code below, or use a sample wristband.','לא ניתן לטעון את הסורק. הקלידו את הקוד למטה, או השתמשו בצמיד לדוגמה.'); });
  }).catch(function(){ msg.textContent = scanMode ? L('Camera blocked or unavailable — tap a blank tag below or type its ID','המצלמה חסומה או לא זמינה — בחרו תג ריק למטה או הקלידו את מספרו') : L('Camera blocked or unavailable — use a sample wristband below','המצלמה חסומה או לא זמינה — השתמש בצמיד לדוגמה למטה'); });
}
function manual(form){
  var v = form.c.value.trim(), m = /^#?\s*(\d{1,4})$/.exec(v);
  if (parseTag(v)){ handle(v); return false; }
  if (scanMode){ W.toast(L('Type the tag ID, e.g. SA-0431','הקלידו את מספר התג, למשל SA-0431'), false); return false; }
  if (m && W.casNum){   // "4" or "#4": the casualty number
    var c = (W._incidentCasualties || []).filter(function(x){ return W.casNum(x) === +m[1]; })[0];
    if (c){ showCard(snapshot(c)); return false; }
    W.toast(L('No casualty number ' + m[1],'אין נפגע מספר ' + m[1]), false); return false;
  }
  if (!handle(v)) W.toast(L('No wristband or tag with that code','לא נמצא צמיד או תג עם הקוד הזה'), false);
  return false;
}
function openSerialOrDoc(id){
  var c = (W._incidentCasualties || []).filter(function(x){ return x._docId === id; })[0];
  if (c) showCard(snapshot(c));
}

// ── Bracelets tab ──────────────────────────────────────────────
// One full-size wristband for the selected casualty, then a list that swaps it. Band, caption and actions live in one card.
var selId = null;
function renderTab(){
  var list = W._incidentCasualties || [];
  var cur = list.filter(function(c){ return c._docId === selId; })[0] || list[0];
  var h = '<div class="bt-hero"><div><h2>' + L('Tags and wristbands','תגים וצמידים') + '</h2><p>' + L('Each casualty wears a tag. Scan it at the end of Form 101 to link the record.','כל נפגע עונד תג. סורקים אותו בסוף טופס 101 כדי לקשר את התיק.') + '</p></div>'
    + '<div class="bt-cta"><button class="xbtn xbtn-primary xbtn-lg" onclick="Bracelet.scan()">' + ico('scan-line', 24) + L('Scan','סריקה') + '</button>'
    + '<button class="xbtn xbtn-lg" onclick="Bracelet.printTags(12)">' + ico('tag', 24) + L('Print blank tags','הדפסת תגים ריקים') + '</button></div></div>'
    + '<ol class="bt-steps2">'
    +   '<li><i>1</i>' + ico('tag', 24) + '<b>' + L('Tag on','תג על הנפגע') + '</b></li>'
    +   '<li><i>2</i>' + ico('scan-line', 24) + '<b>' + L('Scan to link','סריקה לקישור') + '</b></li>'
    +   '<li><i>3</i>' + ico('qr-code', 24) + '<b>' + L('Hand off','העברה') + '</b></li>'
    + '</ol>';
  if (!cur) return h + '<p class="bt-empty">' + L('No casualties yet.','אין עדיין נפגעים.') + '</p>';
  var id = esc(cur._docId);
  h += '<article class="bt-card" id="bt-sel">'
    + '<div class="bt-card-h">' + W.TriageUI.chip(cur.triageColor) + '<div><div class="bt-name">' + (W.casBadge ? W.casBadge(cur, true) + ' ' : '') + esc(String(T(cur.name)).split(' — ')[0]) + '</div>'
    + '<div class="bt-sub">' + (cur.tagId ? (W.casTag ? W.casTag(cur) : '') : '<button class="xbtn bt-link" onclick="Bracelet.scanTag(\'' + id + '\')">' + ico('link', 22) + L('Link to tag','קישור לתג') + '</button>') + ' ' + L('Handoff QR','QR להעברה') + ' <code dir="ltr">' + esc(serialFor(cur)) + '</code>' + (cur.formLevel === 'quick' ? ' · ' + L('Quick triage','מיון מהיר') : '') + '</div></div></div>'
    + '<div class="bt-band">' + braceletHtml(cur) + '</div>'
    + '<div class="bt-btns2"><button class="xbtn xbtn-primary" onclick="Bracelet.viewCard(\'' + id + '\')">' + ico('eye', 24) + L('What a scan shows','מה רואים בסריקה') + '</button>'
    + '<button class="xbtn" onclick="Bracelet.open(\'' + id + '\')">' + ico('printer', 24) + L('Print','הדפסה') + '</button></div>'
    + '</article>';
  h += '<h3 class="bt-lh">' + L('All casualties','כל הנפגעים') + ' <span>(' + list.length + ')</span></h3><div class="bt-picks">';
  list.forEach(function(c){
    var on = c === cur;
    h += '<button class="bt-pick' + (on ? ' on' : '') + '" aria-pressed="' + on + '" onclick="Bracelet.pick(\'' + esc(c._docId) + '\')">'
      + W.TriageUI.chip(c.triageColor)
      + '<span class="bt-pn"><b>' + (W.casBadge ? W.casBadge(c) + ' ' : '') + esc(String(T(c.name)).split(' — ')[0]) + '</b>' + (c.tagId && W.casTag ? W.casTag(c) : '<code dir="ltr">' + L('No tag','ללא תג') + '</code>') + '</span>'
      + (on ? '<em>' + ico('check', 22) + L('Shown','מוצג') + '</em>' : ico(lang() === 'he' ? 'chevron-left' : 'chevron-right', 26))
      + '</button>';
  });
  return h + '</div>';
}
function pick(docId){
  selId = docId;
  if (W.renderIncidentPage) W.renderIncidentPage();
  setTimeout(function(){ var el = document.getElementById('bt-sel'); if (el && el.scrollIntoView) el.scrollIntoView({ behavior:'smooth', block:'start' }); }, 30);
}

// ── Hash route: a scanned QR opens the card directly ───────────
function route(){
  var tg = /#t=/.test(location.hash) ? parseTag(location.hash) : null;
  if (tg){ history.replaceState(null, '', location.pathname + location.search); (function t(){ if (document.querySelector('.dn')) return setTimeout(t, 400); openTag(tg); })(); return; }
  if (!/#b=/.test(location.hash)){ if (overlay && overlay.classList.contains('bo-card')) close(true); return; }
  var s = parseScan(location.hash);
  if (s) showCard(s); else { history.replaceState(null, '', location.pathname + location.search); (function t(){ if (document.querySelector('.dn')) return setTimeout(t, 400); W.toast(L('That wristband link is not valid. Open a wristband from the Wristbands tab, or scan one.','קישור הצמיד אינו תקין. פתחו צמיד מלשונית הצמידים, או סרקו אחד.'), false); })(); }
}
W.addEventListener('hashchange', route);
W.addEventListener('pagehide', function(){ if (stopScan){ try { stopScan(); } catch (e) {} stopScan = null; } });

function take(){
  var s = last; if (!s) return;
  var id = 'cas_' + Date.now().toString(36) + '_b', iso = function(sec){ return new Date(sec * 1000).toISOString(); };
  var rec = { _docId:id, id:id, name:s.n || 'נפגע מצמיד', idNumber:'', triageColor:s.t === 'gray' ? 'black' : (s.t || ''), formLevel:'quick', moi:'', injuredRegions:[], injuries:[], treatments:[],
    xabcde:{ x:{tourniquets:(s.tq || []).filter(function(t){ return t && t[1]; }).map(function(t){ return { site:t[0], time:iso(t[1]) }; }),pressureDressings:[],hemostatic:[],woundPacking:[]}, a:{status:'',interventions:[]}, b:{respiratoryRate:null,tubeThora:null,oxygen:null}, c:{pulseCharacter:'',capRefill:null,ivAccess:[],fluids:[]}, d:{avpu:'',gcs:null,pupils:{left:{size:null,reactive:null},right:{size:null,reactive:null}},motorFunction:{}}, e:{hypothermiaPrevention:'',medications:[],notes:''} },
    evacPriority:'', painScore:null, vitalsHistory:[], timeline:[{ time:new Date().toISOString(), category:'triage', action:'נקלט מצמיד QR — לא מאומת', details:'' }],
    secondarySurvey:{ headToToe:{}, o2Flow:null, tqReeval:[], structured:{} }, examsHistory:[], reportedBy:'demo', reportedByName:'חובש דמו', timestamp:{ toDate:function(){ return new Date(); } } };
  W._upsertOfflineCasualty(rec); close(); W._incidentTab = 'casualties';
  setTimeout(function(){ W.editCasualtyById(id); }, 60);
}

// ── Casualty tags ──────────────────────────────────────────────
// A pre-printed tag carries only its own ID (big print + a small QR of https://…/#t=SA-0427). Scanning it at the end of Form 101
// links that record to the tag; scanning it again anywhere opens the record. The tag never carries medical data: on another
// phone it means nothing until the record arrives, which is what the Handoff QR (the record inside the code) is for.
var TAG_FIRST_BLANK = 431, scanMode = null;
function parseTag(text){
  var t = String(text || '').trim().slice(0, 300), m = /^(?:https?:\/\/[^\s#]*)?#t=(SA-?\d{4})$/i.exec(t) || /^(SA)-?(\d{4})$/i.exec(t.replace(/\s+/g, ''));
  if (!m) return null;
  var d = /(\d{4})$/.exec(m[2] || m[1]); return d ? 'SA-' + d[1] : null;
}
function tagUrl(id){ return baseUrl() + '#t=' + id; }
function casList(){ return W._incidentCasualties || []; }
function byId(id){ return casList().filter(function(c){ return c._docId === id; })[0]; }
function byTag(t){ return casList().filter(function(c){ return c.tagId === t; })[0]; }
function nm(c){ return W.casLabel ? W.casLabel(c) : esc(String(T(c.name)).split(' — ')[0]); }
function freeTags(n){
  var used = {}, out = []; casList().forEach(function(c){ if (c.tagId) used[c.tagId] = 1; });
  for (var k = TAG_FIRST_BLANK; out.length < n && k < 9999; k++){ var id = 'SA-' + ('000' + k).slice(-4); if (!used[id]) out.push(id); }
  return out;
}
function tagSamples(blankOnly){
  var linked = blankOnly ? [] : casList().filter(function(c){ return c.tagId; }).slice(0, 2).map(function(c){ return c.tagId; });
  return linked.concat(freeTags(blankOnly ? 3 : 1)).map(function(t){
    var c = byTag(t);
    return '<button class="bs-sample bs-tag" onclick="Bracelet.handle(\'' + t + '\')">' + ico('tag', 24) + '<code dir="ltr">' + t + '</code><span class="bs-nm">' + (c ? nm(c) : L('Blank tag','תג ריק')) + '</span></button>';
  }).join('');
}
// The one entry point for anything scanned or typed: camera, manual box, sample buttons and tests all come through here.
function handle(txt){
  var t = parseTag(txt);
  if (t){ if (scanMode) linkTag(t); else openTag(t); return true; }
  if (scanMode) return false;   // linking expects a tag, not a record QR
  var s = parseScan(txt); if (s){ showCard(s); return true; }
  return false;
}
function scanTag(docId, after){
  var c = byId(docId);
  mount(topbar(L('Link to tag','קישור לתג')) + '<div class="bo-body">'
    + '<div class="tg-who">' + (c && W.TriageUI ? W.TriageUI.chip(c.triageColor) : '') + (c && W.casBadge ? W.casBadge(c, true) : '') + '<b>' + (c ? nm(c) : '') + '</b></div>'
    + '<div class="bs-view" id="bs-view"><video id="bs-video" playsinline muted></video><div class="bs-frame"></div><div class="bs-msg" id="bs-msg">' + L('Starting camera…','מפעיל מצלמה…') + '</div></div>'
    + '<p class="tg-note">' + ico('info', 22) + '<span>' + L('Scan the tag on this casualty. The tag holds only its ID; the record stays on this phone. To pass the record on, show the Handoff QR.','סרקו את התג שעל הנפגע. התג נושא רק את המספר שלו; התיק נשאר בטלפון הזה. כדי להעביר את התיק, הציגו את ה-QR להעברה.') + '</span></p>'
    + '<div class="bs-or">' + L('No camera? Tap a blank tag:','אין מצלמה? בחרו תג ריק:') + '</div><div class="bs-samples bs-tags">' + tagSamples(true) + '</div>'
    + '<form class="bs-manual" onsubmit="return Bracelet.manual(this)"><input name="c" placeholder="' + L('Or type the tag ID (SA-0431)','או הקלידו את מספר התג (SA-0431)') + '" autocomplete="off" autocapitalize="characters" spellcheck="false"><button class="xbtn">' + ico('link', 24) + L('Link','קישור') + '</button></form></div>', 'bo-scan bo-tag', function(){ scanTag(docId, after); });
  scanMode = { docId: docId, after: after || null };   // set after mount: mount() closes the previous view
  startCamera();
}
function tlPush(c, action){
  if (W._casualtyEditMode && W._casualtyEditId === c._docId){
    (W._casualtyTimeline || []).push({ time: new Date(), category:'triage', action: action, details:'' });   // not on the form's undo stack: the link has its own undo
    if (W.MedHost && W.MedHost.triggerAutoSave) W.MedHost.triggerAutoSave();
    return 'form';
  }
  var tl = (c.timeline || []).slice(); tl.push({ time: new Date().toISOString(), category:'triage', action: action, details:'' });
  W._upsertOfflineCasualty({ _docId: c._docId, timeline: tl }); return 'rec';
}
function tlPop(c, action, where){
  if (where === 'form'){ var t = W._casualtyTimeline || []; for (var i = t.length - 1; i >= 0; i--) if (t[i].action === action){ t.splice(i, 1); break; } return; }
  var cur = byId(c._docId); if (!cur) return;
  var tl = (cur.timeline || []).slice(); for (var j = tl.length - 1; j >= 0; j--) if (tl[j].action === action){ tl.splice(j, 1); break; }
  W._upsertOfflineCasualty({ _docId: c._docId, timeline: tl });
}
function linkTag(t){
  var mode = scanMode, c = mode && byId(mode.docId); if (!c) return;
  var other = byTag(t);
  if (other && other._docId !== c._docId){
    mount(topbar(L('Tag already in use','התג כבר בשימוש'), true) + '<div class="bo-body"><div class="tg-warn">' + ico('triangle-alert', 30)
      + '<div><b dir="auto">' + L('Tag ' + t + ' is already on ' + nm(other),'התג ' + t + ' כבר מקושר ל' + nm(other)) + '</b><p>' + L('One tag, one casualty. Check the tag on the casualty in front of you.','תג אחד, נפגע אחד. בדקו את התג על הנפגע שמולכם.') + '</p></div></div>'
      + '<div class="bo-actions"><button class="xbtn xbtn-primary" onclick="Bracelet.close();Demo.openCasualty(\'' + esc(other._docId) + '\')">' + ico('file-text', 24) + L('Open ' + nm(other),'פתיחת ' + nm(other)) + '</button>'
      + '<button class="xbtn" onclick="Bracelet.scanTag(\'' + esc(c._docId) + '\')">' + ico('scan-line', 24) + L('Scan another tag','סריקת תג אחר') + '</button>'
      + '<button class="xbtn" onclick="Bracelet.close()">' + ico('x', 24) + L('Cancel','ביטול') + '</button></div></div>', 'bo-card bo-tagwarn', null);
    scanMode = null;
    return;
  }
  scanMode = null; close(true);
  if (other){ W.toast(L(nm(c) + ' is already on tag ' + t, nm(c) + ' כבר מקושר לתג ' + t), false); if (mode.after) mode.after(); return; }
  var prev = c.tagId || '', action = 'קושר לתג ' + t;
  W._upsertOfflineCasualty({ _docId: c._docId, tagId: t });
  var where = tlPush(c, action);
  if (W.renderIncidentPage) W.renderIncidentPage();
  var msg = L(nm(c) + ' linked to tag ' + t, nm(c) + ' קושר לתג ' + t);
  var undo = function(){ W._upsertOfflineCasualty({ _docId: c._docId, tagId: prev }); tlPop(c, action, where); if (W.renderIncidentPage) W.renderIncidentPage(); W.toast(L('Undone: link to tag ' + t,'בוטל: קישור לתג ' + t), false); };
  if (W.Field && W.Field.toast) W.Field.toast(msg, undo); else W.toast(msg, false);
  if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
  if (mode.after) mode.after();
}
// Link the casualty open in Form 101 (saving a brand-new one first so it has an id).
function linkForm(){
  var go = function(id){ if (id) scanTag(id); };
  if (W._casualtyEditId && byId(W._casualtyEditId)) return go(W._casualtyEditId);
  Promise.resolve(W.saveCasualtyData && W.saveCasualtyData()).then(function(id){ go(id || W._casualtyEditId); });
}
function openTag(t){
  var c = byTag(t);
  if (c){ close(true); if (W.Demo && W.Demo.openCasualty) W.Demo.openCasualty(c._docId); else if (W.editCasualtyById) W.editCasualtyById(c._docId); return; }
  mount(topbar(L('Tag ' + t,'תג ' + t), true) + '<div class="bo-body"><div class="tg-big" dir="ltr">' + ico('tag', 34) + t + '</div>'
    + '<p class="tg-note">' + ico('info', 22) + '<span>' + L('Not linked on this phone. If another medic treated this casualty, the record is on their phone: scan their Handoff QR.','לא מקושר בטלפון הזה. אם חובש אחר טיפל בנפגע, התיק נמצא בטלפון שלו: סרקו את ה-QR להעברה שלו.') + '</span></p>'
    + '<div class="bo-actions"><button class="xbtn xbtn-primary" onclick="Bracelet.newWithTag(\'' + t + '\')">' + ico('plus', 26) + L('New casualty with this tag','נפגע חדש עם התג הזה') + '</button>'
    + '<button class="xbtn" onclick="Bracelet.scan()">' + ico('qr-code', 24) + L('Scan a Handoff QR','סריקת QR להעברה') + '</button>'
    + '<button class="xbtn" onclick="Bracelet.close()">' + ico('x', 24) + L('Close','סגירה') + '</button></div></div>', 'bo-card bo-tagnew', function(){ openTag(t); });
}
function newWithTag(t){
  close(true);
  if (byTag(t)) return openTag(t);
  if (W.Demo && W.Demo.newFull) W.Demo.newFull(); else if (W.newCasualty) W.newCasualty();
  setTimeout(function(){
    Promise.resolve(W.saveCasualtyData && W.saveCasualtyData()).then(function(id){
      id = id || W._casualtyEditId; var c = byId(id); if (!c) return;
      W._upsertOfflineCasualty({ _docId: id, tagId: t }); tlPush(byId(id), 'קושר לתג ' + t);
      if (W.renderIncidentPage) W.renderIncidentPage();
      if (W.Field && W.Field.toast) W.Field.toast(L(nm(c) + ' linked to tag ' + t, nm(c) + ' קושר לתג ' + t), null);
    });
  }, 80);
}
function tagHtml(id, print){
  return '<div class="tg-card"><div class="tg-qr">' + qrSvg(tagUrl(id), print ? 96 : 120) + '</div>'
    + '<div class="tg-txt"><span class="tg-brand">' + L('Shomer Ahi · casualty tag','שומר אחי · תג נפגע') + '</span><b dir="ltr">' + id + '</b>'
    + '<span class="tg-line">' + L('Casualty no.','נפגע מס׳') + ' <i></i></span></div></div>';
}
function printTags(n){
  n = n || 12;
  var he = lang() === 'he', ids = freeTags(n);
  var css = '*{box-sizing:border-box;margin:0}body{font-family:Inter,Heebo,Arial,sans-serif;background:#eceff3;color:#111;padding:20px}'
    + '.bar{max-width:210mm;margin:0 auto 14px;background:#fff;border-radius:10px;padding:14px 16px;display:flex;gap:14px;align-items:center;justify-content:space-between}.bar b{display:block;font-size:15px}.bar span{font-size:12px;color:#555}.bar button{background:#111;color:#fff;border:0;border-radius:8px;padding:11px 18px;font:600 14px inherit;cursor:pointer}'
    + '.sheet{max-width:210mm;margin:0 auto;background:#fff;padding:10mm;display:grid;grid-template-columns:repeat(2,1fr);gap:6mm}'
    + '.tg-card{display:flex;gap:4mm;align-items:center;border:1px dashed #888;border-radius:3mm;padding:4mm;break-inside:avoid}.tg-qr svg{width:26mm;height:26mm;display:block}'
    + '.tg-txt{display:flex;flex-direction:column;gap:1.5mm}.tg-brand{font-size:9pt;color:#555}.tg-txt b{font-size:24pt;letter-spacing:.02em}.tg-line{font-size:11pt;display:flex;gap:2mm;align-items:flex-end}.tg-line i{display:inline-block;width:22mm;border-bottom:1.5px solid #111;height:7mm}'
    + '@media print{body{background:#fff;padding:0}.bar{display:none}.sheet{padding:8mm;max-width:none}@page{size:A4;margin:0}}';
  var html = '<!DOCTYPE html><html lang="' + (he ? 'he' : 'en') + '" dir="' + (he ? 'rtl' : 'ltr') + '"><head><meta charset="UTF-8"><title>' + L('Blank casualty tags','תגי נפגע ריקים') + '</title><style>' + css + '</style></head><body>'
    + '<div class="bar"><div><b>' + L('Blank casualty tags','תגי נפגע ריקים') + '</b><span>' + L('Print at 100% on A4. Write the casualty number on the tag, attach it, then scan it at the end of Form 101.','הדפיסו ב-100% על A4. כתבו על התג את מספר הנפגע, הצמידו, וסרקו בסוף טופס 101.') + '</span></div>'
    + '<button onclick="window.print()">' + L('Print / Save as PDF','הדפס / שמור כ-PDF') + '</button></div>'
    + '<div class="sheet">' + ids.map(function(id){ return tagHtml(id, true); }).join('') + '</div></body></html>';
  var w = W.open('', '_blank');
  if (!w){ W.toast(L('Allow pop-ups to print','אפשר חלונות קופצים כדי להדפיס'), false); return null; }
  w.document.open(); w.document.write(html); w.document.close();
  try { w.opener = null; } catch (e) {}
  return w;
}
W.casTag = function(c){ return c && c.tagId ? '<span class="ctag" dir="ltr">' + ico('tag', 24) + esc(c.tagId) + '</span>' : ''; };
if (W.ShowcaseI18n && W.ShowcaseI18n.extend) W.ShowcaseI18n.extend({ 'קושר לתג':'Linked to tag', 'נקלט מצמיד QR — לא מאומת':'Taken over from a QR wristband — unverified', 'נפגע מצמיד':'Casualty from wristband' });
W.Bracelet = { take: take, pack: pack, unpack: unpack, decode: decodeSnap, parse: parseScan, linkFor: linkFor,  serialFor: serialFor, snapshot: snapshot, braceletHtml: braceletHtml, renderTab: renderTab, route: route,
  open: showBracelet, pick: pick, viewCard: viewCard, copy: copy, print: print, scan: scan, manual: manual, close: close,
  openCardFor: openSerialOrDoc, handle: handle, parseTag: parseTag, tagUrl: tagUrl, scanTag: scanTag, linkForm: linkForm, openTag: openTag, newWithTag: newWithTag, printTags: printTags, freeTags: freeTags, tagHtml: tagHtml, relang: function(){ if (overlay && redo) redo(); }, css: brcCss };

// Hooks used by the shared form (pair wristband / find by code / export).
W.openBraceletFromCard = function(docId){ showBracelet(docId); };
W.openBraceletLookup = function(){ scan(); };
// From the casualty form: show this casualty's bracelet (saving a brand-new casualty first).
W.openBraceletExport = function(){
  if (W._casualtyEditId) return showBracelet(W._casualtyEditId);
  W.saveCasualtyData().then(function(id){ showBracelet(id || W._casualtyEditId); });
};
})();
