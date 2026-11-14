/* kaay.link home — the Invitation side of the maker.
 * Posts to the same free-maker route as a link (POST /kortex/guest/links), with
 * a name and an `invite`; the server derives everything else. Uses the page's
 * own helpers from kortex-app.js (guestApi, saveGuestSession, showResult,
 * setAlert, friendly, copyText, CONFIG): it must load after that file.
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const form = $('invite-form');
  if (!form || typeof guestApi !== 'function') return;

  /* Link or Invitation: two doors into one maker. */
  function setKind(kind) {
    for (const k of ['link', 'invite']) { $(`kind-${k}`).classList.toggle('active', k === kind); $(`kind-${k}`).setAttribute('aria-pressed', String(k === kind)); }
    $('make-form').hidden = kind !== 'link';
    form.hidden = kind !== 'invite';
    if (kind === 'invite' && !$('iv-title').value) $('iv-title').focus({ preventScroll: true });
  }
  $('kind-link').addEventListener('click', () => setKind('link'));
  $('kind-invite').addEventListener('click', () => setKind('invite'));
  // "Make another" brings the link form back; keep the switch telling the truth.
  new MutationObserver(() => { if (!$('make-form').hidden) setKind('link'); }).observe($('make-form'), { attributes: true, attributeFilter: ['hidden'] });
  // The host link belongs to the result of an invitation only.
  const baseShow = window.showResult;
  window.showResult = function (r) { $('rs-host').hidden = true; return baseShow(r); };
  if (/^#invite/.test(location.hash)) setKind('invite');

  /* When: next Saturday, 7 to 11 in the evening, until the host says otherwise. */
  const pad = (n) => String(n).padStart(2, '0');
  const local = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const sat = new Date(); sat.setDate(sat.getDate() + ((6 - sat.getDay() + 7) % 7 || 7)); sat.setHours(19, 0, 0, 0);
  $('iv-start').value = local(sat);
  $('iv-end').value = local(new Date(sat.getTime() + 4 * 3600000));
  $('iv-start').addEventListener('change', () => {
    const s = new Date($('iv-start').value), e = new Date($('iv-end').value);
    if (!Number.isNaN(s.getTime()) && (Number.isNaN(e.getTime()) || e <= s)) $('iv-end').value = local(new Date(s.getTime() + 4 * 3600000));
  });

  /* The name: suggested from the title until the host types their own; checked as they type. */
  const nameEl = $('iv-name'), nameSay = $('iv-name-status');
  const slug = (t) => String(t).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24).replace(/-+$/, '');
  let nameTouched = false, nameOk = false, checkTimer = 0, checkSeq = 0;
  function say(text, cls) { nameSay.textContent = text; nameSay.className = `field-help name-status${cls ? ` ${cls}` : ''}`; }
  async function checkName() {
    const name = nameEl.value.trim().toLowerCase();
    nameOk = false;
    if (!name) return say('Leave empty for a random one.', '');
    const seq = ++checkSeq;
    try {
      const r = await fetch(`${CONFIG.API_BASE}/kortex/names/${encodeURIComponent(name)}?free=1`);
      const d = await r.json();
      if (seq !== checkSeq) return;
      if (d.available) { nameOk = true; return say(`kaay.link/${d.name} is yours if you take it now.`, 'ok'); }
      say(`${d.message || 'Not available.'}${d.suggestions && d.suggestions.length ? ` Try ${d.suggestions.join(', ')}.` : ''}`, 'bad');
    } catch { if (seq === checkSeq) say('Could not check the name. It is checked again when you create.', ''); }
  }
  const queueCheck = () => { clearTimeout(checkTimer); checkTimer = setTimeout(checkName, 350); };
  nameEl.addEventListener('input', () => { nameTouched = true; nameEl.value = nameEl.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''); queueCheck(); });
  $('iv-title').addEventListener('input', () => { if (!nameTouched) { nameEl.value = slug($('iv-title').value); queueCheck(); } });
  $('iv-access').addEventListener('change', () => { $('iv-pass-field').hidden = $('iv-access').value !== 'code'; });

  /* What a yes unlocks: an address gets a map link, a web address becomes the link itself. */
  function revealOf(text) {
    const t = text.trim();
    if (!t) return undefined;
    if (/^https:\/\/\S+$/i.test(t)) { let host = t; try { host = new URL(t).hostname.replace(/^www\./, ''); } catch { /* shown as typed */ } return { title: host.slice(0, 80), url: t }; }
    const address = /\d/.test(t) && /[a-z]{3,}/i.test(t) && t.length >= 8;
    return { title: t.slice(0, 80), url: address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t)}` : undefined };
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setAlert('iv-alert', '', '');
    const title = $('iv-title').value.trim();
    const start = new Date($('iv-start').value), end = new Date($('iv-end').value);
    if (!title) { setAlert('iv-alert', 'error', 'Say what it is.'); return $('iv-title').focus(); }
    if (Number.isNaN(start.getTime())) { setAlert('iv-alert', 'error', 'Say when it starts.'); return $('iv-start').focus(); }
    if (Number.isNaN(end.getTime()) || end <= start) { setAlert('iv-alert', 'error', 'It has to end after it starts.'); return $('iv-end').focus(); }
    const access = $('iv-access').value;
    const passcode = $('iv-pass').value.trim();
    if (access === 'code' && passcode.length < 4) { setAlert('iv-alert', 'error', 'Give it an invite code of at least 4 characters.'); return $('iv-pass').focus(); }
    const theme = (form.querySelector('input[name="iv-theme"]:checked') || {}).value || 'night';
    const btn = $('iv-submit'); btn.disabled = true; btn.textContent = 'Creating…';
    const { ok, data } = await guestApi('/links', {
      method: 'POST',
      body: {
        code: nameEl.value.trim() || undefined,
        website: $('iv-website').value || undefined,
        invite: {
          title, startsAt: start.toISOString(), endsAt: end.toISOString(),
          tz: (Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC',
          area: $('iv-area').value.trim() || undefined,
          theme, reveal: revealOf($('iv-reveal').value),
          access, passcode: access === 'code' ? passcode : undefined
        }
      }
    });
    btn.disabled = false; btn.textContent = 'Create invitation';
    if (!ok) {
      setAlert('iv-alert', 'error', friendly(data, 'Could not create the invitation. Please try again.'));
      if (data && (data.code === 'ALREADY_EXISTS' || data.code === 'INVALID_CODE')) { nameEl.focus(); checkName(); }
      return;
    }
    saveGuestSession(data.session, data.workspace);
    form.hidden = true;
    window.showResult({ kind: 'dynamic', link: data.link, qrPng: data.qr.png, accessCode: data.accessCode, workspace: data.workspace });
    if (data.hostUrl) {
      $('rs-host').hidden = false;
      $('rs-host-url').textContent = data.hostUrl.replace(/^https?:\/\//, '').replace(/\/host\/.+$/, '/host/…');
      $('rs-host-open').href = data.hostUrl;
      $('rs-host-copy').onclick = () => copyText(data.hostUrl, $('rs-host-copy'));
    }
    form.reset(); nameTouched = false; say('Leave empty for a random one.', '');
    $('iv-start').value = local(sat); $('iv-end').value = local(new Date(sat.getTime() + 4 * 3600000)); $('iv-pass-field').hidden = true;
  });

  /* Plans, samples and team sign-in sit folded below; a link to one of them opens the fold. */
  const more = $('more');
  function openForHash() { if (more && /^#(pricing|cases|connect)/.test(location.hash)) { more.open = true; const t = document.querySelector(location.hash); if (t) t.scrollIntoView(); } }
  window.addEventListener('hashchange', openForHash);
  openForHash();
})();
