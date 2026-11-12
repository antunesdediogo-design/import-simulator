  /* ===== photos ===== */
  function shrink(file, max, q) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var sc = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * sc)); c.height = Math.max(1, Math.round(img.height * sc));
        var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('encode')); }, 'image/jpeg', q);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('load')); };
      img.src = url;
    });
  }
  function blobToDataUrl(b) { return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = rej; fr.readAsDataURL(b); }); }
  function renderPhotos() {
    var el = $('photoList'); if (!el) return;
    var p = cur();
    el.innerHTML = (p.photos || []).map(function (ph, i) {
      if (!ph || typeof ph.data !== 'string' || ph.data.indexOf('data:image/') !== 0) return '';
      return '<span class="ph"><button type="button" class="phb" data-ph="' + i + '" aria-label="Enlarge photo ' + (i + 1) + '"><img alt="Reference photo ' + (i + 1) + '" src="' + esc(ph.data) + '"></button><button type="button" class="phx" data-phdel="' + i + '" aria-label="Remove photo ' + (i + 1) + '">×</button></span>';
    }).join('');
  }
  function addPhotos(files) {
    var p = cur();
    files = files.filter(function (x) { return x && x.type && x.type.indexOf('image/') === 0; });
    if (!files.length) return;
    $('photoMsg').textContent = 'Adding ' + files.length + (files.length > 1 ? ' photos...' : ' photo...');
    var failed = 0;
    files.reduce(function (pr, file) {
      return pr.then(function () { return shrink(file, 800, 0.7).then(blobToDataUrl).then(function (d) { p.photos.push({ data: d }); }, function () { failed++; }); });
    }, Promise.resolve()).then(function () {
      $('photoMsg').textContent = failed ? failed + ' file(s) could not be added.' : '';
      save(); if (cur() === p) renderPhotos();
    });
  }
  $('form').addEventListener('change', function (e) { if (e.target.id === 'photoIn') { addPhotos(Array.prototype.slice.call(e.target.files)); e.target.value = ''; } });
  $('form').addEventListener('click', function (e) {
    var big = e.target.closest('[data-ph]'), del = e.target.closest('[data-phdel]');
    if (big) { var ph = cur().photos[+big.getAttribute('data-ph')]; if (ph && ph.data) { $('lightbox').querySelector('img').src = ph.data; $('lightbox').hidden = false; } }
    if (del) { var idx = +del.getAttribute('data-phdel'); ask('Remove this photo?', 'Remove', function () { cur().photos.splice(idx, 1); save(); renderPhotos(); }); }
  });
  $('lightbox').addEventListener('click', function () { $('lightbox').hidden = true; });

