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
  bleed:  { q:['S · Life-threatening bleeding? Stop it now: tourniquet, packing, pressure.','S · דימום מסכן חיים? עוצרים עכשיו: חוסם עורקים, אריזה, לחץ.'], yes:'breath', no:'breath', flag:'bleed', yesL:['YES — stopped it','כן — עצרתי'], noL:['NO bleeding','אין דימום'] },
  breath: { q:['Is the casualty breathing on their own? Gasping counts as NOT breathing.','האם הפצוע נושם בכוחות עצמו? נשימה אגונלית נחשבת כלא נושם.'], yes:'airway', no:['gray', ['WAITING: not breathing. Move out of the row. Come back only after every urgent casualty is treated. Only a doctor declares death.','ממתין: לא נושם. מוציאים מהשורה. חוזרים רק אחרי שכל הדחופים טופלו. רק רופא קובע מוות.']], yesL:['YES, breathing','כן, נושם'], noL:['NO, not breathing','לא נושם'] },
  airway: { q:['A · Airway at risk? Unconscious, cannot speak, stridor, gurgling, face or neck injury.','A · נתיב אוויר בסיכון? מחוסר הכרה, לא מדבר, סטרידור, חרחור, פגיעת פנים או צוואר.'], yes:['red', ['URGENT: open the airway, put them in the recovery position.','דחוף: פתחו נתיב אוויר, הניחו בתנוחת החלמה.']], no:'chest', yesL:['YES','כן'], noL:['NO','לא'] },
  chest:  { q:['B · Chest wound, fast or laboured breathing, or low SpO₂ (under 90)?','B · פצע חזה, נשימה מהירה או מאומצת, או סטורציה נמוכה (מתחת ל-90)?'], yes:['red', ['URGENT: breathing problem. Oxygen if you have it, let them sit up.','דחוף: בעיה בנשימה. חמצן אם יש, אפשרו ישיבה.']], no:'circ', yesL:['YES','כן'], noL:['NO','לא'] },
  circ:   { q:['C · Weak or absent radial pulse, pale cold skin, or confused or drowsy (not from a head injury)?','C · דופק רדיאלי חלש או חסר, עור חיוור וקר, או מבולבל או ישנוני (לא מפגיעת ראש)?'], yes:['red', ['URGENT: signs of shock. Measure blood pressure, plan IV and blood.','דחוף: סימני הלם. מדדו לחץ דם, תכננו עירוי ודם.']], no:'limb', yesL:['YES','כן'], noL:['NO','לא'] },
  limb:   { q:['Injury that threatens life or limb? Penetrating head, neck, chest, belly or groin; penetrating eye; a tourniquet on a limb.','פציעה שמסכנת חיים או איבר? חדירה בראש, בצוואר, בחזה, בבטן או במפשעה; פגיעה חודרת בעין; חוסם עורקים על גפה.'], yes:['red', ['URGENT: injury threatens life or limb.','דחוף: פציעה מסכנת חיים או איבר.']], no:['green', ['NOT URGENT for now. Walking casualties are not automatically safe: check them like everyone else.','לא דחוף כרגע. גם הולכים לא בטוחים אוטומטית: בדקו אותם כמו כולם.']], yesL:['YES','כן'], noL:['NO','לא'] }
};
var S = null;   // {step, history:[], result:null}

function counts(){ var c = { red:0, yellow:0, green:0, gray:0, black:0 }; (W._incidentCasualties || []).forEach(function(x){ if (c[x.triageColor] != null) c[x.triageColor]++; }); return c; }
function countBar(){
  var c = counts();
  return '<div class="qt-count">' + ['red','green','gray'].map(function(k){ var t = W.TriageUI.tg(k); return '<span class="t-' + k + '">' + W.TriageUI.shapeSvg(t.shape, 20) + '<b>' + c[k] + '</b></span>'; }).join('') + '</div>';
}
function head(){
  return '<div class="qt-top"><button class="xbtn" onclick="Quick.close()">' + ico('x', 26) + L('CLOSE','סגור') + '</button><div class="qt-title"><b>' + L('QUICK TRIAGE','מיון מהיר') + '</b><small>' + L('Many casualties — seconds each','נפגעים רבים — שניות לכל אחד') + '</small></div></div>' + countBar();
}
function body(){
  if (S.result){
    var r = S.result, t = W.TriageUI.tg(r.color);
    return '<div class="qt-res t-' + r.color + '">' + W.TriageUI.shapeSvg(t.shape, 64) + '<b>' + W.TriageUI.word(r.color) + '</b><span>' + esc(L(r.reason[0], r.reason[1])) + '</span></div>'
      + '<button class="xbtn xbtn-primary qt-next" onclick="Quick.save(false)">' + ico('check', 28) + L('SAVE AND NEXT CASUALTY','שמור ונפגע הבא') + '</button>'
      + '<div class="btn-row"><button class="xbtn" onclick="Quick.save(true)">' + ico('file-text', 26) + L('SAVE + OPEN FULL FORM 101','שמור + פתח טופס 101 מלא') + '</button><button class="xbtn" onclick="Quick.change()">' + L('CHANGE GROUP','שנה קבוצה') + '</button></div>'
      + '<button class="xbtn qt-back" onclick="Quick.back()">' + ico('arrow-left', 26) + L('BACK','חזרה') + '</button>';
  }
  var st = STEPS[S.step];
  return '<div class="qt-step"><small>' + L('QUESTION ','שאלה ') + (S.history.length + 1) + '</small><h2>' + L(st.q[0], st.q[1]) + '</h2></div>'
    + '<div class="qt-yn"><button class="yes" onclick="Quick.answer(true)">' + L(st.yesL[0], st.yesL[1]) + '</button><button class="no" onclick="Quick.answer(false)">' + L(st.noL[0], st.noL[1]) + '</button></div>'
    + (S.history.length ? '<button class="xbtn qt-back" onclick="Quick.back()">' + ico('arrow-left', 26) + L('BACK','חזרה') + '</button>' : '')
    + '<p class="qt-note">' + L('Every casualty gets a colour in under a minute. During triage stop only life-threatening bleeding and open the airway. Number every casualty. Walking casualties are triaged too.','כל נפגע מקבל צבע בפחות מדקה. בזמן המיון עוצרים רק דימום מסכן חיים ופותחים נתיב אוויר. ממספרים כל נפגע. גם ההולכים עוברים מיון.') + '</p>'
    + '<div class="qt-rep"><b>' + L('REPORT','דיווח') + '</b><span>' + L('Total ','סה״כ ') + (function(){ var c = counts(); return (c.red + c.yellow + c.green + c.gray + c.black) + ' — ' + (c.red + c.yellow) + L(' urgent, ',' דחופים, ') + (c.green) + L(' not urgent, ',' לא דחופים, ') + (c.gray + c.black) + L(' waiting',' ממתינים'); })() + '</span></div>';
}
function draw(){
  var el = document.getElementById('qt'); if (!el) return;
  el.querySelector('.qt-inner').innerHTML = head() + '<div class="qt-body">' + body() + '</div>';
}
function finish(color, reason){ S.result = { color:color, reason:reason }; draw(); if (navigator.vibrate) navigator.vibrate(30); }

