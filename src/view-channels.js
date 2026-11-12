  function vChannels(p, c) {
    var rows = S.settings.mk.map(function (m) {
      var x = calcPL(c.r, Object.assign({}, p.pl, { mk: m.id }), m, S.settings.fx);
      return { m: m, x: x };
    });
    var best = Math.max.apply(null, rows.map(function (q) { return q.x.profit; }));
    var body = rows.map(function (q) {
      var cur_ = q.m.id === p.pl.mk;
      return '<tr class="' + (cur_ ? 'hl' : '') + '"><td>' + esc(q.m.name) + (q.m.official ? '' : ' <span class="mut">(unconfirmed)</span>') + (cur_ ? ' <span class="pill" style="color:var(--accent)">selected</span>' : '') + '</td>' +
        '<td class="num">' + q.m.commission + '%</td><td class="num ' + (q.x.profit >= 0 ? 'pos' : 'neg') + '">' + clp(q.x.profit) + (q.x.profit === best ? ' ★' : '') + '</td>' +
        '<td class="num">' + pct(q.x.margin) + '</td><td class="num">' + (q.x.tRrp ? clp(q.x.tRrp) : 'n/a') + '</td></tr>';
    }).join('');
    return '<div class="card tablewrap"><h3>Same product, every channel</h3><table class="t"><thead><tr><th>Channel</th><th>Commission</th><th>Profit / unit</th><th>Margin</th><th>Price for target</th></tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<p class="note">Uses your selling price, ROAS and returns for every row. Logistics fees of Falabella, Paris and Ripley are not included, so those channels look better here than they will be.</p>';
  }

