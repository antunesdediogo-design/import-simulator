  /* ===== ideas (shared block in the published version) =====
     Each card walks the idea through the validation process in process.js: a 5-step strip, the next undone step,
     and one collapsible block per stage. Typing updates only the [data-live] parts, dots and Go buttons (focus stays);
     selects, ticks and buttons re-render the one card and put the focus back. */
  var STAT = [['idea', 'Idea'], ['investigating', 'Investigating'], ['test', 'Worth testing'], ['discarded', 'Discarded']];
  var ideaFilter = { status: '', author: '' };
  var stOpen = {}; /* open/closed stages as last shown, kept across re-renders: 'ideaId:stage' -> true/false */
  function safeUrl(u) { u = String(u || '').trim(); return /^https?:\/\//i.test(u) ? u : ''; }
  function fdateTime(t) { try { return new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  function fdate(t) { try { return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } }
  function satLevel(v) {
    if (String(v === undefined ? '' : v).trim() === '') return null;
    var x = n(v), lo = n(S.settings.sat.low), hi = n(S.settings.sat.high);
    return x < lo ? ['Low saturation', 'pos'] : x <= hi ? ['Medium saturation', 'warnc'] : ['High saturation', 'neg'];
  }
  function pill(c, t) { return '<span class="pill ' + c + '">' + t + '</span>'; }
  function ideaExt(i) {
    var p = ideaProduct(i);
    return { prod: !!p, away: !p && !!i.productId && i.productProfile !== ideaProfileKey(),
      quoteOk: !!p && n(p.sim.price) > 0 && n(p.pl.rrp) > 0 && !isGuess('s.price', p) };
  }
  function ideaProg(i) { return ideaProgress(i, ideaExt(i)); }
  function touch(i) { i.editedBy = S.me; i.updated = Date.now(); }
  function getPath(o, f) { f.split('.').forEach(function (k) { o = o === undefined || o === null ? undefined : o[k]; }); return o; }
  function setPath(o, f, v) {
    var ks = f.split('.'), last = ks.pop();
    for (var k = 0; k < ks.length; k++) { o = o[ks[k]]; if (!o || typeof o !== 'object') return; }
    o[last] = v;
  }

  /* form controls bound to an idea field by its path, e.g. data-f="mkt.sold" or "sup.0.price" */
  function ctlIn(i, f, ph, mode, extra) {
    var v = getPath(i, f);
    return '<input type="text"' + (mode ? ' inputmode="' + mode + '"' : '') + ' data-i="' + esc(i.id) + '" data-f="' + f + '"' + (extra || '') + ' value="' + esc(v === undefined ? '' : v) + '" placeholder="' + esc(ph || '') + '">';
  }
  function ctlArea(i, f, ph) { return '<textarea data-i="' + esc(i.id) + '" data-f="' + f + '" placeholder="' + esc(ph || '') + '" style="min-height:60px">' + esc(getPath(i, f) || '') + '</textarea>'; }
  function ctlSel(i, f, opts) {
    var v = getPath(i, f);
    return '<select data-i="' + esc(i.id) + '" data-f="' + f + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (v === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
  }
  function ctlChk(i, f, label) { return '<label class="chk"><input type="checkbox" data-i="' + esc(i.id) + '" data-f="' + f + '"' + (getPath(i, f) === true ? ' checked' : '') + '><span>' + label + '</span></label>'; }
  function fld(label, ctl, cls) { return '<label class="f' + (cls ? ' ' + cls : '') + '"><span>' + label + '</span>' + ctl + '</label>'; }
  function stepRow(P, k, inner, tick) { return '<div class="c' + (tick ? ' tk' : '') + '"><span class="dot' + (P.done[k] ? ' ok' : '') + '" data-dot="' + k + '"></span><div>' + inner + '</div></div>'; }

  /* parts that change while typing: rendered here for the full card and for in-place updates */
  function stageLocked(P, s) { return s === 5 ? P.lockB : s >= 3 && P.lockA; }
  function stripHtml(i, P) {
    var h = '';
    STAGE_SHORT.forEach(function (lab, k) {
      var s = k + 1, c = P.kill && s === P.stage ? 'stop' : P.stDone[s] ? 'done' : s === P.stage ? 'cur' : stageLocked(P, s) ? 'lock' : '';
      h += '<li class="' + c + '" title="' + (k + 1) + '. ' + STAGES[k] + '"><b>' + (c === 'done' ? '✓' : c === 'stop' ? '×' : s) + '</b><span>' + lab + '</span></li>';
      if (s === 2 || s === 4) {
        var g = s === 2 ? 'A' : 'B', d = i['gate' + g].d;
        h += '<li class="gt ' + (d === 'go' ? 'done' : d === 'nogo' ? 'stop' : '') + '" title="Gate ' + g + (d ? ': ' + (d === 'go' ? 'go' : 'no-go') : '') + '"><b>' + g + '</b><span>&nbsp;</span></li>';
      }
    });
    return h;
  }
  function nextInfo(P) {
    if (P.kill) return blank(P.kill.why) ? { t: 'write why it was dropped', f: P.kill.f, st: P.kill.st }
      : { done: P.kill.g ? 'Stopped at Gate ' + P.kill.g + '. To reopen it, clear the no-go.' : 'Discarded. To reopen it, change the status.' };
    if (P.next) return { t: P.next.t, f: P.next.f, st: P.next.st };
    return { done: 'All five stages done. Decide whether to order more.' };
  }
  function nextHtml(P) { var x = nextInfo(P); return x.done ? esc(x.done) : '<b>Next:</b> ' + esc(x.t); }
  function ideaMeta(i, P) {
    var sat = satLevel(i.listings), mu = priceMultiple(i, S.settings.fx), h = '';
    if (P.kill) h += pill('neg', P.kill.g ? 'Dropped at Gate ' + P.kill.g : 'Discarded');
    else if (P.stage === 6) h += pill('pos', 'Test done');
    else if (i.gateB.d === 'go') h += pill('pos', 'Passed Gate B');
    else if (i.gateA.d === 'go') h += pill('pos', 'Passed Gate A');
    else h += pill('mut', 'On paper: ' + (P.cnt[1].d + P.cnt[2].d) + ' of ' + (P.cnt[1].n + P.cnt[2].n) + ' steps');
    if (i.exists === 'no') h += pill('neg', 'Not sold in Chile yet');
    if (i.exists === 'yes') h += pill('', 'Sold in Chile');
    if (sat) h += pill(sat[1], sat[0]);
    if (mu) h += pill(mu.incl >= n(S.settings.gates.mult) ? 'pos' : 'neg', 'Price ' + mu.incl.toFixed(1) + 'x FCA');
    if (i.mkt.reg === 'block') h += pill('neg', 'Blocked by rules'); else if (i.mkt.reg === 'cert') h += pill('warnc', 'Needs a certificate');
    if (i.mkt.fit === 'no') h += pill('warnc', 'Bulky or fragile');
    return h;
  }
  function multHtml(i) {
    var mu = priceMultiple(i, S.settings.fx), tgt = n(S.settings.gates.mult);
    if (!mu) return 'Fill in the Chile price (above) and the FCA cost to see the price multiple. Rule of thumb: the Chile price should be at least ' + tgt + 'x the FCA cost.';
    return pill(mu.incl >= tgt ? 'pos' : 'neg', mu.incl.toFixed(1) + 'x') + ' Chile price incl. IVA <span class="num">' + clp(mu.price) + '</span> ÷ FCA cost in CLP <span class="num">' + clp(mu.fcaClp) +
      '</span> (' + usd(usdNum(i.gateA.fca)) + ' × exchange rate ' + grp(n(S.settings.fx)) + '). Your target: ' + tgt + 'x or more. Without IVA it is ' + mu.excl.toFixed(1) + 'x.';
  }
  function missHtml(i, P, g) {
    var d = i['gate' + g].d, miss = g === 'A' ? P.missA : P.missB;
    if (d === 'go') return g === 'A' ? 'Go. Supplier and Numbers are open.' : 'Go. Test is open.';
    if (d === 'nogo') return 'No-go. The idea is marked as discarded.';
    if (g === 'B' && P.lockA) return 'Gate A must be go first.';
    if (!miss.length) return 'Ready to decide.';
    return 'Go unlocks when ' + miss.length + (miss.length === 1 ? ' step is' : ' steps are') + ' done. Next: ' + esc(miss[0].t) + '.';
  }
  function numHtml(i) {
    var p = ideaProduct(i), c = p && CACHE[p.id], g = S.settings.gates, b = i.gateB;
    var snap = b.d && b.m !== '' ? '<div class="note">At the Gate B decision: net margin ' + esc(b.m) + '%, break-even ROAS ' + esc(b.r) + '.</div>' : '';
    if (!c) return snap || '<div class="note">Net margin and break-even ROAS show here once the product is in the simulator.</div>';
    var m = c.pl.margin, be = c.pl.beRoas, okM = m * 100 >= n(g.margin), okR = be !== null && be <= n(g.roas);
    return '<div class="nums"><span>Net margin <b class="num">' + pct(m) + '</b> ' + pill(okM ? 'pos' : 'neg', (okM ? 'meets' : 'below') + ' your ' + esc(g.margin) + '%') + '</span>' +
      '<span>Break-even ROAS <b class="num">' + (be === null ? 'none' : be.toFixed(1)) + '</b> ' + pill(okR ? 'pos' : 'neg', be === null ? 'loses money before ads' : (okR ? 'within' : 'above') + ' your max ' + esc(g.roas)) + '</span></div>' +
      '<div class="note">From the simulator: ' + c.r.qty + ' units, ' + esc(c.mk.name) + ', margin after ads at ROAS ' + esc(String(c.pl.roas)) + '.</div>' + snap;
  }
  function sellHtml(i) {
    var t = i.test, u = clpNum(t.units), s = clpNum(t.sold), r = clpNum(t.ret);
    return u ? 'Sold ' + s + ' of ' + u + ' (' + pct(s / u) + '), returned ' + r + (s ? ' (' + pct(r / s) + ' of sold)' : '') + '.' : '';
  }
  function supSum(s) { var x = usdNum(s.price); return (x ? usd(x) : 'no price') + ' · MOQ ' + (blank(s.moq) ? '?' : esc(s.moq)) + ' · ' + supScore(s) + ' of ' + SUP_TICKS.length + ' checks'; }
  function srcHtml(i) { var u = safeUrl(i.link); return u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">Open source link</a>' : ''; }
  function killTxt(P) { return blank(P.kill.why) ? 'Write the reason at the gate below.' : esc(P.kill.why); }
  function stHint(P, s) { return stageLocked(P, s) && !P.stDone[s] ? 'Locked: needs Gate ' + (s === 5 ? 'B' : 'A') : P.stDone[s] ? 'Done' : P.cnt[s].d + ' of ' + P.cnt[s].n + ' done'; }
  function liveParts(i, P) {
    var o = { strip: stripHtml(i, P), next: nextHtml(P), meta: ideaMeta(i, P), multA: multHtml(i), missA: missHtml(i, P, 'A'), missB: missHtml(i, P, 'B'), num: numHtml(i), sell: sellHtml(i), src: srcHtml(i) };
    if (P.kill) o.killtxt = killTxt(P);
    for (var s = 1; s <= 5; s++) o['h' + s] = stHint(P, s);
    i.sup.forEach(function (x, k) { o['sup' + k] = supSum(x); });
    return o;
  }

  function searchLinks(i) {
    var q = encodeURIComponent(i.name || '');
    return '<a href="https://listado.mercadolibre.cl/' + encodeURIComponent((i.name || '').trim().replace(/\s+/g, '-')) + '" target="_blank" rel="noopener">Search Mercado Libre</a> · ' +
      '<a href="https://www.falabella.com/falabella-cl/search?Ntt=' + q + '" target="_blank" rel="noopener">Search Falabella</a> · ' +
      '<a href="https://www.aliexpress.com/wholesale?SearchText=' + q + '" target="_blank" rel="noopener">AliExpress</a> · ' +
      '<a href="https://www.temu.com/search_result.html?search_key=' + q + '" target="_blank" rel="noopener">Temu</a>';
  }
  function stCls(P, s) { return P.kill && s === P.stage ? ' stop' : P.stDone[s] ? ' done' : s === P.stage ? ' cur' : stageLocked(P, s) ? ' lock' : ''; }
  function stage(i, P, L, s, body, free) {
    var lock = stageLocked(P, s), key = i.id + ':' + s;
    var open = key in stOpen ? stOpen[key] : s === P.stage && !lock;
    var c = stCls(P, s);
    return '<details class="grp stg' + c + '" data-st="' + s + '"' + (open ? ' open' : '') + '><summary><span class="sn">' + (P.stDone[s] ? '✓' : s) + '</span>' + STAGES[s - 1] +
      '<span class="hint" data-live="h' + s + '">' + L['h' + s] + '</span></summary><fieldset class="sb"' + (lock ? ' disabled' : '') + '>' +
      (lock ? '<p class="note" style="margin:0">Locked until Gate ' + (s === 5 ? 'B' : 'A') + ' is go. Anything already written stays here.</p>' : '') + body + '</fieldset>' + (free || '') + '</details>';
  }
  function decHtml(i, P, L, g) {
    var G = i['gate' + g], can = g === 'A' ? P.canGoA : P.canGoB, id = esc(i.id);
    return '<div class="dec"><button type="button" class="btn gbtn go" data-act="gate" data-g="' + g + '" data-d="go" data-id="' + id + '" data-focus="gate' + g + '.d" data-gogo="' + g + '" aria-pressed="' + (G.d === 'go') + '"' + (can || G.d === 'go' ? '' : ' disabled') + '>Go</button>' +
      '<button type="button" class="btn gbtn nogo" data-act="gate" data-g="' + g + '" data-d="nogo" data-id="' + id + '" aria-pressed="' + (G.d === 'nogo') + '">No-go</button></div>' +
      '<div class="note" data-live="miss' + g + '">' + L['miss' + g] + '</div>' +
      fld(G.d === 'nogo' ? 'Why it fails (kept on the card as the kill reason)' : 'One-line reason', ctlIn(i, 'gate' + g + '.why', G.d === 'nogo' ? 'e.g. needs SEC certificate, too costly' : 'e.g. 4x price, few sellers, no permits needed'));
  }
  function supBox(i, s, k, L) {
    var id = esc(i.id), on = i.supPick === k, f = 'sup.' + k + '.';
    return '<div class="sup' + (on ? ' on' : '') + '"><div class="suph"><b>Supplier ' + (k + 1) + (on ? ', chosen' : '') + '</b><span class="note" data-live="sup' + k + '">' + L['sup' + k] + '</span></div>' +
      '<div class="sf">' + fld('Alibaba link', ctlIn(i, f + 'url', 'https://www.alibaba.com/...', '', ' data-focus="sup"'), 'wide') +
      fld('Unit price (USD)', ctlIn(i, f + 'price', 'e.g. 2.10', 'decimal')) + fld('Minimum order (units)', ctlIn(i, f + 'moq', 'e.g. 500', 'numeric')) + '</div>' +
      '<div class="ticks">' + SUP_TICKS.map(function (t) { return ctlChk(i, f + t[0], esc(t[1])); }).join('') + '</div>' +
      '<div class="dec"><button type="button" class="btn sm" data-act="pick" data-n="' + k + '" data-id="' + id + '" data-focus="pick" aria-pressed="' + on + '">' + (on ? 'Chosen' : 'Choose this one') + '</button>' +
      '<button type="button" class="btn sm danger" data-act="delsup" data-n="' + k + '" data-id="' + id + '">Remove</button></div></div>';
  }
  function quoteHtml(i) {
    var p = ideaProduct(i), ch = i.sup[i.supPick];
    if (!p) return i.productId && i.productProfile !== ideaProfileKey()
      ? 'The product made from this idea is in ' + esc(PROFILES[i.productProfile] || 'the other profile') + '’s numbers. Open that profile in the simulator to check it.'
      : 'Then enter the supplier’s real FCA price, freight and quantity in the simulator.';
    var price = n(p.sim.price), h = 'Real quote: FCA price in the simulator <b class="num">' + usd(price) + '</b> ' +
      (price <= 0 ? pill('neg', 'missing') : isGuess('s.price', p) ? pill('warnc', 'still a guess') : pill('pos', 'confirmed'));
    if (ch && usdNum(ch.price) && Math.abs(usdNum(ch.price) - price) > 0.005) h += ' The chosen supplier quoted ' + usd(usdNum(ch.price)) + '.';
    if (ch && !ch.formF) h += '<div class="warn" style="margin-top:6px">The chosen supplier has not confirmed Form F. Without it duty is 6%, not 0%: check the Cost tab.</div>';
    return h;
  }
  function killHtml(i, P) {
    if (!P.kill) return '';
    if (P.kill.g) return '<div class="ikill"><b>Dropped at Gate ' + P.kill.g + ':</b> <span data-live="killtxt">' + killTxt(P) + '</span></div>';
    return '<div class="ikill">' + fld('<b>Discarded.</b> Why? So nobody researches it again.', ctlIn(i, 'kill', 'e.g. needs SEC certificate, too many sellers')) + '</div>';
  }
  function ideaCard(i) {
    var P = ideaProg(i), L = liveParts(i, P), id = esc(i.id), prod = ideaProduct(i);
    var tick = function (f, k, label) { return stepRow(P, k, ctlChk(i, f, label), true); };
    var s1 = '<div class="chk3">' + stepRow(P, 'seen', fld('Where did you spot it?', ctlSel(i, 'seen', SEEN))) +
      stepRow(P, 'link', fld('Source link (the page where you saw it)', ctlIn(i, 'link', 'https://...'))) + '</div><div class="note" data-live="src">' + L.src + '</div>';
    var s2 = '<div class="chk3">' +
      stepRow(P, 'exists', fld('Is it sold in Chile?', ctlSel(i, 'exists', [['unknown', 'Not checked'], ['yes', 'Yes, already sold'], ['no', 'No, nobody sells it']]))) +
      stepRow(P, 'price', fld('Typical Chile price (CLP, incl. IVA)', ctlIn(i, 'price', 'e.g. 24990', 'numeric'))) +
      stepRow(P, 'listings', fld('Number of Chile listings (saturation)', ctlIn(i, 'listings', 'e.g. 120', 'numeric'))) +
      stepRow(P, 'sold', fld('Units sold by the top Chile listings', ctlIn(i, 'mkt.sold', 'e.g. top 3: 500+, 300+, 150+'))) +
      stepRow(P, 'links', fld('Links to the Chile listings, one per line' + (i.exists === 'yes' ? '' : ' (only needed if it is sold)'), ctlArea(i, 'mkt.links', 'https://articulo.mercadolibre.cl/...'))) +
      stepRow(P, 'direct', fld('Price to buy it direct on AliExpress or Temu (CLP, delivered)', ctlIn(i, 'mkt.direct', 'e.g. 9990'))) +
      stepRow(P, 'reg', fld('Rules and permits: SEC (electrical), ISP (cosmetics, health), SAG (food, plants, wood), brand or patent',
        ctlSel(i, 'mkt.reg', [['', 'Not checked'], ['none', 'Checked, nothing needed'], ['cert', 'Needs a certificate we can get'], ['block', 'Blocked, we cannot sell it']]))) +
      stepRow(P, 'fit', fld('Size and weight', ctlSel(i, 'mkt.fit', [['', 'Not checked'], ['yes', 'Small, light, not fragile'], ['no', 'Big, heavy or fragile']]))) +
      '</div><div class="note">' + searchLinks(i) + '</div>' +
      '<div class="igate"><h5>Gate A: does it pass on paper?</h5><div class="chk3">' + stepRow(P, 'fca', fld('Rough FCA cost per unit (USD)', ctlIn(i, 'gateA.fca', 'e.g. 2.50', 'decimal'))) + '</div>' +
      '<div class="note" data-live="multA">' + L.multA + '</div><div class="chk3">' +
      tick('gateA.tried', 'triedA', 'I tried to prove it wrong: looked for a cheaper Chile listing, a certificate it needs, a reason it fails') + '</div>' + decHtml(i, P, L, 'A') + '</div>';
    var s3 = '<p class="note" style="margin:0">Compare up to 3 Alibaba suppliers. Tick only what you could confirm.</p><div class="chk3">' +
      stepRow(P, 'sup', '<div class="note">At least one supplier with link, price and minimum order</div>') + stepRow(P, 'pick', '<div class="note">One supplier chosen</div>') + '</div>' +
      i.sup.map(function (x, k) { return supBox(i, x, k, L); }).join('') +
      (i.sup.length < 3 ? '<div><button type="button" class="btn" data-act="addsup" data-id="' + id + '" data-focus="sup">Add supplier</button></div>' : '') +
      '<div class="note"><a href="https://www.alibaba.com/trade/search?SearchText=' + encodeURIComponent(i.name || '') + '" target="_blank" rel="noopener">Search Alibaba</a></div>';
    var tos = '<button type="button" class="btn pri" data-act="tosim" data-id="' + id + '" data-focus="tosim">' + (prod ? 'Open product' : 'Create product in simulator') + '</button>';
    var outside = prod && P.lockA; /* an existing product can always be opened */
    var s4 = '<div class="chk3">' + stepRow(P, 'prod', '<div class="note">' + (prod ? 'Product in the simulator: <b style="color:var(--text)">' + esc(prod.name) + '</b>'
        : 'Create the product from this idea. It starts with the chosen supplier’s price, or your rough FCA cost marked as a guess.') + '</div>' + (outside ? '' : '<div style="margin-top:8px">' + tos + '</div>')) +
      stepRow(P, 'quote', '<div class="note">' + quoteHtml(i) + '</div>') + '</div>' + '<div data-live="num">' + L.num + '</div>' +
      '<div class="igate"><h5>Gate B: does the margin hold with real quotes?</h5><p class="note" style="margin:0">Go means: order a sample.</p><div class="chk3">' +
      tick('gateB.tried', 'triedB', 'I tried to prove it wrong: checked the worst case in the What if tab, freight, Form F and returns') + '</div>' + decHtml(i, P, L, 'B') + '</div>';
    var s5 = '<div class="chk3">' + tick('test.sample', 'sample', 'Sample ordered') +
      stepRow(P, 'quality', fld('Sample quality', ctlSel(i, 'test.quality', [['', 'Not checked yet'], ['ok', 'Good enough to sell'], ['bad', 'Not good enough']]))) +
      tick('test.ship', 'ship', 'Small air shipment sent (20 to 50 units)') +
      stepRow(P, 'sell', '<div class="sf3">' + fld('Units sent', ctlIn(i, 'test.units', 'e.g. 40', 'numeric')) + fld('Units sold', ctlIn(i, 'test.sold', 'e.g. 25', 'numeric')) +
        fld('Returned', ctlIn(i, 'test.ret', 'e.g. 1', 'numeric')) + '</div><div class="note" data-live="sell">' + L.sell + '</div>') + '</div>';
    return '<article class="icard' + (P.kill ? ' killed' : '') + '" data-card="' + id + '"><div class="hd"><h4>' + esc(i.name) + '</h4>' +
      '<select data-i="' + id + '" data-f="status" aria-label="Status" style="background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:7px;min-height:36px">' +
      STAT.map(function (x) { return '<option value="' + x[0] + '"' + (i.status === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="note">Added by <b style="color:var(--text)">' + esc(i.author) + '</b> on ' + fdate(i.created) + (i.editedBy ? ' · last edit by ' + esc(i.editedBy) + ' on ' + fdate(i.updated) : '') + '</div>' +
      killHtml(i, P) + '<ol class="istrip" data-live="strip" aria-label="Progress">' + L.strip + '</ol>' +
      '<button type="button" class="inext' + (P.kill ? ' k' : '') + '" data-act="next" data-id="' + id + '" data-live="next">' + L.next + '</button>' +
      '<div class="meta" data-live="meta">' + L.meta + '</div><div class="stgs">' +
      stage(i, P, L, 1, s1) + stage(i, P, L, 2, s2) + stage(i, P, L, 3, s3) + stage(i, P, L, 4, s4, outside ? '<div style="padding:0 12px 12px">' + tos + '</div>' : '') + stage(i, P, L, 5, s5) + '</div>' +
      '<label class="f"><span>Notes, source of the price, competitors</span><textarea data-i="' + id + '" data-f="notes">' + esc(i.notes || '') + '</textarea></label>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn danger" data-act="del" data-id="' + id + '">Delete</button></div></article>';
  }

  /* focus: describe the focused control so it can be found again after a re-render */
  function focusKey(el) {
    if (!el || !el.getAttribute) return null;
    var f = el.getAttribute('data-f'), a = el.getAttribute('data-act');
    if (f) return '[data-f="' + f + '"]';
    if (a) return '[data-act="' + a + '"]' + ['data-g', 'data-d', 'data-n'].map(function (x) { var v = el.getAttribute(x); return v === null ? '' : '[' + x + '="' + v + '"]'; }).join('');
    if (el.tagName === 'SUMMARY' && el.parentNode.getAttribute('data-st')) return 'details[data-st="' + el.parentNode.getAttribute('data-st') + '"] > summary';
    return null;
  }
  function refocus(root, sel) {
    var el = root && sel ? root.querySelector(sel) : null;
    if (!el || el.disabled) return false;
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    return document.activeElement === el;
  }
  function cardEl(id) { return document.querySelector('#appIdeas .icard[data-card="' + id + '"]'); }
  /* Remember which stages are open, so a re-render does not fold the stage the user is working in.
     Without an entry the default applies: the current stage open, the others closed. */
  function keepOpen(c) {
    c.querySelectorAll('details.stg').forEach(function (d) { stOpen[c.getAttribute('data-card') + ':' + d.getAttribute('data-st')] = d.open; });
  }
  function rerenderCard(i, focusSel, fresh) {
    var old = cardEl(i.id); if (!old) { renderIdeas(); return; }
    if (fresh) Object.keys(stOpen).forEach(function (k) { if (k.indexOf(i.id + ':') === 0) delete stOpen[k]; });
    else keepOpen(old);
    var a = document.activeElement, key = old.contains(a) ? focusKey(a) : null;
    var tmp = document.createElement('div'); tmp.innerHTML = ideaCard(i);
    var card = tmp.firstChild; old.parentNode.replaceChild(card, old);
    if (focusSel && refocus(card, focusSel)) return;
    if (key && !refocus(card, key)) refocus(card, 'details.stg[open] > summary');
  }
  function liveCard(i) {
    var card = cardEl(i.id); if (!card) return;
    var P = ideaProg(i), L = liveParts(i, P);
    card.querySelectorAll('[data-live]').forEach(function (el) { var k = el.getAttribute('data-live'); if (L[k] !== undefined) el.innerHTML = L[k]; });
    card.querySelectorAll('details.stg').forEach(function (d) {
      var s = +d.getAttribute('data-st'); d.className = 'grp stg' + stCls(P, s); d.querySelector('.sn').textContent = P.stDone[s] ? '✓' : s;
    });
    card.querySelectorAll('[data-dot]').forEach(function (d) { d.classList.toggle('ok', !!P.done[d.getAttribute('data-dot')]); });
    ['A', 'B'].forEach(function (g) { var bt = card.querySelector('[data-gogo="' + g + '"]'); if (bt) bt.disabled = !(g === 'A' ? P.canGoA : P.canGoB) && i['gate' + g].d !== 'go'; });
  }
  function liveAll() { S.ideas.forEach(liveCard); }
  function goNext(i) {
    var x = nextInfo(ideaProg(i)), card = cardEl(i.id); if (x.done || !card) return;
    var d = x.st ? card.querySelector('details.stg[data-st="' + x.st + '"]') : null;
    if (d && !d.open) { d.open = true; stOpen[i.id + ':' + x.st] = true; }
    var el = card.querySelector('[data-f="' + x.f + '"]:not(:disabled)') || card.querySelector('[data-focus~="' + x.f + '"]:not(:disabled)');
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  }
  function gatesHint() { var g = S.settings.gates; return 'price ' + g.mult + 'x FCA, margin ' + g.margin + '%, ROAS up to ' + g.roas; }

  function renderIdeas() {
    var el = $('appIdeas'), list = S.ideas.filter(function (i) {
      return (!ideaFilter.status || i.status === ideaFilter.status) && (!ideaFilter.author || i.author === ideaFilter.author);
    });
    var fe = document.activeElement, ac = fe && fe.closest ? fe.closest('#appIdeas .icard') : null, fid = ac ? ac.getAttribute('data-card') : null, fkey = ac ? focusKey(fe) : null, aid = fe && el.contains(fe) ? fe.id : '';
    list.sort(function (a, b) { return b.created - a.created; });
    el.querySelectorAll('.icard').forEach(keepOpen);
    el.innerHTML =
      '<div class="card"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:12px"><h3 style="margin:0">New idea to investigate</h3>' +
      (mode === 'shared' ? '<div class="note">Signed in as <b style="color:var(--text)">' + esc(S.me) + '</b>. Everything you write here is shared with both of you.</div></div>' :
      '<div style="display:flex;align-items:center;gap:8px"><span class="note">You are</span><div class="seg" role="radiogroup" aria-label="Who is writing">' +
      ['André', 'Agustín'].map(function (w) { return '<button type="button" role="radio" data-act="me" data-who="' + w + '" aria-checked="' + (S.me === w) + '" style="padding:8px 14px">' + w + '</button>'; }).join('') + '</div></div></div>') +
      '<div class="row"><label class="f"><span>Product or idea</span><input type="text" id="ideaName" placeholder="e.g. Portable tire inflator"></label>' +
      '<label class="f"><span>Where did you spot it? (optional)</span><select id="ideaSeen">' + SEEN.map(function (x) { return '<option value="' + x[0] + '">' + esc(x[1]) + '</option>'; }).join('') + '</select></label>' +
      '<label class="f"><span>Source link (optional)</span><input type="text" id="ideaLink" placeholder="https://..."></label>' +
      '<label class="f" style="flex-basis:100%"><span>Why could it work? (optional)</span><textarea id="ideaNotes" style="min-height:60px"></textarea></label>' +
      '<button type="button" class="btn pri" data-act="add">Add idea</button></div></div>' +
      '<div class="row"><label class="f" style="flex:0 1 180px"><span>Status</span><select id="fStatus"><option value="">All</option>' + STAT.map(function (x) { return '<option value="' + x[0] + '"' + (ideaFilter.status === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label>' +
      '<label class="f" style="flex:0 1 180px"><span>Written by</span><select id="fAuthor"><option value="">Both</option><option' + (ideaFilter.author === 'André' ? ' selected' : '') + '>André</option><option' + (ideaFilter.author === 'Agustín' ? ' selected' : '') + '>Agustín</option></select></label>' +
      '<details class="grp" style="flex:1 1 320px"><summary>Saturation scale<span class="hint">low under ' + esc(S.settings.sat.low) + ', high over ' + esc(S.settings.sat.high) + ' listings</span></summary><div class="fields"><label class="f"><span>Low if fewer than</span><input type="text" inputmode="numeric" data-sat="low" value="' + esc(S.settings.sat.low) + '"></label><label class="f"><span>High if more than</span><input type="text" inputmode="numeric" data-sat="high" value="' + esc(S.settings.sat.high) + '"></label><p class="note wide">These two numbers are a starting guess, not a rule. Adjust them to how many listings feel crowded in the categories you look at.</p></div></details>' +
      '<details class="grp" style="flex:1 1 320px"><summary>Gate rules<span class="hint" id="gatesHint">' + esc(gatesHint()) + '</span></summary><div class="fields">' +
      '<label class="f"><span>Gate A: Chile price at least (x FCA cost)</span><input type="text" inputmode="decimal" data-gs="mult" value="' + esc(S.settings.gates.mult) + '"></label>' +
      '<label class="f"><span>Gate B: net margin at least (%)</span><input type="text" inputmode="decimal" data-gs="margin" value="' + esc(S.settings.gates.margin) + '"></label>' +
      '<label class="f"><span>Gate B: break-even ROAS at most</span><input type="text" inputmode="decimal" data-gs="roas" value="' + esc(S.settings.gates.roas) + '"></label>' +
      '<p class="note wide">These three numbers are your own starting guesses, not rules. Gate A compares the Chile price incl. IVA with the FCA cost in CLP (exchange rate from the simulator). Gate B uses the net margin after ads and the break-even ROAS of the product in the simulator.</p></div></details></div>' +
      (list.length ? '<div class="igrid">' + list.map(ideaCard).join('') + '</div>' : '<div class="card note">' + (S.ideas.length ? 'No ideas match these filters.' : 'No ideas yet. Write the first one above.') + '</div>');
    var cnt = $('ideaCount'); if (cnt) cnt.textContent = S.ideas.length ? '(' + S.ideas.length + ')' : '';
    if (fid) refocus(cardEl(fid), fkey); else if (aid && $(aid)) $(aid).focus();
  }
  function showView(rerender) {
    var ideas = S.view === 'ideas';
    $('appSim').hidden = ideas; $('appIdeas').hidden = !ideas;
    document.querySelectorAll('#viewSw [data-view]').forEach(function (b) { b.setAttribute('aria-checked', String((b.getAttribute('data-view') === 'ideas') === ideas)); });
    var cnt = $('ideaCount'); if (cnt) cnt.textContent = S.ideas.length ? '(' + S.ideas.length + ')' : '';
    if (ideas && rerender) renderIdeas();
  }
  $('viewSw').addEventListener('click', function (e) {
    var b = e.target.closest('[data-view]'); if (!b) return;
    S.view = b.getAttribute('data-view'); save(); showView(true);
  });
  function ideaProfileKey() { return mode === 'shared' ? profile : 'local'; }
  /* The product made from this idea in the profile that is open, or null. */
  function ideaProduct(i) {
    if (!i.productId || i.productProfile !== ideaProfileKey()) return null;
    for (var k = 0; k < S.products.length; k++) if (S.products[k].id === i.productId) return S.products[k];
    return null;
  }
  function ideaById(id) { for (var i = 0; i < S.ideas.length; i++) if (S.ideas[i].id === id) return S.ideas[i]; return null; }
  $('appIdeas').addEventListener('click', function (e) {
    var b =e.target.closest('[data-act]'); if (!b) return;
    var act = b.getAttribute('data-act');
    if (act === 'me') { S.me = b.getAttribute('data-who'); save(); renderIdeas(); return; }
    if (act === 'add') {
      var name = $('ideaName').value.trim();
      if (!name) { $('ideaName').focus(); return; }
      S.ideas.push(normIdea({ id: 'i_' + uid(), name: name, link: $('ideaLink').value.trim(), notes: $('ideaNotes').value.trim(), author: S.me, created: Date.now(), updated: Date.now(), editedBy: '',
        status: 'idea', exists: 'unknown', price: '', listings: '', seen: $('ideaSeen').value }));
      save(); renderIdeas(); return;
    }
    var i = ideaById(b.getAttribute('data-id')); if (!i) return;
    if (act === 'del') {
      ask('Delete the idea "' + i.name + '"? This cannot be undone.', 'Delete', function () {
        S.ideas = S.ideas.filter(function (x) { return x.id !== i.id; }); save(); renderIdeas(); toast('Idea deleted');
      });
      return;
    }
    if (act === 'next') { goNext(i); return; }
    if (act === 'gate') {
      var g = b.getAttribute('data-g'), d = b.getAttribute('data-d'), G = i['gate' + g], P = ideaProg(i);
      if (d === 'go' && G.d !== 'go' && !(g === 'A' ? P.canGoA : P.canGoB)) return;
      G.d = G.d === d ? '' : d;
      if (g === 'B') { var gp = ideaProduct(i), gc = gp && CACHE[gp.id]; if (G.d && gc) { G.m = (gc.pl.margin * 100).toFixed(1); G.r = gc.pl.beRoas === null ? 'none' : gc.pl.beRoas.toFixed(1); } }
      i.status = autoStatus(i); touch(i); save();
      rerenderCard(i, G.d === 'nogo' && blank(G.why) ? '[data-f="gate' + g + '.why"]' : null, true); /* fresh: the new current stage opens */
      return;
    }
    if (act === 'addsup') {
      if (i.sup.length >= 3) return;
      i.sup.push(normSup({})); touch(i); save(); rerenderCard(i, '[data-f="sup.' + (i.sup.length - 1) + '.url"]'); return;
    }
    if (act === 'pick' || act === 'delsup') {
      var k = +b.getAttribute('data-n'), s = i.sup[k]; if (!s) return;
      if (act === 'pick') { i.supPick = i.supPick === k ? -1 : k; touch(i); save(); rerenderCard(i); return; }
      var rm = function () { i.sup.splice(k, 1); if (i.supPick === k) i.supPick = -1; else if (i.supPick > k) i.supPick--; touch(i); save(); rerenderCard(i); };
      if (blank(s.url) && blank(s.price) && blank(s.moq) && !supScore(s)) rm(); else ask('Remove supplier ' + (k + 1) + ' from "' + i.name + '"?', 'Remove', rm);
      return;
    }
    if (act === 'tosim') {
      var ex = ideaProduct(i);
      if (ex) { S.active = ex.id; S.tab = 'overview'; S.view = 'sim'; changed(false); window.scrollTo(0, 0); return; }
      if (ideaProg(i).lockA) return; /* creating a product belongs after Gate A */
      var p = blankProduct(i.name); p.sim.lcl = true; p.sim.qty = '50';
      p.notes = i.notes || '';
      if (safeUrl(i.link)) p.links = [{ url: safeUrl(i.link) }];
      var pr = clpNum(i.price); if (pr > 0) p.pl.rrp = String(pr);
      var sp = i.sup[i.supPick], fca = usdNum(i.gateA.fca);
      if (sp && usdNum(sp.price)) p.sim.price = String(usdNum(sp.price));
      else if (fca) { p.sim.price = String(fca); p.unconf = Object.assign(guessDefaults(false), { 's.price': true }); }
      p.fromIdea = i.id;
      S.products.push(p); S.active = p.id; S.tab = 'overview'; S.view = 'sim';
      i.productId = p.id; i.productProfile = ideaProfileKey(); touch(i);
      changed(false); window.scrollTo(0, 0); toast('Product created from the idea');
    }
  });
  function ideaInput(e) {
    var el = e.target; if (!el.getAttribute) return;
    var whole = el.tagName === 'SELECT' || el.type === 'checkbox';
    if (whole !== (e.type === 'change')) return; /* text on input, selects and ticks on change */
    if (el.getAttribute('data-sat')) { S.settings.sat[el.getAttribute('data-sat')] = el.value; save(); liveAll(); return; }
    if (el.getAttribute('data-gs')) { S.settings.gates[el.getAttribute('data-gs')] = el.value; save(); liveAll(); $('gatesHint').textContent = gatesHint(); return; }
    if (el.id === 'fStatus') { ideaFilter.status = el.value; renderIdeas(); return; }
    if (el.id === 'fAuthor') { ideaFilter.author = el.value; renderIdeas(); return; }
    var id = el.getAttribute('data-i'); if (!id) return;
    var i = ideaById(id); if (!i) return;
    var f = el.getAttribute('data-f');
    setPath(i, f, el.type === 'checkbox' ? el.checked : el.value); touch(i); save();
    if (!whole) { liveCard(i); return; }
    var P = ideaProg(i);
    rerenderCard(i, f === 'status' && P.kill && !P.kill.g && blank(i.kill) ? '[data-f="kill"]' : null);
  }
  $('appIdeas').addEventListener('input', ideaInput);
  $('appIdeas').addEventListener('change', ideaInput);
