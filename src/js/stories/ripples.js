/**
 * Kaayko Stories — still ripple lines traced from a lake's real shoreline.
 *
 * The canvas names its lake: <canvas id="ripples" data-lake="/stories/lakes/lake-powell.json">.
 * That file is the lake's shoreline as rings of [x, y, x, y, …], north up, fitted to a
 * unit square (from the USGS National Hydrography Dataset; islands are extra rings), with
 * its bounding box in degrees, the places on its shore, a state line and a graticule.
 * Those are set in HTML (#chart) at their true positions, so the chart reads as a chart:
 * labels that would sit under the page's text step aside as it scrolls.
 *
 * Every line sits at an exact distance from that shore: the lake is rasterised, a
 * Euclidean distance transform gives each pixel its distance to the water, and lines are
 * drawn where φ(d) is a whole number, with φ' = 1 / (11 + 0.035·d). Spacing starts at
 * 11 px at the shore and widens outward, the way ripples spread. Nothing is random and
 * nothing moves: it is drawn once per window size and once per theme change.
 *
 * Line opacity comes from the --ripple-alpha token, which is capped so every text colour
 * on the page keeps 7:1 contrast over the darkest line (WCAG AAA).
 */
(function () {
  'use strict';

  // Felzenszwalb–Huttenlocher 1D squared distance transform.
  function edt1d(f, n, d, v, z) {
    let k = 0;
    v[0] = 0; z[0] = -1e30; z[1] = 1e30;
    for (let q = 1; q < n; q++) {
      let p = v[k];
      let s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p);
      while (s <= z[k]) {
        k--; p = v[k];
        s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p);
      }
      k++; v[k] = q; z[k] = s; z[k + 1] = 1e30;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      const p = v[k];
      d[q] = (q - p) * (q - p) + f[p];
    }
  }

  const hex = (v) => {
    const h = String(v || '').trim().replace('#', '');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0);
  };

  function mount(canvas) {
    const api = { render() {}, draw() {} };
    const ctx = canvas && canvas.getContext && canvas.getContext('2d');
    if (!ctx || !canvas.dataset.lake) return api;
    const root = document.documentElement;
    let rings = null, geo = null;
    let field = null;
    const dms = (deg, pos, neg) => { const a = Math.abs(deg), d = Math.floor(a), m = Math.round((a - d) * 60); return `${d}°${m ? `${String(m).padStart(2, '0')}′` : ''}${deg < 0 ? neg : pos}`; };

    function render() {
      if (!rings) return;
      const W = innerWidth, H = innerHeight;
      const s = Math.min(window.devicePixelRatio || 1, Math.sqrt(2.4e6 / (W * H)));
      const gw = Math.max(1, Math.round(W * s)), gh = Math.max(1, Math.round(H * s));
      canvas.width = gw; canvas.height = gh;
      // North up, filling most of the shorter side; right of centre where there is room.
      const size = Math.min(W, H) * (W > 900 ? 0.94 : 1.1);
      const ox = (W > 900 ? W * 0.6 : W * 0.5) - size / 2;
      const oy = H * 0.54 - size / 2;
      ctx.clearRect(0, 0, gw, gh);
      ctx.fillStyle = '#000';
      ctx.beginPath();
      for (const ring of rings) {
        for (let i = 0; i < ring.length; i += 2) {
          const x = (ox + ring[i] * size) * s, y = (oy + ring[i + 1] * size) * s;
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.closePath();
      }
      ctx.fill('evenodd'); // islands are holes: their shores make ripples too
      const px = ctx.getImageData(0, 0, gw, gh).data;
      const water = new Uint8Array(gw * gh);
      for (let i = 0; i < water.length; i++) water[i] = px[i * 4 + 3] > 127 ? 1 : 0;

      const INF = 1e12, n = Math.max(gw, gh);
      const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
      const col = new Float64Array(gw * gh), dist = new Float32Array(gw * gh);
      for (let x = 0; x < gw; x++) {
        for (let y = 0; y < gh; y++) f[y] = water[y * gw + x] ? 0 : INF;
        edt1d(f, gh, d, v, z);
        for (let y = 0; y < gh; y++) col[y * gw + x] = d[y];
      }
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) f[x] = col[y * gw + x];
        edt1d(f, gw, d, v, z);
        for (let x = 0; x < gw; x++) dist[y * gw + x] = Math.sqrt(d[x]) / s; // CSS px to the shore
      }
      field = { gw, gh, s, water, dist, fadeLen: Math.max(W, H) * 0.5, ox, oy, size };
      draw();
      chart();
      dispatchEvent(new CustomEvent('kaayko:chart'));   // the compass may now be pointed
    }

    // The lake was fitted as x = lon·cos(mid lat), y = −lat, centred in a square of side `span`.
    function toPx(lon, lat) {
      const [minLon, minLat, maxLon, maxLat] = geo.bbox, { ox, oy, size } = field;
      const kx = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
      const w = (maxLon - minLon) * kx, h = maxLat - minLat, span = Math.max(w, h);
      return [ox + (((lon - minLon) * kx + (span - w) / 2) / span) * size, oy + (((maxLat - lat) + (span - h) / 2) / span) * size, size / (span * 111.32)];
    }

    function chart() {
      let layer = document.getElementById('chart');
      if (!geo) { if (layer) layer.remove(); return; }
      if (!layer) { layer = document.createElement('div'); layer.id = 'chart'; layer.setAttribute('aria-hidden', 'true'); canvas.after(layer); }
      const put = (cls, x, y, html) => { const e = document.createElement('span'); e.className = cls; e.style.left = `${x.toFixed(1)}px`; e.style.top = `${y.toFixed(1)}px`; e.innerHTML = html; layer.append(e); return e; };
      layer.replaceChildren();
      const [, , pxPerKm] = toPx(geo.bbox[0], geo.bbox[1]);
      root.style.setProperty('--km', `${pxPerKm.toFixed(3)}px`);
      if (geo.line) {
        const [, y] = toPx(geo.bbox[0], geo.line[0]);
        const l = document.createElement('div'); l.className = 'chart-line'; l.style.top = `${y.toFixed(1)}px`;
        l.innerHTML = `<b>${geo.line[1]}</b><i>${geo.line[2]}</i>`;
        layer.append(l);
      }
      for (const lat of (geo.grid && geo.grid.lat) || []) { const [, y] = toPx(geo.bbox[0], lat); put('chart-tick chart-lat', 0, y, dms(lat, 'N', 'S')); }
      for (const lon of (geo.grid && geo.grid.lon) || []) { const [x] = toPx(lon, geo.bbox[1]); put('chart-tick chart-lon', x, 0, dms(lon, 'E', 'W')); }
      for (const [name, lon, lat, kind] of geo.places || []) { const [x, y] = toPx(lon, lat); put(`chart-${kind || 'place'}`, x, y, name); }
      avoid();
    }

    // A label under the page's text would cost that text its contrast, so it steps aside.
    let avoidQueued = false;
    function avoid() {
      const layer = document.getElementById('chart');
      if (!layer) return;
      const blocks = [...document.querySelectorAll('.bar, main h1, main h2, main h3, main h4, main p, main li, main .btn, main .cover-wrap, .story, .reader, .pager, .site-footer, .chart-key, .compass')]
        .map((b) => b.getBoundingClientRect()).filter((r) => r.width && r.height);
      const labels = [...layer.querySelectorAll(':scope > :not(.chart-line), .chart-line > *')];
      for (const l of labels) {
        const r = l.getBoundingClientRect(), pad = 6;
        l.classList.toggle('off', blocks.some((b) => r.left < b.right + pad && r.right > b.left - pad && r.top < b.bottom + pad && r.bottom > b.top - pad));
      }
    }
    addEventListener('scroll', () => { if (avoidQueued) return; avoidQueued = true; requestAnimationFrame(() => { avoidQueued = false; avoid(); }); }, { passive: true });

    function draw() {
      if (!field) return;
      const { gw, gh, s, water, dist, fadeLen } = field;
      const cs = getComputedStyle(root);
      const [r, g, b] = hex(cs.getPropertyValue('--ripple'));
      const lineA = parseFloat(cs.getPropertyValue('--ripple-alpha')) || 0.13;
      const fillA = parseFloat(cs.getPropertyValue('--ripple-fill')) || 0.06;
      const A = 11, B = 0.035;
      const img = ctx.createImageData(gw, gh), out = img.data;
      for (let i = 0; i < water.length; i++) {
        let a;
        if (water[i]) a = fillA;
        else {
          const dd = dist[i];
          const phi = Math.log(1 + (B / A) * dd) / B;
          const off = Math.abs(phi - Math.round(phi)) * (A + B * dd); // CSS px from the nearest line
          const cover = Math.min(1, Math.max(0, 1.15 - off * s));
          a = lineA * cover * Math.exp(-dd / fadeLen);
        }
        const o = i * 4;
        out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = a * 255;
      }
      ctx.putImageData(img, 0, 0);
    }

    fetch(canvas.dataset.lake)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length) rings = data;
        else if (data && Array.isArray(data.rings) && data.rings.length) { rings = data.rings; if (data.bbox) geo = data; }
        if (rings) render();
      })
      .catch(() => { /* decorative: the page reads the same without it */ });

    api.render = render;
    api.draw = draw;
    api.avoid = avoid;
    api.toPx = (lon, lat) => (geo && field ? toPx(lon, lat) : null);
    return api;
  }

  window.KaaykoRipples = { mount };
})();
