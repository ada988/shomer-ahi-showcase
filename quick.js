/* QUICK TRIAGE — the short form for mass-casualty events (many casualties, seconds each).
   Steps follow the book's S-A-B-C triage: bleeding, breathing, airway, chest, circulation, life or limb threat. Results: URGENT, NOT URGENT, WAITING (never DECEASED: only a doctor declares death).
   A quick record is a real casualty: it can be opened later as a full Form 101 (formLevel 'quick' → 'full'). */
(function(){
'use strict';
var W = window;
function lang(){ return (W.ShowcaseI18n && W.ShowcaseI18n.lang) || 'en'; }
function L(en, he){ return lang() === 'he' ? he : en; }
function ico(n, s){ return W.Icon ? W.Icon(n, s) : ''; }
function esc(s){ return W.escapeHtml(s); }
function app(){ return document.getElementById('app'); }

var EVAC = { red:'immediate', yellow:'urgent', green:'routine', gray:'expectant', black:'' };
var DEFAULT_COL = 'green';

// Question graph. yes/no → next step id or a final colour.
var STEPS = {
  bleed:  { q:['Life-threatening bleeding? Stop it now: tourniquet, packing, pressure.','דימום מסכן חיים? עוצרים עכשיו: חוסם עורקים, אריזה, לחץ.'], yes:'breath', no:'breath', flag:'bleed', yesL:['Stopped it','עצרתי'], noL:['No bleeding','אין דימום'] },
  breath: { q:['Is the casualty breathing on their own? Gasping counts as NOT breathing.','האם הפצוע נושם בכוחות עצמו? נשימה אגונלית נחשבת כלא נושם.'], yes:'airway', no:'reopen', yesL:['Breathing','נושם'], noL:['Not breathing','לא נושם'] },
  reopen: { q:['Open the airway now: jaw thrust, clear the mouth. Breathing now?','פתחו נתיב אוויר עכשיו: דחיקת לסת, ניקוי הפה. נושם עכשיו?'], yes:['red', ['URGENT: breathes only with the airway held open. Recovery position, keep it open.','דחוף: נושם רק כשנתיב האוויר פתוח. תנוחת החלמה, שמרו עליו פתוח.']], no:['black', ['WAITING: not breathing after the airway was opened. Move out of the row. Come back only after every urgent casualty is treated. Only a doctor declares death.','ממתין: לא נושם אחרי פתיחת נתיב אוויר. מוציאים מהשורה. חוזרים רק אחרי שכל הדחופים טופלו. רק רופא קובע מוות.']], yesL:['Breathing now','נושם עכשיו'], noL:['Still not breathing','עדיין לא נושם'] },
  airway: { q:['Airway at risk? Unconscious, cannot speak, stridor, gurgling, face or neck injury.','נתיב אוויר בסיכון? מחוסר הכרה, לא מדבר, סטרידור, חרחור, פגיעת פנים או צוואר.'], yes:['red', ['URGENT: open the airway, put them in the recovery position.','דחוף: פתחו נתיב אוויר, הניחו בתנוחת החלמה.']], no:'chest', yesL:['Yes','כן'], noL:['No','לא'] },
  chest:  { q:['Chest wound, fast or laboured breathing, or low SpO₂ (under 90)?','פצע חזה, נשימה מהירה או מאומצת, או סטורציה נמוכה (מתחת ל-90)?'], yes:['red', ['URGENT: breathing problem. Oxygen if you have it, let them sit up.','דחוף: בעיה בנשימה. חמצן אם יש, אפשרו ישיבה.']], no:'circ', yesL:['Yes','כן'], noL:['No','לא'] },
  circ:   { q:['Weak or absent radial pulse, pale cold skin, or confused or drowsy (not from a head injury)?','דופק רדיאלי חלש או חסר, עור חיוור וקר, או מבולבל או ישנוני (לא מפגיעת ראש)?'], yes:['red', ['URGENT: signs of shock. Measure blood pressure, plan IV and blood.','דחוף: סימני הלם. מדדו לחץ דם, תכננו עירוי ודם.']], no:'limb', yesL:['Yes','כן'], noL:['No','לא'] },
  limb:   { q:['Injury that threatens life or limb? Penetrating head, neck, chest, belly or groin; penetrating eye; a tourniquet on a limb.','פציעה שמסכנת חיים או איבר? חדירה בראש, בצוואר, בחזה, בבטן או במפשעה; פגיעה חודרת בעין; חוסם עורקים על גפה.'], yes:['red', ['URGENT: injury threatens life or limb.','דחוף: פציעה מסכנת חיים או איבר.']], no:['green', ['NOT URGENT for now. Walking casualties are not automatically safe: check them like everyone else.','לא דחוף כרגע. גם הולכים לא בטוחים אוטומטית: בדקו אותם כמו כולם.']], yesL:['Yes','כן'], noL:['No','לא'] }
};
var S = null;   // {step, history:[], result:null, flags:{}, tq:null, desc:{}}
// Tourniquet sites offered right after "bleeding stopped": [English, Hebrew, engine site label]. Sides are the casualty's.
var TQ_SITES = { r_upper_arm:['Right arm','יד ימין','זרוע R'], l_upper_arm:['Left arm','יד שמאל','זרוע L'], r_thigh:['Right leg','רגל ימין','ירך R'], l_thigh:['Left leg','רגל שמאל','ירך L'] };
// Three one-tap descriptors so quick casualties can be told apart: [key, English, Hebrew]
var DESC = [
  { k:'sex', o:[['m','Male','גבר'], ['f','Female','אישה']] },
  { k:'age', o:[['c','child','ילד'], ['a','adult','מבוגר'], ['o','older','קשיש']] },
  { k:'dress', o:[['u','in uniform','במדים'], ['v','civilian clothes','בלבוש אזרחי']] }
];
// The record's timeline text is stored in Hebrew (the engine's source language) and translated on display.
(function(){
  var d = {}, ks = Object.keys(STEPS);
  ks.forEach(function(k){ [STEPS[k].yes, STEPS[k].no].forEach(function(n){ if (n && typeof n !== 'string') d['מיון מהיר — ' + n[1][1]] = 'Quick triage — ' + n[1][0]; }); });
  d['מיון מהיר — דחוף: דימום מסכן חיים (נעצר). דימום שנעצר בחוסם עורקים נשאר דחוף.'] = 'Quick triage — URGENT: life-threatening bleeding (stopped). A bleed controlled with a tourniquet stays urgent.';
  d['מיון מהיר — נקבע על ידי המטפל'] = 'Quick triage — Set by the medic';
  Object.keys(TQ_SITES).forEach(function(k){ var key = 'ח"ע — ' + TQ_SITES[k][2]; if (!(W.SHOWCASE_DICT || {})[key]) d[key] = 'TQ — ' + TQ_SITES[k][0].toLowerCase(); });
  DESC.forEach(function(g){ g.o.forEach(function(o){ d[o[2]] = o[1]; }); });
  if (W.ShowcaseI18n && W.ShowcaseI18n.extend) W.ShowcaseI18n.extend(d);
})();

function counts(){ var c = { red:0, yellow:0, green:0, black:0 }; (W._incidentCasualties || []).forEach(function(x){ var k = x.triageColor === 'gray' ? 'black' : x.triageColor; if (c[k] != null) c[k]++; }); return c; }
// URGENT includes the optional DELAYED group; not breathing after the airway is opened = WAITING (one category, black, square).
function groups(){ var c = counts(); return { urgent: c.red, delayed: c.yellow, notUrgent: c.green, dead: c.black, total: c.red + c.yellow + c.green + c.black }; }
function countBar(){
  var g = groups(), cells = [['red', g.urgent]].concat(g.delayed ? [['yellow', g.delayed]] : []).concat([['green', g.notUrgent], ['black', g.dead]]);
  return '<div class="qt-count n' + cells.length + '">' + cells.map(function(x){ var k = x[0], t = W.TriageUI.tg(k); return '<span class="t-' + k + '">' + W.TriageUI.shapeSvg(t.shape, 24) + '<b>' + x[1] + '</b><em>' + W.TriageUI.word(k) + '</em></span>'; }).join('') + '</div>';
}
// What the medic sees: one icon, one colour and a few words per step. The long wording stays in STEPS for the record.
var UI = {
  bleed:  { i:'droplet',     c:'#ff6b8b', t:['Bleeding','דימום'],          q:['Life-threatening bleeding?','דימום מסכן חיים?'],        h:['Stop it now: tourniquet, packing, pressure','עוצרים עכשיו: חוסם, אריזה, לחץ'] },
  breath: { i:'wind',        c:'#4fc3ff', t:['Breathing','נשימה'],         q:['Breathing on their own?','נושם בכוחות עצמו?'],          h:['Gasping = not breathing','נשימה אגונלית = לא נושם'] },
  reopen: { i:'wind',        c:'#4fc3ff', t:['Open the airway','פתיחת נתיב'], q:['Breathing now?','נושם עכשיו?'],                       h:['Jaw thrust, clear the mouth','דחיקת לסת, ניקוי הפה'] },
  airway: { i:'volume-2',    c:'#b18cff', t:['Airway','נתיב אוויר'],       q:['Airway at risk?','נתיב אוויר בסיכון?'],                h:['Unconscious, stridor, gurgling, face or neck wound','מחוסר הכרה, סטרידור, חרחור, פגיעת פנים או צוואר'] },
  chest:  { i:'stethoscope', c:'#5ad1c8', t:['Chest','חזה'],               q:['Breathing problem?','בעיית נשימה?'],                    h:['Chest wound, fast breathing, SpO₂ under 90','פצע חזה, נשימה מהירה, סטורציה מתחת 90'] },
  circ:   { i:'heart-pulse', c:'#ff9a62', t:['Shock','הלם'],               q:['Signs of shock?','סימני הלם?'],                         h:['Weak or no radial pulse, pale cold skin, confused','דופק רדיאלי חלש או חסר, עור חיוור וקר, מבולבל'] },
  limb:   { i:'bone',        c:'#8fa2ff', t:['Life or limb','חיים או איבר'], q:['Threat to life or limb?','סכנה לחיים או לאיבר?'],    h:['Penetrating head, neck, chest, belly, groin or eye · tourniquet on','חדירה בראש, צוואר, חזה, בטן, מפשעה או עין · חוסם עורקים'] }
};
var PATH = ['bleed','breath','airway','chest','circ','limb'];
function head(){
  return '<div class="qt-top"><button class="xbtn" onclick="Quick.close()">' + ico('x', 26) + L('Close','סגור') + '</button><div class="qt-title"><b>' + ico('zap', 26) + L('Quick triage','מיון מהיר') + '</b></div><button class="beta-pill" onclick="Disclaimer.open()" aria-label="' + L('Important notice: early beta demo, do not use on real patients','הודעה חשובה: דמו בטא מוקדמת, אין להשתמש בנפגעים אמיתיים') + '">' + ico('triangle-alert', 20) + '<b>' + L('Beta','בטא') + '</b><span>· ' + L('demo','דמו') + '</span></button></div>' + countBar();
}
function body(){
  if (S.result){
    var r = S.result, t = W.TriageUI.tg(r.color);
    return '<div class="qt-res t-' + r.color + '">' + W.TriageUI.shapeSvg(t.shape, 88) + '<b>' + W.TriageUI.word(r.color) + '</b><span>' + esc(L(r.reason[0], r.reason[1]).replace(/^(URGENT|WAITING|NOT URGENT|NO SIGNS OF LIFE|דחוף|ממתין|לא דחוף|ללא סימני חיים)[:]?\s*/, '').replace(/^for now\.\s*/, '').replace(/^./, function(c){ return c.toUpperCase(); })) + '</span></div>'
      + (S.tq ? '<p class="qt-tqline">' + ico('timer', 26) + L('Tourniquet · ' + TQ_SITES[S.tq.site][0].toLowerCase() + ' · clock running','חוסם עורקים · ' + TQ_SITES[S.tq.site][1] + ' · השעון רץ') + '</p>' : '')
      // three optional taps so this casualty can be told apart later
      + '<div class="qt-desc" role="group" aria-label="' + L('Describe (optional)','תיאור (רשות)') + '">' + DESC.map(function(g){ return '<div>' + g.o.map(function(o){ var on = (S.desc || {})[g.k] === o[0]; return '<button aria-pressed="' + on + '" class="' + (on ? 'on' : '') + '" onclick="Quick.desc(\'' + g.k + '\',\'' + o[0] + '\')">' + ico(on ? 'check' : 'circle', 22) + L(o[1].charAt(0).toUpperCase() + o[1].slice(1), o[2]) + '</button>'; }).join('') + '</div>'; }).join('') + '</div>'
      + '<button class="xbtn xbtn-primary qt-next" onclick="Quick.save(false)">' + ico('check', 30) + L('Save · next casualty','שמירה · הנפגע הבא') + '</button>'
      + '<div class="btn-row"><button class="xbtn qt-band" onclick="Quick.save(\'tag\')">' + ico('tag', 26) + L('Save · scan tag','שמירה · סריקת תג') + '</button><button class="xbtn" onclick="Quick.save(true)">' + ico('file-text', 26) + L('Save · open Form 101','שמירה · טופס 101') + '</button><button class="xbtn" onclick="Quick.change()">' + ico('rotate-ccw', 26) + L('Change colour','שינוי צבע') + '</button></div>'
      + '<button class="xbtn qt-back" onclick="Quick.back()">' + ico(lang() === 'he' ? 'arrow-right' : 'arrow-left', 26) + L('Back','חזרה') + '</button>';
  }
  var at = PATH.indexOf(S.step === 'reopen' ? 'breath' : S.step === 'tq' ? 'bleed' : S.step);
  var bar = '<div class="qt-bar" aria-hidden="true">' + PATH.map(function(k, i){ return '<i class="' + (i < at ? 'done' : i === at ? 'now' : '') + '" style="--sc:' + UI[k].c + '"></i>'; }).join('') + '</div>';
  var stepW = L('Step ' + (at + 1) + ' of ' + PATH.length, 'שלב ' + (at + 1) + ' מתוך ' + PATH.length);
  if (S.step === 'tq'){
    var b = UI.bleed;
    return bar + '<div class="qt-step" style="--sc:' + b.c + '"><div class="qt-kind">' + ico(b.i, 30) + '<span><em>' + stepW + ' · </em>' + L('Bleeding','דימום') + '</span></div><h2>' + L('Tourniquet on?','חוסם עורקים?') + '</h2><p>' + L('Tap where. The clock starts now.','לחצו איפה. השעון מתחיל עכשיו.') + '</p></div>'
      + '<div class="qt-tq">' + Object.keys(TQ_SITES).map(function(k){ return '<button onclick="Quick.tq(\'' + k + '\')">' + ico('timer', 30) + '<b>' + L(TQ_SITES[k][0], TQ_SITES[k][1]) + '</b></button>'; }).join('')
      + '<button class="qt-notq" onclick="Quick.tq(null)">' + ico('x', 28) + '<b>' + L('No tourniquet','בלי חוסם') + '</b><small>' + L('Packing or pressure','אריזה או לחץ') + '</small></button></div>'
      + '<button class="xbtn qt-back" onclick="Quick.back()">' + ico(lang() === 'he' ? 'arrow-right' : 'arrow-left', 26) + L('Back','חזרה') + '</button>';
  }
  var st = STEPS[S.step], u = UI[S.step];
  var sub = function(x){ return /^(Yes|No|כן|לא)$/.test(x) ? '' : '<small>' + x + '</small>'; };
  return bar
    + '<div class="qt-step" style="--sc:' + u.c + '"><div class="qt-kind">' + ico(u.i, 30) + '<span><em>' + L('Step ' + (at + 1) + ' of ' + PATH.length, 'שלב ' + (at + 1) + ' מתוך ' + PATH.length) + ' · </em>' + L(u.t[0], u.t[1]) + '</span></div><h2>' + L(u.q[0], u.q[1]) + '</h2><p>' + L(u.h[0], u.h[1]) + '</p></div>'
    + '<div class="qt-yn"><button class="yes" aria-label="' + esc(L('Yes: ' + st.yesL[0], 'כן: ' + st.yesL[1])) + '" onclick="Quick.answer(true)">' + ico('check', 44) + '<b>' + L('YES','כן') + '</b>' + sub(L(st.yesL[0], st.yesL[1])) + '</button>'
    + '<button class="no" aria-label="' + esc(L('No: ' + st.noL[0], 'לא: ' + st.noL[1])) + '" onclick="Quick.answer(false)">' + ico('x', 44) + '<b>' + L('NO','לא') + '</b>' + sub(L(st.noL[0], st.noL[1])) + '</button></div>'
    + (S.history.length ? '<button class="xbtn qt-back" onclick="Quick.back()">' + ico(lang() === 'he' ? 'arrow-right' : 'arrow-left', 26) + L('Back','חזרה') + '</button>' : '');
}
function draw(){
  var el = document.getElementById('qt'); if (!el) return;
  el.querySelector('.qt-inner').innerHTML = head() + '<div class="qt-body">' + body() + '</div>';
}
function finish(color, reason){ if (color === 'gray') color = 'black'; S.result = { color:color, reason:reason }; draw(); if (navigator.vibrate) navigator.vibrate(30); }

var Quick = {
  open: function(){
    Quick.close(); S = { step:'bleed', history:[], result:null, flags:{}, tq:null, desc:{} };
    var el = document.createElement('div'); el.id = 'qt'; el.className = 'qt no-polish'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', L('Quick triage','מיון מהיר'));
    el.innerHTML = '<div class="qt-inner"></div>'; app().appendChild(el); draw();
  },
  relang: function(){ var el = document.getElementById('qt'); if (!el || !S) return; el.setAttribute('aria-label', L('Quick triage','מיון מהיר')); draw(); },
  close: function(){ var e = document.getElementById('qt'); if (e) e.remove(); S = null; if (W.renderIncidentPage) W.renderIncidentPage(); },
  answer: function(yes){
    var st = STEPS[S.step], nxt = yes ? st.yes : st.no;
    S.history.push(S.step);
    if (st.flag) S.flags[st.flag] = yes;
    if (S.step === 'bleed' && yes){ S.step = 'tq'; draw(); return; }
    if (S.step === 'bleed') S.tq = null;
    if (typeof nxt === 'string'){ S.step = nxt; draw(); }
    else if (nxt[0] === 'green' && S.flags.bleed) finish('red', ['URGENT: life-threatening bleeding (stopped). A bleed controlled with a tourniquet stays urgent.','דחוף: דימום מסכן חיים (נעצר). דימום שנעצר בחוסם עורקים נשאר דחוף.']);
    else finish(nxt[0], nxt[1]);
  },
  tq: function(site){
    if (!S) return;
    S.tq = site && TQ_SITES[site] ? { site:site, time:new Date().toISOString() } : null;
    S.history.push('tq'); S.step = 'breath'; draw();
  },
  desc: function(k, v){ if (!S) return; S.desc = S.desc || {}; S.desc[k] = S.desc[k] === v ? '' : v; draw(); },
  back: function(){
    if (S.result){ S.result = null; S.step = S.history.pop() || 'bleed'; draw(); return; }
    if (S.history.length){ S.step = S.history.pop(); draw(); }
  },
  change: function(){
    var el = document.getElementById('qt'); var old = el.querySelector('.qt-pick'); if (old) { old.remove(); return; }
    var d = document.createElement('div'); d.className = 'qt-pick';
    d.innerHTML = ['red','yellow','green','black'].map(function(k){ var t = W.TriageUI.tg(k); return '<button class="t-' + k + '" onclick="Quick.set(\'' + k + '\')">' + W.TriageUI.shapeSvg(t.shape, 26) + '<b>' + W.TriageUI.word(k) + '</b></button>'; }).join('');
    el.querySelector('.qt-body').appendChild(d); d.scrollIntoView({ block:'center' });
  },
  set: function(k){ S.result = { color:k, reason:['Set by the medic','נקבע על ידי המטפל'] }; draw(); },
  save: function(openFull){
    if (!S || !S.result) return;
    var now = new Date(), iso = now.toISOString(), color = S.result.color, reason = S.result.reason;
    var n = W.nextCasNum ? W.nextCasNum() : (W._incidentCasualties || []).length + 1;   // the casualty's number: unique, never reused
    var id = 'cas_' + Date.now().toString(36) + '_q', ex = function(){ return { x:{tourniquets:[],pressureDressings:[],hemostatic:[],woundPacking:[]}, a:{status:'',interventions:[]}, b:{respiratoryRate:null,tubeThora:null,oxygen:null}, c:{pulseCharacter:'',capRefill:null,ivAccess:[],fluids:[]}, d:{avpu:'',gcs:null,pupils:{left:{size:null,reactive:null},right:{size:null,reactive:null}},motorFunction:{}}, e:{hypothermiaPrevention:'',medications:[],notes:''} }; };
    var dsc = DESC.map(function(g){ var v = (S.desc || {})[g.k]; var o = g.o.filter(function(x){ return x[0] === v; })[0]; return o ? o[2] : ''; }).filter(Boolean);
    var rec = { _docId:id, id:id, name:'נפגע ' + n, num:n, desc:dsc.join(', '), idNumber:'', triageColor:color, formLevel:'quick', moi:'', injuredRegions:[], injuries:[], treatments:[], xabcde:ex(), evacPriority:EVAC[color] || '', painScore:null,
      vitalsHistory:[], timeline:[{ time:iso, category:'triage', action:'מיון מהיר — ' + reason[1], details:'' }], secondarySurvey:{ headToToe:{}, o2Flow:null, tqReeval:[], structured:{} }, examsHistory:[],
      reportedBy:'demo', reportedByName:'חובש דמו', timestamp:{ toDate:function(){ return now; } } };
    if (S.tq){   // the tourniquet asked for right after "bleeding stopped": real record, so the TQ clock and the board count it
      rec.xabcde.x.tourniquets.push({ site:S.tq.site, time:S.tq.time });
      rec.timeline.unshift({ time:S.tq.time, category:'x', action:'ח"ע — ' + TQ_SITES[S.tq.site][2], details:'' });
    }
    rec.bracelet = { serial: W.Bracelet.serialFor(rec) };
    W._upsertOfflineCasualty(rec);
    if (openFull === 'band'){ Quick.close(); W._incidentTab = 'bracelets'; W.renderIncidentPage(); setTimeout(function(){ W.Bracelet.open(id); }, 60); return; }
    if (openFull === 'tag'){   // link the tag now, then carry on with the next casualty
      var prevS = S; S = { step:'bleed', history:[], result:null, flags:{} }; draw();
      setTimeout(function(){ W.Bracelet.scanTag(id, function(){ if (!document.getElementById('qt')) Quick.open && Quick.open(); }); }, 30);
      void prevS; return;
    }
    if (openFull){ Quick.close(); W._incidentTab = 'casualties'; setTimeout(function(){ W.editCasualtyById(id); }, 60); return; }
    var prev = S; S = { step:'bleed', history:[], result:null, flags:{} }; draw();
    // Undo puts the record back on the result screen, exactly as it was before Save
    if (W.Field && W.Field.toast) { var nm = W.ShowcaseI18n ? W.ShowcaseI18n.tr(rec.name) : rec.name; W.Field.toast(L(nm + ' saved as ' + W.TriageUI.word(color), nm + ' נשמר כ-' + W.TriageUI.word(color)), function(){ W._removeOfflineCasualty(id); if (document.getElementById('qt')){ S = prev; draw(); } else if (W.renderIncidentPage) W.renderIncidentPage(); }); var ub = document.querySelector('#undo-toast button'); if (ub && !ub.querySelector('svg')) ub.insertAdjacentHTML('afterbegin', ico('undo-2', 24)); }
  }
};
W.Quick = Quick;
})();
