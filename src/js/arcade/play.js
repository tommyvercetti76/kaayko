/**
 * arcade/play.js — the two machines, drawn and played.
 *
 * Both run the SAME fixed-step simulation the server uses to replay them (gameRules.js),
 * so what you see is exactly what gets graded. The loop accumulates real time into fixed
 * 1/60 steps; input is recorded as step indices, never as float seconds, because rounding
 * a time across a step boundary is enough to make the two replays disagree.
 *
 * Rendering is separate from simulation: the sim is chunky and exact, the draw is smooth.
 */

import { FRANK, FLY, STEP } from "./gameRules.js";

const PRM = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ── palette ──────────────────────────────────────────────────────────────── */

export const SKIN = {
  franking: { key: "#e6b95c", deep: "#8a6a1f", glow: "#ffd98a", night: "#171208", ground: "#241a09" },
  mailrun:  { key: "#8ea0e0", deep: "#2b3566", glow: "#c3cfff", night: "#0b0d1c", ground: "#141833" }
};
const PAPER = "#f3e8d2";
const PAPER_EDGE = "#cdbb96";

/* ── small drawing helpers ────────────────────────────────────────────────── */

function fitCanvas(canvas, ctx) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr; canvas.height = h * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h };
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function label(ctx, s, x, y, size, color, align = "left") {
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "middle";
  ctx.font = `${size}px 'Josefin_Light', 'Josefin Sans', Arial, sans-serif`;
  ctx.fillText(s, x, y);
}

