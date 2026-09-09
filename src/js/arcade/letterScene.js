/**
 * arcade/letterScene.js — the street the Beggathon happens on.
 *
 * The Beggathon used to be drawn as a gauge: an "arm" reaching a percentage of
 * the way into a man's pocket. The numbers were honest but nobody could tell
 * what they were meant to be doing, because reaching into a pocket is not a
 * thing you do by typing.
 *
 * So the progress is a letter now. You write at the window on the left, and
 * every key you actually press carries the letter further across the street
 * towards the postbox on the right. When it reaches the slot you may post it.
 * Run out of the minute before it gets there and the wind takes it.
 *
 * Then the letter answers, and the answer is the whole point:
 *   refused  → it comes back out of the slot and BURNS, down to ash
 *   accepted → it comes back out and OPENS, and what he granted is written
 *              inside it
 *
 * The scene owns none of the rules. It is told a number between 0 and 1 and
 * which ending to play; every gate, every keystroke count and every refusal
 * still lives in beg.js and on the server. Nothing here can win a discount.
 */

const STEP = 1 / 60;

const IN = "#0B0A08", PAPER = "#F4EEDF", GOLD = "#B5935A", GOLD_LIT = "#F0D9A0";
const BOX = "#8C2F24", BOX_DARK = "#5E1E17";

const rand = (a, b) => a + Math.random() * (b - a);

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {{reach, post, burn, deliver, blowAway, reset, stop, phase}}
 */
