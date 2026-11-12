  /* ===== calculation core, copied unchanged from the live simulator ===== */
  var IVA = 0.19;
  function n(v) { v = parseFloat(v); return isFinite(v) && v >= 0 ? v : 0; }

  function calcSim(s) {
    var qty = Math.max(0, Math.round(n(s.qty)));
    var goods = qty * n(s.price);
    var weight = qty * n(s.kgu);
    var cartonCm3 = n(s.cl) * n(s.cw) * n(s.ch);
    var upc = Math.max(1, Math.round(n(s.upc)) || 1);
    var cartons = cartonCm3 > 0 ? Math.ceil(qty / upc) : 0;
    var cbm = cartons * cartonCm3 / 1e6;
    var vdiv = n(s.vdiv) || 6000;
    var volWeight = cartons * cartonCm3 / vdiv;
    var chargeable = Math.max(weight, volWeight);
    var alloc = arguments[1] || null;
    var mode = alloc ? 'lcl' : 'air';
    var freight = alloc ? alloc.freight : chargeable * n(s.rate) + n(s.origin);
    var ins = goods * n(s.insp) / 100;
    var cif = goods + freight + ins;
    var dutyRate = n(s.duty) / 100;
    var duty = cif * dutyRate;
    var ivaBase = cif + duty;
    var iva = ivaBase * IVA;
    var agent = alloc ? alloc.agent : n(s.agent);
    var total = goods + freight + ins + duty + iva + agent;
    var net = total - iva;
    var dep = Math.min(100, n(s.dep)) / 100;
    return {
      mode: mode, alloc: alloc, cartons: cartons, cbm: cbm, volWeight: volWeight, chargeable: chargeable, vdiv: vdiv,
      qty: qty, goods: goods, weight: weight, freight: freight, ins: ins, cif: cif,
      dutyRate: dutyRate, duty: duty, ivaBase: ivaBase, iva: iva, agent: agent,
      total: total, net: net, deposit: goods * dep,
      perUnitNet: qty > 0 ? net / qty : 0,
      perUnitGross: qty > 0 ? total / qty : 0
    };
  }

  function lclAlloc(products, cfg) {
    var out = {};
    if (!cfg || !cfg.on) return { map: out, totalCbm: 0, billed: 0, cost: 0, goods: 0, ids: [] };
    var sel = products.filter(function (p) { return p.sim.lcl === true || p.sim.lcl === '1'; });
    var base = sel.map(function (p) { return { id: p.id, r: calcSim(p.sim) }; });
    var totalCbm = 0, goods = 0;
    base.forEach(function (b) { totalCbm += b.r.cbm; goods += b.r.goods; });
    var billed = sel.length ? Math.max(totalCbm, n(cfg.min)) : 0;
    var cost = billed * n(cfg.rate);
    base.forEach(function (b) {
      var share = cfg.split === 'value' ? (goods > 0 ? b.r.goods / goods : 0) : (totalCbm > 0 ? b.r.cbm / totalCbm : 0);
      out[b.id] = {
        freight: cost * share,
        agent: goods > 0 ? n(cfg.agent) * b.r.goods / goods : 0,
        cbm: b.r.cbm, totalCbm: totalCbm, billed: billed
      };
    });
    return { map: out, totalCbm: totalCbm, billed: billed, cost: cost, goods: goods, ids: sel.map(function (p) { return p.id; }) };
  }

  var FULL = {
    S: { day: 0.83, a: 140, b: 1450, c: 3000 },
    M: { day: 2.33, a: 235, b: 2200, c: 3700 },
    L: { day: 10.33, a: 630, b: 5700, c: 9800 },
    XL: { day: 19.33, a: 825, b: 7500, c: 12500 }
  };
  function isMercadoLibre(mk) { return mk && (mk.id === 'ml' || mk.id === 'mlp' || /mercado ?libre/i.test(mk.name || '')); }
  function fullCost(Q, d, size) {
    var t = FULL[size] || FULL.S;
    if (Q <= 0 || d <= 0) return { store: 0, old: 0, avgDays: 0 };
    var N = Math.min(Q, 20000), step = Q / N, sS = 0, sO = 0, sD = 0;
    for (var i = 1; i <= N; i++) {
      var age = i * step * d;
      sD += age;
      sS += age * t.day;
      sO += t.a * Math.max(0, Math.min(age, 180) - 120) / 30 +
            t.b * Math.max(0, Math.min(age, 365) - 180) / 30 +
            t.c * Math.max(0, age - 365) / 30;
    }
    return { store: sS / N, old: sO / N, avgDays: sD / N };
  }

  function calcPL(r, pl, mk, fx) {
    var rrp = n(pl.rrp);
    var days = n(pl.days);
    var full = isMercadoLibre(mk) && (pl.full === true || pl.full === '1');
    var fc = full ? fullCost(r.qty, days, pl.fullSize) : { store: 0, old: 0, avgDays: 0 };
    var fullIn = full && r.qty > 0 ? n(pl.fullIn) / r.qty : 0;
    var fullTotal = fc.store + fc.old + fullIn;
    var netRev = rrp / (1 + IVA);
    var saleIva = rrp - netRev;
    var commRate = n(mk.commission) / 100;
    var comm = rrp * commRate;
    var fixed = (n(mk.fixedMax) > 0 && rrp > n(mk.fixedMax)) ? 0 : n(mk.fixed);
    var ship = rrp >= n(mk.shipMin) ? n(mk.ship) : 0;
    var retRate = n(pl.returns) / 100;
    var ret = netRev * retRate;
    var landed = r.perUnitNet * n(fx);
    var contribPre = netRev - comm - fixed - ship - fullTotal - ret - landed;
    var roas = n(pl.roas);
    var ads = roas > 0 ? rrp / roas : 0;
    var profit = contribPre - ads;
    var margin = netRev > 0 ? profit / netRev : 0;
    var beRoas = contribPre > 0 ? rrp / contribPre : null;
    var m = n(pl.target) / 100;
    var a = roas > 0 ? 1 / roas : 0;
    var k = (1 - retRate - m) / (1 + IVA) - commRate - a;
    var tRrp = k > 0 ? (fixed + ship + fullTotal + landed) / k : null;
    var absorb = (r.iva > 0 && saleIva > 0) ? Math.ceil(r.iva * n(fx) / saleIva) : 0;
    var importIva = r.qty > 0 ? r.iva / r.qty * n(fx) : 0;
    var feeIva = (comm + fixed + ship + fullTotal) * IVA;
    var ivaPay = saleIva - importIva - feeIva;
    var sellDays = r.qty * days;
    var perMonth = days > 0 ? 30 / days : 0;
    return {
      full: full, fullStore: fc.store, fullOld: fc.old, fullIn: fullIn, fullTotal: fullTotal, avgDays: fc.avgDays,
      days: days, sellDays: sellDays, perMonth: perMonth,
      importIva: importIva, feeIva: feeIva, ivaPay: ivaPay,
      rrp: rrp, netRev: netRev, saleIva: saleIva, comm: comm, fixed: fixed, ship: ship,
      ret: ret, landed: landed, contribPre: contribPre, ads: ads, profit: profit,
      margin: margin, beRoas: beRoas, tRrp: tRrp, absorb: absorb, roas: roas
    };
  }
  /* ===== end calculation core ===== */

