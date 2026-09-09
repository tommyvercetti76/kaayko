/**
 * arcade/endless.js — Mail Run, forever.
 *
 * A SEPARATE game from the scored Mail Run. It shares nothing with gameRules.js
 * and posts nothing to the server, on purpose: the scored run is worth 2% off an
 * order and is replayed server-side, so nothing here is allowed near it. Deleting
 * this file would leave the paid game exactly as it is.
 *
 * Hold to climb, let go to fall, thread the towers and collect the letters. It
 * never ends and it never stops getting harder — every ten deliveries the towers
 * come faster, the gaps narrow, and a new hazard is introduced in a fixed order so
 * a player always meets one thing at a time:
 *
 *    10   crosswinds      a steady push, alternating
 *    20   mail sacks      static hazards floating in the gaps
 *    30   moving towers   the gap drifts up and down
 *    40   night           the ground light drops away
 *    50+  everything, and faster
 *
 * There is always a way out. Escape or P pauses, and the pause menu is a real menu
 * — resume, restart, how to play, leave — not a modal you have to guess at.
 */

const STEP = 1 / 60;
const GRAVITY = 1.05, LIFT = -1.32, VMAX = 0.64;
const PLANE_X = 0.22, PLANE_R = 0.034, POST_W = 0.036;

const SKY = { top: "#05070f", mid: "#141a3a", low: "#2b2f57", ground: "#3b3252" };
const PAPER = "#f3e8d2", PAPER_EDGE = "#cdbb96";
const GOLD = "#e8c07a", GOLD_LIT = "#fff0bf";

const rnd = (a) => { let s = a >>> 0; return () => {
  s = (s + 0x6D2B79F5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}; };

/** What is switched on at a given score. Fixed order, so it is learnable. */
export function stageAt(score) {
  return {
    speed: 0.30 + Math.min(0.34, Math.floor(score / 10) * 0.045),
    gap: Math.max(0.235, 0.42 - Math.floor(score / 10) * 0.021),
    wind: score >= 10,
    sacks: score >= 20,
    drift: score >= 30,
    night: score >= 40,
    name: score >= 40 ? "Night mail" : score >= 30 ? "Moving towers"
        : score >= 20 ? "Mail sacks" : score >= 10 ? "Crosswinds" : "Fair weather"
  };
}

function fit(canvas, ctx) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr; canvas.height = h * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{onScore?:(n:number)=>void, onEnd?:(r:object)=>void, best?:number}} opts
 */
