/* DOSE CALCULATOR — doses from the IDF Trauma and Operational Medicine Book (2026 edition, chapters 3, 4, 9, 11, 14, 15, 16, 18).
   Reads this casualty: weight and age (or the book's weight-for-age table), pain score, shock state, wounds, IV access,
   time since injury and every dose already given. Shows what is due now and why, the exact dose, the volume to draw
   (drawn on a syringe), repeat timers and 24-hour totals, and asks for a read-back before anything is recorded.
   Software output: a medical professional decides. */
(function(){
'use strict';
var W = window, Field = W.Field;
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
  var sys = lastOf('bpSys'), hr = lastOf('pulse');
  var inj = Field && Field.injuryInfo ? Field.injuryInfo() : null;
  var pen = injuries().some(function(i){ return i && i.type === 'penetrating'; });
  var child = age != null ? age < 12 : !!(W.isPedsMode && W.isPedsMode());
  return { age:age, child:child, wt:wt, est:est, ageless:ageless,
    deep: !!ctx.deepShock, shock: child ? !!ctx.deepShock : (!!ctx.anyShock || !!ctx.deepShock),
    profound: (age != null && age < 12) ? (!!ctx.deepShock || (sys != null && sys < 70 + 2 * Math.max(1, age))) : ((sys != null && sys < 90) || (hr != null && hr > 130) || !!ctx.deepShock || !!ctx.profoundShock),
    inj: inj, pain: painNow(), pen: pen, penTorso: !!ctx.penetratingTorso, penHNA: !!ctx.penetratingHeadNeckAbd,
    iv: ((x.c || {}).ivAccess || []).length > 0, meds: e.medications || [], fluids: (x.c || {}).fluids || [] };
}
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
    dose: function(){ return { v: P.child ? Math.min(1000, r0(15 * kg)) : 1000, u:'mg' }; }, conc: 100, concNote: L('500 mg / 5 mL ampoule: check the label','אמפולה 500 מ״ג / 5 מ״ל: בדקו בתווית'),
    rule: P.child ? L('15 mg/kg, max 1 g','15 מ״ג/ק״ג, עד 1 גרם') : L('1 g, once','1 גרם, פעם אחת'),
    prep: L('Slow IV. Not in the same line with blood at the same time: flush 10 mL saline between them.','לאט לווריד. לא באותו עירוי עם דם בו-זמנית: שטיפה ב-10 מ״ל סליין ביניהם.'),
    maxN: 1,
    stop: function(){ return !inWin ? L('More than 3 hours since injury: the book says do not give.','חלפו יותר מ-3 שעות מהפציעה: הספר קובע לא לתת.') : null; },
    why: function(){ if (!(P.deep || P.penTorso)) return null; return (P.deep ? L('Deep shock','הלם עמוק') : L('Penetrating torso wound','פצע חודר בגו')) + ' · ' + (P.inj ? L(P.inj.left + ' min left of the 3-hour window', 'נותרו ' + P.inj.left + ' דק׳ מחלון 3 השעות') : L('set the time of injury','קבעו שעת פציעה')); } });
  D.push({ id:'blood', g:'shock', en:L('Whole blood','דם מלא'), sub:L('Plasma (FDP) if no blood. 1:1 with PRBC if both used.','פלסמה (FDP) אם אין דם. 1:1 עם כדוריות אם שתיהן בשימוש.'), fluid:/דם|blood|FDP|פלסמה|plasma/i, ftype:'דם מלא', route:'IV',
    dose: function(){ return { v: P.child ? Math.min(500, r0(20 * kg)) : 500, u:'mL' }; }, conc: null,
    rule: P.child ? L('20 mL/kg (about 1 unit up to 20 kg)','20 מ״ל/ק״ג (כמנה אחת עד 20 ק״ג)') : L('1 unit, then stop and re-check','מנה אחת, ואז עצירה ובדיקה חוזרת'),
    prep: L('After EACH unit: stop, re-check blood pressure. Another unit only if still in deep shock. Target systolic 90.','אחרי כל מנה: עוצרים ומודדים לחץ דם. מנה נוספת רק אם עדיין בהלם עמוק. יעד סיסטולי 90.') + (P.child ? L(' Give with a syringe and a 3-way tap.',' מתן במזרק וברז תלת-כיווני.') : ''),
    stop: function(){ return !P.deep ? L('Only in deep shock. No deep shock is recorded.','רק בהלם עמוק. לא נרשם הלם עמוק.') : null; },
    why: function(){ return P.deep ? L('Deep shock','הלם עמוק') : null; } });
  D.push({ id:'hart', g:'shock', en:L('Hartmann','הרטמן'), sub:L('Ringer lactate. Only if blood is more than 15 min away.','רינגר לקטט. רק אם דם רחוק יותר מ-15 דק׳.'), fluid:/הרטמן|hartmann|ringer/i, ftype:'הרטמן', route:'IV',
    dose: function(){ return { v: P.child ? Math.min(500, r0(20 * kg)) : 500, u:'mL' }; }, conc: null,
    rule: P.child ? L('20 mL/kg bolus','בולוס 20 מ״ל/ק״ג') : L('500 mL bolus','בולוס 500 מ״ל'),
    prep: L('Re-check after each bolus. Never as a "keep vein open" drip. Never mixed with ceftriaxone.','בדיקה חוזרת אחרי כל בולוס. לא כעירוי "לשמירת וריד". לא יחד עם צפטריאקסון.'),
    stop: function(){ return !P.deep ? L('Only in deep shock, when blood is not close.','רק בהלם עמוק, כשאין דם קרוב.') : null; } });

  // ── PAIN (ch. 15) ──
  var ket = { id:'ket', g:'pain', en:L('Ketamine','קטמין'), sub:L('First IV pain drug','תרופת הכאב הראשונה לווריד'), eng:'קטמין', match:/קטמין|ketamine/i, route:'IV',
    dose: function(){ return { v: P.child ? r1(0.3 * kg) : 25, u:'mg' }; }, conc: P.child ? 5 : 50,
    concNote: P.child ? L('Dilute: 1 mL of the 50 mg/mL ampoule + 9 mL saline = 5 mg/mL','מהילה: 1 מ״ל מאמפולת 50 מ״ג/מ״ל + 9 מ״ל סליין = 5 מ״ג/מ״ל') : L('500 mg / 10 mL ampoule (50 mg/mL). Do not dilute.','אמפולה 500 מ״ג / 10 מ״ל (50 מ״ג/מ״ל). לא למהול.'),
    rule: P.child ? L('0.3 mg/kg','0.3 מ״ג/ק״ג') : L('25 mg single bolus','בולוס יחיד 25 מ״ג'),
    prep: L('Flush 10 mL saline. No relief after 5 min: morphine. Long evacuation: repeat every 45 min. Watch breathing and consciousness.','שטיפה 10 מ״ל סליין. אין הקלה אחרי 5 דק׳: מורפין. פינוי ממושך: חזרה כל 45 דק׳. מעקב נשימה והכרה.'),
    every: 45,
    stop: function(){ return !P.iv ? L('No IV access recorded. Without IV: fentanyl lozenge.','לא נרשמה גישה ורידית. בלי וריד: סוכריית פנטניל.') : null; },
    why: function(){ return P.pain != null && P.pain >= 5 ? L('Pain ' + P.pain + ' of 10','כאב ' + P.pain + ' מתוך 10') : null; } };
  D.push(ket);
  D.push({ id:'mor', g:'pain', en:L('Morphine','מורפין'), sub:L('If ketamine did not help after 5 min','אם קטמין לא עזר אחרי 5 דק׳'), eng:'מורפין', match:/מורפין|morphine/i, route:'IV',
    dose: function(){ return { v: P.child ? (P.profound ? r2(0.02 * kg) : r2(0.05 * kg)) : (P.profound ? 2 : 5), u:'mg' }; }, conc: 1,
    concNote: L('Dilute: 10 mg / 1 mL ampoule + 9 mL saline = 1 mg/mL','מהילה: אמפולה 10 מ״ג / 1 מ״ל + 9 מ״ל סליין = 1 מ״ג/מ״ל'),
    rule: (P.child ? L('0.05 mg/kg (0.02 in shock)','0.05 מ״ג/ק״ג (0.02 בהלם)') : L('5 mg (2 mg in shock)','5 מ״ג (2 מ״ג בהלם)')) + (P.profound ? (P.child ? L(' · REDUCED: low blood pressure for age',' · מופחת: לחץ דם נמוך לגיל') : L(' · REDUCED: shock',' · מופחת: הלם')) : ''),
    prep: L('Repeat every 15 min while pain stays 5 or more.','חזרה כל 15 דק׳ כל עוד הכאב 5 ומעלה.') + (P.child ? L(' No IV: 0.1 mg/kg IM once.',' אין וריד: 0.1 מ״ג/ק״ג לשריר פעם אחת.') : ''),
    every: 15,
    stop: function(){ return !P.iv ? L('No IV access recorded.','לא נרשמה גישה ורידית.') : null; },
    why: function(){ if (!(P.pain != null && P.pain >= 5)) return null; var k = givenOf(P, ket); if (!k.length) return null; return minsSince(k[k.length - 1].time) >= 5 ? L('Pain still ' + P.pain + ' after ketamine','כאב עדיין ' + P.pain + ' אחרי קטמין') : null; } });
  D.push({ id:'fen', g:'pain', en:L('Fentanyl lozenge','סוכריית פנטניל'), sub:L('Actiq. When there is no IV.','אקטיק. כשאין וריד.'), eng:'פנטניל', match:/פנטניל|fentanyl/i, route:'OTFC',
    dose: function(){ return { v: 800, u:'mcg' }; }, conc: null, rule: L('800 mcg, max 2','800 מק״ג, עד 2'),
    prep: L('Between cheek and gum, rub along the cheek. Do not chew. Still in pain after 15 min: a second one in the other cheek.','בין הלחי לחניכיים, לשפשף לאורך הלחי. לא ללעוס. עדיין כאוב אחרי 15 דק׳: שנייה בלחי השנייה.'),
    every: 15, maxN: 2,
    stop: function(){ return P.deep ? L('Not in deep shock.','לא בהלם עמוק.') : kg < 40 ? L('Not under 40 kg.','לא מתחת ל-40 ק״ג.') : null; },
    why: function(){ return P.pain != null && P.pain >= 5 && !P.iv ? L('Pain ' + P.pain + ' and no IV','כאב ' + P.pain + ' ואין וריד') : null; } });
  D.push({ id:'para', g:'pain', en:L('Paracetamol','אקמול'), sub:L('Acamol. Or dipyrone (Optalgin) 1000 mg.','פרצטמול. או אופטלגין 1000 מ״ג.'), eng:'פרצטמול', match:/פרצטמול|paracetamol|אקמול|אופטלגין|dipyrone/i, route:'PO',
    dose: function(){ return { v: 1000, u:'mg' }; }, conc: null, rule: L('1000 mg every 6 h, max 4000 mg a day','1000 מ״ג כל 6 שעות, עד 4000 מ״ג ביום'),
    prep: L('Only if they can swallow: not with reduced consciousness, a penetrating torso wound, or a face or neck injury. Ask about allergy.','רק אם יכולים לבלוע: לא בהכרה ירודה, פצע חודר בגו, או פגיעת פנים או צוואר. לשאול על רגישות.'),
    every: 360, max24: 4000,
    stop: function(){ return P.child ? NOCHILD() : P.penTorso ? L('Penetrating torso wound: nothing by mouth.','פצע חודר בגו: לא דרך הפה.') : null; },
    why: function(){ return P.pain != null && P.pain >= 1 && P.pain <= 4 ? L('Mild pain (' + P.pain + ' of 10)','כאב קל (' + P.pain + ' מתוך 10)') : null; } });
  D.push({ id:'meto', g:'pain', en:L('Metoclopramide','פרמין'), sub:L('Pramin. For nausea only.','מטוקלופרמיד. לבחילה בלבד.'), eng:'פרמין', match:/פרמין|metoclopramide/i, route:'IV',
    dose: function(){ return { v: 10, u:'mg' }; }, conc: null, rule: L('10 mg slow IV','10 מ״ג לאט לווריד'), prep: L('Not routine: only if nauseous.','לא באופן שגרתי: רק בבחילה.'),
    stop: function(){ return P.child ? NOCHILD() : null; } });

  // ── INFECTION (ch. 16) ──
  D.push({ id:'cef', g:'abx', en:L('Ceftriaxone','צפטריאקסון'), sub:L('Penetrating wound, evacuation over 1 hour','פצע חודר, פינוי מעל שעה'), eng:'צפטריאקסון', match:/צפטריאקסון|ceftriaxone/i, route:'IV',
    dose: function(){ return { v: P.child ? Math.min(2000, Math.round(100 * kg / 50) * 50) : 2000, u:'mg' }; }, conc: 100,
    concNote: L('Each 1 g vial in 10 mL water for injection = 100 mg/mL','כל בקבוקון 1 גרם ב-10 מ״ל מים להזרקה = 100 מ״ג/מ״ל'),
    rule: P.child ? L('100 mg/kg, max 2 g, once a day','100 מ״ג/ק״ג, עד 2 גרם, פעם ביום') : L('2 g once a day','2 גרם פעם ביום'),
    prep: L('IV push over 2 to 4 min. Never with Hartmann.','דחיפה לווריד במשך 2 עד 4 דק׳. לעולם לא עם הרטמן.') + (P.child ? '' : L(' No IV: 1 g IM × 2, each in 3.5 mL water or lidocaine 1% (not in shock).',' אין וריד: 1 גרם לשריר × 2, כל אחד ב-3.5 מ״ל מים או לידוקאין 1% (לא בהלם).')),
    every: 1440,
    why: function(){ return P.pen ? L('Penetrating wound','פצע חודר') : null; } });
  D.push({ id:'met', g:'abx', en:L('Metronidazole','מטרונידזול'), sub:L('Add for penetrating belly or head wounds','בנוסף בפצע חודר בבטן או בראש'), eng:'מטרונידזול', match:/מטרונידזול|metronidazole/i, route:'IV',
    dose: function(){ return { v: P.child ? Math.min(500, r0(10 * kg)) : 500, u:'mg' }; }, conc: 5, concNote: L('Ready bag 500 mg / 100 mL (5 mg/mL): check the label','שקית מוכנה 500 מ״ג / 100 מ״ל (5 מ״ג/מ״ל): בדקו בתווית'),
    rule: P.child ? L('10 mg/kg, max 500 mg, every 8 h','10 מ״ג/ק״ג, עד 500 מ״ג, כל 8 שעות') : L('500 mg every 8 h','500 מ״ג כל 8 שעות'),
    prep: L('Slow drip. Repeat every 8 hours if evacuation is delayed.','בטפטוף איטי. חזרה כל 8 שעות אם הפינוי מתעכב.'),
    every: 480,
    why: function(){ return P.penHNA ? L('Penetrating head, neck or belly wound','פצע חודר בראש, צוואר או בטן') : null; } });

  // ── OTHER (ch. 4, 11, 3) ──
  D.push({ id:'mid', g:'other', en:L('Midazolam','מידזולם'), sub:L('Seizure','פרכוס'), eng:'דורמיקום', match:/דורמיקום|midazolam|מידזולם/i, route:'IV',
    dose: function(){ return { v: P.child ? r2(0.05 * kg) : 5, u:'mg' }; }, conc: 1, concNote: L('Calculated at 1 mg/mL (5 mg / 5 mL ampoule, or diluted). Check the ampoule strength.','מחושב לפי 1 מ״ג/מ״ל (אמפולה 5 מ״ג / 5 מ״ל, או מהול). בדקו את ריכוז האמפולה.'),
    rule: P.child ? L('0.05 mg/kg','0.05 מ״ג/ק״ג') : L('5 mg IV (or 10 mg IM)','5 מ״ג לווריד (או 10 מ״ג לשריר)'),
    prep: L('Still seizing after 5 min: one more dose. Can drop blood pressure: watch closely if bleeding.','עדיין מפרכס אחרי 5 דק׳: מנה נוספת. עלול להוריד לחץ דם: מעקב צמוד בפצוע מדמם.'),
    every: 5, maxN: 2 });
  var indK = P.child ? r0((P.deep ? 1.25 : 2.5) * kg) : r0((P.deep ? 1.75 : 3.5) * kg), indM = P.child ? Math.min(5, r1((P.deep ? 0.0375 : 0.075) * kg)) : (P.deep ? 2.5 : 5);
  D.push({ id:'ind', g:'other', en:L('Intubation induction','אינדוקציה לאינטובציה'), sub:L('Senior medic only, with two assistants','מטפל בכיר בלבד, עם שני מסייעים'), route:'IV', info:true,
    dose: function(){ return { v: indK, u:'mg', txt: L('Ketamine ' + indK + ' mg + midazolam ' + fmt(indM) + ' mg','קטמין ' + indK + ' מ״ג + מידזולם ' + fmt(indM) + ' מ״ג') }; }, conc: null,
    rule: (P.child ? L('Ketamine 2 to 3 mg/kg, midazolam 0.05 to 0.1 mg/kg (max 5 mg)','קטמין 2 עד 3 מ״ג/ק״ג, מידזולם 0.05 עד 0.1 מ״ג/ק״ג (עד 5 מ״ג)') : L('Ketamine 3 to 4 mg/kg, midazolam 5 mg','קטמין 3 עד 4 מ״ג/ק״ג, מידזולם 5 מ״ג')) + (P.deep ? L(' · HALVED: deep shock',' · חצי: הלם עמוק') : ''),
    prep: P.child ? L('Maintenance: the book gives no child dose. A doctor decides.','אחזקה: אין מינון לילדים בספר. רופא מחליט.') : L('Onset 1 to 2 min. Maintenance every 15 min: ketamine 25 to 50 mg + midazolam 1 to 1.5 mg. No paralytics in the field.','השפעה תוך 1 עד 2 דק׳. אחזקה כל 15 דק׳: קטמין 25 עד 50 מ״ג + מידזולם 1 עד 1.5 מ״ג. ללא משתקי שרירים בשטח.') });
  D.push({ id:'adr', g:'other', en:L('Adrenaline','אדרנלין'), sub:L('Severe reaction to a blood product','תגובה קשה למוצר דם'), eng:'אדרנלין', match:/אדרנלין|adrenaline|epinephrine/i, route:'IM',
    dose: function(){ return { v: 0.5, u:'mg' }; }, conc: 1, concNote: L('1 mg / 1 mL ampoule (1:1000)','אמפולה 1 מ״ג / 1 מ״ל (1:1000)'),
    rule: L('0.5 mg IM, repeat every 5 min','0.5 מ״ג לשריר, חזרה כל 5 דק׳'),
    prep: L('Stop the blood at once and keep the bag with the casualty. Switch to Hartmann 500 mL. Also give Solu-Medrol 125 mg IV.','לעצור את הדם מיד ולהשאיר את השקית עם הפצוע. מעבר להרטמן 500 מ״ל. בנוסף סולו-מדרול 125 מ״ג לווריד.'),
    every: 5, stop: function(){ return P.child ? NOCHILD() : null; } });
  D.push({ id:'sol', g:'other', en:L('Solu-Medrol','סולו-מדרול'), sub:L('Reaction to a blood product (hives alone: this only)','תגובה למוצר דם (פריחה בלבד: רק זה)'), eng:'סולו-מדרול', match:/סולו-מדרול|solu-?medrol|methylpred/i, route:'IV',
    dose: function(){ return { v: 125, u:'mg' }; }, conc: null, rule: L('125 mg IV','125 מ״ג לווריד'), prep: L('Stop the transfusion first.','קודם עוצרים את העירוי.'),
    stop: function(){ return P.child ? NOCHILD() : null; } });
  D.push({ id:'crush', g:'other', en:L('Crush injury','פגיעת מעיכה'), sub:L('Trapped casualty: saline before the rescue','פצוע לכוד: סליין לפני החילוץ'), route:'IV', info:true,
    dose: function(){ return { v: 0, u:'', txt: P.child ? Math.min(1000, r0(20 * kg)) + L(' mL/h saline',' מ״ל/שעה סליין') : L('Saline 1 L per hour','סליין ליטר לשעה') }; }, conc: null,
    rule: P.child ? L('20 mL/kg/h; trapped over 2 h: ' + Math.min(500, r0(10 * kg)) + ' mL/h','20 מ״ל/ק״ג/שעה; לכוד מעל שעתיים: ' + Math.min(500, r0(10 * kg)) + ' מ״ל/שעה') : L('Trapped over 2 h: 0.5 L per hour','לכוד מעל שעתיים: חצי ליטר לשעה'),
    prep: L('For 6 hours. Saline, not Hartmann.','במשך 6 שעות. סליין, לא הרטמן.') + (P.child ? '' : L(' Furosemide 40 mg IV only if no urine AND lung congestion.',' פוסיד 40 מ״ג לווריד רק אם אין שתן וגם יש גודש ריאתי.')) });
  return D;
}

