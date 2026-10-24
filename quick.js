/* QUICK TRIAGE — the short form for mass-casualty events (many casualties, seconds each).
   Five plain questions (START logic) decide the colour; one tap saves the record and moves on to the next casualty.
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

// Question graph. yes/no → next step id or a final colour.
var STEPS = {
  walk:    { q:['Can they WALK?','האם הם יכולים ללכת?'], yes:['green',  ['Walking','הולך']], no:'breath', yesL:['YES — walking','כן — הולכים'], noL:['NO','לא'] },
  breath:  { q:['Are they BREATHING?','האם הם נושמים?'], yes:'rate', no:'airway', yesL:['YES','כן'], noL:['NO','לא'] },
  airway:  { q:['Open the airway. Are they breathing now?','פתחו נתיב אוויר. האם נושמים עכשיו?'], yes:['red', ['Breathing only after the airway was opened','נושם רק לאחר פתיחת נתיב אוויר']], no:['black', ['WAITING: not breathing. Go back only after the urgent casualties are treated. Death is declared by a physician.','ממתין: לא נושם. חוזרים רק אחרי שהדחופים טופלו. קביעת מוות רק על ידי רופא.']], yesL:['YES, now breathing','כן, נושם עכשיו'], noL:['NO, still not','לא, עדיין לא'] },
  rate:    { q:['More than 30 breaths a minute?','יותר מ-30 נשימות בדקה?'], yes:['red', ['Breathing too fast','נשימה מהירה מדי']], no:'pulse', yesL:['YES, over 30','כן, מעל 30'], noL:['NO, 30 or fewer','לא, 30 או פחות'] },
  pulse:   { q:['Is the wrist pulse STRONG, or does a pressed fingernail refill in under 2 seconds?','האם הדופק בפרק היד חזק, או שציפורן לחוצה מתמלאת בפחות מ-2 שניות?'], yes:'obey', no:['red', ['Poor circulation','זרימת דם לקויה']], yesL:['YES, good','כן, תקין'], noL:['NO, weak or slow','לא, חלש או איטי'] },
  obey:    { q:['Can they follow a SIMPLE COMMAND, like “squeeze my hand”?','האם הם מבצעים פקודה פשוטה, כמו “לחצו את ידי”?'], yes:['yellow', ['Stable for now','יציב כרגע']], no:['red', ['Cannot follow commands','לא מבצע פקודות']], yesL:['YES','כן'], noL:['NO','לא'] }
};
var S = null;   // {step, history:[], result:null}

function counts(){ var c = { red:0, yellow:0, green:0, gray:0, black:0 }; (W._incidentCasualties || []).forEach(function(x){ if (c[x.triageColor] != null) c[x.triageColor]++; }); return c; }
function countBar(){
  var c = counts();
  return '<div class="qt-count">' + ['red','yellow','green','black'].map(function(k){ var t = W.TriageUI.tg(k); return '<span class="t-' + k + '">' + W.TriageUI.shapeSvg(t.shape, 20) + '<b>' + c[k] + '</b></span>'; }).join('') + '</div>';
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
    Quick.close(); S = { step:'walk', history:[], result:null };
    var el = document.createElement('div'); el.id = 'qt'; el.className = 'qt no-polish'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', L('Quick triage','מיון מהיר'));
    el.innerHTML = '<div class="qt-inner"></div>'; app().appendChild(el); draw();
  },
  close: function(){ var e = document.getElementById('qt'); if (e) e.remove(); S = null; if (W.renderIncidentPage) W.renderIncidentPage(); },
  answer: function(yes){
    var st = STEPS[S.step], nxt = yes ? st.yes : st.no;
    S.history.push(S.step);
    if (typeof nxt === 'string'){ S.step = nxt; draw(); } else finish(nxt[0], nxt[1]);
  },
  back: function(){
    if (S.result){ S.result = null; S.step = S.history.pop() || 'walk'; draw(); return; }
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
    S = { step:'walk', history:[], result:null }; draw();
    if (W.Field && W.Field.toast) W.Field.toast(L(rec.name + ' saved as ' + W.TriageUI.word(color), rec.name + ' נשמר כ-' + W.TriageUI.word(color)), null);
  }
};
W.Quick = Quick;
})();
