/**
 * arcade/shipping.js — Kaayko Shipping.
 *
 * A SEPARATE game from the scored Mail Run on a product page. It shares no code
 * with gameRules.js and posts nothing to a server, on purpose: that game is worth
 * 2% off an order and is replayed server-side, so nothing here goes near it.
 *
 * The flight model is untouched from the endless run, because it was right:
 * gravity 1.05, lift -1.32, terminal 0.64, and with no input the plane falls from
 * 0.5 to the floor in 0.94s exactly as those numbers predict. Everything added
 * here is built around that, not on top of it.
 *
 * ── Pick up and drop off ────────────────────────────────────────────────────
 * Fly through a parcel to pick it up. A second control appears; press it — press,
 * not hold — and the parcel is released. It then flies on its own: it keeps some
 * of your fall and all of your forward speed, and the air takes the forward speed
 * back. So you release EARLY and lead the pad, which is the whole skill.
 *
 * The rules, in the order they are checked:
 *   1  you can carry one parcel at a time, and only one
 *   2  release does nothing unless you are carrying
 *   3  a released parcel falls at 2.1, faster than the plane, and cannot be caught
 *   4  it carries the plane's forward speed and loses it to drag, so it lands
 *      ahead of the release point and short of the plane
 *   5  it is delivered if it touches the pad between the pad's left and right edge
 *   6  anything else — ground, roof, off the back of the screen — is a miss
 *   7  a miss costs nothing but the parcel; only deliveries score
 *
 * ── The sky ────────────────────────────────────────────────────────────────
 * Four phases taken from the player's own clock, not a timer: dawn, day, dusk,
 * night. Every phase carries its own palette AND its own ink for towers, parcels
 * and pads, so contrast never depends on which hour somebody opens the page. The
 * palettes are all checked for contrast against their own sky before shipping.
 */

const STEP = 1 / 60;
const GRAVITY = 1.05, LIFT = -1.32, VMAX = 0.64;      // do not touch: verified
const PARCEL_FALL = 2.1;                              // a dropped parcel beats the plane down
const PARCEL_DRAG = 0.85;                             // 1/s; how fast it loses the throw
const PLANE_X = 0.22, PLANE_R = 0.034, POST_W = 0.036;
const GROUND = 0.895;                                 // where the city floor sits

const rnd = (a) => { let s = a >>> 0; return () => {
  s = (s + 0x6D2B79F5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}; };

/* ── the sky, by the clock ─────────────────────────────────────────────────
   Each phase names every colour it needs. Nothing is derived at runtime, so a
   palette can be read, checked and corrected as a single object.            */
export const PHASES = {
  dawn: {
    // Dawn is the cool one — light comes up the sky before it warms. Dusk is
    // the deep one. They shared a palette at first and read as the same picture.
    label: "Dawn", sky: ["#4d5490", "#9a86ad", "#c98269", "#f0cba4"],
    far: "#6a5f84", near: "#3b3350", hill: "#8d7ca4", cloud: "#f7e6d4", tower: "#2c2440", towerLit: "#6d6088",
    edge: "#ffd9a0", parcel: "#fff6e2", parcelEdge: "#8a6a3a",
    pad: "#3fae7a", padLit: "#9fe8c4", plane: "#fffaf0", ink: "#1a1220",
    star: 0.12
  },
  day: {
    // Daylight inverts the problem: the sky is the bright thing, so everything
    // that matters is drawn dark against it rather than light.
    label: "Day", sky: ["#7cb8e2", "#9dd0ec", "#c6e2f1", "#e4edf0"],
    far: "#7b9ab4", near: "#41576b", hill: "#a6bccd", cloud: "#ffffff", tower: "#2b3d51", towerLit: "#5f7a92",
    edge: "#ff9a2e", parcel: "#a25f18", parcelEdge: "#2a1b0a",
    pad: "#022415", padLit: "#5cf0ae", plane: "#101f30", ink: "#12212e",
    star: 0
  },
  dusk: {
    label: "Dusk", sky: ["#1b2244", "#553c74", "#a8506a", "#e2825c"],
    far: "#3d3358", near: "#241d38", hill: "#5b4a78", cloud: "#e8c3ac", tower: "#140e24", towerLit: "#544170",
    edge: "#ffc98a", parcel: "#fff4de", parcelEdge: "#7a5a2e",
    pad: "#37a877", padLit: "#8fe6bd", plane: "#fff6e6", ink: "#150f22",
    star: 0.45
  },
  night: {
    // At night the sky is the dark thing, so the towers go LIGHTER than it.
    // A tower you cannot see is not difficulty, it is a bug.
    label: "Night", sky: ["#03050d", "#070b1a", "#0d1229", "#151a38"],
    far: "#1b2444", near: "#05070f", hill: "#27315a", cloud: "#212c52", tower: "#3a4670", towerLit: "#5b6da4",
    edge: "#ffd98a", parcel: "#fff9ec", parcelEdge: "#6a5730",
    pad: "#2fd18f", padLit: "#b6ffdf", plane: "#fffdf5", ink: "#f2ecdc",
    star: 1
  }
};

/** The player's own clock decides the sky. */
export function phaseFor(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h >= 5 && h < 8) return "dawn";
  if (h >= 8 && h < 17) return "day";
  if (h >= 17 && h < 20) return "dusk";
  return "night";
}

