/**
 * Kaayko Stories — the library (/stories).
 * Theme, the reader's preferred layout (every chapter and title link opens in it), the
 * Display menu, and the lake behind the page. The pre-paint script in <head> has already
 * applied a remembered theme; this keeps the controls, the shared footer (html.dark-theme)
 * and the ripple lines in step with it.
 */
(function () {
  'use strict';
  const root = document.documentElement;
  const read = (k) => { try { return localStorage.getItem('stories:' + k); } catch (_) { return null; } };
  const save = (k, v) => { try { localStorage.setItem('stories:' + k, v); } catch (_) { /* private window */ } };
  const osDark = matchMedia('(prefers-color-scheme: dark)');
  const ripples = window.KaaykoRipples ? window.KaaykoRipples.mount(document.getElementById('ripples')) : null;
  const bar = document.getElementById('bar');
  const display = document.getElementById('display');
  let theme = root.getAttribute('data-theme') || 'auto';
  let layout = read('layout') === 'book' ? 'book' : 'scroll';

  function applyTheme() {
    if (theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    root.classList.toggle('dark-theme', theme === 'dark' || (theme === 'auto' && osDark.matches));
    const input = document.getElementById('theme-' + theme);
    if (input) input.checked = true;
    if (ripples) ripples.draw();
  }

  // Title, cover and chapter links open the story in the layout the reader prefers.
  function applyLayout() {
    const input = document.getElementById('open-' + layout);
    if (input) input.checked = true;
    document.querySelectorAll('a[data-view-link]').forEach((a) => {
      const url = new URL(a.getAttribute('href'), location.href);
      url.searchParams.set('view', layout);
      a.setAttribute('href', url.pathname + url.search + url.hash);
    });
  }

  document.querySelectorAll('input[name="theme"]').forEach((input) => {
    input.addEventListener('change', () => { theme = input.value; save('theme', theme); applyTheme(); });
  });
  document.querySelectorAll('input[name="open"]').forEach((input) => {
    input.addEventListener('change', () => { layout = input.value; save('layout', layout); applyLayout(); });
  });
  osDark.addEventListener('change', applyTheme);

  display.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && display.open) { display.open = false; display.querySelector('summary').focus(); }
  });
  document.addEventListener('pointerdown', (e) => { if (display.open && !display.contains(e.target)) display.open = false; });

  const measure = () => root.style.setProperty('--barh', bar.offsetHeight + 'px');
  let timer;
  addEventListener('resize', () => {
    measure();
    clearTimeout(timer);
    timer = setTimeout(() => { if (ripples) ripples.render(); }, 160);
  });

  measure();
  applyTheme();
  applyLayout();
})();
