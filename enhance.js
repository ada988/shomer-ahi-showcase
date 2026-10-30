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
  var nameIn   = c.querySelector('#cas-name'), nameRow = nameIn && nameIn.parentNode !== c ? nameIn.parentNode : (hdr ? hdr.nextElementSibling : null);   // by id: the header text differs for a new casualty
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

  // ── New, lean structure ─────────────────────────────────────────
  // 1 field panel (identity, triage, X-CARE, clocks, vitals)  2 suggestions (folded)  3 body map  4 details (folded)  5 record
  var open = W.FormUI.open;
  function fold(key, title, cls){ var d = document.createElement('details'); d.className = 'fs-fold ' + (cls || ''); d.dataset.k = key; if (open[key]) d.setAttribute('open', ''); var sm = document.createElement('summary'); sm.innerHTML = title; d.appendChild(sm); var w = document.createElement('div'); w.className = 'fs-fold-b'; d.appendChild(w); return d; }
  function put(d, el){ if (el) d.querySelector('.fs-fold-b').appendChild(el); }

  var sSug = fold('sug', '<span>' + L('Software suggestions','הצעות תוכנה') + '<small>' + L('Can be wrong. A medical professional decides.','עלולות לטעות. איש צוות רפואי מחליט.') + '</small></span>', 'fs-sug');
  [cds, recs].forEach(function(el){ put(sSug, el); });
  if (recs) { recs.classList.add('b-recs'); recs.setAttribute('data-tour', 'alerts'); }
  sSug.id = 'fs-now';

  var sBody = section('fs-body', L('Body map','מפת גוף'), L('Tap a body part to mark a wound','לחצו על אזור בגוף כדי לסמן פציעה'));
  [seg, map].forEach(function(el){ move(sBody, el); });
  var fInj = fold('inj', '<span>' + L('Marked injuries','פציעות מסומנות') + '</span>'); put(fInj, inj); if (inj) sBody.querySelector('.fs-b').appendChild(fInj);
  var fTr = fold('tr', '<span>' + L('Treatments on the body','טיפולים על הגוף') + '</span>'); put(fTr, treat); if (treat) sBody.querySelector('.fs-b').appendChild(fTr);

  if (ventry) [].slice.call(ventry.querySelectorAll('button[onclick*="radialPulse="]')).forEach(function(bt){
    var on = !/background:\s*#[0-9a-f]{6}15/i.test(bt.getAttribute('style') || ''); bt.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on){ bt.classList.add('sel'); bt.insertAdjacentHTML('afterbegin', ico('check', 22)); }
  });
  var sCare = document.createElement('div'); sCare.className = 'fs-more-b';
  var fVit = fold('vit', '<span>' + L('More vitals: temperature, EtCO₂, radial pulse','עוד מדדים: חום, EtCO₂, דופק רדיאלי') + '</span>'); put(fVit, ventry); put(fVit, savevit); sCare.appendChild(fVit);
  if (urgency){
    // selected = filled button + tick + aria-pressed (not colour alone)
    [].slice.call(urgency.querySelectorAll('button[onclick*="_casualtyEvacPriority"]')).forEach(function(bt){
      var on = !/background:\s*none/.test(bt.getAttribute('style') || ''); bt.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (on){ bt.classList.add('sel'); bt.insertAdjacentHTML('afterbegin', ico('check', 24)); }
    });
    sCare.appendChild(urgency);
  }

  // Record: who, mechanism, timeline, casualty details. Diagnoses list, care echelons, undo/redo and the old strips are dropped.
  var sRec = section('fs-record', L('Record','תיק'), L('Who, what happened, timeline','מי, מה קרה, ציר זמן'));
  var patient = document.createElement('div'); patient.className = 'fs-patient';
  var pat = document.createElement('div'); pat.innerHTML = W.Field && W.Field.patientHtml ? W.Field.patientHtml() : '';
  [nameRow].concat([].slice.call(pat.children)).concat([moi]).forEach(function(el){ if (el) patient.appendChild(el); });
  var rec = sRec.querySelector('.fs-b'); rec.appendChild(patient);
  if (peds) rec.appendChild(peds);
  // the engine's timeline fold is replaced by the Timeline section (timeline.js)
  var cdet = details.filter(function(el){ return /פרטי הפצוע/.test(txt(el)); })[0]; if (cdet) rec.appendChild(cdet);

  var m = sBody.querySelector('.body-map-wrap'); if (m) m.setAttribute('data-tour', 'bodymap');

  var hand = document.createElement('div'); hand.className = 'fs-handoff';
  handoff.forEach(function(el){ hand.appendChild(el); });
  var bar = document.createElement('div'); bar.className = 'fs-bar';
  bar.innerHTML = '<button class="xbtn bar-back" onclick="Demo.back()">' + ico(document.documentElement.dir === 'rtl' ? 'arrow-right' : 'arrow-left', 26) + '<span>' + L('BACK','חזרה') + '</span></button>'
    + '<button class="xbtn" onclick="Field.undo()">' + ico('undo-2', 28) + '<span>' + L('UNDO','בטל') + '</span></button>'
    + '<button class="xbtn xbtn-primary" data-tour="handoff" onclick="FormUI.handoff()">' + ico('radio', 28) + '<span>' + L('HANDOFF','העברה') + '</span></button>';

  var frag = document.createDocumentFragment();
  var fieldWrap = document.createElement('div'); fieldWrap.innerHTML = W.Field ? W.Field.html() : '';
  var topSec = fieldWrap.querySelector('#field'), monSec = fieldWrap.querySelector('#fs-more');
  var jb = document.createElement('nav'); jb.className = 'jb'; jb.setAttribute('aria-label', L('Jump to','קפיצה אל'));
  [['field', L('101 FORM','טופס 101')], ['fs-body', L('BODY MAP','מפת גוף')], ['fs-time', L('TIMELINE','ציר זמן')], ['fs-more', L('VITALS + RECORD','מדדים ותיק')]].forEach(function(q){
    var bt = document.createElement('button'); bt.textContent = q[1]; bt.dataset.t = q[0]; bt.className = (W.FormUI.cur || 'field') === q[0] ? 'on' : ''; if (bt.className) bt.setAttribute('aria-current', 'true'); bt.onclick = function(){ FormUI.jump(q[0]); }; jb.appendChild(bt);
  });
  if (monSec) { monSec.appendChild(sCare); if (recs) monSec.appendChild(sSug); monSec.appendChild(sRec); }   // no suggestions yet = no empty box
  frag.appendChild(jb);
  if (topSec) frag.appendChild(topSec);
  frag.appendChild(sBody);
  if (W.Field && W.Field.timelineHtml){ var tw = document.createElement('div'); tw.innerHTML = W.Field.timelineHtml(); while (tw.firstChild) frag.appendChild(tw.firstChild); }
  if (monSec) frag.appendChild(monSec);
  var disc = document.createElement('p'); disc.className = 'fs-disc'; disc.textContent = L('Early beta demo · fictional patients · not for clinical use. Software suggestions can be wrong; a medical professional decides.','דמו בטא מוקדמת · נפגעים בדויים · לא לשימוש קליני. הצעות התוכנה עלולות לטעות; איש צוות רפואי מחליט.'); frag.appendChild(disc);
  var spacer = document.createElement('div'); spacer.className = 'fs-foot'; frag.appendChild(spacer); frag.appendChild(hand); frag.appendChild(bar);
  c.innerHTML = ''; c.appendChild(frag);
  c.querySelectorAll('button[aria-label]').forEach(function(bt){ if (!/[A-Za-z0-9א-ת]/.test(bt.textContent) && !bt.querySelector('svg') && /delete|remove|מחק|הסר/i.test(bt.getAttribute('aria-label'))) { bt.innerHTML = ico('x', 22) + '<span>' + L('DELETE','מחק') + '</span>'; bt.classList.add('del-btn'); } });
  c.dataset.enh = 'form';
  flattenSvg(c); flattenVitals(c);
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
  c.dataset.enh = 'board';
  // Quick-triage records carry a QUICK badge on the command board too (same as the casualty list).
  [].slice.call(c.querySelectorAll('.mci-card')).forEach(function(card){
    var m = /toggleMCICardExpand\('([^']+)'\)/.exec(card.getAttribute('onclick') || ''), rec = m && (W._incidentCasualties || []).filter(function(x){ return x._docId === m[1]; })[0];
    var row = card.querySelector('.mci-card-row');
    if (rec && rec.formLevel === 'quick' && row && !row.querySelector('.lvl')) row.insertAdjacentHTML('afterend', '<span class="lvl quick">' + ico('zap', 20) + L('QUICK TRIAGE','מיון מהיר') + '</span>');
  });
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
  open: {},
  bind: function(c){
    if (c.__spy) return; c.__spy = true;
    c.addEventListener('click', function(ev){ var sm = ev.target.closest && ev.target.closest('details.fs-fold > summary'); if (!sm) return; var d = sm.parentNode; W.FormUI.open[d.dataset.k] = !d.open; }, true);
    c.addEventListener('scroll', function(){
      if (c.dataset.view !== 'form') return;
      var top = c.getBoundingClientRect().top, cur = 'field', jb = c.querySelector('.jb'), lim = (jb ? jb.getBoundingClientRect().bottom - top : 84) + 40;
      ['field','fs-body','fs-time','fs-more'].forEach(function(id){ var e = document.getElementById(id); if (e && e.getBoundingClientRect().top - top <= lim) cur = id; });
      if (cur !== W.FormUI.cur){ W.FormUI.cur = cur; c.querySelectorAll('.jb button').forEach(function(b){ var on = b.dataset.t === cur; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); }); }
    }, { passive:true });
  },
  enhance: function(c){ enhanceForm(c); },
  jump: function(id){
    var c = document.getElementById('incident-content'), e = document.getElementById(id); if (!c || !e) return;
    if (id === 'fs-now'){ W.FormUI.open.sug = true; e.setAttribute('open', ''); }
    var jb = c.querySelector('.jb'), off = jb ? jb.getBoundingClientRect().bottom - c.getBoundingClientRect().top + 6 : 60;
    c.scrollTo({ top: id === 'field' ? 0 : c.scrollTop + e.getBoundingClientRect().top - c.getBoundingClientRect().top - off, behavior: 'smooth' });
    if (['field','fs-body','fs-time','fs-more'].indexOf(id) >= 0){ W.FormUI.cur = id; c.querySelectorAll('.jb button').forEach(function(b){ b.classList.toggle('on', b.dataset.t === id); }); }
  },
  handoff: function(){
    var app = document.getElementById('app'); if (document.getElementById('fs-sheet')) return;
    var raw = W.generateMISTPlusReport ? W.generateMISTPlusReport() : '';
    var text = W.Polish ? W.Polish.strip((W.ShowcaseI18n ? W.ShowcaseI18n.tr(raw) : raw).replace(/→/g, L(' then ', ' ואז '))) : raw;
    var s = document.createElement('div'); s.id = 'fs-sheet'; s.className = 'sheet-wrap';
    s.innerHTML = '<div class="sheet-dim" onclick="FormUI.closeSheet()"></div><div class="sheet ho-sheet" role="dialog" aria-label="MIST+"><div class="sheet-grab"></div>'
      + '<div class="ho-top"><h3>' + L('Handoff report (MIST+)','דוח העברה (MIST+)') + '</h3><button class="xbtn" onclick="FormUI.closeSheet()">' + ico('x', 24) + L('CLOSE','סגור') + '</button></div><pre class="mist" dir="auto">' + W.escapeHtml(text) + '</pre><p class="mist-warn">' + W.escapeHtml(W.Disclaimer ? W.Disclaimer.short() : '') + '</p>'
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