// Status of one drug for this casualty: given list, totals, time to next dose, blocked reason, due reason
function status(P, d){
  var g = d.info ? [] : givenOf(P, d), last = g.length ? g[g.length - 1] : null, dz = d.dose(P);
  var s = { g:g, last:last, dose:dz, wait:0, block:null, due:null };
  if (d.stop) s.block = d.stop();
  if (!s.block && d.maxN && g.length >= d.maxN) s.block = d.maxN === 1 ? L('Already given at ' + hm(last.time) + '. One dose only.','כבר ניתן ב-' + hm(last.time) + '. מנה אחת בלבד.') : L('Maximum ' + d.maxN + ' doses reached.','הגיע למקסימום ' + d.maxN + ' מנות.');
  if (d.max24){ var tot = g.filter(function(m){ return minsSince(m.time) < 1440; }).reduce(function(a, m){ return a + amountOf(m); }, 0); s.tot24 = tot; if (!s.block && tot + dz.v > d.max24) s.block = L('Would pass the 24-hour maximum (' + d.max24 + ' mg).','יעבור את המקסימום היומי (' + d.max24 + ' מ״ג).'); }
  if (last && d.every){ var left = d.every * 60 - minsSince(last.time) * 60; if (left > 0) s.wait = left; }
  if (!s.block && d.why) s.due = d.why();
  if (s.due && s.wait > 0) s.due = null;
  if (s.due && d.fluid && g.length && minsSince(last.time) < 10) s.due = null;   // a unit just went in: re-check before the next
  return s;
}

