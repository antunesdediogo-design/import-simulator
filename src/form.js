  /* ===== sidebar form ===== */
  var SPEC = [
    { t: 'Buy', hint: function (p, c) { return usd(c.r.goods); }, f: [
      ['s.qty', 'Quantity (units)'], ['s.price', 'FCA price per unit (US$)'], ['s.dep', 'Deposit %'] ] },
    { t: 'Ship', hint: function (p, c) { return p.sim.lcl ? 'Sea · ' + m3(c.r.cbm) : 'Air · ' + c.r.chargeable.toFixed(1) + ' kg'; }, f: [
      ['mode'],
      ['s.cl', 'Carton length (cm)'], ['s.cw', 'Carton width (cm)'], ['s.ch', 'Carton height (cm)'], ['s.upc', 'Units per carton'],
      ['s.kgu', 'Weight per unit (kg)', 'air'], ['s.rate', 'Air rate (US$/kg)', 'air'], ['s.origin', 'Origin fee (US$)', 'air'], ['s.agent', 'Customs agent (US$)', 'air'],
      ['s.vdiv', 'Volumetric divisor', 'air', ['6000', '5000']],
      ['s.insp', 'Insurance %'], ['duty'] ] },
    { t: 'Sell', hint: function (p, c) { return c.mk.name.split(' ')[0] + ' · ' + clp(c.pl.rrp); }, f: [
      ['p.mk', 'Marketplace', null, 'mk'], ['m.commission', 'Commission %'],
      ['p.rrp', 'Selling price (CLP, incl. IVA)'], ['p.roas', 'ROAS (ads)'], ['p.returns', 'Returns %'], ['p.target', 'Target margin %'],
      ['p.days', 'Days to sell one unit'], ['full'] ] },
    { t: 'Settings for all products', hint: function () { return '1 US$ = ' + grp(n(S.settings.fx)) + ' CLP'; }, f: [
      ['g.fx', 'CLP per 1 US$'], ['l.rate', 'Sea rate (US$/m³)'], ['l.min', 'Minimum billed (m³)'], ['l.agent', 'Shared agent (US$)'] ] }
  ];
  var formBuilt = false;

  var ADV = ['s.dep', 's.insp', 's.vdiv', 'p.returns', 'p.target'];
  function fieldHtml(f) {
    if (f[0] === 'mode') {
      return '<div class="wide"><div class="seg" role="radiogroup" aria-label="Shipping method"><button type="button" role="radio" data-mode="air">By air</button><button type="button" role="radio" data-mode="sea">By sea (shared)</button></div></div>';
    }
    if (f[0] === 'duty') {
      return '<label class="f wide"><span>Tariff treatment (import duty)</span><select data-k="s.dutyMode"><option value="formF">With Form F certificate of origin (China FTA)</option><option value="general">Without certificate (general tariff)</option><option value="custom">Custom rate</option></select></label>' +
        '<label class="f" data-show="dff"><span>Duty with Form F %</span><input type="text" inputmode="decimal" data-k="s.dutyFF"></label>' +
        '<label class="f" data-show="dgen"><span>General tariff %</span><input type="text" inputmode="decimal" data-k="s.dutyGen"></label>' +
        '<label class="f" data-show="dcus"><span>Custom duty %</span><input type="text" inputmode="decimal" data-k="s.dutyCustom"></label>' +
        '<label class="f"><span>Tariff code (HS), for reference</span><input type="text" data-k="s.hs" placeholder="e.g. 8414.80"></label>' +
        '<p class="note wide">The general tariff is 6% (Aduanas). With a valid Form F the China FTA rate for your tariff code applies: it can be 0%, still being reduced in stages, or excluded from the FTA. Ask your customs agent to confirm the code and the rate before you order.</p>';
    }
    if (f[0] === 'full') {
      return '<div class="wide" data-show="ml"><label class="chk"><input type="checkbox" data-k="p.full"> Ship through Mercado Libre Full</label></div>' +
        '<label class="f" data-show="full"><span>Full size</span><select data-k="p.fullSize"><option value="S">S (small)</option><option value="M">M</option><option value="L">L</option><option value="XL">XL</option></select></label>' +
        '<label class="f" data-show="full"><span>Inbound cost, total (CLP)</span><input type="text" inputmode="decimal" data-k="p.fullIn"></label>';
    }
    var show = f[2] ? ' data-show="' + f[2] + '"' : '';
    if (f[3] === 'mk') return '<label class="f wide"><span>' + f[1] + '</span><select data-k="p.mk" id="mkSel"></select></label>';
    if (Array.isArray(f[3])) return '<label class="f"' + show + '><span>' + f[1] + '</span><select data-k="' + f[0] + '">' + f[3].map(function (o) { return '<option>' + o + '</option>'; }).join('') + '</select></label>';
    return '<label class="f"' + show + '><span>' + f[1] + '</span><input type="text" inputmode="decimal" data-k="' + f[0] + '"></label>';
  }
  function buildForm() {
    var html = '<label class="f"><span>Product name</span><input type="text" data-k="n.name"></label><p class="note" id="lastEdit" style="margin:-6px 0 0"></p>';
    SPEC.forEach(function (g, gi) {
      var main = '', adv = '';
      g.f.forEach(function (f) { var h = fieldHtml(f); if (ADV.indexOf(f[0]) >= 0) adv += h; else main += h; });
      html += '<details class="grp" data-g="' + gi + '"' + (gi === 0 ? ' open' : '') + '><summary>' + g.t + '<span class="hint" id="hint' + gi + '"></span></summary><div class="fields">' + main +
        (adv ? '<details class="adv wide"><summary>More options</summary><div class="fields" style="padding:8px 0 0">' + adv + '</div></details>' : '') +
        (gi === 2 ? '<p class="note wide" id="mkNote"></p>' : '') + '</div></details>';
    });
    html += '<details class="grp"><summary>Notes, links, photos</summary><div class="fields"><label class="f wide"><span>Supplier, reminders</span><textarea data-k="n.notes"></textarea></label>' +
      '<label class="f wide"><span>Links (one per line)</span><textarea data-k="n.linksText" style="min-height:60px"></textarea></label><div class="note wide" id="linkList"></div>' +
      '<div class="wide"><div class="photos" id="photoList"></div><label class="btn" style="display:inline-block;cursor:pointer">Add photos<input type="file" id="photoIn" accept="image/*" multiple hidden></label><p class="note" id="photoMsg" style="margin:6px 0 0"></p></div></div></details>';
    $('form').innerHTML = html;
    var sel = $('mkSel');
    sel.innerHTML = S.settings.mk.map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.name) + (m.official ? '' : ' (unconfirmed)') + '</option>'; }).join('');
    formBuilt = true;
  }
  $('form').addEventListener('toggle', function (e) {
    var d = e.target;
    if (d.classList && d.classList.contains('grp') && d.open) {
      $('form').querySelectorAll('details.grp').forEach(function (o) { if (o !== d) o.open = false; });
    }
  }, true);

  function getVal(k) {
    var p = cur(), pre = k.slice(0, 1), key = k.slice(2);
    if (pre === 's') return p.sim[key];
    if (pre === 'p') return p.pl[key];
    if (pre === 'n') return key === 'linksText' ? (p.links || []).map(function (l) { return l.url; }).join('\n') : p[key];
    if (pre === 'm') return mkById(p.pl.mk)[key];
    if (pre === 'g') return S.settings[key];
    if (pre === 'l') return S.settings.lcl[key];
  }
  function setVal(k, v) {
    var p = cur(), pre = k.slice(0, 1), key = k.slice(2);
    if (pre === 's') { p.sim[key] = v; if (key.indexOf('duty') === 0) syncDuty(p.sim); }
    else if (pre === 'p') p.pl[key] = v;
    else if (pre === 'n') { if (key === 'linksText') p.links = v.split('\n').map(function (t) { return t.trim(); }).filter(Boolean).map(function (u) { return { url: u }; }); else p[key] = v; }
    else if (pre === 'm') mkById(p.pl.mk)[key] = v;
    else if (pre === 'g') S.settings[key] = v;
    else if (pre === 'l') S.settings.lcl[key] = v;
  }
  function fillForm() {
    var form = $('form');
    form.querySelectorAll('[data-k]').forEach(function (el) {
      var v = getVal(el.getAttribute('data-k'));
      if (el.type === 'checkbox') el.checked = v === true || v === '1';
      else if (document.activeElement !== el) el.value = v === undefined ? '' : v;
    });
    applyVis();
  }
  function applyVis() {
    var p = cur(), sea = p.sim.lcl === true, mk = mkById(p.pl.mk), ml = isMercadoLibre(mk), full = ml && p.pl.full === true;
    $('form').querySelectorAll('[data-show]').forEach(function (el) {
      var w = el.getAttribute('data-show');
      var dm = p.sim.dutyMode;
      el.hidden = (w === 'air' && sea) || (w === 'ml' && !ml) || (w === 'full' && !full) || (w === 'dff' && dm !== 'formF') || (w === 'dgen' && dm !== 'general') || (w === 'dcus' && dm !== 'custom');
    });
    $('form').querySelectorAll('[data-mode]').forEach(function (b) {
      b.setAttribute('aria-checked', String((b.getAttribute('data-mode') === 'sea') === sea));
    });
    var c = CACHE[p.id];
    SPEC.forEach(function (g, gi) { var h = $('hint' + gi); if (h) h.textContent = g.hint(p, c); });
    var le = $('lastEdit'); if (le) le.textContent = p.updatedBy ? 'Last edit by ' + p.updatedBy + ', ' + fdateTime(p.updatedAt) : '';
    var ll = $('linkList'); if (ll) ll.innerHTML = (p.links || []).map(function (l) { var u = safeUrl(l.url); return u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 48)) + '</a>' : esc(l.url); }).join(' · ');
    renderPhotos();
    var note = $('mkNote');
    if (note) note.textContent = (mk.official ? 'Official rate. ' : 'Unconfirmed rate. ') + (mk.note || '');
  }

  /* ===== product list ===== */
  function renderList() {
    $('plist').innerHTML = S.products.map(function (p, i) {
      var c = CACHE[p.id], ok = c.pl.profit >= 0;
      return '<button type="button" class="pitem" data-id="' + esc(p.id) + '" aria-current="' + (p.id === S.active) + '">' +
        '<span class="dot" style="background:' + COLORS[i % COLORS.length] + '"></span><span class="nm">' + esc(p.name) + '</span>' +
        '<span class="pv num ' + (ok ? 'pos' : 'neg') + '">' + clp(c.pl.profit) + '</span></button>';
    }).join('');
  }

