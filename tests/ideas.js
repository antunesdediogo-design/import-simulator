/* Idea validation process tests (stages, gates, kill reason, focus, reload), required by tests/run.js. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = path.resolve(__dirname, '..', 'src');
const wait = ms => new Promise(r => setTimeout(r, ms));

function load() {
  const code = ['core.js', 'util.js', 'state.js', 'process.js'].map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('');
  return vm.runInNewContext("(function () {\n  'use strict';\n" + code +
    "\nreturn { S: S, normIdea: normIdea, normState: normState, seedProduct: seedProduct, ideaProgress: ideaProgress, priceMultiple: priceMultiple, autoStatus: autoStatus, clpNum: clpNum, usdNum: usdNum };\n})()",
    { document: { addEventListener: function () {} } });
}
const OLD = { id: 'i_old1', name: 'Old grip', link: '', notes: 'from before', author: 'Agustín', created: 1762900000000, updated: 1762900000000, editedBy: '', status: 'investigating', exists: 'yes', price: '19.990', listings: '80' };
const PARTIAL = { id: 'i_part1', name: 'Partial lamp', created: 1762800000000, exists: 'unknown', mkt: { sold: '50' }, gateA: null, gateB: { d: 'maybe', tried: 'yes' }, sup: [{ url: 'https://www.alibaba.com/x', ta: true }, 'junk'], supPick: 5, test: 'bad' };

function node(check) {
  console.log('Idea process (Node, src/process.js)');
  const api = load();
  const o = api.normIdea(JSON.parse(JSON.stringify(OLD)));
  check('old idea keeps its fields', o.name === 'Old grip' && o.exists === 'yes' && o.price === '19.990' && o.status === 'investigating' && o.notes === 'from before');
  check('old idea gets every new field', o.seen === '' && o.kill === '' && o.mkt.sold === '' && o.mkt.reg === '' && o.gateA.d === '' && o.gateA.fca === '' && o.gateA.tried === false &&
    o.gateB.m === '' && Array.isArray(o.sup) && o.sup.length === 0 && o.supPick === -1 && o.test.sample === false && o.test.sold === '', o);
  const pa = api.normIdea(JSON.parse(JSON.stringify(PARTIAL)));
  check('partial or broken nested objects get safe defaults', pa.mkt.sold === '50' && pa.mkt.links === '' && pa.gateA.d === '' && pa.gateA.fca === '' && pa.gateB.d === '' && pa.gateB.tried === false &&
    pa.sup.length === 2 && pa.sup[0].ta === true && pa.sup[0].formF === false && pa.sup[1].url === '' && pa.supPick === -1 && pa.test.quality === '' && pa.test.ship === false && pa.status === 'idea', pa);
  check('normIdea is stable (normalising twice changes nothing)', JSON.stringify(api.normIdea(JSON.parse(JSON.stringify(pa)))) === JSON.stringify(pa));
  const P = api.ideaProgress(o, {});
  check('old idea: 3 old checks count as done, stage 1 is next', P.done.exists && P.done.price && P.done.listings && P.stage === 1 && P.next.k === 'seen' && P.cnt[2].d === 3 && P.cnt[2].n === 11, [P.stage, P.cnt[2]]);
  check('old idea: Gate A cannot go, stages 3 and 4 locked', !P.canGoA && P.lockA && P.lockB && !P.canGoB);

  const m = api.priceMultiple({ price: '24.990', gateA: { fca: '2,5' } }, '1000');
  check('price multiple: 24.990 CLP vs US$2,5 at 1000 = 10.0x incl. IVA', m && Math.abs(m.incl - 9.996) < 1e-9 && Math.abs(m.excl - 9.996 / 1.19) < 1e-9 && m.fcaClp === 2500, m);
  check('price multiple is null without FCA cost or price', api.priceMultiple({ price: '24990', gateA: { fca: '' } }, '1000') === null && api.priceMultiple({ price: 'n/a', gateA: { fca: '2' } }, '1000') === null);
  check('clpNum and usdNum', api.clpNum('$24.990') === 24990 && api.clpNum('abc') === 0 && api.usdNum('US$2.50') === 2.5 && api.usdNum('') === 0);

  const i = api.normIdea({ name: 'x', seen: 'mlcl', link: 'https://a', exists: 'no', price: '20000', listings: '0', mkt: { sold: '0', direct: '9990', reg: 'none', fit: 'yes' }, gateA: { fca: '2' } });
  let q = api.ideaProgress(i, {});
  check('Gate A waits for the "tried to prove it wrong" tick', !q.canGoA && q.missA.length === 1 && q.missA[0].k === 'triedA', q.missA.map(x => x.k));
  i.gateA.tried = true; q = api.ideaProgress(i, {});
  check('Gate A can go once stages 1-2 and its items are done', q.canGoA && q.next.k === 'decA');
  i.gateA.d = 'go'; i.status = api.autoStatus(i); q = api.ideaProgress(i, {});
  check('after Gate A go: supplier stage open, status investigating, Gate B still locked', !q.lockA && q.stage === 3 && i.status === 'investigating' && !q.canGoB && q.lockB);
  i.gateB.d = 'nogo'; i.status = api.autoStatus(i); q = api.ideaProgress(i, {});
  check('Gate B no-go: discarded, kill at Gate B asks for a reason', i.status === 'discarded' && q.kill && q.kill.g === 'B' && q.kill.f === 'gateB.why' && q.stage === 4);
  i.gateB.d = ''; i.status = api.autoStatus(i);
  check('clearing the no-go reopens the idea', i.status === 'investigating' && !api.ideaProgress(i, {}).kill);
  const d = api.normIdea({ name: 'y', status: 'discarded' });
  check('discarded by status: kill reason field is "kill"', api.ideaProgress(d, {}).kill.f === 'kill');
  const t = api.normIdea({ status: 'test', gateA: { d: 'go' } });
  check('autoStatus never moves a live idea backwards', api.autoStatus(t) === 'test');
}

const card = name => '.icard:has(h4:text-is("' + name + '"))';
async function openStage(p, c, s) {
  const sel = c + ' details.stg[data-st="' + s + '"]';
  if (!(await p.$eval(sel, d => d.open))) await p.click(sel + ' > summary');
}
/* Fills stages 1-2 (keeps a price already entered), the FCA cost, the tick, then clicks Go at Gate A. */
async function passGateA(p, c, o) {
  o = o || {};
  await openStage(p, c, 1);
  await p.selectOption(c + ' [data-f="seen"]', 'amzus-ms');
  if (!(await p.inputValue(c + ' [data-f="link"]'))) await p.fill(c + ' [data-f="link"]', 'https://www.amazon.com/dp/example');
  await openStage(p, c, 2);
  await p.selectOption(c + ' [data-f="exists"]', 'yes');
  if (!(await p.inputValue(c + ' [data-f="price"]'))) await p.fill(c + ' [data-f="price"]', o.price || '24990');
  await p.fill(c + ' [data-f="listings"]', '40');
  await p.fill(c + ' [data-f="mkt.sold"]', 'top 3: 300+, 150+, 90+');
  await p.fill(c + ' [data-f="mkt.links"]', 'https://articulo.mercadolibre.cl/MLC-1');
  await p.fill(c + ' [data-f="mkt.direct"]', '17990');
  await p.selectOption(c + ' [data-f="mkt.reg"]', 'none');
  await p.selectOption(c + ' [data-f="mkt.fit"]', 'yes');
  await p.fill(c + ' [data-f="gateA.fca"]', o.fca || '2.5');
  await p.click(c + ' [data-f="gateA.tried"]');
  await p.click(c + ' [data-act="gate"][data-g="A"][data-d="go"]'); await wait(50);
}
async function supplierStage(p, c) {
  await p.click(c + ' [data-act="addsup"]');
  await p.fill(c + ' [data-f="sup.0.url"]', 'https://www.alibaba.com/product-detail/example');
  await p.fill(c + ' [data-f="sup.0.price"]', '3.2');
  await p.fill(c + ' [data-f="sup.0.moq"]', '200');
  for (const k of ['years', 'ta', 'rate', 'maker', 'sample', 'formF']) await p.click(c + ' [data-f="sup.0.' + k + '"]');
  await p.click(c + ' [data-act="addsup"]');
  await p.fill(c + ' [data-f="sup.1.url"]', 'https://www.alibaba.com/product-detail/other');
  await p.fill(c + ' [data-f="sup.1.price"]', '2.9');
  await p.fill(c + ' [data-f="sup.1.moq"]', '1000');
  await p.click(c + ' [data-act="pick"][data-n="0"]');
}