function sizeFor(v){ return [1, 3, 5, 10, 20, 50].filter(function(z){ return z >= v - 1e-9; })[0] || 0; }
// Volume rounded to the syringe's marks: 0.01 mL in a 1 mL syringe, 0.1 mL up to 5 mL, 0.5 mL above
function volR(v){ var z = sizeFor(v); return z === 1 ? r2(v) : z && z <= 5 ? r1(v) : Math.round(v * 2) / 2; }
// A syringe drawn to the exact volume (LTR always; numbers read the same in both languages)
function syringe(vol){
  if (!(vol > 0)) return '';
  vol = volR(vol); var size = sizeFor(vol);
  if (!size) return '<p class="dz-conc">' + L('Volume ' + fmt(vol) + ' mL: use several syringes or a bag.','נפח ' + fmt(vol) + ' מ״ל: כמה מזרקים או שקית.') + '</p>';
  var x0 = 34, x1 = 266, w = x1 - x0, fx = x0 + w * Math.min(1, vol / size), ticks = '';
  var step = size <= 1 ? 0.1 : size <= 3 ? 0.5 : size <= 10 ? 1 : size <= 20 ? 2 : 5, lab = size <= 1 ? 0.5 : size <= 5 ? 1 : size <= 10 ? 2 : size <= 20 ? 5 : 10;
  for (var k = 0; k * step <= size + 1e-9; k++){
    var t = r2(k * step), tx = x0 + w * t / size, major = Math.abs(t / lab - Math.round(t / lab)) < 1e-6;
    ticks += '<line x1="' + tx.toFixed(1) + '" y1="16" x2="' + tx.toFixed(1) + '" y2="' + (major ? 34 : 26) + '" stroke="#0b0c0e" stroke-width="' + (major ? 2.2 : 1.2) + '"/>'
      + (major ? '<text x="' + tx.toFixed(1) + '" y="72" font-size="16" font-weight="800" fill="#e8eaee" text-anchor="middle">' + t + '</text>' : '');
  }
  return '<div class="dz-syr" dir="ltr" role="img" aria-label="' + esc(L('Draw ' + fmt(vol) + ' mL in a ' + size + ' mL syringe','לשאוב ' + fmt(vol) + ' מ״ל במזרק ' + size + ' מ״ל')) + '">'
    + '<svg viewBox="0 0 330 78" width="100%" aria-hidden="true">'
    + '<rect x="' + x0 + '" y="12" width="' + w + '" height="40" rx="6" fill="#e9edf2" stroke="#fff" stroke-width="2"/>'
    + '<rect x="' + x0 + '" y="12" width="' + (fx - x0).toFixed(1) + '" height="40" rx="6" fill="#6fd3ff"/>'
    + ticks
    + '<rect x="' + (fx - 4).toFixed(1) + '" y="6" width="9" height="52" rx="2" fill="#1b1d22" stroke="#fff" stroke-width="2"/>'
    + '<rect x="' + (fx + 5).toFixed(1) + '" y="28" width="' + Math.max(0, 316 - fx - 5).toFixed(1) + '" height="8" fill="#9aa0a8"/>'
    + '<rect x="314" y="10" width="12" height="44" rx="3" fill="#9aa0a8"/>'
    + '<rect x="12" y="26" width="22" height="12" rx="3" fill="#cfd3da"/><rect x="0" y="30" width="14" height="4" fill="#cfd3da"/>'
    + '</svg><div class="dz-syr-l"><b>' + L('DRAW','לשאוב') + ' <span dir="ltr">' + fmt(vol) + ' mL</span></b><span>' + L(size + ' mL syringe', 'מזרק ' + size + ' מ״ל') + '</span></div></div>';
}
function doseText(dz){ if (dz.txt) return dz.txt; return (dz.u === 'mg' && dz.v >= 1000 ? fmt(dz.v / 1000) + ' g' : fmt(dz.v) + ' ' + dz.u); }
function engDose(dz){ return dz.u === 'mg' && dz.v >= 1000 ? fmt(dz.v / 1000) + 'g' : fmt(dz.v) + dz.u; }
function routeWord(r){ return r === 'OTFC' ? L('CHEEK','לחי') : r === 'PO' ? L('BY MOUTH','דרך הפה') : r === 'IM' ? L('IM (MUSCLE)','IM (לשריר)') : r; }

