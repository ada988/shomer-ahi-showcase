/* BODY MAP ZOOM — mark the exact wound spot.
   Long-press a body region (about half a second, a ring fills under the finger) or tap "Zoom" in the region menu.
   The region opens large; tap the exact spot to drop a numbered pin, drag a pin to move it, select it to delete it.
   Pins are stored on the injury record as {x, y} relative to the region's zone (0..1), so they survive a language
   switch, show on the full map at the same place, and are counted in the handoff report. A short tap on the map
   still does what it always did. */
(function(){
'use strict';
var W = window, HOLD = 450, SLOP = 10;
function lang(){ return (W.ShowcaseI18n && W.ShowcaseI18n.lang) || 'en'; }
function L(en, he){ return lang() === 'he' ? he : en; }
function ico(n, s){ return W.Icon ? W.Icon(n, s) : ''; }
function app(){ return document.getElementById('app'); }
function tr(s){ return W.ShowcaseI18n ? W.ShowcaseI18n.tr(s) : s; }
function label(id){ return tr(W.bodyLabelOut ? W.bodyLabelOut(id) : ((W.BODY_LABELS || {})[id] || id)); }
function inj(id, side){ return (W._casualtyInjuries || []).filter(function(i){ return i.region === id && i.side === side; })[0] || null; }
function save(){ if (W.MedHost && W.MedHost.triggerAutoSave) W.MedHost.triggerAutoSave(); }
function snap(){ if (W.pushMedHistory) W.pushMedHistory(); }

var Z = null;   // { id, side, sel, drag }

// ── Zoom sheet ───────────────────────────────────────────────────
function draw(){
  var s = document.getElementById('bz-sheet'); if (!s || !Z) return;
  var b = W.bodyZoneBox ? W.bodyZoneBox(Z.id) : null; if (!b) return;
  var pad = Math.max(b.w, b.h) * 0.08, vb = [b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2];
  var i = inj(Z.id, Z.side), pins = (i && i.pins) || [], sil = W.BODY_SILHOUETTE || '';
  var cls = i ? ' ' + i.type : '';
  var svg = '<svg id="bz-svg" viewBox="' + vb.join(' ') + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + label(Z.id) + '">'
    + '<defs><clipPath id="bz-clip"><path d="' + sil + '"/></clipPath></defs>'
    + '<path class="bz-sil" d="' + sil + '"/>'
    + '<g clip-path="url(#bz-clip)"><path class="bz-zone' + cls + '" d="' + W.BODY_ZONES[Z.id] + '"/></g>'
    + '<path class="bz-out" d="' + sil + '"/>';
  var r = Math.max(b.w, b.h) * 0.045;
  pins.forEach(function(p, k){
    var x = b.x + p.x * b.w, y = b.y + p.y * b.h;
    svg += '<g class="bz-pin' + (Z.sel === k ? ' on' : '') + '" data-k="' + k + '"><circle cx="' + x + '" cy="' + y + '" r="' + (r * 1.9) + '" class="bz-hit"/><circle cx="' + x + '" cy="' + y + '" r="' + r + '" class="bz-dot"/><text x="' + x + '" y="' + (y + r * 0.42) + '" font-size="' + (r * 1.15) + '">' + (k + 1) + '</text></g>';
  });
  svg += '</svg>';
  var hint = Z.sel != null && pins[Z.sel]
    ? '<div class="bz-sel"><span>' + L('Point ' + (Z.sel + 1) + ' · drag to move', 'נקודה ' + (Z.sel + 1) + ' · גררו להזזה') + '</span><button class="bz-del" onclick="BodyZoom.del()">' + ico('x', 24) + L('Delete','מחיקה') + '</button></div>'
    : '<p class="bz-hint" role="status">' + (Z.msg || (pins.length ? L(pins.length + (pins.length === 1 ? ' point marked. Tap to add more.' : ' points marked. Tap to add more.'), 'סומנו ' + pins.length + ' נקודות. לחצו להוספה.') : L('Tap the exact wound spot','לחצו על המקום המדויק של הפצע'))) + '</p>';
  s.querySelector('.bz-body').innerHTML = svg + hint;
  s.querySelector('.bz-ttl').innerHTML = '<b>' + label(Z.id) + '</b><small>' + (Z.side === 'back' ? L('Back','אחורי') : L('Front','קדמי')) + '</small>';
  wire();
}
function open(id){
  if (!id || !W.bodyZoneBox || !W.bodyZoneBox(id)) return;
  close(true);
  Z = { id: id, side: W._casualtyView || 'front', sel: null, lang: lang() };
  W._selectedRegion = null;          // the region menu closes behind the zoom; the map redraws on Done
  var s = document.createElement('div'); s.id = 'bz-sheet'; s.className = 'bz no-polish'; s.setAttribute('role', 'dialog'); s.setAttribute('aria-modal', 'true');
  s.innerHTML = '<div class="bz-top"><div class="bz-ttl"></div>'
    + '<button class="bz-undo" onclick="BodyZoom.undo()">' + ico('undo-2', 24) + '<span>' + L('Undo','בטל') + '</span></button>'
    + '<button class="bz-done" onclick="BodyZoom.close()">' + ico('check', 26) + '<span>' + L('Done','סיום') + '</span></button></div><div class="bz-body"></div>';
  s.setAttribute('aria-label', L('Zoomed body map','מפת גוף מוגדלת'));
  app().appendChild(s);
  draw();
  var d = s.querySelector('.bz-done'); if (d) d.focus();
}
function close(silent){
  var s = document.getElementById('bz-sheet'); if (s) s.remove();
  if (!silent && Z){ Z = null; if (W.MedHost && W.MedHost.renderIncidentPage) W.MedHost.renderIncidentPage(); }
  Z = null;
}
// screen point -> svg user units
function pt(svg, e){ var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); }
function wire(){
  var svg = document.getElementById('bz-svg'); if (!svg) return;
  var b = W.bodyZoneBox(Z.id), down = null;
  svg.addEventListener('pointerdown', function(e){
    var g = e.target.closest && e.target.closest('.bz-pin');
    down = { x: e.clientX, y: e.clientY, k: g ? +g.dataset.k : null, moved: false };
    if (g) { try { svg.setPointerCapture(e.pointerId); } catch (x) {} }
    e.preventDefault();
  });
  svg.addEventListener('pointermove', function(e){
    if (!down || down.k == null) return;
    if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) return;
    var i = inj(Z.id, Z.side); if (!i || !i.pins || !i.pins[down.k]) return;
    if (!down.moved){ snap(); down.moved = true; i = inj(Z.id, Z.side); }
    var q = pt(svg, e), sil = svg.querySelector('.bz-sil');
    if (sil && sil.isPointInFill && !sil.isPointInFill(new DOMPoint(q.x, q.y))) return;   // pins stay on the body
    i.pins[down.k] = { x: clamp((q.x - b.x) / b.w), y: clamp((q.y - b.y) / b.h) };
    var g = svg.querySelector('.bz-pin[data-k="' + down.k + '"]');
    if (g) g.querySelectorAll('circle,text').forEach(function(c){
      if (c.tagName === 'text'){ c.setAttribute('x', q.x); c.setAttribute('y', q.y + (+svg.querySelector('.bz-dot').getAttribute('r')) * 0.42); }
      else { c.setAttribute('cx', q.x); c.setAttribute('cy', q.y); }
    });
  });
  svg.addEventListener('pointerup', function(e){
    if (!down) return; var d = down; down = null;
    if (d.k != null){ if (d.moved){ save(); Z.sel = d.k; } else Z.sel = Z.sel === d.k ? null : d.k; Z.msg = null; return draw(); }
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > SLOP) return;
    if (Z.sel != null){ Z.sel = null; return draw(); }   // first tap away just deselects
    var q = pt(svg, e), sil = svg.querySelector('.bz-sil');
    var inBody = !(sil && sil.isPointInFill) || sil.isPointInFill(new DOMPoint(q.x, q.y));
    var inZone = q.x >= b.x && q.x <= b.x + b.w && q.y >= b.y && q.y <= b.y + b.h;
    if (!inBody || !inZone){ Z.msg = L('Tap on this part of the body','לחצו על החלק הזה בגוף'); return draw(); }
    add({ x: clamp((q.x - b.x) / b.w), y: clamp((q.y - b.y) / b.h) });
  });
  svg.addEventListener('pointercancel', function(){ down = null; });
}
function clamp(v){ return Math.max(0, Math.min(1, Math.round(v * 1000) / 1000)); }
function add(p){
  snap();
  var i = inj(Z.id, Z.side);
  if (!i){ i = { region: Z.id, side: Z.side, type: 'other', severity: '', notes: '' }; W._casualtyInjuries.push(i); }
  i.pins = (i.pins || []).concat([p]);
  Z.sel = null; Z.msg = null; save(); draw();
  if (navigator.vibrate) navigator.vibrate(12);
}

