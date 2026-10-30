/* Display-layer HE → EN translation for the showcase.
   The medical logic keys on Hebrew identifiers (drug names, region ids, etc.), so the source
   stays Hebrew and every string that reaches the user is translated on the way out:
   rendered DOM text + attributes, dialogs, clipboard and print output. */
(function(){
'use strict';
var HE = /[֐-׿]/;
var HE_RUN = /[֐-׿][֐-׿0-9A-Za-z .,'"׳״\-–—:;!?()\/%+·•…|=→←↑↓×]*/g;
var lang = 'en';
try { lang = localStorage.getItem('sc_lang') === 'he' ? 'he' : 'en'; } catch(e){}   // only the two known languages are accepted from storage

var dict = null, rx = null;
function build(){
  dict = window.SHOWCASE_DICT || {};
  var keys = Object.keys(dict).filter(function(k){ return k && dict[k]; });
  keys.sort(function(a,b){ return b.length - a.length; });
  var esc = function(s){ return s.replace(/[.*+?^${}()|[\]\\\/]/g,'\\$&'); };
  // Whole-word match on the Hebrew side so short keys never fire inside longer words.
  rx = keys.length ? new RegExp('(?<![\\u0590-\\u05FF])(?:' + keys.map(esc).join('|') + ')(?![\\u0590-\\u05FF])','g') : null;
}
function tr(s){
  if (lang !== 'en' || s == null) return s;
  s = String(s);
  if (!HE.test(s)) return s;
  if (!rx) build();
  return rx ? s.replace(rx, function(m){ return dict[m]; }) : s;
}

var TRIAGE_CODES = { 'דחוף':'URGENT', 'מיידי':'URGENT', 'לא-דחוף':'NOT URGENT', 'לא דחוף':'NOT URGENT', 'דחוי':'DELAYED', 'עדיפות שנייה':'DELAYED', 'קל':'NOT URGENT', 'ממתין':'WAITING', 'ציפייה':'WAITING', 'חלל':'NO SIGNS OF LIFE', 'נפטר':'NO SIGNS OF LIFE', 'ללא סימני חיים':'NO SIGNS OF LIFE' };
var EXACT = { 'Management':'TREAT', 'Evac':'EVACUATE', 'Triage':'TRIAGE', 'Minimal':'NOT URGENT', 'Immediate':'URGENT', 'Delayed':'DELAYED', 'Expectant':'WAITING', 'Deceased':'NO SIGNS OF LIFE', 'DECEASED':'NO SIGNS OF LIFE' };
var HE_FIX = { 'hemorrhage':'דימום', 'penetrating':'חודר', 'fracture':'שבר', 'burn':'כוויה', 'weak':'חלש', 'Vented':'מאוורר', 'Handoff':'העברה', 'Temp':'חום', 'mmHg':'מ״מ כספית' };
function exact(s){
  if (lang === 'he'){ var th = String(s).trim(); if (HE_FIX[th]) return s.replace(th, HE_FIX[th]); return s; } var t = String(s).trim(); return EXACT[t] ? s.replace(t, EXACT[t]) : s; }
var ATTRS = ['placeholder','title','aria-label','alt'];
// Hebrew mode: the engine still emits a few raw English keys (injury / treatment type ids, one alert title). Map them for display.
var HE_WORDS = { 'penetrating':'חודר', 'hemorrhage':'דימום', 'fracture':'שבר', 'burn':'כוויה', 'bandage':'חבישה', 'tourniquet':'חוסם עורקים', 'pressureDressing':'תחבושת לחץ', 'hemostatic':'המוסטטי', 'tubeThora':'נקז חזה', 'splint':'קיבוע שבר', 'pelvicBinder':'מקבע אגן', 'woundPacking':'אריזת פצע', 'chestSeal':'אטם חזה', 'Lethal Triad':'שלישיית המוות', 'greater trochanter':'הטרוכנטר הגדול', 'Temp':'חום' };
var HE_WORD_RX = /(?<![A-Za-z])(?:penetrating|hemorrhage|fracture|burn|bandage|tourniquet|pressureDressing|hemostatic|tubeThora|splint|pelvicBinder|woundPacking|chestSeal|Lethal Triad|greater trochanter|Temp)(?![A-Za-z])/g;
// text inside .no-tr (user-typed notes, names) is shown exactly as written
function raw(el){ return !!(el && el.closest && el.closest('.no-tr')); }
function heFix(str){ return str.replace(HE_WORD_RX, function(m){ return HE_WORDS[m]; }); }
function walkHe(root){
  if (root.nodeType === 3){ if (/[A-Za-z]/.test(root.nodeValue) && !raw(root.parentElement) && !(root.parentElement && /^(SCRIPT|STYLE|TEXTAREA)$/.test(root.parentElement.tagName))){ var t = heFix(root.nodeValue); if (t !== root.nodeValue) root.nodeValue = t; } return; }
  if (root.nodeType !== 1 || /^(SCRIPT|STYLE)$/.test(root.tagName)) return;
  var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT), n = root, nodes = [];
  do { nodes.push(n); } while ((n = tw.nextNode()));
  nodes.forEach(function(x){
    if (x.nodeType === 3){ if (/[A-Za-z]/.test(x.nodeValue) && !raw(x.parentElement) && !(x.parentElement && /^(SCRIPT|STYLE|TEXTAREA)$/.test(x.parentElement.tagName))){ var t = heFix(x.nodeValue); if (t !== x.nodeValue) x.nodeValue = t; } }
    else if (x.getAttribute){ ['title','aria-label'].forEach(function(a){ var v = x.getAttribute(a); if (v && /[A-Za-z]/.test(v)){ var t = heFix(v); if (t !== v) x.setAttribute(a, t); } }); }
  });
}
function walk(root){
  if (!root) return;
  if (lang !== 'en') return walkHe(root);
  if (root.nodeType === 3){ if (HE.test(root.nodeValue) && !raw(root.parentElement)) root.nodeValue = tr(root.nodeValue); return; }
  if (root.nodeType !== 1) return;
  var tag = root.tagName;
  if (tag === 'SCRIPT' || tag === 'STYLE') return;
  var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  var n = root, nodes = [];
  do { nodes.push(n); } while ((n = tw.nextNode()));
  nodes.forEach(function(x){
    if (x.nodeType === 3){
      if (HE.test(x.nodeValue) && !raw(x.parentElement)){
        var par = x.parentElement;
        // MCI card badge is a 24px token: use the one-letter triage codes there.
        x.nodeValue = (par && par.classList && par.classList.contains('mci-triage-letter') && TRIAGE_CODES[x.nodeValue.trim()])
          ? TRIAGE_CODES[x.nodeValue.trim()] : exact(tr(x.nodeValue));
      }
    }
    else {
      for (var i = 0; i < ATTRS.length; i++){
        var v = x.getAttribute && x.getAttribute(ATTRS[i]);
        if (v && HE.test(v)) x.setAttribute(ATTRS[i], tr(v));
      }
      if (x.tagName === 'INPUT' && (x.type === 'button' || x.type === 'text') && HE.test(x.value)) x.value = tr(x.value);
      // English reads left-to-right: drop hard-coded RTL on inline styles.
      var st = x.getAttribute && x.getAttribute('style');
      if (st && /direction:\s*rtl|-right|text-align:\s*right/.test(st)){
        x.setAttribute('style', st.replace(/direction:\s*rtl;?/g, '')
          .replace(/(border|margin|padding)-right:/g, '$1-left:')
          .replace(/text-align:\s*right/g, 'text-align:left'));
      }
    }
  });
}

var mo = null;
function observe(){
  if (mo) mo.disconnect();
  mo = new MutationObserver(function(list){
    mo.disconnect();
    list.forEach(function(m){
      if (m.type === 'characterData') walk(m.target);
      else m.addedNodes.forEach(walk);
      if (m.type === 'attributes') walk(m.target);
    });
    mo.observe(document.body, { childList:true, subtree:true, characterData:true });
  });
  mo.observe(document.body, { childList:true, subtree:true, characterData:true });
}

// Dialogs / clipboard / print — everything that bypasses the DOM.
(function patch(){
  ['alert','confirm','prompt'].forEach(function(f){
    var orig = window[f].bind(window);
    window[f] = function(msg, def){
      if (f === 'prompt' && lang === 'en'){
        // Engine asks the user to TYPE a Hebrew outcome word. In English that would silently record "failed", so ask OK/Cancel instead.
        var m = String(msg || ''), q = m.match(/"([^"]+)"\s*(?:\/|או)\s*"([^"]+)"/);
        if (q){ var ok = window.confirm(tr(m.replace(/[:：]?\s*(?:הקלד\s*)?"[^"]+"\s*(?:\/|או)\s*"[^"]+"/, '')) + '\n\nOK = succeeded     Cancel = failed'); return ok ? q[1] : q[2]; }
      }
      return orig(tr(msg), def);
    };
  });
  if (navigator.clipboard && navigator.clipboard.writeText){
    var ow = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = function(t){ t = tr(t); if (window.Disclaimer && !/EARLY BETA DEMO|דמו בטא מוקדמת/.test(t)) t += window.Disclaimer.textFooter(); return ow(t); };
  }
  var oopen = window.open;
  window.open = function(){
    if (typeof arguments[0] === 'string' && /whatsapp\.com\/send|wa\.me\//.test(arguments[0])){
      try { var u = new URL(arguments[0]); var t0 = u.searchParams.get('text') || ''; t0 = tr(t0); if (window.Disclaimer && !/EARLY BETA DEMO|דמו בטא מוקדמת/.test(t0)) t0 += window.Disclaimer.textFooter(); u.searchParams.set('text', t0); arguments[0] = u.toString(); } catch (e) {}
    }
    var w = oopen.apply(window, arguments);
    if (w && w.document){
      var od = w.document.write.bind(w.document);
      w.document.write = function(h){
        if (lang === 'en' && typeof h === 'string'){
          h = tr(h).replace('dir="rtl"','dir="ltr"').replace('lang="he"','lang="en"')
            .replace(/direction:\s*rtl/g,'direction:ltr').replace(/text-align:\s*right/g,'text-align:left');
        }
        if (typeof h === 'string' && window.Disclaimer && !/class="demo-banner"/.test(h) && /<body[^>]*>/i.test(h)) h = h.replace(/<body[^>]*>/i, function(m){ return m + '<div class="demo-banner">' + window.Disclaimer.docBanner() + '</div>'; });
        return od(h);
      };
    }
    return w;
  };
})();

function setLang(l){
  lang = l;
  try { localStorage.setItem('sc_lang', l); } catch(e){}
  document.documentElement.lang = l;
  document.documentElement.dir = l === 'en' ? 'ltr' : 'rtl';
  document.querySelectorAll('[data-en]').forEach(function(el){
    el.textContent = l === 'en' ? el.getAttribute('data-en') : el.getAttribute('data-he');
  });
  document.querySelectorAll('.lang-seg button').forEach(function(b){ b.classList.toggle('on', b.dataset.lang === l); });
  observe();
  if (window.Demo && window.Demo.closeOverlays) window.Demo.closeOverlays(true);   // sheets close; quick triage and the bracelet screens are redrawn in place
  if (window.renderIncidentPage) window.renderIncidentPage();
  if (window.Quick && window.Quick.relang) window.Quick.relang();
  if (window.Bracelet && window.Bracelet.relang) window.Bracelet.relang();
  if (window.Tour && window.Tour.active && window.Tour.active()) window.Tour.redraw();
  if (window.Disclaimer && document.querySelector('.dn')) window.Disclaimer.relang();
}

window.ShowcaseI18n = { tr: tr, apply: walk, setLang: setLang, get lang(){ return lang; },
  /* Modules add their own Hebrew -> English phrases here (whole phrases win over the word-level entries). */
  extend: function(o){ window.SHOWCASE_DICT = Object.assign(window.SHOWCASE_DICT || {}, o); rx = null; },
  /* Developer aid: list Hebrew runs on screen that have no translation yet. */
  missing: function(root){
    var out = {}, r = root || document.body;
    var tw = document.createTreeWalker(r, NodeFilter.SHOW_TEXT), n;
    while ((n = tw.nextNode())){ var m = n.nodeValue.match(HE_RUN); if (m) m.forEach(function(x){ out[x.trim()] = 1; }); }
    return Object.keys(out);
  } };
document.addEventListener('DOMContentLoaded', function(){ setLang(lang); });
})();
