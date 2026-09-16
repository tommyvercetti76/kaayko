/* Kortex meteor sky: one fixed canvas behind the page.
   A seeded starfield, and meteors that obey a simple physics model — each
   is a body with position, velocity and a drag term; it ablates as it falls
   (length and brightness follow speed), leaves a trail that cools, and
   occasionally fragments. Showers arrive in gusts from one radiant, like a
   real shower, with lone sporadics between. Pauses when the tab is hidden
   or the sky scrolls out of view; reduced-motion draws one still frame. */
(function () {
  if (!window.HTMLCanvasElement) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'sky'; canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2;

  let W = 0, H = 0, dpr = 1, stars = [], base = null;
  function rng(seed) { let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function buildStars() {
    const r = rng(1729); stars = [];
    const n = Math.round((W * H) / 3800);
    for (let i = 0; i < n; i++) stars.push({ x: r() * W, y: r() * H, m: r() < 0.08 ? 1.6 : r() < 0.3 ? 1.1 : 0.7, tw: r() * TAU, sp: 0.4 + r() * 1.2 });
    base = document.createElement('canvas'); base.width = canvas.width; base.height = canvas.height;
    const b = base.getContext('2d'); b.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = b.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#060b1e'); g.addColorStop(0.45, '#0a1233'); g.addColorStop(0.7, '#0a1129'); g.addColorStop(1, '#080808');
    b.fillStyle = g; b.fillRect(0, 0, W, H);
    // a faint band of haze, the way a dark sky has one
    const hz = b.createRadialGradient(W * 0.62, H * 0.28, 0, W * 0.62, H * 0.28, Math.max(W, H) * 0.55);
    hz.addColorStop(0, 'rgba(120,140,190,0.10)'); hz.addColorStop(1, 'rgba(120,140,190,0)');
    b.fillStyle = hz; b.fillRect(0, 0, W, H);
    stars.forEach(s => { b.fillStyle = `rgba(237,232,223,${s.m > 1.5 ? 0.9 : s.m > 1 ? 0.6 : 0.35})`; b.beginPath(); b.arc(s.x, s.y, s.m, 0, TAU); b.fill(); });
  }

  function resize(force) {
    const nextW = window.innerWidth, nextH = window.innerHeight;
    if (!force && Math.abs(nextW - W) < 4 && Math.abs(nextH - H) < 140) return;
    W = nextW; H = nextH; dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildStars();
  }

  // ── meteors ────────────────────────────────────────────────────────────
  const meteors = [];
  const G = 9;            // px/s² — a gentle pull, so long paths curve
  const DRAG = 0.08;      // per second — the air slows them
  const radiant = { x: 0.78, y: -0.08 };   // where the shower seems to come from
  let gust = 0, nextGust = 2.5, nextSporadic = 1.2;

  function spawn(fromRadiant) {
    const r = Math.random;
    const speed = 380 + r() * 520;
    let x, y, ang;
    if (fromRadiant) {
      x = W * (radiant.x + (r() - 0.5) * 0.5); y = H * (radiant.y + r() * 0.1);
      ang = (Math.PI * 0.62) + (r() - 0.5) * 0.22;             // down-left, slight spread
    } else {
      x = r() * W; y = -20; ang = (Math.PI * 0.45) + (r() - 0.5) * 0.9;
    }
    meteors.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, life: 0, ttl: 0.9 + r() * 1.3, mass: 0.6 + r() * 1.2, trail: [], frag: r() < 0.12 });
  }

  function step(dt) {
    // showers arrive in gusts; sporadics fall alone between them
    nextGust -= dt; nextSporadic -= dt;
    if (nextGust <= 0) { gust = 3 + Math.floor(Math.random() * 5); nextGust = 6 + Math.random() * 9; }
    if (gust > 0 && Math.random() < dt * 4) { spawn(true); gust--; }
    if (nextSporadic <= 0) { spawn(false); nextSporadic = 1.5 + Math.random() * 4; }

    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.vy += G * dt; m.vx *= (1 - DRAG * dt); m.vy *= (1 - DRAG * dt);
      m.x += m.vx * dt; m.y += m.vy * dt; m.life += dt;
      m.trail.push({ x: m.x, y: m.y, t: m.life });
      if (m.trail.length > 26) m.trail.shift();
      if (m.frag && m.life > m.ttl * 0.55 && m.mass > 0.7) {   // it breaks: two smaller bodies, a little sideways
        m.frag = false; m.mass *= 0.6;
        meteors.push({ x: m.x, y: m.y, vx: m.vx * 0.9 + (Math.random() - 0.5) * 90, vy: m.vy * 0.9, life: 0, ttl: 0.5 + Math.random() * 0.5, mass: m.mass * 0.5, trail: [], frag: false });
      }
      if (m.life > m.ttl || m.y > H + 40 || m.x < -60 || m.x > W + 60) meteors.splice(i, 1);
    }
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(base, 0, 0, W, H);
    // twinkle: a handful of stars breathe
    const t = performance.now() / 1000;
    for (let i = 0; i < stars.length; i += 7) { const s = stars[i]; const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * s.sp + s.tw)); ctx.fillStyle = `rgba(237,232,223,${a})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.m, 0, TAU); ctx.fill(); }
    for (const m of meteors) {
      const speed = Math.hypot(m.vx, m.vy);
      const fade = m.life < m.ttl * 0.15 ? m.life / (m.ttl * 0.15) : 1 - Math.max(0, (m.life - m.ttl * 0.7) / (m.ttl * 0.3));
      const glow = Math.min(1, speed / 700) * m.mass * fade;
      // the trail cools: bright and warm at the head, faint and blue at the tail
      for (let k = 1; k < m.trail.length; k++) {
        const a = m.trail[k - 1], b = m.trail[k], f = k / m.trail.length;
        ctx.strokeStyle = `rgba(${Math.round(217 + 38 * f)},${Math.round(189 + 40 * f)},${Math.round(123 + 90 * f)},${(0.05 + 0.5 * f * f) * glow})`;
        ctx.lineWidth = 0.4 + 1.6 * f * m.mass;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.fillStyle = `rgba(255,250,235,${0.9 * glow})`;
      ctx.beginPath(); ctx.arc(m.x, m.y, 0.9 + m.mass * 0.9, 0, TAU); ctx.fill();
    }
  }

  let last = 0, running = false, raf = 0, visible = true;
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    step(dt); draw();
    raf = requestAnimationFrame(frame);
  }
  function start() { if (running || reduced || !visible || document.hidden) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  resize(true);
  if (reduced) { for (let i = 0; i < 4; i++) { spawn(i % 2 === 0); } for (let i = 0; i < 40; i++) step(0.03); draw(); }
  else start();
  window.addEventListener('resize', () => { resize(false); if (reduced) draw(); }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) start(); else stop(); }).observe(canvas);
  }
})();
