/* Top bar collapse, tied to the scroll like a native app: the bar slides up exactly as far as you scroll down,
   slides back as you scroll up, and settles fully open or fully closed when you let go. It floats over the
   content (transform only), so nothing below it jumps. Sticky bars inside the page sit right under it. */
(function(){
'use strict';
var c, bar, H = 72, off = 0, lastY = 0, raf = 0, idle = 0, view = null;
var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function apply(animate){
  if (!bar) return;
  bar.style.transition = animate && !reduce ? 'transform .2s cubic-bezier(.2,.8,.2,1)' : 'none';
  bar.style.transform = off ? 'translate3d(0,' + (-off) + 'px,0)' : '';
  bar.classList.toggle('hide', off >= H - 1);
  var vis = Math.max(0, H - off);
  c.style.setProperty('--abv', vis + 'px');
  if (animate && !reduce){ c.classList.add('ab-anim'); clearTimeout(apply._t); apply._t = setTimeout(function(){ c.classList.remove('ab-anim'); }, 220); }
}
function measure(){
  if (!bar || !c) return;
  var h = bar.offsetHeight || 72;
  if (h !== H){ H = h; off = Math.min(off, H); }
  c.style.setProperty('--abh', H + 'px');
  apply(false);
}
function onScroll(){
  var y = Math.max(0, c.scrollTop), d = y - lastY; lastY = y;
  if (y <= 0) off = 0;
  else off = Math.max(0, Math.min(H, off + d));
  // never hide while the page is too short to need it
  if (c.scrollHeight - c.clientHeight < H * 2) off = 0;
  if (!raf) raf = requestAnimationFrame(function(){ raf = 0; apply(false); });
  clearTimeout(idle);
  idle = setTimeout(settle, 140);
}
function settle(){
  if (off === 0 || off === H) return;
  var y = c.scrollTop;
  off = (off > H / 2 && y > H) ? H : 0;
  apply(true);
}
function show(){ off = 0; lastY = c ? c.scrollTop : 0; apply(true); }

function bind(){
  c = document.getElementById('incident-content'); bar = document.querySelector('.appbar');
  if (!c || !bar) return;
  document.documentElement.classList.add('ab-float');
  measure();
  c.addEventListener('scroll', onScroll, { passive:true });
  window.addEventListener('resize', measure);
  if (window.ResizeObserver) new ResizeObserver(measure).observe(bar);
  view = c.dataset.view;
  new MutationObserver(function(){ if (c.dataset.view !== view){ view = c.dataset.view; off = 0; lastY = 0; apply(false); } }).observe(c, { attributes:true, attributeFilter:['data-view'] });
  // focusing a field near the top or tapping the status area brings the bar back
  bar.addEventListener('focusin', show);
}
window.AppBar = { show: function(){ if (c) show(); } };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
})();
