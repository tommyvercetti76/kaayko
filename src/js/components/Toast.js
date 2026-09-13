/**
 * components/Toast.js — the store's one notice.
 *
 * Replaces two copies: fitPicker's "Added to bag" strip and the checkout's
 * error/notice toast. One element, reused; a new message replaces the old one.
 *
 *   Toast.show('Added to bag', { kind: 'good', action: { label: 'Go to bag', href: '/cart' } })
 *   Toast.show('That card was declined.', { kind: 'error' })
 *
 * kind: 'good' | 'notice' | 'error'. Errors use role="alert" and stay 7 s; the
 * rest role="status" and 5 s. Styles in css/toast.css (tokens from the store
 * palette, with fallbacks so the checkout's dark room reads correctly too).
 */
const ICONS = {
  good:   '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7.5"/></svg>',
  notice: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8.2v.2M12 11v5.4"/></svg>',
  error:  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.6M12 16.2v.2"/></svg>'
};
const HOLD_MS = { good: 5000, notice: 5000, error: 7000 };

let el = null;
let hideTimer = 0;

function ensure() {
  if (el && el.isConnected) return el;
  el = document.createElement('div');
  el.id = 'kaayko-toast';
  el.className = 'ktoast';
  el.innerHTML =
    '<span class="ktoast-icon" aria-hidden="true"></span>' +
    '<span class="ktoast-msg"></span>' +
    '<a class="ktoast-action" hidden></a>' +
    '<button type="button" class="ktoast-close" aria-label="Dismiss">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
    '</button>';
  el.querySelector('.ktoast-close').addEventListener('click', hide);
  document.body.appendChild(el);
  return el;
}

export function hide() {
  clearTimeout(hideTimer);
  if (el) el.classList.remove('is-visible');
}

/**
 * @param {string} message
 * @param {{kind?: 'good'|'notice'|'error', action?: {label:string, href:string}, ms?: number}} [opts]
 */
export function show(message, { kind = 'notice', action = null, ms } = {}) {
  const k = ICONS[kind] ? kind : 'notice';
  const node = ensure();
  node.className = `ktoast is-${k}`;
  node.setAttribute('role', k === 'error' ? 'alert' : 'status');
  node.setAttribute('aria-live', k === 'error' ? 'assertive' : 'polite');
  node.querySelector('.ktoast-icon').innerHTML = ICONS[k];
  node.querySelector('.ktoast-msg').textContent = message;
  const a = node.querySelector('.ktoast-action');
  if (action && action.href) {
    a.textContent = action.label || 'Open';
    a.href = action.href;
    a.hidden = false;
  } else {
    a.hidden = true;
    a.removeAttribute('href');
  }
  // Re-trigger the entrance when a message replaces a visible one.
  node.classList.remove('is-visible');
  void node.offsetWidth;
  node.classList.add('is-visible');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hide, typeof ms === 'number' ? ms : HOLD_MS[k]);
  return node;
}

export const Toast = { show, hide };
export default Toast;
