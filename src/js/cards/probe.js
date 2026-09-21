/**
 * cards/probe.js — the card measured on a real engine.
 *
 * Headless Chrome paces requestAnimationFrame to a timer whatever the paint
 * costs, so it can count paints but cannot feel a frame. That is how a card
 * that ran at three and a half frames a second on an iPhone shipped with a
 * clean trace. This rig runs in whatever browser opens it — Safari on a
 * phone, the iOS Simulator, a desktop — turns the card by script the way a
 * thumb would, and reports what the frames actually took to a local sink.
 * It loads ONLY when the URL carries ?probe=<label>[:engraved[:quiet]], and
 * pages/card.js imports it dynamically, so a normal visit never fetches it.
 *
 * What it reports:
 *   switchMs  how long the page was blocked after switching skins: the time
 *             from the switch to the second animation frame after it.
 *   reliefMs  with the engraved set, how long after the switch its relief
 *             was laid — the raster the switch defers past the dust.
 *   frames    every frame interval during a three-second scripted turn while
 *             Inspecting: mean, median, p95, worst, and how many ran long.
 *   `quiet` turns the light off for the turn, to weigh it on its own.
 */
export async function run({ label, setSkin, setInspect, att, grab, quiet, parts }) {
  const [name, skin, mode = ''] = String(label).split(':');
  if (mode === 'art' || mode === 'flat') parts(mode);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  await sleep(1500);

  // The switch, timed to the second frame after it; then the relief's arrival.
  const t0 = performance.now();
  setSkin(skin === 'engraved', { save: true });
  // Bisecting: strip the base faces' impression filter before it ever paints.
  if (mode === 'noimpress') document.querySelectorAll('.face g[filter]').forEach((g) => g.removeAttribute('filter'));
  await frame(); await frame();
  const switchMs = performance.now() - t0;
  // The dust's flight: every frame for the next 1.3 seconds.
  const flight = [];
  let f0 = await frame();
  while (f0 - t0 < 1300) { const f1 = await frame(); flight.push(f1 - f0); f0 = f1; }
  const fs = [...flight].sort((a, b) => a - b);
  const morph = { p50: +fs[Math.floor(fs.length / 2)].toFixed(1), p95: +fs[Math.min(fs.length - 1, Math.floor(fs.length * 0.95))].toFixed(1), worst: +fs[fs.length - 1].toFixed(1) };
  // Then the relief's arrival, and the longest frame on the way to it: the
  // raster of its stills, which is the one stall the switch still has.
  let reliefMs = null, reliefStall = null;
  if (skin === 'engraved') {
    let worst = 0, prev = await frame();
    while (performance.now() - t0 < 4000) {
      const now = await frame(); worst = Math.max(worst, now - prev); prev = now;
      if (document.querySelector('.relief.is-set')) { reliefMs = now - t0; reliefStall = +worst.toFixed(0); break; }
    }
  }
  await sleep(1200);

  // The turn: rigid under a scripted hand for three seconds.
  if (mode === 'quiet') quiet(true);
  // Bisecting the pick-up: the same turn without the class toggles, or with one of them.
  const cardEl = document.getElementById('card'), wrapEl = cardEl.parentElement;
  if (mode === 'noinspect') { /* nothing */ }
  else if (mode === 'cardclass') cardEl.classList.add('is-inspecting');
  else if (mode === 'wrapclass') wrapEl.classList.add('is-inspecting');
  else setInspect(true);
  grab.on = true;
  const deltas = [];
  let last = await frame();
  const start = last;
  while (last - start < 3000) {
    const t = (last - start) / 1000;
    att.tx = 22 * Math.sin(t * 2.3);
    att.ty = 70 * Math.sin(t * 1.4);
    const now = await frame();
    deltas.push(now - last);
    last = now;
  }
  grab.on = false;
  if (mode === 'cardclass' || mode === 'wrapclass' || mode === 'noinspect') { cardEl.classList.remove('is-inspecting'); wrapEl.classList.remove('is-inspecting'); }
  else setInspect(false);
  quiet(false);

  const sorted = [...deltas].sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const report = {
    name, skin: skin || 'print', mode,
    ua: navigator.userAgent.replace(/^Mozilla\/5\.0 /, '').slice(0, 90),
    dpr: window.devicePixelRatio, width: innerWidth,
    switchMs: Math.round(switchMs), reliefMs: reliefMs === null ? null : Math.round(reliefMs), reliefStall, morph,
    frames: deltas.length,
    mean: +(deltas.reduce((a, b) => a + b, 0) / deltas.length).toFixed(1),
    p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), worst: +sorted[sorted.length - 1].toFixed(1),
    over20: deltas.filter((d) => d > 20).length, over34: deltas.filter((d) => d > 34).length,
  };
  document.title = `${report.skin} p50 ${report.p50} p95 ${report.p95} worst ${report.worst} switch ${report.switchMs}`;
  // On the page too, for a run where no sink can be reached — the live site
  // from a simulator, say — so a screenshot carries the numbers out.
  const out = document.createElement('pre');
  out.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99;margin:0;padding:8px 10px;background:#000;color:#fff;font:12px/1.4 monospace;white-space:pre-wrap;max-width:92vw';
  out.textContent = `${report.name} ${report.skin} ${report.mode}\nswitch ${report.switchMs}ms  dust p95 ${report.morph.p95} worst ${report.morph.worst}\nrelief at ${report.reliefMs} stall ${report.reliefStall}\nturn p50 ${report.p50} p95 ${report.p95} worst ${report.worst} (${report.frames} frames, ${report.over20} over 20ms)\n${report.ua}`;
  document.body.appendChild(out);
  try { await fetch('/probe', { method: 'POST', body: JSON.stringify(report), keepalive: true }); } catch (_) {}
  return report;
}
