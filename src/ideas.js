  /* ===== ideas (shared block in the published version) ===== */
  var STAT = [['idea', 'Idea'], ['investigating', 'Investigating'], ['test', 'Worth testing'], ['discarded', 'Discarded']];
  var ideaFilter = { status: '', author: '' };
  function safeUrl(u) { u = String(u || '').trim(); return /^https?:\/\//i.test(u) ? u : ''; }
  function fdateTime(t) { try { return new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  function fdate(t) { try { return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } }
  function satLevel(v) {
    if (String(v === undefined ? '' : v).trim() === '') return null;
    var x = n(v), lo = n(S.settings.sat.low), hi = n(S.settings.sat.high);
    return x < lo ? ['Low saturation', 'pos'] : x <= hi ? ['Medium saturation', 'warnc'] : ['High saturation', 'neg'];
  }
  function checksDone(i) { return (i.exists === 'yes' || i.exists === 'no' ? 1 : 0) + (String(i.price || '').trim() !== '' ? 1 : 0) + (String(i.listings || '').trim() !== '' ? 1 : 0); }
  function ideaMeta(i) {
    var d = checksDone(i), sat = satLevel(i.listings), h = '';
    h += '<span class="pill ' + (d === 3 ? 'pos' : 'mut') + '">' + (d === 3 ? 'Validated' : d + ' of 3 checks') + '</span>';
    if (i.exists === 'no') h += '<span class="pill neg">Not sold in Chile yet</span>';
    if (i.exists === 'yes') h += '<span class="pill">Sold in Chile</span>';
    if (sat) h += '<span class="pill ' + sat[1] + '">' + sat[0] + '</span>';
    return h;
  }
  function searchLinks(i) {
    var q = encodeURIComponent(i.name || '');
    return '<a href="https://listado.mercadolibre.cl/' + encodeURIComponent((i.name || '').trim().replace(/\s+/g, '-')) + '" target="_blank" rel="noopener">Search Mercado Libre</a> · ' +
      '<a href="https://www.falabella.com/falabella-cl/search?Ntt=' + q + '" target="_blank" rel="noopener">Search Falabella</a>';
  }
  function ideaCard(i) {
    var u = safeUrl(i.link);
    return '<article class="icard" data-card="' + esc(i.id) + '"><div class="hd"><h4>' + esc(i.name) + '</h4>' +
      '<select data-i="' + esc(i.id) + '" data-f="status" aria-label="Status" style="background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:7px;min-height:36px">' +
      STAT.map(function (x) { return '<option value="' + x[0] + '"' + (i.status === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="note">Added by <b style="color:var(--text)">' + esc(i.author) + '</b> on ' + fdate(i.created) + (i.editedBy ? ' · last edit by ' + esc(i.editedBy) + ' on ' + fdate(i.updated) : '') + '</div>' +
      (u ? '<div class="note"><a href="' + esc(u) + '" target="_blank" rel="noopener">Reference link</a></div>' : '') +
      '<div class="meta" id="meta_' + esc(i.id) + '">' + ideaMeta(i) + '</div>' +
      '<div class="chk3">' +
      '<div class="c"><span class="dot' + (i.exists === 'yes' || i.exists === 'no' ? ' ok' : '') + '" data-dot="exists"></span><label class="f"><span>1. Does it exist in Chile?</span><select data-i="' + esc(i.id) + '" data-f="exists"><option value="unknown"' + (i.exists === 'unknown' ? ' selected' : '') + '>Not checked</option><option value="yes"' + (i.exists === 'yes' ? ' selected' : '') + '>Yes, already sold</option><option value="no"' + (i.exists === 'no' ? ' selected' : '') + '>No, nobody sells it</option></select></label></div>' +
      '<div class="c"><span class="dot' + (String(i.price || '').trim() ? ' ok' : '') + '" data-dot="price"></span><label class="f"><span>2. Typical market price (CLP, incl. IVA)</span><input type="text" inputmode="numeric" data-i="' + esc(i.id) + '" data-f="price" value="' + esc(i.price || '') + '" placeholder="e.g. 24990"></label></div>' +
      '<div class="c"><span class="dot' + (String(i.listings || '').trim() ? ' ok' : '') + '" data-dot="listings"></span><label class="f"><span>3. Listings found (saturation)</span><input type="text" inputmode="numeric" data-i="' + esc(i.id) + '" data-f="listings" value="' + esc(i.listings || '') + '" placeholder="e.g. 120"></label></div></div>' +
      '<label class="f"><span>Notes, source of the price, competitors</span><textarea data-i="' + esc(i.id) + '" data-f="notes">' + esc(i.notes || '') + '</textarea></label>' +
      '<div class="note">' + searchLinks(i) + '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn pri" data-act="tosim" data-id="' + esc(i.id) + '">Simulate it</button><button type="button" class="btn danger" data-act="del" data-id="' + esc(i.id) + '">Delete</button></div></article>';
  }
  function renderIdeas() {
    var el = $('appIdeas'), list = S.ideas.filter(function (i) {
      return (!ideaFilter.status || i.status === ideaFilter.status) && (!ideaFilter.author || i.author === ideaFilter.author);
    });
    list.sort(function (a, b) { return b.created - a.created; });
    el.innerHTML =
      '<div class="card"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:12px"><h3 style="margin:0">New idea to investigate</h3>' +
      (mode === 'shared' ? '<div class="note">Signed in as <b style="color:var(--text)">' + esc(S.me) + '</b>. Everything you write here is shared with both of you.</div></div>' :
      '<div style="display:flex;align-items:center;gap:8px"><span class="note">You are</span><div class="seg" role="radiogroup" aria-label="Who is writing">' +
      ['André', 'Agustín'].map(function (w) { return '<button type="button" role="radio" data-act="me" data-who="' + w + '" aria-checked="' + (S.me === w) + '" style="padding:8px 14px">' + w + '</button>'; }).join('') + '</div></div></div>') +
      '<div class="row"><label class="f"><span>Product or idea</span><input type="text" id="ideaName" placeholder="e.g. Portable tire inflator"></label>' +
      '<label class="f"><span>Reference link (optional)</span><input type="text" id="ideaLink" placeholder="https://..."></label>' +
      '<label class="f" style="flex-basis:100%"><span>Why could it work? (optional)</span><textarea id="ideaNotes" style="min-height:60px"></textarea></label>' +
      '<button type="button" class="btn pri" data-act="add">Add idea</button></div></div>' +
      '<div class="row"><label class="f" style="flex:0 1 180px"><span>Status</span><select id="fStatus"><option value="">All</option>' + STAT.map(function (x) { return '<option value="' + x[0] + '"' + (ideaFilter.status === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label>' +
      '<label class="f" style="flex:0 1 180px"><span>Written by</span><select id="fAuthor"><option value="">Both</option><option' + (ideaFilter.author === 'André' ? ' selected' : '') + '>André</option><option' + (ideaFilter.author === 'Agustín' ? ' selected' : '') + '>Agustín</option></select></label>' +
      '<details class="grp" style="flex:1 1 320px"><summary>Saturation scale<span class="hint">low under ' + esc(S.settings.sat.low) + ', high over ' + esc(S.settings.sat.high) + ' listings</span></summary><div class="fields"><label class="f"><span>Low if fewer than</span><input type="text" inputmode="numeric" data-sat="low" value="' + esc(S.settings.sat.low) + '"></label><label class="f"><span>High if more than</span><input type="text" inputmode="numeric" data-sat="high" value="' + esc(S.settings.sat.high) + '"></label><p class="note wide">These two numbers are a starting guess, not a rule. Adjust them to how many listings feel crowded in the categories you look at.</p></div></details></div>' +
      (list.length ? '<div class="igrid">' + list.map(ideaCard).join('') + '</div>' : '<div class="card note">' + (S.ideas.length ? 'No ideas match these filters.' : 'No ideas yet. Write the first one above.') + '</div>');
    var cnt = $('ideaCount'); if (cnt) cnt.textContent = S.ideas.length ? '(' + S.ideas.length + ')' : '';
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
  function ideaById(id) { for (var i = 0; i < S.ideas.length; i++) if (S.ideas[i].id === id) return S.ideas[i]; return null; }
  $('appIdeas').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var act = b.getAttribute('data-act');
    if (act === 'me') { S.me = b.getAttribute('data-who'); save(); renderIdeas(); return; }
    if (act === 'add') {
      var name = $('ideaName').value.trim();
      if (!name) { $('ideaName').focus(); return; }
      S.ideas.push({ id: 'i_' + uid(), name: name, link: $('ideaLink').value.trim(), notes: $('ideaNotes').value.trim(), author: S.me, created: Date.now(), updated: Date.now(), editedBy: '',
        status: 'idea', exists: 'unknown', price: '', listings: '' });
      save(); renderIdeas(); return;
    }
    var i = ideaById(b.getAttribute('data-id')); if (!i) return;
    if (act === 'del') {
      ask('Delete the idea "' + i.name + '"? This cannot be undone.', 'Delete', function () {
        S.ideas = S.ideas.filter(function (x) { return x.id !== i.id; }); save(); renderIdeas(); toast('Idea deleted');
      });
      return;
    }
    if (act === 'tosim') {
      var p = blankProduct(i.name); p.sim.lcl = true; p.sim.qty = '50';
      var pr = String(i.price || '').replace(/\D/g, ''); if (pr) p.pl.rrp = pr;
      p.notes = (safeUrl(i.link) ? i.link + '\n' : '') + (i.notes || '') + '\nIdea by ' + i.author + '. Listings found: ' + (i.listings || 'not checked') + '.';
      S.products.push(p); S.active = p.id; S.tab = 'overview'; S.view = 'sim';
      if (i.status === 'idea') i.status = 'investigating';
      changed(false); window.scrollTo(0, 0);
    }
  });
  function ideaInput(e) {
    var el = e.target, id = el.getAttribute && el.getAttribute('data-i');
    if (el.getAttribute && el.getAttribute('data-sat')) { S.settings.sat[el.getAttribute('data-sat')] = el.value; save(); document.querySelectorAll('.meta').forEach(function (m) { var i2 = ideaById(m.id.slice(5)); if (i2) m.innerHTML = ideaMeta(i2); }); return; }
    if (el.id === 'fStatus') { ideaFilter.status = el.value; renderIdeas(); return; }
    if (el.id === 'fAuthor') { ideaFilter.author = el.value; renderIdeas(); return; }
    if (!id) return;
    var i = ideaById(id); if (!i) return;
    var f = el.getAttribute('data-f');
    i[f] = el.value; i.editedBy = S.me; i.updated = Date.now(); save();
    var card = el.closest('.icard');
    $('meta_' + id).innerHTML = ideaMeta(i);
    ['exists', 'price', 'listings'].forEach(function (k) {
      var ok = k === 'exists' ? (i.exists === 'yes' || i.exists === 'no') : String(i[k] || '').trim() !== '';
      var d = card.querySelector('[data-dot="' + k + '"]'); if (d) d.classList.toggle('ok', ok);
    });
  }
  $('appIdeas').addEventListener('input', ideaInput);
  $('appIdeas').addEventListener('change', function (e) { if (e.target.tagName === 'SELECT') ideaInput(e); });

