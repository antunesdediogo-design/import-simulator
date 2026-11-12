  var $ = function (id) { return document.getElementById(id); };
  var modalFn = null, toastT = null;
  function ask(text, okLabel, fn) {
    $('modalText').textContent = text; $('modalYes').textContent = okLabel || 'OK'; modalFn = fn; $('modal').hidden = false; $('modalYes').focus();
  }
  function closeModal() { $('modal').hidden = true; modalFn = null; }
  function toast(t) { var el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { el.hidden = true; }, 2800); }
  document.addEventListener('DOMContentLoaded', function () {});
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function grp(x) { return String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function usd(v) { var neg = v < 0, a = Math.abs(v); var s = 'US$' + a.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); return neg ? '-' + s : s; }
  function clp(v) { var neg = Math.round(v) < 0; return (neg ? '-$' : '$') + grp(Math.abs(v)); }
  function pct(v) { return (v * 100).toFixed(1) + '%'; }
  function m3(v) { return v.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' m³'; }
  function uid() { return Math.random().toString(36).slice(2, 8) + Date.now().toString(36); }
  var COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)'];