async function browser(br, base, errs, check, newPage) {
  const local = p => p.evaluate(() => JSON.parse(localStorage.getItem('importsim.v2.local') || 'null'));
  const idea = async (p, id) => (await local(p)).ideas.find(x => x.id === id || x.name === id);
  const active = p => p.evaluate(() => { const a = document.activeElement; return a && (a.getAttribute('data-f') || a.getAttribute('data-act') || a.tagName); });
  const api = load();

  console.log('Idea process (local build)');
  const p = await newPage(br, errs, 'ideas-local');
  await p.goto(base + '/dist/local.html'); await wait(200);
  const seed = { products: [api.seedProduct()], settings: JSON.parse(JSON.stringify(api.S.settings)), ideas: [OLD, PARTIAL], me: 'André' };
  delete seed.settings.gates; /* settings saved before this feature */
  await p.evaluate(d => { localStorage.setItem('importsim.v2.local', JSON.stringify(d)); localStorage.setItem('importsim.v2.ui', JSON.stringify({ view: 'ideas' })); }, seed);
  await p.reload(); await wait(300);
  const OC = card('Old grip'), PC = card('Partial lamp');
  check('old idea without new fields renders', (await p.$$(OC)).length === 1 && (await p.$$(PC)).length === 1);
  check('old idea: next step "say where you spotted it"', (await p.textContent(OC + ' .inext')) === 'Next: say where you spotted it', await p.textContent(OC + ' .inext'));
  check('old idea: strip shows stage 1 current, A and B gates open', (await p.$$eval(OC + ' .istrip li', l => l.map(x => x.className).join(','))) === 'cur,,gt ,lock,lock,gt ,lock',
    await p.$$eval(OC + ' .istrip li', l => l.map(x => x.className).join(',')));
  check('old idea: only the current stage is open', JSON.stringify(await p.$$eval(OC + ' details.stg', l => l.map(d => d.open))) === '[true,false,false,false,false]');
  check('old idea: market check shows "3 of 11 done"', (await p.textContent(OC + ' [data-live="h2"]')) === '3 of 11 done', await p.textContent(OC + ' [data-live="h2"]'));
  check('old checks shown as done (dots)', JSON.stringify(await p.$$eval(OC + ' [data-dot]', l => l.filter(d => d.classList.contains('ok')).map(d => d.getAttribute('data-dot')))) === '["exists","price","listings"]');
  check('progress pill replaces "x of 3 checks"', (await p.textContent(OC + ' .meta .pill')) === 'On paper: 3 of 13 steps', await p.textContent(OC + ' .meta .pill'));
  check('gate thresholds default for old settings', (await p.textContent('#gatesHint')) === 'price 3x FCA, margin 15%, ROAS up to 4');

  /* locking */
  check('Gate A Go disabled until stages 1-2 are done', await p.$eval(OC + ' [data-gogo="A"]', b => b.disabled));
  check('supplier, numbers and test stages locked', JSON.stringify(await p.$$eval(OC + ' fieldset.sb', l => l.map(f => f.disabled))) === '[false,false,true,true,true]');
  check('locked stage says what unlocks it', (await p.textContent(OC + ' [data-live="h3"]')) === 'Locked: needs Gate A' && (await p.textContent(OC + ' [data-live="h5"]')) === 'Locked: needs Gate B');
  check('"Create product" is disabled while locked', await p.$eval(OC + ' [data-act="tosim"]', b => b.matches(':disabled')));

  /* typing keeps focus and updates in place */
  await openStage(p, OC, 2);
  await p.click(OC + ' [data-f="mkt.sold"]');
  await p.keyboard.type('top 3 sold 500+', { delay: 15 });
  check('typing keeps focus in the field', (await active(p)) === 'mkt.sold' && (await p.inputValue(OC + ' [data-f="mkt.sold"]')) === 'top 3 sold 500+');
  check('dot and count update while typing', (await p.$eval(OC + ' [data-dot="sold"]', d => d.classList.contains('ok'))) && (await p.textContent(OC + ' [data-live="h2"]')) === '4 of 11 done');
  check('typed value saved', (await idea(p, 'i_old1')).mkt.sold === 'top 3 sold 500+');

  /* price multiple */
  await p.click(OC + ' [data-f="gateA.fca"]'); await p.keyboard.type('2', { delay: 15 });
  let mt = await p.textContent(OC + ' [data-live="multA"]');
  check('multiple shown while typing: 19.990 / (2 x 1.000) = 10.0x', mt.indexOf('10.0x') === 0 && mt.indexOf('Chile price incl. IVA $19.990') > 0 && mt.indexOf('Without IVA it is 8.4x') > 0 && (await active(p)) === 'gateA.fca', mt);
  await p.keyboard.type('0');
  mt = await p.textContent(OC + ' [data-live="multA"]');
  check('below the target the multiple turns red', mt.indexOf('1.0x') === 0 && (await p.$eval(OC + ' [data-live="multA"] .pill', e => e.classList.contains('neg'))), mt);
  check('meta pill shows the multiple', (await p.textContent(OC + ' .meta')).indexOf('Price 1.0x FCA') >= 0);
  await p.fill(OC + ' [data-f="gateA.fca"]', '');

  /* kill reason at a gate */
  await p.click(OC + ' [data-act="gate"][data-g="A"][data-d="nogo"]'); await wait(50);
  check('no-go at Gate A sets status discarded', (await p.inputValue(OC + ' [data-f="status"]')) === 'discarded' && (await idea(p, 'i_old1')).gateA.d === 'nogo');
  check('no-go focuses the reason field', (await active(p)) === 'gateA.why');
  check('next step asks for the kill reason', (await p.textContent(OC + ' .inext')) === 'Next: write why it was dropped');
  await p.keyboard.type('Needs SEC certificate', { delay: 10 });
  check('kill reason shown on the card while typing', (await p.textContent(OC + ' .ikill')) === 'Dropped at Gate A: Needs SEC certificate' && (await active(p)) === 'gateA.why');
  check('strip marks the stop', (await p.$$eval(OC + ' .istrip li', l => l.map(x => x.className).join(','))) === ',stop,gt stop,lock,lock,gt ,lock');

  /* kill reason when discarded by status */
  await p.selectOption(PC + ' [data-f="status"]', 'discarded');
  check('discarding by status asks why and focuses it', (await active(p)) === 'kill' && (await p.isVisible(PC + ' .ikill [data-f="kill"]')));
  await p.keyboard.type('Too many sellers');
  check('kill reason stored', (await idea(p, 'i_part1')).kill === 'Too many sellers');

  /* full walk on a new idea */
  await p.fill('#ideaName', 'Bike phone mount'); await p.selectOption('#ideaSeen', 'mlcl'); await p.fill('#ideaLink', 'https://tendencias.mercadolibre.cl/');
  await p.click('button[data-act="add"]'); await wait(50);
  const NC = card('Bike phone mount');
  check('new idea with source starts at Market check', (await p.$$eval(NC + ' details.stg', l => l.map(d => d.open).join())) === 'false,true,false,false,false');
  await passGateA(p, NC, { fca: '2.5' });
  let ni = await idea(p, 'Bike phone mount');
  check('Gate A go: stored, status investigating', ni.gateA.d === 'go' && ni.status === 'investigating' && ni.gateA.tried === true, ni.gateA);
  check('Gate A go: supplier stage unlocked and open, market folded', JSON.stringify(await p.$$eval(NC + ' details.stg', l => l.map(d => d.open))) === '[false,false,true,false,false]' &&
    JSON.stringify(await p.$$eval(NC + ' fieldset.sb', l => l.map(f => f.disabled))) === '[false,false,false,false,true]');
  check('Gate B Go disabled before supplier and numbers', await p.$eval(NC + ' [data-gogo="B"]', b => b.disabled));
  await supplierStage(p, NC);
  ni = await idea(p, 'Bike phone mount');
  check('suppliers stored with ticks and choice', ni.sup.length === 2 && ni.supPick === 0 && ni.sup[0].formF === true && ni.sup[0].reviews === false && ni.sup[1].moq === '1000');
  check('supplier summary', (await p.textContent(NC + ' [data-live="sup0"]')) === 'US$3.20 · MOQ 200 · 6 of 7 checks');
  check('next step: create the product', (await p.textContent(NC + ' .inext')) === 'Next: create the product in the simulator');
  await p.click(NC + ' .inext'); await wait(50);
  check('"Next" opens the stage and focuses the step', (await active(p)) === 'tosim');
  await p.click(NC + ' [data-act="tosim"]'); await wait(150);
  const d1 = await local(p), prod = d1.products.find(x => x.name === 'Bike phone mount');
  check('product takes the chosen supplier price and the Chile price', prod && prod.sim.price === '3.2' && prod.pl.rrp === '24990' && !(prod.unconf || {})['s.price'], prod && [prod.sim.price, prod.pl.rrp]);
  await p.click('[data-view="ideas"]'); await wait(100);
  const num = await p.textContent(NC + ' [data-live="num"]');
  check('numbers from the simulator shown with thresholds', /^Net margin -?\d+\.\d% (meets|below) your 15%Break-even ROAS (\d+\.\d|none) /.test(num), num);
  check('stage 4 still open after the round trip', await p.$eval(NC + ' details.stg[data-st="4"]', d => d.open));
  await p.click(NC + ' [data-f="gateB.tried"]');
  await p.click(NC + ' [data-act="gate"][data-g="B"][data-d="go"]'); await wait(50);
  ni = await idea(p, 'Bike phone mount');
  check('Gate B go: status test, snapshot of margin and ROAS', ni.gateB.d === 'go' && ni.status === 'test' && /^-?\d+\.\d$/.test(ni.gateB.m) && ni.gateB.r !== '', ni.gateB);
  check('test stage open and unlocked', await p.$eval(NC + ' details.stg[data-st="5"]', d => d.open && !d.querySelector('fieldset').disabled));
  await p.click(NC + ' [data-f="test.sample"]');
  await p.selectOption(NC + ' [data-f="test.quality"]', 'ok');
  await p.click(NC + ' [data-f="test.ship"]');
  await p.fill(NC + ' [data-f="test.units"]', '40'); await p.fill(NC + ' [data-f="test.sold"]', '30'); await p.fill(NC + ' [data-f="test.ret"]', '2');
  check('sell-through shown', (await p.textContent(NC + ' [data-live="sell"]')) === 'Sold 30 of 40 (75.0%), returned 2 (6.7% of sold).');
  check('all five stages done', (await p.textContent(NC + ' .inext')) === 'All five stages done. Decide whether to order more.' && (await p.textContent(NC + ' .meta .pill')) === 'Test done');

  /* reload */
  await p.reload(); await wait(300);
  check('after reload: walked idea keeps every stage', (await p.$$eval(NC + ' .istrip li', l => l.map(x => x.className).join(','))) === 'done,done,gt done,done,done,gt done,done');
  check('after reload: kill reasons still on the cards', (await p.textContent(OC + ' .ikill')) === 'Dropped at Gate A: Needs SEC certificate' && (await p.inputValue(PC + ' [data-f="kill"]')) === 'Too many sellers');
  check('after reload: typed and nested values back in the fields', (await p.inputValue(OC + ' [data-f="mkt.sold"]')) === 'top 3 sold 500+' && (await p.inputValue(NC + ' [data-f="sup.1.price"]')) === '2.9' &&
    (await p.$eval(NC + ' [data-f="sup.0.formF"]', e => e.checked)));
  check('status filter still works', await (async () => { await p.selectOption('#fStatus', 'discarded'); await wait(50); const n = (await p.$$('.icard')).length; await p.selectOption('#fStatus', ''); return n === 2; })());
  await p.context().close();

  console.log('Idea process (shared mode)');
  const s = await newPage(br, errs, 'ideas-shared');
  await s.goto(base + '/'); await wait(300);
  await s.click('#gateIn'); await wait(600);
  await s.click('[data-view="ideas"]'); await wait(150);
  await s.fill('#ideaName', 'Cable organiser'); await s.click('button[data-act="add"]'); await wait(100);
  const SC = card('Cable organiser');
  await passGateA(s, SC);
  await s.click(SC + ' [data-act="addsup"]'); await s.fill(SC + ' [data-f="sup.0.price"]', '1.1'); await s.click(SC + ' [data-f="sup.0.ta"]');
  await wait(900);
  const st = Object.values(await s.evaluate(k => window.__fbstore[k] || {}, 'workspaces/andre-agustin/ideas')).find(x => x.name === 'Cable organiser');
  check('shared: nested idea data written', st && st.gateA.d === 'go' && st.mkt.reg === 'none' && st.sup.length === 1 && st.sup[0].ta === true && st.sup[0].price === '1.1' && st.supPick === -1, st);
  check('shared: idea doc stays small', JSON.stringify(st).length < 3000, JSON.stringify(st).length);
  await s.evaluate(() => { window.__writes = 0; }); await wait(900);
  check('shared: no write loop after the echo', (await s.evaluate(() => window.__writes)) === 0);
  await s.context().close();
}

module.exports = { node, browser, card, openStage, passGateA, supplierStage };
