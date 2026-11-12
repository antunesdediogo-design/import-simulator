  /* ===== what-if: price/ROAS grid and worst/expected/best scenarios (pure, no DOM) =====
     Every function takes the product, all products (for the shared sea freight split) and the settings,
     and works on deep copies: S is never changed here. */
  var WI_ROAS = [0, 16, 12, 8, 6, 4]; /* 0 = no ads */
  var WI_STEPS = [-0.2, -0.13, -0.07, 0, 0.1, 0.2, 0.3];
  var WI_SCEN = { fx: '10', returns: '50', roas: '25' };

  function wiClone(x) { return JSON.parse(JSON.stringify(x)); }
  function wiMk(settings, id) {
    for (var i = 0; i < settings.mk.length; i++) if (settings.mk[i].id === id) return settings.mk[i];
    return settings.mk[0];
  }
  /* Same as recompute() for one product, with optional changes to a copy of the product and of fx. */
  function wiEval(p, products, settings, edit) {
    var q = wiClone(p), fx = settings.fx;
    if (edit) fx = edit(q, fx) || fx;
    var ps = products.map(function (x) { return x.id === p.id ? q : x; });
    var lcl = settings.lcl || {};
    var al = lclAlloc(ps, { on: true, rate: lcl.rate, min: lcl.min, agent: lcl.agent, split: lcl.split });
    var r = calcSim(q.sim, al.map[q.id]);
    var mk = wiMk(settings, q.pl.mk);
    return { r: r, pl: calcPL(r, q.pl, mk, fx), q: q, fx: n(fx) };
  }
  /* "Nice" retail price: ending in 990 (or 90 / 9 for cheap items). */
  function wiNice(x) {
    var u = x >= 20000 ? 1000 : x >= 2000 ? 100 : 10;
    return Math.max(u, Math.round(x / u) * u) - (u === 10 ? 1 : 10);
  }
  function wiPrices(rrp) {
    var out = [];
    WI_STEPS.forEach(function (s) {
      var v = s === 0 ? rrp : wiNice(rrp * (1 + s));
      if (v > 0 && out.indexOf(v) < 0) out.push(v);
    });
    return out.sort(function (a, b) { return a - b; });
  }
  function wiRoasList(roas) {
    var out = WI_ROAS.slice();
    if (out.indexOf(roas) < 0) out.push(roas);
    /* no ads first, then highest ROAS (cheapest ads) to lowest */
    return out.sort(function (a, b) { return (a === 0 ? -1 : b === 0 ? 1 : b - a); });
  }
  function wiBand(profit, margin, target) { return profit < 0 ? 'loss' : margin < target ? 'below' : 'ok'; }

  /* Grid of profit per unit: rows = ROAS, cols = retail price. */
  function wiGrid(p, products, settings) {
    var rrp = n(p.pl.rrp), roas = n(p.pl.roas), target = n(p.pl.target) / 100;
    if (rrp <= 0) return { empty: true, rrp: rrp, roas: roas, target: target, prices: [], roasList: [], rows: [] };
    var prices = wiPrices(rrp), roasList = wiRoasList(roas);
    var rows = roasList.map(function (ro) {
      return { roas: ro, cells: prices.map(function (pr) {
        var x = wiEval(p, products, settings, function (q) { q.pl.rrp = String(pr); q.pl.roas = String(ro); }).pl;
        return { price: pr, roas: ro, profit: x.profit, margin: x.margin, band: wiBand(x.profit, x.margin, target), current: pr === rrp && ro === roas };
      }) };
    });
    var g = { empty: false, rrp: rrp, roas: roas, target: target, prices: prices, roasList: roasList, rows: rows };
    g.finding = wiFinding(g);
    return g;
  }
  function wiFinding(g) {
    var row = null, all = [];
    g.rows.forEach(function (r) { if (r.roas === g.roas) row = r; all = all.concat(r.cells); });
    var hit = row.cells.filter(function (c) { return c.band === 'ok'; })[0];
    var pay = row.cells.filter(function (c) { return c.profit >= 0; })[0];
    var best = all.reduce(function (a, c) { return c.profit > a.profit ? c : a; }, all[0]);
    return { roas: g.roas, hit: hit || null, pay: pay || null, best: best, anyProfit: best.profit >= 0 };
  }

  /* Worst / expected / best. Ranges are relative percentages (strings) from settings.scen. */
  function wiRanges(settings) { return Object.assign({}, WI_SCEN, (settings && settings.scen) || {}); }
  function wiScenarios(p, products, settings) {
    var rg = wiRanges(settings);
    var f = n(rg.fx) / 100, rr = n(rg.returns) / 100, ra = n(rg.roas) / 100;
    var cur = n(p.sim.duty);
    function make(dir) {
      return function (q, fx) {
        if (dir === 0) return fx;
        var s = q.sim;
        if (dir < 0) {
          /* general tariff, unless the current duty is already higher */
          if (n(s.dutyGen) > cur) s.dutyMode = 'general';
        } else if (n(s.dutyFF) < cur) s.dutyMode = 'formF';
        syncDuty(s);
        q.pl.returns = String(n(q.pl.returns) * (1 - dir * rr));
        q.pl.roas = String(n(q.pl.roas) * (1 + dir * ra));
        return String(n(fx) * (1 - dir * f));
      };
    }
    var cols = [['worst', 'Worst', -1], ['expected', 'Expected', 0], ['best', 'Best', 1]].map(function (d) {
      var e = wiEval(p, products, settings, make(d[2]));
      return { id: d[0], label: d[1], fx: e.fx, duty: n(e.q.sim.duty), dutyMode: e.q.sim.dutyMode, returns: n(e.q.pl.returns), roas: n(e.q.pl.roas),
        perUnitNet: e.r.perUnitNet, profit: e.pl.profit, margin: e.pl.margin, total: e.pl.profit * e.r.qty, qty: e.r.qty };
    });
    var ok = cols.map(function (c) { return c.profit >= 0; });
    var summary = ok[0] && ok[1] && ok[2] ? 'Profitable in all three cases.'
      : ok[1] && ok[2] ? 'Profitable as expected and in the best case, loses money in the worst case.'
      : ok[2] ? 'Only profitable in the best case.'
      : ok[0] || ok[1] ? 'Mixed result: check the ranges.'
      : 'Loses money in all three cases.';
    return { ranges: rg, cols: cols, summary: summary };
  }