export function letterScene(canvas) {
  const ctx = canvas.getContext("2d");
  let raf = 0, last = 0, acc = 0, t = 0;
  let reach = 0, shown = 0;                 // shown eases towards reach
  let phase = "writing";                    // writing | posting | burning | opening | gone
  let phaseT = 0;
  let embers = [], ash = [], flakes = [];
  let onDone = null;

  const lerp = (a, b, k) => a + (b - a) * k;

  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr; canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  /* Where the letter is, in canvas units. It leaves the window sill, rises over
     the street and comes down at the slot — an arc, because a flat slide across
     the middle reads as a progress bar wearing a costume. */
  function letterAt(w, h) {
    const from = { x: w * 0.17, y: h * 0.52 };
    const to = { x: w * 0.775, y: h * 0.47 };
    const k = shown;
    const x = lerp(from.x, to.x, k);
    const y = lerp(from.y, to.y, k) - Math.sin(k * Math.PI) * h * 0.20;
    const tilt = Math.sin(t * 3.1) * 0.10 + (1 - k) * 0.16;
    return { x, y, tilt, k };
  }

  function envelope(x, y, s, tilt, { open = 0, char = 0 } = {}) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    const w = s, h = s * 0.66;

    ctx.fillStyle = "rgba(0,0,0,.30)";
    ctx.fillRect(-w / 2 + 2, -h / 2 + 3, w, h);

    // Charring darkens the paper from the edges in rather than tinting it flat.
    if (char > 0) {
      const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
      g.addColorStop(0, `rgba(26,16,10,${char})`);
      g.addColorStop(0.5, `rgba(120,80,40,${char * 0.5})`);
      g.addColorStop(1, `rgba(26,16,10,${char})`);
      ctx.fillStyle = PAPER; ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h);
    } else {
      ctx.fillStyle = PAPER; ctx.fillRect(-w / 2, -h / 2, w, h);
    }
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1;
    ctx.strokeRect(-w / 2, -h / 2, w, h);

    // The flap: shut it is a V on the face, open it swings up over the top.
    ctx.beginPath();
    if (open <= 0) {
      ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(0, h * 0.06); ctx.lineTo(w / 2, -h / 2);
      ctx.stroke();
    } else {
      const lift = h * (0.06 + 0.62 * open);
      ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(0, -h / 2 - lift); ctx.lineTo(w / 2, -h / 2);
      ctx.closePath();
      ctx.fillStyle = "#EDE3CC"; ctx.fill();
      ctx.stroke();
    }
    // a stamp, because it is a letter
    ctx.fillStyle = char > 0.4 ? "#5A3A22" : GOLD;
    ctx.fillRect(w / 2 - s * 0.19, -h / 2 + s * 0.06, s * 0.13, s * 0.10);
    ctx.restore();
  }

  function window_(w, h) {
    const x = w * 0.06, y = h * 0.20, ww = w * 0.16, hh = h * 0.46;
    ctx.fillStyle = "#161320"; ctx.fillRect(x - 8, y - 8, ww + 16, hh + 16);
    const warm = ctx.createLinearGradient(x, y, x, y + hh);
    warm.addColorStop(0, "#F5D79B"); warm.addColorStop(1, "#C79A55");
    ctx.fillStyle = warm; ctx.fillRect(x, y, ww, hh);
    ctx.strokeStyle = "#231C2E"; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + ww / 2, y); ctx.lineTo(x + ww / 2, y + hh);
    ctx.moveTo(x, y + hh / 2); ctx.lineTo(x + ww, y + hh / 2);
    ctx.stroke();
    ctx.strokeRect(x, y, ww, hh);
    // the silhouette of somebody writing at it
    ctx.fillStyle = "rgba(20,14,26,.72)";
    ctx.beginPath();
    ctx.ellipse(x + ww * 0.42, y + hh * 0.52, ww * 0.15, hh * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x + ww * 0.24, y + hh * 0.62, ww * 0.38, hh * 0.30);
  }

  function postbox(w, h, lit) {
    const x = w * 0.775, y = h * 0.30, bw = w * 0.085, bh = h * 0.44;
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.beginPath(); ctx.ellipse(x, y + bh + 4, bw * 0.8, 6, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = BOX_DARK;
    ctx.fillRect(x - bw / 2, y, bw, bh);
    ctx.fillStyle = BOX;
    ctx.fillRect(x - bw / 2, y, bw * 0.62, bh);
    ctx.beginPath();
    ctx.ellipse(x, y, bw / 2, bw * 0.30, 0, Math.PI, 0);
    ctx.fillStyle = BOX; ctx.fill();

    ctx.fillStyle = lit ? GOLD_LIT : "#2B0F0B";           // the slot
    ctx.fillRect(x - bw * 0.30, y + bh * 0.20, bw * 0.60, bh * 0.055);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.4;
    ctx.strokeRect(x - bw * 0.30, y + bh * 0.20, bw * 0.60, bh * 0.055);
    ctx.fillStyle = GOLD;
    ctx.fillRect(x - bw / 2, y + bh * 0.52, bw, 2);
    if (lit) {
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 4);
      ctx.fillStyle = GOLD_LIT;
      ctx.fillRect(x - bw * 0.5, y + bh * 0.12, bw, bh * 0.22);
      ctx.globalAlpha = 1;
    }
  }

  function street(w, h) {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#08070F"); sky.addColorStop(0.5, "#191428"); sky.addColorStop(1, "#2A2136");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(244,238,223,.45)";
    for (let i = 0; i < 26; i++) ctx.fillRect((i * 137.3) % w, (i * 61.1) % (h * 0.36), 1.4, 1.4);

    // The far wall the postbox stands against, so the box is against something.
    ctx.fillStyle = "#1B1728";
    ctx.fillRect(0, h * 0.30, w, h * 0.44);
    ctx.fillStyle = "rgba(10,8,16,.55)";
    for (let x = 0; x < w; x += 62) ctx.fillRect(x, h * 0.30, 2, h * 0.44);

    // Three bands with real value between them: far pavement, road, near kerb.
    // They were nearly black and the whole scene read as objects on nothing.
    ctx.fillStyle = "#2E2740"; ctx.fillRect(0, h * 0.74, w, h * 0.07);
    ctx.fillStyle = "#3A3150"; ctx.fillRect(0, h * 0.74, w, 3);
    ctx.fillStyle = "#141020"; ctx.fillRect(0, h * 0.81, w, h * 0.19);

    const wet = ctx.createLinearGradient(0, h * 0.81, 0, h);
    wet.addColorStop(0, "rgba(181,147,90,.13)"); wet.addColorStop(1, "rgba(181,147,90,0)");
    ctx.fillStyle = wet; ctx.fillRect(0, h * 0.81, w, h * 0.19);

    ctx.setLineDash([20, 22]);
    ctx.strokeStyle = "rgba(240,217,160,.30)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, h * 0.905); ctx.lineTo(w, h * 0.905); ctx.stroke();
    ctx.setLineDash([]);
  }

  /** A lamp on the far kerb. It lights the box, the pavement and the letter as
      it passes, which is what stops the middle of the scene reading as a void. */
  function lamp(w, h) {
    const x = w * 0.56, base = h * 0.755, top = h * 0.16;
    const pool = ctx.createRadialGradient(x, base, 4, x, base, w * 0.20);
    pool.addColorStop(0, "rgba(245,215,155,.30)");
    pool.addColorStop(1, "rgba(245,215,155,0)");
    ctx.fillStyle = pool;
    ctx.beginPath(); ctx.ellipse(x, base, w * 0.20, h * 0.11, 0, 0, Math.PI * 2); ctx.fill();

    const cone = ctx.createLinearGradient(x, top, x, base);
    cone.addColorStop(0, "rgba(245,215,155,.20)");
    cone.addColorStop(1, "rgba(245,215,155,0)");
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(x - 7, top); ctx.lineTo(x + 7, top);
    ctx.lineTo(x + w * 0.10, base); ctx.lineTo(x - w * 0.10, base);
    ctx.closePath(); ctx.fill();

    ctx.strokeStyle = "#0E0B16"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, top + 8); ctx.stroke();
    ctx.fillStyle = "#0E0B16";
    ctx.fillRect(x - 11, top, 22, 8);
    ctx.fillStyle = "#F5D79B";
    ctx.fillRect(x - 8, top + 7, 16, 4);
  }

  /* ── the two endings ───────────────────────────────────────────────────── */

  function stepBurn(x, y, s) {
    if (phaseT < 1.1 && Math.random() < 0.9) {
      embers.push({ x: x + rand(-s / 2, s / 2), y: y + rand(-s / 3, s / 3),
                    vx: rand(-14, 14), vy: rand(-70, -26), life: rand(0.4, 0.9), r: rand(1.5, 4) });
    }
    if (phaseT > 0.5 && Math.random() < 0.5) {
      ash.push({ x: x + rand(-s / 2, s / 2), y: y + rand(-s / 3, s / 3),
                 vx: rand(-10, 10), vy: rand(14, 44), life: rand(1.0, 1.9), r: rand(1, 2.6) });
    }
    for (const p of embers) { p.x += p.vx * STEP; p.y += p.vy * STEP; p.vy += 26 * STEP; p.life -= STEP; }
    for (const p of ash) { p.x += (p.vx + Math.sin(t * 3 + p.y) * 8) * STEP; p.y += p.vy * STEP; p.life -= STEP; }
    embers = embers.filter((p) => p.life > 0);
    ash = ash.filter((p) => p.life > 0);
  }

  function drawFire(x, y, s, k) {
    // A body of flame under the sparks. Embers alone read as confetti.
    if (k < 0.95) {
      const grow = 0.6 + Math.sin(t * 9) * 0.10 + k * 0.5;
      const f = ctx.createRadialGradient(x, y + s * 0.1, 2, x, y, s * grow);
      f.addColorStop(0, "rgba(255,242,196,.95)");
      f.addColorStop(0.35, "rgba(240,154,60,.78)");
      f.addColorStop(0.75, "rgba(184,70,42,.38)");
      f.addColorStop(1, "rgba(184,70,42,0)");
      ctx.fillStyle = f;
      ctx.beginPath();
      ctx.ellipse(x, y - s * 0.15, s * grow * 0.75, s * grow, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const p of embers) {
      const a = Math.max(0, p.life);
      ctx.globalAlpha = Math.min(1, a * 1.4);
      ctx.fillStyle = a > 0.6 ? "#FFE9A8" : a > 0.35 ? "#F09A3C" : "#B8462A";
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.5 + a), 0, Math.PI * 2); ctx.fill();
    }
    for (const p of ash) {
      ctx.globalAlpha = Math.max(0, Math.min(0.7, p.life * 0.5));
      ctx.fillStyle = "#6B6259";
      ctx.fillRect(p.x, p.y, p.r, p.r);
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    const { w, h } = fit();
    t += STEP;
    street(w, h);
    lamp(w, h);
    window_(w, h);
    postbox(w, h, reach >= 1 && phase === "writing");

    const s = Math.max(26, Math.min(46, w * 0.055));
    const L = letterAt(w, h);

    if (phase === "writing") {
      shown = lerp(shown, reach, 0.12);
      envelope(L.x, L.y, s, L.tilt);
    } else if (phase === "posting") {
      // into the slot: shrink and sink, then hold while the server answers
      const k = Math.min(1, phaseT / 0.55);
      envelope(L.x, L.y + k * h * 0.10, s * (1 - k * 0.7), L.tilt * (1 - k));
    } else if (phase === "burning") {
      const k = Math.min(1, phaseT / 1.5);
      // It burns where it came back out — between the lamp and the box, clear of both.
      const bx = w * 0.695, by = h * 0.42 + Math.sin(t * 2) * 3;
      stepBurn(bx, by, s);
      if (k < 1) envelope(bx, by, s * (1 - k * 0.35), Math.sin(t * 2.2) * 0.2, { char: k });
      drawFire(bx, by, s, k);
      if (phaseT > 2.6 && onDone) { const f = onDone; onDone = null; f(); }
    } else if (phase === "opening") {
      const k = Math.min(1, phaseT / 0.9);
      const bx = lerp(w * 0.775, w * 0.5, k), by = lerp(h * 0.47, h * 0.44, k);
      envelope(bx, by, s * (1 + k * 1.5), (1 - k) * 0.2, { open: k });
      if (k >= 1) {
        for (let i = 0; i < 2; i++) flakes.push({ x: bx + rand(-40, 40), y: by - 30,
          vx: rand(-12, 12), vy: rand(-30, -10), life: rand(0.5, 1.1) });
      }
      for (const p of flakes) { p.x += p.vx * STEP; p.y += p.vy * STEP; p.vy += 18 * STEP; p.life -= STEP; }
      flakes = flakes.filter((p) => p.life > 0);
      for (const p of flakes) {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = GOLD_LIT;
        ctx.fillRect(p.x, p.y, 2.5, 2.5);
      }
      ctx.globalAlpha = 1;
      if (phaseT > 1.0 && onDone) { const f = onDone; onDone = null; f(); }
    } else if (phase === "gone") {
      // the wind took it: tumbling away down the street
      const k = Math.min(1, phaseT / 1.6);
      ctx.globalAlpha = 1 - k;
      envelope(lerp(L.x, -60, k), lerp(L.y, h * 0.82, k * k), s, t * 4);
      ctx.globalAlpha = 1;
      if (phaseT > 1.8 && onDone) { const f = onDone; onDone = null; f(); }
    }
  }

  function frame(now) {
    if (!last) last = now;
    acc += Math.min(0.2, (now - last) / 1000);
    last = now;
    let steps = 0;
    while (acc >= STEP && steps < 6) { acc -= STEP; phaseT += STEP; steps++; }
    draw();
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  const to = (p, done) => { phase = p; phaseT = 0; onDone = done || null; };

  return {
    /** 0…1 — how far across the street the letter has got. */
    set reach(v) { reach = Math.max(0, Math.min(1, v)); },
    get reach() { return reach; },
    get phase() { return phase; },
    post() { to("posting"); },
    burn(done) { to("burning", done); },
    deliver(done) { to("opening", done); },
    blowAway(done) { to("gone", done); },
    reset() { reach = 0; shown = 0; embers = []; ash = []; flakes = []; to("writing"); },
    stop() { cancelAnimationFrame(raf); }
  };
}
