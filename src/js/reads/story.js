/**
 * Kaayko Reads — the story reader. One article, two ways to hold it: Scroll (a single column)
 * and Book (the same article cut into a two-page spread by CSS columns, turned by hand).
 * Switching keeps the reader's place. Built to WCAG 2.2 AA with AAA contrast; see css/reads.css.
 */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const story = $('#story'), reader = $('#reader');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
  const store = {
    get(k) { try { return localStorage.getItem('reads:' + k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem('reads:' + k, v); } catch (_) { /* private window */ } }
  };
  const osReduced = matchMedia('(prefers-reduced-motion: reduce)');
  const hostTheme = root.getAttribute('data-host-theme') || '';
  const SCALES = [0.9, 1, 1.12, 1.25, 1.4, 1.6];
  const MINUTES = Number($('#ring-label').firstChild.textContent) || 1;

  const state = {
    layout: root.dataset.layout,
    theme: root.getAttribute('data-theme') || 'auto',
    scale: parseFloat(getComputedStyle(root).getPropertyValue('--scale')) || 1,
    motion: store.get('motion') === null ? !osReduced.matches : store.get('motion') === '1'
  };
  const animate = () => state.motion && !osReduced.matches;

  let announceTimer;
  function announce(msg) {
    clearTimeout(announceTimer);
    const live = $('#announce');
    live.textContent = '';
    announceTimer = setTimeout(() => { live.textContent = msg; }, 60);
  }


  const barH = () => $('#bar').offsetHeight;
  function measureBar() { root.style.setProperty('--barh', `${barH()}px`); }

  /* ── display settings ─────────────────────────────────── */
  function applyTheme() {
    if (state.theme === 'auto') { if (hostTheme) root.setAttribute('data-theme', hostTheme); else root.removeAttribute('data-theme'); }
    else root.setAttribute('data-theme', state.theme);
    // The shared site footer follows html.dark-theme, like every other Kaayko page.
    root.classList.toggle('dark-theme', state.theme === 'dark' || (state.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches));
  }
  function syncControls() {
    $(`#lay-${state.layout}`).checked = true;
    $(`#theme-${state.theme}`).checked = true;
    $('#size-out').textContent = `${Math.round(state.scale * 100)}%`;
    $('#size-down').disabled = state.scale <= SCALES[0];
    $('#size-up').disabled = state.scale >= SCALES[SCALES.length - 1];
    $('#motion').checked = state.motion;
  }
  $$('input[name="theme"]').forEach((r) => r.addEventListener('change', () => {
    state.theme = r.value; store.set('theme', r.value); applyTheme(); Ripples.draw();
  }));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { applyTheme(); Ripples.draw(); });
  function setScale(dir) {
    const i = SCALES.findIndex((s) => Math.abs(s - state.scale) < 0.001);
    const next = SCALES[clamp((i < 0 ? 1 : i) + dir, 0, SCALES.length - 1)];
    if (next === state.scale) return;
    const anchor = currentAnchor();
    state.scale = next; store.set('scale', String(next));
    root.style.setProperty('--scale', String(next));
    syncControls();
    relayout(anchor);
  }
  $('#size-down').addEventListener('click', () => setScale(-1));
  $('#size-up').addEventListener('click', () => setScale(1));
  $('#motion').addEventListener('change', (e) => { state.motion = e.target.checked; store.set('motion', state.motion ? '1' : '0'); });
  const display = $('#display');
  display.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && display.open) { display.open = false; display.querySelector('summary').focus(); }
  });
  document.addEventListener('pointerdown', (e) => { if (display.open && !display.contains(e.target)) display.open = false; });


  const Ripples = window.KaaykoRipples ? window.KaaykoRipples.mount($('#ripples')) : { render() {}, draw() {} };

  /* ── where the reader is: the first block on screen, in either layout ── */
  const blocks = () => $$('.story-head, .story-body > *, .lakes, .story-foot', story);
  function currentAnchor() {
    if (state.layout === 'book' && B.ready) return blocks().find((b) => pageOf(b) >= B.idx) || blocks()[0];
    const top = barH() + 12;
    return blocks().find((b) => b.getBoundingClientRect().bottom > top) || blocks()[0];
  }
  function markHere(block) {
    if (!block || block.classList.contains('story-head')) return;
    $$('.here', story).forEach((b) => b.classList.remove('here', 'fading'));
    block.classList.add('here');
    setTimeout(() => block.classList.add('fading'), 1800);
    setTimeout(() => block.classList.remove('here', 'fading'), 2600);
  }

  /* ── scroll layout ───────────────────────────────────── */
  const scrollMax = () => Math.max(0, document.documentElement.scrollHeight - innerHeight);
  let lastLabel = '';
  function onScroll() {
    if (state.layout !== 'scroll') return;
    const m = scrollMax();
    const f = m ? clamp(scrollY / m, 0, 1) : 0;
    $('#progress').style.width = `${(f * 100).toFixed(2)}%`;
    $('#ring-arc').style.strokeDashoffset = (188.5 * (1 - f)).toFixed(1);
    const done = f > 0.995;
    $('#ring').classList.toggle('done', done);
    const label = done ? 'Read<small>Never give up</small>' : `${Math.max(1, Math.ceil(MINUTES * (1 - f)))}<small>min left</small>`;
    if (label !== lastLabel) { $('#ring-label').innerHTML = label; lastLabel = label; }
  }
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; onScroll(); });
  }, { passive: true });

  /* ── book layout ─────────────────────────────────────── */
  const B = { ready: false, spread: true, pages: 1, idx: 0, pw: 0, ph: 0, iw: 0, ih: 0, padx: 0, padt: 0, padb: 0, flip: null, drag: null, sw: 0 };
  const step = () => (B.spread ? 2 : 1);
  const lastIdx = () => (B.spread ? (B.pages - 1) - ((B.pages - 1) % 2) : B.pages - 1);
  const pagerH = () => $('#pager').offsetHeight || 96;

  function bookFits() {
    const availH = innerHeight - barH() - 120;
    return innerWidth >= 320 && availH >= 300;
  }

  function measureBook() {
    const availW = innerWidth - 32;
    const availH = innerHeight - barH() - pagerH() - 28;
    B.spread = availW >= 780;
    let pw = B.spread ? (availW - 16) / 2 : availW;
    let ph = availH;
    pw = Math.min(pw, 600, ph * 0.76);
    ph = Math.min(ph, pw * 1.42);
    pw = Math.floor(pw); ph = Math.floor(ph);
    const padx = Math.round(clamp(pw * 0.1, 20, 58));
    const padt = Math.round(clamp(ph * 0.085, 36, 62));
    const padb = Math.round(clamp(ph * 0.085, 40, 62));
    Object.assign(B, { pw, ph, padx, padt, padb, iw: pw - padx * 2, ih: ph - padt - padb });
    const bw = B.spread ? pw * 2 : pw;
    const vars = {
      '--pw': pw, '--bh': ph, '--bw': bw, '--iw': B.iw, '--ih': B.ih, '--padx': padx, '--padt': padt, '--padb': padb,
      '--fs': clamp(B.iw / 25, 15, 19),
      '--bx': Math.round((innerWidth - bw) / 2),
      '--by': Math.round(barH() + Math.max(12, (innerHeight - barH() - pagerH() - ph) / 2))
    };
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, `${v}px`);
    reader.classList.toggle('single', !B.spread);
    countPages();
  }

  function countPages() {
    B.sw = story.scrollWidth;
    B.pages = Math.max(1, Math.round((B.sw + B.padx * 2) / B.pw));
  }

  // Which page a block starts on: its first line box, measured from the article's own edge.
  function pageOf(block) {
    const r = block.getClientRects()[0] || block.getBoundingClientRect();
    return clamp(Math.floor((r.left - story.getBoundingClientRect().left + 1) / B.pw), 0, B.pages - 1);
  }

  function setIndex(i, { say = false } = {}) {
    B.idx = clamp(B.spread ? i - (i % 2) : i, 0, lastIdx());
    story.style.setProperty('--shift', `${-B.idx * B.pw}px`);
    $('#window').scrollLeft = 0;
    const a = B.idx + 1, b = Math.min(B.idx + 2, B.pages);
    const label = B.spread && b > a ? `Pages ${a}–${b} of ${B.pages}` : `Page ${a} of ${B.pages}`;
    $('#pager-label').textContent = label;
    const scrub = $('#scrub');
    scrub.max = String(B.pages); scrub.value = String(a);
    scrub.setAttribute('aria-valuetext', label);
    $('#prev').disabled = B.idx <= 0;
    $('#next').disabled = B.idx >= lastIdx();
    $('#folio-l').textContent = B.spread && B.idx > 0 ? String(B.idx + 1) : '';
    $('#folio-r').textContent = B.spread ? (B.idx + 1 < B.pages ? String(B.idx + 2) : '') : (B.idx > 0 ? String(B.idx + 1) : '');
    $('.chrome .rh-l').hidden = B.spread && B.idx === 0;
    $('.chrome .rh-r').hidden = !B.spread && B.idx === 0;
    const prog = lastIdx() ? B.idx / lastIdx() : 0;
    $('.board-l').style.boxShadow = stack(Math.round(prog * 5), -1);
    $('.board-r').style.boxShadow = stack(Math.round((1 - prog) * 5), 1);
    if (say) announce(label);
    pauseHiddenVideo();
  }
  function stack(n, sign) {
    const s = [];
    for (let k = 1; k <= n; k++) s.push(`${sign * k * 1.5}px ${k * 0.7}px 0 -.5px var(--edge)`);
    s.push('0 18px 38px -20px var(--shadow)');
    return s.join(',');
  }

  function layoutBook(anchor) {
    cancelFlip();
    measureBook();
    B.ready = true;
    setIndex(anchor ? pageOf(anchor) : 0);
    prewarmTurns();
  }

  /* ── page turns: a sheet of paper, folded ────────────────────
     The turning sheet folds along the perpendicular bisector between its corner's resting place and
     where that corner is now: under your finger when you drag, along an arc when you tap or press a
     key. The part past the fold is reflected across it and shows the back of the sheet; where the
     sheet has lifted, the page beneath shows through, shadowed along the fold. The corner can never
     pull further from the spine than the paper is wide, so the sheet bends; it does not stretch.
     The four pages a turn needs (left, beneath, front, back) are copies of the article laid out once
     per book layout and kept hidden. A turn only moves and clips them; it never re-lays-out text. */
  const FIN_SVG = '<svg viewBox="0 0 120 120" aria-hidden="true"><g fill="none" stroke="currentColor" filter="url(#ink)"><circle cx="60" cy="60" r="52" stroke-width="3"/><circle cx="60" cy="60" r="33" stroke-width="1.5"/></g><text x="60" y="66" text-anchor="middle" fill="currentColor" font-family="Barlow Condensed, sans-serif" font-weight="600" font-size="17" letter-spacing="4">FIN</text></svg>';
  const Turn = { layer: null, faces: null, key: '' };
  let prewarmTimer = 0;

  function makeFace(role) {
    const face = el('div', `face face-${role}`);
    const win = el('div', 'face-window');
    const copy = story.cloneNode(true);
    copy.removeAttribute('id'); copy.removeAttribute('tabindex'); copy.removeAttribute('aria-labelledby');
    copy.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    copy.querySelectorAll('iframe').forEach((f) => f.replaceWith(el('div', 'video-hold')));  // never a second player
    copy.querySelectorAll('.here').forEach((n) => n.classList.remove('here', 'fading'));
    win.append(copy);
    const rh = el('span', 'rh'), folio = el('span', 'folio'), end = el('div', 'end-mark'), shade = el('div', 'fold-shade');
    end.innerHTML = FIN_SVG;
    face.append(el('div', 'face-board'), win, rh, folio, end, shade);
    Object.assign(face, { _copy: copy, _win: win, _rh: rh, _folio: folio, _end: end, _shade: shade });
    return face;
  }

  function ensureTurnLayer() {
    const key = `${B.spread}:${B.pw}x${B.ph}:${B.sw}:${state.scale}`;
    if (Turn.layer && Turn.key === key) return;
    if (Turn.layer) Turn.layer.remove();
    const layer = el('div', 'turn-layer');
    layer.setAttribute('aria-hidden', 'true');
    layer.inert = true;
    const faces = { left: makeFace('left'), under: makeFace('under'), front: makeFace('front'), back: makeFace('back') };
    faces.left.style.left = `${-B.pw}px`;
    layer.append(faces.left, faces.under, el('div', 'turn-spine'), faces.front, faces.back);
    reader.append(layer);
    Object.assign(Turn, { layer, faces, key });
  }

  // Lay the copies out while the reader is still on the first spread, not on the first turn.
  function prewarmTurns() {
    clearTimeout(prewarmTimer);
    prewarmTimer = setTimeout(() => { if (state.layout === 'book' && B.ready && !B.flip) ensureTurnLayer(); }, 250);
  }

  // Page n on a face. Out of range is plain paper; one past the end is the closing mark.
  function showPage(face, n) {
    const inRange = n >= 0 && n < B.pages;
    face._win.style.visibility = inRange ? '' : 'hidden';
    face._end.style.visibility = n === B.pages ? '' : 'hidden';
    if (inRange) face._copy.style.setProperty('--shift', `${-n * B.pw}px`);
    const head = inRange && n > 0;
    face._rh.style.visibility = face._folio.style.visibility = head ? '' : 'hidden';
    if (head) {
      const leftPage = B.spread && n % 2 === 0;
      face._rh.textContent = leftPage ? 'Kaayko Reads' : 'Never Give Up';
      face._rh.style.textAlign = leftPage || !B.spread ? 'left' : 'right';
      face._folio.textContent = String(n + 1);
    }
  }

  // Keep only the part of polygon `pts` where f(point) >= 0 (one Sutherland–Hodgman pass).
  function clipPoly(pts, f) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], fa = f(a), fb = f(b);
      if (fa >= 0) out.push(a);
      if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }); }
    }
    return out;
  }
  const polygon = (pts) => (pts.length > 2 ? `polygon(${pts.map((p) => `${p.x.toFixed(2)}px ${p.y.toFixed(2)}px`).join(',')})` : 'polygon(0 0,0 0,0 0)');

  // A shadow strip whose top edge lies on the fold line through `pt`, reaching `depth` px along `n`.
  function shade(el, pt, n, depth, alpha) {
    const L = 4 * Math.max(B.pw, B.ph), u = { x: -n.y, y: n.x };
    el.style.width = `${L}px`;
    el.style.height = `${depth.toFixed(1)}px`;
    el.style.transform = `matrix(${u.x},${u.y},${n.x},${n.y},${(pt.x - (u.x * L) / 2).toFixed(2)},${(pt.y - (u.y * L) / 2).toFixed(2)})`;
    el.style.opacity = alpha.toFixed(3);
  }

  // The paper cannot stretch: the corner stays within a page-width of the spine point on its own
  // edge, and within a diagonal of the spine point on the opposite edge.
  function constrain(P, y0) {
    const W = B.pw, H = B.ph, diag = Math.hypot(W, H);
    const near = { x: 0, y: y0 }, far = { x: 0, y: H - y0 };
    let q = { x: P.x, y: P.y };
    const dn = Math.hypot(q.x - near.x, q.y - near.y);
    if (dn > W) q = { x: near.x + (q.x - near.x) * (W / dn), y: near.y + (q.y - near.y) * (W / dn) };
    const df = Math.hypot(q.x - far.x, q.y - far.y);
    if (df > diag) q = { x: far.x + (q.x - far.x) * (diag / df), y: far.y + (q.y - far.y) * (diag / df) };
    return q;
  }

  // Coordinates: origin at the top of the spine (the hinge), the turning sheet spans x 0…W.
  function draw(t, target) {
    const W = B.pw, H = B.ph, { under, front, back } = Turn.faces;
    const P = constrain(target, t.y0);
    t.P = P;
    const dx = P.x - t.c0.x, dy = P.y - t.c0.y, len = Math.hypot(dx, dy);
    if (len < 0.5) {
      front.style.clipPath = 'none';
      back.style.visibility = 'hidden';
      [under, front, back].forEach((f) => { f._shade.style.opacity = '0'; });
      return;
    }
    back.style.visibility = '';
    const d = { x: dx / len, y: dy / len };                       // fold normal, rest corner → corner
    const M = { x: (t.c0.x + P.x) / 2, y: (t.c0.y + P.y) / 2 };   // a point on the fold line
    const md = M.x * d.x + M.y * d.y;
    const side = (X) => X.x * d.x + X.y * d.y - md;               // > 0: flat side, < 0: folded over
    const sheet = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }];
    front.style.clipPath = polygon(clipPoly(sheet, side));
    // The back of the sheet: its page, upright, carried by (reflection across the fold) ∘ (mirror
    // across the sheet's middle). Two reflections make a rotation, so its text is never mirrored.
    const r11 = 1 - 2 * d.x * d.x, r12 = -2 * d.x * d.y, r22 = 1 - 2 * d.y * d.y;
    back.style.transform = `matrix(${(-r11).toFixed(5)},${(-r12).toFixed(5)},${r12.toFixed(5)},${r22.toFixed(5)},${(r11 * W + 2 * md * d.x).toFixed(2)},${(r12 * W + 2 * md * d.y).toFixed(2)})`;
    back.style.clipPath = polygon(clipPoly(sheet, (X) => -side(X)).map((X) => ({ x: W - X.x, y: X.y })));
    // Shading follows how far the corner has travelled and how high the sheet is lifted.
    const p = Math.min(1, len / (2 * W)), lift = Math.sin(Math.PI * p);
    shade(front._shade, M, d, 18 + 26 * lift, 0.07 + 0.16 * lift);
    shade(under._shade, M, { x: -d.x, y: -d.y }, clamp(len * 0.3, 10, 80), 0.18 + 0.22 * (1 - p));
    shade(back._shade, { x: W - M.x, y: M.y }, { x: d.x, y: -d.y }, clamp(len * 0.45, 24, W * 0.6), 0.08 + 0.2 * lift);
  }

  // A tap or a key lifts the corner and carries it over on an arc, inside the paper's reach.
  function arcPoint(t, k) {
    const W = B.pw, H = B.ph, lift = Math.min(H * 0.3, W * 0.5), up = t.y0 === 0 ? 1 : -1;
    return { x: W * Math.cos(Math.PI * k), y: t.y0 + up * lift * Math.sin(Math.PI * k) };
  }

  function startTurn(dir, y0) {
    if (B.flip) return null;
    const from = B.idx, target = from + step() * dir;
    if (target < 0 || target > lastIdx()) return null;
    ensureTurnLayer();
    const W = B.pw, { left, under, front, back } = Turn.faces;
    // Forward from (i, i+1): left i, front i+1, back i+2, beneath i+3. Back is the same sheet
    // turned the other way from the spread before. A single page turns alone; its back is paper.
    const base = B.spread ? (dir > 0 ? from : from - 2) : (dir > 0 ? from : from - 1);
    if (B.spread) showPage(left, base);
    left.style.visibility = B.spread ? '' : 'hidden';
    showPage(under, B.spread ? base + 3 : base + 1);
    showPage(front, B.spread ? base + 1 : base);
    showPage(back, B.spread ? base + 2 : -1);
    Turn.layer.style.left = `${B.spread ? W : 0}px`;
    const t = { dir, from, target, y0, c0: { x: W, y: y0 }, e: { x: -W, y: y0 }, P: null };
    B.flip = t;
    draw(t, dir > 0 ? t.c0 : t.e);
    Turn.layer.classList.add('on');
    return t;
  }

  const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const easeOut = (k) => 1 - Math.pow(1 - k, 3);

  // Carry the corner to the left (the sheet lies on the left page) or back to the right.
  function settle(t, toLeft, fromDrag) {
    const from = { ...t.P }, to = toLeft ? t.e : t.c0;
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const dur = !animate() ? 0 : fromDrag ? 200 + 360 * (dist / (2 * B.pw)) : (B.spread ? 900 : 700);
    const start = performance.now();
    const tick = (now) => {
      if (B.flip !== t) return;
      const k = dur ? clamp((now - start) / dur, 0, 1) : 1;
      if (fromDrag) { const q = easeOut(k); draw(t, { x: from.x + (to.x - from.x) * q, y: from.y + (to.y - from.y) * q }); }
      else { const q = easeInOut(k); draw(t, arcPoint(t, toLeft ? q : 1 - q)); }
      if (k < 1) { requestAnimationFrame(tick); return; }
      const committed = t.dir > 0 ? toLeft : !toLeft;
      B.flip = null;
      setIndex(committed ? t.target : t.from, { say: committed });  // the real page lands first, then the copy goes
      Turn.layer.classList.remove('on');
    };
    requestAnimationFrame(tick);
  }

  function cancelFlip() {
    const t = B.flip;
    if (!t) return;
    B.flip = null;
    if (Turn.layer) Turn.layer.classList.remove('on');
    setIndex(t.from);
  }

  function turn(dir) {
    if (state.layout !== 'book' || B.flip) return;
    const target = B.idx + step() * dir;
    if (target < 0 || target > lastIdx()) return;
    if (!animate()) { setIndex(target, { say: true }); return; }
    const t = startTurn(dir, B.ph);  // a tap lifts the bottom corner, the way a thumb does
    if (t) settle(t, dir > 0, false);
  }

  $('#prev').addEventListener('click', () => turn(-1));
  $('#next').addEventListener('click', () => turn(1));
  $('#scrub').addEventListener('input', (e) => { cancelFlip(); setIndex(Number(e.target.value) - 1); });
  $('#scrub').addEventListener('change', () => announce($('#pager-label').textContent));

  document.addEventListener('keydown', (e) => {
    if (state.layout !== 'book' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest('input, select, textarea, summary, .panel')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); turn(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); turn(-1); }
    else if (e.key === 'Home') { e.preventDefault(); cancelFlip(); setIndex(0, { say: true }); }
    else if (e.key === 'End') { e.preventDefault(); cancelFlip(); setIndex(lastIdx(), { say: true }); }
  });

  // A link on another page that receives keyboard focus brings its page into view.
  story.addEventListener('focusin', (e) => {
    if (state.layout !== 'book' || B.flip || e.target === story) return;
    const p = pageOf(e.target);
    if (p < B.idx || p >= B.idx + step()) setIndex(p, { say: true });
  });
  $('#window').addEventListener('scroll', (e) => { e.currentTarget.scrollLeft = 0; });

  // Drag a page by its edge: the corner on that side (top or bottom half) follows the pointer
  // exactly. Let go past two thirds of the way, or with a flick, and it lands; otherwise it falls back.
  reader.addEventListener('pointerdown', (e) => {
    if (state.layout !== 'book' || B.flip || e.button !== 0 || e.target.closest('a, button')) return;
    const r = reader.getBoundingClientRect(), x = e.clientX - r.left;
    const dir = B.spread ? (x > B.pw ? 1 : -1) : (x > r.width / 2 ? 1 : -1);
    B.drag = { id: e.pointerId, dir, x0: e.clientX, y0: e.clientY, cy: e.clientY - r.top, t: null, rest: null, lastX: e.clientX, lastT: performance.now(), v: 0 };
  });
  reader.addEventListener('pointermove', (e) => {
    const d = B.drag;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.t) {
      if (Math.hypot(dx, dy) < 6) return;
      if ((d.dir > 0 && dx > 0) || (d.dir < 0 && dx < 0) || !animate()) { B.drag = null; return; }
      d.t = startTurn(d.dir, d.cy < B.ph / 2 ? 0 : B.ph);
      if (!d.t) { B.drag = null; return; }
      d.rest = d.dir > 0 ? { ...d.t.c0 } : { ...d.t.e };
      reader.classList.add('dragging');
      try { reader.setPointerCapture(e.pointerId); } catch (_) { /* fine */ }
    }
    draw(d.t, { x: d.rest.x + dx, y: d.rest.y + dy });
    const now = performance.now();
    d.v = (e.clientX - d.lastX) / Math.max(1, now - d.lastT);  // px/ms, positive to the right
    d.lastX = e.clientX; d.lastT = now;
  });
  function endDrag(e, cancelled) {
    const d = B.drag;
    if (!d || e.pointerId !== d.id) return;
    B.drag = null;
    reader.classList.remove('dragging');
    if (!d.t) { if (!cancelled) turn(d.dir); return; }
    const x = d.t.P.x, W = B.pw;
    const done = !cancelled && (d.dir > 0 ? (x < W * 0.35 || d.v < -0.5) : (x > -W * 0.35 || d.v > 0.5));
    settle(d.t, d.dir > 0 ? done : !done, true);
  }
  reader.addEventListener('pointerup', (e) => endDrag(e, false));
  reader.addEventListener('pointercancel', (e) => endDrag(e, true));

  // If the reader's own text settings reflow the pages (zoom, text spacing), keep the count honest.
  setInterval(() => {
    if (state.layout !== 'book' || !B.ready || B.flip) return;
    if (story.scrollWidth !== B.sw) { const a = currentAnchor(); countPages(); setIndex(pageOf(a)); }
  }, 1200);

  /* ── chapters: the Contents menu, and #ch-N links from the library ── */
  function goToChapter(id, { smooth = true } = {}) {
    const h = document.getElementById(id);
    if (!h) return;
    if (state.layout === 'book' && B.ready) { cancelFlip(); setIndex(pageOf(h), { say: true }); }
    else h.scrollIntoView({ behavior: smooth && animate() ? 'smooth' : 'auto', block: 'start' });
    h.focus({ preventScroll: true });
    try { history.replaceState(null, '', `${location.pathname}${location.search}#${id}`); } catch (_) { /* sandboxed */ }
  }
  const contents = $('#contents');
  $$('#contents .toc-link').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    contents.open = false;
    goToChapter(a.getAttribute('href').slice(1));
  }));
  contents.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && contents.open) { contents.open = false; contents.querySelector('summary').focus(); }
  });
  document.addEventListener('pointerdown', (e) => { if (contents.open && !contents.contains(e.target)) contents.open = false; });
  contents.addEventListener('toggle', () => { if (contents.open) display.open = false; });
  display.addEventListener('toggle', () => { if (display.open) contents.open = false; });
  function bootChapter() {
    const m = (location.hash || '').match(/^#(ch-\d+)$/);
    if (m) goToChapter(m[1], { smooth: false });
  }

  /* ── the video plays on the page, and loads from YouTube only when asked ── */
  const YT = 'https://www.youtube-nocookie.com';
  $$('.video-play', story).forEach((btn) => btn.addEventListener('click', () => {
    const fig = btn.closest('.video');
    const frame = btn.closest('.video-frame');
    const player = document.createElement('iframe');
    player.src = `${YT}/embed/${encodeURIComponent(fig.dataset.video)}?autoplay=1&rel=0&playsinline=1&enablejsapi=1`;
    player.title = `${fig.dataset.title || 'Video'} (YouTube)`;
    player.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    player.allowFullscreen = true;
    player.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.replaceChildren(player);
    player.focus();
  }));
  // A video on a page the reader has turned away from stops playing.
  function pauseHiddenVideo() {
    const player = story.querySelector('.video iframe');
    if (!player || state.layout !== 'book' || !B.ready) return;
    const p = pageOf(player.closest('.video'));
    if (p >= B.idx && p < B.idx + step()) return;
    try { player.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), YT); } catch (_) { /* not ready yet */ }
  }

  /* ── switching layouts, keeping the reader's place ────── */
  function applyLayout(layout, anchor) {
    state.layout = layout;
    root.dataset.layout = layout;
    if (layout === 'book') {
      layoutBook(anchor);
    } else {
      cancelFlip();
      B.ready = false;
      story.style.removeProperty('--shift');
      $$('.board').forEach((b) => { b.style.boxShadow = ''; });
      if (anchor) window.scrollTo(0, Math.max(0, anchor.getBoundingClientRect().top + scrollY - barH() - 20));
      onScroll();
    }
  }

  function setLayout(layout, { user = false } = {}) {
    if (layout === state.layout) return;
    if (layout === 'book' && !bookFits()) { syncControls(); return; }
    const anchor = currentAnchor();
    store.set('layout', layout);
    try {
      const u = new URL(location.href);
      u.searchParams.set('view', layout);
      if (u.hash === '#book' || u.hash === '#scroll') u.hash = '';
      history.replaceState(null, '', u);
    } catch (_) { /* sandboxed */ }
    const run = () => {
      applyLayout(layout, anchor);
      syncControls();
      markHere(anchor);
      announce(layout === 'book' ? `Book layout. ${$('#pager-label').textContent}.` : 'Scroll layout.');
    };
    if (user && animate() && document.startViewTransition) document.startViewTransition(run);
    else run();
  }
  $$('input[name="layout"]').forEach((r) => r.addEventListener('change', () => setLayout(r.value, { user: true })));

  function checkFit() {
    const fits = bookFits();
    $('#lay-book').disabled = !fits;
    $('#layout-note').hidden = fits;
    if (!fits && state.layout === 'book') {
      const anchor = currentAnchor();
      applyLayout('scroll', anchor);
      syncControls();
      announce('Book layout needs a larger window. Showing the story as one scroll.');
    }
  }

  function relayout(anchor = currentAnchor()) {
    measureBar();
    checkFit();
    if (state.layout === 'book') layoutBook(anchor);
    else { if (anchor) window.scrollTo(0, Math.max(0, anchor.getBoundingClientRect().top + scrollY - barH() - 20)); onScroll(); }
  }

  let resizeTimer, resizeAnchor = null;
  addEventListener('resize', () => {
    if (!resizeAnchor) resizeAnchor = currentAnchor();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { const a = resizeAnchor; resizeAnchor = null; relayout(a); Ripples.render(); }, 160);
  });
  osReduced.addEventListener('change', syncControls);

  /* ── boot ─────────────────────────────────────────────── */
  applyTheme(); syncControls(); measureBar(); checkFit();
  Ripples.render();
  if (state.layout === 'book') { if (bookFits()) layoutBook(null); else applyLayout('scroll', null); }
  onScroll();
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
    if (state.layout === 'book') { const i = B.idx; measureBook(); setIndex(i); }
    else onScroll();
    bootChapter();
  });
  $$('img', story).forEach((img) => { if (!img.complete) img.addEventListener('load', () => { if (state.layout === 'book' && !B.flip) { countPages(); setIndex(B.idx); } }, { once: true }); });
})();
