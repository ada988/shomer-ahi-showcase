/* ADAPTIVE HELPERS for the field panel (loaded after field.js):
   1) WHAT TO DO NEXT — computed from this casualty's state; the first row is the most urgent thing to do now.
   2) TAP TO MEASURE — heart rate and breathing by tapping with each beat/breath; the window adapts to how fast
      you tap and the estimate shows how steady the rhythm is. */
(function(){
'use strict';
var W = window, Field = W.Field;
function lang(){ return (W.ShowcaseI18n && W.ShowcaseI18n.lang) || 'en'; }
function L(en, he){ return lang() === 'he' ? he : en; }
function ico(n, s){ return W.Icon ? W.Icon(n, s) : ''; }
function app(){ return document.getElementById('app'); }

// ── 1) NEXT STEPS ──────────────────────────────────────────────
var DUE = { red:5, yellow:10, green:15, gray:15, black:0 };   // minutes between vitals, by triage group
function items(){
  var out = [], X = W._casualtyXABCDE || {}, x = X.x || {}, a = X.a || {}, b = X.b || {}, c = X.c || {}, e = X.e || {};
  var ctx = W.buildCasualtyContext ? W.buildCasualtyContext() : {}, inj = W._casualtyInjuries || [], vit = W._casualtyVitals || [];
  var lv = vit.length ? vit[vit.length - 1] : null, color = W._casualtyTriageColor;
  if (color === 'black') return [{ k:'ok', icon:'check', t:L('Waiting','ממתין'), why:L('Re-check when resources allow.','בדקו שוב כשיהיו משאבים.') }];
  var add = function(p, k, icon, t, why, btn, fn){ out.push({ id:String(p), p:p, k:k, icon:icon, t:t, why:why, btn:btn, fn:fn }); };

  if (!color) add(0, 'crit', 'triangle-alert', L('Set the triage group','קבעו קבוצת מיון'), L('Everyone else sees this colour.','כולם רואים את הצבע הזה.'), L('Choose','בחרו'), 'Field.focusTri()');

  var bleed = inj.some(function(i){ return i.type === 'hemorrhage'; });
  var stopped = (x.tourniquets || []).length || (x.pressureDressings || []).length || (x.hemostatic || []).length || (x.woundPacking || []).length || x.noMassiveHemorrhage;
  if (bleed && !stopped) add(1, 'crit', 'droplet', L('Stop the bleeding','עצרו את הדימום'), L('Bleeding wound, no tourniquet or pressure yet.','פצע מדמם, עדיין אין חוסם עורקים או לחץ.'), L('Tourniquet','חוסם עורקים'), 'Field.tq()');

  if ((a.status === 'compromised' || a.status === 'obstructed') && !(a.interventions || []).length)
    add(2, 'crit', 'wind', L('Open the airway','פתחו נתיב אוויר'), L('Airway at risk and nothing done yet.','נתיב האוויר בסיכון ועדיין לא בוצע דבר.'), L('Airway','נתיב אוויר'), "Field.march('a')");

  if (ctx.tqMins >= 100)
    add(2.5, 'urgent', 'timer', L('Tourniquet on ' + ctx.tqMins + ' min — plan evacuation','חוסם עורקים ' + ctx.tqMins + ' דק׳ — תכננו פינוי'), L('The limit is about 2 hours.','המגבלה כשעתיים.'), L('Evacuate','פינוי'), "Demo.tab('evac')");

  var chest = inj.some(function(i){ return /chest/.test(i.region || '') && i.type !== 'fracture'; });
  var chestDone = b.needleDecompression || b.tubeThora || b.oxygen || b.chestChecked || (W._casualtyTreatments || []).some(function(t){ return t.type === 'chestSeal' || t.type === 'needleDecompression' || t.type === 'tubeThora'; });
  if (chest && !chestDone && lv && ((lv.spo2 != null && lv.spo2 < 92) || (lv.rr != null && lv.rr > 28)))
    add(3, 'crit', 'wind', L('Check the chest','בדקו את החזה'), L('Chest wound, fast or low breathing: oxygen, sit them up, pain relief. Open wound: 3-side dressing. Chest tube only per protocol.','פצע חזה, נשימה מהירה או נמוכה: חמצן, ישיבה, שיכוך כאב. פצע פתוח: חבישה משלושה צדדים. נקז חזה רק לפי פרוטוקול.'), L('Breathing','נשימה'), "Field.march('b')");

  if (ctx.shock && !(c.ivAccess || []).length && !(c.fluids || []).length)
    add(4, 'crit', 'droplet', L('Start an IV and give blood','הכניסו עירוי ותנו דם'), L('Suspected shock: low pressure or weak pulse.','חשד להלם: לחץ נמוך או דופק חלש.'), L('Give blood','תנו דם'), "Field.give('blood')");

  if (ctx.txaRisk && !ctx.gotTXA && (ctx.minSinceInjury == null || ctx.minSinceInjury < 180)) {
    var left = ctx.minSinceInjury != null ? Math.max(0, 180 - ctx.minSinceInjury) : null;
    add(5, 'urgent', 'syringe', left != null ? L('Give TXA — ' + left + ' min left of 3 h','תנו TXA — נותרו ' + left + ' דק׳ מתוך 3 שעות') : L('Give TXA','תנו TXA'), L('Bleeding risk. Earlier is better.','סיכון לדימום. מוקדם יותר עדיף.'), L('Give TXA','תנו TXA'), "Field.give('txa')");
  }

  if (ctx.pelvicSuspect && !ctx.pelvicBinder && inj.some(function(i){ return i.region === 'pelvis'; }))
    add(6, 'urgent', 'bandage', L('Apply a pelvic binder','הניחו מקבע אגן'), L('Pelvic wound marked: suspected pelvic fracture.','סומנה פגיעה באגן: חשד לשבר באגן.'), L('Open care','פתחו טיפול'), "Field.march('e')");

  var due = DUE[color] != null ? DUE[color] : 10, since = lv ? (Date.now() - Date.parse(lv.time)) / 60000 : null;
  if (since == null) add(7, 'urgent', 'activity', L('Measure vitals','מדדו סימנים חיוניים'), L('Nothing recorded yet.','עדיין לא נרשם דבר.'), L('Tap heartbeat','הקישו דופק'), "Field.tapStart('pulse')");
  else if (since >= due) add(since >= due * 2 ? 3.5 : 7.5, since >= due * 2 ? 'urgent' : 'next', 'activity', L('Re-check vitals — ' + Math.round(since) + ' min ago','מדדו שוב — לפני ' + Math.round(since) + ' דק׳'), L('Due every ' + due + ' min for this group.','כל ' + due + ' דק׳ לקבוצה זו.'), L('Tap heartbeat','הקישו דופק'), "Field.tapStart('pulse')");

  if (!e.hypothermiaPrevention) add(8, 'next', 'thermometer', L('Keep them warm','שמרו עליהם חמים'), L('Blanket or HPMK. Cold makes bleeding worse.','שמיכה או HPMK. קור מחמיר דימום.'), L('Open care','פתחו טיפול'), "Field.march('e')");

  var analgesic = (e.medications || []).some(function(m){ return /קטמין|פנטניל|מורפין|אופטלגין|פרצטמול/.test(m.drug || m.name || ''); });
  if (W._casualtyPainScore != null && W._casualtyPainScore >= 5 && !analgesic && !e.painDeclined)
    add(9, 'next', 'pill', L('Pain relief','משכך כאבים'), L('Pain 5 or more and nothing given.','כאב 5 ומעלה ולא ניתן דבר.'), L('Ketamine','קטמין'), "Field.give('ket')");

  if ((ctx.penetratingTorso || ctx.penetratingHeadNeckAbd) && !ctx.gotAbx)
    add(10, 'next', 'pill', L('Give an antibiotic early','תנו אנטיביוטיקה מוקדם'), L('Penetrating wound, evacuation over 1 hour. Belly or head wound: add metronidazole 500 mg.','פצע חודר, פינוי מעל שעה. פצע בטן או ראש: הוסיפו מטרונידזול 500 מ״ג.'), L('Give','תנו'), "Field.give('cef')");

  if (ctx.pediatric) {
    var wk = Number(e.weightKg) || 0, age = Number(e.ageYears), est = false;
    if (!wk) { est = true; wk = W._broselowWeight ? W._broselowWeight(age) : (age < 0.5 ? 3.5 : age < 1 ? 7 : age < 4 ? 11 : age < 8 ? 17 : 27); }
    var r1 = function(v){ return Math.round(v * 10) / 10; };
    add(3.2, 'urgent', 'syringe', L('Child ' + wk + ' kg' + (est ? ' (estimated from age)' : ''), 'ילד ' + wk + ' ק״ג' + (est ? ' (הערכה לפי גיל)' : '')),
      L('TXA ' + Math.min(1000, Math.round(wk * 15)) + ' mg · fluid or blood ' + Math.min(500, Math.round(wk * 20)) + ' mL (shock only) · ketamine ' + r1(wk * 0.3) + ' mg IV · ceftriaxone ' + Math.min(2000, Math.round(wk * 100)) + ' mg. Use the length tape if you have one.',
        'TXA ' + Math.min(1000, Math.round(wk * 15)) + ' מ״ג · נוזל או דם ' + Math.min(500, Math.round(wk * 20)) + ' מ״ל (בהלם בלבד) · קטמין ' + r1(wk * 0.3) + ' מ״ג לווריד · צפטריאקסון ' + Math.min(2000, Math.round(wk * 100)) + ' מ״ג. השתמשו בסרגל ההחייאה אם יש.'),
      L('Open care','פתחו טיפול'), "Field.march('c')");
  }

  if (ctx.hasTBI)
    add(5.2, 'urgent', 'brain', L('Suspected head injury: protect the brain','חשד לפגיעת ראש: הגנה על המוח'), L('Keep systolic over 100 and SpO2 over 90. Head up 30° unless in shock. Record eye, verbal and motor scores separately. No routine hyperventilation.','שמרו על סיסטולי מעל 100 וסטורציה מעל 90. ראש מורם 30° אלא אם בהלם. רשמו עיניים, דיבור ומוטורי בנפרד. בלי היפרוונטילציה שגרתית.'), L('Vitals','מדדים'), "Field.tapStart('pulse')");

  if (inj.some(function(i){ return /eye/.test(i.region || ''); }))
    add(5.3, 'urgent', 'eye', L('Eye wound marked: shield it','סומנה פגיעת עין: הגנה'), L('Rigid shield or cup, no pressure, no drops, no pressure bandage. Head up. Chemical burn: rinse 20 minutes first.','מגן קשיח או כוס, בלי לחץ, בלי טיפות, בלי חבישת לחץ. ראש מורם. כוויה כימית: שטיפה 20 דקות קודם.'), L('Open care','פתחו טיפול'), "Field.march('e')");

  if (ctx.crushSuspect)
    add(5.5, 'urgent', 'droplet', L('Suspected crush injury: start saline','חשד לפגיעת מעיכה: התחילו סליין'), L('Trapped over 45 min. Saline 1 L per hour, before the rescue if possible. Do not give Hartmann.','לכוד מעל 45 דק׳. סליין ליטר לשעה, אם אפשר לפני החילוץ. לא להשתמש בהרטמן.'), L('Open care','פתחו טיפול'), "Field.march('c')");

  if (ctx.shock && (c.fluids || []).some(function(f){ return /דם|blood/i.test(f.type || ''); }))
    add(4.5, 'next', 'activity', L('After each unit: stop and re-check','אחרי כל מנה: עצרו ובדקו שוב'), L('Measure blood pressure. Another unit only if deep shock is still suspected. Flush 10 mL saline before TXA.','מדדו לחץ דם. מנה נוספת רק אם עדיין יש חשד להלם עמוק. שטפו 10 מ״ל סליין לפני TXA.'), L('Vitals','מדדים'), "Field.tapStart('pulse')");

  if ((color === 'red' || color === 'yellow') && W._casualtyEditId && W.findVehicleForCasualty) {
    var cas = (W._incidentCasualties || []).filter(function(z){ return z._docId === W._casualtyEditId; })[0];
    if (cas && !W.findVehicleForCasualty(cas)) add(11, 'next', 'ambulance', L('Assign to an ambulance','שייכו לאמבולנס'), L('Not on a vehicle yet.','עדיין לא על רכב.'), L('Evacuate','פינוי'), "Demo.tab('evac')");
  }

  out.sort(function(p, q){ return p.p - q.p; });
  if (!out.length) out.push({ k:'ok', icon:'check', t:L('All key steps are done','כל הצעדים העיקריים בוצעו'), why:L('Keep re-checking vitals and watch for change.','המשיכו למדוד ולעקוב אחר שינויים.') });
  return out;
}
function btnIcon(fn, fallback){ fn = String(fn || ''); return /Field\.tq\(/.test(fn) ? 'timer' : /give\('blood'/.test(fn) ? 'droplet' : /give\(/.test(fn) ? 'syringe' : /tapStart\('pulse'/.test(fn) ? 'heart-pulse' : /keypad/.test(fn) ? 'keyboard' : /evac/.test(fn) ? 'ambulance' : /focusTri/.test(fn) ? 'triangle-alert' : fallback || 'chevron-right'; }
Field._allNext = false;
Field.nextHtml = function(){
  var list = items(), show = Field._allNext ? list : list.slice(0, 3), h = '<div class="f-next"><div class="f-h">' + L('What to do next','מה עושים עכשיו') + '</div>';
  show.forEach(function(it, i){
    h += '<div class="f-n ' + it.k + (i === 0 ? ' first' : '') + '" data-rid="' + it.id + '"><span class="f-ni">' + ico(it.icon, 30) + '</span><span class="f-nt"><b>' + it.t + '</b><small>' + it.why + '</small></span>'
      + (it.btn ? '<button onclick="' + it.fn + '">' + ico(btnIcon(it.fn, it.icon), 24) + it.btn + '</button>' : '') + '</div>';
  });
  if (list.length > 3) h += '<button class="xbtn f-nall" onclick="Field.allNext()">' + ico(Field._allNext ? 'chevron-down' : 'chevrons-down', 24) + (Field._allNext ? L('Show less','הצג פחות') : L('Show all ','הצג הכל ') + '(' + list.length + ')') + '</button>';
  return h + '</div>';
};
Field.nextItems = function(){ return items(); };
Field.allNext = function(){ Field._allNext = !Field._allNext; W.MedHost.renderIncidentPage(); };
Field.focusTri = function(){ var t = document.querySelector('.f-tri'); if (t) t.scrollIntoView({ block:'center' }); };

// ── 2) TAP TO MEASURE (adaptive) ───────────────────────────────
// Taps are kept as timestamps. The rate comes from the MEDIAN of the most recent intervals; how many intervals are
// used adapts to the tapping speed (about 12 seconds of history: few intervals for slow breathing, more for a fast
// pulse). The spread of the intervals tells how steady the rhythm is.
var T = null;
function estimate(){
  if (!T || T.taps.length < 3) return null;
  var iv = [], i; for (i = 1; i < T.taps.length; i++) iv.push(T.taps[i] - T.taps[i - 1]);
  iv = iv.filter(function(d){ return d >= 150; }); if (iv.length < 2) return null;
  var mean = iv.reduce(function(p, q){ return p + q; }, 0) / iv.length;
  var win = Math.max(3, Math.min(12, Math.round(12000 / mean)));
  var use = iv.slice(-win).sort(function(p, q){ return p - q; });
  var med = use.length % 2 ? use[(use.length - 1) / 2] : (use[use.length / 2 - 1] + use[use.length / 2]) / 2;
  var avg = use.reduce(function(p, q){ return p + q; }, 0) / use.length;
  var sd = Math.sqrt(use.reduce(function(p, q){ return p + (q - avg) * (q - avg); }, 0) / use.length);
  var cv = avg ? sd / avg : 1;
  if (!med || med <= 0) return null;
  var rt = Math.round(60000 / med); if (rt > 300) return null;
  return { rate: rt, steady: cv < 0.18 ? 'good' : cv < 0.35 ? 'ok' : 'poor', n: T.taps.length };
}
function range(kind, r){ return kind === 'pulse' ? (r < 50 || r > 120) : (r < 10 || r > 24); }
function draw(){
  var el = document.getElementById('f-tap'); if (!el || !T) return;
  var est = estimate(), kind = T.kind, unit = L('/min','/דק׳');
  var title = kind === 'pulse' ? L('Tap with every heartbeat','הקישו עם כל פעימה') : L('Tap with every breath','הקישו עם כל נשימה');
  var hint = !T.taps.length ? L('Start tapping. Feel the pulse at the wrist or neck.','התחילו להקיש. הרגישו דופק בפרק היד או בצוואר.')
    : (est ? (est.steady === 'good' ? L('Steady rhythm. Save when ready.','קצב יציב. שמרו כשמוכנים.') : est.steady === 'ok' ? L('Keep tapping for a steadier number.','המשיכו להקיש למספר יציב יותר.') : L('Uneven rhythm. Keep tapping.','קצב לא סדיר. המשיכו להקיש.')) : L('Keep tapping… ' + (3 - T.taps.length) + ' more','המשיכו להקיש… עוד ' + Math.max(0, 3 - T.taps.length)));
  el.querySelector('.tap-title').textContent = title;
  var big = el.querySelector('.tap-rate b'); big.textContent = est ? est.rate : '—';
  el.querySelector('.tap-rate').classList.toggle('bad', !!est && range(kind, est.rate));
  el.querySelector('.tap-rate span').textContent = unit;
  el.querySelector('.tap-hint').textContent = hint;
  el.querySelector('.tap-count').textContent = T.taps.length + L(' taps',' הקשות');
  el.querySelector('.tap-steady').className = 'tap-steady ' + (est ? est.steady : '');
  el.querySelector('.tap-steady').textContent = est ? (est.steady === 'good' ? L('Steady','יציב') : est.steady === 'ok' ? L('Fairly steady','די יציב') : L('Uneven','לא סדיר')) : '';
  el.querySelector('.tap-save').disabled = !est;
}
Field.tapStart = function(kind){
  Field.tapClose(); T = { kind:kind, taps:[] };
  var el = document.createElement('div'); el.id = 'f-tap'; el.className = 'sheet-wrap no-polish';
  el.innerHTML = '<div class="sheet tap" role="dialog" aria-label="' + L('Tap to measure','הקשה למדידה') + '" style="top:0;border-radius:0"><div class="tap-head"><b class="tap-title"></b><button class="xbtn" onclick="Field.tapClose()">' + L('Close','סגור') + '</button></div>'
    + '<div class="tap-rate"><b>—</b><span></span></div><div class="tap-info"><span class="tap-count"></span><span class="tap-steady"></span></div><p class="tap-hint"></p>'
    + '<button class="tap-pad" id="f-tap-pad" onpointerdown="Field.tapHit(event)">' + ico(kind === 'pulse' ? 'heart-pulse' : 'wind', 56) + '<span>' + L('Tap here','הקישו כאן') + '</span></button>'
    + '<div class="btn-row"><button class="xbtn" onclick="Field.tapReset()">' + L('Start over','התחל מחדש') + '</button><button class="xbtn xbtn-primary tap-save" onclick="Field.tapSave()">' + L('Save','שמור') + '</button></div></div>';
  app().appendChild(el); draw();
};
Field.tapHit = function(ev){
  if (!T) return; if (ev && ev.preventDefault) ev.preventDefault();
  var now = Date.now();
  if (T.taps.length && now - T.taps[T.taps.length - 1] < 150) return;           // ignore double-registered touches
  if (T.taps.length && now - T.taps[T.taps.length - 1] > 6000) T.taps = [];      // long pause = a new measurement
  T.taps.push(now); if (T.taps.length > 60) T.taps.shift();
  var pad = document.getElementById('f-tap-pad'); if (pad){ pad.classList.add('hit'); setTimeout(function(){ pad.classList.remove('hit'); }, 90); }
  if (navigator.vibrate) navigator.vibrate(12);
  draw();
};
Field.tapReset = function(){ if (T){ T.taps = []; draw(); } };
Field.tapClose = function(){ var e = document.getElementById('f-tap'); if (e) e.remove(); T = null; };
Field.tapSave = function(){
  var est = estimate(); if (!est || !T) return;
  var kind = T.kind, rate = est.rate, n = T.taps.length;
  if (kind === 'rr' ? (rate < 1 || rate > 80) : (rate < 20 || rate > 300)){ var h = document.querySelector('#f-tap .tap-hint'); if (h) h.textContent = L('Not possible (' + rate + '/min). Start over and tap with each ' + (kind === 'rr' ? 'breath' : 'beat') + '.', 'לא אפשרי (' + rate + '/דק׳). התחילו מחדש.'); return; }
  Field.tapClose();
  if (W.pushMedHistory) W.pushMedHistory();
  var vi = (W._casualtyVitalsInput = W._casualtyVitalsInput || {}), X = W._casualtyXABCDE;
  ['pulse','rr','spo2','bpSys','bpDia','temp','etco2','radialPulse','bp'].forEach(function(k){ vi[k] = ''; });
  if (kind === 'rr'){ X.b.respiratoryRate = rate; vi.rr = String(rate); W.addTimestampedAction('vitals', 'קצב נשימה: ' + rate + '/דקה (tap×' + n + ')', ''); }
  else { X.c.pulseRate = rate; vi.pulse = String(rate); W.addTimestampedAction('vitals', 'דופק: ' + rate + '/דקה (tap×' + n + ')', ''); }
  if (W._pushVitalsRowFromInputs) W._pushVitalsRowFromInputs('tap-rate');
  W.MedHost.triggerAutoSave(); W.MedHost.renderIncidentPage();
  if (Field.toast) Field.toast(kind === 'rr' ? L('Breathing saved: ' + rate + '/min','נשימות נשמרו: ' + rate + '/דק׳') : L('Heart rate saved: ' + rate + '/min','דופק נשמר: ' + rate + '/דק׳'), function(){ W.medUndo(); });
};
})();
