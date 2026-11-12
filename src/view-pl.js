  function vPL(p, c) {
    var pl = c.pl, run = pl.rrp, steps = [];
    function total(l, v, k) { steps.push({ l: l, v: v, a: 0, b: v, k: k }); run = v; }
    function cost(l, v, k) { steps.push({ l: l, v: -v, a: run - v, b: run, k: k || 'cost' }); run -= v; }
    total('RRP, IVA included', pl.rrp, 'total');
    cost('IVA on the sale', pl.saleIva, 'iva');
    total('Net revenue', pl.netRev, 'sub');
    cost('Commission ' + c.mk.commission + '%', pl.comm);
    if (pl.fixed > 0) cost('Fixed fee', pl.fixed);
    if (pl.ship > 0) cost('Free shipping', pl.ship);
    if (pl.full) cost('Mercado Libre Full', pl.fullTotal);
    cost('Returns ' + p.pl.returns + '%', pl.ret);
    cost('Product landed in Chile', pl.landed);
    total('Before ads', pl.contribPre, 'sub2');
    cost(pl.ads > 0 ? 'Ads (ROAS ' + pl.roas + ')' : 'Ads', pl.ads);
    total('Profit per unit', pl.profit, 'fin');
    var lo = 0, hi = Math.max(1, pl.rrp);
    steps.forEach(function (x) { lo = Math.min(lo, x.a, x.b); });
    var span = hi - lo || 1;
    function pos(v) { return (v - lo) / span * 100; }
    var zero = pos(0);
    var html = steps.map(function (x) {
      var l = pos(Math.min(x.a, x.b)), w = Math.max(0.4, pos(Math.max(x.a, x.b)) - l);
      var colr = x.k === 'total' || x.k === 'sub' ? 'var(--accent)' : x.k === 'iva' ? 'var(--muted)' : x.k === 'cost' ? 'var(--c2)' : (x.v >= 0 ? 'var(--good)' : 'var(--warn)');
      var strong = x.k === 'sub' || x.k === 'sub2' || x.k === 'fin';
      var vcol = (x.k === 'sub2' || x.k === 'fin') ? (x.v >= 0 ? 'pos' : 'neg') : '';
      return '<div class="wfr' + (x.k === 'fin' ? ' fin' : '') + '"><span class="lab" style="' + (strong ? 'font-weight:' + (x.k === 'fin' ? 700 : 600) : 'color:var(--muted)') + '">' + esc(x.l) + '</span>' +
        '<span class="bar" style="background:none;overflow:visible"><i style="left:' + l + '%;width:' + w + '%;background:' + colr + '"></i>' +
        (lo < 0 ? '<u style="position:absolute;left:' + zero + '%;top:-4px;bottom:-4px;width:1px;background:var(--muted)"></u>' : '') + '</span>' +
        '<span class="v num ' + vcol + '" style="' + (strong ? 'font-weight:600' : '') + '">' + clp(x.v) + '</span></div>';
    }).join('');
    var share = pl.rrp > 0 ? Math.round(pl.landed / pl.rrp * 100) : 0;
    var insight = pl.rrp > 0 ? 'The product cost alone takes ' + share + '% of the price.' + (pl.profit < 0 ? ' The fix is upstream: freight and order size.' : '') : 'Enter a selling price.';
    var chips = [
      pl.beRoas ? 'Break-even ROAS: ' + pl.beRoas.toFixed(1) : 'Break-even ROAS: none, loses before ads',
      'RRP for ' + p.pl.target + '% margin: ' + (pl.tRrp ? clp(pl.tRrp) : 'not reachable'),
      'IVA you pay SII per unit: ' + clp(pl.ivaPay)
    ].map(function (t) { return '<span style="border:1px solid var(--line);border-radius:6px;padding:4px 8px">' + t + '</span>'; }).join('');
    return '<div class="card"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:10px"><h3 style="margin:0">From the price the customer pays to your profit (CLP)</h3><span class="note">' + esc(c.mk.name) + ' · ROAS ' + pl.roas + '</span></div>' +
      '<div class="wf">' + html + '</div><p class="note" style="margin:12px 0 0">' + insight + '</p></div>' +
      '<div class="note" style="display:flex;gap:10px;flex-wrap:wrap">' + chips + '</div>' +
      (pl.full ? '<div class="card"><h3>Mercado Libre Full</h3><p class="note" style="margin:0">Storage ' + clp(pl.fullStore) + ' + old-stock charge ' + clp(pl.fullOld) + ' + inbound ' + clp(pl.fullIn) + ' per unit. The average unit waits about ' + Math.round(pl.avgDays) + ' days in the warehouse.</p></div>' : '');
  }

