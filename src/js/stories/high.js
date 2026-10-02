/* Kaayko Stories · the HIGH lighter's air: smoke, sparks and the flame, on one canvas over the page.

   Smoke is a plume of puffs. Each is born hot at the burning edge and rises on its own buoyancy, which
   fades as it cools. It is carried by a swirling, divergence-free current (the curl of a slowly
   changing noise field). The swirl is weak while the puff is hot and young and strong once it has
   cooled, so a thin straight stream breaks into curls the way smoke off a joint does. A puff widens
   as it diffuses and thins as it widens. Moving the pointer through the air stirs it.

   Sparks are thrown up, cool from white through orange to red, and fall.

   The lighter's flame sits at the pointer. It flickers, stretches when moved, and leans away from its
   motion on a spring, so it sways when it stops.

   Nothing runs unless something is in the air. With reduced motion, none of it runs at all. */
window.High = (() => {
  'use strict';
  let motion = () => true;

  // Improved Perlin noise in three dimensions (two of space, one of time).
  const perm = new Uint8Array(512);
  {
    const p = [];
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = 1013904223;
    for (let i = 255; i > 0; i--) { s = (s * 1664525 + 1013904223) >>> 0; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  }
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const mix = (a, b, t) => a + (b - a) * t;
  function grad(h, x, y, z) {
    h &= 15;
    const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }
  function noise(x, y, z) {
    const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
    const X = fx & 255, Y = fy & 255, Z = fz & 255;
    x -= fx; y -= fy; z -= fz;
    const u = fade(x), v = fade(y), w = fade(z);
    const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z, B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
    return mix(
      mix(mix(grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z), u), mix(grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z), u), v),
      mix(mix(grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1), u), mix(grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1), u), v),
      w);
  }
  // The current: curl of the noise potential, in px/s per unit of strength. Divergence-free, so the
  // smoke swirls without bunching up or tearing.
  // Two octaves: broad rolls about 130 px across, and eddies a third that size that turn over faster.
  const EPS = 0.3;
  const C = { x: 0, y: 0 };
  function octave(x, y, t, ns, ts, z) {
    const nx = x * ns, ny = y * ns, nt = t * ts + z;
    return [(noise(nx, ny + EPS, nt) - noise(nx, ny - EPS, nt)) / (2 * EPS), -(noise(nx + EPS, ny, nt) - noise(nx - EPS, ny, nt)) / (2 * EPS)];
  }
  function curl(x, y, t) {
    const a = octave(x, y, t, 1 / 130, 0.16, 0), b = octave(x, y, t, 1 / 42, 0.5, 31.7);
    C.x = a[0] + 0.55 * b[0]; C.y = a[1] + 0.55 * b[1];
    return C;
  }

  // ── the canvas ─────────────────────────────────────────────
  let cv = null, cx = null, dpr = 1, puffImg = null, tint = '', dark = false, raf = 0, last = 0, clock = 0;
  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function ready() {
    if (!cv) {
      cv = document.createElement('canvas');
      cv.className = 'smoke'; cv.setAttribute('aria-hidden', 'true');
      document.body.append(cv);
      cx = cv.getContext('2d');
      size();
      addEventListener('resize', size);
    }
    const t = getComputedStyle(document.documentElement).getPropertyValue('--smoke').trim() || '128,128,128';
    if (t !== tint) {   // one soft puff per theme, stamped for every particle
      tint = t;
      dark = (Number(t.split(',')[0]) || 0) > 150;
      puffImg = document.createElement('canvas'); puffImg.width = puffImg.height = 64;
      const g = puffImg.getContext('2d'), rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      rg.addColorStop(0, `rgba(${t},.62)`); rg.addColorStop(0.45, `rgba(${t},.3)`); rg.addColorStop(0.8, `rgba(${t},.08)`); rg.addColorStop(1, `rgba(${t},0)`);
      g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
    }
    return true;
  }

  // ── the air ────────────────────────────────────────────────
  // Puffs: x, y in page px; vx, vy in px/s; T temperature 0..1; r0 + grow·√age radius; a0 opacity.
  const puffs = [], sparks = [], MAX = 1200;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const BUOY = 62, RISE = 9, TAU = 0.9, SWIRL = 62, RELAX = 2.2;
  function puff(x, y, o = {}) {
    if (puffs.length >= MAX) puffs.splice(0, puffs.length - MAX + 1);
    puffs.push({
      x, y: y + scrollY, vx: o.vx ?? rnd(-12, 12), vy: o.vy ?? rnd(-40, -10), T: (o.T ?? 1) * rnd(0.7, 1),
      r0: o.r0 ?? rnd(1.6, 3), grow: o.grow ?? rnd(9, 16), a0: o.a0 ?? rnd(0.2, 0.3),
      life: o.life ?? rnd(2.2, 3.6), age: 0, relax: o.relax ?? RELAX, swirl: (o.swirl ?? 1) * rnd(0.75, 1.3), fin: o.fin ?? 0.08
    });
  }
  function spark(x, y, o = {}) {
    sparks.push({ x, y: y + scrollY, vx: o.vx ?? rnd(-60, 60), vy: o.vy ?? rnd(-190, -80), life: o.life ?? rnd(0.35, 0.8), age: 0, r: rnd(0.8, 1.6) });
  }
  // The pointer, for stirring the air and for the flame.
  const P = { x: -1e4, y: -1e4, vx: 0, vy: 0, t: 0 };
  addEventListener('pointermove', (e) => {
    const now = performance.now(), dt = Math.max(8, now - P.t) / 1000;
    const vx = (e.clientX - P.x) / dt, vy = (e.clientY - P.y) / dt;
    const k = P.t && now - P.t < 120 ? 0.35 : 1;
    P.vx = mix(P.vx, Math.max(-3000, Math.min(3000, vx)), k); P.vy = mix(P.vy, Math.max(-3000, Math.min(3000, vy)), k);
    P.x = e.clientX; P.y = e.clientY; P.t = now;
  }, { passive: true });

  // Bursts scheduled along a passage: each job reports where its burning edge is at time t.
  const jobs = [];

  // ── the flame ──────────────────────────────────────────────
  // base: where the lighter's nozzle is (client px). lean: tip offset on a spring. heat: 0 (out) .. 1.
  const F = { want: false, kind: 'mouse', x: 0, y: 0, lean: 0, leanV: 0, heat: 0, boost: 0 };
  function flameBase() {
    // A mouse's hotspot sits in the hot lower third of the flame; on a phone the flame rides above
    // the finger, so the words under it stay visible.
    return F.kind === 'touch' ? { x: F.x, y: F.y - 44 } : { x: F.x, y: F.y + 11 };
  }
  function stepFlame(dt) {
    const target = F.want ? 1 : 0;
    F.heat += (target - F.heat) * (1 - Math.exp(-dt * (F.want ? 14 : 22)));
    F.boost *= Math.exp(-dt * 3);
    const moving = performance.now() - P.t < 90;
    const want = Math.max(-17, Math.min(17, -(moving ? P.vx : 0) * 0.03));
    const w = 15, z = 0.42;   // a light, slightly underdamped flame: it sways once when the hand stops
    F.leanV += (w * w * (want - F.lean) - 2 * z * w * F.leanV) * dt;
    F.lean += F.leanV * dt;
  }
  function drawFlame() {
    if (F.heat < 0.02) return;
    const b = flameBase(), t = clock;
    const speed = Math.min(1, Math.hypot(P.vx, P.vy) / 900) * (performance.now() - P.t < 90 ? 1 : 0);
    const H = 30 * F.heat * (1 + 0.11 * noise(t * 7.1, 1.3, 0) + 0.05 * noise(t * 19, 4.2, 0) + 0.22 * speed + 0.25 * F.boost);
    const W = 7.5 * F.heat * (1 - 0.12 * speed);
    const tx = b.x + F.lean + 1.6 * noise(t * 11, 7.7, 0), ty = b.y - H;
    cx.save();
    cx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
    // the light the flame throws on the page
    const glow = cx.createRadialGradient(b.x, b.y - H * 0.45, 0, b.x, b.y - H * 0.45, H * 1.5);
    glow.addColorStop(0, `rgba(255,170,60,${dark ? 0.32 : 0.18})`); glow.addColorStop(1, 'rgba(255,140,40,0)');
    cx.fillStyle = glow; cx.beginPath(); cx.arc(b.x, b.y - H * 0.45, H * 1.5, 0, 6.2832); cx.fill();
    const body = (s) => {
      const w = W * s, h = H * s, x1 = b.x + (tx - b.x) * s, y1 = b.y - h;
      cx.beginPath();
      cx.moveTo(b.x - w, b.y - w * 0.4);
      cx.bezierCurveTo(b.x - w * 1.05, b.y - h * 0.55, x1 - w * 0.25, b.y - h * 0.85, x1, y1);
      cx.bezierCurveTo(x1 + w * 0.25, b.y - h * 0.85, b.x + w * 1.05, b.y - h * 0.55, b.x + w, b.y - w * 0.4);
      cx.arc(b.x, b.y - w * 0.4, w, 0, Math.PI);
      cx.closePath();
    };
    // outer flame: orange at the edges, yellow inside
    const g = cx.createRadialGradient(b.x, b.y - H * 0.28, 0, b.x, b.y - H * 0.28, H * 0.95);
    g.addColorStop(0, '#fffbe8'); g.addColorStop(0.28, '#ffe089'); g.addColorStop(0.6, '#ffa22e'); g.addColorStop(0.88, 'rgba(255,96,16,.75)'); g.addColorStop(1, 'rgba(255,70,10,0)');
    cx.fillStyle = g; body(1); cx.fill();
    // the hot white core
    cx.globalAlpha = 0.9; cx.fillStyle = '#fffdf2'; body(0.42); cx.fill(); cx.globalAlpha = 1;
    // the blue at the root, where the gas burns clean
    const bl = cx.createRadialGradient(b.x, b.y - W * 0.3, 0, b.x, b.y - W * 0.3, W * 1.15);
    bl.addColorStop(0, 'rgba(70,120,255,.75)'); bl.addColorStop(0.6, 'rgba(70,120,255,.35)'); bl.addColorStop(1, 'rgba(70,120,255,0)');
    cx.fillStyle = bl; cx.beginPath(); cx.ellipse(b.x, b.y - W * 0.3, W * 1.05, W * 0.75, 0, 0, 6.2832); cx.fill();
    cx.restore();
  }

  // ── the loop ───────────────────────────────────────────────
  function tick(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now; clock += dt;
    // scheduled emissions
    for (let i = jobs.length - 1; i >= 0; i--) if (jobs[i](now, dt) === false) jobs.splice(i, 1);
    stepFlame(dt);
    cx.clearRect(0, 0, innerWidth, innerHeight);
    const sy = scrollY, stir = now - P.t < 90, px = P.x, py = P.y + sy;
    // smoke
    for (let i = puffs.length - 1; i >= 0; i--) {
      const q = puffs[i];
      q.age += dt;
      if (q.age >= q.life) { puffs.splice(i, 1); continue; }
      q.T *= Math.exp(-dt / TAU);
      const c = curl(q.x, q.y, clock);
      const turb = SWIRL * q.swirl * Math.min(1, Math.pow(q.age / 0.7, 1.5)) * (1 - 0.55 * q.T);
      const k = 1 - Math.exp(-dt * q.relax);
      q.vx += (c.x * turb - q.vx) * k;
      q.vy += (c.y * turb - (BUOY * q.T + RISE) - q.vy) * k;
      if (stir) {   // a hand moved through the smoke drags the air with it
        const dx = q.x - px, dy = q.y - py, d2 = dx * dx + dy * dy;
        if (d2 < 8100) { const f = (1 - Math.sqrt(d2) / 90) ** 2 * Math.min(1, dt * 9); q.vx += (P.vx * 0.55 - q.vx) * f; q.vy += (P.vy * 0.55 - q.vy) * f; }
      }
      q.x += q.vx * dt; q.y += q.vy * dt;
      const r = q.r0 + q.grow * Math.sqrt(q.age);
      const a = q.a0 * Math.min(1, q.age / q.fin) * Math.pow(1 - q.age / q.life, 1.4) * Math.min(1, (q.r0 + 6) / (r + 2) * 1.6);
      if (a < 0.004) continue;
      cx.globalAlpha = a;
      const sp = Math.hypot(q.vx, q.vy), st = 1 + Math.min(0.7, sp / 120);   // drawn a little long along its motion
      if (st > 1.08) {
        const ux = q.vx / sp, uy = q.vy / sp;
        cx.setTransform(dpr * ux * st, dpr * uy * st, -dpr * uy, dpr * ux, dpr * q.x, dpr * (q.y - sy));
        cx.drawImage(puffImg, -r, -r, r * 2, r * 2);
        cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      } else cx.drawImage(puffImg, q.x - r, q.y - sy - r, r * 2, r * 2);
    }
    cx.globalAlpha = 1;
    // sparks
    if (sparks.length) {
      cx.save();
      cx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.age += dt;
        if (s.age >= s.life) { sparks.splice(i, 1); continue; }
        const k = s.age / s.life;
        s.vy += (s.age > 0.08 ? 420 : 0) * dt;          // gravity, once the first lift is spent
        s.vx *= Math.exp(-dt * 1.6); s.vy *= Math.exp(-dt * 0.9);
        s.x += s.vx * dt; s.y += s.vy * dt;
        // it cools: white, yellow, orange, red
        cx.fillStyle = k < 0.15 ? '#fff6d8' : k < 0.4 ? '#ffd24d' : k < 0.7 ? '#ff8a1a' : '#d9400b';
        cx.globalAlpha = 1 - k * k;
        cx.beginPath(); cx.arc(s.x, s.y - sy, s.r * (1 - 0.5 * k), 0, 6.2832); cx.fill();
      }
      cx.restore();
    }
    drawFlame();
    if (puffs.length || sparks.length || jobs.length || F.want || F.heat > 0.02) raf = requestAnimationFrame(tick);
    else { raf = 0; last = 0; cx.clearRect(0, 0, innerWidth, innerHeight); }
  }
  const run = () => { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } };

  // Where a burning edge is, `d` px along a mark's line boxes (client px).
  function along(rects, d) {
    for (const r of rects) { if (d <= r.width) return { x: r.left + d, y: r.top, h: r.height }; d -= r.width; }
    const r = rects[rects.length - 1];
    return { x: r.right, y: r.top, h: r.height };
  }
  const boxes = (marks) => marks.flatMap((m) => [...m.getClientRects()]).filter((r) => r.width > 0);

  return {
    setMotion(fn) { motion = fn; },

    // The lighter. kind is 'mouse' or 'touch'; positions are client px.
    flame(on, kind, x, y) {
      if (!motion()) return;
      if (on) { ready(); F.want = true; if (kind) F.kind = kind; if (x !== undefined) { F.x = x; F.y = y; } run(); }
      else F.want = false;
    },
    flameAt(x, y) { F.x = x; F.y = y; },
    // A flint strike: a fan of sparks where the flame is about to catch, and the flame flares.
    strike(x, y, kind = 'mouse') {
      if (!motion()) return;
      ready();
      const by = kind === 'touch' ? y - 44 : y + 11;
      for (let i = 0; i < 9; i++) spark(x + rnd(-3, 3), by - 2, { vx: rnd(-120, 120), vy: rnd(-260, -90), life: rnd(0.25, 0.55) });
      F.boost = 1;
      run();
    },
    // Paper heating under the flame while it is dragged: a thread of smoke, no more.
    heat(x, y) {
      if (!motion()) return;
      ready();
      if (Math.random() < 0.55) puff(x + rnd(-2, 2), y - 6, { a0: rnd(0.16, 0.26), r0: rnd(1.2, 2), grow: rnd(5, 8), life: rnd(1.4, 2.2), T: 0.8 });
      run();
    },

    // A passage burning. plan: [{ m, w, delay, dur }] in ms, one per mark, in reading order, each
    // mark's edge running at a steady pace (see mark.hl.igniting). The edge throws a stream of smoke
    // and sparks. When it is through, the passage is drawn on once (inhale), breathes out a cloud
    // (exhale) and smoulders.
    burn(plan, edge, lead) {
      if (!motion()) return;
      ready();
      const t0 = performance.now(), end = plan.reduce((s, p) => Math.max(s, p.delay + p.dur), 0);
      const marks = plan.map((p) => p.m);
      jobs.push((now) => {
        const t = now - t0;
        for (const p of plan) {
          if (t < p.delay || t >= p.delay + p.dur) continue;
          const d = (t - p.delay) * (p.w + edge) / p.dur - lead;
          if (d < 0 || d > p.w) continue;
          const rects = [...p.m.getClientRects()].filter((r) => r.width > 0);
          if (!rects.length) continue;
          const from = p.last === undefined ? d : Math.min(p.last, d);
          p.last = d;
          for (let k = 0; k < 4; k++) {   // spread over the stretch the edge crossed since the last frame
            const at = along(rects, from + (d - from) * Math.random());
            puff(at.x + rnd(-2, 2), at.y + at.h * rnd(-0.2, 0.6), { a0: rnd(0.07, 0.14), r0: rnd(2.5, 5.5), vy: rnd(-55, -6), fin: 0.15 });
          }
          const at = along(rects, d);
          puff(at.x - rnd(4, 22), at.y + at.h * rnd(0, 0.5), { a0: rnd(0.06, 0.12), T: 0.6 });
          if (Math.random() < 0.45) spark(at.x, at.y + at.h * rnd(0.3, 0.8));
        }
        return t < end;
      });
      // exhale: once the inhale glow peaks (see .smolder), a breath of smoke leaves from where the burn
      // finished: a jet that opens into a cone, slows against the air and billows, then hangs as haze.
      const ex = performance.now() + end + 650, exEnd = ex + 900;
      jobs.push((now) => {
        if (now < ex) return true;
        if (now > exEnd) return false;
        const rects = boxes(marks);
        if (!rects.length) return false;
        const r = rects[rects.length - 1], ox = r.right, oy = r.top + r.height * 0.35;
        const f = (now - ex) / (exEnd - ex), strength = Math.sin(Math.PI * Math.min(1, f * 1.15));   // a breath: swells, then fades
        for (let k = 0; k < 4; k++) {
          const ang = -Math.PI / 2 + 0.55 + rnd(-0.32, 0.32), sp = rnd(120, 220) * (0.4 + 0.6 * strength);
          puff(ox + rnd(-3, 3), oy + rnd(-3, 3), {
            vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, T: 0.25, relax: 1.15, r0: rnd(3, 6), grow: rnd(22, 32),
            a0: rnd(0.1, 0.18) * (0.5 + 0.5 * strength), life: rnd(2.6, 4), swirl: 1.4, fin: 0.28
          });
        }
        if (Math.random() < 0.12) puff(ox + rnd(10, 60), oy - rnd(20, 70), { vx: rnd(4, 18), vy: rnd(-14, -4), T: 0.1, relax: 0.6, r0: rnd(26, 40), grow: rnd(24, 36), a0: rnd(0.06, 0.1), life: rnd(4.5, 6.5), swirl: 0.6 });
        return true;
      });
      // smoulder: thin wisps from points along the passage, dying away
      const s0 = performance.now() + end, sEnd = s0 + 3200;
      jobs.push((now) => {
        if (now < s0) return true;
        const left = 1 - (now - s0) / (sEnd - s0);
        if (left <= 0) return false;
        if (Math.random() < 0.5 * left) {
          const rects = boxes(marks);
          if (rects.length) { const r = rects[(Math.random() * rects.length) | 0]; puff(r.left + rnd(0, r.width), r.top + r.height * 0.2, { a0: rnd(0.22, 0.36) * left + 0.08, T: 0.9, life: rnd(1.8, 2.6) }); }
        }
        return true;
      });
      run();
    },

    // Putting a passage out: a short white puff off every line, and the last embers falling away.
    douse(rects) {
      if (!motion()) return;
      ready();
      for (const r of rects) {
        for (let x = r.left; x < r.right; x += 7) {
          const ang = rnd(-Math.PI, 0);
          puff(x + rnd(-2, 2), r.top + r.height * rnd(0.2, 0.7), { vx: Math.cos(ang) * rnd(20, 70), vy: Math.sin(ang) * rnd(30, 80) - 10, T: 0.5, relax: 1.6, r0: rnd(3, 6), grow: rnd(10, 16), a0: rnd(0.2, 0.32), life: rnd(1, 1.6) });
          if (Math.random() < 0.18) spark(x, r.top + r.height * 0.6, { vx: rnd(-20, 20), vy: rnd(-40, 10), life: rnd(0.3, 0.6) });
        }
      }
      run();
    }
  };
})();
