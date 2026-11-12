  /* ===== container mix optimizer (pure, no DOM) =====
     optimizeMix(ctx) searches the units of the products in the shared sea shipment (sim.lcl === true)
     for the highest total net profit, evaluating every candidate with the real lclAlloc + calcSim + calcPL.
     ctx = { products, cfg (lclCfg()), fx, mk: function (id) -> marketplace, budget (US$ for goods, 0 = no limit) }
     A product with blank sim.maxUnits is fixed at its current quantity. Others move in whole cartons
     (units-per-carton steps) between 0 and their max. Coordinate ascent from several starts, then pair swaps;
     the current mix is always a candidate, so the result is never worse than it (when it is feasible). */
  function mixEval(ctx, qty) {
    var ps = ctx.products.map(function (p) {
      if (qty[p.id] === undefined) return p;
      var q = Object.assign({}, p); q.sim = Object.assign({}, p.sim, { qty: String(qty[p.id]) }); return q;
    });
    var al = lclAlloc(ps, ctx.cfg), profit = 0, goods = 0;
    ps.forEach(function (p) {
      if (qty[p.id] === undefined) return;
      var r = calcSim(p.sim, al.map[p.id]);
      var pl = calcPL(r, p.pl, ctx.mk(p.pl.mk), ctx.fx);
      profit += pl.profit * r.qty; goods += r.goods;
    });
    return { qty: qty, profit: profit, goods: goods, totalCbm: al.totalCbm, billed: al.billed };
  }

  function optimizeMix(ctx) {
    var t0 = Date.now(), evals = 0, MAX_EVALS = ctx.maxEvals || 3000;
    var budget = n(ctx.budget);
    var MAX_MS = ctx.maxMs || 150;
    function stop() { return evals >= MAX_EVALS || Date.now() - t0 > MAX_MS; }
    var sel = ctx.products.filter(function (p) { return p.sim.lcl === true; });
    var items = sel.map(function (p) {
      var cur = Math.max(0, Math.round(n(p.sim.qty)));
      var fixed = String(p.sim.maxUnits === undefined ? '' : p.sim.maxUnits).trim() === '';
      var step = Math.max(1, Math.round(n(p.sim.upc)) || 1);
      var maxC = fixed ? 0 : Math.floor(Math.round(n(p.sim.maxUnits)) / step);
      return { id: p.id, name: p.name, fixed: fixed, current: cur, step: step, maxC: maxC, max: fixed ? cur : maxC * step, price: n(p.sim.price) };
    });
    var vars = items.filter(function (it) { return !it.fixed; });
    var fixedGoods = 0;
    items.forEach(function (it) { if (it.fixed) fixedGoods += it.current * it.price; });

    function toQty(c) { var q = {}; items.forEach(function (it) { q[it.id] = it.fixed ? it.current : c[it.id] * it.step; }); return q; }
    function goodsOf(c) { var g = fixedGoods; vars.forEach(function (it) { g += c[it.id] * it.step * it.price; }); return g; }
    function okBudget(g) { return !budget || g <= budget + 1e-9; }
    var memo = {};
    function ev(c) {
      var key = vars.map(function (it) { return c[it.id]; }).join(',');
      if (memo[key]) return memo[key];
      evals++;
      return (memo[key] = mixEval(ctx, toQty(c)));
    }
    function better(a, b) { return !b || a.profit > b.profit + 1e-6 || (Math.abs(a.profit - b.profit) <= 1e-6 && a.goods < b.goods - 1e-9); }
    /* shrink proportionally (then one carton at a time) until the goods fit the budget */
    function repair(c) {
      c = Object.assign({}, c);
      if (!budget) return c;
      var g = goodsOf(c), varG = g - fixedGoods;
      if (okBudget(g)) return c;
      var f = varG > 0 ? Math.max(0, (budget - fixedGoods) / varG) : 0;
      vars.forEach(function (it) { c[it.id] = Math.floor(c[it.id] * f); });
      while (!okBudget(goodsOf(c))) {
        var big = null;
        vars.forEach(function (it) { if (c[it.id] > 0 && (!big || c[it.id] * it.step * it.price > c[big.id] * big.step * big.price)) big = it; });
        if (!big) break;
        c[big.id]--;
      }
      return c;
    }

    var curQ = {}; items.forEach(function (it) { curQ[it.id] = it.current; });
    var currentRes = mixEval(ctx, curQ);
    var currentOver = !okBudget(currentRes.goods);
    var currentOverMax = vars.some(function (it) { return it.current > it.max; });
    var currentOk = !currentOver && !currentOverMax;
    var fixedOverBudget = budget > 0 && fixedGoods > budget + 1e-9;

    var best = null;
    if (vars.length && !fixedOverBudget) {
      var starts = [], cCur = {}, cMax = {}, cZero = {}, cHalf = {};
      vars.forEach(function (it) {
        cCur[it.id] = Math.min(it.maxC, Math.round(it.current / it.step));
        cMax[it.id] = it.maxC; cZero[it.id] = 0; cHalf[it.id] = Math.floor(it.maxC / 2);
      });
      starts.push(repair(cCur), repair(cMax), cZero, repair(cHalf));
      /* one product at its max, the others at zero (finds corner mixes when the budget binds) */
      if (vars.length > 1) vars.forEach(function (it) { var c1 = Object.assign({}, cZero); c1[it.id] = it.maxC; starts.push(repair(c1)); });
      starts.forEach(function (s0) {
        if (stop()) return;
        var c = Object.assign({}, s0), res = ev(c);
        var top = 0; vars.forEach(function (it) { top = Math.max(top, it.maxC); });
        var scale = Math.max(1, Math.ceil(top / 4));
        while (scale >= 1 && !stop()) {
          var moved = false;
          vars.forEach(function (it) {
            [scale, -scale].forEach(function (d) {
              var v = c[it.id] + d;
              if (v < 0 || v > it.maxC || stop()) return;
              var t = Object.assign({}, c); t[it.id] = v;
              if (!okBudget(goodsOf(t))) return;
              var r = ev(t);
              if (better(r, res)) { c = t; res = r; moved = true; }
            });
          });
          /* pair swaps: one more carton step of i, one less of j (helps when the budget binds) */
          if (!moved && vars.length > 1) {
            vars.forEach(function (a) {
              vars.forEach(function (b) {
                if (a === b || stop()) return;
                var t = Object.assign({}, c); t[a.id] += scale; t[b.id] -= scale;
                if (t[a.id] > a.maxC || t[b.id] < 0) return;
                while (!okBudget(goodsOf(t)) && t[b.id] > 0) t[b.id]--;
                if (!okBudget(goodsOf(t))) return;
                var r = ev(t);
                if (better(r, res)) { c = t; res = r; moved = true; }
              });
            });
          }
          if (!moved) scale = scale > 1 ? Math.floor(scale / 2) : 0;
        }
        if (better(res, best)) best = res;
      });
    }
    /* never return a mix worse than the current one */
    var improved = !!best && (!currentOk || best.profit > currentRes.profit + 1e-6);
    if (currentOk && (!best || !improved)) best = currentRes;
    return {
      items: items, current: currentRes, best: best, improved: improved && !!best,
      currentOk: currentOk, currentOverBudget: currentOver, currentOverMax: currentOverMax,
      fixedOverBudget: fixedOverBudget, noProfit: !!best && best.profit <= 0,
      budget: budget, evals: evals, ms: Date.now() - t0
    };
  }
