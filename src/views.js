  /* ===== main ===== */
  var TABS = [['overview', 'Overview'], ['cost', 'Cost build-up'], ['pl', 'P&L per unit'], ['channels', 'Compare channels'], ['whatif', 'What if'], ['ship', 'Shipment']];

  function renderKpis() {
    var p = cur(), c = CACHE[p.id], r = c.r, pl = c.pl, ok = pl.profit >= 0;
    $('kpis').innerHTML =
      '<div class="kpi"><div class="l">Net cost per unit</div><div class="v">' + usd(r.perUnitNet) + '</div><div class="s num">' + clp(pl.landed) + ' · IVA credit excluded</div></div>' +
      '<div class="kpi main"><div class="l">Profit per unit</div><div class="v ' + (ok ? 'pos' : 'neg') + '">' + clp(pl.profit) + '</div><div class="s">' + (pl.rrp > 0 ? pct(pl.margin) + ' margin on net sales' : 'enter a selling price') + '</div></div>' +
      '<div class="kpi"><div class="l">Cash for this order</div><div class="v">' + usd(r.total) + '</div><div class="s">' + usd(r.iva) + ' of it is IVA you get back as credit</div></div>' +
      '<div class="kpi"><div class="l">Total result, ' + r.qty + ' units</div><div class="v ' + (ok ? 'pos' : 'neg') + '">' + clp(pl.profit * r.qty) + '</div><div class="s">' + (pl.days > 0 ? 'about ' + Math.ceil(pl.sellDays) + ' days to sell all' : '') + '</div></div>';
  }
  function renderTabs() {
    $('tabs').innerHTML = TABS.map(function (t) {
      return '<button type="button" role="tab" data-tab="' + t[0] + '" aria-selected="' + (S.tab === t[0]) + '">' + t[1] + '</button>';
    }).join('');
  }

