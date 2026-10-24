/* Re-organises the engine's long casualty form into a clear information architecture and restyles the
   triage board, without touching the engine. Runs after every render, before translation.
   Source markup is Hebrew at this point, so matching is done on stable Hebrew labels / classes. */
(function(){
'use strict';
var W = window;
function lang(){ return (W.ShowcaseI18n && W.ShowcaseI18n.lang) || 'en'; }
function L(en, he){ return lang() === 'he' ? he : en; }
function ico(n, s){ return W.Icon ? W.Icon(n, s) : ''; }

function kids(c){ return [].slice.call(c.children); }
function txt(el){ return (el.textContent || '').replace(/\s+/g, ' ').trim(); }
function styleOf(el){ return el.getAttribute('style') || ''; }
function first(c, pred){ var k = kids(c); for (var i = 0; i < k.length; i++) if (pred(k[i], i)) return k[i]; return null; }

// ── Casualty form ──────────────────────────────────────────────
function section(id, title, sub){
  var s = document.createElement('section'); s.className = 'fs'; s.id = id;
  s.innerHTML = '<h2 class="fs-h">' + title + (sub ? '<small>' + sub + '</small>' : '') + '</h2><div class="fs-b"></div>';
  return s;
}
function move(dst, el){ if (el && el.parentNode) dst.querySelector('.fs-b').appendChild(el); }

function enhanceForm(c){
  if (c.querySelector('.fs')) return;
  var ks = kids(c);
  var pick = function(re){ return ks.filter(function(k){ return re.test(txt(k)); })[0] || null; };
  var cls  = function(name){ return ks.filter(function(k){ return k.classList.contains(name); }); };

  var cds = c.querySelector('#cds-alert-mount');
  var timers   = ks.filter(function(k){ return /שעת זהב|Golden/.test(txt(k)) && k.children.length; })[0];
  var march    = ks.filter(function(k){ return /^MARCH-P/.test(txt(k)); })[0];
  var recs     = ks.filter(function(k){ return /המלצות קליניות|הצעות תוכנה/.test(txt(k)); })[0];
  var undo     = ks.filter(function(k){ return /^\W*(↶|בטל)/.test(txt(k)) && /חזור|↷/.test(txt(k)); })[0];
  var peds     = ks.filter(function(k){ return k.tagName === 'BUTTON' && /פעוטות|ילדים|פדיאטרי|🧒/.test(txt(k)); })[0];
  var tqBanner = ks.filter(function(k){ return /^\W*(🔴\s*)?ח"ע|ח״ע/.test(txt(k)) && /Long|ארוך|⋯/.test(txt(k)); })[0] || ks.filter(function(k){ return /rgba\(231,76,60/.test(styleOf(k)) && /\d\d:\d\d/.test(txt(k)) && k.children.length <= 4; })[0];
  var hdr      = ks.filter(function(k){ return /עריכת נפגע|Edit casualty/.test(txt(k)); })[0];
  var nameRow  = hdr ? hdr.nextElementSibling : null;
  var moi      = cls('cas-section').filter(function(k){ return /מנגנון/.test(txt(k)); })[0];
  var seg      = cls('seg')[0];
  var map      = cls('body-map-wrap')[0];
  var vstrip   = ks.filter(function(k){ return /סימנים חיוניים/.test(txt(k)) && /קריאות/.test(txt(k)) && !k.classList.contains('cas-section'); })[0];
  var ctimers  = ks.filter(function(k){ return /טיימרים קריטיים/.test(txt(k)); })[0];
  var inj      = cls('cas-section').filter(function(k){ return /פגיעות מסומנות/.test(txt(k)); })[0];
  var treat    = cls('cas-section').filter(function(k){ return /טיפולים על הגוף/.test(txt(k)); })[0];
  var primary  = cls('cas-section').filter(function(k){ return /סקר ראשוני/.test(txt(k)); })[0];
  var second   = cls('cas-section').filter(function(k){ return /סקר שניוני/.test(txt(k)); })[0];
  var urgency  = cls('cas-section').filter(function(k){ return /דחיפות פינוי/.test(txt(k)); })[0];
  var ventry   = cls('cas-section').filter(function(k){ return /^\W*(❤️|🫁)?\s*סימנים חיוניים/.test(txt(k)) || /דופק.*נשימות.*SpO2/.test(txt(k)); })[0];
  var vsummary = ks.filter(function(k){ return k !== vstrip && /קריאות/.test(txt(k)) && /\d+\/\d+/.test(txt(k)) && /[↑↓→]/.test(txt(k)) && !k.classList.contains('cas-section'); }).slice(-1)[0];
  var savevit  = ks.filter(function(k){ return k.tagName === 'BUTTON' && /שמור (מדד|סימנים)/.test(txt(k)); })[0];
  var timeline = cls('cas-section').filter(function(k){ return /ציר זמן טיפולי/.test(txt(k)); })[0];
  var details  = ks.filter(function(k){ return k.tagName === 'DETAILS'; });
  var handoff  = ks.filter(function(k){ return /טופס 101|WhatsApp|MIST\+|הדפס|דיווח רדיו|ייצוא לצמיד/.test(txt(k)) && (k.tagName === 'BUTTON' || (k.tagName === 'DIV' && k.querySelector('button'))); });
  var autosave = c.querySelector('#autosave-status');
  var saveBtn  = c.querySelector('button.bp'), closeBtn = c.querySelector('button.bs');

  var sNow  = section('fs-now',   L('Decision support','תמיכה בהחלטות'), L('Software suggestions — can be wrong. A medical professional decides.','הצעות תוכנה — עלולות לטעות. איש צוות רפואי מחליט.'));
  var sBody = section('fs-body',  L('Body map','מפת גוף'), L('Tap a body part to mark a wound','לחצו על אזור בגוף כדי לסמן פציעה'));
  var sVit  = section('fs-vitals',L('Vitals','מדדים'), L('Every reading is logged with trends','כל מדידה נרשמת עם מגמות'));
  var sCare = section('fs-care',  L('Details','פרטים'), L('Enter the details behind each X-CARE step (optional)','הזנת הפרטים מאחורי כל שלב ב-X-CARE (לא חובה)'));
  var sRec  = section('fs-record',L('Record','תיק'), L('Details, timeline and handoff chain','פרטים, ציר זמן ושרשרת העברה'));

  // Now: alerts, clocks, MARCH-P, recommendations
  [cds, recs].forEach(function(e){ move(sNow, e); });
  var tools = document.createElement('details'); tools.className = 'fs-tools';
  tools.innerHTML = '<summary>' + L('Undo, redo and pediatric mode','ביטול, שחזור ומצב ילדים') + '</summary><div></div>';
  [undo, peds].forEach(function(e){ if (e) tools.querySelector('div').appendChild(e); });
  sNow.querySelector('.fs-b').appendChild(tools);

  // Body map
  [seg, map].forEach(function(e){ move(sBody, e); });
  if (inj) move(sBody, inj); if (treat) move(sBody, treat);

  // Vitals
  [vstrip, ctimers, vsummary, ventry, savevit].forEach(function(e){ move(sVit, e); });

  // Care
  [primary, urgency].forEach(function(e){ move(sCare, e); });
  if (second){ var d = document.createElement('details'); d.className = 'fs-fold'; var sm = document.createElement('summary'); sm.textContent = L('Secondary survey','סקירה שניונית'); d.appendChild(sm); d.appendChild(second); move(sCare, d); }

  // Record: patient identity + mechanism + timeline + details
  var patient = document.createElement('div'); patient.className = 'fs-patient';
  [hdr, nameRow, moi].forEach(function(e){ if (e) patient.appendChild(e); });

  var rec = sRec.querySelector('.fs-b');
  rec.appendChild(patient);
  if (timeline) rec.appendChild(timeline);
  details.forEach(function(e){ rec.appendChild(e); });

  // Handoff actions → one sticky bar + sheet (originals stay inside the sheet so every action still works)
  var hand = document.createElement('div'); hand.className = 'fs-handoff';
  handoff.forEach(function(e){ hand.appendChild(e); });
  var bar = document.createElement('div'); bar.className = 'fs-bar';
  bar.innerHTML = '<button class="xbtn bar-back" onclick="Demo.back()">' + ico(document.documentElement.dir === 'rtl' ? 'arrow-right' : 'arrow-left', 26) + '<span>' + L('BACK','חזרה') + '</span></button>'
    + '<button class="xbtn" onclick="Field.undo()">' + ico('undo-2', 28) + '<span>' + L('UNDO','בטל') + '</span></button>'
    + '<button class="xbtn xbtn-primary" data-tour="handoff" onclick="FormUI.handoff()">' + ico('radio', 28) + '<span>' + L('HANDOFF','העברה') + '</span></button>';

  // Nav chips
  var nav = document.createElement('nav'); nav.className = 'fnav'; nav.setAttribute('aria-label', L('Jump to section','קפיצה לסעיף'));
  [['field', L('TREAT NOW','טיפול מיידי')], ['fs-body', L('BODY MAP','מפת גוף')], ['fs-vitals', L('VITALS','מדדים')], ['fs-care', L('CARE','טיפול')], ['fs-record', L('RECORD','תיק')], ['fs-now', L('ADVICE','תמיכה')]].forEach(function(p){
    var b = document.createElement('button'); b.textContent = p[1]; b.onclick = function(){ FormUI.jump(p[0]); }; b.dataset.t = p[0]; nav.appendChild(b);
  });

  if (recs) recs.classList.add('b-recs');
  // Tour anchors
  var m = sBody.querySelector('.body-map-wrap'); if (m) m.setAttribute('data-tour', 'bodymap');
  var vs = sVit.querySelector('.fs-b > div'); if (vs) vs.setAttribute('data-tour', 'vitals');
  sNow.setAttribute('data-tour', 'alerts-wrap'); var cm = sNow.querySelector('#cds-alert-mount'); if (recs) recs.setAttribute('data-tour', 'alerts');
  if (primary) primary.setAttribute('data-tour', 'care');

  // Rebuild content in the new order (anything unclaimed stays at the end so nothing is lost)
  [timers, march, tqBanner].forEach(function(d){ if (d && d.parentNode) d.parentNode.removeChild(d); });
  var rest = kids(c).filter(function(e){ return [autosave, saveBtn, closeBtn].indexOf(e) < 0; });
  var frag = document.createDocumentFragment();
  var fieldWrap = document.createElement('div'); fieldWrap.innerHTML = W.Field ? W.Field.html() : ''; while (fieldWrap.firstChild) frag.appendChild(fieldWrap.firstChild);
  frag.appendChild(nav);
  [sNow, sBody, sVit, sCare, sRec].forEach(function(s){ frag.appendChild(s); });
  rest.forEach(function(e){ if (e.parentNode === c) frag.appendChild(e); });
  var foot = document.createElement('div'); foot.className = 'fs-foot';
  [autosave, saveBtn, closeBtn].forEach(function(e){ if (e) foot.appendChild(e); });
  frag.appendChild(foot); frag.appendChild(hand); frag.appendChild(bar);
  c.innerHTML = ''; c.appendChild(frag);
  c.querySelectorAll('#fs-care [onclick*="_casualtyActiveTab"]').forEach(function(h){ var m = /cur===.(\w)./.exec(h.getAttribute('onclick') || ''); var g = h.parentNode; if (m && g) g.classList.add('eg', 'xc-' + m[1]); });
  c.querySelectorAll('button[aria-label]').forEach(function(b){ if (!b.textContent.trim() && !b.querySelector('svg') && /delete|remove|מחק/i.test(b.getAttribute('aria-label'))) { b.innerHTML = ico('x', 22) + '<span>' + L('DELETE','מחק') + '</span>'; b.classList.add('del-btn'); } });
  c.dataset.enh = 'form';
  flattenSvg(c); flattenVitals(c);
  nav.querySelectorAll('button').forEach(function(b){ b.classList.toggle('on', b.dataset.t === (W.FormUI.cur || 'field')); });
  // collapse the long, rarely-needed blocks by default
  c.querySelectorAll('#fs-record .cas-section').forEach(function(e){ /* keep timeline visible */ });
}

function flattenSvg(root){
  root.querySelectorAll('radialGradient,linearGradient').forEach(function(g){
    var st = g.querySelectorAll('stop'); if (!st.length) return;
    var last = st[st.length - 1], col = last.getAttribute('stop-color') || last.style.stopColor;
    if (!col) return;
    st.forEach(function(x){ x.setAttribute('stop-color', col); x.style.stopColor = col; x.setAttribute('stop-opacity', 1); });
  });
}
function flattenVitals(root){
  var strip = root.querySelector('[data-tour=vitals]'); if (!strip) return;
  strip.querySelectorAll('div[style*="background"]').forEach(function(t){
    var st = t.getAttribute('style') || '', m = /background:\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\))/i.exec(st);
    if (!m || /var\(/.test(m[1])) return;
    var col = m[1];
    if (/^rgba/i.test(col) && /,\s*0?\.\d+\)$/.test(col)) return;           // already a soft tint
    t.setAttribute('style', st.replace(/background:\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\))/i, 'background:var(--c2);border:1px solid ' + col) + ';');
    t.querySelectorAll('*').forEach(function(x){ var xs = x.getAttribute('style') || ''; x.setAttribute('style', xs.replace(/color:\s*#fff[^;]*;?/i, 'color:' + col + ';')); });
  });
}

// ── Triage board ───────────────────────────────────────────────
function enhanceBoard(c){
  kids(c).forEach(function(k){
    var s = styleOf(k), t = txt(k);
    if (/position:sticky/.test(s)) k.classList.add('b-modes');
    else if (/grid-template-columns:1fr 1fr 1fr 1fr/.test(s)) k.classList.add('b-kpis');
    else if (k.tagName === 'BUTTON' && /צמיד/.test(t)) k.classList.add('b-search');
    else if (/231,76,60,\.18|re-hi/.test(s) && k.children.length <= 2) k.classList.add('b-alert');
    else if (/230,126,34/.test(s) && /var\(--or\)/.test(s)) k.classList.add('b-next');
    else if (/justify-content:center/.test(s) && /\|/.test(t)) k.classList.add('b-stats');
  });
}

W.FormUI = {
  cur: 'field',
  bind: function(c){
    if (c.__spy) return; c.__spy = true;
    c.addEventListener('scroll', function(){
      if (c.dataset.view !== 'form') return;
      var top = c.getBoundingClientRect().top, cur = 'field';
      ['field','fs-body','fs-vitals','fs-care','fs-record','fs-now'].forEach(function(id){ var e = document.getElementById(id); if (e && e.getBoundingClientRect().top - top <= 120) cur = id; });
      if (cur !== W.FormUI.cur){ W.FormUI.cur = cur; c.querySelectorAll('.fnav button').forEach(function(b){ b.classList.toggle('on', b.dataset.t === cur); }); }
    }, { passive:true });
  },
  enhance: function(c){ enhanceForm(c); },
  jump: function(id){
    var c = document.getElementById('incident-content'), e = document.getElementById(id); if (!c || !e) return;
    c.scrollTo({ top: c.scrollTop + e.getBoundingClientRect().top - c.getBoundingClientRect().top - 56, behavior: 'smooth' });
  },
  handoff: function(){
    var app = document.getElementById('app'); if (document.getElementById('fs-sheet')) return;
    var raw = W.generateMISTPlusReport ? W.generateMISTPlusReport() : '';
    var text = W.Polish ? W.Polish.strip(W.ShowcaseI18n ? W.ShowcaseI18n.tr(raw) : raw) : raw;
    var s = document.createElement('div'); s.id = 'fs-sheet'; s.className = 'sheet-wrap';
    s.innerHTML = '<div class="sheet-dim" onclick="FormUI.closeSheet()"></div><div class="sheet" role="dialog" aria-label="MIST+"><div class="sheet-grab"></div>'
      + '<h3>' + L('Handoff report (MIST+)','דוח העברה (MIST+)') + '</h3><pre class="mist" dir="auto">' + W.escapeHtml(text) + '</pre><p class="mist-warn">' + W.escapeHtml(W.Disclaimer ? W.Disclaimer.short() : '') + '</p>'
      + '<div class="bo-actions"><button class="xbtn" onclick="FormUI.closeSheet();FormUI.sheet()">' + ico('share-2', 24) + L('SHARE / PRINT','שיתוף / הדפסה') + '</button><button class="xbtn" onclick="showRadioReadout();FormUI.closeSheet()">' + ico('radio', 24) + L('RADIO SCRIPT','תסריט רדיו') + '</button>'
      + '<button class="xbtn xbtn-primary" onclick="copyMISTPlus()">' + ico('copy', 24) + L('COPY','העתק') + '</button></div></div>';
    app.appendChild(s);
  },
  sheet: function(){
    var app = document.getElementById('app'); if (document.getElementById('fs-sheet')) return;
    var s = document.createElement('div'); s.id = 'fs-sheet'; s.className = 'sheet-wrap no-polish';
    var items = [
      ['file-text', L('Form 101 (print / PDF)','טופס 101 (הדפסה / PDF)'), L('Full casualty record','תיק נפגע מלא'), 'printCasualty()'],
      ['radio', L('Radio report','דיווח רדיו'), L('Read-out script for the net','תסריט הקראה לרשת'), 'showRadioReadout()'],
      ['copy', L('Copy MIST','העתקת MIST'), L('Mechanism, injuries, signs, treatment','מנגנון, פציעות, סימנים, טיפול'), 'copyMIST()'],
      ['share-2', L('Send via WhatsApp','שליחה בוואטסאפ'), L('MIST+ summary','סיכום MIST+'), 'shareCasualtyWhatsApp()'],
      ['qr-code', L('Wristband','צמיד'), L('QR bracelet with this record','צמיד QR עם התיק הזה'), 'openBraceletExport()']
    ];
    s.innerHTML = '<div class="sheet-dim" onclick="FormUI.closeSheet()"></div><div class="sheet" role="dialog" aria-label="' + L('Share and print','שיתוף והדפסה') + '"><div class="sheet-grab"></div><h3>' + L('Share & print','שיתוף והדפסה') + '</h3>'
      + items.map(function(i){ return '<button class="sheet-row" onclick="FormUI.closeSheet();' + i[3] + '"><span class="gi">' + ico(i[0], 19) + '</span><span><b>' + i[1] + '</b><small>' + i[2] + '</small></span></button>'; }).join('') + '</div>';
    app.appendChild(s);
  },
  closeSheet: function(){ var s = document.getElementById('fs-sheet'); if (s) s.remove(); }
};
W.BoardUI = { enhance: enhanceBoard };
})();
