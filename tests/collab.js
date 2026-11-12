/* Tests for idea to product, change history, guessed inputs and the placeholder fix. Required by tests/run.js. */
'use strict';
const ANDRE = 'antunes.de.diogo@gmail.com', AGUSTIN = 'agustin.oelckers@gmail.com';

module.exports = async function collabTests(h) {
  const { browser, base, errs, check, newPage, openGroup, wait, loadCalc, ITEMS, IDEAS } = h;
  const local = p => p.evaluate(() => JSON.parse(localStorage.getItem('importsim.v2.local') || 'null'));
  const store = (p, k) => p.evaluate(k => window.__fbstore[k] || {}, k);
  const activeName = p => p.textContent('#plist .pitem[aria-current="true"] .nm');
  async function addIdea(p, name, link, notes, price) {
    await p.click('[data-view="ideas"]'); await wait(150);
    await p.fill('#ideaName', name); await p.fill('#ideaLink', link); await p.fill('#ideaNotes', notes);
    await p.click('button[data-act="add"]'); await wait(150);
    const card = '.icard:has(h4:text-is("' + name + '"))';
    await p.fill(card + ' [data-f="price"]', price); await wait(100);
    return card;
  }
  async function edit(p, k, v) { await p.fill('[data-k="' + k + '"]', v); await p.press('[data-k="' + k + '"]', 'Tab'); await wait(30); }

  console.log('Idea to product (local build)');
  {
    const p = await newPage(browser, errs, 'idea-local');
    await p.goto(base + '/dist/local.html'); await wait(300);
    const card = await addIdea(p, 'Bottle cage', 'https://example.com/cage', 'Cheap on Alibaba', '24.990');
    check('idea card shows "Create product in simulator"', (await p.textContent(card + ' [data-act="tosim"]')) === 'Create product in simulator');
    await p.click(card + ' [data-act="tosim"]'); await wait(200);
    check('switched to the simulator', !(await p.$eval('#appSim', e => e.hidden)));
    check('new product is active', (await activeName(p)) === 'Bottle cage', await activeName(p));
    check('toast shown', (await p.textContent('#toast')) === 'Product created from the idea');
    const d = await local(p), prod = d.products.find(x => x.name === 'Bottle cage'), idea = d.ideas.find(x => x.name === 'Bottle cage');
    check('product fields from the idea', prod && prod.notes === 'Cheap on Alibaba' && prod.links.length === 1 && prod.links[0].url === 'https://example.com/cage' && prod.pl.rrp === '24990' && prod.fromIdea === idea.id, prod);
    check('idea set to test with productId and profile "local"', idea.status === 'test' && idea.productId === prod.id && idea.productProfile === 'local', idea);
    await p.click('#plist .pitem'); await wait(100);
    await p.click('[data-view="ideas"]'); await wait(150);
    check('button now reads "Open product"', (await p.textContent(card + ' [data-act="tosim"]')) === 'Open product');
    await p.click(card + ' [data-act="tosim"]'); await wait(200);
    const d2 = await local(p);
    check('"Open product" navigates without creating', (await activeName(p)) === 'Bottle cage' && d2.products.length === 2 && !(await p.$eval('#appSim', e => e.hidden)), d2.products.length);
    await p.context().close();
  }

  console.log('Idea to product (shared mode)');
  {
    const p = await newPage(browser, errs, 'idea-shared');
    await p.goto(base + '/'); await wait(300);
    await p.click('#gateIn'); await wait(600);
    const card = await addIdea(p, 'Chain cleaner', 'not a link', 'Ask supplier', 'n/a');
    await p.click(card + ' [data-act="tosim"]'); await wait(1000);
    const items = await store(p, ITEMS('andre')), ideas = await store(p, IDEAS);
    const idea = Object.values(ideas).find(x => x.name === 'Chain cleaner'), prod = Object.values(items).find(x => x.name === 'Chain cleaner');
    check('product written to André profile with fromIdea', prod && prod.fromIdea === idea.id && prod.links.length === 0 && prod.pl.rrp === '0' && prod.notes === 'Ask supplier', prod);
    check('idea written with status test, productId, productProfile andre', idea.status === 'test' && idea.productId === prod.id && idea.productProfile === 'andre', idea);
    await p.click('#who .seg button[data-prof="agustin"]'); await wait(500);
    await p.click('[data-view="ideas"]'); await wait(150);
    check('in Agustín profile the button offers to create', (await p.textContent(card + ' [data-act="tosim"]')) === 'Create product in simulator');
    await p.context().close();
  }

  console.log('Change history');
  {
    const p = await newPage(browser, errs, 'history-local');
    await p.goto(base + '/dist/local.html'); await wait(300);
    await openGroup(p, 0);
    await p.fill('[data-k="s.qty"]', '45'); await wait(50);
    check('no entry while typing (before change)', !((await local(p)).products[0].history));
    await p.press('[data-k="s.qty"]', 'Tab'); await wait(50);
    let hs = (await local(p)).products[0].history;
    check('entry on change: by André, 30 -> 45', hs && hs.length === 1 && hs[0].k === 's.qty' && hs[0].by === 'André' && hs[0].from === '30' && hs[0].to === '45' && hs[0].label === 'Quantity', hs);
    await edit(p, 's.qty', '100');
    hs = (await local(p)).products[0].history;
    check('second edit within 5 min coalesced, original from kept', hs.length === 1 && hs[0].from === '30' && hs[0].to === '100', hs);
    await p.click('#histGrp > summary'); await wait(50);
    const li = await p.textContent('#histList li');
    check('history line text', /^\d{1,2} \w{3}, \d\d:\d\d · André · Quantity: 30 → 100$/.test(li), li);
    await p.click('[data-view="ideas"]'); await p.click('[data-act="me"][data-who="Agustín"]'); await p.click('[data-view="sim"]'); await wait(100);
    await openGroup(p, 0);
    await edit(p, 's.qty', '110');
    hs = (await local(p)).products[0].history;
    check('other person gets a new entry', hs.length === 2 && hs[0].by === 'Agustín' && hs[0].from === '100' && hs[0].to === '110', hs);
    for (let i = 0; i < 25; i++) await edit(p, i % 2 ? 's.qty' : 's.price', String(200 + i));
    hs = (await local(p)).products[0].history;
    check('history capped at 20, newest first', hs.length === 20 && hs[0].to === '224', hs.length);
    await openGroup(p, 3);
    await p.click('#histGrp > summary'); await wait(50);
    check('history list shows 20 lines', (await p.$$('#histList li')).length === 20);
    await p.click('#btnMenu'); await p.click('#btnDup'); await wait(100);
    const dup = (await local(p)).products[1];
    check('duplicate starts with empty history', dup.name.endsWith('(copy)') && !dup.history, dup.history);
    await p.click('#histGrp > summary'); await wait(50);
    check('"No changes recorded yet" shown', (await p.textContent('#histList')) === 'No changes recorded yet');
    await p.context().close();
  }
  {
    const p = await newPage(browser, errs, 'history-shared');
    await p.goto(base + '/'); await wait(300);
    await p.evaluate(e => { window.__mockEmail = e; localStorage.setItem('importsim.profile', 'andre'); }, AGUSTIN);
    await p.click('#gateIn'); await wait(600);
    await openGroup(p, 0);
    await edit(p, 's.qty', '55'); await wait(900);
    const hs = (await store(p, ITEMS('andre'))).p_seed.history;
    check('shared: Agustín editing André profile, by = Agustín', hs && hs.length === 1 && hs[0].by === 'Agustín' && hs[0].from === '30' && hs[0].to === '55', hs);
    await p.context().close();
  }

  console.log('Guessed inputs');
  {
    const p = await newPage(browser, errs, 'guess-local');
    await p.goto(base + '/dist/local.html'); await wait(300);
    const line = () => p.evaluate(() => { const e = document.getElementById('guessLine'); return e.hidden ? '' : e.textContent; });
    check('default guesses line', (await line()) === '6 inputs are still guesses: Duty rate, Tariff code, ROAS, Returns, Sea rate, Shared agent', await line());
    await openGroup(p, 0);
    check('FCA price defaults to confirmed', (await p.textContent('[data-guess="s.price"]')) === '✓ confirmed');
    await p.click('[data-guess="s.price"]'); await wait(50);
    check('toggle shows guess', (await p.getAttribute('[data-guess="s.price"]', 'data-on')) === 'guess' && (await p.textContent('[data-guess="s.price"]')) === '? guess');
    await openGroup(p, 2);
    await p.click('[data-guess="p.roas"]'); await wait(50);
    check('count line updates', (await line()) === '6 inputs are still guesses: FCA price, Duty rate, Tariff code, Returns, Sea rate, Shared agent', await line());
    await openGroup(p, 3);
    await p.click('[data-guess="g.fx"]'); await wait(50);
    let d = await local(p);
    check('stored in p.unconf and settings.unconf', d.products[0].unconf['s.price'] === true && !d.products[0].unconf['p.roas'] && d.products[0].unconf['s.dutyFF'] === true &&
      d.settings.unconf['g.fx'] === true && d.settings.unconf['l.rate'] === true && d.settings.unconf['m.commission.sodimac'] === true, [d.products[0].unconf, d.settings.unconf]);
    await p.reload(); await wait(300);
    check('guesses persist after reload', (await line()) === '7 inputs are still guesses: FCA price, Duty rate, Tariff code, Returns, Exchange rate, Sea rate, Shared agent', await line());
    await p.click('#guessLine'); await wait(100);
    check('clicking the line opens and focuses the first guess', await p.evaluate(() => document.activeElement.getAttribute('data-k') === 's.price' && document.querySelector('details.grp[data-g="0"]').open));
    await p.context().close();
  }
  {
    const p = await newPage(browser, errs, 'guess-shared');
    await p.goto(base + '/'); await wait(300);
    await p.click('#gateIn'); await wait(600);
    await p.evaluate(() => { window.__writes = 0; });
    await openGroup(p, 3);
    await p.click('[data-guess="l.rate"]'); await wait(900);
    const st = (await store(p, ITEMS('andre'))).settings;
    check('shared: settings doc has unconf without l.rate', st.unconf && !st.unconf['l.rate'] && st.unconf['l.agent'] === true, st.unconf);
    check('shared: one write for the toggle', (await p.evaluate(() => window.__writes)) === 1, await p.evaluate(() => window.__writes));
    check('shared: line drops Sea rate', (await p.textContent('#guessLine')) === '5 inputs are still guesses: Duty rate, Tariff code, ROAS, Returns, Shared agent', await p.textContent('#guessLine'));
    await p.context().close();
  }

  console.log('Placeholder seed is dropped when the store has products');
  {
    const api = loadCalc();
    const prod = api.seedProduct(); prod.id = 'p_only1'; prod.name = 'Only product'; prod.created = 7;
    const doc = JSON.parse(JSON.stringify(Object.assign(api.normProduct(prod), { updatedBy: 'André', updatedAt: 1762900000000 })));
    const p = await newPage(browser, errs, 'placeholder');
    await p.goto(base + '/'); await wait(300);
    await p.evaluate(([k, doc]) => { window.__fbstore[k] = { [doc.id]: doc }; window.__writes = 0; }, [ITEMS('andre'), doc]);
    await p.click('#gateIn'); await wait(900);
    const names = await p.$$eval('#plist .nm', e => e.map(x => x.textContent));
    check('exactly the stored product is listed', JSON.stringify(names) === JSON.stringify(['Only product']), names);
    check('0 writes after sign-in', (await p.evaluate(() => window.__writes)) === 0, await p.evaluate(() => window.__writes));
    await openGroup(p, 0); await edit(p, 's.qty', '31'); await wait(900);
    const ids = Object.keys(await store(p, ITEMS('andre'))).filter(k => k !== 'settings');
    check('after an edit only the stored product is written, no p_seed', JSON.stringify(ids) === '["p_only1"]', ids);
    await p.context().close();
  }
};
