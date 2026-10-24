/* Visual normaliser. The medical engine renders markup with heavy inline decoration (side accent
   stripes, gradients, glows, pulsing animations, emoji as icons). This layer flattens that to a
   restrained, consistent system after every render, without touching the engine itself. */
(function(){
'use strict';
var W = window;

// ── Emoji → line icon / dot / nothing ──────────────────────────
var DOT = { '🔴':'#e5484d', '🟡':'#f5b82e', '🟢':'#30a46c', '⚫':'#4b4f56', '⬛':'#4b4f56', '🔘':'#9aa0a6', '🔵':'#4f8cff', '🟠':'#f08a24', '🟣':'#8e6bd8' };
var SQ  = { '🟧':'#f08a24', '🟫':'#a0714f', '⬜':'#d4d7dd', '🟥':'#e5484d', '🟨':'#f5b82e', '🟩':'#30a46c', '🟦':'#4f8cff' };
var ICON = {
  '🚑':'ambulance','⚡':'zap','🔄':'layers','📋':'file-text','📻':'radio','📡':'radio','📍':'map-pin','🎯':'target','📱':'smartphone',
  '🩹':'bandage','💉':'syringe','💊':'pill','🫁':'wind','🧠':'brain','🩸':'droplet','🌡':'thermometer','🔖':'tag','🔍':'search',
  '⏱':'timer','⏰':'clock','⏳':'clock','📊':'activity','📈':'activity','❤':'heart-pulse','💓':'heart-pulse','🔗':'link','⚠':'triangle-alert',
  '🚨':'siren','🦴':'bone','🔥':'flame','🩺':'stethoscope','🛡':'shield','🔒':'lock','📴':'wifi-off','✓':'check','✔':'check','✕':'x','✖':'x',
  '→':'arrow-right','←':'arrow-left','🤝':'hand-helping','📦':'package','↩':'undo-2','↪':'redo-2','↶':'undo-2','↷':'redo-2','🆘':'siren','🏥':'plus'
};
// Everything else (decorative emoji) is simply dropped.
var EMO = /(?:[←-⇿⌀-⏿☀-➿⬀-⯿⤴⤵]|[\uD83C-\uD83E][\uDC00-\uDFFF])(?:️|‍(?:[\uD83C-\uD83E][\uDC00-\uDFFF])️?)*️?/g;
var TYPO = /[→←✓✕]/;  // typographic arrows/ticks only become icons when they stand alone-ish

function iconFor(ch){
  var base = ch.replace(/️/g, '');
  if (DOT[base]) return '<span class="sdot" style="background:' + DOT[base] + '"></span>';
  if (SQ[base]) return '<span class="sq" style="background:' + SQ[base] + '"></span>';
  var n = ICON[base] || ICON[base.charAt(0)];
  if (n && W.Icon) return W.Icon(n, 14, 'ei-i');
  return '';
}

function replaceEmojiInText(node){
  var s = node.nodeValue; EMO.lastIndex = 0;
  if (!EMO.test(s)) return; EMO.lastIndex = 0;
  var p = node.parentNode; if (!p) return;
  var frag = document.createDocumentFragment(), last = 0, m;
  while ((m = EMO.exec(s))){
    if (m.index > last) frag.appendChild(document.createTextNode(s.slice(last, m.index)));
    var html = iconFor(m[0]);
    if (html){ var sp = document.createElement('span'); sp.className = 'ei'; sp.innerHTML = html; frag.appendChild(sp); }
    last = m.index + m[0].length;
  }
  if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last)));
  // Trim the stray space an emoji used to leave behind.
  var first = frag.firstChild; if (first && first.nodeType === 3) first.nodeValue = first.nodeValue.replace(/^\s+(?=\S)/, function(sp){ return node.previousSibling ? sp : ''; });
  p.replaceChild(frag, node);
}
function stripEmoji(str){ return str.replace(EMO, '').replace(/\s{2,}/g, ' ').trim(); }

