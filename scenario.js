/* Demo scenario: vehicle ramming + shooting at a bus stop (6 casualties, all triage categories).
   All names and IDs are fictional. Times are relative to page load so clocks and timers look live,
   and every clock-time string is derived from the same instant so the record never contradicts itself. */
(function(){
  var now = Date.now();
  var iso  = function(minAgo){ return new Date(now - minAgo * 60000).toISOString(); };
  var hhmm = function(minAgo){ var d = new Date(now - minAgo * 60000); return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); };

  var emptyX = function(){ return {
    x:{tourniquets:[],pressureDressings:[],hemostatic:[],woundPacking:[]},
    a:{status:'',interventions:[]},
    b:{respiratoryRate:null,tubeThora:null,oxygen:null},
    c:{pulseCharacter:'',capRefill:null,ivAccess:[],fluids:[]},
    d:{avpu:'',gcs:null,pupils:{left:{size:null,reactive:null},right:{size:null,reactive:null}},motorFunction:{}},
    e:{hypothermiaPrevention:'',medications:[],notes:''}
  }; };
  var vit = function(minAgo, o){
    var v = Object.assign({ t:iso(minAgo), time:iso(minAgo), source:'manual', pulse:null, radialPulse:null, bpSys:null, bpDia:null, spo2:null, etco2:null, rr:null, temp:null }, o);
    v.bp = v.bpSys != null ? v.bpSys + '/' + (v.bpDia || 0) : '';
    return v;
  };
  var tl  = function(minAgo, category, action, details){ return { time:iso(minAgo), category:category, action:action, details:details || '' }; };
  var med = function(minAgo, drug, dose, route){ return { drug:drug, name:drug, dose:dose, route:route, time:iso(minAgo) }; };
  var sec = function(){ return { headToToe:{}, o2Flow:null, tqReeval:[], structured:{} }; };
  var ts  = function(minAgo){ return { toDate:function(){ return new Date(now - minAgo * 60000); } }; };

  // ── A · RED · GSW thigh + right chest + pelvis, in haemorrhagic shock ──────────────────────
  var a = emptyX();
  a.x.tourniquets.push({ site:'r_thigh', time:iso(14) });
  a.x.hemostatic.push({ label:'המוסטטי — אריזת פצע מפשעה', site:'pelvis', time:iso(12) });
  a.a.status = 'clear';
  a.b.respiratoryRate = 24;
  a.b.oxygen = { side:null, time:iso(10) };
  a.b.o2Lpm = 15; a.b.o2StartTime = iso(10);
  // chest wound, spontaneously breathing: supportive care only (oxygen, position, analgesia). No needle decompression or chest seal in this protocol.
  a.c.pulseCharacter = 'weak'; a.c.capRefill = 4.2;
  a.c.ivAccess.push({ site:'יד R', time:iso(9) });
  a.c.fluids.push({ type:'דם מלא', volume:500, time:iso(7) });
  a.d.avpu = 'V'; a.d.gcs = 13; a.d.gcsDetail = { eye:3, verbal:4, motor:6 };
  a.d.pupils = { left:{ size:3, reactive:true }, right:{ size:3, reactive:true } };
  a.b.chestChecked = true; a.x.noMassiveHemorrhage = false;
  a.e.hypothermiaPrevention = 'HPMK';
  a.e.pelvicBinder = { site:'greater trochanter', time:iso(10) };
  a.e.ageYears = 30; a.e.weightKg = 80;
  a.e.sex = 'M'; a.e.allergies = 'לא ידוע'; a.e.npo = true; a.e.lastOral = 'לא ידוע'; a.e.timeOfInjury = iso(16);
  a.e.evacPlan = 'מרכז טראומה';
  a.e.medications.push(med(8, 'TXA', '1g', 'IV'));
  a.e.medications.push(med(5, 'קטמין', '25mg', 'IV'));

  // ── B · RED · penetrating head wound, GCS 7, unequal pupils, airway at risk ───────────────
  var b = emptyX();
  b.a.status = 'compromised';
  b.a.interventions.push({ type:'NPA', time:iso(10) });
  b.a.interventions.push({ type:'SGA (i-gel)', time:iso(4) });
  // ventilated by BVM (through the i-gel) with 15 L oxygen: no separate NRB entry
  b.b.respiratoryRate = 20; b.b.bvm = { time:iso(5) };
  b.b.oxygen = { side:null, time:iso(5) }; b.b.o2Lpm = 15; b.b.o2StartTime = iso(5);
  b.c.pulseCharacter = 'normal'; b.c.capRefill = 2;
  b.c.ivAccess.push({ site:'IO hum-L', time:iso(7) });
  b.d.avpu = 'P'; b.d.gcs = 7; b.d.gcsDetail = { eye:2, verbal:2, motor:3 };
  b.d.pupils = { left:{ size:5, reactive:false }, right:{ size:3, reactive:true } };
  b.x.noMassiveHemorrhage = true; b.b.chestChecked = true;
  b.e.hypothermiaPrevention = 'blanket';
  b.e.ageYears = 45; b.e.weightKg = 65;
  b.e.sex = 'F'; b.e.allergies = 'לא ידוע'; b.e.npo = true; b.e.lastOral = 'לא ידוע'; b.e.timeOfInjury = iso(12);
  b.e.evacPlan = 'נוירוכירורגיה (תלוי משאבים)';

  // ── C · YELLOW · GSW left forearm + abdomen, compensated ──────────────────────────────────
  var c = emptyX();
  c.x.pressureDressings.push({ label:'תחבושת לחץ — אמה L', site:'l_forearm', time:iso(15) });
  c.a.status = 'clear';
  c.b.respiratoryRate = 20;
  c.c.pulseCharacter = 'normal'; c.c.capRefill = 2;
  c.c.ivAccess.push({ site:'יד R', time:iso(10) });
  c.d.avpu = 'A'; c.d.gcs = 15; c.d.gcsDetail = { eye:4, verbal:5, motor:6 };
  c.d.pupils = { left:{ size:3, reactive:true }, right:{ size:3, reactive:true } };
  c.b.chestChecked = true;
  c.e.hypothermiaPrevention = 'blanket';
  c.e.ageYears = 22; c.e.weightKg = 75;
  c.e.sex = 'M'; c.e.allergies = 'ללא אלרגיות ידועות'; c.e.npo = true; c.e.lastOral = 'לפני כ-3 שעות'; c.e.timeOfInjury = iso(17);
  c.e.evacPlan = 'פינוי מהיר לחדר ניתוח';
  c.e.medications.push(med(6, 'קטמין', '25mg', 'IV'));

  // ── D · YELLOW · closed tib/fib fracture (vehicle strike), alert ──────────────────────────
  var d = emptyX();
  d.a.status = 'clear'; d.b.respiratoryRate = 18;
  d.c.pulseCharacter = 'normal'; d.c.capRefill = 2;
  d.d.avpu = 'A'; d.d.gcs = 15; d.d.gcsDetail = { eye:4, verbal:5, motor:6 };
  d.d.pupils = { left:{ size:3, reactive:true }, right:{ size:3, reactive:true } };
  d.b.chestChecked = true; d.x.noMassiveHemorrhage = true;
  d.e.hypothermiaPrevention = 'blanket';
  d.e.ageYears = 60; d.e.weightKg = 85;
  d.e.sex = 'M'; d.e.allergies = 'ללא אלרגיות ידועות'; d.e.anticoag = 'לא ידוע'; d.e.timeOfInjury = iso(10);
  d.e.evacPlan = 'פינוי לאורתופדיה';
  d.e.medications.push(med(7, 'קטמין', '50mg', 'IM'));

  // ── E · GREEN · minor hand laceration, walking ────────────────────────────────────────────
  var e = emptyX();
  e.a.status = 'clear'; e.b.respiratoryRate = 16; e.d.avpu = 'A'; e.d.gcs = 15; e.d.gcsDetail = { eye:4, verbal:5, motor:6 };
  e.d.pupils = { left:{ size:3, reactive:true }, right:{ size:3, reactive:true } };
  e.b.chestChecked = true; e.x.noMassiveHemorrhage = true; e.e.painDeclined = false;
  e.e.ageYears = 17; e.e.weightKg = 55;
  e.e.sex = 'F'; e.e.allergies = 'ללא אלרגיות ידועות'; e.e.timeOfInjury = iso(8);

  // ── F · BLACK · no breathing after airway opened, no carotid pulse ────────────────────────
  var f = emptyX();
  f.a.status = 'clear'; f.a.interventions.push({ type:'הרמת סנטר', time:iso(9) });
  f.b.respiratoryRate = 0; f.d.avpu = 'U'; f.d.gcs = 3; f.d.gcsDetail = { eye:1, verbal:1, motor:1 };
  f.e.sex = 'M'; f.e.allergies = 'לא ידוע'; f.e.timeOfInjury = iso(11); f.e.noSignsOfLifeAt = iso(8);
  f.d.pupils = { left:{ size:6, reactive:false }, right:{ size:6, reactive:false } };

  var list = [
    { _docId:'demo_c1', id:'demo_c1', name:'נפגע א׳ — גבר, כבן 30', idNumber:'', triageColor:'red', moi:'gsw',
      injuredRegions:['r_thigh','chest_r','pelvis'],
      injuries:[{region:'r_thigh',side:'front',type:'hemorrhage',severity:'severe',notes:''},
                {region:'chest_r',side:'front',type:'penetrating',severity:'severe',notes:''},
                {region:'pelvis',side:'front',type:'hemorrhage',severity:'moderate',notes:''}],
      treatments:[{region:'r_thigh',side:'front',type:'tourniquet',time:hhmm(14)},
                  {region:'pelvis',side:'front',type:'hemostatic',time:hhmm(12)}],
      xabcde:a, evacPriority:'immediate', painScore:7, avpu:'V', pulse:132, spo2:95, rr:24, bpSys:84, bpDia:50, temp:35.4,
      vitalsHistory:[
        vit(13,{pulse:138,bpSys:78,bpDia:44,spo2:88,rr:30,temp:35.6,radialPulse:'weak',painScore:8,avpu:'V'}),
        vit(8, {pulse:134,bpSys:82,bpDia:48,spo2:93,rr:26,temp:35.5,radialPulse:'weak',painScore:8,avpu:'V'}),
        vit(3, {pulse:132,bpSys:84,bpDia:50,spo2:95,rr:24,temp:35.4,radialPulse:'weak',painScore:7,avpu:'V'})],
      timeline:[tl(15,'injury','סימון פציעה — ירך R','hemorrhage'),
                tl(14,'x','ח"ע — ירך R',''),
                tl(12,'x','המוסטטי — אריזת פצע מפשעה',''),
                tl(11,'b','אטם חזה מאוורר — חזה R',''),
                tl(10,'b','דקירת מחט ימין (10–14G, אורך 8 ס״מ, צלע 5 אקסילרי קדמי / צלע 2 אמצע-הבריח) — שחרור אוויר, SpO₂ משתפר',''),
                tl(10,'b','חמצן 15L/דק׳ — מסכת NRB',''),
                tl(10,'e','מקבע אגן (greater trochanter)',''),
                tl(9,'c','גישה ורידית: יד R',''),
                tl(8,'e','TXA 1g IV',''),
                tl(7,'c','נוזלים: 500ml דם מלא',''),
                tl(5,'e','קטמין 25mg IV','')],
      secondarySurvey:sec(), examsHistory:[], timestamp:ts(16) },

    { _docId:'demo_c2', id:'demo_c2', name:'נפגע ב׳ — אישה, כבת 45', idNumber:'', triageColor:'red', moi:'gsw',
      injuredRegions:['head'],
      injuries:[{region:'head',side:'front',type:'penetrating',severity:'severe',notes:''}],
      treatments:[], xabcde:b, evacPriority:'immediate', painScore:null, avpu:'P', pulse:96, spo2:98, rr:20, bpSys:128, bpDia:84, temp:36.1,
      vitalsHistory:[vit(9,{pulse:92,bpSys:132,bpDia:88,spo2:93,rr:12,temp:36.2,etco2:46,radialPulse:'strong',avpu:'P'}),
                     vit(6,{pulse:94,bpSys:130,bpDia:86,spo2:94,rr:10,temp:36.2,etco2:48,radialPulse:'strong',avpu:'P'}),
                     vit(2,{pulse:96,bpSys:128,bpDia:84,spo2:98,rr:20,temp:36.1,etco2:38,radialPulse:'strong',avpu:'P'})],
      timeline:[tl(11,'injury','סימון פציעה — ראש','penetrating'),
                tl(10,'a','התערבות נתיב אוויר: NPA',''),
                tl(8,'d','ראש מוגבה 30° · אישונים: שמאל 5 מ״מ לא מגיב',''),
                tl(7,'c','גישה ורידית: IO hum-L',''),
                tl(5,'b','התחלת הנשמה עם אמבו ומסיכה',''),
                tl(5,'b','חמצן 15L/דק׳ דרך BVM',''),
                tl(4,'a','SGA (i-gel)',''),
                tl(2,'b','EtCO₂ ירד מ-48 ל-38 mmHg (הנשמה 20/דק׳)','')],
      secondarySurvey:sec(), examsHistory:[], timestamp:ts(12) },

    { _docId:'demo_c3', id:'demo_c3', name:'נפגע ג׳ — גבר, כבן 22', idNumber:'', triageColor:'yellow', moi:'gsw',
      injuredRegions:['l_forearm','abdomen_l'],
      injuries:[{region:'l_forearm',side:'front',type:'hemorrhage',severity:'moderate',notes:''},
                {region:'abdomen_l',side:'front',type:'penetrating',severity:'moderate',notes:''}],
      treatments:[{region:'l_forearm',side:'front',type:'pressureDressing',time:hhmm(15)},
                  {region:'abdomen_l',side:'front',type:'bandage',time:hhmm(14)}],
      xabcde:c, evacPriority:'urgent', painScore:4, avpu:'A', pulse:100, spo2:97, rr:20, bpSys:118, bpDia:76, temp:36.6,
      vitalsHistory:[vit(10,{pulse:108,bpSys:116,bpDia:74,spo2:97,rr:22,temp:36.5,radialPulse:'strong',painScore:7,avpu:'A'}),
                     vit(4,{pulse:100,bpSys:118,bpDia:76,spo2:97,rr:20,temp:36.6,radialPulse:'strong',painScore:4,avpu:'A'})],
      timeline:[tl(16,'injury','סימון פציעה — בטן L','penetrating'),
                tl(15,'x','תחבושת לחץ — אמה L',''),
                tl(14,'treatment','חבישת פצע בטן — בטן L',''),
                tl(10,'c','גישה ורידית: יד R',''),
                tl(8,'d','צום (NPO) — פצע חודר בבטן',''),
                tl(6,'e','קטמין 25mg IV','')],
      secondarySurvey:sec(), examsHistory:[], timestamp:ts(16) },

    { _docId:'demo_c4', id:'demo_c4', name:'נפגע ד׳ — גבר, כבן 60', idNumber:'', triageColor:'yellow', moi:'vehicle',
      injuredRegions:['r_shin'],
      injuries:[{region:'r_shin',side:'front',type:'fracture',severity:'moderate',notes:'סגור'}],
      treatments:[{region:'r_shin',side:'front',type:'splint',time:hhmm(6)}], xabcde:d, evacPriority:'urgent', painScore:5, avpu:'A', pulse:92, spo2:98, rr:18, bpSys:142, bpDia:90, temp:36.8,
      vitalsHistory:[vit(7,{pulse:96,bpSys:144,bpDia:92,spo2:98,rr:18,temp:36.8,radialPulse:'strong',painScore:7,avpu:'A'}),
                     vit(3,{pulse:92,bpSys:142,bpDia:90,spo2:98,rr:18,temp:36.8,radialPulse:'strong',painScore:5,avpu:'A'})],
      timeline:[tl(9,'injury','סימון פציעה — שוק R','fracture'),
                tl(7,'e','קטמין 50mg IM',''),
                tl(6,'treatment','קיבוע שוק R בסד · דופק דיסטלי נמשש · תחושה תקינה','')],
      secondarySurvey:sec(), examsHistory:[], timestamp:ts(10) },

    { _docId:'demo_c5', id:'demo_c5', formLevel:'quick', name:'נפגע ה׳ — אישה, כבת 17', idNumber:'', triageColor:'green', moi:'blunt',
      injuredRegions:['l_hand'],
      injuries:[{region:'l_hand',side:'front',type:'hemorrhage',severity:'mild',notes:''}],
      treatments:[{region:'l_hand',side:'front',type:'bandage',time:hhmm(5)}],
      xabcde:e, evacPriority:'routine', painScore:3, avpu:'A', pulse:88, spo2:99, rr:16, bpSys:118, bpDia:72, temp:36.7,
      vitalsHistory:[vit(6,{pulse:92,bpSys:120,bpDia:74,spo2:99,rr:17,temp:36.7,radialPulse:'strong',painScore:4,avpu:'A'}),
                     vit(2,{pulse:88,bpSys:118,bpDia:72,spo2:99,rr:16,temp:36.7,radialPulse:'strong',painScore:3,avpu:'A'})],
      timeline:[tl(7,'injury','סימון פציעה — כף יד L','hemorrhage'),tl(5,'treatment','חבישה — כף יד L',''),tl(2,'d','הערכה חוזרת: יציבה, הולכת',''),
                tl(1,'e','קטינה (17) — לידע הורה/אפוטרופוס; לבדוק חיסון טטנוס','')],
      secondarySurvey:sec(), examsHistory:[], timestamp:ts(8) },

    { _docId:'demo_c6', id:'demo_c6', formLevel:'quick', name:'נפגע ו׳ — גבר, גיל לא ידוע', idNumber:'', triageColor:'black', moi:'vehicle',
      injuredRegions:['head','chest_l'],
      injuries:[{region:'head',side:'front',type:'hemorrhage',severity:'severe',notes:''},
                {region:'chest_l',side:'front',type:'fracture',severity:'severe',notes:''}],
      treatments:[], xabcde:f, evacPriority:'', painScore:null, avpu:'U', pulse:0, spo2:null, rr:0, bpSys:null, bpDia:null, temp:null,
      vitalsHistory:[vit(8,{pulse:0,rr:0,avpu:'U'})],
      timeline:[tl(10,'injury','סימון פציעה — ראש','hemorrhage'),
                tl(9,'a','נתיב אוויר נפתח — אין נשימה ספונטנית',''),
                tl(8,'d','אין דופק קרוטידי, אין נשימה לאחר פתיחת נתיב אוויר · אישונים רחבים לא מגיבים — סווג שחור (קביעת מוות ע"י רופא)',''),
                tl(8,'d','ללא סימני חיים מאז זיהוי הנפגע · הערכה חוזרת כשיתפנו משאבים','')],
      secondarySurvey:sec(), examsHistory:[], timestamp:ts(11) }
  ];
  list.forEach(function(x){ x.reportedBy = 'demo'; x.reportedByName = 'חובש דמו'; });

  window.SHOWCASE_DEMO = {
    incident: {
      type:'medical', location:'תחנת אוטובוס, צומת קו 4', circumstances:'דריסה וירי בתחנת אוטובוס',
      environment:'עירוני, רחוב פתוח', threats:'הזירה אובטחה על ידי כוחות הביטחון', estCount:6,
      triggeredByName:'מוקד (דמו)', acknowledged:[], timestamp:ts(18)
    },
    casualties: list
  };
})();