var S = { tab:'now', rb:null };
try { S.tab = sessionStorage.getItem('dz-tab') || 'now'; } catch (e){}

function card(P, d, s, hero){
  var dz = s.dose, vol = d.conc && dz.u === 'mg' ? volR(dz.v / d.conc) : null, blocked = !!s.block;
  var h = '<article class="dz-c' + (blocked ? ' stop' : s.due ? ' due' : '') + (hero ? ' hero' : '') + '" data-id="' + d.id + '">';
  if (blocked) h += '<div class="dz-flag no">' + ico('octagon', 22) + '<span>' + L('NOT NOW','לא כעת') + '</span></div>';
  else if (s.wait > 0) h += '<div class="dz-flag wait" data-due="' + Math.round(Date.now() + s.wait * 1000) + '">' + ico('timer', 22) + '<span>' + L('NEXT DOSE IN ','מנה הבאה בעוד ') + '<b dir="ltr">' + mmss(s.wait) + '</b></span></div>';
  else if (s.due) h += '<div class="dz-flag due">' + ico('check', 22) + '<span>' + L('GIVE NOW','לתת עכשיו') + '</span></div>';
  h += '<div class="dz-h"><div><b>' + d.en + '</b><small>' + d.sub + '</small></div><span class="dz-route">' + esc(routeWord(d.route)) + '</span></div>';
  h += '<div class="dz-dose"><strong dir="ltr">' + esc(doseText(dz)) + '</strong>' + (vol ? '<span dir="ltr">= ' + fmt(vol) + ' mL</span>' : '') + '</div>';
  h += '<p class="dz-rule">' + d.rule + (P.child && !d.info ? ' · ' + kgW(P.wt) : '') + '</p>';
  if (s.block) h += '<p class="dz-why no">' + s.block + '</p>';
  else if (s.due) h += '<p class="dz-why">' + L('Why: ','למה: ') + s.due + '</p>';
  if (vol && !blocked) h += syringe(vol) + (d.concNote ? '<p class="dz-conc">' + d.concNote + '</p>' : '');
  if (s.g.length){
    var tot = d.fluid ? s.g.reduce(function(a, f){ return a + (Number(f.volume) || 0); }, 0) + ' mL' : null;
    h += '<p class="dz-hist">' + ico('clock', 22) + '<span>' + L('Given ' + s.g.length + '×, last at ' + hm(s.last.time), 'ניתן ' + s.g.length + ' פעמים, אחרון ב-' + hm(s.last.time)) + (tot ? L(' · total ',' · סה״כ ') + tot : '') + (d.max24 ? L(' · ' + s.tot24 + ' of ' + d.max24 + ' mg today',' · ' + s.tot24 + ' מתוך ' + d.max24 + ' מ״ג היום') : '') + '</span></p>';
  }
  h += '<details class="dz-more"><summary>' + ico('info', 22) + L('HOW TO GIVE','איך לתת') + '</summary><p>' + d.prep + '</p></details>';
  if (!d.info && !blocked) h += '<button class="xbtn ' + (s.wait > 0 ? 'dz-early' : 'xbtn-primary') + ' dz-give" onclick="Field.doseCheck(\'' + d.id + '\')">' + ico('syringe', 24) + (s.wait > 0 ? L('TOO EARLY: CHECK','מוקדם מדי: בדיקה') : L('GIVE','מתן')) + '</button>';
  return h + '</article>';
}