// ── Inline style flattening ────────────────────────────────────
var STRIPE = /(?:border-(?:right|left|inline-start|inline-end)|border-top)\s*:\s*([3-9]|\d{2,})px\s+(?:solid|dashed)\s+[^;]+;?/gi;
function flatGradient(m){
  var c = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/.exec(m);
  if (!c) return 'background:var(--c2)';
  var a = Math.min(c[4] == null ? 1 : parseFloat(c[4]), 0.07);
  return 'background:rgba(' + c[1] + ',' + c[2] + ',' + c[3] + ',' + (a < .03 ? .05 : a) + ')';
}
function flatten(st){
  var o = st;
  o = o.replace(STRIPE, function(m){ return /border-top/i.test(m) && !/(red|#e74c3c)/i.test(m) ? '' : ''; });
  o = o.replace(/background(?:-image)?\s*:\s*linear-gradient\([^;]*\)/gi, flatGradient);
  o = o.replace(/background(?:-image)?\s*:\s*radial-gradient\([^;]*\)/gi, 'background:var(--c2)');
  o = o.replace(/1\.5px/g, '1px');
  // Stress rule: nothing small. Any inline text under 16px becomes 16px; tight gaps become 12px.
  o = o.replace(/font-size\s*:\s*(\d+(?:\.\d+)?)px/g, function(m, n){ return parseFloat(n) < 16 ? 'font-size:16px' : m; });
  o = o.replace(/(^|[;\s])gap\s*:\s*(\d+)px/g, function(m, pre, n){ return +n < 10 ? pre + 'gap:12px' : m; });
  o = o.replace(/(?:box|text)-shadow\s*:[^;]*;?/gi, '');
  o = o.replace(/animation(?:-name)?\s*:[^;]*;?/gi, '');
  o = o.replace(/border-radius\s*:\s*(\d+)px/gi, function(m, n){ return +n > 14 && +n < 40 ? 'border-radius:12px' : m; });
  o = o.replace(/(background(?:-color)?\s*:\s*)rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/gi, function(m, pre, r, g, b, a){ return pre + 'rgba(' + r + ',' + g + ',' + b + ',' + Math.min(parseFloat(a), .1) + ')'; });
  return o;
}

var SKIP = { SCRIPT:1, STYLE:1, SVG:1, svg:1, TEXTAREA:1, INPUT:1, CODE:0 };
function polish(root){
  if (!root) return;
  if (root.nodeType === 3){ if (!(root.parentNode && root.parentNode.closest && root.parentNode.closest('.no-polish'))) replaceEmojiInText(root); return; }
  if (root.nodeType !== 1 || root.closest && root.closest('.no-polish, svg')) return;
  var els = [root].concat([].slice.call(root.querySelectorAll('*')));
  els.forEach(function(el){
    if (el.closest('svg') && el.tagName !== 'svg') return;
    // Keyboard + screen reader: clickable non-buttons become real controls; unlabeled inputs get a name.
    if (el.hasAttribute('onclick') && !/^(BUTTON|A|INPUT|SELECT|SUMMARY|TEXTAREA|LABEL)$/.test(el.tagName) && !el.hasAttribute('role')){ el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0'); }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !el.getAttribute('aria-label') && !(el.id && document.querySelector('label[for="' + el.id + '"]'))){
      var nm = el.getAttribute('placeholder') || el.getAttribute('title') || (el.previousElementSibling && el.previousElementSibling.textContent) || (el.parentElement && el.parentElement.firstElementChild !== el && el.parentElement.firstElementChild.textContent) || '';
      nm = nm.replace(/\s+/g, ' ').trim().slice(0, 40); if (nm) el.setAttribute('aria-label', nm);
    }
    var st = el.getAttribute('style');
    if (st && /border-(?:right|left|top|inline)|gradient|shadow|animation|border-radius|font-size|gap/.test(st)){
      var n = flatten(st); if (n !== st) el.setAttribute('style', n);
    }
    ['title','aria-label','placeholder','alt'].forEach(function(a){ var v = el.getAttribute(a); if (v && EMO.test(v)){ EMO.lastIndex = 0; el.setAttribute(a, stripEmoji(v)); } EMO.lastIndex = 0; });
  });
  var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: function(n){ return n.parentNode && n.parentNode.closest && n.parentNode.closest('.no-polish, svg, textarea, script, style') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } });
  var nodes = [], n; while ((n = tw.nextNode())) nodes.push(n);
  nodes.forEach(function(t){ EMO.lastIndex = 0; if (EMO.test(t.nodeValue)){ EMO.lastIndex = 0; replaceEmojiInText(t); } EMO.lastIndex = 0; });
}

var busy = false;
function start(){
  var mo = new MutationObserver(function(list){
    if (busy) return; busy = true;
    try { list.forEach(function(m){ m.addedNodes.forEach(function(n){ if (n.nodeType === 1 || n.nodeType === 3) polish(n); }); if (m.type === 'characterData') polish(m.target); }); }
    finally { busy = false; }
  });
  mo.observe(document.body, { childList:true, subtree:true, characterData:true });
  polish(document.body);
}
W.Polish = { apply: polish, strip: stripEmoji };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
