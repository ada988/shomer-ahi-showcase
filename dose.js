/* DOSE CALCULATOR — doses from the IDF Trauma and Operational Medicine Book (2026 edition, chapters 3, 4, 9, 11, 14, 15, 16, 18).
   Uses this casualty's weight and age (or a weight estimated from age), the shock state and the time since injury.
   Shows the dose, the volume to draw, route, repeat and maximum, and the book's warnings. Software output: a medical professional decides. */
(function(){
'use strict';
var W = window, Field = W.Field;
function lang(){ return (W.ShowcaseI18n && W.ShowcaseI18n.lang) || 'en'; }
function L(en, he){ return lang() === 'he' ? he : en; }
function ico(n, s){ return W.Icon ? W.Icon(n, s) : ''; }
function X(){ return W._casualtyXABCDE || {}; }
function r1(v){ return Math.round(v * 10) / 10; }
function r0(v){ return Math.round(v); }
function fmt(v){ return (Math.round(v * 100) / 100).toString(); }

// Broselow-style estimate when no weight is entered (book, chapter 18, appendix B)
function estWeight(age){
  if (age == null) return null;
  if (W._broselowWeight) return W._broselowWeight(age);
  if (age < 0.5) return 3.5; if (age < 1) return 7; if (age < 4) return 11; if (age < 8) return 17; if (age < 11) return 27; if (age < 14) return 40; return 70;
}
function patient(){
  var e = X().e || {}, age = e.ageYears != null ? Number(e.ageYears) : null, wt = Number(e.weightKg) || null, est = false;
  if (!wt){ wt = estWeight(age); est = wt != null; }
  if (!wt){ wt = 70; est = true; }
  var ctx = W.buildCasualtyContext ? W.buildCasualtyContext() : {};
  var tl = W._casualtyVitals || [], lastOf = function(k){ for (var i = tl.length - 1; i >= 0; i--){ if (tl[i] && tl[i][k] != null && tl[i][k] !== '') return Number(tl[i][k]); } return null; };
  var sys = lastOf('bpSys'), hr = lastOf('pulse');
  var inj = Field && Field.injuryInfo ? Field.injuryInfo() : null;
  var meds = (e.medications || []);
  var gave = function(re){ return meds.filter(function(m){ return re.test(String(m.drug || m.name || '')); }); };
  return { age:age, child: (W.isPedsMode && W.isPedsMode()) || (age != null && age < 12), wt:wt, est:est, ageless: age == null && !e.weightKg,
    deep: !!ctx.deepShock, shock: !!ctx.anyShock || !!ctx.shock || !!ctx.deepShock, profound: (sys != null && sys < 90) || (hr != null && hr > 130) || !!ctx.deepShock || !!ctx.profoundShock,
    inj: inj, txa: gave(/^TXA/i), ket: gave(/קטמין|ketamine/i), mor: gave(/מורפין|morphine/i), cef: gave(/צפטריאקסון|ceftriaxone/i) };
}

// Each card: [title, dose line, how-to line, repeat / max line, warnings[], give key]
function cards(P){
  var C = [], kg = P.wt, kgTxt = fmt(kg) + L(' kg',' ק״ג');
  var add = function(group, d){ d.group = group; C.push(d); };

  // ── BLEEDING AND SHOCK (ch. 3 RDCR) ──
  var txaMg = P.child ? Math.min(1000, r0(15 * kg)) : 1000;
  var txaWarn = [];
  if (P.inj && P.inj.left <= 0) txaWarn.push(L('Do NOT give: more than 3 hours since injury.','אין לתת: חלפו יותר מ-3 שעות מהפציעה.'));
  else if (P.inj) txaWarn.push(L(P.inj.left + ' min left of the 3-hour window.','נותרו ' + P.inj.left + ' דק׳ מחלון 3 השעות.'));
  else txaWarn.push(L('Only within 3 hours of injury. Set the time of injury.','רק תוך 3 שעות מהפציעה. קבעו שעת פציעה.'));
  if (P.txa.length) txaWarn.push(L('Already given at ' + hm(P.txa[0].time) + '.','כבר ניתן ב-' + hm(P.txa[0].time) + '.'));
  txaWarn.push(L('Not in the same line with blood: flush 10 mL saline between them.','לא באותו עירוי עם דם: שטיפה ב-10 מ״ל סליין ביניהם.'));
  add('shock', { t:'TXA (Hexakapron)', d: txaMg + ' mg IV', how: P.child ? L('15 mg/kg × ' + kgTxt + ' (max 1 g). 500 mg ampoule: ' + fmt(txaMg / 500) + ' ampoule.','15 מ״ג/ק״ג × ' + kgTxt + ' (עד 1 גרם). אמפולה 500 מ״ג: ' + fmt(txaMg / 500) + ' אמפולה.') : L('2 ampoules of 500 mg. Slow IV push.','2 אמפולות של 500 מ״ג. דחיפה איטית לווריד.'),
    rep: L('Penetrating torso or junction wound, or deep shock. Once.','פצע חודר בגו או באזור מעבר, או הלם עמוק. פעם אחת.'), warn: txaWarn, give:'txa', stop: (P.inj && P.inj.left <= 0) || P.txa.length > 0 });
  var bloodMl = P.child ? Math.min(500, r0(20 * kg)) : null;
  add('shock', { t:L('Whole blood / plasma (FDP)','דם מלא / פלסמה (FDP)'), d: bloodMl ? bloodMl + ' mL' : L('1 unit','מנה אחת'), how: bloodMl ? L('20 mL/kg × ' + kgTxt + '. Give with a syringe and 3-way tap.','20 מ״ל/ק״ג × ' + kgTxt + '. מתן במזרק וברז תלת-כיווני.') : L('Whole blood first; plasma (200 mL) if no blood. 1:1 with PRBC if both are used.','קודם דם מלא; פלסמה (200 מ״ל) אם אין דם. 1:1 עם כדוריות אם שתיהן בשימוש.'),
    rep: L('Only in deep shock. After EACH unit stop and re-check BP; another unit only if still in deep shock. Target systolic 90.','רק בהלם עמוק. אחרי כל מנה עוצרים ומודדים ל״ד; מנה נוספת רק אם עדיין בהלם עמוק. יעד סיסטולי 90.'),
    warn: P.deep ? [L('Deep shock now: give blood.','הלם עמוק עכשיו: תנו דם.')] : [L('No deep shock recorded: volume is not indicated.','לא נרשם הלם עמוק: אין התוויה לנפח.')], give:'blood', stop: !P.deep });
  add('shock', { t:L('Hartmann (Ringer lactate)','הרטמן'), d: P.child ? Math.min(500, r0(20 * kg)) + ' mL' : '500 mL', how: L('Only if blood or plasma is more than 15 minutes away.','רק אם דם או פלסמה רחוקים יותר מ-15 דקות.'),
    rep: L('Re-check after each bolus.','בדיקה חוזרת אחרי כל בולוס.'), warn: [L('Never as a "keep vein open" drip.','לא כעירוי "לשמירת וריד".')], stop: !P.deep });

  // ── PAIN (ch. 15) ──
  var ketMg = P.child ? r1(0.3 * kg) : 25;
  add('pain', { t:L('Ketamine (pain)','קטמין (כאב)'), d: fmt(ketMg) + ' mg IV', how: L('500 mg / 10 mL ampoule (50 mg/mL): draw ' + fmt(ketMg / 50) + ' mL into a 3 mL syringe, flush 10 mL saline. Do not dilute.','אמפולה 500 מ״ג / 10 מ״ל (50 מ״ג/מ״ל): שואבים ' + fmt(ketMg / 50) + ' מ״ל במזרק 3 מ״ל, שוטפים 10 מ״ל סליין. לא למהול.'),
    rep: L('First IV pain drug, single dose. No relief after 5 min: morphine. Long evacuation: repeat every 45 min.','תרופת הכאב הראשונה לווריד, מנה אחת. אין הקלה אחרי 5 דק׳: מורפין. פינוי ממושך: חזרה כל 45 דק׳.') + (P.child ? L(' Child: 0.3 mg/kg.',' ילד: 0.3 מ״ג/ק״ג.') : ''),
    warn: (P.ket.length ? [L('Already given at ' + hm(P.ket[P.ket.length - 1].time) + '.','כבר ניתן ב-' + hm(P.ket[P.ket.length - 1].time) + '.')] : []).concat([L('Pain 5 or more out of 10. Watch breathing and consciousness.','כאב 5 ומעלה מתוך 10. מעקב נשימה והכרה.')]), give:'ket' });
  var morMg = P.child ? (P.profound ? r1(0.02 * kg) : r1(0.05 * kg)) : (P.profound ? 2 : 5);
  add('pain', { t:L('Morphine IV','מורפין לווריד'), d: fmt(morMg) + ' mg IV', how: L('10 mg / 1 mL ampoule + 9 mL saline = 1 mg/mL: give ' + fmt(morMg) + ' mL. Flush 20 mL.','אמפולה 10 מ״ג / 1 מ״ל + 9 מ״ל סליין = 1 מ״ג/מ״ל: נותנים ' + fmt(morMg) + ' מ״ל. שטיפה 20 מ״ל.'),
    rep: L('Repeat every 15 min while pain stays 5 or more.','חזרה כל 15 דק׳ כל עוד הכאב 5 ומעלה.') + (P.child ? L(' Child: 0.05 mg/kg (0.02 in shock). No IV: 0.1 mg/kg IM once.',' ילד: 0.05 מ״ג/ק״ג (0.02 בהלם). אין וריד: 0.1 מ״ג/ק״ג לשריר פעם אחת.') : ''),
    warn: P.profound ? [L('Shock (SBP under 90 or HR over 130): reduced dose.','הלם (סיסטולי מתחת 90 או דופק מעל 130): מינון מופחת.')] : [] });
  add('pain', { t:L('Fentanyl lozenge (Actiq)','סוכריית פנטניל (אקטיק)'), d: '800 mcg', how: L('Between cheek and gum, rub along the cheek. Do not chew. Remove after 15 min.','בין הלחי לחניכיים, לשפשף לאורך הלחי. לא ללעוס. להוציא אחרי 15 דק׳.'),
    rep: L('No IV access. Still in pain after 15 min: a second lozenge in the other cheek. Max 2.','אין גישה ורידית. עדיין כאוב אחרי 15 דק׳: סוכרייה שנייה בלחי השנייה. עד 2.'),
    warn: [L('Not in deep shock.','לא בהלם עמוק.')].concat(kg < 40 ? [L('Not for children under 40 kg.','לא לילדים מתחת ל-40 ק״ג.')] : []), stop: P.deep || kg < 40 });
  add('pain', { t:L('Paracetamol (Acamol) or dipyrone (Optalgin)','אקמול או אופטלגין'), d: '1000 mg PO', how: L('Pain 4 or less, or with any other pain drug, if they can swallow.','כאב 4 ומטה, או בנוסף לכל תרופת כאב, אם יכולים לבלוע.'),
    rep: L('Every 6 hours. Max 4000 mg in 24 hours.','כל 6 שעות. עד 4000 מ״ג ב-24 שעות.'), warn: [L('Not by mouth: reduced consciousness, penetrating torso wound, face or neck injury that limits swallowing. Ask about allergy (dipyrone).','לא דרך הפה: הכרה ירודה, פצע חודר בגו, פגיעת פנים או צוואר שמגבילה בליעה. לשאול על רגישות (אופטלגין).')] });
  add('pain', { t:L('Metoclopramide (Pramin), nausea','פרמין, בחילה'), d: '10 mg IV', how: L('Dilute to 10 mL, give over 5 minutes.','למהול ל-10 מ״ל, לתת במשך 5 דקות.'), rep: L('Only if nausea; not routine.','רק בבחילה; לא באופן שגרתי.'), warn: [] });

  // ── INFECTION (ch. 16) ──
  var cefMg = P.child ? Math.min(2000, Math.round(100 * kg / 50) * 50) : 2000;
  add('abx', { t:L('Ceftriaxone','צפטריאקסון'), d: (cefMg >= 1000 ? fmt(cefMg / 1000) + ' g' : cefMg + ' mg') + ' IV', how: L('1 g vials: each in 10 mL water for injection, IV push over 2 to 4 min. IM: 1 g in 3.5 mL lidocaine 1% per site (not in shock).','בקבוקונים של 1 גרם: כל אחד ב-10 מ״ל מים להזרקה, דחיפה לווריד במשך 2 עד 4 דק׳. לשריר: 1 גרם ב-3.5 מ״ל לידוקאין 1% בכל אתר (לא בהלם).'),
    rep: L('Penetrating wound and evacuation over 1 hour. Once every 24 h.','פצע חודר ופינוי מעל שעה. פעם ב-24 שעות.') + (P.child ? L(' Child: 100 mg/kg (max 2 g).',' ילד: 100 מ״ג/ק״ג (עד 2 גרם).') : ''),
    warn: [L('Never mix with Hartmann (Ringer lactate).','לעולם לא למהול עם הרטמן.')].concat(P.cef.length ? [L('Already given at ' + hm(P.cef[0].time) + '.','כבר ניתן ב-' + hm(P.cef[0].time) + '.')] : []), give:'cef' });
  var metMg = P.child ? Math.min(500, r0(10 * kg)) : 500;
  add('abx', { t:L('Metronidazole','מטרונידזול'), d: metMg + ' mg IV', how: L('Ready-to-use vial.','בקבוקון מוכן להזרקה.'), rep: L('Add for penetrating belly or head wounds. Every 8 hours if evacuation is delayed.','מוסיפים בפצע חודר בבטן או בראש. כל 8 שעות אם הפינוי מתעכב.') + (P.child ? L(' Child: 10 mg/kg (max 500 mg).',' ילד: 10 מ״ג/ק״ג (עד 500 מ״ג).') : ''), warn: [] });

  // ── OTHER (ch. 11, 4, 3) ──
  var midSz = P.child ? r1(0.05 * kg) : 5;
  add('other', { t:L('Midazolam, seizure','מידזולם, פרכוס'), d: P.child ? fmt(midSz) + ' mg IV' : L('5 mg IV or 10 mg IM','5 מ״ג לווריד או 10 מ״ג לשריר'), how: L('5 mg/mL ampoule: ' + fmt(midSz / 5) + ' mL IV.','אמפולה 5 מ״ג/מ״ל: ' + fmt(midSz / 5) + ' מ״ל לווריד.'),
    rep: L('Still seizing after 5 min: one more dose.','עדיין מפרכס אחרי 5 דק׳: מנה נוספת.'), warn: [L('Can drop blood pressure: watch closely in bleeding casualties.','עלול להוריד לחץ דם: מעקב צמוד בפצוע מדמם.')] });
  var indK = P.child ? r0(2.5 * kg) : r0((P.deep ? 1.75 : 3.5) * kg), indM = P.child ? Math.min(5, r1(0.075 * kg)) : (P.deep ? 2.5 : 5);
  add('other', { t:L('Intubation induction (senior medic only)','אינדוקציה לאינטובציה (מטפל בכיר בלבד)'), d: L('Ketamine ' + indK + ' mg + midazolam ' + fmt(indM) + ' mg IV','קטמין ' + indK + ' מ״ג + מידזולם ' + fmt(indM) + ' מ״ג לווריד'),
    how: P.child ? L('Ketamine 2 to 3 mg/kg, midazolam 0.05 to 0.1 mg/kg (max 5 mg). Halve in deep shock.','קטמין 2 עד 3 מ״ג/ק״ג, מידזולם 0.05 עד 0.1 מ״ג/ק״ג (עד 5 מ״ג). חצי בהלם עמוק.') : L('Ketamine 3 to 4 mg/kg (shown: ' + (P.deep ? '1.75, halved for deep shock' : '3.5') + ' mg/kg), midazolam 5 mg. Onset 1 to 2 min.','קטמין 3 עד 4 מ״ג/ק״ג (מוצג: ' + (P.deep ? '1.75, חצי בהלם עמוק' : '3.5') + ' מ״ג/ק״ג), מידזולם 5 מ״ג. השפעה תוך 1 עד 2 דק׳.'),
    rep: L('Maintenance every 15 min: ketamine 25 to 50 mg + midazolam 1 to 1.5 mg. Not effective after 5 min: 75 to 100 mg ketamine more.','אחזקה כל 15 דק׳: קטמין 25 עד 50 מ״ג + מידזולם 1 עד 1.5 מ״ג. לא מספיק אחרי 5 דק׳: עוד 75 עד 100 מ״ג קטמין.'),
    warn: [L('Only on a clear indication, with two assistants. No paralytics in the field.','רק בהתוויה ברורה, עם שני מסייעים. ללא משתקי שרירים בשטח.')] });
  add('other', { t:L('Atropine, heavy secretions after ketamine','אטרופין, הפרשות מרובות אחרי קטמין'), d: P.child ? r0(20 * kg) + ' mcg IV' : '0.5 mg IV', how: L('Suction first.','קודם שאיבה.'), rep: '', warn: [] });
  add('other', { t:L('Blood product reaction','תגובה למוצר דם'), d: L('Adrenaline 0.5 mg IM + Solu-Medrol 125 mg IV','אדרנלין 0.5 מ״ג לשריר + סולו-מדרול 125 מ״ג לווריד'), how: L('Stop the blood at once, keep the bag with the casualty, switch to Hartmann 500 mL.','לעצור את הדם מיד, הצמידו את השקית לפצוע, מעבר להרטמן 500 מ״ל.'), rep: L('Adrenaline can be repeated every 5 min.','אדרנלין ניתן לחזור כל 5 דק׳.'), warn: [L('Hives only (no breathing or BP change): Solu-Medrol 125 mg IV alone.','פריחה בלבד (ללא שינוי בנשימה או בל״ד): סולו-מדרול 125 מ״ג לבד.')] });
  add('other', { t:L('Crush injury (trapped over 45 min)','פגיעת מעיכה (לכוד מעל 45 דק׳)'), d: P.child ? Math.min(1000, r0(20 * kg)) + ' mL/h ' + L('saline','סליין') : L('Saline 1 L per hour','סליין ליטר לשעה'), how: L('Start before the rescue if possible. Trapped over 2 h: 0.5 L per hour. For 6 hours.','להתחיל לפני החילוץ אם אפשר. לכוד מעל שעתיים: חצי ליטר לשעה. במשך 6 שעות.'), rep: L('Furosemide 40 mg IV only if no urine AND lung congestion.','פוסיד 40 מ״ג לווריד רק אם אין שתן וגם יש גודש ריאתי.'), warn: [L('Not Hartmann (contains potassium).','לא הרטמן (מכיל אשלגן).')] });
  return C;
}
function hm(t){ var d = new Date(t); return isNaN(d) ? '--:--' : String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }
var GROUPS = [['shock','BLEEDING AND SHOCK','דימום והלם','xc-x'], ['pain','PAIN','כאב','xc-e'], ['abx','INFECTION','זיהום','xc-r'], ['other','AIRWAY, SEIZURE, REACTIONS, CRUSH','נתיב אוויר, פרכוס, תגובות, מעיכה','xc-a']];

function draw(){
  var el = document.getElementById('dose-sheet'); if (!el) return;
  var P = patient(), C = cards(P), e = X().e || {};
  var h = '<div class="dz-top"><b>' + L('DOSE CALCULATOR','מחשבון מינונים') + '</b><button class="xbtn" onclick="Field.doseClose()">' + ico('x', 24) + L('CLOSE','סגור') + '</button></div>'
    + '<p class="dz-warn">' + L('Doses from the IDF Trauma and Operational Medicine Book. Calculated by software: check every dose before giving. A medical professional decides.','מינונים מספר הטראומה והרפואה המבצעית של צה״ל. מחושב על ידי תוכנה: בדקו כל מנה לפני מתן. איש צוות רפואי מחליט.') + '</p>'
    + '<div class="dz-pt"><label><span>' + L('WEIGHT (KG)','משקל (ק״ג)') + '</span><input type="number" inputmode="decimal" min="1" max="250" value="' + (e.weightKg || '') + '" placeholder="' + (P.est ? fmt(P.wt) : '') + '" onchange="Field.doseSet(\'wt\',this.value)"></label>'
    + '<label><span>' + L('AGE (YEARS)','גיל (שנים)') + '</span><input type="number" inputmode="numeric" min="0" max="120" value="' + (e.ageYears != null ? e.ageYears : '') + '" placeholder="—" onchange="Field.doseSet(\'age\',this.value)"></label></div>'
    + '<p class="dz-who">' + (P.child ? L('CHILD · ','ילד · ') : L('ADULT · ','מבוגר · ')) + fmt(P.wt) + L(' kg',' ק״ג') + (P.est ? L(P.ageless ? ' (assumed adult weight: enter the weight)' : ' (estimated from age)', P.ageless ? ' (משקל מבוגר משוער: הזינו משקל)' : ' (הערכה לפי גיל)') : '')
    + (P.deep ? ' · <b class="dz-shock">' + L('DEEP SHOCK','הלם עמוק') + '</b>' : P.shock ? ' · <b class="dz-shock">' + L('SIGNS OF SHOCK','סימני הלם') + '</b>' : '') + '</p>';
  GROUPS.forEach(function(g){
    h += '<h3 class="dz-g ' + g[3] + '">' + L(g[1], g[2]) + '</h3>';
    C.filter(function(c){ return c.group === g[0]; }).forEach(function(c){
      h += '<div class="dz-c' + (c.stop ? ' stop' : '') + '"><div class="dz-h"><b>' + c.t + '</b><strong dir="ltr">' + c.d + '</strong></div>'
        + (c.how ? '<p>' + c.how + '</p>' : '') + (c.rep ? '<p class="dz-rep">' + c.rep + '</p>' : '')
        + (c.warn && c.warn.length ? '<ul>' + c.warn.map(function(w){ return '<li>' + w + '</li>'; }).join('') + '</ul>' : '')
        + (c.give && !c.stop ? '<button class="xbtn xbtn-primary dz-give" onclick="Field.doseClose();Field.give(\'' + c.give + '\')">' + ico('syringe', 24) + L('GIVE AND RECORD','מתן ותיעוד') + '</button>' : '')
        + '</div>';
    });
  });
  el.querySelector('.dz').innerHTML = h;
}
Field.doseOpen = function(){
  Field.doseClose();
  var el = document.createElement('div'); el.id = 'dose-sheet'; el.className = 'dz-wrap no-polish'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', L('Dose calculator','מחשבון מינונים'));
  el.innerHTML = '<div class="dz"></div>';
  (document.getElementById('app') || document.body).appendChild(el); draw();
};
setInterval(function(){ var s = document.getElementById('dose-sheet'); if (s && !s.contains(document.activeElement)) draw(); }, 15000);
Field.doseClose = function(){ var s = document.getElementById('dose-sheet'); if (s) s.remove(); };
Field.doseSet = function(k, v){
  if (k === 'wt'){ Field.patIn('wt', v); Field.patDone('wt', v); } else { Field.patIn('age', v); Field.patDone('age', v); }
  setTimeout(draw, 30);
};
Field.doseHtml = function(){
  if (W._casualtyTriageColor === 'black') return '';
  return '<button class="f-dose" onclick="Field.doseOpen()">' + ico('pill', 30) + '<span><b>' + L('DOSES','מינונים') + '</b><small>' + L('Exact doses for this casualty, from the book','מינונים מדויקים לנפגע הזה, מהספר') + '</small></span></button>';
};
})();
