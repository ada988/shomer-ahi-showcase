/* X-CARE: the unified single-casualty protocol, built into the form.
   PRIMARY SURVEY   X (extract / stop massive bleeding) · C · A · R · E
   SECONDARY SURVEY C · A · R · E · PFC (prolonged field care)
   Each step is a big row: tap the row to mark it done (time is stored), tap the action button to do it.
   Steps that the record already proves (a tourniquet exists, BP was measured…) tick themselves. */
(function(){
'use strict';
var W = window, Field = W.Field;
function lang(){ return (W.ShowcaseI18n && W.ShowcaseI18n.lang) || 'en'; }
function L(en, he){ return lang() === 'he' ? he : en; }
function ico(n, s){ return W.Icon ? W.Icon(n, s) : ''; }
function hhmm(iso){ var d = new Date(iso); return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }
function X(){ return W._casualtyXABCDE || {}; }
function vitalsHave(k){ return (W._casualtyVitals || []).some(function(v){ return v[k] != null; }); }
function medGiven(re){ return ((X().e || {}).medications || []).some(function(m){ return re.test(m.drug || m.name || ''); }); }

var COL = { X:'xc-x', C:'xc-c', A:'xc-a', R:'xc-r', E:'xc-e', P:'xc-p' };
// item: [key, EN, HE, subEN, subHE, actionLabelEN, actionLabelHE, actionJs, autoFn]
var PRIMARY = [
  { k:'X', en:'EXTRACT', he:'חילוץ', sub:['Stop massive bleeding. Safe place first.','עצירת דימום מסכן חיים. קודם מקום בטוח.'], items:[
    ['p_x1','Safe place reached','הגענו למקום בטוח','Cover, fire superiority, casualty and medic safe.','מחסה, עליונות באש, הפצוע והמטפל מאובטחים.'],
    ['p_x2','First look and tactical report','מבט ראשון ודיווח אג״מי','Mechanism, location, how many, urgency.','מנגנון, מיקום, כמה פצועים, דחיפות.'],
    ['p_x3','Massive bleeding stopped','דימום פורץ נעצר','Tourniquet or packing. Check it worked.','חוסם עורקים או אריזה. ודאו שעבד.','TOURNIQUET','חוסם עורקים','Field.tq()', function(){ var x = X().x || {}; return (x.tourniquets || []).length || (x.pressureDressings || []).length || (x.hemostatic || []).length || (x.woundPacking || []).length || x.noMassiveHemorrhage; }]
  ]},
  { k:'C', en:'CIRCULATION', he:'מחזור דם', sub:['Hidden bleeding, shock check, blood.','דימום נסתר, בדיקת הלם, דם.'], items:[
    ['p_c1','Find and stop other bleeding','איתור ועצירת דימומים נוספים','Strip and roll: head, chest, armpits, back, groin.','הפשטה והפיכה: ראש, חזה, בתי שחי, גב, מפשעה.'],
    ['p_c2','Consciousness (AVPU)','הכרה (AVPU)','Alert, Voice, Pain, Unresponsive. No breathing or no pain response: jaw thrust + airway.','ער, קול, כאב, אין תגובה. אין נשימה או תגובה לכאב: דחיקת לסת ומנתב.','VITALS','מדדים','Field.keypad(0)', function(){ return !!((X().d || {}).avpu); }],
    ['p_c3','Blood pressure','לחץ דם','Cuff on early. Under 90 = deep shock.','שרוול מוקדם. מתחת ל-90 = הלם עמוק.','ENTER BP','הזינו ל״ד','Field.keypad(1)', function(){ return vitalsHave('bpSys'); }],
    ['p_c4','Pulse: strength and rate','דופק: חוזק וקצב','Radial pulse. None: carotid. Count 15 s if no reading.','דופק רדיאלי. אין: קרוטידי. ספרו 15 שניות אם אין קריאה.','TAP PULSE','הקישו דופק',"Field.tapStart('pulse')", function(){ return vitalsHave('pulse'); }],
    ['p_c5','Oxygen saturation','סטורציה','Pulse oximeter. Unreliable in deep shock.','מד סטורציה. לא אמין בהלם עמוק.','ENTER SpO₂','הזינו סטורציה','Field.keypad(3)', function(){ return vitalsHave('spo2'); }],
    ['p_c6','Deep shock: IV and blood now','הלם עמוק: עירוי ודם עכשיו','BP under 90, or no BP reading with no radial pulse or an altered mind (not from a head injury). Medics set the line.','ל״ד מתחת ל-90, או אין קריאת ל״ד יחד עם היעדר דופק רדיאלי או שינוי הכרה (לא מפגיעת ראש). החובשים מכניסים עירוי.','WHOLE BLOOD','דם מלא',"Field.give('blood')", function(){ return ((X().c || {}).fluids || []).length; }]
  ]},
  { k:'A', en:'AIRWAY', he:'נתיב אוויר', sub:['Talk to them. Basic steps only.','דברו אליהם. פעולות בסיסיות בלבד.'], items:[
    ['p_a1','Airway checked','נתיב אוויר נבדק','Does the casualty speak in full sentences? Stridor, gurgling, face or neck injury?','האם מדבר במשפטים שלמים? סטרידור, חרחור, פגיעת פנים או צוואר?',null,null,null, function(){ return !!((X().a || {}).status); }],
    ['p_a2','Basic airway only','נתיב אוויר בסיסי בלבד','Open mouth, suction, sit up or recovery position. No head tilt if spine injury is suspected.','פתיחת פה, שאיבה, ישיבה או שכיבה על הצד. בלי הטיית ראש בחשד לעמוד שדרה.']
  ]},
  { k:'R', en:'BREATHING', he:'נשימה', sub:['Rate, saturation, oxygen, chest.','קצב, סטורציה, חמצן, חזה.'], items:[
    ['p_r1','Breathing rate','קצב נשימה','Count for 30 seconds. Not breathing: BVM.','ספרו 30 שניות. לא נושם: אמבו ומסכה.','TAP BREATHS','הקישו נשימות',"Field.tapStart('rr')", function(){ return vitalsHave('rr'); }],
    ['p_r2','Oxygen if indicated','חמצן לפי התוויה','Chest injury, shock, head injury, distress. BVM only if SpO₂ 88 or less after basic care.','פגיעת חזה, הלם, פגיעת ראש, מצוקה. אמבו רק בסטורציה 88 ומטה אחרי טיפול בסיסי.',null,null,null, function(){ return !!((X().b || {}).oxygen); }],
    ['p_r3','Chest exposed and looked at','חזה נחשף ונבדק','Wounds, bruising, shape. Open wound: 3-side dressing. No needle, no chest seal.','פצעים, חבלה, צורה. פצע פתוח: חבישה משלושה צדדים. בלי מחט ובלי אטם.']
  ]},
  { k:'E', en:'EXPOSURE + EVACUATION', he:'חשיפה ופינוי', sub:['Complete the exam, keep warm, load, report.','השלמת בדיקה, חימום, העמסה, דיווח.'], items:[
    ['p_e1','Fully undressed and rolled','הפשטה מלאה והפיכה','Everything off, including boots and underwear. No hidden wounds.','הכל מוסר, כולל נעליים ותחתונים. אין פצעים נסתרים.'],
    ['p_e2','Head, neck, pelvis','ראש, צוואר, אגן','Collar if spine injury suspected (not for penetrating neck wound). Pelvic binder at the trochanters.','צווארון בחשד לעמוד שדרה (לא בפצע חודר בצוואר). מקבע אגן בגובה הטרוכנטרים.',null,null,null],
    ['p_e3','Covered and warm','מכוסים וחמים','Blanket, active warming if under 36 °C.','שמיכה, חימום אקטיבי מתחת ל-36 מעלות.',null,null,null, function(){ return !!((X().e || {}).hypothermiaPrevention); }],
    ['p_e4','On the stretcher','על האלונקה','Strapped, covered, tubes secured.','קשור, מכוסה, צנרת מקובעת.'],
    ['p_e5','Team huddle: urgency and plan','חיתוך מצב: דחיפות ותוכנית','Say it aloud: urgency of evacuation, plan, who does what.','אמרו בקול: דחיפות פינוי, תוכנית, מי עושה מה.'],
    ['p_e6','Medical report sent','דיווח רפואי הועבר','MIST+: what happened, injuries, signs, treatment.','MIST+: מה קרה, פציעות, סימנים, טיפול.','HANDOFF','העברה','FormUI.handoff()'],
    ['p_e7','Form 101 completed','טופס 101 הושלם','Digital or paper. Required for every casualty.','דיגיטלי או ידני. חובה לכל נפגע.']
  ]}
];
var SECONDARY = [
  { k:'C', en:'CIRCULATION', he:'מחזור דם', sub:['Shock again, access, TXA, tourniquets.','הלם שוב, גישה, TXA, חוסמי עורקים.'], items:[
    ['s_c1','Shock re-checked, volume continues','הלם נבדק שוב, החזר נפח ממשיך','Stop and reassess after every unit. More only if still in deep shock.','עצרו והעריכו אחרי כל מנה. עוד רק אם עדיין בהלם עמוק.','WHOLE BLOOD','דם מלא',"Field.give('blood')"],
    ['s_c2','IV or bone access secured','גישה לווריד או לעצם מקובעת','Max 2 tries by a medic, 2 by senior, then bone. Never pull the line when moving.','עד שני ניסיונות חובש, שניים בכיר, ואז עצם. לא לשלוף בהעברה.', null, null, null, function(){ return ((X().c || {}).ivAccess || []).length; }],
    ['s_c3','TXA 1 g','TXA 1 גרם','Deep shock or penetrating torso or junction wound, within 3 hours.','הלם עמוק או פצע חודר בגו או באזור מעבר, תוך 3 שעות.','GIVE TXA','תנו TXA',"Field.give('txa')", function(){ return medGiven(/^TXA/i); }],
    ['s_c4','Tourniquets reassessed, converted if possible','חוסמי עורקים נבדקו, הומרו אם אפשר','Only after bleeding control and shock treatment.','רק אחרי שליטה בדימום וטיפול בהלם.'],
    ['s_c5','Thigh fracture: Thomas splint','שבר בירך: סד תומס','Senior only, neurovascular check before and after.','מטפל בכיר בלבד, בדיקה נוירווסקולרית לפני ואחרי.'],
    ['s_c6','Second IV for shock casualty','עירוי שני לפצוע בהלם','Do not delay evacuation for it.','לא מעכבים פינוי בגללו.']
  ]},
  { k:'A', en:'AIRWAY', he:'נתיב אוויר', sub:['Re-check. Conservative first.','בדיקה חוזרת. קודם שמרני.'], items:[
    ['s_a1','Airway re-assessed','נתיב אוויר נבדק שוב','Conservative care or by indication. Advanced airway is rare and needs a team.','טיפול שמרני או לפי התוויה. נתיב מתקדם נדיר ודורש צוות.',null,null,null]
  ]},
  { k:'R', en:'BREATHING', he:'נשימה', sub:['Oxygen, ventilator, chest drain only if needed.','חמצן, מנשם, נקז חזה רק לפי צורך.'], items:[
    ['s_r1','Oxygen','חמצן','Keep SpO₂ at 94 or more when possible.','שמרו על סטורציה 94 ומעלה כשאפשר.',null,null,null, function(){ return !!((X().b || {}).oxygen); }],
    ['s_r2','Ventilated casualty: ventilator, bite block, ETCO₂','מונשם: מנשם, מגן נשיכה, ETCO₂','ETCO₂ target 30 to 35. Gastric tube. Check tube depth.','יעד ETCO₂ 30 עד 35. זונדה. בדקו עומק טובוס.'],
    ['s_r3','Chest drain only if needed','נקז חזה רק לפי צורך','Ventilated chest casualty, or all four: one-sided sign, worsening, SpO₂ 88 or less, 2 h after injury.','פצוע חזה מונשם, או כל ארבעת: סימן חד צדדי, החמרה, סטורציה 88 ומטה, שעתיים מהפציעה.']
  ]},
  { k:'E', en:'EVERYTHING ELSE', he:'כל השאר', sub:['Pain, infection, head to toe, splints, 101.','כאב, זיהום, מראש עד רגל, קיבועים, 101.'], items:[
    ['s_e1','Pain assessed and treated','כאב הוערך וטופל','Ketamine 25 mg IV first. Morphine 5 mg (2 mg in shock). Pills if they can swallow.','קטמין 25 מ״ג IV קודם. מורפין 5 מ״ג (2 בהלם). כדורים אם יכולים לבלוע.','KETAMINE','קטמין',"Field.give('ket')", function(){ return medGiven(/קטמין|פנטניל|מורפין|אופטלגין|פרצטמול/); }],
    ['s_e2','Wounds washed, dressed, antibiotic','פצעים נשטפו, נחבשו, אנטיביוטיקה','Irrigate. Ceftriaxone 2 g IV if evacuation over 1 h; belly or head: add metronidazole.','שטיפה. צפטריאקסון 2 גרם IV אם פינוי מעל שעה; בטן או ראש: הוסיפו מטרונידזול.','CEFTRIAXONE','צפטריאקסון',"Field.give('cef')", function(){ return medGiven(/צפטריאקסון|ceftriaxone/i); }],
    ['s_e3','GCS, limb movement, pupils','GCS, תנועת גפיים, אישונים','Record eye, verbal, motor separately.','רשמו עיניים, דיבור ומוטורי בנפרד.',null,null,null, function(){ return (X().d || {}).gcs != null; }],
    ['s_e4','Head to toe exam, treat as you go','סריקה מראש עד רגל, טיפול תוך כדי','Every injury found is treated.','כל פציעה שנמצאת מטופלת.'],
    ['s_e5','Fractures splinted, all splints checked','שברים קובעו, כל הקיבועים נבדקו','SAM splint. Re-check the circulation line.','סד SAM. בדקו שוב את קו הזרימה.'],
    ['s_e6','Stress reaction checked','תגובת דחק נבדקה','Calm, explain, keep talking.','הרגעה, הסבר, המשיכו לדבר.'],
    ['s_e7','Form 101 and second medical report','טופס 101 ודיווח רפואי חוזר','Same format: what happened, injuries, shock, treatment.','אותו מבנה: מה קרה, פציעות, הלם, טיפול.','HANDOFF','העברה','FormUI.handoff()']
  ]},
  { k:'P', en:'PROLONGED FIELD CARE', he:'טיפול מתמשך', sub:['Only when evacuation is delayed.','רק כשהפינוי מתעכב.'], items:[
    ['s_p1','Vitals logged on schedule','מדדים נרשמים בקביעות','Every 15 min if urgent, every hour if not.','כל 15 דקות בדחוף, כל שעה בלא דחוף.','TAP PULSE','הקישו דופק',"Field.tapStart('pulse')"],
    ['s_p2','Repeat doses on time','מנות חוזרות בזמן','Ketamine, midazolam, morphine, antibiotic every 8 h.','קטמין, מידזולם, מורפין, אנטיביוטיקה כל 8 שעות.'],
    ['s_p3','Gastric tube, urine catheter','זונדה וקטטר שתן','Ventilated casualty. Not life-saving: only if time allows.','פצוע מונשם. לא מציל חיים: רק אם יש זמן.'],
    ['s_p4','Pressure points, warmth, positions','נקודות לחץ, חום, תנוחה','Pad heels, shoulders, tailbone. Turn when you can.','ריפוד עקבים, כתפיים, עצם הזנב. הפכו כשאפשר.']
  ]}
];

Field._xs = 'primary'; Field._xo = {};
function done(it){ var m = (X().xcare || {})[it[0]]; if (m) return m; return it[8] && it[8]() ? true : false; }

function groupsHtml(sec){
  var all = sec ? SECONDARY : PRIMARY, pf = sec ? 's' : 'p', firstOpen = null, h = '<div class="xc-list">';
  // Open/closed state belongs to ONE casualty: switching patient resets it. The default open group is chosen once
  // (so ticking the last row of a group does not collapse it under the medic's thumb).
  if (Field._xcid !== W._casualtyEditId){ Field._xcid = W._casualtyEditId; Field._xo = {}; Field._xfo = {}; }
  Field._xfo = Field._xfo || {};
  if (Field._xfo[pf] === undefined){
    all.forEach(function(g){ if (firstOpen == null && g.items.some(function(it){ return !done(it); })) firstOpen = g.k; });
    Field._xfo[pf] = firstOpen || '';
  }
  firstOpen = Field._xfo[pf];
  all.forEach(function(g){
    var n = g.items.filter(done).length, tot = g.items.length, key = pf + g.k;
    var open = Field._xo[key] != null ? Field._xo[key] : (g.k === firstOpen);
    h += '<section class="xc-g ' + COL[g.k] + (open ? ' open' : '') + (n === tot ? ' all' : '') + '">'
      + '<button class="xc-gh" aria-expanded="' + open + '" onclick="Field.xcOpen(\'' + key + '\',' + (open ? 0 : 1) + ')"><span class="xc-let">' + (g.k === 'P' ? 'PFC' : g.k) + '</span><span class="xc-gt"><b>' + L(g.en, g.he) + '</b><small>' + L(g.sub[0], g.sub[1]) + '</small></span><span class="xc-pr">' + (n === tot ? ico('check', 24) : '') + n + '/' + tot + '</span></button>';
    if (open){
      h += '<div class="xc-items">';
      g.items.forEach(function(it){
        var d = done(it), manual = (X().xcare || {})[it[0]], auto = d && !manual;
        h += '<div class="xc-i' + (d ? ' done' : '') + '"><button class="xc-row" role="checkbox" aria-checked="' + !!d + '" onclick="Field.xcToggle(\'' + it[0] + '\')"><span class="xc-box">' + (d ? ico('check', 26) : '') + '</span><span class="xc-t"><b>' + L(it[1], it[2]) + '</b><small>' + L(it[3], it[4]) + '</small>' + (manual && manual !== true ? '<em>' + L('DONE ','בוצע ') + hhmm(manual) + '</em>' : (auto ? '<em>' + L('FROM THE RECORD','מתוך התיק') + '</em>' : '')) + '</span></button>'
          + (it[7] ? '<button class="xc-act" onclick="' + it[7] + '">' + L(it[5], it[6]) + '</button>' : '') + '</div>';
      });
      h += '</div>';
    }
    h += '</section>';
  });
  return h + '</div>';
}
Field.xcareGroups = groupsHtml;
Field.xcareHtml = function(){
  var sec = Field._xs === 'secondary';
  var tabs = '<div class="xc-tabs" role="tablist">'
    + '<button role="tab" aria-selected="' + !sec + '" class="' + (!sec ? 'on' : '') + '" onclick="Field.xcStage(\'primary\')"><b>' + L('PRIMARY SURVEY','סקר ראשוני') + '</b><small>X · C · A · R · E</small></button>'
    + '<button role="tab" aria-selected="' + sec + '" class="' + (sec ? 'on' : '') + '" onclick="Field.xcStage(\'secondary\')"><b>' + L('SECONDARY SURVEY','סקר שניוני') + '</b><small>C · A · R · E · PFC</small></button></div>';
  return '<div class="f-h">' + L('X-CARE PROTOCOL','פרוטוקול X-CARE') + '</div>' + tabs + groupsHtml(sec);
};
Field.xcStage = function(s){ Field._xs = s; Field._xo = {}; Field._xfo = {}; W.MedHost.renderIncidentPage(); };
Field.xcOpen = function(key, v){ Field._xo[key] = !!v; W.MedHost.renderIncidentPage(); };
Field.xcToggle = function(k){
  var Xo = X(); if (!Xo) return;
  var cur = PRIMARY.concat(SECONDARY).reduce(function(a, g){ return a || g.items.filter(function(i){ return i[0] === k; })[0]; }, null);
  if (!Xo.xcare || !Xo.xcare[k]) if (cur && cur[8] && cur[8]()){ if (Field.toast) Field.toast(L('Already done in the record. Undo it there.','כבר בוצע לפי התיק. בטלו אותו שם.'), null); return; }
  if (W.pushMedHistory) W.pushMedHistory();
  Xo.xcare = Xo.xcare || {};
  var all = PRIMARY.concat(SECONDARY), it = null; all.forEach(function(g){ g.items.forEach(function(i){ if (i[0] === k) it = i; }); });
  if (Xo.xcare[k]) delete Xo.xcare[k];
  else {
    Xo.xcare[k] = new Date().toISOString();
    if (it && W.addTimestampedAction) W.addTimestampedAction(k.charAt(0) === 'p' && /_x/.test(k) ? 'x' : /_c/.test(k) ? 'c' : /_a/.test(k) ? 'a' : /_r/.test(k) ? 'b' : 'e', 'X-CARE: ' + L(it[1], it[2]), '');
  }
  W.MedHost.triggerAutoSave(); W.MedHost.renderIncidentPage();
};
})();
