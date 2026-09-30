/**
 * Kaayko Reads — the /reads landing: the theme choice and the lake behind the page.
 * The pre-paint script in <head> has already applied a remembered theme; this keeps the
 * radios, the shared footer (html.dark-theme) and the ripple lines in step with it.
 */
(function () {
  'use strict';
  const root = document.documentElement;
  const save = (k, v) => { try { localStorage.setItem('reads:' + k, v); } catch (_) { /* private window */ } };
  const osDark = matchMedia('(prefers-color-scheme: dark)');
  const ripples = window.KaaykoRipples ? window.KaaykoRipples.mount(document.getElementById('ripples')) : null;
  const bar = document.getElementById('bar');
  let theme = root.getAttribute('data-theme') || 'auto';

  function apply() {
    if (theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    root.classList.toggle('dark-theme', theme === 'dark' || (theme === 'auto' && osDark.matches));
    const input = document.getElementById('theme-' + theme);
    if (input) input.checked = true;
    if (ripples) ripples.draw();
  }

  document.querySelectorAll('input[name="theme"]').forEach((input) => {
    input.addEventListener('change', () => { theme = input.value; save('theme', theme); apply(); });
  });
  osDark.addEventListener('change', apply);

  const measure = () => root.style.setProperty('--barh', bar.offsetHeight + 'px');
  let timer;
  addEventListener('resize', () => {
    measure();
    clearTimeout(timer);
    timer = setTimeout(() => { if (ripples) ripples.render(); }, 160);
  });

  measure();
  apply();
})();
