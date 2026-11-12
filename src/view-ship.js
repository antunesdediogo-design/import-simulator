  function vShip() {
    var inShip = S.products.filter(function (x) { return x.sim.lcl === true; });
    var billed = LCL.billed || n(S.settings.lcl.min);
    var used = LCL.totalCbm, fill = billed > 0 ? Math.min(1, used / billed) : 0;
    var p = cur(), room = Math.max(0, billed - used), u = unitCbm(p), more = u > 0 ? Math.floor(room / u) : 0;
    var seg = '', leg = '';
    S.products.forEach(function (x, i) {
      if (x.sim.lcl !== true) return;
      var cb = CACHE[x.id].r.cbm;
      if (cb > 0) seg += '<div style="width:' + Math.max(0.5, cb / billed * 100) + '%;background:' + COLORS[i % COLORS.length] + ';min-width:14px" title="' + esc(x.name) + '"></div>';
      leg += '<span><b style="background:' + COLORS[i % COLORS.length] + '"></b>' + esc(x.name) + ' · ' + CACHE[x.id].r.qty + ' units</span>';
    });
    var goods = 0, frt = 0, agent = 0, iva = 0, cash = 0, contrib = 0;
    inShip.forEach(function (x) { var r = CACHE[x.id].r; goods += r.goods; frt += r.freight; agent += r.agent + r.ins + r.duty; iva += r.iva; cash += r.total; contrib += CACHE[x.id].pl.profit * r.qty; });
    var sc = [['Current plan', scen(p, CACHE[p.id].r.qty, p.sim.lcl === true), p.sim.lcl === true]];
    if (unitCbm(p) > 0) {
      if (p.sim.lcl !== true) sc.push(['By sea, same quantity', scen(p, CACHE[p.id].r.qty, true), true]);
      else sc.push(['By air, same quantity', scen(p, CACHE[p.id].r.qty, false), false]);
      [250, 500].forEach(function (q) { sc.push([q + ' units by sea', scen(p, q, true), true]); });
      var fq = fillQty(p); if (fq > 0) sc.push(['Fills the ' + m3(n(S.settings.lcl.min)) + ' (' + fq + ' units)', scen(p, fq, true), true]);
    }
    var sbody = sc.map(function (s, i) {
      return '<tr class="' + (i === 0 ? 'hl' : '') + '"><td>' + s[0] + '</td><td class="num">' + (s[2] ? Math.round(s[1].fill * 100) + '%' : '-') + '</td><td class="num">' + usd(s[1].r.freight / Math.max(1, s[1].qty)) + '</td><td class="num">' + usd(s[1].r.perUnitNet) + '</td><td class="num ' + (s[1].pl.profit >= 0 ? 'pos' : 'neg') + '">' + clp(s[1].pl.profit) + '</td></tr>';
    }).join('');
    var uv = S.sumView !== 'total', byValue = S.settings.lcl.split === 'value';
    var rowsS = '', tU = 0, tG = 0, tF = 0, tNet = 0, tRev = 0, tRrp = 0, tAds = 0, tGross = 0;
    function cells(q, goods, frt, net, gross, netp, roas, tot, rev) {
      var d = tot ? 1 : Math.max(1, q);
      return '<td class="num">' + usd(goods / d) + '</td><td class="num">' + usd(frt / d) + '</td><td class="num">' + usd(net / d) + '</td><td class="num">' + (roas > 0 ? roas.toFixed(1) : '-') + '</td>' +
        '<td class="num ' + (gross >= 0 ? 'pos' : 'neg') + '">' + clp(gross / d) + ' <span style="font-size:12px">· ' + (rev > 0 ? pct(gross / rev) : '-') + '</span></td><td class="num ' + (netp >= 0 ? 'pos' : 'neg') + '">' + clp(netp / d) + ' <span style="font-size:12px">· ' + (rev > 0 ? pct(netp / rev) : '-') + '</span></td>';
    }
    S.products.forEach(function (x, i) {
      var c2 = CACHE[x.id], r2 = c2.r, q2 = r2.qty, on = x.sim.lcl === true;
      var nameCell = '<span style="display:inline-flex;align-items:center;gap:8px"><input type="checkbox" style="width:18px;height:18px;accent-color:var(--accent)" data-ship="' + esc(x.id) + '"' + (on ? ' checked' : '') + ' aria-label="In shipment: ' + esc(x.name) + '"><span class="dotc" style="background:' + COLORS[i % COLORS.length] + '"></span><button type="button" class="lnk" data-open="' + esc(x.id) + '" title="Open details">' + esc(x.name) + '</button></span>';
      if (!on) { rowsS += '<tr style="opacity:.65"><td>' + nameCell + '</td><td class="num">' + q2 + '</td><td colspan="6" class="mut" style="text-align:left">Not in this shipment. Tick the box to add it.</td></tr>'; return; }
      tU += q2; tG += r2.goods; tF += r2.freight; tNet += r2.net; tRev += c2.pl.netRev * q2;
      tRrp += c2.pl.rrp * q2; tAds += c2.pl.ads * q2; tGross += c2.pl.contribPre * q2;
      rowsS += '<tr><td>' + nameCell + '</td><td class="num">' + q2 + '</td>' +
        cells(q2, r2.goods, r2.freight, r2.net, c2.pl.contribPre * q2, c2.pl.profit * q2, c2.pl.roas, !uv, c2.pl.netRev * q2) + '</tr>';
    });
    var summary = '<div class="card tablewrap"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px"><h3 style="margin:0">Container summary</h3>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<div class="seg" role="radiogroup" aria-label="Freight split"><button type="button" role="radio" data-split="space" aria-checked="' + !byValue + '" title="What the forwarder invoices">Freight by space</button><button type="button" role="radio" data-split="value" aria-checked="' + byValue + '" title="What-if: freight in proportion to goods value">Freight by value</button></div>' +
      '<div class="seg" role="radiogroup" aria-label="View"><button type="button" role="radio" data-sum="unit" aria-checked="' + uv + '">Unit view</button><button type="button" role="radio" data-sum="total" aria-checked="' + !uv + '">Total view</button></div></div></div>' + (inShip.length ?
      '<table class="t"><thead><tr><th>Product</th><th>Units</th><th>Goods cost</th><th>Freight</th><th>Net cost</th><th>ROAS</th><th>Gross profit</th><th>Net profit</th></tr></thead><tbody>' + rowsS +
      '<tr class="tot"><td>Total</td><td class="num">' + tU + '</td>' + cells(tU, tG, tF, tNet, tGross, contrib, tAds > 0 ? tRrp / tAds : 0, !uv, tRev) + '</tr></tbody></table>' +
      '<p class="note" style="margin:10px 0 0">' + (uv ? 'Per unit.' : 'Totals for all units.') + ' Costs in US$, profits in CLP. Gross profit is before ads, net profit after ads, and the % is the share of net sales (price without IVA). ' +
      (byValue ? 'Freight is split by goods value, a what-if view. The forwarder invoices by space.' : 'Freight is split by space, as the forwarder invoices it.') + ' The shared agent is split by goods value.</p>' :
      '<p class="note" style="margin:0">No product is marked "In shipment" yet.</p>') + '</div>';
    return '<div class="grid2" style="grid-template-columns:minmax(0,1.6fr) minmax(0,1fr)"><div class="card"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap"><h3 style="margin:0">' + m3(billed) + ' you pay for</h3><span class="num"><b>' + m3(used) + '</b> used · ' + Math.round(fill * 100) + '%</span></div>' +
      '<div class="cont" role="img" aria-label="Container ' + Math.round(fill * 100) + ' percent full" style="margin-top:12px">' + seg + '<div class="empty">' + (fill < 1 ? Math.round((1 - fill) * 100) + '% empty, already paid' : 'Full') + '</div></div>' +
      '<div class="legend">' + leg + (more > 0 && fill < 1 ? '<span>Room for about ' + more + ' more of "' + esc(p.name) + '"</span>' : '') + '</div></div>' +
      '<div class="dark"><span style="font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:#98A2B3;font-weight:600">This shipment</span>' +
      '<div class="r" style="align-items:baseline"><span>Cash you need</span><b style="font-size:22px">' + usd(cash) + '</b></div>' +
      '<div class="r"><span>of which IVA, comes back as credit</span><b>' + usd(iva) + '</b></div>' +
      '<div class="r t" style="align-items:baseline"><span>Total net profit</span><b style="font-size:22px;color:' + (contrib >= 0 ? '#4BE3A0' : '#FDBA74') + '">' + clp(contrib) + '</b></div></div></div>' +
      summary +
      '<div class="card tablewrap"><h3>How order size changes "' + esc(p.name) + '"</h3><table class="t"><thead><tr><th>Scenario</th><th>Container used</th><th>Freight / unit</th><th>Net cost / unit</th><th>Profit / unit</th></tr></thead><tbody>' + sbody + '</tbody></table>' +
      (unitCbm(p) > 0 ? '' : '<p class="note">Enter the carton size to see these scenarios.</p>') + '</div>';
  }

