  /* ===== events ===== */
  $('form').addEventListener('input', function (e) {
    var el = e.target, k = el.getAttribute && el.getAttribute('data-k');
    if (!k) return;
    var v = el.type === 'checkbox' ? el.checked : el.value;
    setVal(k, v);
    if (k === 'p.mk') { changed(false); return; }
    changed(true);
  });
  $('form').addEventListener('click', function (e) {
    var b = e.target.closest('[data-mode]');
    if (!b) return;
    cur().sim.lcl = b.getAttribute('data-mode') === 'sea';
    changed(false);
  });
  $('plist').addEventListener('click', function (e) {
    var b = e.target.closest('[data-id]'); if (!b) return;
    S.active = b.getAttribute('data-id'); changed(false);
  });
  $('tabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]'); if (!b) return;
    S.tab = b.getAttribute('data-tab'); save(); renderTabs(); renderView();
  });
  $('view').addEventListener('change', function (e) {
    var id = e.target.getAttribute && e.target.getAttribute('data-ship');
    if (!id) return;
    S.products.forEach(function (x) { if (x.id === id) x.sim.lcl = e.target.checked; });
    changed(false);
  });
  $('view').addEventListener('click', function (e) {
    var sp = e.target.closest('[data-split]');
    if (sp) { S.settings.lcl.split = sp.getAttribute('data-split'); changed(true); return; }
    var sv = e.target.closest('[data-sum]');
    if (sv) { S.sumView = sv.getAttribute('data-sum'); save(); renderView(); return; }
    var o = e.target.closest('[data-open]');
    if (o) { S.active = o.getAttribute('data-open'); S.tab = 'overview'; changed(false); window.scrollTo(0, 0); return; }
    if (e.target.closest('[data-add]')) addProduct();
  });
  function addProduct() {
    var p = blankProduct('New product'); p.sim.lcl = true; p.sim.qty = '50';
    S.products.push(p); S.active = p.id; changed(false);
  }
  $('btnAdd').addEventListener('click', addProduct);
  $('btnDup').addEventListener('click', function () {
    var p = JSON.parse(JSON.stringify(cur())); p.id = 'p_' + uid(); p.name += ' (copy)';
    S.products.push(p); S.active = p.id; changed(false);
  });
  $('btnDel').addEventListener('click', function () {
    var p = cur(), name = p.name;
    ask('Delete "' + name + '"? This cannot be undone.', 'Delete', function () {
      S.products = S.products.filter(function (x) { return x.id !== p.id; });
      if (!S.products.length) { var b = blankProduct('New product'); b.sim.lcl = true; b.sim.qty = '50'; S.products.push(b); }
      S.active = S.products[0].id; changed(false); toast('Deleted "' + name + '"');
    });
  });
  $('btnReset').addEventListener('click', function () {
    var sh = mode === 'shared';
    ask(sh ? 'Replace the products and settings of ' + PROFILES[profile] + ' with the baseline, 30 pumps by sea? Both of you will see this. Shared ideas are not touched.' : 'Replace everything in this browser (products and ideas) with the baseline, 30 pumps by sea?', 'Reset', function () {
      var bl = baseline(); S.products = bl.products; S.settings = bl.settings; S.active = bl.active;
      if (!sh) S.ideas = [];
      formBuilt = false; changed(false); toast('Reset to baseline');
    });
  });
  $('btnExport').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'import-simulator-v2-data.json';
    document.body.appendChild(a); a.click(); a.remove();
  });
  $('btnImport').addEventListener('click', function () { $('fileIn').click(); });
  $('fileIn').addEventListener('change', function () {
    var f = this.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      var n2;
      try { n2 = normState(JSON.parse(rd.result)); } catch (e) { toast('That file is not valid data.'); return; }
      var sh = mode === 'shared';
      ask(sh ? 'Importing replaces the products and settings of ' + PROFILES[profile] + ' for both of you. Shared ideas are not touched. Continue?' : 'Importing replaces everything in this browser. Continue?', 'Import', function () {
        if (sh) { S.products = n2.products; S.settings = n2.settings; S.active = n2.active; }
        else { S = n2; }
        formBuilt = false; changed(false); toast('Data imported');
      });
    };
    rd.readAsText(f); this.value = '';
  });
