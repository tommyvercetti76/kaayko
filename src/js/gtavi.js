/* GTA VI launch party — kaayko.com/gtavi
 * RSVP → POST /api/kortex/links/gtavi/answer (Kortex, one answer per person, name kept).
 * Radio → the nine Vice City stations as full broadcasts on YouTube, through the
 * official IFrame player: tunes in mid-broadcast like a real radio, remembers the
 * station, pauses when a trailer plays. Browsers block sound before a tap, so the
 * first tap anywhere turns it on.
 */
(function () {
  'use strict';
  const CODE = 'gtavi';
  const $ = (id) => document.getElementById(id);

  /* ── RSVP ─────────────────────────────────────────────────────────── */
  const form = $('rsvp-form'), nameEl = $('rsvp-name'), msgEl = $('rsvp-msg');
  const KEY = 'kaayko_gtavi_rsvp';
  const remembered = (() => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } })();
  if (remembered && remembered.name) nameEl.value = remembered.name;
  if (remembered && remembered.choice) showMsg(remembered.choice, remembered.name, true);

  function showMsg(choice, name, quiet) {
    msgEl.hidden = false;
    msgEl.className = 'rsvp__msg' + (choice === 'out' ? ' is-out' : '');
    const who = name ? `, ${name}` : '';
    msgEl.textContent = choice === 'in'
      ? `You're in${who}. See you in Vice City. Address lands by text.`
      : `Noted${who}. Change your mind any time — just tap I'm in.`;
    if (!quiet) msgEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  async function answer(choice) {
    const name = nameEl.value.trim();
    if (choice === 'in' && !name) { nameEl.focus(); nameEl.placeholder = 'Your name first'; return; }
    const btn = form.querySelector('.btn--in'); btn.disabled = true;
    try {
      const r = await fetch(`/api/kortex/links/${CODE}/answer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choice, name })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.success) throw new Error(data.error || 'failed');
      try { localStorage.setItem(KEY, JSON.stringify({ choice, name: data.name || name })); } catch {}
      showMsg(choice, data.name || name, false);
    } catch (e) {
      msgEl.hidden = false; msgEl.className = 'rsvp__msg is-error';
      msgEl.textContent = 'That did not go through. Try again, or just text me.';
    } finally { btn.disabled = false; }
  }
  form.addEventListener('submit', (e) => { e.preventDefault(); answer('in'); });
  form.querySelector('[data-choice="out"]').addEventListener('click', () => answer('out'));

  /* ── Radio ────────────────────────────────────────────────────────── */
  // Full-broadcast uploads, checked 13 Nov 2026. `len` = seconds, so we can tune in mid-show.
  const STATIONS = [
    { name: 'Flash FM',        dj: 'Toni · pop',                          id: 'B-8EORB783c', len: 3793 },
    { name: 'V-Rock',          dj: 'Lazlow · rock',                       id: 'Up2qr5K6zc4', len: 4166 },
    { name: 'Emotion 98.3',    dj: 'Fernando Martinez · power ballads',   id: '9lrKRc1Z7Uc', len: 3546 },
    { name: 'Wave 103',        dj: 'Adam First · new wave',               id: 'h89GrZ9ackg', len: 3967 },
    { name: 'Fever 105',       dj: 'Oliver Ladykiller · soul & disco',    id: 'B8wt7p9LHOw', len: 3795 },
    { name: 'Wildstyle',       dj: 'Mr. Magic · hip hop & electro',       id: '0SXR99_ShJs', len: 4108 },
    { name: 'Radio Espantoso', dj: 'Pepe · Latin jazz & salsa',           id: '-B6N4pIikMw', len: 3698 },
    { name: 'K-Chat',          dj: 'Amy Sheckenhausen · interviews',      id: 'FMK-9lee2bs', len: 6240 },
    { name: 'VCPR',            dj: 'Maurice Chavez · Pressing Issues',    id: 'N8pbnjvypQ0', len: 6223 }
  ];
  const SKEY = 'kaayko_gtavi_station';
  let idx = (() => { const n = parseInt(localStorage.getItem(SKEY), 10); return Number.isInteger(n) && n >= 0 && n < STATIONS.length ? n : Math.floor(Math.random() * STATIONS.length); })();
  let player = null, ready = false, wantPlay = false, playing = false, muted = false, userPaused = false;

  const dial = $('radio-dial'), hint = $('radio-hint'), bar = $('bar');
  STATIONS.forEach((s, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'station'; b.role = 'tab'; b.textContent = s.name;
    b.setAttribute('aria-selected', String(i === idx));
    b.addEventListener('click', () => tune(i, true));
    dial.appendChild(b);
  });

  function paint() {
    const s = STATIONS[idx];
    $('radio-station').textContent = s.name; $('radio-dj').textContent = s.dj; $('bar-station').textContent = s.name;
    [...dial.children].forEach((b, i) => b.setAttribute('aria-selected', String(i === idx)));
    const glyph = playing ? '⏸' : '▶', label = playing ? 'Pause' : 'Play';
    for (const id of ['radio-play', 'bar-play']) { $(id).textContent = glyph; $(id).setAttribute('aria-label', label); }
    $('radio-mute').textContent = muted ? '🔇' : '🔊';
    bar.classList.toggle('is-playing', playing);
    bar.hidden = !ready;
    hint.hidden = ready && (playing || userPaused);
    if (ready && !playing && !userPaused) hint.textContent = 'Tap anywhere to turn it on';
  }
  const startAt = (s) => Math.floor(Math.random() * Math.max(1, s.len - 300));

  function tune(i, play) {
    idx = (i + STATIONS.length) % STATIONS.length;
    try { localStorage.setItem(SKEY, String(idx)); } catch {}
    const s = STATIONS[idx];
    if (ready) {
      if (play || playing) { player.loadVideoById({ videoId: s.id, startSeconds: startAt(s) }); wantPlay = true; userPaused = false; }
      else player.cueVideoById({ videoId: s.id, startSeconds: startAt(s) });
    }
    paint();
  }
  function play() { if (!ready) { wantPlay = true; return; } userPaused = false; player.playVideo(); }
  function pause() { if (!ready) return; userPaused = true; wantPlay = false; player.pauseVideo(); }
  function toggle() { playing ? pause() : play(); }

  $('radio-play').addEventListener('click', toggle);
  $('bar-play').addEventListener('click', toggle);
  $('radio-next').addEventListener('click', () => tune(idx + 1, true));
  $('bar-next').addEventListener('click', () => tune(idx + 1, true));
  $('radio-prev').addEventListener('click', () => tune(idx - 1, true));
  $('radio-mute').addEventListener('click', () => { if (!ready) return; muted = !muted; muted ? player.mute() : player.unMute(); paint(); });

  // The first tap anywhere turns the radio on (browsers refuse sound before a gesture).
  // A tap on a trailer or a control is its own intent, so it does not count.
  function firstTap(e) {
    if (e.target.closest('.trailer, .ctl, .bar, .lightbox, input, .link')) return;
    document.removeEventListener('pointerdown', firstTap, true);
    if (!playing && !userPaused) play();
  }
  document.addEventListener('pointerdown', firstTap, true);

  window.onYouTubeIframeAPIReady = function () {
    const s = STATIONS[idx];
    player = new YT.Player('radio-player', {
      host: 'https://www.youtube-nocookie.com',
      videoId: s.id,
      playerVars: { playsinline: 1, rel: 0, modestbranding: 1, controls: 1, start: startAt(s), origin: location.origin },
      events: {
        onReady() { ready = true; paint(); if (wantPlay) player.playVideo(); },
        onStateChange(ev) {
          const S = YT.PlayerState;
          playing = ev.data === S.PLAYING || ev.data === S.BUFFERING;
          if (ev.data === S.ENDED) { player.seekTo(0); player.playVideo(); }  // a station never signs off
          if (ev.data === S.PLAYING) pauseTrailers();
          paint();
        },
        onError() { tune(idx + 1, playing || wantPlay); }   // a dead upload: next station
      }
    });
  };
  const tag = document.createElement('script'); tag.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(tag);
  paint();

  /* ── Trailers: tap → the official video plays here; the radio steps aside ── */
  function pauseTrailers() {
    document.querySelectorAll('.trailer.is-playing').forEach((t) => { t.querySelector('iframe')?.remove(); t.classList.remove('is-playing'); });
  }
  document.querySelectorAll('.trailer').forEach((t) => {
    t.addEventListener('click', () => {
      if (t.classList.contains('is-playing')) return;
      if (playing) pause();
      pauseTrailers();
      const f = document.createElement('iframe');
      f.src = `https://www.youtube-nocookie.com/embed/${t.dataset.yt}?autoplay=1&rel=0&playsinline=1`;
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; f.allowFullscreen = true; f.title = t.querySelector('span').textContent;
      t.appendChild(f); t.classList.add('is-playing');
    });
  });

  /* ── Screenshots: tap → full screen ── */
  const box = $('lightbox'), boxImg = $('lightbox-img');
  $('shots-strip').addEventListener('click', (e) => {
    const img = e.target.closest('img'); if (!img || typeof box.showModal !== 'function') return;
    boxImg.src = img.src; boxImg.alt = img.alt; box.showModal();
  });
  $('lightbox-close').addEventListener('click', () => box.close());
  box.addEventListener('click', (e) => { if (e.target === box || e.target === boxImg) box.close(); });
})();
