  /* ===== change history and guessed inputs =====
     p.history: last 20 changes, newest first: { t, by, k, label, from, to }.
     p.unconf / S.settings.unconf: keys of inputs that are still a guess. Missing object = defaults below. */
  var HIST_MAX = 20, HIST_MERGE = 5 * 60 * 1000;
  var HIST_LABELS = { 'n.name': 'Product name', 's.lcl': 'Shipping', 's.dutyMode': 'Tariff treatment', 's.dutyFF': 'Duty with Form F', 's.dutyGen': 'General tariff',
    's.dutyCustom': 'Custom duty', 's.hs': 'Tariff code', 'p.full': 'Mercado Libre Full', 'p.fullSize': 'Full size', 'p.fullIn': 'Full inbound cost' };
  function histLabel(k) {
    if (HIST_LABELS[k]) return HIST_LABELS[k];
    for (var g = 0; g < SPEC.length; g++) for (var i = 0; i < SPEC[g].f.length; i++) {
      var f = SPEC[g].f[i]; if (f[0] === k && f[1]) return f[1].replace(/\s*\(.*\)\s*$/, '');
    }
    return k;
  }
  function histKey(k) { return !!k && (k === 'n.name' || /^[sp]\./.test(k)); }
  function histWho() { return mode === 'shared' ? who : S.me; }
  /* Shared helper: call it before or after changing a product field from code (from = old value). */
  function logChange(p, k, from, to) {
    if (!p || String(from) === String(to)) return false;
    var by = histWho(), now = Date.now(), h = Array.isArray(p.history) ? p.history.slice() : [], top = h[0];
    if (top && top.k === k && top.by === by && now - top.t < HIST_MERGE) {
      top = Object.assign({}, top, { t: now, to: to }); h[0] = top;
      if (String(top.from) === String(to)) h.shift(); /* edited back: nothing changed */
    } else h.unshift({ t: now, by: by, k: k, label: histLabel(k), from: from, to: to });
    if (h.length) p.history = h.slice(0, HIST_MAX); else delete p.history;
    return true;
  }
  function histVal(k, v) {
    if (k === 's.lcl') return v === true ? 'Sea' : 'Air';
    if (v === true) return 'Yes';
    if (v === false) return 'No';
    if (k === 'p.mk') { for (var i = 0; i < S.settings.mk.length; i++) if (S.settings.mk[i].id === v) return S.settings.mk[i].name; }
    return v === undefined || v === null || String(v) === '' ? '(empty)' : String(v);
  }
  function renderHistory(p) {
    var el = $('histList'); if (!el) return;
    var h = Array.isArray(p.history) ? p.history : [];
    el.innerHTML = h.length ? h.map(function (x) {
      return '<li>' + esc(fdateTime(x.t)) + ' · ' + esc(x.by || '') + ' · ' + esc(x.label || x.k) + ': <span class="num">' + esc(histVal(x.k, x.from)) + ' → ' + esc(histVal(x.k, x.to)) + '</span></li>';
    }).join('') : '<li class="mut">No changes recorded yet</li>';
    var hi = $('histHint'); if (hi) hi.textContent = h.length ? h.length + (h.length === 1 ? ' change' : ' changes') : '';
  }
  /* Form edits: the value before the first keystroke is kept until the change event (blur, select, checkbox). */
  var histStart = {};
  $('form').addEventListener('input', function (e) {
    var k = e.target.getAttribute && e.target.getAttribute('data-k'); if (!histKey(k)) return;
    var id = cur().id + '|' + k; if (!(id in histStart)) histStart[id] = getVal(k);
  }, true);
  $('form').addEventListener('change', function (e) {
    var k = e.target.getAttribute && e.target.getAttribute('data-k'); if (!histKey(k)) return;
    var id = cur().id + '|' + k; if (!(id in histStart)) return;
    var from = histStart[id]; delete histStart[id];
    if (logChange(cur(), k, from, getVal(k))) { save(); renderHistory(cur()); }
  });
  $('form').addEventListener('click', function (e) {
    var b = e.target.closest('[data-mode]'); if (!b) return; /* events.js saves after this capture handler */
    var p = cur(); logChange(p, 's.lcl', p.sim.lcl === true, b.getAttribute('data-mode') === 'sea');
  }, true);

  /* Guessed inputs */
  var GUESS = [['s.price', 'FCA price'], ['s.dutyFF', 'Duty rate'], ['s.dutyGen', 'Duty rate'], ['s.dutyCustom', 'Duty rate'], ['s.hs', 'Tariff code'],
    ['m.commission', 'Commission'], ['p.roas', 'ROAS'], ['p.returns', 'Returns'], ['g.fx', 'Exchange rate'], ['l.rate', 'Sea rate'], ['l.agent', 'Shared agent']];
  var GUESS_DEF = ['s.dutyFF', 's.dutyGen', 's.dutyCustom', 's.hs', 'p.roas', 'p.returns', 'l.rate', 'l.agent'];
  function guessShared(k) { return /^[glm]\./.test(k); }
  function guessKey(k, p) { return k === 'm.commission' ? 'm.commission.' + p.pl.mk : k; }
  function isGuess(k, p) {
    p = p || cur();
    var o = guessShared(k) ? S.settings.unconf : p.unconf;
    if (o) return o[guessKey(k, p)] === true;
    return k === 'm.commission' ? mkById(p.pl.mk).official !== true : GUESS_DEF.indexOf(k) >= 0;
  }
  function guessDefaults(shared) {
    var o = {};
    GUESS_DEF.forEach(function (k) { if (guessShared(k) === shared) o[k] = true; });
    if (shared) S.settings.mk.forEach(function (m) { if (m.official !== true) o['m.commission.' + m.id] = true; });
    return o;
  }
  function toggleGuess(k) {
    var p = cur(), sh = guessShared(k);
    var o = sh ? (S.settings.unconf || guessDefaults(true)) : (p.unconf || guessDefaults(false));
    o = Object.assign({}, o);
    var key = guessKey(k, p);
    if (o[key] === true) delete o[key]; else o[key] = true;
    if (sh) S.settings.unconf = o; else p.unconf = o;
    changed(true);
  }
  function guessRelevant(k, p) {
    var dm = p.sim.dutyMode;
    if (k === 's.dutyFF') return dm === 'formF';
    if (k === 's.dutyGen') return dm === 'general';
    if (k === 's.dutyCustom') return dm === 'custom';
    if (k === 'l.rate' || k === 'l.agent') return p.sim.lcl === true;
    return true;
  }
  function guessList(p) {
    p = p || cur();
    return GUESS.filter(function (g) { return guessRelevant(g[0], p) && isGuess(g[0], p); });
  }
  /* Adds the guess/confirmed switch next to the label of each sensitive field (called by buildForm). */
  function decorateGuesses() {
    GUESS.forEach(function (g) {
      var inp = $('form').querySelector('[data-k="' + g[0] + '"]'); if (!inp) return;
      var lab = inp.closest('label.f'), sp = lab && lab.querySelector('span'); if (!sp) return;
      sp.classList.add('lh');
      sp.innerHTML = '<span>' + sp.innerHTML + '</span><span class="gtog" role="button" tabindex="0" data-guess="' + g[0] + '"></span>';
    });
  }
  function renderGuesses() {
    var p = cur();
    $('form').querySelectorAll('[data-guess]').forEach(function (t) {
      var gs = isGuess(t.getAttribute('data-guess'), p);
      t.setAttribute('data-on', gs ? 'guess' : 'ok');
      t.textContent = gs ? '? guess' : '✓ confirmed';
      t.title = gs ? 'Still a guess. Click when confirmed.' : 'Confirmed. Click to mark as a guess.';
      t.setAttribute('aria-label', (gs ? 'Still a guess' : 'Confirmed') + '. Click to change.');
    });
    var line = $('guessLine'); if (!line) return;
    var gl = guessList(p), names = [];
    gl.forEach(function (g) { if (names.indexOf(g[1]) < 0) names.push(g[1]); });
    line.hidden = !gl.length;
    if (gl.length) {
      line.setAttribute('data-first', gl[0][0]);
      line.textContent = gl.length + (gl.length === 1 ? ' input is still a guess: ' : ' inputs are still guesses: ') + names.join(', ');
    }
  }
  function collabVis() { var p = cur(); renderGuesses(); renderHistory(p); }
  function openField(k) {
    var el = $('form').querySelector('[data-k="' + k + '"]'); if (!el) return;
    var adv = el.closest('details.adv'), grp = el.closest('details.grp');
    if (grp) grp.open = true;
    if (adv) adv.open = true;
    el.scrollIntoView({ block: 'center' });
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  }
  $('form').addEventListener('click', function (e) {
    var t = e.target.closest('[data-guess]');
    if (t) { e.preventDefault(); toggleGuess(t.getAttribute('data-guess')); return; }
    if (e.target.closest('#guessLine')) openField($('guessLine').getAttribute('data-first'));
  });
  $('form').addEventListener('keydown', function (e) {
    var t = e.target.closest && e.target.closest('[data-guess]');
    if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleGuess(t.getAttribute('data-guess')); }
  });
