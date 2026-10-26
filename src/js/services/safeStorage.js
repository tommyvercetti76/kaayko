/**
 * services/safeStorage.js — somewhere to keep small things, in any browser.
 *
 * localStorage first; where it is blocked (Safari's "Block all cookies", Firefox
 * with DOM storage off, some in-app browsers and company policies), sessionStorage;
 * then a first-party cookie; then this page's memory. Found 26 Oct 2026: with
 * storage blocked the bag emptied on every page and the header threw before it drew
 * its menu and bag icon.
 *
 *   storageMode()      'local' | 'session' | 'cookie' | 'memory'
 *   get(key) / set(key, value) / remove(key)   strings, like localStorage
 *
 * A cookie holds at most ~3.8 KB, so a larger value stays in memory for this page.
 * Cookies are first-party, SameSite=Lax, a year long, and carry only what the page
 * already kept in localStorage (the bag, a held code, preferences) — never PII.
 */
const COOKIE_MAX = 3800;
const memory = new Map();
const cookieName = (k) => k.replace(/[^a-z0-9]/gi, '_');

function probe() {
  for (const s of ['localStorage', 'sessionStorage']) {
    try {
      const st = window[s];
      st.setItem('__kaayko_probe', '1');
      st.removeItem('__kaayko_probe');
      return s === 'localStorage' ? 'local' : 'session';
    } catch (_) { /* blocked: try the next */ }
  }
  try {
    document.cookie = '__kaayko_probe=1; path=/; samesite=lax';
    if (/(?:^|; )__kaayko_probe=1/.test(document.cookie)) {
      document.cookie = '__kaayko_probe=; path=/; max-age=0; samesite=lax';
      return 'cookie';
    }
  } catch (_) { /* blocked */ }
  return 'memory';
}

let mode;
export function storageMode() {
  if (!mode) mode = probe();
  return mode;
}

function readCookie(k) {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${cookieName(k)}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : null;
  } catch (_) { return null; }
}

export function get(k) {
  const m = storageMode();
  try {
    if (m === 'local') return localStorage.getItem(k);
    if (m === 'session') return sessionStorage.getItem(k);
  } catch (_) { /* revoked mid-visit: fall through */ }
  if (memory.has(k)) return memory.get(k);
  return m === 'cookie' ? readCookie(k) : null;
}

/** Returns true when the value will outlive this page. */
export function set(k, v) {
  const m = storageMode();
  const value = String(v);
  memory.set(k, value);
  try {
    if (m === 'local') { localStorage.setItem(k, value); return true; }
    if (m === 'session') { sessionStorage.setItem(k, value); return true; }
  } catch (_) { return false; }
  if (m === 'cookie') {
    const enc = encodeURIComponent(value);
    if (enc.length > COOKIE_MAX) { remove(k); memory.set(k, value); return false; }
    try { document.cookie = `${cookieName(k)}=${enc}; path=/; max-age=31536000; samesite=lax`; return true; } catch (_) { return false; }
  }
  return false;
}

export function remove(k) {
  memory.delete(k);
  const m = storageMode();
  try {
    if (m === 'local') localStorage.removeItem(k);
    else if (m === 'session') sessionStorage.removeItem(k);
    else if (m === 'cookie') document.cookie = `${cookieName(k)}=; path=/; max-age=0; samesite=lax`;
  } catch (_) { /* nothing kept */ }
}

export const safeStorage = { get, set, remove, storageMode };
export default safeStorage;
