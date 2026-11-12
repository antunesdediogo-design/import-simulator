  /* ===== "Best mix for this shipment" card (Shipment tab), uses optimizeMix() from optimizer.js ===== */
  var mixMemo = { key: '', res: null };
  function mixResult() {
    var mix = S.settings.mix || { budget: '' };
    var key = JSON.stringify([S.products.map(function (p) { return [p.id, p.name, p.sim, p.pl]; }), S.settings.lcl, S.settings.fx, mix, S.settings.mk]);
    if (mixMemo.key !== key) {
      mixMemo.key = key;
      mixMemo.res = optimizeMix({ products: S.products, cfg: lclCfg(), fx: S.settings.fx, mk: mkById, budget: mix.budget });
    }
    return mixMemo.res;
  }

  function mixCard() {
    var inShip = S.products.filter(function (x) { return x.sim.lcl === true; });
    var head = '<h3>Best mix for this shipment</h3>';
    if (!inShip.length) return '<div class="card">' + head + '<p class="note" style="margin:0">Tick products into the shipment above to use this.</p></div>';
    var R = mixResult(), budget = (S.settings.mix || {}).budget || '';
    var sug = R.best && R.improved ? R.best.qty : null;
    var rows = R.items.map(function (it) {
      var p = S.products.filter(function (x) { return x.id === it.id; })[0];
      var i = S.products.indexOf(p);
      var s = sug ? sug[it.id] : it.current, d = s - it.current;
      return '<tr><td><span style="display:inline-flex;align-items:center;gap:8px"><span class="dotc" style="background:' + COLORS[i % COLORS.length] + '"></span>' + esc(it.name) + '</span></td>' +
        '<td class="num">' + it.current + '</td>' +
        '<td><input class="mixin num" type="text" inputmode="numeric" placeholder="Fixed" data-maxu="' + esc(it.id) + '" value="' + esc(p.sim.maxUnits || '') + '" aria-label="Max units you can sell: ' + esc(it.name) + '"></td>' +
        '<td class="num"><b>' + (it.fixed ? it.current : s) + '</b>' + (it.step > 1 && !it.fixed ? ' <span class="mut" style="font-size:12px">' + Math.round(s / it.step) + ' ctn</span>' : '') + '</td>' +
        '<td class="num ' + (d > 0 ? 'pos' : d < 0 ? 'neg' : 'mut') + '">' + (it.fixed ? 'fixed' : d > 0 ? '+' + d : d < 0 ? String(d) : 'same') + '</td></tr>';
    }).join('');
    var C = R.current, B = R.best;
    function col(x, isNow) {
      if (!x) return ['-', '-', '-'];
      return [usd(x.goods) + (isNow && R.currentOverBudget ? ' <span class="neg" style="font-size:12px">over budget</span>' : ''),
        m3(x.totalCbm) + ' of ' + m3(x.billed),
        '<span class="' + (x.profit >= 0 ? 'pos' : 'neg') + '">' + clp(x.profit) + '</span>'];
    }
    var cn = col(C, true), cs = col(sug ? B : null, false);
    var cmp = '<table class="t" style="margin-top:12px"><thead><tr><th></th><th>Now</th><th>Suggested</th></tr></thead><tbody>' +
      '<tr><td>Goods cost</td><td class="num">' + cn[0] + '</td><td class="num">' + cs[0] + '</td></tr>' +
      '<tr><td>Space used / billed</td><td class="num">' + cn[1] + '</td><td class="num">' + cs[1] + '</td></tr>' +
      '<tr class="tot"><td>Total net profit</td><td class="num">' + cn[2] + '</td><td class="num">' + cs[2] + '</td></tr></tbody></table>';
    var msg;
    var anyVar = R.items.some(function (it) { return !it.fixed; });
    if (!anyVar) msg = 'Enter a max for at least one product to let the optimizer change its quantity.';
    else if (R.fixedOverBudget) msg = 'The fixed products alone cost more than the budget. Raise the budget or enter a max for them.';
    else if (R.noProfit && !sug) msg = 'No mix is profitable with these numbers, and nothing beats your current quantities.';
    else if (R.noProfit) msg = 'No mix is profitable with these numbers. The suggestion below only loses less than now.';
    else if (!sug) msg = 'Your current quantities are already the best mix found.';
    else msg = 'This mix adds ' + clp(B.profit - C.profit) + ' of net profit' + (R.currentOk ? '' : ' and fits your limits') + '.';
    if (anyVar && !R.currentOk && !R.fixedOverBudget) msg += ' Your current quantities are ' + (R.currentOverBudget ? 'over the budget' : 'above a max') + '.';
    return '<div class="card mix">' + head +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:6px"><label class="f" style="flex:0 1 240px"><span>Budget for goods (US$)</span><input type="text" inputmode="decimal" placeholder="No limit" data-mixbudget value="' + esc(budget) + '"></label>' +
      '<p class="note" style="margin:0;flex:1 1 260px">Set the most units you can sell for each product. A blank max keeps that product at its current quantity. Quantities move in whole cartons.</p></div>' +
      '<div class="tablewrap"><table class="t"><thead><tr><th>Product</th><th>Now</th><th>Max you can sell</th><th>Suggested</th><th>Change</th></tr></thead><tbody>' + rows + '</tbody></table></div>' + cmp +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between;margin-top:12px"><p class="note" style="margin:0;flex:1 1 260px">' + msg + ' Profit uses the real freight split for each mix.</p>' +
      (sug ? '<button type="button" class="btn pri" data-mixapply>Apply these quantities</button>' : '') + '</div></div>';
  }

  $('view').addEventListener('change', function (e) {
    var el = e.target;
    if (!el.getAttribute) return;
    if (el.hasAttribute('data-mixbudget')) {
      if (!S.settings.mix) S.settings.mix = { budget: '' };
      S.settings.mix.budget = el.value.trim(); changed(true); return;
    }
    var id = el.getAttribute('data-maxu');
    if (id) { S.products.forEach(function (x) { if (x.id === id) x.sim.maxUnits = el.value.trim(); }); changed(true); }
  });
  $('view').addEventListener('click', function (e) {
    if (!e.target.closest('[data-mixapply]')) return;
    var R = mixResult();
    if (!R.best || !R.improved) return;
    var q = R.best.qty;
    ask('Set the quantities of the products in this shipment to the suggested mix?', 'Apply', function () {
      S.products.forEach(function (x) { if (q[x.id] !== undefined) x.sim.qty = String(q[x.id]); });
      changed(false); toast('Quantities updated');
    });
  });