var Quick = {
  open: function(){
    Quick.close(); S = { step:'bleed', history:[], result:null, flags:{} };
    var el = document.createElement('div'); el.id = 'qt'; el.className = 'qt no-polish'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', L('Quick triage','מיון מהיר'));
    el.innerHTML = '<div class="qt-inner"></div>'; app().appendChild(el); draw();
  },
  close: function(){ var e = document.getElementById('qt'); if (e) e.remove(); S = null; if (W.renderIncidentPage) W.renderIncidentPage(); },
  answer: function(yes){
    var st = STEPS[S.step], nxt = yes ? st.yes : st.no;
    S.history.push(S.step);
    if (st.flag) S.flags[st.flag] = yes;
    if (typeof nxt === 'string'){ S.step = nxt; draw(); }
    else if (nxt[0] === 'green' && S.flags.bleed) finish('red', ['URGENT: life-threatening bleeding (stopped). A bleed controlled with a tourniquet stays urgent.','דחוף: דימום מסכן חיים (נעצר). דימום שנעצר בחוסם עורקים נשאר דחוף.']);
    else finish(nxt[0], nxt[1]);
  },
  back: function(){
    if (S.result){ S.result = null; S.step = S.history.pop() || 'bleed'; draw(); return; }
    if (S.history.length){ S.step = S.history.pop(); draw(); }
  },
  change: function(){
    var el = document.getElementById('qt'); var old = el.querySelector('.qt-pick'); if (old) { old.remove(); return; }
    var d = document.createElement('div'); d.className = 'qt-pick';
    d.innerHTML = ['red','yellow','green','gray','black'].map(function(k){ var t = W.TriageUI.tg(k); return '<button class="t-' + k + '" onclick="Quick.set(\'' + k + '\')">' + W.TriageUI.shapeSvg(t.shape, 26) + '<b>' + W.TriageUI.word(k) + '</b></button>'; }).join('');
    el.querySelector('.qt-body').appendChild(d);
  },
  set: function(k){ S.result = { color:k, reason:['Set by the medic','נקבע על ידי המטפל'] }; draw(); },
  save: function(openFull){
    if (!S || !S.result) return;
    var now = new Date(), iso = now.toISOString(), color = S.result.color, reason = S.result.reason;
    var n = (W._incidentCasualties || []).filter(function(c){ return c.formLevel === 'quick'; }).length + 1;
    var id = 'cas_' + Date.now().toString(36) + '_q', ex = function(){ return { x:{tourniquets:[],pressureDressings:[],hemostatic:[],woundPacking:[]}, a:{status:'',interventions:[]}, b:{respiratoryRate:null,tubeThora:null,oxygen:null}, c:{pulseCharacter:'',capRefill:null,ivAccess:[],fluids:[]}, d:{avpu:'',gcs:null,pupils:{left:{size:null,reactive:null},right:{size:null,reactive:null}},motorFunction:{}}, e:{hypothermiaPrevention:'',medications:[],notes:''} }; };
    var rec = { _docId:id, id:id, name:L('Casualty Q' + n, 'נפגע Q' + n), idNumber:'', triageColor:color, formLevel:'quick', moi:'', injuredRegions:[], injuries:[], treatments:[], xabcde:ex(), evacPriority:EVAC[color] || '', painScore:null,
      vitalsHistory:[], timeline:[{ time:iso, category:'triage', action:'מיון מהיר — ' + reason[1], details:'' }], secondarySurvey:{ headToToe:{}, o2Flow:null, tqReeval:[], structured:{} }, examsHistory:[],
      reportedBy:'demo', reportedByName:'חובש דמו', timestamp:{ toDate:function(){ return now; } } };
    rec.bracelet = { serial: W.Bracelet.serialFor(rec) };
    W._upsertOfflineCasualty(rec);
    if (openFull){ Quick.close(); W._incidentTab = 'casualties'; setTimeout(function(){ W.editCasualtyById(id); }, 60); return; }
    S = { step:'bleed', history:[], result:null, flags:{} }; draw();
    if (W.Field && W.Field.toast) W.Field.toast(L(rec.name + ' saved as ' + W.TriageUI.word(color), rec.name + ' נשמר כ-' + W.TriageUI.word(color)), null);
  }
};
W.Quick = Quick;
})();
