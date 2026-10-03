#!/usr/bin/env node
/**
 * scripts/browser-check.mjs — load the key pages in a real browser and check
 * what a visitor would actually get, at phone and desktop size.
 *
 *   npm run browser-check                                   # against kaayko.com
 *   BASE=https://kaaykostore--<channel>.web.app npm run browser-check   # a preview channel
 *   ONLY=forecast npm run browser-check                    # just the pages whose label matches
 *
 * Built from the probe that found, on 3 Oct 2026: the homepage resizing its
 * headlines after first paint (a race only a live load showed), the forecast
 * running on the viewer's clock, and the API never sending the lake's
 * timezone. Static checks (npm run check) cannot see any of those.
 *
 * Uses the Chrome already installed (CHROME_PATH to override), headless, a
 * fresh profile per run, and the DevTools protocol over Node's built-in
 * WebSocket — no dependencies. Screenshots go to a NEW folder every run
 * (never overwritten); the path is printed. Exit code 1 if anything fails.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const T = require('../src/js/services/spotTime.js');
const { checkContract } = require('../src/js/contracts/paddling.js');

const BASE = (process.env.BASE || 'https://kaayko.com').replace(/\/$/, '');
const STORE = (process.env.STORE_BASE || 'https://kaay.store').replace(/\/$/, '');
const API = `${BASE}/api`;
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ONLY = process.env.ONLY || '';   // ONLY=forecast checks just the pages whose label contains it
const CLS_MAX = Number(process.env.CLS_MAX || 0.1);   // Google's "good" line; lower it to see smaller shifts
const RUN = new Date().toISOString().replace(/[:.]/g, '-');
const OUT = join(tmpdir(), 'kaayko-browser-check', RUN);
mkdirSync(OUT, { recursive: true });

// Every view is a viewer in Dallas, except the "far" one: the same phone in India.
// A lake's page must read the same from both, because every rating is the
// lake's, at the lake's current time, whoever is looking.
const PHONE = { name: 'phone', width: 390, height: 844, mobile: true, tz: 'America/Chicago',
  ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' };
const DESKTOP = { name: 'desktop', width: 1440, height: 900, mobile: false, ua: null, tz: 'America/Chicago' };
const FAR = { ...PHONE, name: 'phone@IST', tz: 'Asia/Kolkata' };

const results = [];
const record = (page, view, ok, detail) => results.push({ page, view, ok, detail });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── the homepage recorder (from the 3 Oct probe): transitions + headline sizes from the first frame
const HOME_PROBE = `(() => {
  const log = window.__bc = { transitions: [], sizes: new Set() };
  document.addEventListener('transitionrun', (e) => {
    const el = e.target; const cls = typeof el.className === 'string' ? el.className.split(' ')[0] : el.nodeName;
    log.transitions.push(e.propertyName + ' .' + cls);
  }, true);
  const tick = () => {
    const l = document.querySelector('.choice-label');
    // only what a person can see: labels stay visibility:hidden until placed
    if (l && getComputedStyle(l).visibility === 'visible') log.sizes.add(getComputedStyle(l).fontSize);
    if (performance.now() < 3000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();`;

async function browser() {
  if (!existsSync(CHROME)) throw new Error(`Chrome not found at ${CHROME}; set CHROME_PATH`);
  const profile = join(OUT, 'profile');
  const port = 9400 + Math.floor(Math.random() * 400);
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
  let version;
  for (let i = 0; i < 50 && !version; i++) {
    await sleep(200);
    try { version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch (_) {}
  }
  if (!version) { proc.kill(); throw new Error('Chrome did not start'); }
  return { port, close: async () => { proc.kill('SIGTERM'); await sleep(800); rmSync(profile, { recursive: true, force: true }); } };
}

/** One fresh tab: navigate, collect errors, run assertions, screenshot. */
async function visit(port, url, view, { probe = null, settle = 3500 } = {}) {
  const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map();
  const errors = [], failed = [];
  let status = null;
  const origin = new URL(url).origin;
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
    const p = msg.params || {};
    if (msg.method === 'Runtime.exceptionThrown') errors.push((p.exceptionDetails.exception?.description || p.exceptionDetails.text || '').split('\n')[0]);
    if (msg.method === 'Runtime.consoleAPICalled' && p.type === 'error') errors.push(p.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200));
    if (msg.method === 'Network.responseReceived') {
      const r = p.response;
      // the first Document response is the page itself (a redirect lands here as the final 200)
      if (p.type === 'Document' && status === null) status = r.status;
      if (r.status >= 400 && r.url.startsWith(origin)) failed.push(`${r.status} ${r.url.slice(origin.length, origin.length + 80)}`);
    }
    if (msg.method === 'Network.loadingFailed' && !p.canceled && p.type !== 'Ping') failed.push(`failed ${p.errorText} (${p.type})`);
  };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (expression) => {
    const out = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (out.result?.exceptionDetails) throw new Error(out.result.exceptionDetails.exception?.description || 'evaluate failed');
    return out.result?.result?.value;
  };
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: view.width, height: view.height, deviceScaleFactor: view.mobile ? 2 : 1, mobile: view.mobile });
  if (view.mobile) {
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' });
  }
  if (view.ua) await send('Network.setUserAgentOverride', { userAgent: view.ua });
  if (view.tz) await send('Emulation.setTimezoneOverride', { timezoneId: view.tz });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { window.__cls = 0; window.__shifts = []; const name = (n) => !n || !n.tagName ? '?' : n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (typeof n.className === 'string' && n.className ? '.' + n.className.trim().split(/\\s+/).slice(0, 2).join('.') : ''); try { new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (e.hadRecentInput) return; window.__cls += e.value; window.__shifts.push({ v: +e.value.toFixed(3), t: Math.round(e.startTime), who: (e.sources || []).map((x) => name(x.node) + ' ' + Math.round(x.currentRect.y - x.previousRect.y) + 'px/' + Math.round(x.currentRect.height - x.previousRect.height) + 'h').slice(0, 3).join(', ') }); })).observe({ type: 'layout-shift', buffered: true }); } catch (_) {} })();` + (probe || '') });
  await send('Page.navigate', { url });
  await sleep(settle);
  const cls = await evaluate('window.__cls || 0');
  const shifts = await evaluate('(window.__shifts || []).sort((a, b) => b.v - a.v).slice(0, 3)');
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
  const file = join(OUT, `${new URL(url).hostname}${new URL(url).pathname.replace(/\//g, '_') || '_'}${new URL(url).search.replace(/[^a-z0-9]/gi, '_')}-${view.name}.jpg`);
  writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
  return { evaluate, errors, failed, status, cls, shifts, close: () => { try { ws.close(); } catch (_) {} fetch(`http://127.0.0.1:${port}/json/close/${tab.id}`).catch(() => {}); } };
}

/** The common bar every page must clear, then the page's own checks. */
async function checkPage(port, label, url, view, assertions = async () => [], opts = {}) {
  if (ONLY && !label.includes(ONLY)) return;
  if (opts.skip) return;
  let v;
  try {
    v = await visit(port, url, view, opts);
    const problems = [];
    if (v.status !== 200) problems.push(`document status ${v.status}`);
    if (v.errors.length) problems.push(`script errors: ${[...new Set(v.errors)].slice(0, 3).join(' | ')}`);
    if (v.failed.length) problems.push(`failed requests: ${[...new Set(v.failed)].slice(0, 3).join(' | ')}`);
    if (v.cls > CLS_MAX) problems.push(`layout shift ${v.cls.toFixed(3)} (> ${CLS_MAX}): ${v.shifts.map((x) => `${x.v} at ${x.t}ms ${x.who}`).join(' | ')}`);
    problems.push(...(await assertions(v.evaluate)));
    record(label, view.name, problems.length === 0, problems.join('; ') || `ok (CLS ${v.cls.toFixed(3)})`);
  } catch (e) {
    record(label, view.name, false, `could not check: ${e.message.slice(0, 160)}`);
  } finally { v?.close(); }
}

/** What every surface must show for a spot right now: night (no score) or the rating. */
function expectFor(score) {
  if (T.isNightAt(score)) return { night: true, text: 'night' };
  return { night: false, text: score && score.rating != null ? Number(score.rating).toFixed(1) : null };
}

// The same lake page, read from Dallas and from India, must say the same thing.
const seen = new Map();   // "page|what" → { view, value }
function sameEverywhere(key, view, value) {
  const v = JSON.stringify(value);
  if (!seen.has(key)) { seen.set(key, { view, v }); return []; }
  const first = seen.get(key);
  return first.v === v ? [] : [`${key} differs by viewer: ${first.view} saw ${first.v}, ${view} saw ${v}`];
}

const json = async (u, init) => (await fetch(u, { headers: { 'User-Agent': PHONE.ua, 'Content-Type': 'application/json' }, ...init })).json();

async function main() {
  console.log(`browser-check → ${BASE}  (store ${STORE})\nscreenshots → ${OUT}\n`);

  // ── 1. API contracts against the live responses
  const spots = await json(`${API}/paddlingOut`);
  const spotProblems = spots.flatMap((s) => checkContract('spot', s).map((p) => `${s.id}: ${p}`));
  record('API /paddlingOut', 'api', spotProblems.length === 0, spotProblems.slice(0, 4).join('; ') || `${spots.length} spots keep the contract`);
  const forecastSpots = ['powell', 'ambazari'].map((id) => spots.find((s) => s.id === id)).filter(Boolean);
  const forecasts = {};
  for (const s of forecastSpots) {
    const ff = await json(`${API}/fastForecast?lat=${s.location.latitude}&lng=${s.location.longitude}`);
    forecasts[s.id] = ff;
    const p = checkContract('fastForecast', ff);
    record(`API /fastForecast ${s.id}`, 'api', p.length === 0, p.join('; ') || `zone ${ff.location.timeZone}`);
  }
  const ps = await json(`${API}/paddleScore?spotId=powell`);
  const psp = checkContract('paddleScore', ps);
  record('API /paddleScore powell', 'api', psp.length === 0, psp.join('; ') || 'ok');

  const b = await browser();
  try {
    for (const view of [PHONE, DESKTOP, FAR]) {
      const far = view === FAR;
      // ── 2. homepage: one headline size from the first frame, only the entrance moves
      await checkPage(b.port, 'home', `${BASE}/`, view, async (ev) => {
        const r = await ev('({ t: [...new Set(window.__bc.transitions)], sizes: [...window.__bc.sizes], panels: document.getElementById("pg-home").dataset.panels, cls: document.getElementById("pg-home").className })');
        const allowed = new Set(['transform .seam', 'opacity .mark', 'opacity .choice-sub', 'transform .choice-sub']);
        const extra = r.t.filter((x) => !allowed.has(x));
        const p = [];
        if (r.sizes.length !== 1) p.push(`headline changed size on load: ${r.sizes.join(' → ')}`);
        if (extra.length) p.push(`unplanned load transitions: ${extra.join(', ')}`);
        if (!/is-lit/.test(r.cls)) p.push('entrance never finished');
        return p;
      }, { probe: HOME_PROBE, skip: far });

      // ── 3. Paddling Out list: every card shows night exactly when it is night AT THAT LAKE
      await checkPage(b.port, 'paddlingout', `${BASE}/paddlingout`, view, async (ev) => {
        const r = await ev(`fetch('/api/paddlingOut').then(x => x.json()).then(api => ({ api, cards: [...document.querySelectorAll('[data-spot-id]')].map(c => ({ id: c.dataset.spotId, text: (c.querySelector('.badge-score, .pcard-stat-val') || {}).textContent || '' })) }))`);
        const p = [];
        if (r.cards.length < 10) p.push(`only ${r.cards.length} lake cards rendered`);
        const byId = new Map(r.api.map((s) => [s.id, s.paddleScore]));
        for (const c of r.cards) {
          const want = expectFor(byId.get(c.id));
          const got = c.text.includes('\u263E') ? 'night' : c.text.trim();
          if (want.text != null && got !== want.text) p.push(`${c.id}: card shows "${got}", the lake says "${want.text}"`);
        }
        p.push(...sameEverywhere('list', view.name, r.cards.map((c) => c.id + '=' + (c.text.includes('\u263E') ? 'night' : c.text.trim()))));
        return p;
      });

      // ── 3b. a static spot page: the same rule on its live pill
      for (const [id, slug] of [['ambazari', 'ambazari-lake-nagpur'], ['powell', 'lake-powell-utah']]) {
        await checkPage(b.port, `spot page ${id}`, `${BASE}/paddlingout/${slug}`, view, async (ev) => {
          const r = await ev(`fetch('/api/paddlingOut').then(x => x.json()).then(api => ({ api, text: (document.getElementById('live-text') || {}).textContent || '' }))`);
          const want = expectFor((r.api.find((s) => s.id === id) || {}).paddleScore);
          const p = [];
          if (want.night && !/Night at the lake/.test(r.text)) p.push(`pill says "${r.text}" while it is night at the lake`);
          if (!want.night && want.text && !r.text.includes(want.text + ' / 5')) p.push(`pill says "${r.text}", the lake says ${want.text}`);
          p.push(...sameEverywhere(`spot ${id}`, view.name, r.text));
          return p;
        }, { settle: 4000 });
      }

      // ── 4. forecast: labels and "this hour" on the LAKE's clock
      for (const s of forecastSpots) {
        await checkPage(b.port, `forecast ${s.id}`, `${BASE}/paddlingout/forecast?id=${s.id}`, view, async (ev) => {
          const ff = forecasts[s.id];
          const now = T.nowAt(ff.location);
          const dom = await ev(`fetch('/api/paddleScore?spotId=${s.id}').then(x => x.json()).then(ps => ({ ps, labels: [...document.querySelectorAll('.khm-day-label')].map(e => e.textContent.replace(/\\s+/g,' ').trim()), now: (document.querySelector('.khm-now') || {}).style?.left || null, nightMark: !!document.querySelector('.night-mark'), next: ((document.querySelector('.night-next-when') || {}).textContent || '').trim() }))`);
          const p = [];
          const night = T.isNightAt({ ...dom.ps.paddleScore, conditions: dom.ps.conditions });
          if (night !== dom.nightMark) p.push(night ? 'it is night at the lake but the hero shows a score' : 'the hero says "after dark" in daylight at the lake');
          p.push(...sameEverywhere(`forecast ${s.id}`, view.name, { labels: dom.labels, now: dom.now, night: dom.nightMark, next: dom.next }));
          const want = ff.forecast.slice(0, 3).map((d) => { const l = T.dayLabels(d.date, now); return `${l.primary} ${l.secondary}`; });
          want.forEach((w, i) => { if (dom.labels[i] && dom.labels[i].replace(/\s/g, '') !== w.replace(/\s/g, '')) p.push(`day ${i} labelled "${dom.labels[i]}", lake says "${w}"`); });
          const todayOnForecast = ff.forecast.slice(0, 3).some((d) => d.date === now.date);
          const inStrip = now.hour >= 6 && now.hour <= 20 && todayOnForecast;
          if (inStrip && !dom.now) p.push(`no "this hour" marker at the lake's ${now.hour}:00`);
          if (!inStrip && dom.now) p.push(`"this hour" drawn at ${dom.now} while the lake's hour (${now.hour}:00) is off the strip`);
          if (inStrip && dom.now) {
            const want = ((now.hour - 6) / 14 * 100).toFixed(1);
            if (Math.abs(parseFloat(dom.now) - parseFloat(want)) > 0.6) p.push(`"this hour" at ${dom.now}, lake hour ${now.hour} → ${want}%`);
          }
          return p;
        }, { settle: 6000 });
      }

      if (far) continue;   // the far viewer only re-reads the lake pages

      // ── 4b. Find or add: one page. The old add address forwards, filled in.
      await checkPage(b.port, 'find or add', `${BASE}/paddlingout/submitentry?name=Dillon%20Reservoir&lat=39.6175&lng=-106.0526`, view, async (ev) => {
        const r = await ev(`({ url: location.pathname + location.search, title: (document.getElementById('po-title') || {}).textContent, actions: document.querySelectorAll('.po-actions .po-btn').length, add: !document.getElementById('add-pane').hidden, find: !document.getElementById('find-pane').hidden, name: document.getElementById('lakeName').value, mapH: document.getElementById('pin-map').offsetHeight, pin: !!document.querySelector('#pin-map .leaflet-marker-icon') })`);
        const p = [];
        if (!/^\/paddlingout\/search\?mode=add/.test(r.url)) p.push(`old add address landed on ${r.url}`);
        if (!r.add || r.find) p.push('the Add tab is not the one showing');
        if (r.title !== 'Add a lake') p.push(`header says "${r.title}"`);
        if (r.name !== 'Dillon Reservoir') p.push('the name did not carry over');
        if (r.mapH < 200 || !r.pin) p.push(`add map ${r.mapH}px tall, pin ${r.pin ? 'placed' : 'missing'}`);
        if (r.actions !== 2) p.push(`header has ${r.actions} actions, expected Find-or-add + Settings`);
        const back = await ev(`(document.getElementById('mode-find').click(), new Promise(ok => setTimeout(() => ok({ find: !document.getElementById('find-pane').hidden, mapH: document.getElementById('search-map').offsetHeight }), 600)))`);
        if (!back.find || back.mapH < 150) p.push(`back to Find: pane ${back.find ? 'shown' : 'hidden'}, map ${back.mapH}px`);
        return p;
      }, { settle: 5000 });

      // ── 5. Stories
      await checkPage(b.port, 'stories', `${BASE}/stories`, view, async (ev) =>
        (await ev('document.querySelectorAll(".cover-wrap").length')) >= 1 ? [] : ['no story covers on the shelf']);
      await checkPage(b.port, 'story', `${BASE}/stories/never-give-up`, view, async (ev) =>
        (await ev('document.querySelectorAll("h2.chapter").length')) >= 6 ? [] : ['chapters missing']);

      // ── 6. /card: renders, and survives a full stop/start
      await checkPage(b.port, 'card', `${BASE}/card`, view, async (ev) => {
        const before = await ev('({ front: !!document.querySelector("#face-front svg"), marks: document.querySelectorAll("#marks .mark").length, api: !!window.KaaykoCard, coarse: matchMedia("(pointer: coarse)").matches })');
        const p = [];
        // /card has separate touch and mouse code paths; it once shipped blank on every phone
        // because only the mouse one was looked at. The phone run must really be a touch device.
        if (before.coarse !== view.mobile) p.push(`expected ${view.mobile ? 'a touch' : 'a mouse'} pointer, got ${before.coarse ? 'touch' : 'mouse'}`);
        if (!before.front) p.push('card front not drawn');
        if (!before.marks) p.push('no series marks');
        if (!before.api) { p.push('KaaykoCard.start/stop missing'); return p; }
        const after = await ev(`new Promise((ok) => { KaaykoCard.stop(); KaaykoCard.start(); setTimeout(() => ok({ front: !!document.querySelector("#face-front svg"), marks: document.querySelectorAll("#marks .mark").length }), 2500); })`);
        if (!after.front) p.push('card front missing after stop/start');
        if (after.marks !== before.marks) p.push(`series marks ${before.marks} → ${after.marks} after stop/start`);
        return p;
      }, { settle: 5000 });

      // ── 7. the store host
      await checkPage(b.port, 'kaay.store', `${STORE}/`, view, async (ev) => {
        const n = await ev('document.querySelectorAll(".product-card, [data-product-id], .card").length');
        return n >= 1 ? [] : ['no product tiles'];
      }, { settle: 5000 });
    }
  } finally { await b.close(); }

  // ── report
  const w = Math.max(...results.map((r) => r.page.length));
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.page.padEnd(w)}  ${r.view.padEnd(7)}  ${r.detail}`);
  const bad = results.filter((r) => !r.ok).length;
  writeFileSync(join(OUT, 'report.json'), JSON.stringify({ base: BASE, store: STORE, at: RUN, results }, null, 1));
  console.log(`\n${results.length - bad}/${results.length} passed · report + screenshots: ${OUT}`);
  process.exit(bad ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
