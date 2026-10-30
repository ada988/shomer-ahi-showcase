/* Early-beta / safety disclaimers: a persistent banner, a first-visit acknowledgement, a full notice,
   and a warning line on everything that can leave the app (prints, copied reports, bracelets). */
(function(){
'use strict';
var W = window;
function lang(){ return (W.ShowcaseI18n && W.ShowcaseI18n.lang) || 'en'; }
function L(en, he){ return lang() === 'he' ? he : en; }
function ico(n, s){ return W.Icon ? W.Icon(n, s) : ''; }

var SHORT = { en:'EARLY BETA DEMO — FICTIONAL DATA — NOT FOR CLINICAL OR COMBAT USE — DO NOT USE ON REAL PATIENTS',
              he:'דמו בטא מוקדמת — נתונים בדויים — לא לשימוש קליני או קרבי — אין להשתמש בנפגעים אמיתיים' };
function short(){ return SHORT[lang()]; }

var POINTS = [
  ['triangle-alert',  ['Early beta. Not deployed.', 'This is a showcase of work in progress. It has not been released, validated or tested on real patients.'],
             ['בטא מוקדמת. לא הופעל.', 'זהו מצג של עבודה בתהליך. המערכת לא שוחררה, לא עברה תיקוף ולא נבדקה על נפגעים אמיתיים.']],
  ['x',      ['Do not use it yet.', 'Not for combat, emergency, medical or any real-patient use. Not a medical device and not approved or certified by any health authority.'],
             ['אין להשתמש בה עדיין.', 'לא לשימוש קרבי, חירום, רפואי או בנפגעים אמיתיים. אינה מכשיר רפואי ואינה מאושרת או מוסמכת על ידי רשות בריאות כלשהי.']],
  ['stethoscope', ['Software suggestions, not medical advice.', 'Every alert, dose, calculation, triage colour and recommendation is produced by code from the values entered. Code makes mistakes: bugs, missing data, wrong assumptions, translation errors. Only a qualified medical professional, following their own protocols and medical direction, may make medical decisions.'],
             ['הצעות תוכנה, לא ייעוץ רפואי.', 'כל התראה, מינון, חישוב, צבע מיון והמלצה מופקים על ידי קוד מתוך הערכים שהוזנו. קוד עלול לטעות: באגים, נתונים חסרים, הנחות שגויות, שגיאות תרגום. רק איש צוות רפואי מוסמך, לפי הנהלים וההנחיה הרפואית שלו, רשאי לקבל החלטות רפואיות.']],
  ['users',  ['All patients are fictional.', 'Do not enter real names, ID numbers or medical data. Wristband QR codes contain the record itself, unencrypted: anyone who scans one can read it.'],
             ['כל הנפגעים בדויים.', 'אין להזין שמות, מספרי זהות או נתונים רפואיים אמיתיים. קודי ה-QR בצמידים מכילים את התיק עצמו, ללא הצפנה: כל סורק יכול לקרוא אותו.']],
  ['languages', ['Translations may be wrong.', 'English and Hebrew text was partly machine-translated and has not been reviewed by a clinician. Doses and protocols shown are examples and differ between organisations.'],
             ['תרגומים עלולים להיות שגויים.', 'טקסטים באנגלית ובעברית תורגמו בחלקם אוטומטית ולא נבדקו על ידי רופא. המינונים והנהלים המוצגים הם דוגמאות ונבדלים בין ארגונים.']],
  ['lock',   ['No warranty.', 'Provided “as is” with no warranty of any kind. The authors accept no liability for any use or misuse.'],
             ['ללא אחריות.', 'ניתן “כפי שהוא” ללא אחריות מכל סוג. היוצרים אינם נושאים באחריות לכל שימוש או שימוש לרעה.']]
];

function pointsHtml(){
  return '<ol class="dn-list">' + POINTS.map(function(p){
    var t = lang() === 'he' ? p[2] : p[1];
    return '<li><span class="dn-i">' + ico(p[0], 26) + '</span><div><b>' + t[0] + '</b><p>' + t[1] + '</p></div></li>';
  }).join('') + '</ol>';
}

var el = null, onOk = null;
function close(){ if (el){ el.remove(); el = null; } }
function open(gate, cb){
  close(); onOk = cb || null;
  var app = document.getElementById('app'); if (!app) return;
  el = document.createElement('div'); el.className = 'dn no-polish'; el.setAttribute('role', gate ? 'alertdialog' : 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', L('Important notice','הודעה חשובה'));
  el.innerHTML = '<div class="dn-top">'
    + '<div class="dn-badge">' + ico('triangle-alert', 30) + '<span>' + L('EARLY BETA','בטא מוקדמת') + '</span></div>'
    + '<h2>' + L('Do not use on real patients','אין להשתמש בנפגעים אמיתיים') + '</h2>'
    + '<p class="dn-sub">' + L('Early beta showcase of a product in development.','תצוגת בטא מוקדמת של מוצר בפיתוח.') + '</p></div>'
    + (gate && !open._full ? '<div class="dn-body dn-short"><p class="dn-one">' + L('Fictional patients. Not a medical device. Software suggestions can be wrong; only a qualified medical professional makes medical decisions.','נפגעים בדויים. אינו מכשיר רפואי. הצעות התוכנה עלולות לטעות; רק איש צוות רפואי מוסמך מקבל החלטות רפואיות.') + '</p><button class="dn-more" onclick="Disclaimer.full()">' + L('Read the full notice','קראו את ההודעה המלאה') + '</button></div>' : '<div class="dn-body">' + pointsHtml() + '</div>')
    + '<div class="dn-foot">'
    + '<div class="dn-lang"><button class="' + (lang() === 'en' ? 'on' : '') + '" onclick="ShowcaseI18n.setLang(\'en\')">ENGLISH</button><button class="' + (lang() === 'he' ? 'on' : '') + '" onclick="ShowcaseI18n.setLang(\'he\')">עברית</button></div>'
    + (gate ? '<button class="dn-ok" data-autofocus onclick="Disclaimer.ack()">' + L('I understand — show the demo','הבנתי — הצג את הדמו') + '</button>'
            : '<button class="dn-ok" data-autofocus onclick="Disclaimer.close()">' + L('Close','סגור') + '</button>')
    + '</div>';
  app.appendChild(el);
  var b = el.querySelector('[data-autofocus]'); if (b) setTimeout(function(){ b.focus({ preventScroll:true }); }, 30);
  if (W.ShowcaseI18n && lang() === 'en') W.ShowcaseI18n.apply(el);
}
function ack(){
  try { sessionStorage.setItem('sc_ack', '1'); } catch(e){}
  var cb = onOk; close(); if (cb) cb();
}
function needed(){
  if (/[?&]gate=1/.test(location.search)) return true;
  if (navigator.webdriver) return false;          // automated test browsers skip the gate; humans never do
  try { return sessionStorage.getItem('sc_ack') !== '1'; } catch(e){ return true; }
}
function gate(cb){ if (needed()) open(true, cb); else if (cb) cb(); }

// Banner line for documents opened in a new window (prints) and appended to copied text.
function docBanner(){ return '<div style="border:3px solid #b00020;color:#b00020;padding:10px 14px;margin:0 0 14px;font:700 14px/1.35 Arial,sans-serif;text-align:center">' + short() + '</div>'; }
function textFooter(){ return '\n— ' + (lang() === 'he' ? 'דמו בטא מוקדמת, נתונים בדויים, לא לשימוש קליני —' : 'EARLY BETA DEMO, FICTIONAL DATA, NOT FOR CLINICAL USE —'); }

W.Disclaimer = { full: function(){ open._full = true; var g = el && el.getAttribute('role') === 'alertdialog'; open(g, onOk); }, relang: function(){ var g = el && el.getAttribute('role') === 'alertdialog'; var cb = onOk; if (el) open(g, cb); }, open: function(){ open(false); }, gate: gate, ack: ack, close: close, short: short, docBanner: docBanner, textFooter: textFooter, pointsHtml: pointsHtml };
})();
