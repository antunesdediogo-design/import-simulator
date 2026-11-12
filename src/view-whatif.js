  /* ===== view: What if (price/ROAS grid + scenarios). Computation in whatif.js ===== */
  function wiShort(v) {
    var a = Math.abs(Math.round(v)), s = Math.round(v) < 0 ? '-$' : '$';
    if (a < 1000) return s + a;
    if (a < 10000) return s + (Math.round(a / 100) / 10).toFixed(1).replace('.', ',') + 'k';
    return s + grp(a / 1000) + 'k';
  }
  function wiRoasLabel(r) { return r > 0 ? 'ROAS ' + (Math.round(r * 10) / 10) : 'no ads'; }

  function vWhatif(p) {
    return wiGridCard(p) + wiScenCard(p);
  }

  function wiGridCard(p) {
    var g = wiGrid(p, S.products, S.settings), tp = Math.round(g.target * 100) + '%';
    var head = '<h3>Price and ad spend sweet spot</h3>';
    if (g.empty) return '<div class="card">' + head + '<p class="note" style="margin:0">Enter a selling price to see the grid.</p></div>';
    var f = g.finding, rl = wiRoasLabel(f.roas), line;
    if (f.hit) line = 'At ' + rl + ', the lowest price in range that reaches your ' + tp + ' margin is <b>' + clp(f.hit.price) + '</b>.';
    else if (f.pay) line = 'At ' + rl + ', no price in range reaches ' + tp + ' margin. The lowest price that makes money is <b>' + clp(f.pay.price) + '</b>.';
    else if (f.anyProfit) line = 'At ' + rl + ', no price in range makes money. Best cell: <b>' + clp(f.best.price) + '</b> with ' + wiRoasLabel(f.best.roas) + ', ' + clp(f.best.profit) + ' per unit.';
    else line = 'No price and ad spend in this range makes money. Best cell loses ' + clp(-f.best.profit) + ' per unit.';
    var th = '<tr><th>ROAS</th>' + g.prices.map(function (pr) { return '<th class="num' + (pr === g.rrp ? ' wi-curh' : '') + '">' + clp(pr) + '</th>'; }).join('') + '</tr>';
    var body = g.rows.map(function (r) {
      return '<tr><th scope="row"' + (r.roas === g.roas ? ' class="wi-curh"' : '') + '>' + (r.roas > 0 ? (Math.round(r.roas * 10) / 10) : 'No ads') + '</th>' + r.cells.map(function (c) {
        var t = clp(c.price) + ', ' + wiRoasLabel(c.roas) + ': ' + clp(c.profit) + ' per unit, ' + pct(c.margin) + ' margin' + (c.current ? ' (current)' : '');
        return '<td class="wi-' + c.band + (c.current ? ' wi-cur' : '') + '"><button type="button" class="num" data-wi-cell="' + c.price + '|' + c.roas + '" title="' + esc(t) + '" aria-label="' + esc(t) + '">' + wiShort(c.profit) + (c.band === 'ok' ? ' ✓' : '') + '</button></td>';
      }).join('') + '</tr>';
    }).join('');
    return '<div class="card">' + head + '<p style="margin:0 0 10px">' + line + '</p>' +
      '<div class="tablewrap"><table class="wi-grid"><thead>' + th + '</thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="legend"><span><b class="wi-loss"></b>Loss (minus sign)</span><span><b class="wi-below"></b>Profit, below ' + tp + ' margin</span><span><b class="wi-ok"></b>✓ ' + tp + ' margin or more</span><span><b class="wi-curk"></b>Current price and ROAS</span></div>' +
      '<p class="note" style="margin:8px 0 0">Profit per unit in CLP. Click a cell to use that price and ROAS. The grid assumes sales volume does not change with price or ad spend, which in practice it does.</p></div>';
  }

  function wiScenCard(p) {
    var s = wiScenarios(p, S.products, S.settings), cols = s.cols, rg = s.ranges;
    function row(label, fn, cls) {
      return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + label + '</td>' + cols.map(function (c) { return '<td class="num">' + fn(c) + '</td>'; }).join('') + '</tr>';
    }
    function money(v) { return '<span class="' + (v >= 0 ? 'pos' : 'neg') + '">' + clp(v) + '</span>'; }
    var dutyL = function (c) { return (Math.round(c.duty * 10) / 10) + '%' + (c.dutyMode === 'formF' ? ' (Form F)' : c.dutyMode === 'general' ? ' (general)' : ''); };
    var head = '<tr><th>Per unit</th>' + cols.map(function (c) { return '<th' + (c.id === 'expected' ? ' style="color:var(--text)"' : '') + '>' + c.label + '</th>'; }).join('') + '</tr>';
    var body =
      row('1 US$ in CLP', function (c) { return grp(c.fx); }) +
      row('Import duty', dutyL) +
      row('Returns', function (c) { return (Math.round(c.returns * 10) / 10) + '%'; }) +
      row('Ads', function (c) { return wiRoasLabel(c.roas); }) +
      row('Net cost per unit', function (c) { return usd(c.perUnitNet); }, 'wi-sep') +
      row('Profit per unit', function (c) { return money(c.profit); }) +
      row('Margin', function (c) { return pct(c.margin); }) +
      row('Total result, ' + cols[1].qty + ' units', function (c) { return money(c.total); }, 'tot');
    function inp(k, label) {
      return '<label class="f"><span>' + label + '</span><input type="text" inputmode="decimal" data-wi-scen="' + k + '" value="' + esc(rg[k]) + '"></label>';
    }
    return '<div class="card"><h3>Scenarios</h3><p style="margin:0 0 10px"><b>' + s.summary + '</b></p>' +
      '<div class="tablewrap"><table class="t wi-scen"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
      '<details class="adv" style="margin-top:12px"><summary>Adjust ranges</summary>' +
      '<p class="note" style="margin:0 0 8px">Worst and best move each input by these amounts. Duty: general tariff in the worst case, Form F in the best. Shared by both of you.</p>' +
      '<div class="wi-fields">' + inp('fx', 'Exchange rate, +/- %') + inp('returns', 'Returns, relative +/- %') + inp('roas', 'ROAS, +/- %') + '</div></details></div>';
  }

  /* events for this view (delegated on #view, like events.js) */
  $('view').addEventListener('click', function (e) {
    var b = e.target.closest('[data-wi-cell]');
    if (!b) return;
    var v = b.getAttribute('data-wi-cell').split('|'), pr = v[0], ro = v[1];
    ask('Use price ' + clp(+pr) + ' and ' + (+ro > 0 ? 'ROAS ' + ro : 'no ads (ROAS 0)') + '?', 'Use', function () {
      var p = cur(); p.pl.rrp = pr; p.pl.roas = ro; changed(false);
    });
  });
  $('view').addEventListener('change', function (e) {
    var k = e.target.getAttribute && e.target.getAttribute('data-wi-scen');
    if (!k) return;
    S.settings.scen = Object.assign({}, WI_SCEN, S.settings.scen || {});
    S.settings.scen[k] = String(e.target.value).trim();
    changed(true);
  });
