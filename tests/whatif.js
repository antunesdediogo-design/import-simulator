/* What if tab tests, required by tests/run.js. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = path.resolve(__dirname, '..', 'src');
const wait = ms => new Promise(r => setTimeout(r, ms));

function load() {
  const code = ['core.js', 'util.js', 'state.js', 'whatif.js'].map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('');
  return vm.runInNewContext("(function () {\n  'use strict';\n" + code +
    "\nreturn { S: S, recompute: recompute, cache: function () { return CACHE; }, wiGrid: wiGrid, wiScenarios: wiScenarios };\n})()",
    { document: { addEventListener: function () {} } });
}

function node(check) {
  console.log('What if (Node, src/whatif.js)');
  const api = load();
  api.recompute();
  const p = api.S.products[0], before = JSON.stringify(api.S);
  const c = api.cache()[p.id];
  const sc = api.wiScenarios(p, api.S.products, api.S.settings);
  const [w, e, b] = sc.cols;
  check('scenario order worst <= expected <= best', w.profit <= e.profit && e.profit <= b.profit, [w.profit, e.profit, b.profit]);
  check('expected equals calcPL result', e.profit === c.pl.profit && e.margin === c.pl.margin && e.perUnitNet === c.r.perUnitNet, [e.profit, c.pl.profit]);
  check('worst uses general duty, best Form F', w.dutyMode === 'general' && w.duty === 6 && b.duty === 0, [w.dutyMode, w.duty, b.duty]);
  check('ranges: fx +/-10%, returns 3 -> 4.5 / 1.5, ROAS 12 -> 9 / 15',
    w.fx === 1100 && b.fx === 900 && w.returns === 4.5 && b.returns === 1.5 && w.roas === 9 && b.roas === 15, [w.fx, b.fx, w.returns, b.returns, w.roas, b.roas]);
  const g = api.wiGrid(p, api.S.products, api.S.settings);
  const curCells = [].concat.apply([], g.rows.map(r => r.cells)).filter(x => x.current);
  check('grid has one current cell equal to current profit', curCells.length === 1 && curCells[0].profit === c.pl.profit, curCells.map(x => x.profit));
  check('grid prices end in 990 (current price kept)', g.prices.every(x => x === g.rrp || x % 1000 === 990), g.prices);
  check('what-if does not change S', JSON.stringify(api.S) === before);
}

async function browser(br, base, errs, check, newPage) {
  console.log('What if tab (dist/local.html)');
  const p = await newPage(br, errs, 'whatif');
  await p.goto(base + '/dist/local.html'); await wait(300);
  await p.click('[data-tab="whatif"]'); await wait(150);
  const h = await p.$$eval('#view .card h3', e => e.map(x => x.textContent));
  check('tab renders both cards', JSON.stringify(h) === JSON.stringify(['Price and ad spend sweet spot', 'Scenarios']), h);
  check('one current cell outlined', (await p.$$('#view td.wi-cur')).length === 1);
  const btn = await p.$('#view td:not(.wi-cur) button[data-wi-cell]');
  const [pr, ro] = (await btn.getAttribute('data-wi-cell')).split('|');
  await btn.click(); await wait(100);
  check('cell click asks to confirm', !(await p.$eval('#modal', e => e.hidden)) && /^Use price /.test(await p.textContent('#modalText')));
  await p.click('#modalYes'); await wait(200);
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('importsim.v2.local')).products[0].pl);
  check('confirm applies price and ROAS', st.rrp === pr && st.roas === ro, [st.rrp, st.roas, pr, ro]);
  check('new cell is now current', (await p.getAttribute('#view td.wi-cur button', 'data-wi-cell')) === pr + '|' + ro);
  await p.click('#view details.adv > summary');
  await p.fill('[data-wi-scen="fx"]', '20'); await p.press('[data-wi-scen="fx"]', 'Tab'); await wait(200);
  const sc = await p.evaluate(() => JSON.parse(localStorage.getItem('importsim.v2.local')).settings.scen);
  check('range edit stored in settings.scen', sc && sc.fx === '20', sc);
  await p.context().close();
}

module.exports = { node, browser };
