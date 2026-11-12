  function dutyCard(p, c) {
    var s0 = p.sim, mode = s0.dutyMode;
    function at(rate) {
      var q = Object.assign({}, s0, { duty: String(rate) });
      var r = calcSim(q, LCL.map[p.id]);
      return { r: r, pl: calcPL(r, p.pl, c.mk, S.settings.fx) };
    }
    var a = at(s0.dutyFF), b = at(s0.dutyGen), q = Math.max(1, c.r.qty);
    var diffNet = b.r.perUnitNet - a.r.perUnitNet, diffProfit = b.pl.profit - a.pl.profit;
    var label = mode === 'formF' ? 'Your plan: with Form F' : mode === 'general' ? 'Your plan: without certificate' : 'Your plan: custom rate ' + n(s0.dutyCustom) + '%';
    function row(t, x, rate, hl) {
      return '<tr class="' + (hl ? 'hl' : '') + '"><td>' + t + '</td><td class="num">' + n(rate) + '%</td><td class="num">' + usd(x.r.duty) + '</td><td class="num">' + usd(x.r.perUnitNet) + '</td><td class="num ' + (x.pl.profit >= 0 ? 'pos' : 'neg') + '">' + clp(x.pl.profit) + '</td><td class="num ' + (x.pl.profit >= 0 ? 'pos' : 'neg') + '">' + clp(x.pl.profit * x.r.qty) + '</td></tr>';
    }
    return '<details class="grp"' + (mode !== 'formF' ? ' open' : '') + '><summary>What the certificate of origin is worth<span class="hint">' + (diffNet > 0 ? '+' + usd(diffNet) + ' per unit without it' : '') + '</span></summary><div class="tablewrap" style="padding:0 12px 12px"><table class="t"><thead><tr><th>Case</th><th>Duty</th><th>Duty total</th><th>Net cost / unit</th><th>Profit / unit</th><th>Total result</th></tr></thead><tbody>' +
      row('With Form F', a, s0.dutyFF, mode === 'formF') + row('Without certificate (general tariff)', b, s0.dutyGen, mode === 'general') + '</tbody></table>' +
      '<p class="note" style="margin:10px 0 0">' + label + '. Without the certificate this order costs <b>' + usd(diffNet) + '</b> more per unit, and your profit per unit drops by <b>' + clp(Math.abs(diffProfit)) + '</b>. ' +
      'Duty is charged on the customs value (CIF), and the IVA you pay on top comes back as credit, so only the duty itself is a real cost.</p>' +
      '<p class="note" style="margin:6px 0 0">Ask the supplier to confirm in writing that they issue Form F before you pay a deposit, and have the customs agent confirm the tariff code' + (s0.hs ? ' (you entered ' + esc(s0.hs) + ')' : '') + ' and its rate under the China agreement.</p></div></details>';
  }

  function vCost(p, c) {
    var r = c.r, q = Math.max(1, r.qty);
    var rows = [
      ['Product (FCA)', r.goods, COLORS[0]],
      [p.sim.lcl ? 'Sea freight share' : 'Air freight', r.freight, COLORS[1]],
      ['Insurance', r.ins, COLORS[4]],
      ['Import duty ' + (r.dutyRate * 100).toFixed(0) + '%', r.duty, COLORS[3]],
      ['Customs agent', r.agent, COLORS[5]]
    ];
    var tot = rows.reduce(function (a, x) { return a + x[1]; }, 0);
    var fx = n(S.settings.fx);
    var body = rows.map(function (x) { return '<tr><td>' + x[0] + '</td><td class="num">' + usd(x[1]) + '</td><td class="num">' + usd(x[1] / q) + '</td><td class="num">' + clp(x[1] / q * fx) + '</td></tr>'; }).join('');
    return '<div class="card tablewrap"><h3>Where the cost per unit comes from</h3><table class="t"><thead><tr><th>Item</th><th>Total</th><th>Per unit</th><th>Per unit CLP</th></tr></thead><tbody>' + body +
      '<tr class="tot"><td>Net cost (without recoverable IVA)</td><td class="num">' + usd(r.net) + '</td><td class="num">' + usd(r.perUnitNet) + '</td><td class="num">' + clp(r.perUnitNet * fx) + '</td></tr>' +
      '<tr><td>IVA 19% paid at customs (comes back as credit)</td><td class="num">' + usd(r.iva) + '</td><td class="num">' + usd(r.iva / q) + '</td><td class="num">' + clp(r.iva / q * fx) + '</td></tr>' +
      '<tr class="tot"><td>Cash you need</td><td class="num">' + usd(r.total) + '</td><td class="num">' + usd(r.total / q) + '</td><td class="num">' + clp(r.total / q * fx) + '</td></tr></tbody></table></div>' +
      '<p class="note">Deposit to the supplier: ' + usd(r.deposit) + ' (' + p.sim.dep + '% of goods). Customs value (CIF) ' + usd(r.cif) + '.</p>' + dutyCard(p, c);
  }

