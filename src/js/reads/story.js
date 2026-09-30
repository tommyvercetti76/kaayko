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
  }

  // A picture of page i: the paper, a copy of the article shifted to that page, and its running head.
  function pageFace(i) {
    const face = el('div', 'face');
    face.setAttribute('aria-hidden', 'true');
    face.inert = true;
    face.append(el('div', 'face-board'));
    if (i >= 0 && i < B.pages) {
      const win = el('div', 'face-window');
      const copy = story.cloneNode(true);
      copy.removeAttribute('id'); copy.removeAttribute('tabindex'); copy.removeAttribute('aria-labelledby');
      copy.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
      copy.style.setProperty('--shift', `${-i * B.pw}px`);
      win.append(copy);
      face.append(win);
      if (i > 0) {
        const rh = el('span', 'rh'); rh.textContent = i % 2 === 0 && B.spread ? 'Kaayko Reads' : 'Never Give Up';
        if (!(i % 2 === 0 && B.spread)) rh.style.textAlign = B.spread ? 'right' : 'left';
        const folio = el('span', 'folio'); folio.textContent = String(i + 1);
        face.append(rh, folio);
      }
    } else if (i === B.pages) {
      const end = el('div', 'end-mark');
      end.innerHTML = '<svg viewBox="0 0 120 120" aria-hidden="true"><g fill="none" stroke="currentColor" filter="url(#ink)"><circle cx="60" cy="60" r="52" stroke-width="3"/><circle cx="60" cy="60" r="33" stroke-width="1.5"/></g><text x="60" y="66" text-anchor="middle" fill="currentColor" font-family="Barlow Condensed, sans-serif" font-weight="600" font-size="17" letter-spacing="4">FIN</text></svg>';
      face.append(end);
    }
    return face;
  }

  function startFlip(dir) {
    if (B.flip) return null;
    const from = B.idx, target = B.idx + step() * dir;
    if (target < 0 || target > lastIdx()) return null;
    const leaf = el('div', 'leaf'), front = el('div', 'side front'), back = el('div', 'side back');
    let stay = null, reverse = false;
    if (B.spread) {
      stay = el('div', 'stay');
      if (dir > 0) { leaf.classList.add('leaf-r'); front.append(pageFace(from + 1)); back.append(pageFace(from + 2)); stay.style.left = '0'; stay.append(pageFace(from)); }
      else { leaf.classList.add('leaf-l'); front.append(pageFace(from)); back.append(pageFace(from - 1)); stay.style.left = `${B.pw}px`; stay.append(pageFace(from + 1)); }
    } else {
      leaf.classList.add('leaf-r');
      const paper = el('div', 'face'); paper.append(el('div', 'face-board'));
      if (dir > 0) { front.append(pageFace(from)); back.append(paper); }
      else { front.append(pageFace(from - 1)); back.append(paper); reverse = true; }
    }
    leaf.append(front, back);
    if (stay) reader.append(stay);
    reader.append(leaf);
    const f = { dir, from, target, leaf, stay, reverse, t: 0 };
    // Under the turning page the real article is already where the turn will leave it.
    if (!reverse) setIndex(target);
    B.flip = f;
    setT(f, 0);
    return f;
  }

  function setT(f, t) {
    f.t = t;
    const a = f.reverse ? 180 * (1 - t) : 180 * t;
    f.leaf.style.setProperty('--a', a.toFixed(2));
    f.leaf.style.setProperty('--p', (a / 180).toFixed(3));
    if (!B.spread) f.leaf.style.opacity = a > 100 ? String(clamp(1 - (a - 100) / 70, 0, 1)) : '1';
  }

  const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const easeOut = (k) => 1 - Math.pow(1 - k, 3);

  function finishFlip(f, commit, fromDrag) {
    const t0 = f.t, t1 = commit ? 1 : 0;
    const dur = animate() ? (fromDrag ? 380 : 700) * Math.abs(t1 - t0) + 60 : 0;
    const start = performance.now();
    const curve = fromDrag ? easeOut : easeInOut;
    const tick = (now) => {
      if (B.flip !== f) return;
      const k = dur ? clamp((now - start) / dur, 0, 1) : 1;
      setT(f, t0 + (t1 - t0) * curve(k));
      if (k < 1) { requestAnimationFrame(tick); return; }
      f.leaf.remove(); if (f.stay) f.stay.remove();
      B.flip = null;
      setIndex(commit ? f.target : f.from, { say: commit });
    };
    requestAnimationFrame(tick);
  }

  function cancelFlip() {
    const f = B.flip;
    if (!f) return;
    f.leaf.remove(); if (f.stay) f.stay.remove();
    B.flip = null;
    setIndex(f.from);
  }

  function turn(dir) {
    if (state.layout !== 'book' || B.flip) return;
    const target = B.idx + step() * dir;
    if (target < 0 || target > lastIdx()) return;
    if (!animate()) { setIndex(target, { say: true }); return; }
    const f = startFlip(dir);
    if (f) finishFlip(f, true, false);
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

  // Drag a page: the leaf follows the pointer; past a third of the way, or with a flick, it turns.
  reader.addEventListener('pointerdown', (e) => {
    if (state.layout !== 'book' || B.flip || e.button !== 0 || e.target.closest('a, button')) return;
    const r = reader.getBoundingClientRect();
    B.drag = { id: e.pointerId, dir: e.clientX - r.left > r.width / 2 ? 1 : -1, x0: e.clientX, lastX: e.clientX, lastT: performance.now(), v: 0, f: null };
  });
  reader.addEventListener('pointermove', (e) => {
    const d = B.drag;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x0;
    if (!d.f) {
      if (Math.abs(dx) < 8) return;
      if ((d.dir > 0 && dx > 0) || (d.dir < 0 && dx < 0) || !animate()) { B.drag = null; return; }
      d.f = startFlip(d.dir);
      if (!d.f) { B.drag = null; return; }
      reader.classList.add('dragging');
      try { reader.setPointerCapture(e.pointerId); } catch (_) { /* fine */ }
    }
    const span = B.spread ? B.pw * 1.7 : B.pw * 1.2;
    setT(d.f, clamp(((d.dir > 0 ? -dx : dx) / span) * 1.1, 0, 1));
    const now = performance.now();
    d.v = (d.dir > 0 ? d.lastX - e.clientX : e.clientX - d.lastX) / Math.max(1, now - d.lastT);
    d.lastX = e.clientX; d.lastT = now;
  });
  function endDrag(e, cancelled) {
    const d = B.drag;
    if (!d || e.pointerId !== d.id) return;
    B.drag = null;
    reader.classList.remove('dragging');
    if (!d.f) { if (!cancelled) turn(d.dir); return; }
    finishFlip(d.f, !cancelled && (d.f.t > 0.33 || d.v > 0.45), true);
  }
  reader.addEventListener('pointerup', (e) => endDrag(e, false));
  reader.addEventListener('pointercancel', (e) => endDrag(e, true));

  // If the reader's own text settings reflow the pages (zoom, text spacing), keep the count honest.
  setInterval(() => {
    if (state.layout !== 'book' || !B.ready || B.flip) return;
    if (story.scrollWidth !== B.sw) { const a = currentAnchor(); countPages(); setIndex(pageOf(a)); }
  }, 1200);

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
    try { history.replaceState(null, '', `#${layout}`); } catch (_) { /* sandboxed */ }
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
  });
  $$('img', story).forEach((img) => { if (!img.complete) img.addEventListener('load', () => { if (state.layout === 'book' && !B.flip) { countPages(); setIndex(B.idx); } }, { once: true }); });
})();
