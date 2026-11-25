window.__WASM_PARTS={"parts": ["index.wasm.part1", "index.wasm.part2", "index.wasm.part3", "index.wasm.part4", "index.wasm.part5"], "total": 35376909};
/* Sunda Life: pengaman & diagnostik Web (iPad/iPhone Safari). ES5 agar jalan di Safari lama. */
(function () {
  var T0 = Date.now(), errs = [], started = false, fatal = false, idbState = 'belum dipakai', box = null;

  // 1) Batasi resolusi render (iPad retina 2x terlalu berat)
  try {
    var r = window.devicePixelRatio || 1;
    Object.defineProperty(window, 'devicePixelRatio', { get: function () { return Math.min(r, 1.25); }, configurable: true });
  } catch (e) {}

  // 1b) index.wasm dipecah jadi beberapa bagian kecil (batas unggah GitHub 25 MB). Gabungkan saat dimuat.
  var probes = [];
  try {
    var cfg = window.__WASM_PARTS, _fetch = window.fetch;
    if (cfg && cfg.parts && cfg.parts.length && _fetch && typeof ReadableStream === 'function') {
      window.fetch = function (input, init) {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        if (!/(^|\/)index\.wasm(\?.*)?$/.test(url)) return _fetch.apply(this, arguments);
        var fetches = cfg.parts.map(function (p) {
          var f = _fetch(p, { credentials: 'same-origin' }).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + p);
            return r;
          });
          f.catch(function () {});
          return f;
        });
        return fetches[0].then(function () {
          var i = 0, reader = null;
          var stream = new ReadableStream({
            pull: function (ctrl) {
              function next() {
                if (!reader) {
                  if (i >= fetches.length) { ctrl.close(); return Promise.resolve(); }
                  return fetches[i].then(function (r) { reader = r.body.getReader(); return next(); });
                }
                return reader.read().then(function (x) {
                  if (x.done) { reader = null; i++; return next(); }
                  ctrl.enqueue(x.value);
                });
              }
              return next();
            }
          });
          return new Response(stream, { status: 200, headers: { 'Content-Type': 'application/wasm', 'Content-Length': String(cfg.total) } });
        }, function () {
          return _fetch.apply(window, [url, init]);   // cadangan: pakai index.wasm utuh bila bagian tidak ada
        });
      };
      window.__origFetch = _fetch;
    }
  } catch (e) {}

  // 2) Pengaman IndexedDB: Safari iOS kadang tidak pernah membalas -> game macet di layar muat
  try {
    var idb = window.indexedDB, orig = idb.open;
    idb.open = function () {
      var req = orig.apply(idb, arguments), settled = false;
      var t = setTimeout(function () {
        if (settled) return; settled = true;
        idbState = 'TIDAK MERESPONS (8 dtk), dilewati: save otomatis nonaktif, pakai Kode Simpan';
        try { if (typeof req.onerror === 'function') req.onerror({ target: { error: new Error('IndexedDB timeout') }, preventDefault: function () {} }); } catch (e) {}
        render();
      }, 8000);
      var done = function () { if (!settled) { settled = true; clearTimeout(t); idbState = 'OK'; } };
      try { req.addEventListener('success', done); req.addEventListener('error', done); req.addEventListener('blocked', done); } catch (e) {}
      return req;
    };
  } catch (e) { idbState = 'tidak tersedia'; }

  // 3) Tangkap error
  window.addEventListener('error', function (e) {
    fatal = true; errs.push('JS: ' + (e.message || 'error') + ' @' + String(e.filename || '').split('/').pop() + ':' + e.lineno); render();
  });
  window.addEventListener('unhandledrejection', function (e) {
    var m = e.reason && (e.reason.message || e.reason); fatal = true; errs.push('REJECT: ' + String(m).slice(0, 180)); render();
  });
  var ce = console.error;
  console.error = function () {
    try {
      var m = Array.prototype.slice.call(arguments).join(' ');
      if (!/MSAA|USER WARNING|at: |run dependencies|dependency:|end of list/.test(m)) { errs.push(m.slice(0, 200)); if (!started) render(); }
    } catch (e) {}
    return ce.apply(console, arguments);
  };

  var probed = false, probeRes = {}, probeTotal = 0;
  function probe() {
    if (probed) return; probed = true;
    var f = window.__origFetch || window.fetch, cfg = window.__WASM_PARTS;
    var list = ['index.js', 'index.pck'].concat(cfg && cfg.parts ? cfg.parts : ['index.wasm']);
    probeTotal = list.length;
    list.forEach(function (u) {
      var done = function (v) { probeRes[u] = v; render(); };
      try { f(u + '?cek=' + Date.now(), { method: 'HEAD', cache: 'no-store' }).then(function (r) { done(r.ok ? 'OK' : 'HTTP ' + r.status); }, function () { done('gagal dijangkau'); }); }
      catch (e) { done('gagal'); }
    });
  }
  function probeText() {
    var keys = Object.keys(probeRes); if (!keys.length) return '';
    var bad = keys.filter(function (k) { return probeRes[k] !== 'OK'; });
    var t = '\n\nCek berkas: ' + (keys.length - bad.length) + ' dari ' + probeTotal + ' OK';
    if (bad.length) t += '\nBERKAS HILANG DI HOSTING:\n- ' + bad.map(function (k) { return k + ' (' + probeRes[k] + ')'; }).join('\n- ') + '\nUnggah ulang SEMUA berkas dari zip, lalu coba lagi.';
    return t;
  }
  function webgl2() { try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; } }
  function info() {
    var ua = navigator.userAgent, m = /OS (\d+)[_.](\d+)/.exec(ua);
    return [
      'Waktu: ' + Math.round((Date.now() - T0) / 1000) + ' dtk',
      'Perangkat: ' + ua.replace(/Mozilla\/5.0 /, '').slice(0, 110),
      'iOS: ' + (m ? m[1] + '.' + m[2] : '(tidak terbaca; iPadOS Safari mode desktop)') + ' | sentuh: ' + (navigator.maxTouchPoints || 0),
      'WebGL2: ' + (webgl2() ? 'ya' : 'TIDAK (butuh iOS/iPadOS 15+; matikan Mode Daya Rendah)'),
      'WebAssembly: ' + (typeof WebAssembly === 'object' ? 'ya' : 'TIDAK'),
      'IndexedDB: ' + idbState,
      'Layar: ' + screen.width + 'x' + screen.height + ' | DPR ' + window.devicePixelRatio
    ];
  }
  function render() {
    if (started && !fatal) return;
    if (!document.body) { setTimeout(render, 300); return; }
    if (!box) {
      box = document.createElement('div'); box.id = 'sunda-diag';
      box.style.cssText = 'position:fixed;left:8px;right:8px;top:8px;z-index:99999;max-height:70%;overflow:auto;padding:10px 12px;border-radius:10px;background:rgba(18,15,13,.92);color:#ffeccb;font:13px/1.45 -apple-system,system-ui,sans-serif;border:2px solid #e0534f;pointer-events:none;white-space:pre-wrap;word-break:break-word';
      document.body.appendChild(box);
    }
    if (!probed) probe();
    var head = fatal ? 'TERJADI ERROR. Kirim tangkapan layar ini.' : 'Game belum mulai. Kirim tangkapan layar ini jika tetap macet.';
    box.textContent = head + '\n' + info().join('\n') + (errs.length ? '\n\nError:\n- ' + errs.slice(-6).join('\n- ') : '') + probeText();
  }

  // 4) Deteksi game sudah berjalan: kanvas Godot berubah dari ukuran bawaan 300x150
  var poll = setInterval(function () {
    var c = document.querySelector('canvas');
    if (c && (c.width !== 300 || c.height !== 150)) {
      started = true; clearInterval(poll);
      if (box && !fatal) { box.parentNode.removeChild(box); box = null; }
    } else if (Date.now() - T0 > 25000) { render(); }
  }, 1000);
})();
