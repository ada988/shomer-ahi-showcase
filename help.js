/* "How to use": a full-screen guide opened from the Menu. Topic list → topic page with numbered one-line steps,
   a small picture of the real control, "Show me" (opens that screen) and "Tour from here". */
(function(){
'use strict';
var W = window;
function lang(){ return (W.ShowcaseI18n && W.ShowcaseI18n.lang) || 'en'; }
function L(en, he){ return lang() === 'he' ? he : en; }
function ico(n, s){ return W.Icon ? W.Icon(n, s || 22) : ''; }
function rtl(){ return document.documentElement.dir === 'rtl'; }
function t2(a){ return lang() === 'he' ? a[1] : a[0]; }

// ── after "Show me": bring a part of the form into view ──
function inForm(sel, then){
  return Promise.resolve(W.Demo.go('casualty')).then(function(){
    setTimeout(function(){
      var el = sel && document.querySelector(sel), sc = document.getElementById('incident-content');
      if (el && sc && sc.contains(el)){ sc.scrollTop += el.getBoundingClientRect().top - sc.getBoundingClientRect().top - 12; }
      if (then) then();
    }, 350);
  });
}

// ── small pictures, drawn from the app's own vocabulary ──
var V = {
  tiles: function(){
    var k = [['red','Urgent','דחוף'],['yellow','Delayed','עדיפות שנייה'],['green','Not urgent','לא דחוף'],['black','Waiting','ממתין']];
    return '<div class="hv-tiles">' + k.map(function(x){ var sh = W.TriageUI ? W.TriageUI.shapeSvg(W.TriageUI.tg(x[0]).shape, 22) : ''; return '<span class="t-' + x[0] + '">' + sh + '<b>' + L(x[1], x[2]) + '</b></span>'; }).join('') + '</div>';
  },
  yesno: function(){
    return '<div class="hv-yn"><span class="y">' + ico('check', 30) + '<b>' + L('YES','כן') + '</b></span><span class="n">' + ico('x', 30) + '<b>' + L('NO','לא') + '</b></span></div>'
      + '<p class="hv-cap">' + L('Same colour and same place on every question','אותו צבע ואותו מקום בכל שאלה') + '</p>';
  },
  id: function(){
    return '<div class="hv-id"><span class="hv-num">1</span><span><b>' + L('Casualty 1','נפגע 1') + '</b><small>' + L('30 y · Male · 80 kg','30 · גבר · 80 ק״ג') + '</small></span><span class="hv-chip t-red">' + (W.TriageUI ? W.TriageUI.shapeSvg('oct', 18) : '') + L('Urgent','דחוף') + '</span></div>';
  },
  xcare: function(){
    var x = [['X','Bleeding','דימום'],['C','Circulation','מחזור דם'],['A','Airway','נתיב אוויר'],['R','Breathing','נשימה'],['E','Evacuate','פינוי']];
    return '<div class="hv-xc">' + x.map(function(r, k){ return '<span class="' + (k < 2 ? 'done' : '') + '"><i class="l-' + r[0] + '">' + r[0] + '</i><b>' + L(r[1], r[2]) + '</b>' + (k < 2 ? ico('check', 20) : '') + '</span>'; }).join('') + '</div>';
  },
  vitals: function(){
    return '<div class="hv-vit"><span><small>' + L('Pulse','דופק') + '</small><b>132</b></span><span><small>' + L('BP','ל״ד') + '</small><b>84/50</b></span><span><small>SpO₂</small><b>94</b></span></div>'
      + V.alert();
  },
  alert: function(){
    return '<div class="hv-alert">' + ico('droplet', 26) + '<span><b>' + L('Suspected shock — IV and blood','חשד להלם — עירוי ודם') + '</b><small>' + L('Tap for the full recommendation','לחצו להמלצה המלאה') + '</small></span></div>';
  },
  body: function(){
    return '<svg class="hv-body" viewBox="0 0 120 150" role="img" aria-label="' + L('Body map','מפת גוף') + '"><g fill="#262a33" stroke="#5b6170" stroke-width="2"><circle cx="60" cy="18" r="12"/><rect x="42" y="33" width="36" height="52" rx="12"/><rect x="24" y="36" width="14" height="48" rx="7"/><rect x="82" y="36" width="14" height="48" rx="7"/><rect x="44" y="86" width="14" height="58" rx="7"/><rect x="62" y="86" width="14" height="58" rx="7"/></g>'
      + '<g><circle cx="69" cy="112" r="9" fill="#e5484d"/><text x="69" y="116" text-anchor="middle" font-size="11" font-weight="800" fill="#fff">1</text><rect x="62" y="96" width="14" height="5" rx="2" fill="#f5b82e"/></g></svg>'
      + '<p class="hv-cap">' + L('Wound pin + tourniquet on the right thigh','סימון פצע + חוסם עורקים בירך ימין') + '</p>';
  },
  proc: function(){
    return '<div class="hv-chips">' + [['wind', L('AW (nasal airway)','AW')], ['activity', L('Intubation · attempt 2 ✓','אינטובציה · ניסיון 2 ✓')], ['crosshair', L('Needle decompression R','ניקור חזה ימין')], ['bandage', L('Pelvic binder','מקבע אגן')]]
      .map(function(c){ return '<span>' + ico(c[0], 20) + c[1] + '</span>'; }).join('') + '</div>';
  },
  timeline: function(){
    var r = [['00:07','Ketamine 25 mg IV','קטמין 25 מ״ג IV'],['00:05','Whole blood 500 mL','דם מלא 500 מ״ל'],['00:04','TXA 1 g IV','TXA 1 גרם IV']];
    return '<div class="hv-tl">' + r.map(function(x){ return '<span><b dir="ltr">' + x[0] + '</b><em>' + L(x[1], x[2]) + '</em>' + ico(rtl() ? 'chevron-left' : 'chevron-right', 20) + '</span>'; }).join('') + '</div>'
      + '<p class="hv-cap">' + L('Logged automatically. Tap a row to edit its time.','נרשם אוטומטית. לחיצה על שורה לעריכת השעה.') + '</p>';
  },
  dose: function(){
    return '<div class="hv-dec"><span class="g">' + ico('check', 20) + '<b>' + L('Give now','לתת עכשיו') + '</b><em>' + L('Ketamine 25 mg','קטמין 25 מ״ג') + '</em></span>'
      + '<span class="c">' + ico('gauge', 20) + '<b>' + L('Changed dose','מינון משתנה') + '</b><em>' + L('Morphine 2 mg — suspected shock','מורפין 2 מ״ג — חשד להלם') + '</em></span>'
      + '<span class="x">' + ico('x', 20) + '<b>' + L('Do not give','לא לתת') + '</b><em>' + L('Fentanyl — suspected shock','פנטניל — חשד להלם') + '</em></span></div>'
      + V.syringe();
  },
  syringe: function(){
    // 10 cc barrel: 1 cc drug (solid) + 9 cc saline (striped), push 2 cc
    return '<svg class="hv-syr" viewBox="0 0 300 92" role="img" aria-label="' + L('Syringe: 1 cc drug + 9 cc saline','מזרק: 1 סמ״ק תרופה + 9 סמ״ק סליין') + '"><defs><pattern id="hvst" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#2b4f8f"/><line x1="0" y1="0" x2="0" y2="6" stroke="#6fa0ff" stroke-width="2"/></pattern></defs>'
      + '<rect x="20" y="28" width="230" height="28" rx="5" fill="#111317" stroke="#8a90a0" stroke-width="2"/><rect x="22" y="30" width="23" height="24" fill="#6fd3ff"/><rect x="45" y="30" width="203" height="24" fill="url(#hvst)"/>'
      + '<rect x="250" y="37" width="34" height="10" fill="#8a90a0"/><rect x="284" y="27" width="6" height="30" rx="2" fill="#8a90a0"/><rect x="6" y="39" width="14" height="6" fill="#8a90a0"/>'
      + '<text x="33" y="20" font-size="17" font-weight="800" fill="#6fd3ff" text-anchor="middle">1 cc</text><text x="150" y="20" font-size="17" font-weight="800" fill="#9cbcff" text-anchor="middle">' + L('+ 9 cc saline','+ 9 סמ״ק סליין') + '</text>'
      + '<text x="150" y="82" font-size="16" font-weight="700" fill="#c9ced6" text-anchor="middle">' + L('= 10 cc · 1 mg/cc · push 2 cc','= 10 סמ״ק · 1 מ״ג/סמ״ק · להזריק 2 סמ״ק') + '</text></svg>';
  },
  evac: function(){
    return '<div class="hv-ev"><span class="hv-tag">' + (W.TriageUI ? W.TriageUI.shapeSvg('oct', 18) : '') + L('Next out','הבא לפינוי') + '</span>'
      + '<span>' + ico('users', 22) + '<b>' + L('Casualty 1','נפגע 1') + '</b></span><span>' + ico('ambulance', 22) + '<b>' + L('Ambulance 1','אמבולנס 1') + '</b></span><span>' + ico('hospital', 22) + '<b>' + L('City Trauma Center · 12 min','מרכז טראומה עירוני · 12 ד׳') + '</b></span></div>';
  },
  band: function(){
    return '<div class="hv-band"><span class="hv-num big">1</span><span class="hv-qr">' + ico('qr-code', 64) + '</span><span><b>' + L('The whole record','כל התיק') + '</b><small>' + L('inside the code, no network','בתוך הקוד, בלי רשת') + '</small></span></div>';
  },
  mist: function(){
    var m = [['M','Mechanism','מנגנון'],['I','Injuries','פציעות'],['S','Signs','סימנים'],['T','Treatment','טיפול']];
    return '<div class="hv-mist">' + m.map(function(x){ return '<span><i>' + x[0] + '</i><b>' + L(x[1], x[2]) + '</b></span>'; }).join('') + '</div>';
  },
  undo: function(){
    return '<div class="hv-undo"><span>' + L('Undone: TXA 1 g, 22:59','בוטל: TXA 1 גרם, 22:59') + '</span><b>' + ico('undo-2', 22) + L('Undo','ביטול') + '</b></div>';
  },
  lang: function(){
    return '<div class="hv-lang"><span class="' + (lang() === 'en' ? 'on' : '') + '">English</span><span class="' + (lang() === 'he' ? 'on' : '') + '">עברית</span></div><p class="hv-cap">' + L('Switch any time. Nothing is lost.','אפשר להחליף בכל רגע. שום דבר לא הולך לאיבוד.') + '</p>';
  },
  offline: function(){
    return '<div class="hv-row">' + ico('wifi-off', 40) + ico('arrow-right', 24) + ico('smartphone', 40) + ico('check', 32) + '</div><p class="hv-cap">' + L('Add to the home screen once. Then it works with no signal.','מוסיפים פעם אחת למסך הבית. מאז עובד בלי קליטה.') + '</p>';
  },
  notice: function(){
    return '<div class="hv-notice">' + ico('triangle-alert', 30) + '<b>' + L('Do not use on real patients','אין להשתמש בנפגעים אמיתיים') + '</b></div>';
  },
  start: function(){
    return '<div class="hv-row">' + ico('zap', 34) + ico(rtl() ? 'arrow-left' : 'arrow-right', 22) + ico('file-text', 34) + ico(rtl() ? 'arrow-left' : 'arrow-right', 22) + ico('ambulance', 34) + ico(rtl() ? 'arrow-left' : 'arrow-right', 22) + ico('qr-code', 34) + '</div>'
      + '<p class="hv-cap">' + L('Triage → treat → evacuate → hand off','מיון ← טיפול ← פינוי ← העברה') + '</p>';
  }
};

// ── topics ──
var T = [
  { k:'start', icon:'play', v:'start', tour:0, show: function(){ W.Demo.tab('status'); },
    t:['Getting started','איך מתחילים'], s:['The whole flow in four steps','כל הזרימה בארבעה צעדים'],
    steps:[['zap',['Count and triage everyone first','קודם סופרים וממיינים את כולם']],['file-text',['Open Form 101 for each casualty','פותחים טופס 101 לכל נפגע']],['ambulance',['Send the most urgent first','שולחים קודם את הדחוף ביותר']],['qr-code',['Hand off with the wristband','מעבירים עם הצמיד']]] },
  { k:'home', icon:'layout-dashboard', v:'tiles', tour:0, show: function(){ W.Demo.tab('status'); },
    t:['Home and the scene','בית והזירה'], s:['Every casualty, counted by triage','כל הנפגעים, לפי מיון'],
    steps:[['users',['Each tile is a triage group with its count','כל אריח הוא קבוצת מיון עם המספר שלה']],['hand-helping',['Tap a tile to see those casualties','לחיצה על אריח מציגה את הנפגעים שלו']],['clock',['“Due now” lists what is late across everyone','״מגיע עכשיו״ מציג מה מאחר אצל כולם']],['plus',['Start a new casualty from here','מכאן פותחים נפגע חדש']]] },
  { k:'quick', icon:'zap', v:'yesno', tour:1, show: function(){ W.Demo.tab('status').then(function(){ W.Quick.open(); }); },
    t:['Quick triage','מיון מהיר'], s:['A colour per casualty in seconds','צבע לכל נפגע תוך שניות'],
    steps:[['circle-help',['Answer one question at a time','עונים על שאלה אחת בכל פעם']],['check',['YES is always blue, always in the same place','כן תמיד כחול, תמיד באותו מקום']],['x',['NO is grey, always in the same place','לא אפור, תמיד באותו מקום']],['tag',['The casualty gets a number and a colour','הנפגע מקבל מספר וצבע']],['qr-code',['Save, then the next casualty or the wristband','שומרים, ואז הנפגע הבא או הצמיד']]] },
  { k:'form', icon:'file-text', v:'id', tour:2, show: function(){ inForm(); },
    t:['Form 101','טופס 101'], s:['One record per casualty','תיק אחד לכל נפגע'],
    steps:[['tag',['The casualty is a number, never a name','הנפגע הוא מספר, אף פעם לא שם']],['triangle',['Set triage with one tap','קובעים מיון בלחיצה אחת']],['clock',['Set the injury time: “Now” or exact','קובעים שעת פציעה: ״עכשיו״ או מדויקת']],['layers',['Tabs jump to Form, Body, Timeline, Vitals','לשוניות קופצות לטופס, גוף, ציר זמן, מדדים']]] },
  { k:'xcare', icon:'list-checks', v:'xcare', tour:3, show: function(){ inForm('.xc-list'); },
    t:['X-CARE','X-CARE'], s:['The next step, in the book’s order','הצעד הבא, לפי סדר הספר'],
    steps:[['droplet',['Bleeding first, then circulation','קודם דימום, אחר כך מחזור דם']],['wind',['Then airway and breathing','אחר כך נתיב אוויר ונשימה']],['check',['Rows tick themselves from what you record','שורות מסומנות לבד לפי מה שתיעדת']],['hand-helping',['Tap a row to act on it','לחיצה על שורה לביצוע']]] },
  { k:'vitals', icon:'heart-pulse', v:'vitals', tour:6, show: function(){ inForm('[data-tour=vitals], #cas-pulse'); },
    t:['Vitals and alerts','מדדים והתראות'], s:['Big keypad, alerts as suspicions','מקלדת גדולה, התראות כחשד'],
    steps:[['keyboard',['Tap a vital, type on the big keypad','לוחצים על מדד ומקלידים במקלדת הגדולה']],['triangle-alert',['A new finding pops up as “Suspected…”','ממצא חדש קופץ כ״חשד ל…״']],['hand-helping',['Tap the alert for the full advice','לחיצה על ההתראה להמלצה המלאה']],['brain',['GCS and pupils in a few taps','GCS ואישונים בכמה לחיצות']]] },
  { k:'body', icon:'crosshair', v:'body', show: function(){ inForm('[data-tour=bodymap]'); },
    t:['Body map and treatments','מפת גוף וטיפולים'], s:['Mark wounds and what was done','מסמנים פצעים ומה בוצע'],
    steps:[['hand-helping',['Tap a body part to mark a wound','לחיצה על איבר לסימון פצע']],['bandage',['Pick a treatment, then tap the body','בוחרים טיפול, ואז לוחצים על הגוף']],['search',['Hold a body part to zoom in','לחיצה ארוכה על איבר להגדלה']],['map-pin',['Pin the exact spot','מסמנים את המקום המדויק']]] },
  { k:'proc', icon:'activity', v:'proc', show: function(){ inForm(null, function(){ if (W.Field && W.Field.procSheet) W.Field.procSheet(); }); },
    t:['Procedures','פעולות'], s:['Airway, breathing, circulation','נתיב אוויר, נשימה, מחזור דם'],
    steps:[['list-checks',['Open “Procedures” in the form','פותחים ״פעולות״ בטופס']],['wind',['AW, intubation with attempts, crico','AW, אינטובציה עם ניסיונות, קוניוטומיה']],['check',['One tap records it with the time','לחיצה אחת רושמת עם השעה']],['undo-2',['Undo if it was a mistake','ביטול אם זו טעות']]] },
  { k:'time', icon:'clock', v:'timeline', tour:4, show: function(){ inForm('#fs-time'); },
    t:['Timeline','ציר זמן'], s:['Everything, with its exact time','הכול, עם השעה המדויקת'],
    steps:[['activity',['Every action is logged automatically','כל פעולה נרשמת אוטומטית']],['hand-helping',['Tap a row to edit it','לחיצה על שורה לעריכה']],['clock',['“Edit time”: −5, −1, +1, +5 or exact','״עריכת שעה״: ‎−5, ‎−1, ‎+1, ‎+5 או מדויקת']],['timer',['Timers and doses update with it','השעונים והמינונים מתעדכנים בהתאם']]] },
  { k:'dose', icon:'syringe', v:'dose', tour:5, show: function(){ inForm(null, function(){ W.Field.doseOpen('now'); }); },
    t:['Dose calculator','מחשבון מינונים'], s:['Reads the casualty, gives the dose','קורא את הנפגע, נותן מינון'],
    steps:[['users',['Check weight and age at the top','בודקים משקל וגיל למעלה']],['search',['Findings are read from the form','הממצאים נקראים מהטופס']],['check',['Give now · Changed dose · Do not give','לתת עכשיו · מינון משתנה · לא לתת']],['droplet',['The syringe shows drug and saline','המזרק מראה תרופה וסליין']],['syringe',['Pick the syringe size, default 10 cc','בוחרים גודל מזרק, ברירת מחדל 10 סמ״ק']],['triangle-alert',['“Warnings” lists who not to give it to','״אזהרות״ מפרט למי לא לתת']],['check-check',['Read back, then record','הקראה חוזרת, ואז רישום']]] },
  { k:'evac', icon:'ambulance', v:'evac', tour:7, show: function(){ W.Demo.tab('evac'); },
    t:['Evacuation','פינוי'], s:['Who goes next, where, when','מי יוצא הבא, לאן, מתי'],
    steps:[['siren',['“Next out” is the most urgent casualty','״הבא לפינוי״ הוא הדחוף ביותר']],['ambulance',['It shows the ambulance and hospital','מוצגים האמבולנס ובית החולים']],['check',['Load and go, then confirm','העמסה ויציאה, ואז אישור']],['clock',['Each ambulance shows when it arrives','כל אמבולנס מראה מתי הוא מגיע']]] },
  { k:'band', icon:'qr-code', v:'band', tour:8, show: function(){ W.Demo.tab('bracelets'); },
    t:['Wristbands and scanning','צמידים וסריקה'], s:['The record travels on the casualty','התיק נוסע עם הנפגע'],
    steps:[['qr-code',['Each casualty gets a QR wristband','כל נפגע מקבל צמיד QR']],['printer',['Print it and fasten it','מדפיסים ומהדקים']],['scan-line',['Any phone camera reads it','כל מצלמת טלפון קוראת']],['wifi-off',['No app, no account, no network','בלי אפליקציה, בלי חשבון, בלי רשת']]] },
  { k:'hand', icon:'radio', v:'mist', show: function(){ inForm(null, function(){ var b = document.querySelector('[data-tour=handoff]'); if (b) b.click(); }); },
    t:['Handoff (MIST)','העברה (MIST)'], s:['A short report in one tap','דוח קצר בלחיצה אחת'],
    steps:[['radio',['Tap “Handoff” at the bottom of the form','לוחצים ״העברה״ בתחתית הטופס']],['list-checks',['Mechanism, Injuries, Signs, Treatment','מנגנון, פציעות, סימנים, טיפול']],['volume-2',['Large text to read it aloud','טקסט גדול להקראה בקול']],['share-2',['Share, copy or send by radio','שיתוף, העתקה או קשר']]] },
  { k:'undo', icon:'undo-2', v:'undo', show: function(){ inForm(); },
    t:['Undo','ביטול'], s:['Every tap can be taken back','כל לחיצה ניתנת לביטול'],
    steps:[['undo-2',['Tap Undo on the message or the bottom bar','לוחצים ״ביטול״ בהודעה או בסרגל התחתון']],['file-text',['It says exactly what was undone','מוצג בדיוק מה בוטל']],['syringe',['Undoing a drug asks first','ביטול תרופה מבקש אישור']]] },
  { k:'lang', icon:'languages', v:'lang', show: function(){ W.Demo.menu(); },
    t:['Language','שפה'], s:['Hebrew and English','עברית ואנגלית'],
    steps:[['menu',['Open the Menu','פותחים את התפריט']],['languages',['Pick English or עברית','בוחרים English או עברית']],['check',['The whole app switches, data stays','כל האפליקציה מתחלפת, הנתונים נשארים']]] },
  { k:'off', icon:'wifi-off', v:'offline', show: function(){ if (W.PWA && W.PWA.install) W.PWA.install(); },
    t:['Offline and install','בלי רשת והתקנה'], s:['Works with no signal','עובד בלי קליטה'],
    steps:[['smartphone',['Add it to the home screen once','מוסיפים פעם אחת למסך הבית']],['wifi-off',['Then it opens with no signal','מאז נפתח בלי קליטה']],['qr-code',['Wristbands are read offline too','גם צמידים נקראים בלי רשת']]] },
  { k:'notice', icon:'triangle-alert', v:'notice', show: function(){ if (W.Disclaimer) W.Disclaimer.open(); },
    t:['Safety notice','הודעת בטיחות'], s:['Early beta, fictional patients','בטא מוקדמת, נפגעים בדויים'],
    steps:[['triangle-alert',['This is a demo. Do not use on real patients.','זה דמו. אין להשתמש בנפגעים אמיתיים.']],['stethoscope',['Software can be wrong; a professional decides','תוכנה עלולה לטעות; איש מקצוע מחליט']],['users',['All patients here are fictional','כל הנפגעים כאן בדויים']]] }
];

var el = null, cur = null;
function sheet(){
  if (el) return el;
  el = document.createElement('div'); el.id = 'help-sheet'; el.className = 'hp no-polish no-tr';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  document.getElementById('app').appendChild(el);
  return el;
}
function head(back){
  return '<div class="hp-bar">'
    + (back ? '<button class="hp-btn" onclick="Help.list()">' + ico(rtl() ? 'arrow-right' : 'arrow-left', 22) + '<span>' + L('All topics','כל הנושאים') + '</span></button>' : '<h2>' + ico('circle-help', 26) + L('How to use','איך משתמשים') + '</h2>')
    + '<button class="hp-btn" onclick="Help.close()">' + ico('x', 22) + '<span>' + L('Close','סגור') + '</span></button></div>';
}
function list(){
  cur = null; var s = sheet(); s.setAttribute('aria-label', L('How to use','איך משתמשים'));
  s.innerHTML = head(false) + '<div class="hp-scroll"><p class="hp-intro">' + L('Pick a topic. Each one shows the steps and opens the real screen.','בחרו נושא. כל נושא מראה את השלבים ופותח את המסך האמיתי.') + '</p><div class="hp-list">'
    + T.map(function(x){ return '<button class="hp-topic" onclick="Help.topic(\'' + x.k + '\')"><span class="hp-ti">' + ico(x.icon, 26) + '</span><span class="hp-tt"><b>' + t2(x.t) + '</b><small>' + t2(x.s) + '</small></span>' + ico(rtl() ? 'chevron-left' : 'chevron-right', 22) + '</button>'; }).join('')
    + '</div></div>';
  s.querySelector('.hp-scroll').scrollTop = 0;
  focusFirst();
}
function topic(k){
  var x = T.filter(function(t){ return t.k === k; })[0]; if (!x) return list();
  cur = k; var s = sheet(); s.setAttribute('aria-label', t2(x.t));
  s.innerHTML = head(true) + '<div class="hp-scroll"><div class="hp-hero"><span class="hp-ti big">' + ico(x.icon, 30) + '</span><div><h3>' + t2(x.t) + '</h3><p>' + t2(x.s) + '</p></div></div>'
    + '<div class="hp-vis">' + (V[x.v] ? V[x.v]() : '') + '</div>'
    + '<ol class="hp-steps">' + x.steps.map(function(st, n){ return '<li><span class="hp-n">' + (n + 1) + '</span>' + ico(st[0], 24) + '<span>' + t2(st[1]) + '</span></li>'; }).join('') + '</ol></div>'
    + '<div class="hp-foot"><button class="hp-show" onclick="Help.show(\'' + x.k + '\')">' + ico('eye', 24) + '<span>' + L('Show me','הראו לי') + '</span></button>'
    + (x.tour != null ? '<button class="hp-tour" onclick="Help.tour(\'' + x.k + '\')">' + ico('play', 22) + '<span>' + L('Tour from here','סיור מכאן') + '</span></button>' : '') + '</div>';
  focusFirst();
}
function focusFirst(){ var b = el && el.querySelector('.hp-bar button'); if (b) try { b.focus({ preventScroll:true, focusVisible:false }); } catch (e) { b.focus(); } }
function close(){ if (el){ el.remove(); el = null; cur = null; } }
function open(k){ if (W.Demo && W.Demo.closeMenu) W.Demo.closeMenu(); if (k) topic(k); else list(); }
function find(k){ return T.filter(function(t){ return t.k === k; })[0]; }
W.Help = {
  open: open, close: close, list: list, topic: topic, topics: function(){ return T.map(function(t){ return t.k; }); },
  show: function(k){ var x = find(k); close(); if (W.Tour && W.Tour.active()) W.Tour.stop(true); if (x && x.show) x.show(); },
  tour: function(k){ var x = find(k); close(); if (x && W.Tour) W.Tour.start(x.tour); },
  relang: function(){ if (!el) return; if (cur) topic(cur); else list(); }
};
document.addEventListener('DOMContentLoaded', function(){
  var s = W.ShowcaseI18n; if (!s) return;
  var prev = s.setLang; s.setLang = function(l){ var keep = el ? (cur || '') : null; prev(l); if (keep !== null){ if (keep) topic(keep); else list(); } };
});
document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && el && !document.querySelector('.tr-card')){ e.preventDefault(); e.stopImmediatePropagation(); close(); } }, true);
})();