// ── Long-press on the main map ──────────────────────────────────
var hold = null, eatClick = 0;
function regionOf(t){
  var el = t && t.closest && t.closest('.body-map-wrap [onclick*="handleRegionTap"]'); if (!el) return null;
  var m = /handleRegionTap\('([^']+)'\)/.exec(el.getAttribute('onclick') || ''); return m ? m[1] : null;
}
function cancelHold(){ if (!hold) return; clearTimeout(hold.t); if (hold.ring) hold.ring.remove(); hold = null; }
document.addEventListener('pointerdown', function(e){
  if (e.button > 0) return;
  var id = regionOf(e.target); if (!id) return;
  cancelHold();
  var a = app(), r = a.getBoundingClientRect(), ring = document.createElement('div');
  ring.className = 'bz-ring'; ring.style.left = (e.clientX - r.left) + 'px'; ring.style.top = (e.clientY - r.top) + 'px';
  ring.setAttribute('aria-hidden', 'true'); a.appendChild(ring);
  hold = { id: id, x: e.clientX, y: e.clientY, ring: ring, t: setTimeout(function(){
    var h = hold; cancelHold(); if (!h) return;
    eatClick = Date.now();                 // the click that follows the hold must not also toggle the region menu
    if (navigator.vibrate) navigator.vibrate(30);
    open(h.id);
  }, HOLD) };
}, true);
document.addEventListener('pointermove', function(e){ if (hold && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > SLOP) cancelHold(); }, true);
['pointerup','pointercancel'].forEach(function(n){ document.addEventListener(n, cancelHold, true); });
document.addEventListener('click', function(e){ if (eatClick && Date.now() - eatClick < 800){ eatClick = 0; e.preventDefault(); e.stopPropagation(); } }, true);
document.addEventListener('contextmenu', function(e){ if (e.target.closest && e.target.closest('.body-map-wrap')) e.preventDefault(); }, true);

