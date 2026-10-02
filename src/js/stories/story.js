/**
 * Kaayko Stories — the story reader. One article, two ways to hold it: Scroll (a single column)
 * and Book (the same article cut into a two-page spread by CSS columns, turned by hand).
 * Switching keeps the reader's place. Built to WCAG 2.2 AA with AAA contrast; see css/stories.css.
 */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const story = $('#story'), reader = $('#reader');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
  const store = {
    get(k) { try { return localStorage.getItem('stories:' + k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem('stories:' + k, v); } catch (_) { /* private window */ } }
  };
  const osReduced = matchMedia('(prefers-reduced-motion: reduce)');
  const hostTheme = root.getAttribute('data-host-theme') || '';
  const SCALES = [0.9, 1, 1.12, 1.25, 1.4, 1.6];
  const MINUTES = Number($('#ring-label').firstChild.textContent) || 1;

  const state = {
    layout: root.dataset.layout,
    theme: root.getAttribute('data-theme') || 'auto',
    scale: parseFloat(getComputedStyle(root).getPropertyValue('--scale')) || 1,
    motion: store.get('motion') === null ? !osReduced.matches : store.get('motion') === '1',
    hl: store.get('hl') === '1'
  };
  root.dataset.hl = state.hl ? '1' : '0';
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
    if ($('#hl-mode')) $('#hl-mode').checked = state.hl;
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
    const availH = innerHeight - barH() - pagerH() - 16;
    B.spread = availW >= 780;
    let pw = B.spread ? (availW - 16) / 2 : availW;
    let ph = availH;
    pw = Math.min(pw, 600, ph * 0.76);
    ph = Math.min(ph, pw * (B.spread ? 1.42 : 1.85));   // a phone's page may be tall; a spread keeps a book's shape
    pw = Math.floor(pw); ph = Math.floor(ph);
    const padx = Math.round(clamp(pw * 0.1, 20, 58));
    const padt = Math.round(clamp(ph * 0.07, 30, 56));
    const padb = Math.round(clamp(ph * 0.07, 34, 56));
    Object.assign(B, { pw, ph, padx, padt, padb, iw: pw - padx * 2, ih: ph - padt - padb });
    const bw = B.spread ? pw * 2 : pw;
    const vars = {
      '--pw': pw, '--bh': ph, '--bw': bw, '--iw': B.iw, '--ih': B.ih, '--padx': padx, '--padt': padt, '--padb': padb,
      '--fs': clamp(B.iw / 25, 15, 19),
      '--bx': Math.round((innerWidth - bw) / 2),
      '--by': Math.round(barH() + Math.max(8, (innerHeight - barH() - pagerH() - ph) / 2))
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
    $('#folio-l').textContent = B.spread && B.idx > 0 ? String(B.idx + 1) : '';
    $('#folio-r').textContent = B.spread ? (B.idx + 1 < B.pages ? String(B.idx + 2) : '') : (B.idx > 0 ? String(B.idx + 1) : '');
    $('.chrome .rh-l').hidden = B.spread && B.idx === 0;
    $('.chrome .rh-r').hidden = !B.spread && B.idx === 0;
    const prog = lastIdx() ? B.idx / lastIdx() : 0;
    $('.board-l').style.boxShadow = stack(Math.round(prog * 5), -1);
    $('.board-r').style.boxShadow = stack(Math.round((1 - prog) * 5), 1);
    if (say) announce(label);
    pointCompass();
    readyVisibleVideos();
  }
  function stack(n, sign) {
    const s = [];
    for (let k = 1; k <= n; k++) s.push(`${sign * k * 1.5}px ${k * 0.7}px 0 -.5px var(--edge)`);
    s.push('0 18px 38px -20px var(--shadow)');
    return s.join(',');
  }

  // In a book every page is laid out at once, so a photo on page 30 must not wait to be scrolled to.
  let photosEager = false;
  function eagerPhotos() {
    if (photosEager) return;
    photosEager = true;
    $$('img', story).forEach((img) => { img.loading = 'eager'; if (img.decode) img.decode().catch(() => { /* still loading */ }); });
  }

  function layoutBook(anchor, warmAfter = 250) {
    cancelFlip();
    eagerPhotos();
    measureBook();
    B.ready = true;
    setIndex(anchor ? pageOf(anchor) : 0);
    prewarmTurns(warmAfter);
  }

  /* ── page turns: a sheet of paper, bent ──────────────────────
     The turning sheet folds along the perpendicular bisector between its corner's resting place and
     where that corner is now: under your finger when you drag, under a thumb when you tap or press a
     key, and in free fall once either lets go. The part past the fold is reflected across it and
     shows the back of the sheet. The sheet does not crease: it bends over a cylinder along the fold,
     so the page beneath shows through a gap, the bend is dark at its silhouette and catches the light
     along its crown, and the radius loosens as the sheet stands up. The corner can never pull further
     from the spine than the paper is wide, so the sheet bends; it does not stretch.
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
    // A copy's photos must be there the moment its page is shown: no lazy loading, no async decode.
    copy.querySelectorAll('img').forEach((img) => { img.loading = 'eager'; img.decoding = 'sync'; });
    win.append(copy);
    const rh = el('span', 'rh'), folio = el('span', 'folio'), end = el('div', 'end-mark'), shade = el('div', 'fold-shade'), light = el('div', 'fold-shade fold-light');
    end.innerHTML = FIN_SVG;
    face.append(el('div', 'face-board'), win, rh, folio, end, shade, light);
    Object.assign(face, { _copy: copy, _win: win, _rh: rh, _folio: folio, _end: end, _shade: shade, _light: light });
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
  function prewarmTurns(after = 250) {
    clearTimeout(prewarmTimer);
    prewarmTimer = setTimeout(() => { if (state.layout === 'book' && B.ready && !B.flip) ensureTurnLayer(); }, after);
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
      face._rh.textContent = leftPage ? 'Kaayko Stories' : 'Never Give Up';
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
      back._light.style.opacity = '0';
      return;
    }
    back.style.visibility = '';
    const d = { x: dx / len, y: dy / len };                       // fold normal, rest corner → corner
    const M = { x: (t.c0.x + P.x) / 2, y: (t.c0.y + P.y) / 2 };   // a point on the fold line
    const md = M.x * d.x + M.y * d.y;
    const side = (X) => X.x * d.x + X.y * d.y - md;               // > 0: flat side, < 0: folded over
    // The bend: a cylinder of radius R along the fold. Loose while the sheet stands, tight as it lies
    // down. The sheet leaves the page 0.57R before the fold line and lands 2.57R past it, so the page
    // beneath shows through a gap of g along the fold.
    const p = Math.min(1, len / (2 * W)), lift = Math.sin(Math.PI * p);
    const R = 3 + clamp(W * 0.085, 12, 52) * lift, g = 0.57 * R;
    const sheet = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }];
    front.style.clipPath = polygon(clipPoly(sheet, (X) => side(X) - g));
    // The back of the sheet: its page, upright, carried by (reflection across the fold) ∘ (mirror
    // across the sheet's middle). Two reflections make a rotation, so its text is never mirrored.
    const r11 = 1 - 2 * d.x * d.x, r12 = -2 * d.x * d.y, r22 = 1 - 2 * d.y * d.y;
    back.style.transform = `matrix(${(-r11).toFixed(5)},${(-r12).toFixed(5)},${r12.toFixed(5)},${r22.toFixed(5)},${(r11 * W + 2 * md * d.x).toFixed(2)},${(r12 * W + 2 * md * d.y).toFixed(2)})`;
    back.style.clipPath = polygon(clipPoly(sheet, (X) => -side(X) - g).map((X) => ({ x: W - X.x, y: X.y })));
    // Light from above. The bend is dark at its silhouette and bright along its crown (1.57R in),
    // the sheet throws a shadow back across the page beneath, and a soft crease shadow lies on
    // what stays flat.
    const Mb = { x: W - M.x, y: M.y }, nb = { x: d.x, y: -d.y };   // the fold, seen from the back
    shade(back._shade, { x: Mb.x + nb.x * g, y: Mb.y + nb.y * g }, nb, R * 1.1, 0.12 + 0.26 * lift);
    shade(back._light, { x: Mb.x + nb.x * R * 1.15, y: Mb.y + nb.y * R * 1.15 }, nb, R * 0.9, 0.08 + 0.22 * lift);
    const Mg = { x: M.x + d.x * g, y: M.y + d.y * g };
    shade(under._shade, Mg, { x: -d.x, y: -d.y }, g + clamp(len * 0.3, 10, 80), 0.16 + 0.22 * (1 - p));
    shade(front._shade, Mg, d, 14 + 24 * lift, 0.06 + 0.14 * lift);
  }

  /* The sheet in flight. φ is its angle from its resting side (0 = flat on the right, π = flat on the
     left); the corner projects to x = W·cos φ, lifted A·sin φ toward the page's middle, which is what
     makes the fold diagonal. Gravity tips the sheet toward whichever side it leans (torque ∝ cos φ),
     the air damps it, the hand that let go keeps a light hold until it is past the vertical, and the
     lift relaxes as it falls, so the fold straightens the way a dropped page flattens. */
  const PHYS = { g: 1.05e-4, drag: 2.6e-3, hand: 2.4e-5, relax: 320 };
  const pos = (t, phi, A) => ({ x: B.pw * Math.cos(phi), y: t.y0 + (t.y0 === 0 ? 1 : -1) * A * Math.sin(phi) });
  function angleOf(t, P) {
    const phi = Math.acos(clamp(P.x / B.pw, -1, 1)), sn = Math.sin(phi);
    return { phi, A: sn > 0.05 ? ((P.y - t.y0) * (t.y0 === 0 ? 1 : -1)) / sn : 0 };
  }

  function startTurn(dir, y0) {
    if (B.flip) return null;
    const from = B.idx, target = from + step() * dir;
    if (target < 0 || target > lastIdx()) return null;
    try { getSelection().removeAllRanges(); } catch (_) { /* none */ }
    if (HL.bar) hideBar();
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

  // Let go: the sheet falls to the left page (toLeft) or back to the right, from where it is,
  // with the velocity v (px/ms) it was given.
  function settle(t, toLeft, v = { x: 0, y: 0 }) {
    if (!animate()) { finish(t, toLeft); return; }
    const W = B.pw, phiT = toLeft ? Math.PI : 0;
    let { phi, A } = angleOf(t, t.P);
    let omega = clamp(-v.x / (W * Math.max(0.05, Math.sin(phi))), -0.03, 0.03);   // dx = −W·sin φ·dφ
    let last = performance.now();
    const tick = (now) => {
      if (B.flip !== t) return;
      let dt = Math.min(48, now - last);
      last = now;
      while (dt > 0) {
        const h = Math.min(6, dt);
        dt -= h;
        const notOver = (phi < Math.PI / 2) === toLeft;          // still on the wrong side of vertical
        const alpha = -PHYS.g * Math.cos(phi) - PHYS.drag * omega + PHYS.hand * (phiT - phi) * (notOver ? 2 : 1);
        omega += alpha * h;
        phi = clamp(phi + omega * h, 0, Math.PI);
        if (phi === 0 || phi === Math.PI) omega = 0;             // the page: the sheet lies down
        A -= (A / PHYS.relax) * h;
      }
      draw(t, pos(t, phi, A));
      if (Math.abs(phi - phiT) < 1e-3 && Math.abs(omega) < 1e-4) finish(t, toLeft);
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function finish(t, toLeft) {
    const committed = t.dir > 0 ? toLeft : !toLeft;
    draw(t, toLeft ? t.e : t.c0);
    B.flip = null;
    setIndex(committed ? t.target : t.from, { say: committed });  // the real page lands under the copy
    // The copy stays two frames more, so the real page has painted before it goes.
    requestAnimationFrame(() => requestAnimationFrame(() => { if (!B.flip) Turn.layer.classList.remove('on'); }));
  }

  function cancelFlip() {
    const t = B.flip;
    if (!t) return;
    B.flip = null;
    if (Turn.layer) Turn.layer.classList.remove('on');
    setIndex(t.from);
  }

  // A tap or a key: a thumb lifts the bottom corner, carries the sheet past the vertical, and lets go.
  function turn(dir) {
    if (state.layout !== 'book' || B.flip) return;
    const target = B.idx + step() * dir;
    if (target < 0 || target > lastIdx()) return;
    if (!animate()) { setIndex(target, { say: true }); return; }
    const t = startTurn(dir, B.ph);
    if (!t) return;
    const W = B.pw, Amax = Math.min(B.ph * 0.3, W * 0.5), dur = B.spread ? 400 : 340;
    const phi0 = dir > 0 ? 0 : Math.PI, span = (dir > 0 ? 1 : -1) * 0.62 * Math.PI;
    const start = performance.now();
    let prev = { phi: phi0, now: start };
    const push = (now) => {
      if (B.flip !== t) return;
      const k = clamp((now - start) / dur, 0, 1), e = 0.4 * k + 0.6 * k * k;   // the thumb speeds up, then lets go
      const phi = phi0 + span * e, A = Amax * Math.sin((Math.PI * k) / 2);
      draw(t, pos(t, phi, A));
      if (k < 1) { prev = { phi, now }; requestAnimationFrame(push); return; }
      const omega = (phi - prev.phi) / Math.max(1, now - prev.now);
      settle(t, dir > 0, { x: -omega * W * Math.sin(phi), y: 0 });
    };
    requestAnimationFrame(push);
  }

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
    if (state.layout !== 'book' || B.flip || e.button !== 0 || e.target.closest('a, button, mark')) return;
    const r = reader.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    // Inside the text, a press selects; a page is taken by its edge or its margin.
    const onEdge = Math.min(x % B.pw, B.pw - (x % B.pw)) < 56 || y < B.padt || y > B.ph - B.padb;
    if (state.hl && e.target.closest('.story') && !onEdge) return;
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
    settle(d.t, d.dir > 0 ? done : !done, { x: cancelled ? 0 : d.v, y: 0 });
  }
  reader.addEventListener('pointerup', (e) => endDrag(e, false));
  reader.addEventListener('pointercancel', (e) => endDrag(e, true));

  // If the reader's own text settings reflow the pages (zoom, text spacing), keep the count honest.
  setInterval(() => {
    if (state.layout !== 'book' || !B.ready || B.flip) return;
    if (story.scrollWidth !== B.sw) { const a = currentAnchor(); countPages(); setIndex(pageOf(a)); prewarmTurns(); }
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

  /* ── the video. YouTube's frame is made ready under the still once its page is in front, and a
     tap on the still passes through to the player's own play button: the one gesture every phone
     honours. When the player reports that it is playing, the still fades. Its fullscreen is the
     player's own. A player on a page turned away from is paused. ── */
  const YT = 'https://www.youtube-nocookie.com';
  const videos = $$('.video', story);
  let live = null;
  const tell = (player, func) => { try { player.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: [] }), YT); } catch (_) { /* not up yet */ } };
  function ensurePlayer(fig) {
    if (fig._player) return fig._player;
    const frame = fig.querySelector('.video-frame'), title = fig.dataset.title || 'Video';
    const player = document.createElement('iframe');
    player.src = `${YT}/embed/${encodeURIComponent(fig.dataset.video)}?playsinline=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`;
    player.title = `${title} (YouTube)`;
    player.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    player.allowFullscreen = true;
    player.referrerPolicy = 'strict-origin-when-cross-origin';
    player.addEventListener('load', () => { try { player.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), YT); } catch (_) { /* fine */ } });
    frame.prepend(player);
    fig._player = player;
    return player;
  }
  addEventListener('message', (e) => {
    if (e.origin !== YT) return;
    let data; try { data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (_) { return; }
    const fig = videos.find((f) => f._player && f._player.contentWindow === e.source);
    if (!fig || !data || data.event !== 'infoDelivery' || !data.info) return;
    const st = data.info.playerState, frame = fig.querySelector('.video-frame');
    if (st === 1) { frame.classList.add('playing'); live = fig; }          // playing: the still goes
    else if (st === 0) { frame.classList.remove('playing'); live = null; } // ended: it comes back
  });
  // Keyboard, and the shields over the player's own links: ask the player to play (every desktop
  // browser allows this after a click; a phone wants the tap on the player itself).
  videos.forEach((fig) => {
    const ask = () => { ensurePlayer(fig); tell(fig._player, 'playVideo'); };
    fig.querySelector('.video-play').addEventListener('click', ask);
    fig.querySelectorAll('.video-shield').forEach((sh) => sh.addEventListener('click', ask));
  });
  function readyVisibleVideos() {
    if (state.layout !== 'book' || !B.ready) return;
    for (const fig of videos) {
      const p = pageOf(fig), shown = p >= B.idx && p < B.idx + step();
      if (shown) ensurePlayer(fig); else if (fig._player) tell(fig._player, 'pauseVideo');
    }
  }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => { if (state.layout === 'scroll') entries.forEach((en) => { if (en.isIntersecting) ensurePlayer(en.target); }); }, { rootMargin: '100% 0px' });
    videos.forEach((fig) => io.observe(fig));
  }

  /* ── switching layouts, keeping the reader's place ────── */
  function applyLayout(layout, anchor, { animating = false } = {}) {
    state.layout = layout;
    root.dataset.layout = layout;
    placeCompass(layout);
    if (layout === 'book') {
      layoutBook(anchor, animating ? 700 : 250);
    } else {
      cancelFlip();
      B.ready = false;
      story.style.removeProperty('--shift');
      $$('.board').forEach((b) => { b.style.boxShadow = ''; });
      if (anchor) window.scrollTo(0, Math.max(0, anchor.getBoundingClientRect().top + scrollY - barH() - 20));
      onScroll();
      pointCompass();
    }
    if (Ripples.avoid) setTimeout(Ripples.avoid, 50);
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
    const vt = user && animate() && !!document.startViewTransition;
    const run = () => {
      applyLayout(layout, anchor, { animating: vt });
      syncControls();
      markHere(anchor);
      announce(layout === 'book' ? `Book layout. ${$('#pager-label').textContent}.` : 'Scroll layout.');
    };
    if (vt) { const t = document.startViewTransition(run); [t.ready, t.finished, t.updateCallbackDone].forEach((p) => p.catch(() => {})); }  // a hidden tab skips the fade
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

  /* ── the compass: from wherever you are reading, which way is the place? ──
     Each part names its place (data-geo on its heading). The needle points from the compass's own
     spot on the screen to that place on the chart beneath, so it swings as the story moves on. */
  const compass = $('#compass'), needle = compass && compass.querySelector('.needle'), compassLabel = compass && compass.querySelector('.compass-label'), compassFact = compass && compass.querySelector('.compass-fact');
  const fmtCoord = (lat, lon) => `${Math.abs(lat).toFixed(2)}°${lat < 0 ? 'S' : 'N'} ${Math.abs(lon).toFixed(2)}°${lon < 0 ? 'W' : 'E'}`;
  const rad = Math.PI / 180;
  function kmBetween(lat1, lon1, lat2, lon2) {
    const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(a));
  }
  function bearingTo(lat1, lon1, lat2, lon2) {
    const y = Math.sin((lon2 - lon1) * rad) * Math.cos(lat2 * rad);
    const x = Math.cos(lat1 * rad) * Math.sin(lat2 * rad) - Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos((lon2 - lon1) * rad);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  }
  const POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const placed = $$('.chapter[data-geo]', story);
  function placeCompass(layout) {
    if (!compass) return;
    if (layout === 'book') $('#pager').prepend(compass); else document.body.append(compass);
  }
  function currentPlace() {
    let h = null;
    if (state.layout === 'book') { if (!B.ready) return null; for (const c of placed) if (pageOf(c) <= B.idx + step() - 1) h = c; }
    else { const line = innerHeight * 0.45; for (const c of placed) if (c.getBoundingClientRect().top <= line) h = c; }
    return h;
  }
  function pointCompass() {
    if (!compass || !Ripples.toPx) return;
    const h = currentPlace();
    const [lon, lat] = h ? h.dataset.geo.split(',').map(Number) : [NaN, NaN];
    const px = Number.isFinite(lon) ? Ripples.toPx(lon, lat) : null;
    const r = compass.querySelector('svg').getBoundingClientRect();
    const deg = px && r.width ? (Math.atan2(px[1] - (r.top + r.height / 2), px[0] - (r.left + r.width / 2)) * 180) / Math.PI + 90 : 0;
    needle.style.transform = `rotate(${deg.toFixed(1)}deg)`;
    const name = h ? (h.dataset.place || h.querySelector('.chapter-title').textContent.trim()) : 'North';
    // The fact is measured, not written: the place's coordinates, and how far and which way it
    // lies from the part before it (great-circle distance and initial bearing).
    let fact = '';
    if (h) {
      const prev = placed[placed.indexOf(h) - 1];
      fact = fmtCoord(lat, lon);
      if (prev) {
        const [plon, plat] = prev.dataset.geo.split(',').map(Number);
        const km = kmBetween(plat, plon, lat, lon), dir = POINTS[Math.round(bearingTo(plat, plon, lat, lon) / 22.5) % 16];
        const from = (prev.dataset.place || prev.querySelector('.chapter-title').textContent.trim()).split(',')[0];
        fact += ` · ${km < 10 ? km.toFixed(1) : Math.round(km)} km ${dir} of ${from}`;
      } else if (h.dataset.region) fact += ` · ${h.dataset.region}`;
    }
    compassLabel.textContent = name;
    compassFact.textContent = fact;
    compass.setAttribute('aria-label', h ? `Compass: ${name} lies that way. ${fact}` : 'Compass: north is up');
  }
  addEventListener('kaayko:chart', pointCompass);
  let compassQueued = false;
  addEventListener('scroll', () => {
    if (state.layout === 'book' || compassQueued) return;
    compassQueued = true;
    requestAnimationFrame(() => { compassQueued = false; pointCompass(); });
  }, { passive: true });

  /* ── highlights: the reader's own pencil, kept in this browser ──
     A highlight is stored as spans of (block, from, to) over the article's text, so it survives a
     reload and lands on the same words in either layout. The marks live in the article itself, so
     the book's copies carry them too. */
  const HL = { key: 'hl:' + location.pathname.split('/').pop(), items: [], mode: '', current: null,
    bar: $('#hl-bar'), add: $('#hl-add'), del: $('#hl-del'), list: $('#hl-list'), empty: $('#hl-empty') };
  const hlBlocks = () => $$('p, h2, figcaption', $('.story-body')).filter((b) => !b.closest('.lakes, .story-foot'));
  const textNodes = (block) => { const out = [], w = document.createTreeWalker(block, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) out.push(n); return out; };
  function pointOffset(block, node, off) {
    const r = document.createRange();
    r.setStart(block, 0);
    try { r.setEnd(node, off); } catch (_) { return 0; }
    return r.toString().length;
  }
  function captureSelection() {
    const sel = getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    if (!story.contains(range.commonAncestorContainer)) return null;
    const blocks = hlBlocks();
    const hit = blocks.map((b, i) => ({ b, i })).filter(({ b }) => range.intersectsNode(b));
    if (!hit.length) return null;
    const spans = hit.map(({ b, i }, k) => {
      const from = k === 0 ? pointOffset(b, range.startContainer, range.startOffset) : 0;
      const to = k === hit.length - 1 ? pointOffset(b, range.endContainer, range.endOffset) : b.textContent.length;
      return [i, Math.max(0, from), Math.min(b.textContent.length, to)];
    }).filter(([, from, to]) => to > from);
    if (!spans.length) return null;
    return { id: Date.now().toString(36), spans, text: range.toString().replace(/\s+/g, ' ').trim().slice(0, 140) };
  }
  function paint(item) {
    const blocks = hlBlocks();
    for (const [bi, from, to] of item.spans) {
      const b = blocks[bi];
      if (!b) continue;
      let at = 0;
      for (const t of textNodes(b)) {
        const len = t.data.length, a = Math.max(from, at), z = Math.min(to, at + len);
        if (z > a) {
          let node = t;
          if (a > at) node = node.splitText(a - at);
          if (z < at + len) node.splitText(z - a);
          const m = el('mark', 'hl');
          m.dataset.hl = item.id;
          node.replaceWith(m);
          m.append(node);
        }
        at += len;
      }
    }
  }
  function unpaint(id) {
    $$(`mark.hl[data-hl="${id}"]`, story).forEach((m) => m.replaceWith(...m.childNodes));
    story.normalize();
  }
  const saveHL = () => store.set(HL.key, JSON.stringify(HL.items));
  function copiesStale() { Turn.key = ''; if (state.layout === 'book') { countPages(); setIndex(B.idx); prewarmTurns(60); } }
  function renderHL() {
    if (!HL.list) return;
    HL.list.replaceChildren(...HL.items.map((it) => {
      const li = el('li'), jump = el('button', 'hl-jump'), del = el('button', 'hl-del');
      jump.type = 'button'; jump.textContent = `“${it.text}”`;
      jump.addEventListener('click', () => jumpToHL(it));
      del.type = 'button'; del.setAttribute('aria-label', `Remove the highlight “${it.text.slice(0, 40)}”`); del.textContent = '×';
      del.addEventListener('click', () => removeHL(it.id));
      li.append(jump, del);
      return li;
    }));
    HL.empty.hidden = HL.items.length > 0;
  }
  function jumpToHL(it) {
    const m = story.querySelector(`mark.hl[data-hl="${it.id}"]`);
    if (!m) return;
    contents.open = false;
    if (state.layout === 'book') { cancelFlip(); setIndex(pageOf(m), { say: true }); }
    else m.scrollIntoView({ block: 'center', behavior: animate() ? 'smooth' : 'auto' });
  }
  function removeHL(id) {
    unpaint(id);
    HL.items = HL.items.filter((it) => it.id !== id);
    saveHL(); renderHL(); copiesStale();
    announce('Highlight removed.');
  }
  function hideBar() { HL.bar.hidden = true; HL.mode = ''; }
  function showBar(rect, mode) {
    HL.mode = mode;
    HL.add.hidden = mode !== 'add';
    HL.del.hidden = mode !== 'del';
    HL.bar.hidden = false;
    const w = HL.bar.offsetWidth, h = HL.bar.offsetHeight;
    let top = rect.top - h - 10;
    if (top < barH() + 8) top = rect.bottom + 10;
    HL.bar.style.left = `${clamp(rect.left + rect.width / 2 - w / 2, 8, innerWidth - w - 8).toFixed(0)}px`;
    HL.bar.style.top = `${clamp(top, 8, innerHeight - h - 8).toFixed(0)}px`;
  }
  let selTimer = 0;
  document.addEventListener('selectionchange', () => {
    clearTimeout(selTimer);
    if (!state.hl || B.flip || B.drag) { if (HL.mode === 'add') hideBar(); return; }
    selTimer = setTimeout(() => {
      const sel = getSelection();
      const live = sel && !sel.isCollapsed && sel.rangeCount && story.contains(sel.getRangeAt(0).commonAncestorContainer);
      if (live) showBar(sel.getRangeAt(0).getBoundingClientRect(), 'add');
      else if (HL.mode === 'add') hideBar();
    }, 160);
  });
  story.addEventListener('click', (e) => {
    const m = e.target.closest('mark.hl');
    if (!m || !state.hl) return;
    const sel = getSelection();
    if (sel && !sel.isCollapsed) return;
    HL.current = m.dataset.hl;
    showBar(m.getBoundingClientRect(), 'del');
  });
  document.addEventListener('pointerdown', (e) => { if (HL.mode === 'del' && !HL.bar.contains(e.target)) hideBar(); });
  if (HL.bar) {
    HL.add.addEventListener('click', () => {
      const item = captureSelection();
      if (!item) return;
      paint(item);
      HL.items.push(item);
      saveHL(); renderHL(); copiesStale();
      getSelection().removeAllRanges();
      hideBar();
      announce('Highlighted.');
    });
    HL.del.addEventListener('click', () => { if (HL.current) removeHL(HL.current); hideBar(); });
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'h') { e.preventDefault(); HL.add.click(); }
    });
    $('#hl-mode').addEventListener('change', (e) => {
      state.hl = e.target.checked; store.set('hl', state.hl ? '1' : '0'); root.dataset.hl = state.hl ? '1' : '0';
      if (!state.hl) { hideBar(); try { getSelection().removeAllRanges(); } catch (_) { /* none */ } }
      announce(state.hl ? 'Highlighter on. Select words to highlight them.' : 'Highlighter off.');
    });
    try { HL.items = JSON.parse(store.get(HL.key) || '[]'); } catch (_) { HL.items = []; }
    HL.items.forEach(paint);   // before the book is laid out, so its copies carry the marks
    renderHL();
  }

  /* ── boot ─────────────────────────────────────────────── */
  applyTheme(); syncControls(); measureBar(); checkFit(); placeCompass(state.layout);
  Ripples.render();
  if (state.layout === 'book') { if (bookFits()) layoutBook(null); else applyLayout('scroll', null); }
  onScroll();
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
    if (state.layout === 'book') { const i = B.idx; measureBook(); setIndex(i); }
    else onScroll();
    bootChapter();
    pointCompass();
  });
  $$('img', story).forEach((img) => { if (!img.complete) img.addEventListener('load', () => { if (state.layout === 'book' && !B.flip) { countPages(); setIndex(B.idx); prewarmTurns(); } }, { once: true }); });
})();
