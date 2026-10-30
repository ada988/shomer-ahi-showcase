/* Desktop landing: a short field-manual page next to a live phone. Every row in the index drives the real app.
   Hidden under 900px, where the phone app fills the screen. */
(function(w){
'use strict';
function lang(){ return (w.ShowcaseI18n && w.ShowcaseI18n.lang) || 'en'; }
function L(en, he){ return lang() === 'he' ? he : en; }
function ico(n, s){ return w.Icon ? w.Icon(n, s || 22) : ''; }

var STEPS = [
  { k:'triage', t:['Triage','מיון'],    d:['Six yes / no questions, one colour per casualty, everyone counted.','שש שאלות כן / לא, צבע אחד לכל נפגע, כולם נספרים.'] },
  { k:'treat',  t:['Treat','טיפול'],     d:['X-CARE in the right order. Every treatment lands on the timeline with its exact time.','X-CARE בסדר הנכון. כל טיפול נרשם בציר הזמן עם השעה המדויקת.'] },
  { k:'dose',   t:['Dose','מינון'],      d:['Dose, dilution and syringe for this casualty, read back before it is recorded.','מנה, מיהול ומזרק לנפגע הזה, בהקראה חוזרת לפני הרישום.'] },
  { k:'evac',   t:['Evacuate','פינוי'],  d:['Most urgent first, right ambulance, right hospital.','הדחוף ביותר קודם, לאמבולנס הנכון, לבית החולים הנכון.'] },
  { k:'hand',   t:['Hand off','העברה'],  d:['The full record on a QR wristband any phone can read.','התיק המלא על צמיד QR שכל טלפון קורא.'] }
];

var active = null;
function show(k){
  active = k;
  var run = {
    triage: function(){ return w.Quick && w.Quick.open(); },
    treat:  function(){ return w.Demo.go('casualty'); },
    dose:   function(){ return Promise.resolve(w.Demo.go('casualty')).then(function(){ setTimeout(function(){ if (w.Field && w.Field.doseOpen) w.Field.doseOpen('now'); }, 350); }); },
    evac:   function(){ return w.Demo.tab('evac'); },
    hand:   function(){ return w.Demo.tab('bracelets'); }
  }[k];
  if (w.Tour && w.Tour.active && w.Tour.active()) w.Tour.stop();
  try { if (run) run(); } catch (e) { console.error(e); }
  mark();
}
function mark(){
  document.querySelectorAll('.lp-row').forEach(function(el){
    var on = el.getAttribute('data-k') === active;
    el.classList.toggle('on', on); el.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}
function appQr(){
  var el = document.getElementById('lp-app-qr'); if (!el || !w.qrcode) return;
  var q; try { q = w.qrcode(0, 'M'); q.addData(APP_URL); q.make(); } catch (e) { return; }
  var n = q.getModuleCount(), d = '';
  for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) d += 'M' + (c + 3) + ' ' + (r + 3) + 'h1v1h-1z';
  el.innerHTML = '<svg class="qr" viewBox="0 0 ' + (n + 6) + ' ' + (n + 6) + '" shape-rendering="crispEdges" role="img" aria-label="' + L('QR code: open the demo on your phone','קוד QR: פתיחת הדמו בטלפון') + '"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '"/></svg>';
}
var APP_URL = 'https://ada988.github.io/shomer-ahi-showcase/';
function clock(){
  var el = document.getElementById('ph-time'); if (!el) return;
  var d = new Date(); el.textContent = d.getHours() + ':' + ('0' + d.getMinutes()).slice(-2);
}

function render(){
  var root = document.getElementById('lp'); if (!root) return;
  var he = lang() === 'he', fwd = he ? 'arrow-left' : 'arrow-right';
  var h = '';

  h += '<nav class="lp-nav"><span class="lp-brand"><img src="shared/logo-shield.svg" alt=""><b>' + L('Shomer Ahi','שומר אחי') + '</b></span>'
    + '<span class="lp-nav-r"><span class="lp-beta">' + L('Early beta · not for clinical use','בטא מוקדמת · לא לשימוש קליני') + '</span>'
    + '<span class="lang-seg lp-lang" role="group" aria-label="' + L('Language','שפה') + '"><button data-lang="en" class="' + (he ? '' : 'on') + '" onclick="ShowcaseI18n.setLang(\'en\')" lang="en">EN</button><button data-lang="he" class="' + (he ? 'on' : '') + '" onclick="ShowcaseI18n.setLang(\'he\')" lang="he">עב</button></span></span></nav>';

  h += '<header class="lp-hero">'
    + '<p class="lp-kick">' + L('Built by medics, for medics','נבנה על ידי מטפלים, עבור מטפלים') + '</p>'
    + '<h1>' + L('Every casualty.<br>One card.<br>Handed off in seconds.','כל נפגע.<br>כרטיס אחד.<br>מועבר תוך שניות.') + '</h1>'
    + '<p class="lp-lede">' + L('Shomer Ahi is a digital Form 101 for combat medics and paramedics. It shows the next step in the right order, works out the exact dose for the casualty in front of you, and carries the whole record to the hospital on a QR wristband, even with no signal.',
                               'שומר אחי הוא טופס 101 דיגיטלי לחובשים ולפרמדיקים. הוא מראה את הצעד הבא בסדר הנכון, מחשב את המנה המדויקת לנפגע שמולך, ומעביר את כל התיק לבית החולים על צמיד QR, גם בלי קליטה.') + '</p>'
    + '<div class="lp-cta"><button class="lp-btn" onclick="Tour.start()">' + ico('play', 20) + '<span>' + L('Watch the 60-second tour','צפו בסיור של 60 שניות') + '</span></button></div>'
    + '</header>';

  h += '<section class="lp-ba" aria-label="' + L('Before and after','לפני ואחרי') + '">'
    + '<div><span class="lp-lbl">' + L('Today','היום') + '</span><p>' + L('The card is filled in by hand, under fire, in rain and at night. Doses are worked out in your head. At the hospital door the handoff is shouted, and half of it is lost.','הכרטיס נכתב ביד, תחת אש, בגשם ובלילה. המינונים מחושבים בראש. בפתח בית החולים ההעברה נעשית בצעקות, וחצי ממנה הולך לאיבוד.') + '</p></div>'
    + '<div><span class="lp-lbl">' + L('With Shomer Ahi','עם שומר אחי') + '</span><p>' + L('Every action is recorded with its time. Doses come from the IDF trauma book for this casualty’s weight. The record travels on the wristband, readable by any phone.','כל פעולה נרשמת עם השעה שלה. המינונים מספר הטראומה של צה״ל, לפי המשקל של הנפגע. התיק נוסע על הצמיד, וכל טלפון קורא אותו.') + '</p></div>'
    + '</section>';

  h += '<section class="lp-cond" aria-labelledby="lp-cond"><h2 id="lp-cond">' + L('Made for the moment you have no hands free','בנוי לרגע שבו אין לך ידיים פנויות') + '</h2><div class="lp-cond-g">'
    + [['hand-helping', L('With gloves','עם כפפות'), L('Every button is at least 48 px, the main ones 56 to 64. No tiny links, no gestures you can miss.','כל כפתור לפחות 48 פיקסלים, הראשיים 56 עד 64. בלי קישורים זעירים, בלי מחוות שאפשר לפספס.')],
       ['eye', L('Under stress','תחת לחץ'), L('One clear next step at a time. Colour, shape, icon and one word on every choice, so your eyes stay on the casualty.','צעד ברור אחד בכל פעם. צבע, צורה, סמל ומילה אחת בכל בחירה, כך שהעיניים נשארות על הנפגע.')],
       ['ambulance', L('On the move','בתנועה'), L('Large type and high contrast for a bumpy ambulance at night. Every tap can be undone, and every drug is read back first.','טקסט גדול וניגודיות גבוהה לאמבולנס קופצני בלילה. כל לחיצה ניתנת לביטול, וכל תרופה מוקראת לפני הרישום.')]]
        .map(function(c){ return '<div>' + ico(c[0], 24) + '<b>' + c[1] + '</b><p>' + c[2] + '</p></div>'; }).join('')
    + '</div></section>';

  // every feature, grouped
  var FEATS = [
    [['Record and treat','תיעוד וטיפול'], [
      ['file-text', ['Digital Form 101','טופס 101 דיגיטלי'], ['The full casualty card on the phone, with the body map, vitals and drugs.','כרטיס הנפגע המלא בטלפון, עם מפת גוף, מדדים ותרופות.']],
      ['list-checks', ['X-CARE checklist','צ׳קליסט X-CARE'], ['The next step in the book’s order, ticked from what you record.','הצעד הבא לפי סדר הספר, מסומן לפי מה שתיעדת.']],
      ['timer', ['Tourniquet clocks','שעוני חוסם עורקים'], ['Start on their own and warn before two hours.','מתחילים לבד ומתריעים לפני שעתיים.']],
      ['activity', ['Automatic treatment timeline','ציר זמן טיפול אוטומטי'], ['Every treatment, drug and vital is logged with its exact time as you work. Nothing to write down.','כל טיפול, תרופה ומדד נרשמים עם השעה המדויקת תוך כדי עבודה. אין מה לכתוב.']],
      ['heart-pulse', ['Vitals and alerts','מדדים והתראות'], ['Glove-sized keypad. New findings pop up as “Suspected…”, never a diagnosis.','מקלדת בגודל כפפה. ממצא חדש קופץ כ“חשד ל…”, אף פעם לא אבחנה.']],
      ['brain', ['GCS and pupils','GCS ואישונים'], ['Eyes, voice, movement and pupils in a few taps.','עיניים, דיבור, תנועה ואישונים בכמה לחיצות.']]
    ]],
    [['Drugs','תרופות'], [
      ['syringe', ['Exact dose','מנה מדויקת'], ['From the IDF trauma book, for this casualty’s weight and age, adult or child.','מספר הטראומה של צה״ל, לפי משקל וגיל, מבוגר או ילד.']],
      ['droplet', ['Dilution, drawn','מיהול, מצויר'], ['Drug and saline shown in the syringe, 1 to 20 cc, and how much to push.','התרופה והסליין מצוירים במזרק, 1 עד 20 סמ״ק, וכמה להזריק.']],
      ['check-check', ['Read-back first','הקראה חוזרת קודם'], ['Drug, dose, route, patient and time are confirmed before anything is recorded.','תרופה, מנה, דרך מתן, מטופל ושעה מאושרים לפני רישום.']],
      ['triangle-alert', ['Warnings per drug','אזהרות לכל תרופה'], ['Who not to give it to, when not to, and side effects, with what applies now on top.','למי לא לתת, מתי לא, ותופעות לוואי, ומה שרלוונטי עכשיו למעלה.']],
      ['clock', ['Repeat timers','שעוני מנה חוזרת'], ['Shows when the next dose is due and the total in 24 hours.','מראה מתי המנה הבאה וכמה ניתן ב-24 שעות.']],
      ['lock', ['IV and IO check','בדיקת וריד ולשד'], ['IV drugs stay locked until access is recorded.','תרופות לווריד נעולות עד שנרשמת גישה.']]
    ]],
    [['Mass casualties','אר״ן'], [
      ['zap', ['Quick triage','מיון מהיר'], ['Six yes / no questions, colour-coded, one colour per casualty.','שש שאלות כן / לא בצבעים, צבע אחד לכל נפגע.']],
      ['layout-dashboard', ['Command board','לוח שליטה'], ['Every casualty on one screen, with what is due now across all of them.','כל הנפגעים במסך אחד, עם מה שמגיע עכשיו אצל כולם.']],
      ['ambulance', ['Evacuation board','לוח פינוי'], ['Who goes next, on which ambulance, to which hospital, and when it arrives.','מי יוצא הבא, באיזה אמבולנס, לאיזה בית חולים ומתי מגיע.']],
      ['undo-2', ['Undo everything','ביטול לכל פעולה'], ['Every tap can be taken back, and it says what was undone.','כל לחיצה ניתנת לביטול, עם פירוט מה בוטל.']]
    ]],
    [['Handoff','העברה'], [
      ['qr-code', ['QR wristband','צמיד QR'], ['The whole record inside the code. Any phone camera reads it, no network.','כל התיק בתוך הקוד. כל מצלמת טלפון קוראת, בלי רשת.']],
      ['clipboard-list', ['MIST report','דוח MIST'], ['One tap for the handoff, with a large-text mode to read aloud.','לחיצה אחת להעברה, עם מצב טקסט גדול להקראה.']],
      ['wifi-off', ['Works offline','עובד בלי רשת'], ['Installs on the phone and keeps working with no signal.','מותקן בטלפון וממשיך לעבוד בלי קליטה.']],
      ['languages', ['Hebrew and English','עברית ואנגלית'], ['Full right-to-left Hebrew, switchable mid-scene.','עברית מלאה מימין לשמאל, מחליפים באמצע אירוע.']]
    ]]
  ];
  h += '<section class="lp-feat" aria-labelledby="lp-feat"><h2 id="lp-feat">' + L('What’s inside','מה יש בפנים') + '</h2>'
    + FEATS.map(function(g){
        return '<div class="lp-fg"><h3>' + L(g[0][0], g[0][1]) + '</h3><ul>'
          + g[1].map(function(f){ return '<li>' + ico(f[0], 22) + '<div><b>' + L(f[1][0], f[1][1]) + '</b><p>' + L(f[2][0], f[2][1]) + '</p></div></li>'; }).join('')
          + '</ul></div>';
      }).join('')
    + '</section>';

  h += '<section class="lp-idx" aria-labelledby="lp-how"><h2 id="lp-how">' + L('Try it on the phone','נסו בטלפון') + '</h2><ol>'
    + STEPS.map(function(s, i){
        return '<li><button class="lp-row" data-k="' + s.k + '" aria-pressed="false" onclick="Landing.show(\'' + s.k + '\')"><span class="lp-n">0' + (i + 1) + '</span><b>' + L(s.t[0], s.t[1]) + '</b><span class="lp-d">' + L(s.d[0], s.d[1]) + '</span>' + ico(fwd, 22) + '</button></li>';
      }).join('')
    + '</ol></section>';

  h += '<section class="lp-scan"><div class="phone-qr lp-qr" id="phone-qr"></div><div><h2>' + L('Scan it with your own phone.','סרקו עם הטלפון שלכם.') + '</h2><p>'
    + L('This is Casualty 1’s wristband. The full record opens from the code itself: no app, no account, no server.','זה הצמיד של נפגע 1. התיק המלא נפתח מהקוד עצמו: בלי אפליקציה, בלי חשבון, בלי שרת.') + '</p></div></section>';

  h += '<dl class="lp-nums">'
    + [['0', L('logins','התחברויות')], ['0', L('signal needed','קליטה נדרשת')], ['48', L('px smallest target, for gloves','פיקסלים, המטרה הקטנה ביותר, לכפפות')], ['2', L('languages, full Hebrew','שפות, עברית מלאה')]]
        .map(function(s){ return '<div><dt>' + s[0] + '</dt><dd>' + s[1] + '</dd></div>'; }).join('')
    + '</dl>';

  // try the whole app on your own phone
  h += '<section class="lp-scan lp-try"><div class="lp-qr2" id="lp-app-qr"></div><div><h2>' + L('Open it on your phone.','פתחו בטלפון שלכם.') + '</h2><p>'
    + L('Scan to run the full demo on your own phone. Add it to the home screen and it works with no signal.','סרקו כדי להריץ את הדמו המלא בטלפון שלכם. הוסיפו למסך הבית והוא עובד גם בלי קליטה.') + '</p><span class="lp-url">ada988.github.io/shomer-ahi-showcase</span></div></section>';

  h += '<aside class="lp-note" role="note"><b>' + L('Early beta demo — not for real use','דמו בטא מוקדמת — לא לשימוש אמיתי') + '</b><p>'
    + L('This showcase uses fictional patients and has not been deployed or validated. It is not a medical device. Every suggestion is produced by software from the values entered and can be wrong; only a qualified medical professional may make medical decisions. Do not use it on real patients. Doses and protocol follow the IDF Trauma and Operational Medicine Book (January 2026).',
        'הדמו משתמש בנפגעים בדויים ולא הופעל ולא תוקף. אינו מכשיר רפואי. כל הצעה מופקת על ידי תוכנה מתוך הערכים שהוזנו ועלולה להיות שגויה; רק איש צוות רפואי מוסמך רשאי לקבל החלטות רפואיות. אין להשתמש בנפגעים אמיתיים. המינונים והפרוטוקול לפי ספר הטראומה והרפואה המבצעית של צה״ל (ינואר 2026).')
    + '</p><button class="lp-link" onclick="Disclaimer.open()">' + L('Read the full notice','קראו את ההודעה המלאה') + '</button></aside>';

  h += '<footer class="lp-foot"><span>' + L('Shomer Ahi — “my brother’s keeper”. By medics, for medics.','שומר אחי — ממטפלים, עבור מטפלים.') + '</span><span>' + L('Works offline · installs as an app','עובד בלי רשת · מותקן כאפליקציה') + '</span></footer>';

  root.innerHTML = h;
  if (w.Demo && w.Demo.renderSide) w.Demo.renderSide();
  appQr();
  mark();
}

// keep real phone proportions: the phone is laid out at 410×880 and scaled as one object to fit the window
function fit(){
  var r = document.documentElement.style;
  if (w.innerWidth < 901){ r.removeProperty('--ph-s'); return; }
  var s = Math.min(1, (w.innerHeight - 48) / 880, (w.innerWidth * 0.45) / 410);
  r.setProperty('--ph-s', Math.max(0.55, s).toFixed(3));
}
w.addEventListener('resize', fit);
w.Landing = { render: render, show: show };
document.addEventListener('DOMContentLoaded', function(){
  var s = w.ShowcaseI18n;
  if (s){ var prev = s.setLang; s.setLang = function(l){ prev(l); render(); }; }
  fit(); render(); clock(); setInterval(clock, 15000);
});
})(window);
