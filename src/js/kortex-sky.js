/* Kortex sky: shared by the landing page and the samples page. */
/* ── THE SKY — one fixed canvas behind the whole page ──
   Deep-space ground, a faint star-chart grid, a seeded starfield, a soft band
   of haze, and nine real constellations (stars at their J2000 right ascension
   and declination) lit one at a time: stars brighten, every link between them
   shines at once, pulses travel the links, then it fades and the next one
   rises. The canvas is fixed to the viewport, so the sky never scrolls; the
   page moves over it on glass plates. Only a real size change rebuilds it. */
(function() {
  if (!window.HTMLCanvasElement) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'sky'; canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2;

  // Right ascension in hours, declination in degrees, magnitude class (1 = bright, 2 = mid, 3 = faint).
  const CONSTELLATIONS = [
    { name: 'orion', stars: [[5.919,7.407,1],[5.419,6.350,2],[5.586,9.934,3],[5.679,-1.943,2],[5.604,-1.202,2],[5.533,-0.299,2],[5.796,-9.670,2],[5.242,-8.202,1]],
      edges: [[0,2],[1,2],[0,3],[1,5],[3,4],[4,5],[3,6],[5,7],[6,7]] },
    { name: 'ursa major', stars: [[11.062,61.751,1],[11.031,56.383,2],[11.897,53.695,2],[12.257,57.033,3],[12.900,55.960,1],[13.399,54.925,2],[13.792,49.313,1]],
      edges: [[6,5],[5,4],[4,3],[3,2],[2,1],[1,0],[0,3]] },
    { name: 'cassiopeia', stars: [[0.153,59.150,2],[0.675,56.537,1],[0.945,60.717,2],[1.430,60.235,3],[1.907,63.670,3]],
      edges: [[0,1],[1,2],[2,3],[3,4]] },
    { name: 'cygnus', stars: [[20.690,45.280,1],[20.370,40.257,2],[19.512,27.960,2],[19.749,45.131,3],[20.770,33.970,2]],
      edges: [[0,1],[1,2],[3,1],[1,4]] },
    { name: 'leo', stars: [[10.140,11.967,1],[10.122,16.763,3],[10.333,19.842,2],[10.278,23.417,3],[9.879,26.007,3],[9.764,23.774,3],[11.235,20.524,2],[11.237,15.430,3],[11.818,14.572,1]],
      edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[2,6],[6,8],[8,7],[7,0],[7,6]] },
    { name: 'scorpius', stars: [[16.091,-19.805,2],[16.006,-22.622,2],[15.981,-26.114,2],[16.490,-26.432,1],[16.598,-28.216,3],[16.836,-34.293,2],[16.864,-38.047,2],[16.909,-42.362,2],[17.203,-43.239,3],[17.622,-42.998,2],[17.708,-39.030,2],[17.560,-37.104,1],[17.793,-40.127,3],[17.512,-37.296,3]],
      edges: [[0,1],[1,2],[1,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13]] },
    { name: 'lyra', stars: [[18.616,38.784,1],[18.739,39.670,3],[18.746,37.605,3],[18.908,36.899,3],[18.982,32.690,2],[18.835,33.363,2]],
      edges: [[0,1],[0,2],[2,3],[3,4],[4,5],[5,2]] },
    { name: 'gemini', stars: [[7.577,31.888,1],[7.755,28.026,1],[7.186,30.245,3],[6.732,25.131,2],[6.383,22.514,3],[6.248,22.507,3],[7.335,21.982,2],[7.068,20.570,3],[6.629,16.399,2]],
      edges: [[0,2],[2,3],[3,4],[4,5],[1,6],[6,7],[7,8],[2,6]] },
    { name: 'taurus', stars: [[4.599,16.509,1],[5.438,28.607,2],[5.627,21.143,3],[4.330,15.628,3],[4.383,17.543,3],[4.477,19.180,3],[4.477,15.871,3],[4.011,12.490,3]],
      edges: [[0,6],[6,3],[3,4],[4,5],[5,1],[0,2],[3,7]] }
  ];
  CONSTELLATIONS.forEach(c => {
    const ra0 = c.stars.reduce((t, st) => t + st[0], 0) / c.stars.length;
    const dec0 = c.stars.reduce((t, st) => t + st[1], 0) / c.stars.length;
    const cosD = Math.cos(dec0 * Math.PI / 180);
    const pts = c.stars.map(st => ({ x: -(st[0] - ra0) * 15 * cosD, y: -(st[1] - dec0), m: st[2] || 3 }));
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const span = Math.max(maxX - minX, maxY - minY) || 1;
    c.points = pts.map(p => ({ x: (p.x - minX) / span, y: (p.y - minY) / span, m: p.m }));
    c.w = (maxX - minX) / span; c.h = (maxY - minY) / span;
  });

  function mulberry32(a) { return function() { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  let W = 0, H = 0, dpr = 1, stars = [], twinklers = [], base = null, sprites = {}, running = false, raf = 0, lastFrame = 0, startTs = 0;
  let order = [], current = 0, phaseStart = 0;
  const PERIOD = 9000, STAR_IN = 1100, LINE_IN = 1700, FADE_OUT = 7600;

  function sprite(radius, glow, warm) {
    const size = Math.ceil((radius + glow) * 2 + 2);
    const c = document.createElement('canvas'); c.width = c.height = Math.ceil(size * dpr);
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = size / 2, cy = size / 2;
    const halo = g.createRadialGradient(cx, cy, 0, cx, cy, radius + glow);
    halo.addColorStop(0, warm ? 'rgba(232,206,150,0.55)' : 'rgba(220,226,245,0.5)');
    halo.addColorStop(0.35, warm ? 'rgba(217,189,123,0.16)' : 'rgba(205,214,236,0.14)');
    halo.addColorStop(1, 'rgba(217,189,123,0)');
    g.fillStyle = halo; g.beginPath(); g.arc(cx, cy, radius + glow, 0, TAU); g.fill();
    g.fillStyle = warm ? 'rgba(252,246,232,1)' : 'rgba(240,244,255,1)';
    g.beginPath(); g.arc(cx, cy, radius, 0, TAU); g.fill();
    // Diffraction spikes on the brightest class.
    if (radius >= 2.4) {
      g.strokeStyle = 'rgba(245,235,210,0.55)'; g.lineWidth = 0.7;
      g.beginPath(); g.moveTo(cx - radius * 3.2, cy); g.lineTo(cx + radius * 3.2, cy); g.moveTo(cx, cy - radius * 3.2); g.lineTo(cx, cy + radius * 3.2); g.stroke();
    }
    return { c, size };
  }

  function buildStars() {
    const rnd = mulberry32(20260903);
    const count = W < 520 ? 170 : W < 1100 ? 300 : 420;
    stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({ x: rnd(), y: rnd(), r: 0.3 + rnd() * 1.1, a: 0.2 + rnd() * 0.6, ph: rnd() * TAU, sp: 0.35 + rnd() * 1.1, cool: rnd() < 0.32 });
    }
    twinklers = stars.filter((st, i) => i % 5 === 0);
    order = CONSTELLATIONS.map((c, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    sprites = { 1: sprite(2.6, 18, true), 2: sprite(1.9, 11, true), 3: sprite(1.35, 7, false) };
  }

  function renderBase() {
    base = document.createElement('canvas');
    base.width = canvas.width; base.height = canvas.height;
    const b = base.getContext('2d');
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Ground
    const grad = b.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#060b1e'); grad.addColorStop(0.45, '#0a1233'); grad.addColorStop(0.72, '#0a1129'); grad.addColorStop(1, '#080808');
    b.fillStyle = grad; b.fillRect(0, 0, W, H);
    // A soft band of haze, the way a dark-sky night actually looks.
    for (let i = 0; i < 7; i++) {
      const t = i / 6, cx = W * (0.05 + 0.9 * t), cy = H * (0.78 - 0.62 * t) + Math.sin(i * 1.7) * H * 0.05;
      const rad = Math.max(W, H) * (0.16 + (i % 3) * 0.05);
      const g = b.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, 'rgba(120,140,200,0.075)'); g.addColorStop(0.5, 'rgba(120,140,200,0.03)'); g.addColorStop(1, 'rgba(120,140,200,0)');
      b.fillStyle = g; b.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    // Star-chart grid: gentle arcs of declination and meridians, barely there.
    b.strokeStyle = 'rgba(181,147,90,0.07)'; b.lineWidth = 0.6;
    for (let i = 1; i <= 5; i++) {
      const cy = H * 1.9, r = H * 1.9 - H * (i / 6) + H * 0.1;
      b.beginPath(); b.arc(W / 2, cy, r, Math.PI * 1.08, Math.PI * 1.92); b.stroke();
    }
    for (let i = 0; i <= 8; i++) {
      const x0 = W * (i / 8);
      b.beginPath(); b.moveTo(x0, 0); b.quadraticCurveTo(W / 2 + (x0 - W / 2) * 0.55, H * 0.55, x0, H); b.stroke();
    }
    // Stars
    stars.forEach((st, i) => {
      if (i % 5 === 0) return; // twinklers are drawn live
      b.fillStyle = st.cool ? `rgba(205,214,236,${st.a * 0.9})` : `rgba(237,232,223,${st.a})`;
      b.beginPath(); b.arc(st.x * W, st.y * H, st.r, 0, TAU); b.fill();
    });
  }

  function resize(force) {
    // A viewport can report zero (a hidden tab, a pane that is not laid out);
    // a zero-area canvas makes every later drawImage throw, so never go below 1.
    const nextW = Math.max(1, Math.round(window.innerWidth)), nextH = Math.max(1, Math.round(window.innerHeight));
    // Address-bar height changes on phones are ignored; a real resize rebuilds.
    if (!force && Math.abs(nextW - W) < 4 && Math.abs(nextH - H) < 140) return;
    W = nextW; H = nextH;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildStars(); renderBase();
  }

  // Where the lit constellation sits: beside the wordmark on wide screens,
  // above it on phones, always inside the safe area so nothing is clipped.
  function placement(index) {
    const c = CONSTELLATIONS[order[index % order.length]];
    const phone = W < 700;
    // Measure the wordmark block first; the figure is sized to the room beside it.
    const inner = document.querySelector('.hero-inner');
    const box = inner ? inner.getBoundingClientRect() : null;
    const roomLeft = box ? box.left : W * 0.3, roomRight = box ? W - box.right : W * 0.3;
    const sideRoom = Math.max(roomLeft, roomRight);
    const wide = !phone && sideRoom >= 250;
    const boxW = phone ? Math.min(W * 0.62, 300) : wide ? Math.min(W * 0.30, 440, sideRoom - 44) : Math.min(W * 0.5, 380);
    const scale = boxW / Math.max(c.w, 0.001);
    let w = c.w * scale, h = c.h * scale;
    const maxH = phone ? H * 0.28 : H * 0.62;
    if (h > maxH) { const k = maxH / h; w *= k; h *= k; }
    const side = index % 2 === 0 ? -1 : 1;
    const useLeft = wide ? (roomLeft >= roomRight ? side < 0 || roomRight < w + 44 : side < 0 && roomLeft >= w + 44) : false;
    // No room beside the wordmark (phones, short windows): sit behind it, dimmed, like a chart under glass.
    const cx = !wide ? W * 0.5 : useLeft ? roomLeft / 2 : W - roomRight / 2;
    const cy = !wide ? (box ? box.top + box.height * 0.32 : H * 0.35) : H * 0.48;
    if (!wide) { const k = Math.min(1, Math.min(W * 0.62, 380) / Math.max(w, 1), (H * 0.42) / Math.max(h, 1)); w *= k; h *= k; }
    return { c, x: Math.max(16, Math.min(W - w - 16, cx - w / 2)), y: Math.max(16, cy - h / 2), w, h, dim: wide ? 1 : 0.45 };
  }

  function ease(t) { t = Math.max(0, Math.min(1, t)); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function drawConstellation(place, starA, lineA, t, dim) {
    const { c, x, y, w, h } = place;
    const pts = c.points.map(p => ({ x: x + p.x * w, y: y + p.y * h, m: p.m }));
    const lA = lineA * dim, sA = starA * dim;
    if (lA > 0) {
      c.edges.forEach(([i, j], k) => {
        const a = pts[i], b = pts[j];
        ctx.lineWidth = 4.5; ctx.strokeStyle = `rgba(217,189,123,${lA * 0.10})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.lineWidth = 0.9; ctx.strokeStyle = `rgba(242,230,205,${lA * 0.78})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        // A pulse travelling each link: the scans a link carries.
        const u = ((t * 0.16) + k * 0.37) % 1;
        const px = a.x + (b.x - a.x) * u, py = a.y + (b.y - a.y) * u;
        const g = ctx.createRadialGradient(px, py, 0, px, py, 6);
        g.addColorStop(0, `rgba(250,240,215,${lA * 0.75})`); g.addColorStop(1, 'rgba(217,189,123,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 6, 0, TAU); ctx.fill();
      });
    }
    pts.forEach(p => {
      const sp = sprites[p.m] || sprites[3];
      ctx.globalAlpha = 0.28 + sA * 0.72;
      ctx.drawImage(sp.c, p.x - sp.size / 2, p.y - sp.size / 2, sp.size, sp.size);
      ctx.globalAlpha = 1;
    });
    if (lA > 0.05 && dim >= 0.99) { // no label when the figure sits behind the wordmark
      const cx = x + w / 2, ly = y + h + 26;
      ctx.strokeStyle = `rgba(181,147,90,${lA * 0.5})`; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(cx - 34, ly - 9); ctx.lineTo(cx + 34, ly - 9); ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = 'italic 13px "Cormorant Garamond", Georgia, serif';
      ctx.fillStyle = `rgba(217,189,123,${lA * 0.95})`;
      ctx.fillText(c.name.split('').join(' '), cx, ly + 6);
      ctx.font = '10px ui-monospace, Menlo, monospace';
      ctx.fillStyle = `rgba(237,232,223,${lA * 0.5})`;
      ctx.fillText(`${c.points.length} stars · ${c.edges.length} links`, cx, ly + 22);
    }
  }

  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    if (base) ctx.drawImage(base, 0, 0, W, H);
    const t = (now - startTs) / 1000;
    twinklers.forEach(st => {
      const a = st.a * (0.55 + 0.45 * Math.sin(t * st.sp + st.ph));
      ctx.fillStyle = st.cool ? `rgba(205,214,236,${a})` : `rgba(237,232,223,${a})`;
      ctx.beginPath(); ctx.arc(st.x * W, st.y * H, st.r + 0.3, 0, TAU); ctx.fill();
    });
    const elapsed = now - phaseStart;
    if (elapsed >= PERIOD) { current = (current + 1) % order.length; phaseStart = now; }
    const e = now - phaseStart;
    const starA = e < STAR_IN ? ease(e / STAR_IN) : e < FADE_OUT ? 1 : 1 - ease((e - FADE_OUT) / (PERIOD - FADE_OUT));
    const lineA = e < STAR_IN ? 0 : e < LINE_IN ? ease((e - STAR_IN) / (LINE_IN - STAR_IN)) : e < FADE_OUT ? 1 : 1 - ease((e - FADE_OUT) / (PERIOD - FADE_OUT));
    // Past the hero the constellation stays, quieter, behind the plates.
    const scrolled = Math.min(1, Math.max(0, (window.scrollY || 0) / Math.max(1, H * 0.9)));
    const dim = 1 - scrolled * 0.7;
    const place = placement(current);
    drawConstellation(place, starA, lineA, t, dim * (place.dim || 1));
  }

  function frame(ts) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const budget = (window.scrollY || 0) > H ? 50 : 33; // 20 fps once the sky is mostly behind plates
    if (ts - lastFrame < budget) return;
    lastFrame = ts;
    draw(ts);
  }
  function start() { if (running || reduced) return; running = true; if (!startTs) { startTs = performance.now(); phaseStart = startTs; } raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  function drawStill() { const now = performance.now(); startTs = now; phaseStart = now - LINE_IN - 500; draw(now); }

  resize(true);
  startTs = phaseStart = performance.now();
  draw(startTs);
  let resizeTimer = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { resize(false); if (reduced) drawStill(); }, 200); });
  if (reduced) {
    drawStill();
  } else {
    start();
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
  }
})();
