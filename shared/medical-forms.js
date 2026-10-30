/* ═══════════════════════════════════════════════════════════════
   shared/medical-forms.js — SINGLE SOURCE OF TRUTH for medical
   constants + pure exports shared by both shomer-ahi (beta) and
   magen-ahi (magen). Loaded BEFORE each app's own app.js.

   DO NOT duplicate these in beta/app.js or magen/app.js.
   Edit here → both apps update.

   Contents:
   - Constants: MOI_TYPES, BODY_LABELS, BURN_NINES, TRIAGE_COLORS,
     TRIAGE_STEPS, TREATMENT_ICONS
   - Pure helpers: sanitizeExport, spellDigits, fmtTime
   - Pure builders: generateForm101, generateRadioFormat,
     generateMISTPlusReport, calcBurnPercentage, getXABCDESummary,
     _getPatientWeight
   - MCI pure helpers: triageColorOf, calcTriageCounts

   Pure builders read these globals (populated by app.js during
   casualty form usage; both apps share the same schema):
     _casualtyName, _casualtyIdNumber, _casualtyMOI,
     _casualtyInjuries, _casualtyTreatments, _casualtyTimeline,
     _casualtyXABCDE, _casualtyVitals, _casualtyTriageColor,
     _casualtyPainScore, _casualtyVitalsInput
   ═══════════════════════════════════════════════════════════════ */

// ── HOST INTERFACE ─────────────────────────────────────────────
// Shared code calls app-specific helpers (Firestore writes, toast,
// autosave, re-render) via this indirection. Each host app must do
// Object.assign(window.MedHost, {...}) early in its init.
// Defaults are safe no-ops so shared code can run even pre-init.
window.MedHost = window.MedHost || {
  renderIncidentPage: function(){},
  triggerAutoSave:    function(){},
  save:               function(){},
  toast:              function(msg){ try{ console.log('[toast]', msg); }catch(_){} },
  // Firestore + identity hooks (each app wires what it needs):
  getDb:              function(){ return null; },
  getAlertId:         function(){ return (typeof _incidentAlertId!=='undefined')?_incidentAlertId:null; },
  getTeamId:          function(){ return null; }
};

// ─── Phase 5: cross-app casualty field reconciliation ───────────
// Beta writes `xabcde`, magen writes `xcare` — same XABCDE shape,
// different field names. Mirror both on every write so either
// reader sees data. Migration is additive: no field ever removed.
window.SA = window.SA || {};
window.SA.mirrorCasualtyXABCDE = function(data){
  if (!data || typeof data !== 'object') return data;
  if (data.xabcde && !data.xcare) data.xcare = data.xabcde;
  else if (data.xcare && !data.xabcde) data.xabcde = data.xcare;
  return data;
};
// Normalize a read-side casualty doc so whichever field is present
// becomes authoritative for consumers that expect either name.
window.SA.readCasualtyXABCDE = function(doc){
  if (!doc || typeof doc !== 'object') return null;
  return doc.xabcde || doc.xcare || null;
};

// ── BETA-SPECIFIC STATE STUBS (safe defaults for magen) ─────────
// These globals exist in beta/app.js only (declared there as `let`);
// attach safe defaults as window properties so shared code paths that
// reference them under magen don't ReferenceError. Beta's `let`
// declarations will shadow via the script declarative environment.
(function(){
  const g=window;
  if(typeof g._autoSaveDirty    ==='undefined') g._autoSaveDirty=false;
  if(typeof g._autoSaveInFlight ==='undefined') g._autoSaveInFlight=false;
  if(typeof g._autoSaveTimer    ==='undefined') g._autoSaveTimer=null;
  if(typeof g._autoSaveMaxWait  ==='undefined') g._autoSaveMaxWait=null;
  if(typeof g._autoSaveStatus   ==='undefined') g._autoSaveStatus='';
  if(typeof g.saveCasualtyData  !=='function')  g.saveCasualtyData=async function(){ /* magen no-op */ };
  // Beta-only helpers referenced by MCI/offline paths. Safe defaults for magen.
  if(typeof g._canWriteCloud        !=='function') g._canWriteCloud=function(){ return !!g.MedHost?.getDb?.(); };
  if(typeof g._upsertOfflineCasualty!=='function') g._upsertOfflineCasualty=function(){ /* no-op */ };
  if(typeof g._removeOfflineCasualty!=='function') g._removeOfflineCasualty=function(){ /* no-op */ };
  if(typeof g._vehicleRec           !=='function') g._vehicleRec=function(v){ return typeof v==='string'?{type:v,seats:null,litter:null}:(v||{type:'',seats:null,litter:null}); };
  if(typeof g._syncMciVehicles      !=='function') g._syncMciVehicles=function(){ /* no-op — magen uses its own vehicle fleet */ };
  if(typeof g._normalizeVehicleStatus!=='function')g._normalizeVehicleStatus=function(s){ return s||'enroute'; };
  if(typeof g._computeEtaCountdown  !=='function') g._computeEtaCountdown=function(){ return null; };
  // Beta's full-draft local snapshot helpers. Magen has its own per-field autosave.
  if(typeof g._writeLocalCasualtySnapshot!=='function') g._writeLocalCasualtySnapshot=function(){};
  if(typeof g._readLocalCasualtySnapshot !=='function') g._readLocalCasualtySnapshot=function(){ return null; };
  if(typeof g._clearLocalCasualtySnapshot!=='function') g._clearLocalCasualtySnapshot=function(){};
  if(typeof g._localCasualtyKey          !=='function') g._localCasualtyKey=function(id){ return 'magen_cas_'+(id||'new'); };
  if(typeof g._maybeRehydrateLocalDraft  !=='function') g._maybeRehydrateLocalDraft=function(){};
})();

// ── SHARED STATE (Stage 2) ─────────────────────────────────────
// Casualty-form + MCI + SABC wizard state moved here so BOTH apps
// read/write the same globals. Declared with `var` to avoid TDZ
// and to keep classic-script hoisting/shadow semantics predictable.
// NEVER redeclare these in app.js — just read/write them.
var _incidentAlertId     = (typeof _incidentAlertId    !=='undefined')?_incidentAlertId    :null;
var _incidentData        = (typeof _incidentData       !=='undefined')?_incidentData       :null;
var _incidentTab         = (typeof _incidentTab        !=='undefined')?_incidentTab        :'status';
var _incidentUpdatesUnsub    = (typeof _incidentUpdatesUnsub   !=='undefined')?_incidentUpdatesUnsub   :null;
var _incidentCasualtiesUnsub = (typeof _incidentCasualtiesUnsub!=='undefined')?_incidentCasualtiesUnsub:null;
var _incidentUpdates     = (typeof _incidentUpdates    !=='undefined')?_incidentUpdates    :[];
var _incidentCasualties  = (typeof _incidentCasualties !=='undefined')?_incidentCasualties :[];

// Casualty form state
var _casualtyRegions     = (typeof _casualtyRegions    !=='undefined')?_casualtyRegions    :new Set();
var _casualtyEditMode    = (typeof _casualtyEditMode   !=='undefined')?_casualtyEditMode   :false;
var _casualtyView        = (typeof _casualtyView       !=='undefined')?_casualtyView       :'front';
var _casualtyInjuries    = (typeof _casualtyInjuries   !=='undefined')?_casualtyInjuries   :[];
var _casualtyXABCDE      = (typeof _casualtyXABCDE     !=='undefined')?_casualtyXABCDE     :{
  x:{tourniquets:[],pressureDressings:[],hemostatic:[],woundPacking:[]},
  a:{status:'',interventions:[]},
  b:{respiratoryRate:null,tubeThora:null,oxygen:null},
  c:{pulseCharacter:'',capRefill:null,ivAccess:[],fluids:[]},
  d:{avpu:'',gcs:null,pupils:{left:{size:null,reactive:null},right:{size:null,reactive:null}},motorFunction:{}},
  e:{hypothermiaPrevention:'',medications:[],notes:''}
};
var _casualtyTimeline    = (typeof _casualtyTimeline   !=='undefined')?_casualtyTimeline   :[];
var _casualtyVitals      = (typeof _casualtyVitals     !=='undefined')?_casualtyVitals     :[];
var _casualtyTriageColor = (typeof _casualtyTriageColor!=='undefined')?_casualtyTriageColor:null;
var _casualtyActiveTab   = (typeof _casualtyActiveTab  !=='undefined')?_casualtyActiveTab  :'x';
// v3.43: pediatric mode override — null=auto (by age≤12), true=force on, false=force off
var _casualtyPedsOverride= (typeof _casualtyPedsOverride!=='undefined')?_casualtyPedsOverride:null;
function isPedsMode(){
  if(_casualtyPedsOverride===true)return true;
  if(_casualtyPedsOverride===false)return false;
  const age=_casualtyXABCDE?.e?.ageYears;
  return age!=null&&age<=12;
}
function togglePedsOverride(){
  const cur=isPedsMode();
  _casualtyPedsOverride=!cur;
  addTimestampedAction('e','מצב פדיאטרי: '+(!cur?'הופעל ידנית':'בוטל ידנית'),'');
  MedHost.triggerAutoSave();MedHost.renderIncidentPage();
}
if(typeof window!=='undefined'){window.isPedsMode=isPedsMode;window.togglePedsOverride=togglePedsOverride;}
var _triageWizardStep    = (typeof _triageWizardStep   !=='undefined')?_triageWizardStep   :0;
var _triageMode          = (typeof _triageMode         !=='undefined')?_triageMode         :false;
var _casualtyEditId      = (typeof _casualtyEditId     !=='undefined')?_casualtyEditId     :null;
var _selectedRegion      = (typeof _selectedRegion     !=='undefined')?_selectedRegion     :null;
var _casualtyTreatments  = (typeof _casualtyTreatments !=='undefined')?_casualtyTreatments :[];
var _pendingTreatmentType= (typeof _pendingTreatmentType!=='undefined')?_pendingTreatmentType:null;
var _casualtyPainScore   = (typeof _casualtyPainScore  !=='undefined')?_casualtyPainScore  :null;
var _xcareGuided         = (typeof _xcareGuided        !=='undefined')?_xcareGuided        :false;
var _xcareStep           = (typeof _xcareStep          !=='undefined')?_xcareStep          :0;
var _secondarySurvey     = (typeof _secondarySurvey    !=='undefined')?_secondarySurvey    :{headToToe:{},o2Flow:null,tqReeval:[]};
var _medRedoseTimers     = (typeof _medRedoseTimers    !=='undefined')?_medRedoseTimers    :[];
var _casualtyEvacPriority= (typeof _casualtyEvacPriority!=='undefined')?_casualtyEvacPriority:'';
var _casualtyVitalsInput = (typeof _casualtyVitalsInput!=='undefined')?_casualtyVitalsInput:{pulse:'',rr:'',spo2:'',bpSys:'',bpDia:'',temp:'',etco2:'',radialPulse:''};
var _casualtyName        = (typeof _casualtyName       !=='undefined')?_casualtyName       :'';
var _casualtyIdNumber    = (typeof _casualtyIdNumber   !=='undefined')?_casualtyIdNumber   :'';
var _casualtyMOI         = (typeof _casualtyMOI        !=='undefined')?_casualtyMOI        :null;

// MCI state
var _mciVehicles         = (typeof _mciVehicles        !=='undefined')?_mciVehicles        :[];
var _mciResources        = (typeof _mciResources       !=='undefined')?_mciResources       :{tourniquets:10,tubeThora:5,npa:8,ivKits:10,bandages:20,hemostatic:5,oxygen:3,blankets:5};
var _mciInited           = (typeof _mciInited          !=='undefined')?_mciInited          :false;
var _mciTriageFilter     = (typeof _mciTriageFilter    !=='undefined')?_mciTriageFilter    :null;
var _mciExpandedCard     = (typeof _mciExpandedCard    !=='undefined')?_mciExpandedCard    :null;
var _mciShowRapidTriage  = (typeof _mciShowRapidTriage !=='undefined')?_mciShowRapidTriage :false;
var _mciSearch           = (typeof _mciSearch          !=='undefined')?_mciSearch          :'';
var _mciMode             = (typeof _mciMode            !=='undefined')?_mciMode            :'triage';
var _mciModeManuallySet  = (typeof _mciModeManuallySet !=='undefined')?_mciModeManuallySet :false;
var _mciActionFilter     = (typeof _mciActionFilter    !=='undefined')?_mciActionFilter    :null;
var _mciRapidStep        = (typeof _mciRapidStep       !=='undefined')?_mciRapidStep       :0;
var _mciRapidName        = (typeof _mciRapidName       !=='undefined')?_mciRapidName       :'';
var _mciRapidCounts      = (typeof _mciRapidCounts     !=='undefined')?_mciRapidCounts     :{red:0,yellow:0,green:0,gray:0,black:0};

// SABC wizard state
var _sabcStep            = (typeof _sabcStep           !=='undefined')?_sabcStep           :'S';
var _sabcFindings        = (typeof _sabcFindings       !=='undefined')?_sabcFindings       :{
  s:{bleedingSource:null,controls:[]},
  a:{avpu:null,airwayThreat:null},
  b:{breathing:null,spo2:null,chestFinding:null},
  c:{radialPulse:null,carotidPulse:null,bp:null},
  classification:null
};
var _sabcMode            = (typeof _sabcMode           !=='undefined')?_sabcMode           :true;
var _sabcRetrofitDocId   = (typeof _sabcRetrofitDocId  !=='undefined')?_sabcRetrofitDocId  :null;

// ── CONSTANTS ──────────────────────────────────────────────────
var BURN_NINES = {head:4.5,back_head:4.5,neck:1,back_neck:1,chest_r:4.5,chest_l:4.5,abdomen_r:4.5,abdomen_l:4.5,pelvis:1,upper_back_r:4.5,upper_back_l:4.5,lower_back_r:4.5,lower_back_l:4.5,r_upper_arm:2,r_forearm:1.5,r_hand:1,l_upper_arm:2,l_forearm:1.5,l_hand:1,back_r_upper_arm:2,back_r_forearm:1.5,back_r_hand:1,back_l_upper_arm:2,back_l_forearm:1.5,back_l_hand:1,r_thigh:4.5,r_shin:3,r_foot:1.5,l_thigh:4.5,l_shin:3,l_foot:1.5,back_r_thigh:4.5,back_r_shin:3,back_r_foot:1.5,back_l_thigh:4.5,back_l_shin:3,back_l_foot:1.5};

var BODY_LABELS = {'head':'ראש','neck':'צוואר','chest_r':'חזה R','chest_l':'חזה L','abdomen_r':'בטן R','abdomen_l':'בטן L','pelvis':'אגן','r_upper_arm':'זרוע R','r_forearm':'אמה R','r_hand':'כף יד R','l_upper_arm':'זרוע L','l_forearm':'אמה L','l_hand':'כף יד L','r_thigh':'ירך R','r_shin':'שוק R','r_foot':'כף רגל R','l_thigh':'ירך L','l_shin':'שוק L','l_foot':'כף רגל L','back_head':'עורף','back_neck':'עורף צוואר','upper_back_r':'גב עליון R','upper_back_l':'גב עליון L','spine':'עמוד שדרה','lower_back_r':'גב תחתון R','lower_back_l':'גב תחתון L','r_buttock':'עכוז R','l_buttock':'עכוז L','back_r_upper_arm':'זרוע R אחורי','back_l_upper_arm':'זרוע L אחורי','back_r_forearm':'אמה R אחורי','back_l_forearm':'אמה L אחורי','back_r_hand':'כף יד R אחורי','back_l_hand':'כף יד L אחורי','back_r_thigh':'ירך R אחורי','back_l_thigh':'ירך L אחורי','back_r_shin':'שוק R אחורי','back_l_shin':'שוק L אחורי'};

var TREATMENT_ICONS = {tourniquet:'🔴',pressureDressing:'⬜',tubeThora:'🩻',hemostatic:'🟧',woundPacking:'🟫',bandage:'🩹',needleDecompression:'💉',chestSeal:'🔵',splint:'🪵',pelvicBinder:'🦴',custom:'✏'};
var _txHe=t=>({tourniquet:'ח"ע',tubeThora:'נקז חזה',needleDecompression:'דקירת מחט (NDC)',chestSeal:'אטם חזה',splint:'קיבוע שבר',pelvicBinder:'מקבע אגן',pressureDressing:'תחבושת לחץ',hemostatic:'המוסטטי',woundPacking:'אריזת פצע',bandage:'חבישה'}[t]||t||'');

var TRIAGE_STEPS = [
  {q:'האם הנפגע מהלך?',yes:{color:'green',label:'🟢 ירוק — קל'},no:{next:1}},
  {q:'האם הנפגע נושם?',yes:{next:3},no:{next:2}},
  {q:'פתחת נתיב אוויר — האם נושם עכשיו?',yes:{color:'red',label:'🔴 אדום — מיידי'},no:{color:'black',label:'⬛ שחור — ללא סימני חיים'}},
  {q:'קצב נשימה מעל 30 לדקה?',yes:{color:'red',label:'🔴 אדום — מיידי'},no:{next:4}},
  {q:'האם יש דופק רדיאלי / CRT מתחת ל-2 שניות?',yes:{next:5},no:{color:'red',label:'🔴 אדום — מיידי'}},
  {q:'האם הנפגע מבצע פקודות?',yes:{color:'yellow',label:'🟡 צהוב — דחוי'},no:{color:'red',label:'🔴 אדום — מיידי'}}
];

var TRIAGE_COLORS = {red:'#e74c3c',yellow:'#f1c40f',green:'#2ecc71',black:'#333',gray:'#888'};

var MOI_TYPES = [
  {id:'gsw',icon:'🔫',label:'ירי'},
  {id:'shrapnel',icon:'💥',label:'רסיסים'},
  {id:'blast',icon:'💣',label:'הדף'},
  {id:'stab',icon:'🗡️',label:'דקירה'},
  {id:'blunt',icon:'🔨',label:'קהה'},
  {id:'fall',icon:'⬇️',label:'נפילה'},
  {id:'burn',icon:'🔥',label:'כוויה'},
  {id:'crush',icon:'🪨',label:'מעיכה'},
  {id:'vehicle',icon:'🚗',label:'רכב'},
  {id:'other',icon:'✏',label:'אחר'}
];

// ── PURE HELPERS ───────────────────────────────────────────────
// Spell numeric sequences digit-by-digit in Hebrew for radio readout
// over noisy nets. "140/80" -> "אחת-ארבע-אפס על שמונה-אפס". TCCC/IDF doctrine.
function spellDigits(s){
  const en=(typeof window!=='undefined'&&window.ShowcaseI18n&&window.ShowcaseI18n.lang==='en');
  const map=en?{'0':'zero','1':'one','2':'two','3':'three','4':'four','5':'five','6':'six','7':'seven','8':'eight','9':'nine'}:{'0':'אפס','1':'אחת','2':'שתיים','3':'שלוש','4':'ארבע','5':'חמש','6':'שש','7':'שבע','8':'שמונה','9':'תשע'};
  const txt=String(s??'');
  return txt.replace(/\d+/g,run=>run.split('').map(d=>map[d]).join('-')).replace(/\//g,en?' over ':' על ');
}

// Strips Unicode bidi overrides + control chars; neutralizes CSV/formula-
// injection prefixes (=+-@) by prepending apostrophe. Apply to every field
// flowing into clipboard, WhatsApp, print, or radio readout.
function sanitizeExport(s){
  let v=String(s??'').replace(/[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g,'');
  if(/^[=+\-@\t\r]/.test(v))v="'"+v;
  return v;
}

function fmtTime(iso){
  if(!iso)return'';
  const d=new Date(iso);
  return d.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
}

// ── CASUALTY-STATE HELPERS ─────────────────────────────────────
function _getPatientWeight(){
  return (typeof _casualtyXABCDE!=='undefined' && _casualtyXABCDE?.e?.weightKg)||null;
}

function calcBurnPercentage(){
  if(typeof _casualtyInjuries==='undefined')return 0;
  let total=0;
  _casualtyInjuries.filter(i=>i.type==='burn').forEach(i=>{
    total+=(BURN_NINES[i.region]||0);
  });
  return total;
}

function getXABCDESummary(key){
  if(typeof _casualtyXABCDE==='undefined')return'';
  const d=_casualtyXABCDE[key];
  if(!d)return'';
  if(key==='x'){const items=[];if(d.tourniquets?.length)items.push('ח"ע ×'+d.tourniquets.length);if(d.pressureDressings?.length)items.push('תחבושת');if(d.hemostatic?.length)items.push('המוסטטי');return items.join(', ');}
  if(key==='a'){return d.status?airwayLabelOut(d.status):'';}
  if(key==='b'){const items=[];if(d.respiratoryRate!==null&&d.respiratoryRate!==undefined)items.push(d.respiratoryRate+'/דק');if(d.tubeThora)items.push('נקז חזה');return items.join(', ');}
  if(key==='c'){const items=[];if(d.pulseCharacter)items.push({strong:'חזק',weak:'חלש',absent:'אין'}[d.pulseCharacter]);if(d.capRefill!==null&&d.capRefill!==undefined)items.push('CRT:'+d.capRefill+'s');if(d.ivAccess?.length)items.push('IV×'+d.ivAccess.length);return items.join(', ');}
  if(key==='d'){return d.avpu?'AVPU:'+d.avpu+(d.gcs?' GCS:'+d.gcs:''):'';}
  if(key==='e'){const items=[];if(d.hypothermiaPrevention)items.push(hypoLabelOut(d.hypothermiaPrevention));if(d.medications?.length)items.push(d.medications.length+' תרופות');return items.join(', ');}
  return '';
}

// ── FORM 101 (pure text export) ────────────────────────────────
function generateForm101(){
  const S=sanitizeExport;
  const name=S(((typeof _casualtyName!=='undefined'?_casualtyName:'')||'ללא שם').trim());
  const idNum=S((typeof _casualtyIdNumber!=='undefined'?_casualtyIdNumber:'').trim());
  const moiId=(typeof _casualtyMOI!=='undefined')?_casualtyMOI:null;
  const moiObj=MOI_TYPES.find(m=>m.id===moiId);
  const moiText=S(moiObj?moiObj.icon+' '+moiObj.label:'לא ידוע');
  const injArr=(typeof _casualtyInjuries!=='undefined')?_casualtyInjuries:[];
  const injuries=S(injArr.map(i=>bodyLabelOut(i.region)+' ('+({hemorrhage:'דימום',fracture:'שבר',burn:'כוויה',penetrating:'חודר'}[i.type]||'')+(i.side?', '+sideLabelOut(i.side):'')+')').join('\n  ')||'לא סומנו');
  const txArr=(typeof _casualtyTreatments!=='undefined')?_casualtyTreatments:[];
  const treatments=S(txArr.map(t=>bodyLabelOut(t.region)+' — '+(_txHe(t.type))+' ('+(t.time||'')+')').join('\n  ')||'ללא');
  const tlArr=(typeof _casualtyTimeline!=='undefined')?_casualtyTimeline:[];
  const timeline=S(tlArr.map(t=>{const time=t.time instanceof Date?t.time:new Date(t.time);return time.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit',second:'2-digit'})+' — '+outLR(t.action||'');}).join('\n  '));
  const xabcde=(typeof _casualtyXABCDE!=='undefined')?_casualtyXABCDE:{x:{},a:{},b:{},c:{},d:{},e:{medications:[]}};
  const meds=S((xabcde?.e?.medications||[]).map(m=>fmtHM(m.time)+' '+(m.drug||'')+' '+(m.dose||'')+' '+(m.route||'')).join('\n  ')||'ללא');
  const tqLines=S(tqOutLines(xabcde).join('\n  '));
  const fluidLines=S((xabcde?.c?.fluids||[]).map(f=>fmtHM(f.time)+' '+(f.type||'')+' '+(_hv(f.volume)?f.volume+'ml':'')+(f.unit?' יח׳ '+f.unit:'')+(f.abo?' '+f.abo:'')+(f.lot?' [Lot:'+f.lot+']':'')).join('\n  ')||'ללא');
  const vArr=(typeof _casualtyVitals!=='undefined')?_casualtyVitals:[];
  const vitals=S(vArr.map(v=>fmtHM(v.time)+' '+vitalsOutText(v)).join('\n  ')||'ללא');
  const ageWeight=[];
  if(xabcde?.e?.ageYears!=null)ageWeight.push(`גיל: ${xabcde.e.ageYears}`);
  if(sexOutName(xabcde?.e?.sex))ageWeight.push(`מין: ${sexOutName(xabcde.e.sex)}`);
  if(_getPatientWeight())ageWeight.push(`משקל: ${_getPatientWeight()}ק״ג`);
  const peb=xabcde?.e?.pelvicBinder?`\n  מקבע אגן (greater trochanter) ב-${fmtHM(xabcde.e.pelvicBinder.time)}`:'';
  const cco=xabcde?.a?.cervicalCollar?`\n  צווארון C-Collar ב-${fmtHM(xabcde.a.cervicalCollar.time)}`:'';
  const tube=xabcde?.b?.tubeThora?`\n  נקז חזה ${outLR(xabcde.b.tubeThora.side||'')} (צלע 4-5) ב-${fmtHM(xabcde.b.tubeThora.time)}`:'';
  const burnPct=calcBurnPercentage();
  const triageCol=(typeof _casualtyTriageColor!=='undefined')?_casualtyTriageColor:null;
  const triage=triageCol?triageOutName(triageCol):'לא נקבע';
  const xCareLabels={x:'X',c:'C',a:'A',b:'R',e:'E'};
  const xSummary=['x','c','a','b','e'].map(k=>`  ${xCareLabels[k]}: ${getXABCDESummary(k)||'—'}`).join('\n');
  return `╔══════════════════════════════════╗
║     טופס 101 דיגיטלי — שומר אחי     ║
╚══════════════════════════════════╝

📋 פרטים אישיים
  שם: ${name}${idNum?' | מ.א/ת.ז: '+idNum:''}${ageWeight.length?'\n  '+ageWeight.join(' | '):''}
  טריאז\': ${triage}${evacOutName(typeof _casualtyEvacPriority!=='undefined'?_casualtyEvacPriority:null)?' | פינוי: '+evacOutName(_casualtyEvacPriority):''}
  תאריך: ${new Date().toLocaleDateString('he-IL')} ${new Date().toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}

🔧 מנגנון פציעה: ${moiText}${injuryTimeOut(xabcde)?' | שעת פציעה '+fmtHM(injuryTimeOut(xabcde).t)+(injuryTimeOut(xabcde).approx?' (משוער, מסימון)':''):''}
${tqLines?'\n⏱ חוסם עורקים\n  '+tqLines+'\n':''}
🩸 פגיעות
  ${injuries}${burnPct>0?'\n  🔥 כוויה: '+burnPct+'%':''}

💊 טיפולים על הגוף
  ${treatments}${peb}${cco}${tube}

📊 X-CARE
${xSummary}

⏱ ציר זמן
  ${timeline||'ללא'}

סימנים חיוניים
  ${vitals}

הכרה: ${consciousnessOutText(xabcde)||'לא נבדקה'}

תרופות
  ${meds}

דם ונוזלים
  ${fluidLines}

═══ נוצר ע"י שומר אחי v2.0 ═══`;
}

// ── OUTPUT HELPERS (shared by MIST+, MIST, radio script, Form 101) ──
// Display only: Hebrew identifiers (drug names, region ids, enum keys) are never renamed.
// BODY_LABELS keeps its internal "R"/"L" suffix; outLR()/bodyLabelOut() turn it into ימין/שמאל for printed + spoken text.
function outLR(s){return String(s??'').replace(/(^|[\s(—])([RL])(?=$|[\s),.:;·—])/g,(m,p,c)=>p+(c==='R'?'ימין':'שמאל'));}
function bodyLabelOut(id){return outLR((typeof BODY_LABELS!=='undefined'&&BODY_LABELS[id])||id||'');}
function sideLabelOut(s){return({front:'קדמי',back:'אחורי',L:'שמאל',R:'ימין',left:'שמאל',right:'ימין'})[s]||outLR(s||'');}
function fmtHM(t){if(!t)return'';if(typeof t==='string'&&/^\d{1,2}:\d{2}$/.test(t.trim()))return t.trim();const d=new Date(t);return isNaN(d.getTime())?'':d.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit',hour12:false});}
function minsSince(t){const ms=new Date(t).getTime();return isNaN(ms)?null:Math.max(0,Math.round((Date.now()-ms)/60000));}
// null/undefined/''/NaN = not measured; 0 is a real value (apnoea, no pulse) and must never read as "missing".
function _hv(x){return x!==null&&x!==undefined&&x!==''&&!(typeof x==='number'&&isNaN(x));}
function _bpOut(v){if(!v)return null;if(_hv(v.bpSys))return v.bpSys+'/'+(_hv(v.bpDia)?v.bpDia:'—');return(_hv(v.bp)&&v.bp!=='-'&&v.bp!=='—/—')?String(v.bp):null;}
function airwayLabelOut(s){return({clear:'פתוח',compromised:'בסיכון',obstructed:'חסום'})[s]||s||'';}
function hypoLabelOut(m){return({HPMK:'HPMK — ערכת מניעת היפותרמיה',blanket:'שמיכה'})[m]||m||'';}
function triageOutName(c){return({red:'דחוף',yellow:'עדיפות שנייה',green:'לא דחוף',gray:'ממתין',black:'ללא סימני חיים'})[c]||'לא נקבע';}
// NATO evacuation categories: Urgent ≤1h, Priority ≤4h, Routine ≤24h.
function evacOutName(p){return({immediate:'דחוף (עד שעה)',urgent:'בעדיפות (עד 4 שעות)',routine:'שגרתי (עד 24 שעות)',expectant:'ממתין'})[p]||'';}
function vitalsOutText(v){
  if(!v)return'לא נמדדו';
  const p=['HR '+(_hv(v.pulse)?v.pulse+(v.pulse===0?' (אין דופק)':''):'—'),'RR '+(_hv(v.rr)?v.rr+(v.rr===0?' (אין נשימה)':''):'—'),'SpO₂ '+(_hv(v.spo2)?v.spo2+'%':'—'),'BP '+(_bpOut(v)||'—')];
  if(_hv(v.temp))p.push('T '+v.temp+'°');
  if(_hv(v.etco2))p.push('EtCO₂ '+v.etco2+' mmHg');
  if(v.radialPulse)p.push('רדיאלי '+(v.radialPulse==='absent'?'אין':v.radialPulse==='weak'?'חלש':'תקין'));
  return p.join(' · ');
}
function vitalsTrendOut(a,b){
  if(!a||!b||a===b)return'';
  const t=[];
  if(_hv(a.pulse)&&_hv(b.pulse)&&a.pulse!==b.pulse)t.push('HR '+a.pulse+' → '+b.pulse);
  const ba=_bpOut(a),bb=_bpOut(b);
  if(ba&&bb&&ba!==bb)t.push('BP '+ba+' → '+bb);
  if(_hv(a.spo2)&&_hv(b.spo2)&&a.spo2!==b.spo2)t.push('SpO₂ '+a.spo2+' → '+b.spo2);
  return t.length?' (מגמה: '+t.join(' · ')+')':'';
}
function pupilsOutText(pu){
  if(!pu)return'';
  const one=p=>(!p||(p.size==null&&p.reactive==null))?null:((_hv(p.size)?p.size+'mm ':'')+(p.reactive===true?'מגיב לאור':p.reactive===false?'קבוע':'')).trim();
  const l=one(pu.left),r=one(pu.right);
  return(!l&&!r)?'':'שמאל '+(l||'לא נבדק')+' / ימין '+(r||'לא נבדק');
}
function gcsOutText(d){
  if(!d||!_hv(d.gcs))return'';
  const g=d.gcsDetail;
  return'GCS '+d.gcs+((g&&_hv(g.eye)&&_hv(g.verbal)&&_hv(g.motor))?' (E'+g.eye+' V'+g.verbal+' M'+g.motor+')':'');
}
function consciousnessOutText(x){
  const d=(x||{}).d||{},p=[];
  if(d.avpu)p.push('AVPU='+d.avpu);
  const g=gcsOutText(d);if(g)p.push(g);
  const pp=pupilsOutText(d.pupils);if(pp)p.push('אישונים: '+pp);
  return p.join(' · ');
}
function tqOutLines(x){
  return((x||{}).x?.tourniquets||[]).map(q=>{const m=minsSince(q.time);return'ח"ע: '+bodyLabelOut(q.site)+' '+fmtHM(q.time)+(m!=null?' ('+m+' דק׳)':'')+(q.converted?.success?' — הומר':'');});
}
function medsOutLine(x){
  return((x||{}).e?.medications||[]).slice().sort((a,b)=>new Date(a.time)-new Date(b.time)).map(m=>(fmtHM(m.time)+' '+_mn(m)+' '+(m.dose||'')+' '+(m.route||'')).replace(/\s+/g,' ').trim()).join(' · ');
}
function fluidsOutLine(x){
  return((x||{}).c?.fluids||[]).slice().sort((a,b)=>new Date(a.time)-new Date(b.time)).map(f=>(fmtHM(f.time)+' '+(f.type||'')+' '+(_hv(f.volume)?f.volume+'ml':'')+(f.unit?' יח׳ '+f.unit:'')+(f.abo?' '+f.abo:'')+(f.lot?' [Lot:'+f.lot+']':'')).replace(/\s+/g,' ').trim()).join(' · ');
}
// Time of injury: an explicit e.timeOfInjury if recorded, otherwise the first injury mark in the app (approximate).
function injuryTimeOut(x){
  const e=(x||{}).e||{};
  if(e.timeOfInjury)return{t:e.timeOfInjury,approx:false};
  const f=(typeof _casualtyTimeline!=='undefined'?_casualtyTimeline:[]).find(t=>t.category==='injury');
  return f?{t:f.time,approx:true}:null;
}
// Every timeline category except the injury marks and raw vitals; entries that merely repeat the structured
// tourniquet / drug / fluid lists are dropped so nothing is printed twice. Empty list = "none recorded", not "none given".
function timelineOutItems(x,noTime){
  const tl=(typeof _casualtyTimeline!=='undefined')?_casualtyTimeline:[];
  const medKeys=new Set(((x||{}).e?.medications||[]).map(m=>(_mn(m)+' '+(m.dose||'')+' '+(m.route||'')).trim()));
  return tl.filter(t=>{
    if(['injury','vitals'].includes(t.category))return false;
    const a=String(t.action||'').trim();
    if(!a||medKeys.has(a)||/^נוזלים: /.test(a)||/^ח"ע — /.test(a)||/^(AVPU:|כאב:|גיל:|משקל משוער:|❌)/.test(a))return false;
    return true;
  }).map(t=>(noTime?'':(fmtHM(t.time)+' '))+outLR(t.action||''));
}
function sexOutName(s){return({M:'זכר',F:'נקבה'})[s]||'';}

// ── RADIO FORMAT (pure text, ATMIST order, digit-by-digit numbers) ────────────
function generateRadioFormat(){
  const S=sanitizeExport,sd=spellDigits;
  const name=S(((typeof _casualtyName!=='undefined'?_casualtyName:'')||'ללא שם').trim());
  const idNum=S((typeof _casualtyIdNumber!=='undefined'?_casualtyIdNumber:'').trim());
  const moiObj=MOI_TYPES.find(m=>m.id===(typeof _casualtyMOI!=='undefined'?_casualtyMOI:null));
  const triageCol=(typeof _casualtyTriageColor!=='undefined')?_casualtyTriageColor:null;
  const injArr=(typeof _casualtyInjuries!=='undefined')?_casualtyInjuries:[];
  const vArr=(typeof _casualtyVitals!=='undefined')?_casualtyVitals:[];
  const lastV=vArr.length?vArr[vArr.length-1]:null;
  const x=(typeof _casualtyXABCDE!=='undefined'&&_casualtyXABCDE)?_casualtyXABCDE:{d:{},e:{},x:{},c:{}};
  const sdT=t=>{const h=fmtHM(t);return h?sd(h.replace(':',' ')):'';};
  const L=['דיווח רדיו — '+name+(idNum?' | מ.א '+sd(idNum):'')];
  const evac=evacOutName(typeof _casualtyEvacPriority!=='undefined'?_casualtyEvacPriority:null);
  L.push((evac?'בקשה: פינוי '+evac+' | ':'')+'טריאז\': '+(triageCol?triageOutName(triageCol).split(' — ')[0]:'לא ידוע'));
  const e=x.e||{},age=e.ageYears,wt=(typeof _getPatientWeight==='function')?_getPatientWeight():e.weightKg;
  L.push([age!=null?'גיל '+sd(age):'גיל לא ידוע',sexOutName(e.sex),wt?'משקל '+sd(wt)+' ק"ג':''].filter(Boolean).join(' · '));
  const it=injuryTimeOut(x);
  if(it)L.push('שעת פציעה: '+sdT(it.t)+(it.approx?' (משוער)':''));
  L.push('מנגנון: '+S(moiObj?moiObj.label:'לא ידוע'));
  L.push('פגיעות: '+S(injArr.map(i=>bodyLabelOut(i.region)).join(', ')||'ללא'));
  (x.x?.tourniquets||[]).forEach(q=>{L.push('חוסם עורקים: '+bodyLabelOut(q.site)+' בשעה '+sdT(q.time)+(minsSince(q.time)!=null?' — חלפו '+sd(minsSince(q.time))+' דקות':''));});
  L.push('סימנים: '+(lastV?[
    'דופק '+(_hv(lastV.pulse)?sd(lastV.pulse)+(lastV.pulse===0?' — אין דופק':''):'לא נמדד'),
    'נשימות '+(_hv(lastV.rr)?sd(lastV.rr)+(lastV.rr===0?' — אין נשימה':''):'לא נמדד'),
    'SpO2 '+(_hv(lastV.spo2)?sd(lastV.spo2):'לא נמדד'),
    'ל"ד '+(_bpOut(lastV)?sd(_bpOut(lastV)):'לא נמדד')].join(', '):'ללא מדדים'));
  const cs=[];
  if(x.d?.avpu)cs.push('AVPU '+S(x.d.avpu));
  if(_hv(x.d?.gcs))cs.push('GCS '+sd(x.d.gcs));
  const pp=pupilsOutText(x.d?.pupils);if(pp)cs.push('אישונים '+pp);
  L.push('הכרה: '+(cs.join(' · ')||'לא נבדקה'));
  const meds=(e.medications||[]).slice().sort((a,b)=>new Date(a.time)-new Date(b.time)).map(m=>_mn(m)+' '+(m.dose||'')+' '+(m.route||'')+' בשעה '+sdT(m.time)).join(' · ');
  if(meds)L.push('תרופות: '+S(meds));
  const bl=(x.c?.fluids||[]).map(f=>(f.type||'')+' '+(_hv(f.volume)?f.volume+'ml':'')+' בשעה '+sdT(f.time)).join(' · ');
  if(bl)L.push('דם/נוזלים: '+S(bl));
  L.push('טיפול: '+S(timelineOutItems(x,true).join(' · ')||'לא תועדו'));
  return L.join('\n');
}

const _mn=m=>m.drug||m.name;
// Penetrating torso / head / neck wounds: antibiotics are due EARLY (not after an hour). One region list for alerts + priorities.
const _ABX_REGIONS=['abdomen_r','abdomen_l','lower_back_r','lower_back_l','head','back_head','neck','chest_r','chest_l','upper_back_r','upper_back_l'];
const _ABX_NAMES=['צפטריאקסון','מטרונידזול','Ertapenem'];
const bpTxt=v=>_bpOut(v)||'-';
// ── MIST+ HANDOFF (pure text) — time-critical items first ──────────────────────
function generateMISTPlusReport(){
  const S=sanitizeExport;
  const name=S(((typeof _casualtyName!=='undefined'?_casualtyName:'')||'ללא שם').trim());
  const moiObj=MOI_TYPES.find(m=>m.id===(typeof _casualtyMOI!=='undefined'?_casualtyMOI:null));
  const moiText=S(moiObj?moiObj.label:'לא ידוע');
  const injArr=(typeof _casualtyInjuries!=='undefined')?_casualtyInjuries:[];
  const injuries=S(injArr.map(i=>bodyLabelOut(i.region)+' ('+({hemorrhage:'דימום',fracture:'שבר',burn:'כוויה',penetrating:'חודר'}[i.type]||'')+')').join(', ')||'לא סומנו');
  const vArr=(typeof _casualtyVitals!=='undefined')?_casualtyVitals:[];
  const lastVitals=vArr.length?vArr[vArr.length-1]:null;
  const firstVitals=vArr.length?vArr[0]:null;
  const vitalsText=lastVitals?vitalsOutText(lastVitals)+vitalsTrendOut(firstVitals,lastVitals):'לא נמדדו';
  const x=(typeof _casualtyXABCDE!=='undefined'&&_casualtyXABCDE)?_casualtyXABCDE:{e:{},c:{},d:{},x:{}};
  const e=x.e||{};
  const treatItems=timelineOutItems(x);
  const tqL=tqOutLines(x),medL=medsOutLine(x),flL=fluidsOutLine(x);
  const treatments=S(treatItems.join(' · ')||((tqL.length||medL||flL)?'(ראו ח"ע / תרופות / דם)':'לא תועדו'));
  const allergies=S(e.allergies||'לא ידוע');
  const complications=S(e.complications||'');
  const handoff=S(e.handoffFrom||'');
  const evacPlan=S(e.evacPlan||'');
  const triageCol=(typeof _casualtyTriageColor!=='undefined')?_casualtyTriageColor:null;
  const evac=evacOutName(typeof _casualtyEvacPriority!=='undefined'?_casualtyEvacPriority:null);
  const it=injuryTimeOut(x);
  const who=(e.ageYears==null&&!(typeof _getPatientWeight==='function'&&_getPatientWeight()))?'':[e.ageYears!=null?'גיל '+e.ageYears:'',sexOutName(e.sex),(typeof _getPatientWeight==='function'&&_getPatientWeight())?_getPatientWeight()+' ק"ג':'',(e.sex==='F'&&e.ageYears!=null&&e.ageYears>=12&&e.ageYears<=50)?'היריון: '+(e.pregnant===true?'כן':e.pregnant===false?'לא':'לא ידוע'):''].filter(Boolean).join(' · ');
  const L=['\u2068MIST+\u2069 — '+name+(who?' | '+who:''),
    'שעה '+new Date().toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})+' | טריאז׳: '+triageOutName(triageCol)+(evac?' | פינוי: '+evac:'')];
  const iso=t=>String(t).split(' · ').map(x=>'\u2068'+x+'\u2069').join(' · ');
  try{const cx=buildCasualtyContext();if(cx.deepShock&&triageCol!=='black')L.push('הלם עמוק');else if(cx.shock&&triageCol!=='black')L.push('סימני הלם');}catch(_e){}
  tqL.forEach(l=>L.push('\u2068'+S(l)+'\u2069'));
  if(medL)L.push('תרופות: '+iso(S(medL)));
  if(flL)L.push('דם/נוזלים: '+iso(S(flL)));
  L.push('M: '+moiText+(it?' | שעת פציעה '+fmtHM(it.t)+(it.approx?' (משוער, מסימון)':''):''));
  L.push('I: '+injuries);
  L.push('S: '+vitalsText);
  const cs=consciousnessOutText(x);if(cs)L.push('הכרה: '+S(cs));
  L.push('T: '+treatments);
  L.push('אלרגיות: '+allergies);
  if(e.npo||e.lastOral)L.push('צום / אכילה אחרונה: '+S([e.npo?'צום (NPO)':'',(e.lastOral&&e.lastOral!=='לא ידוע')?e.lastOral:''].filter(Boolean).join(' · ')||'לא ידוע'));
  if(complications)L.push('סיבוכים: '+complications);
  L.push('הוראות / יעד: '+(evacPlan||'—'));
  L.push('נמסר ע״י: '+(handoff||'—'));
  return L.join('\n');
}

// ── MCI PURE HELPERS ───────────────────────────────────────────
// Pure MCI logic shared between beta + magen. UI renderers stay in
// each app (they touch app-specific DOM + event handlers).

// Returns {red, yellow, green, black, gray, total} counts.
function calcTriageCounts(casualties){
  const c={red:0,yellow:0,green:0,black:0,gray:0,total:0};
  if(!Array.isArray(casualties))return c;
  casualties.forEach(cas=>{
    c.total++;
    const col=cas.triageColor||cas.triage||null;
    if(col && c[col]!==undefined)c[col]++;
  });
  return c;
}

function triageColorOf(casualty){
  return casualty?.triageColor||casualty?.triage||null;
}

// ── MIST SHORT REPORT (pure text, different from MIST+) ───────
function generateMISTReport(){
  const name=sanitizeExport(((typeof _casualtyName!=='undefined'?_casualtyName:'')||'ללא שם').trim());
  const moiObj=MOI_TYPES.find(m=>m.id===(typeof _casualtyMOI!=='undefined'?_casualtyMOI:null));
  const moiText=sanitizeExport(moiObj?moiObj.label:'לא ידוע');
  const injArr=(typeof _casualtyInjuries!=='undefined')?_casualtyInjuries:[];
  const injuries=sanitizeExport(injArr.map(i=>bodyLabelOut(i.region)+' ('+({hemorrhage:'דימום',fracture:'שבר',burn:'כוויה',penetrating:'חודר'}[i.type]||'')+')').join(', ')||'לא סומנו');
  const vArr=(typeof _casualtyVitals!=='undefined')?_casualtyVitals:[];
  const lastVitals=vArr.length?vArr[vArr.length-1]:null;
  const vitalsText=lastVitals?vitalsOutText(lastVitals):'לא נמדדו';
  const xabcde=(typeof _casualtyXABCDE!=='undefined')?_casualtyXABCDE:{d:{}};
  const cons=sanitizeExport(consciousnessOutText(xabcde)||'לא נבדקה');
  const tq=tqOutLines(xabcde).map(l=>sanitizeExport(l)+'\n').join('');
  const meds=medsOutLine(xabcde),fl=fluidsOutLine(xabcde);
  const tlArr=(typeof _casualtyTimeline!=='undefined')?_casualtyTimeline:[];
  const items=timelineOutItems(xabcde);
  const treatments=sanitizeExport(items.join(' · ')||((tq||meds||fl)?'(ראו ח"ע / תרופות / דם)':'לא תועדו'));
  return`MIST — ${name}\n${tq}${meds?'תרופות: '+sanitizeExport(meds)+'\n':''}${fl?'דם/נוזלים: '+sanitizeExport(fl)+'\n':''}M: ${moiText}\nI: ${injuries}\nS: ${vitalsText}\nהכרה: ${cons}\nT: ${treatments}`;
}

// ── CLIPBOARD + SHARE HELPERS ──────────────────────────────────
// Each helper routes user feedback through MedHost.toast so both
// apps can customize the toast behavior (beta has undo-flag, magen
// has duration).
function copyMIST(){
  const text=generateMISTReport();
  const _toast=m=>(window.MedHost&&window.MedHost.toast)?window.MedHost.toast(m):null;
  navigator.clipboard?.writeText(text).then(()=>_toast('MIST הועתק ✓')).catch(()=>{
    const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();_toast('MIST הועתק ✓');
  });
}
function copyMISTPlus(){
  const text=generateMISTPlusReport();
  const _toast=m=>(window.MedHost&&window.MedHost.toast)?window.MedHost.toast(m):null;
  navigator.clipboard?.writeText(text).then(()=>_toast('MIST+ הועתק ✓')).catch(()=>{
    const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();_toast('MIST+ הועתק ✓');
  });
}
function exportCasualtyHandoff(){
  const full=generateForm101();
  const _toast=m=>(window.MedHost&&window.MedHost.toast)?window.MedHost.toast(m):null;
  navigator.clipboard?.writeText(full).then(()=>_toast('טופס 101 הועתק ✓')).catch(()=>_toast('שגיאה'));
}
function shareCasualtyWhatsApp(){
  const text=encodeURIComponent(generateMISTReport());
  window.open('https://wa.me/?text='+text,'_blank','noopener,noreferrer');
}

// ── RADIO READOUT OVERLAY (full-screen high-contrast display) ──
function showRadioReadout(){
  closeRadioReadout();
  const text=generateRadioFormat();
  const _esc=(typeof escapeHtml==='function')?escapeHtml:(s=>String(s??''));
  const ov=document.createElement('div');
  // Pure #000 (not rgba .97) so no chrome bleeds through — glance-at-3m
  // legibility under sunlight. z-index 100500 sits above the incident
  // sheet (99999) so the overlay actually renders on top. safe-area
  // padding for iPhone notch / home indicator.
  ov.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:#000;z-index:100500;display:flex;flex-direction:column;padding:max(20px,env(safe-area-inset-top)) 20px max(20px,env(safe-area-inset-bottom));direction:rtl';
  ov.setAttribute('role','dialog');ov.setAttribute('aria-label','דיווח רדיו MIST');
  ov.innerHTML=`<div style="flex:1;overflow-y:auto;padding:10px"><pre style="font-family:var(--f);font-size:24px;font-weight:700;line-height:1.9;color:#fff;white-space:pre-wrap;text-align:right;margin:0">${_esc(text)}</pre></div>
  <div style="display:flex;gap:8px;padding:10px 0;flex-shrink:0">
    <button onclick="copyRadioReadout()" style="flex:1;padding:16px;border-radius:12px;border:none;background:var(--bl);color:#fff;font-size:15px;font-weight:800;cursor:pointer;font-family:var(--f);min-height:52px">📋 העתק</button>
    <button onclick="closeRadioReadout()" style="flex:1;padding:16px;border-radius:12px;border:2px solid var(--t3);background:none;color:var(--t2);font-size:15px;font-weight:800;cursor:pointer;font-family:var(--f);min-height:52px">סגור</button>
  </div>`;
  ov.id='radio-overlay';
  document.body.appendChild(ov);
}
function copyRadioReadout(){
  const el=document.querySelector('#radio-overlay pre');if(!el)return;
  const _toast=m=>(window.MedHost&&window.MedHost.toast)?window.MedHost.toast(m):null;
  navigator.clipboard?.writeText(el.textContent).then(()=>_toast('הועתק ✓')).catch(()=>_toast('שגיאה'));
}
function closeRadioReadout(){const el=document.getElementById('radio-overlay');if(el)el.remove();}

// ── PRINT FORM 101 — v3.37 super-detailed HTML export ────────────
function printCasualty(){
  const _toast=m=>(window.MedHost&&window.MedHost.toast)?window.MedHost.toast(m):null;
  const w=window.open('','_blank','width=800,height=1000');
  if(!w){_toast('חסימת חלונות קופצים — אפשר הדפסה');return;}
  const html=_buildDetailedForm101HTML();
  w.document.write(html);
  w.document.close();
  try{w.opener=null;}catch(e){}
  setTimeout(()=>{try{w.print();}catch(e){}},500);
}
function _buildDetailedForm101HTML(){
  const esc=(typeof escapeHtml==='function')?escapeHtml:(s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  const fmt=t=>{if(!t)return'—';try{return new Date(t).toLocaleString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});}catch(e){return String(t);}};
  const fmtT=t=>{if(!t)return'—';try{return new Date(t).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'});}catch(e){return String(t);}};
  const name=(typeof _casualtyName!=='undefined'?_casualtyName:'')||'ללא שם';
  const idNum=(typeof _casualtyIdNumber!=='undefined'?_casualtyIdNumber:'')||'—';
  const moiId=(typeof _casualtyMOI!=='undefined')?_casualtyMOI:null;
  const moiObj=(typeof MOI_TYPES!=='undefined')?MOI_TYPES.find(m=>m.id===moiId):null;
  const moiLabel=moiObj?moiObj.label:'לא ידוע';
  const x=_casualtyXABCDE||{};
  const ageYears=x.e?.ageYears||'—';
  const weightKg=(typeof _getPatientWeight==='function')?_getPatientWeight():(x.e?.weightKg||'—');
  const allergies=x.e?.allergies||'לא ידוע';
  const caseStory=x.e?.caseStory||'';
  const notes=x.e?.notes||'';
  const evacPlan=x.e?.evacPlan||'';
  const handoffFrom=x.e?.handoffFrom||'';
  const triageCol=(typeof _casualtyTriageColor!=='undefined')?_casualtyTriageColor:null;
  const triage=triageCol?triageOutName(triageCol):'לא נקבע';
  const triageBg=triageCol?{red:'#e74c3c',yellow:'#f1c40f',green:'#2ecc71',gray:'#7f8c8d',black:'#000'}[triageCol]:'#ccc';
  const injArr=(typeof _casualtyInjuries!=='undefined')?_casualtyInjuries:[];
  const txArr=(typeof _casualtyTreatments!=='undefined')?_casualtyTreatments:[];
  const vArr=(typeof _casualtyVitals!=='undefined')?_casualtyVitals:[];
  const eArr=(typeof _casualtyExams!=='undefined'&&Array.isArray(_casualtyExams))?_casualtyExams:[];
  const tlArr=(typeof _casualtyTimeline!=='undefined')?_casualtyTimeline:[];
  const meds=x.e?.medications||[];
  const fluids=x.c?.fluids||[];
  const ivs=x.c?.ivAccess||[];
  const tqs=x.x?.tourniquets||[];
  const pdressings=x.x?.pressureDressings||[];
  const hemost=x.x?.hemostatic||[];
  const wpack=x.x?.woundPacking||[];
  const evacPriority=(typeof _casualtyEvacPriority!=='undefined'?_casualtyEvacPriority:null)||'—';
  const painHist=x.e?.painHistory||[];
  const painScore=(typeof _casualtyPainScore!=='undefined'&&_casualtyPainScore!==null)?_casualtyPainScore:null;
  const burnPct=(typeof calcBurnPercentage==='function')?calcBurnPercentage():0;
  const checklist=_secondarySurvey?.checklist||{};
  const h2t=_secondarySurvey?.headToToe||{};
  const structured=_secondarySurvey?.structured||{};
  const o2Flow=_secondarySurvey?.o2Flow||null;
  const bodyLabel=id=>bodyLabelOut(id);
  const injTypeLabel=t=>({hemorrhage:'דימום',fracture:'שבר',burn:'כוויה',penetrating:'חודר',blunt:'קהה'}[t]||t||'');
  const txTypeLabel=t=>({tourniquet:'חסם עורקי',pressureDressing:'תחבושת לחץ',tubeThora:'נקז חזה',hemostatic:'המוסטטי',bandage:'חבישה',needleDecompression:'דקירת מחט (NDC)',chestSeal:'אטם חזה',splint:'קיבוע שבר',pelvicBinder:'מקבע אגן',woundPacking:'אריזת פצע'}[t]||t||'');
  const airwayLbl={patent:'פתוח',compromised:'חלקי',obstructed:'חסום'};
  const abdLbl={soft:'רכה',tender:'רגישה',distended:'נפוחה',rigid:'קשה'};
  const breathLbl={clear:'נקייה',wheezy:'צפצוף',crackles:'חרחורים',decreased:'מופחת',absent:'אין'};
  const pulseLbl={present:'נמשש',weak:'חלש',absent:'נעדר'};
  const rowSec=(label,val,extra='')=>`<tr><td class="lbl">${esc(label)}</td><td>${val!=null&&val!==''?esc(String(val)):'<i>—</i>'}${extra}</tr>`;
  // ── Build sections ──
  let H='';
  // Header
  H+=`<div class="hdr"><div><div class="title">טופס 101 דיגיטלי — שומר אחי</div><div class="sub">דוח מפורט · ${fmt(new Date())}</div></div><div class="triage" style="background:${triageBg};color:${triageCol==='yellow'?'#000':'#fff'}">${esc(triage)}</div></div>`;
  // Section: Identity
  let secN=0;
  H+=`<section><h2>${++secN} · זיהוי ופרטים אישיים</h2><table class="kv">`;
  H+=rowSec('שם',name);
  H+=rowSec('מ.א / ת.ז',idNum);
  H+=rowSec('גיל',ageYears!=='—'?ageYears+' שנים':'—');
  H+=rowSec('משקל',weightKg!=='—'?weightKg+' ק"ג':'—');
  H+=rowSec('אלרגיות',allergies);
  if(sexOutName(x.e?.sex))H+=rowSec('מין',sexOutName(x.e.sex));
  if(x.e?.pregnant!=null)H+=rowSec('היריון',x.e.pregnant?'כן':'לא');
  if(x.e?.npo||x.e?.lastOral)H+=rowSec('צום / אכילה אחרונה',[x.e.npo?'צום (NPO)':'',(x.e.lastOral&&x.e.lastOral!=='לא ידוע')?x.e.lastOral:''].filter(Boolean).join(' · ')||'לא ידוע');
  if(x.e?.anticoag)H+=rowSec('נוגדי קרישה',x.e.anticoag);
  {const it=injuryTimeOut(x);if(it)H+=rowSec('שעת פציעה',fmtT(it.t)+(it.approx?' (משוער, מסימון)':''));}
  H+=rowSec('מנגנון פציעה',moiLabel);
  H+=rowSec('עדיפות פינוי',evacOutName(evacPriority)||evacPriority);
  H+=rowSec('יעד פינוי',evacPlan);
  H+=rowSec('חתום ע״י',handoffFrom);
  H+=`</table></section>`;
  // Section: Case story
  if(caseStory){H+=`<section><h2>${++secN} · סיפור מקרה</h2><p class="narrative">${esc(caseStory)}</p></section>`;}
  // Section: Injuries
  H+=`<section><h2>${++secN} · פגיעות</h2>`;
  if(burnPct>0)H+=`<div class="pill burn">🔥 שטח כוויה משוער: ${burnPct}% מהגוף</div>`;
  if(injArr.length){
    H+=`<table class="data"><thead><tr><th>אזור</th><th>סוג</th><th>צד</th><th>תיאור</th></tr></thead><tbody>`;
    injArr.forEach(i=>{H+=`<tr><td>${esc(bodyLabel(i.region))}</td><td>${esc(injTypeLabel(i.type))}</td><td>${esc(i.side?sideLabelOut(i.side):'—')}</td><td>${esc(i.notes||'—')}</td></tr>`;});
    H+=`</tbody></table>`;
  } else H+=`<p class="empty">לא סומנו פגיעות</p>`;
  H+=`</section>`;
  // Section: Treatments on body
  H+=`<section><h2>${++secN} · טיפולים שהונחו על הגוף</h2>`;
  if(txArr.length){
    H+=`<table class="data"><thead><tr><th>סוג</th><th>אזור</th><th>צד</th><th>זמן</th><th>תיאור</th></tr></thead><tbody>`;
    txArr.forEach(t=>{H+=`<tr><td>${esc(txTypeLabel(t.type))}</td><td>${esc(bodyLabel(t.region))}</td><td>${esc(t.side==='front'?'קדמי':'אחורי')}</td><td>${esc(t.time||'—')}</td><td>${esc(t.label||'—')}</td></tr>`;});
    H+=`</tbody></table>`;
  } else H+=`<p class="empty">ללא</p>`;
  H+=`</section>`;
  // Section: Primary X / ABCDE per stage — EVERY field
  H+=`<section class="page-break"><h2>${++secN} · סקר ראשוני (X → C → A → R → E)</h2>`;
  // X
  H+=`<h3 style="color:#c0392b">X — חילוץ + שליטה בדימום</h3><table class="kv">`;
  H+=rowSec('ח״ע שהותקנו',tqs.length?tqs.map(t=>`${esc(bodyLabel(t.site))} @ ${fmtT(t.time)}${minsSince(t.time)!=null?' ('+minsSince(t.time)+' דק׳)':''}${t.converted?.success?' — הומר':''}`).join('<br>'):'ללא');
  H+=rowSec('תחבושות לחץ',pdressings.length?pdressings.map(p=>esc(p.label||p.type||'')+' @ '+fmtT(p.time)).join('<br>'):'ללא');
  H+=rowSec('המוסטטי',hemost.length?hemost.map(p=>esc(p.label||'')+' @ '+fmtT(p.time)).join('<br>'):'ללא');
  H+=rowSec('מילוי פצע',wpack.length?wpack.map(p=>esc(p.label||'')+' @ '+fmtT(p.time)).join('<br>'):'ללא');
  H+=`</table>`;
  // C
  H+=`<h3 style="color:#d35400">C — מחזור דם</h3><table class="kv">`;
  H+=rowSec('AVPU',x.d?.avpu||'—');
  H+=rowSec('אופי דופק',({strong:'חזק',weak:'חלש',absent:'נעדר'}[x.c?.pulseCharacter])||'—');
  H+=rowSec('CRT (מילוי קפילרי)',x.c?.capRefill!=null?x.c.capRefill+' שניות':'—');
  H+=rowSec('גישות ורידיות',ivs.length?ivs.map(i=>esc(i.site)+' @ '+fmtT(i.time)).join('<br>'):'ללא');
  H+=rowSec('נוזלים ומוצרי דם',fluids.length?'ראו סעיף 10':'ללא');
  H+=`</table>`;
  // A
  H+=`<h3 style="color:#2980b9">A — נתיב אוויר</h3><table class="kv">`;
  H+=rowSec('סטטוס',airwayLabelOut(x.a?.status)||'—');
  H+=rowSec('התערבויות',(x.a?.interventions||[]).length?(x.a.interventions).map(i=>esc(i.type)+' × '+(i.attempts||1)+(i.tubeSize?' ('+i.tubeSize+')':'')+' @ '+fmtT(i.time)+' — '+(i.outcome||'—')).join('<br>'):'ללא');
  H+=rowSec('צווארון קשיח',x.a?.cervicalCollar?'✓ הונח @ '+fmtT(x.a.cervicalCollar.time):'לא');
  H+=`</table>`;
  // R (B internally)
  H+=`<h3 style="color:#16a085">R — נשימה</h3><table class="kv">`;
  H+=rowSec('קצב נשימה',x.b?.respiratoryRate!=null?x.b.respiratoryRate+' /דקה':'—');
  H+=rowSec('חמצן משלים',x.b?.o2Lpm?x.b.o2Lpm+' L/min @ '+fmtT(x.b?.o2StartTime):'לא');
  H+=rowSec('נקז חזה',x.b?.tubeThora?`✓ ${outLR(x.b.tubeThora.side||'')} (tube ${x.b.tubeThora.tubeSize||'—'}) @ ${fmtT(x.b.tubeThora.time)} — ${x.b.tubeThora.outcome||'—'}`:'לא');
  H+=rowSec('BVM',x.b?.bvm?'✓ מ-'+fmtT(x.b.bvm.time):'לא');
  const vent=x.b?.vent;
  H+=rowSec('מנשם',vent?`TV ${vent.tv||'—'} · PEEP ${vent.peep||'—'} · FiO₂ ${vent.fio2||'—'}% · RR ${vent.rr||'—'}`:'לא');
  H+=`</table>`;
  // E
  H+=`<h3 style="color:#27ae60">E — חשיפה / פינוי</h3><table class="kv">`;
  H+=rowSec('הפשטה מלאה',x.e?.fullExposure?'✓ @ '+fmtT(x.e.fullExposure.time):'לא בוצעה');
  if((x.e?.exposureFindings||[]).length){H+=rowSec('ממצאים בהפשטה',x.e.exposureFindings.map(f=>fmtT(f.time)+' — '+esc(f.text)).join('<br>'));}
  if((x.e?.exposureDressings||[]).length){H+=rowSec('חבישות בהפשטה',x.e.exposureDressings.map(f=>fmtT(f.time)+' — '+esc(f.text)).join('<br>'));}
  H+=rowSec('מקבע אגן',x.e?.pelvicBinder?'✓ '+esc(x.e.pelvicBinder.site||'')+' @ '+fmtT(x.e.pelvicBinder.time):'לא');
  H+=rowSec('מניעת היפותרמיה',hypoLabelOut(x.e?.hypothermiaPrevention)||'לא');
  H+=rowSec('GCS',x.d?.gcs||'—');
  const gd=x.d?.gcsDetail;
  if(gd&&(gd.eye||gd.verbal||gd.motor))H+=rowSec('GCS פירוט',`E:${gd.eye||'—'} V:${gd.verbal||'—'} M:${gd.motor||'—'}`);
  const pL=x.d?.pupils?.left,pR=x.d?.pupils?.right;
  const pupT=p=>(!p||(p.size==null&&p.reactive==null))?'לא נבדק':`${_hv(p.size)?p.size:'—'}mm ${p.reactive===true?'(מגיב לאור)':p.reactive===false?'(קבוע)':''}`;
  if(pL||pR)H+=rowSec('אישונים',`שמאל: ${pupT(pL)} · ימין: ${pupT(pR)}`);
  H+=rowSec('ציון כאב',painScore!=null?painScore+'/10':'—');
  if(painHist.length)H+=rowSec('היסטוריית כאב',painHist.map(p=>fmtT(p.time)+' — '+p.score+'/10').join('<br>'));
  H+=rowSec('סיבוכים',x.e?.complications||'אין');
  H+=`</table></section>`;
  // Section: Secondary survey — every checklist item + status + structured fields
  H+=`<section class="page-break"><h2>${++secN} · X-CARE</h2>`;
  if(window.Field&&Field.xcarePrintHtml)H+=Field.xcarePrintHtml();
  const secSchema=(window.Field&&Field.xcarePrintHtml)?[]:((typeof _SECONDARY_SCHEMA!=='undefined')?_SECONDARY_SCHEMA:[]);
  secSchema.forEach(sec=>{
    const pdone=sec.items.filter(i=>checklist[i.id]?.done).length;
    H+=`<h3 style="color:${sec.color}">${esc(sec.title)} (${pdone}/${sec.items.length})</h3>`;
    H+=`<table class="data"><thead><tr><th style="width:30px">✓</th><th>פריט</th><th>זמן</th></tr></thead><tbody>`;
    sec.items.forEach(it=>{
      const d=checklist[it.id];
      H+=`<tr><td>${d?.done?'✓':'—'}</td><td>${esc(it.t)}</td><td>${d?.time?fmtT(d.time):'—'}</td></tr>`;
    });
    H+=`</tbody></table>`;
  });
  // Structured findings
  H+=`<h3>ממצאים מובנים</h3><table class="kv">`;
  H+=rowSec('מצב נתיב אוויר (חוזר)',structured.airway?airwayLbl[structured.airway]||structured.airway:'—');
  H+=rowSec('בדיקת בטן',structured.abdomen?abdLbl[structured.abdomen]||structured.abdomen:'—');
  H+=rowSec('ריאה שמאל',structured.breathL?breathLbl[structured.breathL]||structured.breathL:'—');
  H+=rowSec('ריאה ימין',structured.breathR?breathLbl[structured.breathR]||structured.breathR:'—');
  H+=rowSec('סימטריית חזה',structured.chestRise||'—');
  H+=rowSec('דופק גפני — יד שמאל',structured.pulseLU?pulseLbl[structured.pulseLU]:'—');
  H+=rowSec('דופק גפני — יד ימין',structured.pulseRU?pulseLbl[structured.pulseRU]:'—');
  H+=rowSec('דופק גפני — רגל שמאל',structured.pulseLL?pulseLbl[structured.pulseLL]:'—');
  H+=rowSec('דופק גפני — רגל ימין',structured.pulseRL?pulseLbl[structured.pulseRL]:'—');
  if(structured.pupilL)H+=rowSec('אישון שמאל',`${structured.pupilL.size}mm · ${structured.pupilL.reactive?'מגיב':'לא מגיב'}`);
  if(structured.pupilR)H+=rowSec('אישון ימין',`${structured.pupilR.size}mm · ${structured.pupilR.reactive?'מגיב':'לא מגיב'}`);
  H+=rowSec('חמצן משלים (סקר שניוני)',o2Flow?o2Flow+' L/min':'—');
  H+=`</table>`;
  // Head-to-toe
  const h2tLabels={head:'ראש',face:'פנים/עיניים',neck_spine:'צוואר/עמ״ש',chest2:'חזה',abdomen2:'בטן',back2:'גב',pelvis2:'אגן',upper_limbs:'גפיים עליונות',lower_limbs:'גפיים תחתונות'};
  H+=`<h3>סריקה ראש-עד-רגל</h3><table class="data"><thead><tr><th>אזור</th><th>סטטוס</th></tr></thead><tbody>`;
  Object.keys(h2tLabels).forEach(k=>{
    const st=h2t[k];
    const stLbl=st==='normal'?'✓ תקין':st==='finding'?'⚠ ממצא':'לא נבדק';
    H+=`<tr><td>${esc(h2tLabels[k])}</td><td>${stLbl}</td></tr>`;
  });
  H+=`</tbody></table></section>`;
  // Section: Vitals history (all readings)
  H+=`<section class="page-break"><h2>${++secN} · היסטוריית סימנים חיוניים (${vArr.length} קריאות)</h2>`;
  if(vArr.length){
    H+=`<table class="data small"><thead><tr><th>זמן</th><th>דופק</th><th>ל״ד</th><th>SpO₂</th><th>RR</th><th>EtCO₂</th><th>טמפ׳</th><th>רדיאלי</th><th>AVPU</th><th>כאב</th></tr></thead><tbody>`;
    vArr.forEach(v=>{
      const bpD=(v.bpSys||v.bpDia)?((v.bpSys||'—')+'/'+(v.bpDia||'—')):(v.bp||'—');
      H+=`<tr><td>${fmtT(v.time)}</td><td>${_hv(v.pulse)?v.pulse:'—'}</td><td>${bpD}</td><td>${_hv(v.spo2)?v.spo2+'%':'—'}</td><td>${_hv(v.rr)?v.rr:'—'}</td><td>${_hv(v.etco2)?v.etco2:'—'}</td><td>${_hv(v.temp)?v.temp+'°':'—'}</td><td>${v.radialPulse?(v.radialPulse==='absent'?'נעדר':v.radialPulse==='weak'?'חלש':'תקין'):'—'}</td><td>${esc(v.avpu||'—')}</td><td>${v.painScore!=null?v.painScore+'/10':'—'}</td></tr>`;
    });
    H+=`</tbody></table>`;
  } else H+=`<p class="empty">לא נלקחו מדדים</p>`;
  H+=`</section>`;
  // Section: Exam history (structured exam snapshots)
  H+=`<section><h2>${++secN} · היסטוריית בדיקות גופניות (${eArr.length} תמונות מצב)</h2>`;
  if(eArr.length){
    H+=`<table class="data small"><thead><tr><th>זמן</th><th>בטן</th><th>ריאה L</th><th>ריאה R</th><th>נ.א</th><th>דופק LU</th><th>דופק RU</th><th>דופק LL</th><th>דופק RL</th></tr></thead><tbody>`;
    eArr.forEach(ex=>{
      H+=`<tr><td>${fmtT(ex.t)}</td><td>${ex.abdomen?abdLbl[ex.abdomen]:'—'}</td><td>${ex.breathL?breathLbl[ex.breathL]:'—'}</td><td>${ex.breathR?breathLbl[ex.breathR]:'—'}</td><td>${ex.airway?airwayLbl[ex.airway]:'—'}</td><td>${ex.pulseLU?pulseLbl[ex.pulseLU]:'—'}</td><td>${ex.pulseRU?pulseLbl[ex.pulseRU]:'—'}</td><td>${ex.pulseLL?pulseLbl[ex.pulseLL]:'—'}</td><td>${ex.pulseRL?pulseLbl[ex.pulseRL]:'—'}</td></tr>`;
    });
    H+=`</tbody></table>`;
  } else H+=`<p class="empty">לא נרשמו בדיקות מובנות</p>`;
  H+=`</section>`;
  // Section: Medications (full log)
  H+=`<section class="page-break"><h2>${++secN} · תרופות — יומן מלא</h2>`;
  if(meds.length){
    H+=`<table class="data"><thead><tr><th>זמן</th><th>תרופה</th><th>מינון</th><th>נתיב</th></tr></thead><tbody>`;
    meds.forEach(m=>{H+=`<tr><td>${fmtT(m.time)}</td><td>${esc(m.drug||m.name||'')}</td><td>${esc(String(m.dose||''))}</td><td>${esc(m.route||'')}</td></tr>`;});
    H+=`</tbody></table>`;
    // Totals by drug
    const totals={};
    meds.forEach(m=>{const k=m.drug||m.name||'';(totals[k]=totals[k]||[]).push(String(m.dose||'').trim());});
    H+=`<h3 style="margin-top:10px">סיכום מצטבר</h3><table class="kv">`;
    Object.entries(totals).forEach(([k,v])=>{H+=rowSec(k,v.length+(v.length===1?' מנה':' מנות')+' · '+v.filter(Boolean).join(' + '));});
    H+=`</table>`;
  } else H+=`<p class="empty">לא ניתנו תרופות</p>`;
  H+=`</section>`;
  // Section: Fluids (explicit; already in C but here standalone + totals)
  H+=`<section><h2>${++secN} · נוזלים ומוצרי דם — יומן מלא</h2>`;
  if(fluids.length){
    H+=`<table class="data"><thead><tr><th>זמן</th><th>סוג</th><th>נפח</th><th>פרטי מוצר</th></tr></thead><tbody>`;
    fluids.forEach(f=>{H+=`<tr><td>${fmtT(f.time)}</td><td>${esc(f.type||'')}</td><td>${f.volume||0} ml</td><td>${esc([f.abo,f.unit?'יח׳ '+f.unit:'',f.lot?'Lot '+f.lot:''].filter(Boolean).join(' · ')||'—')}</td></tr>`;});
    H+=`</tbody></table>`;
    // Totals
    const fTot={};let total=0;fluids.forEach(f=>{const k=f.type||'';const v=parseFloat(f.volume)||0;fTot[k]=(fTot[k]||0)+v;total+=v;});
    H+=`<h3 style="margin-top:10px">סיכום נפחים</h3><table class="kv">`;
    Object.entries(fTot).forEach(([k,v])=>{H+=rowSec(k,v+' ml');});
    H+=rowSec('סה"כ',total+' ml');
    H+=`</table>`;
  } else H+=`<p class="empty">לא ניתנו נוזלים</p>`;
  H+=`</section>`;
  // Section: Timeline
  H+=`<section class="page-break"><h2>${++secN} · ציר זמן טיפולי (${tlArr.length} אירועים)</h2>`;
  if(tlArr.length){
    H+=`<table class="data small"><thead><tr><th>זמן</th><th>קטגוריה</th><th>פעולה</th><th>פירוט</th></tr></thead><tbody>`;
    const catLbl={x:'X',a:'A',b:'R',c:'C',d:'C',e:'E',vitals:'מדדים',injury:'פציעה',exam:'בדיקה',triage:'מיון'};
    const tlCat=t=>{const a=String(t.action||'');if(/מקבע אגן/.test(a))return 'C';if((t.category==='e'||t.category==='c')&&!/^נוזלים/.test(a)&&/(TXA|קטמין|מורפין|פנטניל|צפטריאקסון|מטרונידזול|אקמול|אופטלגין|\bmg\b|\bmcg\b)/.test(a))return 'Rx';return catLbl[t.category]||t.category||'';};
    tlArr.forEach(t=>{H+=`<tr><td>${fmtT(t.time)}</td><td>${esc(tlCat(t))}</td><td>${esc(outLR(t.action||''))}</td><td>${esc(t.detail||'')}</td></tr>`;});
    H+=`</tbody></table>`;
  } else H+=`<p class="empty">ציר זמן ריק</p>`;
  H+=`</section>`;
  // Section: Notes
  if(notes){H+=`<section><h2>${++secN} · הערות חופשיות</h2><p class="narrative">${esc(notes)}</p></section>`;}
  // Section: Handoff (MIST+)
  if(typeof generateMISTPlusReport==='function'){
    H+=`<section><h2>${++secN} · העברה — MIST+</h2><pre class="hndf">${esc(generateMISTPlusReport())}</pre></section>`;
  }
  // Footer
  H+=`<footer>הופק ${fmt(new Date())} · שומר אחי v3.37 · טופס 101 דיגיטלי מפורט</footer>`;
  const css=`*{box-sizing:border-box}
body{font-family:'Heebo','Arial Hebrew',Arial,sans-serif;direction:rtl;color:#000;background:#fff;margin:0;padding:20px;line-height:1.45;font-size:12px}
.hdr{display:flex;justify-content:space-between;align-items:center;border-bottom:3px double #000;padding-bottom:10px;margin-bottom:16px}
.title{font-size:20px;font-weight:900}
.sub{font-size:11px;color:#555;margin-top:3px}
.triage{padding:10px 14px;border-radius:10px;font-weight:900;font-size:13px;text-align:center;min-width:140px}
section{margin-bottom:18px;page-break-inside:avoid}
h2{font-size:14px;background:#2c3e50;color:#fff;padding:6px 10px;margin:0 0 8px;border-radius:5px}
h3{font-size:12px;margin:10px 0 4px;padding:3px 8px;background:#ecf0f1;border-right:4px solid #888;border-radius:3px}
table{border-collapse:collapse;width:100%;margin:4px 0}
table.kv td{padding:5px 8px;border-bottom:1px dotted #ccc;vertical-align:top;font-size:11px}
table.kv td.lbl{width:32%;color:#555;font-weight:700;background:#f8f9fa}
table.data{font-size:11px}
table.data th,table.data td{padding:5px 7px;border:1px solid #bbb;text-align:right}
table.data th{background:#34495e;color:#fff;font-weight:700}
table.data tr:nth-child(even) td{background:#f8f9fa}
table.small{font-size:10px}
table.small th,table.small td{padding:3px 5px}
.empty{color:#888;font-style:italic;padding:6px 10px;background:#f8f9fa;border-radius:4px}
.pill{display:inline-block;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:700;margin-bottom:6px}
.pill.burn{background:#fff3cd;color:#b85500;border:1px solid #ffd699}
.narrative{background:#f8f9fa;border-right:4px solid #3498db;padding:10px 14px;border-radius:4px;font-size:12px;white-space:pre-wrap;line-height:1.6}
pre.hndf{background:#f1f8ff;border:1px solid #b8daff;padding:12px;font-family:'Courier New',monospace;white-space:pre-wrap;font-size:11px;border-radius:4px;line-height:1.5}
footer{margin-top:30px;padding-top:12px;border-top:2px solid #000;text-align:center;font-size:10px;color:#666}
.page-break{page-break-before:always}
.no-print{display:inline-block;margin:16px 0;padding:10px 22px;font-size:14px;border:2px solid #2c3e50;background:#2c3e50;color:#fff;border-radius:6px;cursor:pointer}
@media print{
  body{padding:10px;font-size:11px}
  .no-print{display:none!important}
  h2{break-after:avoid}
  section{break-inside:avoid}
  .page-break{page-break-before:always}
}`;
  return `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"><title>טופס 101 מפורט — ${esc(name)}</title><style>${css}</style></head><body>${H}<button class="no-print" onclick="window.print()">🖨️ הדפס / שמור כ-PDF</button></body></html>`;
}

// ── BODY MAP (SVG front + back, tap menus, injury/treatment placement) ──
// Uses MedHost.renderIncidentPage() + MedHost.triggerAutoSave() so each
// app re-renders its own page type after mutations.
var BODY_FRONT=(typeof BODY_FRONT!=='undefined')?BODY_FRONT:[
  {id:'head',label:'ראש',d:'M85,15 Q100,2 115,15 Q120,30 115,42 Q100,48 85,42 Q80,30 85,15Z',burn:9},
  {id:'neck',label:'צוואר',d:'M92,44 L108,44 L106,56 L94,56Z',burn:1},
  {id:'chest_r',label:'חזה ימין',d:'M60,58 L98,58 L98,115 L62,115 Q58,90 60,58Z',burn:9},
  {id:'chest_l',label:'חזה שמאל',d:'M102,58 L140,58 Q142,90 140,115 L102,115Z',burn:9},
  {id:'abdomen_r',label:'בטן ימין',d:'M62,117 L98,117 L98,162 L65,162Z',burn:4.5},
  {id:'abdomen_l',label:'בטן שמאל',d:'M102,117 L138,117 L135,162 L102,162Z',burn:4.5},
  {id:'pelvis',label:'אגן',d:'M68,164 L132,164 L128,188 L72,188Z',burn:1},
  {id:'r_upper_arm',label:'זרוע ימין',d:'M36,62 L58,62 Q56,78 54,95 L52,128 L34,128 Q35,95 36,62Z',burn:4.5},
  {id:'r_forearm',label:'אמה ימין',d:'M32,130 L52,130 L48,178 L28,178Z',burn:0},
  {id:'r_hand',label:'כף יד ימין',d:'M26,180 L50,180 L48,200 L24,200Z',burn:0},
  {id:'l_upper_arm',label:'זרוע שמאל',d:'M142,62 L164,62 Q165,95 166,128 L148,128 Q146,95 142,62Z',burn:4.5},
  {id:'l_forearm',label:'אמה שמאל',d:'M148,130 L168,130 L172,178 L152,178Z',burn:0},
  {id:'l_hand',label:'כף יד שמאל',d:'M150,180 L174,180 L176,200 L152,200Z',burn:0},
  {id:'r_thigh',label:'ירך ימין',d:'M70,190 L97,190 L93,278 L72,278Z',burn:9},
  {id:'r_shin',label:'שוק ימין',d:'M73,280 L92,280 L90,352 L75,352Z',burn:0},
  {id:'r_foot',label:'כף רגל ימין',d:'M73,354 L92,354 L94,378 L71,378Z',burn:0},
  {id:'l_thigh',label:'ירך שמאל',d:'M103,190 L130,190 L128,278 L107,278Z',burn:9},
  {id:'l_shin',label:'שוק שמאל',d:'M108,280 L127,280 L125,352 L110,352Z',burn:0},
  {id:'l_foot',label:'כף רגל שמאל',d:'M106,354 L127,354 L129,378 L106,378Z',burn:0}
];
var BODY_BACK=(typeof BODY_BACK!=='undefined')?BODY_BACK:[
  {id:'back_head',label:'עורף',d:'M85,15 Q100,2 115,15 Q120,30 115,42 Q100,48 85,42 Q80,30 85,15Z',burn:0},
  {id:'back_neck',label:'עורף צוואר',d:'M92,44 L108,44 L106,56 L94,56Z',burn:1},
  {id:'upper_back_r',label:'גב עליון ימין',d:'M60,58 L98,58 L98,115 L62,115Z',burn:9},
  {id:'upper_back_l',label:'גב עליון שמאל',d:'M102,58 L140,58 L140,115 L102,115Z',burn:9},
  {id:'spine',label:'עמוד שדרה',d:'M96,58 L104,58 L104,162 L96,162Z',burn:0},
  {id:'lower_back_r',label:'גב תחתון ימין',d:'M62,117 L96,117 L96,162 L65,162Z',burn:4.5},
  {id:'lower_back_l',label:'גב תחתון שמאל',d:'M104,117 L138,117 L135,162 L104,162Z',burn:4.5},
  {id:'r_buttock',label:'עכוז ימין',d:'M68,164 L98,164 L96,194 L70,194Z',burn:0},
  {id:'l_buttock',label:'עכוז שמאל',d:'M102,164 L132,164 L130,194 L104,194Z',burn:0},
  {id:'back_r_upper_arm',label:'זרוע R (אחורי)',d:'M36,62 L58,62 Q56,78 54,95 L52,128 L34,128 Q35,95 36,62Z',burn:4.5},
  {id:'back_l_upper_arm',label:'זרוע L (אחורי)',d:'M142,62 L164,62 Q165,95 166,128 L148,128 Q146,95 142,62Z',burn:4.5},
  {id:'back_r_forearm',label:'אמה R (אחורי)',d:'M32,130 L52,130 L48,178 L28,178Z',burn:0},
  {id:'back_l_forearm',label:'אמה L (אחורי)',d:'M148,130 L168,130 L172,178 L152,178Z',burn:0},
  {id:'back_r_hand',label:'כף יד R (אחורי)',d:'M26,180 L50,180 L48,200 L24,200Z',burn:0},
  {id:'back_l_hand',label:'כף יד L (אחורי)',d:'M150,180 L174,180 L176,200 L152,200Z',burn:0},
  {id:'back_r_thigh',label:'ירך R (אחורי)',d:'M70,196 L95,196 L93,278 L72,278Z',burn:9},
  {id:'back_l_thigh',label:'ירך L (אחורי)',d:'M105,196 L130,196 L128,278 L107,278Z',burn:9},
  {id:'back_r_shin',label:'שוק R (אחורי)',d:'M73,280 L92,280 L90,352 L75,352Z',burn:0},
  {id:'back_l_shin',label:'שוק L (אחורי)',d:'M108,280 L127,280 L125,352 L110,352Z',burn:0}
];

// Front and back share one outline (viewBox 200 × 400): head + body with arms and legs
var BODY_SILHOUETTE='M100,3 C110,3 117,12 117,24 C117,36 110,46 100,46 C90,46 83,36 83,24 C83,12 90,3 100,3Z M94.0,40.0 C91.8,42.2 95.3,50.2 93.0,53.0 C90.7,55.8 84.8,55.8 80.0,57.0 C75.2,58.2 69.0,58.8 64.0,60.0 C59.0,61.2 53.8,61.8 50.0,64.0 C46.2,66.2 43.2,67.7 41.0,73.0 C38.8,78.3 38.2,87.2 37.0,96.0 C35.8,104.8 35.3,116.2 34.0,126.0 C32.7,135.8 30.3,146.5 29.0,155.0 C27.7,163.5 27.3,171.2 26.0,177.0 C24.7,182.8 21.5,186.0 21.0,190.0 C20.5,194.0 21.3,198.5 23.0,201.0 C24.7,203.5 28.0,204.8 31.0,205.0 C34.0,205.2 38.3,204.5 41.0,202.0 C43.7,199.5 45.5,194.2 47.0,190.0 C48.5,185.8 49.0,183.3 50.0,177.0 C51.0,170.7 52.0,160.2 53.0,152.0 C54.0,143.8 55.0,136.2 56.0,128.0 C57.0,119.8 58.0,108.0 59.0,103.0 C60.0,98.0 61.3,94.8 62.0,98.0 C62.7,101.2 62.8,114.2 63.0,122.0 C63.2,129.8 62.7,137.8 63.0,145.0 C63.3,152.2 64.3,157.5 65.0,165.0 C65.7,172.5 66.2,177.5 67.0,190.0 C67.8,202.5 69.0,225.0 70.0,240.0 C71.0,255.0 72.5,267.0 73.0,280.0 C73.5,293.0 72.7,306.3 73.0,318.0 C73.3,329.7 75.7,341.7 75.0,350.0 C74.3,358.3 69.8,363.2 69.0,368.0 C68.2,372.8 67.5,376.8 70.0,379.0 C72.5,381.2 79.8,381.2 84.0,381.0 C88.2,380.8 93.7,382.8 95.0,378.0 C96.3,373.2 92.2,362.5 92.0,352.0 C91.8,341.5 93.5,327.0 94.0,315.0 C94.5,303.0 94.5,294.2 95.0,280.0 C95.5,265.8 96.3,244.0 97.0,230.0 C97.7,216.0 98.5,202.3 99.0,196.0 C99.5,189.7 99.7,192.0 100.0,192.0 C100.3,192.0 100.5,189.7 101.0,196.0 C101.5,202.3 102.3,216.0 103.0,230.0 C103.7,244.0 104.5,265.8 105.0,280.0 C105.5,294.2 105.5,303.0 106.0,315.0 C106.5,327.0 108.2,341.5 108.0,352.0 C107.8,362.5 103.7,373.2 105.0,378.0 C106.3,382.8 111.8,380.8 116.0,381.0 C120.2,381.2 127.5,381.2 130.0,379.0 C132.5,376.8 131.8,372.8 131.0,368.0 C130.2,363.2 125.7,358.3 125.0,350.0 C124.3,341.7 126.7,329.7 127.0,318.0 C127.3,306.3 126.5,293.0 127.0,280.0 C127.5,267.0 129.0,255.0 130.0,240.0 C131.0,225.0 132.2,202.5 133.0,190.0 C133.8,177.5 134.3,172.5 135.0,165.0 C135.7,157.5 136.7,152.2 137.0,145.0 C137.3,137.8 136.8,129.8 137.0,122.0 C137.2,114.2 137.3,101.2 138.0,98.0 C138.7,94.8 140.0,98.0 141.0,103.0 C142.0,108.0 143.0,119.8 144.0,128.0 C145.0,136.2 146.0,143.8 147.0,152.0 C148.0,160.2 149.0,170.7 150.0,177.0 C151.0,183.3 151.5,185.8 153.0,190.0 C154.5,194.2 156.3,199.5 159.0,202.0 C161.7,204.5 166.0,205.2 169.0,205.0 C172.0,204.8 175.3,203.5 177.0,201.0 C178.7,198.5 179.5,194.0 179.0,190.0 C178.5,186.0 175.3,182.8 174.0,177.0 C172.7,171.2 172.3,163.5 171.0,155.0 C169.7,146.5 167.3,135.8 166.0,126.0 C164.7,116.2 164.2,104.8 163.0,96.0 C161.8,87.2 161.2,78.3 159.0,73.0 C156.8,67.7 153.8,66.2 150.0,64.0 C146.2,61.8 141.0,61.2 136.0,60.0 C131.0,58.8 124.8,58.2 120.0,57.0 C115.2,55.8 109.3,55.8 107.0,53.0 C104.7,50.2 108.2,42.2 106.0,40.0 C103.8,37.8 96.2,37.8 94.0,40.0Z';

var _bodyMenuStep=(typeof _bodyMenuStep!=='undefined')?_bodyMenuStep:0;

function renderBodyMap(){
  const _esc=(typeof escapeHtml==='function')?escapeHtml:(s=>String(s??''));
  const regions=_casualtyView==='front'?BODY_FRONT:BODY_BACK;
  const side=_casualtyView;
  let _bmMarks='';
  let svg=`<svg viewBox="0 0 200 400" width="100%" preserveAspectRatio="xMidYMid meet" style="display:block;margin:0 auto;max-width:360px" role="img" aria-label="מפת גוף — ${side==='front'?'קדמי':'אחורי'}">`;
  svg+=`<rect x="0" y="0" width="200" height="400" fill="none"/>`;
  // Smooth human silhouette; the tap regions are clipped to it so marked regions follow the body outline
  svg+=`<defs><clipPath id="bm-clip-${side}"><path d="${BODY_SILHOUETTE}"/></clipPath></defs><path class="bm-sil" d="${BODY_SILHOUETTE}"/><g clip-path="url(#bm-clip-${side})">`;
  regions.forEach(r=>{
    const injury=_casualtyInjuries.find(i=>i.region===r.id && i.side===side);
    const treatment=_casualtyTreatments.find(t=>t.region===r.id && t.side===side);
    const isSelected=_selectedRegion===r.id;
    const cls='body-region'+(injury?' '+injury.type:'')+(isSelected?' selected':'');
    const ariaLabel=r.label+(injury?' — פציעה: '+injury.type:'')+(treatment?' — טיפול: '+treatment.type:'');
    svg+=`<path d="${r.d}" class="${cls}" onclick="handleRegionTap('${r.id}')" style="cursor:pointer"><title>${_esc(ariaLabel)}</title></path>`;
    const c=getPathCenter(r.d);
    if(treatment){
      _bmMarks+=`<circle cx="${c.x}" cy="${c.y}" r="11" fill="#0b0c0e" stroke="#fff" stroke-width="2" style="pointer-events:none"/><text x="${c.x}" y="${c.y+3.5}" text-anchor="middle" font-size="10" font-weight="900" fill="#fff" style="pointer-events:none">${({tourniquet:'TQ',pressureDressing:'PD',hemostatic:'HG',woundPacking:'WP',bandage:'D',splint:'S',pelvicBinder:'PB',tubeThora:'CT',custom:'+'})[treatment.type]||'+'}</text>`;
      if(injury){
        const dotCol={hemorrhage:'#e74c3c',fracture:'#f1c40f',burn:'#e67e22',penetrating:'#9b59b6',other:'#3498db'}[injury.type]||'#3498db';
        _bmMarks+=`<circle cx="${c.x+9}" cy="${c.y-6}" r="3" fill="${dotCol}" style="pointer-events:none"/>`;
      }
    } else if(injury){
      const ic={hemorrhage:'B',fracture:'F',burn:'BU',penetrating:'P',other:'+'}[injury.type]||'+';
      const icc={hemorrhage:'#d01a20',fracture:'#c08a00',burn:'#b8420a',penetrating:'#6d3fc0',other:'#3b4656'}[injury.type]||'#3b4656';
      _bmMarks+=`<circle cx="${c.x}" cy="${c.y}" r="11" fill="${icc}" stroke="#fff" stroke-width="2" style="pointer-events:none"/><text x="${c.x}" y="${c.y+3.5}" text-anchor="middle" font-size="10" font-weight="900" fill="#fff" style="pointer-events:none">${ic}</text>`;
    }
  });
  svg+=`</g><path class="bm-out" d="${BODY_SILHOUETTE}"/>`;
  svg+=_bmMarks;
  regions.forEach(r=>{
    const injury=_casualtyInjuries.find(i=>i.region===r.id && i.side===side);
    const treatment=_casualtyTreatments.find(t=>t.region===r.id && t.side===side);
    const c=getPathCenter(r.d);
    const ariaLabel=r.label+(injury?' — פציעה: '+injury.type:'')+(treatment?' — טיפול: '+treatment.type:'');
    svg+=`<circle cx="${c.x}" cy="${c.y}" r="18" class="body-region-hit" role="button" tabindex="0" aria-label="${_esc(ariaLabel)}" ontouchstart="event.stopPropagation()" onclick="handleRegionTap('${r.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();handleRegionTap('${r.id}');}"/>`;
  });
  svg+=`</svg>`;
  if(_selectedRegion){
    const r=regions.find(x=>x.id===_selectedRegion);
    if(r){
      svg+=`<div id="body-tap-overlay" onclick="if(event.target===this){_selectedRegion=null;MedHost.renderIncidentPage();}" style="position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;padding:20px">`;
      svg+=`<div class="body-tap-menu" dir="rtl" style="background:var(--c1);border:1.5px solid var(--sep);border-radius:14px;padding:14px;min-width:260px;max-width:340px;box-shadow:0 12px 40px rgba(0,0,0,.6)" onclick="event.stopPropagation()">`;
      svg+=renderFloatingRegionMenu(_selectedRegion);
      svg+=`<button onclick="_selectedRegion=null;MedHost.renderIncidentPage()" style="width:100%;margin-top:8px;padding:10px;border-radius:8px;border:1px solid var(--sep);background:var(--c2);color:var(--t2);font-size:12px;font-weight:700;cursor:pointer;font-family:var(--f);min-height:40px">✕ סגור</button>`;
      svg+=`</div></div>`;
    }
  }
  if(_pendingTreatmentType){
    svg+=`<div style="text-align:center;padding:6px;background:rgba(52,152,219,.12);border:1px solid rgba(52,152,219,.3);border-radius:8px;margin-top:4px;font-size:11px;color:var(--bl);font-weight:700">👆 לחץ על הגוף למיקום ${TREATMENT_ICONS[_pendingTreatmentType]||''} ${_pendingTreatmentType==='tourniquet'?'ח"ע':_pendingTreatmentType==='tubeThora'?'נקז חזה':_pendingTreatmentType==='pressureDressing'?'תחבושת':_pendingTreatmentType}</div>`;
  }
  const usedTreatments=new Set(_casualtyTreatments.filter(t=>t.side===side).map(t=>t.type));
  const usedInjuries=new Set(_casualtyInjuries.filter(i=>i.side===side).map(i=>i.type));
  if(usedTreatments.size||usedInjuries.size){
    svg+=`<div class="bm-legend">`;
    const lg=(code,col,txt)=>`<span><i style="background:${col}">${code}</i>${txt}</span>`;
    if(usedInjuries.has('hemorrhage'))svg+=lg('B','#d01a20','דימום');
    if(usedInjuries.has('fracture'))svg+=lg('F','#c08a00','שבר');
    if(usedInjuries.has('burn'))svg+=lg('BU','#b8420a','כוויה');
    if(usedInjuries.has('penetrating'))svg+=lg('P','#6d3fc0','חודר');
    usedTreatments.forEach(t=>{svg+=lg(({tourniquet:'TQ',pressureDressing:'PD',hemostatic:'HG',woundPacking:'WP',bandage:'D',splint:'S',pelvicBinder:'PB',tubeThora:'CT',custom:'+'})[t]||'+','#0b0c0e',_txHe(t));});
    svg+=`</div>`;
  }
  return svg;
}
function getPathCenter(d){
  const nums=d.match(/[\d.]+/g).map(Number);
  let sx=0,sy=0,n=0;
  for(let i=0;i<nums.length-1;i+=2){sx+=nums[i];sy+=nums[i+1];n++;}
  return{x:Math.round(sx/n),y:Math.round(sy/n)+3};
}
function renderFloatingRegionMenu(regionId){
  const _esc=(typeof escapeHtml==='function')?escapeHtml:(s=>String(s??''));
  const currentInj=_casualtyInjuries.find(i=>i.region===regionId&&i.side===_casualtyView);
  const currentTx=_casualtyTreatments.filter(t=>t.region===regionId&&t.side===_casualtyView);
  const currentType=currentInj?.type||'';
  const extremities=['r_upper_arm','r_forearm','r_hand','l_upper_arm','l_forearm','l_hand','r_thigh','r_shin','r_foot','l_thigh','l_shin','l_foot','back_r_upper_arm','back_l_upper_arm','back_r_forearm','back_l_forearm','back_r_hand','back_l_hand','back_r_thigh','back_l_thigh','back_r_shin','back_l_shin'];
  const chestRegions=['chest_r','chest_l','upper_back_r','upper_back_l'];
  const headRegions=['head','neck','back_head','back_neck'];
  let txOpts=[];
  if(extremities.includes(regionId))txOpts=[{t:'tourniquet',e:'🔴',l:'חסם עורקים'},{t:'pressureDressing',e:'⬜',l:'תחבושת לחץ'},{t:'hemostatic',e:'🟧',l:'גזה המוסטטית'},{t:'woundPacking',e:'🟫',l:'אריזת פצע'},{t:'splint',e:'🪵',l:'קיבוע שבר'}];
  // IDF protocol: no needle decompression and no chest seal. Open chest wound = 3-side dressing; chest drain only on indication.
  else if(chestRegions.includes(regionId))txOpts=[{t:'bandage',e:'🩹',l:'חבישה (3 צדדים)'},{t:'pressureDressing',e:'⬜',l:'תחבושת לחץ'}];
  else if(headRegions.includes(regionId))txOpts=[{t:'bandage',e:'🩹',l:'חבישה'},{t:'pressureDressing',e:'⬜',l:'תחבושת לחץ'},{t:'hemostatic',e:'🟧',l:'המוסטטי'}];
  else txOpts=[{t:'pressureDressing',e:'⬜',l:'תחבושת לחץ'},{t:'woundPacking',e:'🟫',l:'אריזת פצע'},{t:'hemostatic',e:'🟧',l:'המוסטטי'}];
  const steps=['סוג פציעה','טיפול','הערות'];
  let h=`<div class="btm-label">${_esc(BODY_LABELS[regionId]||regionId)}</div>`;
  h+=`<div style="display:flex;gap:4px;justify-content:center;margin-bottom:10px">`;
  steps.forEach((s,i)=>{
    const active=_bodyMenuStep===i;
    h+=`<div onclick="_bodyMenuStep=${i};MedHost.renderIncidentPage()" style="flex:1;text-align:center;padding:5px 4px;border-radius:6px;border:1px solid ${active?'var(--bl)':'var(--sep)'};background:${active?'rgba(52,152,219,.15)':'none'};color:${active?'var(--bl)':'var(--t4)'};font-size:10px;font-weight:${active?'800':'600'};cursor:pointer">${i+1}. ${s}</div>`;
  });
  h+=`</div>`;
  if(currentInj||currentTx.length){
    h+=`<div style="padding:6px 8px;background:var(--c3);border-radius:8px;margin-bottom:8px;font-size:10px;color:var(--t2)">`;
    if(currentInj)h+=`<div>פציעה: <b style="color:var(--re)">${({hemorrhage:'דימום',fracture:'שבר',burn:'כוויה',penetrating:'חודר'})[currentInj.type]||currentInj.type}</b>${currentInj.notes?' — '+_esc(currentInj.notes):''}</div>`;
    currentTx.forEach(t=>{h+=`<div>טיפול: <b style="color:var(--bl)">${TREATMENT_ICONS[t.type]||''} ${_txHe(t.type)}</b> · ${t.time||''}</div>`;});
    h+=`</div>`;
  }
  if(_bodyMenuStep===0){
    h+='<div style="font-size:11px;font-weight:700;color:var(--t3);margin-bottom:6px;text-align:center">מה סוג הפציעה?</div>';
    h+='<div class="btm-row">';
    [{t:'hemorrhage',e:'🩸',l:'דימום'},{t:'fracture',e:'🦴',l:'שבר'},{t:'burn',e:'🔥',l:'כוויה'},{t:'penetrating',e:'⊕',l:'חודר'}].forEach(it=>{
      const on=currentType===it.t;
      h+=`<button class="btm-btn${on?' btm-on':''}" onclick="setInjuryType('${regionId}','${it.t}');_bodyMenuStep=1;MedHost.renderIncidentPage()"><span class="btm-emo">${it.e}</span><span class="btm-txt">${it.l}</span></button>`;
    });
    h+=`<button class="btm-btn" onclick="addCustomInjury('${regionId}');_bodyMenuStep=1;MedHost.renderIncidentPage()"><span class="btm-emo">✏</span><span class="btm-txt">אחר</span></button>`;
    h+='</div>';
    if(currentType){h+=`<button onclick="_bodyMenuStep=1;MedHost.renderIncidentPage()" style="width:100%;margin-top:8px;padding:10px;border-radius:8px;border:1px solid var(--bl);background:rgba(52,152,219,.12);color:var(--bl);font-size:12px;font-weight:700;cursor:pointer;font-family:var(--f)">הבא — טיפול →</button>`;}
  }
  else if(_bodyMenuStep===1){
    h+='<div style="font-size:11px;font-weight:700;color:var(--t3);margin-bottom:6px;text-align:center">איזה טיפול בוצע?</div>';
    h+='<div class="btm-row">';
    txOpts.forEach(t=>{
      const placed=currentTx.some(ct=>ct.type===t.t);
      h+=`<button class="btm-btn btm-tx${placed?' btm-on':''}" onclick="startTreatmentPlacement('${t.t}');handleRegionTap('${regionId}')"><span class="btm-emo">${t.e}</span><span class="btm-txt">${t.l}</span></button>`;
    });
    h+=`<button class="btm-btn btm-tx" onclick="addCustomTreatment('${regionId}')"><span class="btm-emo">✏</span><span class="btm-txt">אחר</span></button>`;
    h+='</div>';
    h+=`<div style="display:flex;gap:6px;margin-top:8px">`;
    h+=`<button onclick="_bodyMenuStep=0;MedHost.renderIncidentPage()" style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--sep);background:none;color:var(--t3);font-size:12px;font-weight:700;cursor:pointer;font-family:var(--f)">← חזור</button>`;
    h+=`<button onclick="_bodyMenuStep=2;MedHost.renderIncidentPage()" style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--bl);background:rgba(52,152,219,.12);color:var(--bl);font-size:12px;font-weight:700;cursor:pointer;font-family:var(--f)">הבא — הערות →</button>`;
    h+=`</div>`;
  }
  else if(_bodyMenuStep===2){
    h+='<div style="font-size:11px;font-weight:700;color:var(--t3);margin-bottom:6px;text-align:center">הערות נוספות (אופציונלי)</div>';
    h+='<div class="btm-row">';
    h+=`<button class="btm-btn btm-note" onclick="addRegionNote('${regionId}')"><span class="btm-emo">📝</span><span class="btm-txt">הוסף הערה</span></button>`;
    h+='</div>';
    h+=`<div style="display:flex;gap:6px;margin-top:8px">`;
    h+=`<button onclick="_bodyMenuStep=1;MedHost.renderIncidentPage()" style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--sep);background:none;color:var(--t3);font-size:12px;font-weight:700;cursor:pointer;font-family:var(--f)">← חזור</button>`;
    h+=`<button onclick="_selectedRegion=null;_bodyMenuStep=0;MedHost.renderIncidentPage()" style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--gr);background:rgba(46,204,113,.12);color:var(--gr);font-size:12px;font-weight:700;cursor:pointer;font-family:var(--f)">✓ סיום</button>`;
    h+=`</div>`;
  }
  return h;
}
function addCustomInjury(regionId){
  const label=prompt('סוג פציעה חופשי:');
  if(!label)return;
  pushMedHistory();
  const clean=String(label).slice(0,80);
  _casualtyInjuries.push({region:regionId,side:_casualtyView,type:'other',severity:'',notes:clean});
  _casualtyRegions.add(regionId);
  addTimestampedAction('injury','פציעה '+clean+' — '+(BODY_LABELS[regionId]||regionId),'');
  _selectedRegion=null;
  MedHost.triggerAutoSave();MedHost.renderIncidentPage();
}
function addCustomTreatment(regionId){
  const label=prompt('סוג טיפול חופשי:');
  if(!label)return;
  pushMedHistory();
  const clean=String(label).slice(0,80);
  const now=new Date().toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'});
  _casualtyTreatments.push({region:regionId,side:_casualtyView,type:'custom',label:clean,time:now});
  addTimestampedAction('x','טיפול '+clean+' — '+(BODY_LABELS[regionId]||regionId),'');
  _selectedRegion=null;
  MedHost.triggerAutoSave();MedHost.renderIncidentPage();
}
function addRegionNote(regionId){
  const n=prompt('הערה לאזור '+(BODY_LABELS[regionId]||regionId)+':');
  if(!n)return;
  pushMedHistory();
  const clean=String(n).slice(0,200);
  addTimestampedAction('injury','הערה — '+(BODY_LABELS[regionId]||regionId)+': '+clean,'');
  _selectedRegion=null;
  MedHost.triggerAutoSave();MedHost.renderIncidentPage();
}
function handleRegionTap(regionId){
  if(_pendingTreatmentType){
    placeTreatmentOnBody(regionId,_pendingTreatmentType);
    _pendingTreatmentType=null;
    MedHost.renderIncidentPage();
    return;
  }
  if(_selectedRegion===regionId){_selectedRegion=null;_bodyMenuStep=0;}
  else{_selectedRegion=regionId;_bodyMenuStep=0;}
  MedHost.renderIncidentPage();
}
function startTreatmentPlacement(type){
  _pendingTreatmentType=type;
  MedHost.renderIncidentPage();
}
function placeTreatmentOnBody(regionId,type){
  const side=_casualtyView;
  const existing=_casualtyTreatments.findIndex(t=>t.region===regionId&&t.side===side&&t.type===type);
  const iso=new Date().toISOString();
  pushMedHistory();   // snapshot BEFORE the change (later pushes in this tick are ignored), so UNDO really removes the treatment
  if(existing>=0){
    const removed=_casualtyTreatments.splice(existing,1)[0];
    _removeFromXStep(type,regionId,removed);
    if(navigator.vibrate)navigator.vibrate(8);
    return;
  }
  _casualtyTreatments.push({region:regionId,side,type,time:new Date().toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})});
  _mirrorBodyTreatmentToX(type,regionId,iso);
  addTimestampedAction(['tourniquet','pressureDressing','hemostatic','woundPacking'].includes(type)?'x':'treatment','טיפול '+_txHe(type)+' — '+BODY_LABELS[regionId],type);
  if(navigator.vibrate)navigator.vibrate(15);
}
function _mirrorBodyTreatmentToX(type,regionId,iso){
  const label=BODY_LABELS[regionId]||regionId;
  const x=_casualtyXABCDE?.x;if(!x)return;
  if(type==='tourniquet'){
    x.tourniquets=x.tourniquets||[];
    x.tourniquets.push({site:regionId,time:iso});
  } else if(type==='pressureDressing'){
    x.pressureDressings=x.pressureDressings||[];
    x.pressureDressings.push({label:'תחבושת לחץ — '+label,site:regionId,time:iso});
  } else if(type==='hemostatic'){
    x.hemostatic=x.hemostatic||[];
    x.hemostatic.push({label:'המוסטטי — '+label,site:regionId,time:iso});
  } else if(type==='woundPacking'){
    x.woundPacking=x.woundPacking||[];
    x.woundPacking.push({label:'אריזת פצע — '+label,site:regionId,time:iso});
  }
}
function _removeFromXStep(type,regionId,removed){
  const x=_casualtyXABCDE?.x;if(!x)return;
  const key={tourniquet:'tourniquets',pressureDressing:'pressureDressings',hemostatic:'hemostatic',woundPacking:'woundPacking'}[type];
  if(!key||!Array.isArray(x[key]))return;
  const i=x[key].findIndex(e=>e.site===regionId);
  if(i>=0)x[key].splice(i,1);
}
function removeTreatmentFromBody(idx){
  pushMedHistory();
  _casualtyTreatments.splice(idx,1);
  MedHost.triggerAutoSave();
  MedHost.renderIncidentPage();
}
function setInjuryType(regionId,type){
  const side=_casualtyView;
  const existing=_casualtyInjuries.findIndex(i=>i.region===regionId&&i.side===side);
  if(existing>=0){
    if(_casualtyInjuries[existing].type===type){
      _casualtyInjuries.splice(existing,1);
    } else {
      _casualtyInjuries[existing].type=type;
    }
  } else {
    _casualtyInjuries.push({region:regionId,side,type,severity:'moderate',notes:''});
  }
  // The popup stays open: the next step (treatment) is shown by the caller. Closing it here made step 2 unreachable.
  addTimestampedAction('injury','סימון פציעה — '+BODY_LABELS[regionId],type);
  if(navigator.vibrate)navigator.vibrate(10);
  MedHost.triggerAutoSave();MedHost.renderIncidentPage();
}
function removeInjury(idx){
  pushMedHistory();
  _casualtyInjuries.splice(idx,1);
  MedHost.triggerAutoSave();
  MedHost.renderIncidentPage();
}

// ── MEDICAL UNDO/REDO (Tier 9) ─────────────────────────────────
// Separate from beta's scheduling undo. Snapshots full casualty-form
// state so a mistap can be reverted. Cap 30 to bound memory.
var _medUndoStack=(typeof _medUndoStack!=='undefined')?_medUndoStack:[];
var _medRedoStack=(typeof _medRedoStack!=='undefined')?_medRedoStack:[];
var _MED_UNDO_MAX=(typeof _MED_UNDO_MAX!=='undefined')?_MED_UNDO_MAX:30;
function _snapshotMedState(){
  return JSON.stringify({
    xabcde:_casualtyXABCDE,
    timeline:_casualtyTimeline.map(t=>({...t,time:t.time instanceof Date?t.time.toISOString():t.time})),
    vitals:_casualtyVitals,
    treatments:_casualtyTreatments,
    injuries:_casualtyInjuries,
    regions:[..._casualtyRegions],
    name:_casualtyName,
    idNumber:_casualtyIdNumber,
    triageColor:_casualtyTriageColor,
    painScore:_casualtyPainScore,
    moi:_casualtyMOI,
    secondary:_secondarySurvey,
    evac:_casualtyEvacPriority,
    vitalsInput:_casualtyVitalsInput
  });
}
function _restoreMedState(snap){
  if(!snap)return;
  try{
    const s=JSON.parse(snap);
    _casualtyXABCDE=s.xabcde||_casualtyXABCDE;
    _casualtyTimeline=(s.timeline||[]).map(t=>({...t,time:typeof t.time==='string'?new Date(t.time):t.time}));
    _casualtyVitals=s.vitals||[];
    _casualtyTreatments=s.treatments||[];
    _casualtyInjuries=s.injuries||[];
    _casualtyRegions=new Set(s.regions||[]);
    _casualtyName=s.name||'';
    _casualtyIdNumber=s.idNumber||'';
    _casualtyTriageColor=s.triageColor||null;
    _casualtyPainScore=s.painScore??null;
    _casualtyMOI=s.moi||null;
    _secondarySurvey=s.secondary||{headToToe:{},o2Flow:null,tqReeval:[]};
    _casualtyEvacPriority=s.evac||'';
    _casualtyVitalsInput=s.vitalsInput||{pulse:'',rr:'',spo2:'',bpSys:'',bpDia:'',temp:'',etco2:'',radialPulse:''};
    MedHost.triggerAutoSave();
    MedHost.renderIncidentPage();
  }catch(e){}
}
var _medPushLock=false;
function pushMedHistory(){
  if(!_casualtyEditMode)return;
  // One user action = one undo step: later pushes in the same tick (e.g. addTimestampedAction after the
  // state was already changed) would snapshot the NEW state and make UNDO look like it did nothing.
  if(_medPushLock)return;
  _medPushLock=true;Promise.resolve().then(()=>{_medPushLock=false;});
  _medUndoStack.push(_snapshotMedState());
  if(_medUndoStack.length>_MED_UNDO_MAX)_medUndoStack.shift();
  _medRedoStack=[];
}
function medUndo(){
  const _toast=m=>(window.MedHost&&window.MedHost.toast)?window.MedHost.toast(m):null;
  if(!_medUndoStack.length){_toast('אין פעולה לביטול');return;}
  _medRedoStack.push(_snapshotMedState());
  _restoreMedState(_medUndoStack.pop());
  if(navigator.vibrate)navigator.vibrate(20);
}
function medRedo(){
  const _toast=m=>(window.MedHost&&window.MedHost.toast)?window.MedHost.toast(m):null;
  if(!_medRedoStack.length){_toast('אין פעולה לחזרה');return;}
  _medUndoStack.push(_snapshotMedState());
  _restoreMedState(_medRedoStack.pop());
  if(navigator.vibrate)navigator.vibrate(20);
}
// Keyboard shortcuts — Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z = redo.
document.addEventListener('keydown',(ev)=>{
  if(!_casualtyEditMode)return;
  const mod=ev.ctrlKey||ev.metaKey;
  if(mod && ev.key.toLowerCase()==='z'){
    ev.preventDefault();
    if(ev.shiftKey)medRedo();else medUndo();
  }
});
function addTimestampedAction(category,action,details){
  pushMedHistory();
  _casualtyTimeline.push({time:new Date(),category,action,details:details||''});
  if(_casualtyEditMode)MedHost.triggerAutoSave();
}

// ── CDS ENGINE (shock, TBI, MARCH-P, timers, hints, clinical priorities) ──
// Extracted blocks:

// ── [shock] block from beta lines 6849-6875 ──
// Vitals the shock logic reads: the live input form if filled in, otherwise the last recorded reading.
function _shockInputs(){
  const inp=(typeof _casualtyVitalsInput!=='undefined'&&_casualtyVitalsInput)||{};
  // each vital = its most recent measured value (a later reading of only the pulse must not erase a low BP)
  const rows=(typeof _casualtyVitals!=='undefined'&&_casualtyVitals)||[];
  const lastOf=k=>{for(let i=rows.length-1;i>=0;i--){const v=rows[i]&&rows[i][k];if(v!==null&&v!==undefined&&v!=='')return v;}return null;};
  const pn=(a,b)=>{const x=parseInt(a);if(!isNaN(x))return x;const y=parseInt(b);return isNaN(y)?null:y;};
  return{sys:pn(inp.bpSys,lastOf('bpSys'))||null,hr:pn(inp.pulse,lastOf('pulse')),rp:(inp.radialPulse||lastOf('radialPulse')||'')};
}
// Age-adjusted minimum systolic BP: adults 90 mmHg; children under 12: 70 + 2 x age (max 90).
function _sbpMinFor(age){return(age!=null&&age<12)?Math.min(90,70+2*age):90;}
function _headInjury(){return _casualtyInjuries.some(i=>/head|face/.test(String(i.region||'')));}
function _headPenetrating(){return _casualtyInjuries.some(i=>i.type==='penetrating'&&['head','back_head'].includes(i.region));}
function _recentSedation(){
  return(_casualtyXABCDE?.e?.medications||[]).some(m=>{
    const t=m.time?new Date(m.time):null;
    if(!t)return false;
    const ageMin=(Date.now()-t.getTime())/60000;
    return ageMin<60&&['פנטניל','מורפין','קטמין','דורמיקום'].includes(_mn(m));
  });
}
// TCCC shock: weak/absent radial pulse, OR altered mentation not explained by head injury / sedation, OR SBP below the age limit.
function _inTccShock(){
  const {sys,rp}=_shockInputs();
  const age=_casualtyXABCDE?.e?.ageYears;
  if(sys&&sys<_sbpMinFor(age))return true;
  if(rp==='absent'||rp==='weak')return true;
  const avpu=(_casualtyXABCDE?.d?.avpu||'').toUpperCase();
  return(avpu==='V'||avpu==='P'||avpu==='U')&&!_headPenetrating()&&!_recentSedation();
}
// Legacy gate (pain flow, morphine override): TCCC shock or marked tachycardia.
function _inProfoundShock(){
  const {hr}=_shockInputs();
  const age=_casualtyXABCDE?.e?.ageYears;
  const hrShock=(age!=null&&age<12)?(age<1?170:age<3?160:age<6?150:130):130;
  return _inTccShock()||!!(hr&&hr>hrShock);
}
// Deep shock (strongest wording): SBP below the age limit, or no BP reading + absent radial pulse / P-U not from head trauma or sedation.
function _isDeepShock(){
  const {sys,rp}=_shockInputs();
  const age=_casualtyXABCDE?.e?.ageYears;
  const sbpLow=(sys!==null&&sys<_sbpMinFor(age));
  const rpAbsent=rp==='absent';
  const avpu=(_casualtyXABCDE?.d?.avpu||'').toUpperCase();
  const altered=avpu==='V'||avpu==='P'||avpu==='U';
  const cleanAltered=altered&&!_headInjury()&&!_recentSedation();
  // IDF: SBP under the limit, OR no measurable BP together with no radial pulse / altered consciousness not caused by head injury or sedation.
  return sbpLow||(sys===null&&(rpAbsent||cleanAltered));
}

// ── [cds] block from beta lines 6961-7214 ──
// Tier 28: Clinical Context Engine — what matters NOW for THIS casualty
function _hasTBI(){
  return _casualtyInjuries.some(i=>['head','back_head'].includes(i.region)&&['penetrating','blunt','hemorrhage'].includes(i.type))||
    (_casualtyXABCDE?.d?.gcs!=null&&_casualtyXABCDE.d.gcs<=12&&(_hasMOI('blast')||_hasMOI('fall')||_hasMOI('blunt')||_hasMOI('vehicle')));
}
function buildCasualtyContext(){
  const v=_casualtyVitals.length?_casualtyVitals[_casualtyVitals.length-1]:null;
  const lastVitals=v||{};
  const _sp=lastVitals.bp?parseInt(lastVitals.bp):NaN;
  const sys=!isNaN(_sp)?_sp:(lastVitals.bpSys!=null&&!isNaN(parseInt(lastVitals.bpSys))?parseInt(lastVitals.bpSys):null);
  const inj=_casualtyInjuries||[];
  const torsoRegions=['chest_r','chest_l','abdomen_r','abdomen_l','upper_back_r','upper_back_l','lower_back_r','lower_back_l','neck','pelvis'];
  const headNeckAbd=_ABX_REGIONS;
  const penetratingTorso=inj.some(i=>i.type==='penetrating'&&torsoRegions.includes(i.region));
  const penetratingHeadNeckAbd=inj.some(i=>i.type==='penetrating'&&headNeckAbd.includes(i.region));
  const burns=inj.some(i=>i.type==='burn');
  const fracture=inj.some(i=>i.type==='fracture');
  const pelvicSuspect=inj.some(i=>i.region==='pelvis');
  const meds=_casualtyXABCDE?.e?.medications||[];
  const gotTXA=meds.some(m=>_mn(m)==='TXA');
  const gotAbx=meds.some(m=>_ABX_NAMES.includes(_mn(m)));
  const _it0=injuryTimeOut(_casualtyXABCDE);
  const firstInj=_it0?{time:_it0.t}:null;
  const minSinceInjury=firstInj?Math.round((Date.now()-new Date(firstInj.time).getTime())/60000):null;
  const tqList=_casualtyXABCDE?.x?.tourniquets||[];
  const tqOverdue=tqList.some(t=>(Date.now()-new Date(t.time).getTime())/60000>120);
  const moi=_casualtyMOI||null;
  const crushSuspect=_hasMOI('crush');
  const age=_casualtyXABCDE?.e?.ageYears||null;
  const pediatric=age!=null&&age<12;
  const hypothermic=lastVitals.temp!=null&&lastVitals.temp<36;
  const deepShock=_isDeepShock();
  const profoundShock=_inProfoundShock();
  const hasTBI=_hasTBI();
  const tbiBpLow=hasTBI&&sys!=null&&sys<100;
  const tbiHypoxia=hasTBI&&lastVitals.spo2!=null&&lastVitals.spo2<90;
  const tbiEtco2Bad=hasTBI&&lastVitals.etco2!=null&&(parseInt(lastVitals.etco2)<35||parseInt(lastVitals.etco2)>40);
  const pelvicBinder=!!_casualtyXABCDE?.e?.pelvicBinder;
  const cCollar=!!_casualtyXABCDE?.a?.cervicalCollar;
  const tube=!!_casualtyXABCDE?.b?.tubeThora||!!_casualtyXABCDE?.b?.needleDecompression||(_casualtyTreatments||[]).some(t=>['tubeThora','needleDecompression'].includes(t.type));
  const activeTqs=tqList.filter(t=>!t.converted||!t.converted.success);
  const tqMins=activeTqs.length?Math.round((Date.now()-Math.min(...activeTqs.map(t=>new Date(t.time).getTime())))/60000):0;
  const anyShock=deepShock||profoundShock;
  const tqRec=tqMins>360?'ח״ע מעל 6 שעות — אין להסיר/להמיר; פינוי דחוף':anyShock?'אין להמיר ח״ע בהלם — להשאיר במקום':tqMins>120?'ח״ע 2–6 שעות — המרה רק עם רופא ובניטור צמוד; אחרת להשאיר':'המרה אפשרית אם ח״ע מתחת ל-2 שעות, דימום נשלט, אין קטיעה, פינוי מעל 30–60 ד׳, עם תחבושת לחץ/המוסטטי מוכנים. 2–6 ש׳: רק עם רופא. מעל 6 ש׳: אל תסיר.';
  const gcsNow=_casualtyXABCDE?.d?.gcs;
  const _crt=parseFloat(_casualtyXABCDE?.c?.capRefill);
  const _hypoperf=(sys!=null&&sys<100)||['weak','absent'].includes(lastVitals.radialPulse||'')||(!isNaN(_crt)&&_crt>3);
  // TXA: hemorrhage risk. Tachycardia alone is not enough; TBI only when blunt and GCS 9-15 (CRASH-3); penetrating head wound is not a TXA trigger by itself.
  const txaRisk=penetratingTorso||activeTqs.length>0||anyShock||(sys!=null&&sys<90)||(parseInt(lastVitals.pulse)>110&&_hypoperf)||inj.some(i=>i.region==='pelvis'&&i.type==='hemorrhage')||(hasTBI&&gcsNow!=null&&gcsNow>=9&&gcsNow<=15&&!_headPenetrating());
  return {txaRisk,shock:_inTccShock(),tqMins,tqRec,anyShock,sys,penetratingTorso,penetratingHeadNeckAbd,burns,fracture,pelvicSuspect,gotTXA,gotAbx,minSinceInjury,tqOverdue,crushSuspect,pediatric,age,hypothermic,deepShock,profoundShock,pelvicBinder,cCollar,tube,lastVitals,moi,hasTBI,tbiBpLow,tbiHypoxia,tbiEtco2Bad};
}
// Tier 29: MARCH-P completion — returns {done,total,missing[]}
function getMarchPStatus(){
  const x=_casualtyXABCDE?.x||{};
  const a=_casualtyXABCDE?.a||{};
  const b=_casualtyXABCDE?.b||{};
  const c=_casualtyXABCDE?.c||{};
  const e=_casualtyXABCDE?.e||{};
  const injs=_casualtyInjuries||[];
  const txs=_casualtyTreatments||[];
  const lastV=(_casualtyVitals||[]).length?_casualtyVitals[_casualtyVitals.length-1]:{};
  const chestInj=injs.some(i=>['chest_r','chest_l','upper_back_r','upper_back_l'].includes(i.region)&&['penetrating','blunt','hemorrhage'].includes(i.type));
  const rrKnown=(b.respiratoryRate!=null)||lastV.rr!=null;
  const chestDone=!!b.tubeThora||!!b.needleDecompression||!!b.oxygen||!!b.chestChecked||txs.some(t=>['chestSeal','tubeThora','needleDecompression'].includes(t.type));
  const shockNow=_isDeepShock()||_inProfoundShock();
  const bleedInj=injs.some(i=>i.type==='hemorrhage');
  const items=[
    {k:'M',l:'דימום מסיבי',done:x.tourniquets?.length>0||x.pressureDressings?.length>0||x.hemostatic?.length>0||x.woundPacking?.length>0||!!x.noMassiveHemorrhage},
    {k:'A',l:'נתיב אוויר',done:!!a.status||a.interventions?.length>0},
    {k:'R',l:'נשימה',done:rrKnown&&(chestDone||(!chestInj&&(lastV.spo2==null||lastV.spo2>=94)))},
    {k:'C',l:'מחזור דם',done:c.ivAccess?.length>0||c.fluids?.length>0||(!!c.pulseCharacter&&!shockNow&&!bleedInj)},
    {k:'H',l:'ראש/היפותרמיה',done:!!e.hypothermiaPrevention},
    {k:'P',l:'כאב',done:!!e.painDeclined||(_casualtyPainScore!==null&&_casualtyPainScore<=3)||e.medications?.some(m=>['מורפין','קטמין','פנטניל','אופטלגין','פרצטמול','אקמול','Actiq OTFC'].includes(_mn(m)))},
  ];
  const missing=items.filter(i=>!i.done);
  return {done:items.length-missing.length,total:items.length,missing,items};
}
// Tier 29: Critical timers (golden hour, TQ, sedation)
function renderCriticalTimers(){
  const _it=injuryTimeOut(_casualtyXABCDE);
  const firstInj=_it?{time:_it.t}:null;
  const timers=[];
  if(firstInj){
    const min=Math.round((Date.now()-new Date(firstInj.time).getTime())/60000);
    const gh=60-min;
    timers.push({k:'gh',l:_it.approx?'שעת זהב (מסימון)':'שעת זהב',v:gh>0?`${gh}ד׳ נותרו`:`+${-gh}ד׳`,cl:gh<=0?'#e74c3c':gh<=15?'#f1c40f':'#2ecc71'});
  }
  const tqList=_casualtyXABCDE?.x?.tourniquets||[];
  const activeTqs=tqList.filter(t=>!t.converted||!t.converted.success);
  if(activeTqs.length){
    const oldest=activeTqs.reduce((o,t)=>new Date(t.time)<new Date(o.time)?t:o);
    const min=Math.round((Date.now()-new Date(oldest.time).getTime())/60000);
    const cl=min>=120?'#e74c3c':min>=90?'#f1c40f':'#2ecc71';
    timers.push({k:'tq',l:'זמן ח״ע',v:`${min}ד׳`,cl});
  }
  const meds=_casualtyXABCDE?.e?.medications||[];
  const lastSed=meds.filter(m=>['מורפין','קטמין','דורמיקום','פנטניל'].includes(_mn(m))).pop();
  if(lastSed){
    const min=Math.round((Date.now()-new Date(lastSed.time).getTime())/60000);
    timers.push({k:'sed',l:_mn(lastSed),v:`${min}ד׳`,cl:min>30?'#f1c40f':'#3498db'});
  }
  if(!timers.length)return '';
  let h=`<div style="display:flex;gap:4px;margin-bottom:8px;padding:6px;border-radius:8px;background:rgba(0,0,0,.2);border:1px solid var(--sep)">`;
  timers.forEach(t=>{
    h+=`<div style="flex:1;text-align:center;padding:4px 2px;border-radius:5px;background:rgba(255,255,255,.02);border:1px solid ${t.cl}"><div style="font-size:9px;color:var(--t3);font-weight:700">${t.l}</div><div style="font-size:12px;font-weight:900;color:${t.cl}">${t.v}</div></div>`;
  });
  h+=`</div>`;
  return h;
}
// Tier 29: Per-tab context hints — show only the priorities relevant to THIS step
function renderTabHints(tabKey){
  if(_casualtyTriageColor==='black')return '';
  const ctx=buildCasualtyContext();
  const hints=[];
  const sysStr=ctx.sys!=null?`SBP ${ctx.sys}mmHg`:'SBP לא נמדד';
  if(tabKey==='x'){
    if(ctx.deepShock)hints.push({ic:'🩸',obs:`נמדד הלם עמוק (${sysStr})`,rec:'מומלץ: עצירת דימום מיידית'});
    if(ctx.tqOverdue){
      const tqs=_casualtyXABCDE?.x?.tourniquets||[];
      const oldest=tqs.reduce((o,t)=>(!o||new Date(t.time)<new Date(o.time))?t:o,null);
      const mins=oldest?Math.round((Date.now()-new Date(oldest.time).getTime())/60000):0;
      hints.push({ic:'⏰',obs:`ח״ע מונח ${mins} דק׳ (מעל 120)`,rec:ctx.tqRec});
    }
    if(ctx.txaRisk&&!ctx.gotTXA&&ctx.minSinceInjury!=null){
      const left=180-ctx.minSinceInjury;
      if(left>0)hints.push({ic:'💉',obs:`סיכון להלם דימומי — חלפו ${ctx.minSinceInjury} דק׳, נותרו ${left} דק׳`,rec:'מומלץ: TXA 1g IV בהקדם, רצוי תוך שעה'});
    }
  } else if(tabKey==='c'){
    if(ctx.deepShock)hints.push({ic:'🩸',obs:`נמדד הלם עמוק (${sysStr})`,rec:'מומלץ: דם מלא / RDCR ביחס 1:1:1'});
    else if(ctx.shock)hints.push({ic:'🩸',obs:`סימני הלם (${sysStr})`,rec:'מומלץ: דם מלא / פלזמה, TXA, חימום'});
    if(ctx.crushSuspect)hints.push({ic:'🪨',obs:'MOI מסומן: מעיכה',rec:'מומלץ: NaCl 0.9% ב-1L/שעה לפני חילוץ'});
    if(ctx.hasTBI&&ctx.tbiBpLow)hints.push({ic:'🧠',obs:`TBI + נמדד SBP ${ctx.sys}mmHg`,rec:'מומלץ: שמירה על SBP ≥100–110 (לפי נוהל TBI)'});
  } else if(tabKey==='a'){
    if(ctx.deepShock)hints.push({ic:'⚠',obs:`נמדד הלם עמוק (${sysStr})`,rec:'מומלץ: הימנעות מאינטובציה/RSI אם אפשר'});
    if(ctx.pediatric)hints.push({ic:'🚫',obs:`נרשם גיל ${ctx.age} שנים`,rec:'אסור: קריקותירואידוטומיה מתחת לגיל 12'});
    if(ctx.hasTBI&&ctx.tbiHypoxia)hints.push({ic:'🧠',obs:`TBI + נמדד SpO₂ ${ctx.lastVitals.spo2}%`,rec:'מומלץ: חמצן 100% + אבטחת נתיב אוויר'});
  } else if(tabKey==='b'){
    const lastV=_casualtyVitals.length?_casualtyVitals[_casualtyVitals.length-1]:null;
    if(lastV?.etco2){
      const eco=parseInt(lastV.etco2);
      if(eco<35)hints.push({ic:'⬇',obs:`נמדד EtCO₂ ${eco}mmHg (יעד 35-45)`,rec:'מומלץ: הפחתת קצב הנשמה (RR)'});
      else if(eco>45)hints.push({ic:'⬆',obs:`נמדד EtCO₂ ${eco}mmHg (יעד 35-45)`,rec:'מומלץ: הגברת קצב הנשמה (RR)'});
    }
  } else if(tabKey==='d'){
    if(ctx.hasTBI){
      const g=_casualtyXABCDE?.d?.gcs;
      hints.push({ic:'🧠',obs:`חשד TBI — GCS ${g||'לא נמדד'}`,rec:'מומלץ: GCS סדרתי כל 15ד׳ + הרמת ראש 30°'});
    }
  } else if(tabKey==='e'){
    if(ctx.hypothermic)hints.push({ic:'🧊',obs:`נמדדה טמפ׳ ${ctx.lastVitals.temp}°C (מתחת 36)`,rec:'מומלץ: HPMK / חימום פעיל'});
    if(ctx.pelvicSuspect&&!ctx.pelvicBinder)hints.push({ic:'🦴',obs:'סומנה פציעה באגן',rec:'מומלץ: מקבע אגן בגובה greater trochanters'});
    if(ctx.penetratingHeadNeckAbd&&!ctx.gotAbx){
      hints.push({ic:'🛡',obs:ctx.minSinceInjury!=null?`פציעה חודרת בגו/ראש/צוואר — חלפו ${ctx.minSinceInjury} דק׳`:'פציעה חודרת בגו/ראש/צוואר',rec:'מומלץ: אנטיביוטיקה מוקדם — Ceftriaxone 2g + Metronidazole 500mg IV (או Ertapenem 1g)'});
    }
  }
  if(!hints.length)return '';
  let h='<div style="margin-bottom:6px;display:flex;flex-direction:column;gap:3px">';
  h+='<div style="font-size:9px;color:var(--t4);text-align:center;padding:3px;background:rgba(255,255,255,.02);border-radius:5px;font-weight:600">⚠ המלצות בוט בלבד — לא תחליף שיקול קליני</div>';
  hints.forEach(it=>{
    h+=`<div style="display:flex;align-items:flex-start;gap:6px;padding:6px 8px;border-radius:6px;background:rgba(231,76,60,.08);border-right:2px solid var(--re);font-size:11px;color:var(--t2)">`;
    h+=`<span style="flex-shrink:0">${it.ic}</span>`;
    h+=`<div style="flex:1;min-width:0"><div style="font-size:10px;color:var(--t3);margin-bottom:2px">${escapeHtml(it.obs||'')}</div><div style="font-size:11px;color:var(--re);font-weight:700">${escapeHtml(it.rec||'')}</div></div>`;
    h+=`</div>`;
  });
  h+='</div>';
  return h;
}
function renderClinicalPriorities(){
  if(_casualtyTriageColor==='black')return'<div style="margin-bottom:8px;padding:10px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid var(--sep);font-size:13px;font-weight:800;color:var(--t2);text-align:center">אין סימני חיים — הערכה חוזרת כשיתפנו משאבים</div>';
  const ctx=buildCasualtyContext();
  const items=[];
  // Format: {obs: what the system detected, rec: recommendation}
  const rp=ctx.lastVitals?.radialPulse;
  const rpLabel=rp==='absent'?'נעדר':rp==='weak'?'חלש':rp==='present'?'תקין':'לא נמדד';
  const avpu=_casualtyXABCDE?.d?.avpu||'—';
  if(ctx.deepShock){
    const parts=[];
    if(ctx.sys!=null)parts.push(`SBP ${ctx.sys}mmHg`);
    if(rp)parts.push(`רדיאלי ${rpLabel}`);
    if(avpu&&avpu!=='—'&&['P','U'].includes(avpu))parts.push(`AVPU=${avpu}`);
    items.push({k:'shock',ic:'🩸',cl:'#e74c3c',obs:`נמדד הלם עמוק (${parts.join(' · ')||'SBP נמוך'})`,rec:'מומלץ: דם מלא ראשון; הימנעות מאינטובציה ואופיואידים'});
  } else if(ctx.shock){
    const parts=[];
    if(ctx.sys!=null)parts.push(`SBP ${ctx.sys}mmHg`);
    if(rp)parts.push(`רדיאלי ${rpLabel}`);
    if(avpu&&avpu!=='—'&&avpu!=='A')parts.push(`AVPU=${avpu}`);
    items.push({k:'shock',ic:'🩸',cl:'#e74c3c',obs:`סימני הלם (${parts.join(' · ')||'לפי הערכה קלינית'})`,rec:'הלם — דם מלא / פלזמה, TXA, חימום'});
  }
  if(ctx.hypothermic&&ctx.deepShock){
    items.push({k:'triad',ic:'☠',cl:'#c0392b',obs:`נמדדה טמפ׳ ${ctx.lastVitals.temp}°C + SBP ${ctx.sys}mmHg — Lethal Triad`,rec:'מומלץ: חימום דחוף (HPMK/פעיל) + דם מלא + TXA 1g IV'});
  }
  if(ctx.hasTBI){
    if(ctx.tbiBpLow)items.push({k:'tbi-bp',ic:'🧠',cl:'#e74c3c',obs:`חשד TBI + נמדד SBP ${ctx.sys}mmHg (מתחת ל-100)`,rec:'מומלץ: שמירה על SBP ≥100–110 (לפי נוהל TBI) — נוזלים/דם מיידי'});
    if(ctx.tbiHypoxia)items.push({k:'tbi-o2',ic:'🧠',cl:'#e74c3c',obs:`חשד TBI + נמדד SpO₂ ${ctx.lastVitals.spo2}% (מתחת ל-90%)`,rec:'מומלץ: שמירה על רוויון חמצן ≥90% + אבטחת נתיב אוויר'});
    if(ctx.tbiEtco2Bad){
      const eco=parseInt(ctx.lastVitals.etco2);
      items.push({k:'tbi-co2',ic:'🧠',cl:'#e67e22',obs:`חשד TBI + נמדד EtCO₂ ${eco}mmHg (יעד 35-40)`,rec:`מומלץ: ${eco<35?'הפחתת קצב הנשמה':'הגברת קצב הנשמה'} — שמירה על PCO₂ בין 35 ל-40`});
    }
    if(!ctx.tbiBpLow&&!ctx.tbiHypoxia&&!ctx.tbiEtco2Bad){
      items.push({k:'tbi',ic:'🧠',cl:'#9b59b6',obs:`זוהה חשד TBI — GCS ${_casualtyXABCDE?.d?.gcs||'לא נמדד'}, AVPU=${_casualtyXABCDE?.d?.avpu||'—'}`,rec:'מומלץ: 1) ניטור GCS/AVPU + אישונים 2) SBP ≥100–110 3) SpO₂ ≥90% 4) PCO₂ 35-40 5) מניעת היפותרמיה'});
    }
  }
  if(!ctx.hasTBI&&_casualtyXABCDE?.d?.gcs!=null&&_casualtyXABCDE.d.gcs<=13&&!(ctx.sys!=null&&ctx.sys<_sbpMinFor(ctx.age))){
    items.push({k:'ams',ic:'🧠',cl:'#9b59b6',obs:`GCS ${_casualtyXABCDE.d.gcs}`,rec:'שינוי במצב הכרה — שקול הלם מול TBI'});
  }
  if(ctx.tqOverdue){
    const tqs=_casualtyXABCDE?.x?.tourniquets||[];
    const oldest=tqs.reduce((o,t)=>(!o||new Date(t.time)<new Date(o.time))?t:o,null);
    const mins=oldest?Math.round((Date.now()-new Date(oldest.time).getTime())/60000):0;
    items.push({k:'tq',ic:'⏰',cl:'#e74c3c',obs:`ח״ע מונח כבר ${mins} דק׳ (מעל סף 120 דק׳)`,rec:ctx.tqRec});
  }
  if(ctx.hypothermic){
    items.push({k:'temp',ic:'🧊',cl:'#3498db',obs:`נמדדה טמפ׳ ${ctx.lastVitals.temp}°C (מתחת ל-36°C)`,rec:'מומלץ: מניעת היפותרמיה — HPMK / שמיכה / חימום פעיל'});
  }
  if(ctx.txaRisk&&!ctx.gotTXA&&ctx.minSinceInjury!=null){
    const left=180-ctx.minSinceInjury;
    if(left>0)items.push({k:'txa',ic:'💉',cl:'#f39c12',obs:`סיכון להלם דימומי (חודר בגו / ח״ע / הלם / TBI) — חלפו ${ctx.minSinceInjury} דק׳ מהפציעה (נותרו ${left} דק׳ מחלון 180 דק׳)`,rec:'מומלץ: TXA 1g IV בהקדם — רצוי תוך שעה מהפציעה (חלון 3 שעות)'});
  }
  if(ctx.penetratingHeadNeckAbd&&!ctx.gotAbx){
    const late=ctx.minSinceInjury!=null&&ctx.minSinceInjury>60;
    items.push({k:'abx',ic:'🛡',cl:late?'#e74c3c':'#1abc9c',obs:ctx.minSinceInjury!=null?`פציעה חודרת בגו/ראש/צוואר — חלפו ${ctx.minSinceInjury} דק׳ מהפציעה${late?' (מעל שעה)':''}`:'פציעה חודרת בגו/ראש/צוואר',rec:'אנטיביוטיקה: לתת מוקדם — Ceftriaxone 2g IV + Metronidazole 500mg IV (או Ertapenem 1g IV/IM)'});
  }
  if(ctx.crushSuspect){
    items.push({k:'crush',ic:'🪨',cl:'#e67e22',obs:'מנגנון פציעה מסומן: מעיכה (crush) — סיכון תסמונת מעיכה',rec:'מומלץ: NaCl 0.9% בקצב 1L/שעה לפני חילוץ (לא הרטמן — סיכון היפרקלמיה)'});
  }
  if(ctx.pelvicSuspect&&!ctx.pelvicBinder){
    items.push({k:'pelvic',ic:'🦴',cl:'#9b59b6',obs:'סומנה פציעה באזור אגן במפת הגוף — חשד שבר אגן',rec:'מומלץ: הנחת מקבע אגן בגובה greater trochanters'});
  }
  if(ctx.pediatric){
    const wt=_getPatientWeight();
    items.push({k:'peds',ic:'🧒',cl:'#3498db',obs:`נרשם גיל ${ctx.age} שנים${wt?` · משקל ${wt}ק״ג`:''} — ילד מתחת לגיל 12`,rec:'מומלץ: מינונים לפי משקל (Broselow). קריקותירואידוטומיה אסורה מתחת לגיל 12'});
  }
  if(ctx.burns){
    const tbsa=calcBurnPercentage()||0;
    const _bAge=ctx.age,_bFragile=(_bAge!=null&&(_bAge<12||_bAge>=60));
    if(tbsa>=(_bFragile?10:20)){
      const wtKg=_getPatientWeight()||70;
      const inShock=ctx.deepShock||ctx.profoundShock;
      const rate=tbsa*10+(wtKg>80?Math.floor((wtKg-80)/10)*100:0);
      const fluidRec=inShock?'פלסמה (FDP/FFP) / דם — פצוע בהלם':(_bFragile?'הרטמן/Ringer — קצב לפי משקל וגיל (נוהל ילדים/קשישים), טיטור לפי תפוקת שתן':`הרטמן/Ringer, קצב התחלתי = TBSA% × 10 מ"ל/שעה (כ-${rate} מ"ל/שעה), טיטור לפי תפוקת שתן (30–50 מ"ל/שעה)`);
      items.push({k:'burn',ic:'🔥',cl:'#e67e22',obs:`נרשמה כוויה — חושבו ${tbsa}% TBSA (Rule of Nines) · משקל ${wtKg}ק״ג${inShock?' · בהלם':''}`,rec:`מומלץ: שטיפה + חבישה לחה + שיכוך כאב + מניעת היפותרמיה + ${fluidRec}`});
    } else if(tbsa>0){
      items.push({k:'burn',ic:'🔥',cl:'#e67e22',obs:`נרשמה כוויה — חושבו ${tbsa}% TBSA (לפי Rule of Nines)`,rec:'מומלץ: שטיפה + חבישה יבשה, שיכוך כאב'});
    } else {
      items.push({k:'burn',ic:'🔥',cl:'#e67e22',obs:'סומנה כוויה — לא זוהו אזורים במפה',rec:'מומלץ: סמן את אזורי הכוויה במפת הגוף לחישוב TBSA אוטומטי'});
    }
  }
  if(ctx.burns&&_casualtyInjuries.some(i=>i.type==='burn'&&['head','neck','back_head','back_neck'].includes(i.region))){
    items.push({k:'inhal',ic:'🔥',cl:'#e74c3c',obs:'כוויה בפנים/צוואר — חשד לפגיעת שאיפה (פיח, צרידות, מקום סגור)',rec:'חשד פגיעת שאיפה — אבטחת נתיב אוויר מוקדמת, חמצן 100%, SpO2 לא אמין (CO)'});
  }
  if(ctx.fracture){
    items.push({k:'compart',ic:'🦴',cl:'#3498db',obs:'שבר בגפה',rec:'בדוק תחושה, דופק דיסטלי וכאב לא פרופורציונלי (תסמונת תאים); נטר חוזר אחרי קיבוע'});
  }
  // Eye injury
  const eyeInjury=_casualtyInjuries.some(i=>['head'].includes(i.region)&&i.notes&&i.notes.includes('עין'))||_casualtyInjuries.some(i=>i.region==='face');
  if(eyeInjury){
    items.push({k:'eye',ic:'👁',cl:'#e67e22',obs:'סומנה פציעה באזור פנים/עיניים',rec:'מומלץ: מגן עין קשיח (Eye Shield) בלבד. אסור חבישת לחץ על העין! כוויה כימית — שטיפה ב-2L סליין'});
  }
  const collarMOIs=['fall','vehicle','blunt'];
  const matchedCollarMOI=collarMOIs.find(m=>_hasMOI(m));
  const penHeadNeck=_casualtyInjuries.some(i=>i.type==='penetrating'&&['head','back_head','neck','back_neck'].includes(i.region));
  if(!ctx.cCollar&&matchedCollarMOI&&!penHeadNeck){
    const moiLabels={fall:'נפילה',vehicle:'תאונת רכב',blast:'הדף',blunt:'פציעה קהה'};
    items.push({k:'collar',ic:'🦴',cl:'#3498db',obs:`מנגנון פציעה מסומן: ${moiLabels[matchedCollarMOI]||matchedCollarMOI} — סיכון לפגיעה בעמ״ש צווארי`,rec:'אם ער ומשתף פעולה: NEXUS — צווארון לפי החלטה'});
  }
  // MARCH-P progress strip
  const march=getMarchPStatus();
  let marchStrip='';
  marchStrip+=`<div style="display:flex;gap:3px;margin-bottom:8px;padding:6px;border-radius:8px;background:rgba(0,0,0,.2);border:1px solid var(--sep)">`;
  marchStrip+=`<div style="font-size:9px;color:var(--t3);font-weight:700;align-self:center;margin-left:6px">MARCH-P</div>`;
  march.items.forEach(it=>{
    const col=it.done?'#2ecc71':'var(--t4)';
    marchStrip+=`<div style="flex:1;text-align:center;padding:4px 2px;border-radius:5px;background:${it.done?'rgba(46,204,113,.12)':'rgba(255,255,255,.02)'};border:1px solid ${col}"><div style="font-size:10px;font-weight:900;color:${col}">${it.k}</div>${it.done?`<div style="font-size:8px;color:${col}">✓</div>`:''}</div>`;
  });
  marchStrip+=`</div>`;
  if(!items.length)return marchStrip;
  let h=marchStrip+'<div style="margin-bottom:8px;padding:8px;border-radius:10px;background:linear-gradient(180deg,rgba(231,76,60,.06),rgba(0,0,0,0));border:1px solid rgba(231,76,60,.2)">';
  h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">';
  h+='<div style="font-size:15px;font-weight:900;color:var(--re);display:flex;align-items:center;gap:4px">⚡ הצעות תוכנה — אינן ייעוץ רפואי</div>';
  h+='</div>';
  h+='<div style="font-size:14px;line-height:1.4;color:var(--t2);margin-bottom:8px;text-align:center;padding:8px;background:rgba(255,255,255,.04);border-radius:8px;font-weight:600">⚠ מחושב אוטומטית על ידי תוכנה מתוך הערכים שהוזנו, ועלול להיות שגוי. רק איש צוות רפואי מוסמך מחליט. גרסת בטא מוקדמת — אין להסתמך.</div>';
  h+='<div style="display:flex;flex-direction:column;gap:4px">';
  items.forEach(it=>{
    h+=`<div style="display:flex;align-items:flex-start;gap:8px;padding:7px 8px;border-radius:8px;background:rgba(${parseInt(it.cl.slice(1,3),16)},${parseInt(it.cl.slice(3,5),16)},${parseInt(it.cl.slice(5,7),16)},.1);border-right:3px solid ${it.cl}">`;
    h+=`<span style="font-size:18px;flex-shrink:0;line-height:1.1">${it.ic}</span>`;
    h+=`<div style="flex:1;text-align:right;min-width:0">`;
    h+=`<div style="font-size:11px;color:var(--t2);margin-bottom:3px;line-height:1.4">${escapeHtml(it.obs||'')}</div>`;
    h+=`<div style="font-size:11px;font-weight:800;color:${it.cl};line-height:1.4">${escapeHtml(it.rec||'')}</div>`;
    h+=`</div></div>`;
  });
  h+='</div></div>';
  return h;
}

// ── [moi] block from beta lines 8357-8366 ──
function _hasMOI(id){if(!_casualtyMOI)return false;if(Array.isArray(_casualtyMOI))return _casualtyMOI.includes(id);return _casualtyMOI===id;}
function _toggleMOI(id){
  if(!_casualtyMOI)_casualtyMOI=[];
  else if(!Array.isArray(_casualtyMOI))_casualtyMOI=[_casualtyMOI];
  if(id==='other'){const v=prompt('מנגנון פציעה חופשי:');if(!v)return;_casualtyMOI.push('other:'+v.slice(0,40));addTimestampedAction('injury','מנגנון: '+v,'');MedHost.renderIncidentPage();return;}
  const idx=_casualtyMOI.indexOf(id);
  if(idx>=0)_casualtyMOI.splice(idx,1);else _casualtyMOI.push(id);
  if(!_casualtyMOI.length)_casualtyMOI=null;
  MedHost.renderIncidentPage();
}


// ── X-CARE TAB HELPERS (stage 3.4) ──
// MED_PRESETS + patient setters (_setPainScore/_setPatientAge/_broselowWeight/_setPatientWeight)
// + renderXABCDETab dispatcher + getTqElapsed + renderEntryList + delete helpers
// + pelvic binder + C-collar add/clear. Inline onclick strings in XTab/ATab/etc
// still resolve global handlers at tap time — those live in beta until stage 3.4c.
const MED_PRESETS=[
  // concMg: default vial concentration in mg/mL for CC calculator
  // mgPerKg: typical mg/kg for weight-based dosing
  // respDepressant: flags opioids/sedatives for interaction alerts
  // prep: {stock, steps[], concentration, warnings[], onset, duration, redose}
  {name:'מורפין',dosesByRoute:{IV:['2mg','5mg'],IM:['5mg']},concMg:{IV:1,IM:10},mgPerKg:{IV:0.08,IM:0.1},respDepressant:true,
   prep:{stock:'אמפולה 10 mg/1 מ"ל',steps:['שאוב 1 מ"ל מהאמפולה למזרק','דלל 1:10 עם 9 מ"ל NS → ריכוז 1 mg/mL','שאוב את המנה הנדרשת (5 מ"ל = 5 mg)','הזרק IV איטי, שטוף ב-20 מ"ל NS לפחות'],concentration:'1 mg/mL לאחר דילול',warnings:['⚠️ הלם (SBP<90 או HR>130) — הפחת מנה ל-2 mg או הימנע','💤 דיכוי נשימתי אפשרי','🤢 בחילות — שקול מטוקלופרמיד 10mg IV איטי בדילול'],onset:'5–10 דק׳ IV',duration:'2–4 שעות',redose:'כל 15 דק׳'}},
  {name:'קטמין',dosesByRoute:{IV:['20mg','25mg'],IM:['50mg','100mg'],IN:['50mg','100mg']},concMg:{IV:10,IM:50,IN:50},mgPerKg:{IV:0.3,IM:0.5,IN:1},
   prep:{stock:'אמפולה 500 mg/10 מ"ל (50 mg/mL)',steps:['אנלגזיה IV: דלל 1 מ"ל (50 mg) ב-4 מ"ל NS → 10 mg/mL','הזרק 2.5 מ"ל (25 mg) IV איטי תוך דקה, שטוף ב-10 מ"ל NS','IM/IN: ללא דילול (50 mg/mL) — 50 mg = 1 מ"ל','אינדוקציה: 1–2 mg/kg IV (0.5–1 mg/kg בהלם); סדציה IM 4 mg/kg'],concentration:'10 mg/mL לאחר דילול (IV); 50 mg/mL (IM/IN)',warnings:['💧 הפרשת רוק מוגברת — אטרופין 0.5 mg IV אם נדרש','🧠 בדרך כלל שומר על רפלקסי נתיב אוויר ול"ד; זהירות בהלם מאוחר','👶 ילדים: 0.3 mg/kg IV לאנלגזיה'],onset:'1–2 דק׳',duration:'15–20 דק׳',redose:'IV כל 20 דק׳ / IM-IN כל 30 דק׳'}},
  {name:'TXA',dosesByRoute:{IV:['1g']},concMg:{IV:100},
   prep:{stock:'2 × אמפולה 500 mg',steps:['שאוב 2 אמפולות × 500 mg לסה״כ 1 גרם','הוסף ל-100 מ"ל NS והזרק IV תוך ≥10 דק׳ (בולוס מהיר → ירידת ל"ד)','פינוי באמצעות קו IV נפרד מדם/פלסמה'],concentration:'100 mg/mL',warnings:['🚫 לא לערבב עם דם/פלסמה באותו קו IV — שטוף ב-10 מ"ל NS בין','⏱ חלון 3 שעות מהפציעה בלבד','💊 מנה אחת בנקודת הפציעה (1 גרם לפי נוהל)','💊 מנה שנייה 1 גרם / עירוי 8 שעות — לפי הוראת רופא (CRASH-2)','👶 ילדים: 15 mg/kg עד גיל 12, מעל — 1 גרם'],onset:'מיידי',duration:'~8 שעות',redose:'אין בשטח — מנה שנייה לפי רופא'}},
  {name:'צפטריאקסון',dosesByRoute:{IV:['2g','1g'],IM:['1g','2g']},
   prep:{stock:'אבקה 1 גרם / ויאל',steps:['IV: הוסף 10 מ"ל מים סטריליים לכל ויאל, ערבב, הזרק IV push 2–4 דק׳','IM: הוסף 3.5 מ"ל מים סטריליים או לידוקאין 1% (פחות כואב), הזרק בעומק'],concentration:'מסיסות מלאה',warnings:['🚫 לעולם לא לערבב עם הרטמן/Ringer Lactate — משקע','🚫 IM בהלם — ספיגה ירודה, עדיף IV','💊 פציעה חודרת + פינוי >1 שעה → מנה אחת ב-24 שעות','ℹ️ אנטיביוטיקה לפי נוהל צה״ל (TCCC ארה״ב: מוקסיפלוקסצין 400 mg PO / ertapenem 1 g IV/IM)','👶 ילדים: 100 mg/kg/יום, מקס 2g/יום'],onset:'דקות IV',duration:'24 שעות',redose:'כל 24 שעות'}},
  {name:'מטרונידזול',dosesByRoute:{IV:['500mg']},
   prep:{stock:'שקית 500 mg/100 מ"ל',steps:['שקית מגיעה מדוללת — אין הכנה נוספת','הזרק IV לאט דרך טפטוף, 30–60 דק׳'],concentration:'5 mg/mL',warnings:['💊 תוספת לצפטריאקסון בפציעה בטנית/ראש','⏱ כל 8 שעות בפינוי ממושך','👶 ילדים: 10 mg/kg × 3 ביום'],onset:'IV דקות',duration:'8 שעות',redose:'כל 8 שעות'}},
  {name:'אדרנלין',dosesByRoute:{IM:['0.3mg','0.5mg'],IV:['10mcg (1:100,000)','50mcg']},
   prep:{stock:'אמפולה 1 mg/1 מ"ל (1:1000)',steps:['הכנת 1:10,000: 1 מ"ל (1:1000) + 9 מ"ל NS = 10 מ"ל','הכנת 1:100,000: 1 מ"ל (1:10,000) + 9 מ"ל NS = 10 מקג׳/מ"ל','IV: תן בולוסים של 10 מקג׳ (1 מ"ל של 1:100,000)','טיטר לפי ל"ד — יעד SBP ≥100'],concentration:'תלוי דילול: 1:1000 / 1:10,000 / 1:100,000',warnings:['⏱ פעולה קצרה מאוד — חזור כל כמה דקות','🚫 IV bolus גבוה בלי הלם = סכנה','📊 נטר ל"ד אחרי כל מנה'],onset:'מיידי IV, 5 דק׳ IM',duration:'קצר (דקות)',redose:'לפי תגובה'}},
  {name:'אונדנסטרון',dosesByRoute:{IV:['4mg'],PO:['4mg']},
   prep:{stock:'אמפולה 4 mg/2 מ"ל',steps:['IV: שאוב 2 מ"ל, הזרק איטי 2 דק׳','PO: טבלייה 4 mg מתחת ללשון'],concentration:'2 mg/mL',warnings:['🫀 אריתמיה QT מאורכת — נטר אם רקע לבבי','💊 שקול לפני מתן אופיואידים במקום מטוקלופרמיד'],onset:'דקות IV',duration:'4–8 שעות',redose:'כל 8 שעות'}},
  {name:'פנטניל',dosesByRoute:{IV:['50mcg'],IN:['50mcg','100mcg']},respDepressant:true,
   prep:{stock:'אמפולה 100 mcg/2 מ"ל',steps:['IV: שאוב המנה, הזרק איטי 1 דק׳','IN: רסס חצי בכל נחיר דרך מכשיר MAD'],concentration:'50 mcg/mL',warnings:['💤 דיכוי נשימתי בולט','⚠️ IV 50 mcg ≈ מורפין 5 mg — לא בהלם / מצוקה נשימתית (העדף קטמין)','👶 ילדים: 1–2 mcg/kg IN'],onset:'1–2 דק׳ IV, 3–5 דק׳ IN',duration:'30–60 דק׳',redose:'IV כל 10–15 דק׳ / OTFC לאחר 15 דק׳'}},
  {name:'פרצטמול',dosesByRoute:{IV:['1g'],PO:['1g']},
   prep:{stock:'שקית 1g/100 מ"ל או טבליות 500 mg',steps:['IV: שקית מוכנה — הזרק 15 דק׳','PO: 2 טבליות × 500 mg'],concentration:'10 mg/mL IV',warnings:['💊 כאב קל בלבד (NRS ≤4)','🚫 מקס 4 גרם/24 שעות','👶 IV מתחת ל-50 ק"ג: 15 mg/kg'],onset:'10–15 דק׳',duration:'4–6 שעות',redose:'כל 6 שעות'}},
  {name:'דורמיקום',dosesByRoute:{IV:['2.5mg','5mg'],IM:['5mg'],IN:['5mg']},respDepressant:true,
   prep:{stock:'אמפולה 5 mg/5 מ"ל',steps:['IV: שאוב לפי מנה, הזרק איטי','אינדוקציה: 0.05–0.1 mg/kg IV עד 5 mg','אחזקה: 1–1.5 mg IV כל 15 דק׳ בפצוע מורדם'],concentration:'1 mg/mL',warnings:['⚠️ חצה מנה בהלם (SBP<90)','💤 דיכוי נשימתי + ירידת ל"ד','🔁 משולב עם קטמין באינדוקציה'],onset:'1–2 דק׳',duration:'20–60 דק׳',redose:'כל 15 דק׳ בפצוע מורדם'}},
  {name:'אטרופין',dosesByRoute:{IV:['0.5mg','1mg']},
   prep:{stock:'אמפולה 1 mg/1 מ"ל',steps:['IV: שאוב 0.5 מ"ל (0.5 mg)','הזרק push מהיר'],concentration:'1 mg/mL',warnings:['💧 שימוש עיקרי: שליטה בהפרשות עם קטמין','🫀 ברדיקרדיה סימפטומטית','👶 ילדים: 20 mcg/kg (מינימום 0.1 mg)'],onset:'דקות',duration:'2–4 שעות',redose:'לפי צורך'}},
  {name:'אופטלגין',dosesByRoute:{PO:['1g'],IV:['1g']},
   prep:{stock:'אמפולה 1g/2 מ"ל או טבלייה 500 mg',steps:['PO: 2 טבליות × 500 mg','IV: שאוב 2 מ"ל, דלל ב-10 מ"ל NS, הזרק איטי 5 דק׳'],concentration:'500 mg/mL',warnings:['💊 כאב קל–בינוני (NRS ≤4)','⚠️ אלרגיה — שאל לפני מתן','🚫 הלם / SBP מתחת ל-100 — אסור IV (ירידת ל"ד)','⚠️ בטן חודרת / צום — אל תיתן PO','🚫 אגרנולוציטוזיס נדיר בשימוש כרוני'],onset:'10 דק׳',duration:'4–6 שעות',redose:'כל 6 שעות'}},
  {name:'אקמול',dosesByRoute:{PO:['1g']},
   prep:{stock:'טבליות 500 mg',steps:['2 טבליות × 500 mg PO עם מים'],concentration:'-',warnings:['💊 כאב קל בלבד','🚫 מקס 4 גרם/24 שעות'],onset:'15–30 דק׳',duration:'4–6 שעות',redose:'כל 6 שעות'}},
  {name:'Actiq OTFC',dosesByRoute:{Buccal:['800mcg']},
   prep:{stock:'לוזנג׳ 800 mcg על מקל',steps:['הכנס לוזנג׳ לחלל פה (בין לחי לשיניים)','מצוץ ~15 דק׳ — אל תבלע','מקס 2 לוזנג׳ים לפצוע'],concentration:'-',warnings:['💤 דיכוי נשימתי','🚫 אסור במצב הכרה ירוד / דיספאגיה','⚠️ מקסימום 2 לוזנג׳ים — לאחר מכן IV בלבד'],onset:'7–10 דק׳',duration:'1–2 שעות',redose:'לוזנג׳ שני לאחר 15 דק׳ במידת הצורך'}},
  {name:'נרקאן',dosesByRoute:{IV:['0.04mg','0.4mg'],IM:['0.4mg'],IN:['2mg']},
   prep:{stock:'אמפולה 0.4 mg/1 מ"ל',steps:['IV: שאוב 1 מ"ל, הזרק push','IN: בקבוק מרסס מוכן 2 mg — 1 מ"ל בכל נחיר','טרואומה: טיטרציה 0.04–0.4 mg IV (מניעת הצפת קטכולמינים); חזור כל 2–3 דק׳ עד תגובה'],concentration:'0.4 mg/mL IV',warnings:['⚠️ הפיכת אופיואידים — צפה כאב חד + בחילות','⏱ משך קצר — עלול להחזיר דיכוי נשימתי'],onset:'1–3 דק׳',duration:'30–90 דק׳',redose:'כל 2–3 דק׳ לפי תגובה'}},
  {name:'Ertapenem',dosesByRoute:{IV:['1g'],IM:['1g']},
   prep:{stock:'ויאל 1 g',steps:['IV: הוסף 10 מ"ל NS לויאל, ערבב והזרק IV תוך 30 דק׳','IM: הוסף 3.2 מ"ל לידוקאין 1%, הזרק עמוק'],concentration:'~100 mg/mL (IM)',warnings:['💊 חלופה בסגנון TCCC ארה״ב לצפטריאקסון + מטרונידזול (מנה אחת)','🚫 לא לערבב עם גלוקוז','👶 ילדים: 15 mg/kg'],onset:'דקות IV',duration:'24 שעות',redose:'כל 24 שעות'}},
  {name:'Ca-gluconate',dosesByRoute:{IV:['3g'],IO:['3g']},
   prep:{stock:'אמפולה 10% (1 g / 10 מ"ל)',steps:['3 אמפולות = 3 g (30 מ"ל)','הזרק IV/IO איטי תוך 5–10 דק׳'],concentration:'100 mg/mL',warnings:['💊 אחרי יחידת דם ראשונה; חזרה אחרי יחידה רביעית','🚫 לא באותו קו עם דם — שטוף לפני ואחרי'],onset:'דקות',duration:'30–60 דק׳',redose:'אחרי כל 4 יחידות דם'}},
  {name:'CaCl',dosesByRoute:{IV:['1g'],IO:['1g']},
   prep:{stock:'אמפולה 10% (1 g / 10 מ"ל)',steps:['10 מ"ל (1 g) IV/IO איטי תוך 5–10 דק׳'],concentration:'100 mg/mL',warnings:['⚠️ מגרה רקמות — העדף IO/קו מרכזי, הימנע מחדירה חוץ-ורידית','💊 אחרי יחידת דם ראשונה; חזרה אחרי יחידה רביעית','🚫 לא באותו קו עם דם — שטוף לפני ואחרי'],onset:'דקות',duration:'30–60 דק׳',redose:'אחרי כל 4 יחידות דם'}}
];
// Doses live per route (dosesByRoute) so unsafe route/dose combinations are never offered (e.g. adrenaline 1 mg IV, ketamine 100 mg IV, naloxone 2 mg IV).
// `routes` and the flat `doses` union are derived for backward compatibility; presets that still declare doses+routes keep working.
MED_PRESETS.forEach(m=>{
  if(m.dosesByRoute){
    m.routes=Object.keys(m.dosesByRoute);
    const u=[];m.routes.forEach(r=>m.dosesByRoute[r].forEach(d=>{if(!u.includes(d))u.push(d);}));
    m.doses=u;
  } else if(m.doses&&m.routes){
    m.dosesByRoute={};m.routes.forEach(r=>{m.dosesByRoute[r]=m.doses.slice();});
  }
});
function medDosesFor(med,route){return(med&&med.dosesByRoute&&med.dosesByRoute[route])||[];}
function medDoseRoutePairs(med){const out=[];((med&&med.routes)||[]).forEach(r=>medDosesFor(med,r).forEach(d=>out.push({dose:d,route:r})));return out;}
// _getPatientWeight moved to shared/medical-forms.js
function _setPainScore(val){
  const v=val==='null'||val===null?null:parseInt(val);
  _casualtyPainScore=v;
  if(!_casualtyXABCDE.e.painHistory)_casualtyXABCDE.e.painHistory=[];
  if(v!==null)_casualtyXABCDE.e.painHistory.push({score:v,time:new Date().toISOString()});
  addTimestampedAction('e',v===null?'כאב: לא ידוע':`כאב: ${v}/10`,'');
  MedHost.triggerAutoSave();MedHost.renderIncidentPage();
}
function _setPatientAge(years){
  if(!_casualtyXABCDE.e)_casualtyXABCDE.e={};
  _casualtyXABCDE.e.ageYears=years;
  // Auto-set weight from Broselow estimate if not already set
  if(!_getPatientWeight()&&years<=12){
    _casualtyXABCDE.e.weightKg=_broselowWeight(years);
    _casualtyXABCDE.e.weightEst=true;
  }
  addTimestampedAction('e','גיל: '+years+' שנים','');
  MedHost.triggerAutoSave();MedHost.renderIncidentPage();
}
// Simple Broselow-style weight estimate by age (kg). Pediatric default lookup.
function _broselowWeight(years){
  // IDF trauma book table (ch. 18, appendix B) up to age 10; APLS estimate above. Confirm with a length tape: dosing is mg/kg.
  if(years<0.5)return 3.5;
  if(years<1)return 7;
  if(years<4)return 11;
  if(years<8)return 17;
  if(years<11)return 27;
  if(years<=12)return 3*years+7;
  if(years<=17)return Math.min(70,3*years+7); // APLS estimate for teenagers - confirm weight
  return 70;
}
function _setPatientWeight(kg){
  if(!_casualtyXABCDE.e)_casualtyXABCDE.e={};
  _casualtyXABCDE.e.weightKg=kg;
  _casualtyXABCDE.e.weightEst=false;
  addTimestampedAction('e','משקל: '+kg+' ק"ג','');
  MedHost.triggerAutoSave();
  MedHost.renderIncidentPage();
}
// IDF 2026 shock criterion: SBP<90 OR unmeasurable + (radial absent OR altered consciousness).
// _inProfoundShock = legacy gate (any positive sign). _isDeepShock = full 2026 criterion.
// _inProfoundShock + _isDeepShock moved to shared/medical-forms.js
let _tapRateState={active:false,type:'',taps:0,startTime:null,timerId:null};
let _crtState={pressing:false,startTime:null};
let _tqSitePickerOpen=false;
let _medPickerOpen=false,_medSelected=null;
// v3.29 M4: medication prep drawer state
var _medPrepOpen = (typeof _medPrepOpen!=='undefined')?_medPrepOpen:null; // index or null
function openMedPrep(i){_medPrepOpen=i;MedHost.renderIncidentPage();}
function closeMedPrep(){_medPrepOpen=null;MedHost.renderIncidentPage();}
function renderMedPrepSheet(){
  if(_medPrepOpen==null)return'';
  const med=MED_PRESETS[_medPrepOpen];
  if(!med||!med.prep)return'';
  const p=med.prep;
  let h=`<div onclick="closeMedPrep()" style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;display:flex;align-items:flex-end;justify-content:center" role="dialog" aria-modal="true">`;
  h+=`<div onclick="event.stopPropagation()" style="background:var(--c1);width:100%;max-width:520px;border-radius:16px 16px 0 0;padding:16px;max-height:80vh;overflow-y:auto">`;
  h+=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div style="font-size:16px;font-weight:900;color:var(--gr)">💊 ${escapeHtml(med.name)} — איך מכינים</div><button onclick="closeMedPrep()" aria-label="סגור" style="background:none;border:none;color:var(--t3);font-size:22px;cursor:pointer;padding:4px 8px;min-height:40px;min-width:40px">✕</button></div>`;
  if(p.stock)h+=`<div style="font-size:11px;color:var(--t3);margin-bottom:4px">מלאי</div><div style="font-size:13px;color:var(--tx);margin-bottom:10px;padding:6px 10px;background:var(--c2);border-radius:8px">${escapeHtml(p.stock)}</div>`;
  if(p.steps&&p.steps.length){
    h+=`<div style="font-size:11px;color:var(--t3);margin-bottom:4px">הכנה</div><ol style="padding-inline-start:20px;margin:0 0 10px">`;
    p.steps.forEach(s=>{h+=`<li style="font-size:13px;color:var(--tx);line-height:1.5;margin-bottom:4px">${escapeHtml(s)}</li>`;});
    h+=`</ol>`;
  }
  if(p.concentration)h+=`<div style="font-size:11px;color:var(--t3);margin-bottom:4px">ריכוז סופי</div><div style="font-size:13px;color:var(--tx);margin-bottom:10px;font-family:monospace">${escapeHtml(p.concentration)}</div>`;
  if(p.warnings&&p.warnings.length){
    h+=`<div style="font-size:11px;color:var(--re-hi);margin-bottom:4px;font-weight:700">אזהרות</div><div style="margin-bottom:10px">`;
    p.warnings.forEach(w=>{h+=`<div style="font-size:12px;color:var(--tx);padding:5px 8px;background:rgba(231,76,60,.08);border-inline-start:3px solid var(--re-hi);margin-bottom:4px;border-radius:4px">${escapeHtml(w)}</div>`;});
    h+=`</div>`;
  }
  const meta=[];
  if(p.onset)meta.push(`התחלה: ${p.onset}`);
  if(p.duration)meta.push(`משך: ${p.duration}`);
  if(p.redose)meta.push(`חזרה: ${p.redose}`);
  if(meta.length)h+=`<div style="font-size:12px;color:var(--t2);padding:8px 10px;background:var(--c2);border-radius:8px">${meta.map(escapeHtml).join(' · ')}</div>`;
  h+=`</div></div>`;
  return h;
}

function renderXABCDETab(tab){
  // Tier 21b: append a "הערות לשלב X" textarea at the bottom of each
  // step so the medic can capture step-specific observations separate
  // from the general case story + free-form notes.
  let body='';
  switch(tab){
    case'x':body=renderXTab();break;
    case'a':body=renderATab();break;
    case'b':body=renderBTab();break;
    case'c':body=renderCTab();break;
    case'd':body=renderDTab();break;
    case'e':body=renderETab();break;
    default:return'';
  }
  // Tier 29: per-tab context hints at the top
  const hints=renderTabHints(tab);
  return hints+body+renderStepNotes(tab);
}
// getXABCDESummary + fmtTime moved to shared/medical-forms.js
function getTqElapsed(iso){const diff=Date.now()-new Date(iso).getTime();const m=Math.floor(diff/60000),s=Math.floor((diff%60000)/1000);return{m,s,alert:diff>=7200000,str:String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')};}
// Generic X/A/B/C/E entry list — every row is deletable. Pass the
// xabcde subkey ('x'/'a'/...) and the field name so the delete helper
// can splice the right array.
function renderEntryList(arr,labelFn,subKey,fieldName){
  if(!arr||!arr.length)return'';
  return arr.map((e,i)=>{
    const deleteBtn=(subKey&&fieldName)?`<button aria-label="מחק רשומה" onclick="deleteXabcdeEntry('${subKey}','${fieldName}',${i})" style="background:none;border:none;color:var(--re);font-size:13px;cursor:pointer;font-family:var(--f);padding:4px 6px;min-height:32px;min-width:32px">🗑</button>`:'';
    return `<div class="xabcde-entry" style="align-items:center"><span class="time">${fmtTime(e.time)}</span><span style="flex:1">${escapeHtml(labelFn(e))}</span>${deleteBtn}</div>`;
  }).join('');
}
function deleteXabcdeEntry(subKey,fieldName,idx){
  const arr=_casualtyXABCDE?.[subKey]?.[fieldName];
  if(!Array.isArray(arr)||idx<0||idx>=arr.length)return;
  const removed=arr.splice(idx,1)[0];
  addTimestampedAction(subKey,'❌ הוסר: '+(removed?.label||fieldName),'');
  MedHost.triggerAutoSave();
  MedHost.renderIncidentPage();
}
function deleteTourniquet(idx){
  const tqs=_casualtyXABCDE.x.tourniquets;
  if(idx<0||idx>=tqs.length)return;
  const removed=tqs.splice(idx,1)[0];
  addTimestampedAction('x','❌ הוסר ח"ע '+(BODY_LABELS[removed?.site]||removed?.site||''),'');
  MedHost.triggerAutoSave();
  MedHost.renderIncidentPage();
}
function clearBreathingEntry(field){
  if(!_casualtyXABCDE.b[field])return;
  const entry=_casualtyXABCDE.b[field];
  _casualtyXABCDE.b[field]=null;
  addTimestampedAction('b','❌ הוסר '+field+' '+(entry?.side||''),'');
  MedHost.triggerAutoSave();
  MedHost.renderIncidentPage();
}
// Tier 28: Pelvic Binder (X tab) — IDF 2026 mandates greater trochanter site.
function addPelvicBinder(){
  if(!_casualtyXABCDE.e)_casualtyXABCDE.e={};
  _casualtyXABCDE.e.pelvicBinder={site:'greater trochanter',time:new Date().toISOString()};
  addTimestampedAction('e','מקבע אגן (greater trochanter)','');
  MedHost.triggerAutoSave();MedHost.renderIncidentPage();
}
function clearPelvicBinder(){
  if(!_casualtyXABCDE.e?.pelvicBinder)return;
  _casualtyXABCDE.e.pelvicBinder=null;
  addTimestampedAction('e','❌ הוסר מקבע אגן','');
  MedHost.triggerAutoSave();MedHost.renderIncidentPage();
}
// Tier 28: C-Collar (A tab) — cervical spine immobilization
function addCervicalCollar(){
  if(!_casualtyXABCDE.a)_casualtyXABCDE.a={};
  _casualtyXABCDE.a.cervicalCollar={time:new Date().toISOString()};
  addTimestampedAction('a','צווארון C-Collar','');
  MedHost.triggerAutoSave();MedHost.renderIncidentPage();
}
function clearCervicalCollar(){
  if(!_casualtyXABCDE.a?.cervicalCollar)return;
  _casualtyXABCDE.a.cervicalCollar=null;
  addTimestampedAction('a','❌ הוסר צווארון','');
  MedHost.triggerAutoSave();MedHost.renderIncidentPage();
}

// ── VITALS + MEDS + TIMERS + CRT (stage 3.5) ──

// ── [addTourniquetEntry] from beta lines 6827-6827 ──
function addTourniquetEntry(site){const t=new Date().toISOString();_casualtyXABCDE.x.tourniquets.push({site,time:t});addTimestampedAction('x','ח"ע — '+(BODY_LABELS[site]||site),'');autoPlaceTreatment(site,'tourniquet');if(_mciResources.tourniquets>0)_mciResources.tourniquets--;MedHost.renderIncidentPage();}

// ── [autoPlaceTreatment] from beta lines 6882-6892 ──
function autoPlaceTreatment(regionId,type){
  const side=_casualtyView;
  if(!regionId){
    // Find first injured region without this treatment
    const inj=_casualtyInjuries.find(i=>i.side===side&&!_casualtyTreatments.some(t=>t.region===i.region&&t.side===side&&t.type===type));
    if(inj)regionId=inj.region;else return;
  }
  if(!_casualtyTreatments.some(t=>t.region===regionId&&t.side===side&&t.type===type)){
    _casualtyTreatments.push({region:regionId,side,type,time:new Date().toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})});
  }
}

// ── [meds+vitals+timer+CRT] from beta lines 7477-7897 ──
function addMedication(name,dose,route){
  // Check for recent duplicate dose (within 5 minutes for controlled substances)
  const controlled=['קטמין','פנטניל','מורפין'];
  if(controlled.includes(name)){
    const lastSame=_casualtyXABCDE.e.medications.filter(m=>m.drug===name).slice(-1)[0];
    if(lastSame){
      const minsAgo=(Date.now()-new Date(lastSame.time).getTime())/60000;
      if(minsAgo<5&&!window._fieldConfirmed){
        if(!confirm(`${name} ניתן לפני ${Math.round(minsAgo)} דקות. להמשיך?`))return;
      }
    }
  }
  // --- Tier 12 safety checks ---
  // 1) Profound-shock morphine override. If the user tries to give >2mg
  //    morphine while SBP<90 or HR>130, refuse unless they confirm.
  if(name==='מורפין' && _inProfoundShock()){
    const mgVal=parseFloat(String(dose).replace(/[^\d.]/g,''))||0;
    if(mgVal>2){
      if(!window._fieldConfirmed&&!confirm(`⚠️ הלם עמוק (ל"ד<90 או דופק>130).\nהפרוטוקול קובע מורפין 2mg בלבד (לא ${dose}).\nלהמשיך בכל זאת?`))return;
      addTimestampedAction('e','⚠ חריגה מפרוטוקול: מורפין '+dose+' בהלם עמוק','');
    }
  }
  // 2) Respiratory-depressant interaction. Morphine/fentanyl/dormicum
  //    stack dangerously; warn if another was given in the last 30min.
  const preset=MED_PRESETS.find(m=>m.name===name);
  if(preset?.respDepressant){
    const cutoff=Date.now()-30*60000;
    const recent=(_casualtyXABCDE.e.medications||[]).filter(m=>{
      const p=MED_PRESETS.find(mm=>mm.name===m.drug);
      return p?.respDepressant && m.drug!==name && new Date(m.time).getTime()>cutoff;
    });
    if(recent.length){
      const others=recent.map(m=>m.drug).join(' + ');
      if(!window._fieldConfirmed&&!confirm(`🚨 אינטראקציה — ${name} מעל ${others} ב-30 דק' האחרונות.\nסיכון לדיכוי נשימה. להמשיך?`))return;
      addTimestampedAction('e','⚠ אינטראקציה: '+name+' מעל '+others,'');
    }
  }
  const entry={drug:name,dose,route,time:new Date().toISOString()};_casualtyXABCDE.e.medications.push(entry);addTimestampedAction('e',name+' '+dose+' '+route,'');
  // Redose alerts — persisted to localStorage so they survive tab
  // evict / service worker restart. On re-open we rehydrate pending
  // alerts for this casualty and reschedule the setTimeout.
  if(name==='קטמין'){const mins=45;_scheduleRedose('קטמין',mins);}
  if(name==='פנטניל'){_scheduleRedose('פנטניל',15);}
  if(name==='TXA'){const injuryTime=_incidentData?.timestamp?.toDate?.();if(injuryTime&&(Date.now()-injuryTime.getTime())>3*3600000)MedHost.toast('⚠️ TXA ניתן >3 שעות מהפציעה — בדוק התוויה',false);}
  MedHost.renderIncidentPage();}
function deleteMedication(idx){
  const meds=_casualtyXABCDE.e.medications||[];
  if(idx<0||idx>=meds.length)return;
  const removed=meds.splice(idx,1)[0];
  addTimestampedAction('e','❌ הוסר: '+(removed?.drug||'')+' '+(removed?.dose||'')+' '+(removed?.route||''),'');
  MedHost.triggerAutoSave();
  MedHost.renderIncidentPage();
}
function editMedication(idx){
  const meds=_casualtyXABCDE.e.medications||[];
  if(idx<0||idx>=meds.length)return;
  const m=meds[idx];
  const newDose=prompt('עדכן מינון ל-'+m.drug+' ('+m.route+')',m.dose);
  if(newDose===null)return;
  const n=String(newDose).trim();
  if(!n){MedHost.toast('ערך ריק',false);return;}
  meds[idx]={...m,dose:n,editedAt:new Date().toISOString()};
  addTimestampedAction('e','✏️ עודכן: '+m.drug+' '+m.dose+' → '+n,'');
  MedHost.triggerAutoSave();
  MedHost.renderIncidentPage();
}
function _redoseKey(){return 'sh_redose_'+(_casualtyEditId||'new');}
function _readRedoses(){try{return JSON.parse(localStorage.getItem(_redoseKey())||'[]');}catch(e){return [];}}
function _writeRedoses(list){try{localStorage.setItem(_redoseKey(),JSON.stringify(list));}catch(e){}}
function _scheduleRedose(drug,mins){
  const dueAt=Date.now()+mins*60000;
  const list=_readRedoses();list.push({drug,mins,dueAt});_writeRedoses(list);
  const id=setTimeout(()=>_fireRedose(drug,mins,dueAt),mins*60000);
  _medRedoseTimers.push(id);
}
function _fireRedose(drug,mins,dueAt){
  if(_casualtyEditMode)MedHost.toast(`⏰ ${drug} — מנה חוזרת אפשרית (${mins} דק')`,false);
  if(navigator.vibrate)navigator.vibrate([50,30,50]);
  // Remove from persisted list.
  const list=_readRedoses().filter(r=>r.dueAt!==dueAt);_writeRedoses(list);
}
// Called from editCasualty to rehydrate pending redose alerts for this
// casualty. Fires immediate alert if due time already passed while the
// app was backgrounded.
function _rehydrateRedoses(){
  const list=_readRedoses();const now=Date.now();const keep=[];
  list.forEach(r=>{
    if(r.dueAt<=now){_fireRedose(r.drug,r.mins,r.dueAt);}
    else{const id=setTimeout(()=>_fireRedose(r.drug,r.mins,r.dueAt),r.dueAt-now);_medRedoseTimers.push(id);keep.push(r);}
  });
  _writeRedoses(keep);
}
function clearRedoseTimers(){_medRedoseTimers.forEach(id=>clearTimeout(id));_medRedoseTimers=[];}

// Tap-to-rate — no fixed countdown. Tap 1 starts the clock, every tap
// from #2 onward computes BPM live as (taps-1) * 60 / elapsed_sec. This
// is far more accurate than the old "tap for 15s then ×4" hack and lets
// the medic stop as soon as the rate stabilizes.
function _computeTapRate(state){
  if(!state.active||state.taps<2||!state.startTime)return 0;
  const elapsedSec=(Date.now()-state.startTime)/1000;
  if(elapsedSec<=0)return 0;
  return Math.round(((state.taps-1)*60)/elapsedSec);
}
function startTapToRate(type){
  if(_tapRateState.active&&_tapRateState.type===type){
    _tapRateState.taps++;
    _tapRateState.lastTap=Date.now();
    MedHost.renderIncidentPage();
    return;
  }
  // Starting a new session — clear any previous type.
  _tapRateState={active:true,type,taps:1,startTime:Date.now(),lastTap:Date.now(),timerId:null};
  MedHost.renderIncidentPage();
}
// Commits the currently-tapped rate into XABCDE, vitals input, AND auto-
// pushes a full vitals reading so the Vitals tab updates without re-entry.
function commitTapRate(){
  if(!_tapRateState.active||_tapRateState.taps<2)return;
  const type=_tapRateState.type;
  const rate=_computeTapRate(_tapRateState);
  if(type==='rr'){
    _casualtyXABCDE.b.respiratoryRate=rate;
    _casualtyVitalsInput.rr=String(rate);
    addTimestampedAction('b','קצב נשימה: '+rate+'/דקה (tap×'+_tapRateState.taps+')','');
  }else{
    _casualtyXABCDE.c.pulseRate=rate;
    _casualtyVitalsInput.pulse=String(rate);
    addTimestampedAction('c','דופק: '+rate+'/דקה (tap×'+_tapRateState.taps+')','');
  }
  _tapRateState={active:false,type:'',taps:0,startTime:null,lastTap:null,timerId:null};
  if(navigator.vibrate)navigator.vibrate(100);
  // Auto-push into the vitals history so the Vitals tab reflects the
  // new measurement immediately. Reads other fields from the controlled
  // vitals inputs so a partial commit still produces a useful row.
  _pushVitalsRowFromInputs('tap-rate');
  MedHost.triggerAutoSave();
  MedHost.renderIncidentPage();
}
function cancelTapRate(){
  _tapRateState={active:false,type:'',taps:0,startTime:null,lastTap:null,timerId:null};
  MedHost.renderIncidentPage();
}
// Manual numeric entry: prompts for a value, writes it into state +
// vitals history same as commitTapRate. Falls back to a simple prompt()
// so it works on every device without adding a modal.
function manualEnterRate(type){
  const label=type==='rr'?'קצב נשימה (לדקה)':'דופק (לדקה)';
  const v=prompt(label);
  if(v===null)return;
  const n=parseInt(v,10);
  if(!isFinite(n)||n<0||n>300){MedHost.toast('ערך לא תקין',false);return;}
  if(type==='rr'){_casualtyXABCDE.b.respiratoryRate=n;_casualtyVitalsInput.rr=String(n);addTimestampedAction('b','קצב נשימה: '+n+'/דקה (ידני)','');}
  else{_casualtyXABCDE.c.pulseRate=n;_casualtyVitalsInput.pulse=String(n);addTimestampedAction('c','דופק: '+n+'/דקה (ידני)','');}
  _pushVitalsRowFromInputs('manual');
  MedHost.triggerAutoSave();
  MedHost.renderIncidentPage();
}
// Writes the current _casualtyVitalsInput snapshot into _casualtyVitals so
// the Vitals tab / trend chart / CDS alerts update immediately. Only
// records if there's at least one non-empty field.
function _pushVitalsRowFromInputs(source){
  const vi=_casualtyVitalsInput||{};
  const pulse=parseInt(vi.pulse)||null;
  const rr=parseInt(vi.rr)||null;
  const spo2=parseInt(vi.spo2)||null;
  const bp=(vi.bp||'').trim();
  if(!pulse&&!rr&&!spo2&&!bp)return;
  _casualtyVitals.push({pulse,rr,spo2,bp,time:new Date().toISOString(),source:source||'tap'});
  // Re-run CDS with the fresh values.
  try{runClinicalAlerts(pulse,rr,spo2,bp);}catch(e){}
}

// CRT
function crtStart(){_crtState={pressing:true,startTime:Date.now()};MedHost.renderIncidentPage();}

// Auto-refresh for live timers (tourniquets, tap-to-rate, CRT)
let _casualtyTimerInterval=null;
function ensureCasualtyTimers(){
  if(_casualtyTimerInterval)return;
  _casualtyTimerInterval=setInterval(()=>{
    if(!_casualtyEditMode){clearInterval(_casualtyTimerInterval);_casualtyTimerInterval=null;return;}
    const hasTQ=_casualtyXABCDE.x.tourniquets.length>0;
    const hasTap=_tapRateState.active;
    const hasCRT=_crtState.pressing;
    if(!(hasTQ||hasTap||hasCRT))return;
    // Tier 29 fix: skip re-render while user is typing in an input (keyboard stays open)
    const active=document.activeElement;
    if(active&&(active.tagName==='INPUT'||active.tagName==='TEXTAREA')){return;}
    MedHost.renderIncidentPage();
  },1000);
}

// ═══ TREATMENT TIMELINE + VITALS + EXPORT (Commits 5-7) ═══
function renderTimeline(){
  if(!_casualtyTimeline.length)return'<div style="font-size:10px;color:var(--t4);text-align:center;padding:10px 0">אין פעולות עדיין</div>';
  const catColors={x:'#e74c3c',a:'#3498db',b:'#1abc9c',c:'#e67e22',d:'#9b59b6',e:'#2ecc71',vitals:'#888',meds:'#f1c40f',triage:'#e74c3c',injury:'#e74c3c'};
  return'<div style="position:relative;padding-right:16px">'+_casualtyTimeline.map((t,i)=>{
    const time=t.time instanceof Date?t.time:new Date(t.time);
    const ts=time.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const col=catColors[t.category]||'var(--t3)';
    const delta=i>0?Math.round((time-(_casualtyTimeline[i-1].time instanceof Date?_casualtyTimeline[i-1].time:new Date(_casualtyTimeline[i-1].time)))/1000):-1;
    let h=`<div style="display:flex;gap:8px;padding:4px 0;position:relative;align-items:flex-start">`;
    h+=`<div style="position:absolute;right:0;top:0;bottom:0;width:2px;background:var(--sep)"></div>`;
    h+=`<div style="width:8px;height:8px;border-radius:50%;background:${col};flex-shrink:0;margin-top:5px;position:relative;z-index:1"></div>`;
    h+=`<div style="flex:1"><span style="font-family:monospace;font-size:10px;color:var(--t4)">${ts}</span>`;
    if(delta>0&&delta<300)h+=` <span style="font-size:9px;color:var(--t4)">+${delta}s</span>`;
    h+=`<div style="font-size:12px;color:var(--t2)">${escapeHtml(t.action)}</div>`;
    if(t.details)h+=`<div style="font-size:11px;color:var(--t4)">${escapeHtml(t.details)}</div>`;
    h+=`</div>`;
    // v3.43: inline edit + delete per timeline entry
    h+=`<button aria-label="ערוך פעולה" onclick="editTimelineEntry(${i})" style="background:none;border:none;color:var(--bl);font-size:13px;cursor:pointer;font-family:var(--f);padding:4px 6px;min-height:32px;min-width:32px">✏️</button>`;
    h+=`<button aria-label="מחק פעולה" onclick="deleteTimelineEntry(${i})" style="background:none;border:none;color:var(--t4);font-size:14px;cursor:pointer;font-family:var(--f);padding:4px 6px;min-height:32px;min-width:32px">🗑</button>`;
    h+=`</div>`;
    return h;
  }).join('')+'</div>';
}
// v3.43: timeline edit with smart back-sync.
// Prompts medic for new time + new action text. If any numeric token
// differs from the original, propagate to the first matching source
// (meds[].dose, vitals[].pulse/rr/spo2/bpSys/bpDia/temp/etco2,
// xabcde.c.capRefill, painHistory, etc.) where we can find a match.
function editTimelineEntry(idx){
  if(idx<0||idx>=_casualtyTimeline.length)return;
  const t=_casualtyTimeline[idx];
  const origTime=t.time instanceof Date?t.time:new Date(t.time);
  const origAction=t.action||'';
  const newTimeStr=prompt('שעה (HH:MM):',origTime.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'}));
  if(newTimeStr===null)return;
  const newAction=prompt('תיאור פעולה:',origAction);
  if(newAction===null)return;
  pushMedHistory();
  // Parse new time
  const m=/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(String(newTimeStr).trim());
  let newTime=origTime;
  if(m){
    newTime=new Date(origTime);
    newTime.setHours(parseInt(m[1])||0,parseInt(m[2])||0,parseInt(m[3]||'0')||0,0);
  }
  t.time=newTime;
  t.action=newAction.slice(0,500);
  // Smart sync: detect numbers in old vs new action and find matching state fields
  const extractNums=s=>Array.from(String(s).matchAll(/(\d+(?:\.\d+)?)/g)).map(x=>parseFloat(x[1]));
  const oldNums=extractNums(origAction);
  const newNums=extractNums(newAction);
  if(oldNums.length===newNums.length && oldNums.some((v,i)=>v!==newNums[i])){
    // Try matching against the most likely source field given category
    const cat=t.category;
    if(cat==='meds' || /מג|mg|mcg|גרם|ml|mL/i.test(origAction)){
      // Find the medication entry with matching time (±60s)
      const medIdx=(_casualtyXABCDE?.e?.medications||[]).findIndex(m=>{
        if(!m.time)return false;
        return Math.abs(new Date(m.time)-origTime)<90*1000;
      });
      if(medIdx>=0){
        const med=_casualtyXABCDE.e.medications[medIdx];
        // Replace first numeric token in dose with new first num
        if(newNums[0]!=null&&/^\s*\d+(\.\d+)?/.test(String(med.dose||''))){
          med.dose=String(med.dose).replace(/^\s*\d+(\.\d+)?/,String(newNums[0]));
        }
        med.time=newTime.toISOString();
      }
    }
    if(cat==='vitals'){
      // Find vitals reading with matching time
      const vIdx=_casualtyVitals.findIndex(v=>v.time && Math.abs(new Date(v.time)-origTime)<90*1000);
      if(vIdx>=0){
        const v=_casualtyVitals[vIdx];
        // Re-parse common vital labels from new action
        const re={pulse:/❤️\s*(\d+)/,rr:/🫁\s*(\d+)/,spo2:/📊\s*(\d+)/,bp:/💉\s*([\d\/]+)/,temp:/🌡\s*(\d+(?:\.\d+)?)/,etco2:/CO₂\s*(\d+)/};
        const pv=newAction.match(re.pulse);if(pv)v.pulse=parseInt(pv[1]);
        const rrv=newAction.match(re.rr);if(rrv)v.rr=parseInt(rrv[1]);
        const sv=newAction.match(re.spo2);if(sv)v.spo2=parseInt(sv[1]);
        const bv=newAction.match(re.bp);if(bv){const parts=String(bv[1]).split('/');v.bpSys=parseInt(parts[0])||v.bpSys;if(parts[1])v.bpDia=parseInt(parts[1])||v.bpDia;v.bp=bv[1];}
        const tv=newAction.match(re.temp);if(tv)v.temp=parseFloat(tv[1]);
        const ev=newAction.match(re.etco2);if(ev)v.etco2=parseInt(ev[1]);
        v.time=newTime.toISOString();
      }
    }
    if(/CRT/i.test(origAction)&&newNums[0]!=null){
      if(_casualtyXABCDE?.c)_casualtyXABCDE.c.capRefill=newNums[0];
    }
    if(/כאב/i.test(origAction)&&newNums[0]!=null){
      const v=parseInt(newNums[0]);
      if(v>=0&&v<=10){
        _casualtyPainScore=v;
        if(_casualtyXABCDE?.e){
          if(!_casualtyXABCDE.e.painHistory)_casualtyXABCDE.e.painHistory=[];
          // Update last painHistory entry matching origTime, or push new
          const hi=_casualtyXABCDE.e.painHistory.findIndex(p=>p.time&&Math.abs(new Date(p.time)-origTime)<90*1000);
          if(hi>=0)_casualtyXABCDE.e.painHistory[hi]={score:v,time:newTime.toISOString()};
        }
      }
    }
  }
  MedHost.toast('✓ עודכן — כולל סנכרון לטופס');
  MedHost.triggerAutoSave();
  MedHost.renderIncidentPage();
}
if(typeof window!=='undefined')window.editTimelineEntry=editTimelineEntry;
function deleteTimelineEntry(idx){
  if(idx<0||idx>=_casualtyTimeline.length)return;
  pushMedHistory();
  _casualtyTimeline.splice(idx,1);
  MedHost.triggerAutoSave();
  MedHost.renderIncidentPage();
}

// generateMISTReport + copyMIST + copyMISTPlus moved to shared/medical-forms.js

function addVitalsReading(){
  // 0 is a real reading (no pulse / apnoea) and must not collapse into "not measured" (null).
  const _pz=v=>{const n=parseInt(v);return isNaN(n)?null:n;};
  const pulse=_pz(_casualtyVitalsInput.pulse);
  const rr=_pz(_casualtyVitalsInput.rr);
  const spo2=parseInt(_casualtyVitalsInput.spo2)||null;
  const bpSys=parseInt(_casualtyVitalsInput.bpSys)||null;
  const bpDia=parseInt(_casualtyVitalsInput.bpDia)||null;
  const temp=parseFloat(_casualtyVitalsInput.temp)||null;
  const etco2=_pz(_casualtyVitalsInput.etco2);
  const radialPulse=(_casualtyVitalsInput.radialPulse||'').trim();
  if(pulse==null&&rr==null&&!spo2&&!bpSys&&!bpDia&&!temp&&etco2==null&&!radialPulse)return;
  const bp=(bpSys||bpDia)?((bpSys||'—')+'/'+(bpDia||'—')):'';
  // v3.29 M2: also snapshot painScore + avpu with each reading for trend tracking
  const painScore=(typeof _casualtyPainScore!=='undefined'&&_casualtyPainScore!==null)?_casualtyPainScore:null;
  const avpu=_casualtyXABCDE?.d?.avpu||null;
  _casualtyVitals.push({pulse,rr,spo2,bpSys,bpDia,bp,temp,etco2,radialPulse,painScore,avpu,time:new Date().toISOString()});
  const extras=[];
  if(temp)extras.push('T '+temp+'°');
  if(etco2!=null)extras.push('EtCO₂ '+etco2+' mmHg');
  if(radialPulse)extras.push('רדיאלי:'+(radialPulse==='absent'?'אין':radialPulse==='weak'?'חלש':'תקין'));
  addTimestampedAction('vitals',`סימנים: HR ${pulse!=null?pulse:'—'} · RR ${rr!=null?rr:'—'} · SpO₂ ${spo2!=null?spo2+'%':'—'} · BP ${bp||'—'}${extras.length?' · '+extras.join(' · '):''}`,'');
  runClinicalAlerts(pulse,rr,spo2,bpSys,temp,etco2,radialPulse);
  if(navigator.vibrate)navigator.vibrate(15);
  MedHost.renderIncidentPage();
}
function runClinicalAlerts(pulse,rr,spo2,bpSys,temp,etco2,radialPulse){
  const alerts=[];
  const sys=bpSys||null;
  // Black tag / no signs of life: no treatment alerts, one line only.
  if(_casualtyTriageColor==='black'||(pulse===0&&rr===0)){
    const nol=[{level:'⚠️',msg:'אין סימני חיים — הערכה חוזרת כשיתפנו משאבים'}];
    renderCdsBanner(nol);return nol;
  }
  // Paediatric limits (age under 12): age-adjusted HR / RR / SBP instead of adult thresholds.
  const _age=_casualtyXABCDE?.e?.ageYears,_ped=_age!=null&&_age<12;
  const _hrHi=_ped?(_age<1?160:_age<3?150:_age<6?140:120):120;
  const _rrHi=_ped?(_age<1?50:_age<3?40:_age<6?34:30):30;
  const _sbpMin=_sbpMinFor(_age),_sbpCrit=_ped?Math.max(50,_sbpMin-20):70;
  const _pp=_ped?'ילד: ':'';
  // --- IDF 2026 deep-shock criterion ---
  if(_isDeepShock()){
    alerts.push({level:'🔴',msg:'הלם עמוק (קריטריון 2026) — דם מלא ראשון; הימנע מאינטובציה ואופיואידים'});
  } else if(_inTccShock()){
    alerts.push({level:'🔴',msg:_pp+'הלם — דם מלא / פלזמה, TXA, חימום'});
  }
  // --- IDF 2026 additions: temp, etco2, radial pulse ---
  if(temp!=null){
    if(temp<35)alerts.push({level:'🔴',msg:`היפותרמיה (${temp}°C) — סיכון Lethal Triad — HPMK + חימום פעיל + פינוי דחוף`});
    else if(temp<36)alerts.push({level:'⚠️',msg:`היפותרמיה (${temp}°C) — HPMK עכשיו`});
    else if(temp>38.5)alerts.push({level:'⚠️',msg:`חום גבוה (${temp}°C) — בדוק סביבה, שקול פגיעת חום / פרכוס`});
  }
  if(etco2!=null){
    if(etco2<25)alerts.push({level:'🔴',msg:`EtCO₂ נמוך (${etco2}) — היפר-ונטילציה / היפו-פרפוזיה — בדוק`});
    else if(etco2>50)alerts.push({level:'⚠️',msg:`EtCO₂ גבוה (${etco2}) — היפו-ונטילציה — שקול לעזור בהנשמה`});
  }
  if(radialPulse==='absent'){
    alerts.push({level:'🔴',msg:'דופק רדיאלי לא נמשש — סימן הלם עמוק (SBP<90 צפוי) — שקול דם מלא'});
  }
  // --- Antibiotics: give EARLY after a penetrating torso/head/neck wound (red after 60 min) ---
  const penAbdHeadNeck=_casualtyInjuries.some(i=>i.type==='penetrating'&&_ABX_REGIONS.includes(i.region));
  if(penAbdHeadNeck){
    const _itA=injuryTimeOut(_casualtyXABCDE);
    const ageMin=_itA?(Date.now()-new Date(_itA.t).getTime())/60000:null;
    const gotAbx=(_casualtyXABCDE?.e?.medications||[]).some(m=>_ABX_NAMES.includes(_mn(m)));
    if(!gotAbx){
      const late=ageMin!=null&&ageMin>60;
      alerts.push({level:late?'🔴':'⚠️',msg:'אנטיביוטיקה: לתת מוקדם — Ceftriaxone 2g + Metronidazole 500mg IV (או Ertapenem 1g IV/IM)'+(late?' — עברה שעה מהפציעה':'')});
    }
  }
  // --- TXA 3-hour window ---
  const penTorso=_casualtyInjuries.some(i=>i.type==='penetrating'&&['chest_r','chest_l','abdomen_r','abdomen_l','upper_back_r','upper_back_l','lower_back_r','lower_back_l','neck','pelvis'].includes(i.region));
  if(penTorso||buildCasualtyContext().txaRisk){
    const firstInjury=_casualtyTimeline.find(t=>t.category==='injury');
    if(firstInjury){
      const ageMin=(Date.now()-new Date(firstInjury.time).getTime())/60000;
      const gotTXA=(_casualtyXABCDE?.e?.medications||[]).some(m=>_mn(m)==='TXA');
      const remaining=Math.round(180-ageMin);
      if(!gotTXA&&remaining>0){
        alerts.push({level:'⚠️',msg:`TXA 1g IV בהקדם, רצוי תוך שעה מהפציעה — נותרו ${remaining} דק׳ מחלון 3 שעות. לפצוע בסיכון להלם דימומי (חודר בגו / ח״ע / הלם / דימום משמעותי).`});
      }
    }
  }
  // Previous reading for delta detection.
  const prev=_casualtyVitals.length>1?_casualtyVitals[_casualtyVitals.length-2]:null;
  // --- Circulation / shock ---
  if(pulse&&pulse>_hrHi&&sys&&sys<_sbpMin)alerts.push({level:'🔴',msg:_pp+'הלם דימומי — שקול מתן דם מלא / פלזמה'});
  else if(pulse&&pulse>_hrHi)alerts.push({level:'⚠️',msg:_pp+'טכיקרדיה — בדוק מקור דימום'});
  if(pulse&&pulse<40)alerts.push({level:'🔴',msg:'ברדיקרדיה קשה — בדוק הלם ספינלי / טונוס וגאלי / חסם-בטא'});
  else if(pulse&&pulse<50&&!(_hasTBI()&&sys&&sys>140))alerts.push({level:'⚠️',msg:'ברדיקרדיה — שקול אטרופין אם סימפטומטי'});
  // Cushing response: bradycardia + hypertension with suspected TBI = raised ICP, not spinal shock.
  if(pulse&&pulse<60&&sys&&sys>160&&_hasTBI())alerts.push({level:'🔴',msg:'חשד TBI + דופק איטי + לחץ דם גבוה (תגובת Cushing; גם נשימה לא סדירה) — ICP גבוה / פיתוק: אותה התערבות כמו herniation'});
  if(sys&&sys<_sbpCrit)alerts.push({level:'🔴',msg:_pp+'לחץ דם קריטי — נוזלים דחופים / דם'});
  else if(sys&&sys<_sbpMin)alerts.push({level:'⚠️',msg:_pp+'לחץ דם נמוך — שקול נוזלים'});
  // Hypotension without tachycardia = spinal shock or beta-blockade.
  if(!_ped&&sys&&sys<90&&pulse&&pulse<90)alerts.push({level:'⚠️',msg:'לחץ נמוך ללא טכיקרדיה — חשד להלם ספינלי / חסם-בטא'});
  if(!_ped&&pulse&&sys&&sys>0){const si=(pulse/sys).toFixed(2);if(si>1.0)alerts.push({level:'🔴',msg:'Shock Index '+si+' — הלם משמעותי'});else if(si>0.9)alerts.push({level:'⚠️',msg:'Shock Index '+si+' — חשד להלם'});}
  // --- Oxygenation ---
  if(spo2&&spo2<85)alerts.push({level:'🔴',msg:'היפוקסיה קריטית (SpO2<85) — חמצן 100% + בדוק נתיב אוויר + שלול פנאומו׳ מתח'});
  else if(spo2&&spo2<90)alerts.push({level:'🔴',msg:'היפוקסיה — בדוק נתיב אוויר + שקול O2'});
  else if(spo2&&spo2<94)alerts.push({level:'⚠️',msg:'SpO2 נמוך — שקול חמצן משלים'});
  // SpO2 drop detection — 5% drop between consecutive readings is
  // actionable even if the new value is within "normal" range.
  if(spo2&&prev&&prev.spo2&&(prev.spo2-spo2)>=5)alerts.push({level:'🔴',msg:`ירידה חדה בחמצן: ${prev.spo2}→${spo2} — בדוק A/B מיד`});
  // --- Ventilation ---
  if(rr&&rr>_rrHi)alerts.push({level:'⚠️',msg:_pp+'טכיפנאה — שלול פנאומותורקס מתח'});
  if(rr&&rr<10)alerts.push({level:'⚠️',msg:'ברדיפנאה — בדוק מינון אופיואידים'});
  if(rr&&rr<6)alerts.push({level:'🔴',msg:'ברדיפנאה קשה — הנשם (BVM); נלוקסון רק אם ניתן אופיואיד'});
  // Tension pneumo: previously required BOTH a pre-logged penetrating
  // chest injury AND rr>28. Relax the gate so deterioration alone is
  // actionable even if the injury wasn't logged (chest-sealed casualty
  // who tanks).
  const hasPenChest=_casualtyInjuries.some(i=>i.type==='penetrating'&&['chest_r','chest_l'].includes(i.region));
  const hasTube=!!_casualtyXABCDE.b.tubeThora||!!_casualtyXABCDE.b.needleDecompression||(_casualtyTreatments||[]).some(t=>['tubeThora','needleDecompression'].includes(t.type));
  const tensionSigns=(rr&&rr>28)||(spo2&&spo2<90)||(pulse&&sys&&pulse>120&&sys<90);
  const hasChestInj=hasPenChest||_casualtyInjuries.some(i=>i.type==='blunt'&&['chest_r','chest_l'].includes(i.region));
  const _lx=(typeof _casualtyExams!=='undefined'&&_casualtyExams.length)?_casualtyExams[_casualtyExams.length-1]:null;
  const reducedAir=_lx?.breathL==='absent'||_lx?.breathR==='absent'||_lx?.breathL==='reduced'||_lx?.breathR==='reduced';
  if((hasChestInj||reducedAir)&&!hasTube&&tensionSigns){
    alerts.push({level:'🔴',msg:'חשד לפנאומותורקס מתח — חמצן, ישיבה, פינוי דחוף; נקז חזה ע״י מוסמך לפי פרוטוקול (בלי דקירת מחט ובלי אטם חזה)'});
  }
  // v3.29 M5 — book red-flag additions
  // Fixed bilateral pupils + blunt MOI → futility per book (no other vital signs)
  const pL=_casualtyXABCDE?.d?.pupils?.left;
  const pR=_casualtyXABCDE?.d?.pupils?.right;
  if(pL&&pR&&pL.reactive===false&&pR.reactive===false){
    const bluntMOI=_hasMOI('blunt')||_hasMOI('blast')||_hasMOI('fall')||_hasMOI('vehicle');
    if(bluntMOI&&(!pulse||pulse<30)){
      alerts.push({level:'🔴',msg:'אישונים מקובעים דו-צדדי + ללא סימני חיים בחבלה קהה — שקול הפסקת החייאה (צור קשר עם רופא)'});
    } else if(bluntMOI){
      alerts.push({level:'🔴',msg:'אישונים מקובעים דו-צדדי — חשד לחוד גזעי / ICP קשה'});
    }
  }
  // Unilateral fixed dilated pupil + GCS<=8 = impending herniation
  const _fd=p=>!!p&&p.reactive===false&&p.size!=null&&p.size>=5;
  const _gH=_casualtyXABCDE?.d?.gcs;
  if((_fd(pL)!==_fd(pR))&&_gH!=null&&_gH<=8){
    alerts.push({level:'🔴',msg:'אישון מורחב וקבוע חד-צדדי + GCS ≤8 — חשד לפיתוק מוחי (herniation): חמצן 100%, SBP ≥110, הנשמה ל-EtCO₂ 35-40 (30-35 קצר בלבד), הרמת ראש 30°, שקול מלח היפרטוני 3-5% 250 מ"ל לפי הוראת רופא'});
  }
  // Rigid abdomen (from exams history)
  if(typeof _casualtyExams!=='undefined'&&_casualtyExams.length){
    const lastExam=_casualtyExams[_casualtyExams.length-1];
    if(lastExam?.abdomen==='rigid'){
      alerts.push({level:'🔴',msg:'בטן קשה — פריטוניטיס / דמם פנימי — פינוי מיידי'});
    }
    // Absent breath sounds + hypotension → tension pneumothorax suspicion
    const absent=lastExam?.breathL==='absent'||lastExam?.breathR==='absent';
    if(absent&&sys&&sys<90){
      alerts.push({level:'🔴',msg:'אווריריות נעדרת חד-צדדית + יתר-לחץ נמוך — חשד לפנאומותורקס מתח — חמצן, פינוי דחוף; נקז חזה ע״י מוסמך לפי פרוטוקול (בלי דקירת מחט)'});
    }
  }
  // GCS ≤5 + trismus hint (no induction drugs per book)
  const gcs=_casualtyXABCDE?.d?.gcs;
  const _defAirway=(_casualtyXABCDE?.a?.interventions||[]).some(i=>/SGA|אינטובציה|נתיב כירורגי/.test(String(i.type||'')));
  if(gcs!=null&&gcs<=8&&!_defAirway)alerts.push({level:'🔴',msg:`GCS ${gcs} ≤8 — נתיב אוויר לא מוגן: NPA+BVM אינו סופי — נדרש SGA/אינטובציה לפי הכשרה, EtCO₂ רציף; חמצן 100%`});
  if(gcs!=null&&gcs<=5&&!_defAirway)alerts.push({level:'⚠️',msg:`GCS ${gcs} ≤5 — אם אין רפלקס הקאה/טונוס לסת: אינטובציה ללא תרופות אפשרית; אחרת — אינדוקציה לפי נוהל (ketamine, בהלם 0.5–1 mg/kg)`});
  // Temp <32 severe hypothermia — extended CPR acceptable
  if(temp!=null&&temp<32){
    alerts.push({level:'🔴',msg:`היפותרמיה קשה (${temp}°C) — "לא מת עד שחם" — החייאה ממושכת מוצדקת (אירוע סביבתי בלבד; לא בזירה עם נפגעים רבים)`});
  }
  // FDP given → monitor reminder
  const gotFDP=(_casualtyXABCDE?.c?.fluids||[]).some(f=>['פלזמה יבשה (FDP)','FDP','פלזמה מיובשת','פלזמה/FFP'].includes(f.type));
  if(gotFDP){
    // Find earliest FDP administration
    const fdpEntry=(_casualtyXABCDE?.c?.fluids||[]).find(f=>['פלזמה יבשה (FDP)','FDP','פלזמה מיובשת','פלזמה/FFP'].includes(f.type));
    if(fdpEntry?.time){
      const mins=(Date.now()-new Date(fdpEntry.time).getTime())/60000;
      if(mins<15){
        alerts.push({level:'⚠️',msg:`FDP ניתן — נטר תגובה 5 דק׳ (פריחה/כאב חזה/קור). אם תגובה: עצור, החלף ל-500 מ"ל Hartmann`});
      }
    }
  }
  // Whole blood: calcium after the first unit + transfusion-reaction watch.
  {
    const wb=(_casualtyXABCDE?.c?.fluids||[]).filter(f=>f.type==='דם מלא');
    if(wb.length){
      const gotCa=(_casualtyXABCDE?.e?.medications||[]).some(m=>['Ca-gluconate','CaCl'].includes(_mn(m)));
      if(!gotCa)alerts.push({level:'⚠️',msg:'דם ניתן — סידן: Ca-gluconate 3g או CaCl 1g IV/IO (אחרי יחידה ראשונה; שוב אחרי יחידה רביעית)'});
      const lw=wb[wb.length-1];const wm=lw.time?(Date.now()-new Date(lw.time).getTime())/60000:null;
      if(wm!=null&&wm<15)alerts.push({level:'⚠️',msg:'דם מלא ניתן — נטר 15 דק׳ (חום, צמרמורת, כאב חזה, פריחה)'});
    }
  }
  // Stop-fluids-at-SBP≥90: check last 2 readings
  if(_casualtyVitals.length>=2){
    const last2=_casualtyVitals.slice(-2);
    const bothOk=last2.every(v=>v.bpSys&&v.bpSys>=90);
    const gotAnyFluid=(_casualtyXABCDE?.c?.fluids||[]).length>0;
    if(bothOk&&gotAnyFluid&&sys&&sys>=90){
      if(!_hasTBI())alerts.push({level:'✅',msg:'SBP ≥90 בשתי קריאות רצופות — שקול להפסיק נוזלים רק אם הדימום נשלט (יעד 80–90; TBI ≥110); אם עדיין מדמם — המשך דם'});
      else if(sys<110)alerts.push({level:'⚠️',msg:'TBI — שמור SBP ≥110, אל תפסיק נוזלים'});
    }
  }
  // Render to the sticky CDS banner inside the casualty form. The old
  // 2.8s toast was shared state — multiple alerts stomped each other
  // and a glance away meant a miss.
  renderCdsBanner(alerts);
  return alerts;
}
// CDS alert banner: sticky red-level alerts that only disappear when the
// underlying vital normalizes OR the medic taps "ראיתי". Non-red
// (warn) alerts show as a smaller amber row that auto-dismisses.
function renderCdsBanner(alerts){
  const mount=document.getElementById('cds-alert-mount');
  if(!mount)return; // banner not on-screen — fall back to toast
  const reds=alerts.filter(a=>a.level==='🔴');
  const warns=alerts.filter(a=>a.level!=='🔴'&&a.level!=='✅');
  const goods=alerts.filter(a=>a.level==='✅');
  if(!reds.length&&!warns.length&&!goods.length){mount.innerHTML='';return;}
  let h='';
  if(reds.length){
    h+=`<div role="alert" aria-live="assertive" style="background:var(--re);color:#fff;border-radius:10px;padding:12px 14px;margin-bottom:6px;box-shadow:0 4px 16px rgba(231,76,60,.4)">
      <div style="font-size:11px;font-weight:700;opacity:.8;margin-bottom:4px">⚠ התראה קלינית קריטית</div>`;
    reds.forEach(a=>{h+=`<div style="font-size:14px;font-weight:800;margin-bottom:2px">🔴 ${escapeHtml(a.msg)}</div>`;});
    h+=`<button onclick="_ackCds()" style="margin-top:8px;padding:10px 14px;border-radius:8px;background:#fff;color:var(--re);border:none;font-weight:800;font-size:13px;cursor:pointer;font-family:var(--f);min-height:40px">ראיתי</button>
    </div>`;
  }
  if(warns.length){
    h+=`<div role="status" aria-live="polite" style="background:rgba(241,196,15,.12);border:1px solid var(--ye);color:var(--ye);border-radius:10px;padding:8px 12px;margin-bottom:6px">`;
    warns.forEach(a=>{h+=`<div style="font-size:12px;font-weight:600;margin-bottom:2px">${escapeHtml(a.level)} ${escapeHtml(a.msg)}</div>`;});
    h+=`</div>`;
  }
  if(goods.length){
    h+=`<div role="status" aria-live="polite" style="background:rgba(46,204,113,.12);border:1px solid var(--gr);color:var(--gr);border-radius:10px;padding:8px 12px;margin-bottom:6px">`;
    goods.forEach(a=>{h+=`<div style="font-size:12px;font-weight:600;margin-bottom:2px">${escapeHtml(a.level)} ${escapeHtml(a.msg)}</div>`;});
    h+=`</div>`;
  }
  mount.innerHTML=h;
  // Strong haptic for red alerts.
  if(reds.length&&navigator.vibrate)navigator.vibrate([200,80,200,80,200]);
}
function _ackCds(){const m=document.getElementById('cds-alert-mount');if(m)m.innerHTML='';}

// v3.29 M3: structured exams history (categorical fields with trend tracking)
var _casualtyExams = (typeof _casualtyExams!=='undefined')?_casualtyExams:[];
// Ordinal maps for categorical trend direction. Lower ordinal = better (0 = normal).
const _EXAM_ORDINAL = {
  abdomen: {soft:0,tender:1,distended:2,rigid:3},
  breath:  {clear:0,wheezy:1,crackles:2,decreased:3,absent:4},
  pulse:   {present:0,weak:1,absent:2},
  airway:  {patent:0,compromised:1,obstructed:2},
  avpu:    {A:0,V:1,P:2,U:3}
};
const _EXAM_LABELS = {
  abdomen: {soft:'רכה',tender:'רגישה',distended:'נפוחה',rigid:'קשה'},
  breath:  {clear:'נקייה',wheezy:'צפצוף',crackles:'חרחורים',decreased:'מופחת',absent:'אין'},
  pulse:   {present:'נמשש',weak:'חלש',absent:'נעדר'},
  airway:  {patent:'פתוח',compromised:'חלקי',obstructed:'חסום'}
};
// v3.30: active secondary tab (c/a/r/e). null = all collapsed inside the parent.
var _casualtySecActiveTab = (typeof _casualtySecActiveTab!=='undefined')?_casualtySecActiveTab:null;
// v3.34: expose for cross-file use from beta/app.js inline controls
if(typeof window!=='undefined'){
  try{Object.defineProperty(window,'_casualtyExams',{get:()=>_casualtyExams,configurable:true});}catch(_){}
}
function _trendCat(key,history,field){
  // history entries have {[field]: value}; returns {from, to, dir, label}
  const vals=history.map(h=>h[field]).filter(v=>v!=null);
  if(vals.length<2)return null;
  const map=_EXAM_ORDINAL[key];
  if(!map)return null;
  const prev=vals[vals.length-2],curr=vals[vals.length-1];
  if(prev===curr)return null;
  const pOrd=map[prev],cOrd=map[curr];
  if(pOrd==null||cOrd==null)return null;
  const dir=cOrd>pOrd?'↓':cOrd<pOrd?'↑':'—'; // higher ordinal = worse, so arrow ↓ means deterioration
  const color=cOrd>pOrd?'var(--re-hi)':cOrd<pOrd?'var(--gr)':'var(--t3)';
  const labelMap=_EXAM_LABELS[key]||{};
  const fromL=labelMap[prev]||prev,toL=labelMap[curr]||curr;
  return {from:prev,to:curr,dir,label:`${fromL}→${toL} ${dir}`,color};
}
if(typeof window!=='undefined'){window._trendCat=_trendCat;window.addExamReading=addExamReading;}
function addExamReading(){
  const snap={t:new Date().toISOString()};
  // Pull current exam fields from _secondarySurvey.structured (edited below)
  const s=_secondarySurvey?.structured||{};
  Object.assign(snap,s);
  // Skip empty snapshots
  if(Object.keys(snap).length<=1)return;
  _casualtyExams.push(snap);
  addTimestampedAction('exam','בדיקה גופנית תועדה','');
  if(navigator.vibrate)navigator.vibrate(15);
  MedHost.triggerAutoSave();
  MedHost.renderIncidentPage();
}
function _setExamField(key,val){
  if(!_secondarySurvey.structured)_secondarySurvey.structured={};
  _secondarySurvey.structured[key]=val;
  MedHost.triggerAutoSave();
  MedHost.renderIncidentPage();
}
function _setPupil(side,field,val){
  if(!_secondarySurvey.structured)_secondarySurvey.structured={};
  if(!_secondarySurvey.structured['pupil'+side])_secondarySurvey.structured['pupil'+side]={size:3,reactive:true};
  _secondarySurvey.structured['pupil'+side][field]=val;
  MedHost.triggerAutoSave();
  MedHost.renderIncidentPage();
}
// v3.30: trend-badge helper bound to exams history
function _secTrendBadge(ordKey,field){
  const tr=_trendCat(ordKey,_casualtyExams,field);
  if(!tr)return'';
  return `<span style="font-size:10px;color:${tr.color};font-weight:800;margin-inline-start:6px">${escapeHtml(tr.label)}</span>`;
}
// v3.29 M2: 7-chip vitals strip below avatar. Each chip tappable → history sheet.
// Uses current _casualtyVitalsInput values blended with last-saved _casualtyVitals.
var _vitalHistoryKey = (typeof _vitalHistoryKey!=='undefined')?_vitalHistoryKey:null;
// v3.46: gesture state
var _vChipTouch = (typeof _vChipTouch!=='undefined')?_vChipTouch:{x:0,y:0,t:0,swiped:false};
function _vChipTouchStart(e){
  const t=e.touches&&e.touches[0];if(!t)return;
  _vChipTouch={x:t.clientX,y:t.clientY,t:Date.now(),swiped:false};
}
function _vChipTouchEnd(e,key){
  const t=(e.changedTouches&&e.changedTouches[0])||null;if(!t||!_vChipTouch.t)return;
  const dx=t.clientX-_vChipTouch.x,dy=Math.abs(t.clientY-_vChipTouch.y),dt=Date.now()-_vChipTouch.t;
  // Swipe-left (RTL: dx < -60) = save new vitals reading
  if(dx<-60&&dy<40&&dt<600){
    e.preventDefault();e.stopPropagation();
    _vChipTouch.swiped=true;
    if(typeof addVitalsReading==='function')addVitalsReading();
    if(navigator.vibrate)navigator.vibrate([25,15,25]);
    if(window.MedHost?.toast)MedHost.toast('📊 נשמר מדד ✓');
  }
  setTimeout(()=>{_vChipTouch={x:0,y:0,t:0,swiped:false};},100);
}
if(typeof window!=='undefined'){window._vChipTouchStart=_vChipTouchStart;window._vChipTouchEnd=_vChipTouchEnd;}
// v3.46: TQ long-press menu
var _tqLongPressTimer=(typeof _tqLongPressTimer!=='undefined')?_tqLongPressTimer:null;
var _tqMenuIdx=(typeof _tqMenuIdx!=='undefined')?_tqMenuIdx:null;
function _tqPressStart(idx){
  clearTimeout(_tqLongPressTimer);
  _tqLongPressTimer=setTimeout(()=>{
    _tqMenuIdx=idx;
    if(navigator.vibrate)navigator.vibrate(30);
    MedHost.renderIncidentPage();
  },600);
}
function _tqPressEnd(){clearTimeout(_tqLongPressTimer);_tqLongPressTimer=null;}
function _tqCloseMenu(){_tqMenuIdx=null;MedHost.renderIncidentPage();}
function renderTqLongPressMenu(){
  if(_tqMenuIdx==null)return'';
  const tqs=_casualtyXABCDE?.x?.tourniquets||[];
  const tq=tqs[_tqMenuIdx];
  if(!tq)return'';
  const site=(typeof BODY_LABELS!=='undefined'?BODY_LABELS[tq.site]:tq.site)||tq.site||'';
  let h=`<div onclick="_tqCloseMenu()" style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1001;display:flex;align-items:center;justify-content:center" role="dialog" aria-modal="true">`;
  h+=`<div onclick="event.stopPropagation()" style="background:var(--c1);border:1px solid var(--sep);border-radius:14px;padding:16px;min-width:260px;max-width:360px">`;
  h+=`<div style="font-size:14px;font-weight:800;color:var(--re);margin-bottom:10px">🩸 ח"ע — ${escapeHtml(site)}</div>`;
  h+=`<button onclick="tqContinue(${_tqMenuIdx});_tqCloseMenu()" style="width:100%;padding:12px;border-radius:8px;border:1px solid var(--re);background:rgba(231,76,60,.12);color:var(--re);font-family:var(--f);font-size:13px;font-weight:700;cursor:pointer;margin-bottom:6px;min-height:44px">🔴 המשך ח"ע</button>`;
  h+=`<button onclick="tqConvert(${_tqMenuIdx});_tqCloseMenu()" style="width:100%;padding:12px;border-radius:8px;border:1px solid var(--gr);background:rgba(46,204,113,.12);color:var(--gr);font-family:var(--f);font-size:13px;font-weight:700;cursor:pointer;margin-bottom:6px;min-height:44px">✓ המר לתחבושת</button>`;
  h+=`<button onclick="if(confirm('להסיר ח״ע ${escapeHtml(String(site).replace(/['"\\<>&]/g,''))}?')){_casualtyXABCDE.x.tourniquets.splice(${_tqMenuIdx},1);addTimestampedAction('x','הסרת ח״ע — ${escapeHtml(String(site).replace(/['"\\<>&]/g,''))}','');MedHost.triggerAutoSave();_tqCloseMenu();}" style="width:100%;padding:12px;border-radius:8px;border:1px solid var(--t3);background:rgba(255,255,255,.04);color:var(--t3);font-family:var(--f);font-size:12px;cursor:pointer;min-height:40px">🗑 הסר לחלוטין</button>`;
  h+=`<button onclick="_tqCloseMenu()" style="width:100%;padding:10px;margin-top:8px;border-radius:8px;border:none;background:none;color:var(--t4);font-family:var(--f);font-size:11px;cursor:pointer;min-height:36px">ביטול</button>`;
  h+=`</div></div>`;
  return h;
}
if(typeof window!=='undefined'){window._tqPressStart=_tqPressStart;window._tqPressEnd=_tqPressEnd;window._tqCloseMenu=_tqCloseMenu;}
function openVitalHistory(key){_vitalHistoryKey=key;MedHost.renderIncidentPage();}
function closeVitalHistory(){_vitalHistoryKey=null;MedHost.renderIncidentPage();}
function _trendNum(key,history){
  const vals=history.map(v=>v[key]).filter(v=>v!=null&&!isNaN(v));
  if(vals.length<2)return null;
  const curr=vals[vals.length-1],prev=vals[vals.length-2];
  const delta=curr-prev;
  const thr=key==='spo2'?3:key==='bpSys'||key==='bpDia'||key==='pulse'||key==='rr'?10:key==='temp'?0.5:key==='etco2'?5:key==='pain'?2:5;
  let dir='—';
  if(Math.abs(delta)<thr/3)dir='—';
  else if(delta>=thr)dir='↑↑';
  else if(delta>0)dir='↑';
  else if(delta<=-thr)dir='↓↓';
  else if(delta<0)dir='↓';
  // For pulse/rr/pain: higher = worse (usually). For spo2/bpSys/bpDia: lower = worse.
  const worseWhenUp=['pulse','rr','pain','etco2'].includes(key);
  const worseWhenDown=['spo2','bpSys','bpDia','temp'].includes(key);
  let badColor='var(--t3)';
  if(worseWhenUp&&delta>0)badColor='var(--re-hi)';
  else if(worseWhenDown&&delta<0)badColor='var(--re-hi)';
  else if((worseWhenUp&&delta<0)||(worseWhenDown&&delta>0))badColor='var(--gr)';
  return {dir,delta,prev,curr,color:badColor};
}
function renderVitalsStrip(){
  if(!_casualtyVitals.length)return'';
  const last=_casualtyVitals[_casualtyVitals.length-1];
  const ageMin=Math.max(0,Math.round((Date.now()-new Date(last.time).getTime())/60000));
  const ageStr=ageMin<1?'זה עתה':ageMin<60?ageMin+' דק׳':(Math.round(ageMin/60)+' שע׳');
  const ageCol=ageMin>15?'var(--re-hi)':ageMin>5?'var(--ye)':'var(--t3)';
  // v3.29 M5 + v3.43: age-adjusted thresholds (auto on age≤12 + manual override)
  const ageY=_casualtyXABCDE?.e?.ageYears||null;
  const isPed=isPedsMode();
  const pedHrHigh=ageY==null?null:ageY<1?160:ageY<3?150:ageY<6?140:ageY<12?120:null;
  const pedSbpLow=ageY==null?null:(ageY*2+70);
  const pedRrHigh=ageY==null?null:ageY<1?50:ageY<3?40:ageY<6?30:25;
  const allChips=[
    {k:'pulse',ic:'❤️',label:'דופק',unit:'',redIf:v=>isPed?v>pedHrHigh||v<60:v>120||v<50},
    {k:'bpSys',ic:'💉',label:'ל"ד',unit:'',dualKey:'bpDia',redIf:v=>isPed?v<pedSbpLow:v<90},
    {k:'spo2',ic:'📊',label:'SpO₂',unit:'%',redIf:v=>v<90,yelIf:v=>v<95},
    {k:'rr',ic:'🫁',label:'RR',unit:'',redIf:v=>isPed?v>pedRrHigh||v<15:v>30||v<10},
    {k:'etco2',ic:'🌬',label:'ETCO₂',unit:'',redIf:v=>v<25||v>50,yelIf:v=>v<30||v>45},
    {k:'temp',ic:'🌡',label:'°C',unit:'',redIf:v=>v<35||v>38.5,yelIf:v=>v<36},
    {k:'pain',ic:'😣',label:'כאב',unit:'/10'}
  ];
  // v3.46: chip configuration (order + hidden) from localStorage
  let cfg=null;
  try{cfg=JSON.parse(localStorage.getItem('shomer_vitals_chip_cfg')||'null');}catch(_){}
  const order=(cfg&&Array.isArray(cfg.order))?cfg.order:allChips.map(c=>c.k);
  const hidden=new Set((cfg&&Array.isArray(cfg.hidden))?cfg.hidden:[]);
  const chips=order.map(k=>allChips.find(c=>c.k===k)).filter(c=>c&&!hidden.has(c.k));
  // Append any new chips not in saved order (e.g. future additions)
  allChips.forEach(c=>{if(!order.includes(c.k)&&!hidden.has(c.k))chips.push(c);});
  // Shock Index chip (computed from last pulse + bpSys)
  const si=(last.pulse&&last.bpSys)?(last.pulse/last.bpSys):null;
  let h=`<div style="margin-bottom:8px">`;
  h+=`<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;padding:0 4px"><span style="font-size:10px;font-weight:700;color:var(--or)">📈 סימנים חיוניים</span><span style="font-size:9px;color:${ageCol}">(${ageStr} · ${_casualtyVitals.length} קריאות)</span></div>`;
  h+=`<div style="display:flex;gap:4px;overflow-x:auto;padding:4px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch">`;
  chips.forEach(c=>{
    let val=last[c.k],dualVal=c.dualKey?last[c.dualKey]:null;
    if(c.k==='pain'){val=last.painScore!=null?last.painScore:_casualtyPainScore;}
    let displayVal;
    if(c.k==='bpSys'){
      displayVal=(val||dualVal)?((val||'—')+'/'+(dualVal||'—')):'—';
    } else {
      displayVal=val!=null?(val+c.unit):'—';
    }
    const t=_trendNum(c.k,_casualtyVitals);
    let bg='var(--c2)',fg='var(--tx)',bc='var(--sep)';
    if(val!=null){
      if(c.redIf&&c.redIf(val)){fg='#fff';bg='var(--re-hi)';bc='var(--re-hi)';}
      else if(c.yelIf&&c.yelIf(val)){fg='var(--ye)';bg='rgba(241,196,15,.12)';bc='rgba(241,196,15,.35)';}
    }
    const trendStr=t?`<span style="font-size:10px;color:${t.color};font-weight:900">${t.dir}</span>`:'';
    h+=`<button onclick="openVitalHistory('${c.k}')" ontouchstart="_vChipTouchStart(event)" ontouchend="_vChipTouchEnd(event,'${c.k}')" style="flex:0 0 auto;scroll-snap-align:start;background:${bg};color:${fg};border:1.5px solid ${bc};border-radius:10px;padding:8px 10px;min-width:78px;cursor:pointer;font-family:var(--f);display:flex;flex-direction:column;align-items:center;gap:2px">`;
    h+=`<span style="font-size:9px;opacity:.75">${c.ic} ${c.label}</span>`;
    h+=`<span style="font-size:14px;font-weight:900;font-family:monospace">${escapeHtml(String(displayVal))}</span>`;
    if(trendStr)h+=`<span>${trendStr}</span>`;
    h+=`</button>`;
  });
  // Shock Index chip (extra, read-only)
  if(si!=null){
    const siStr=si.toFixed(2);
    const siRed=si>1.0,siYel=si>0.9&&si<=1.0;
    const bg=siRed?'var(--re-hi)':siYel?'rgba(241,196,15,.12)':'var(--c2)';
    const fg=siRed?'#fff':siYel?'var(--ye)':'var(--tx)';
    const bc=siRed?'var(--re-hi)':siYel?'rgba(241,196,15,.35)':'var(--sep)';
    h+=`<div style="flex:0 0 auto;scroll-snap-align:start;background:${bg};color:${fg};border:1.5px solid ${bc};border-radius:10px;padding:8px 10px;min-width:78px;display:flex;flex-direction:column;align-items:center;gap:2px">`;
    h+=`<span style="font-size:9px;opacity:.75">⚡ SI</span>`;
    h+=`<span style="font-size:14px;font-weight:900;font-family:monospace">${siStr}</span>`;
    if(siRed)h+=`<span style="font-size:9px;font-weight:700">הלם</span>`;
    h+=`</div>`;
  }
  h+=`</div>`;
  // History drawer
  if(_vitalHistoryKey){
    const chip=chips.find(c=>c.k===_vitalHistoryKey);
    if(chip){
      h+=`<div onclick="closeVitalHistory()" style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:999;display:flex;align-items:flex-end;justify-content:center" role="dialog" aria-modal="true">`;
      h+=`<div onclick="event.stopPropagation()" style="background:var(--c1);width:100%;max-width:500px;border-radius:16px 16px 0 0;padding:16px;max-height:70vh;overflow-y:auto">`;
      h+=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div style="font-size:15px;font-weight:800;color:var(--tx)">${chip.ic} ${chip.label} — היסטוריה</div><button onclick="closeVitalHistory()" aria-label="סגור" style="background:none;border:none;color:var(--t3);font-size:22px;cursor:pointer;padding:4px 8px;min-height:40px;min-width:40px">✕</button></div>`;
      // Sparkline for numeric metrics
      const dataPts=_casualtyVitals.map(v=>{
        if(_vitalHistoryKey==='pain')return {v:v.painScore,t:v.time};
        if(_vitalHistoryKey==='bpSys')return {v:v.bpSys,t:v.time,dia:v.bpDia};
        return {v:v[_vitalHistoryKey],t:v.time};
      }).filter(p=>p.v!=null);
      if(dataPts.length>=2){
        const vals=dataPts.map(p=>p.v);
        const mx=Math.max(...vals),mn=Math.min(...vals),rng=Math.max(mx-mn,1);
        const w=460,hh=60,step=w/Math.max(1,dataPts.length-1);
        let path='';
        dataPts.forEach((p,i)=>{const x=i*step;const y=hh-((p.v-mn)/rng)*hh;path+=(i===0?'M':'L')+x.toFixed(1)+','+y.toFixed(1)+' ';});
        h+=`<svg viewBox="0 0 ${w} ${hh}" preserveAspectRatio="none" style="width:100%;height:60px;margin-bottom:12px;display:block"><path d="${path}" stroke="var(--bl)" stroke-width="2" fill="none"/>`;
        dataPts.forEach((p,i)=>{const x=i*step;const y=hh-((p.v-mn)/rng)*hh;h+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="var(--bl)"/>`;});
        h+=`</svg>`;
      }
      // List
      h+=`<div style="font-family:monospace;font-size:12px">`;
      for(let i=dataPts.length-1;i>=0;i--){
        const p=dataPts[i];
        const vt=fmtTime(p.t);
        const prev=i>0?dataPts[i-1]:null;
        const delta=prev?(p.v-prev.v):null;
        const dStr=delta!=null?(delta>0?` (↑ ${delta.toFixed(1)})`:delta<0?` (↓ ${Math.abs(delta).toFixed(1)})`:' (—)'):'';
        let vStr=p.v;
        if(_vitalHistoryKey==='bpSys'&&p.dia)vStr=p.v+'/'+p.dia;
        h+=`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--sep)"><span style="color:var(--t3)">${escapeHtml(vt)}</span><span style="color:var(--tx);font-weight:700">${escapeHtml(String(vStr))}${chip.unit||''}${dStr}</span></div>`;
      }
      h+=`</div>`;
      if(!dataPts.length)h+=`<div style="text-align:center;color:var(--t4);padding:20px">אין קריאות עדיין</div>`;
      h+=`</div></div>`;
    }
  }
  h+=`</div>`;
  return h;
}
// v3.32: Event timer strip — unified TQ + TXA + antibiotics + sedation redose
function renderEventTimerStrip(){
  const items=[];
  const now=Date.now();
  // TQ elapsed (longest-standing)
  const tqs=_casualtyXABCDE?.x?.tourniquets||[];
  if(tqs.length){
    tqs.forEach(tq=>{
      const mins=Math.floor((now-new Date(tq.time).getTime())/60000);
      const alert=mins>=120;
      items.push({
        ic:'🩸',label:'ח"ע '+(BODY_LABELS[tq.site]||tq.site).slice(0,8),
        value:mins<60?mins+'ד':Math.floor(mins/60)+'ש'+(mins%60?(mins%60)+'ד':''),
        col:alert?'var(--re-hi)':mins>=60?'#e67e22':'var(--or)'
      });
    });
  }
  // TXA 3-hour window — first injury timestamp
  const firstInjury=_casualtyTimeline.find(t=>t.category==='injury');
  const gotTXA=(_casualtyXABCDE?.e?.medications||[]).some(m=>_mn(m)==='TXA');
  if(firstInjury&&!gotTXA){
    const mins=Math.floor((now-new Date(firstInjury.time).getTime())/60000);
    const remaining=180-mins;
    if(remaining>0){
      items.push({ic:'⏱',label:'TXA חלון',value:remaining+'ד',col:remaining<30?'var(--re-hi)':remaining<60?'#e67e22':'var(--gr)'});
    } else {
      items.push({ic:'⏱',label:'TXA חלון',value:'סגור',col:'var(--t4)'});
    }
  } else if(gotTXA){
    items.push({ic:'✅',label:'TXA',value:'ניתן',col:'var(--gr)'});
  }
  // Antibiotic deadline — 60min post-injury for penetrating
  const penetrating=_casualtyInjuries.some(i=>i.type==='penetrating');
  const gotAbx=(_casualtyXABCDE?.e?.medications||[]).some(m=>['צפטריאקסון','מטרונידזול'].includes(_mn(m)));
  if(penetrating&&firstInjury&&!gotAbx){
    const mins=Math.floor((now-new Date(firstInjury.time).getTime())/60000);
    const target=60-mins;
    if(target>0){
      items.push({ic:'💊',label:'אנטיב׳ חלון',value:target+'ד',col:target<15?'var(--re-hi)':'#e67e22'});
    } else {
      items.push({ic:'⚠️',label:'אנטיב׳',value:'חרג',col:'var(--re-hi)'});
    }
  } else if(gotAbx){
    items.push({ic:'✅',label:'אנטיב׳',value:'ניתן',col:'var(--gr)'});
  }
  // Sedation redose — last ketamine/morphine/dormicum
  const meds=_casualtyXABCDE?.e?.medications||[];
  const sedatives=['קטמין','מורפין','דורמיקום','פנטניל'];
  const lastSed=meds.filter(m=>sedatives.includes(_mn(m))).slice(-1)[0];
  if(lastSed){
    const mins=Math.floor((now-new Date(lastSed.time).getTime())/60000);
    const redoseIntervals={'קטמין':(lastSed.route==='IV'||lastSed.route==='IO')?20:30,'מורפין':15,'דורמיקום':15,'פנטניל':15};
    const interval=redoseIntervals[_mn(lastSed)]||30;
    const remaining=interval-mins;
    items.push({
      ic:'💤',label:_mn(lastSed).slice(0,6)+' חזרה',
      value:remaining>0?remaining+'ד':'זמין',
      col:remaining>0?'var(--t3)':'var(--gr)'
    });
  }
  if(!items.length)return '';
  let h='<div style="margin-bottom:8px"><div style="font-size:10px;font-weight:700;color:var(--or);margin-bottom:4px;padding:0 4px">⏱ טיימרים קריטיים</div>';
  h+='<div style="display:flex;gap:4px;overflow-x:auto;padding:4px;-webkit-overflow-scrolling:touch">';
  items.forEach(it=>{
    h+=`<div style="flex:0 0 auto;background:var(--c2);border:1.5px solid ${it.col};border-radius:10px;padding:6px 10px;min-width:78px;display:flex;flex-direction:column;align-items:center;gap:2px">`;
    h+=`<span style="font-size:9px;color:var(--t3)">${it.ic} ${escapeHtml(it.label)}</span>`;
    h+=`<span style="font-size:13px;font-weight:900;color:${it.col};font-family:monospace">${escapeHtml(it.value)}</span>`;
    h+=`</div>`;
  });
  h+='</div></div>';
  return h;
}
function renderVitalsBar(){
  if(!_casualtyVitals.length)return'';
  const last=_casualtyVitals[_casualtyVitals.length-1];
  const trend=(key)=>{if(_casualtyVitals.length<2)return'';const prev=_casualtyVitals[_casualtyVitals.length-2];const d=(last[key]||0)-(prev[key]||0);return d>5?'↑↑':d>0?'↑':d<-5?'↓↓':d<0?'↓':'—';};
  const pCol=last.pulse>120||last.pulse<50?'var(--re-hi)':'var(--tx)';
  const sCol=last.spo2<90?'var(--re-hi)':last.spo2<95?'var(--ye)':'var(--tx)';
  const rCol=last.rr>30||last.rr<10?'var(--re-hi)':'var(--tx)';
  // Time since last reading
  const ageMs=Date.now()-new Date(last.time).getTime();
  const ageMin=Math.floor(ageMs/60000);
  const ageStr=ageMin<1?'זה עתה':ageMin+'ד לפני';
  const ageCol=ageMin>15?'var(--re-hi)':ageMin>5?'var(--ye)':'var(--t3)';
  let h=`<div style="background:var(--c2);border-radius:10px;margin-bottom:8px;border:1px solid var(--sep);padding:8px 12px">`;
  h+=`<div style="display:flex;gap:10px;justify-content:center;align-items:center;flex-wrap:wrap">`;
  h+=`<span style="font-size:13px;font-weight:800;color:${pCol}">❤️ ${last.pulse||'—'}${trend('pulse')}</span>`;
  h+=`<span style="font-size:13px;font-weight:800;color:${rCol}">🫁 ${last.rr||'—'}${trend('rr')}</span>`;
  h+=`<span style="font-size:13px;font-weight:800;color:${sCol}">📊 ${last.spo2||'—'}%${trend('spo2')}</span>`;
  const bpDisp=(last.bpSys||last.bpDia)?((last.bpSys||'—')+'/'+(last.bpDia||'—')):(last.bp||'—');
  h+=`<span style="font-size:13px;font-weight:800;color:var(--tx)">💉 ${bpDisp}</span>`;
  h+=`</div>`;
  h+=`<div style="text-align:center;font-size:10px;color:${ageCol};margin-top:4px">${ageStr} · ${_casualtyVitals.length} קריאות</div>`;
  // Mini trend chart — last 6 pulse readings
  if(_casualtyVitals.length>=2){
    const recent=_casualtyVitals.slice(-6);
    const pulses=recent.map(v=>v.pulse).filter(p=>p);
    if(pulses.length>=2){
      const maxP=Math.max(...pulses,120);const minP=Math.min(...pulses,50);const range=Math.max(maxP-minP,20);
      const w=220,hh=28,step=w/(pulses.length-1);
      let path='';
      pulses.forEach((p,i)=>{const x=i*step;const y=hh-((p-minP)/range)*hh;path+=(i===0?'M':'L')+x.toFixed(1)+','+y.toFixed(1)+' ';});
      h+=`<svg width="${w}" height="${hh}" style="display:block;margin:6px auto 0" aria-label="מגמת דופק">`;
      h+=`<path d="${path}" stroke="var(--re-hi)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
      pulses.forEach((p,i)=>{const x=i*step;const y=hh-((p-minP)/range)*hh;h+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2" fill="var(--re-hi)"/>`;});
      h+=`</svg>`;
    }
  }
  // Full history list — every row deletable/editable. Folded under a
  // details element so it doesn't overwhelm the compact bar.
  if(_casualtyVitals.length){
    h+=`<details style="margin-top:6px;padding:0"><summary style="font-size:11px;color:var(--t3);cursor:pointer;padding:4px 0;min-height:28px">📋 כל הקריאות (${_casualtyVitals.length})</summary>`;
    h+=`<div style="margin-top:4px">`;
    _casualtyVitals.forEach((v,i)=>{
      const vt=fmtTime(v.time);
      h+=`<div class="xabcde-entry" style="align-items:center;padding:6px 0"><span class="time">${escapeHtml(vt)}</span><span style="flex:1;font-family:monospace;font-size:12px">P:${escapeHtml(String(v.pulse||'—'))} R:${escapeHtml(String(v.rr||'—'))} S:${escapeHtml(String(v.spo2||'—'))} BP:${escapeHtml(String(v.bp||'—'))}</span><button aria-label="מחק קריאה" onclick="deleteVitalsReading(${i})" style="background:none;border:none;color:var(--re);font-size:13px;cursor:pointer;font-family:var(--f);padding:4px 6px;min-height:32px;min-width:32px">🗑</button></div>`;
    });
    h+=`</div></details>`;
  }
  h+=`</div>`;
  return h;
}
function deleteVitalsReading(idx){
  if(idx<0||idx>=_casualtyVitals.length)return;
  pushMedHistory();
  _casualtyVitals.splice(idx,1);
  MedHost.triggerAutoSave();
  MedHost.renderIncidentPage();
}

// generateForm101 moved to shared/medical-forms.js
// exportCasualtyHandoff + printCasualty + shareCasualtyWhatsApp moved to shared/medical-forms.js
// (generateRadioFormat already moved in stage 1)

function crtEnd(){if(!_crtState.pressing)return;const s=((Date.now()-_crtState.startTime)/1000).toFixed(1);_casualtyXABCDE.c.capRefill=parseFloat(s);addTimestampedAction('c','CRT: '+s+'s','');_crtState={pressing:false,startTime:null};MedHost.renderIncidentPage();}


// ── X-CARE TABS + TRIAGE WIZARD (stage 3.6) ──

// ── [X/A/B/C/D/E tabs + renderPainProtocolFlow + _formatCcForDose + speech note] from beta lines 6803-7468 ──
// BODY_FRONT + BODY_BACK moved to shared/medical-forms.js
// BURN_NINES + BODY_LABELS + TREATMENT_ICONS moved to shared/medical-forms.js
// renderBodyMap + getPathCenter + renderFloatingRegionMenu + body-map handlers moved to shared/medical-forms.js
// (addCustomInjury/Treatment, addRegionNote, handleRegionTap, startTreatmentPlacement, placeTreatmentOnBody, _mirrorBodyTreatmentToX, _removeFromXStep, removeTreatmentFromBody, setInjuryType, removeInjury, _bodyMenuStep)
// medUndo/medRedo/_snapshotMedState/_restoreMedState/pushMedHistory/addTimestampedAction + keyboard shortcuts moved to shared/medical-forms.js
// ═══ X-ABCDE TAB RENDERERS ═══
// MED_PRESETS + _setPainScore + _setPatientAge + _broselowWeight + _setPatientWeight + renderXABCDETab + getTqElapsed + renderEntryList + deleteXabcdeEntry + deleteTourniquet + clearBreathingEntry + addPelvicBinder + clearPelvicBinder + addCervicalCollar + clearCervicalCollar (+ _tapRateState _crtState _tqSitePickerOpen _medPickerOpen) moved to shared/medical-forms.js
// _hasTBI + buildCasualtyContext + getMarchPStatus + renderCriticalTimers + renderTabHints + renderClinicalPriorities moved to shared/medical-forms.js

// X — eXsanguination
function renderXTab(){
  const x=_casualtyXABCDE.x;let h='';
  // Tourniquets
  h+='<div style="font-size:11px;font-weight:700;color:#e74c3c;margin-bottom:4px">חסמי עורקים</div>';
  if(x.tourniquets.length){x.tourniquets.forEach((t,i)=>{const e=getTqElapsed(t.time);h+=`<div class="xabcde-entry" style="align-items:center;${e.alert?'background:rgba(231,76,60,.15)':''}"><span class="time">${fmtTime(t.time)}</span><span style="flex:1">${escapeHtml(BODY_LABELS[t.site]||t.site||'')}</span><span class="tq-timer${e.alert?' alert':''}">${escapeHtml(e.str)}</span><button aria-label="מחק ח״ע" onclick="deleteTourniquet(${i})" style="background:none;border:none;color:var(--re);font-size:13px;cursor:pointer;font-family:var(--f);padding:4px 6px;min-height:32px;min-width:32px">🗑</button></div>`;});}
  if(_tqSitePickerOpen){
    const sites=['r_thigh','l_thigh','r_upper_arm','l_upper_arm','r_forearm','l_forearm','r_shin','l_shin'];
    h+='<div style="display:flex;flex-wrap:wrap;gap:4px;margin:6px 0">'+sites.map(s=>`<button class="xabcde-btn" style="flex:0 0 auto;padding:6px 10px;font-size:9px" onclick="addTourniquetEntry('${s}');_tqSitePickerOpen=false;MedHost.renderIncidentPage()">${BODY_LABELS[s]}</button>`).join('')+'</div>';
  } else {
    h+=`<button class="xabcde-btn" style="width:100%;margin:4px 0;border-color:#e74c3c;color:#e74c3c" onclick="_tqSitePickerOpen=true;MedHost.renderIncidentPage()">+ הנח ח"ע</button>`;
  }
  // M = Massive hemorrhage: explicit "no massive hemorrhage" confirmation
  h+=`<button class="xabcde-btn" style="width:100%;margin:4px 0;${x.noMassiveHemorrhage?'background:rgba(46,204,113,.15);border-color:var(--gr);color:var(--gr)':''}" onclick="_casualtyXABCDE.x.noMassiveHemorrhage=!_casualtyXABCDE.x.noMassiveHemorrhage;addTimestampedAction('x',_casualtyXABCDE.x.noMassiveHemorrhage?'אין דימום מסיבי':'בוטל: אין דימום מסיבי','');MedHost.renderIncidentPage()">${x.noMassiveHemorrhage?'✓ ':''}אין דימום מסיבי</button>`;
  // Other X interventions
  h+='<div style="display:flex;gap:4px;margin:6px 0;flex-wrap:wrap">';
  h+=`<button class="xabcde-btn" style="flex:1" onclick="addXEntry('pressureDressings','תחבושת לחץ')">תחבושת לחץ</button>`;
  h+=`<button class="xabcde-btn" style="flex:1" onclick="addXEntry('hemostatic','חומר המוסטטי')">המוסטטי</button>`;
  h+=`<button class="xabcde-btn" style="flex:1" onclick="addXEntry('woundPacking','אריזת פצע')">אריזת פצע</button>`;
  h+='</div>';
  // Junction bleeding hint
  const junctionBleed=_casualtyInjuries.some(i=>['pelvis','abdomen_r','abdomen_l'].includes(i.region)&&i.type==='hemorrhage');
  if(junctionBleed){
    h+='<div style="padding:6px 8px;border-radius:6px;background:rgba(231,76,60,.1);border-right:2px solid var(--re);margin:6px 0;font-size:10px;color:var(--re);font-weight:700">דימום באזור מעבר (מפשעה/בית שחי) — בצע אריזת פצע (Packing) עם גזה המוסטטית + לחץ ישיר 3 דק׳ לפחות</div>';
  }
  h+=renderEntryList(x.pressureDressings,e=>e.label||'תחבושת לחץ','x','pressureDressings');
  h+=renderEntryList(x.hemostatic,e=>e.label||'חומר המוסטטי','x','hemostatic');
  h+=renderEntryList(x.woundPacking,e=>e.label||'אריזת פצע','x','woundPacking');
  return h;
}
// addTourniquetEntry moved to shared/medical-forms.js
function toggleHeadToToe(areaId){
  const labels={head:'ראש',face:'פנים/עיניים',neck_spine:'צוואר/עמ״ש',chest2:'חזה',abdomen2:'בטן',back2:'גב',pelvis2:'אגן',upper_limbs:'גפיים עליונות',lower_limbs:'גפיים תחתונות'};
  const cur=_secondarySurvey.headToToe[areaId];
  const next=cur==='normal'?'finding':cur==='finding'?null:'normal';
  _secondarySurvey.headToToe[areaId]=next;
  addTimestampedAction('e','Head2Toe '+(labels[areaId]||areaId)+': '+(next||'לא נבדק'),'');
  if(navigator.vibrate)navigator.vibrate(10);
  MedHost.renderIncidentPage();
}
function setGCSComponent(key,val){
  if(!_casualtyXABCDE.d.gcsDetail)_casualtyXABCDE.d.gcsDetail={eye:null,verbal:null,motor:null};
  _casualtyXABCDE.d.gcsDetail[key]=val;
  const g=_casualtyXABCDE.d.gcsDetail;
  if(g.eye&&g.verbal&&g.motor){_casualtyXABCDE.d.gcs=g.eye+g.verbal+g.motor;}
  addTimestampedAction('d','GCS '+key.toUpperCase()+': '+val,'');
  MedHost.renderIncidentPage();
}
async function closeCasualtyForm(){
  // Flush any pending auto-save before tearing down state. This closes the
  // "typed for 2s, hit close → edit lost" race.
  if(_casualtyEditMode && _autoSaveDirty && !_autoSaveInFlight){
    try{await saveCasualtyData();_autoSaveDirty=false;}catch(e){MedHost.toast('שגיאה בשמירה — לא נסגר',false);return;}
  }
  if(_autoSaveTimer){clearTimeout(_autoSaveTimer);_autoSaveTimer=null;}
  if(_autoSaveMaxWait){clearTimeout(_autoSaveMaxWait);_autoSaveMaxWait=null;}
  clearRedoseTimers();
  // v3.48: release any active stage lock on form close
  try{if(window._stageHeartbeat)window._stageHeartbeat(null);if(_casualtyActiveTab&&window._releaseStageLock)window._releaseStageLock(_casualtyActiveTab);}catch(_){}
  _autoSaveStatus='';
  _casualtyEditMode=false;
  _casualtyEditId=null;
  _casualtyPainScore=null;_xcareGuided=false;_xcareStep=0;
  _secondarySurvey={headToToe:{},o2Flow:null,tqReeval:[],structured:{}};
  _casualtyExams=[];
  _casualtyEvacPriority='';_casualtyVitalsInput={pulse:'',rr:'',spo2:'',bpSys:'',bpDia:'',temp:'',etco2:'',radialPulse:''};
  _casualtyName='';_casualtyIdNumber='';
  _pendingTreatmentType=null;_selectedRegion=null;
  // Restore the tab the medic came from (mci → mci, not always 'casualties').
  if(_incidentTabBeforeEdit){_incidentTab=_incidentTabBeforeEdit;_incidentTabBeforeEdit=null;}
  MedHost.renderIncidentPage();
}
function reevalTourniquet(idx){const tq=_casualtyXABCDE.x.tourniquets[idx];if(!tq)return;const label=BODY_LABELS[tq.site]||tq.site;addTimestampedAction('x','הערכה מחדש ח"ע — '+label,'');MedHost.renderIncidentPage();}
function tqContinue(idx){const tq=_casualtyXABCDE.x.tourniquets[idx];if(!tq)return;const label=BODY_LABELS[tq.site]||tq.site;addTimestampedAction('c','הערכת ח"ע — '+label,'המשך');MedHost.renderIncidentPage();}
function tqConvert(idx){
  const tq=_casualtyXABCDE.x.tourniquets[idx];if(!tq)return;
  const outcome=prompt('תוצאת ההמרה: הקלד "הצליח" או "נכשל"','הצליח');
  if(!outcome)return;
  const success=outcome.includes('הצליח');
  tq.converted={time:new Date().toISOString(),success};
  const label=BODY_LABELS[tq.site]||tq.site;
  addTimestampedAction('x',`המרת ח"ע — ${label}: ${success?'✓ הצליחה':'✗ נכשלה (החזר ח"ע)'}`,'המרה');
  MedHost.triggerAutoSave();MedHost.renderIncidentPage();
}
function addXEntry(type,label){_casualtyXABCDE.x[type].push({label,time:new Date().toISOString()});addTimestampedAction('x',label,'');
  if(type==='pressureDressings'){autoPlaceTreatment(null,'pressureDressing');if(_mciResources.bandages>0)_mciResources.bandages--;}
  if(type==='hemostatic'){autoPlaceTreatment(null,'hemostatic');if(_mciResources.hemostatic>0)_mciResources.hemostatic--;}
  MedHost.renderIncidentPage();}
// autoPlaceTreatment moved to shared/medical-forms.js

// A — Airway
function renderATab(){
  const a=_casualtyXABCDE.a;let h='';
  h+='<div style="font-size:11px;font-weight:700;color:#3498db;margin-bottom:4px">מצב נתיב אוויר</div>';
  h+='<div style="display:flex;gap:6px;margin-bottom:8px">';
  [{v:'clear',l:'פתוח',c:'#2ecc71'},{v:'compromised',l:'בסיכון',c:'#f1c40f'},{v:'obstructed',l:'חסום',c:'#e74c3c'}].forEach(s=>{
    const on=a.status===s.v;
    h+=`<button class="xabcde-btn" style="flex:1;min-height:52px;border-color:${s.c};color:${on?'#fff':s.c};background:${on?s.c:s.c+'15'}" onclick="setAirwayStatus('${s.v}','${s.l}')">${s.l}</button>`;
  });
  h+='</div>';
  h+='<div style="font-size:11px;font-weight:700;color:#3498db;margin-bottom:4px">התערבויות</div>';
  h+='<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">';
  const _ay=_casualtyXABCDE?.e?.ageYears;
  const peds=_ay!=null&&_ay<12;
  ['הרמת סנטר','הרמת לסת','NPA','OPA','SGA (i-gel)','תנוחת התאוששות','נתיב כירורגי','אינטובציה'].forEach(i=>{
    const blockedCric=peds&&i==='נתיב כירורגי';
    const guard=blockedCric?`onclick="alert('נתיב כירורגי (cric) אסור בילדים מתחת לגיל 12 לפי ספר הטראומה צה״ל 01/2026. שקול BMV + אינטובציה ע״י מוסמך.')" style="flex:0 0 auto;padding:8px 12px;min-height:40px;opacity:.5;border-color:var(--re);color:var(--re)"`:`onclick="addAirwayIntervention('${i}')" style="flex:0 0 auto;padding:8px 12px;min-height:40px"`;
    h+=`<button class="xabcde-btn" ${guard}>${blockedCric?'🚫 ':''}${i}</button>`;
  });
  h+=`<button class="xabcde-btn" style="flex:0 0 auto;padding:8px 12px;min-height:40px;border-color:var(--t3);color:var(--t2)" onclick="addAirwayInterventionPrompt()">✏ ידני</button>`;
  h+='</div>';
  // Face/inhalation burn warning
  const faceInjury=_casualtyInjuries.some(i=>i.region==='face'||(i.region==='head'&&i.type==='burn'));
  if(faceInjury){
    h+='<div style="padding:6px 8px;border-radius:6px;background:rgba(230,126,34,.12);border-right:2px solid var(--or);margin:6px 0;font-size:10px;color:var(--or);font-weight:700">פגיעת פנים / כוויות שאיפה — ניטור רציף של איכות הנשימה ונתיב אוויר</div>';
  }
  // Tier 28: deep-shock airway warning (IDF 2026)
  if(_isDeepShock()){
    h+='<div style="padding:8px 10px;border-radius:8px;background:rgba(231,76,60,.12);border:1.5px solid var(--re);margin:6px 0;font-size:11px;color:var(--re);font-weight:700">⚠ הלם עמוק — הימנע מאינטובציה (RSI) אם אפשר. שקול NPA/OPA + BMV + פינוי דחוף.</div>';
  }
  // Tier 17: pass subKey+field so each row gets a 🗑 delete button.
  h+=renderEntryList(a.interventions,e=>e.type,'a','interventions');
  // Tier 28: C-Collar (cervical spine immobilization)
  const collarMOIs=['fall','vehicle','blast','blunt'];
  const collarReason=collarMOIs.find(m=>_hasMOI(m));
  const collarHighlight=!!collarReason&&!a.cervicalCollar;
  const moiNames={fall:'נפילה',vehicle:'רכב',blast:'הדף',blunt:'קהה'};
  h+='<div style="font-size:11px;font-weight:700;color:#3498db;margin:8px 0 4px 0">צווארון קשיח</div>';
  if(a.cervicalCollar){
    h+=`<div class="xabcde-entry" style="align-items:center;background:rgba(52,152,219,.1)"><span class="time">${fmtTime(a.cervicalCollar.time)}</span><span style="flex:1">צווארון C-Collar</span><button aria-label="מחק" onclick="clearCervicalCollar()" style="background:none;border:none;color:var(--re);font-size:13px;cursor:pointer;font-family:var(--f);padding:4px 6px;min-height:32px;min-width:32px">🗑</button></div>`;
  } else {
    h+=`<button class="xabcde-btn" style="width:100%;border-color:${collarHighlight?'var(--re)':'#3498db'};color:${collarHighlight?'var(--re)':'#3498db'};background:${collarHighlight?'rgba(231,76,60,.12)':'none'};font-weight:${collarHighlight?'800':'600'}" onclick="addCervicalCollar()">+ הנח צווארון</button>`;
    if(collarHighlight){
      h+=`<div style="font-size:9px;color:var(--re);font-weight:600;text-align:center;margin-top:3px">חשד לפגיעת עמ״ש צווארי בשל ${moiNames[collarReason]||collarReason}</div>`;
    }
  }
  return h;
}
function setAirwayStatus(v,label){_casualtyXABCDE.a.status=v;addTimestampedAction('a','נתיב אוויר: '+(label||v),'');MedHost.renderIncidentPage();}
function addAirwayIntervention(type){
  pushMedHistory();
  const entry={type,time:new Date().toISOString()};
  // For intubation + surgical airway — capture attempts + tube size + outcome (IDF 2026)
  if(type==='אינטובציה'||type==='נתיב כירורגי'){
    const attemptsStr=prompt('מס׳ ניסיונות:','1');
    const attempts=parseInt(attemptsStr)||1;
    const sizeStr=prompt(type==='נתיב כירורגי'?'גודל צינור/canula (mm):':'גודל צינור (mm ID):',type==='נתיב כירורגי'?'6.0':'7.5');
    const size=parseFloat(sizeStr)||null;
    const outcome=prompt('תוצאה: "צלח" / "כשל"','צלח');
    entry.attempts=attempts;
    entry.tubeSize=size;
    entry.outcome=outcome&&outcome.includes('צלח')?'success':'fail';
  }
  _casualtyXABCDE.a.interventions.push(entry);
  let label=type;
  if(entry.attempts){
    const mark=entry.outcome==='success'?'✓':entry.outcome==='fail'?'✗':'';
    label+=` (${entry.attempts} ניסיונות${entry.tubeSize?', '+entry.tubeSize+'mm':''}${mark?' '+mark:''})`;
  }
  addTimestampedAction('a',label,'');
  MedHost.renderIncidentPage();
}
function addAirwayInterventionPrompt(){
  const v=prompt('התערבות חופשית:');if(!v)return;
  addAirwayIntervention(String(v).slice(0,80));
}

// B — Breathing
function renderBTab(){
  const b=_casualtyXABCDE.b;let h='';
  // Tap-to-rate (no 15s countdown — computes live from tap 2 onward)
  h+='<div style="font-size:10px;font-weight:700;color:#1abc9c;margin-bottom:4px">קצב נשימה</div>';
  if(_tapRateState.active&&_tapRateState.type==='rr'){
    const elapsed=((Date.now()-_tapRateState.startTime)/1000).toFixed(1);
    const liveRate=_computeTapRate(_tapRateState);
    h+=`<button class="tap-rate-btn active" onclick="startTapToRate('rr')">🫁 ${_tapRateState.taps} נשימות · ${elapsed}s · ${_tapRateState.taps>=2?liveRate+' לדקה':'הקש שוב'}</button>`;
    h+='<div style="display:flex;gap:4px;margin-top:4px">';
    h+=`<button class="xabcde-btn" style="flex:2;border-color:var(--gr);color:var(--gr);background:rgba(46,204,113,.08)" ${_tapRateState.taps<2?'disabled':''} onclick="commitTapRate()">✓ קבע</button>`;
    h+=`<button class="xabcde-btn" style="flex:1" onclick="cancelTapRate()">ביטול</button>`;
    h+='</div>';
  } else {
    h+=`<div style="display:flex;gap:4px">`;
    h+=`<button class="tap-rate-btn" style="flex:2" onclick="startTapToRate('rr')">🫁 הקש עם כל נשימה</button>`;
    h+=`<button class="xabcde-btn" style="flex:1" onclick="manualEnterRate('rr')">⌨ ידני</button>`;
    h+=`</div>`;
  }
  if(b.respiratoryRate!==null){
    const c=b.respiratoryRate>30?'#e74c3c':b.respiratoryRate>20?'#f1c40f':b.respiratoryRate<12?'#3498db':'#2ecc71';
    h+=`<div style="text-align:center;font-size:18px;font-weight:900;color:${c};margin:6px 0">${b.respiratoryRate}/דקה</div>`;
  }
  // IDF protocol: open chest wound = 3-side dressing. No chest seal, no needle decompression.
  const penChest=_casualtyInjuries.some(i=>i.type==='penetrating'&&['chest_r','chest_l'].includes(i.region));
  if(penChest){
    h+='<div style="padding:6px 8px;border-radius:6px;background:rgba(230,126,34,.12);border-right:2px solid var(--or);margin:6px 0;font-size:10px;color:var(--or);font-weight:700">פצע חזה חודר — חבישה משלושה צדדים. בלי אטם חזה ובלי דקירת מחט. חמצן, ישיבה, שיכוך כאב; נקז חזה רק לפי פרוטוקול.</div>';
  }
  // Chest intervention — IDF 2026: tube thoracostomy only on indication (rib 4-5, anterior-mid axillary)
  h+='<div style="font-size:10px;font-weight:700;color:#e67e22;margin:8px 0 4px 0">התערבות חזה (דורש הכשרה ייעודית)</div>';
  h+='<div style="display:flex;gap:4px;margin-bottom:6px">';
  h+=`<button class="xabcde-btn" style="flex:1" onclick="addBreathingEntry('tubeThora','נקז חזה שמאל (צלע 4-5 אקסילרי קדמי-אמצעי)','L')">נקז חזה L</button>`;
  h+=`<button class="xabcde-btn" style="flex:1" onclick="addBreathingEntry('tubeThora','נקז חזה ימין (צלע 4-5 אקסילרי קדמי-אמצעי)','R')">נקז חזה R</button>`;
  h+='</div>';
  if(b.tubeThora)h+=`<div class="xabcde-entry" style="align-items:center"><span class="time">${fmtTime(b.tubeThora.time)}</span><span style="flex:1">נקז חזה ${escapeHtml(outLR(String(b.tubeThora.side||'')))} — צלע 4-5</span><button aria-label="מחק נקז חזה" onclick="clearBreathingEntry('tubeThora')" style="background:none;border:none;color:var(--re);font-size:13px;cursor:pointer;font-family:var(--f);padding:4px 6px;min-height:32px;min-width:32px">🗑</button></div>`;
  if(b.needleDecompression)h+=`<div class="xabcde-entry" style="align-items:center"><span class="time">${fmtTime(b.needleDecompression.time)}</span><span style="flex:1">דקירת מחט ${escapeHtml(outLR(String(b.needleDecompression.side||'')))} — 14G</span><button aria-label="מחק דקירת מחט" onclick="clearBreathingEntry('needleDecompression')" style="background:none;border:none;color:var(--re);font-size:13px;cursor:pointer;font-family:var(--f);padding:4px 6px;min-height:32px;min-width:32px">🗑</button></div>`;
  // Tier 29: Ventilator panel — only if intubated
  const intubated=(_casualtyXABCDE?.a?.interventions||[]).some(i=>i.type==='אינטובציה');
  if(intubated){
    if(!b.vent)b.vent={};
    const v=b.vent;
    const wtKg=_getPatientWeight()||70;
    const suggestedTV=Math.round(wtKg*7);
    h+='<div style="margin-top:10px;padding:8px;border-radius:8px;background:rgba(26,188,156,.08);border:1px solid rgba(26,188,156,.25)">';
    h+=`<div style="font-size:11px;font-weight:900;color:#1abc9c;margin-bottom:6px">🫁 הגדרות מנשם (מוצע: TV=${suggestedTV} PEEP=5 FiO2=100%)</div>`;
    h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:4px">';
    [{k:'tv',l:'TV',ph:'ml',def:suggestedTV},{k:'peep',l:'PEEP',ph:'cmH2O',def:5},{k:'fio2',l:'FiO2',ph:'%',def:100},{k:'rr',l:'RR',ph:'/min',def:14}].forEach(f=>{
      const val=v[f.k]??'';
      h+=`<div><div style="font-size:9px;color:var(--t3)">${f.l}</div><input class="fi" type="number" value="${val}" placeholder="${f.def}" oninput="_casualtyXABCDE.b.vent.${f.k}=this.value;MedHost.triggerAutoSave()" style="font-size:12px;padding:6px;text-align:center;min-height:34px"></div>`;
    });
    h+='</div>';
    // EtCO2 target guidance
    const lastV=_casualtyVitals.length?_casualtyVitals[_casualtyVitals.length-1]:null;
    if(lastV?.etco2){
      const eco=parseInt(lastV.etco2);
      const target=eco<35?'⬆ הגבר RR':eco>45?'⬇ הפחת RR':'✓ יעד 35-45';
      const cl=eco<30||eco>50?'#e74c3c':eco<35||eco>45?'#f1c40f':'#2ecc71';
      h+=`<div style="margin-top:6px;font-size:11px;color:${cl};font-weight:700">EtCO₂ ${eco} → ${target}</div>`;
    }
    h+='</div>';
  }
  // Tier 30: O2 enrichment panel + BVM
  h+='<div style="font-size:10px;font-weight:700;color:#1abc9c;margin:10px 0 4px">העשרת חמצן</div>';
  const curO2=_casualtyXABCDE.b.o2Lpm||null;
  const o2On=curO2!==null;
  h+='<div style="display:flex;gap:4px;margin-bottom:4px;flex-wrap:wrap">';
  [2,4,6,8,10,15].forEach(lpm=>{
    const on=curO2===lpm;
    h+=`<button class="xabcde-btn" style="flex:1;min-width:40px;min-height:36px;font-size:11px;${on?'background:rgba(26,188,156,.2);border-color:#1abc9c;color:#1abc9c':''}" onclick="_casualtyXABCDE.b.o2Lpm=${on?'null':lpm};_casualtyXABCDE.b.o2StartTime=${on?'null':"new Date().toISOString()"};addTimestampedAction('b','${on?'הפסקת':'העשרת'} חמצן ${lpm}L/min','');MedHost.triggerAutoSave();MedHost.renderIncidentPage()">${lpm}L</button>`;
  });
  h+='</div>';
  if(o2On&&_casualtyXABCDE.b.o2StartTime){
    const elapsed=Math.round((Date.now()-new Date(_casualtyXABCDE.b.o2StartTime).getTime())/60000);
    h+=`<div style="font-size:10px;color:#1abc9c;font-weight:700;margin-bottom:4px">⏱ חמצן ${curO2}L/min פעיל — ${elapsed} דק׳</div>`;
  }
  // SpO2 < 95 recommendation
  const lastSpo2=parseInt(_casualtyVitalsInput?.spo2)||null;
  if(lastSpo2&&lastSpo2<95&&!o2On){
    h+='<div style="padding:6px 8px;border-radius:6px;background:rgba(231,76,60,.1);border-right:2px solid var(--re);font-size:10px;color:var(--re);font-weight:700;margin-bottom:4px">⚠ SpO₂ '+lastSpo2+'% — מומלץ: העשרת חמצן</div>';
  }
  // BVM (Bag-Valve-Mask) button
  h+='<div style="margin-top:6px">';
  const bvmActive=!!_casualtyXABCDE.b.bvm;
  h+=`<button class="xabcde-btn" style="width:100%;border-color:#1abc9c;color:${bvmActive?'#fff':'#1abc9c'};background:${bvmActive?'#1abc9c':'none'};margin-bottom:4px" onclick="_casualtyXABCDE.b.bvm=${bvmActive?'null':'{time:new Date().toISOString()}'};addTimestampedAction('b','${bvmActive?'הפסקת':'התחלת'} הנשמה עם אמבו ומסיכה','');MedHost.triggerAutoSave();MedHost.renderIncidentPage()">${bvmActive?'✓ הנשמה עם אמבו ומסיכה — פעיל':'+ הנשמה עם אמבו ומסיכה (BVM)'}</button>`;
  if(bvmActive&&_casualtyXABCDE.b.bvm?.time){
    const elapsed=Math.round((Date.now()-new Date(_casualtyXABCDE.b.bvm.time).getTime())/60000);
    h+=`<div style="font-size:10px;color:#1abc9c;font-weight:700">⏱ BVM פעיל — ${elapsed} דק׳</div>`;
  }
  h+='</div>';
  return h;
}
function addBreathingEntry(field,label,side){
  const entry={side,time:new Date().toISOString()};
  if(field==='tubeThora'){
    const outcome=prompt('תוצאת נקז חזה: "צלח" / "כשל"','צלח');
    entry.outcome=outcome&&outcome.includes('צלח')?'success':'fail';
    const sizeStr=prompt('גודל צינור (Fr):','28');
    const size=parseInt(sizeStr);
    if(size)entry.tubeSize=size;
  }
  _casualtyXABCDE.b[field]=entry;
  const mark=entry.outcome==='success'?' ✓':entry.outcome==='fail'?' ✗':'';
  const sz=entry.tubeSize?` ${entry.tubeSize}Fr`:'';
  addTimestampedAction('b',label+sz+mark,'');
  const regionMap={tubeThora:{R:'chest_r',L:'chest_l'},needleDecompression:{R:'chest_r',L:'chest_l'}};
  if(regionMap[field]&&regionMap[field][side])autoPlaceTreatment(regionMap[field][side],field);
  MedHost.renderIncidentPage();
}

// C — Circulation
function renderCTab(){
  const c=_casualtyXABCDE.c;let h='';
  // Tier 29: AVPU (moved from D — rapid neuro part of Circulation per X-CARE 2026)
  const d=_casualtyXABCDE.d;
  h+='<div style="font-size:10px;font-weight:700;color:#9b59b6;margin-bottom:4px">הכרה — AVPU</div>';
  h+='<div style="display:flex;gap:4px;margin-bottom:8px">';
  [{v:'A',l:'ערני'},{v:'V',l:'לקול'},{v:'P',l:'לכאב'},{v:'U',l:'לא מגיב'}].forEach(a=>{
    const on=d.avpu===a.v;
    h+=`<button class="xabcde-btn" style="flex:1;min-height:44px;font-size:11px;${on?'background:rgba(155,89,182,.2);border-color:#9b59b6;color:#9b59b6':''}" onclick="_casualtyXABCDE.d.avpu='${a.v}';addTimestampedAction('c','AVPU: ${a.v}','');MedHost.renderIncidentPage()">${a.v} · ${a.l}</button>`;
  });
  h+='</div>';
  // Current pulse snapshot from last vitals reading (if any)
  if(_casualtyVitals.length){
    const lv=_casualtyVitals[_casualtyVitals.length-1];
    const ageMin=Math.round((Date.now()-new Date(lv.time).getTime())/60000);
    const ageStr=ageMin<1?'זה עתה':ageMin+'ד׳ לפני';
    const rpLabel=lv.radialPulse==='absent'?'נעדר':lv.radialPulse==='weak'?'חלש':lv.radialPulse==='present'?'תקין':'';
    const pCol=lv.pulse&&(lv.pulse>120||lv.pulse<50)?'var(--re-hi)':'var(--tx)';
    h+=`<div style="background:var(--c2);border-radius:8px;padding:6px 10px;margin-bottom:8px;font-size:11px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">`;
    h+=`<span style="font-weight:800;color:${pCol}">❤️ דופק ${lv.pulse||'—'}</span>`;
    if(rpLabel)h+=`<span style="color:var(--t3)">· רדיאלי ${rpLabel}</span>`;
    h+=`<span style="color:var(--t4);margin-inline-start:auto">${ageStr}</span>`;
    h+=`</div>`;
  } else {
    h+=`<div style="background:var(--c2);border-radius:8px;padding:6px 10px;margin-bottom:8px;font-size:11px;color:var(--t3);text-align:center">טרם נמדדו סימנים חיוניים — השתמש בסקירת מדדים למטה</div>`;
  }
  // Tier 30: Quick BP + SpO2 measurement in C tab
  h+='<div style="font-size:10px;font-weight:700;color:#e67e22;margin:4px 0 4px">מדידה מהירה</div>';
  h+='<div style="display:grid;grid-template-columns:1.6fr 1fr;gap:6px;margin-bottom:8px">';
  h+=`<div><div style="font-size:9px;color:var(--t3)">💉 ל"ד (סיסט/דיאס)</div><div style="display:flex;gap:3px;align-items:center"><input class="fi" type="number" inputmode="numeric" placeholder="סיסט" value="${escapeHtml(String(_casualtyVitalsInput.bpSys||''))}" oninput="_casualtyVitalsInput.bpSys=this.value" style="font-size:14px;padding:8px;text-align:center;min-height:40px;flex:1;min-width:0"><span style="color:var(--t4);font-weight:700">/</span><input class="fi" type="number" inputmode="numeric" placeholder="דיאס" value="${escapeHtml(String(_casualtyVitalsInput.bpDia||''))}" oninput="_casualtyVitalsInput.bpDia=this.value" style="font-size:14px;padding:8px;text-align:center;min-height:40px;flex:1;min-width:0"></div></div>`;
  h+=`<div><div style="font-size:9px;color:var(--t3)">📊 SpO₂</div><input class="fi" type="number" inputmode="numeric" placeholder="%" value="${escapeHtml(String(_casualtyVitalsInput.spo2||''))}" oninput="_casualtyVitalsInput.spo2=this.value" style="font-size:14px;padding:8px;text-align:center;min-height:40px"></div>`;
  h+='</div>';
  // Radial pulse quick toggle (persists into _casualtyVitalsInput for next vitals save)
  h+='<div style="font-size:10px;font-weight:700;color:#e67e22;margin-bottom:4px">דופק רדיאלי</div>';
  h+='<div style="display:flex;gap:4px;margin-bottom:8px">';
  const rp0=_casualtyVitalsInput.radialPulse||'';
  [{v:'present',l:'תקין',c:'#2ecc71'},{v:'weak',l:'חלש',c:'#f1c40f'},{v:'absent',l:'נעדר',c:'#e74c3c'}].forEach(o=>{
    const on=rp0===o.v;
    h+=`<button class="xabcde-btn" style="flex:1;min-height:44px;border-color:${o.c};color:${on?'#fff':o.c};background:${on?o.c:o.c+'15'};font-size:11px" onclick="_casualtyVitalsInput.radialPulse='${o.v}';addTimestampedAction('c','דופק רדיאלי: ${o.l}','');MedHost.renderIncidentPage()">${o.l}</button>`;
  });
  h+='</div>';
  // Pulse
  h+='<div style="font-size:10px;font-weight:700;color:#e67e22;margin-bottom:4px">דופק</div>';
  h+='<div style="display:flex;gap:6px;margin-bottom:6px">';
  [{v:'strong',l:'חזק',c:'#2ecc71'},{v:'weak',l:'חלש',c:'#f1c40f'},{v:'absent',l:'אין',c:'#e74c3c'}].forEach(p=>{
    const on=c.pulseCharacter===p.v;
    h+=`<button class="xabcde-btn" style="flex:1;min-height:48px;border-color:${p.c};color:${on?'#fff':p.c};background:${on?p.c:p.c+'15'}" onclick="_casualtyXABCDE.c.pulseCharacter='${p.v}';addTimestampedAction('c','דופק: ${p.l}','');MedHost.renderIncidentPage()">${p.l}</button>`;
  });
  h+='</div>';
  // Tap-to-rate pulse (no countdown — computes live from tap 2 onward)
  if(_tapRateState.active&&_tapRateState.type==='pulse'){
    const elapsed=((Date.now()-_tapRateState.startTime)/1000).toFixed(1);
    const liveRate=_computeTapRate(_tapRateState);
    h+=`<button class="tap-rate-btn active" onclick="startTapToRate('pulse')">❤️ ${_tapRateState.taps} פעימות · ${elapsed}s · ${_tapRateState.taps>=2?liveRate+' לדקה':'הקש שוב'}</button>`;
    h+='<div style="display:flex;gap:4px;margin-top:4px;margin-bottom:6px">';
    h+=`<button class="xabcde-btn" style="flex:2;border-color:var(--gr);color:var(--gr);background:rgba(46,204,113,.08)" ${_tapRateState.taps<2?'disabled':''} onclick="commitTapRate()">✓ קבע</button>`;
    h+=`<button class="xabcde-btn" style="flex:1" onclick="cancelTapRate()">ביטול</button>`;
    h+='</div>';
  } else {
    h+='<div style="display:flex;gap:4px;margin-bottom:6px">';
    h+=`<button class="tap-rate-btn" style="flex:2;border-color:#e67e22;color:#e67e22;background:rgba(230,126,34,.1)" onclick="startTapToRate('pulse')">❤️ הקש עם כל פעימה</button>`;
    h+=`<button class="xabcde-btn" style="flex:1;border-color:#e67e22;color:#e67e22" onclick="manualEnterRate('pulse')">⌨ ידני</button>`;
    h+=`</div>`;
  }
  // CRT moved to secondary survey E (per IDF 2026 doctrine — neuro/perfusion reassessment)
  // IV Access
  h+='<div style="font-size:11px;font-weight:700;color:#e67e22;margin:8px 0 4px">גישה ורידית</div>';
  h+='<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:4px">';
  ['יד R','יד L','AC R','AC L','EJ R','EJ L','IO hum-R','IO hum-L','IO tib-R','IO tib-L'].forEach(site=>{
    h+=`<button class="xabcde-btn" style="flex:0 0 auto;padding:6px 10px;font-size:10px;min-height:36px" onclick="addIVAccess('${site}')">${site}</button>`;
  });
  h+=`<button class="xabcde-btn" style="flex:0 0 auto;padding:6px 10px;font-size:10px;min-height:36px;border-color:var(--t3);color:var(--t2)" onclick="addIVAccessPrompt()">✏ ידני</button>`;
  h+='</div>';
  h+=renderEntryList(c.ivAccess,e=>e.site,'c','ivAccess');
  // Tier 29: Quick TXA button in C (per IDF 2026 schema — TXA lives in Circulation)
  const gotTXA=(_casualtyXABCDE?.e?.medications||[]).some(m=>_mn(m)==='TXA');
  const penTorso=_casualtyInjuries.some(i=>i.type==='penetrating'&&['chest_r','chest_l','abdomen_r','abdomen_l','upper_back_r','upper_back_l','lower_back_r','lower_back_l','neck','pelvis'].includes(i.region));
  const txaHighlight=penTorso&&!gotTXA;
  h+='<div style="font-size:11px;font-weight:700;color:#e74c3c;margin:8px 0 4px">מתן TXA</div>';
  if(gotTXA){
    h+=`<div class="xabcde-entry" style="align-items:center;background:rgba(46,204,113,.1);border-right:3px solid var(--gr)"><span style="flex:1;color:var(--gr);font-weight:700">✓ TXA ניתן</span></div>`;
    // Flush warning if blood also given
    const hasBlood=(_casualtyXABCDE?.c?.fluids||[]).some(f=>['דם מלא','פלזמה/FFP','כדוריות'].includes(f.type));
    if(hasBlood){h+=`<div style="padding:6px 8px;border-radius:6px;background:rgba(231,76,60,.12);border-right:2px solid var(--re);margin:4px 0;font-size:10px;color:var(--re);font-weight:700">⚠ חובה לשטוף ב-10cc סליין בין TXA לדם! אי-שטיפה = קרישה בליין</div>`;}
  } else {
    h+=`<button class="xabcde-btn" style="width:100%;border-color:#e74c3c;color:#e74c3c;margin-bottom:4px;background:${txaHighlight?'rgba(231,76,60,.15)':'none'};font-weight:${txaHighlight?'800':'600'}" onclick="addMedication('TXA','1g','IV');MedHost.toast('TXA 1g IV תועד',false)">+ TXA 1g IV</button>`;
    if(txaHighlight){h+=`<div style="font-size:9px;color:var(--re);font-weight:600;text-align:center;margin-bottom:4px">פציעה חודרת בגו — TXA מומלץ תוך 3 שעות</div>`;}
  }
  // Shock-driven blood highlight
  const deepShockNow=_isDeepShock();
  h+='<div style="font-size:11px;font-weight:700;color:#e74c3c;margin:8px 0 4px">🩸 דם ומוצרי דם</div>';
  if(deepShockNow){h+=`<div style="padding:6px 8px;border-radius:6px;background:rgba(231,76,60,.12);border-right:2px solid var(--re);margin-bottom:6px;font-size:10px;color:var(--re);font-weight:700">הלם עמוק — מומלץ: דם מלא ראשון</div>`;}
  h+='<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:4px">';
  [{t:'דם מלא',v:500},{t:'פלזמה/FFP',v:250},{t:'כדוריות',v:250},{t:'טרומבוציטים',v:250}].forEach(f=>{
    h+=`<button class="xabcde-btn" style="flex:0 0 auto;padding:6px 10px;font-size:10px;min-height:36px;border-color:#e74c3c;color:#e74c3c" onclick="addFluidEntry('${f.t}',${f.v})">${f.t} ${f.v}ml</button>`;
  });
  h+=`<button class="xabcde-btn" style="flex:0 0 auto;padding:6px 10px;font-size:10px;min-height:36px;border-color:var(--t3);color:var(--t2)" onclick="addFluidEntryPrompt(true)">✏ ידני</button>`;
  h+='</div>';
  // Crystalloids
  h+='<div style="font-size:11px;font-weight:700;color:#e67e22;margin:8px 0 4px">💧 קריסטלואידים</div>';
  h+='<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:4px">';
  [{t:'הרטמן',v:500},{t:'NaCl 0.9%',v:500}].forEach(f=>{
    h+=`<button class="xabcde-btn" style="flex:0 0 auto;padding:6px 10px;font-size:10px;min-height:36px" onclick="addFluidEntry('${f.t}',${f.v})">${f.t} ${f.v}ml</button>`;
  });
  h+=`<button class="xabcde-btn" style="flex:0 0 auto;padding:6px 10px;font-size:10px;min-height:36px;border-color:var(--t3);color:var(--t2)" onclick="addFluidEntryPrompt(false)">✏ ידני</button>`;
  h+='</div>';
  // Totals with blood vs crystalloid breakdown
  const totals=getFluidTotals();const totalKeys=Object.keys(totals);
  if(totalKeys.length){
    const bloodProducts=['דם מלא','פלזמה/FFP','כדוריות','טרומבוציטים'];
    const vBlood=Object.entries(totals).filter(([k])=>bloodProducts.includes(k)).reduce((s,[,v])=>s+v,0);
    const vCrystal=Object.entries(totals).filter(([k])=>!bloodProducts.includes(k)).reduce((s,[,v])=>s+v,0);
    h+=`<div style="font-size:10px;font-weight:700;color:var(--or);margin:4px 0">סה"כ: ${Object.entries(totals).map(([k,v])=>escapeHtml(v+'ml '+k)).join(' | ')}</div>`;
    if(vBlood>0&&vCrystal>0){
      const ratio=(vCrystal/vBlood).toFixed(1);
      const ratioOk=parseFloat(ratio)<=0.5&&vCrystal<1000;
      h+=`<div style="font-size:9px;color:${ratioOk?'var(--gr)':'var(--or)'};margin-top:2px">${ratioOk?'✓':'⚠️'} יחס קריסטלואיד:דם = ${ratio}:1 ${ratioOk?'(תקין)':'(הימנע מקריסטלואידים בדימום — שקול עוד מוצרי דם)'}</div>`;
    }
    h+=`<div style="font-size:9px;color:var(--t3);margin-top:2px">🩸 ${vBlood}ml דם | 💧 ${vCrystal}ml קריסטלואידים | סה"כ ${vBlood+vCrystal}ml</div>`;
    // Tier 29: RDCR 1:1:1 component breakdown
    const vFFP=totals['פלזמה/FFP']||totals['פלזמה יבשה (FDP)']||0;
    const vRBC=totals['כדוריות']||0;
    const vPLT=totals['טרומבוציטים']||0;
    const vWB=totals['דם מלא']||0;
    if(vFFP||vRBC||vPLT||vWB){
      const ratio111Ok=vWB>0||(vFFP>0&&vRBC>0&&Math.abs(vFFP-vRBC)<100);
      h+=`<div style="font-size:10px;margin-top:4px;padding:4px 6px;border-radius:6px;background:${ratio111Ok?'rgba(46,204,113,.1)':'rgba(241,196,15,.1)'};border:1px solid ${ratio111Ok?'rgba(46,204,113,.3)':'rgba(241,196,15,.3)'}">${ratio111Ok?'✓':'⚠'} RDCR 1:1:1 — FFP:${vFFP} | RBC:${vRBC} | PLT:${vPLT} | WB:${vWB} ${ratio111Ok?'(תקין)':'(שקול לאזן)'}</div>`;
    }
  }
  return h;
}
function addIVAccess(site){pushMedHistory();_casualtyXABCDE.c.ivAccess.push({site,time:new Date().toISOString()});addTimestampedAction('c','גישה ורידית: '+site,'');MedHost.renderIncidentPage();}
function addIVAccessPrompt(){const v=prompt('אתר גישה חופשי:');if(!v)return;addIVAccess(String(v).slice(0,40));}
function addFluidEntry(type,volume){pushMedHistory();_casualtyXABCDE.c.fluids.push({type,volume:parseFloat(volume)||0,time:new Date().toISOString()});addTimestampedAction('c','נוזלים: '+volume+'ml '+type,'');MedHost.renderIncidentPage();}
function addFluidEntryPrompt(isBloodProduct){
  const t=prompt(isBloodProduct?'סוג מוצר דם / נוזל:':'סוג נוזל/קריסטלואיד:');
  if(!t)return;
  const vStr=prompt('נפח במ״ל:','500');
  const v=parseFloat(vStr);
  if(!isFinite(v)||v<=0){MedHost.toast('נפח לא תקין',false);return;}
  addFluidEntry(String(t).slice(0,40),v);
}
function getFluidTotals(){const t={};(_casualtyXABCDE.c.fluids||[]).forEach(f=>{t[f.type]=(t[f.type]||0)+(parseFloat(f.volume)||0);});return t;}

// D — Disability
function renderDTab(){
  // D = Disability: primary-survey rapid neuro screen only.
  // - AVPU alone (no GCS auto-mapping; they're different tools)
  // - Pupil size + reactivity per side (pupils are a primary-survey
  //   finding because "blown pupil" = immediate herniation concern)
  // Full GCS calculator lives in the Secondary Survey — with pupil
  // reactivity as a modifier that adjusts the score when both are marked.
  const d=_casualtyXABCDE.d;let h='';
  h+='<div style="font-size:11px;font-weight:700;color:#9b59b6;margin-bottom:4px">הכרה — AVPU</div>';
  h+='<div style="display:flex;gap:6px;margin-bottom:6px">';
  [{v:'A',l:'ערני (Alert)'},{v:'V',l:'מגיב לקול'},{v:'P',l:'מגיב לכאב'},{v:'U',l:'לא מגיב'}].forEach(a=>{
    const on=d.avpu===a.v;
    h+=`<button class="xabcde-btn" style="flex:1;min-height:48px;font-size:11px;${on?'background:rgba(155,89,182,.2);border-color:#9b59b6;color:#9b59b6':''}" onclick="_casualtyXABCDE.d.avpu='${a.v}';addTimestampedAction('d','AVPU: ${a.v}','');MedHost.renderIncidentPage()">${a.l}</button>`;
  });
  h+='</div>';
  // Pupils — primary survey (quick glance).
  h+='<div style="font-size:11px;font-weight:700;color:#9b59b6;margin:8px 0 4px">אישונים</div>';
  h+='<div style="display:flex;gap:16px;justify-content:center;margin:6px 0">';
  ['left','right'].forEach(side=>{
    const p=d.pupils[side];const label=side==='left'?'שמאל':'ימין';
    h+=`<div style="text-align:center"><div style="font-size:10px;color:var(--t3);margin-bottom:4px">${label}</div>`;
    h+=`<div style="width:44px;height:44px;border-radius:50%;border:2px solid #9b59b6;display:flex;align-items:center;justify-content:center;margin:0 auto"><div style="width:${(p.size||3)*3}px;height:${(p.size||3)*3}px;border-radius:50%;background:${p.reactive?'#9b59b6':'#555'}"></div></div>`;
    h+=`<div style="font-size:10px;color:var(--t3);margin-top:3px">${(p.size==null&&p.reactive==null)?'לא נבדק':p.size+'mm '+(p.reactive?'מגיב לאור':'קבוע')}</div>`;
    h+=`<div style="display:flex;gap:3px;margin-top:4px;justify-content:center"><button aria-label="הקטן אישון" onclick="_casualtyXABCDE.d.pupils.${side}.size=Math.max(1,(_casualtyXABCDE.d.pupils.${side}.size??4)-1);MedHost.renderIncidentPage()" style="background:var(--c3);border:none;border-radius:4px;width:28px;height:28px;color:var(--t2);cursor:pointer;font-size:14px;min-height:28px">−</button><button aria-label="הגדל אישון" onclick="_casualtyXABCDE.d.pupils.${side}.size=Math.min(8,(_casualtyXABCDE.d.pupils.${side}.size??2)+1);MedHost.renderIncidentPage()" style="background:var(--c3);border:none;border-radius:4px;width:28px;height:28px;color:var(--t2);cursor:pointer;font-size:14px;min-height:28px">+</button><button onclick="_casualtyXABCDE.d.pupils.${side}.reactive=!_casualtyXABCDE.d.pupils.${side}.reactive;addTimestampedAction('d','אישון ${label}: '+(_casualtyXABCDE.d.pupils.${side}.reactive?'מגיב':'קבוע'),'');MedHost.renderIncidentPage()" style="background:${p.reactive?'rgba(46,204,113,.15)':'rgba(231,76,60,.15)'};border:none;border-radius:4px;padding:4px 8px;font-size:10px;color:${p.reactive?'var(--gr)':'var(--re)'};cursor:pointer;font-family:var(--f);min-height:28px">${p.reactive?'מגיב':'קבוע'}</button></div></div>`;
  });
  h+='</div>';
  // Detailed GCS moved to Secondary Survey — breadcrumb link here.
  h+=`<div style="margin-top:8px;padding:6px 10px;background:var(--c2);border-radius:8px;font-size:11px;color:var(--t3);line-height:1.4">ℹ️ GCS מפורט זמין בסקר המשני (C-A-R-E) למעקב ושינוי במצב נוירולוגי</div>`;
  return h;
}

// E — Exposure
// Pain Management Protocol flow — matches IDF Trauma Book Figure 1
// (pages 257-258). Starts from pain score → branches by IV access /
// profound shock → recommends drug+dose with "give now" buttons that
// feed directly into addMedication. Every dose displayed also shows
// the CC-per-route when weight is set (via renderCcForDose helper).
function renderPainProtocolFlow(){
  const p=_casualtyPainScore;
  if(p===null)return'';
  const inShock=_inProfoundShock();
  const hasIV=(_casualtyXABCDE.c.ivAccess||[]).length>0;
  // Opioids (morphine / fentanyl / Actiq) are withheld in shock and with altered consciousness, head injury, hypoxia or slow breathing: ketamine only.
  const lv=(_casualtyVitals||[]).length?_casualtyVitals[_casualtyVitals.length-1]:{};
  const avpuNow=(_casualtyXABCDE?.d?.avpu||'').toUpperCase();
  const opioidBlock=(!!avpuNow&&avpuNow!=='A')||_hasTBI()||(_hv(lv.spo2)&&lv.spo2<90)||(_hv(lv.rr)&&lv.rr<12);
  // IDF: ketamine 25 mg IV first line; morphine 5 mg IV (2 mg in shock); no Actiq (or other oral-transmucosal opioid) in shock; no opioid at all with altered consciousness, head injury, hypoxia or slow breathing.
  const noOpioid=opioidBlock, noActiq=inShock||opioidBlock;
  let h='';
  h+=`<div style="background:rgba(52,152,219,.08);border:1px solid rgba(52,152,219,.3);border-radius:10px;padding:10px 12px;margin-bottom:8px">`;
  h+=`<div style="font-size:12px;font-weight:800;color:var(--bl);margin-bottom:6px">💊 פרוטוקול טיפול בכאב (IDF)</div>`;
  if(p<=4){
    // Mild-moderate pain pathway.
    h+=`<div style="font-size:11px;color:var(--t2);margin-bottom:6px;line-height:1.5">כאב ${p}/10 — קל-בינוני: שילוב פרצטמול + אופטלגין PO</div>`;
    if(_casualtyInjuries.some(i=>i.type==='penetrating'&&['abdomen_r','abdomen_l','lower_back_r','lower_back_l'].includes(i.region)))h+=`<div style="font-size:10px;color:var(--re-hi);margin-bottom:4px">⚠️ בטן חודרת / צום — אל תיתן PO</div>`;
    h+=`<div style="display:flex;gap:4px;flex-wrap:wrap">`;
    h+=`<button class="xabcde-btn" style="flex:1;min-height:40px;font-size:11px;border-color:var(--gr);color:var(--gr)" onclick="addMedication('אופטלגין','1g','PO')">אופטלגין 1g PO</button>`;
    h+=`<button class="xabcde-btn" style="flex:1;min-height:40px;font-size:11px;border-color:var(--gr);color:var(--gr)" onclick="addMedication('אקמול','1g','PO')">אקמול 1g PO</button>`;
    h+=`</div>`;
  } else {
    // Severe pain pathway. Branches on IV access; opioid buttons only when they are safe to offer.
    h+=`<div style="font-size:11px;color:var(--t2);margin-bottom:6px;line-height:1.5">כאב ${p}/10 — חזק. ${hasIV?'✓ יש גישה ורידית':'⚠ אין גישה ורידית'}${inShock?' · <b style="color:var(--re-hi)">הלם!</b>':''}</div>`;
    if(inShock){
      h+=`<div style="background:rgba(231,76,60,.15);border:1.5px solid var(--re);border-radius:8px;padding:6px 10px;font-size:11px;color:var(--re-hi);margin-bottom:6px;line-height:1.5">🚨 הלם — קטמין קו ראשון; מורפין 2mg בלבד; ללא Actiq / פנטניל</div>`;
    } else if(opioidBlock){
      h+=`<div style="background:rgba(231,76,60,.15);border:1.5px solid var(--re);border-radius:8px;padding:6px 10px;font-size:11px;color:var(--re-hi);margin-bottom:6px;line-height:1.5">🚫 קטמין בלבד — אופיואידים אסורים (הכרה/נשימה)</div>`;
    }
    if(hasIV){
      h+=`<button class="xabcde-btn" style="width:100%;min-height:44px;font-size:12px;border-color:var(--bl);color:var(--bl);margin-bottom:4px" onclick="addMedication('קטמין','25mg','IV')">🧪 קטמין 25mg IV — קו ראשון</button>`;
      if(!noOpioid){
        h+=`<div style="font-size:10px;color:var(--t3);margin:4px 0">אם כעבור 5 דק׳ הכאב עדיין ≥5:</div>`;
        h+=inShock?`<button class="xabcde-btn" style="width:100%;min-height:44px;font-size:12px;border-color:var(--bl);color:var(--bl)" onclick="addMedication('מורפין','2mg','IV')">💉 מורפין 2mg IV (הלם)</button>`:`<button class="xabcde-btn" style="width:100%;min-height:44px;font-size:12px;border-color:var(--bl);color:var(--bl)" onclick="addMedication('מורפין','5mg','IV')">💉 מורפין 5mg IV</button>`;
      } else {
        h+=`<div style="font-size:10px;color:var(--t3);margin:4px 0">הכאב נמשך: קטמין חוזר לפי חלון המנה (IV כל 20 דק׳)</div>`;
      }
    } else {
      // No IV access path.
      if(!noActiq){
        h+=`<button class="xabcde-btn" style="width:100%;min-height:44px;font-size:12px;border-color:var(--bl);color:var(--bl);margin-bottom:4px" onclick="addMedication('Actiq OTFC','800mcg','Buccal')">🍭 Actiq OTFC 800mcg בוקאלי</button>`;
        h+=`<div style="font-size:10px;color:var(--t3);margin:4px 0">אם כעבור 15 דק׳ הכאב עדיין ≥5: עד 2 Actiq בסה״כ, ואם עדיין — קטמין או מורפין IM:</div>`;
        h+=`<button class="xabcde-btn" style="width:100%;min-height:44px;font-size:12px;border-color:var(--bl);color:var(--bl);margin-bottom:4px" onclick="addMedication('קטמין','50mg','IM')">🧪 קטמין 50mg IM</button>`;
        h+=`<button class="xabcde-btn" style="width:100%;min-height:44px;font-size:12px;border-color:var(--bl);color:var(--bl)" onclick="addMedication('מורפין','5mg','IM')">💉 מורפין 5mg IM</button>`;
      } else {
        h+=`<button class="xabcde-btn" style="width:100%;min-height:44px;font-size:12px;border-color:var(--bl);color:var(--bl);margin-bottom:4px" onclick="addMedication('קטמין','50mg','IM')">🧪 קטמין 50mg IM — קו ראשון${inShock?' בהלם':''}</button>`;
      }
    }
  }
  h+=`</div>`;
  return h;
}
function renderETab(){
  const e=_casualtyXABCDE.e;let h='';
  // Tier 30: Full exposure + wound findings + dressings
  const exposed=!!e.fullExposure;
  h+='<div style="font-size:11px;font-weight:700;color:#2ecc71;margin-bottom:4px">הפשטה מלאה</div>';
  h+=`<button class="xabcde-btn" style="width:100%;margin-bottom:6px;border-color:${exposed?'var(--gr)':'var(--sep)'};color:${exposed?'var(--gr)':'var(--t3)'};background:${exposed?'rgba(46,204,113,.12)':'none'}" onclick="_casualtyXABCDE.e.fullExposure=${exposed?'null':'{time:new Date().toISOString()}'};addTimestampedAction('e','${exposed?'ביטול':'ביצוע'} הפשטה מלאה','');MedHost.triggerAutoSave();MedHost.renderIncidentPage()">${exposed?'✓ הפשטה מלאה בוצעה — '+fmtTime(e.fullExposure?.time):'ביצוע הפשטה מלאה'}</button>`;
  if(exposed){
    h+='<div style="display:flex;gap:4px;margin-bottom:6px">';
    h+=`<button class="xabcde-btn" style="flex:1;border-color:var(--re);color:var(--re)" onclick="const f=prompt('תאר פציעות שנמצאו בהפשטה:');if(f){addTimestampedAction('e','ממצא בהפשטה: '+f.slice(0,120),'');_casualtyXABCDE.e.exposureFindings=(_casualtyXABCDE.e.exposureFindings||[]);_casualtyXABCDE.e.exposureFindings.push({text:f.slice(0,120),time:new Date().toISOString()});MedHost.triggerAutoSave();MedHost.renderIncidentPage();}">+ זוהתה פציעה</button>`;
    h+=`<button class="xabcde-btn" style="flex:1;border-color:var(--bl);color:var(--bl)" onclick="const d=prompt('תאר חבישה/טיפול:');if(d){addTimestampedAction('e','חבישה: '+d.slice(0,120),'');_casualtyXABCDE.e.exposureDressings=(_casualtyXABCDE.e.exposureDressings||[]);_casualtyXABCDE.e.exposureDressings.push({text:d.slice(0,120),time:new Date().toISOString()});MedHost.triggerAutoSave();MedHost.renderIncidentPage();}">+ חבישה</button>`;
    h+='</div>';
    if(e.exposureFindings?.length){
      e.exposureFindings.forEach((f,i)=>{h+=`<div class="xabcde-entry"><span class="time">${fmtTime(f.time)}</span><span style="flex:1">🔍 ${escapeHtml(f.text)}</span></div>`;});
    }
    if(e.exposureDressings?.length){
      e.exposureDressings.forEach((d,i)=>{h+=`<div class="xabcde-entry"><span class="time">${fmtTime(d.time)}</span><span style="flex:1">🩹 ${escapeHtml(d.text)}</span></div>`;});
    }
  }
  // Tier 29: GCS + pupils (moved from D per X-CARE 2026 — secondary neuro in E)
  const d=_casualtyXABCDE.d;
  const tbiActive=_hasTBI();
  h+='<div style="font-size:11px;font-weight:700;color:#9b59b6;margin-bottom:4px">GCS ואישונים</div>';
  if(tbiActive){
    h+='<div style="padding:6px 8px;border-radius:6px;background:rgba(155,89,182,.12);border-right:2px solid #9b59b6;margin-bottom:6px;font-size:10px;color:#9b59b6;font-weight:700">בשל חשד TBI — נדרש מעקב אישונים (הרחבה/היצרות, תגובה לאור) + GCS סדרתי כל 15ד׳</div>';
  }
  h+='<div style="display:flex;gap:16px;justify-content:center;margin:6px 0;padding:8px;border-radius:8px;background:rgba(155,89,182,.06);border:1px solid rgba(155,89,182,.2)">';
  ['left','right'].forEach(side=>{
    const p=d.pupils[side];const label=side==='left'?'שמאל':'ימין';
    h+=`<div style="text-align:center"><div style="font-size:10px;color:var(--t3);margin-bottom:4px">${label}</div>`;
    h+=`<div style="width:40px;height:40px;border-radius:50%;border:2px solid #9b59b6;display:flex;align-items:center;justify-content:center;margin:0 auto"><div style="width:${(p.size||3)*3}px;height:${(p.size||3)*3}px;border-radius:50%;background:${p.reactive?'#9b59b6':'#555'}"></div></div>`;
    h+=`<div style="font-size:9px;color:var(--t3);margin-top:3px">${(p.size==null&&p.reactive==null)?'לא נבדק':p.size+'mm '+(p.reactive?'מגיב לאור':'קבוע')}</div>`;
    h+=`<div style="display:flex;gap:3px;margin-top:4px;justify-content:center"><button onclick="_casualtyXABCDE.d.pupils.${side}.size=Math.max(1,(_casualtyXABCDE.d.pupils.${side}.size??4)-1);MedHost.renderIncidentPage()" style="background:var(--c3);border:none;border-radius:4px;width:26px;height:26px;color:var(--t2);font-size:13px">−</button><button onclick="_casualtyXABCDE.d.pupils.${side}.size=Math.min(8,(_casualtyXABCDE.d.pupils.${side}.size??2)+1);MedHost.renderIncidentPage()" style="background:var(--c3);border:none;border-radius:4px;width:26px;height:26px;color:var(--t2);font-size:13px">+</button><button onclick="_casualtyXABCDE.d.pupils.${side}.reactive=!_casualtyXABCDE.d.pupils.${side}.reactive;addTimestampedAction('e','אישון ${label}: '+(_casualtyXABCDE.d.pupils.${side}.reactive?'מגיב':'קבוע'),'');MedHost.renderIncidentPage()" style="background:${p.reactive?'rgba(46,204,113,.15)':'rgba(231,76,60,.15)'};border:none;border-radius:4px;padding:3px 6px;font-size:9px;color:${p.reactive?'var(--gr)':'var(--re)'};font-family:var(--f)">${p.reactive?'מגיב':'קבוע'}</button></div></div>`;
  });
  h+='</div>';
  if(d.gcs)h+=`<div style="text-align:center;font-size:13px;font-weight:900;color:#9b59b6;margin:6px 0">GCS: ${d.gcs}/15</div>`;
  h+=`<div style="font-size:9px;color:var(--t3);text-align:center;margin-bottom:8px">GCS מפורט זמין בסקר המשני</div>`;
  // Tier 29: Pelvic binder (moved from X to E per IDF 2026 — Exposure/secondary)
  const pelvicSuspect=_casualtyInjuries.some(i=>i.region==='pelvis');
  const pelvicHighlight=pelvicSuspect&&!e.pelvicBinder;
  h+='<div style="font-size:11px;font-weight:700;color:#9b59b6;margin-bottom:4px">מקבע אגן</div>';
  if(e.pelvicBinder){
    h+=`<div class="xabcde-entry" style="align-items:center;background:rgba(155,89,182,.1)"><span class="time">${fmtTime(e.pelvicBinder.time)}</span><span style="flex:1">מקבע אגן — ${escapeHtml(e.pelvicBinder.site||'')}</span><button aria-label="מחק" onclick="clearPelvicBinder()" style="background:none;border:none;color:var(--re);font-size:13px;cursor:pointer;font-family:var(--f);padding:4px 6px;min-height:32px;min-width:32px">🗑</button></div>`;
  } else {
    h+=`<button class="xabcde-btn" style="width:100%;border-color:${pelvicHighlight?'var(--re)':'#9b59b6'};color:${pelvicHighlight?'var(--re)':'#9b59b6'};background:${pelvicHighlight?'rgba(231,76,60,.12)':'none'};font-weight:${pelvicHighlight?'800':'600'};margin-bottom:4px" onclick="addPelvicBinder()">+ הנח מקבע אגן (greater trochanter)</button>`;
    if(pelvicHighlight){h+=`<div style="font-size:9px;color:var(--re);font-weight:600;text-align:center;margin-bottom:6px">סומנה פציעה באגן — חשד שבר</div>`;}
  }
  // Tier 29: Quick antibiotic buttons in E (per IDF 2026 schema — abx in Exposure)
  const medsList=_casualtyXABCDE?.e?.medications||[];
  const gotCtx=medsList.some(m=>_mn(m)==='צפטריאקסון');
  const gotMet=medsList.some(m=>_mn(m)==='מטרונידזול');
  h+='<div style="font-size:11px;font-weight:700;color:#1abc9c;margin-bottom:4px">🛡 אנטיביוטיקה (חדירה בבטן/ראש + פינוי >1ש׳)</div>';
  h+='<div style="display:flex;gap:4px;margin-bottom:8px">';
  h+=`<button class="xabcde-btn" style="flex:1;font-size:10px;${gotCtx?'background:rgba(46,204,113,.15);border-color:var(--gr);color:var(--gr)':'border-color:#1abc9c;color:#1abc9c'}" onclick="addMedication('צפטריאקסון','2g','IV');MedHost.toast('צפטריאקסון 2g IV תועד',false)">${gotCtx?'✓ ':'+ '}Ceftriaxone 2g</button>`;
  h+=`<button class="xabcde-btn" style="flex:1;font-size:10px;${gotMet?'background:rgba(46,204,113,.15);border-color:var(--gr);color:var(--gr)':'border-color:#1abc9c;color:#1abc9c'}" onclick="addMedication('מטרונידזול','500mg','IV');MedHost.toast('מטרונידזול 500mg IV תועד',false)">${gotMet?'✓ ':'+ '}Metronidazole 500mg</button>`;
  h+='</div>';
  // Hypothermia
  const lastTemp=_casualtyVitals.length?_casualtyVitals[_casualtyVitals.length-1]?.temp:null;
  const hypoAlert=lastTemp!=null&&lastTemp<36;
  h+='<div style="font-size:11px;font-weight:700;color:#2ecc71;margin-bottom:4px">מניעת היפותרמיה</div>';
  if(hypoAlert&&!e.hypothermiaPrevention){
    h+=`<div style="padding:6px 8px;border-radius:6px;background:rgba(52,152,219,.12);border-right:2px solid #3498db;margin-bottom:6px;font-size:10px;color:#3498db;font-weight:700">נמדדה טמפ׳ ${lastTemp}°C — היפותרמיה. בחר שיטת חימום</div>`;
  }
  if(tbiActive&&!e.hypothermiaPrevention){
    h+=`<div style="padding:6px 8px;border-radius:6px;background:rgba(155,89,182,.08);border-right:2px solid #9b59b6;margin-bottom:6px;font-size:10px;color:#9b59b6;font-weight:700">TBI — מניעת היפותרמיה חובה</div>`;
  }
  h+='<div style="display:flex;gap:4px;margin-bottom:8px">';
  ['שמיכת מרחב','שמיכת צמר','חימום פעיל','ללא'].forEach(b=>{
    const on=e.hypothermiaPrevention===b;
    h+=`<button class="xabcde-btn" style="flex:1;font-size:10px;${on?'background:rgba(46,204,113,.2);border-color:var(--gr);color:var(--gr)':''}" onclick="_casualtyXABCDE.e.hypothermiaPrevention='${b}';addTimestampedAction('e','${b}','');MedHost.renderIncidentPage()">${b}</button>`;
  });
  h+='</div>';
  // Patient weight — drives the CC dose calculator. Quick presets +
  // manual entry. Weight is required for mg/kg paediatric/bariatric
  // doses but optional for the standard protocol flow.
  h+='<div style="font-size:11px;font-weight:700;color:#2ecc71;margin-bottom:4px">משקל משוער (ק"ג) — למחשבון מינון</div>';
  h+='<div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap">';
  [50,60,70,80,90,100,110].forEach(w=>{
    const on=_getPatientWeight()===w;
    h+=`<button onclick="_setPatientWeight(${w})" class="xabcde-btn" style="flex:1;min-width:48px;min-height:40px;font-size:11px;${on?'background:rgba(46,204,113,.2);border-color:var(--gr);color:var(--gr)':''}">${w}</button>`;
  });
  h+=`<button onclick="const v=prompt('הזן משקל בק״ג','${_getPatientWeight()||''}');const n=parseInt(v);if(n&&n>0&&n<250)_setPatientWeight(n);" class="xabcde-btn" style="flex:1;min-width:56px;min-height:40px;font-size:11px">⌨ ידני</button>`;
  h+='</div>';
  // Tier 28: Age (pediatric mode if ≤12)
  const curAge=_casualtyXABCDE?.e?.ageYears||null;
  h+='<div style="font-size:11px;font-weight:700;color:#3498db;margin:6px 0 4px 0">גיל (שנים) — לזיהוי ילד/תינוק</div>';
  h+='<div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap">';
  [1,3,5,8,10,12,18,30,50].forEach(a=>{
    const on=curAge===a;
    h+=`<button onclick="_setPatientAge(${a})" class="xabcde-btn" style="flex:1;min-width:42px;min-height:38px;font-size:11px;${on?'background:rgba(52,152,219,.2);border-color:#3498db;color:#3498db':''}">${a}</button>`;
  });
  h+=`<button onclick="const v=prompt('גיל בשנים','${curAge||''}');const n=parseInt(v);if(n>=0&&n<120)_setPatientAge(n);" class="xabcde-btn" style="flex:1;min-width:56px;min-height:38px;font-size:11px">⌨ ידני</button>`;
  h+='</div>';
  if(curAge!=null&&curAge<=12){
    const broWeight=_broselowWeight(curAge);
    h+=`<div style="padding:8px 10px;border-radius:8px;background:rgba(52,152,219,.1);border:1px solid rgba(52,152,219,.3);margin-bottom:8px;font-size:11px;color:var(--bl);font-weight:700">🧒 מצב פדיאטרי — משקל מוערך ${broWeight}ק״ג. מינונים מוצגים לפי משקל. cric אסור!</div>`;
  }
  // Pain Scale (0-10)
  // Tier 29: Handoff fields (MIST+ extras)
  h+='<div style="font-size:11px;font-weight:700;color:#9b59b6;margin:8px 0 4px 0">פרטי העברה (Handoff)</div>';
  const eX=_casualtyXABCDE.e;
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">';
  h+=`<div><div style="font-size:9px;color:var(--t3)">אלרגיות</div><input class="fi" value="${escapeHtml(String(eX.allergies||''))}" oninput="_casualtyXABCDE.e.allergies=this.value;MedHost.triggerAutoSave()" placeholder="לא ידוע" style="font-size:11px;padding:6px;min-height:34px"></div>`;
  h+=`<div><div style="font-size:9px;color:var(--t3)">סיבוכים/שינויים</div><input class="fi" value="${escapeHtml(String(eX.complications||''))}" oninput="_casualtyXABCDE.e.complications=this.value;MedHost.triggerAutoSave()" placeholder="אין" style="font-size:11px;padding:6px;min-height:34px"></div>`;
  h+=`<div><div style="font-size:9px;color:var(--t3)">יעד פינוי</div><input class="fi" value="${escapeHtml(String(eX.evacPlan||''))}" oninput="_casualtyXABCDE.e.evacPlan=this.value;MedHost.triggerAutoSave()" placeholder="בי״ח/קוד" style="font-size:11px;padding:6px;min-height:34px"></div>`;
  h+=`<div><div style="font-size:9px;color:var(--t3)">חתום ע״י</div><input class="fi" value="${escapeHtml(String(eX.handoffFrom||''))}" oninput="_casualtyXABCDE.e.handoffFrom=this.value;MedHost.triggerAutoSave()" placeholder="שם/תפקיד" style="font-size:11px;padding:6px;min-height:34px"></div>`;
  h+='</div>';
  h+='<div style="font-size:11px;font-weight:700;color:#2ecc71;margin-bottom:4px">סולם כאב (0-10)</div>';
  h+='<div style="display:flex;gap:3px;margin-bottom:4px;justify-content:center;flex-wrap:wrap">';
  for(let p=0;p<=10;p++){
    const on=_casualtyPainScore===p;
    const col=p<=3?'#2ecc71':p<=6?'#f1c40f':'#e74c3c';
    h+=`<button onclick="_setPainScore(${on?'null':p})" style="width:32px;height:40px;border-radius:6px;border:1.5px solid ${on?col:'var(--sep)'};background:${on?col+'30':'none'};color:${on?col:'var(--t3)'};font-size:13px;font-weight:800;cursor:pointer;font-family:var(--f)">${p}</button>`;
  }
  h+='</div>';
  // Pain Management Protocol mini-flow — IDF Trauma Book Figure 1.
  // Triggers only when a pain score has been set.
  if(_casualtyPainScore!==null){
    h+=renderPainProtocolFlow();
  }
  // Medications
  h+='<div style="font-size:10px;font-weight:700;color:#2ecc71;margin-bottom:4px">תרופות</div>';
  if(_medPickerOpen&&_medSelected!==null){
    const med=MED_PRESETS[_medSelected];
    h+=`<div style="background:rgba(46,204,113,.08);border:1px solid rgba(46,204,113,.2);border-radius:10px;padding:8px;margin-bottom:6px">`;
    h+=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><div style="font-size:11px;font-weight:700;color:var(--gr);flex:1">${med.name}</div>`;
    if(med.prep)h+=`<button onclick="openMedPrep(${_medSelected})" style="padding:5px 10px;border-radius:6px;border:1px solid var(--bl);background:rgba(52,152,219,.12);color:var(--bl);font-size:10px;font-weight:700;cursor:pointer;font-family:var(--f);min-height:32px">📋 איך מכינים</button>`;
    h+=`</div>`;
    // v3.33: inline warnings + dose limits + redose timer
    const warnings=_medWarningsFor(med.name);
    if(warnings.length){
      h+=`<div style="margin-bottom:6px">`;
      warnings.forEach(w=>{
        const bg=w.lvl==='🔴'?'rgba(231,76,60,.15)':w.lvl==='⚠️'?'rgba(230,126,34,.15)':w.lvl==='⏱'?'rgba(52,152,219,.12)':'rgba(155,89,182,.1)';
        const bc=w.lvl==='🔴'?'var(--re-hi)':w.lvl==='⚠️'?'#e67e22':w.lvl==='⏱'?'var(--bl)':'#9b59b6';
        h+=`<div style="background:${bg};border:1px solid ${bc};border-inline-start:3px solid ${bc};border-radius:6px;padding:6px 8px;margin-bottom:3px;font-size:11px;color:var(--tx);line-height:1.4">${w.lvl} ${escapeHtml(w.t)}</div>`;
      });
      h+=`</div>`;
    }
    h+='<div style="display:flex;gap:4px;flex-wrap:wrap">';
    medDoseRoutePairs(med).forEach(({dose,route})=>{
      const cc=_formatCcForDose(med.name,dose,route);
      h+=`<button class="xabcde-btn" style="padding:8px 10px;font-size:11px;border-color:var(--gr);color:var(--gr);min-height:40px" onclick="addMedication('${med.name}','${dose}','${route}');_medPickerOpen=false;_medSelected=null;MedHost.renderIncidentPage()">${dose} ${route}${cc}</button>`;
    });
    h+='</div><button onclick="_medPickerOpen=false;_medSelected=null;MedHost.renderIncidentPage()" style="background:none;border:none;color:var(--t4);font-size:10px;cursor:pointer;font-family:var(--f);margin-top:4px">ביטול</button></div>';
  } else {
    h+='<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">';
    MED_PRESETS.forEach((m,i)=>{h+=`<button class="xabcde-btn" style="flex:0 0 auto;padding:6px 10px;font-size:9px" onclick="_medPickerOpen=true;_medSelected=${i};MedHost.renderIncidentPage()">${m.name}</button>`;});
    h+='</div>';
  }
  // Medication list — every row is editable & deletable so a mistap
  // doesn't poison the controlled-substance log.
  if(e.medications.length){
    h+=e.medications.map((m,i)=>`<div class="xabcde-entry" style="align-items:center"><span class="time">${fmtTime(m.time)}</span><span style="flex:1">💊 ${escapeHtml(m.drug||'')} ${escapeHtml(String(m.dose||''))} ${escapeHtml(m.route||'')}</span><button aria-label="ערוך תרופה" onclick="editMedication(${i})" style="background:none;border:none;color:var(--bl);font-size:13px;cursor:pointer;font-family:var(--f);padding:4px 6px;min-height:32px;min-width:32px">✏️</button><button aria-label="מחק תרופה" onclick="deleteMedication(${i})" style="background:none;border:none;color:var(--re);font-size:13px;cursor:pointer;font-family:var(--f);padding:4px 6px;min-height:32px;min-width:32px">🗑</button></div>`).join('');
    // Running totals
    const totals={};e.medications.forEach(m=>{totals[m.drug]=(totals[m.drug]||0)+(parseFloat(m.dose)||0);});
    h+=`<div style="font-size:11px;color:var(--gr);margin-top:6px;font-weight:700">סה"כ: ${escapeHtml(Object.entries(totals).map(([k,v])=>k+' '+v).join(' | '))}</div>`;
  }
  // Case story — free-form narrative box. Separate from notes so the
  // handoff radio format can pull it cleanly.
  h+='<div style="font-size:11px;font-weight:700;color:#2ecc71;margin:10px 0 4px">📖 סיפור מקרה</div>';
  h+=`<textarea class="fi" id="cas-story" placeholder="תיאור אירוע חופשי (מנגנון, כוחות מעורבים, טיפול קודם...)" oninput="_casualtyXABCDE.e.caseStory=this.value" style="width:100%;font-size:12px;padding:10px;min-height:60px;resize:vertical;margin-bottom:8px">${escapeHtml(e.caseStory||'')}</textarea>`;
  // Notes + Speech-to-Text
  h+='<div style="font-size:11px;font-weight:700;color:#2ecc71;margin:8px 0 4px">📝 הערות</div>';
  h+='<div style="display:flex;gap:4px;margin-bottom:4px">';
  h+=`<textarea class="fi" id="cas-notes" placeholder="הערות חופשיות..." oninput="_casualtyXABCDE.e.notes=this.value" style="flex:1;font-size:12px;padding:8px;min-height:48px;resize:vertical">${escapeHtml(e.notes||'')}</textarea>`;
  h+=`<button onclick="startSpeechNote()" style="width:48px;min-height:48px;border-radius:10px;border:1.5px solid ${_speechActive?'var(--re)':'var(--sep)'};background:${_speechActive?'rgba(231,76,60,.15)':'none'};color:${_speechActive?'var(--re)':'var(--t3)'};cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;${_speechActive?'animation:pulse 1s infinite':''}">🎤</button>`;
  h+='</div>';
  return h;
}
// CC calculator helper: "25mg IV" at 10mg/mL = 2.5 mL. Used in the
// per-dose medication picker so the medic sees the volume, not just
// the mg, when the weight+concentration combo is available.
// v3.33: pre-administration warnings + dose limits + redose windows
function _medWarningsFor(medName){
  const out=[];
  const meds=_casualtyXABCDE?.e?.medications||[];
  const vitals=_casualtyVitals[_casualtyVitals.length-1]||{};
  const sys=vitals.bpSys||parseInt(_casualtyVitalsInput?.bpSys)||null;
  const hr=vitals.pulse||parseInt(_casualtyVitalsInput?.pulse)||null;
  const now=Date.now();
  // Shock check (used multiple places)
  const inShock=(sys&&sys<90)||(hr&&hr>130);
  // Per-med rules
  if(medName==='מורפין'){
    if(inShock)out.push({lvl:'⚠️',t:'הלם (SBP<90 או HR>130) — הפחת מנה ל-2 mg או הימנע'});
    const last=meds.filter(m=>m.drug==='מורפין').slice(-1)[0];
    if(last){
      const mins=(now-new Date(last.time).getTime())/60000;
      if(mins<15)out.push({lvl:'⏱',t:`מורפין קודם לפני ${Math.floor(mins)} דק׳ — חלון חזרה 15 דק׳ (${Math.ceil(15-mins)} דק׳ נותרו)`});
    }
    const totalMg=meds.filter(m=>m.drug==='מורפין').reduce((s,m)=>s+(parseFloat(m.dose)||0),0);
    if(totalMg>=25)out.push({lvl:'⚠️',t:`סה"כ מורפין: ${totalMg}mg ב-24ש׳ — קרוב למקסימום 30mg`});
    if(totalMg>=30)out.push({lvl:'🔴',t:`חריגה: ${totalMg}mg מורפין ב-24ש׳ (מקס 30mg) — נדרש אישור רופא`});
  }
  if(medName==='קטמין'){
    const last=meds.filter(m=>m.drug==='קטמין').slice(-1)[0];
    if(last){
      const mins=(now-new Date(last.time).getTime())/60000;
      const win=(last.route==='IV'||last.route==='IO')?20:30;
      if(mins<win)out.push({lvl:'⏱',t:`קטמין קודם לפני ${Math.floor(mins)} דק׳ — חלון חזרה ${win} דק׳`});
    }
    // Caution in uncontrolled HTN (note field heuristic)
    if(sys&&sys>180)out.push({lvl:'⚠️',t:`ל"ד גבוה מאוד (${sys}) — קטמין מעלה ל"ד, שקול זהירות`});
  }
  if(medName==='דורמיקום'){
    const last=meds.filter(m=>m.drug==='דורמיקום').slice(-1)[0];
    if(last){
      const mins=(now-new Date(last.time).getTime())/60000;
      if(mins<15)out.push({lvl:'⏱',t:`דורמיקום קודם לפני ${Math.floor(mins)} דק׳ — חלון חזרה 15 דק׳`});
    }
    if(inShock)out.push({lvl:'⚠️',t:'הלם — חצה מנה (ל"ד יורד)'});
  }
  if(medName==='פנטניל'){
    if(inShock||(vitals.spo2&&vitals.spo2<90)||(vitals.rr&&vitals.rr>=28))out.push({lvl:'🔴',t:'הלם / מצוקה נשימתית — העדף קטמין'});
    const last=meds.filter(m=>m.drug==='פנטניל').slice(-1)[0];
    if(last){
      const mins=(now-new Date(last.time).getTime())/60000;
      if(mins<15)out.push({lvl:'⏱',t:`פנטניל קודם לפני ${Math.floor(mins)} דק׳ — חלון 15 דק׳`});
    }
  }
  if(medName==='Actiq OTFC'){
    const actiqCount=meds.filter(m=>m.drug==='Actiq OTFC').length;
    if(actiqCount>=2)out.push({lvl:'🔴',t:'מקסימום 2 לוזנג׳ים לפצוע — המשך ב-IV בלבד'});
  }
  if(medName==='TXA'){
    const gotTXA=meds.some(m=>m.name==='TXA'||m.drug==='TXA');
    if(gotTXA)out.push({lvl:'🔴',t:'TXA כבר ניתן — מנה אחת בלבד בנקודת הפציעה'});
    const firstInj=_casualtyTimeline.find(t=>t.category==='injury');
    if(firstInj){
      const mins=(now-new Date(firstInj.time).getTime())/60000;
      if(mins>180)out.push({lvl:'🔴',t:'חלון TXA סגור (>3 שעות מהפציעה) — אין יתרון'});
    }
    const hasBlood=(_casualtyXABCDE?.c?.fluids||[]).some(f=>['דם מלא','פלזמה/FFP','כדוריות'].includes(f.type));
    if(hasBlood)out.push({lvl:'⚠️',t:'דם/פלסמה בקו IV — חובה שטיפה 10cc NS בין TXA לדם'});
  }
  if(medName==='צפטריאקסון'){
    const hasLR=(_casualtyXABCDE?.c?.fluids||[]).some(f=>['הרטמן','Ringer','Ringer Lactate'].includes(f.type));
    if(hasLR)out.push({lvl:'🔴',t:'הרטמן בקו IV — לעולם לא לערבב עם צפטריאקסון (משקע)! שטוף קו לפני מתן'});
    if(inShock)out.push({lvl:'⚠️',t:'הלם — IV עדיף על IM (ספיגה ירודה)'});
  }
  if(medName==='אופטלגין'){
    if(inShock||(sys&&sys<100))out.push({lvl:'🔴',t:'הלם / SBP מתחת ל-100 — אופטלגין IV אסור (ירידת ל"ד)'});
    if(_casualtyInjuries.some(i=>i.type==='penetrating'&&['abdomen_r','abdomen_l','lower_back_r','lower_back_l'].includes(i.region)))out.push({lvl:'⚠️',t:'בטן חודרת / צום — אל תיתן PO'});
    const total=meds.filter(m=>m.drug==='אופטלגין').reduce((s,m)=>s+(parseFloat(m.dose)||0),0);
    if(total>=3500)out.push({lvl:'⚠️',t:`סה"כ אופטלגין: ${total}mg — קרוב למקסימום 4000mg`});
    if(total>=4000)out.push({lvl:'🔴',t:`חריגה: ${total}mg ב-24ש׳ (מקס 4g)`});
  }
  if(medName==='אקמול'||medName==='פרצטמול'){
    const total=meds.filter(m=>m.drug==='אקמול'||m.drug==='פרצטמול').reduce((s,m)=>s+(parseFloat(m.dose)||0),0);
    if(total>=3500)out.push({lvl:'⚠️',t:`סה"כ פרצטמול: ${total}mg — קרוב למקסימום 4000mg`});
    if(total>=4000)out.push({lvl:'🔴',t:`חריגה: ${total}mg ב-24ש׳ (מקס 4g)`});
  }
  if(medName==='מטרונידזול'){
    const last=meds.filter(m=>m.drug==='מטרונידזול').slice(-1)[0];
    if(last){
      const mins=(now-new Date(last.time).getTime())/60000;
      if(mins<8*60)out.push({lvl:'⏱',t:`מטרונידזול קודם לפני ${Math.floor(mins/60)}ש׳ ${Math.floor(mins%60)}ד׳ — חלון 8 שעות`});
    }
  }
  if(medName==='אטרופין'){
    // Glaucoma + GI obstruction caution — heuristic, surface as general caution
    out.push({lvl:'ℹ️',t:'זהירות: גלאוקומה צרת זווית / חסימה במעיים / אצירת שתן'});
  }
  return out;
}
function _formatCcForDose(drugName,dose,route){
  const preset=MED_PRESETS.find(m=>m.name===drugName);
  if(!preset?.concMg)return '';
  const mg=parseFloat(String(dose).replace(/[^\d.]/g,''))||0;
  const conc=preset.concMg[route];
  if(!conc||!mg)return '';
  const mL=(mg/conc).toFixed(mg/conc<1?2:1);
  return route==='IN'?` (${mL}mL · חצי בכל נחיר)`:` (${mL}mL)`;
}
var _speechActive=(typeof _speechActive!=='undefined')?_speechActive:false;
var _speechRecognition=(typeof _speechRecognition!=='undefined')?_speechRecognition:null;
function startSpeechNote(){
  if(_speechActive&&_speechRecognition){_speechRecognition.stop();_speechActive=false;MedHost.renderIncidentPage();return;}
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){MedHost.toast('דיבור לטקסט לא נתמך בדפדפן זה',false);return;}
  _speechRecognition=new SR();_speechRecognition.lang='he-IL';_speechRecognition.continuous=true;_speechRecognition.interimResults=false;
  _speechRecognition.onresult=(ev)=>{
    const text=Array.from(ev.results).map(r=>r[0].transcript).join(' ');
    const el=document.getElementById('e-notes-ta');
    if(el){el.value=(el.value?el.value+' ':'')+text;_casualtyXABCDE.e.notes=el.value;}
    addTimestampedAction('e','הערה קולית: '+text,'');
  };
  _speechRecognition.onerror=()=>{_speechActive=false;MedHost.renderIncidentPage();};
  _speechRecognition.onend=()=>{_speechActive=false;MedHost.renderIncidentPage();};
  _speechRecognition.start();_speechActive=true;
  if(navigator.vibrate)navigator.vibrate(15);
  MedHost.renderIncidentPage();
}
// showRadioReadout + copyRadioReadout + closeRadioReadout moved to shared/medical-forms.js
// meds+vitals+timer+CRT moved to shared/medical-forms.js

// TRIAGE_STEPS + TRIAGE_COLORS moved to shared/medical-forms.js

function startTriageWizard(){_triageMode=true;_triageWizardStep=0;MedHost.renderIncidentPage();}

function renderTriageWizard(){
  const step=TRIAGE_STEPS[_triageWizardStep];if(!step)return'';
  let h=`<div style="padding:20px 0;text-align:center">`;
  h+=`<div style="font-size:10px;color:var(--t4);margin-bottom:16px">שלב ${_triageWizardStep+1} מתוך ${TRIAGE_STEPS.length} — טריאז' START</div>`;
  h+=`<div style="font-size:20px;font-weight:900;color:var(--tx);line-height:1.4;margin-bottom:24px">${step.q}</div>`;
  h+=`<div style="display:flex;gap:12px;justify-content:center">`;
  h+=`<button onclick="triageAnswer(true)" style="flex:1;max-width:140px;min-height:64px;border-radius:16px;border:2px solid #2ecc71;background:rgba(46,204,113,.12);color:#2ecc71;font-size:20px;font-weight:900;cursor:pointer;font-family:var(--f)">כן</button>`;
  h+=`<button onclick="triageAnswer(false)" style="flex:1;max-width:140px;min-height:64px;border-radius:16px;border:2px solid #e74c3c;background:rgba(231,76,60,.12);color:#e74c3c;font-size:20px;font-weight:900;cursor:pointer;font-family:var(--f)">לא</button>`;
  h+=`</div>`;
  if(_triageWizardStep>0)h+=`<button onclick="_triageWizardStep--;MedHost.renderIncidentPage()" style="background:none;border:none;color:var(--t3);font-size:11px;cursor:pointer;font-family:var(--f);margin-top:16px">← חזור</button>`;
  h+=`<button onclick="_triageMode=false;MedHost.renderIncidentPage()" style="background:none;border:none;color:var(--t4);font-size:10px;cursor:pointer;font-family:var(--f);margin-top:8px;display:block;margin-left:auto;margin-right:auto">ביטול</button>`;
  h+=`</div>`;
  return h;
}

function triageAnswer(yes){
  const step=TRIAGE_STEPS[_triageWizardStep];
  const result=yes?step.yes:step.no;
  if(result.color){
    _casualtyTriageColor=result.color;_triageMode=false;
    addTimestampedAction('triage','טריאז\': '+result.label,'START');
    if(navigator.vibrate)navigator.vibrate(40);
    MedHost.renderIncidentPage();
  } else if(result.next!==undefined){
    _triageWizardStep=result.next;MedHost.renderIncidentPage();
  }
}

function renderTriageBar(){
  if(!_casualtyTriageColor)return`<button onclick="startTriageWizard()" style="width:100%;padding:12px;border-radius:12px;border:2px dashed var(--sep);background:none;color:var(--t3);font-size:12px;font-weight:700;cursor:pointer;font-family:var(--f);margin-bottom:8px;min-height:48px">🏷 הפעל טריאז' START</button>`;
  const labels={red:'🔴 דחוף — IMMEDIATE',yellow:'🟡 עדיפות שנייה — DELAYED',green:'🟢 לא דחוף — MINIMAL',gray:'🔘 ממתין — EXPECTANT',black:'⬛ ללא סימני חיים — NO SIGNS OF LIFE'};
  const txtColor=_casualtyTriageColor==='yellow'?'#000':'#fff';
  return`<div style="width:100%;padding:14px;border-radius:12px;background:${TRIAGE_COLORS[_casualtyTriageColor]};color:${txtColor};font-size:14px;font-weight:900;text-align:center;margin-bottom:8px;letter-spacing:.5px">${labels[_casualtyTriageColor]}<button onclick="startTriageWizard()" style="display:block;margin:4px auto 0;background:${txtColor}30;border:none;border-radius:6px;color:${txtColor};font-size:9px;padding:3px 10px;cursor:pointer;font-family:var(--f)">שנה טריאז'</button></div>`;
}


// ── renderCasualtyForm + EXTRA FIELDS (stage 3.7) ──

// ── [renderCasualtyForm] from beta lines 8569-8910 ──
function renderCasualtyForm(){
  if(_triageMode)return renderTriageWizard();
  ensureCasualtyTimers();
  // v3.41: defensive — normalize _casualtyActiveTab if stuck at invalid value (prevents E toggle edge case)
  const _validTabs=['x','a','b','c','d','e','secondary','timeline',null];
  if(!_validTabs.includes(_casualtyActiveTab))_casualtyActiveTab=null;
  let h='';
  // Sticky CDS alert mount — red alerts persist here until the medic
  // acknowledges, instead of flashing as a 2.8s shared toast.
  h+='<div id="cds-alert-mount" style="margin-bottom:6px"></div>';
  // Tier 29: Critical timers (golden hour, TQ, sedation)
  h+=renderCriticalTimers();
  // Tier 28: Clinical Context Engine — top-of-form priority card
  h+=renderClinicalPriorities();
  // Undo/Redo toolbar — visible affordance because a medic with gloves
  // cannot hit Ctrl-Z on a phone. Disabled state when stack empty.
  const undoDisabled=!_medUndoStack.length;
  const redoDisabled=!_medRedoStack.length;
  h+=`<div style="display:flex;gap:6px;margin-bottom:6px">`;
  h+=`<button onclick="medUndo()" aria-label="בטל פעולה אחרונה" ${undoDisabled?'disabled':''} style="flex:1;padding:8px;border-radius:8px;border:1px solid var(--sep);background:${undoDisabled?'none':'var(--c2)'};color:${undoDisabled?'var(--t4)':'var(--t2)'};font-size:12px;font-weight:700;cursor:${undoDisabled?'not-allowed':'pointer'};font-family:var(--f);min-height:36px">↶ בטל</button>`;
  h+=`<button onclick="medRedo()" aria-label="חזור על פעולה" ${redoDisabled?'disabled':''} style="flex:1;padding:8px;border-radius:8px;border:1px solid var(--sep);background:${redoDisabled?'none':'var(--c2)'};color:${redoDisabled?'var(--t4)':'var(--t2)'};font-size:12px;font-weight:700;cursor:${redoDisabled?'not-allowed':'pointer'};font-family:var(--f);min-height:36px">↷ חזור</button>`;
  h+=`</div>`;
  // Triage removed from form (v3.11) — assign via MCI rapid-triage flow only
  // v3.29 M4: medication prep drawer overlay (renders on top if open)
  h+=renderMedPrepSheet();
  // v3.43: pediatric mode banner (auto on age≤12 + manual override toggle)
  const _pedsOn=isPedsMode();
  const _pedsAuto=_pedsOn && _casualtyPedsOverride===null;
  if(_pedsOn||_casualtyPedsOverride===false){
    const bg=_pedsOn?'rgba(52,152,219,.14)':'rgba(155,89,182,.08)';
    const col=_pedsOn?'var(--bl)':'#9b59b6';
    const msg=_pedsOn?(_pedsAuto?'🧒 מצב פדיאטרי פעיל (אוטו׳ לפי גיל ≤12) — משקל, מנות, ערכי סף מותאמים. cric אסור!':'🧒 מצב פדיאטרי הופעל ידנית'):'⚙ מצב פדיאטרי בוטל ידנית (גיל ≤12)';
    h+=`<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;margin-bottom:6px;background:${bg};border:1px solid ${col}33;border-radius:8px;font-size:11px;color:${col};font-weight:700"><span style="flex:1">${msg}</span><button onclick="togglePedsOverride()" style="padding:4px 10px;border-radius:6px;border:1px solid ${col};background:transparent;color:${col};font-family:var(--f);font-size:10px;font-weight:700;cursor:pointer;min-height:30px">${_pedsOn?'בטל':'הפעל'}</button></div>`;
  } else if(!_pedsOn && _casualtyPedsOverride===null && !(_casualtyXABCDE?.e?.ageYears>=18)){
    h+=`<button onclick="togglePedsOverride()" style="display:block;margin:0 0 6px auto;padding:4px 10px;border-radius:6px;border:1px dashed var(--sep);background:transparent;color:var(--t4);font-family:var(--f);font-size:10px;cursor:pointer;min-height:28px">🧒 הפעל מצב פדיאטרי ידנית</button>`;
  }
  // Sticky TQ timer banner — v3.46: long-press opens context menu
  if(_casualtyXABCDE.x.tourniquets.length>0){
    h+='<div style="background:rgba(231,76,60,.12);border:1.5px solid rgba(231,76,60,.3);border-radius:10px;padding:8px 12px;margin-bottom:8px">';
    _casualtyXABCDE.x.tourniquets.forEach((tq,i)=>{
      const e=getTqElapsed(tq.time);
      const isAlert=e.alert;
      h+=`<div onmousedown="_tqPressStart(${i})" onmouseup="_tqPressEnd()" onmouseleave="_tqPressEnd()" ontouchstart="_tqPressStart(${i})" ontouchend="_tqPressEnd()" oncontextmenu="event.preventDefault();_tqMenuIdx=${i};MedHost.renderIncidentPage()" style="display:flex;align-items:center;gap:8px;${_casualtyXABCDE.x.tourniquets.length>1?'margin-bottom:4px':''};user-select:none;cursor:pointer" title="לחיצה ארוכה — אפשרויות">`;
      h+=`<span style="font-size:11px;font-weight:700;color:var(--re)">🔴 ח"ע ${escapeHtml(BODY_LABELS[tq.site]||tq.site)}</span>`;
      h+=`<span style="font-family:monospace;font-size:14px;font-weight:900;color:${isAlert?'#fff':'var(--re)'};${isAlert?'background:#e74c3c;padding:2px 8px;border-radius:6px;animation:pulse 1s infinite':''}"> ${e.str}</span>`;
      if(isAlert)h+=`<button onclick="event.stopPropagation();reevalTourniquet(${i})" style="padding:3px 8px;border-radius:6px;border:1px solid #fff;background:rgba(255,255,255,.2);color:#fff;font-size:8px;font-weight:700;cursor:pointer;font-family:var(--f)">הערכה מחדש</button>`;
      h+=`<span style="font-size:9px;color:var(--t4);margin-inline-start:auto;opacity:.6">⋯ ארוך</span>`;
      h+=`</div>`;
    });
    h+='</div>';
    h+=renderTqLongPressMenu();
  }
  h+=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">`;
  h+=`<div style="font-size:15px;font-weight:800;color:var(--tx);flex:1">${_casualtyEditId?'✏️ עריכת נפגע':'דיווח נפגע חדש'}</div>`;
  // Bracelet chip — when paired shows the serial (clickable = print),
  // when not paired shows a "צמד צמיד" CTA button.
  if(_casualtyEditId){
    const cur=_incidentCasualties.find(x=>x._docId===_casualtyEditId);
    const br=cur?.bracelet;
    if(br?.serial){
      h+=`<button onclick="openBraceletExport()" aria-label="צמיד ${escapeHtml(br.serial)}" style="background:rgba(155,89,182,.2);border:1px solid var(--pu);border-radius:8px;color:var(--pu);font-family:monospace;font-size:13px;font-weight:800;letter-spacing:1px;padding:6px 10px;cursor:pointer;min-height:36px">🔖 ${escapeHtml(br.serial)}</button>`;
    } else {
      h+=`<button onclick="openBraceletExport()" aria-label="צמד צמיד" style="background:rgba(155,89,182,.12);border:1px dashed var(--pu);border-radius:8px;color:var(--pu);font-size:12px;font-weight:700;padding:6px 10px;cursor:pointer;min-height:36px;font-family:var(--f)">🔖 צמד צמיד</button>`;
    }
  }
  h+=`</div>`;
  // Identity
  h+='<div style="display:flex;gap:6px;margin-bottom:8px">';
  h+=`<input class="fi" id="cas-name" placeholder="שם הנפגע" autocomplete="off" value="${escapeHtml(_casualtyName)}" oninput="_casualtyName=this.value;MedHost.triggerAutoSave()" style="font-size:14px;flex:2;min-height:44px">`;
  h+=`<input class="fi" id="cas-id" placeholder="מ.א / ת.ז" autocomplete="off" value="${escapeHtml(_casualtyIdNumber)}" oninput="_casualtyIdNumber=this.value;MedHost.triggerAutoSave()" style="font-size:12px;flex:1;min-height:44px">`;
  h+='</div>';
  // MOI
  h+='<div class="cas-section" style="padding:8px 10px"><div class="cas-section-title">מנגנון פציעה</div>';
  h+='<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">';
  MOI_TYPES.forEach(m=>{
    const on=_hasMOI(m.id);
    h+=`<button onclick="_toggleMOI('${m.id}')" style="padding:6px 10px;border-radius:8px;border:1.5px solid ${on?'var(--or)':'var(--sep)'};background:${on?'rgba(230,126,34,.15)':'none'};font-size:10px;cursor:pointer;font-family:var(--f);min-height:36px;color:${on?'var(--or)':'var(--t3)'}">${m.icon} ${m.label}</button>`;
  });
  h+='</div>';
  // Tier 21b: case story directly under mechanism — main narrative
  // field the medic types. Separate from xabcde.e.notes which is
  // finer-grained per-step.
  h+='<div style="font-size:11px;font-weight:700;color:var(--or);margin:8px 0 4px">📖 סיפור מקרה</div>';
  h+=`<textarea class="fi" id="cas-case-story" placeholder="מה קרה? מנגנון מפורט, כוחות מעורבים, מה נעשה עד עכשיו..." oninput="(function(v){if(!_casualtyXABCDE.e)_casualtyXABCDE.e={};_casualtyXABCDE.e.caseStory=v;MedHost.triggerAutoSave();})(this.value)" style="width:100%;font-size:13px;padding:10px;min-height:72px;resize:vertical;box-sizing:border-box">${escapeHtml(_casualtyXABCDE?.e?.caseStory||'')}</textarea>`;
  h+='</div>';
  // Front/Back toggle
  h+='<div class="seg" style="margin-bottom:6px"><button class="so'+(_casualtyView==='front'?' on':'')+'" onclick="_casualtyView=\'front\';MedHost.renderIncidentPage()">קדמי</button><button class="so'+(_casualtyView==='back'?' on':'')+'" onclick="_casualtyView=\'back\';MedHost.renderIncidentPage()">אחורי</button></div>';
  // Body map (floating tap menu is rendered INSIDE the SVG at the tap
  // point — see renderFloatingRegionMenu — so the old duplicated
  // below-map selector is gone).
  h+='<div class="bm-side" dir="ltr"><b>'+(_casualtyView==='back'?'שמאל':'ימין')+'</b><b>'+(_casualtyView==='back'?'ימין':'שמאל')+'</b></div>';
  h+='<div class="body-map-wrap">'+renderBodyMap()+'</div>';
  // v3.29 M2: vitals strip below avatar — tap any chip for history
  h+=renderVitalsStrip();
  // v3.32: unified event-timer strip (TQ + TXA window + antibiotic deadline + sedation redose)
  h+=renderEventTimerStrip();
  // Injury summary
  h+='<div class="cas-section"><div class="cas-section-title">פגיעות מסומנות</div>'+renderInjurySummary()+'</div>';
  // Treatment placement on body
  h+='<div class="cas-section"><div class="cas-section-title">טיפולים על הגוף</div>';
  h+='<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">';
  [{t:'tourniquet',l:'🔴 חסם עורקי'},{t:'pressureDressing',l:'⬜ תחבושת לחץ'},{t:'tubeThora',l:'🩻 נקז חזה'},{t:'hemostatic',l:'🟧 המוסטטי'},{t:'bandage',l:'🩹 חבישה'}].forEach(it=>{
    const on=_pendingTreatmentType===it.t;
    h+=`<button onclick="startTreatmentPlacement('${it.t}')" style="padding:5px 8px;border-radius:7px;border:1.5px solid ${on?'var(--bl)':'var(--sep)'};background:${on?'rgba(52,152,219,.15)':'none'};font-size:9px;cursor:pointer;font-family:var(--f);color:${on?'var(--bl)':'var(--t3)'}">${it.l}</button>`;
  });
  h+='</div>';
  if(_casualtyTreatments.length){
    _casualtyTreatments.forEach((t,idx)=>{
      const icon=TREATMENT_ICONS[t.type]||'💊';
      const reg=escapeHtml(BODY_LABELS[t.region]||t.region||'');
      const sideL=t.side==='front'?'קדמי':'אחורי';
      // Custom free-form treatments carry a label string.
      const custom=t.type==='custom'&&t.label?' — '+escapeHtml(String(t.label).slice(0,60)):'';
      h+=`<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid var(--sep);font-size:12px">
        <span style="font-size:14px">${icon}</span>
        <span style="flex:1;color:var(--t2)">${reg} (${sideL})${custom}</span>
        <span style="color:var(--t4);font-size:10px">${escapeHtml(String(t.time||''))}</span>
        <button onclick="removeTreatmentFromBody(${idx})" aria-label="מחק טיפול" style="background:none;border:none;color:var(--re);font-size:14px;cursor:pointer;padding:4px 8px;min-height:32px;min-width:32px">🗑</button>
      </div>`;
    });
  } else {
    h+='<div style="font-size:10px;color:var(--t4);text-align:center;padding:4px 0">בחר טיפול ולחץ על הגוף למיקום</div>';
  }
  h+='</div>';
  // SABC
  // Primary survey accordion (v3.36: renamed; guided X-CARE mode removed per user)
  h+='<div class="cas-section"><div class="cas-section-title">🔍 סקר ראשוני</div>';
  // Defensive init — old casualties may lack subfields
  if(!_casualtyXABCDE.x)_casualtyXABCDE.x={tourniquets:[],pressureDressings:[],hemostatic:[],woundPacking:[]};
  if(!_casualtyXABCDE.a)_casualtyXABCDE.a={status:'',interventions:[]};
  if(!_casualtyXABCDE.b)_casualtyXABCDE.b={respiratoryRate:null,tubeThora:null,oxygen:null};
  if(!_casualtyXABCDE.c)_casualtyXABCDE.c={pulseCharacter:'',capRefill:null,ivAccess:[],fluids:[]};
  if(!_casualtyXABCDE.d)_casualtyXABCDE.d={avpu:'',gcs:null,pupils:{left:{size:null,reactive:null},right:{size:null,reactive:null}}};
  if(!_casualtyXABCDE.e)_casualtyXABCDE.e={hypothermiaPrevention:'',medications:[],notes:''};
  if(false){
    // IDF 2026 X-CARE: X → C → A → R → E (5 steps, no D). R replaces B.
    const xcareOrder=['x','c','a','b','e'];
    window._xcareOrder=xcareOrder;
    const xcareLabels={x:'X',c:'C',a:'A',b:'R',e:'E'};
    const xcarePrompts={x:'🛑 eXtract — חלץ-טפל ועצור דימום פורץ',c:'💉 Circulation — AVPU + TXA + נוזלים/דם',a:'🫁 Airway — פתח/נהל נתיב אוויר',b:'🌬 Respiration — בדוק חזה סימטרי, נקז אם חסר',e:'👁 Exposure & Evac — GCS, היפותרמיה, אנטיב׳, פינוי'};
    h+=`<div style="display:flex;gap:2px;margin-bottom:6px">`;
    xcareOrder.forEach((key,i)=>{
      const stepData=_casualtyXABCDE[key];
      let hasData=false;
      if(key==='x')hasData=stepData.tourniquets.length>0||stepData.pressureDressings.length>0||stepData.hemostatic.length>0||stepData.woundPacking.length>0;
      else if(key==='a')hasData=!!stepData.status||stepData.interventions.length>0;
      else if(key==='b')hasData=stepData.respiratoryRate!==null||!!stepData.tubeThora;
      else if(key==='c')hasData=!!stepData.pulseCharacter||stepData.capRefill!==null||stepData.ivAccess.length>0||!!_casualtyXABCDE?.d?.avpu;
      else if(key==='e')hasData=!!stepData.hypothermiaPrevention||stepData.medications.length>0||_casualtyPainScore!==null||!!_casualtyXABCDE?.d?.gcs||!!stepData.pelvicBinder;
      const isCurrent=_xcareStep===i;
      const isDone=hasData;
      const col=isDone?'#2ecc71':isCurrent?'#e74c3c':'var(--t4)';
      h+=`<div style="flex:1;text-align:center;padding:4px 2px;border-radius:6px;border:1.5px solid ${col};background:${isCurrent?col+'15':isDone?col+'10':'none'};cursor:pointer" onclick="_xcareStep=${i};_casualtyActiveTab='${key}';MedHost.renderIncidentPage()">`;
      h+=`<div style="font-size:10px;font-weight:900;color:${col}">${xcareLabels[key]}</div>`;
      if(isDone)h+=`<div style="font-size:7px;color:${col}">✓</div>`;
      h+=`</div>`;
    });
    h+=`</div>`;
    // Current step prompt
    const curKey=xcareOrder[_xcareStep];
    h+=`<div style="padding:8px 10px;border-radius:8px;background:rgba(231,76,60,.06);border:1px solid rgba(231,76,60,.15);margin-bottom:6px;display:flex;align-items:center;gap:8px">`;
    h+=`<span style="font-size:12px;font-weight:900;color:var(--re)">${xcareLabels[curKey]}</span>`;
    h+=`<span style="font-size:10px;color:var(--t2);flex:1">${xcarePrompts[curKey]}</span>`;
    if(_xcareStep<4)h+=`<button onclick="advanceXCare()" style="padding:6px 14px;border-radius:8px;border:1px solid var(--bl);background:rgba(52,152,219,.12);color:var(--bl);font-size:11px;font-weight:700;cursor:pointer;font-family:var(--f);white-space:nowrap;min-height:32px">הבא →</button>`;
    h+=`</div>`;
  }
  // IDF 2026 X-CARE: X → C → A → R → E (D merged: AVPU into C, GCS into E)
  const xabcdeSteps=[
    {key:'x',label:'X — חילוץ + דימום',color:'#e74c3c',fullLabel:'eXtract'},
    {key:'c',label:'C — מחזור דם',color:'#e67e22',fullLabel:'Circulation'},
    {key:'a',label:'A — נתיב אוויר',color:'#3498db',fullLabel:'Airway'},
    {key:'b',label:'R — נשימה',color:'#1abc9c',fullLabel:'Respiration'},
    {key:'e',label:'E — חשיפה ופינוי',color:'#2ecc71',fullLabel:'Exposure & Evac'}
  ];
  xabcdeSteps.forEach(step=>{
    const stepData=_casualtyXABCDE[step.key];
    let hasData=false;
    if(step.key==='x')hasData=stepData.tourniquets.length>0||stepData.pressureDressings.length>0||stepData.hemostatic.length>0||stepData.woundPacking.length>0;
    else if(step.key==='a')hasData=!!stepData.status||stepData.interventions.length>0;
    else if(step.key==='b')hasData=stepData.respiratoryRate!==null||!!stepData.tubeThora||!!stepData.oxygen;
    else if(step.key==='c')hasData=!!stepData.pulseCharacter||stepData.capRefill!==null||stepData.ivAccess.length>0||stepData.fluids.length>0;
    else if(step.key==='d')hasData=!!stepData.avpu||stepData.gcs!==null;
    else if(step.key==='e')hasData=!!stepData.hypothermiaPrevention||stepData.medications.length>0;
    const isOpen=_casualtyActiveTab===step.key;
    const summary=getXABCDESummary(step.key);
    h+=`<div style="border:1.5px solid ${hasData?step.color:isOpen?step.color+'80':'var(--sep)'};border-radius:10px;margin-bottom:4px;overflow:hidden;background:${isOpen?step.color+'08':'none'}">`;
    h+=`<div onclick="const cur=_casualtyActiveTab;_casualtyActiveTab=cur==='${step.key}'?null:'${step.key}';if(window._stageHeartbeat){if(_casualtyActiveTab==='${step.key}')window._stageHeartbeat('${step.key}');else if(cur==='${step.key}'&&window._releaseStageLock){window._releaseStageLock('${step.key}');window._stageHeartbeat(null);}}MedHost.renderIncidentPage()" style="display:flex;align-items:center;gap:8px;padding:10px 12px;cursor:pointer">`;
    // Tier 30: X-CARE display letter ('b' internal = 'R' external)
    const displayLetter=step.key==='b'?'R':step.key.toUpperCase();
    h+=`<span style="font-size:14px;font-weight:900;color:${hasData||isOpen?step.color:'var(--t4)'};min-width:20px">${displayLetter}</span>`;
    h+=`<span style="font-size:11px;font-weight:600;color:${isOpen?step.color:'var(--t3)'};flex:1">${step.label}</span>`;
    if(hasData&&!isOpen)h+=`<span style="font-size:9px;color:var(--t3);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(summary)}</span>`;
    h+=`<span style="font-size:10px;color:var(--t4)">${isOpen?'▲':'▼'}</span>`;
    if(hasData)h+=`<span style="width:7px;height:7px;border-radius:50%;background:${step.color};flex-shrink:0"></span>`;
    h+=`</div>`;
    if(isOpen){
      let body='';
      try{ body=renderXABCDETab(step.key); }
      catch(err){ console.error('renderXABCDETab('+step.key+') failed:',err); body='<div style="padding:10px;color:var(--re);font-size:11px">שגיאה בטעינת שלב '+step.key.toUpperCase()+'. פתח מחדש את הטופס.</div>'; }
      const lockBanner=(typeof window._getStageLockBanner==='function')?window._getStageLockBanner(step.key):'';
      h+=`<div style="padding:0 12px 10px">${lockBanner}${body}</div>`;
    }
    h+=`</div>`;
  });
  h+='</div>';

  // ═══ SECONDARY SURVEY (C-A-R-E) — v3.34: IDF 2026 schema as 4 accordion phases with inline inputs ═══
  h+='<div class="cas-section" style="padding:8px 10px">';
  h+=renderSecondaryChecklist();
  h+='</div>';

  // Evacuation priority
  h+='<div class="cas-section"><div class="cas-section-title">דחיפות פינוי</div>';
  h+='<div style="display:flex;gap:6px">';
  [{v:'immediate',l:'דחוף ≤שעה',c:'#e74c3c'},{v:'urgent',l:'בעדיפות ≤4ש׳',c:'#e67e22'},{v:'routine',l:'שגרתי ≤24ש׳',c:'#2ecc71'},{v:'expectant',l:'פינוי אחרון',c:'#555'}].forEach(e=>{
    const on=_casualtyEvacPriority===e.v;
    h+=`<button onclick="_casualtyEvacPriority='${e.v}';MedHost.triggerAutoSave();MedHost.renderIncidentPage()" style="flex:1;text-align:center;padding:10px 4px;border-radius:10px;background:${on?e.c+'25':'none'};border:2px solid ${e.c};font-size:11px;font-weight:700;color:${e.c};cursor:pointer;font-family:var(--f);min-height:48px">${e.l}</button>`;
  });
  h+='</div></div>';

  // Vitals (compact bar) — values persist across re-renders via _casualtyVitalsInput
  // Seed from tap-to-rate if blank
  if(!_casualtyVitalsInput.pulse&&_casualtyXABCDE.c.pulseRate)_casualtyVitalsInput.pulse=_casualtyXABCDE.c.pulseRate;
  if(!_casualtyVitalsInput.rr&&_casualtyXABCDE.b.respiratoryRate)_casualtyVitalsInput.rr=_casualtyXABCDE.b.respiratoryRate;
  h+='<div class="cas-section"><div class="cas-section-title">סימנים חיוניים</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1.4fr;gap:6px">';
  h+=`<div><div style="font-size:10px;color:var(--t3);margin-bottom:3px">❤️ דופק</div><input class="fi" id="cas-pulse" type="number" inputmode="numeric" placeholder="—" value="${escapeHtml(String(_casualtyVitalsInput.pulse||''))}" oninput="_casualtyVitalsInput.pulse=this.value" style="font-size:14px;padding:10px;text-align:center;min-height:44px"></div>`;
  h+=`<div><div style="font-size:10px;color:var(--t3);margin-bottom:3px">🫁 נשימות</div><input class="fi" id="cas-rr" type="number" inputmode="numeric" placeholder="—" value="${escapeHtml(String(_casualtyVitalsInput.rr||''))}" oninput="_casualtyVitalsInput.rr=this.value" style="font-size:14px;padding:10px;text-align:center;min-height:44px"></div>`;
  h+=`<div><div style="font-size:10px;color:var(--t3);margin-bottom:3px">📊 SpO2</div><input class="fi" id="cas-spo2" type="number" inputmode="numeric" placeholder="—" value="${escapeHtml(String(_casualtyVitalsInput.spo2||''))}" oninput="_casualtyVitalsInput.spo2=this.value" style="font-size:14px;padding:10px;text-align:center;min-height:44px"></div>`;
  h+=`<div><div style="font-size:10px;color:var(--t3);margin-bottom:3px">💉 ל"ד סיסט/דיאס</div><div style="display:flex;gap:3px;align-items:center"><input class="fi" id="cas-bp-sys" type="number" inputmode="numeric" placeholder="סיסט" value="${escapeHtml(String(_casualtyVitalsInput.bpSys||''))}" oninput="_casualtyVitalsInput.bpSys=this.value" style="font-size:13px;padding:10px;text-align:center;min-height:44px;flex:1;min-width:0"><span style="color:var(--t4);font-weight:700">/</span><input class="fi" id="cas-bp-dia" type="number" inputmode="numeric" placeholder="דיאס" value="${escapeHtml(String(_casualtyVitalsInput.bpDia||''))}" oninput="_casualtyVitalsInput.bpDia=this.value" style="font-size:13px;padding:10px;text-align:center;min-height:44px;flex:1;min-width:0"></div></div>`;
  h+='</div>';
  // Tier 27: temp + EtCO2 + radial pulse (IDF 2026)
  h+='<div style="display:grid;grid-template-columns:1fr 1fr 1.4fr;gap:6px;margin-top:6px">';
  h+=`<div><div style="font-size:10px;color:var(--t3);margin-bottom:3px">🌡 טמפ׳</div><input class="fi" id="cas-temp" type="number" step="0.1" inputmode="decimal" placeholder="°C" value="${escapeHtml(String(_casualtyVitalsInput.temp||''))}" oninput="_casualtyVitalsInput.temp=this.value" style="font-size:13px;padding:10px;text-align:center;min-height:44px"></div>`;
  h+=`<div><div style="font-size:10px;color:var(--t3);margin-bottom:3px">CO₂ (EtCO2)</div><input class="fi" id="cas-etco2" type="number" inputmode="numeric" placeholder="mmHg" value="${escapeHtml(String(_casualtyVitalsInput.etco2||''))}" oninput="_casualtyVitalsInput.etco2=this.value" style="font-size:13px;padding:10px;text-align:center;min-height:44px"></div>`;
  const rp=_casualtyVitalsInput.radialPulse||'';
  h+=`<div><div style="font-size:10px;color:var(--t3);margin-bottom:3px">דופק רדיאלי</div><div style="display:flex;gap:3px">`;
  [{v:'present',l:'תקין',c:'#2ecc71'},{v:'weak',l:'חלש',c:'#f1c40f'},{v:'absent',l:'אין',c:'#e74c3c'}].forEach(o=>{
    const on=rp===o.v;
    h+=`<button class="xabcde-btn" style="flex:1;padding:8px 4px;min-height:44px;border-color:${o.c};color:${on?'#fff':o.c};background:${on?o.c:o.c+'15'};font-size:11px" onclick="_casualtyVitalsInput.radialPulse='${o.v}';MedHost.renderIncidentPage()">${o.l}</button>`;
  });
  h+=`</div></div>`;
  h+='</div></div>';

  // Save/Cancel
  // Vitals bar (if readings exist)
  h+=renderVitalsBar();
  // Record vitals button
  h+=`<button onclick="addVitalsReading()" class="xabcde-btn" style="width:100%;margin-bottom:8px;border-color:var(--bl);color:var(--bl)">📊 שמור סימנים חיוניים</button>`;
  // Timeline
  if(_casualtyTimeline.length){
    // v3.36: collapsible timeline
    const tlOpen=_casualtyActiveTab==='timeline';
    h+='<div class="cas-section" style="padding:8px 10px">';
    h+=`<div onclick="_casualtyActiveTab=_casualtyActiveTab==='timeline'?null:'timeline';MedHost.renderIncidentPage()" style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:2px 0">`;
    h+=`<span style="font-size:12px;font-weight:800;color:var(--or)">⏱ ציר זמן טיפולי</span>`;
    h+=`<span style="font-size:10px;color:var(--t3);flex:1">(${_casualtyTimeline.length} אירועים)</span>`;
    h+=`<span style="font-size:10px;color:var(--t4)">${tlOpen?'▲':'▼'}</span>`;
    h+=`</div>`;
    if(tlOpen)h+='<div style="margin-top:8px">'+renderTimeline()+'</div>';
    h+='</div>';
  }
  // Action buttons
  // Tier 21b: end-of-form additional diagnoses + casualty identity +
  // caretaker chain tables. Rendered as collapsible <details> so they
  // don't dominate the form height.
  h+=renderAdditionalDiagnoses();
  h+=renderCasualtyIdentityTable();
  h+=renderCaretakerChainTable();
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:4px">';
  h+=`<button onclick="exportCasualtyHandoff()" class="xabcde-btn" style="font-size:10px;border-color:var(--bl);color:var(--bl)">📄 טופס 101</button>`;
  h+=`<button onclick="shareCasualtyWhatsApp()" class="xabcde-btn" style="font-size:10px;border-color:var(--gr);color:var(--gr)">📱 WhatsApp</button>`;
  h+='</div>';
  h+=`<button onclick="copyMISTPlus()" class="xabcde-btn" style="font-size:10px;border-color:#9b59b6;color:#9b59b6;width:100%;margin-bottom:4px">🔄 MIST+ להעברת פצוע</button>`;
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:4px">';
  h+=`<button onclick="printCasualty()" class="xabcde-btn" style="font-size:11px;border-color:var(--t3);color:var(--t3);min-height:40px">🖨️ הדפסה</button>`;
  h+=`<button onclick="showRadioReadout()" class="xabcde-btn" style="font-size:11px;border-color:var(--ye);color:var(--ye);min-height:40px">📻 דיווח רדיו</button>`;
  h+='</div>';
  // Bracelet export — Tier 17 hospital-confidential handoff.
  h+=`<button onclick="openBraceletExport()" class="xabcde-btn" style="width:100%;margin-bottom:8px;font-size:12px;font-weight:700;border-color:var(--pu);color:var(--pu);min-height:44px">🔖 ייצוא לצמיד (קוד + PIN)</button>`;
  // Auto-save status indicator
  h+=`<div id="autosave-status" style="text-align:center;font-size:10px;color:var(--gr);margin-bottom:6px;min-height:16px">${_autoSaveStatus||''}</div>`;
  h+=`<button onclick="saveCasualty()" class="btn bp" style="margin-bottom:6px;min-height:48px">${_casualtyEditId?'💾 שמור וסגור':'💾 שמור דיווח נפגע'}</button>`;
  h+='<button onclick="closeCasualtyForm()" class="btn bs" style="min-height:44px">סגור</button>';
  return h;
}

// ── [_ensureExtra + _setExtraField + identity tables + caretaker chain + renderStepNotes] from beta lines 9266-9370 ──
function _ensureExtra(){
  if(!_casualtyXABCDE.extra)_casualtyXABCDE.extra={addlDiagnoses:'',identity:{},caretakers:[],stepNotes:{}};
  if(!_casualtyXABCDE.extra.identity)_casualtyXABCDE.extra.identity={};
  if(!Array.isArray(_casualtyXABCDE.extra.caretakers))_casualtyXABCDE.extra.caretakers=[];
  if(!_casualtyXABCDE.extra.stepNotes)_casualtyXABCDE.extra.stepNotes={};
  return _casualtyXABCDE.extra;
}
function _setExtraField(path,val){
  const ex=_ensureExtra();
  const keys=path.split('.');
  let cur=ex;
  for(let i=0;i<keys.length-1;i++){cur[keys[i]]=cur[keys[i]]||{};cur=cur[keys[i]];}
  cur[keys[keys.length-1]]=val;
  MedHost.triggerAutoSave();
}
function renderAdditionalDiagnoses(){
  const ex=_ensureExtra();
  return `<details class="cas-section" style="padding:10px 12px;margin-bottom:6px">
    <summary style="cursor:pointer;font-size:12px;font-weight:700;color:var(--tx);min-height:36px;display:flex;align-items:center;gap:6px">🩺 אבחנות נוספות</summary>
    <textarea class="fi" placeholder="אבחנות נוספות שצוות הבית-חולים צריך לדעת..." oninput="_setExtraField('addlDiagnoses',this.value)" style="width:100%;margin-top:10px;font-size:13px;padding:10px;min-height:80px;resize:vertical;box-sizing:border-box">${escapeHtml(ex.addlDiagnoses||'')}</textarea>
  </details>`;
}
// Tier 22c: matches the IDF trauma record (גיליון מעקב טיפול ופינוי
// — עמוד 4) exactly. Two 7-column rows for casualty identity, and a
// 9-column caretakers log.
function renderCasualtyIdentityTable(){
  const ex=_ensureExtra();const id=ex.identity||{};
  // Row 1: מ.א/ת.ז · שם פרטי · שם משפחה · גיל · דרגה · יחידה · סוג שירות
  const row1=[
    {k:'firstName',l:'שם פרטי'},
    {k:'lastName',l:'שם משפחה'},
    {k:'rank',l:'דרגה'},
    {k:'unit',l:'יחידה (שם/ד.צ)'},
    {k:'serviceType',l:'סוג שירות',options:['חובה','קבע','מילואים','אזרח','אחר']}
  ];
  // Row 2: זמן פציעה · מקום פציעה · שעת קבלה · יחידה מטפלת · דרג מטפל · חייל/אזרח/אויב/אחר · שייכות
  const row2=[
    {k:'injuryLocation',l:'מקום פציעה'},
    {k:'receiveTime',l:'שעת קבלה',type:'time'},
    {k:'caringUnit',l:'יחידה מטפלת'},
    {k:'caringLevel',l:'דרג מטפל',options:['חובש','פראמדיק','רופא','אחר']},
    {k:'casualtyClass',l:'סיווג',options:['חייל','אזרח','אויב','אחר']},
    {k:'affiliation',l:'שייכות'}
  ];
  const fieldCell=(f)=>{
    if(f.options){
      const cur=id[f.k]||'';
      const opts=[''].concat(f.options).map(o=>`<option value="${escapeHtml(o)}"${o===cur?' selected':''}>${escapeHtml(o||'—')}</option>`).join('');
      return `<div style="display:flex;flex-direction:column;gap:3px"><label style="font-size:10px;color:var(--t3);font-weight:600">${escapeHtml(f.l)}</label><select oninput="_setExtraField('identity.${f.k}',this.value)" style="font-size:13px;padding:8px;background:var(--c3);border:1px solid var(--sep);border-radius:7px;color:var(--tx);font-family:var(--f);min-height:38px">${opts}</select></div>`;
    }
    return `<div style="display:flex;flex-direction:column;gap:3px"><label style="font-size:10px;color:var(--t3);font-weight:600">${escapeHtml(f.l)}</label><input type="${f.type||'text'}" value="${escapeHtml(id[f.k]||'')}" oninput="_setExtraField('identity.${f.k}',this.value)" style="font-size:13px;padding:8px;background:var(--c3);border:1px solid var(--sep);border-radius:7px;color:var(--tx);font-family:var(--f);min-height:38px;box-sizing:border-box"></div>`;
  };
  let h=`<details class="cas-section" style="padding:12px 14px;margin-bottom:6px">
    <summary style="cursor:pointer;font-size:13px;font-weight:800;color:var(--tx);min-height:36px;display:flex;align-items:center;gap:6px">👤 פרטי הפצוע</summary>
    <div style="margin-top:12px">
      <div style="font-size:10px;color:var(--t4);font-weight:700;margin-bottom:6px;letter-spacing:.3px">זיהוי</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">`;
  row1.forEach(f=>{h+=fieldCell(f);});
  h+=`</div>
      <div style="font-size:10px;color:var(--t4);font-weight:700;margin-bottom:6px;letter-spacing:.3px">פציעה וקבלה</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">`;
  row2.forEach(f=>{h+=fieldCell(f);});
  h+=`</div></div></details>`;
  return h;
}
function renderCaretakerChainTable(){
  const ex=_ensureExtra();const list=ex.caretakers||[];
  // Image columns: # · מ.א/ת.ז · דרגה · שם מלא · יחידה · תפקיד · התמחות · תאריך ושעה · חתימה
  let h=`<details class="cas-section" style="padding:12px 14px;margin-bottom:6px">
    <summary style="cursor:pointer;font-size:13px;font-weight:800;color:var(--tx);min-height:36px;display:flex;align-items:center;gap:6px">🧑‍⚕️ דרגי טיפול — פרטי המטפלים</summary>
    <div style="margin-top:12px">`;
  if(!list.length){h+=`<div style="font-size:12px;color:var(--t4);text-align:center;padding:12px">אין רישומי מטפלים — הוסף למטה</div>`;}
  list.forEach((c,i)=>{
    const upd=(f)=>`oninput="_casualtyXABCDE.extra.caretakers[${i}].${f}=this.value;MedHost.triggerAutoSave()"`;
    h+=`<div style="background:var(--c3);border:1px solid var(--sep);border-radius:10px;padding:10px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="background:var(--bl);color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900">${i+1}</span>
        <span style="font-size:11px;color:var(--t3);flex:1">מטפל #${i+1}</span>
        <button onclick="_casualtyXABCDE.extra.caretakers.splice(${i},1);MedHost.triggerAutoSave();MedHost.renderIncidentPage()" aria-label="מחק" style="background:none;border:none;color:var(--re);font-size:16px;cursor:pointer;padding:4px 8px;min-height:32px;min-width:32px">🗑</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <div><label style="font-size:10px;color:var(--t3);font-weight:600;display:block;margin-bottom:2px">מ.א / ת.ז</label><input value="${escapeHtml(c.idNumber||'')}" ${upd('idNumber')} style="width:100%;font-size:13px;padding:8px;background:var(--c2);border:1px solid var(--sep);border-radius:6px;color:var(--tx);font-family:var(--f);min-height:38px;box-sizing:border-box"></div>
        <div><label style="font-size:10px;color:var(--t3);font-weight:600;display:block;margin-bottom:2px">דרגה</label><input value="${escapeHtml(c.rank||'')}" ${upd('rank')} style="width:100%;font-size:13px;padding:8px;background:var(--c2);border:1px solid var(--sep);border-radius:6px;color:var(--tx);font-family:var(--f);min-height:38px;box-sizing:border-box"></div>
        <div style="grid-column:1/-1"><label style="font-size:10px;color:var(--t3);font-weight:600;display:block;margin-bottom:2px">שם מלא</label><input value="${escapeHtml(c.name||'')}" ${upd('name')} style="width:100%;font-size:13px;padding:8px;background:var(--c2);border:1px solid var(--sep);border-radius:6px;color:var(--tx);font-family:var(--f);min-height:38px;box-sizing:border-box"></div>
        <div><label style="font-size:10px;color:var(--t3);font-weight:600;display:block;margin-bottom:2px">יחידה</label><input value="${escapeHtml(c.unit||'')}" ${upd('unit')} style="width:100%;font-size:13px;padding:8px;background:var(--c2);border:1px solid var(--sep);border-radius:6px;color:var(--tx);font-family:var(--f);min-height:38px;box-sizing:border-box"></div>
        <div><label style="font-size:10px;color:var(--t3);font-weight:600;display:block;margin-bottom:2px">תפקיד</label><input value="${escapeHtml(c.role||'')}" ${upd('role')} placeholder="חובש / פראמדיק / רופא" style="width:100%;font-size:13px;padding:8px;background:var(--c2);border:1px solid var(--sep);border-radius:6px;color:var(--tx);font-family:var(--f);min-height:38px;box-sizing:border-box"></div>
        <div><label style="font-size:10px;color:var(--t3);font-weight:600;display:block;margin-bottom:2px">התמחות</label><input value="${escapeHtml(c.specialty||'')}" ${upd('specialty')} placeholder="למשל: תאונות דרכים" style="width:100%;font-size:13px;padding:8px;background:var(--c2);border:1px solid var(--sep);border-radius:6px;color:var(--tx);font-family:var(--f);min-height:38px;box-sizing:border-box"></div>
        <div><label style="font-size:10px;color:var(--t3);font-weight:600;display:block;margin-bottom:2px">תאריך ושעה</label><input type="datetime-local" value="${escapeHtml(c.dateTime||'')}" ${upd('dateTime')} style="width:100%;font-size:13px;padding:8px;background:var(--c2);border:1px solid var(--sep);border-radius:6px;color:var(--tx);font-family:var(--f);min-height:38px;box-sizing:border-box"></div>
        <div style="grid-column:1/-1"><label style="font-size:10px;color:var(--t3);font-weight:600;display:block;margin-bottom:2px">חתימה</label><div style="display:flex;gap:4px"><input value="${escapeHtml(c.signature||'')}" ${upd('signature')} placeholder="חתימה / שם חתימה" style="flex:1;font-size:13px;padding:8px;background:var(--c2);border:1px solid var(--sep);border-radius:6px;color:var(--tx);font-family:var(--f);min-height:38px;box-sizing:border-box"><button onclick="_casualtyXABCDE.extra.caretakers[${i}].signature=(curUser?.displayName||'')+' · '+new Date().toLocaleString('he-IL');MedHost.triggerAutoSave();MedHost.renderIncidentPage()" class="xabcde-btn" style="padding:4px 10px;font-size:11px;border-color:var(--gr);color:var(--gr);min-height:38px;white-space:nowrap">✓ חתום</button></div></div>
      </div>
    </div>`;
  });
  h+=`<button onclick="_casualtyXABCDE.extra.caretakers.push({idNumber:'',rank:'',name:'',unit:'',role:'',specialty:'',dateTime:new Date().toISOString().slice(0,16),signature:''});MedHost.triggerAutoSave();MedHost.renderIncidentPage()" class="xabcde-btn" style="width:100%;margin-top:6px;min-height:44px;border-color:var(--bl);color:var(--bl);font-weight:700">+ הוסף מטפל</button>`;
  h+=`</div></details>`;
  return h;
}
// Step notes component — shown at the bottom of each X-ABCDE tab.
function renderStepNotes(stepKey){
  const ex=_ensureExtra();
  const val=ex.stepNotes?.[stepKey]||'';
  return `<div style="margin-top:10px"><label style="font-size:10px;color:var(--t3);font-weight:600;display:block;margin-bottom:4px">📝 הערות לשלב ${stepKey.toUpperCase()}</label><textarea class="fi" placeholder="הערות חופשיות לשלב..." oninput="_setExtraField('stepNotes.${stepKey}',this.value)" style="width:100%;font-size:12px;padding:8px;min-height:52px;resize:vertical;box-sizing:border-box">${escapeHtml(val)}</textarea></div>`;
}


// ── MCI DASHBOARD + SABC WIZARD (stage 3.8) ──

// ── [MCI dashboard + helpers + treatment round + priority picker + commander + filters + casualty cards + triage hold + quickChangeTriage + deleteCasualtyById + copyMCIMIST] from beta lines 6830-7813 ──
function renderMCIDashboard(){
  if(!_mciInited){_mciInited=true;const defVehicles=JSON.parse(localStorage.getItem('shomer_vehicles')||'[]');if(defVehicles.length&&!_mciVehicles.length){defVehicles.forEach(raw=>{const v=_vehicleRec(raw);_mciVehicles.push({id:'v_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,5),type:v.type,seats:v.seats,litter:v.litter,status:'enroute',destination:'',casualties:[]});});}}
  // Targeted timer tick: the 5s interval used to re-run the whole
  // MedHost.renderIncidentPage() which rebuilt 30 card DOMs, wiped focus/search,
  // and killed expand state. Now it only mutates .mci-tq-timer,
  // [data-wait], and the overdue banner via textContent. It also pauses
  // entirely when the tab is hidden so a phone in a pocket isn't burning
  // CPU and battery.
  if(!_mciRefreshInterval){
    _mciRefreshInterval=setInterval(()=>{
      if(_incidentTab!=='mci'){clearInterval(_mciRefreshInterval);_mciRefreshInterval=null;return;}
      if(document.hidden)return;
      try{_tickMciTimers();}catch(e){}
    },5000);
  }
  let h='';
  // Tier 18b auto-promotion: once 3 casualties triaged, suggest jump to
  // 'manage' mode unless user has manually set a mode.
  if(!_mciModeManuallySet){
    if(_mciMode==='triage' && _incidentCasualties.length>=3 && _incidentCasualties.every(c=>c.triageColor)){
      _mciMode='manage';
    }
    if(!_incidentCasualties.length){_mciMode='triage';}
  }
  // Auto-open SALT rapid triage in triage mode on empty MCI.
  if(_mciMode==='triage' && !_mciInited_saltAutoOpen && !_incidentCasualties.length && !_mciShowRapidTriage){
    _mciInited_saltAutoOpen=true;
    _mciShowRapidTriage=true;
  }
  // CDS dashboard rescue strip — pipe critical alerts from any open
  // casualty in this incident to the dashboard so commander sees them.
  h+=renderCdsDashboardStrip();
  // Mode segmented control — sticky at top.
  h+=renderMciModeBar();
  // Treatment-round full-screen walker (highest priority overlay).
  if(_roundMode){h+=renderTreatmentRound();h+=renderMCIFAB();return h;}
  // ─── TRIAGE MODE ───
  if(_mciMode==='triage'){
    h+=renderMCIBanner();
    if(_mciShowRapidTriage){h+=renderRapidTriageWizard();h+=renderMCIFAB();return h;}
    h+=`<div style="text-align:center;padding:30px 16px"><button onclick="_mciShowRapidTriage=true;MedHost.renderIncidentPage()" style="width:100%;padding:24px;border-radius:16px;border:2px solid var(--re);background:rgba(231,76,60,.12);color:var(--re);font-size:18px;font-weight:900;cursor:pointer;font-family:var(--f);min-height:80px">⚡ התחל סיווג נפגע חדש</button></div>`;
    if(_incidentCasualties.length){
      h+=`<div style="font-size:11px;color:var(--t3);text-align:center;margin-bottom:6px">${_incidentCasualties.length} נפגעים סווגו · עבור ל"ניהול" כדי להתחיל לטפל</div>`;
      h+=renderMCICasualtyCards();
    }
    h+=renderMCIFAB();
    return h;
  }
  // ─── MANAGE MODE ───
  if(_mciMode==='manage'){
    h+=renderNextActionPrompt();
    h+=renderCommanderDashboard();
    h+=`<button onclick="openBraceletLookup()" style="width:100%;padding:10px;border-radius:10px;border:1.5px solid var(--pu);background:rgba(155,89,182,.08);color:var(--pu);font-size:12px;font-weight:700;cursor:pointer;font-family:var(--f);margin-bottom:8px;min-height:40px">🔖 חפש לפי קוד צמיד</button>`;
    h+=renderMCIBanner();
    if(_mciShowRapidTriage){h+=renderRapidTriageWizard();h+=renderMCIFAB();return h;}
    h+=renderMCIStatsBar();
    h+=renderPrioritySummary();
    h+=renderMCICasualtyCards();
    h+=renderMCIFAB();
    return h;
  }
  // ─── EVAC MODE ───
  if(_mciMode==='evac'){
    h+=renderMCIBanner();
    h+=`<div class="cas-section" style="padding:10px 12px;margin-bottom:8px"><div style="font-size:12px;font-weight:800;color:var(--tx);margin-bottom:6px">🚑 פינוי</div>`+renderMCIEvac()+`</div>`;
    // Evacuated archive entry
    const evacuatedCount=_incidentCasualties.filter(c=>c.evacStatus==='evacuated').length;
    h+=`<button onclick="openEvacuatedArchive()" style="width:100%;padding:14px;border-radius:12px;border:1.5px solid var(--gr);background:rgba(46,204,113,.1);color:var(--gr);font-size:13px;font-weight:800;cursor:pointer;font-family:var(--f);margin-bottom:8px;min-height:48px">📦 ארכיון פונים (${evacuatedCount})</button>`;
    h+=renderMCIResourcesSection();
    h+=renderMCIFAB();
    return h;
  }
  return h;
}
// Tier 18b: mode segmented control. Sticky just below banner.
function renderMciModeBar(){
  const tabs=[
    {v:'triage',l:'🔄 טריאז׳'},
    {v:'manage',l:'⚡ ניהול'},
    {v:'evac',l:'🚑 פינוי'}
  ];
  let h=`<div style="display:flex;gap:4px;margin-bottom:10px;background:var(--c2);border-radius:12px;padding:4px;position:sticky;top:0;z-index:20">`;
  tabs.forEach(t=>{
    const on=_mciMode===t.v;
    h+=`<button onclick="_setMciMode('${t.v}')" style="flex:1;padding:10px 4px;border-radius:9px;border:none;background:${on?'var(--bg)':'transparent'};color:${on?'var(--tx)':'var(--t3)'};font-size:13px;font-weight:${on?'800':'600'};cursor:pointer;font-family:var(--f);min-height:42px;${on?'box-shadow:0 1px 4px rgba(0,0,0,.4)':''}">${t.l}</button>`;
  });
  h+=`</div>`;
  return h;
}
function _setMciMode(m){
  _mciMode=m;
  _mciModeManuallySet=true;
  _mciTriageFilter=null;
  _mciActionFilter=null;
  MedHost.renderIncidentPage();
}
// Tier 18c: Next Action Prompt — single sentence + one button. State
// machine drives priority. Updates on every render.
function renderNextActionPrompt(){
  const active=_incidentCasualties.filter(c=>c.evacStatus!=='evacuated');
  let promptText='',btnText='',btnAction='',col='var(--gr)',bg='rgba(46,204,113,.12)';
  if(!_incidentCasualties.length){
    promptText='התחל סיווג נפגעים — לחץ "טריאז׳"';
    btnText='התחל';btnAction=`_setMciMode('triage');_mciShowRapidTriage=true;MedHost.renderIncidentPage()`;
    col='var(--re)';bg='rgba(231,76,60,.12)';
  } else if(active.some(c=>!c.triageColor)){
    const n=active.filter(c=>!c.triageColor).length;
    promptText=`${n} נפגעים ללא סיווג — סווג עכשיו`;
    btnText='סווג';btnAction=`_setMciMode('triage');_mciShowRapidTriage=true;MedHost.renderIncidentPage()`;
    col='var(--ye)';bg='rgba(241,196,15,.12)';
  } else {
    // Find oldest open TQ over 150 min
    let oldestTq=null,oldestTqAge=0,oldestTqCas=null;
    active.forEach(c=>{
      (c.treatments||[]).forEach(t=>{
        if(t.type!=='tourniquet')return;
        const age=(Date.now()-new Date(t.time).getTime())/60000;
        if(age>oldestTqAge){oldestTqAge=age;oldestTq=t;oldestTqCas=c;}
      });
    });
    if(oldestTqCas && oldestTqAge>=120){
      promptText=`🔴 ח״ע ישן: ${oldestTqCas.name||''} — ${Math.round(oldestTqAge)} דק׳`;
      btnText='פתח';btnAction=`editCasualtyById('${escapeHtml(String(oldestTqCas._docId||''))}')`;
      col='var(--re)';bg='rgba(231,76,60,.18)';
    } else {
      const noIv=active.find(c=>c.triageColor==='red'&&!((c.xabcde?.c?.ivAccess||[]).length));
      if(noIv){
        promptText=`${noIv.name||'נפגע אדום'} צריך גישה ורידית (IV/IO)`;
        btnText='פתח';btnAction=`editCasualtyById('${escapeHtml(String(noIv._docId||''))}')`;
        col='var(--or)';bg='rgba(230,126,34,.12)';
      } else {
        const noEvac=active.find(c=>c.triageColor && c.triageColor!=='black' && c.triageColor!=='gray' && !isCasualtyAssignedToVehicle(c));
        if(noEvac){
          promptText=`${noEvac.name||''} · מוכן — שייך לרכב`;
          btnText='פינוי';btnAction=`_setMciMode('evac');MedHost.renderIncidentPage()`;
          col='var(--bl)';bg='rgba(52,152,219,.12)';
        } else {
          // Vitals stalest
          let stalest=null,stalestAge=0;
          active.forEach(c=>{
            const v=c.vitalsHistory?.length?c.vitalsHistory[c.vitalsHistory.length-1]:null;
            if(!v)return;
            const age=(Date.now()-new Date(v.time).getTime())/60000;
            if(age>stalestAge){stalestAge=age;stalest=c;}
          });
          if(stalest && stalestAge>15){
            promptText=`בדוק סימנים חיוניים של ${stalest.name||''} — ${Math.round(stalestAge)} דק׳`;
            btnText='פתח';btnAction=`editCasualtyById('${escapeHtml(String(stalest._docId||''))}')`;
            col='var(--cy)';bg='rgba(26,188,156,.12)';
          } else {
            promptText='✓ כל הכבוד. כולם מטופלים — סבב נוסף או סיים?';
            btnText='סיים אירוע';btnAction=`endIncident()`;
            col='var(--gr)';bg='rgba(46,204,113,.12)';
          }
        }
      }
    }
  }
  let h=`<div style="background:${bg};border:1.5px solid ${col};border-radius:14px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:10px">`;
  h+=`<div style="flex:1;font-size:13px;font-weight:700;color:${col};line-height:1.4">${escapeHtml(promptText)}</div>`;
  if(btnText){
    h+=`<button onclick="${btnAction}" style="background:${col};border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:800;padding:10px 16px;cursor:pointer;font-family:var(--f);min-height:44px;flex-shrink:0">${escapeHtml(btnText)} →</button>`;
  }
  h+=`</div>`;
  return h;
}
// Tier 18e: dashboard-level CDS rescue strip — surfaces critical alerts
// from any casualty (not just the open one). Inspects every casualty's
// last vitals + xabcde and flags shock / hypoxia / open-TQ-overdue.
function renderCdsDashboardStrip(){
  const alerts=[];
  _incidentCasualties.filter(c=>c.evacStatus!=='evacuated').forEach(c=>{
    const v=c.vitalsHistory?.length?c.vitalsHistory[c.vitalsHistory.length-1]:null;
    if(v){
      if(v.spo2 && v.spo2<85)alerts.push({c:c,msg:`SpO2 ${v.spo2}% — היפוקסיה`,col:'var(--re)'});
      else if(v.spo2 && v.spo2<90)alerts.push({c:c,msg:`SpO2 ${v.spo2}% — נמוך`,col:'var(--or)'});
      const sys=v.bp?parseInt(v.bp):null;
      if(sys && sys<70)alerts.push({c:c,msg:`ל"ד ${sys} — קריטי`,col:'var(--re)'});
      if(v.pulse && v.pulse<40)alerts.push({c:c,msg:`דופק ${v.pulse} — ברדיקרדיה`,col:'var(--re)'});
    }
    (c.treatments||[]).forEach(t=>{
      if(t.type!=='tourniquet')return;
      const age=(Date.now()-new Date(t.time).getTime())/60000;
      if(age>=120)alerts.push({c:c,msg:`ח״ע ${Math.round(age)} דק׳ — המר/הערך`,col:'var(--re)'});
    });
  });
  if(!alerts.length)return'';
  // Top 3 most critical only.
  const top=alerts.slice(0,3);
  let h='';
  top.forEach(a=>{
    const safeId=escapeHtml(String(a.c._docId||''));
    h+=`<div role="alert" aria-live="assertive" style="background:${a.col};border-radius:12px;padding:10px 12px;margin-bottom:6px;display:flex;align-items:center;gap:10px;color:#fff;cursor:pointer;box-shadow:0 4px 12px ${a.col}55" onclick="editCasualtyById('${safeId}')">`;
    h+=`<div style="flex:1;font-size:12px;font-weight:800">🚨 ${escapeHtml(a.c.name||'נפגע')}: ${escapeHtml(a.msg)}</div>`;
    h+=`<div style="font-size:11px;font-weight:700;background:rgba(255,255,255,.22);border-radius:6px;padding:4px 8px">פתח →</div>`;
    h+=`</div>`;
  });
  return h;
}
// ═══ TIER 14: priority + round ═══
// Two commander-set numeric fields per casualty, persisted to Firestore:
//   treatmentPriority — order to perform life-saving actions (1 = first)
//   evacOrder         — order to evacuate (1 = first on bird/vehicle)
// Both default to 0 (unassigned); auto-suggested from triageColor when
// empty. Stored on the casualty doc so all medics see the same order.
async function _setCasualtyPriorityField(docId,field,val){
  if(!window.FB||!curTeamId||!_incidentAlertId)return;
  try{
    await window.FB.setDoc(
      window.FB.doc(window.FB.fbDb,'teams',curTeamId,'alerts',_incidentAlertId,'casualties',docId),
      {[field]:val},{merge:true}
    );
    if(navigator.vibrate)navigator.vibrate(15);
  }catch(e){MedHost.toast('שגיאה בעדכון עדיפות',false);}
}
function bumpTreatmentPriority(docId,delta){
  const c=_incidentCasualties.find(x=>x._docId===docId);if(!c)return;
  const cur=c.treatmentPriority||_autoPriorityFromTriage(c.triageColor);
  const next=Math.max(1,Math.min(99,(cur||1)+delta));
  _setCasualtyPriorityField(docId,'treatmentPriority',next);
}
function bumpEvacOrder(docId,delta){
  const c=_incidentCasualties.find(x=>x._docId===docId);if(!c)return;
  const cur=c.evacOrder||_autoPriorityFromTriage(c.triageColor);
  const next=Math.max(1,Math.min(99,(cur||1)+delta));
  _setCasualtyPriorityField(docId,'evacOrder',next);
}
// Tier 18a: replaced prompt() with a digit-picker bottom sheet — gloves
// and screen-readers can't use prompt(). Buttons 1-9 + clear, big targets.
function setTreatmentPriorityPrompt(docId){_openPriorityPicker(docId,'treatmentPriority','עדיפות טיפול');}
function setEvacOrderPrompt(docId){_openPriorityPicker(docId,'evacOrder','סדר פינוי');}
function _openPriorityPicker(docId,field,title){
  const c=_incidentCasualties.find(x=>x._docId===docId);if(!c)return;
  const cur=c[field]||_autoPriorityFromTriage(c.triageColor);
  const ov=document.createElement('div');
  ov.id='sh-prio-pick';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:100500;display:flex;align-items:flex-end;justify-content:center';
  const body=document.createElement('div');
  body.style.cssText='background:var(--bg);border-top:2px solid var(--bl);border-radius:18px 18px 0 0;width:100%;max-width:480px;padding:16px 16px max(16px,env(safe-area-inset-bottom));direction:rtl';
  let h=`<div style="font-size:14px;font-weight:900;color:var(--tx);margin-bottom:6px">${escapeHtml(title)} — ${escapeHtml(c.name||'')}</div>`;
  h+=`<div style="font-size:11px;color:var(--t3);margin-bottom:10px">נוכחי: ${cur} · בחר חדש (1=ראשון)</div>`;
  h+=`<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:8px">`;
  for(let n=1;n<=10;n++){
    const on=cur===n;
    h+=`<button onclick="_setCasualtyPriorityField('${escapeHtml(docId)}','${field}',${n});document.getElementById('sh-prio-pick').remove()" style="padding:14px 0;border-radius:12px;border:2px solid ${on?'var(--bl)':'var(--sep)'};background:${on?'rgba(52,152,219,.25)':'var(--c2)'};color:${on?'var(--bl)':'var(--tx)'};font-size:18px;font-weight:900;cursor:pointer;font-family:var(--f);min-height:54px">${n}</button>`;
  }
  h+=`</div>`;
  h+=`<button onclick="document.getElementById('sh-prio-pick').remove()" class="btn bs" style="width:100%;min-height:44px">סגור</button>`;
  body.innerHTML=h;
  ov.appendChild(body);
  ov.addEventListener('click',ev=>{if(ev.target===ov)ov.remove();});
  document.body.appendChild(ov);
}
// Auto-suggest: red=1, yellow=3, green=5, gray=9, black=9. Just a seed
// — the commander overrides with ↑ / ↓ / ✏ buttons on the card.
function _autoPriorityFromTriage(tc){
  return({red:1,yellow:3,green:5,gray:9,black:9}[tc])||5;
}
function _effectivePriority(c,field){
  if(c?.[field])return c[field];
  return _autoPriorityFromTriage(c?.triageColor);
}
// Sorted work-order view: red/TQ first, then yellow.
function getSortedByTreatment(){
  return [..._incidentCasualties]
    .filter(c=>c.triageColor!=='black')
    .sort((a,b)=>_effectivePriority(a,'treatmentPriority')-_effectivePriority(b,'treatmentPriority'));
}
function getSortedByEvac(){
  return [..._incidentCasualties]
    .filter(c=>c.triageColor!=='black'&&c.triageColor!=='gray')
    .sort((a,b)=>_effectivePriority(a,'evacOrder')-_effectivePriority(b,'evacOrder'));
}
// Treatment round state — full-screen one-casualty-at-a-time walker.
let _roundMode=false;
let _roundIndex=0;
function startTreatmentRound(){
  const sorted=getSortedByTreatment();
  if(!sorted.length){MedHost.toast('אין נפגעים לסבב',false);return;}
  _roundMode=true;_roundIndex=0;MedHost.renderIncidentPage();
}
function roundNext(){
  const n=getSortedByTreatment().length;
  _roundIndex=Math.min(n-1,_roundIndex+1);MedHost.renderIncidentPage();
}
function roundPrev(){_roundIndex=Math.max(0,_roundIndex-1);MedHost.renderIncidentPage();}
function endRound(){_roundMode=false;MedHost.renderIncidentPage();}
function renderTreatmentRound(){
  const sorted=getSortedByTreatment();
  if(!sorted.length)return'';
  const c=sorted[Math.min(_roundIndex,sorted.length-1)];
  const tc=c.triageColor||'yellow';
  const tcCol=TRIAGE_COLORS[tc]||'#888';
  const lastV=c.vitalsHistory?.length?c.vitalsHistory[c.vitalsHistory.length-1]:null;
  let h=`<div style="background:${tcCol}15;border:2px solid ${tcCol};border-radius:14px;padding:14px;margin-bottom:10px">`;
  h+=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">`;
  h+=`<div style="font-size:13px;font-weight:900;color:${tcCol}">🔄 סבב טיפולי · ${_roundIndex+1}/${sorted.length}</div>`;
  h+=`<button onclick="endRound()" aria-label="סיים סבב" style="background:var(--c3);border:none;border-radius:8px;color:var(--t2);cursor:pointer;font-size:11px;padding:4px 10px;font-family:var(--f);min-height:32px">סיים</button>`;
  h+=`</div>`;
  h+=`<div style="font-size:16px;font-weight:800;color:var(--tx);margin-bottom:4px">${escapeHtml(c.name||'ללא שם')}</div>`;
  h+=`<div style="font-size:12px;color:var(--t2);margin-bottom:8px">עדיפות טיפול: ${_effectivePriority(c,'treatmentPriority')} · פינוי: ${_effectivePriority(c,'evacOrder')}</div>`;
  if(lastV){
    h+=`<div style="font-family:monospace;font-size:14px;background:var(--c2);border-radius:8px;padding:8px;margin-bottom:8px">`;
    h+=`P:${escapeHtml(String(lastV.pulse||'—'))}  R:${escapeHtml(String(lastV.rr||'—'))}  SpO2:${escapeHtml(String(lastV.spo2||'—'))}%  BP:${escapeHtml(String(lastV.bp||'—'))}`;
    h+=`</div>`;
  }
  const tqs=(c.treatments||[]).filter(t=>t.type==='tourniquet');
  if(tqs.length){
    h+=`<div style="font-size:12px;color:var(--re);margin-bottom:6px">🔴 ח״ע פתוח × ${tqs.length}</div>`;
  }
  h+=`<div style="display:flex;gap:4px;margin:10px 0 6px">`;
  h+=`<button onclick="editCasualtyById('${escapeHtml(String(c._docId||''))}');endRound()" class="xabcde-btn" style="flex:2;min-height:48px;font-size:13px;border-color:var(--bl);color:var(--bl)">✏ טפל עכשיו</button>`;
  h+=`<button onclick="openVehiclePickerById('${escapeHtml(String(c._docId||''))}')" class="xabcde-btn" style="flex:1;min-height:48px;font-size:12px;border-color:var(--gr);color:var(--gr)">🚑 פינוי</button>`;
  h+=`</div>`;
  h+=`<div style="display:flex;gap:6px;margin-top:10px">`;
  h+=`<button onclick="roundPrev()" ${_roundIndex===0?'disabled':''} class="xabcde-btn" style="flex:1;min-height:44px;font-size:12px">← קודם</button>`;
  h+=`<button onclick="roundNext()" ${_roundIndex>=sorted.length-1?'disabled':''} class="xabcde-btn" style="flex:2;min-height:44px;font-size:13px;font-weight:700;border-color:var(--bl);color:var(--bl);background:rgba(52,152,219,.08)">הבא →</button>`;
  h+=`</div>`;
  h+=`</div>`;
  return h;
}
function renderPrioritySummary(){
  if(!_incidentCasualties.length)return'';
  // Tier 16: fold under a collapsible header so the main dashboard
  // stays lean. Commander taps to expand when they want the sorted view.
  const open=_mciPriorityOpen;
  let wrap=`<div class="mci-section-header" onclick="_mciPriorityOpen=!_mciPriorityOpen;MedHost.renderIncidentPage()" style="margin-bottom:${open?'4px':'8px'}"><span style="font-size:13px">🎯</span><span style="font-size:11px;font-weight:700;color:var(--tx);flex:1">סדר עבודה</span><button onclick="event.stopPropagation();startTreatmentRound()" style="background:rgba(52,152,219,.15);border:1px solid var(--bl);border-radius:6px;color:var(--bl);cursor:pointer;font-size:10px;font-weight:700;padding:4px 8px;font-family:var(--f);min-height:28px">▶ סבב</button><span style="font-size:10px;color:var(--t4);margin-right:4px">${open?'▲':'▼'}</span></div>`;
  if(!open)return wrap;
  const tSorted=getSortedByTreatment().slice(0,5);
  const eSorted=getSortedByEvac().slice(0,5);
  let h=wrap;
  h+=`<div class="cas-section" style="padding:10px 12px;margin-bottom:8px">`;
  h+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">`;
  // Treatment priority column
  h+=`<div>`;
  h+=`<div style="font-size:10px;color:var(--re);font-weight:700;margin-bottom:4px">💊 עדיפות טיפול</div>`;
  tSorted.forEach((c,i)=>{
    const tc=c.triageColor||'yellow';
    h+=`<div style="display:flex;gap:6px;align-items:center;padding:4px;border-radius:6px;margin-bottom:3px;background:${TRIAGE_COLORS[tc]||'#888'}18">`;
    h+=`<span style="font-size:14px;font-weight:900;color:${TRIAGE_COLORS[tc]||'#888'};min-width:20px">${i+1}</span>`;
    h+=`<span style="font-size:11px;color:var(--tx);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(c.name||'—')}</span>`;
    h+=`</div>`;
  });
  if(!tSorted.length)h+=`<div style="font-size:10px;color:var(--t4);text-align:center;padding:6px">—</div>`;
  h+=`</div>`;
  // Evac priority column
  h+=`<div>`;
  h+=`<div style="font-size:10px;color:var(--gr);font-weight:700;margin-bottom:4px">🚑 סדר פינוי</div>`;
  eSorted.forEach((c,i)=>{
    const tc=c.triageColor||'yellow';
    h+=`<div style="display:flex;gap:6px;align-items:center;padding:4px;border-radius:6px;margin-bottom:3px;background:${TRIAGE_COLORS[tc]||'#888'}18">`;
    h+=`<span style="font-size:14px;font-weight:900;color:${TRIAGE_COLORS[tc]||'#888'};min-width:20px">${i+1}</span>`;
    h+=`<span style="font-size:11px;color:var(--tx);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(c.name||'—')}</span>`;
    h+=`</div>`;
  });
  if(!eSorted.length)h+=`<div style="font-size:10px;color:var(--t4);text-align:center;padding:6px">—</div>`;
  h+=`</div>`; // close evac column
  h+=`</div>`; // close grid
  h+=`</div>`; // close cas-section
  return h;
}

// Targeted 5s tick: walks .mci-tq-timer and [data-wait] spans and only
// mutates textContent / class. No innerHTML, no focus-destroying reflow.
function _tickMciTimers(){
  document.querySelectorAll('.mci-tq-timer[data-tq-time]').forEach(el=>{
    const t=el.getAttribute('data-tq-time');if(!t)return;
    const e=getTqElapsed(t);
    el.textContent='🔴ח"ע '+e.str;
    if(e.alert)el.classList.add('overdue'); else el.classList.remove('overdue');
  });
  document.querySelectorAll('[data-wait-ts]').forEach(el=>{
    const ts=parseInt(el.getAttribute('data-wait-ts'),10);if(!ts)return;
    const min=Math.floor((Date.now()-ts)/60000);
    el.textContent=min<1?'זה עתה':min+'ד';
    if(min>15){el.style.color='var(--re)';el.style.fontWeight='800';}
  });
  // 1-min-before ETA alert (Tier 16). For every enroute vehicle that
  // has an ETA and hasn't yet fired the alert, check if the countdown
  // is ≤1 minute and fire a tap-to-assign toast.
  _mciVehicles.forEach((v,i)=>{
    if(!v||v._alertedOneMin)return;
    if(_normalizeVehicleStatus(v.status)!=='enroute')return;
    const rem=_computeEtaCountdown(v);
    if(rem===null||rem>1)return;
    v._alertedOneMin=true;
    _syncMciVehicles();
    const seats=v.seats||'?';
    const litter=v.litter||0;
    const capacity=litter?`${seats} (${litter} בשכיבה)`:String(seats);
    const msg=`🚑 ${v.type||'רכב פינוי'} מגיע עוד דקה — יכול לפנות ${capacity} פצועים`;
    showEtaArrivalAlert(v,i,msg);
    if(navigator.vibrate)navigator.vibrate([200,80,200]);
  });
}
// Sticky tap-to-assign alert shown 1 minute before a vehicle arrives.
// Persists until the medic taps it (opens the assign picker) or the
// ✕ close button. Sits above the incident sheet so it's always visible.
function showEtaArrivalAlert(vehicle,vehicleIdx,msg){
  // Dedupe: only one alert per vehicle at a time.
  const existingId='sh-eta-alert-'+(vehicle.id||vehicleIdx);
  const existing=document.getElementById(existingId);
  if(existing)existing.remove();
  const ov=document.createElement('div');
  ov.id=existingId;
  ov.style.cssText='position:fixed;top:max(16px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);background:var(--re);color:#fff;border-radius:14px;padding:14px 18px;z-index:100700;box-shadow:0 6px 24px rgba(231,76,60,.55);max-width:calc(100% - 32px);direction:rtl;cursor:pointer;display:flex;align-items:center;gap:10px;font-family:var(--f)';
  ov.setAttribute('role','alert');
  ov.setAttribute('aria-live','assertive');
  ov.innerHTML=`<div style="font-size:13px;font-weight:800;flex:1;line-height:1.4">${escapeHtml(msg)}<div style="font-size:11px;opacity:.85;margin-top:4px;font-weight:600">לחץ לשיוך נפגעים</div></div>
    <button aria-label="סגור התראה" onclick="event.stopPropagation();this.parentElement.remove()" style="background:rgba(255,255,255,.22);border:none;border-radius:50%;width:30px;height:30px;color:#fff;cursor:pointer;font-size:14px;font-weight:800;min-height:30px">✕</button>`;
  ov.addEventListener('click',()=>{
    ov.remove();
    // Re-resolve index in case the array reordered via snapshot.
    const i=_mciVehicles.indexOf(vehicle);
    if(i>=0)openVehicleAssignPicker(i);
    else openVehicleAssignPicker(vehicleIdx);
  });
  document.body.appendChild(ov);
  // Auto-dismiss after 60s so the screen doesn't stack forever.
  setTimeout(()=>{const el=document.getElementById(existingId);if(el)el.remove();},60000);
}

// Commander dashboard — ops-side snapshot rendered above the triage
// banner. Four tiles: open TQs, casualties waiting on IV/fluids, ready
// to evac, already evacuated. Colors escalate when attention is needed.
function renderCommanderDashboard(){
  const active=_incidentCasualties.filter(c=>c.evacStatus!=='evacuated');
  const openTqs=active.reduce((n,c)=>n+((c.treatments||[]).filter(t=>t.type==='tourniquet').length),0);
  const volumeWaiting=active.filter(c=>c.triageColor==='red' && !((c.xabcde?.c?.ivAccess||[]).length)).length;
  const readyToEvac=active.filter(c=>!!c.triageColor && c.triageColor!=='black' && c.triageColor!=='gray' && !isCasualtyAssignedToVehicle(c)).length;
  const evacuated=_mciVehicles.filter(v=>v.status==='evacuating'||v.status==='athospital').reduce((s,v)=>s+v.casualties.length,0)+_incidentCasualties.filter(c=>c.evacStatus==='evacuated'&&!isCasualtyAssignedToVehicle(c)).length;
  // Tier 18a: tiles are buttons that filter/route. 13px label / 28px
  // value. Tap an active tile → set MCI filter or scroll to action.
  let h=`<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin-bottom:8px">`;
  const tile=(val,label,col,bg,onClick,disabled)=>`<button onclick="${onClick||''}" ${disabled?'disabled':''} aria-label="${escapeHtml(label)}: ${val}" style="background:${bg};border:1.5px solid ${col};border-radius:12px;padding:10px 4px;text-align:center;cursor:${disabled?'default':'pointer'};font-family:var(--f);min-height:64px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px"><div style="font-size:24px;font-weight:900;color:${col};line-height:1">${val}</div><div style="font-size:11px;color:${col};font-weight:700;line-height:1.1">${label}</div></button>`;
  h+=tile(openTqs,'ח״ע פתוחים',openTqs>0?'var(--re)':'var(--t3)',openTqs>0?'rgba(231,76,60,.12)':'var(--c2)',openTqs>0?`_filterByOpenTqs()`:'',openTqs===0);
  h+=tile(volumeWaiting,'דורש נפח',volumeWaiting>0?'var(--or)':'var(--t3)',volumeWaiting>0?'rgba(230,126,34,.12)':'var(--c2)',volumeWaiting>0?`_filterByVolumeWaiting()`:'',volumeWaiting===0);
  h+=tile(readyToEvac,'מוכן לפינוי',readyToEvac>0?'var(--bl)':'var(--t3)',readyToEvac>0?'rgba(52,152,219,.12)':'var(--c2)',readyToEvac>0?`_filterByReadyToEvac()`:'',readyToEvac===0);
  h+=tile(evacuated,'פונו',evacuated>0?'var(--gr)':'var(--t3)',evacuated>0?'rgba(46,204,113,.12)':'var(--c2)',evacuated>0?`openEvacuatedArchive()`:'',evacuated===0);
  h+=`</div>`;
  return h;
}
// Tier 18a: tile-tap routers. Lightweight client-side filters layered on
// top of the existing _mciTriageFilter — set a marker that the card-list
// renderer uses.
// _mciActionFilter declared in shared/medical-forms.js
function _filterByOpenTqs(){_mciActionFilter='open_tq';_mciTriageFilter=null;MedHost.renderIncidentPage();MedHost.toast('סינון: ח״ע פתוחים',false);}
function _filterByVolumeWaiting(){_mciActionFilter='volume_waiting';_mciTriageFilter=null;MedHost.renderIncidentPage();MedHost.toast('סינון: דורש נפח',false);}
function _filterByReadyToEvac(){_mciActionFilter='ready_evac';_mciTriageFilter=null;MedHost.renderIncidentPage();MedHost.toast('סינון: מוכן לפינוי',false);}
function _clearActionFilter(){_mciActionFilter=null;MedHost.renderIncidentPage();}
// Tier 18 evacuated archive: full-screen list of casualties already
// transported out, with their final status, vehicle, time, and a quick
// route back into the casualty form for handoff verification.
function openEvacuatedArchive(){
  const ev=_incidentCasualties.filter(c=>c.evacStatus==='evacuated')
    .sort((a,b)=>{
      const ta=a.evacDepartedAt?.toDate?.()?.getTime?.()||0;
      const tb=b.evacDepartedAt?.toDate?.()?.getTime?.()||0;
      return tb-ta;
    });
  const ov=document.createElement('div');
  ov.id='sh-evac-archive';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:100500;display:flex;flex-direction:column;direction:rtl';
  let h='<div style="padding:max(14px,env(safe-area-inset-top)) 14px 8px;display:flex;align-items:center;gap:10px;background:var(--bg);border-bottom:1px solid var(--sep)">';
  h+=`<button onclick="document.getElementById('sh-evac-archive').remove()" aria-label="סגור" style="background:var(--c2);border:none;border-radius:50%;width:36px;height:36px;color:var(--t2);cursor:pointer;font-size:16px;min-height:36px">✕</button>`;
  h+=`<div style="flex:1"><div style="font-size:15px;font-weight:900;color:var(--gr)">🚑 פונו מהזירה</div><div style="font-size:11px;color:var(--t3)">${ev.length} נפגעים פונו בסה״כ</div></div>`;
  h+='</div>';
  h+='<div style="flex:1;overflow-y:auto;padding:10px 14px max(14px,env(safe-area-inset-bottom))">';
  if(!ev.length){
    h+='<div style="text-align:center;padding:40px 0;color:var(--t4);font-size:13px">עדיין לא פונה אף נפגע</div>';
  } else {
    ev.forEach(c=>{
      const tc=c.triageColor||'yellow';
      const col=TRIAGE_COLORS[tc]||'#888';
      const evTime=c.evacDepartedAt?.toDate?.()?c.evacDepartedAt.toDate().toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'}):'';
      const vehicle=c.evacVehicleType||'לא ידוע';
      const lastV=c.vitalsHistory?.length?c.vitalsHistory[c.vitalsHistory.length-1]:null;
      const tqs=(c.treatments||[]).filter(t=>t.type==='tourniquet').length;
      const meds=(c.xabcde?.e?.medications||[]).length;
      h+=`<div class="cas-section" style="padding:12px;margin-bottom:8px;border-right:4px solid ${col};background:var(--c2)">`;
      h+=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">`;
      h+=`<span style="background:${col};color:#fff;border-radius:6px;padding:3px 8px;font-size:12px;font-weight:900">${({red:'דחוף',yellow:'עדיפות שנייה',green:'לא דחוף',gray:'ממתין',black:'ללא סימני חיים'})[tc]||tc}</span>`;
      h+=`<span style="font-size:14px;font-weight:800;color:var(--tx);flex:1">${escapeHtml(c.name||'ללא שם')}</span>`;
      h+=`<span style="font-size:11px;color:var(--t3);font-family:monospace">${escapeHtml(evTime)}</span>`;
      h+=`</div>`;
      h+=`<div style="font-size:12px;color:var(--t2);margin-bottom:4px">🚑 פונה ע״י <b>${escapeHtml(vehicle)}</b>${c.evacDestination?' → '+escapeHtml(c.evacDestination):''}</div>`;
      if(lastV){
        h+=`<div style="font-family:monospace;font-size:12px;color:var(--t3);margin-bottom:4px">סטטוס אחרון: P:${escapeHtml(String(lastV.pulse||'—'))} R:${escapeHtml(String(lastV.rr||'—'))} SpO2:${escapeHtml(String(lastV.spo2||'—'))}% BP:${escapeHtml(String(lastV.bp||'—'))}</div>`;
      }
      const chips=[];
      if(tqs)chips.push(`🔴 ${tqs} ח״ע`);
      if(meds)chips.push(`💊 ${meds} מנות`);
      if(c.bracelet?.code)chips.push(`🔖 ${c.bracelet.code}`);
      if(chips.length){
        h+=`<div style="font-size:11px;color:var(--t3);margin-bottom:6px">${chips.map(s=>escapeHtml(s)).join(' · ')}</div>`;
      }
      const safeId=escapeHtml(String(c._docId||''));
      h+=`<div style="display:flex;gap:6px;margin-top:6px">`;
      h+=`<button onclick="document.getElementById('sh-evac-archive').remove();editCasualtyById('${safeId}')" class="xabcde-btn" style="flex:2;min-height:40px;font-size:12px;border-color:var(--bl);color:var(--bl)">✏ פתח טופס</button>`;
      h+=`<button onclick="_unEvacuate('${safeId}')" class="xabcde-btn" style="flex:1;min-height:40px;font-size:11px;border-color:var(--ye);color:var(--ye)">↩ החזר לזירה</button>`;
      h+=`</div>`;
      h+=`</div>`;
    });
  }
  h+='</div>';
  ov.innerHTML=h;
  document.body.appendChild(ov);
}
async function _unEvacuate(docId){
  if(!confirm('להחזיר את הנפגע לרשימת הזירה הפעילה?'))return;
  try{
    await window.FB.setDoc(
      window.FB.doc(window.FB.fbDb,'teams',curTeamId,'alerts',_incidentAlertId,'casualties',docId),
      {evacStatus:'',evacDepartedAt:null},{merge:true}
    );
    MedHost.toast('הנפגע חזר לזירה',false);
    document.getElementById('sh-evac-archive')?.remove();
  }catch(e){MedHost.toast('שגיאה',false);}
}
function renderMCIBanner(){
  const counts={red:0,yellow:0,green:0,gray:0,black:0,total:0};
  _incidentCasualties.forEach(c=>{if(c.triageColor&&counts[c.triageColor]!==undefined)counts[c.triageColor]++;counts.total++;});
  let h=`<div class="mci-banner">`;
  [{c:'red',l:'דחוף'},{c:'yellow',l:'עדיפות שנייה'},{c:'green',l:'לא דחוף'},{c:'gray',l:'ממתין'},{c:'black',l:'ללא סימני חיים'}].forEach(t=>{
    const active=_mciTriageFilter===t.c;
    const col=TRIAGE_COLORS[t.c];
    h+=`<button class="mci-banner-btn${active?' active':''}" onclick="_mciTriageFilter=_mciTriageFilter==='${t.c}'?null:'${t.c}';MedHost.renderIncidentPage()" style="border-color:${col};background:${active?col+'30':col+'10'};color:${col}">`;
    h+=`<div style="font-size:22px;font-weight:900">${counts[t.c]}</div>`;
    h+=`<div style="font-size:8px;font-weight:700">${t.l}</div>`;
    h+=`</button>`;
  });
  h+=`</div>`;
  return h;
}
function renderMCIStatsBar(){
  const total=_incidentCasualties.length;
  const evaced=_mciVehicles.filter(v=>v.status==='evacuating'||v.status==='athospital').reduce((s,v)=>s+v.casualties.length,0)+_incidentCasualties.filter(c=>c.evacStatus==='evacuated'&&!isCasualtyAssignedToVehicle(c)).length;
  const reds=_incidentCasualties.filter(c=>c.triageColor==='red').length;
  // Count reds waiting >15min without evac assignment
  const redsOverdue=_incidentCasualties.filter(c=>{
    if(c.triageColor!=='red')return false;
    if(isCasualtyAssignedToVehicle(c))return false;
    const waitMs=c.timestamp?.toDate?Date.now()-c.timestamp.toDate().getTime():0;
    return waitMs>15*60*1000;
  }).length;
  let timer='';
  if(_incidentData?.timestamp?.toDate){const elapsed=Date.now()-_incidentData.timestamp.toDate().getTime();const mins=Math.floor(elapsed/60000),hrs=Math.floor(mins/60);timer=`⏱ ${hrs>0?hrs+'ש '+mins%60+'ד':mins+'ד'}`;}
  let h='';
  if(redsOverdue>0){
    h+=`<div role="alert" style="background:rgba(231,76,60,.18);border:1.5px solid var(--re-hi);border-radius:10px;padding:8px 12px;margin-bottom:8px;text-align:center;font-size:12px;font-weight:800;color:var(--re-hi);animation:pulse 1.5s infinite">⚠️ ${redsOverdue} ${redsOverdue>1?'נפגעים דחופים ממתינים':'נפגע דחוף ממתין'} לפינוי מעל 15 דק׳</div>`;
  }
  h+=`<div style="display:flex;gap:8px;justify-content:center;padding:6px 0;font-size:11px;color:var(--t2);margin-bottom:6px;font-weight:600">`;
  h+=`<span>${total} נפגעים</span>`;
  h+=`<span style="color:var(--t4)">|</span><span style="color:var(--gr)">${evaced} פונו</span>`;
  h+=`<span style="color:var(--t4)">|</span><span style="color:${total-evaced>0?'var(--or)':'var(--t3)'}">${total-evaced} בזירה</span>`;
  if(timer)h+=`<span style="color:var(--t4)">|</span><span>${timer}</span>`;
  h+=`</div>`;
  return h;
}
function renderMCIFAB(){
  // Tier 21: FAB always opens a fresh SABC session. Prior behavior
  // toggled _mciShowRapidTriage which, combined with a stale
  // _sabcStep, could fail to reset and land the medic on the
  // classify step with a stale casualty name.
  return`<button class="mci-fab" onclick="startSabcWizard()" aria-label="הוסף נפגע" title="הוסף נפגע (SABC)">+</button>`;
}
function mciToast(msg,undoFn){
  // Tier 18e: destructive undo extended to 10s + paused while
  // document is hidden (radio call doesn't eat the undo window).
  document.querySelectorAll('.mci-undo-toast').forEach(e=>e.remove());
  const el=document.createElement('div');el.className='mci-undo-toast';
  el.innerHTML=`<span>${msg}</span>${undoFn?'<button onclick="this.parentElement._undoFn();this.parentElement.remove()" style="background:rgba(52,152,219,.22);border:1px solid var(--bl);border-radius:8px;padding:6px 14px;color:var(--bl);font-size:13px;font-weight:800;cursor:pointer;font-family:var(--f);min-height:36px">ביטול</button>':''}`;
  if(undoFn)el._undoFn=undoFn;
  document.body.appendChild(el);
  const dur=undoFn?10000:4000;
  let remaining=dur;
  let lastTick=Date.now();
  const tick=()=>{
    if(!document.body.contains(el))return;
    if(!document.hidden){
      remaining-=(Date.now()-lastTick);
      if(remaining<=0){el.remove();return;}
    }
    lastTick=Date.now();
    setTimeout(tick,250);
  };
  tick();
}
function renderMCIOverview(counts){
  let h='';
  const total=_incidentCasualties.length;
  const evaced=_incidentCasualties.filter(c=>c.evacVehicle).length;
  // Quick stats
  h+=`<div class="cas-section"><div class="cas-section-title">סיכום אירוע</div>`;
  h+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">`;
  h+=`<div style="text-align:center;padding:8px;background:var(--c3);border-radius:8px"><div style="font-size:18px;font-weight:900;color:var(--tx)">${total}</div><div style="font-size:9px;color:var(--t3)">סה"כ נפגעים</div></div>`;
  h+=`<div style="text-align:center;padding:8px;background:var(--c3);border-radius:8px"><div style="font-size:18px;font-weight:900;color:var(--tx)">${evaced}</div><div style="font-size:9px;color:var(--t3)">פונו</div></div>`;
  h+=`<div style="text-align:center;padding:8px;background:var(--c3);border-radius:8px"><div style="font-size:18px;font-weight:900;color:var(--tx)">${total-evaced}</div><div style="font-size:9px;color:var(--t3)">ממתינים</div></div>`;
  h+=`<div style="text-align:center;padding:8px;background:var(--c3);border-radius:8px"><div style="font-size:18px;font-weight:900;color:var(--tx)">${_mciVehicles.length}</div><div style="font-size:9px;color:var(--t3)">רכבי פינוי</div></div>`;
  h+=`</div></div>`;
  if(_incidentData?.location)h+=`<div class="cas-section"><div style="font-size:11px;color:var(--t2)">📍 ${escapeHtml(_incidentData.location)}</div></div>`;
  // Incident timer
  if(_incidentData?.timestamp?.toDate){
    const elapsed=Date.now()-_incidentData.timestamp.toDate().getTime();
    const mins=Math.floor(elapsed/60000),hrs=Math.floor(mins/60);
    h+=`<div style="text-align:center;font-size:11px;color:var(--t3);margin:6px 0">⏱ ${hrs>0?hrs+'ש '+mins%60+'ד':mins+'ד'} מתחילת האירוע</div>`;
  }
  return h;
}

function renderMCICasualtyCards(){
  const order={red:0,yellow:1,green:2,gray:3,black:4};
  // Archive evacuated casualties out of the main list; they render in
  // a collapsible "ארכיון זירה" block at the bottom so the active
  // roster stays focused.
  const activeCasualties=_incidentCasualties.filter(c=>c.evacStatus!=='evacuated');
  let filtered=_mciTriageFilter?activeCasualties.filter(c=>c.triageColor===_mciTriageFilter):[...activeCasualties];
  // Tier 18a action-filter (set by commander dashboard tile taps).
  if(_mciActionFilter==='open_tq'){
    filtered=filtered.filter(c=>(c.treatments||[]).some(t=>t.type==='tourniquet'));
  } else if(_mciActionFilter==='volume_waiting'){
    filtered=filtered.filter(c=>c.triageColor==='red' && !((c.xabcde?.c?.ivAccess||[]).length));
  } else if(_mciActionFilter==='ready_evac'){
    filtered=filtered.filter(c=>!!c.triageColor && c.triageColor!=='black' && c.triageColor!=='gray' && !isCasualtyAssignedToVehicle(c));
  }
  // Search filter (name or idNumber)
  if(_mciSearch){
    const q=_mciSearch.toLowerCase();
    filtered=filtered.filter(c=>(c.name||'').toLowerCase().includes(q)||(c.idNumber||'').toLowerCase().includes(q));
  }
  filtered.sort((a,b)=>{const od=(order[a.triageColor]??9)-(order[b.triageColor]??9);if(od!==0)return od;const ta=a.timestamp?.toDate?a.timestamp.toDate().getTime():0;const tb=b.timestamp?.toDate?b.timestamp.toDate().getTime():0;return ta-tb;});
  // Search box (shown if >3 casualties or search active)
  let h='';
  if(_incidentCasualties.length>3||_mciSearch){
    h+=`<div style="margin-bottom:6px"><input type="search" placeholder="🔍 חיפוש שם או מ.א..." value="${escapeHtml(_mciSearch)}" oninput="_mciSearch=this.value;MedHost.renderIncidentPage()" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--sep);background:var(--c2);color:var(--tx);font-size:13px;font-family:var(--f);min-height:44px" aria-label="חיפוש נפגעים"></div>`;
  }
  if(!filtered.length){return h+`<div style="text-align:center;padding:30px 0;color:var(--t4);font-size:12px">${_mciSearch?'לא נמצאו תוצאות ל"'+escapeHtml(_mciSearch)+'"':_mciTriageFilter?'אין נפגעים ב'+{red:'אדום',yellow:'צהוב',green:'ירוק',gray:'אפור',black:'שחור'}[_mciTriageFilter]:'אין נפגעים — לחץ + להוספה'}</div>`;}
  filtered.forEach((c,idx)=>{
    const realIdx=_incidentCasualties.indexOf(c);
    const expanded=_mciExpandedCard===c._docId;
    h+=renderMCICasualtyCard(c,realIdx,idx+1,expanded);
  });
  return h;
}
function renderMCICasualtyCard(c,realIdx,displayNum,expanded){
  const tc=c.triageColor||'';const tColor=TRIAGE_COLORS[tc]||'var(--pu)';
  const needsTriage=!tc;
  const moiObj=MOI_TYPES.find(m=>m.id===c.moi);
  const lastV=c.vitalsHistory?.length?c.vitalsHistory[c.vitalsHistory.length-1]:null;
  const avpu=c.xabcde?.d?.avpu||'';
  // Wait time
  let waitMin=0,waitStr='',waitTs=0;
  if(c.timestamp?.toDate){waitTs=c.timestamp.toDate().getTime();waitMin=Math.floor((Date.now()-waitTs)/60000);waitStr=waitMin>=60?Math.floor(waitMin/60)+'ש '+waitMin%60+'ד':waitMin+'ד';}
  const isOverdue=tc==='red'&&waitMin>15&&!isCasualtyAssignedToVehicle(c);
  // Tourniquet timers
  const tqs=c.xabcde?.x?.tourniquets||[];
  // Evac status
  const evacd=isCasualtyAssignedToVehicle(c);
  const vehicleInfo=findVehicleForCasualty(c);

  // docId is also validated server-side by firestore.rules (^[A-Za-z0-9_-]{1,64}$)
  // but we escape here too as defense-in-depth against legacy docs.
  const safeDocId=escapeHtml(String(c._docId||''));
  // Triage letter glyph — color-only coding fails WCAG 1.4.1 and fails
  // in dim light / red night-vision. Add a high-contrast letter so the
  // triage category is parseable without hue.
  // Tier 19: short Hebrew text label instead of abstract letters.
  const triageLetter=needsTriage?'❓ סווג':({red:'דחוף',yellow:'עדיפות שנייה',green:'לא דחוף',gray:'ממתין',black:'ללא סימני חיים'})[tc]||'?';
  const triageLabel=needsTriage?'טרם סווג':({red:'דחוף',yellow:'עדיפות שנייה',green:'לא דחוף',gray:'ממתין',black:'ללא סימני חיים'})[tc]||'';
  const ariaLabel=`נפגע מספר ${displayNum}, ${c.name||'ללא שם'}, טריאז\' ${triageLabel}${waitStr?', ממתין '+waitStr:''}`;
  // Tier 20b: casualties without triage get a distinct purple dashed
  // border + tap-to-triage-now behavior. Tapping the card opens SABC
  // wizard bound to this casualty instead of toggling expand.
  const primaryClick=needsTriage?`openSabcForCasualty('${safeDocId}')`:`toggleMCICardExpand('${safeDocId}')`;
  const cardExtra=needsTriage?'border-top:3px dashed var(--pu) !important;background:rgba(155,89,182,.08)':'';
  let h=`<div class="mci-card triage-${String(tc).replace(/[^a-z]/gi,'')}${isOverdue?' mci-card-alert':''}" role="button" tabindex="0" aria-label="${escapeHtml(ariaLabel)}" aria-expanded="${expanded?'true':'false'}" style="${cardExtra}" onclick="${primaryClick}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${primaryClick};}">`;
  // Letter token — for no-triage shows "❓" purple; otherwise colored label.
  const letterBg=needsTriage?'var(--pu)':(TRIAGE_COLORS[tc]||'#888');
  const letterFontSize=needsTriage?'10px':'14px';
  const letterW=needsTriage?'46px':'24px';
  h+=`<span class="mci-triage-letter" aria-hidden="true" style="position:absolute;inset-inline-start:8px;top:8px;width:${letterW};height:24px;border-radius:12px;background:${letterBg};color:#fff;font-size:${letterFontSize};font-weight:900;display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,.3);padding:0 4px;white-space:nowrap">${triageLetter}</span>`;
  // Row 1: # + name + MOI + vitals + wait
  h+=`<div class="mci-card-row">`;
  h+=`<span style="font-size:16px;font-weight:800;color:var(--tx);min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">#${displayNum} ${escapeHtml(c.name||'ללא שם')}</span>`;
  if(moiObj)h+=`<span style="font-size:18px" title="${escapeHtml(moiObj.label||'')}" aria-label="${escapeHtml(moiObj.label||'')}">${moiObj.icon}</span>`;
  // Vitals compact
  if(lastV){
    const pAbn=lastV.pulse>120||lastV.pulse<50;
    const rAbn=(lastV.rr>30||lastV.rr<10)&&lastV.rr;
    const sAbn=lastV.spo2<90;
    h+=`<span class="mci-card-vitals" aria-label="סימנים חיוניים">`;
    h+=`<span class="${pAbn?'abnormal':''}" ${pAbn?'aria-label="דופק חריג"':''}>${pAbn?'⚠ ':''}HR ${lastV.pulse||'—'}</span> `;
    if(lastV.rr)h+=`<span class="${rAbn?'abnormal':''}" ${rAbn?'aria-label="נשימות חריגות"':''}>${rAbn?'⚠ ':''}RR ${lastV.rr}</span> `;
    if(lastV.spo2)h+=`<span class="${sAbn?'abnormal':''}" ${sAbn?'aria-label="חמצן נמוך"':''}>${sAbn?'⚠ ':''}SpO₂ ${lastV.spo2}%</span> `;
    h+=`</span>`;
  }
  if(avpu){const avpuCol=avpu==='A'?'var(--gr)':avpu==='V'?'var(--ye)':'var(--re-hi)';const avpuIcon=avpu==='A'?'':avpu==='V'?'◑':'●';h+=`<span aria-label="רמת הכרה AVPU ${escapeHtml(String(avpu))}" style="font-size:13px;font-weight:800;color:${avpuCol}">${avpuIcon} ${escapeHtml(String(avpu))}</span>`;}
  h+=`<span data-wait-ts="${waitTs}" style="font-size:12px;color:${isOverdue?'var(--re)':'var(--t3)'};font-weight:${isOverdue?'800':'600'}">${escapeHtml(waitStr)}</span>`;
  h+=`</div>`;

  // MIST summary line
  const moiLabel=moiObj?moiObj.label:'';
  const firstInj=(c.injuries&&c.injuries.length>0)?BODY_LABELS[c.injuries[0].region]||'':'';
  if(moiLabel||firstInj){
    h+=`<div style="font-size:12px;color:var(--t3);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">`;
    if(moiLabel)h+=`${escapeHtml(moiLabel)}`;
    if(firstInj)h+=` · ${escapeHtml(firstInj)}`;
    if(tqs.length)h+=` · ח"ע ${escapeHtml(getTqElapsed(tqs[0].time).str)}`;
    h+=`</div>`;
  }

  // Row 2: treatments + evac
  const treatments=c.treatments||[];
  if(tqs.length||treatments.length||evacd){
    h+=`<div class="mci-card-row" style="margin-top:4px">`;
    tqs.forEach(tq=>{const e=getTqElapsed(tq.time);h+=`<span class="mci-tq-timer${e.alert?' overdue':''}" data-tq-time="${escapeHtml(String(tq.time))}">🔴ח"ע ${e.str}</span>`;});
    treatments.forEach(t=>{if(t.type!=='tourniquet')h+=`<span style="font-size:10px">${TREATMENT_ICONS[t.type]||'💊'}</span>`;});
    h+=`<span style="flex:1"></span>`;
    if(evacd&&vehicleInfo){
      h+=`<span class="mci-evac-badge" style="background:rgba(46,204,113,.15);color:var(--gr)">🚑 ${escapeHtml(vehicleInfo.type)} ${vehicleInfo.destination?'→ '+escapeHtml(vehicleInfo.destination):''}</span>`;
    } else if(!evacd&&tc==='red'){
      h+=`<button class="mci-evac-badge" style="background:rgba(231,76,60,.12);color:var(--re)" onclick="event.stopPropagation();openVehiclePickerById('${safeDocId}')">🚑 פנה</button>`;
    }
    h+=`</div>`;
  }

  // Expanded section
  if(expanded){
    h+=`<div class="mci-card-expand" onclick="event.stopPropagation()">`;
    // Injuries
    if(c.injuries?.length){
      h+=`<div style="font-size:12px;color:var(--t3);margin-bottom:4px;font-weight:700">פגיעות:</div>`;
      c.injuries.forEach(inj=>{
        const typeL={hemorrhage:'דימום',fracture:'שבר',burn:'כוויה',penetrating:'חודר'}[inj.type]||inj.type||'';
        const regL=BODY_LABELS[inj.region]||inj.region||'';
        h+=`<span style="font-size:12px;padding:3px 8px;border-radius:6px;background:var(--c3);color:var(--t2);margin-left:4px;display:inline-block;margin-bottom:3px">${escapeHtml(typeL)} — ${escapeHtml(regL)}</span>`;
      });
    }
    // Treatment details
    if(treatments.length){
      h+=`<div style="font-size:12px;color:var(--t3);margin:8px 0 3px;font-weight:700">טיפולים:</div>`;
      treatments.forEach(t=>{
        const icon=TREATMENT_ICONS[t.type]||'💊';
        const reg=escapeHtml(BODY_LABELS[t.region]||t.region||'');
        const tm=escapeHtml(String(t.time||''));
        h+=`<div style="font-size:12px;color:var(--t2);padding:2px 0">${icon} ${reg} (${tm})</div>`;
      });
    }
    // Action buttons
    h+=`<div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap">`;
    h+=`<button class="xabcde-btn" style="flex:1;min-height:44px;font-size:11px;border-color:var(--or);color:var(--or)" onclick="copyMCIMISTById('${safeDocId}')">📋 MIST</button>`;
    h+=`<button class="xabcde-btn" style="flex:1;min-height:44px;font-size:11px;border-color:var(--bl);color:var(--bl)" onclick="editCasualtyById('${safeDocId}')">✏️ ערוך</button>`;
    if(!evacd){h+=`<button class="xabcde-btn" style="flex:1;min-height:44px;font-size:11px;border-color:var(--gr);color:var(--gr)" onclick="openVehiclePickerById('${safeDocId}')">🚑 פנה</button>`;}
    h+=`</div>`;
    // Quick triage change (5 colors) — Tier 19: text labels inside each
    // swatch (דחוף / לא-דחוף / קל / ממתין / חלל) instead of abstract
    // letters. Long-press still required for gray/black (forcing fn).
    const tLet={red:'דחוף',yellow:'עדיפות שנייה',green:'לא דחוף',gray:'ממתין',black:'ללא סימני חיים'};
    const tLab={red:'דחוף',yellow:'עדיפות שנייה',green:'לא דחוף',gray:'ממתין',black:'ללא סימני חיים'};
    h+=`<div style="display:flex;gap:4px;margin-top:6px">`;
    ['red','yellow','green','gray','black'].forEach(color=>{
      const on=tc===color;
      const requiresHold=(color==='gray'||color==='black');
      const handler=requiresHold
        ? `_armTriageHold('${safeDocId}','${color}',this)`
        : `quickChangeTriageById('${safeDocId}','${color}')`;
      const onDown=requiresHold?`_armTriageHold('${safeDocId}','${color}',this)`:'';
      const onUp=requiresHold?`_releaseTriageHold(this)`:'';
      h+=`<button class="trg-btn" aria-label="שנה טריאז' ${tLab[color]} ${requiresHold?'(לחיצה ארוכה)':''}" `;
      h+=`${requiresHold?`onpointerdown="${onDown}" onpointerup="${onUp}" onpointercancel="${onUp}" onpointerleave="${onUp}"`:`onclick="${handler}"`} `;
      h+=`style="flex:1;min-height:48px;padding:4px 2px;border-radius:8px;border:2px solid ${TRIAGE_COLORS[color]};background:${on?TRIAGE_COLORS[color]+'40':TRIAGE_COLORS[color]+'15'};color:${on?'#fff':TRIAGE_COLORS[color]};cursor:pointer;font-family:var(--f);font-size:11px;font-weight:800;line-height:1.1;text-align:center;word-break:keep-all">${tLet[color]}</button>`;
    });
    h+=`</div>`;
    // Priority controls (Tier 14): commander can bump treatment and
    // evac order with ↑/↓/✏ — numbers auto-seed from triage color.
    const tp=_effectivePriority(c,'treatmentPriority');
    const ep=_effectivePriority(c,'evacOrder');
    h+=`<div style="display:flex;gap:6px;margin-top:8px;align-items:center">`;
    h+=`<span style="font-size:10px;color:var(--t3);flex:1">💊 עדיפות טיפול</span>`;
    h+=`<button onclick="bumpTreatmentPriority('${safeDocId}',-1)" aria-label="הקדם" style="background:var(--c3);border:1px solid var(--sep);border-radius:6px;color:var(--t2);cursor:pointer;font-size:14px;min-width:32px;min-height:32px;font-family:var(--f)">−</button>`;
    h+=`<button onclick="setTreatmentPriorityPrompt('${safeDocId}')" style="background:var(--c2);border:1px solid var(--re);border-radius:6px;color:var(--re);cursor:pointer;font-size:13px;font-weight:900;min-width:36px;min-height:32px;font-family:var(--f)">${tp}</button>`;
    h+=`<button onclick="bumpTreatmentPriority('${safeDocId}',1)" aria-label="דחה" style="background:var(--c3);border:1px solid var(--sep);border-radius:6px;color:var(--t2);cursor:pointer;font-size:14px;min-width:32px;min-height:32px;font-family:var(--f)">+</button>`;
    h+=`</div>`;
    h+=`<div style="display:flex;gap:6px;margin-top:4px;align-items:center">`;
    h+=`<span style="font-size:10px;color:var(--t3);flex:1">🚑 סדר פינוי</span>`;
    h+=`<button onclick="bumpEvacOrder('${safeDocId}',-1)" aria-label="הקדם" style="background:var(--c3);border:1px solid var(--sep);border-radius:6px;color:var(--t2);cursor:pointer;font-size:14px;min-width:32px;min-height:32px;font-family:var(--f)">−</button>`;
    h+=`<button onclick="setEvacOrderPrompt('${safeDocId}')" style="background:var(--c2);border:1px solid var(--gr);border-radius:6px;color:var(--gr);cursor:pointer;font-size:13px;font-weight:900;min-width:36px;min-height:32px;font-family:var(--f)">${ep}</button>`;
    h+=`<button onclick="bumpEvacOrder('${safeDocId}',1)" aria-label="דחה" style="background:var(--c3);border:1px solid var(--sep);border-radius:6px;color:var(--t2);cursor:pointer;font-size:14px;min-width:32px;min-height:32px;font-family:var(--f)">+</button>`;
    h+=`</div>`;
    // Delete button
    // Bracelet/QR share link — a printed QR encoding this URL pairs
    // the bracelet to this casualty for any phone that scans it.
    // Bracelet export — primary handoff path. Promoted to a full button
    // so it's accessible without entering the casualty form.
    h+=`<button onclick="openBraceletFromCard('${safeDocId}')" style="width:100%;margin-top:6px;padding:10px;border-radius:8px;border:1.5px solid var(--pu);background:rgba(155,89,182,.12);color:var(--pu);font-size:12px;font-weight:800;cursor:pointer;font-family:var(--f);min-height:44px">🔖 צמיד נפגע (קוד + PIN)</button>`;
    h+=`<button onclick="copyCasualtyShareLink('${safeDocId}')" style="width:100%;margin-top:6px;padding:8px;border-radius:8px;border:1px solid var(--bl);background:rgba(52,152,219,.08);color:var(--bl);font-size:11px;font-weight:700;cursor:pointer;font-family:var(--f);min-height:36px">🔗 העתק קישור</button>`;
    h+=`<button onclick="deleteCasualtyById('${safeDocId}')" style="width:100%;margin-top:6px;padding:8px;border-radius:8px;border:1px solid var(--re);background:none;color:var(--re);font-size:11px;font-weight:600;cursor:pointer;font-family:var(--f);min-height:36px">🗑 מחק נפגע</button>`;
    h+=`</div>`;
  }
  h+=`</div>`;
  return h;
}
function toggleMCICardExpand(id){_mciExpandedCard=_mciExpandedCard===id?null:id;MedHost.renderIncidentPage();}
// Tier 18a: forcing-function long-press for destructive triage changes.
// 600ms hold on gray/black fires the change. Visual progress via box-shadow.
let _triageHoldTimer=null;
function _armTriageHold(docId,color,btn){
  _releaseTriageHold(btn);
  if(navigator.vibrate)navigator.vibrate(15);
  btn.style.transition='box-shadow 600ms linear, transform 100ms';
  btn.style.boxShadow=`inset 0 0 0 999px ${TRIAGE_COLORS[color]}55`;
  btn.style.transform='scale(.96)';
  _triageHoldTimer=setTimeout(()=>{
    if(navigator.vibrate)navigator.vibrate([60,40,60]);
    quickChangeTriageById(docId,color);
    _releaseTriageHold(btn);
  },600);
}
function _releaseTriageHold(btn){
  if(_triageHoldTimer){clearTimeout(_triageHoldTimer);_triageHoldTimer=null;}
  if(btn){btn.style.boxShadow='';btn.style.transform='';}
}
async function quickChangeTriage(idx,color){
  const c=_incidentCasualties[idx];if(!c||!c._docId)return;
  const oldColor=c.triageColor||'';
  const emoji=({red:'🔴',yellow:'🟡',green:'🟢',gray:'🔘',black:'⬛'})[color]||'';
  if(!_canWriteCloud()){
    // Offline — mutate the local store; undo reverts the same way.
    _upsertOfflineCasualty({...c,triageColor:color,_pendingOffline:true});
    mciToast(`📴 ${escapeHtml(c.name||'')} → ${emoji}`,()=>{_upsertOfflineCasualty({...c,triageColor:oldColor,_pendingOffline:true});});
    if(navigator.vibrate)navigator.vibrate(15);
    return;
  }
  try{
    await window.FB.setDoc(window.FB.doc(window.FB.fbDb,'teams',curTeamId,'alerts',_incidentAlertId,'casualties',c._docId),{triageColor:color},{merge:true});
    mciToast(`${escapeHtml(c.name||'')} → ${emoji}`,async()=>{try{await window.FB.setDoc(window.FB.doc(window.FB.fbDb,'teams',curTeamId,'alerts',_incidentAlertId,'casualties',c._docId),{triageColor:oldColor},{merge:true});}catch(e){MedHost.toast('שגיאה בביטול',false);}});
    if(navigator.vibrate)navigator.vibrate(15);
  }catch(e){
    if(e && e.code==='permission-denied')MedHost.toast('אין הרשאה',false);
    else if(e && e.code==='unavailable')MedHost.toast('ייסונכרן כשיחזור חיבור',false);
    else MedHost.toast('שגיאה',false);
  }
}
async function deleteCasualtyById(docId){
  // Tier 23a: offline-capable delete. If FB unavailable, remove from
  // the local offline store (which is what MCI uses offline anyway).
  const c=_incidentCasualties.find(x=>x._docId===docId);if(!c){MedHost.toast('נפגע לא נמצא',false);return;}
  const backup={};for(const k in c){if(k==='_docId'||k==='id'||k==='timestamp')continue;backup[k]=c[k];}
  if(!_canWriteCloud()){
    _removeOfflineCasualty(docId);
    mciToast(`📴 נמחק: ${escapeHtml(c.name||'')} (מקומי)`,()=>{_upsertOfflineCasualty({...backup,_docId:docId,id:docId,_pendingOffline:true,timestamp:{toDate:()=>new Date()}});});
    if(navigator.vibrate)navigator.vibrate(30);
    if(_mciExpandedCard===docId)_mciExpandedCard=null;
    MedHost.renderIncidentPage();
    return;
  }
  try{
    await window.FB.deleteDoc(window.FB.doc(window.FB.fbDb,'teams',curTeamId,'alerts',_incidentAlertId,'casualties',docId));
    mciToast(`נמחק: ${escapeHtml(c.name||'')}`,async()=>{
      try{
        backup.timestamp=window.FB.serverTimestamp();
        await window.FB.setDoc(window.FB.doc(window.FB.fbDb,'teams',curTeamId,'alerts',_incidentAlertId,'casualties',docId),backup);
      }catch(e){MedHost.toast('שגיאה בביטול',false);}
    });
    if(navigator.vibrate)navigator.vibrate(30);
    if(_mciExpandedCard===docId)_mciExpandedCard=null;
    MedHost.renderIncidentPage();
  }catch(e){MedHost.toast('שגיאה במחיקה',false);}
}
function copyMCIMIST(idx){
  const c=_incidentCasualties[idx];if(!c)return;
  const S=sanitizeExport;
  const moiObj=MOI_TYPES.find(m=>m.id===c.moi);
  const injuries=S((c.injuries||[]).map(i=>bodyLabelOut(i.region)+' ('+({hemorrhage:'דימום',fracture:'שבר',burn:'כוויה',penetrating:'חודר'}[i.type]||'')+')').join(', ')||'לא ידוע');
  const lastV=c.vitalsHistory?.length?c.vitalsHistory[c.vitalsHistory.length-1]:null;
  const vitals=lastV?S(vitalsOutText(lastV)):'לא נמדדו';
  const avpu=S(consciousnessOutText(c.xabcde)||'—');
  const treatments=S((c.treatments||[]).map(t=>_txHe(t.type)+' '+bodyLabelOut(t.region)).join(', ')||'לא תועדו');
  const text=`MIST — ${S(c.name||'ללא שם')}\nM: ${S(moiObj?moiObj.label:'לא ידוע')}\nI: ${injuries}\nS: ${vitals}\nהכרה: ${avpu}\nT: ${treatments}`;
  navigator.clipboard?.writeText(text).then(()=>MedHost.toast('MIST הועתק ✓',false)).catch(()=>MedHost.toast('שגיאה',false));
}
// _mciRapidStep, _mciRapidName, _mciRapidCounts moved to shared/medical-forms.js
let _saltStep='sort',_saltIdType='חייל',_saltIdCounter={חייל:0,אזרח:0,ילד:0,נקבה:0};
// ═══ SABC TRIAGE WIZARD (Tier 13) ═══
// Per-step rapid assessment with auto-classification. Replaces SALT as
// the default entry; SALT stays reachable via a toggle for teams that
// prefer it. Matches IDF primary-survey ordering: S-A-B-C.
function _sabcAutoClassify(){
  const f=_sabcFindings;
  const s=f.s;
  // Not breathing (after airway opened): carotid absent -> deceased;
  // pulse present -> RED (apnoeic with pulse is salvageable); unknown pulse -> expectant pending check.
  if(f.b.breathing==='none'){
    if(f.c.carotidPulse==='absent')return'black';
    if(f.c.carotidPulse==='present'||f.c.radialPulse==='strong'||f.c.radialPulse==='weak')return'red';
    return'gray';
  }
  const hasTq=(s.controls||[]).includes('tq');
  const uncontrolled=(s.controls||[]).includes('uncontrolled');
  const shockRadial=f.c.radialPulse==='weak'||f.c.radialPulse==='absent';
  const tachypnea=f.b.breathing==='fast';
  const sys=parseInt(f.c.bp)||null;
  if(hasTq||uncontrolled||f.a.obeys==='no'||f.a.avpu==='P'||f.a.avpu==='U'||f.a.airwayThreat==='obstructed'||f.b.breathing==='slow'||shockRadial||tachypnea||(f.b.spo2&&f.b.spo2<90)||f.b.chestFinding==='penetrating'||f.b.chestFinding==='flail'||(sys&&sys<90))return'red';
  if((s.controls||[]).includes('walk'))return'green';
  return'yellow';
}
function _sabcLsKey(){return 'sh_sabc_'+(_incidentAlertId||'local');}
function _persistSabc(){try{localStorage.setItem(_sabcLsKey(),JSON.stringify({step:_sabcStep,f:_sabcFindings}));}catch(e){}}
function _readSabc(){try{return JSON.parse(localStorage.getItem(_sabcLsKey())||'null');}catch(e){return null;}}
function _clearSabc(){try{localStorage.removeItem(_sabcLsKey());}catch(e){}}
// Tier 20b: retrofit SABC onto an existing un-triaged casualty. Runs
// the wizard as a picker — on classify, writes the chosen triage
// color back to the casualty instead of creating a new one.
// _sabcRetrofitDocId declared in shared/medical-forms.js
function openSabcForCasualty(docId){
  _sabcRetrofitDocId=docId;
  _sabcMode=true;
  _sabcStep='S';
  _sabcFindings={
    s:{bleedingSource:null,controls:[]},
    a:{avpu:null,airwayThreat:null},
    b:{breathing:null,spo2:null,chestFinding:null},
    c:{radialPulse:null,carotidPulse:null,bp:null},
    classification:null
  };
  _mciShowRapidTriage=true;
  MedHost.renderIncidentPage();
}
function startSabcWizard(){
  _sabcMode=true;
  // Tier 18e: rehydrate previous in-progress wizard if any.
  const saved=_readSabc();
  if(saved && saved.step && saved.step!=='S'){
    _sabcStep=saved.step;
    _sabcFindings=saved.f||_sabcFindings;
    MedHost.toast('ממשיך הערכה משלב '+_sabcStep,false);
  } else {
    _sabcStep='S';
    _sabcFindings={
      s:{bleedingSource:null,controls:[]},
      a:{avpu:null,airwayThreat:null},
      b:{breathing:null,spo2:null,chestFinding:null},
      c:{radialPulse:null,carotidPulse:null,bp:null},
      classification:null
    };
  }
  _mciShowRapidTriage=true;
  MedHost.renderIncidentPage();
}
function sabcNext(){
  const order=['S','A','B','C','classify'];
  const i=order.indexOf(_sabcStep);
  if(i<order.length-1){_sabcStep=order[i+1];_persistSabc();MedHost.renderIncidentPage();}
}
function sabcBack(){
  const order=['S','A','B','C','classify'];
  const i=order.indexOf(_sabcStep);
  if(i>0){_sabcStep=order[i-1];_persistSabc();MedHost.renderIncidentPage();}
}
async function sabcCommitCasualty(overrideColor){
  const color=overrideColor||_sabcFindings.classification||_sabcAutoClassify();
  // Tier 20b: retrofit path — wizard opened on existing casualty.
  if(_sabcRetrofitDocId){
    const docId=_sabcRetrofitDocId;
    _sabcRetrofitDocId=null;
    try{
      await window.FB.setDoc(
        window.FB.doc(window.FB.fbDb,'teams',curTeamId,'alerts',_incidentAlertId,'casualties',docId),
        {triageColor:color,evacPriority:color==='red'?'immediate':color==='yellow'?'urgent':color==='gray'?'expectant':color==='black'?'deceased':'routine'},
        {merge:true}
      );
      MedHost.toast('סווג: '+({red:'דחוף',yellow:'עדיפות שנייה',green:'לא דחוף',gray:'ממתין',black:'ללא סימני חיים'})[color],false);
      if(navigator.vibrate)navigator.vibrate(20);
    }catch(e){MedHost.toast('שגיאה בסיווג',false);}
  } else {
    await quickTriageCasualty(color);
  }
  // Tier 21: keep _sabcMode=true so next open stays SABC (not SALT).
  _sabcStep='S';_mciShowRapidTriage=false;
  _clearSabc();
  MedHost.renderIncidentPage();
}
// Auto-commit partial SABC on page hide so a radio-call doesn't lose
// the in-progress assessment. Commits as the auto-classification color.
window.addEventListener('beforeunload',()=>{try{if(_sabcMode)_persistSabc();}catch(e){}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden' && _sabcMode){try{_persistSabc();}catch(e){}}});

// ── [SABC wizard (_sabcAutoClassify/_persistSabc/_readSabc/_clearSabc/openSabcForCasualty/startSabcWizard/sabcNext/sabcBack/sabcCommitCasualty/renderSabcWizard/renderRapidTriageWizard)] from beta lines 7814-7972 ──
function renderSabcWizard(){
  const f=_sabcFindings;
  const step=_sabcStep;
  let h=`<div style="background:rgba(52,152,219,.06);border:1.5px solid rgba(52,152,219,.3);border-radius:12px;padding:14px;margin-top:6px">`;
  h+=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">`;
  h+=`<div style="font-size:14px;font-weight:900;color:var(--bl)">⚡ SABC טריאז׳ — #${_incidentCasualties.length+1}</div>`;
  h+=`<button onclick="_mciShowRapidTriage=false;_sabcStep='S';MedHost.renderIncidentPage()" aria-label="סגור" style="background:var(--c3);border:none;border-radius:50%;width:32px;height:32px;color:var(--t2);cursor:pointer;font-size:14px;min-height:32px">✕</button>`;
  h+=`</div>`;
  // Step indicator
  // Tier 23b: step chips tappable — clicking S/A/B/C jumps to that step.
  h+=`<div style="display:flex;gap:4px;margin-bottom:10px">`;
  ['S','A','B','C','classify'].forEach(s=>{
    const on=step===s;
    const lbl=s==='classify'?'סיווג':s;
    h+=`<button onclick="_sabcStep='${s}';_persistSabc();MedHost.renderIncidentPage();if(navigator.vibrate)navigator.vibrate(10)" aria-label="עבור לשלב ${lbl}" style="flex:1;padding:10px 4px;border-radius:8px;border:${on?'2px solid var(--bl)':'1px solid var(--sep)'};background:${on?'rgba(52,152,219,.22)':'var(--c3)'};color:${on?'var(--bl)':'var(--t2)'};font-size:14px;font-weight:${on?'900':'700'};cursor:pointer;font-family:var(--f);min-height:44px;transition:transform .1s,background .12s" ontouchstart="this.style.transform='scale(.93)'" ontouchend="this.style.transform=''" onmousedown="this.style.transform='scale(.93)'" onmouseup="this.style.transform=''" onmouseleave="this.style.transform=''">${lbl}</button>`;
  });
  h+=`</div>`;
  // Per-step body
  if(step==='S'){
    h+=`<div style="font-size:12px;font-weight:700;color:var(--tx);margin-bottom:6px">S — זיהוי ועצירת דימום פורץ</div>`;
    h+=`<div style="font-size:10px;color:var(--t3);margin-bottom:6px">האם יש דימום מזהה? סמן אמצעי בקרה שהופעלו:</div>`;
    [{k:'tq',l:'🔴 חסם עורקים (ח"ע)'},{k:'pack',l:'🟫 אריזת פצע'},{k:'pressure',l:'⬜ תחבושת לחץ'},{k:'hemostatic',l:'🟧 המוסטטי'},{k:'uncontrolled',l:'⚠️ דימום לא נשלט'},{k:'walk',l:'🟢 מסוגל ללכת'},{k:'none',l:'ללא דימום פורץ'}].forEach(o=>{
      const on=(f.s.controls||[]).includes(o.k);
      h+=`<button onclick="const a=_sabcFindings.s.controls||[];const i=a.indexOf('${o.k}');if(i>=0)a.splice(i,1);else a.push('${o.k}');_sabcFindings.s.controls=a;MedHost.renderIncidentPage()" style="width:100%;padding:12px;border-radius:10px;border:1.5px solid ${on?'var(--re)':'var(--sep)'};background:${on?'rgba(231,76,60,.15)':'none'};color:${on?'var(--re)':'var(--t2)'};font-size:13px;font-weight:700;cursor:pointer;font-family:var(--f);margin-bottom:4px;min-height:44px;text-align:right">${o.l}</button>`;
    });
  } else if(step==='A'){
    h+=`<div style="font-size:12px;font-weight:700;color:var(--tx);margin-bottom:6px">A — הכרה ונתיב אוויר</div>`;
    h+=`<div style="font-size:10px;color:var(--t3);margin-bottom:6px">AVPU:</div>`;
    h+=`<div style="display:flex;gap:4px;margin-bottom:10px">`;
    [{v:'A',l:'ערני'},{v:'V',l:'קול'},{v:'P',l:'כאב'},{v:'U',l:'אין'}].forEach(a=>{
      const on=f.a.avpu===a.v;
      h+=`<button onclick="_sabcFindings.a.avpu='${a.v}';MedHost.renderIncidentPage()" class="xabcde-btn" style="flex:1;min-height:44px;font-size:12px;${on?'background:rgba(155,89,182,.2);border-color:#9b59b6;color:#9b59b6':''}">${a.l}</button>`;
    });
    h+=`</div>`;
    h+=`<div style="font-size:10px;color:var(--t3);margin-bottom:6px">ממלא פקודות פשוטות?</div>`;
    h+=`<div style="display:flex;gap:4px;margin-bottom:10px">`;
    [{v:'yes',l:'כן',c:'var(--gr)'},{v:'no',l:'לא',c:'var(--re)'}].forEach(o=>{const on=f.a.obeys===o.v;h+=`<button onclick="_sabcFindings.a.obeys='${o.v}';MedHost.renderIncidentPage()" class="xabcde-btn" style="flex:1;min-height:44px;font-size:12px;border-color:${o.c};color:${o.c};${on?'background:'+o.c+'25':''}">${o.l}</button>`;});
    h+=`</div>`;
    h+=`<div style="font-size:10px;color:var(--t3);margin-bottom:6px">איום על נתיב אוויר:</div>`;
    h+=`<div style="display:flex;gap:4px">`;
    [{v:'clear',l:'פתוח ✓',c:'var(--gr)'},{v:'risk',l:'חשד',c:'var(--ye)'},{v:'obstructed',l:'חסום',c:'var(--re)'}].forEach(o=>{
      const on=f.a.airwayThreat===o.v;
      h+=`<button onclick="_sabcFindings.a.airwayThreat='${o.v}';MedHost.renderIncidentPage()" class="xabcde-btn" style="flex:1;min-height:44px;font-size:12px;border-color:${o.c};color:${o.c};${on?'background:'+o.c+'25':''}">${o.l}</button>`;
    });
    h+=`</div>`;
  } else if(step==='B'){
    h+=`<div style="font-size:12px;font-weight:700;color:var(--tx);margin-bottom:6px">B — נשימה וחשיפת חזה</div>`;
    h+=`<div style="font-size:10px;color:var(--t3);margin-bottom:6px">נשימה:</div>`;
    h+=`<div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap">`;
    [{v:'normal',l:'תקינה',c:'var(--gr)'},{v:'fast',l:'מהירה >30',c:'var(--ye)'},{v:'slow',l:'איטית <10',c:'var(--re)'},{v:'none',l:'אין',c:'var(--re-hi)'}].forEach(o=>{
      const on=f.b.breathing===o.v;
      h+=`<button onclick="_sabcFindings.b.breathing='${o.v}';MedHost.renderIncidentPage()" class="xabcde-btn" style="flex:1;min-width:80px;min-height:44px;font-size:11px;border-color:${o.c};color:${o.c};${on?'background:'+o.c+'25':''}">${o.l}</button>`;
    });
    h+=`</div>`;
    h+=`<div style="font-size:10px;color:var(--t3);margin-bottom:6px">ממצא חזה:</div>`;
    h+=`<div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap">`;
    [{v:'normal',l:'ללא ממצא'},{v:'penetrating',l:'חודר'},{v:'flail',l:'לא סימטרי'},{v:'bruise',l:'חבלה'}].forEach(o=>{
      const on=f.b.chestFinding===o.v;
      h+=`<button onclick="_sabcFindings.b.chestFinding='${o.v}';MedHost.renderIncidentPage()" class="xabcde-btn" style="flex:1;min-width:70px;min-height:44px;font-size:11px;${on?'background:rgba(26,188,156,.15);border-color:var(--cy);color:var(--cy)':''}">${o.l}</button>`;
    });
    h+=`</div>`;
    h+=`<div style="font-size:10px;color:var(--t3);margin-bottom:6px">SpO2 (אופציונלי):</div>`;
    h+=`<input class="fi" type="number" min="50" max="100" placeholder="95" value="${f.b.spo2||''}" oninput="_sabcFindings.b.spo2=parseInt(this.value)||null" style="font-size:14px;padding:10px;min-height:44px">`;
  } else if(step==='C'){
    h+=`<div style="font-size:12px;font-weight:700;color:var(--tx);margin-bottom:6px">C — מחזור הדם</div>`;
    h+=`<div style="font-size:10px;color:var(--t3);margin-bottom:6px">דופק רדיאלי:</div>`;
    h+=`<div style="display:flex;gap:4px;margin-bottom:8px">`;
    [{v:'strong',l:'חזק',c:'var(--gr)'},{v:'weak',l:'חלש',c:'var(--ye)'},{v:'absent',l:'אין',c:'var(--re)'}].forEach(o=>{
      const on=f.c.radialPulse===o.v;
      h+=`<button onclick="_sabcFindings.c.radialPulse='${o.v}';MedHost.renderIncidentPage()" class="xabcde-btn" style="flex:1;min-height:44px;font-size:12px;border-color:${o.c};color:${o.c};${on?'background:'+o.c+'25':''}">${o.l}</button>`;
    });
    h+=`</div>`;
    if(f.c.radialPulse==='absent'||f.b.breathing==='none'){
      h+=`<div style="font-size:10px;color:var(--t3);margin-bottom:6px">דופק קרוטידי:</div>`;
      h+=`<div style="display:flex;gap:4px;margin-bottom:8px">`;
      [{v:'present',l:'קיים',c:'var(--ye)'},{v:'absent',l:'אין',c:'var(--re-hi)'}].forEach(o=>{
        const on=f.c.carotidPulse===o.v;
        h+=`<button onclick="_sabcFindings.c.carotidPulse='${o.v}';MedHost.renderIncidentPage()" class="xabcde-btn" style="flex:1;min-height:44px;font-size:12px;border-color:${o.c};color:${o.c};${on?'background:'+o.c+'25':''}">${o.l}</button>`;
      });
      h+=`</div>`;
    }
    h+=`<div style="font-size:10px;color:var(--t3);margin-bottom:6px">לחץ דם סיסטולי (חובה אם חשד להלם):</div>`;
    h+=`<input class="fi" type="number" min="0" max="250" placeholder="110" value="${f.c.bp||''}" oninput="_sabcFindings.c.bp=this.value" style="font-size:14px;padding:10px;min-height:44px">`;
  } else if(step==='classify'){
    const auto=_sabcAutoClassify();
    const labels={red:'🔴 דחוף',yellow:'🟡 עדיפות שנייה',green:'🟢 לא דחוף',gray:'🔘 ממתין',black:'⬛ ללא סימני חיים'};
    h+=`<div style="font-size:12px;font-weight:700;color:var(--tx);margin-bottom:6px">סיווג — המערכת ממליצה, אתה מחליט</div>`;
    h+=`<div style="background:${TRIAGE_COLORS[auto]||'#888'}30;border:2px solid ${TRIAGE_COLORS[auto]||'#888'};border-radius:12px;padding:10px;margin-bottom:10px;text-align:center">`;
    h+=`<div style="font-size:11px;color:var(--t3);margin-bottom:4px">המלצה אוטומטית:</div>`;
    h+=`<div style="font-size:18px;font-weight:900;color:${TRIAGE_COLORS[auto]||'#888'}">${labels[auto]}</div>`;
    h+=`</div>`;
    h+=`<div style="font-size:11px;color:var(--t3);margin-bottom:6px">לחץ לאישור או בחר סיווג אחר:</div>`;
    ['red','yellow','green','gray','black'].forEach(c=>{
      const isAuto=c===auto;
      h+=`<button class="trg-btn" onclick="sabcCommitCasualty('${c}')" style="width:100%;padding:14px;border-radius:12px;border:2.5px solid ${TRIAGE_COLORS[c]};background:${TRIAGE_COLORS[c]}${isAuto?'30':'10'};color:${TRIAGE_COLORS[c]};cursor:pointer;font-family:var(--f);text-align:center;margin-bottom:6px;min-height:52px;font-size:14px;font-weight:${isAuto?'900':'700'}">${labels[c]}${isAuto?' ✓ המלצה':''}</button>`;
    });
  }
  // Nav
  h+=`<div style="display:flex;gap:6px;margin-top:12px">`;
  if(step!=='S')h+=`<button onclick="sabcBack()" class="xabcde-btn" style="flex:1;min-height:44px;font-size:12px">← קודם</button>`;
  if(step!=='classify')h+=`<button onclick="sabcNext()" class="xabcde-btn" style="flex:2;min-height:44px;font-size:13px;font-weight:700;border-color:var(--bl);color:var(--bl);background:rgba(52,152,219,.08)">הבא →</button>`;
  h+=`</div>`;
  // Toggle to legacy SALT
  h+=`<button onclick="quickAddWithoutTriage()" style="width:100%;margin-top:8px;padding:12px;border-radius:10px;border:1.5px dashed var(--bl);background:rgba(52,152,219,.08);color:var(--bl);font-size:12px;font-weight:700;cursor:pointer;font-family:var(--f);min-height:44px">+ הוסף עכשיו, טריאז׳ אחר כך</button>`;
  // Tier 21: SALT toggle removed — SABC is the only wizard per user spec.
  h+=`</div>`;
  return h;
}
function renderRapidTriageWizard(){
  // Tier 21: SABC is the only wizard. SALT removed per user spec.
  return renderSabcWizard();
  let h=`<div style="background:rgba(231,76,60,.06);border:1.5px solid rgba(231,76,60,.2);border-radius:12px;padding:14px;margin-top:6px">`;
  h+=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">`;
  h+=`<div style="font-size:14px;font-weight:900;color:var(--re)">⚡ SALT טריאז\' — #${_incidentCasualties.length+1}</div>`;
  h+=`<button onclick="_mciShowRapidTriage=false;_saltStep='sort';MedHost.renderIncidentPage()" style="background:var(--c3);border:none;border-radius:50%;width:28px;height:28px;color:var(--t2);cursor:pointer;font-size:14px">✕</button>`;
  h+=`</div>`;
  // Visual Quick-ID
  h+='<div style="display:flex;gap:4px;margin-bottom:6px">';
  ['👤 חייל','👨 אזרח','👶 ילד','👩 נקבה'].forEach(id=>{
    const type=id.split(' ')[1];const on=_saltIdType===type;
    h+=`<button onclick="_saltIdType='${type}';_mciRapidName='${type} '+(_saltIdCounter['${type}']+1);MedHost.renderIncidentPage()" style="flex:1;padding:8px 4px;border-radius:8px;border:1.5px solid ${on?'var(--bl)':'var(--sep)'};background:${on?'rgba(52,152,219,.1)':'none'};color:${on?'var(--bl)':'var(--t3)'};font-size:10px;font-weight:700;cursor:pointer;font-family:var(--f);min-height:40px">${id}</button>`;
  });
  h+='</div>';
  // oninput (not onchange) so rapid triage in <90s doesn't lose the
  // typed name — onchange only fires on blur, and there's no blur
  // between tapping triage colors.
  h+=`<input class="fi" id="mci-rapid-name" placeholder="שם (אופציונלי)" value="${escapeHtml(_mciRapidName||_saltIdType+' '+(_saltIdCounter[_saltIdType]+1))}" oninput="_mciRapidName=this.value" style="margin-bottom:8px;font-size:13px;padding:10px;min-height:44px">`;

  if(_saltStep==='sort'){
    // SALT Step 1: Sort
    h+='<div style="font-size:11px;font-weight:700;color:var(--tx);margin-bottom:6px;text-align:center">שלב 1: מיון ראשוני</div>';
    h+=`<button class="trg-btn" onclick="quickTriageCasualty('green')" style="width:100%;padding:16px;border-radius:12px;border:2.5px solid ${TRIAGE_COLORS.green};background:${TRIAGE_COLORS.green}15;color:${TRIAGE_COLORS.green};cursor:pointer;font-family:var(--f);text-align:center;margin-bottom:6px;min-height:64px;touch-action:manipulation"><div style="font-size:16px;font-weight:900">🚶 מהלך</div><div style="font-size:9px;margin-top:3px;opacity:.7">הולך בכוחות עצמו → ירוק</div></button>`;
    h+=`<button class="trg-btn" onclick="_saltStep='assess';MedHost.renderIncidentPage()" style="width:100%;padding:16px;border-radius:12px;border:2.5px solid ${TRIAGE_COLORS.yellow};background:${TRIAGE_COLORS.yellow}12;color:${TRIAGE_COLORS.yellow};cursor:pointer;font-family:var(--f);text-align:center;margin-bottom:6px;min-height:64px;touch-action:manipulation"><div style="font-size:16px;font-weight:900">👋 מניף יד / פעולה כוונתית</div><div style="font-size:9px;margin-top:3px;opacity:.7">בהכרה אך לא מהלך → הערכה</div></button>`;
    h+=`<button class="trg-btn" onclick="_saltStep='assess';MedHost.renderIncidentPage()" style="width:100%;padding:16px;border-radius:12px;border:2.5px solid ${TRIAGE_COLORS.red};background:${TRIAGE_COLORS.red}12;color:${TRIAGE_COLORS.red};cursor:pointer;font-family:var(--f);text-align:center;margin-bottom:6px;min-height:64px;touch-action:manipulation"><div style="font-size:16px;font-weight:900">🛌 שוכב ללא תגובה</div><div style="font-size:9px;margin-top:3px;opacity:.7">לא מגיב → הערכה דחופה</div></button>`;
  } else {
    // SALT Step 2-3: Assess — includes green option so a "waving"
    // casualty who turns out to be stable-ambulatory can be assigned
    // without backing out to sort.
    h+='<div style="font-size:11px;font-weight:700;color:var(--tx);margin-bottom:6px;text-align:center">שלב 2: הערכה</div>';
    [{c:'red',l:'🔴 דחוף',desc:'נשימה >30 / דופק חלש / לא ממלא פקודות'},{c:'yellow',l:'🟡 עדיפות שנייה',desc:'ממלא פקודות / נשימה תקינה / ללא סימני הלם'},{c:'green',l:'🟢 קל',desc:'ממלא פקודות, יכול ללכת / ממשיך בכוחות עצמו'},{c:'gray',l:'🔘 ציפייה',desc:'פגיעה לא הישרדותית / משאבים מוגבלים'},{c:'black',l:'⬛ נפטר',desc:'לא נושם גם אחרי פתיחת נתיב אוויר'}].forEach(t=>{
      h+=`<button class="trg-btn" onclick="_saltStep='sort';quickTriageCasualty('${t.c}')" style="width:100%;padding:14px;border-radius:12px;border:2.5px solid ${TRIAGE_COLORS[t.c]};background:${TRIAGE_COLORS[t.c]}12;color:${TRIAGE_COLORS[t.c]};cursor:pointer;font-family:var(--f);text-align:center;margin-bottom:6px;min-height:60px;touch-action:manipulation"><div style="font-size:16px;font-weight:900">${t.l}</div><div style="font-size:10px;margin-top:3px;opacity:.8">${t.desc}</div></button>`;
    });
    h+=`<button onclick="_saltStep='sort';MedHost.renderIncidentPage()" style="background:none;border:none;color:var(--t4);font-size:11px;cursor:pointer;font-family:var(--f);display:block;width:100%;text-align:center;margin-top:4px;min-height:36px">← חזור למיון</button>`;
  }
  // Running count
  const rc=_mciRapidCounts;
  const total=rc.red+rc.yellow+rc.green+rc.gray+rc.black;
  if(total>0){
    h+=`<div style="text-align:center;font-size:10px;color:var(--t3);margin-top:6px;padding:6px;background:var(--c3);border-radius:8px">נוספו: `;
    if(rc.red)h+=`<span style="color:#e74c3c;font-weight:700">${rc.red}🔴</span> `;
    if(rc.yellow)h+=`<span style="color:#f1c40f;font-weight:700">${rc.yellow}🟡</span> `;
    if(rc.green)h+=`<span style="color:#2ecc71;font-weight:700">${rc.green}🟢</span> `;
    if(rc.gray)h+=`<span style="color:#888;font-weight:700">${rc.gray}🔘</span> `;
    if(rc.black)h+=`<span style="color:#555;font-weight:700">${rc.black}⬛</span>`;
    h+=`</div>`;
  }
  // Tier 19: quick "add without triage now" — pushes a nameless
  // casualty and flags it for tap-to-triage on the card.
  h+=`<button onclick="quickAddWithoutTriage()" style="width:100%;margin-top:6px;padding:12px;border-radius:10px;border:1.5px dashed var(--bl);background:rgba(52,152,219,.08);color:var(--bl);font-size:12px;font-weight:700;cursor:pointer;font-family:var(--f);min-height:44px">+ הוסף עכשיו, טריאז׳ אחר כך</button>`;
  h+=`<button onclick="_mciShowRapidTriage=false;_saltStep='sort';MedHost.renderIncidentPage()" style="width:100%;margin-top:6px;padding:10px;border-radius:8px;border:1.5px solid var(--t3);background:none;color:var(--t3);font-size:11px;font-weight:700;cursor:pointer;font-family:var(--f)">סיים טריאז\'</button>`;
  h+=`</div>`;
  return h;
}

// ── advanceXCare (stage 4 bugfix) ──
function advanceXCare(){
  const order=window._xcareOrder||['x','c','a','b','e'];
  _xcareStep=Math.min(order.length-1,(_xcareStep||0)+1);
  _casualtyActiveTab=order[_xcareStep]||'e';
  MedHost.renderIncidentPage();
}

// ── renderInjurySummary (stage 4 bugfix) ──
function renderInjurySummary(){
  if(!_casualtyInjuries.length)return'<div style="font-size:11px;color:var(--t4);text-align:center;padding:6px 0">לחץ על אזור בגוף לסימון פגיעה</div>';
  const typeLabels={hemorrhage:'דימום',fracture:'שבר',burn:'כוויה',penetrating:'חודר',other:'ידני'};
  const typeColors={hemorrhage:'var(--re)',fracture:'var(--ye)',burn:'var(--or)',penetrating:'var(--pu)',other:'var(--bl)'};
  let h='';
  _casualtyInjuries.forEach((inj,idx)=>{
    const label=typeLabels[inj.type]||inj.type||'פציעה';
    const col=typeColors[inj.type]||'var(--t3)';
    const note=inj.notes?' — '+escapeHtml(String(inj.notes).slice(0,80)):'';
    h+=`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--sep)">
      <span style="color:${col};font-size:11px;font-weight:700;min-width:48px">${escapeHtml(label)}</span>
      <span style="font-size:12px;color:var(--t2);flex:1">${escapeHtml(BODY_LABELS[inj.region]||inj.region||'')} (${inj.side==='front'?'קדמי':'אחורי'})${note}</span>
      <button onclick="removeInjury(${idx})" aria-label="מחק פציעה" style="background:none;border:none;color:var(--re);font-size:14px;cursor:pointer;padding:4px 8px;min-height:32px;min-width:32px">🗑</button>
    </div>`;
  });
  const burnPct=calcBurnPercentage();
  if(burnPct>0)h+=`<div style="font-size:12px;font-weight:700;color:var(--or);margin-top:6px">🔥 אחוז כוויה: ${burnPct}% (כלל תשעות)</div>`;
  return h;
}

// Sanity check — surface in dev console on load.
if(typeof console!=='undefined'){
  console.log('[shared/medical-forms.js] loaded — constants + pure builders + exports + body map + undo available');
}