/** Progress pips across the top, so "how close am I" needs no reading. */
function pips(ctx, W, done, total, skin) {
  const pad = 12, gap = 4;
  const w = (W - pad * 2 - gap * (total - 1)) / total;
  for (let i = 0; i < total; i++) {
    ctx.fillStyle = i < done ? skin.glow : "rgba(255,255,255,0.13)";
    roundRect(ctx, pad + i * (w + gap), 10, w, 4, 2);
    ctx.fill();
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Franking Rush
   ══════════════════════════════════════════════════════════════════════════ */

function frankingGame(seed) {
  const sched = FRANK.schedule(seed);
  const struck = new Set();
  const gone = new Set();
  const pops = [];
  const puffs = [];
  let franked = 0, missed = 0, misfire = 0;
  const taps = [];

  return {
    target: FRANK.TARGET,
    taps,
    get missed() { return missed; },
    get misfire() { return misfire; },
    step(s) {
      for (let i = pops.length - 1; i >= 0; i--) { pops[i].life -= STEP; if (pops[i].life <= 0) pops.splice(i, 1); }
      for (let i = puffs.length - 1; i >= 0; i--) { puffs[i].life -= STEP; if (puffs[i].life <= 0) puffs.splice(i, 1); }
      // Count what crossed the head unfranked, by the server's own rule. Ending the
      // run here is the honest thing: better than letting it feel like a win and
      // then having the replay refuse it.
      for (const env of sched) {
        if (struck.has(env.id) || gone.has(env.id)) continue;
        if (FRANK.posAt(env, s) > FRANK.ZONE_HI) { gone.add(env.id); missed += 1; }
      }
      if (franked >= FRANK.TARGET) return "won";
      if (missed > FRANK.MAX_MISSED || misfire > FRANK.MAX_MISFIRE) return "lost";
      return s > 7200 ? "lost" : null;
    },
    /** A tap only marks an envelope inside the strike zone. Anything else is a misfire. */
    tap(s, lane) {
      if (taps.length && s <= taps[taps.length - 1].s) return;
      taps.push({ s, lane });
      const best = FRANK.targetOf(sched, struck, lane, s);
      if (best) {
        struck.add(best.id); franked += 1;
        pops.push({ x: FRANK.posAt(best, s), lane: best.lane, life: 0.4 });
      } else {
        misfire += 1;
        puffs.push({ lane, life: 0.3 });
      }
    },
    get score() { return franked; },
    draw(ctx, W, H, s, now) {
      const k = SKIN.franking, t = s * STEP;
      const top = 26, deskH = H - top - 8, laneH = deskH / 3;
      const zL = FRANK.ZONE_LO * W, zR = FRANK.ZONE_HI * W;

      // ── the room: a lamp over a dark sorting desk ────────────────────────
      ctx.fillStyle = k.night; ctx.fillRect(0, 0, W, H);
      const lamp = ctx.createRadialGradient(zL, top - 30, 10, zL, top + deskH * 0.6, H * 1.2);
      lamp.addColorStop(0, "rgba(255,214,138,0.30)");
      lamp.addColorStop(0.45, "rgba(180,140,60,0.10)");
      lamp.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = lamp; ctx.fillRect(0, 0, W, H);

      // ── the desk: three channels, grain along them ──────────────────────
      for (let i = 0; i < 3; i++) {
        const y = top + i * laneH;
        const wood = ctx.createLinearGradient(0, y, 0, y + laneH);
        wood.addColorStop(0, i % 2 ? "#2a1e0b" : "#31240d");
        wood.addColorStop(0.5, i % 2 ? "#211806" : "#281d09");
        wood.addColorStop(1, "#180f04");
        ctx.fillStyle = wood; ctx.fillRect(0, y, W, laneH);
        ctx.fillStyle = "rgba(255,220,150,0.04)";
        for (let g = 0; g < 3; g++) ctx.fillRect(0, y + 8 + g * (laneH / 3.4), W, 1);
        ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, y - 2, W, 3);
        ctx.fillStyle = `${k.key}55`; ctx.fillRect(0, y + 1, W, 1);
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, y + laneH - 5, W, 4);
        ctx.fillStyle = `${k.key}33`;
        for (let x = -((t * 60) % 14); x < W; x += 14) ctx.fillRect(x, y + laneH - 5, 6, 4);
      }

      // ── THE STRIKE ZONE. Nothing outside these two lines can be franked. ──
      const zg = ctx.createLinearGradient(zL, 0, zR, 0);
      zg.addColorStop(0, `${k.glow}0a`); zg.addColorStop(0.5, `${k.glow}22`); zg.addColorStop(1, `${k.glow}0a`);
      ctx.fillStyle = zg; ctx.fillRect(zL, top, zR - zL, deskH);
      ctx.fillStyle = `${k.glow}99`;
      ctx.fillRect(zL, top, 1.5, deskH);
      ctx.fillRect(zR - 1.5, top, 1.5, deskH);
      ctx.fillStyle = k.glow;
      for (let y = top + 4; y < top + deskH; y += 10) {
        ctx.fillRect(zL - 3, y, 3, 3);
        ctx.fillRect(zR, y, 3, 3);
      }

      // ── the franking head, past the zone ────────────────────────────────
      const headW = Math.max(14, W - zR);
      const body = ctx.createLinearGradient(W - headW, 0, W, 0);
      body.addColorStop(0, "#4a3a15"); body.addColorStop(0.4, "#241a08"); body.addColorStop(1, "#120c03");
      ctx.fillStyle = body; ctx.fillRect(W - headW, top, headW, deskH);
      ctx.fillStyle = k.key; ctx.fillRect(W - headW - 2, top, 2, deskH);
      for (let i = 0; i < 3; i++) {
        const cy = top + i * laneH + laneH / 2;
        const rh = Math.min(laneH * 0.62, 34), rw = Math.max(6, headW - 10);
        const rx = W - headW + 5, ry = cy - rh / 2;
        const drum = ctx.createLinearGradient(rx, 0, rx + rw, 0);
        drum.addColorStop(0, "#0d0903"); drum.addColorStop(0.35, "#6b5218");
        drum.addColorStop(0.6, "#3d2d0c"); drum.addColorStop(1, "#0d0903");
        ctx.fillStyle = drum; roundRect(ctx, rx, ry, rw, rh, 3); ctx.fill();
        ctx.save();
        ctx.beginPath(); roundRect(ctx, rx, ry, rw, rh, 3); ctx.clip();
        ctx.fillStyle = `${k.glow}55`;
        for (let b = -1; b < 4; b++) ctx.fillRect(rx, ry + (((t * 46 + b * 11) % (rh + 11)) - 11), rw, 2);
        ctx.restore();
      }

      // ── the mail ────────────────────────────────────────────────────────
      for (const env of sched) {
        if (struck.has(env.id)) continue;
        const x = FRANK.posAt(env, s);
        if (x < -0.16 || x > 1.16) continue;
        const cx = x * W, cy = top + env.lane * laneH + laneH / 2;
        const ew = Math.min(laneH * 1.25, W * 0.17), eh = ew * 0.58;
        const live = x >= FRANK.ZONE_LO && x <= FRANK.ZONE_HI;   // strikeable right now
        const lost = x > FRANK.ZONE_HI;
        const lean = Math.sin(t * 3 + env.id) * 0.02;

        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(lean);
        if (live) {                                              // it lifts into the light
          ctx.shadowColor = k.glow; ctx.shadowBlur = 12;
        }
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        roundRect(ctx, -ew / 2 + 2, -eh / 2 + 4, ew, eh, 3); ctx.fill();
        ctx.shadowBlur = 0;

        const pg = ctx.createLinearGradient(0, -eh / 2, 0, eh / 2);
        if (lost) { pg.addColorStop(0, "#8d8272"); pg.addColorStop(1, "#5e564a"); }
        else { pg.addColorStop(0, "#fdf6e6"); pg.addColorStop(0.55, PAPER); pg.addColorStop(1, PAPER_EDGE); }
        ctx.fillStyle = pg;
        roundRect(ctx, -ew / 2, -eh / 2, ew, eh, 3); ctx.fill();

        ctx.strokeStyle = live ? k.glow : lost ? "#4a4238" : "rgba(74,54,22,0.55)";
        ctx.lineWidth = live ? 2 : 1;
        roundRect(ctx, -ew / 2, -eh / 2, ew, eh, 3); ctx.stroke();

        ctx.strokeStyle = "rgba(74,54,22,0.42)"; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-ew / 2, -eh / 2); ctx.lineTo(0, 2); ctx.lineTo(ew / 2, -eh / 2); ctx.stroke();
        ctx.fillStyle = "rgba(74,54,22,0.30)";
        ctx.fillRect(-ew / 2 + 7, eh / 2 - 12, ew * 0.42, 2);
        ctx.fillRect(-ew / 2 + 7, eh / 2 - 7, ew * 0.30, 2);
        const sx = ew / 2 - 17, sy = -eh / 2 + 4;
        ctx.fillStyle = "#fdf6e6"; ctx.fillRect(sx - 1, sy - 1, 15, 13);
        ctx.fillStyle = lost ? "#5e564a" : env.id % 2 ? "#8a3a2a" : k.deep;
        ctx.fillRect(sx, sy, 13, 11);
        ctx.fillStyle = "rgba(255,240,210,0.5)";
        ctx.fillRect(sx + 3, sy + 3, 7, 5);
        ctx.restore();
      }

      // ── a frank landing ─────────────────────────────────────────────────
      for (const p of pops) {
        const cy = top + p.lane * laneH + laneH / 2, a = p.life / 0.4, px = p.x * W;
        ctx.globalAlpha = a;
        ctx.strokeStyle = k.glow; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(px, cy, 10 + (1 - a) * 30, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = k.glow;
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2 + p.lane, d = 8 + (1 - a) * 26;
          ctx.fillRect(px + Math.cos(ang) * d - 1, cy + Math.sin(ang) * d - 1, 2.5, 2.5);
        }
        ctx.globalAlpha = 1;
      }

      // ── a misfire: the head stamps the bare desk ────────────────────────
      for (const p of puffs) {
        const cy = top + p.lane * laneH + laneH / 2, a = p.life / 0.3;
        ctx.globalAlpha = a * 0.8;
        ctx.strokeStyle = "#c2603a"; ctx.lineWidth = 2;
        const r = 9 + (1 - a) * 8, mx = (zL + zR) / 2;
        ctx.beginPath();
        ctx.moveTo(mx - r, cy - r); ctx.lineTo(mx + r, cy + r);
        ctx.moveTo(mx + r, cy - r); ctx.lineTo(mx - r, cy + r);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      pips(ctx, W, franked, FRANK.TARGET, k);
      label(ctx, `${franked} / ${FRANK.TARGET} franked`, 12, 20, 11, k.glow);
      const errs = missed + misfire;
      label(ctx, errs ? `${missed} missed · ${misfire} misfired` : "strike inside the light",
            W - 12, 20, 11,
            errs > Math.min(FRANK.MAX_MISSED, FRANK.MAX_MISFIRE) - 3 ? "#e08a6a" : "rgba(255,240,210,0.45)",
            "right");
    }
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Mail Run
   ══════════════════════════════════════════════════════════════════════════ */

function mailrunGame(seed) {
  const posts = FLY.posts(seed);
  const scored = new Set();
  const events = [];
  let y = 0.5, v = 0, passed = 0, down = false, dead = false;
  const trail = [];

  return {
    target: FLY.TARGET,
    events,
    setDown(s, next) {
      if (next === down) return;
      // Two flips inside one step cannot both be sent, and a state change we did not
      // send is a replay that disagrees with what the player saw. So drop the input.
      if (events.length && s <= events[events.length - 1].s) return;
      down = next;
      events.push({ s, down: next });
    },
    step(s) {
      if (dead) return "lost";
      const t = s * STEP;
      v += (down ? FLY.LIFT : FLY.GRAVITY) * STEP;
      v = Math.max(-FLY.VMAX, Math.min(FLY.VMAX, v));
      y += v * STEP;
      trail.push(y); if (trail.length > 26) trail.shift();
      if (y < FLY.PLANE_R || y > 1 - FLY.PLANE_R) { dead = true; return "lost"; }
      for (const p of posts) {
        const x = p.x0 - t * FLY.SPEED;
        if (Math.abs(x - FLY.PLANE_X) < FLY.POST_W + FLY.PLANE_R &&
            (y < p.gapY - p.gap / 2 || y > p.gapY + p.gap / 2)) { dead = true; return "lost"; }
        if (!scored.has(p.id) && x < FLY.PLANE_X - FLY.POST_W) { scored.add(p.id); passed += 1; }
      }
      return passed >= FLY.TARGET ? "won" : null;
    },
    get score() { return passed; },
    draw(ctx, W, H, s, now) {
      const k = SKIN.mailrun, t = s * STEP;

      // ── night sky ───────────────────────────────────────────────────────
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#05070f");
      sky.addColorStop(0.45, "#141a3a");
      sky.addColorStop(0.8, "#2b2f57");
      sky.addColorStop(1, "#3b3252");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

      // stars, then the moon behind everything
      for (let i = 0; i < 34; i++) {
        let sx = (i * 149.3 - t * 7) % W; if (sx < 0) sx += W;
        const sy = (i * 61.7) % (H * 0.62);
        ctx.fillStyle = `rgba(255,255,255,${0.18 + ((i * 7) % 5) * 0.11})`;
        ctx.fillRect(sx, sy, 1.6, 1.6);
      }
      const mx = W * 0.82, my = H * 0.20, mr = Math.min(18, H * 0.09);
      const halo = ctx.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 5);
      halo.addColorStop(0, "rgba(220,228,255,0.22)"); halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(mx, my, mr * 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#e8ecff"; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(200,208,240,0.55)";
      ctx.beginPath(); ctx.arc(mx - mr * 0.3, my - mr * 0.25, mr * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(mx + mr * 0.35, my + mr * 0.3, mr * 0.15, 0, Math.PI * 2); ctx.fill();

      // ── a far skyline, drifting slower than the towers ──────────────────
      ctx.fillStyle = "#0d1128";
      for (let i = 0; i < 26; i++) {
        let bx = (i * 71 - t * 9) % (W + 80); if (bx < -80) bx += W + 80;
        const bh = 16 + ((i * 37) % 40);
        ctx.fillRect(bx, H - bh, 30, bh);
      }
      ctx.fillStyle = "rgba(255,214,138,0.28)";
      for (let i = 0; i < 26; i++) {
        let bx = (i * 71 - t * 9) % (W + 80); if (bx < -80) bx += W + 80;
        const bh = 16 + ((i * 37) % 40);
        for (let r = 0; r < Math.floor(bh / 12); r++) ctx.fillRect(bx + 6 + ((i + r) % 3) * 8, H - bh + 5 + r * 12, 3, 4);
      }

      // ── the towers you are threading ────────────────────────────────────
      for (const p of posts) {
        const x = (p.x0 - t * FLY.SPEED) * W;
        const pw = FLY.POST_W * W;
        if (x < -pw * 3 || x > W + pw * 3) continue;
        const gy = p.gapY * H, g = (p.gap * H) / 2;

        const tower = (yy, hh) => {
          if (hh <= 0) return;
          const tg = ctx.createLinearGradient(x - pw, 0, x + pw, 0);
          tg.addColorStop(0, "#080b1d"); tg.addColorStop(0.22, "#242a52");
          tg.addColorStop(0.5, "#171c3c"); tg.addColorStop(0.78, "#101430");
          tg.addColorStop(1, "#05060f");
          ctx.fillStyle = tg; ctx.fillRect(x - pw, yy, pw * 2, hh);
          // Lit windows across the full face, so a tower reads as a building
          // rather than a coloured bar. Some are dark: nobody is home in all of them.
          const cols = Math.max(2, Math.floor((pw * 2 - 8) / 9));
          for (let wy = yy + 10; wy < yy + hh - 7; wy += 14) {
            for (let c = 0; c < cols; c++) {
              const lit = ((wy * 3 + c * 29 + p.id * 17) | 0) % 5;
              if (lit === 0) continue;
              ctx.fillStyle = lit === 1 ? "rgba(255,226,158,0.75)"
                            : lit === 2 ? "rgba(198,214,255,0.42)" : "rgba(255,226,158,0.30)";
              ctx.fillRect(x - pw + 5 + c * 9, wy, 4, 6);
            }
          }
          ctx.fillStyle = `${k.glow}44`; ctx.fillRect(x - pw + 1, yy, 1.5, hh);
          ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(x + pw - 2, yy, 2, hh);
        };
        tower(0, gy - g);
        tower(gy + g, H - (gy + g));

        // the lip of each tower, and the lit gap between them
        ctx.fillStyle = k.glow;
        ctx.fillRect(x - pw - 5, gy - g - 5, pw * 2 + 10, 5);
        ctx.fillRect(x - pw - 5, gy + g, pw * 2 + 10, 5);
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillRect(x - pw - 5, gy - g - 5, pw * 2 + 10, 1.5);
        ctx.fillRect(x - pw - 5, gy + g, pw * 2 + 10, 1.5);
        // the way through, lit from both lips so it reads as the target
        const beam = ctx.createLinearGradient(0, gy - g, 0, gy + g);
        beam.addColorStop(0, `${k.glow}30`);
        beam.addColorStop(0.22, "rgba(0,0,0,0)");
        beam.addColorStop(0.78, "rgba(0,0,0,0)");
        beam.addColorStop(1, `${k.glow}30`);
        ctx.fillStyle = beam; ctx.fillRect(x - pw - 5, gy - g, pw * 2 + 10, g * 2);
        // an aircraft light on top, blinking
        if (gy - g > 8) {
          ctx.fillStyle = Math.floor(t * 2) % 2 ? "#ff8a6a" : "rgba(255,138,106,0.25)";
          ctx.beginPath(); ctx.arc(x, gy - g - 9, 2.4, 0, Math.PI * 2); ctx.fill();
        }
      }

      // ── the plane, and the paper it leaves behind ───────────────────────
      const px = FLY.PLANE_X * W;
      trail.forEach((ty, i) => {
        const a = (i / trail.length);
        ctx.globalAlpha = a * 0.5;
        ctx.fillStyle = a > 0.7 ? "#fff6e2" : k.glow;
        const sz = 1 + a * 2;
        ctx.fillRect(px - (trail.length - i) * 2.6, ty * H - sz / 2, sz, sz);
      });
      ctx.globalAlpha = 1;

      const tilt = Math.max(-0.5, Math.min(0.55, v * 0.62));
      ctx.save();
      ctx.translate(px, y * H);
      ctx.rotate(tilt);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath(); ctx.moveTo(18, 2); ctx.lineTo(-14, -9); ctx.lineTo(-7, 2); ctx.lineTo(-14, 12);
      ctx.closePath(); ctx.fill();
      const wing = ctx.createLinearGradient(0, -11, 0, 11);
      wing.addColorStop(0, "#fffaf0"); wing.addColorStop(0.5, PAPER); wing.addColorStop(1, "#c9b48c");
      ctx.fillStyle = wing;
      ctx.beginPath(); ctx.moveTo(17, 0); ctx.lineTo(-14, -10); ctx.lineTo(-7, 0); ctx.lineTo(-14, 10);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(90,70,40,0.6)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(17, 0); ctx.lineTo(-7, 0); ctx.stroke();
      ctx.strokeStyle = "rgba(90,70,40,0.35)";
      ctx.beginPath(); ctx.moveTo(-14, -10); ctx.lineTo(-7, 0); ctx.lineTo(-14, 10); ctx.stroke();
      ctx.fillStyle = "#b4653f";                      // airmail stripe
      ctx.fillRect(-2, -3.5, 8, 1.6);
      ctx.restore();

      pips(ctx, W, passed, FLY.TARGET, k);
      label(ctx, `${passed} / ${FLY.TARGET} delivered`, 12, 20, 11, k.glow);
      label(ctx, dead ? "down" : "hold to climb", W - 12, 20, 11,
            dead ? "#e08a6a" : "rgba(255,255,255,0.45)", "right");
    }
  };
}

export const MAKE = { franking: frankingGame, mailrun: mailrunGame };

/**
 * Run one game to completion.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {"franking"|"mailrun"} id
 * @param {number} seed
 * @param {(result:{won:boolean, score:number, taps?:Array, events?:Array})=>void} onEnd
 */
export function play(canvas, id, seed, onEnd) {
  const ctx = canvas.getContext("2d");
  const game = MAKE[id](seed);
  let raf = 0, last = 0, acc = 0, step = 0, alive = true, ended = false;

  const finish = (won) => {
    if (ended) return;
    ended = true; alive = false;
    cancelAnimationFrame(raf);
    detach();
    onEnd({
      won, score: game.score, target: game.target,
      taps: game.taps, events: game.events,
      missed: game.missed, misfire: game.misfire
    });
  };

  /* ── the input surface ──────────────────────────────────────────────────
     Everything goes through these two, so the on-screen buttons and the canvas
     are the same input as far as the simulation is concerned. Nothing here
     touches the clock: a press is stamped with the CURRENT step index, which is
     the only timing the server will agree with.                              */
  const api = {
    /** Franking Rush: strike a lane, 0 to 2. */
    press(lane) {
      if (!alive || id !== "franking") return;
      game.tap(step, Math.max(0, Math.min(2, lane | 0)));
    },
    /** Mail Run: hold to climb, release to fall. */
    hold(down) {
      if (!alive || id !== "mailrun") return;
      game.setDown(step, !!down);
    }
  };

  const laneOf = (e) => {
    const r = canvas.getBoundingClientRect();
    return Math.max(0, Math.min(2, Math.floor(((e.clientY - r.top) / r.height) * 3)));
  };
  const onDown = (e) => {
    if (!alive) return;
    e.preventDefault();
    if (id === "franking") api.press(laneOf(e));
    else { canvas.setPointerCapture?.(e.pointerId); api.hold(true); }
  };
  const onUp = () => api.hold(false);
  const onKey = (e) => {
    if (id === "mailrun") {
      if (e.code !== "Space" && e.code !== "Enter" && e.code !== "ArrowUp") return;
      e.preventDefault();
      api.hold(e.type === "keydown");
      return;
    }
    // Franking Rush takes 1/2/3 and the arrow keys for its three lanes.
    const lane = { Digit1: 0, Digit2: 1, Digit3: 2, ArrowUp: 0, ArrowDown: 2 }[e.code];
    const mid = e.code === "Space" || e.code === "Enter" || e.code === "ArrowRight";
    if (lane === undefined && !mid) return;
    e.preventDefault();
    if (e.type === "keydown" && !e.repeat) api.press(mid ? 1 : lane);
  };
  // A long press on a canvas otherwise starts a text selection or a callout menu,
  // which is exactly what a hold-to-climb game must not do.
  const swallow = (e) => e.preventDefault();

  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  canvas.addEventListener("contextmenu", swallow);
  canvas.addEventListener("keydown", onKey);
  canvas.addEventListener("keyup", onKey);
  const onHide = () => { if (document.hidden) finish(false); };
  document.addEventListener("visibilitychange", onHide);

  function detach() {
    canvas.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    canvas.removeEventListener("contextmenu", swallow);
    canvas.removeEventListener("keydown", onKey);
    canvas.removeEventListener("keyup", onKey);
    document.removeEventListener("visibilitychange", onHide);
  }

  function frame(now) {
    if (!alive) return;
    if (!last) last = now;
    acc += Math.min(0.25, (now - last) / 1000);
    last = now;
    // Fixed steps only: the server replays these exact steps, so the simulation must
    // never depend on how fast this particular browser happens to be painting.
    while (acc >= STEP) {
      acc -= STEP;
      const r = game.step(step);
      step += 1;
      if (r === "won") return finish(true);
      if (r === "lost") return finish(false);
    }
    const { w, h } = fitCanvas(canvas, ctx);
    ctx.clearRect(0, 0, w, h);
    game.draw(ctx, w, h, step, now);
    raf = requestAnimationFrame(frame);
  }

  fitCanvas(canvas, ctx);
  raf = requestAnimationFrame(frame);
  return { stop: () => finish(false), press: api.press, hold: api.hold };
}

/** A machine playing itself behind the Insert-coin overlay. */
export function attract(canvas, id, seed = 3) {
  const ctx = canvas.getContext("2d");
  let game = MAKE[id](seed), raf = 0, last = 0, acc = 0, step = 0, alive = true, gen = 0;

  const paint = () => {
    const { w, h } = fitCanvas(canvas, ctx);
    ctx.clearRect(0, 0, w, h);
    game.draw(ctx, w, h, step, 0);
  };

  if (PRM()) { paint(); return { stop() {} }; }

  function frame(now) {
    if (!alive) return;
    if (!last) last = now;
    acc += Math.min(0.25, (now - last) / 1000);
    last = now;
    while (acc >= STEP) {
      acc -= STEP;
      // A hands-off demo: it plays badly, restarts, and never claims anything.
      if (id === "franking" && step % 46 === 0) game.tap(step, Math.floor(Math.random() * 3));
      if (id === "mailrun") game.setDown(step, Math.sin(step / 26) > -0.1);
      const r = game.step(step);
      step += 1;
      if (r) { gen += 1; game = MAKE[id](seed + gen); step = 0; }
    }
    paint();
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return { stop() { alive = false; cancelAnimationFrame(raf); } };
}
