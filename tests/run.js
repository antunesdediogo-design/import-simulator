#!/usr/bin/env node
/* Test runner: node tests/run.js
   - Builds dist/local.html (python3 build.py --local) and checks index.html is built from the current src.
   - Golden numbers: loads src/core.js + util.js + state.js in Node (vm) and checks the seeded product's
     calculations against fixed values captured from the original single-file page (Nov 2026).
   - Local build in the browser: KPI texts for the seeded product.
   - Shared mode (index.html) with tests/fbmock.js in place of Firebase: login gate, sign-in, sync,
     profiles, ideas, sign-out, access denied, pre-existing data loads with 0 writes.
   - No uncaught page errors.
   Exits non-zero on any failure. Needs Playwright with Chromium (global install is fine). */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), vm = require('vm');
const { execSync } = require('child_process');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { ({ chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'))); }

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const MOCK = fs.readFileSync(path.join(__dirname, 'fbmock.js'), 'utf8');
const ANDRE = 'antunes.de.diogo@gmail.com', AGUSTIN = 'agustin.oelckers@gmail.com';
const ITEMS = p => 'workspaces/andre-agustin/profiles/' + p + '/items';
const IDEAS = 'workspaces/andre-agustin/ideas';

let fails = 0, passes = 0;
function check(name, ok, info) {
  if (ok) { passes++; console.log('  ok   ' + name); }
  else { fails++; console.log('  FAIL ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : '')); }
}
function near(a, b) { return a === b || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b))); }

/* ---------- golden values (captured from the original index.html, commit 9b1da86) ---------- */
const GOLDEN = {"seedSea":{"r":{"qty":30,"goods":630,"cbm":0.027,"chargeable":6,"freight":350,"ins":6.3,"cif":986.3,"duty":0,"iva":187.397,"agent":0,"total":1173.697,"net":986.3,"perUnitNet":32.876666666666665},"pl":{"netRev":42008.40336134454,"comm":5998.8,"ship":3050,"ret":1260.2521008403362,"landed":32876.666666666664,"ads":4165.833333333333,"fullTotal":0,"profit":-5343.148739495792,"margin":-0.12719237847569498,"beRoas":null,"tRrp":80965.97437030489,"ivaPay":15.757971988790814},"billed":1},
  "seedAir":{"r":{"qty":30,"goods":630,"cbm":0.027,"chargeable":6,"freight":60,"ins":6.3,"cif":696.3,"duty":0,"iva":132.297,"agent":150,"total":978.597,"net":846.3,"perUnitNet":28.209999999999997},"pl":{"netRev":42008.40336134454,"comm":5998.8,"ship":3050,"ret":1260.2521008403362,"landed":28209.999999999996,"ads":4165.833333333333,"fullTotal":0,"profit":-676.4820728291243,"margin":-0.016103494032139582,"beRoas":14.326445309715389,"tRrp":70448.96155545734,"ivaPay":1852.4246386554578},"billed":0},
  "seedSeaFullGeneralDuty":{"r":{"qty":30,"goods":630,"cbm":0.027,"chargeable":6,"freight":350,"ins":6.3,"cif":986.3,"duty":59.178,"iva":198.64082000000002,"agent":0,"total":1244.1188200000001,"net":1045.478,"perUnitNet":34.84926666666667},"pl":{"netRev":42008.40336134454,"comm":5998.8,"ship":3050,"ret":1260.2521008403362,"landed":34849.26666666667,"ads":4165.833333333333,"fullTotal":38.595,"profit":-7354.343739495799,"margin":-0.17506839467893578,"beRoas":null,"tRrp":85498.49513919576,"ivaPay":-366.3690780112088},"billed":1}};
const GOLDEN_KPIS = [
  ['Net cost per unit', 'US$32.88', '$32.877 · IVA credit excluded'],
  ['Profit per unit', '-$5.343', '-12.7% margin on net sales'],
  ['Cash for this order', 'US$1,173.70', 'US$187.40 of it is IVA you get back as credit'],
  ['Total result, 30 units', '-$160.294', 'about 30 days to sell all']
];
const GOLDEN_HINTS = ['US$630.00', 'Sea · 0.027 m³', 'Mercado · $49.990', '1 US$ = 1.000 CLP'];

/* Load core + util + state in one scope, as the page does, with a stub document (no localStorage: seed state). */
function loadCalc() {
  const code = ['core.js', 'util.js', 'state.js'].map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('');
  return vm.runInNewContext("(function () {\n  'use strict';\n" + code +
    "\nreturn { S: S, recompute: recompute, cache: function () { return CACHE; }, lcl: function () { return LCL; }, normProduct: normProduct, normSettings: normSettings, seedProduct: seedProduct };\n})()",
    { document: { addEventListener: function () {} } });
}

function goldenNode() {
  console.log('Golden numbers (Node, src/core.js)');
  const api = loadCalc();
  function cmp(label) {
    api.recompute();
    const c = api.cache()[api.S.products[0].id], g = GOLDEN[label];
    const bad = [];
    Object.keys(g.r).forEach(k => { if (!near(c.r[k], g.r[k])) bad.push(['r.' + k, c.r[k], g.r[k]]); });
    Object.keys(g.pl).forEach(k => { if (!near(c.pl[k], g.pl[k])) bad.push(['pl.' + k, c.pl[k], g.pl[k]]); });
    if (!near(api.lcl().billed, g.billed)) bad.push(['billed', api.lcl().billed, g.billed]);
    check(label, bad.length === 0, bad);
  }
  cmp('seedSea');
  const p = api.S.products[0];
  p.sim.lcl = false; cmp('seedAir');
  p.sim.lcl = true; p.pl.full = true; p.pl.days = '3'; p.sim.dutyMode = 'general'; p.sim.duty = '6'; cmp('seedSeaFullGeneralDuty');
}

function inlineScript(html) { const i = html.lastIndexOf('<script>\n(function () {'); return html.slice(i, html.lastIndexOf('</script>')); }

function serve() {
  return new Promise(res => {
    const srv = http.createServer((q, s) => {
      const u = decodeURIComponent(q.url.split('?')[0]);
      const f = path.join(ROOT, u === '/' ? 'index.html' : u);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); s.end(); return; }
      s.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
      s.end(fs.readFileSync(f));
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}

const wait = ms => new Promise(r => setTimeout(r, ms));

async function newPage(browser, errs, tag) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(tag + ': ' + e.message));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.route('**/firebasejs/**', r => r.request().url().includes('app-compat')
    ? r.fulfill({ contentType: 'application/javascript', body: MOCK })
    : r.fulfill({ contentType: 'application/javascript', body: '' }));
  return p;
}
async function openGroup(p, g) {
  if (!(await p.$eval('details.grp[data-g="' + g + '"]', d => d.open))) await p.click('details.grp[data-g="' + g + '"] > summary');
}
const hidden = (p, sel) => p.$eval(sel, e => e.hidden);
const store = (p, fn, arg) => p.evaluate(fn, arg);

async function localBuild(browser, base, errs) {
  console.log('Local build (dist/local.html)');
  const p = await newPage(browser, errs, 'local');
  await p.goto(base + '/dist/local.html'); await wait(300);
  check('no login gate in local mode', await hidden(p, '#gate'));
  check('status "Saved in this browser"', (await p.textContent('#status')) === 'Saved in this browser');
  const kp = await p.$$eval('#kpis .kpi', els => els.map(e => [e.querySelector('.l').textContent, e.querySelector('.v').textContent, e.querySelector('.s').textContent]));
  check('KPI texts match golden', JSON.stringify(kp) === JSON.stringify(GOLDEN_KPIS), kp);
  const hints = await p.$$eval('#form .hint', e => e.map(x => x.textContent));
  check('form group hints match golden', JSON.stringify(hints) === JSON.stringify(GOLDEN_HINTS), hints);
  await p.context().close();
}

async function mixBrowser(browser, base, errs) {
  console.log('Mix optimizer card (dist/local.html)');
  const p = await newPage(browser, errs, 'mix');
  await p.goto(base + '/dist/local.html'); await wait(300);
  await p.click('[data-tab="ship"]'); await wait(150);
  check('mix card renders', (await p.textContent('#view')).indexOf('Best mix for this shipment') >= 0);
  check('blank max shown as fixed', (await p.textContent('.mix tbody')).indexOf('fixed') >= 0);
  await p.fill('[data-maxu="p_seed"]', '1000'); await p.press('[data-maxu="p_seed"]', 'Enter'); await wait(300);
  const btn = await p.$('[data-mixapply]');
  check('Apply button shown after entering a max', !!btn);
  const sug = await p.$eval('.mix tbody tr td:nth-child(4) b', e => e.textContent);
  if (btn) { await btn.click(); await wait(100); await p.click('#modalYes'); await wait(300); }
  await openGroup(p, 0);
  const q = await p.inputValue('[data-k="s.qty"]');
  check('Apply sets the suggested quantity', q === sug && q !== '30', [q, sug]);
  check('no Apply button once applied', !(await p.$('[data-mixapply]')));
  await p.context().close();
}

async function shared(browser, base, errs) {
  console.log('Shared mode (index.html + fbmock)');
  const p = await newPage(browser, errs, 'shared');
  await p.goto(base + '/'); await wait(300);
  check('login gate visible before sign-in', !(await hidden(p, '#gate')) && !(await hidden(p, '#gateIn')));
  await p.click('#gateIn'); await wait(500);
  check('sign in as André opens the app', await hidden(p, '#gate'));
  check('header shows André', (await p.textContent('#hdrUser')) === 'Signed in as André');
  check('badge "Saved, shared"', (await p.textContent('#status')) === 'Saved, shared', await p.textContent('#status'));
  check('André profile selected', (await p.getAttribute('#who .seg button[aria-checked="true"]', 'data-prof')) === 'andre');
  check('seed written to André store', await store(p, k => !!(window.__fbstore[k] || {}).p_seed, ITEMS('andre')));

  await openGroup(p, 0);
  await p.fill('[data-k="s.qty"]', '77'); await wait(1000);
  const a = await store(p, k => window.__fbstore[k].p_seed, ITEMS('andre'));
  check('quantity edit stored', a.sim.qty === '77', a.sim.qty);
  check('updatedBy "André"', a.updatedBy === 'André', a.updatedBy);
  check('last edit line shows André', /^Last edit by André, /.test(await p.textContent('#lastEdit')));

  await p.click('#who .seg button[data-prof="agustin"]'); await wait(500);
  check('Agustín profile shows seed (qty 30)', (await p.inputValue('[data-k="s.qty"]')) === '30');
  check('André data untouched', (await store(p, k => window.__fbstore[k].p_seed.sim.qty, ITEMS('andre'))) === '77');
  await p.click('#who .seg button[data-prof="andre"]'); await wait(400);
  check('back to André shows 77', (await p.inputValue('[data-k="s.qty"]')) === '77');

  await p.click('[data-view="ideas"]'); await wait(200);
  await p.fill('#ideaName', 'Silicone phone grip'); await p.click('button[data-act="add"]'); await wait(900);
  const ideas = await store(p, k => Object.values(window.__fbstore[k] || {}).map(i => i.name + '|' + i.author), IDEAS);
  check('idea stored with author', ideas.length === 1 && ideas[0] === 'Silicone phone grip|André', ideas);

  await p.click('#btnOut'); await wait(300);
  check('sign out shows gate', !(await hidden(p, '#gate')) && !(await hidden(p, '#gateIn')));

  await p.evaluate(() => { window.__mockEmail = 'stranger@gmail.com'; });
  await p.click('#gateIn'); await wait(300);
  const msg = await p.textContent('#gateMsg');
  check('non-allowed email gets "does not have access"', !(await hidden(p, '#gate')) && msg.indexOf('stranger@gmail.com does not have access') === 0, msg);
  check('denied: sign-out button shown', !(await hidden(p, '#gateOut')));
  await p.context().close();
}

async function preexisting(browser, base, errs) {
  console.log('Pre-existing data (shared mode)');
  const api = loadCalc();
  /* Stored products include p_seed, as in the live store. (A store without p_seed gets the placeholder seed
     product added and written on first open: existing behaviour, not covered here.) */
  const prod = api.seedProduct(); prod.name = 'Stored pump'; prod.sim.qty = '64';
  const doc = JSON.parse(JSON.stringify(Object.assign(api.normProduct(prod), { updatedBy: 'Agustín', updatedAt: 1762900000000 })));
  const prod2 = api.seedProduct(); prod2.id = 'p_stored2'; prod2.name = 'Second product'; prod2.created = 5; prod2.sim.qty = '12';
  const doc2 = JSON.parse(JSON.stringify(Object.assign(api.normProduct(prod2), { updatedBy: 'André', updatedAt: 1762900000000 })));
  const settings = JSON.parse(JSON.stringify(api.normSettings()));
  const idea = { id: 'i_stored1', name: 'Old idea', link: '', notes: '', author: 'Agustín', created: 1762900000000, updated: 1762900000000, editedBy: '', status: 'idea', exists: 'unknown', price: '', listings: '' };
  const p = await newPage(browser, errs, 'preexisting');
  await p.goto(base + '/'); await wait(300);
  await p.evaluate(([k, ik, doc, doc2, settings, idea]) => {
    const s = window.__fbstore; s[k] = { [doc.id]: doc, [doc2.id]: doc2, settings: settings }; s[ik] = { [idea.id]: idea }; window.__writes = 0;
  }, [ITEMS('andre'), IDEAS, doc, doc2, settings, idea]);
  await p.click('#gateIn'); await wait(700);
  const names = await p.$$eval('#plist .nm', e => e.map(x => x.textContent));
  check('stored products listed', JSON.stringify(names) === JSON.stringify(['Stored pump', 'Second product']), names);
  await openGroup(p, 0);
  check('stored quantity shown', (await p.inputValue('[data-k="s.qty"]')) === '64');
  check('last edit by Agustín shown', /^Last edit by Agustín, /.test(await p.textContent('#lastEdit')));
  for (const t of ['cost', 'pl', 'channels', 'ship', 'overview']) { await p.click('[data-tab="' + t + '"]'); await wait(80); }
  await p.click('[data-view="ideas"]'); await wait(200);
  check('stored idea shown', (await p.textContent('#appIdeas')).indexOf('Old idea') >= 0);
  await p.click('[data-view="sim"]'); await wait(900);
  check('0 writes after viewing', (await p.evaluate(() => window.__writes)) === 0, await p.evaluate(() => window.__writes));
  check('badge "Saved, shared"', (await p.textContent('#status')) === 'Saved, shared');
  await p.context().close();
}

(async () => {
  const t0 = Date.now();
  execSync('python3 build.py --local', { cwd: ROOT, stdio: 'ignore' });
  console.log('Build');
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), loc = fs.readFileSync(path.join(ROOT, 'dist', 'local.html'), 'utf8');
  check('index.html script matches src (run python3 build.py if not)', inlineScript(idx) === inlineScript(loc));
  check('index.html has build stamp', /<meta name="build" content="\d{4}-\d\d-\d\d \d\d:\d\d UTC[^"]*">/.test(idx));
  check('local build has no Firebase config', loc.indexOf('FIREBASE_CONFIG =') < 0 && loc.indexOf('firebasejs') < 0);

  goldenNode();
  require('./optimizer.test.js')(check);
  const srv = await serve(), base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch();
  const errs = [];
  try {
    await localBuild(browser, base, errs);
    await mixBrowser(browser, base, errs);
    await shared(browser, base, errs);
    await preexisting(browser, base, errs);
  } catch (e) { check('runner exception', false, String(e && e.stack || e)); }
  console.log('Page errors');
  check('no uncaught page errors', errs.length === 0, errs);
  await browser.close(); srv.close();
  console.log('\n' + passes + ' passed, ' + fails + ' failed, ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  process.exit(fails ? 1 : 0);
})();