var TABS = [['now','GIVE NOW','לתת עכשיו','check'], ['shock','BLEEDING','דימום','droplet'], ['pain','PAIN','כאב','zap'], ['abx','INFECTION','זיהום','shield'], ['other','OTHER','אחר','list-checks']];
function painWord(p){ return p === 0 ? L('NONE','אין') : p <= 4 ? L('MILD','קל') : p <= 7 ? L('MODERATE','בינוני') : L('SEVERE','חזק'); }

function draw(){
  var el = document.getElementById('dose-sheet'); if (!el) return;
  var P = patient(), D = drugs(P), ST = D.map(function(d){ return status(P, d); }), e = X().e || {};
  var all = D.map(function(d, i){ return { d:d, s:ST[i] }; });
  var due = all.filter(function(o){ return o.s.due && !o.s.block; });
  var z = zone(P.wt);
  var h = '<div class="dz-top"><b>' + ico('pill', 26) + '<span class="dz-long">' + L('DOSE CALCULATOR','מחשבון מינונים') + '</span><span class="dz-short">' + L('DOSES','מינונים') + '</span></b><button class="xbtn" onclick="Field.doseClose()">' + ico('x', 24) + L('CLOSE','סגור') + '</button></div>';
  // patient: weight stepper, age
  h += '<section class="dz-pt">'
    + '<div class="dz-wt"><span class="dz-lbl">' + L('WEIGHT','משקל') + '</span><div class="dz-step" dir="ltr"><button aria-label="' + L('Less weight','פחות משקל') + '" onclick="Field.doseWt(-1)">' + ico('minus', 28) + '</button>'
    + '<label><input type="number" inputmode="decimal" min="1" max="250" step="any" value="' + (e.weightKg && !e.weightEst ? e.weightKg : '') + '" placeholder="' + fmt(P.wt) + '" onchange="Field.doseSet(\'wt\',this.value)" aria-label="' + L('Weight in kg','משקל בק״ג') + '"><u>kg</u></label>'
    + '<button aria-label="' + L('More weight','יותר משקל') + '" onclick="Field.doseWt(1)">' + ico('plus', 28) + '</button></div></div>'
    + '<div class="dz-age"><span class="dz-lbl">' + L('AGE','גיל') + '</span><label class="dz-agein"><input type="number" inputmode="decimal" min="0" max="120" step="any" value="' + (e.ageYears != null ? e.ageYears : '') + '" placeholder="—" onchange="Field.doseSet(\'age\',this.value)" aria-label="' + L('Age in years','גיל בשנים') + '"><u>' + L('y','שנים') + '</u></label></div>'
    + '</section>';
  h += '<div class="dz-who"><b class="dz-kind">' + (P.child ? L('CHILD','ילד') : L('ADULT','מבוגר')) + '</b><span class="dz-kg">' + kgW(P.wt) + '</span>'
    + (z && P.child ? '<span class="dz-zone"><i style="background:' + z[4] + '"></i>' + L('BROSELOW ' + z[2], 'ברוסלו ' + z[3]) + '</span>' : '')
    + (P.deep ? '<b class="dz-shock">' + L('DEEP SHOCK','הלם עמוק') + '</b>' : (P.profound || P.shock) ? '<b class="dz-shock">' + L('SIGNS OF SHOCK','סימני הלם') + '</b>' : '')
    + (P.est ? '<em>' + (P.ageless ? L('Assumed adult weight: enter the weight.','משקל מבוגר משוער: הזינו משקל.') : L('Weight estimated from age: confirm with a length tape.','משקל משוער לפי גיל: אמתו בסרט ברוסלו.')) + '</em>' : '') + '</div>';
  // pain score
  h += '<section class="dz-pain"><span class="dz-lbl">' + L('PAIN NOW, 0 TO 10','כאב עכשיו, 0 עד 10') + (P.pain != null ? ': <b>' + P.pain + ' ' + painWord(P.pain) + '</b>' : '') + '</span><div class="dz-pain-g" dir="ltr">';
  for (var i = 0; i <= 10; i++) h += '<button class="' + (P.pain === i ? 'on ' : '') + 'p' + (i === 0 ? 0 : i <= 4 ? 1 : i <= 7 ? 2 : 3) + '" aria-pressed="' + (P.pain === i) + '" aria-label="' + L('Pain ','כאב ') + i + '" onclick="Field.dosePain(' + i + ')">' + i + '</button>';
  h += '</div></section>';
  h += '<p class="dz-warn">' + ico('triangle-alert', 22) + '<span>' + L('From the IDF Trauma and Operational Medicine Book. Calculated by software: check every dose. A medical professional decides.','מספר הטראומה והרפואה המבצעית של צה״ל. מחושב על ידי תוכנה: בדקו כל מנה. איש צוות רפואי מחליט.') + '</span></p>';
  // tabs
  h += '<nav class="dz-tabs" role="tablist">' + TABS.map(function(t){ return '<button role="tab" aria-selected="' + (S.tab === t[0]) + '" class="' + (S.tab === t[0] ? 'on' : '') + (t[0] === 'now' ? ' now' : '') + '" onclick="Field.doseTab(\'' + t[0] + '\')">' + ico(t[3], 22) + '<span>' + L(t[1], t[2]) + '</span>' + (t[0] === 'now' ? '<i>' + due.length + '</i>' : '') + '</button>'; }).join('') + '</nav>';
  if (S.tab === 'now'){
    if (!due.length) h += '<div class="dz-empty">' + ico('check-check', 30) + '<b>' + L('Nothing is due right now.','אין מנה שמגיעה עכשיו.') + '</b><span>' + (P.pain == null ? L('Set the pain score above. Doses appear here as wounds, shock and pain are recorded. Every drug is in the tabs.','קבעו ציון כאב למעלה. מנות יופיעו כאן לפי פציעות, הלם וכאב שנרשמו. כל התרופות בלשוניות.') : L('Doses appear here as wounds, shock and pain are recorded. Every drug is in the tabs.','מנות יופיעו כאן לפי פציעות, הלם וכאב שנרשמו. כל התרופות בלשוניות.')) + '</span></div>';
    else due.forEach(function(o, k){ h += card(P, o.d, o.s, k === 0); });
    var waiting = all.filter(function(o){ return o.s.wait > 0 && !o.s.block; });
    if (waiting.length) h += '<h3 class="dz-sub">' + ico('timer', 24) + L('REPEAT TIMERS','טיימרים לחזרה') + '</h3>' + waiting.map(function(o){ return '<div class="dz-timer"><b>' + o.d.en + '</b><span>' + L('next dose in ','מנה הבאה בעוד ') + '<i dir="ltr" data-due="' + Math.round(Date.now() + o.s.wait * 1000) + '">' + mmss(o.s.wait) + '</i></span></div>'; }).join('');
  } else {
    all.forEach(function(o){ if (o.d.g === S.tab) h += card(P, o.d, o.s, false); });
  }
  var top = el.scrollTop;
  el.querySelector('.dz').innerHTML = h;
  el.scrollTop = top;
  if (S.rb) readback(S.rb);
}

