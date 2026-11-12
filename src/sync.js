  /* ===== shared mode (Firebase, only in the GitHub build) =====
     Each profile lives in workspaces/andre-agustin/profiles/<id>/items: one doc per product plus a "settings" doc.
     Ideas live in workspaces/andre-agustin/ideas and are common to both profiles.
     Only the two emails below can read or write; firestore.rules enforces the same list. */
  var FB = window.FIREBASE_CONFIG || null;
  var PROFILES = { andre: 'André', agustin: 'Agustín' };
  var ALLOWED = { 'antunes.de.diogo@gmail.com': 'andre', 'agustin.oelckers@gmail.com': 'agustin' };
  var fbUser = null, fbDb = null, profile = null, who = null, itemsCol = null, ideasCol = null, unsubItems = null, unsubIdeas = null;
  var syncTimer = null, lastItems = {}, lastIdeas = {}, lastSettings = '', loadedItems = false, seeded = false;

  function canon(o) {
    if (Array.isArray(o)) return '[' + o.map(canon).join(',') + ']';
    if (o && typeof o === 'object') return '{' + Object.keys(o).sort().map(function (k) { return JSON.stringify(k) + ':' + canon(o[k]); }).join(',') + '}';
    return JSON.stringify(o);
  }
  function canonP(p) { var c = Object.assign({}, p); delete c.updatedBy; delete c.updatedAt; return canon(c); }
  function allowedProfile(u) { return u && u.email ? ALLOWED[u.email.toLowerCase()] || null : null; }
  function prefProfile() { try { return localStorage.getItem('importsim.profile'); } catch (e) { return null; } }

  function dirty() {
    if (mode !== 'shared' || !loadedItems) return false;
    var d = false;
    S.products.forEach(function (p) { if (lastItems[p.id] !== canonP(p)) d = true; });
    Object.keys(lastItems).forEach(function (id) { if (!S.products.some(function (p) { return p.id === id; })) d = true; });
    if (canon(S.settings) !== lastSettings) d = true;
    S.ideas.forEach(function (i) { if (lastIdeas[i.id] !== canon(i)) d = true; });
    Object.keys(lastIdeas).forEach(function (id) { if (!S.ideas.some(function (i) { return i.id === id; })) d = true; });
    return d;
  }
  function scheduleSync() {
    if (!dirty()) return;
    setStatus('saving'); clearTimeout(syncTimer); syncTimer = setTimeout(syncUp, 600);
  }
  function syncUp() {
    syncTimer = null;
    if (mode !== 'shared' || !loadedItems || !itemsCol) return;
    var col = itemsCol, icol = ideasCol, ops = [], big = false;
    S.products.forEach(function (p) {
      var c = canonP(p);
      if (lastItems[p.id] === c) return;
      p.updatedBy = who; p.updatedAt = Date.now();
      var data = JSON.parse(JSON.stringify(p));
      if (JSON.stringify(data).length > 900000) { big = true; return; }
      lastItems[p.id] = c; ops.push(col.doc(p.id).set(data));
    });
    Object.keys(lastItems).forEach(function (id) {
      if (!S.products.some(function (p) { return p.id === id; })) { delete lastItems[id]; ops.push(col.doc(id).delete()); }
    });
    var sc = canon(S.settings);
    if (sc !== lastSettings) { lastSettings = sc; ops.push(col.doc('settings').set(JSON.parse(JSON.stringify(S.settings)))); }
    S.ideas.forEach(function (i) { var c = canon(i); if (lastIdeas[i.id] !== c) { lastIdeas[i.id] = c; ops.push(icol.doc(i.id).set(JSON.parse(JSON.stringify(i)))); } });
    Object.keys(lastIdeas).forEach(function (id) {
      if (!S.ideas.some(function (i) { return i.id === id; })) { delete lastIdeas[id]; ops.push(icol.doc(id).delete()); }
    });
    if (big) { setStatus('toobig'); return; }
    if (formBuilt) applyVis();
    Promise.all(ops).then(function () { if (!syncTimer) setStatus('saved'); }, function () { setStatus('unsaved'); });
  }

  function onItems(snap) {
    var remote = {}, sdoc = null, ids;
    snap.docs.forEach(function (d) {
      var data = d.data(); if (!data) return;
      if (d.id === 'settings') sdoc = data; else if (d.id.indexOf('p_') === 0) remote[d.id] = data;
    });
    ids = Object.keys(remote);
    if (!ids.length) {
      if (!snap.metadata.fromCache && !seeded) {
        seeded = true; loadedItems = true; lastItems = {}; lastSettings = '';
        S.products = [seedProduct()]; S.settings = normSettings(); S.active = 'p_seed';
        syncUp(); formBuilt = false; refresh(false);
      }
      return;
    }
    loadedItems = true;
    var next = [], known = {};
    ids.forEach(function (id) {
      var loc = S.products.filter(function (x) { return x.id === id; })[0];
      if (loc && lastItems[id] !== undefined && canonP(loc) !== lastItems[id]) { next.push(loc); return; } /* unsynced local edit wins */
      if (!loc && lastItems[id] !== undefined) return; /* deleted here, delete still on its way */
      var np = normProduct(remote[id]); next.push(np); lastItems[id] = canonP(np);
    });
    S.products.forEach(function (loc) { if (!remote[loc.id] && lastItems[loc.id] === undefined) next.push(loc); });
    Object.keys(lastItems).forEach(function (id) { if (!remote[id]) delete lastItems[id]; });
    next.sort(function (a, b) { return (a.created || 0) - (b.created || 0); });
    S.products = next.length ? next : [seedProduct()];
    if (!S.products.some(function (p) { return p.id === S.active; })) S.active = S.products[0].id;
    var mkChanged = false;
    if (sdoc && !(lastSettings && canon(S.settings) !== lastSettings)) {
      var ns = normSettings(sdoc);
      mkChanged = canon(ns.mk) !== canon(S.settings.mk);
      S.settings = ns; lastSettings = canon(ns);
    }
    if (!snap.metadata.fromCache && !syncTimer) setStatus('saved');
    if (mkChanged) formBuilt = false;
    if (S.view === 'sim') {
      var f = document.activeElement, typing = f && $('form').contains(f) && /^(INPUT|TEXTAREA|SELECT)$/.test(f.tagName);
      refresh(!!typing && !mkChanged);
    } else { recompute(); showView(false); }
  }
  function onIdeas(snap) {
    var remote = {};
    snap.docs.forEach(function (d) { var data = d.data(); if (data && d.id.indexOf('i_') === 0) remote[d.id] = data; });
    var next = [];
    Object.keys(remote).forEach(function (id) {
      var loc = S.ideas.filter(function (x) { return x.id === id; })[0];
      if (loc && lastIdeas[id] !== undefined && canon(loc) !== lastIdeas[id]) { next.push(loc); return; }
      if (!loc && lastIdeas[id] !== undefined) return;
      var ni = normIdea(remote[id]); next.push(ni); lastIdeas[id] = canon(ni);
    });
    S.ideas.forEach(function (loc) { if (!remote[loc.id] && lastIdeas[loc.id] === undefined) next.push(loc); });
    Object.keys(lastIdeas).forEach(function (id) { if (!remote[id]) delete lastIdeas[id]; });
    S.ideas = next;
    var f = document.activeElement, typing = f && $('appIdeas').contains(f) && /^(INPUT|TEXTAREA|SELECT)$/.test(f.tagName);
    if (S.view === 'ideas' && !typing) renderIdeas(); else showView(false);
  }

  function renderWho() {
    var ok = !!allowedProfile(fbUser), btns = document.querySelectorAll('#who .seg button');
    for (var i = 0; i < btns.length; i++) {
      btns[i].disabled = !ok;
      btns[i].setAttribute('aria-checked', ok && btns[i].getAttribute('data-prof') === profile ? 'true' : 'false');
    }
    $('btnAuth').textContent = fbUser ? 'Sign out' : 'Sign in with Google';
    $('btnSignIn').hidden = !!fbUser;
    $('hdrUser').hidden = !ok; $('btnOut').hidden = !fbUser;
    if (ok) $('hdrUser').textContent = 'Signed in as ' + PROFILES[allowedProfile(fbUser)];
    $('authInfo').textContent = !fbUser
      ? 'You are not signed in, so what you change is saved only in this browser and Agustín cannot see it. Sign in with Google to share changes.'
      : ok ? 'Signed in as ' + fbUser.email + '. Editing ' + PROFILES[profile] + '’s numbers; both of you see the changes.'
      : fbUser.email + ' has no access to the shared numbers. Changes stay in this browser.';
  }
  function flushSync() { if (syncTimer) { clearTimeout(syncTimer); syncUp(); } }
  function openProfile(pid) {
    if (!fbDb || !PROFILES[pid]) return;
    if (mode === 'shared' && profile === pid) return;
    flushSync();
    if (unsubItems) { unsubItems(); unsubItems = null; }
    var firstOpen = mode !== 'shared';
    profile = pid; who = PROFILES[allowedProfile(fbUser)];
    try { localStorage.setItem('importsim.profile', pid); } catch (e) {}
    itemsCol = fbDb.collection('workspaces/andre-agustin/profiles/' + pid + '/items');
    mode = 'shared'; loadedItems = false; seeded = false; lastItems = {}; lastSettings = '';
    S.products = [seedProduct()]; S.settings = normSettings(); S.active = 'p_seed'; S.me = who;
    if (firstOpen) { S.ideas = []; lastIdeas = {}; ideasCol = fbDb.collection('workspaces/andre-agustin/ideas'); }
    setStatus('wait');
    var col = itemsCol;
    unsubItems = col.onSnapshot(function (snap) { if (col === itemsCol) onItems(snap); }, function (err) {
      setStatus('unsaved'); $('authInfo').textContent = 'Could not open the shared numbers (' + (err && err.code ? err.code : 'error') + '). Check the Firestore rules.';
    });
    if (firstOpen) unsubIdeas = ideasCol.onSnapshot(onIdeas, function () { setStatus('unsaved'); });
    formBuilt = false; refresh(false); renderWho();
  }
  function leaveShared() {
    flushSync();
    if (unsubItems) { unsubItems(); unsubItems = null; }
    if (unsubIdeas) { unsubIdeas(); unsubIdeas = null; }
    if (mode === 'shared') {
      var d = load(); mode = 'local'; profile = null; who = null;
      S.products = d.products; S.settings = d.settings; S.ideas = d.ideas; S.me = d.me;
      S.active = S.products.some(function (p) { return p.id === S.active; }) ? S.active : S.products[0].id;
      formBuilt = false; refresh(false); setStatus('local');
    }
  }
  function gate(state, msg) {
    /* state: 'checking' | 'login' | 'denied' | 'error' | 'open' */
    var g = $('gate'); g.hidden = state === 'open';
    $('gateIn').hidden = state !== 'login'; $('gateOut').hidden = state !== 'denied';
    var m = $('gateMsg'); m.textContent = msg || ''; m.className = state === 'denied' || state === 'error' ? 'err' : '';
  }
  function initFirebase() {
    if (!FB) { gate('open'); return; }
    gate('checking', 'Checking sign-in...');
    $('who').hidden = false; $('btnAuth').hidden = false;
    if (!window.firebase || !firebase.initializeApp) {
      $('authInfo').textContent = 'The shared database did not load.'; $('btnAuth').disabled = true; gate('error', 'The shared database could not load. Check your connection and reload the page.'); return;
    }
    try { firebase.initializeApp(FB); fbDb = firebase.firestore(); } catch (e) {
      gate('error', 'The shared database could not start. Reload the page.'); return;
    }
    firebase.auth().onAuthStateChanged(function (u) {
      fbUser = u;
      var own = allowedProfile(u);
      if (own) { var pref = prefProfile(); openProfile(PROFILES[pref] ? pref : own); gate('open'); }
      else {
        leaveShared();
        if (u) gate('denied', u.email + ' does not have access. Sign in with the account that was invited (André or Agustín).');
        else gate('login', 'Sign in required. Use your Google account to open the simulator. Only André and Agustín have access, and your changes are shared between you.');
      }
      renderWho();
    });
    function authClick() {
      if (fbUser) { flushSync(); firebase.auth().signOut(); return; }
      var provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      firebase.auth().signInWithPopup(provider).then(null, function (e) {
        var em = e && e.code === 'auth/popup-blocked' ? 'The sign-in window was blocked. Allow pop-ups for this page and try again.' : 'Sign-in did not finish (' + (e && e.code ? e.code : 'error') + '). Try again.';
        $('authInfo').textContent = em; if (!fbUser) gate('login', em);
      });
    }
    $('btnAuth').addEventListener('click', authClick);
    $('btnSignIn').addEventListener('click', authClick);
    $('gateIn').addEventListener('click', authClick);
    $('btnOut').addEventListener('click', authClick);
    $('gateOut').addEventListener('click', function () { firebase.auth().signOut(); });
    document.querySelector('#who .seg').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button[data-prof]') : null;
      if (b && !b.disabled) openProfile(b.getAttribute('data-prof'));
    });
    renderWho();
  }
  window.addEventListener('pagehide', flushSync);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flushSync(); });