// ── "Zoom" button inside the region menu (so nobody has to know the gesture) ──
function addZoomButton(){
  var m = document.querySelector('.body-tap-menu'); if (!m) return;
  // injury types and step tabs: icon + word, and the steps are a tab list
  m.querySelectorAll('.btm-btn').forEach(function(b){
    if (b.querySelector('svg')) return;
    var t = b.textContent || '', n = /penetrat|חודר/i.test(t) ? 'crosshair' : /other|אחר/i.test(t) ? 'circle-help' : null;
    if (n){ var e = b.querySelector('.btm-emo'); if (e) e.innerHTML = ico(n, 24); else b.insertAdjacentHTML('afterbegin', ico(n, 24)); }
  });
  var st = m.querySelector('div[onclick*="_bodyMenuStep"]'); if (st && st.parentElement && !st.parentElement.hasAttribute('role')){ st.parentElement.setAttribute('role', 'tablist'); st.parentElement.querySelectorAll('div[onclick*="_bodyMenuStep"]').forEach(function(d){ d.setAttribute('role', 'tab'); }); }
  if (m.querySelector('.bz-btn') || !W._selectedRegion) return;
  var btns = m.querySelectorAll(':scope > button'), last = btns[btns.length - 1];
  var b = document.createElement('button'); b.className = 'bz-btn';
  b.innerHTML = ico('search', 24) + '<span>' + L('Zoom — mark the exact spot','הגדלה — סימון המקום המדויק') + '</span>';
  var id = W._selectedRegion; b.onclick = function(ev){ ev.stopPropagation(); open(id); };
  if (last) m.insertBefore(b, last); else m.appendChild(b);
}
// The region menu is drawn inside the scrolling form, under the sticky tabs. Lift it to the app frame so it is a
// real full-screen sheet with its title visible; drop it once no region is selected.
function liftMenu(){
  var a = app(), c = document.getElementById('incident-content'); if (!a || !c) return;
  var fresh = c.querySelector('#body-tap-overlay'), lifted = a.querySelector(':scope > #body-tap-overlay');
  if (fresh){ if (lifted) lifted.remove(); a.appendChild(fresh); var d = fresh.querySelector('.body-tap-menu button'); if (d && !fresh.contains(document.activeElement)) try { d.focus({ preventScroll:true }); } catch (e) {} }
  else if (lifted && !W._selectedRegion) lifted.remove();
}
function boot(){
  var c = document.getElementById('incident-content'); if (!c) return;
  new MutationObserver(function(){
    liftMenu();
    addZoomButton();
    if (Z && !document.getElementById('bz-sheet')) Z = null;
    if (Z && Z.lang !== lang()){ Z.lang = lang(); var s = document.getElementById('bz-sheet'), u = s && s.querySelector('.bz-undo span'), d = s && s.querySelector('.bz-done span'); if (u) u.textContent = L('Undo','בטל'); if (d) d.textContent = L('Done','סיום'); draw(); }
  }).observe(c, { childList: true, subtree: true });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

W.BodyZoom = {
  open: open,
  close: function(){ close(false); },
  undo: function(){ if (W.medUndo) W.medUndo(); if (Z){ Z.sel = null; Z.msg = null; draw(); } },
  del: function(){
    var i = Z && inj(Z.id, Z.side); if (!i || !i.pins || Z.sel == null) return;
    snap(); i = inj(Z.id, Z.side); i.pins = i.pins.filter(function(_, k){ return k !== Z.sel; }); Z.sel = null; save(); draw();
  },
  relang: draw
};
})();