// ── Read-back: say it out loud before it is recorded ──
function readback(id){
  var P = patient(), d = drugs(P).filter(function(x){ return x.id === id; })[0]; if (!d){ S.rb = null; return; }
  var s = status(P, d), dz = s.dose, vol = d.conc && dz.u === 'mg' ? dz.v / d.conc : null;
  var old = document.getElementById('dz-rb'); if (old) old.remove();
  var warn = [];
  if (s.wait > 0) warn.push(L('Last dose ' + Math.round(minsSince(s.last.time)) + ' min ago. The next dose is due in ' + mmss(s.wait) + '.','מנה אחרונה לפני ' + Math.round(minsSince(s.last.time)) + ' דק׳. המנה הבאה בעוד ' + mmss(s.wait) + '.'));
  if (P.est) warn.push(L('Weight is estimated (' + kgW(P.wt) + '). Confirm it before a weight-based dose.','המשקל משוער (' + kgW(P.wt) + '). אמתו לפני מנה לפי משקל.'));
  if (/^(mor|mid|fen)$/.test(id) && P.meds.some(function(m){ return /מורפין|פנטניל|דורמיקום|morphine|fentanyl|midazolam/i.test(m.drug || '') && minsSince(m.time) < 30 && !d.match.test(m.drug || ''); })) warn.push(L('Another drug that slows breathing was given in the last 30 min: watch breathing.','תרופה נוספת שמאטה נשימה ניתנה ב-30 הדק׳ האחרונות: מעקב נשימה.'));
  if (id === 'txa' && P.fluids.some(function(f){ return /דם|blood|FDP|פלסמה/i.test(f.type || '') && minsSince(f.time) < 15; })) warn.push(L('Blood is running: use another line, or flush 10 mL saline first.','דם בעירוי: קו אחר, או שטיפה ב-10 מ״ל סליין קודם.'));
  var el = document.createElement('div'); el.id = 'dz-rb'; el.className = 'dz-rb-wrap';
  el.innerHTML = '<div class="dz-rb" role="dialog" aria-modal="true" aria-label="' + L('Read back before giving','הקראה לפני מתן') + '">'
    + '<p class="dz-rb-k">' + ico('volume-2', 24) + L('READ IT BACK OUT LOUD','הקריאו בקול') + '</p>'
    + '<h3>' + d.en + '</h3>'
    + '<div class="dz-rb-d"><strong dir="ltr">' + esc(doseText(dz)) + '</strong><span>' + esc(routeWord(d.route)) + '</span></div>'
    + (vol ? syringe(vol) + (d.concNote ? '<p class="dz-conc">' + d.concNote + '</p>' : '') : '')
    + '<p class="dz-rb-p">' + (P.child ? L('CHILD','ילד') : L('ADULT','מבוגר')) + ' · ' + kgW(P.wt) + (P.est ? L(' (estimated)',' (משוער)') : '') + ' · ' + d.rule + '</p>'
    + warn.map(function(w){ return '<p class="dz-rb-w">' + ico('triangle-alert', 22) + '<span>' + w + '</span></p>'; }).join('')
    + '<div class="dz-rb-b"><button class="xbtn' + (s.wait > 0 ? ' xbtn-primary' : '') + '" onclick="Field.doseRbClose()">' + ico('x', 24) + L('CANCEL','ביטול') + '</button>'
    + '<button class="xbtn ' + (s.wait > 0 ? 'dz-early' : 'xbtn-primary') + '" onclick="Field.doseGive(\'' + id + '\')">' + ico('check', 24) + (s.wait > 0 ? L('GIVE ANYWAY','לתת בכל זאת') : L('GIVEN: RECORD','ניתן: תיעוד')) + '</button></div>'
    + '</div>';
  document.getElementById('dose-sheet').appendChild(el);
}
Field.doseCheck = function(id){ S.rb = id; readback(id); };
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
  el.innerHTML = '<span>' + esc(msg) + '</span><button>' + L('UNDO','בטל') + '</button>';
  el.querySelector('button').onclick = function(){ el.remove(); if (W.medUndo) W.medUndo(); setTimeout(draw, 50); };
  (document.getElementById('app') || document.body).appendChild(el);
  setTimeout(function(){ el.remove(); }, 8000);
  if (navigator.vibrate) navigator.vibrate(25);
}

