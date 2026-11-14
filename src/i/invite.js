/* kaay.link invitations — the page's script (kaay.link/i/invite.js).
 * Everything it shows about answers comes from the link: GET/POST/DELETE
 * /<name>/rsvp. The page holds no address and no numbers. Text is always set
 * as text, never as markup. Optional parts (radio, films, stills) exist only
 * when the invitation carries them.
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const data = JSON.parse(($('invite-data') || {}).textContent || '{}');
  const CODE = data.code, API = `/${encodeURIComponent(CODE)}/rsvp`;
  const el = (tag, props, ...kids) => { const n = Object.assign(document.createElement(tag), props || {}); kids.forEach(k => k != null && n.append(k)); return n; };
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }, del(k) { try { localStorage.removeItem(k); } catch { /* private mode */ } } };

  /* One token per phone: the link keeps one answer per token, so answering
     again from any network replaces the answer instead of adding one. */
  const visitor = (() => {
    let v = store.get('kaaylink_visitor');
    if (!v || !/^[A-Za-z0-9_-]{16,64}$/.test(v)) {
      try {
        const b = crypto.getRandomValues(new Uint8Array(18));
        v = btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        store.set('kaaylink_visitor', v);
      } catch { v = null; }
    }
    return v;
  })();

  /* ── RSVP ─────────────────────────────────────────────────────────── */
  const form = $('rsvp');
  if (form) {
    const nameEl = $('rsvp-name'), msg = $('rsvp-msg'), inBtn = $('rsvp-in');
    const KEY = `kaaylink_rsvp_${CODE}`;
    const remembered = (() => { try { return JSON.parse(store.get(KEY) || 'null'); } catch { return null; } })();

    const say = (cls, ...kids) => { msg.hidden = false; msg.className = `rsvp__reply${cls ? ` ${cls}` : ''}`; msg.replaceChildren(...kids.filter(Boolean)); };
    function revealNode(r) {
      if (!r) return null;
      const title = r.title ? el('strong', { textContent: r.title }) : null;
      const line = el('span', { className: 'label', textContent: r.text || '' });
      if (r.url) line.append(r.text ? ' · ' : '', el('u', { textContent: /maps/i.test(r.url) ? 'Open in Maps' : 'Open' }));
      return r.url ? el('a', { className: 'rsvp__addr', href: r.url, target: '_blank', rel: 'noopener' }, title, line) : el('div', { className: 'rsvp__addr' }, title, line);
    }
    function show(state, quiet) {
      const mine = state.mine;
      if (!mine) { msg.hidden = true; return; }
      const who = mine.name ? `, ${mine.name}` : '';
      const kids = [];
      if (mine.choice === data.yes) {
        const p = el('p');
        if (mine.pending) p.textContent = `Got it${who}. The host lets each guest in; check back here.`;
        else {
          p.append(`You're in${who}.`);
          const n = state.counts ? state.counts[data.yes] : null;
          if (n != null) p.append(n <= 1 ? ' First one in.' : ' ', n > 1 ? el('b', { textContent: String(n) }) : '', n > 1 ? ' in so far.' : '');
        }
        kids.push(p, revealNode(state.reveal));
      } else kids.push(el('p', { textContent: `Noted${who}. Changed your mind? Tap I'm in.` }));
      const undo = el('button', { type: 'button', className: 'textlink', textContent: 'Remove my answer' });
      undo.addEventListener('click', remove);
      kids.push(undo);
      say('', ...kids);
      if (!quiet) msg.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    const fail = (text) => say('is-error', el('p', { textContent: text }));

    async function call(method, body) {
      const r = await fetch(method === 'GET' && visitor ? `${API}?visitor=${encodeURIComponent(visitor)}` : API, {
        method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined
      });
      const d = await r.json().catch(() => ({}));
      return { ok: r.ok && d.success, d };
    }
    async function answer(choice) {
      const name = nameEl.value.trim();
      if (choice === data.yes && !name) { nameEl.focus(); nameEl.placeholder = 'Name first'; return; }
      const days = [...form.querySelectorAll('input[name="days"]:checked')].map(i => i.value);
      const guests = $('rsvp-guests') ? $('rsvp-guests').value : undefined;
      const passcode = $('rsvp-pass') ? $('rsvp-pass').value.trim() : undefined;
      inBtn.disabled = true;
      try {
        const { ok, d } = await call('POST', { choice, name, days, guests, passcode, visitor });
        if (!ok) return fail(d.error || "Didn't send. Try again.");
        // One phone holds one answer: say so when a second name takes the first one's place.
        const was = remembered && remembered.name && d.replaced && remembered.name !== (d.name || name) ? remembered.name : null;
        store.set(KEY, JSON.stringify({ name: d.name || name }));
        if (remembered) remembered.name = d.name || name;
        show(d, false);
        if (was) msg.append(el('p', { className: 'label', textContent: `This replaced ${was}'s answer from this phone. Answering for someone else? Use their phone.` }));
      } catch { fail("Didn't send. Try again."); } finally { inBtn.disabled = false; }
    }
    async function remove() {
      try {
        const { ok, d } = await call('DELETE', { visitor });
        if (!ok) return fail(d.error || "Couldn't remove it. Try again.");
        store.del(KEY);
        say('', el('p', { textContent: 'Removed. Nothing of yours is kept.' }));
      } catch { fail("Couldn't remove it. Try again."); }
    }
    form.addEventListener('submit', (e) => { e.preventDefault(); answer(data.yes); });
    $('rsvp-out').addEventListener('click', () => answer(data.no));

    // A returning guest sees their answer, and what follows it, straight from the link.
    if (remembered && remembered.name) nameEl.value = remembered.name;
    call('GET').then(({ ok, d }) => {
      if (!ok) return;
      if (d.mine) {
        if (d.mine.name && !nameEl.value) nameEl.value = d.mine.name;
        if (Array.isArray(d.mine.days) && d.mine.days.length) form.querySelectorAll('input[name="days"]').forEach(i => { i.checked = d.mine.days.includes(i.value); });
        if ($('rsvp-guests') && d.mine.guests) $('rsvp-guests').value = d.mine.guests;   // or a re-send would shrink the party to one
        show(d, true);
      } else if (d.full) { inBtn.textContent = "It's full"; }
    }).catch(() => {});
  }

  /* ── The strip: a film plays in its tile; a still opens full screen ── */
  let pauseRadio = () => {};
  const stopFilms = () => document.querySelectorAll('.tile.is-playing').forEach((t) => { const f = t.querySelector('iframe'); if (f) f.remove(); t.classList.remove('is-playing'); });
  const strip = $('strip'), box = $('lightbox'), boxImg = $('lightbox-img');
  if (strip) strip.addEventListener('click', (e) => {
    const t = e.target.closest('.tile'); if (!t) return;
    if (t.dataset.yt) {
      if (t.classList.contains('is-playing')) return;
      pauseRadio(); stopFilms();
      const f = el('iframe', { src: `https://www.youtube-nocookie.com/embed/${t.dataset.yt}?autoplay=1&rel=0&playsinline=1`, allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowFullscreen: true, title: (t.querySelector('.tile__cap') || {}).textContent || 'Video' });
      t.appendChild(f); t.classList.add('is-playing');
      return;
    }
    const img = t.querySelector('img'); if (!img || !box || typeof box.showModal !== 'function') return;
    boxImg.src = t.dataset.full || img.src; boxImg.alt = img.alt; box.showModal();
  });
  if (box) {
    $('lightbox-close').addEventListener('click', () => box.close());
    box.addEventListener('click', (e) => { if (e.target === box || e.target === boxImg) box.close(); });
  }

  /* ── Radio: full broadcasts through the YouTube player, tuned in mid-show ── */
  const STATIONS = Array.isArray(data.radio) ? data.radio : [];
  if (STATIONS.length && $('radio-dial')) {
    const SKEY = `kaaylink_station_${CODE}`;
    const saved = parseInt(store.get(SKEY), 10);
    let idx = Number.isInteger(saved) && saved >= 0 && saved < STATIONS.length ? saved : new Date().getMinutes() % STATIONS.length;
    let player = null, ready = false, wantPlay = false, playing = false, muted = false, userPaused = false;
    const dial = $('radio-dial'), hint = $('radio-hint'), bar = $('bar');
    const icon = (id, name) => { const u = $(id) && $(id).querySelector('use'); if (u) u.setAttribute('href', `#${name}`); };
    STATIONS.forEach((s, i) => {
      const b = el('button', { type: 'button', className: 'station', textContent: s.name });
      b.setAttribute('role', 'tab'); b.addEventListener('click', () => tune(i, true)); dial.appendChild(b);
    });
    const startAt = (s) => (s.len > 600 ? Math.floor(((Date.now() / 1000) % (s.len - 300))) : 0);   // "now" on a station that never stops
    function paint() {
      const s = STATIONS[idx];
      $('radio-station').textContent = s.name; $('radio-note').textContent = s.note || ''; $('bar-station').textContent = s.name;
      [...dial.children].forEach((b, i) => b.setAttribute('aria-selected', String(i === idx)));
      for (const id of ['radio-play', 'bar-play']) { icon(id, playing ? 'i-pause' : 'i-play'); $(id).setAttribute('aria-label', playing ? 'Pause' : 'Play'); }
      icon('radio-mute', muted ? 'i-mute' : 'i-vol'); $('radio-mute').setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
      bar.classList.toggle('is-playing', playing); bar.hidden = !ready;
      hint.hidden = ready && (playing || userPaused);
    }
    function tune(i, play) {
      idx = (i + STATIONS.length) % STATIONS.length; store.set(SKEY, String(idx));
      const s = STATIONS[idx];
      if (ready) {
        if (play || playing) { player.loadVideoById({ videoId: s.yt, startSeconds: startAt(s) }); wantPlay = true; userPaused = false; }
        else player.cueVideoById({ videoId: s.yt, startSeconds: startAt(s) });
      }
      paint();
    }
    const play = () => { if (!ready) { wantPlay = true; return; } userPaused = false; player.playVideo(); };
    const pause = () => { if (!ready) return; userPaused = true; wantPlay = false; player.pauseVideo(); };
    pauseRadio = () => { if (playing) pause(); };
    const toggle = () => (playing ? pause() : play());
    $('radio-play').addEventListener('click', toggle); $('bar-play').addEventListener('click', toggle);
    $('radio-next').addEventListener('click', () => tune(idx + 1, true)); $('bar-next').addEventListener('click', () => tune(idx + 1, true));
    $('radio-prev').addEventListener('click', () => tune(idx - 1, true));
    $('radio-mute').addEventListener('click', () => { if (!ready) return; muted = !muted; if (muted) player.mute(); else player.unMute(); paint(); });
    // Browsers refuse sound before a tap: the first tap that is not its own action turns the radio on.
    function firstTap(e) {
      if (e.target.closest('.tile, .ctl, .bar, .lightbox, input, label, a, button')) return;
      document.removeEventListener('pointerdown', firstTap, true);
      if (!playing && !userPaused) play();
    }
    document.addEventListener('pointerdown', firstTap, true);
    window.onYouTubeIframeAPIReady = function () {
      const s = STATIONS[idx];
      player = new YT.Player('radio-player', {
        host: 'https://www.youtube-nocookie.com', videoId: s.yt,
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, controls: 1, start: startAt(s), origin: location.origin },
        events: {
          onReady() { ready = true; paint(); if (wantPlay) player.playVideo(); },
          onStateChange(ev) {
            const S = YT.PlayerState;
            playing = ev.data === S.PLAYING || ev.data === S.BUFFERING;
            if (ev.data === S.ENDED) { player.seekTo(0); player.playVideo(); }
            if (ev.data === S.PLAYING) stopFilms();
            paint();
          },
          onError() { tune(idx + 1, playing || wantPlay); }
        }
      });
    };
    document.head.appendChild(el('script', { src: 'https://www.youtube.com/iframe_api' }));
    paint();
  }
})();
