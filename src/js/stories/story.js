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
  // The blocks burnt words are counted against, in the article's own order. Taken once, before the
  // book may set a paragraph ahead of a photo, so stored spans always land on the same words.
  const HL_BLOCKS = $$('p, h2, figcaption', $('.story-body')).filter((b) => !b.closest('.lakes, .story-foot'));
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

  // Photos in the book. A photo too tall for what is left of its page used to jump to the next one
  // and leave this page half empty. Now, if there is room for most of it, it is lowered to fit; if
  // not, the paragraph after it is set first and fills the page, and the photo follows it, as a
  // printed book places its plates. The scroll keeps the article's own order.
  const moved = [];
  function unfitPlates() {
    while (moved.length) { const { p, after } = moved.pop(); after.after(p); }
    $$('.story-body > .plate', story).forEach((pl) => pl.style.removeProperty('--fit'));
  }
  function fitPlates() {
    unfitPlates();
    if (state.layout !== 'book') return '';
    const s0 = story.getBoundingClientRect(), col = (x) => Math.floor((x - s0.left + 1) / B.pw), out = [];
    for (const plate of $$('.story-body > .plate', story)) {
      for (let tries = 0; tries < 3; tries++) {
        const prev = plate.previousElementSibling, frags = prev ? prev.getClientRects() : [], last = frags[frags.length - 1];
        if (!last) break;
        if (col(plate.getBoundingClientRect().left) <= col(last.left)) break;   // it sits where its text left off
        const free = B.ih - (last.bottom - s0.top);
        const img = plate.matches('.video') ? null : plate.querySelector('.mount img');
        if (img) {
          const room = Math.floor(free - (plate.getBoundingClientRect().height - img.getBoundingClientRect().height) - (parseFloat(getComputedStyle(plate).marginTop) || 0) - 6);
          if (room >= B.ih * 0.42) {
            plate.style.setProperty('--fit', `${room}px`);
            if (col(plate.getBoundingClientRect().left) <= col(last.left)) { out.push(room); break; }
            plate.style.removeProperty('--fit');
          }
        }
        let after = plate;   // photos side by side in the text travel together
        while (after.nextElementSibling && after.nextElementSibling.matches('.plate')) after = after.nextElementSibling;
        const next = after.nextElementSibling;
        if (free < 48 || !next || !next.matches('p')) break;   // a sliver of page, or a new chapter: leave it
        plate.before(next);
        moved.push({ p: next, after });
        out.push('p');
      }
    }
    return out.join(',');
  }

  function countPages() {
    const fit = fitPlates();
    if (fit !== B.fit) { B.fit = fit; Turn.key = ''; }   // the copies must be laid out the same way
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
    copy.querySelectorAll('mark.igniting').forEach((m) => m.classList.remove('igniting'));   // a copy shows words already burnt
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
    const r = reader.getBoundingClientRect(), x = e.clientX - r.left;
    // With the Lighter on, a mouse on words lights them, and the page is taken by its margin. A finger
    // on words still starts a turn: only a hold lights them (see arm), so a swipe across text turns.
    if (state.hl && onWords(e.target) && e.pointerType !== 'touch') return;
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
      unfitPlates();
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

  /* ── the Lighter: drag across words and they burn ──
     A burnt passage is stored as spans of (block, from, to) over the article's text, so it survives a
     reload and lands on the same words in either layout. The marks live in the article itself, so the
     book's copies carry them too. A press and drag (on a phone: hold, then drag) lights whole words
     under it; letting go burns them. An ember edge runs through the passage at a steady pace, smoke and
     sparks come off it, and the letters settle as burnt gold. A tap on a burnt passage offers to put it
     out. The browser's own selection is never used: no handles, no menu, no button to press. */
  const HL = { key: 'hl:' + location.pathname.split('/').pop(), items: [], current: null,
    bar: $('#hl-bar'), del: $('#hl-del'), list: $('#hl-list'), empty: $('#hl-empty') };
  const hlBlocks = () => HL_BLOCKS;
  const textNodes = (block) => { const out = [], w = document.createTreeWalker(block, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) out.push(n); return out; };
  function pointOffset(block, node, off) {
    const r = document.createRange();
    r.setStart(block, 0);
    try { r.setEnd(node, off); } catch (_) { return 0; }
    return r.toString().length;
  }
  function captureRange(range) {
    if (!range || range.collapsed || !story.contains(range.commonAncestorContainer)) return null;
    const blocks = hlBlocks();
    const hit = blocks.map((b, i) => ({ b, i })).filter(({ b }) => range.intersectsNode(b))
      .sort((x, y) => (x.b.compareDocumentPosition(y.b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));   // page order
    if (!hit.length) return null;
    const spans = hit.map(({ b, i }, k) => {
      const from = k === 0 && b.contains(range.startContainer) ? pointOffset(b, range.startContainer, range.startOffset) : 0;
      const to = k === hit.length - 1 && b.contains(range.endContainer) ? pointOffset(b, range.endContainer, range.endOffset) : b.textContent.length;
      return [i, Math.max(0, from), Math.min(b.textContent.length, to)];
    }).filter(([, from, to]) => to > from);
    if (!spans.length) return null;
    return { id: Date.now().toString(36), spans, text: range.toString().replace(/\s+/g, ' ').trim().slice(0, 140) };
  }
  function paint(item) {
    const blocks = hlBlocks(), made = [];
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
          made.push(m);
        }
        at += len;
      }
    }
    return made;
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
      del.type = 'button'; del.setAttribute('aria-label', `Put out “${it.text.slice(0, 40)}”`); del.textContent = '×';
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
    const marks = $$(`mark.hl[data-hl="${id}"]`, story);
    const gone = () => {
      unpaint(id);
      HL.items = HL.items.filter((it) => it.id !== id);
      saveHL(); renderHL(); copiesStale();
    };
    if (animate() && marks.length) {
      Smoke.puff(marks.flatMap((m) => [...m.getClientRects()]));
      marks.forEach((m) => m.classList.add('dousing'));
      setTimeout(gone, 380);
    } else gone();
    announce('Put out.');
  }
  function hideBar() { HL.bar.hidden = true; HL.current = null; }
  // Offered just above where the passage was tapped (below it near the top of the screen), so it
  // never sits on the line being read.
  function offerPutOut(mark, x, y) {
    HL.current = mark.dataset.hl;
    HL.bar.hidden = false;
    const w = HL.bar.offsetWidth, h = HL.bar.offsetHeight;
    let top = y - h - 22;
    if (top < barH() + 8) top = y + 26;
    HL.bar.style.left = `${clamp(x - w / 2, 8, innerWidth - w - 8).toFixed(0)}px`;
    HL.bar.style.top = `${clamp(top, 8, innerHeight - h - 8).toFixed(0)}px`;
    HL.del.focus({ preventScroll: true });
  }

  // Burning: the ember edge moves at a steady pace through the passage, mark after mark, and settles
  // as gold. Each mark's strip is sized to its own length laid end to end (see mark.hl.igniting).
  const EDGE = 72;   // px of strip between gold and ink: char, ember, flame, the yellow leading edge
  function ignite(marks, done) {
    if (!marks.length || !animate()) { done(); return; }
    const widths = marks.map((m) => [...m.getClientRects()].reduce((s, r) => s + r.width, 0));
    const total = widths.reduce((s, w) => s + w + EDGE, 0);
    const pace = Math.max(0.42, total / 2600);   // px per ms; a long passage burns faster, never past 2.6 s
    let at = 0;
    const plan = marks.map((m, i) => {
      const dur = (widths[i] + EDGE) / pace;
      m.style.setProperty('--W', `${widths[i].toFixed(1)}px`);
      m.style.setProperty('--burn-dur', `${dur.toFixed(0)}ms`);
      m.style.setProperty('--burn-delay', `${at.toFixed(0)}ms`);
      m.classList.add('igniting');
      const job = { m, w: widths[i], delay: at, dur };
      at += dur;
      return job;
    });
    Smoke.burn(plan);
    setTimeout(() => {
      marks.forEach((m) => { m.classList.remove('igniting'); ['--W', '--burn-dur', '--burn-delay'].forEach((v) => m.style.removeProperty(v)); });
      done();
    }, at + 60);
  }
  function burn(range) {
    const item = captureRange(range);
    if (!item) return;
    hideBar();
    const marks = paint(item);
    HL.items.push(item);
    saveHL(); renderHL();
    Turn.key = '';   // the next turn copies the page with these words burnt
    ignite(marks, () => { if (state.layout === 'book' && B.ready) prewarmTurns(60); });
    announce('Burnt.');
  }

  // Smoke and sparks, on one canvas over the page, running only while there is something in the air.
  const Smoke = (() => {
    let cv = null, cx = null, sprite = null, tint = '', parts = [], jobs = [], raf = 0, last = 0;
    const rnd = (a, b) => a + Math.random() * (b - a);
    function size() {
      const d = Math.min(2, devicePixelRatio || 1);
      cv.width = Math.round(innerWidth * d); cv.height = Math.round(innerHeight * d);
      cx.setTransform(d, 0, 0, d, 0, 0);
    }
    function ready() {
      if (!cv) {
        cv = el('canvas', 'smoke'); cv.setAttribute('aria-hidden', 'true');
        document.body.append(cv); cx = cv.getContext('2d'); size();
        addEventListener('resize', size);
      }
      const t = getComputedStyle(root).getPropertyValue('--smoke').trim() || '128,128,128';
      if (t !== tint) {   // one soft puff, drawn once per theme and stamped for every particle
        tint = t; sprite = document.createElement('canvas'); sprite.width = sprite.height = 64;
        const g = sprite.getContext('2d'), rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        rg.addColorStop(0, `rgba(${t},.55)`); rg.addColorStop(.5, `rgba(${t},.22)`); rg.addColorStop(1, `rgba(${t},0)`);
        g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
      }
    }
    const smoke = (x, y, big = 1) => ({ k: 's', x, y: y + scrollY, vx: rnd(-0.012, 0.012), vy: rnd(-0.05, -0.028) * big, r0: rnd(2, 4) * big, grow: rnd(12, 22) * big, a: rnd(0.35, 0.6), life: rnd(1100, 1900), age: 0, seed: rnd(0, 6000), wob: rnd(0.006, 0.016) });
    const spark = (x, y) => ({ k: 'e', x, y: y + scrollY, vx: rnd(-0.05, 0.05), vy: rnd(-0.16, -0.08), r0: rnd(0.7, 1.5), grow: 0, a: 1, life: rnd(300, 650), age: 0, seed: 0, wob: 0 });
    // Where the burning edge is along a mark's line boxes, `d` px from its start.
    function along(rects, d) {
      for (const r of rects) { if (d <= r.width) return { x: r.left + d, y: r.top, h: r.height }; d -= r.width; }
      const r = rects[rects.length - 1];
      return { x: r.right, y: r.top, h: r.height };
    }
    function tick(now) {
      const dt = last ? Math.min(48, now - last) : 16;
      last = now;
      jobs = jobs.filter((j) => {
        const t = now - j.t0;
        const live = j.plan.filter((p) => t >= p.delay && t < p.delay + p.dur);
        for (const p of live) {
          const rects = [...p.m.getClientRects()].filter((r) => r.width > 0);
          if (!rects.length) continue;
          const d = (t - p.delay) * (p.w + EDGE) / p.dur - 16;   // the yellow leading edge of the strip
          if (d < 0 || d > p.w) continue;
          const at = along(rects, d);
          parts.push(smoke(at.x + rnd(-2, 2), at.y + at.h * rnd(0.15, 0.6)));
          if (Math.random() < 0.7) parts.push(smoke(at.x - rnd(4, 14), at.y + at.h * rnd(0.1, 0.5), 0.8));
          if (Math.random() < 0.55) parts.push(spark(at.x, at.y + at.h * rnd(0.3, 0.8)));
        }
        return t < j.end;
      });
      cx.clearRect(0, 0, innerWidth, innerHeight);
      parts = parts.filter((q) => (q.age += dt) < q.life);
      for (const q of parts) {
        const k = q.age / q.life;
        q.x += (q.vx + Math.sin((q.age + q.seed) / 240) * q.wob) * dt;
        q.y += q.vy * dt;
        const y = q.y - scrollY;
        if (q.k === 's') {
          const r = q.r0 + q.grow * k;
          cx.globalAlpha = q.a * (k < 0.12 ? k / 0.12 : 1) * (1 - k) * (1 - k);
          cx.drawImage(sprite, q.x - r, y - r, r * 2, r * 2);
        } else {
          cx.globalAlpha = 1 - k;
          cx.fillStyle = k < 0.35 ? '#ffe7a3' : '#ff7a12';
          cx.beginPath(); cx.arc(q.x, y, q.r0 * (1 - k * 0.5), 0, 6.283); cx.fill();
          q.vy += 0.00012 * dt;   // sparks slow as they cool
        }
      }
      cx.globalAlpha = 1;
      if (parts.length || jobs.length) raf = requestAnimationFrame(tick);
      else { raf = 0; last = 0; cx.clearRect(0, 0, innerWidth, innerHeight); }
    }
    const run = () => { if (!raf) raf = requestAnimationFrame(tick); };
    return {
      burn(plan) {
        if (!animate()) return;
        ready();
        const end = plan.reduce((s, p) => Math.max(s, p.delay + p.dur), 0);
        jobs.push({ plan, t0: performance.now(), end });
        run();
      },
      puff(rects) {
        if (!animate()) return;
        ready();
        for (const r of rects) for (let x = r.left; x < r.right; x += 9) parts.push(smoke(x + rnd(-3, 3), r.top + r.height * rnd(0.2, 0.7), 0.9));
        run();
      }
    };
  })();

  // The press. A mouse or pen lights at once; a finger lights after a short hold, so a swipe still
  // scrolls the page or turns it. On a phone a small flame rides above the finger so the words under
  // it stay visible.
  const LT = { id: null, type: '', armed: false, moved: false, hold: 0, a: null, b: null, x0: 0, y0: 0, target: null };
  const hasHighlights = typeof Highlight === 'function' && window.CSS && CSS.highlights;
  const flame = (() => {
    const f = el('div', 'lighter-flame');
    f.hidden = true; f.setAttribute('aria-hidden', 'true');
    f.innerHTML = '<svg viewBox="0 0 22 33" width="22" height="33"><defs><radialGradient id="lf-g" cx="50%" cy="72%" r="62%"><stop offset="0" stop-color="#fff6d6"/><stop offset=".42" stop-color="#ffc247"/><stop offset="1" stop-color="#ff5a0a"/></radialGradient></defs><path d="M11 1c2.2 6.5 9 10.6 9 19.4a9 9 0 0 1-18 0c0-5.6 3.4-8.8 4.4-13.2 1.1 3.2 2.3 4.6 3.4 5.6 1-4.3 1.2-7.6 1.2-11.8Z" fill="url(#lf-g)"/></svg>';
    document.body.append(f);
    return f;
  })();
  const onWords = (t) => {
    const b = t && t.closest && t.closest('.story-body :is(p, h2, figcaption)');
    return !!b && !b.closest('.lakes, .story-foot') && !t.closest('a, button, .video-frame');
  };
  function caretAt(x, y) {
    let node = null, off = 0;
    if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); if (p) { node = p.offsetNode; off = p.offset; } }
    else if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); if (r) { node = r.startContainer; off = r.startOffset; } }
    if (!node || node.nodeType !== 3 || !onWords(node.parentElement)) return null;
    return { node, off };
  }
  const WORD = /[\p{L}\p{N}'’-]/u;
  function wordRange(p, q) {
    const r = document.createRange();
    r.setStart(p.node, p.off);
    const [s, e] = r.comparePoint(q.node, q.off) < 0 ? [q, p] : [p, q];
    let so = s.off, eo = e.off;
    while (so > 0 && WORD.test(s.node.data[so - 1])) so--;
    while (eo < e.node.data.length && WORD.test(e.node.data[eo])) eo++;
    r.setStart(s.node, so); r.setEnd(e.node, eo);
    return r;
  }
  function preview() {
    if (!hasHighlights || !LT.a) return;
    CSS.highlights.set('lighter', new Highlight(wordRange(LT.a, LT.b)));
  }
  function moveFlame(x, y) { flame.style.left = `${x}px`; flame.style.top = `${y}px`; }
  function arm() {
    if (B.flip || (B.drag && B.drag.t)) { endLight(); return; }   // the page is already turning
    if (B.drag && B.drag.id === LT.id) B.drag = null;              // held still: this finger lights, it does not turn
    LT.armed = true;
    try { story.setPointerCapture(LT.id); } catch (_) { /* gone */ }
    if (LT.type === 'touch') { moveFlame(LT.x0, LT.y0); flame.hidden = false; if (navigator.vibrate) navigator.vibrate(8); }
    preview();
  }
  function endLight() {
    clearTimeout(LT.hold);
    try { if (LT.id !== null) story.releasePointerCapture(LT.id); } catch (_) { /* gone */ }
    Object.assign(LT, { id: null, armed: false, moved: false, a: null, b: null, target: null });
    if (hasHighlights) CSS.highlights.delete('lighter');
    flame.hidden = true;
  }
  story.addEventListener('pointerdown', (e) => {
    if (!state.hl || e.button !== 0 || B.flip || !onWords(e.target)) return;
    const pt = caretAt(e.clientX, e.clientY);
    if (!pt) return;
    endLight();
    Object.assign(LT, { id: e.pointerId, type: e.pointerType, a: pt, b: pt, x0: e.clientX, y0: e.clientY, target: e.target });
    if (e.pointerType === 'touch') LT.hold = setTimeout(arm, 260);
    else { e.preventDefault(); arm(); }
  });
  story.addEventListener('pointermove', (e) => {
    if (e.pointerId !== LT.id) return;
    const far = Math.hypot(e.clientX - LT.x0, e.clientY - LT.y0);
    if (!LT.armed) { if (far > 8) endLight(); return; }   // a swipe before the hold: let it scroll
    if (far > 4) LT.moved = true;
    if (LT.type === 'touch') moveFlame(e.clientX, e.clientY);
    const pt = caretAt(e.clientX, e.clientY);
    if (pt) { LT.b = pt; preview(); }
  });
  story.addEventListener('pointerup', (e) => {
    if (e.pointerId !== LT.id) return;
    const { armed, moved, type, a, b, target } = LT;
    endLight();
    const mark = target && target.closest('mark.hl');
    if (!armed || (!moved && type !== 'touch') || (!moved && mark)) {   // a tap or a click
      if (mark) offerPutOut(mark, e.clientX, e.clientY); else hideBar();
      return;
    }
    burn(wordRange(a, b));
  });
  story.addEventListener('pointercancel', (e) => { if (e.pointerId === LT.id) endLight(); });
  story.addEventListener('touchmove', (e) => { if (LT.armed) e.preventDefault(); }, { passive: false });
  story.addEventListener('contextmenu', (e) => { if (state.hl && LT.id !== null) e.preventDefault(); });
  document.addEventListener('pointerdown', (e) => { if (!HL.bar.hidden && !HL.bar.contains(e.target) && !e.target.closest('mark.hl')) hideBar(); });
  if (HL.bar) {
    HL.del.addEventListener('click', () => { const id = HL.current; hideBar(); if (id) removeHL(id); });
    HL.bar.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideBar(); });
    // A keyboard selection (scroll layout, Lighter off) burns with Cmd/Ctrl+Shift+H.
    document.addEventListener('keydown', (e) => {
      if (!((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'h')) return;
      const sel = getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;
      e.preventDefault();
      const r = sel.getRangeAt(0).cloneRange();
      sel.removeAllRanges();
      burn(r);
    });
    $('#hl-mode').addEventListener('change', (e) => {
      state.hl = e.target.checked; store.set('hl', state.hl ? '1' : '0'); root.dataset.hl = state.hl ? '1' : '0';
      if (!state.hl) { hideBar(); endLight(); }
      announce(state.hl ? 'Lighter on. Drag across words to burn them; on a phone, hold, then drag.' : 'Lighter off.');
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