Field.doseOpen = function(tab){
  Field.doseClose();
  if (tab) S.tab = tab;
  var el = document.createElement('div'); el.id = 'dose-sheet'; el.className = 'dz-wrap no-polish'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', L('Dose calculator','מחשבון מינונים'));
  el.innerHTML = '<div class="dz"></div>';
  (document.getElementById('app') || document.body).appendChild(el); draw();
};
Field.doseClose = function(){ S.rb = null; var s = document.getElementById('dose-sheet'); if (s) s.remove(); };
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
Field.dosePain = function(i){
  if (W.pushMedHistory) W.pushMedHistory();
  if (W._setPainScore) W._setPainScore(i);
  setTimeout(draw, 30);
};
// live countdowns without rebuilding the sheet; full refresh every 15 s for time windows
setInterval(function(){
  var s = document.getElementById('dose-sheet'); if (!s) return;
  var done = false;
  s.querySelectorAll('[data-due]').forEach(function(n){ var left = (Number(n.getAttribute('data-due')) - Date.now()) / 1000; var t = n.tagName === 'I' ? n : n.querySelector('b'); if (t) t.textContent = mmss(left); if (left <= 0) done = true; });
  if (done && !S.rb && !s.contains(document.activeElement)) draw();
}, 1000);
setInterval(function(){ var s = document.getElementById('dose-sheet'); if (s && !S.rb && !s.contains(document.activeElement)) draw(); }, 15000);

// Entry button in Form 101: says how many doses are due now
Field.doseHtml = function(){
  if (W._casualtyTriageColor === 'black') return '';
  var n = 0; try { var P = patient(); n = drugs(P).filter(function(d){ var s = status(P, d); return s.due && !s.block; }).length; } catch (e){}
  return '<button class="f-dose' + (n ? ' has' : '') + '" onclick="Field.doseOpen(\'now\')">' + ico('pill', 30) + '<span><b>' + L('DOSE CALCULATOR','מחשבון מינונים') + '</b><small>' + (n ? L(n + (n === 1 ? ' dose is' : ' doses are') + ' due now for this casualty', n === 1 ? 'מנה אחת מגיעה עכשיו לנפגע הזה' : n + ' מנות מגיעות עכשיו לנפגע הזה') : L('Exact doses for this casualty, from the book','מינונים מדויקים לנפגע הזה, מהספר')) + '</small></span>' + (n ? '<i>' + n + '</i>' : '') + '</button>';
};
})();
