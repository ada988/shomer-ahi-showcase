/* shomer-ahi + magen-ahi — shared core utilities
 * Phase 1 of merge. Loaded before each app's main script.
 * Exposes window.SA namespace. Safe to load multiple times (idempotent).
 */
(function(){
  'use strict';
  if (window.SA && window.SA._v) return;
  var SA = window.SA || {};
  SA._v = '1';

  // XSS-safe HTML escape (used for Firestore-string interpolation).
  SA.escapeHtml = function(s){
    return String(s == null ? '' : s)
      .replace(/[&<>"']/g, function(c){
        return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
      });
  };

  // Unified toast. Both apps have #tst + #tst-m in their HTML.
  // beta uses {undo:true} to show the '.ul' cancel button; magen uses {duration:N}.
  // Local wrappers in each app adapt their old signature to this options-based call.
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

  // ─── Storage migration (phase 3) ─────────────────────────────────────────
  // One-shot copy of legacy localStorage keys into sa_* namespace.
  // Idempotent via sa_migrated_v1 sentinel. Old keys kept read-only until
  // phase 10 user sign-off. Existing call sites in beta/magen unchanged —
  // this simply pre-populates sa_* so later phases can switch read paths.
  var MIGRATION_MAP = [
    ['shvtzk7_next',   'sa_state'],
    ['shvtzk7_reqq',   'sa_reqq'],
    ['magen_teamId',   'sa_currentTeamId'],
    ['magen_myTeams',  'sa_myTeams'],
    ['magen_basemap',  'sa_basemap'],
    ['magen_f101_draft', 'sa_f101_draft']
  ];
  var PREFIX_MIGRATION_MAP = [
    ['magen_panel_',        'sa_panel_'],
    ['magen_check_draft_',  'sa_check_draft_']
  ];
  SA.migrateStorage = function(){
    try {
      if (localStorage.getItem('sa_migrated_v1')) return;
      for (var i = 0; i < MIGRATION_MAP.length; i++) {
        var oldK = MIGRATION_MAP[i][0], newK = MIGRATION_MAP[i][1];
        var newVal = localStorage.getItem(newK);
        if (newVal != null) continue; // already populated, don't overwrite
        var oldVal = localStorage.getItem(oldK);
        if (oldVal != null) localStorage.setItem(newK, oldVal);
      }
      // Prefix-based: scan all keys once.
      var keys = [];
      for (var k = 0; k < localStorage.length; k++) keys.push(localStorage.key(k));
      for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        if (!key) continue;
        for (var p = 0; p < PREFIX_MIGRATION_MAP.length; p++) {
          var oldP = PREFIX_MIGRATION_MAP[p][0], newP = PREFIX_MIGRATION_MAP[p][1];
          if (key.indexOf(oldP) === 0) {
            var suffix = key.slice(oldP.length);
            var tgt = newP + suffix;
            if (localStorage.getItem(tgt) == null) {
              var v = localStorage.getItem(key);
              if (v != null) localStorage.setItem(tgt, v);
            }
          }
        }
      }
      localStorage.setItem('sa_migrated_v1', String(Date.now()));
    } catch (e) {
      // Storage may be unavailable (private-mode, quota). Fail silent — app
      // still works against legacy keys.
    }
  };

  // Helper wrappers for future phases to read/write with automatic fallback.
  // Not used by existing call sites in phase 3 — reserved API.
  SA.lsGet = function(saKey, legacyKey){
    try {
      var v = localStorage.getItem(saKey);
      if (v != null) return v;
      if (legacyKey) return localStorage.getItem(legacyKey);
      return null;
    } catch (e) { return null; }
  };
  SA.lsSet = function(saKey, value){
    try { localStorage.setItem(saKey, value); } catch (e) {}
  };

  // Run migration immediately on script load — before any app-specific code
  // reads its legacy keys. Safe because migration never overwrites sa_* keys.
  SA.migrateStorage();

  // ─── Unified mode matrix (phase 4) ────────────────────────────────────────
  // Team-level axis: teamMode ∈ {military, settlement} — same delta as beta today.
  // Member-level axis: subMode ∈ {fighter, medic, fighterMedic, hamal}.
  SA.SUB_MODES = ['fighter', 'medic', 'fighterMedic', 'hamal'];
  SA.SUB_MODE_LABELS = {
    fighter: 'לוחם',
    medic: 'חובש/ת',
    fighterMedic: 'לוחם+חובש',
    hamal: 'חמ״ל'
  };

  // Sub-mode → visible tabs (used by phase 8 nav).
  // Manager role always sees all enabled tabs regardless of subMode.
  SA.SUB_MODE_TABS = {
    fighter:      { scheduling: true,  readiness: false, chmal: 'receive', medical: 'field' },
    medic:        { scheduling: true,  readiness: true,  chmal: 'receive', medical: 'full' },
    fighterMedic: { scheduling: true,  readiness: true,  chmal: 'receive', medical: 'full' },
    hamal:        { scheduling: 'manage', readiness: 'manage', chmal: true, medical: 'full' }
  };

  // Logo picker — keyed off member.subMode.
  SA.pickLogo = function(subMode){
    switch (subMode) {
      case 'medic':        return '../shared/logo-medical.svg';
      case 'fighterMedic': return '../shared/logo-mixed.svg';
      default:             return '../shared/logo-guard.svg';
    }
  };

  // Apply logo to an <img> element by id.
  SA.applyLogo = function(imgElOrId, subMode){
    var el = typeof imgElOrId === 'string' ? document.getElementById(imgElOrId) : imgElOrId;
    if (!el) return;
    el.src = SA.pickLogo(subMode);
  };

  // Compute default enabledModules for a team based on its legacy shape.
  // Called once when team doc lacks enabledModules; result written back by app.
  SA.defaultEnabledModules = function(teamDoc){
    var has = function(k){ return teamDoc && teamDoc[k] != null; };
    var isHamal = teamDoc && (teamDoc.type === 'hamal' || teamDoc.teamKind === 'hamal');
    return {
      scheduling: !!(has('personnel') || has('posts')) && !isHamal ? true : !!has('posts'),
      readiness:  false,  // phase 4: off by default in beta; manager turns on. Set to true if team has checkTemplates (detected server-side later).
      chmal:      !!isHamal,
      medical:    true    // universal
    };
  };

  // Compute default subMode for a member based on team kind + role.
  SA.defaultSubMode = function(teamDoc, memberDoc){
    var isHamal = teamDoc && (teamDoc.type === 'hamal' || teamDoc.teamKind === 'hamal');
    var role = memberDoc && memberDoc.role;
    if (isHamal) {
      return role === 'manager' || role === 'owner' ? 'hamal' : 'medic';
    }
    return 'fighter';
  };

  // ─── post.kind generalization (phase 6) ───────────────────────────────────
  // Additive: post.kind is optional, defaults to 'guard'. New kinds skip the
  // day/night branches in _runAGCore. Slot-key format unchanged so all 9
  // existing key.split('_') sites still parse 6 parts.
  SA.POST_KINDS = ['guard', 'kitchen', 'onCallMedic', 'onCallTeam', 'readinessShift'];
  SA.POST_KIND_LABELS = {
    guard:          'משמר',
    kitchen:        'במ״מ (מטבח)',
    onCallMedic:    'חובש תורן',
    onCallTeam:     'צוות אר״ן',
    readinessShift: 'מוכנות'
  };
  // Shorthand mode-slot for non-guard kinds. Must NOT be 'day'/'night'/'both'.
  SA.POST_KIND_MODE_SLOT = {
    guard:          null,
    kitchen:        'kit',
    onCallMedic:    'oc',
    onCallTeam:     'ct',
    readinessShift: 'rd'
  };
  // Default onCallTeam composition: 2 medics + 1 doctor/paramedic + 1 driver.
  SA.DEFAULT_ON_CALL_TEAM = [
    { role: 'medic',   count: 2, label: 'חובש' },
    { role: 'doctor',  count: 1, label: 'רופא/פרמדיק' },
    { role: 'driver',  count: 1, label: 'נהג' }
  ];
  // Which subModes may be assigned to posts of this kind. Empty = everyone.
  SA.POST_KIND_ELIGIBLE_SUBMODES = {
    guard:          [],                                    // anyone
    kitchen:        ['medic', 'fighterMedic'],             // user: medic-only
    onCallMedic:    ['medic', 'fighterMedic'],
    onCallTeam:     [],                                    // per-composition role
    readinessShift: []                                     // anyone
  };
  SA.getPostKind = function(post){
    return (post && post.kind) || 'guard';
  };
  SA.postMatchesKinds = function(post, kindFilter){
    var k = SA.getPostKind(post);
    if (!kindFilter || kindFilter.length === 0) return k === 'guard';
    return kindFilter.indexOf(k) !== -1;
  };
  // Annoyance weights (phase 7 consumes).
  SA.DEFAULT_KIND_WEIGHTS = {
    guard:          1.0,
    kitchen:        1.5,
    onCallMedic:    0.3,
    readinessShift: 0.5
  };
  // ─── Annoyance score (phase 7) ────────────────────────────────────────────
  // Score a single slot — used to weight fairness across duty types.
  //   post          : { kind, type, ... }
  //   startHour     : integer 0..23 (slot start hour, local)
  //   durationMin   : slot length in minutes
  //   nightWindow   : { ns, ne } from team settings (defaults to 22..6)
  //   callOuts      : for onCallMedic only — count of actual call-outs during slot
  //   weights       : optional override map (defaults to DEFAULT_KIND_WEIGHTS)
  // Returns numeric annoyance contribution.
  SA.computeAnnoyance = function(post, startHour, durationMin, nightWindow, callOuts, weights){
    var kind = SA.getPostKind(post);
    var w = (weights && weights[kind]) || SA.DEFAULT_KIND_WEIGHTS[kind] || 1.0;
    var hours = (durationMin || 0) / 60;
    var score = w * hours;
    // Kitchen dawn bonus: any part of 04:00-07:00 window → 1.4×
    if (kind === 'kitchen' && startHour >= 4 && startHour < 7) score *= 1.4;
    // Guard night weighting: uses built-in hScore in beta; caller can pass weights.guardNight.
    if (kind === 'guard') {
      var ns = (nightWindow && nightWindow.ns) != null ? nightWindow.ns : 22;
      var ne = (nightWindow && nightWindow.ne) != null ? nightWindow.ne : 6;
      var isNight = (ns <= ne) ? (startHour >= ns && startHour < ne)
                               : (startHour >= ns || startHour < ne);
      if (isNight) score *= 1.2;
    }
    // On-call call-out bonus: +2.0 per actual dispatch during the shift.
    if (kind === 'onCallMedic' && callOuts) score += 2.0 * callOuts;
    return score;
  };
  // Night-wake detection — slot starts between 00:00 and 05:59 AND kind is
  // one that actually wakes the person (kitchen or on-call).
  SA.isNightWake = function(post, startHour){
    var kind = SA.getPostKind(post);
    if (kind !== 'kitchen' && kind !== 'onCallMedic') return false;
    return startHour >= 0 && startHour < 6;
  };

  window.SA = SA;
})();