export function stageAt(score) {
  const tier = Math.floor(score / 5);
  return {
    speed: 0.30 + Math.min(0.30, tier * 0.038),
    gap: Math.max(0.245, 0.42 - tier * 0.018),
    wind: score >= 5,
    drift: score >= 10,
    narrowPad: score >= 15,
    name: score >= 15 ? "Tight pads" : score >= 10 ? "Moving towers"
        : score >= 5 ? "Crosswinds" : "Clear run"
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
 * @param {{onScore?:Function, onCarry?:Function, onEnd?:Function, phase?:string}} opts
 */
export function shipping(canvas, opts = {}) {
  const ctx = canvas.getContext("2d");
  let raf = 0, last = 0, acc = 0, step = 0;
  let running = false, paused = false, dead = false;

  let y = 0.5, v = 0, down = false, score = 0, missed = 0, dist = 0;
  let carrying = false, drop = null;                       // the parcel in the air
  let posts = [], parcels = [], pads = [], fx = [];
  let rng = rnd(1);
  let nextPost = 1.2, nextJob = 1.7;
  const trail = [];
  let phaseKey = opts.phase || phaseFor();

  const stage = () => stageAt(score);
  const P = () => PHASES[phaseKey];

  function reset() {
    y = 0.5; v = 0; down = false; score = 0; missed = 0; dist = 0; dead = false;
    carrying = false; drop = null;
    posts = []; parcels = []; pads = []; fx = []; trail.length = 0;
    nextPost = 1.2; nextJob = 1.7; step = 0; acc = 0; last = 0;
    rng = rnd((Date.now() ^ (Math.random() * 1e9)) & 0xffffffff);
    phaseKey = opts.phase || phaseFor();
    opts.onCarry?.(false);
  }

  function spawn() {
    const s = stage();
    while (nextPost < dist + 2.4) {
      posts.push({ id: posts.length, x: nextPost, gapY: 0.24 + rng() * 0.44, gap: s.gap,
                   drift: s.drift ? (rng() - 0.5) * 0.30 : 0, phase: rng() * 6.28 });
      nextPost += 0.62 + rng() * 0.18;
    }
    // A job is a parcel with a pad some way beyond it, so there is always somewhere
    // to take the thing you just picked up.
    while (nextJob < dist + 2.4) {
      const px = nextJob;
      parcels.push({ id: parcels.length, x: px, y: 0.24 + rng() * 0.5, got: false });
      pads.push({ id: pads.length, x: px + 0.85 + rng() * 0.5,
                  w: s.narrowPad ? 0.075 : 0.105, used: false });
      nextJob += 1.7 + rng() * 0.8;
    }
  }

  const gapAt = (p, t) => p.drift ? p.gapY + Math.sin(t * 0.9 + p.phase) * p.drift * 0.5 : p.gapY;

  function tick() {
    const s = stage(), t = step * STEP;
    dist += s.speed * STEP;

    // ── flight. Unchanged. ──────────────────────────────────────────────
    v += (down ? LIFT : GRAVITY) * STEP;
    if (s.wind) v += Math.sin(t * 0.42) * 0.32 * STEP;
    v = Math.max(-VMAX, Math.min(VMAX, v));
    y += v * STEP;
    trail.push(y); if (trail.length > 30) trail.shift();
    if (y < PLANE_R || y > GROUND - PLANE_R) return end("ground");

    spawn();

    for (const p of posts) {
      const px = p.x - dist, g = gapAt(p, t);
      if (Math.abs(px - PLANE_X) < POST_W + PLANE_R &&
          (y < g - p.gap / 2 || y > g + p.gap / 2)) return end("tower");
    }

    // ── rule 1: one parcel at a time ────────────────────────────────────
    for (const c of parcels) {
      if (c.got || carrying) continue;
      const cx = c.x - dist;
      if (Math.abs(cx - PLANE_X) < 0.055 && Math.abs(c.y - y) < 0.075) {
        c.got = true; carrying = true;
        fx.push({ kind: "grab", x: PLANE_X, y, life: 0.35 });
        opts.onCarry?.(true);
      }
    }

    // ── rules 3, 4 and 5: the parcel's own flight ───────────────────────
    if (drop) {
      // Real projectile motion. The parcel leaves the plane with the plane's own
      // forward speed and bleeds it off against the air, so it lands AHEAD of
      // where you let go but BEHIND where the plane will be. That gap is the
      // whole skill, and it is why release has to be early.
      drop.v += PARCEL_FALL * STEP;
      drop.y += drop.v * STEP;
      drop.vx -= drop.vx * PARCEL_DRAG * STEP;
      drop.x += drop.vx * STEP;
      const dx = drop.x - dist;
      if (drop.y >= GROUND) {
        const pad = pads.find((p) => !p.used && Math.abs(drop.x - p.x) <= p.w / 2);
        if (pad) {
          pad.used = true; score += 1;
          fx.push({ kind: "hit", x: dx, y: GROUND, life: 0.55 });
          opts.onScore?.(score);
        } else {
          missed += 1;
          fx.push({ kind: "miss", x: dx, y: GROUND, life: 0.45 });
          opts.onMiss?.(missed);
        }
        drop = null;
      } else if (dx < -0.15) {
        missed += 1; drop = null; opts.onMiss?.(missed);
      }
    }

    for (let i = fx.length - 1; i >= 0; i--) {
      fx[i].life -= STEP; if (fx[i].life <= 0) fx.splice(i, 1);
    }
    posts = posts.filter((p) => p.x - dist > -0.35);
    parcels = parcels.filter((c) => c.x - dist > -0.35);
    pads = pads.filter((p) => p.x - dist > -0.35);
  }

  function end(how) {
    dead = true; running = false;
    cancelAnimationFrame(raf);
    opts.onEnd?.({ score, missed, how, stage: stage().name, phase: P().label });
  }

  /* ── drawing ────────────────────────────────────────────────────────── */

  /** A far ridge, slower than anything built. Depth before detail. */
  function hills(w, h, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(0, h * GROUND);
    for (let x = 0; x <= w; x += 8) {
      const u = (x + dist * 5) * 0.006;
      ctx.lineTo(x, h * GROUND - 76 - Math.sin(u) * 24 - Math.sin(u * 2.7 + 1.3) * 13);
    }
    ctx.lineTo(w, h * GROUND); ctx.closePath(); ctx.fill();
  }

  /** Cloud bank. Soft, wide, and always behind the towers so it never lies. */
  function clouds(w, h, colour, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colour;
    for (let i = 0; i < 7; i++) {
      let cxp = (i * 173 - dist * 14) % (w + 260); if (cxp < -260) cxp += w + 260;
      const cy = h * (0.09 + ((i * 0.13) % 0.34));
      const cw = 70 + (i % 3) * 40, ch = 7 + (i % 2) * 3;
      for (let k = 0; k < 4; k++) {
        const t = k / 3;
        ctx.beginPath();
        ctx.ellipse(cxp + t * cw, cy - Math.sin(t * Math.PI) * ch * 0.8,
                    cw * (0.20 + Math.sin(t * Math.PI) * 0.14),
                    ch * (0.7 + Math.sin(t * Math.PI) * 0.6), 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  /** The strip in front of the city: lamps going by, fast, to sell the speed. */
  function lamps(w, h, colour, lit) {
    const gy = h * GROUND;
    for (let i = 0; i < 14; i++) {
      let lx = (i * 96 - dist * 118) % (w + 96); if (lx < -96) lx += w + 96;
      ctx.fillStyle = colour;
      ctx.fillRect(lx, gy + 6, 2, 16);
      ctx.fillStyle = lit;
      ctx.fillRect(lx - 3, gy + 4, 8, 3);
    }
  }

  function skyline(w, h, colour, amp, speed, base) {
    ctx.fillStyle = colour;
    for (let i = 0; i < 30; i++) {
      let bx = (i * 67 - dist * speed * 100) % (w + 90);
      if (bx < -90) bx += w + 90;
      const bh = base + ((i * 37) % amp);
      ctx.fillRect(bx, h * GROUND - bh, 34, bh + 4);
    }
  }

  function draw(w, h) {
    const s = stage(), t = step * STEP, c = P();
    const gy = h * GROUND;

    const sky = ctx.createLinearGradient(0, 0, 0, gy);
    c.sky.forEach((col, i) => sky.addColorStop(i / (c.sky.length - 1), col));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

    if (c.star > 0) {
      ctx.fillStyle = `rgba(255,255,255,${0.55 * c.star})`;
      for (let i = 0; i < 40; i++) {
        let sx = (i * 149.3 - dist * 8) % w; if (sx < 0) sx += w;
        ctx.fillRect(sx, (i * 61.7) % (h * 0.55), 1.7, 1.7);
      }
    }
    // sun or moon, drifting with the parallax rather than pinned
    const bx = w * 0.78 - ((dist * 4) % (w * 1.6));
    ctx.beginPath(); ctx.arc(bx + w * 0.8, h * 0.2, Math.min(26, h * 0.07), 0, Math.PI * 2);
    ctx.fillStyle = phaseKey === "day" ? "rgba(255,248,214,.95)"
                  : phaseKey === "night" ? "rgba(226,232,255,.9)" : "rgba(255,214,164,.9)";
    ctx.fill();

    clouds(w, h, c.cloud, phaseKey === "day" ? 0.62 : phaseKey === "night" ? 0.5 : 0.34);
    // four bands of parallax, each faster than the one behind it
    hills(w, h, c.hill);
    skyline(w, h, c.far, 46, 0.10, 24);
    skyline(w, h, c.near, 62, 0.22, 34);

    for (const p of posts) {
      const x = (p.x - dist) * w, pw = POST_W * w;
      if (x < -pw * 3 || x > w + pw * 3) continue;
      const g = gapAt(p, t) * h, half = (p.gap * h) / 2;
      const tower = (yy, hh) => {
        if (hh <= 0) return;
        ctx.fillStyle = c.tower; ctx.fillRect(x - pw, yy, pw * 2, hh);
        ctx.fillStyle = c.towerLit; ctx.fillRect(x - pw, yy, pw * 0.5, hh);
        for (let wy = yy + 12; wy < yy + hh - 8; wy += 15) {
          if (((wy * 3 + p.id * 17) | 0) % 4 === 0) continue;
          ctx.fillStyle = phaseKey === "day" ? "rgba(20,32,46,.5)" : "rgba(255,226,158,.72)";
          ctx.fillRect(x - pw + 6, wy, 4, 6);
          ctx.fillRect(x + pw - 10, wy, 4, 6);
        }
      };
      tower(0, g - half);
      tower(g + half, gy - (g + half));
      // Rimmed, not just filled. The bar has to read against the tower behind
      // most of it AND against open sky at the overhang, and no single colour
      // clears both in daylight — so it gets an outline instead.
      ctx.strokeStyle = "rgba(0,0,0,.55)"; ctx.lineWidth = 1;
      ctx.fillStyle = c.edge;
      for (const yy of [g - half - 5, g + half]) {
        ctx.fillRect(x - pw - 5, yy, pw * 2 + 10, 5);
        ctx.strokeRect(x - pw - 5.5, yy - 0.5, pw * 2 + 11, 6);
      }
    }

    ctx.fillStyle = c.near; ctx.fillRect(0, gy, w, h - gy);
    ctx.fillStyle = c.edge; ctx.globalAlpha = .35; ctx.fillRect(0, gy, w, 2); ctx.globalAlpha = 1;
    lamps(w, h, c.tower, c.edge);

    for (const p of pads) {
      const x = (p.x - dist) * w, pw = p.w * w;
      if (x < -pw || x > w + pw) continue;
      ctx.fillStyle = p.used ? c.pad : c.padLit;
      ctx.fillRect(x - pw / 2, gy - 7, pw, 7);
      ctx.fillStyle = c.pad;
      ctx.fillRect(x - pw / 2, gy, pw, 5);
      if (!p.used) {                                   // a beam, so the pad is findable
        // A short glow at the pad, not a column up the sky. The tall version
        // washed a grey smudge across the skyline at dawn and dusk.
        const beam = ctx.createLinearGradient(0, gy - h * 0.16, 0, gy);
        beam.addColorStop(0, "rgba(0,0,0,0)");
        beam.addColorStop(1, `${c.padLit}88`);
        ctx.fillStyle = beam;
        ctx.fillRect(x - pw * 0.3, gy - h * 0.16, pw * 0.6, h * 0.16);
      }
    }

    const parcel = (px, py, sz) => {
      ctx.fillStyle = c.parcel; ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
      ctx.strokeStyle = c.parcelEdge; ctx.lineWidth = 1.6;
      ctx.strokeRect(px - sz / 2, py - sz / 2, sz, sz);
      ctx.beginPath();
      ctx.moveTo(px, py - sz / 2); ctx.lineTo(px, py + sz / 2);
      ctx.moveTo(px - sz / 2, py); ctx.lineTo(px + sz / 2, py);
      ctx.stroke();
    };
    for (const cpar of parcels) {
      if (cpar.got) continue;
      const x = (cpar.x - dist) * w;
      if (x < -40 || x > w + 40) continue;
      parcel(x, cpar.y * h, Math.min(24, w * 0.032));
    }
    if (drop) parcel((drop.x - dist) * w, drop.y * h, Math.min(22, w * 0.03));

    for (const e of fx) {
      const a = e.life / (e.kind === "hit" ? 0.55 : e.kind === "miss" ? 0.45 : 0.35);
      ctx.globalAlpha = a;
      ctx.strokeStyle = e.kind === "miss" ? "#d4674a" : e.kind === "hit" ? c.padLit : c.edge;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(e.x * w, e.y * h, 10 + (1 - a) * 34, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    const px = PLANE_X * w;
    trail.forEach((ty, i) => {
      const a = i / trail.length;
      ctx.globalAlpha = a * 0.4; ctx.fillStyle = c.edge;
      const sz = 1 + a * 2.4;
      ctx.fillRect(px - (trail.length - i) * 2.6, ty * h - sz / 2, sz, sz);
    });
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(px, y * h);
    ctx.rotate(Math.max(-0.5, Math.min(0.55, v * 0.62)));
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.beginPath(); ctx.moveTo(18, 2); ctx.lineTo(-14, -9); ctx.lineTo(-7, 2); ctx.lineTo(-14, 12);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = c.plane;
    ctx.beginPath(); ctx.moveTo(17, 0); ctx.lineTo(-14, -10); ctx.lineTo(-7, 0); ctx.lineTo(-14, 10);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = c.parcelEdge; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(17, 0); ctx.lineTo(-7, 0); ctx.stroke();
    ctx.restore();
    // What you are carrying, on a line below the plane. It was drawn big and
    // level with the fuselage at first and read as a house sitting on the wing.
    if (carrying) {
      const sz = Math.min(11, w * 0.015), hang = 25;
      ctx.strokeStyle = c.parcelEdge; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px - 3, y * h + 3); ctx.lineTo(px - 3, y * h + hang - sz / 2);
      ctx.stroke();
      parcel(px - 3, y * h + hang, sz);
    }
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
    /** Rule 2: does nothing unless you are carrying. A press, never a hold. */
    release() {
      if (!running || paused || !carrying || drop) return false;
      carrying = false;
      drop = { x: dist + PLANE_X, y, v: v * 0.6, vx: stage().speed };   // inherits the throw
      opts.onCarry?.(false);
      return true;
    },
    pause() { if (!running || paused) return false; paused = true; running = false;
              cancelAnimationFrame(raf); return true; },
    resume() { if (!paused) return; paused = false; running = true; last = 0;
               raf = requestAnimationFrame(frame); },
    stop() { running = false; paused = false; cancelAnimationFrame(raf); },
    get score() { return score; },
    get missed() { return missed; },
    get carrying() { return carrying; },
    get stageName() { return stage().name; },
    /* Read-only, for the checker in scripts/. An autopilot needs to see the
       world to prove that a released parcel can actually reach a pad; without
       it the delivery mechanic can only be tested by hand. */
    get telemetry() {
      return {
        y, v, dist, carrying, speed: stage().speed,
        parcel: parcels.filter((c) => !c.got && c.x > dist)[0] || null,
        pad: pads.filter((p) => !p.used && p.x > dist)[0] || null,
        gap: posts.filter((p) => p.x > dist).map((p) => ({ x: p.x, y: gapAt(p, step * STEP), h: p.gap }))[0] || null
      };
    },
    get phaseLabel() { return P().label; },
    paint() { const { w, h } = fit(canvas, ctx); ctx.clearRect(0, 0, w, h); draw(w, h); }
  };
  reset();
  api.paint();
  return api;
}
