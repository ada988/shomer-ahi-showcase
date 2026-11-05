/* Shared core utilities: HTML escaping and the toast message.
 * Exposes the window.SA namespace. Safe to load more than once.
 */
(function(){
  'use strict';
  if (window.SA && window.SA._v) return;
  var SA = window.SA || {};
  SA._v = '1';

  // XSS-safe HTML escape for any text placed into markup.
  SA.escapeHtml = function(s){
    return String(s == null ? '' : s)
      .replace(/[&<>"']/g, function(c){
        return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
      });
  };

  // Toast message in #tst / #tst-m. {undo:true} shows the '.ul' undo button; {duration:N} sets the time on screen.
  SA.toast = function(msg, opts){
    opts = opts || {};
    var el = document.getElementById('tst');
    if (!el) return;
    var m = document.getElementById('tst-m');
    if (m) m.textContent = msg;
    var undoEl = el.querySelector ? el.querySelector('.ul') : null;
    if (undoEl) undoEl.style.display = opts.undo ? 'inline' : 'none';
    el.classList.add('on');
    clearTimeout(el._t);
    el._t = setTimeout(function(){ el.classList.remove('on'); }, opts.duration || 2800);
  };

  window.SA = SA;
})();
