/* Node tests for src/optimizer.js (container mix optimizer). Loaded by tests/run.js. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = path.join(__dirname, '..', 'src');

function loadOpt() {
  const code = ['core.js', 'optimizer.js'].map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('');
  return vm.runInNewContext("(function () {\n  'use strict';\n" + code + "\nreturn { optimizeMix: optimizeMix, mixEval: mixEval };\n})()", {});
}

const MK = { id: 'ml', name: 'Mercado Libre', commission: 12, fixed: 0, ship: 3050, shipMin: 19990 };
const PL = { rrp: '0', mk: 'ml', roas: '8', returns: '3', target: '20', days: '1', full: false, fullSize: 'S', fullIn: '0' };
function prod(id, o) {
  const sim = Object.assign({ qty: '100', price: '5', kgu: '0.2', rate: '10', origin: '0', insp: '1', duty: '6', agent: '0', dep: '30',
    cl: '40', cw: '30', ch: '30', upc: '20', vdiv: '6000', lcl: true, maxUnits: '' }, o.sim);
  return { id: id, name: id, sim: sim, pl: Object.assign({}, PL, o.pl) };
}
function ctx(products, budget) {
  return { products: products, cfg: { on: true, rate: '120', min: '1', agent: '200', split: 'space' }, fx: '950', mk: () => MK, budget: budget };
}

module.exports = function run(check) {
  console.log('Mix optimizer (Node, src/optimizer.js)');
  const O = loadOpt();
  const ps = [
    prod('a', { sim: { qty: '100', price: '5', upc: '20', maxUnits: '400' }, pl: { rrp: '19990' } }),
    prod('b', { sim: { qty: '50', price: '12', cl: '50', cw: '40', ch: '30', upc: '10', maxUnits: '205' }, pl: { rrp: '39990' } }),
    prod('c', { sim: { qty: '60', price: '3', upc: '30', maxUnits: '' }, pl: { rrp: '9990' } }),
    prod('off', { sim: { qty: '999', lcl: false, maxUnits: '5000' }, pl: { rrp: '19990' } })
  ];
  const R = O.optimizeMix(ctx(ps, '2000'));
  const q = R.best.qty;
  check('optimizer: goods within budget', R.best.goods <= 2000 + 1e-9, R.best.goods);
  check('optimizer: max units respected', q.a <= 400 && q.b <= 205, q);
  check('optimizer: whole cartons', q.a % 20 === 0 && q.b % 10 === 0, q);
  check('optimizer: profit >= current mix', R.best.profit >= R.current.profit - 1e-6, [R.best.profit, R.current.profit]);
  check('optimizer: blank max stays fixed', q.c === 60 && R.items.find(i => i.id === 'c').fixed, q);
  check('optimizer: product not in shipment ignored', q.off === undefined && !R.items.some(i => i.id === 'off'), Object.keys(q));
  const chk = O.mixEval(ctx(ps, '2000'), q);
  check('optimizer: result matches real calc', Math.abs(chk.profit - R.best.profit) < 1e-6);

  const U = O.optimizeMix(ctx(ps, ''));
  check('optimizer: no budget, still within max and >= current', U.best.qty.a <= 400 && U.best.qty.b <= 205 && U.best.profit >= U.current.profit - 1e-6, U.best.qty);
  check('optimizer: better with no budget than with budget', U.best.profit >= R.best.profit - 1e-6);

  /* every unit loses money: price above what it sells for */
  const bad = [prod('x', { sim: { qty: '40', price: '50', maxUnits: '200' }, pl: { rrp: '9990' } }), prod('y', { sim: { qty: '40', price: '40', maxUnits: '100' }, pl: { rrp: '9990' } })];
  const L = O.optimizeMix(ctx(bad, ''));
  check('optimizer: losing products flagged noProfit', L.noProfit === true);
  check('optimizer: losing mix is never worse than current', L.best.profit >= L.current.profit - 1e-6, [L.best.profit, L.current.profit]);

  /* speed with 6 products, ML Full on (slow fullCost path) */
  const six = [];
  for (let i = 0; i < 6; i++) six.push(prod('s' + i, { sim: { qty: String(40 + 20 * i), price: String(3 + i * 2), upc: String([1, 10, 20, 12, 6, 24][i]), maxUnits: String(300 + 100 * i) }, pl: { rrp: String(14990 + 5000 * i), full: i % 2 === 0, days: '2' } }));
  const t0 = Date.now(), F = O.optimizeMix(ctx(six, '6000')), ms = Date.now() - t0;
  check('optimizer: 6 products under 200 ms', ms < 200, { ms: ms, evals: F.evals });
  check('optimizer: 6 products within budget and >= current', F.best.goods <= 6000 + 1e-9 && F.best.profit >= F.current.profit - 1e-6);
};
