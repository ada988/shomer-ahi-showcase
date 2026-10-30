/* DOSE CALCULATOR — doses from the IDF Trauma and Operational Medicine Book (2026 edition, chapters 3, 4, 9, 11, 14, 15, 16, 18).
   Reads this casualty: weight and age (or the book's weight-for-age table), pain score, shock state, wounds, IV access,
   time since injury and every dose already given. Shows what is due now and why, the exact dose, the volume to draw
   (drawn on a syringe), repeat timers and 24-hour totals, and asks for a read-back before anything is recorded.
   Software output: a medical professional decides. */
(function(){
'use strict';
var W = window, Field = W.Field;
if (W.SHOWCASE_DICT) Object.assign(W.SHOWCASE_DICT, { 'גישה תוך-גרמית: IO':'IO access', 'גישה ורידית: IV':'IV access' });
function lang(){ return (W.ShowcaseI18n && W.ShowcaseI18n.lang) || 'en'; }
function L(en, he){ return lang() === 'he' ? he : en; }
function ico(n, s){ return W.Icon ? W.Icon(n, s) : ''; }
function X(){ return W._casualtyXABCDE || {}; }
function r1(v){ return Math.round(v * 10) / 10; }
function r2(v){ return Math.round(v * 100) / 100; }
function r0(v){ return Math.round(v); }
function fmt(v){ return String(r2(v)); }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]; }); }
function hm(t){ var d = new Date(t); return isNaN(d) ? '--:--' : String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }
function minsSince(t){ return (Date.now() - new Date(t).getTime()) / 60000; }
function mmss(sec){ sec = Math.max(0, Math.ceil(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
function kgW(v){ return fmt(v) + L(' kg', ' ק״ג'); }
var NOCHILD = function(){ return L('Child: the book gives no child dose. A doctor decides.', 'ילד: אין מינון לילדים בספר. רופא מחליט.'); };

// Weight for age: the book table (ch. 18, appendix B) via the engine; APLS above age 10.
function estWeight(age){
  if (age == null) return null;
  if (W._broselowWeight) return W._broselowWeight(age);
  if (age < 0.5) return 3.5; if (age < 1) return 7; if (age < 4) return 11; if (age < 8) return 17; if (age < 11) return 27; return 70;
}
// Broselow tape colour zone for a weight (shown with its word, never colour alone)
var ZONES = [[3,5,'GREY','אפור','#9aa0a8'],[6,7,'PINK','ורוד','#f49ac1'],[8,9,'RED','אדום','#e5383b'],[10,11,'PURPLE','סגול','#9b5de5'],[12,14,'YELLOW','צהוב','#f5d000'],[15,18,'WHITE','לבן','#ffffff'],[19,23,'BLUE','כחול','#3a86ff'],[24,29,'ORANGE','כתום','#ff8c1a'],[30,36,'GREEN','ירוק','#2dc653']];
function zone(kg){ for (var i = 0; i < ZONES.length; i++){ if (kg >= ZONES[i][0] - 0.5 && kg < ZONES[i][1] + 0.5) return ZONES[i]; } return null; }

function painNow(){ try { return typeof _casualtyPainScore !== 'undefined' ? _casualtyPainScore : null; } catch (e){ return null; } }
function injuries(){ try { return typeof _casualtyInjuries !== 'undefined' ? (_casualtyInjuries || []) : []; } catch (e){ return []; } }

function patient(){
  var x = X(), e = x.e || {}, age = e.ageYears != null && e.ageYears !== '' ? Number(e.ageYears) : null, wt = Number(e.weightKg) || null, est = !!(wt && e.weightEst);
  if (!wt){ wt = estWeight(age); est = wt != null; }
  var ageless = !wt;
  if (!wt){ wt = 70; est = true; }
  var ctx = W.buildCasualtyContext ? W.buildCasualtyContext() : {};
  var tl = W._casualtyVitals || [], lastOf = function(k){ for (var i = tl.length - 1; i >= 0; i--){ if (tl[i] && tl[i][k] != null && tl[i][k] !== '') return Number(tl[i][k]); } return null; };
  var si = W._shockInputs ? W._shockInputs() : { sys: lastOf('bpSys'), hr: lastOf('pulse'), rp: '' };
  var sys = si.sys != null ? Number(si.sys) : lastOf('bpSys'), hr = si.hr != null ? Number(si.hr) : lastOf('pulse'), rp = si.rp || '';
  var inj = Field && Field.injuryInfo ? Field.injuryInfo() : null;
  var pen = injuries().some(function(i){ return i && i.type === 'penetrating'; });
  var child = age != null ? age < 12 : !!(W.isPedsMode && W.isPedsMode());
  var d = x.d || {}, avpu = String(d.avpu || '').toUpperCase(), gcs = d.gcs != null && d.gcs !== '' ? Number(d.gcs) : null;
  var crt = parseFloat((x.c || {}).capRefill), spo2 = lastOf('spo2'), rr = lastOf('rr'), temp = lastOf('temp');
  var sbpMin = W._sbpMinFor ? W._sbpMinFor(age) : (child ? Math.min(90, 70 + 2 * (age || 0)) : 90);
  var hrLim = child ? (age < 1 ? 170 : age < 3 ? 160 : age < 6 ? 150 : 130) : 130;
  var deep = !!ctx.deepShock, shock = !!ctx.anyShock || deep || !!ctx.shock;
  // the evidence behind "suspected shock", in words (engine criteria: SBP for age, HR for age, radial pulse, CRT over 3 s, AVPU, shock index)
  var ev = [];
  if (sys != null && sys < sbpMin) ev.push(L('SBP ','ל״ד ') + sys);
  if (hr != null && hr > hrLim) ev.push(L('HR ','דופק ') + hr);
  if (rp === 'absent') ev.push(L('no radial pulse','אין דופק רדיאלי')); else if (rp === 'weak') ev.push(L('weak radial','רדיאלי חלש'));
  if (!isNaN(crt) && crt > 3) ev.push(L('CRT ','מילוי קפילרי ') + crt + L(' s',' שנ׳'));
  if (/^[VPU]$/.test(avpu) && shock) ev.push('AVPU ' + avpu);
  if (!child && hr && sys && hr / sys > 0.9) ev.push(L('shock index ','מדד הלם ') + (hr / sys).toFixed(1));
  var allergy = String(e.allergies || '').trim(); if (/^(לא ידוע|אין|ללא|none|nkda|no|unknown|-)$/i.test(allergy)) allergy = '';
  return { age:age, child:child, wt:wt, est:est, ageless:ageless,
    deep: deep, shock: shock, evid: ev, sys: sys, hr: hr, sbpMin: sbpMin, lowBP: sys != null && sys < sbpMin,
    profound: (age != null && age < 12) ? (deep || (sys != null && sys < 70 + 2 * Math.max(1, age))) : ((sys != null && sys < 90) || (hr != null && hr > 130) || deep || !!ctx.profoundShock),
    avpu: avpu, gcs: gcs, uncon: avpu === 'U' || (gcs != null && gcs <= 8), altered: /^[VPU]$/.test(avpu) || (gcs != null && gcs < 15),
    spo2: spo2, rr: rr, temp: temp, resp: (rr != null && rr < 10) || (spo2 != null && spo2 < 90), hypo: !!ctx.hypothermic || (temp != null && temp < 36),
    allergy: allergy, preg: e.pregnant === true, burns: !!ctx.burns, tbi: !!ctx.hasTBI || injuries().some(function(i){ return i && /head|face/.test(String(i.region || '')); }),
    neck: injuries().some(function(i){ return i && /neck/.test(String(i.region || '')); }), mins: ctx.minSinceInjury != null ? ctx.minSinceInjury : null,
    inj: inj, pain: painNow(), pen: pen, penTorso: !!ctx.penetratingTorso, penHNA: !!ctx.penetratingHeadNeckAbd,
    iv: hasAccess(x.c || {}), io: isIO(x.c || {}), meds: e.medications || [], fluids: (x.c || {}).fluids || [] };
}

/* FINDINGS → RULES. Every rule below is stated by the IDF Trauma and Operational Medicine Book (Jan 2026, beta/… .txt line refs)
   or by this project's engine (shared/medical-forms.js), or MDA ALS 2024 where the owner chose it. Nothing else. */
var ALG = { txa:/TXA|טרנקס|הקסק|hexak|tranex/i, ket:/קטמין|ketam/i, mor:/מורפ|morph|אופי|opi/i, fen:/פנטנ|fentan|אקטיק|actiq|אופי|opi/i,
  para:/אקמול|פרצט|paracet|acetam|אופטלג|dipyr|optalg|metamiz/i, meto:/פרמין|metoc|pramin/i, cef:/צפטר|ceftr|צפלו|cephal/i, met:/מטרונ|metron|flagyl|פלג׳?יל/i,
  mid:/דורמי|מידזו|midaz|dormic|בנזו|benzo/i, adr:/אדרנ|adren|epine/i, sol:/סולו|solu|methylpred|סטרואיד|steroid/i, ind:/קטמין|ketam|דורמי|מידזו|midaz/i };
function shockW(P){ return (P.deep ? L('Suspected deep shock','חשד להלם עמוק') : L('Suspected shock','חשד להלם')) + (P.evid.length ? ': ' + P.evid.join(' · ') : ''); }
function consW(P){ return P.gcs != null ? 'GCS ' + P.gcs : 'AVPU ' + P.avpu; }
function respW(P){ return [P.rr != null && P.rr < 10 ? L('RR ','נשימות ') + P.rr : '', P.spo2 != null && P.spo2 < 90 ? 'SpO2 ' + P.spo2 + '%' : ''].filter(Boolean).join(' · '); }
// A finding-based "do not give" for this casualty, or null
function contra(P, d){
  var id = d.id, A = ALG[id];
  if (A && P.allergy && A.test(P.allergy)) return L('Allergy recorded: ','רגישות שנרשמה: ') + P.allergy;
  // ch. 15 §6 (line 4121): unconscious and not ventilated: no pain drugs in the field
  if (/^(ket|mor|fen|para)$/.test(id) && P.uncon) return L('Unconscious (' + consW(P) + '): no pain drugs unless ventilated','חסר הכרה (' + consW(P) + '): ללא תרופות לכאב אלא אם מונשם');
  // ch. 15 §5 (line 4119): breathing worse → stop pain drugs; engine: RR<10 / SpO2<90, respiratory depressants (morphine, fentanyl, midazolam)
  if (/^(ket|mor|fen|mid)$/.test(id) && P.resp) return L('Breathing slowed (' + respW(P) + '): stop pain and sedative drugs. Bag-mask; naloxone if an opioid was given.','נשימה מדוכאת (' + respW(P) + '): להפסיק תרופות כאב והרגעה. הנשמה במפוח; נרקאן אם ניתן אופיואיד.');
  // ch. 15 (line 4058): nothing by mouth with reduced consciousness, penetrating torso, face or neck injury
  if (id === 'para' && P.altered) return L('Reduced consciousness (' + consW(P) + '): nothing by mouth','הכרה ירודה (' + consW(P) + '): לא דרך הפה');
  if (id === 'para' && P.neck) return L('Neck injury: nothing by mouth','פגיעת צוואר: לא דרך הפה');
  // engine OTFC warning: not with reduced consciousness; engine fentanyl warning + deep-shock alert: not in shock
  if (id === 'fen' && P.altered) return L('Reduced consciousness (' + consW(P) + '): no lozenge','הכרה ירודה (' + consW(P) + '): ללא סוכרייה');
  if (id === 'fen' && (P.shock || P.deep)) return shockW(P) + L(': no fentanyl',': ללא פנטניל');
  // MDA ALS 2024 (owner's choice): ketamine contraindicated with systolic over 180
  if (id === 'ket' && P.sys != null && P.sys > 180) return L('Systolic ' + P.sys + ' (over 180): no ketamine · MDA ALS 2024','סיסטולי ' + P.sys + ' (מעל 180): ללא קטמין · מד״א ALS 2024');
  // ch. 4 (lines 901–902): no induction drugs below GCS 5 unless the jaw is locked
  if (id === 'ind' && P.gcs != null && P.gcs < 5) return L('GCS ' + P.gcs + ' (under 5): no induction drugs unless the jaw is locked','GCS ' + P.gcs + ' (מתחת ל-5): ללא תרופות אינדוקציה אלא אם יש נעילת לסתות');
  return null;
}
// Patient findings chips: icon + word, tap → where it is recorded
function findings(P){
  var F = [], ch = function(ic, t, cls, go, foc){ F.push('<button class="dz-fd' + (cls ? ' ' + cls : '') + '" onclick="Field.doseFind(\'' + go + '\',\'' + (foc || '') + '\')">' + ico(ic, 22) + '<span>' + t + '</span></button>'); };
  if (P.deep || P.shock) ch('heart-pulse', shockW(P), 'red', 'fs-more', 'cas-bp-sys');
  else if (P.sys != null || P.hr != null) ch('heart-pulse', L('No suspected shock','אין חשד להלם') + (P.sys != null ? L(' · SBP ',' · ל״ד ') + P.sys : '') + (P.hr != null ? L(' · HR ',' · דופק ') + P.hr : ''), '', 'fs-more', 'cas-bp-sys');
  if (P.sys != null && P.sys > 180) ch('triangle-alert', L('Systolic ' + P.sys + ' (over 180)','סיסטולי ' + P.sys + ' (מעל 180)'), 'red', 'fs-more', 'cas-bp-sys');
  if (P.uncon) ch('brain', L('Unconscious · ','חסר הכרה · ') + consW(P), 'red', 'field', 'f-gcs-t');
  else if (P.altered) ch('brain', L('Reduced consciousness · ','הכרה ירודה · ') + consW(P), 'amber', 'field', 'f-gcs-t');
  else if (P.gcs != null || P.avpu) ch('brain', L('Alert · ','בהכרה · ') + consW(P), '', 'field', 'f-gcs-t');
  if (P.tbi) ch('brain', L('Head injury','פגיעת ראש'), 'amber', 'fs-body');
  if (P.resp) ch('wind', L('Breathing slowed · ','נשימה מדוכאת · ') + respW(P), 'red', 'fs-more', 'cas-spo2');
  else if (P.spo2 != null || P.rr != null) ch('wind', [P.spo2 != null ? 'SpO2 ' + P.spo2 + '%' : '', P.rr != null ? L('RR ','נשימות ') + P.rr : ''].filter(Boolean).join(' · '), '', 'fs-more', 'cas-spo2');
  if (P.allergy) ch('triangle-alert', L('Allergy: ','רגישות: ') + P.allergy, 'red', 'field');
  if (P.preg) ch('users', L('Pregnant','בהריון'), 'amber', 'field');
  if (P.pen) ch('crosshair', L('Penetrating: ','חודר: ') + penRegions(null), P.penTorso ? 'amber' : '', 'fs-body');
  if (P.burns) ch('flame', L('Burns','כוויות'), 'amber', 'fs-body');
  if (P.hypo) ch('thermometer', L('Cold','קר') + (P.temp != null ? ' · ' + P.temp + '°' : ''), 'amber', 'fs-more', 'cas-temp');
  if (P.mins != null) ch('clock', L('Injury ' + P.mins + ' min ago','פציעה לפני ' + P.mins + ' דק׳'), '', 'fs-time');
  ch(P.iv ? 'check' : 'x', P.io ? L('IO access','גישה גרמית (IO)') : P.iv ? L('IV access','גישה ורידית') : L('No IV or IO','אין וריד או IO'), P.iv ? '' : 'red', 'field');
  var given = P.meds.slice(-4).map(function(m){ return esc(W.ShowcaseI18n ? W.ShowcaseI18n.tr(String(m.drug || '')) : String(m.drug || '')) + ' ' + hm(m.time); });
  if (given.length) ch('syringe', L('Given: ','ניתן: ') + given.join(' · '), '', 'fs-time');
  var z = zone(P.wt); if (z && P.child) F.push('<span class="dz-fd"><i style="background:' + z[4] + '"></i><span>' + L('Broselow ' + z[2].charAt(0) + z[2].slice(1).toLowerCase(), 'ברוסלו ' + z[3]) + '</span></span>');
  return '<section class="dz-fds" aria-label="' + L('Patient findings','ממצאי המטופל') + '"><h3 class="dz-h3">' + ico('clipboard-list', 22) + L('Patient findings','ממצאי המטופל') + '</h3><div class="dz-fdg">' + F.join('') + '</div></section>';
}
// Decision summary: give now / changed dose / do not give, each line opens its card
function decisions(all, P){
  var full = shockW(P), brief = P.deep ? L('Suspected deep shock','חשד להלם עמוק') : L('Suspected shock','חשד להלם');
  var line = function(o, ic, t){ t = String(t).split(full).join(brief); return '<button class="dz-dl" onclick="Field.doseGo(\'' + o.d.id + '\')">' + ico(ic, 22) + '<span><b>' + o.d.en + '</b> ' + t + '</span></button>'; };
  var give = all.filter(function(o){ return o.s.due && !o.s.block; });
  var chg = all.filter(function(o){ return o.s.chg && !o.s.block; });
  var no = all.filter(function(o){ return o.s.block && (o.s.kind === 'contra' || o.s.kind === 'access'); });
  var sec = function(cls, ic, title, list, fn){ return list.length ? '<div class="dz-dg ' + cls + '"><h4>' + ico(ic, 22) + '<span>' + title + '</span><i>' + list.length + '</i></h4>' + list.map(fn).join('') + '</div>' : ''; };
  var h = sec('give', 'check', L('Give now','לתת עכשיו'), give, function(o){ return line(o, 'check', doseText(o.s.dose) + ' · ' + o.s.due); })
    + sec('chg', 'gauge', L('Changed dose','מינון משתנה'), chg, function(o){ return line(o, 'gauge', o.s.chg); })
    + sec('no', 'octagon', L('Do not give','לא לתת'), no, function(o){ return line(o, 'octagon', o.s.block); });
  return h ? '<section class="dz-dec" aria-label="' + L('Decision summary','סיכום החלטות') + '"><h3 class="dz-h3">' + ico('list-checks', 22) + L('What to give','מה לתת') + '</h3>' + h + '</section>' : '';
}
Field.doseFind = function(sec, foc){
  Field.doseClose();
  if (W.FormUI && W.FormUI.jump) W.FormUI.jump(sec);
  if (foc) setTimeout(function(){ var e = document.getElementById(foc); if (e){ e.scrollIntoView({ block:'center', behavior:'smooth' }); try { e.focus({ preventScroll:true }); } catch (x){} } }, 350);
};
Field.doseGo = function(id){
  var P = patient(), d = drugs(P).filter(function(x){ return x.id === id; })[0]; if (!d) return;
  var s = status(P, d); S.tab = s.due && !s.block ? 'now' : d.g; draw();
  var el = document.getElementById('dose-sheet'), c = el && el.querySelector('.dz-c[data-id="' + id + '"]');
  if (c){ c.scrollIntoView({ block:'start', behavior:'smooth' }); c.classList.add('dz-flash'); setTimeout(function(){ c.classList.remove('dz-flash'); }, 1600); }
};

function isIO(c){ var a = c.ivAccess; return c.ioAccess === true || a === 'IO' || (Array.isArray(a) && a.some(function(v){ return /^IO|תוך-גרמ/i.test(String((v && v.site) || v)); })); }
function hasAccess(c){ var a = c.ivAccess; return isIO(c) || (Array.isArray(a) ? a.length > 0 : !!a); }
// region words for reasons: name the wound that triggers the rule
function regionWord(r){ r = String(r || ''); return /head/.test(r) ? L('head','ראש') : r === 'neck' || /neck/.test(r) ? L('neck','צוואר') : /chest|upper_back/.test(r) ? L('chest','חזה') : /abdomen|lower_back/.test(r) ? L('belly','בטן') : r === 'pelvis' ? L('pelvis','אגן') : L('torso','גו'); }
function penRegions(list){ var seen = {}; return injuries().filter(function(i){ return i && i.type === 'penetrating' && (!list || list.indexOf(i.region) >= 0); }).map(function(i){ return regionWord(i.region); }).filter(function(w){ return seen[w] ? false : (seen[w] = true); }).join(', '); }
var TORSO = ['chest_r','chest_l','abdomen_r','abdomen_l','upper_back_r','upper_back_l','lower_back_r','lower_back_l','neck','pelvis'];
function givenOf(P, d){
  if (d.fluid) return P.fluids.filter(function(f){ return d.fluid.test(String(f.type || '')); });
  return P.meds.filter(function(m){ return d.match.test(String(m.drug || m.name || '')); });
}
function amountOf(m){ var s = String(m.dose || '').trim(), n = parseFloat(s.replace(/[^\d.]/g, '')) || 0; return /mcg/i.test(s) ? n / 1000 : /^[\d.]+\s*g$/i.test(s) ? n * 1000 : n; }

/* Drug table. Each: id, group, names, engine name, route, dose(P) → {v, u}, conc (mg per mL as drawn, or null),
   prep text, every (min between doses), max24 (mg), maxN (doses), stop() → reason, why() → reason it is due now. */
function drugs(P){
  var kg = P.wt, D = [];
  var inWin = P.inj ? P.inj.left > 0 : true;
  // ── BLEEDING AND SHOCK (ch. 3) ──
  D.push({ id:'txa', g:'shock', en:'TXA', sub:L('Tranexamic acid (Hexakapron)','חומצה טרנקסמית (הקסקפרון)'), eng:'TXA', match:/^TXA/i, route:'IV',
    dose: function(){ return { v: P.child ? Math.min(1000, r0(15 * kg)) : 1000, u:'mg' }; },
    rule: P.child ? L('15 mg/kg, max 1 g','15 מ״ג/ק״ג, עד 1 גרם') : L('1 g, once','1 גרם, פעם אחת'),
    prep: L('Slow IV. Not in the same line with blood at the same time: flush 10 mL saline between them.','לאט לווריד. לא באותו עירוי עם דם בו-זמנית: שטיפה ב-10 מ״ל סליין ביניהם.'),
    maxN: 1,
    stop: function(){ return !inWin ? L('More than 3 hours since injury: the book says do not give.','חלפו יותר מ-3 שעות מהפציעה: הספר קובע לא לתת.') : null; },
    why: function(){ if (!(P.deep || P.penTorso)) return null; return (P.deep ? shockW(P) : L('Penetrating wound: ','פצע חודר: ') + penRegions(TORSO)) + ' · ' + (P.inj ? L(P.inj.left + ' min left of the 3-hour window', 'נותרו ' + P.inj.left + ' דק׳ מחלון 3 השעות') : L('set the time of injury','קבעו שעת פציעה')); } });
  D.push({ id:'blood', g:'shock', en:L('Whole blood','דם מלא'), sub:L('Plasma (FDP) if no blood. 1:1 with PRBC if both used.','פלסמה (FDP) אם אין דם. 1:1 עם כדוריות אם שתיהן בשימוש.'), fluid:/דם|blood|FDP|פלסמה|plasma/i, ftype:'דם מלא', route:'IV',
    dose: function(){ return { v: P.child ? Math.min(500, r0(20 * kg)) : 500, u:'mL' }; },
    rule: P.child ? L('20 mL/kg (about 1 unit up to 20 kg)','20 מ״ל/ק״ג (כמנה אחת עד 20 ק״ג)') : L('1 unit, then stop and re-check','מנה אחת, ואז עצירה ובדיקה חוזרת'),
    prep: L('After EACH unit: stop, re-check blood pressure. Another unit only if still in deep shock. Target systolic 90.','אחרי כל מנה: עוצרים ומודדים לחץ דם. מנה נוספת רק אם עדיין בהלם עמוק. יעד סיסטולי 90.') + (P.child ? L(' Give with a syringe and a 3-way tap.',' מתן במזרק וברז תלת-כיווני.') : ''),
    stop: function(){ return !P.deep ? L('Only in suspected deep shock. None is recorded.','רק בחשד להלם עמוק. לא נרשם.') : null; },
    why: function(){ return P.deep ? shockW(P) : null; } });
  D.push({ id:'hart', g:'shock', en:L('Hartmann','הרטמן'), sub:L('Ringer lactate. Only if blood is more than 15 min away.','רינגר לקטט. רק אם דם רחוק יותר מ-15 דק׳.'), fluid:/הרטמן|hartmann|ringer/i, ftype:'הרטמן', route:'IV',
    dose: function(){ return { v: P.child ? Math.min(500, r0(20 * kg)) : 500, u:'mL' }; },
    rule: P.child ? L('20 mL/kg bolus','בולוס 20 מ״ל/ק״ג') : L('500 mL bolus','בולוס 500 מ״ל'),
    prep: L('Re-check after each bolus. Never as a "keep vein open" drip. Never mixed with ceftriaxone.','בדיקה חוזרת אחרי כל בולוס. לא כעירוי "לשמירת וריד". לא יחד עם צפטריאקסון.'),
    stop: function(){ return !P.deep ? L('Only in suspected deep shock, when blood is not close.','רק בחשד להלם עמוק, כשאין דם קרוב.') : null; } });

  // ── PAIN (ch. 15) ──
  var ket = { id:'ket', g:'pain', en:L('Ketamine','קטמין'), sub:L('First IV pain drug','תרופת הכאב הראשונה לווריד'), eng:'קטמין', match:/קטמין|ketamine/i, route:'IV',
    dose: function(){ return { v: P.child ? r1(0.3 * kg) : 25, u:'mg' }; },
    rule: P.child ? L('0.3 mg/kg','0.3 מ״ג/ק״ג') : L('25 mg single bolus','בולוס יחיד 25 מ״ג'),
    prep: L('Flush 10 mL saline. No relief after 5 min: morphine. Long evacuation: repeat every 45 min. Watch breathing and consciousness.','שטיפה 10 מ״ל סליין. אין הקלה אחרי 5 דק׳: מורפין. פינוי ממושך: חזרה כל 45 דק׳. מעקב נשימה והכרה.'),
    every: 45,
    stop: function(){ return !P.iv ? L('No IV access recorded. Without IV: fentanyl lozenge.','לא נרשמה גישה ורידית. בלי וריד: סוכריית פנטניל.') : null; },
    why: function(){ return P.pain != null && P.pain >= 5 ? L('Pain ' + P.pain + ' of 10','כאב ' + P.pain + ' מתוך 10') : null; } };
  D.push(ket);
  D.push({ id:'mor', g:'pain', en:L('Morphine','מורפין'), sub:L('If ketamine did not help after 5 min','אם קטמין לא עזר אחרי 5 דק׳'), eng:'מורפין', match:/מורפין|morphine/i, route:'IV',
    dose: function(){ return { v: P.child ? (P.profound ? r2(0.02 * kg) : r2(0.05 * kg)) : (P.profound ? 2 : 5), u:'mg' }; },
    rule: (P.child ? L('0.05 mg/kg (0.02 in shock)','0.05 מ״ג/ק״ג (0.02 בהלם)') : L('5 mg (2 mg in shock)','5 מ״ג (2 מ״ג בהלם)')) + (P.profound ? (P.child ? L(' · REDUCED: low blood pressure for age',' · מופחת: לחץ דם נמוך לגיל') : L(' · REDUCED: shock',' · מופחת: הלם')) : ''),
    prep: L('Repeat every 15 min while pain stays 5 or more.','חזרה כל 15 דק׳ כל עוד הכאב 5 ומעלה.') + (P.child ? L(' No IV: 0.1 mg/kg IM once.',' אין וריד: 0.1 מ״ג/ק״ג לשריר פעם אחת.') : ''),
    every: 15, chg: function(){ return P.profound ? (P.child ? L('0.02 mg/kg instead of 0.05 · ','0.02 מ״ג/ק״ג במקום 0.05 · ') : L('2 mg instead of 5 mg · ','2 מ״ג במקום 5 מ״ג · ')) + (P.evid.length ? shockW(P) : L('suspected shock','חשד להלם')) + ' · ' + L('book ch. 15','ספר פרק 15') : null; },
    stop: function(){ return !P.iv ? L('No IV access recorded.','לא נרשמה גישה ורידית.') : null; },
    why: function(){ if (!(P.pain != null && P.pain >= 5)) return null; var k = givenOf(P, ket); if (!k.length) return null; return minsSince(k[k.length - 1].time) >= 5 ? L('Pain still ' + P.pain + ' after ketamine','כאב עדיין ' + P.pain + ' אחרי קטמין') : null; } });
  D.push({ id:'fen', g:'pain', en:L('Fentanyl lozenge','סוכריית פנטניל'), sub:L('Actiq. When there is no IV.','אקטיק. כשאין וריד.'), eng:'פנטניל', match:/פנטניל|fentanyl/i, route:'OTFC',
    dose: function(){ return { v: 800, u:'mcg' }; }, rule: L('800 mcg, max 2','800 מק״ג, עד 2'),
    prep: L('Between cheek and gum, rub along the cheek. Do not chew. Still in pain after 15 min: a second one in the other cheek.','בין הלחי לחניכיים, לשפשף לאורך הלחי. לא ללעוס. עדיין כאוב אחרי 15 דק׳: שנייה בלחי השנייה.'),
    every: 15, maxN: 2,
    stop: function(){ return kg < 40 ? L('Not under 40 kg.','לא מתחת ל-40 ק״ג.') : null; },
    why: function(){ return P.pain != null && P.pain >= 5 && !P.iv ? L('Pain ' + P.pain + ' and no IV','כאב ' + P.pain + ' ואין וריד') : null; } });
  D.push({ id:'para', g:'pain', en:L('Paracetamol','אקמול'), sub:L('Acamol. Or dipyrone (Optalgin) 1000 mg.','פרצטמול. או אופטלגין 1000 מ״ג.'), eng:'פרצטמול', match:/פרצטמול|paracetamol|אקמול|אופטלגין|dipyrone/i, route:'PO',
    dose: function(){ return { v: 1000, u:'mg' }; }, rule: L('1000 mg every 6 h, max 4000 mg a day','1000 מ״ג כל 6 שעות, עד 4000 מ״ג ביום'),
    prep: L('Only if they can swallow: not with reduced consciousness, a penetrating torso wound, or a face or neck injury. Ask about allergy.','רק אם יכולים לבלוע: לא בהכרה ירודה, פצע חודר בגו, או פגיעת פנים או צוואר. לשאול על רגישות.'),
    every: 360, max24: 4000,
    stop: function(){ return P.child ? NOCHILD() : P.penTorso ? L('Penetrating torso wound: nothing by mouth.','פצע חודר בגו: לא דרך הפה.') : null; },
    why: function(){ return P.pain != null && P.pain >= 1 && P.pain <= 4 ? L('Mild pain (' + P.pain + ' of 10)','כאב קל (' + P.pain + ' מתוך 10)') : null; } });
  D.push({ id:'meto', g:'pain', en:L('Metoclopramide','פרמין'), sub:L('Pramin. For nausea only.','מטוקלופרמיד. לבחילה בלבד.'), eng:'פרמין', match:/פרמין|metoclopramide/i, route:'IV',
    dose: function(){ return { v: 10, u:'mg' }; }, rule: L('10 mg slow IV','10 מ״ג לאט לווריד'), prep: L('Not routine: only if nauseous.','לא באופן שגרתי: רק בבחילה.'),
    stop: function(){ return P.child ? NOCHILD() : null; } });

  // ── INFECTION (ch. 16) ──
  D.push({ id:'cef', g:'abx', en:L('Ceftriaxone','צפטריאקסון'), sub:L('Penetrating wound, evacuation over 1 hour','פצע חודר, פינוי מעל שעה'), eng:'צפטריאקסון', match:/צפטריאקסון|ceftriaxone/i, route:'IV',
    dose: function(){ return { v: P.child ? Math.min(2000, Math.round(100 * kg / 50) * 50) : 2000, u:'mg' }; },
    rule: P.child ? L('100 mg/kg, max 2 g, once a day','100 מ״ג/ק״ג, עד 2 גרם, פעם ביום') : L('2 g once a day','2 גרם פעם ביום'),
    prep: L('IV push over 2 to 4 min. Never with Hartmann.','דחיפה לווריד במשך 2 עד 4 דק׳. לעולם לא עם הרטמן.') + (P.child ? '' : L(' No IV: 1 g IM × 2, each in 3.5 mL water or lidocaine 1% (not in shock).',' אין וריד: 1 גרם לשריר × 2, כל אחד ב-3.5 מ״ל מים או לידוקאין 1% (לא בהלם).')),
    every: 1440,
    why: function(){ return P.pen ? L('Penetrating wound: ','פצע חודר: ') + penRegions(null) : null; } });
  D.push({ id:'met', g:'abx', en:L('Metronidazole','מטרונידזול'), sub:L('Penetrating wound to the torso, head or neck','פציעה חודרת בבית החזה, בבטן, בגב, בראש או בצוואר'), eng:'מטרונידזול', match:/מטרונידזול|metronidazole/i, route:'IV',
    dose: function(){ return { v: P.child ? Math.min(500, r0(10 * kg)) : 500, u:'mg' }; },
    rule: P.child ? L('10 mg/kg, max 500 mg, every 8 h','10 מ״ג/ק״ג, עד 500 מ״ג, כל 8 שעות') : L('500 mg every 8 h','500 מ״ג כל 8 שעות'),
    prep: L('Slow drip. Repeat every 8 hours if evacuation is delayed.','בטפטוף איטי. חזרה כל 8 שעות אם הפינוי מתעכב.'),
    every: 480,
    why: function(){ return P.penHNA ? L('Penetrating wound: ','פצע חודר: ') + penRegions(typeof _ABX_REGIONS !== 'undefined' ? _ABX_REGIONS : null) : null; } });

  // ── OTHER (ch. 4, 11, 3) ──
  D.push({ id:'mid', g:'other', en:L('Midazolam','מידזולם'), sub:L('Seizure','פרכוס'), eng:'דורמיקום', match:/דורמיקום|midazolam|מידזולם/i, route:'IV',
    dose: function(){ return { v: P.child ? r2((P.lowBP ? 0.025 : 0.05) * kg) : (P.lowBP ? 2.5 : 5), u:'mg' }; },
    rule: (P.child ? L('0.05 mg/kg','0.05 מ״ג/ק״ג') : L('5 mg IV (or 10 mg IM)','5 מ״ג לווריד (או 10 מ״ג לשריר)')) + (P.lowBP ? L(' · HALVED: low blood pressure',' · חצי: לחץ דם נמוך') : ''),
    chg: function(){ return P.lowBP ? (P.child ? L('0.025 mg/kg instead of 0.05 · ','0.025 מ״ג/ק״ג במקום 0.05 · ') : L('2.5 mg instead of 5 mg · ','2.5 מ״ג במקום 5 מ״ג · ')) + L('low blood pressure (SBP ' + P.sys + ') · engine drug list','לחץ דם נמוך (ל״ד ' + P.sys + ') · רשימת התרופות במערכת') : null; },
    prep: L('Still seizing after 5 min: one more dose. Can drop blood pressure: watch closely if bleeding.','עדיין מפרכס אחרי 5 דק׳: מנה נוספת. עלול להוריד לחץ דם: מעקב צמוד בפצוע מדמם.'),
    every: 5, maxN: 2 });
  var indK = P.child ? r0((P.deep ? 1.25 : 2.5) * kg) : r0((P.deep ? 1.75 : 3.5) * kg), indM = P.child ? Math.min(5, r1((P.deep ? 0.0375 : 0.075) * kg)) : (P.deep ? 2.5 : 5);
  D.push({ id:'ind', g:'other', en:L('Intubation induction','אינדוקציה לאינטובציה'), sub:L('Senior medic only, with two assistants','מטפל בכיר בלבד, עם שני מסייעים'), route:'IV', info:true,
    chg: function(){ return P.deep ? L('Half dose · ','חצי מנה · ') + shockW(P) + L(' · book ch. 4',' · ספר פרק 4') : null; },
    dose: function(){ return { v: indK, u:'mg', txt: L('Ketamine ' + indK + ' mg + midazolam ' + fmt(indM) + ' mg','קטמין ' + indK + ' מ״ג + מידזולם ' + fmt(indM) + ' מ״ג') }; },
    rule: (P.child ? L('Ketamine 2 to 3 mg/kg, midazolam 0.05 to 0.1 mg/kg (max 5 mg)','קטמין 2 עד 3 מ״ג/ק״ג, מידזולם 0.05 עד 0.1 מ״ג/ק״ג (עד 5 מ״ג)') : L('Ketamine 3 to 4 mg/kg, midazolam 5 mg','קטמין 3 עד 4 מ״ג/ק״ג, מידזולם 5 מ״ג')) + (P.deep ? L(' · HALVED: suspected deep shock',' · חצי: חשד להלם עמוק') : ''),
    prep: P.child ? L('Maintenance: the book gives no child dose. A doctor decides.','אחזקה: אין מינון לילדים בספר. רופא מחליט.') : L('Onset 1 to 2 min. Maintenance every 15 min: ketamine 25 to 50 mg + midazolam 1 to 1.5 mg. No paralytics in the field.','השפעה תוך 1 עד 2 דק׳. אחזקה כל 15 דק׳: קטמין 25 עד 50 מ״ג + מידזולם 1 עד 1.5 מ״ג. ללא משתקי שרירים בשטח.') });
  D.push({ id:'adr', g:'other', en:L('Adrenaline','אדרנלין'), sub:L('Severe reaction to a blood product','תגובה קשה למוצר דם'), eng:'אדרנלין', match:/אדרנלין|adrenaline|epinephrine/i, route:'IM',
    dose: function(){ return { v: 0.5, u:'mg' }; },
    rule: L('0.5 mg IM, repeat every 5 min','0.5 מ״ג לשריר, חזרה כל 5 דק׳'),
    prep: L('Stop the blood at once and keep the bag with the casualty. Switch to Hartmann 500 mL. Also give Solu-Medrol 125 mg IV.','לעצור את הדם מיד ולהשאיר את השקית עם הפצוע. מעבר להרטמן 500 מ״ל. בנוסף סולו-מדרול 125 מ״ג לווריד.'),
    every: 5, stop: function(){ return P.child ? NOCHILD() : null; } });
  D.push({ id:'sol', g:'other', en:L('Solu-Medrol','סולו-מדרול'), sub:L('Reaction to a blood product (hives alone: this only)','תגובה למוצר דם (פריחה בלבד: רק זה)'), eng:'סולו-מדרול', match:/סולו-מדרול|solu-?medrol|methylpred/i, route:'IV',
    dose: function(){ return { v: 125, u:'mg' }; }, rule: L('125 mg IV','125 מ״ג לווריד'), prep: L('Stop the transfusion first.','קודם עוצרים את העירוי.'),
    stop: function(){ return P.child ? NOCHILD() : null; } });
  D.push({ id:'crush', g:'other', en:L('Crush injury','פגיעת מעיכה'), sub:L('Trapped casualty: saline before the rescue','פצוע לכוד: סליין לפני החילוץ'), route:'IV', info:true,
    dose: function(){ return { v: 0, u:'', txt: P.child ? Math.min(1000, r0(20 * kg)) + L(' mL/h saline',' מ״ל/שעה סליין') : L('Saline 1 L per hour','סליין ליטר לשעה') }; },
    rule: P.child ? L('20 mL/kg/h; trapped over 2 h: ' + Math.min(500, r0(10 * kg)) + ' mL/h','20 מ״ל/ק״ג/שעה; לכוד מעל שעתיים: ' + Math.min(500, r0(10 * kg)) + ' מ״ל/שעה') : L('Trapped over 2 h: 0.5 L per hour','לכוד מעל שעתיים: חצי ליטר לשעה'),
    prep: L('For 6 hours. Saline, not Hartmann.','במשך 6 שעות. סליין, לא הרטמן.') + (P.child ? '' : L(' Furosemide 40 mg IV only if no urine AND lung congestion.',' פוסיד 40 מ״ג לווריד רק אם אין שתן וגם יש גודש ריאתי.')) });
  return D;
}

// Status of one drug for this casualty: given list, totals, time to next dose, blocked reason, due reason
function status(P, d){
  var g = d.info ? [] : givenOf(P, d), last = g.length ? g[g.length - 1] : null, dz = d.dose(P);
  var s = { g:g, last:last, dose:dz, wait:0, block:null, due:null };
  var ci = contra(P, d); if (ci){ s.block = ci; s.kind = 'contra'; }
  if (!s.block && d.stop){ s.block = d.stop(); if (s.block) s.kind = /^(blood|hart)$/.test(d.id) ? 'notind' : (!P.iv && /^(ket|mor)$/.test(d.id) ? 'access' : 'contra'); }
  s.chg = d.chg ? d.chg() : null;
  if (d.route === 'IV' && !P.iv && !d.info){ s.noAccess = true; if (!s.block){ s.kind = 'access'; s.wouldDue = d.why ? d.why() : null; s.block = L('Needs IV or IO first.','צריך קודם וריד או IO.') + (d.id === 'cef' && !P.child ? L(' Without access: IM, see How to give.',' בלי גישה: לשריר, ראו איך לתת.') : ''); } }
  if (!s.block && d.maxN && g.length >= d.maxN) s.kind = 'done';
  if (!s.block && d.maxN && g.length >= d.maxN) s.block = d.maxN === 1 ? L('Already given at ' + hm(last.time) + '. One dose only.','כבר ניתן ב-' + hm(last.time) + '. מנה אחת בלבד.') : L('Maximum ' + d.maxN + ' doses reached.','הגיע למקסימום ' + d.maxN + ' מנות.');
  if (d.max24){ var tot = g.filter(function(m){ return minsSince(m.time) < 1440; }).reduce(function(a, m){ return a + amountOf(m); }, 0); s.tot24 = tot; if (!s.block && tot + dz.v > d.max24) s.block = L('Would pass the 24-hour maximum (' + d.max24 + ' mg).','יעבור את המקסימום היומי (' + d.max24 + ' מ״ג).'); }
  if (last && d.every){ var left = d.every * 60 - minsSince(last.time) * 60; if (left > 0) s.wait = left; }
  if (!s.block && d.why) s.due = d.why();
  if (s.due && s.wait > 0) s.due = null;
  if (s.due && d.fluid && g.length && minsSince(last.time) < 10) s.due = null;   // a unit just went in: re-check before the next
  return s;
}

var UHE = { mg:'מ״ג', mL:'מ״ל', mcg:'מק״ג', g:'גרם', kg:'ק״ג', cc:'סמ״ק' };
function U(u){ return lang() === 'he' ? (UHE[u] || u) : u; }
function parts(dz){ return dz.u === 'mg' && dz.v >= 1000 ? { n: fmt(dz.v / 1000), u: 'g' } : { n: fmt(dz.v), u: dz.u }; }
function doseText(dz){ if (dz.txt) return dz.txt; var p = parts(dz); return p.n + ' ' + U(p.u); }
function engDose(dz){ return dz.u === 'mg' && dz.v >= 1000 ? fmt(dz.v / 1000) + 'g' : fmt(dz.v) + dz.u; }
// number + unit as one unit of reading; the flex order follows the page direction, so Hebrew reads "25 מ״ג" naturally
function qty(n, u, cls){ return '<span class="dz-q' + (cls ? ' ' + cls : '') + '"><span class="dz-qn">' + esc(n) + '</span><span class="dz-qu">' + esc(U(u)) + '</span></span>'; }
function mL(v){ return qty(fmt(v), 'mL'); }
function routeWord(r){ return r === 'OTFC' ? L('Cheek','לחי') : r === 'PO' ? L('By mouth','דרך הפה') : r === 'IM' ? L('IM · muscle','IM · לשריר') : r; }

/* PREPARATION — how to make up each drug, from the IDF Trauma and Operational Medicine Book (Jan 2026) only.
   Volumes in cc (what medics say). A dilution is shown only where the book gives one; otherwise "give as supplied".
   kind: 'dil'  = drug + diluent mixed in one syringe   'vial' = powder vial made up with a set volume
         'none' = no dilution in the book                'bag'  = ready-made bottle or bag, no syringe      'na' = no syringe */
var DILUENT = { saline:['saline 0.9%','סליין 0.9%'], water:['water for injection','מים להזרקה'], fluid:['IV fluid','נוזלים'] };
function dilWord(k){ var w = DILUENT[k]; return w ? L(w[0], w[1]) : ''; }
function pct(c){ return fmt(c / 10) + '%'; }   // mg per cc → % weight/volume (1% = 10 mg/cc)
function cc(v){ return qty(fmt(v), 'cc'); }
function ccT(v){ return fmt(v) + ' ' + U('cc'); }
function prepOf(P, d){
  var dz = d.dose(P);
  switch (d.id){
    case 'mor': return { kind:'dil', drugCc:1, drugMg:10, dil:'fluid', dilCc:9, total:10, conc:1,
      amp: L('Ampoule 10 mg / 1 cc','אמפולה 10 מ״ג / 1 סמ״ק'), ref: L('Book ch. 15, morphine','ספר, פרק 15, מורפין') };
    case 'mid': return { kind:'dil', drugCc:1, drugMg:5, dil:'saline', dilCc:9, total:10, conc:0.5,
      amp: L('Ampoule 5 mg / 1 cc','אמפולה 5 מ״ג / 1 סמ״ק'), ref: L('Book ch. 17, prepared midazolam syringe','ספר, פרק 17, מזרק מידזולם מוכן') };
    case 'meto': return { kind:'dil', drugCc:null, drugMg:10, dil:'fluid', dilCc:null, total:10, conc:1, over: L('over 5 min','במשך 5 דק׳'),
      amp: L('10 mg ampoule','אמפולה 10 מ״ג'), ref: L('Book ch. 15, nausea after morphine: dilute to 10 cc','ספר, פרק 15, בחילה אחרי מורפין: מהילה ל-10 סמ״ק') };
    case 'cef': return { kind:'vial', perVial:1000, dil:'water', dilCc:10, conc:100, vials: Math.max(1, Math.ceil(dz.v / 1000)), over: L('over 2 to 4 min','במשך 2 עד 4 דק׳'),
      amp: L('1 g vial (powder)','בקבוקון 1 גרם (אבקה)'), ref: L('Book ch. 16, ceftriaxone','ספר, פרק 16, צפטריאקסון'),
      alt: P.child ? null : L('No IV: 1 g IM × 2, each in 3.5 cc water for injection or lidocaine 1%. Not in shock.','אין וריד: 1 גרם לשריר × 2, כל אחד ב-3.5 סמ״ק מים להזרקה או לידוקאין 1%. לא בהלם.') };
    case 'ket': return { kind:'none', conc:50, amp: L('Ampoule 500 mg / 10 cc (50 mg/cc)','אמפולה 500 מ״ג / 10 סמ״ק (50 מ״ג/סמ״ק)'),
      ref: L('Book ch. 15: ketamine is not diluted. Flush with saline.','ספר, פרק 15: קטמין לא נמהל. שטיפה בסליין.'),
      tiny: P.child ? (function(){ var a = r1(0.5 * P.wt), b = r1(1 * P.wt); return L('Too small to measure as supplied · consult a physician · or IM 0.5–1 mg/kg (MDA): ' + fmt(a) + '–' + fmt(b) + ' mg = ' + fmt(r2(a / 50)) + '–' + fmt(r2(b / 50)) + ' cc at 50 mg/cc', 'קטן מדי למדידה כפי שמגיע · להתייעץ עם רופא · או לשריר 0.5–1 מ״ג/ק״ג (מד״א): ' + fmt(a) + '–' + fmt(b) + ' מ״ג = ' + fmt(r2(a / 50)) + '–' + fmt(r2(b / 50)) + ' סמ״ק בריכוז 50 מ״ג/סמ״ק'); })() : null,
      mda: P.child ? L('Not the IDF book. IV 0.2 mg/kg with other drugs, 0.3–0.5 mg/kg for pain · IM 0.5–1 mg/kg · may repeat once after 10 min · not if systolic over 180. No dilution given.','לא ספר צה״ל. לווריד 0.2 מ״ג/ק״ג בשילוב, 0.3–0.5 מ״ג/ק״ג לכאב · לשריר 0.5–1 מ״ג/ק״ג · אפשר לחזור פעם אחת אחרי 10 דק׳ · לא בסיסטולי מעל 180. ללא מהילה.') : null };
    case 'ind': return { kind:'none', conc:50, amp: L('Ketamine ampoule 500 mg / 10 cc (50 mg/cc)','אמפולת קטמין 500 מ״ג / 10 סמ״ק (50 מ״ג/סמ״ק)'),
      ref: L('Book ch. 4, induction','ספר, פרק 4, אינדוקציה'),
      extra: [ { name: L('Ketamine maintenance syringe','מזרק אחזקה קטמין'), dname: L('ketamine 50 mg/cc','קטמין 50 מ״ג/סמ״ק'), drugCc:5, drugMg:250, dil:'saline', dilCc:5, total:10, conc:25 },
               { name: L('Midazolam maintenance syringe','מזרק אחזקה מידזולם'), dname: L('midazolam 5 mg/cc','מידזולם 5 מ״ג/סמ״ק'), drugCc:1, drugMg:5, dil:'saline', dilCc:9, total:10, conc:0.5 } ],
      extraRef: L('Book ch. 17, prepared sedation syringes','ספר, פרק 17, מזרקי הרדמה מוכנים') };
    case 'txa': return { kind:'none', conc:100, amp: L('Hexakapron ampoule 500 mg / 5 cc = 100 mg/cc · confirm the label','אמפולת הקסקפרון 500 מ״ג / 5 סמ״ק = 100 מ״ג/סמ״ק · לאשר מול התווית'),
      ref: L('Book ch. 3: never with blood in the same line: flush 10 cc saline between.','ספר, פרק 3: לא עם דם באותו קו: שטיפה 10 סמ״ק סליין ביניהם.') };
    case 'adr': return { kind:'none', conc:1, amp: L('Adrenaline ampoule 1 mg / 1 cc (1:1000) · IM only, never IV undiluted · confirm the label','אמפולת אדרנלין 1 מ״ג / 1 סמ״ק (1:1000) · לשריר בלבד, לעולם לא לווריד לא מהול · לאשר מול התווית'), ref: L('Book ch. 3, transfusion reaction','ספר, פרק 3, תגובה לעירוי') };
    case 'met': return dz.v >= 500 ? { kind:'bag', vol:100, ref: L('Book ch. 16: comes ready in a bottle','ספר, פרק 16: מגיע מוכן בבקבוקון') }
      : { kind:'none', conc:5, amp: L('Ready bottle 500 mg / 100 cc (5 mg/cc)','בקבוקון מוכן 500 מ״ג / 100 סמ״ק (5 מ״ג/סמ״ק)'), ref: L('Book ch. 16: comes ready in a bottle','ספר, פרק 16: מגיע מוכן בבקבוקון'), from: L('from the bottle','מהבקבוקון') };
    case 'sol': return { kind:'none', conc:null, amp: L('Make up as the vial label says','להכין לפי תווית הבקבוקון'), ref: L('Book ch. 3, transfusion reaction','ספר, פרק 3, תגובה לעירוי') };
    default: return { kind:'na' };
  }
}

var SIZES = [1, 3, 5, 10, 20];
function sizeFor(v){ return SIZES.concat([50]).filter(function(z){ return z >= v - 1e-9; })[0] || 0; }
// Volume rounded to the syringe's marks: 0.01 cc in a 1 cc syringe, 0.1 cc up to 5 cc, 0.5 cc above
function volR(v){ var z = sizeFor(v); return z === 1 ? r2(v) : z && z <= 5 ? r1(v) : Math.round(v * 2) / 2; }
var SYRN = 0;
// One syringe of a chosen size. layers: [{cc, k:'drug'|'dil'|'mix'}] from the tip outward. mark: {cc, label} pointer on the scale.
function drawSyr(size, layers, mark){
  var id = 'dzp' + (++SYRN), x0 = 40, x1 = 270, w = x1 - x0, at = function(v){ return x0 + w * Math.min(1, v / size); };
  var fill = { drug:'#6fd3ff', mix:'url(#' + id + 'm)', dil:'url(#' + id + 'd)' }, total = 0, rects = '';
  layers.forEach(function(l){ var a = at(total), b = at(total + l.cc); rects += '<rect x="' + a.toFixed(1) + '" y="31.5" width="' + Math.max(0, b - a).toFixed(1) + '" height="37" fill="' + fill[l.k] + '"/>'; total += l.cc; });
  var fx = at(total), ticks = '';
  var step = size <= 1 ? 0.1 : size <= 3 ? 0.5 : size <= 10 ? 1 : 2, lab = size <= 1 ? 0.5 : size <= 5 ? 1 : size <= 10 ? 2 : 5;
  for (var k = 0; k * step <= size + 1e-9; k++){
    var t = r2(k * step), tx = at(t), major = Math.abs(t / lab - Math.round(t / lab)) < 1e-6;
    ticks += '<line x1="' + tx.toFixed(1) + '" y1="34" x2="' + tx.toFixed(1) + '" y2="' + (major ? 52 : 44) + '" stroke="#0b0c0e" stroke-opacity=".8" stroke-width="' + (major ? 2.2 : 1.2) + '"/>'
      + (major ? '<text x="' + tx.toFixed(1) + '" y="94" font-size="17" font-weight="800" fill="#cfd3da" text-anchor="middle">' + t + '</text>' : '');
  }
  var mx = mark ? at(mark.cc) : fx, px = Math.max(x0 + 34, Math.min(x1 - 8, mx));
  return '<svg viewBox="0 0 340 100" width="100%" aria-hidden="true"><defs>'
    + '<pattern id="' + id + 'd" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#dfe6ee"/><rect width="3" height="8" fill="#8fa3b8"/></pattern>'
    + '<pattern id="' + id + 'm" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#6fd3ff"/><circle cx="4" cy="4" r="1.6" fill="#0b4a63"/></pattern></defs>'
    + '<rect x="2" y="48" width="20" height="3" rx="1.5" fill="#cfd3da"/><path d="M22 41h18v17H22z" fill="#9aa0a8"/>'
    + '<rect x="' + x0 + '" y="30" width="' + w + '" height="40" rx="7" fill="#20242c" stroke="#e8eaee" stroke-width="2.5"/>'
    + '<g clip-path="inset(0 round 6px)">' + rects + '</g>' + ticks
    + '<rect x="' + (x1 - 2) + '" y="22" width="8" height="56" rx="3" fill="#e8eaee"/>'
    + '<rect x="' + (fx - 3).toFixed(1) + '" y="30" width="10" height="40" rx="2" fill="#0b0c0e" stroke="#fff" stroke-width="2"/>'
    + '<rect x="' + (fx + 7).toFixed(1) + '" y="46" width="' + Math.max(0, 322 - fx - 7).toFixed(1) + '" height="8" rx="2" fill="#9aa0a8"/>'
    + '<rect x="322" y="28" width="12" height="44" rx="4" fill="#cfd3da"/>'
    + (mark ? '<path d="M' + mx.toFixed(1) + ' 28l-7 -9h14z" fill="#fff"/><text x="' + px.toFixed(1) + '" y="14" font-size="17" font-weight="900" fill="#fff" text-anchor="middle" direction="ltr" unicode-bidi="embed">' + esc(mark.label) + '</text>' : '')
    + '</svg>';
}
function swatch(k){ return '<i class="dz-sw ' + k + '" aria-hidden="true"></i>'; }
// A syringe figure for a volume, honouring the chosen size: too big → say so and offer the right size
function syrFig(vol, layers, mark, legend, caption){
  var size = S.syr, best = sizeFor(vol), h = '<figure class="dz-syr" dir="ltr" role="img" aria-label="' + esc(caption) + '">';
  if (vol > size + 1e-9){
    return '<div class="dz-fit no">' + ico('triangle-alert', 24) + '<span><b>' + L('Too big for ' + size + ' cc', 'גדול מדי למזרק ' + size + ' סמ״ק') + '</b>' + (best ? L('Needs ' + ccT(vol) + ': use ' + best + ' cc, or ' + Math.ceil(vol / size) + ' × ' + size + ' cc', 'צריך ' + ccT(vol) + ': מזרק ' + best + ' סמ״ק, או ' + Math.ceil(vol / size) + ' × ' + size + ' סמ״ק') : L('Needs ' + ccT(vol) + ': use several syringes', 'צריך ' + ccT(vol) + ': כמה מזרקים')) + '</span>'
      + (best && SIZES.indexOf(best) >= 0 ? '<button class="xbtn xbtn-primary" onclick="Field.doseSyr(' + best + ')">' + ico('syringe', 24) + '<span>' + L('Use ' + best + ' cc','מזרק ' + best) + '</span></button>' : '') + '</div>';
  }
  h += drawSyr(size, layers, mark);
  if (legend) h += '<figcaption class="dz-leg" dir="' + (lang() === 'he' ? 'rtl' : 'ltr') + '">' + legend + '</figcaption>';
  h += '</figure>';
  if (best && best < size && vol < size / 5) h += '<div class="dz-fit">' + ico('info', 24) + '<span><b>' + L('Hard to read on ' + size + ' cc', 'קשה לקריאה במזרק ' + size + ' סמ״ק') + '</b>' + L(best + ' cc reads more exactly', 'מזרק ' + best + ' סמ״ק מדויק יותר') + '</span><button class="xbtn" onclick="Field.doseSyr(' + best + ')">' + ico('syringe', 24) + '<span>' + L('Use ' + best + ' cc','מזרק ' + best) + '</span></button></div>';
  return h;
}
function sizePicker(){
  return '<div class="dz-size"><span class="dz-lbl">' + ico('syringe', 22) + L('Syringe size (cc)','גודל מזרק (סמ״ק)') + '</span><div class="dz-size-g" role="radiogroup" dir="ltr">'
    + SIZES.map(function(z){ return '<button role="radio" aria-checked="' + (S.syr === z) + '" class="' + (S.syr === z ? 'on' : '') + '" aria-label="' + L(z + ' cc syringe', 'מזרק ' + z + ' סמ״ק') + '" onclick="Field.doseSyr(' + z + ')">' + ico('syringe', 20) + '<span>' + z + '</span></button>'; }).join('') + '</div></div>';
}
function steps(list){ return '<ol class="dz-steps">' + list.map(function(t, i){ return '<li><b>' + (i + 1) + '</b><span>' + t + '</span></li>'; }).join('') + '</ol>'; }
function mixLine(m, name){ return (m.drugCc != null ? ccT(m.drugCc) + ' ' + name : name) + ' + ' + (m.dilCc != null ? ccT(m.dilCc) + ' ' : '') + dilWord(m.dil) + ' = ' + fmt(m.conc) + L(' mg/cc',' מ״ג/סמ״ק') + ' (' + pct(m.conc) + ')'; }
// The whole "how to prepare" block for a card (and a short version for the read-back)
function prepHtml(P, d, dz, short){
  var pr = prepOf(P, d); if (pr.kind === 'na' || dz.u !== 'mg' && pr.kind !== 'bag') return '';
  var name = d.en, vol = pr.conc ? volR(dz.v / pr.conc) : null, h = '<section class="dz-prep">';
  h += '<h4>' + ico('layers', 22) + '<span>' + L('Prepare','הכנה') + '</span></h4>';
  if (pr.kind === 'bag') return h + '<p class="dz-bag">' + ico('droplet', 26) + '<span><b>' + L('Ready-made bottle','בקבוקון מוכן') + ' · ' + cc(pr.vol) + '</b>' + L('Run as a slow drip. No syringe, no dilution.','בטפטוף איטי. בלי מזרק ובלי מהילה.') + '</span></p><p class="dz-ref">' + pr.ref + '</p></section>';
  if (!short) h += sizePicker();
  if (pr.kind === 'dil'){
    var drugStep = pr.drugCc != null ? L('Draw ' + ccT(pr.drugCc) + ' ' + name, 'לשאוב ' + ccT(pr.drugCc) + ' ' + name) + ' <small>(' + pr.amp + ')</small>' : L('Draw the ' + pr.amp.replace(/^10 mg /, '10 mg '), 'לשאוב את ה' + pr.amp);
    var addStep = pr.dilCc != null ? L('Add ' + ccT(pr.dilCc) + ' ' + dilWord(pr.dil), 'להוסיף ' + ccT(pr.dilCc) + ' ' + dilWord(pr.dil)) : L('Add ' + dilWord(pr.dil) + ' up to ' + ccT(pr.total), 'להוסיף ' + dilWord(pr.dil) + ' עד ' + ccT(pr.total));
    var mixStep = L('Mix: ', 'לערבב: ') + ccT(pr.total) + ' · ' + fmt(pr.conc) + L(' mg/cc',' מ״ג/סמ״ק') + ' (' + pct(pr.conc) + ')';
    var pushStep = (vol >= pr.total - 1e-9 ? L('Push all ' + ccT(pr.total), 'לדחוף את כל ' + ccT(pr.total)) : L('Push ' + ccT(vol) + ' of the mix', 'לדחוף ' + ccT(vol) + ' מהתערובת')) + (pr.over ? ' ' + pr.over : '');
    h += steps([drugStep, addStep, mixStep, pushStep]);
    if (!short){
      var dc = pr.drugCc != null ? pr.drugCc : 1, layers = [{ cc: dc, k:'drug' }, { cc: pr.total - dc, k:'dil' }];
      var legend = '<span>' + swatch('drug') + name + ' ' + (pr.drugCc != null ? ccT(pr.drugCc) : '') + '</span><span>' + swatch('dil') + dilWord(pr.dil) + ' ' + (pr.dilCc != null ? ccT(pr.dilCc) : L('to ' + ccT(pr.total), 'עד ' + ccT(pr.total))) + '</span><span class="dz-leg-t">' + L('Total ','סה״כ ') + ccT(pr.total) + '</span>';
      h += '<p class="dz-fig-t">' + L('1 · Make the mix','1 · הכנת התערובת') + '</p>' + syrFig(pr.total, layers, { cc: pr.total, label: ccT(pr.total) }, legend, L(name + ' ' + (pr.drugCc || '') + ' cc plus ' + dilWord(pr.dil), name + ' ועוד ' + dilWord(pr.dil)));
      h += '<p class="dz-fig-t">' + L('2 · Push','2 · מתן') + '</p>' + syrFig(vol, [{ cc: vol, k:'mix' }], { cc: vol, label: L('Push ','') + ccT(vol) }, '<span>' + swatch('mix') + L('Mix ','תערובת ') + fmt(pr.conc) + L(' mg/cc',' מ״ג/סמ״ק') + '</span><span class="dz-leg-t">' + L('Push ','לדחוף ') + ccT(vol) + '</span>', L('Push ' + vol + ' cc of the mix', 'לדחוף ' + vol + ' סמ״ק מהתערובת'));
    }
  } else if (pr.kind === 'vial'){
    h += steps([L('Add ' + ccT(pr.dilCc) + ' ' + dilWord(pr.dil) + ' to each ' + pr.amp, 'להוסיף ' + ccT(pr.dilCc) + ' ' + dilWord(pr.dil) + ' לכל ' + pr.amp) + (pr.vials > 1 ? ' · ' + L(pr.vials + ' vials', pr.vials + ' בקבוקונים') : ''),
      L('Mix until clear: ','לערבב עד שקוף: ') + fmt(pr.conc) + L(' mg/cc',' מ״ג/סמ״ק') + ' (' + pct(pr.conc) + ')',
      L('Draw ' + ccT(vol), 'לשאוב ' + ccT(vol)),
      L('Push ' + ccT(vol) + ' ', 'לדחוף ' + ccT(vol) + ' ') + pr.over]);
    if (!short) h += syrFig(vol, [{ cc: vol, k:'mix' }], { cc: vol, label: ccT(vol) }, '<span>' + swatch('mix') + L('Made-up vial ','בקבוקון מוכן ') + fmt(pr.conc) + L(' mg/cc',' מ״ג/סמ״ק') + '</span>', L('Draw ' + vol + ' cc', 'לשאוב ' + vol + ' סמ״ק'));
    if (pr.alt) h += '<p class="dz-conc">' + ico('info', 22) + '<span>' + pr.alt + '</span></p>';
  } else {
    h += '<p class="dz-nodil">' + ico('circle-help', 22) + '<span><b>' + L('No dilution in the book · give as supplied','אין מהילה בספר · לתת כפי שמגיע') + '</b>' + pr.amp + '</span></p>';
    if (vol){
      h += steps([L('Draw ' + ccT(vol) + ' ', 'לשאוב ' + ccT(vol) + ' ') + (pr.from || L('as supplied','כפי שמגיע')), L('Push, then flush with saline','לדחוף ואז לשטוף בסליין')]);
      if (!short) h += syrFig(vol, [{ cc: vol, k:'drug' }], { cc: vol, label: ccT(vol) }, '<span>' + swatch('drug') + name + ' ' + fmt(pr.conc) + L(' mg/cc',' מ״ג/סמ״ק') + '</span>', L('Draw ' + vol + ' cc', 'לשאוב ' + vol + ' סמ״ק'));
      if (pr.tiny && vol < 0.1) h += '<p class="dz-tiny">' + ico('triangle-alert', 22) + '<span>' + pr.tiny + '</span></p>';
      if (pr.mda) h += '<p class="dz-mda">' + ico('file-text', 22) + '<span><b>' + L('MDA ALS 2024','מד״א ALS 2024') + '</b>' + pr.mda + '</span></p>';
    }
    if (pr.extra && !short){
      h += '<p class="dz-fig-t">' + pr.extraRef + '</p>' + pr.extra.map(function(m){ return '<p class="dz-mixl">' + swatch('mix') + '<span><b>' + m.name + '</b>' + mixLine(m, m.dname) + '</span></p>'; }).join('');
    }
  }
  return h + '<p class="dz-ref">' + ico('file-text', 22) + '<span>' + pr.ref + '</span></p></section>';
}
// unit check hook for tests: concentration = drug mg ÷ total cc for every book dilution
Field.dosePrepCheck = function(){
  var P = patient(), out = [];
  drugs(P).forEach(function(d){ var pr = prepOf(P, d); [pr].concat(pr.extra || []).forEach(function(m){
    if (m.kind === 'dil' || m.drugMg && m.total) out.push({ id: d.id, conc: m.conc, calc: r2(m.drugMg / m.total), ok: Math.abs(m.drugMg / m.total - m.conc) < 1e-9 && (m.drugCc == null || m.dilCc == null || Math.abs(m.drugCc + m.dilCc - m.total) < 1e-9) });
    if (m.kind === 'vial') out.push({ id: d.id, conc: m.conc, calc: r2(m.perVial / m.dilCc), ok: Math.abs(m.perVial / m.dilCc - m.conc) < 1e-9 });
  }); });
  return out;
};

var S = { tab:'now', rb:null, edit:null, sf:null, syr:10 };
try { var z0 = Number(sessionStorage.getItem('dz-syr')); if (SIZES.indexOf(z0) >= 0) S.syr = z0; } catch (e){}
function accessBtns(){ return '<div class="dz-acc-b"><button class="xbtn xbtn-primary" onclick="Field.doseAccess(\'IV\')">' + ico('syringe', 24) + '<span>' + L('Record IV','תיעוד וריד') + '</span></button><button class="xbtn" onclick="Field.doseAccess(\'IO\')">' + ico('bone', 24) + '<span>' + L('Record IO','תיעוד IO') + '</span></button></div>'; }
try { S.tab = sessionStorage.getItem('dz-tab') || 'now'; } catch (e){}

// One state band per card: what to do and why, in words (colour only repeats it)
function band(P, d, s){
  if (s.noAccess && !d.stop2) { if (s.block && /IV or IO|וריד או IO/.test(s.block)) return '<div class="dz-band no">' + ico('octagon', 24) + '<div><strong>' + L('Needs IV or IO first','צריך קודם וריד או IO') + '</strong><span>' + (s.wouldDue ? L('Would be due: ','היה מגיע: ') + s.wouldDue : L('No IV or IO access recorded','לא נרשמה גישה ורידית או גרמית')) + '</span></div></div>'; }
  if (s.block) return '<div class="dz-band no">' + ico('octagon', 24) + '<div><strong>' + L('Not now','לא עכשיו') + '</strong><span>' + s.block + '</span></div></div>';
  if (s.wait > 0) return '<div class="dz-band wait" data-due="' + Math.round(Date.now() + s.wait * 1000) + '">' + ico('timer', 24) + '<div><strong>' + L('Next dose in ','מנה הבאה בעוד ') + '<b dir="ltr">' + mmss(s.wait) + '</b></strong><span>' + L('Last given at ','ניתן לאחרונה ב-') + hm(s.last.time) + '</span></div></div>';
  if (s.due) return '<div class="dz-band due">' + ico('check', 24) + '<div><strong>' + L('Give now','לתת עכשיו') + '</strong><span>' + s.due + '</span></div></div>';
  if (d.fluid && s.last && minsSince(s.last.time) < 10) return '<div class="dz-band wait">' + ico('heart-pulse', 24) + '<div><strong>' + L('Re-check first','בדיקה חוזרת קודם') + '</strong><span>' + L('A unit went in at ','מנה ניתנה ב-') + hm(s.last.time) + L(': blood pressure before the next.',': לחץ דם לפני הבאה.') + '</span></div></div>';
  if (d.info) return '<div class="dz-band ref">' + ico('file-text', 24) + '<div><strong>' + L('Reference','לעיון') + '</strong><span>' + L('Record each drug in the form','כל תרופה נרשמת בטופס') + '</span></div></div>';
  return '<div class="dz-band ok">' + ico('circle', 24) + '<div><strong>' + L('If needed','לפי הצורך') + '</strong><span>' + d.sub + '</span></div></div>';
}

/* SAFETY SHEET per drug: who must not get it, when not to give it, caution, side effects (with what to do).
   From the IDF Trauma and Operational Medicine Book (Jan 2026) where this project encodes it (dose table above and the
   engine drug list), otherwise well-established pharmacology. No new doses. Each item: [en, he, appliesNow].
   Side effects: [en, he, what-to-do en, what-to-do he], most important first. */
function recentOther(P, re, mins){ return P.meds.some(function(m){ return re.test(String(m.drug || '')) && minsSince(m.time) < mins; }); }
function safety(P, d, s){
  var kg = P.wt, opioidRecent = recentOther(P, /מורפין|פנטניל|morphine|fentanyl/i, 30), benzoRecent = recentOther(P, /דורמיקום|midazolam|מידזולם/i, 30);
  var waitItem = s.wait > 0 ? [[L('Repeat timer still running: next dose in ' + mmss(s.wait), 'טיימר חזרה עדיין רץ: מנה הבאה בעוד ' + mmss(s.wait)), true]] : [];
  var ALLERGY = function(n){ return [L('Known allergy to ' + n, 'רגישות ידועה ל' + n), false]; };
  var NOKID = [L('Child: the book gives no child dose', 'ילד: אין מינון לילדים בספר'), P.child];
  var BREATH = [L('Slow or stopped breathing', 'נשימה איטית או דום נשימה'), 'he', L('Bag-mask ventilation. Naloxone (Narcan) if available.', 'הנשמה במפוח (BVM). נרקאן (נלוקסון) אם זמין.')];
  var map = {
    txa: { no:[ALLERGY('TXA')],
      when:[[L('More than 3 hours since injury', 'עברו יותר מ-3 שעות מהפציעה'), !!(P.inj && P.inj.left <= 0)],
            [L('In the same line while blood is running: flush 10 mL saline between', 'באותו קו בזמן שדם בעירוי: שטיפה 10 מ״ל סליין ביניהם'), P.fluids.some(function(f){ return /דם|blood|FDP|פלסמה/i.test(f.type || '') && minsSince(f.time) < 15; })],
            [L('Already given: a second dose only on a doctor\'s order', 'כבר ניתן: מנה שנייה רק בהוראת רופא'), s.g.length > 0]],
      caution:[[L('Give slowly: a fast push can drop blood pressure', 'לאט: דחיפה מהירה עלולה להוריד לחץ דם'), false]],
      side:[['Low blood pressure', '', L('Slow the injection, re-check BP.', 'להאט את ההזרקה, למדוד לחץ דם.')],
            ['Nausea, vomiting', '', L('Turn on the side, protect the airway.', 'להשכיב על הצד, לשמור על נתיב אוויר.')],
            ['Seizure (rare)', '', L('Midazolam per protocol.', 'מידזולם לפי הפרוטוקול.')]] },
    blood: { no:[[L('No suspected deep shock: blood is not given routinely', 'ללא חשד להלם עמוק: לא נותנים דם באופן שגרתי'), !P.deep]],
      when:[[L('A unit went in less than 10 min ago: re-check BP first', 'מנה ניתנה לפני פחות מ-10 דק׳: קודם מדידת לחץ דם'), !!(s.last && minsSince(s.last.time) < 10)],
            [L('Same line as TXA at the same time', 'באותו קו עם TXA בו-זמנית'), false]],
      caution:[[L('Re-check blood pressure after each unit. Target systolic 90.', 'מדידת לחץ דם אחרי כל מנה. יעד סיסטולי 90.'), false],
               [L('Child: give with a syringe and a 3-way tap', 'ילד: מתן במזרק וברז תלת-כיווני'), P.child]],
      side:[['Transfusion reaction: fever, wheeze, low BP', '', L('Stop the blood, keep the bag. Hartmann 500 mL. Adrenaline 0.5 mg IM + Solu-Medrol 125 mg IV.', 'לעצור את הדם ולשמור את השקית. הרטמן 500 מ״ל. אדרנלין 0.5 מ״ג לשריר + סולו-מדרול 125 מ״ג לווריד.')],
            ['Hives only', '', L('Solu-Medrol 125 mg IV.', 'סולו-מדרול 125 מ״ג לווריד.')],
            ['Cold casualty', '', L('Keep warm: blanket, warm fluids if possible.', 'לחמם: שמיכה, נוזלים מחוממים אם אפשר.')]] },
    hart: { no:[[L('Not as a "keep vein open" drip', 'לא כעירוי "לשמירת וריד"'), false]],
      when:[[L('No suspected deep shock recorded', 'לא נרשם חשד להלם עמוק'), !P.deep],
            [L('Blood is less than 15 min away: give blood instead', 'דם במרחק פחות מ-15 דק׳: לתת דם'), false],
            [L('Same line as ceftriaxone: they form a deposit', 'באותו קו עם צפטריאקסון: נוצר משקע'), false]],
      caution:[[L('Re-check after each bolus', 'בדיקה חוזרת אחרי כל בולוס'), false]],
      side:[['Too much fluid: thinner blood, more bleeding', '', L('One bolus, then re-check.', 'בולוס אחד ואז בדיקה חוזרת.')],
            ['Cold casualty', '', L('Keep warm.', 'לחמם.')]] },
    ket: { no:[ALLERGY(L('ketamine','קטמין')), [L('Systolic over 180 (MDA ALS 2024)', 'סיסטולי מעל 180 (מד״א ALS 2024)'), false]],
      when:[[L('No IV access: use a fentanyl lozenge', 'אין גישה ורידית: סוכריית פנטניל'), !P.iv]].concat(waitItem),
      caution:[[L('Watch breathing and consciousness', 'מעקב נשימה והכרה'), false],
               [L('Suspected deep shock: give with care', 'חשד להלם עמוק: בזהירות'), P.deep],
               [L('Child: dilute to 5 mg/mL first', 'ילד: למהול ל-5 מ״ג/מ״ל קודם'), P.child]],
      side:[['Agitation, hallucinations on waking', '', L('Calm voice, reassure. Midazolam per protocol if severe.', 'קול רגוע והרגעה. מידזולם לפי הפרוטוקול אם קשה.')],
            ['More saliva', '', L('Suction. Atropine 0.5 mg IV if needed.', 'שאיבה. אטרופין 0.5 מ״ג לווריד אם נדרש.')],
            ['Higher heart rate and BP', '', L('Expected. Monitor.', 'צפוי. מעקב.')],
            ['Flickering eyes', '', L('Expected, harmless.', 'צפוי, לא מזיק.')]] },
    mor: { no:[ALLERGY(L('morphine','מורפין')), [L('Slow breathing or reduced consciousness', 'נשימה איטית או הכרה ירודה'), false]],
      when:[[L('No IV access recorded', 'לא נרשמה גישה ורידית'), !P.iv],
            [L('Midazolam in the last 30 min: breathing risk', 'מידזולם ב-30 הדק׳ האחרונות: סכנה לנשימה'), benzoRecent],
            [L('Less than 5 min after ketamine', 'פחות מ-5 דק׳ אחרי קטמין'), recentOther(P, /קטמין|ketamine/i, 5)]].concat(waitItem),
      caution:[[(P.child ? L('Low blood pressure for age: reduced dose', 'לחץ דם נמוך לגיל: מינון מופחת') : L('Shock: reduced dose', 'הלם: מינון מופחת')), P.profound],
               [L('Ketamine first; morphine only if no relief after 5 min', 'קודם קטמין; מורפין רק אם אין הקלה אחרי 5 דק׳'), false]],
      side:[BREATH,
            ['Low blood pressure', '', L('Re-check BP. No more doses.', 'מדידת לחץ דם. לא מנות נוספות.')],
            ['Nausea, vomiting', '', P.child ? L('Turn on the side.', 'להשכיב על הצד.') : L('Metoclopramide 10 mg slow IV.', 'פרמין 10 מ״ג לאט לווריד.')],
            ['Itching', '', L('Harmless.', 'לא מזיק.')]] },
    fen: { no:[[L('Under 40 kg', 'מתחת ל-40 ק״ג'), kg < 40], [L('Reduced consciousness or cannot swallow', 'הכרה ירודה או קושי בבליעה'), false]],
      when:[[L('Suspected deep shock', 'חשד להלם עמוק'), P.deep],
            [L('Midazolam in the last 30 min: breathing risk', 'מידזולם ב-30 הדק׳ האחרונות: סכנה לנשימה'), benzoRecent],
            [L('Two lozenges already: IV only from now', 'כבר ניתנו שתי סוכריות: מעכשיו רק לווריד'), s.g.length >= 2]].concat(waitItem),
      caution:[[L('Drowsy: take the lozenge out of the mouth', 'ישנוני: להוציא את הסוכרייה מהפה'), false], [L('Do not chew', 'לא ללעוס'), false]],
      side:[[BREATH[0], '', L('Take the lozenge out. Bag-mask. Naloxone (Narcan) if available.', 'להוציא את הסוכרייה. הנשמה במפוח. נרקאן אם זמין.')],
            ['Drowsiness', '', L('Take the lozenge out.', 'להוציא את הסוכרייה.')],
            ['Nausea, vomiting', '', L('Turn on the side.', 'להשכיב על הצד.')]] },
    para: { no:[NOKID, ALLERGY(L('paracetamol or dipyrone','אקמול או אופטלגין'))],
      when:[[L('Penetrating torso wound: nothing by mouth', 'פצע חודר בגו: לא דרך הפה'), P.penTorso],
            [L('Reduced consciousness, or a face or neck injury', 'הכרה ירודה, או פגיעת פנים או צוואר'), false],
            [L('Would pass 4000 mg in 24 hours', 'יעבור 4000 מ״ג ב-24 שעות'), !!(s.tot24 && s.tot24 + 1000 > 4000)]].concat(waitItem),
      caution:[[L('Dipyrone (Optalgin): not IV in shock, lowers BP', 'אופטלגין: לא לווריד בהלם, מוריד לחץ דם'), P.shock]],
      side:[['Allergic rash', '', L('Stop. Do not repeat.', 'להפסיק. לא לחזור.')],
            ['Liver damage in overdose', '', L('Keep under 4000 mg a day.', 'לא יותר מ-4000 מ״ג ביום.')]] },
    meto: { no:[NOKID],
      when:[[L('No nausea: not given routinely', 'אין בחילה: לא ניתן באופן שגרתי'), false]],
      caution:[[L('Slow IV', 'לאט לווריד'), false]],
      side:[['Restlessness, spasm of face or neck muscles', '', L('Stop. Tell the doctor.', 'להפסיק. לדווח לרופא.')],
            ['Drowsiness', '', L('Monitor.', 'מעקב.')]] },
    cef: { no:[ALLERGY(L('ceftriaxone or cephalosporins','צפטריאקסון או צפלוספורינים')), [L('Severe penicillin allergy: ask a doctor', 'רגישות קשה לפניצילין: להתייעץ עם רופא'), false]],
      when:[[L('Same line as Hartmann (Ringer): forms a deposit', 'באותו קו עם הרטמן (רינגר): נוצר משקע'), P.fluids.some(function(f){ return /הרטמן|hartmann|ringer/i.test(f.type || ''); })],
            [L('IM in shock: poor absorption, use IV', 'לשריר בהלם: ספיגה ירודה, לווריד'), P.shock]].concat(waitItem),
      caution:[[L('IV push over 2 to 4 min', 'דחיפה לווריד במשך 2 עד 4 דק׳'), false], [L('IM with lidocaine 1%: not in shock', 'לשריר עם לידוקאין 1%: לא בהלם'), P.shock]],
      side:[['Allergic reaction: rash, wheeze, low BP', '', L('Stop. Treat as anaphylaxis.', 'להפסיק. לטפל כאנפילקסיס.')],
            ['Pain at the injection site (IM)', '', L('Expected.', 'צפוי.')]] },
    met: { no:[ALLERGY(L('metronidazole','מטרונידזול'))],
      when:waitItem,
      caution:[[L('Slow drip', 'טפטוף איטי'), false]],
      side:[['Nausea, metallic taste', '', L('Expected.', 'צפוי.')],
            ['Numbness or seizure (rare)', '', L('Stop. Tell the doctor.', 'להפסיק. לדווח לרופא.')]] },
    mid: { no:[ALLERGY(L('midazolam','מידזולם'))],
      when:[[L('Morphine or fentanyl in the last 30 min: breathing risk', 'מורפין או פנטניל ב-30 הדק׳ האחרונות: סכנה לנשימה'), opioidRecent],
            [L('Two doses already given', 'כבר ניתנו שתי מנות'), s.g.length >= 2]].concat(waitItem),
      caution:[[L('Can drop blood pressure: watch closely if bleeding', 'עלול להוריד לחץ דם: מעקב צמוד בפצוע מדמם'), P.shock || P.deep]],
      side:[BREATH.slice(0, 2).concat([L('Bag-mask ventilation.', 'הנשמה במפוח (BVM).')]),
            ['Low blood pressure', '', L('Re-check BP.', 'מדידת לחץ דם.')],
            ['Deep sedation', '', L('Open the airway, monitor.', 'פתיחת נתיב אוויר, מעקב.')]] },
    ind: { no:[[L('Not by a junior medic: senior medic with two assistants', 'לא על ידי מטפל זוטר: מטפל בכיר עם שני מסייעים'), false], [L('No paralytics in the field', 'ללא משתקי שרירים בשטח'), false]],
      when:[],
      caution:[[L('Suspected deep shock: half dose', 'חשד להלם עמוק: חצי מנה'), P.deep], [L('Child maintenance: a doctor decides', 'אחזקה בילד: רופא מחליט'), P.child]],
      side:[['Stopped breathing', '', L('Bag-mask, secure the airway.', 'הנשמה במפוח, אבטחת נתיב אוויר.')],
            ['Low blood pressure', '', L('Re-check BP.', 'מדידת לחץ דם.')],
            ['More saliva (ketamine)', '', L('Suction. Atropine if needed.', 'שאיבה. אטרופין אם נדרש.')]] },
    adr: { no:[NOKID],
      when:[[L('IV at this dose: never. IM only.', 'לווריד במינון הזה: לעולם לא. רק לשריר.'), false]].concat(waitItem),
      caution:[[L('Short-acting: repeat every 5 min if needed', 'קצר טווח: חזרה כל 5 דק׳ לפי הצורך'), false], [L('Check BP after each dose', 'מדידת לחץ דם אחרי כל מנה'), false]],
      side:[['Fast heart rate, palpitations', '', L('Expected. Monitor.', 'צפוי. מעקב.')],
            ['High BP, tremor, anxiety', '', L('Monitor.', 'מעקב.')]] },
    sol: { no:[NOKID],
      when:[[L('Transfusion still running: stop it first', 'העירוי עדיין רץ: קודם לעצור'), false]],
      caution:[[L('Hives alone: this drug only', 'פריחה בלבד: רק התרופה הזו'), false]],
      side:[['High blood sugar', '', L('Single dose: usually harmless.', 'מנה אחת: בדרך כלל לא מזיק.')]] },
    crush: { no:[[L('Hartmann: use saline (Hartmann has potassium)', 'הרטמן: סליין בלבד (בהרטמן יש אשלגן)'), false]],
      when:[[L('Furosemide only if no urine AND lung congestion', 'פוסיד רק אם אין שתן וגם גודש ריאתי'), false]],
      caution:[[L('Run for 6 hours', 'במשך 6 שעות'), false]],
      side:[['Heart rhythm problems on release (high potassium)', '', L('Monitor, evacuate fast.', 'מעקב, פינוי מהיר.')],
            ['Fluid overload: wet lungs', '', L('Slow the rate.', 'להאט את הקצב.')]] }
  };
  var o = map[d.id] || { no:[], when:[], caution:[], side:[] };
  // side-effect Hebrew names (kept apart so the table above stays readable)
  var SHE = { 'Low blood pressure':'לחץ דם נמוך', 'Nausea, vomiting':'בחילה, הקאה', 'Seizure (rare)':'פרכוס (נדיר)', 'Transfusion reaction: fever, wheeze, low BP':'תגובה לעירוי: חום, צפצופים, לחץ דם נמוך', 'Hives only':'פריחה בלבד', 'Cold casualty':'פצוע קר', 'Too much fluid: thinner blood, more bleeding':'עודף נוזלים: דם מדולל, יותר דימום', 'Agitation, hallucinations on waking':'אי-שקט והזיות ביקיצה', 'More saliva':'ריור מוגבר', 'Higher heart rate and BP':'דופק ולחץ דם גבוהים', 'Flickering eyes':'ריצוד עיניים', 'Itching':'גרד', 'Drowsiness':'ישנוניות', 'Allergic rash':'פריחה אלרגית', 'Liver damage in overdose':'נזק לכבד במנת יתר', 'Restlessness, spasm of face or neck muscles':'אי-שקט, עוויתות בשרירי הפנים או הצוואר', 'Allergic reaction: rash, wheeze, low BP':'תגובה אלרגית: פריחה, צפצופים, לחץ דם נמוך', 'Pain at the injection site (IM)':'כאב באתר ההזרקה (לשריר)', 'Nausea, metallic taste':'בחילה, טעם מתכתי', 'Numbness or seizure (rare)':'נימול או פרכוס (נדיר)', 'Deep sedation':'הרדמה עמוקה', 'Stopped breathing':'דום נשימה', 'More saliva (ketamine)':'ריור מוגבר (קטמין)', 'Fast heart rate, palpitations':'דופק מהיר, דפיקות לב', 'High BP, tremor, anxiety':'לחץ דם גבוה, רעד, חרדה', 'High blood sugar':'סוכר גבוה בדם', 'Heart rhythm problems on release (high potassium)':'הפרעות קצב בשחרור (אשלגן גבוה)', 'Fluid overload: wet lungs':'עודף נוזלים: ריאות רטובות' };
  o.side = o.side.map(function(x){ var en = x[0]; return { t: lang() === 'he' ? (SHE[en] || en) : en, a: x[2] }; });
  return o;
}
function safetyNow(P, d, s){ var o = safety(P, d, s), n = []; ['no','when','caution'].forEach(function(k){ o[k].forEach(function(i){ if (i[1]) n.push({ k:k, t:i[0] }); }); }); return n; }
function safetyBtn(P, d, s){
  var n = safetyNow(P, d, s).filter(function(x){ return x.k !== 'caution'; }).length;
  return '<button class="dz-sfb' + (n ? ' hot' : '') + '" onclick="Field.doseSafety(\'' + d.id + '\')">' + ico('triangle-alert', 24) + '<span>' + L('Warnings','אזהרות') + '</span>' + (n ? '<em>' + L(n + ' apply now', n + ' חלות עכשיו') + '</em>' : '') + '</button>';
}
function safetySheet(id){
  var P = patient(), d = drugs(P).filter(function(x){ return x.id === id; })[0]; if (!d){ S.sf = null; return; }
  var s = status(P, d), o = safety(P, d, s), now = safetyNow(P, d, s);
  var old = document.getElementById('dz-sf'); if (old) old.remove();
  var KIND = { no:['octagon', L('Do not give','לא לתת'), 'red'], when:['x', L('Not now','לא עכשיו'), 'red'], caution:['triangle-alert', L('Caution','זהירות'), 'amber'] };
  var list = function(k, title, sub){
    if (!o[k].length) return '';
    return '<section class="dz-sf-s ' + KIND[k][2] + '"><h4>' + ico(KIND[k][0], 24) + '<span>' + title + '</span></h4>' + (sub ? '<p class="dz-sf-sub">' + sub + '</p>' : '') + '<ul>'
      + o[k].map(function(i){ return '<li' + (i[1] ? ' class="now"' : '') + '><span>' + i[0] + '</span>' + (i[1] ? '<b>' + L('Applies now','חל עכשיו') + '</b>' : '') + '</li>'; }).join('') + '</ul></section>';
  };
  var h = '<div class="dz-sf" role="dialog" aria-modal="true" aria-labelledby="dz-sf-t" tabindex="-1">'
    + '<div class="dz-sf-top"><div><p class="dz-rb-k">' + ico('triangle-alert', 24) + '<span>' + L('Warnings','אזהרות') + '</span></p><h3 id="dz-sf-t">' + d.en + '</h3></div>'
    + '<button class="xbtn" onclick="Field.doseSafetyClose()">' + ico('x', 24) + '<span>' + L('Close','סגירה') + '</span></button></div>';
  if (now.length) h += '<section class="dz-sf-now"><h4>' + ico('target', 24) + '<span>' + L('For this casualty now','לנפגע הזה עכשיו') + '</span></h4><ul>'
    + now.map(function(x){ return '<li class="' + KIND[x.k][2] + '">' + ico(KIND[x.k][0], 22) + '<span><b>' + KIND[x.k][1] + ':</b> ' + x.t + '</span></li>'; }).join('') + '</ul></section>';
  else h += '<p class="dz-sf-ok">' + ico('check', 24) + '<span>' + L('Nothing recorded for this casualty blocks this drug. Still check every item.','שום דבר שנרשם לנפגע הזה לא חוסם את התרופה. בכל זאת לבדוק כל סעיף.') + '</span></p>';
  h += list('no', L('Do not give to','התוויות נגד'), '') + list('when', L('Do not give when','לא לתת כאשר'), '') + list('caution', L('Caution','זהירות'), '');
  if (o.side.length) h += '<section class="dz-sf-s dz-fx"><h4>' + ico('activity', 24) + '<span>' + L('Side effects: what to do','תופעות לוואי: מה עושים') + '</span></h4><ul>'
    + o.side.map(function(x){ return '<li><b>' + x.t + '</b><span>' + ico(lang() === 'he' ? 'arrow-left' : 'arrow-right', 22) + x.a + '</span></li>'; }).join('') + '</ul></section>';
  h += '<p class="dz-src">' + ico('file-text', 22) + '<span>' + L('IDF Trauma and Operational Medicine Book, Jan 2026, and standard pharmacology. Software: a medical professional decides.','ספר הטראומה והרפואה המבצעית של צה״ל, ינואר 2026, ופרמקולוגיה מקובלת. תוכנה: איש צוות רפואי מחליט.') + '</span></p>'
    + '<button class="xbtn dz-sf-close" onclick="Field.doseSafetyClose()">' + ico('x', 24) + '<span>' + L('Close','סגירה') + '</span></button></div>';
  var el = document.createElement('div'); el.id = 'dz-sf'; el.className = 'dz-rb-wrap dz-sf-wrap'; el.innerHTML = h;
  el.addEventListener('click', function(ev){ if (ev.target === el) Field.doseSafetyClose(); });
  document.getElementById('dose-sheet').appendChild(el);
  var b = el.querySelector('.dz-sf'); try { b.focus({ preventScroll:true }); } catch (e){}
}
Field.doseSafety = function(id){ S.sf = id; safetySheet(id); };
Field.doseSafetyClose = function(){ S.sf = null; var r = document.getElementById('dz-sf'); if (r) r.remove(); };

function card(P, d, s, hero){
  var dz = s.dose, pr = prepOf(P, d), vol = pr.conc && dz.u === 'mg' ? volR(dz.v / pr.conc) : null, blocked = !!s.block, p = parts(dz);
  var h = '<article class="dz-c' + (blocked ? ' stop' : s.wait > 0 ? ' wait' : s.due ? ' due' : '') + (hero ? ' hero' : '') + '" data-id="' + d.id + '">';
  h += band(P, d, s);
  h += '<div class="dz-body"><div class="dz-h"><div><b>' + d.en + '</b>' + (d.info ? '<small>' + d.sub + '</small>' : '') + '</div><span class="dz-route">' + esc(routeWord(d.route)) + '</span></div>';
  h += '<div class="dz-dose">' + (dz.txt ? '<strong class="dz-txt">' + esc(dz.txt) + '</strong>' : qty(p.n, p.u, 'dz-big')) + (vol ? '<span class="dz-vol"><i>=</i>' + cc(vol) + '</span>' : '') + '</div>';
  if (s.chg && !blocked) h += '<p class="dz-chg">' + ico('gauge', 22) + '<span><b>' + L('Changed dose','מינון משתנה') + '</b>' + s.chg + '</span></p>';
  h += '<p class="dz-rule">' + d.rule + (P.child && !d.info ? ' · ' + kgW(P.wt) + (P.est ? L(' (estimated)',' (משוער)') : '') : '') + '</p>';
  if (!blocked) h += prepHtml(P, d, dz);
  if (s.g.length){
    var tot = d.fluid ? s.g.reduce(function(a, f){ return a + (Number(f.volume) || 0); }, 0) : null;
    h += '<p class="dz-hist">' + ico('clock', 22) + '<span>' + L('Given ' + s.g.length + '×, last at ' + hm(s.last.time), 'ניתן ' + s.g.length + ' פעמים, אחרון ב-' + hm(s.last.time)) + (tot != null ? L(' · total ',' · סה״כ ') + tot + ' ' + U('mL') : '') + (d.max24 ? L(' · ' + s.tot24 + ' of ' + d.max24 + ' mg today',' · ' + s.tot24 + ' מתוך ' + d.max24 + ' מ״ג היום') : '') + '</span></p>';
  }
  if (s.noAccess && /IV or IO|וריד או IO/.test(s.block || '')) h += accessBtns();
  h += safetyBtn(P, d, s);
  h += '<details class="dz-more"><summary>' + ico('info', 22) + '<span>' + L('How to give','איך לתת') + '</span></summary><p>' + d.prep + '</p></details>';
  if (!d.info && !blocked) h += '<button class="xbtn ' + (s.wait > 0 ? 'dz-early' : 'xbtn-primary') + ' dz-give" onclick="Field.doseCheck(\'' + d.id + '\')">' + ico('syringe', 26) + '<span>' + (s.wait > 0 ? L('Too early: check first','מוקדם מדי: לבדוק קודם') : L('Give ','מתן ') + doseText(dz)) + '</span></button>';
  return h + '</div></article>';
}

var TABS = [['now','Give now','לתת עכשיו','check'], ['shock','Bleeding','דימום','droplet'], ['pain','Pain','כאב','zap'], ['abx','Infection','זיהום','shield'], ['other','Other','אחר','list-checks']];
function painWord(p){ return p === 0 ? L('None','אין') : p <= 4 ? L('Mild','קל') : p <= 7 ? L('Moderate','בינוני') : L('Severe','חזק'); }

function draw(){
  var el = document.getElementById('dose-sheet'); if (!el) return;
  var P = patient(), D = drugs(P), ST = D.map(function(d){ return status(P, d); }), e = X().e || {};
  var all = D.map(function(d, i){ return { d:d, s:ST[i] }; });
  var due = all.filter(function(o){ return o.s.due && !o.s.block; });
  var waiting = all.filter(function(o){ return o.s.wait > 0 && !o.s.block; });
  var blockedN = all.filter(function(o){ return o.s.block; }).length;
  var z = zone(P.wt);
  var cn = W.casNum ? W.casNum({ name: W._casualtyName }) : null, who = cn ? W.casLabel({ name: W._casualtyName }) : String(W._casualtyName || '').split(' — ')[0];
  var h = '<header class="dz-top"><b>' + ico('pill', 26) + '<span class="dz-tt"><small>' + L('Dose calculator','מחשבון מינונים') + '</small><span>' + esc(who || L('This casualty','הנפגע הזה')) + '</span></span></b><button class="xbtn" onclick="Field.doseClose()">' + ico('x', 24) + '<span>' + L('Close','סגירה') + '</span></button></header>';

  // patient strip: who the doses are for, and the pain score; each opens its own editor
  var kg = fmt(P.wt);
  h += '<section class="dz-ps">'
    + '<button class="dz-ps-b' + (S.edit === 'pt' ? ' on' : '') + '" aria-expanded="' + (S.edit === 'pt') + '" onclick="Field.doseEdit(\'pt\')">'
    + '<span class="dz-ps-k"><span>' + (P.child ? (P.age != null && P.age < 1 ? L('Infant','תינוק') : L('Child','ילד')) : L('Adult','מבוגר')) + (P.age != null ? ' · ' + fmt(P.age) + L(' y',' ש׳') : '') + '</span>' + ico('chevron-down', 22) + '</span>'
    + '<span class="dz-ps-v">' + qty(kg, 'kg') + '</span>'
    + '<span class="dz-ps-s' + (P.est ? ' est' : '') + '">' + (P.est ? (P.ageless ? L('Assumed: enter it','משוער: הזינו') : L('Estimated by age','משוער לפי גיל')) : L('Known','ידוע')) + '</span>'
    + '</button>'
    + '<button class="dz-ps-b' + (S.edit === 'pain' ? ' on' : '') + (P.pain == null ? ' need' : '') + '" aria-expanded="' + (S.edit === 'pain') + '" onclick="Field.doseEdit(\'pain\')">'
    + '<span class="dz-ps-k"><span>' + L('Pain now','כאב עכשיו') + '</span>' + ico('chevron-down', 22) + '</span>'
    + '<span class="dz-ps-v">' + (P.pain != null ? '<span class="dz-q" dir="ltr"><span class="dz-qn">' + P.pain + '</span><span class="dz-qu">/10</span></span>' : '<span class="dz-q"><span class="dz-qn">?</span></span>') + '</span>'
    + '<span class="dz-ps-s">' + (P.pain != null ? painWord(P.pain) : L('Not scored yet','טרם נקבע')) + '</span>'
    + '</button>'
    + '</section>';
  if (S.edit === 'pt'){
    h += '<section class="dz-ed dz-pt">'
      + '<div class="dz-wt"><span class="dz-lbl">' + L('Weight','משקל') + '</span><div class="dz-step" dir="ltr"><button aria-label="' + L('Less weight','פחות משקל') + '" onclick="Field.doseWt(-1)">' + ico('minus', 24) + '<span>' + L('Less','פחות') + '</span></button>'
      + '<label><input type="number" inputmode="decimal" min="1" max="250" step="any" value="' + (e.weightKg && !e.weightEst ? e.weightKg : '') + '" placeholder="' + fmt(P.wt) + '" onchange="Field.doseSet(\'wt\',this.value)" aria-label="' + L('Weight in kg','משקל בק״ג') + '"><u>' + L('kg','ק״ג') + '</u></label>'
      + '<button aria-label="' + L('More weight','יותר משקל') + '" onclick="Field.doseWt(1)">' + ico('plus', 24) + '<span>' + L('More','יותר') + '</span></button></div></div>'
      + '<div class="dz-age"><span class="dz-lbl">' + L('Age','גיל') + '</span><label class="dz-agein"><input type="number" inputmode="decimal" min="0" max="120" step="any" value="' + (e.ageYears != null ? e.ageYears : '') + '" placeholder="—" onchange="Field.doseSet(\'age\',this.value)" aria-label="' + L('Age in years','גיל בשנים') + '"><u>' + L('y','שנים') + '</u></label></div>'
      + '</section>';
  }
  if (S.edit === 'pain'){
    h += '<section class="dz-ed dz-pain"><span class="dz-lbl">' + L('Pain now, 0 to 10','כאב עכשיו, 0 עד 10') + '</span><div class="dz-pain-g" dir="ltr">';
    for (var i = 0; i <= 10; i++) h += '<button class="' + (P.pain === i ? 'on ' : '') + 'p' + (i === 0 ? 0 : i <= 4 ? 1 : i <= 7 ? 2 : 3) + '" aria-pressed="' + (P.pain === i) + '" aria-label="' + L('Pain ','כאב ') + i + '" onclick="Field.dosePain(' + i + ')">' + i + '</button>';
    h += '</div><div class="dz-pain-k" dir="ltr"><span>' + L('0 none','0 אין') + '</span><span>' + L('1–4 mild','1–4 קל') + '</span><span>' + L('5–7 moderate','5–7 בינוני') + '</span><span>' + L('8–10 severe','8–10 חזק') + '</span></div></section>';
  }
  h += findings(P) + decisions(all, P);
  h += '<p class="dz-warn">' + ico('triangle-alert', 22) + '<span>' + L('Software calculation: check every dose. A medical professional decides.','חישוב תוכנה: בדקו כל מנה. איש צוות רפואי מחליט.') + '</span></p>';
  // tabs
  var gDue = {}; due.forEach(function(o){ gDue[o.d.g] = (gDue[o.d.g] || 0) + 1; });
  h += '<nav class="dz-tabs" role="tablist" aria-label="' + L('Drug groups','קבוצות תרופות') + '">' + TABS.map(function(t){ var n = t[0] === 'now' ? due.length : (gDue[t[0]] || 0); return '<button role="tab" aria-selected="' + (S.tab === t[0]) + '" class="' + (S.tab === t[0] ? 'on' : '') + (t[0] === 'now' ? ' now' : '') + '" onclick="Field.doseTab(\'' + t[0] + '\')">' + ico(t[3], 22) + '<span>' + L(t[1], t[2]) + '</span>' + (t[0] === 'now' || n ? '<i aria-label="' + L(n + ' due', n + ' מגיעות') + '">' + n + '</i>' : '') + '</button>'; }).join('') + '</nav>';
  if (S.tab === 'now'){
    var needAcc = all.filter(function(o){ return o.s.noAccess && o.s.wouldDue; });
    if (needAcc.length) h += '<div class="dz-acc">' + '<p class="dz-acc-h">' + ico('octagon', 26) + '<span><b>' + L('Needs IV or IO first','צריך קודם וריד או IO') + '</b>' + L('Due once access is in: ','יגיעו כשתהיה גישה: ') + needAcc.map(function(o){ return o.d.en; }).join(', ') + '</span></p>' + accessBtns() + '</div>';
    h += '<p class="dz-sum">' + L(D.length + ' checked · ', D.length + ' נבדקו · ')
      + '<b>' + L(due.length + ' due', due.length + ' לתת') + '</b>'
      + (waiting.length ? ' · ' + L(waiting.length + ' waiting', waiting.length + ' בהמתנה') : '')
      + (blockedN ? ' · ' + L(blockedN + ' not now', blockedN + ' לא עכשיו') : '') + '</p>';
    if (!due.length){
      h += '<div class="dz-empty">' + ico('check-check', 32) + '<b>' + L('Nothing is due right now','אין מנה שמגיעה עכשיו') + '</b><span>' + L('Every drug is in the tabs above.','כל התרופות בלשוניות למעלה.') + '</span>'
        + (P.pain == null ? '<button class="xbtn xbtn-primary" onclick="Field.doseEdit(\'pain\')">' + ico('zap', 24) + '<span>' + L('Score pain now','לקבוע ציון כאב') + '</span></button>' : '') + '</div>';
    } else due.forEach(function(o, k){ h += card(P, o.d, o.s, k === 0); });
    if (waiting.length) h += '<h3 class="dz-sub">' + ico('timer', 24) + L('Repeat timers','טיימרים לחזרה') + '</h3>' + waiting.map(function(o){ return '<div class="dz-timer"><b>' + o.d.en + '</b><span>' + L('next dose in ','מנה הבאה בעוד ') + '<i dir="ltr" data-due="' + Math.round(Date.now() + o.s.wait * 1000) + '">' + mmss(o.s.wait) + '</i></span></div>'; }).join('');
  } else {
    // in a group: due first, then waiting, then available, then not-now
    var rank = function(o){ return o.s.block ? 3 : o.s.due ? 0 : o.s.wait > 0 ? 1 : 2; };
    all.filter(function(o){ return o.d.g === S.tab; }).sort(function(a, b){ return rank(a) - rank(b); }).forEach(function(o){ h += card(P, o.d, o.s, false); });
  }
  h += '<p class="dz-src">' + ico('file-text', 22) + '<span>' + L('IDF Trauma Book 2026 · fictional patient','ספר הטראומה של צה״ל 2026 · מטופל בדוי') + '</span></p>';
  var top = el.scrollTop;
  el.querySelector('.dz').innerHTML = h;
  el.scrollTop = top;
  if (S.rb) readback(S.rb);
}

// ── Read-back: the five rights, out loud, before anything is recorded ──
function readback(id){
  var P = patient(), d = drugs(P).filter(function(x){ return x.id === id; })[0]; if (!d){ S.rb = null; return; }
  var s = status(P, d), dz = s.dose, p = parts(dz), pr = prepOf(P, d), vol = pr.conc && dz.u === 'mg' ? volR(dz.v / pr.conc) : null;
  var old = document.getElementById('dz-rb'); if (old) old.remove();
  var warn = [];
  if (s.wait > 0) warn.push(L('Last dose ' + Math.round(minsSince(s.last.time)) + ' min ago. The next dose is due in ' + mmss(s.wait) + '.','מנה אחרונה לפני ' + Math.round(minsSince(s.last.time)) + ' דק׳. המנה הבאה בעוד ' + mmss(s.wait) + '.'));
  if (P.est) warn.push(L('Weight is estimated (' + kgW(P.wt) + '). Confirm it before a weight-based dose.','המשקל משוער (' + kgW(P.wt) + '). אמתו לפני מנה לפי משקל.'));
  if (/^(mor|mid|fen)$/.test(id) && P.meds.some(function(m){ return /מורפין|פנטניל|דורמיקום|morphine|fentanyl|midazolam/i.test(m.drug || '') && minsSince(m.time) < 30 && !d.match.test(m.drug || ''); })) warn.push(L('Another drug that slows breathing was given in the last 30 min: watch breathing.','תרופה נוספת שמאטה נשימה ניתנה ב-30 הדק׳ האחרונות: מעקב נשימה.'));
  if (id === 'txa' && P.fluids.some(function(f){ return /דם|blood|FDP|פלסמה/i.test(f.type || '') && minsSince(f.time) < 15; })) warn.push(L('Blood is running: use another line, or flush 10 mL saline first.','דם בעירוי: קו אחר, או שטיפה ב-10 מ״ל סליין קודם.'));
  var row = function(k, v){ return '<div><dt>' + ico('check', 22) + '<span>' + k + '</span></dt><dd>' + v + '</dd></div>'; };
  var el = document.createElement('div'); el.id = 'dz-rb'; el.className = 'dz-rb-wrap';
  el.innerHTML = '<div class="dz-rb" role="dialog" aria-modal="true" aria-labelledby="dz-rb-t">'
    + '<p class="dz-rb-k">' + ico('volume-2', 24) + '<span>' + L('Read it back out loud','הקריאו בקול') + '</span></p>'
    + '<h3 id="dz-rb-t">' + L('Five rights before giving','חמשת הנכונים לפני מתן') + '</h3>'
    + '<dl class="dz-rb-l">'
    + row(L('Drug','תרופה'), '<b>' + d.en + '</b>')
    + row(L('Dose','מינון'), qty(p.n, p.u, 'dz-rb-n') + (vol ? '<span class="dz-vol"><i>=</i>' + cc(vol) + '</span>' : ''))
    + (pr.kind === 'dil' ? row(L('Mix','תערובת'), '<b>' + mixLine(pr, d.en) + '</b>') : pr.kind === 'vial' ? row(L('Mix','תערובת'), '<b>' + ccT(pr.dilCc) + ' ' + dilWord(pr.dil) + L(' per 1 g vial = ',' לכל בקבוקון 1 גרם = ') + fmt(pr.conc) + L(' mg/cc',' מ״ג/סמ״ק') + '</b>') : pr.kind === 'none' && vol ? row(L('Mix','תערובת'), '<b>' + L('No dilution · as supplied','ללא מהילה · כפי שמגיע') + '</b>') : '')
    + (vol ? row(L('Syringe','מזרק'), '<b>' + ccT(vol > S.syr ? sizeFor(vol) : S.syr) + '</b>') : '')
    + row(L('Route','דרך מתן'), '<b>' + esc(routeWord(d.route)) + '</b>')
    + row(L('Patient','מטופל'), '<b>' + (P.child ? L('Child','ילד') : L('Adult','מבוגר')) + ' · ' + kgW(P.wt) + (P.est ? L(' (estimated)',' (משוער)') : '') + '</b>')
    + row(L('Time','שעה'), '<b dir="ltr">' + hm(Date.now()) + '</b>')
    + '</dl>'
    + safetyBtn(P, d, s)
    + prepHtml(P, d, dz, true)
    + '<p class="dz-rb-p">' + d.rule + '</p>'
    + warn.map(function(w){ return '<p class="dz-rb-w">' + ico('triangle-alert', 22) + '<span>' + w + '</span></p>'; }).join('')
    + '<p class="dz-rb-x">' + L('Software calculation: a medical professional decides.','חישוב תוכנה: איש צוות רפואי מחליט.') + '</p>'
    + '<div class="dz-rb-b"><button class="xbtn' + (s.wait > 0 ? ' xbtn-primary' : '') + '" onclick="Field.doseRbClose()">' + ico('x', 24) + '<span>' + L('Cancel','ביטול') + '</span></button>'
    + '<button class="xbtn ' + (s.wait > 0 ? 'dz-early' : 'xbtn-primary') + '" onclick="Field.doseGive(\'' + id + '\')">' + ico('check', 24) + '<span>' + (s.wait > 0 ? L('Give anyway','לתת בכל זאת') : L('Given: record it','ניתן: לתעד')) + '</span></button></div>'
    + '</div>';
  document.getElementById('dose-sheet').appendChild(el);
}
Field.doseCheck = function(id){ S.rb = id; readback(id); var b = document.querySelector('#dz-rb .dz-rb'); if (b){ b.tabIndex = -1; try { b.focus({ preventScroll:true }); } catch (e){} } };
Field.doseRbClose = function(){ S.rb = null; var r = document.getElementById('dz-rb'); if (r) r.remove(); };
Field.doseGive = function(id){
  var P = patient(), d = drugs(P).filter(function(x){ return x.id === id; })[0]; if (!d) return;
  var dz = d.dose(P), x = X(), n0 = (x.e.medications || []).length, f0 = ((x.c || {}).fluids || []).length;
  Field.doseRbClose();
  if (W.pushMedHistory) W.pushMedHistory();
  W._fieldConfirmed = true;
  try { if (d.fluid) W.addFluidEntry(d.ftype, dz.v); else W.addMedication(d.eng, engDose(dz), d.route); } finally { W._fieldConfirmed = false; }
  var added = (x.e.medications || []).length > n0 || ((x.c || {}).fluids || []).length > f0;
  if (!added){ if (W._medUndoStack) W._medUndoStack.pop(); return; }
  if (d.fluid && W._medUndoStack) W._medUndoStack.pop();   // addFluidEntry takes its own undo step
  if (W.MedHost && W.MedHost.triggerAutoSave) W.MedHost.triggerAutoSave();
  toast(L(d.en + ' ' + doseText(dz) + ' recorded at ' + hm(Date.now()), d.en + ' ' + doseText(dz) + ' תועד ב-' + hm(Date.now())));
  draw();
};
function toast(msg){
  var old = document.getElementById('undo-toast'); if (old) old.remove();
  var el = document.createElement('div'); el.id = 'undo-toast'; el.className = 'undo-toast no-polish'; el.setAttribute('role', 'status');
  el.innerHTML = '<span>' + esc(msg) + '</span><button>' + ico('undo-2', 24) + '<span>' + L('Undo','ביטול') + '</span></button>';
  el.querySelector('button').onclick = function(){ el.remove(); if (W.medUndo) W.medUndo(); setTimeout(draw, 50); };
  (document.getElementById('app') || document.body).appendChild(el);
  setTimeout(function(){ el.remove(); }, 8000);
  if (navigator.vibrate) navigator.vibrate(25);
}

Field.doseOpen = function(tab){
  Field.doseClose();
  if (tab) S.tab = tab;
  S.edit = painNow() == null ? 'pain' : null;
  var el = document.createElement('div'); el.id = 'dose-sheet'; el.className = 'dz-wrap no-polish'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', L('Dose calculator','מחשבון מינונים'));
  el.innerHTML = '<div class="dz"></div>';
  (document.getElementById('app') || document.body).appendChild(el); draw();
};
Field.doseAccess = function(kind){
  var x = X(); x.c = x.c || {}; if (!Array.isArray(x.c.ivAccess)) x.c.ivAccess = x.c.ivAccess ? [{ site: String(x.c.ivAccess), time: new Date().toISOString() }] : [];
  if (W.pushMedHistory) W.pushMedHistory();
  x.c.ivAccess.push({ site: kind, time: new Date().toISOString() });
  if (kind === 'IO') x.c.ioAccess = true;
  if (W.addTimestampedAction) W.addTimestampedAction('c', kind === 'IO' ? 'גישה תוך-גרמית: IO' : 'גישה ורידית: IV', '');
  if (W.MedHost && W.MedHost.triggerAutoSave) W.MedHost.triggerAutoSave();
  toast(L((kind === 'IO' ? 'IO' : 'IV') + ' access recorded at ' + hm(Date.now()), (kind === 'IO' ? 'גישה גרמית' : 'גישה ורידית') + ' תועדה ב-' + hm(Date.now())));
  draw();
};
Field.doseSyr = function(z){ S.syr = z; try { sessionStorage.setItem('dz-syr', String(z)); } catch (e){} draw(); };
Field.doseClose = function(){ S.rb = null; S.sf = null; var s = document.getElementById('dose-sheet'); if (s) s.remove(); };
Field.doseEdit = function(k){ S.edit = S.edit === k ? null : k; draw(); };
Field.doseTab = function(t){ S.tab = t; try { sessionStorage.setItem('dz-tab', t); } catch (e){} draw(); var el = document.getElementById('dose-sheet'), n = el && el.querySelector('.dz-tabs'); if (n && el.scrollTop > n.offsetTop) el.scrollTop = Math.max(0, n.offsetTop - 80); };
Field.doseSet = function(k, v){
  if (v === '' || v == null) return;
  Field.patIn(k, v); Field.patDone(k, v);
  setTimeout(draw, 30);
};
Field.doseWt = function(dir){
  var P = patient(), step = P.wt < 10 ? 0.5 : 1, v = Math.max(1, Math.min(250, r1(Math.round(P.wt / step) * step + dir * step)));
  Field.doseSet('wt', String(v));
};
// a pain score closes its picker: one tap, back to the doses
Field.dosePain = function(i){
  if (W.pushMedHistory) W.pushMedHistory();
  if (W._setPainScore) W._setPainScore(i);
  S.edit = null;
  setTimeout(draw, 30);
};
// live countdowns without rebuilding the sheet; full refresh every 15 s for time windows
setInterval(function(){
  var s = document.getElementById('dose-sheet'); if (!s) return;
  var done = false;
  s.querySelectorAll('[data-due]').forEach(function(n){ var left = (Number(n.getAttribute('data-due')) - Date.now()) / 1000; var t = n.tagName === 'I' ? n : n.querySelector('b'); if (t) t.textContent = mmss(left); if (left <= 0) done = true; });
  if (done && !S.rb && !S.sf && !s.contains(document.activeElement)) draw();
}, 1000);
setInterval(function(){ var s = document.getElementById('dose-sheet'); if (s && !S.rb && !S.sf && !s.contains(document.activeElement)) draw(); }, 15000);

// Entry button in Form 101: says how many doses are due now
Field.doseHtml = function(){
  if (W._casualtyTriageColor === 'black' || W._casualtyTriageColor === 'gray' || W._casualtyTriageColor === 'grey') return '';   // grey = black (same category)
  var n = 0; try { var P = patient(); n = drugs(P).filter(function(d){ var s = status(P, d); return s.due && !s.block; }).length; } catch (e){}
  return '<button class="f-dose' + (n ? ' has' : '') + '" onclick="Field.doseOpen(\'now\')">' + ico('pill', 30) + '<span><b>' + L('Dose calculator','מחשבון מינונים') + '</b><small>' + (n ? L(n + (n === 1 ? ' dose is' : ' doses are') + ' due now for this casualty', n === 1 ? 'מנה אחת מגיעה עכשיו לנפגע הזה' : n + ' מנות מגיעות עכשיו לנפגע הזה') : L('Exact doses for this casualty, from the book','מינונים מדויקים לנפגע הזה, מהספר')) + '</small></span>' + (n ? '<i>' + n + '</i>' : '') + '</button>';
};
})();
