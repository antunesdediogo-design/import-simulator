  var menuEl = $('menu'), menuBtn = $('btnMenu');
  function closeMenu() { menuEl.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); }
  menuBtn.addEventListener('click', function (e) { e.stopPropagation(); menuEl.hidden = !menuEl.hidden; menuBtn.setAttribute('aria-expanded', String(!menuEl.hidden)); });
  menuEl.addEventListener('click', function () { setTimeout(closeMenu, 0); });
  document.addEventListener('click', function (e) { if (!menuEl.hidden && !menuEl.contains(e.target)) closeMenu(); });
  $('modalYes').addEventListener('click', function () { var fn = modalFn; closeModal(); if (fn) fn(); });
  $('modalNo').addEventListener('click', closeModal);
  $('modal').addEventListener('click', function (e) { if (e.target === $('modal')) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (!$('modal').hidden) closeModal(); $('lightbox').hidden = true; closeMenu(); } });
  function theme(t) { document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem('importsim.v2.theme2', t); } catch (e) {} }
  $('btnTheme').addEventListener('click', function () { theme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light'); });
  (function () { var t = null; try { t = localStorage.getItem('importsim.v2.theme2'); } catch (e) {} theme(t || 'light'); })();