export function endless(canvas, opts = {}) {
  const ctx = canvas.getContext("2d");
  let raf = 0, last = 0, acc = 0, step = 0;
  let running = false, paused = false, dead = false;

  let y = 0.5, v = 0, down = false, score = 0, dist = 0;
  let posts = [], letters = [], sacks = [], puffs = [];
  let rng = rnd(Date.now() & 0xffff);
  let nextPost = 1.15, nextLetter = 1.8;
  const trail = [];

  const stage = () => stageAt(score);

  function reset() {
    y = 0.5; v = 0; down = false; score = 0; dist = 0; dead = false;
    posts = []; letters = []; sacks = []; puffs = []; trail.length = 0;
    nextPost = 1.15; nextLetter = 1.8; step = 0; acc = 0; last = 0;
    rng = rnd((Date.now() ^ (Math.random() * 1e9)) & 0xffffffff);
  }

  function spawn(t) {
    const s = stage();
    while (nextPost < dist + 2.2) {
      posts.push({
        id: posts.length, x: nextPost,
        gapY: 0.26 + rng() * 0.46,
        gap: s.gap,
        drift: s.drift ? (rng() - 0.5) * 0.34 : 0,
        phase: rng() * 6.28,
        scored: false
      });
      nextPost += 0.60 + rng() * 0.16;
    }
    while (nextLetter < dist + 2.2) {
      letters.push({ id: letters.length, x: nextLetter, y: 0.22 + rng() * 0.56, got: false });
      nextLetter += 0.75 + rng() * 0.7;
      if (s.sacks && rng() < 0.55) {
        sacks.push({ x: nextLetter - 0.45, y: 0.2 + rng() * 0.6, r: 0.03 });
      }
    }
  }

  const gapAt = (p, t) => p.drift ? p.gapY + Math.sin(t * 0.9 + p.phase) * p.drift * 0.5 : p.gapY;

  function tick() {
    const s = stage(), t = step * STEP;
    dist += s.speed * STEP;

    v += (down ? LIFT : GRAVITY) * STEP;
    if (s.wind) v += Math.sin(t * 0.42) * 0.34 * STEP;      // a steady push, alternating
    v = Math.max(-VMAX, Math.min(VMAX, v));
    y += v * STEP;
    trail.push(y); if (trail.length > 30) trail.shift();

    if (y < PLANE_R || y > 1 - PLANE_R) return end();

    spawn(t);
    for (const p of posts) {
      const px = p.x - dist;
      const g = gapAt(p, t);
      if (Math.abs(px - PLANE_X) < POST_W + PLANE_R &&
          (y < g - p.gap / 2 || y > g + p.gap / 2)) return end();
      if (!p.scored && px < PLANE_X - POST_W) { p.scored = true; }
    }
    for (const L of letters) {
      if (L.got) continue;
      const lx = L.x - dist;
      // A generous catch. The difficulty is threading the towers; making the pickup
      // pixel-perfect on top of that just reads as the game cheating you.
      if (Math.abs(lx - PLANE_X) < 0.058 && Math.abs(L.y - y) < 0.078) {
        L.got = true; score += 1;
        puffs.push({ x: PLANE_X, y, life: 0.4 });
        opts.onScore?.(score);
      }
    }
    for (const k of sacks) {
      const kx = k.x - dist;
      if (Math.abs(kx - PLANE_X) < k.r + PLANE_R && Math.abs(k.y - y) < k.r + PLANE_R) return end();
    }
    for (let i = puffs.length - 1; i >= 0; i--) {
      puffs[i].life -= STEP; if (puffs[i].life <= 0) puffs.splice(i, 1);
    }
    posts = posts.filter((p) => p.x - dist > -0.3);
    letters = letters.filter((L) => L.x - dist > -0.3);
    sacks = sacks.filter((k) => k.x - dist > -0.3);
  }

  function end() {
    dead = true; running = false;
    cancelAnimationFrame(raf);
    opts.onEnd?.({ score, stage: stage().name });
  }

  function draw(w, h) {
    const s = stage(), t = step * STEP;
    const dark = s.night ? 0.55 : 1;

    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, SKY.top);
    sky.addColorStop(0.45, s.night ? "#0b0f22" : SKY.mid);
    sky.addColorStop(0.8, s.night ? "#171a33" : SKY.low);
    sky.addColorStop(1, s.night ? "#221d33" : SKY.ground);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = `rgba(255,255,255,${0.30 * (s.night ? 1.5 : 1)})`;
    for (let i = 0; i < 30; i++) {
      let sx = (i * 149.3 - dist * 40) % w; if (sx < 0) sx += w;
      ctx.fillRect(sx, (i * 61.7) % (h * 0.62), 1.6, 1.6);
    }

    ctx.fillStyle = s.night ? "#080a18" : "#0d1128";
    for (let i = 0; i < 26; i++) {
      let bx = (i * 71 - dist * 26) % (w + 80); if (bx < -80) bx += w + 80;
      const bh = 16 + ((i * 37) % 40);
      ctx.fillRect(bx, h - bh, 30, bh);
    }

    for (const p of posts) {
      const x = (p.x - dist) * w, pw = POST_W * w;
      if (x < -pw * 3 || x > w + pw * 3) continue;
      const g = gapAt(p, t) * h, half = (p.gap * h) / 2;
      const tower = (yy, hh) => {
        if (hh <= 0) return;
        const tg = ctx.createLinearGradient(x - pw, 0, x + pw, 0);
        tg.addColorStop(0, "#080b1d"); tg.addColorStop(0.22, "#242a52");
        tg.addColorStop(0.5, "#171c3c"); tg.addColorStop(1, "#05060f");
        ctx.fillStyle = tg; ctx.fillRect(x - pw, yy, pw * 2, hh);
        for (let wy = yy + 10; wy < yy + hh - 7; wy += 14) {
          const lit = ((wy * 3 + p.id * 17) | 0) % 5;
          if (lit === 0) continue;
          ctx.fillStyle = `rgba(255,226,158,${(lit === 1 ? 0.75 : 0.32) * dark})`;
          ctx.fillRect(x - pw + 5, wy, 4, 6);
          ctx.fillRect(x + pw - 9, wy, 4, 6);
        }
      };
      tower(0, g - half);
      tower(g + half, h - (g + half));
      ctx.fillStyle = GOLD;
      ctx.fillRect(x - pw - 5, g - half - 5, pw * 2 + 10, 5);
      ctx.fillRect(x - pw - 5, g + half, pw * 2 + 10, 5);
    }

    for (const k of sacks) {
      const kx = (k.x - dist) * w;
      if (kx < -40 || kx > w + 40) continue;
      const r = k.r * w;
      ctx.beginPath(); ctx.arc(kx, k.y * h, r, 0, Math.PI * 2);
      ctx.fillStyle = "#6b5a3e"; ctx.fill();
      ctx.strokeStyle = "#2b2418"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "#2b2418";
      ctx.fillRect(kx - r * 0.5, k.y * h - r * 0.15, r, 3);
    }

    for (const L of letters) {
      if (L.got) continue;
      const lx = (L.x - dist) * w;
      if (lx < -40 || lx > w + 40) continue;
      const ly = L.y * h, ew = Math.min(26, w * 0.035), eh = ew * 0.62;
      ctx.fillStyle = PAPER;
      ctx.fillRect(lx - ew / 2, ly - eh / 2, ew, eh);
      ctx.strokeStyle = PAPER_EDGE; ctx.lineWidth = 1.4;
      ctx.strokeRect(lx - ew / 2, ly - eh / 2, ew, eh);
      ctx.beginPath();
      ctx.moveTo(lx - ew / 2, ly - eh / 2); ctx.lineTo(lx, ly + 1); ctx.lineTo(lx + ew / 2, ly - eh / 2);
      ctx.stroke();
    }

    for (const p of puffs) {
      const a = p.life / 0.4;
      ctx.globalAlpha = a; ctx.strokeStyle = GOLD_LIT; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x * w, p.y * h, 10 + (1 - a) * 28, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    const px = PLANE_X * w;
    trail.forEach((ty, i) => {
      const a = i / trail.length;
      ctx.globalAlpha = a * 0.45; ctx.fillStyle = a > 0.7 ? "#fff6e2" : GOLD;
      const sz = 1 + a * 2.4;
      ctx.fillRect(px - (trail.length - i) * 2.6, ty * h - sz / 2, sz, sz);
    });
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(px, y * h);
    ctx.rotate(Math.max(-0.5, Math.min(0.55, v * 0.62)));
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath(); ctx.moveTo(18, 2); ctx.lineTo(-14, -9); ctx.lineTo(-7, 2); ctx.lineTo(-14, 12);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = PAPER;
    ctx.beginPath(); ctx.moveTo(17, 0); ctx.lineTo(-14, -10); ctx.lineTo(-7, 0); ctx.lineTo(-14, 10);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(90,70,40,0.6)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(17, 0); ctx.lineTo(-7, 0); ctx.stroke();
    ctx.fillStyle = "#b4653f"; ctx.fillRect(-2, -3.5, 8, 1.6);
    ctx.restore();
  }

  function frame(now) {
    if (!running) return;
    if (!last) last = now;
    acc += Math.min(0.25, (now - last) / 1000);
    last = now;
    while (acc >= STEP) { acc -= STEP; tick(); step += 1; if (dead) return; }
    const { w, h } = fit(canvas, ctx);
    ctx.clearRect(0, 0, w, h);
    draw(w, h);
    raf = requestAnimationFrame(frame);
  }

  const api = {
    start() { reset(); running = true; paused = false; raf = requestAnimationFrame(frame); },
    hold(on) { if (running && !paused) down = !!on; },
    pause() { if (!running || paused) return false; paused = true; running = false;
              cancelAnimationFrame(raf); return true; },
    resume() { if (!paused) return; paused = false; running = true; last = 0;
               raf = requestAnimationFrame(frame); },
    stop() { running = false; paused = false; cancelAnimationFrame(raf); },
    get score() { return score; },
    get paused() { return paused; },
    get stageName() { return stage().name; },
    paint() { const { w, h } = fit(canvas, ctx); ctx.clearRect(0, 0, w, h); draw(w, h); }
  };
  reset();
  api.paint();
  return api;
}
