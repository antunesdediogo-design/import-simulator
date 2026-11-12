  function vOverview(p, c) {
    var r = c.r, pl = c.pl, ok = pl.profit >= 0, sea = p.sim.lcl === true;
    var tgt = n(p.pl.target);
    var verdict = pl.rrp <= 0 ? 'Enter a selling price' : ok ? (pl.margin * 100 >= tgt ? 'Meets your ' + tgt + '% target' : 'Profitable, below your ' + tgt + '% target') : 'Loses money on every unit';
    var sugs = [];
    if (pl.rrp > 0 && pl.margin * 100 < tgt) {
      sugs.push(pl.tRrp ? ['Raise the price', clp(pl.tRrp) + ' for a ' + tgt + '% margin', 'Keeps your current costs and ROAS ' + pl.roas + '.'] : ['Raise the price', 'Not reachable at this ROAS', 'Commission, returns and ads already take more than the target allows. Lower the ads cost or change channel.']);
    }
    if (sea && LCL.billed > 0 && LCL.totalCbm / LCL.billed < 0.6) {
      var fq = fillQty(p);
      if (fq > r.qty) { var s = scen(p, fq, true); sugs.push(['Fill the shipment', 'Only ' + Math.round(LCL.totalCbm / LCL.billed * 100) + '% of your ' + m3(LCL.billed) + ' is used', fq + ' units: ' + usd(s.r.perUnitNet) + ' net cost, ' + clp(s.pl.profit) + ' profit per unit.']); }
    }
    if (!sea && unitCbm(p) > 0) {
      var sa = scen(p, r.qty, true);
      sugs.push(['Compare by sea', usd(sa.r.perUnitNet) + ' net cost per unit', 'Same ' + r.qty + ' units in a shared container. Now by air: ' + usd(r.perUnitNet) + '.']);
    }
    var best = null;
    S.settings.mk.forEach(function (m) {
      if (!m.official) return;
      var x = calcPL(r, Object.assign({}, p.pl, { mk: m.id }), m, S.settings.fx);
      if (!best || x.profit > best.x.profit) best = { m: m, x: x };
    });
    if (best && best.m.id !== p.pl.mk && best.x.profit > pl.profit + 1) {
      sugs.push(['Try another channel', best.m.name, clp(best.x.profit) + ' profit per unit instead of ' + clp(pl.profit) + '' + '.']);
    }
    if (!sugs.length) sugs.push(['Nothing to fix', 'Your numbers look healthy', 'Check the P&L tab to see where each peso goes.']);
    var warn = '';
    if (sea && r.cbm === 0) warn = '<div class="warn">Add the carton size (Ship group) so the shared container can be split correctly.</div>';
    if (p.pl.mk && !c.mk.official) warn += '<div class="warn" style="margin-top:8px">The ' + esc(c.mk.name) + ' commission is not confirmed. Treat this result as an estimate.</div>';
    var chips = [
      'IVA you pay SII per unit: ' + clp(pl.ivaPay),
      pl.beRoas ? 'Break-even ROAS: ' + pl.beRoas.toFixed(1) : 'Loses money even with no ads',
      pl.days > 0 ? 'About ' + pl.perMonth.toFixed(1) + ' sales per month' : '',
      pl.absorb ? 'Customs IVA (' + usd(r.iva) + ') is used up after about ' + pl.absorb + ' sales' : ''
    ].filter(Boolean).map(function (t) { return '<span style="border:1px solid var(--line);border-radius:6px;padding:4px 8px">' + t + '</span>'; }).join('');
    return '<div class="card"><div class="' + (ok ? 'pos' : 'neg') + '" style="font:700 22px Archivo,sans-serif">' + verdict + '</div>' +
      '<p class="note" style="margin:6px 0 0">' + r.qty + ' units · ' + (sea ? 'by sea, shared container' : 'by air') + ' · ' + esc(c.mk.name) + ' at ' + clp(pl.rrp) + ' · ROAS ' + pl.roas + '</p>' + (warn ? '<div style="margin-top:12px">' + warn + '</div>' : '') + '</div>' +
      '<div><h2 class="sec" style="margin-bottom:8px">Ways to improve it</h2><div class="grid3">' + sugs.slice(0, 3).map(function (s) {
        return '<div class="sug"><span class="t">' + s[0] + '</span><span class="h">' + esc(s[1]) + '</span><span class="d">' + esc(s[2]) + '</span></div>'; }).join('') + '</div></div>' +
      '<div class="note" style="display:flex;gap:10px;flex-wrap:wrap">' + chips + '</div>';
  }

