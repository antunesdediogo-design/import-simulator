  function renderView() {
    var p = cur(), c = CACHE[p.id];
    var f = { overview: vOverview, cost: vCost, pl: vPL, channels: vChannels, ship: vShip }[S.tab] || vOverview;
    var html = f(p, c);
    $('view').innerHTML = '<div style="display:flex;flex-direction:column;gap:16px">' + html + '</div>';
  }

  function refresh(skipForm) {
    recompute(); renderList(); renderKpis(); renderTabs(); renderView();
    if (!formBuilt) buildForm();
    if (!skipForm) fillForm(); else applyVis();
    showView(true);
  }
  function changed(skipForm) { save(); refresh(skipForm); }

