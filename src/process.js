  /* ===== idea validation process (pure: no DOM, tests load it in Node) =====
     Market track: 1 Idea, 2 Market check, then Gate A (passes on paper). Supplier track: 3 Supplier, 4 Numbers,
     then Gate B (margin holds with real quotes), 5 Test. Data defaults are in normIdea (state.js).
     ext = { prod: the product made from the idea is in the open profile, away: it was made in the other profile,
             quoteOk: that product has a real FCA quote (filled in and not marked as a guess) }, supplied by ideas.js. */
  var STAGES = ['Idea', 'Market check', 'Supplier', 'Numbers', 'Test'];
  var STAGE_SHORT = ['Idea', 'Market', 'Supplier', 'Numbers', 'Test'];
  var SEEN = [['', 'Not set'], ['amzus-ms', 'Amazon US, Movers & Shakers'], ['amzus-nr', 'Amazon US, New Releases'], ['amzde-ms', 'Amazon DE, Movers & Shakers'],
    ['amzde-nr', 'Amazon DE, New Releases'], ['mlcl', 'Mercado Libre Chile, trends'], ['mlmx', 'Mercado Libre Mexico'], ['mlbr', 'Mercado Libre Brazil'], ['other', 'Somewhere else']];
  var SUP_TICKS = [['years', '3+ years on Alibaba and Verified Supplier'], ['ta', 'Trade Assurance'], ['rate', 'On-time delivery and response rate above 90%'],
    ['reviews', 'Real reviews for this product'], ['maker', 'Manufacturer, not a trading company'], ['sample', 'Will send a sample'], ['formF', 'Can provide Form F (needed for 0% duty)']];
  function blank(v) { return String(v === undefined || v === null ? '' : v).trim() === ''; }
  /* "24.990", "$24,990" -> 24990 (CLP has no decimals). 0 when it is not a number. */
  function clpNum(v) { var s = String(v || '').replace(/[\s$.,]/g, ''); return /^\d+$/.test(s) ? +s : 0; }
  /* "2.5", "2,5", "US$2.50" -> 2.5 */
  function usdNum(v) { var x = parseFloat(String(v || '').replace(',', '.').replace(/[^\d.]/g, '')); return isFinite(x) && x > 0 ? x : 0; }
  /* Chile price (CLP, incl. IVA) against the FCA unit cost converted to CLP. null until both are filled in. */
  function priceMultiple(i, fx) {
    var p = clpNum(i.price), f = usdNum(i.gateA && i.gateA.fca), x = n(fx);
    if (!(p > 0 && f > 0 && x > 0)) return null;
    var c = f * x;
    return { price: p, fcaClp: c, incl: p / c, excl: p / (1 + IVA) / c };
  }
  function supReady(s) { return !!s && !blank(s.url) && !blank(s.price) && !blank(s.moq); }
  function supScore(s) { var k = 0; SUP_TICKS.forEach(function (t) { if (s[t[0]] === true) k++; }); return k; }
  function ideaSteps(i, ext) {
    ext = ext || {};
    var m = i.mkt, a = i.gateA, b = i.gateB, t = i.test, ch = i.sup[i.supPick];
    return [
      [1, 'seen', 'seen', 'say where you spotted it', !blank(i.seen)],
      [1, 'link', 'link', 'paste the source link', !blank(i.link)],
      [2, 'exists', 'exists', 'check if it is sold in Chile', i.exists === 'yes' || i.exists === 'no'],
      [2, 'price', 'price', 'note the typical Chile price', !blank(i.price)],
      [2, 'listings', 'listings', 'count the Chile listings', !blank(i.listings)],
      [2, 'sold', 'mkt.sold', 'note units sold by the top Chile listings', !blank(m.sold)],
      [2, 'links', 'mkt.links', 'paste links to the Chile listings', i.exists === 'no' || (i.exists === 'yes' && !blank(m.links))],
      [2, 'direct', 'mkt.direct', 'check the price on AliExpress or Temu', !blank(m.direct)],
      [2, 'reg', 'mkt.reg', 'check rules and permits (SEC, ISP, SAG, brand)', m.reg !== ''],
      [2, 'fit', 'mkt.fit', 'check size, weight and fragility', m.fit !== ''],
      [2, 'fca', 'gateA.fca', 'estimate the FCA cost per unit', !blank(a.fca)],
      [2, 'triedA', 'gateA.tried', 'try to prove it wrong, then tick the box', a.tried],
      [2, 'decA', 'gateA.d', 'decide Gate A: go or no-go', a.d === 'go'],
      [3, 'sup', 'sup', 'add an Alibaba supplier (link, price, minimum order)', i.sup.some(supReady)],
      [3, 'pick', 'pick', 'choose a supplier', supReady(ch)],
      [4, 'prod', 'tosim', 'create the product in the simulator', !!(ext.prod || ext.away)],
      [4, 'quote', 'tosim', ext.prod || !ext.away ? 'enter the real quote in the simulator' : 'open the profile that has the product', !!ext.quoteOk],
      [4, 'triedB', 'gateB.tried', 'try to prove it wrong, then tick the box', b.tried],
      [4, 'decB', 'gateB.d', 'decide Gate B: order a sample or not', b.d === 'go'],
      [5, 'sample', 'test.sample', 'order a sample', t.sample],
      [5, 'quality', 'test.quality', t.quality === 'bad' ? 'sample not good enough: try another supplier or stop' : 'check the sample quality', t.quality === 'ok'],
      [5, 'ship', 'test.ship', 'send a small air shipment (20 to 50 units)', t.ship],
      [5, 'sell', 'test.sold', 'note units sold and returned', !blank(t.sold) && !blank(t.ret)]
    ].map(function (x) { return { st: x[0], k: x[1], f: x[2], t: x[3], done: !!x[4] }; });
  }
  /* Where the idea is: stage (1-5, 6 = all done), next undone step, counts per stage, gate locks and the kill reason. */
  function ideaProgress(i, ext) {
    var steps = ideaSteps(i, ext), P = { steps: steps, done: {}, cnt: [null], stDone: [null], next: null };
    for (var s = 1; s <= 5; s++) P.cnt.push({ d: 0, n: 0 });
    steps.forEach(function (x) {
      P.done[x.k] = x.done; P.cnt[x.st].n++;
      if (x.done) P.cnt[x.st].d++; else if (!P.next) P.next = x;
    });
    for (s = 1; s <= 5; s++) P.stDone.push(P.cnt[s].d === P.cnt[s].n);
    P.lockA = i.gateA.d !== 'go'; P.lockB = i.gateB.d !== 'go';
    P.missA = steps.filter(function (x) { return x.st <= 2 && x.k !== 'decA' && !x.done; });
    P.missB = steps.filter(function (x) { return (x.st === 3 || x.st === 4) && x.k !== 'decB' && !x.done; });
    P.canGoA = !P.missA.length;
    P.canGoB = !P.lockA && !P.missB.length;
    P.kill = i.gateA.d === 'nogo' ? { g: 'A', st: 2, f: 'gateA.why', why: i.gateA.why }
      : i.gateB.d === 'nogo' ? { g: 'B', st: 4, f: 'gateB.why', why: i.gateB.why }
      : i.status === 'discarded' ? { g: '', st: 0, f: 'kill', why: i.kill } : null;
    P.stage = P.kill && P.kill.st ? P.kill.st : P.next ? P.next.st : 6;
    return P;
  }
  /* Status that follows a gate decision. Never moves a live idea backwards (idea < investigating < test). */
  function autoStatus(i) {
    if (i.gateA.d === 'nogo' || i.gateB.d === 'nogo') return 'discarded';
    var rank = { idea: 0, investigating: 1, test: 2 };
    var to = i.gateB.d === 'go' ? 'test' : i.gateA.d === 'go' ? 'investigating' : 'idea';
    if (i.status === 'discarded') return to === 'idea' ? 'investigating' : to;
    return (rank[i.status] || 0) >= rank[to] ? i.status : to;
  }
