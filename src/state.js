  /* ===== state ===== */
  var DEFAULT_SIM = { qty: '100', price: '0', kgu: '0.2', rate: '10', origin: '0', insp: '1', duty: '0', agent: '150', dep: '30', cl: '0', cw: '0', ch: '0', upc: '100', vdiv: '6000', lcl: false, dutyMode: 'formF', dutyFF: '0', dutyGen: '6', dutyCustom: '', hs: '' };
  var DEFAULT_PL = { rrp: '0', mk: 'ml', roas: '4', returns: '3', target: '20', days: '1', full: false, fullSize: 'S', fullIn: '0' };

  function defaultMk() {
    return [
      { id: 'ml', name: 'Mercado Libre Clásica', commission: 12, fixed: 0, ship: 3050, shipMin: 19990, verified: true, official: true, note: 'Official ML Chile fee search, checked 4 Nov 2026. Free shipping mandatory from $19.990 ($3.050 for up to 0.3 kg).' },
      { id: 'mlp', name: 'Mercado Libre Premium', commission: 16, fixed: 0, ship: 3050, shipMin: 19990, verified: true, official: true, note: 'Same category, Premium 16%. Same shipping.' },
      { id: 'fala', name: 'Falabella.com', commission: 15, fixed: 0, ship: 0, verified: true, official: true, note: 'Falabella table 20 Jul 2026. Logistics fees not included.' },
      { id: 'paris', name: 'Paris.cl', commission: 15, fixed: 0, ship: 0, verified: true, official: true, note: 'Paris table (undated), Fitness > Bicicleta 15%. Logistics not included.' },
      { id: 'ripley', name: 'Ripley.cl', commission: 18, fixed: 990, fixedMax: 5000, ship: 0, verified: true, official: true, note: 'Ripley table, Bombines y Compresores 18%. $990 fixed fee only at $5.000 or less. Logistics not included.' },
      { id: 'sodimac', name: 'Sodimac.cl', commission: 15, fixed: 0, ship: 0, verified: false, official: false, note: 'No public table found. 15% is a placeholder borrowed from Falabella.' },
      { id: 'web', name: 'Own web store', commission: 0, fixed: 0, ship: 0, verified: false, official: false, note: 'Add your payment gateway fee if you want it in the P&L.' },
      { id: 'direct', name: 'Direct sale', commission: 0, fixed: 0, ship: 0, verified: true, official: false, note: '' }
    ];
  }
  function blankProduct(name) {
    return { id: 'p_' + uid(), name: name || 'New product', created: Date.now(), notes: '', links: [], photos: [], sim: Object.assign({}, DEFAULT_SIM), pl: Object.assign({}, DEFAULT_PL) };
  }
  function seedProduct() {
    var p = blankProduct('LW-A5Mini mini pump');
    p.id = 'p_seed';
    p.created = 1;
    p.links = [{ url: 'https://www.alibaba.com/product-detail/100PSI-Lightweight-Wireless-Rechargeable-Bicycle-Tire_1601941323078.html' }];
    p.notes = 'Supplier: Langwei Technology (Ningbo). Before any deposit: written confirmation of Form F, invoice from the Chinese company, UN3481 classification, UN38.3 report and MSDS for the battery.';
    p.sim.qty = '30'; p.sim.price = '21'; p.sim.cl = '15'; p.sim.cw = '12'; p.sim.ch = '5'; p.sim.upc = '1'; p.sim.lcl = true;
    p.pl.rrp = '49990'; p.pl.roas = '12';
    return p;
  }
  function baseline() {
    return { products: [seedProduct()], active: 'p_seed', tab: 'overview', view: 'sim', me: 'André', ideas: [],
      settings: { fx: '1000', lcl: { rate: '350', min: '1', agent: '0', split: 'space' }, sat: { low: '50', high: '300' }, mk: defaultMk(), scen: { fx: '10', returns: '50', roas: '25' } } };
  }
  function syncDuty(sim) { sim.duty = sim.dutyMode === 'general' ? sim.dutyGen : sim.dutyMode === 'custom' ? sim.dutyCustom : sim.dutyFF; }
  function normProduct(p) {
    p = p || {};
    var sim = Object.assign({}, DEFAULT_SIM, p.sim || {});
    if (p.sim && p.sim.dutyMode === undefined) {
      if (n(p.sim.duty) > 0) { sim.dutyMode = 'custom'; sim.dutyCustom = String(p.sim.duty); } else { sim.dutyMode = 'formF'; }
    }
    syncDuty(sim);
    var out = { id: p.id || ('p_' + uid()), name: p.name || 'Untitled', created: p.created || Date.now(), notes: p.notes || '',
      links: Array.isArray(p.links) ? p.links : [], photos: Array.isArray(p.photos) ? p.photos : [],
      sim: sim, pl: Object.assign({}, DEFAULT_PL, p.pl || {}) };
    if (p.updatedBy) { out.updatedBy = p.updatedBy; out.updatedAt = p.updatedAt || 0; }
    return out;
  }
  function normSettings(st) {
    st = st || {};
    return {
      fx: st.fx !== undefined && st.fx !== '' ? st.fx : '1000',
      lcl: Object.assign({ rate: '350', min: '1', agent: '0', split: 'space' }, st.lcl || {}),
      sat: Object.assign({ low: '50', high: '300' }, st.sat || {}),
      mk: Array.isArray(st.mk) && st.mk.length ? st.mk : defaultMk(),
      scen: Object.assign({ fx: '10', returns: '50', roas: '25' }, st.scen || {})
    };
  }
  function normIdea(i) {
    return Object.assign({ id: 'i_' + uid(), name: 'Untitled', link: '', notes: '', author: 'André', created: Date.now(), updated: Date.now(), editedBy: '', status: 'idea', exists: 'unknown', price: '', listings: '' }, i || {});
  }
  function normState(s) {
    var b = baseline();
    if (!s || !Array.isArray(s.products) || !s.products.length) return b;
    return {
      products: s.products.map(normProduct),
      active: s.active || s.products[0].id,
      tab: s.tab || 'overview',
      view: s.view === 'ideas' ? 'ideas' : 'sim',
      sumView: s.sumView === 'total' ? 'total' : 'unit',
      me: s.me === 'Agustín' ? 'Agustín' : 'André',
      ideas: Array.isArray(s.ideas) ? s.ideas.map(normIdea) : [],
      settings: normSettings(s.settings)
    };
  }
  /* Local storage: data (products, settings, ideas) and screen choices (tab, view) are kept apart,
     so that in shared mode the shared data never lands in this browser's local copy. */
  var KEY = 'importsim.v2.local', UIKEY = 'importsim.v2.ui';
  var mode = 'local'; /* 'local' or 'shared' (Firebase) */
  function readJSON(k) { try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  function load() { var d = readJSON(KEY), u = readJSON(UIKEY); return normState(d ? Object.assign({}, d, u || {}) : null); }
  function saveUI() { try { localStorage.setItem(UIKEY, JSON.stringify({ active: S.active, tab: S.tab, view: S.view, sumView: S.sumView })); } catch (e) {} }
  function saveLocalData() {
    try { localStorage.setItem(KEY, JSON.stringify({ products: S.products, settings: S.settings, ideas: S.ideas, me: S.me })); setStatus('local'); }
    catch (e) { setStatus('unsaved'); }
  }
  function save() { saveUI(); if (mode === 'shared') scheduleSync(); else saveLocalData(); }
  function setStatus(st) {
    var FB = window.FIREBASE_CONFIG || null;
    var m = { saved: mode === 'shared' ? 'Saved, shared' : 'Saved', saving: 'Saving...', local: FB ? 'Only in this browser, not shared' : 'Saved in this browser', unsaved: 'Not saved', wait: 'Connecting...', toobig: 'Not saved: too many photos' };
    var el = $('status'); if (!el) return;
    el.textContent = m[st] || ''; el.setAttribute('data-s', st);
  }
  var S = load();

  function cur() { for (var i = 0; i < S.products.length; i++) if (S.products[i].id === S.active) return S.products[i]; return S.products[0]; }
  function mkById(id) { for (var i = 0; i < S.settings.mk.length; i++) if (S.settings.mk[i].id === id) return S.settings.mk[i]; return S.settings.mk[0]; }
  function lclCfg() { return { on: true, rate: S.settings.lcl.rate, min: S.settings.lcl.min, agent: S.settings.lcl.agent, split: S.settings.lcl.split }; }

  var LCL, CACHE = {};
  function recompute() {
    LCL = lclAlloc(S.products, lclCfg());
    CACHE = {};
    S.products.forEach(function (p) {
      var r = calcSim(p.sim, LCL.map[p.id]);
      var mk = mkById(p.pl.mk);
      CACHE[p.id] = { r: r, pl: calcPL(r, p.pl, mk, S.settings.fx), mk: mk };
    });
  }

  /* what-if: same product, another quantity and mode, other products unchanged */
  function scen(p, qty, sea) {
    var q = JSON.parse(JSON.stringify(p));
    q.sim.qty = String(qty); q.sim.lcl = !!sea;
    var ps = S.products.map(function (x) { return x.id === p.id ? q : x; });
    var al = lclAlloc(ps, lclCfg());
    var r = calcSim(q.sim, sea ? al.map[q.id] : null);
    var pl = calcPL(r, q.pl, mkById(q.pl.mk), S.settings.fx);
    return { r: r, pl: pl, qty: qty, fill: sea && al.billed ? al.totalCbm / al.billed : 0 };
  }
  function unitCbm(p) {
    var c = n(p.sim.cl) * n(p.sim.cw) * n(p.sim.ch) / 1e6;
    return c / Math.max(1, Math.round(n(p.sim.upc)) || 1);
  }
  function fillQty(p) {
    var others = 0;
    S.products.forEach(function (x) { if (x.id !== p.id && (x.sim.lcl === true)) others += CACHE[x.id].r.cbm; });
    var room = Math.max(0, n(S.settings.lcl.min) - others);
    var u = unitCbm(p);
    return u > 0 ? Math.floor(room / u) : 0;
  }

