/* Notifications can always be swiped away (left or right) or tapped on their text. Applies to every toast and alert banner. */
(function(){
'use strict';
var SEL = '#tst.on, .undo-toast, .eta-toast';
var S = null, justDragged = false;
function gone(el){
  if (el.id === 'tst'){ el.classList.remove('on'); clearTimeout(el._t); el.style.translate = ''; el.style.opacity = ''; el.style.transition = ''; }
  else el.remove();
}
document.addEventListener('pointerdown', function(e){
  var el = e.target.closest && e.target.closest(SEL); if (!el) return;
  S = { el:el, x:e.clientX, y:e.clientY, dx:0, t:Date.now(), moved:false, id:e.pointerId };
}, true);
document.addEventListener('pointermove', function(e){
  if (!S || e.pointerId !== S.id) return;
  var dx = e.clientX - S.x, dy = e.clientY - S.y;
  if (!S.moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)){ S.moved = true; S.el.style.transition = 'none'; try { S.el.setPointerCapture(e.pointerId); } catch(_){} }
  if (S.moved){ S.dx = dx; S.el.style.translate = dx + 'px 0'; S.el.style.opacity = String(Math.max(.25, 1 - Math.abs(dx) / 300)); }
}, true);
function end(e){
  if (!S || e.pointerId !== S.id) return;
  var el = S.el, dx = S.dx, fast = Math.abs(dx) / Math.max(1, Date.now() - S.t) > .5, moved = S.moved; S = null;
  if (moved){
    justDragged = true; setTimeout(function(){ justDragged = false; }, 350);
    if (Math.abs(dx) > 70 || fast){ el.style.transition = 'translate .16s, opacity .16s'; el.style.translate = (dx > 0 ? 500 : -500) + 'px 0'; el.style.opacity = '0'; setTimeout(function(){ gone(el); }, 160); }
    else { el.style.transition = 'translate .15s, opacity .15s'; el.style.translate = ''; el.style.opacity = ''; }
  }
}
document.addEventListener('pointerup', end, true);
document.addEventListener('pointercancel', end, true);
// a drag must not trigger the button under the finger; a plain tap on the message text dismisses
document.addEventListener('click', function(e){
  var el = e.target.closest && e.target.closest(SEL); if (!el) return;
  if (justDragged){ e.stopPropagation(); e.preventDefault(); return; }
  if (el.id === 'tst' && !(e.target.closest && e.target.closest('button'))) gone(el);
  else if (el.classList.contains('undo-toast') && !(e.target.closest && e.target.closest('button'))) gone(el);
}, true);
})();
