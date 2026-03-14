/* =========================================================
   KAMERA QUEST — EVF JavaScript
   Camera Electronic Viewfinder UI
   ========================================================= */
(function () {
  'use strict';

  /* ── Constants ── */
  const STORAGE_KEY  = 'kameraQuest:lastClassicPreset';
  const BUILDER_KEY  = 'kameraQuest:builderState';
  const SCENE_KEY    = 'kameraQuest:sceneState';
  const API_BASE     = window.__KAMERA_QUEST_API_BASE__ || 'https://api-vwcc5j4qda-uc.a.run.app';

  /* ── Genre data ── */
  const GENRE_META = {
    portrait:      { label: 'Portrait',       icon: '◐' },
    landscape:     { label: 'Landscape',      icon: '△' },
    astro:         { label: 'Astro',          icon: '✦' },
    wildlife:      { label: 'Wildlife',       icon: '◆' },
    sports:        { label: 'Sports',         icon: '◈' },
    macro:         { label: 'Macro',          icon: '◎' },
    indoorlowlight:{ label: 'Indoor / Low Light', icon: '◌' },
    goldenhour:    { label: 'Golden Hour',    icon: '☼' },
    street:        { label: 'Street',         icon: '↗' },
    architecture:  { label: 'Architecture',   icon: '▥' },
    event:         { label: 'Event',          icon: '◍' },
    travel:        { label: 'Travel',         icon: '✧' },
    food:          { label: 'Food',           icon: '◔' },
    realestate:    { label: 'Real Estate',    icon: '▣' },
    automotive:    { label: 'Automotive',     icon: '▶' },
    product:       { label: 'Product',        icon: '■' },
    concert:       { label: 'Concert',        icon: '♫' },
    underwater:    { label: 'Underwater',     icon: '≈' },
    drone:         { label: 'Drone',          icon: '◇' },
    newborn:       { label: 'Newborn',        icon: '○' },
    fashion:       { label: 'Fashion',        icon: '⬒' },
  };

  const PRIMARY_GENRES = [
    'portrait','landscape','astro','wildlife','sports','macro',
    'indoorlowlight','goldenhour','street','architecture','event','travel',
  ];

  const BRAND_META = {
    canon: { label: 'Canon',  mount: 'RF / EF', note: 'Canon mirrorless + legacy EF' },
    sony:  { label: 'Sony',   mount: 'E-mount',  note: 'Full-frame + APS-C E-mount' },
  };

  const MODE_META = {
    apprentice:  { label: 'Appr.',  abbr: 'Appr.'  },
    enthusiast:  { label: 'Enth.',  abbr: 'Enth.'  },
    craftsperson:{ label: 'Craft.', abbr: 'Craft.' },
    professional:{ label: 'Pro',    abbr: 'Pro'    },
  };

  /* ── Genre canvas palettes ── */
  const GENRE_PALETTE = {
    portrait:      { base: '#1a0810', hi: '#7a2042' },
    landscape:     { base: '#060e14', hi: '#1a4a6e' },
    astro:         { base: '#02030f', hi: '#0a1a3e' },
    wildlife:      { base: '#080d04', hi: '#2a4210' },
    sports:        { base: '#0a0810', hi: '#3a1050' },
    macro:         { base: '#060c08', hi: '#1a4228' },
    indoorlowlight:{ base: '#0a0804', hi: '#2a1e08' },
    goldenhour:    { base: '#120800', hi: '#a04808' },
    street:        { base: '#080808', hi: '#1a1a2a' },
    architecture:  { base: '#080a0c', hi: '#122030' },
    event:         { base: '#0c080c', hi: '#3a183a' },
    travel:        { base: '#060a0c', hi: '#0e2e4a' },
    food:          { base: '#0c0804', hi: '#3c1c08' },
    realestate:    { base: '#080a0c', hi: '#162030' },
    automotive:    { base: '#080808', hi: '#1c1a10' },
    product:       { base: '#060608', hi: '#12121c' },
    concert:       { base: '#0c0408', hi: '#4a0c28' },
    underwater:    { base: '#020a10', hi: '#083448' },
    drone:         { base: '#060a0e', hi: '#0c2038' },
    newborn:       { base: '#0c0808', hi: '#2c1010' },
    fashion:       { base: '#0a0408', hi: '#3a0c1c' },
  };

  /* ── Aperture / Shutter / ISO stops ── */
  const AP_STOPS  = [1.2, 1.4, 1.8, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
  const ISO_STOPS = [100, 200, 400, 800, 1600, 3200, 6400, 12800];
  const SH_STOPS  = [1/30, 1/60, 1/125, 1/250, 1/500, 1/1000, 1/2000, 1/4000, 1/8000];

  /* ── State ── */
  const state = {
    genre:    '',
    condition:'',
    brand:    '',
    camera:   '',
    lens:     '',
    mode:     'enthusiast',
    apIdx:    3,   // default f/2
    shIdx:    3,   // default 1/250
    isoIdx:   2,   // default ISO 400
    activeDialKey: 'ap',
    generating: false,
    briefOpen: false,
    sceneOpen: false,
    gearOpen:  false,
    gearConfirmed: false,
    preset: null,
    error: '',
  };

  /* ── Session cache ── */
  const cache = {
    cameras: null,
    lenses:  null,
    meta:    null,
    brandKey: null,
    cameraKey: null,
  };

  /* ── Storage helpers ── */
  function safeParse(v) { try { return JSON.parse(v); } catch(e) { return null; } }
  function readSt(key)   { try { return safeParse(sessionStorage.getItem(key)); } catch(e) { return null; } }
  function writeSt(key, v) { try { sessionStorage.setItem(key, JSON.stringify(v)); } catch(e) {} }

  function loadPersistedState() {
    const b = readSt(BUILDER_KEY);
    const s = readSt(SCENE_KEY);
    const r = readSt(STORAGE_KEY);
    if (b) {
      state.brand  = b.brand  || '';
      state.camera = b.cameraModel || '';
      state.lens   = b.lensName || '';
      state.mode   = b.mode || 'enthusiast';
      state.gearConfirmed = !!(b.brand && b.cameraModel && b.lensName);
    }
    if (s) {
      state.genre     = s.genre || '';
      state.condition = s.condition || '';
    }
    if (r && r.response && r.response.preset) {
      state.preset = r.response.preset;
      applyPresetToState(state.preset);
    }
  }

  function persistBuilder() {
    writeSt(BUILDER_KEY, {
      brand: state.brand, cameraModel: state.camera,
      lensName: state.lens, mode: state.mode,
    });
  }

  function persistScene() {
    writeSt(SCENE_KEY, { genre: state.genre, condition: state.condition });
  }

  /* ── Escape helper ── */
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  /* ── Format helpers ── */
  function fmtShutter(s) {
    if (!s || !isFinite(s)) return '—';
    if (s >= 1) return s >= 10 ? Math.round(s)+'s' : s.toFixed(1)+'s';
    return '1/'+Math.round(1/s);
  }
  function fmtAperture(v) { return 'f/'+v; }
  function fmtISO(v)      { return String(v); }

  function parseShutter(v) {
    if (typeof v === 'number') return v;
    const t = String(v||'').trim();
    if (/^\d+\/\d+/.test(t)) { const p=t.split('/').map(Number); return p[1]?p[0]/p[1]:0; }
    return Number(t.replace(/[^\d.]/g,'')) || 0;
  }
  function parseAp(v) {
    if (typeof v === 'number') return v;
    const m = String(v||'').match(/(\d+(\.\d+)?)/);
    return m ? Number(m[1]) : 2.8;
  }

  function nearestIdx(arr, val) {
    let best=0, bestD=Infinity;
    arr.forEach(function(x,i){const d=Math.abs(x-val);if(d<bestD){bestD=d;best=i;}});
    return best;
  }

  function applyPresetToState(preset) {
    if (!preset) return;
    const ap = parseAp(preset.aperture);
    const sh = parseShutter(preset.shutterSpeedWithIBIS||preset.shutterSpeed||'1/125');
    const is = Number(preset.ISO)||400;
    state.apIdx  = nearestIdx(AP_STOPS, ap);
    state.shIdx  = nearestIdx(SH_STOPS, sh);
    state.isoIdx = nearestIdx(ISO_STOPS, is);
  }

  /* ── EV computation ── */
  function computeEV(apIdx, shIdx, isoIdx) {
    const ap  = AP_STOPS[apIdx]  || 2.8;
    const sh  = SH_STOPS[shIdx]  || (1/125);
    const iso = ISO_STOPS[isoIdx]|| 400;
    return Math.log2(ap*ap) - Math.log2(sh) - Math.log2(iso/100);
  }

  /* ── Implication sentence (single, most critical consequence) ── */
  function buildImplication() {
    const ap  = AP_STOPS[state.apIdx];
    const sh  = SH_STOPS[state.shIdx];
    const iso = ISO_STOPS[state.isoIdx];

    if (!state.genre) {
      return 'Choose a scene to see live photographic consequences update here.';
    }
    // Lead with the single most critical consequence for the current settings
    if (ap <= 1.4)    return '<b>f/' + ap + '</b> wide open — depth of field is millimetres. Eye focus must be pin-sharp or the frame is lost.';
    if (iso > 6400)   return '<b>ISO ' + iso + '</b> — heavy grain tradeoff. Use only when aperture and shutter have no room left.';
    if (sh <= 1/30)   return '<b>' + fmtShutter(sh) + '</b> is very slow for handheld. Stabilisation or solid support is essential here.';
    if (ap <= 2.8)    return '<b>f/' + ap + '</b> — strong subject separation with generous light. Good baseline for most genres.';
    if (sh <= 1/1000) return '<b>' + fmtShutter(sh) + '</b> — fast enough to freeze most action cleanly.';
    if (iso > 1600)   return '<b>ISO ' + iso + '</b> — visible grain likely. Test the first frames before committing.';
    if (ap <= 5.6)    return '<b>f/' + ap + '</b> — balanced depth and light. Reliable for active and complex scenes.';
    return '<b>f/' + ap + '</b> · <b>' + fmtShutter(sh) + '</b> · ISO <b>' + iso + '</b> — solid baseline for this genre.';
  }

  /* Readout sub-labels */
  function apSub(ap) {
    if (ap <= 2) return 'Shallow DoF';
    if (ap <= 5.6) return 'Balanced';
    return 'Deep DoF';
  }
  function shSub(sh) {
    if (!sh) return '—';
    if (sh <= 1/500) return 'Freezes motion';
    if (sh <= 1/60)  return 'Watch motion';
    return 'Use support';
  }
  function isoSub(iso) {
    if (iso <= 400)  return 'Clean';
    if (iso <= 1600) return 'Moderate noise';
    if (iso <= 6400) return 'Visible grain';
    return 'Heavy grain';
  }
  function modeSub(m) {
    if (!m) return 'Auto';
    const k = m.toLowerCase().replace(/[^a-z]/g,'');
    if (k==='m'||k==='manual') return 'Manual';
    if (k==='av'||k==='a') return 'Ap. Priority';
    if (k==='tv'||k==='s') return 'Sh. Priority';
    return 'Auto';
  }

  /* ── Canvas renderer ── */
  let canvasRAF = null;
  let canvasT   = 0;
  let lastFrameTime = 0;

  // Seeded pseudo-random for stable stars
  function seededRand(seed) {
    let x = Math.sin(seed+1)*10000;
    return x - Math.floor(x);
  }

  function renderCanvas(canvas) {
    const W = canvas.width  = canvas.offsetWidth  || window.innerWidth;
    const H = canvas.height = canvas.offsetHeight || window.innerHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const ap    = AP_STOPS[state.apIdx]   || 2.8;
    const shIdx = state.shIdx;
    const iso   = ISO_STOPS[state.isoIdx] || 400;
    const genre = state.genre || 'portrait';
    const pal   = GENRE_PALETTE[genre] || GENRE_PALETTE.portrait;
    const T     = canvasT;

    // Base gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, pal.base);
    grad.addColorStop(1, '#030304');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Atmosphere bloom
    const bloomO = (genre==='goldenhour'?0.26:genre==='astro'?0.16:0.18)
                   * (0.9 + 0.1*Math.sin(T*0.3));
    const bloom = ctx.createRadialGradient(W/2, H*0.52, 0, W/2, H*0.52, W*0.55);
    bloom.addColorStop(0, hexAlpha(pal.hi, bloomO));
    bloom.addColorStop(1, 'transparent');
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, W, H);

    // Aperture-driven DOF vignette
    const vigO = Math.max(0.22, 0.68 - ap*0.022);
    const vig = ctx.createRadialGradient(W/2, H/2, W*0.18, W/2, H/2, W*0.72);
    vig.addColorStop(0, 'transparent');
    vig.addColorStop(1, 'rgba(0,0,0,'+vigO.toFixed(3)+')');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // Bokeh bloom at wide apertures
    if (ap <= 2.0) {
      const bO = ((2.0-ap)/2.0)*0.18;
      const bb = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W*0.3);
      bb.addColorStop(0, hexAlpha(pal.hi, bO));
      bb.addColorStop(1, 'transparent');
      ctx.fillStyle = bb;
      ctx.fillRect(0, 0, W, H);
    }

    // Focus plane ellipse at wide aperture
    if (ap <= 2.0 && genre) {
      ctx.save();
      ctx.strokeStyle = 'rgba(240,168,40,0.07)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.ellipse(W/2, H*0.44, W*0.2, H*0.14, 0, 0, Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }

    // ISO grain
    if (iso > 800) {
      const density = Math.log2(iso/800)/6 * 0.5;
      const count   = Math.floor(W*H * density);
      ctx.save();
      for (let i = 0; i < count; i++) {
        const gx = Math.random()*W;
        const gy = Math.random()*H;
        const ga = Math.random() * 0.38;
        ctx.fillStyle = 'rgba(220,215,200,'+ga.toFixed(3)+')';
        ctx.fillRect(gx, gy, 1, 1);
      }
      ctx.restore();
    }

    // Shutter smear
    if (shIdx <= 2) {
      const smearO = (2-shIdx)/2;
      ctx.save();
      for (let i = 0; i < 18; i++) {
        const sy = Math.random()*H;
        const len = (0.3 + Math.random()*0.5)*W * smearO;
        ctx.fillStyle = 'rgba(255,255,255,'+(Math.random()*0.04*smearO).toFixed(4)+')';
        ctx.fillRect(0, sy, len, 1);
      }
      ctx.restore();
    }

    // Astro stars
    if (genre === 'astro') {
      ctx.save();
      for (let i = 0; i < 220; i++) {
        const sx = seededRand(i*3+1)*W;
        const sy = seededRand(i*3+2)*H*0.75;
        const sr = 0.2 + seededRand(i*3+3)*1.6;
        const so = 0.3 + 0.7*((Math.sin(T*1.6+i*0.55)+1)/2);
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(220,230,255,'+so.toFixed(3)+')';
        ctx.fill();
      }
      ctx.restore();
    }

    // Golden rays
    const isGolden = genre==='goldenhour'
      || (state.condition && (state.condition.toLowerCase().includes('golden')
         || state.condition.toLowerCase().includes('backlit')));
    if (isGolden) {
      ctx.save();
      const rx = W*0.72, ry = H*0.14;
      for (let i = 0; i < 9; i++) {
        const baseAngle = (i/9)*Math.PI*2;
        const a = baseAngle + Math.sin(T*0.18+i)*0.018;
        const spread = 0.06;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + Math.cos(a-spread)*W*1.5, ry + Math.sin(a-spread)*H*1.5);
        ctx.lineTo(rx + Math.cos(a+spread)*W*1.5, ry + Math.sin(a+spread)*H*1.5);
        ctx.closePath();
        const rayGrad = ctx.createRadialGradient(rx, ry, 0, rx, ry, W*1.5);
        rayGrad.addColorStop(0, 'rgba(210,130,8,0.10)');
        rayGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = rayGrad;
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /* hex + opacity helper */
  function hexAlpha(hex, alpha) {
    hex = hex.replace('#','');
    if (hex.length===3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    const r=parseInt(hex.substr(0,2),16);
    const g=parseInt(hex.substr(2,2),16);
    const b=parseInt(hex.substr(4,2),16);
    return 'rgba('+r+','+g+','+b+','+alpha+')';
  }

  function startCanvasLoop(canvas) {
    if (canvasRAF) cancelAnimationFrame(canvasRAF);
    function loop(timestamp) {
      const dt = lastFrameTime ? (timestamp - lastFrameTime)/1000 : 0;
      lastFrameTime = timestamp;
      canvasT += dt;
      renderCanvas(canvas);
      canvasRAF = requestAnimationFrame(loop);
    }
    canvasRAF = requestAnimationFrame(loop);
  }

  /* ── Build dial tape HTML ── */
  function buildDialTape(stops, activeIdx, fmtFn) {
    return stops.map(function(val, idx) {
      const isMajor  = idx % 2 === 0;
      const isActive = idx === activeIdx;
      let cls = 'evf-dial-stop';
      if (isActive) cls += ' evf-dial-stop--active';
      else if (isMajor) cls += ' evf-dial-stop--major';
      return '<div class="'+cls+'">'
        +'<div class="evf-dial-tick"></div>'
        +'<span class="evf-dial-label">'+esc(fmtFn(val))+'</span>'
        +'</div>';
    }).join('');
  }

  /* Position the tape so the active stop is centred under the needle */
  function dialTranslate(activeIdx, stopWidth, zoneWidth) {
    const offset = (zoneWidth / 2) - (activeIdx * stopWidth) - (stopWidth / 2);
    return offset;
  }

  /* ── EV meter fill ── */
  function evMeterStyle(apIdx, shIdx, isoIdx) {
    const ev      = computeEV(apIdx, shIdx, isoIdx);
    const nominal = 8;
    const delta   = ev - nominal;
    const clamped = Math.max(-2, Math.min(2, delta));
    const pct50   = 50;
    const fillW   = Math.abs(clamped) / 2 * 48;
    if (clamped >= 0) {
      return { left: pct50+'%', width: fillW+'px', transform: 'none' };
    } else {
      return { left: 'calc('+pct50+'% - '+fillW+'px)', width: fillW+'px' };
    }
  }

  /* ── Aperture colour class ── */
  function apColor(ap) {
    return ap <= 4 ? 'evf-readout-value--amber' : '';
  }
  function isoColor(iso) {
    if (iso <= 800) return 'evf-readout-value--green';
    if (iso > 6400) return 'evf-readout-value--warn';
    return '';
  }
  function shColor(sh) {
    return sh && sh <= 1/30 ? 'evf-readout-value--warn' : '';
  }

  /* ── Mode label from preset ── */
  function modeLabel() {
    if (!state.preset) return 'AV';
    const m = (state.preset.sessionOptimization && state.preset.sessionOptimization.exposure
      && state.preset.sessionOptimization.exposure.mode) || '';
    const k = m.toLowerCase().replace(/[^a-z]/g,'');
    if (k==='m'||k==='manual') return 'M';
    if (k==='tv'||k==='s')     return 'Tv';
    if (k==='av'||k==='a')     return 'Av';
    return m.toUpperCase().slice(0,4) || 'AV';
  }

  /* ── DOM refs ── */
  let dom = {};

  function $ (id) { return document.getElementById(id); }
  function $$ (sel) { return document.querySelector(sel); }

  /* ── Build EVF DOM skeleton ── */
  function buildDOM(root) {
    root.classList.add('evf-root');
    document.body.classList.add('evf-active');

    root.innerHTML = `
      <!-- Background canvas -->
      <canvas id="evf-bg"></canvas>

      <!-- Scanlines -->
      <div class="evf-scanlines"></div>

      <!-- Vignette -->
      <div class="evf-vignette"></div>

      <!-- Corner brackets -->
      <div class="evf-corners" aria-hidden="true">
        <div class="evf-corner evf-corner--tl"></div>
        <div class="evf-corner evf-corner--tr"></div>
        <div class="evf-corner evf-corner--bl"></div>
        <div class="evf-corner evf-corner--br"></div>
      </div>

      <!-- AF Reticle -->
      <div class="evf-reticle" aria-hidden="true">
        <div class="evf-reticle__frame"></div>
      </div>

      <!-- Onboarding instruction -->
      <div class="evf-instruction" id="evf-instruction"></div>

      <!-- HUD -->
      <div class="evf-hud" aria-label="Camera HUD">
        <div class="evf-hud-top">
          <div class="evf-hud-left">
            <div class="evf-hud-brand">
              <div class="evf-rec-dot" aria-hidden="true"></div>
              <span class="evf-hud-title">KAMERA QUEST</span>
            </div>
            <div class="evf-hud-lens" id="hud-lens">—</div>
          </div>
          <div class="evf-hud-right">
            <span class="evf-hud-scene" id="hud-scene">—</span>
            <span class="evf-hud-mode" id="hud-mode">AV</span>
          </div>
        </div>
        <div class="evf-hud-mid">
          <!-- Centered action bar: GEAR › SCENE › GENERATE -->
          <div class="evf-action-bar" role="group" aria-label="Workflow steps">
            <button class="evf-pill evf-pill--gear ${state.gearConfirmed?'lit':''}" id="btn-gear" aria-label="Set gear">
              <svg class="evf-pill-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
              </svg>
              <span id="gear-label">${state.gearConfirmed ? esc(state.camera.split(' ').slice(-2).join(' ')) : 'Set Gear'}</span>
            </button>
            <span class="evf-action-arrow" aria-hidden="true">›</span>
            <button class="evf-pill evf-pill--scene ${state.genre?'lit':''}" id="btn-scene" aria-label="Choose scene">
              <span id="scene-label">${state.genre ? esc((GENRE_META[state.genre]||{label:state.genre}).label + (state.condition?' / —':'')) : 'Choose Scene'}</span>
            </button>
            <span class="evf-action-arrow" aria-hidden="true">›</span>
            <button class="evf-pill evf-pill--gen go" id="btn-gen"
              ${(state.gearConfirmed && state.genre && state.condition) ? '' : 'disabled'}
              aria-label="Generate settings">
              Generate →
            </button>
          </div>
        </div>
        <div class="evf-hud-bottom">
          <div class="evf-implication" id="evf-implication" aria-live="polite">
            Choose gear and scene to see live settings.
          </div>
          <!-- Tape strip -->
          <div class="evf-tape-strip" id="evf-tape" role="group" aria-label="Exposure dials">
            <div class="evf-dial-zone ${state.activeDialKey==='ap'?'is-active':''}" id="dial-ap" data-dial="ap" role="slider" aria-label="Aperture" aria-valuemin="0" aria-valuemax="${AP_STOPS.length-1}" aria-valuenow="${state.apIdx}">
              <div class="evf-dial-needle" aria-hidden="true"></div>
              <div class="evf-dial-tape" id="tape-ap">${buildDialTape(AP_STOPS, state.apIdx, fmtAperture)}</div>
              <div class="evf-dial-fade" aria-hidden="true"></div>
            </div>
            <div class="evf-dial-zone ${state.activeDialKey==='sh'?'is-active':''}" id="dial-sh" data-dial="sh" role="slider" aria-label="Shutter speed" aria-valuemin="0" aria-valuemax="${SH_STOPS.length-1}" aria-valuenow="${state.shIdx}">
              <div class="evf-dial-needle" aria-hidden="true"></div>
              <div class="evf-dial-tape" id="tape-sh">${buildDialTape(SH_STOPS, state.shIdx, fmtShutter)}</div>
              <div class="evf-dial-fade" aria-hidden="true"></div>
            </div>
            <div class="evf-dial-zone ${state.activeDialKey==='iso'?'is-active':''}" id="dial-iso" data-dial="iso" role="slider" aria-label="ISO" aria-valuemin="0" aria-valuemax="${ISO_STOPS.length-1}" aria-valuenow="${state.isoIdx}">
              <div class="evf-dial-needle" aria-hidden="true"></div>
              <div class="evf-dial-tape" id="tape-iso">${buildDialTape(ISO_STOPS, state.isoIdx, fmtISO)}</div>
              <div class="evf-dial-fade" aria-hidden="true"></div>
            </div>
          </div>
          <!-- Readout strip -->
          <div class="evf-readout-strip" id="evf-readout" role="group" aria-label="Settings readout">
            <div class="evf-readout-cell ${state.activeDialKey==='ap'?'is-active':''}" id="cell-ap" data-cell="ap" role="button" tabindex="0" aria-label="Aperture">
              <span class="evf-readout-head">APERTURE</span>
              <span class="evf-readout-value ${apColor(AP_STOPS[state.apIdx])}" id="rv-ap">${esc(fmtAperture(AP_STOPS[state.apIdx]))}</span>
              <span class="evf-readout-sub" id="rs-ap">${apSub(AP_STOPS[state.apIdx])}</span>
            </div>
            <div class="evf-readout-cell ${state.activeDialKey==='sh'?'is-active':''}" id="cell-sh" data-cell="sh" role="button" tabindex="0" aria-label="Shutter speed">
              <span class="evf-readout-head">SHUTTER</span>
              <span class="evf-readout-value ${shColor(SH_STOPS[state.shIdx])}" id="rv-sh">${esc(fmtShutter(SH_STOPS[state.shIdx]))}</span>
              <span class="evf-readout-sub" id="rs-sh">${shSub(SH_STOPS[state.shIdx])}</span>
            </div>
            <div class="evf-readout-cell ${state.activeDialKey==='iso'?'is-active':''}" id="cell-iso" data-cell="iso" role="button" tabindex="0" aria-label="ISO">
              <span class="evf-readout-head">ISO</span>
              <span class="evf-readout-value ${isoColor(ISO_STOPS[state.isoIdx])}" id="rv-iso">${esc(fmtISO(ISO_STOPS[state.isoIdx]))}</span>
              <span class="evf-readout-sub" id="rs-iso">${isoSub(ISO_STOPS[state.isoIdx])}</span>
            </div>
            <div class="evf-readout-cell" id="cell-mode">
              <span class="evf-readout-head">MODE</span>
              <span class="evf-readout-value" id="rv-mode" style="font-size:17px;">${esc(modeLabel())}</span>
              <span class="evf-readout-sub" id="rs-mode">${modeSub(modeLabel())}</span>
            </div>
            <div class="evf-readout-cell" id="cell-ev" aria-label="Exposure value meter">
              <span class="evf-readout-head">EV</span>
              <div class="evf-ev-meter" id="ev-meter" aria-hidden="true">
                <div class="evf-ev-center"></div>
                <div class="evf-ev-fill" id="ev-fill"></div>
              </div>
              <span class="evf-readout-sub" id="rs-ev">±0 EV</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Scene overlay -->
      <div class="evf-overlay-backdrop" id="scene-overlay" role="dialog" aria-label="Choose scene" aria-modal="true">
        <div class="evf-overlay-dim" id="scene-dim" aria-hidden="true"></div>
        <div class="evf-scene-panel" id="scene-panel">
          <div class="evf-ov-head">
            <span class="evf-ov-title">SCENE</span>
            <button class="evf-ov-close" id="scene-close" aria-label="Close scene panel">CLOSE ×</button>
          </div>
          <div id="scene-genre-grid" class="evf-genre-grid"></div>
          <div id="scene-condition-section" class="evf-condition-section" style="display:none"></div>
        </div>
      </div>

      <!-- Gear overlay -->
      <div class="evf-gear-backdrop" id="gear-overlay" role="dialog" aria-label="Gear settings" aria-modal="true">
        <div class="evf-gear-dim" id="gear-dim" aria-hidden="true"></div>
        <div class="evf-gear-panel" id="gear-panel">
          <div class="evf-ov-head">
            <span class="evf-ov-title">GEAR</span>
            <button class="evf-ov-close" id="gear-close" aria-label="Close gear panel">CLOSE ×</button>
          </div>

          <div class="evf-gear-field">
            <span class="evf-gear-label">Brand</span>
            <div class="evf-brand-grid" id="gear-brand-grid"></div>
          </div>

          <div class="evf-gear-field">
            <span class="evf-gear-label">Body</span>
            <select class="evf-gear-select" id="gear-body"></select>
            <span class="evf-gear-spec" id="gear-body-spec">Select a body to preview sensor details.</span>
          </div>

          <div class="evf-gear-field">
            <span class="evf-gear-label">Lens</span>
            <select class="evf-gear-select" id="gear-lens" disabled></select>
            <span class="evf-gear-spec" id="gear-lens-spec">Select a body first.</span>
          </div>

          <div class="evf-gear-field">
            <span class="evf-gear-label">Skill Level</span>
            <div class="evf-skill-row" id="gear-skill-row"></div>
          </div>

          <button class="evf-gear-confirm" id="gear-confirm" disabled>Confirm gear</button>
        </div>
      </div>

      <!-- Brief overlay -->
      <div class="evf-brief-backdrop" id="brief-overlay" role="dialog" aria-label="Session brief" aria-modal="true">
        <div class="evf-brief-dim" id="brief-dim" aria-hidden="true"></div>
        <div class="evf-brief-panel" id="brief-panel">
          <div class="evf-ov-head">
            <span class="evf-ov-title">SESSION BRIEF</span>
            <button class="evf-ov-close" id="brief-close" aria-label="Close brief">CLOSE ×</button>
          </div>
          <div class="evf-brief-grid" id="brief-grid"></div>
        </div>
      </div>

      <!-- Generating overlay -->
      <div class="evf-generating" id="evf-generating" aria-live="polite">
        <div class="evf-state-spinner"></div>
        <span class="evf-generating-label">BUILDING SESSION</span>
      </div>

      <!-- Error toast -->
      <div class="evf-toast" id="evf-toast" role="alert" aria-live="assertive"></div>
    `;

    // cache DOM refs
    dom.canvas        = $('evf-bg');
    dom.hudLens       = $('hud-lens');
    dom.hudScene      = $('hud-scene');
    dom.hudMode       = $('hud-mode');
    dom.implication   = $('evf-implication');
    dom.tapes         = { ap: $('tape-ap'), sh: $('tape-sh'), iso: $('tape-iso') };
    dom.dialZones     = { ap: $('dial-ap'), sh: $('dial-sh'), iso: $('dial-iso') };
    dom.cells         = { ap: $('cell-ap'), sh: $('cell-sh'), iso: $('cell-iso'), mode: $('cell-mode'), ev: $('cell-ev') };
    dom.rvAp          = $('rv-ap');
    dom.rvSh          = $('rv-sh');
    dom.rvIso         = $('rv-iso');
    dom.rvMode        = $('rv-mode');
    dom.rsAp          = $('rs-ap');
    dom.rsSh          = $('rs-sh');
    dom.rsIso         = $('rs-iso');
    dom.rsMode        = $('rs-mode');
    dom.rsEv          = $('rs-ev');
    dom.evFill        = $('ev-fill');
    dom.btnGear       = $('btn-gear');
    dom.gearLabel     = $('gear-label');
    dom.btnScene      = $('btn-scene');
    dom.sceneLabel    = $('scene-label');
    dom.btnGen        = $('btn-gen');
    dom.sceneOverlay  = $('scene-overlay');
    dom.sceneDim      = $('scene-dim');
    dom.scenePanel    = $('scene-panel');
    dom.sceneClose    = $('scene-close');
    dom.sceneGenreGrid= $('scene-genre-grid');
    dom.sceneCondSec  = $('scene-condition-section');
    dom.gearOverlay   = $('gear-overlay');
    dom.gearDim       = $('gear-dim');
    dom.gearPanel     = $('gear-panel');
    dom.gearClose     = $('gear-close');
    dom.gearBrandGrid = $('gear-brand-grid');
    dom.gearBody      = $('gear-body');
    dom.gearBodySpec  = $('gear-body-spec');
    dom.gearLens      = $('gear-lens');
    dom.gearLensSpec  = $('gear-lens-spec');
    dom.gearSkillRow  = $('gear-skill-row');
    dom.gearConfirm   = $('gear-confirm');
    dom.briefOverlay  = $('brief-overlay');
    dom.briefDim      = $('brief-dim');
    dom.briefPanel    = $('brief-panel');
    dom.briefClose    = $('brief-close');
    dom.briefGrid     = $('brief-grid');
    dom.generating    = $('evf-generating');
    dom.toast         = $('evf-toast');
    dom.instruction   = $('evf-instruction');
  }

  /* ── Onboarding instruction ── */
  function updateInstruction() {
    const el = dom.instruction;
    if (!el) return;
    if (!state.gearConfirmed) {
      el.innerHTML = '<span class="evf-instruction-text">TAP <b>SET GEAR</b> ↗ TO BEGIN</span>';
      el.style.opacity = '1';
    } else if (!state.genre || !state.condition) {
      el.innerHTML = '<span class="evf-instruction-text">← TAP <b>SCENE</b> TO CHOOSE YOUR CONDITIONS</span>';
      el.style.opacity = '1';
    } else if (!state.preset) {
      el.innerHTML = '<span class="evf-instruction-text">TAP <b>GENERATE →</b> FOR YOUR SETTINGS ↘</span>';
      el.style.opacity = '1';
    } else {
      el.style.opacity = '0';
    }
  }

  /* ── Update HUD ── */
  function updateHUD() {
    const ap  = AP_STOPS[state.apIdx];
    const sh  = SH_STOPS[state.shIdx];
    const iso = ISO_STOPS[state.isoIdx];

    // Implication
    dom.implication.innerHTML = buildImplication();

    // Readout values
    dom.rvAp.textContent  = fmtAperture(ap);
    dom.rvAp.className    = 'evf-readout-value ' + apColor(ap);
    dom.rvSh.textContent  = fmtShutter(sh);
    dom.rvSh.className    = 'evf-readout-value ' + shColor(sh);
    dom.rvIso.textContent = fmtISO(iso);
    dom.rvIso.className   = 'evf-readout-value ' + isoColor(iso);
    dom.rvMode.textContent= modeLabel();
    dom.rsAp.textContent  = apSub(ap);
    dom.rsSh.textContent  = shSub(sh);
    dom.rsIso.textContent = isoSub(iso);
    dom.rsMode.textContent= modeSub(modeLabel());

    // EV meter
    const ev      = computeEV(state.apIdx, state.shIdx, state.isoIdx);
    const nominal = 8;
    const delta   = ev - nominal;
    const clamped = Math.max(-2, Math.min(2, delta));
    const pct     = ((clamped + 2) / 4) * 100;
    const fillW   = Math.abs(clamped) / 2 * 34;
    const center  = 50;
    if (clamped >= 0) {
      dom.evFill.style.left  = center+'%';
      dom.evFill.style.width = fillW+'px';
    } else {
      dom.evFill.style.left  = 'calc('+center+'% - '+fillW+'px)';
      dom.evFill.style.width = fillW+'px';
    }
    dom.rsEv.textContent = (delta > 0.15 ? '+' : '') + (Math.abs(delta) < 0.15 ? '±0' : delta.toFixed(1)) + ' EV';

    // HUD labels
    dom.hudLens.textContent  = state.lens  || (state.gearConfirmed ? state.camera : '—');
    dom.hudScene.textContent = state.genre
      ? ((GENRE_META[state.genre]||{label:state.genre}).label + (state.condition ? ' / ' + state.condition : ''))
      : '—';
    dom.hudMode.textContent  = modeLabel();

    // Active cell highlight
    Object.keys(dom.cells).forEach(function(k) {
      dom.cells[k].classList.toggle('is-active', k === state.activeDialKey);
    });

    // Active dial zone highlight
    Object.keys(dom.dialZones).forEach(function(k) {
      dom.dialZones[k].classList.toggle('is-active', k === state.activeDialKey);
    });

    // ARIA
    if(dom.dialZones.ap) dom.dialZones.ap.setAttribute('aria-valuenow', state.apIdx);
    if(dom.dialZones.sh) dom.dialZones.sh.setAttribute('aria-valuenow', state.shIdx);
    if(dom.dialZones.iso) dom.dialZones.iso.setAttribute('aria-valuenow', state.isoIdx);

    // Gear/scene pills
    dom.btnGear.classList.toggle('lit', state.gearConfirmed);
    dom.gearLabel.textContent = state.gearConfirmed
      ? (state.camera || 'Gear set')
      : 'Set Gear';

    dom.btnScene.classList.toggle('lit', !!(state.genre));
    dom.sceneLabel.textContent = state.genre
      ? ((GENRE_META[state.genre]||{label:state.genre}).label + (state.condition ? ' / ' + state.condition.replace(/[_-]/g,' ') : ''))
      : 'Scene';

    const canGenerate = state.gearConfirmed && state.genre && state.condition;
    dom.btnGen.disabled = !canGenerate;

    updateInstruction();
  }

  /* ── Update tape ── */
  function repositionTape(key) {
    const tape = dom.tapes[key];
    const zone = dom.dialZones[key];
    if (!tape || !zone) return;

    const stops = key==='ap' ? AP_STOPS : key==='sh' ? SH_STOPS : ISO_STOPS;
    const fmtFn = key==='ap' ? fmtAperture : key==='sh' ? fmtShutter : fmtISO;
    const idx   = key==='ap' ? state.apIdx  : key==='sh' ? state.shIdx  : state.isoIdx;
    const STOP_W= 38;

    tape.innerHTML = buildDialTape(stops, idx, fmtFn);
    const zoneW = zone.offsetWidth || (window.innerWidth / 3);
    const tx    = dialTranslate(idx, STOP_W, zoneW);
    tape.style.transform = 'translateX('+tx+'px)';
    tape.style.left = '0';
  }

  function repositionAllTapes() {
    repositionTape('ap');
    repositionTape('sh');
    repositionTape('iso');
  }

  /* ── Dial drag interaction ── */
  let drag = null;

  function dialPointerDown(e, key) {
    e.preventDefault();
    state.activeDialKey = key;
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    drag = {
      key:      key,
      startX:   cx,
      startIdx: key==='ap' ? state.apIdx : key==='sh' ? state.shIdx : state.isoIdx,
    };
  }

  function dialPointerMove(e) {
    if (!drag) return;
    e.preventDefault();
    const cx  = e.touches ? e.touches[0].clientX : e.clientX;
    const delta = Math.round((drag.startX - cx) / 38);
    const key = drag.key;
    const stops = key==='ap' ? AP_STOPS : key==='sh' ? SH_STOPS : ISO_STOPS;
    const newIdx = Math.max(0, Math.min(stops.length-1, drag.startIdx + delta));

    if (key==='ap')  state.apIdx  = newIdx;
    if (key==='sh')  state.shIdx  = newIdx;
    if (key==='iso') state.isoIdx = newIdx;

    repositionTape(key);
    updateHUD();
  }

  function dialPointerUp() { drag = null; }

  function bindDialEvents() {
    ['ap','sh','iso'].forEach(function(key) {
      const zone = dom.dialZones[key];
      if (!zone) return;
      zone.addEventListener('mousedown',  function(e){ dialPointerDown(e,key); });
      zone.addEventListener('touchstart', function(e){ dialPointerDown(e,key); }, {passive:false});
    });
    document.addEventListener('mousemove',  dialPointerMove);
    document.addEventListener('touchmove',  dialPointerMove, {passive:false});
    document.addEventListener('mouseup',    dialPointerUp);
    document.addEventListener('touchend',   dialPointerUp);
  }

  /* ── Readout cell click → set active dial ── */
  function bindReadoutEvents() {
    ['ap','sh','iso'].forEach(function(key) {
      const cell = dom.cells[key];
      if (!cell) return;
      cell.addEventListener('click', function() {
        state.activeDialKey = key;
        updateHUD();
      });
      cell.addEventListener('keydown', function(e) {
        if (e.key==='Enter'||e.key===' ') { state.activeDialKey=key; updateHUD(); }
      });
    });
  }

  /* ── Keyboard ── */
  function bindKeyboard() {
    document.addEventListener('keydown', function(e) {
      if (state.sceneOpen || state.gearOpen || state.briefOpen) {
        if (e.key==='Escape') closeAllOverlays();
        return;
      }
      if (e.key==='1') { state.activeDialKey='ap';  updateHUD(); }
      if (e.key==='2') { state.activeDialKey='sh';  updateHUD(); }
      if (e.key==='3') { state.activeDialKey='iso'; updateHUD(); }
      if (e.key==='Escape') closeAllOverlays();

      if (e.key==='ArrowLeft' || e.key==='ArrowRight') {
        e.preventDefault();
        const key = state.activeDialKey;
        if (key==='ap') {
          state.apIdx = Math.max(0, Math.min(AP_STOPS.length-1, state.apIdx + (e.key==='ArrowRight'?1:-1)));
        } else if (key==='sh') {
          state.shIdx = Math.max(0, Math.min(SH_STOPS.length-1, state.shIdx + (e.key==='ArrowRight'?1:-1)));
        } else {
          state.isoIdx = Math.max(0, Math.min(ISO_STOPS.length-1, state.isoIdx + (e.key==='ArrowRight'?1:-1)));
        }
        repositionTape(key);
        updateHUD();
      }
    });
  }

  /* ── Overlays ── */
  function closeAllOverlays() {
    state.sceneOpen = false;
    state.gearOpen  = false;
    state.briefOpen = false;
    if (dom.sceneOverlay) dom.sceneOverlay.classList.remove('open');
    if (dom.gearOverlay)  dom.gearOverlay.classList.remove('open');
    if (dom.briefOverlay) dom.briefOverlay.classList.remove('open');
  }

  function openSceneOverlay() {
    closeAllOverlays();
    state.sceneOpen = true;
    renderScenePanel();
    dom.sceneOverlay.classList.add('open');
  }

  function openGearOverlay() {
    closeAllOverlays();
    state.gearOpen = true;
    renderGearPanel();
    dom.gearOverlay.classList.add('open');
  }

  function openBriefOverlay() {
    if (!state.preset) return;
    closeAllOverlays();
    state.briefOpen = true;
    renderBriefPanel();
    dom.briefOverlay.classList.add('open');
    // Animate confidence bar after paint
    setTimeout(function() {
      const fill = document.querySelector('.evf-confidence-fill');
      if (!fill) return;
      const score = Number(fill.dataset.score) || 0;
      fill.style.width = score + '%';
    }, 60);
  }

  /* ── Scene panel ── */
  function renderScenePanel() {
    // Genre chips
    const genreKeys = Object.keys(GENRE_META);
    const primary   = PRIMARY_GENRES.filter(function(k){ return genreKeys.indexOf(k)!==-1; });
    const extras    = genreKeys.filter(function(k){ return PRIMARY_GENRES.indexOf(k)===-1; });
    const all       = primary.concat(extras);

    dom.sceneGenreGrid.innerHTML = all.map(function(k) {
      const info = GENRE_META[k] || {label:k};
      return '<button class="evf-genre-chip'+(state.genre===k?' is-active':'')+'" data-genre="'+esc(k)+'" aria-pressed="'+(state.genre===k)+'">'
        + esc(info.icon||'•') + ' ' + esc(info.label)
        + '</button>';
    }).join('');

    renderConditionSection();
  }

  function renderConditionSection() {
    if (!state.genre || !cache.meta || !cache.meta[state.genre]) {
      dom.sceneCondSec.style.display = 'none';
      return;
    }
    const conditions = cache.meta[state.genre] || [];
    dom.sceneCondSec.style.display = '';
    dom.sceneCondSec.innerHTML = '<div class="evf-condition-label">CONDITION</div>'
      + '<div class="evf-condition-grid">'
      + conditions.map(function(item) {
          const active = item.key === state.condition;
          return '<button class="evf-condition-chip'+(active?' is-active':'')+'"'
            +' data-condition="'+esc(item.key)+'"'
            +' aria-pressed="'+active+'">'
            + esc(item.displayName || item.key)
            + '</button>';
        }).join('')
      + '</div>';
  }

  /* ── Gear panel ── */
  function renderGearPanel() {
    // Brand tiles
    dom.gearBrandGrid.innerHTML = Object.keys(BRAND_META).map(function(bk) {
      const bm = BRAND_META[bk];
      return '<button class="evf-brand-tile'+(state.brand===bk?' is-active':'')+'" data-brand="'+esc(bk)+'" aria-pressed="'+(state.brand===bk)+'">'
        +'<span class="evf-brand-name">'+esc(bm.label)+'</span>'
        +'<span class="evf-brand-mount">'+esc(bm.mount)+'</span>'
        +'</button>';
    }).join('');

    // Skill row
    dom.gearSkillRow.innerHTML = Object.keys(MODE_META).map(function(mk) {
      const mm = MODE_META[mk];
      return '<button class="evf-skill-btn'+(state.mode===mk?' is-active':'')+'" data-skill="'+esc(mk)+'" aria-pressed="'+(state.mode===mk)+'">'+esc(mm.label)+'</button>';
    }).join('');

    refreshBodySelect();
    refreshLensSelect();
    refreshGearConfirm();
  }

  function refreshBodySelect() {
    dom.gearBody.innerHTML = '';
    if (!state.brand || !cache.cameras) {
      dom.gearBody.innerHTML = '<option value="">'+(state.brand ? 'Loading…' : 'Choose brand first')+'</option>';
      dom.gearBody.disabled = true;
      dom.gearBodySpec.textContent = state.brand ? '' : 'Select a brand to see bodies.';
      return;
    }
    dom.gearBody.disabled = false;
    const bodies = (cache.cameras && cache.cameras.cameras) || [];
    dom.gearBody.innerHTML = '<option value="">Select body…</option>'
      + bodies.map(function(b) {
          return '<option value="'+esc(b.modelName)+'"'+(state.camera===b.modelName?' selected':'')+'>'+esc(b.modelName)+'</option>';
        }).join('');
    updateBodySpec();
  }

  function updateBodySpec() {
    if (!state.camera || !cache.cameras) {
      dom.gearBodySpec.textContent = 'Select a body to see sensor details.';
      return;
    }
    const bodies = (cache.cameras && cache.cameras.cameras) || [];
    const cam = bodies.find(function(b){ return b.modelName===state.camera; });
    if (!cam) { dom.gearBodySpec.textContent = ''; return; }
    dom.gearBodySpec.textContent = [
      cam.sensorFormat || cam.sensorType || '',
      cam.effectiveMegapixels ? cam.effectiveMegapixels+'MP' : '',
      cam.IBIS ? 'IBIS' : 'No IBIS',
    ].filter(Boolean).join(' · ');
  }

  function refreshLensSelect() {
    dom.gearLens.innerHTML = '';
    if (!state.camera || !cache.lenses) {
      dom.gearLens.innerHTML = '<option value="">'+(state.camera ? 'Loading…' : 'Choose body first')+'</option>';
      dom.gearLens.disabled = true;
      dom.gearLensSpec.textContent = state.camera ? '' : 'Select a body first.';
      return;
    }
    dom.gearLens.disabled = false;
    const lenses = (cache.lenses && cache.lenses.lenses) || [];
    dom.gearLens.innerHTML = '<option value="">Select lens…</option>'
      + lenses.map(function(l) {
          return '<option value="'+esc(l.lensName)+'"'+(state.lens===l.lensName?' selected':'')+'>'+esc(l.lensName)+'</option>';
        }).join('');
    updateLensSpec();
  }

  function updateLensSpec() {
    if (!state.lens || !cache.lenses) {
      dom.gearLensSpec.textContent = 'Select a lens to see aperture and focal range.';
      return;
    }
    const lenses = (cache.lenses && cache.lenses.lenses) || [];
    const lens = lenses.find(function(l){ return l.lensName===state.lens; });
    if (!lens) { dom.gearLensSpec.textContent=''; return; }
    const focal = lens.minFocalLength===lens.maxFocalLength
      ? lens.minFocalLength+'mm'
      : (lens.minFocalLength+'-'+lens.maxFocalLength+'mm');
    const ap = lens.maxApertureAtTele && Number(lens.maxApertureAtTele)!==Number(lens.maxAperture)
      ? 'f/'+lens.maxAperture+'-'+lens.maxApertureAtTele
      : 'f/'+lens.maxAperture;
    dom.gearLensSpec.textContent = [ap, focal, lens.hasOIS?'OIS':'No OIS'].filter(Boolean).join(' · ');
  }

  function refreshGearConfirm() {
    dom.gearConfirm.disabled = !(state.brand && state.camera && state.lens);
  }

  /* ── Brief panel ── */
  function buildConfidenceScore(validity) {
    const checks = validity && validity.checks ? validity.checks : [];
    if (!checks.length) return 83;
    const weights = { gearlimits:0.32, exposurebaseline:0.26, colorandrepeatability:0.14, colorcontrol:0.14 };
    let w=0, tw=0;
    checks.forEach(function(c) {
      const key = (c.label||'').toLowerCase().replace(/[^a-z]/g,'');
      const weight = weights[key] || 0.1;
      const score = c.confidence==='high'?92:c.confidence==='mediumhigh'?84:c.confidence==='medium'?72:58;
      w += score * weight; tw += weight;
    });
    return Math.round(w/(tw||1));
  }

  function renderBriefPanel() {
    const preset  = state.preset;
    if (!preset) return;
    const session = preset.sessionOptimization || {};
    const briefing= session.briefing || {};
    const validity= session.validity  || {};
    const exposure= session.exposure  || {};
    const focus   = session.focus     || {};
    const stab    = session.stabilization || {};
    const mode    = (exposure.mode||'').replace(/[^a-zA-Z]/g,'') || '?';
    const confidence = buildConfidenceScore(validity);

    const ap  = AP_STOPS[state.apIdx];
    const sh  = SH_STOPS[state.shIdx];
    const iso = ISO_STOPS[state.isoIdx];

    // Primary actions
    const primaryActions = (briefing.primaryActions||session.checklist||[]).slice(0,5);
    // Watchouts
    const watchouts = (briefing.watchouts||session.caveats||[]).slice(0,4);

    dom.briefGrid.innerHTML = `
      <div class="evf-brief-settings">
        <div class="evf-brief-setting-row">
          <span class="evf-brief-setting-label">APERTURE</span>
          <span class="evf-brief-setting-value evf-brief-setting-value--ap">${esc(fmtAperture(ap))}</span>
        </div>
        <div class="evf-brief-setting-row">
          <span class="evf-brief-setting-label">SHUTTER</span>
          <span class="evf-brief-setting-value">${esc(fmtShutter(sh))}</span>
        </div>
        <div class="evf-brief-setting-row">
          <span class="evf-brief-setting-label">ISO</span>
          <span class="evf-brief-setting-value">${esc(String(iso))}</span>
        </div>
        <div class="evf-brief-setting-row">
          <span class="evf-brief-setting-label">MODE</span>
          <span class="evf-brief-setting-value" style="font-size:22px">${esc(mode.toUpperCase().slice(0,4))}</span>
        </div>
        <div class="evf-confidence-bar-wrap">
          <div class="evf-confidence-bar-label">MATCH</div>
          <div class="evf-confidence-track">
            <div class="evf-confidence-fill" data-score="${confidence}" style="width:0%"></div>
          </div>
          <div style="font-family:'Share Tech Mono',monospace;font-size:9px;color:rgba(240,168,40,0.7);margin-top:3px">${confidence}%</div>
        </div>
      </div>

      <div class="evf-brief-main">
        <h2 class="evf-brief-title">${esc(briefing.heading || (((GENRE_META[state.genre]||{label:state.genre}).label)+' Brief'))}</h2>
        <p class="evf-brief-subtitle">${esc(state.genre ? (GENRE_META[state.genre]||{label:state.genre}).label : '') + (state.condition ? ' / ' + state.condition.replace(/[_-]/g,' ') : '')}</p>
        <p class="evf-brief-coach">${esc(briefing.coachTip || preset.proTip || 'Use this as a disciplined starting point. Validate on the first frames and adjust from the scene.')}</p>
        ${primaryActions.length ? `
          <div class="evf-brief-steps">
            ${primaryActions.map(function(step,i) {
              return '<div class="evf-brief-step">'
                +'<span class="evf-brief-step-num">0'+(i+1)+'</span>'
                +'<span class="evf-brief-step-text">'+esc(step)+'</span>'
                +'</div>';
            }).join('')}
          </div>
        ` : ''}
      </div>

      <div class="evf-brief-tech">
        <div class="evf-brief-tech-block">
          <div class="evf-brief-tech-label">EXPOSURE</div>
          <div class="evf-brief-tech-text">${esc(mode+' · '+fmtAperture(ap)+' · '+fmtShutter(sh)+' · ISO '+iso)}</div>
        </div>
        <div class="evf-brief-tech-block">
          <div class="evf-brief-tech-label">FOCUS MODE</div>
          <div class="evf-brief-tech-text">${esc([focus.autofocusMode, focus.focusArea].filter(Boolean).join(' · ') || '—')}</div>
        </div>
        <div class="evf-brief-tech-block">
          <div class="evf-brief-tech-label">WHITE BALANCE</div>
          <div class="evf-brief-tech-text">${esc(exposure.whiteBalance || '—')}</div>
        </div>
        <div class="evf-brief-tech-block">
          <div class="evf-brief-tech-label">STABILISATION</div>
          <div class="evf-brief-tech-text">${esc(stab.staticHandheldFloor ? 'Handheld floor: '+stab.staticHandheldFloor : (stab.support || '—'))}</div>
        </div>
        ${watchouts.length ? `
          <div class="evf-brief-tech-block">
            <div class="evf-brief-tech-label">WATCH FOR</div>
            <div class="evf-brief-risks">
              ${watchouts.map(function(w) {
                return '<div class="evf-brief-risk"><div class="evf-risk-dot"></div><span class="evf-risk-text">'+esc(w)+'</span></div>';
              }).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  /* ── API helpers ── */
  async function fetchJson(endpoint, init) {
    const resp = await fetch(API_BASE + endpoint, init);
    const data = await resp.json().catch(function(){ return null; });
    if (!resp.ok) {
      throw new Error(data && data.error && data.error.message ? data.error.message
        : data && data.message ? data.message : 'Request failed: '+resp.status);
    }
    return data;
  }

  async function ensureMeta() {
    if (cache.meta) return cache.meta;
    cache.meta = await fetchJson('/presets/meta');
    return cache.meta;
  }

  async function ensureCameras(brand) {
    if (cache.brandKey===brand && cache.cameras) return cache.cameras;
    cache.cameras  = await fetchJson('/cameras/'+encodeURIComponent(brand));
    cache.brandKey = brand;
    return cache.cameras;
  }

  async function ensureLenses(brand, camera) {
    const k = brand+'::'+camera;
    if (cache.cameraKey===k && cache.lenses) return cache.lenses;
    cache.lenses   = await fetchJson('/cameras/'+encodeURIComponent(brand)+'/'+encodeURIComponent(camera)+'/lenses');
    cache.cameraKey = k;
    return cache.lenses;
  }

  /* ── Show toast ── */
  let toastTimer = null;
  function showToast(msg) {
    dom.toast.textContent = msg;
    dom.toast.classList.add('visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ dom.toast.classList.remove('visible'); }, 4000);
  }

  /* ── Wire up overlay events ── */
  function bindOverlayEvents() {
    // Scene
    dom.btnScene.addEventListener('click', openSceneOverlay);
    dom.sceneClose.addEventListener('click', closeAllOverlays);
    dom.sceneDim.addEventListener('click', closeAllOverlays);

    // scene genre click
    dom.sceneGenreGrid.addEventListener('click', function(e) {
      const btn = e.target.closest('[data-genre]');
      if (!btn) return;
      const g = btn.getAttribute('data-genre');
      state.genre = g;
      state.condition = '';
      persistScene();
      updateHUD();
      // Update chip states
      dom.sceneGenreGrid.querySelectorAll('[data-genre]').forEach(function(b) {
        b.classList.toggle('is-active', b.getAttribute('data-genre')===g);
        b.setAttribute('aria-pressed', b.getAttribute('data-genre')===g);
      });
      // Load conditions
      ensureMeta().then(function() {
        renderConditionSection();
      }).catch(function(){});
    });

    // scene condition click (delegated)
    dom.sceneCondSec.addEventListener('click', function(e) {
      const btn = e.target.closest('[data-condition]');
      if (!btn) return;
      const c = btn.getAttribute('data-condition');
      state.condition = c;
      persistScene();
      updateHUD();
      dom.sceneCondSec.querySelectorAll('[data-condition]').forEach(function(b) {
        b.classList.toggle('is-active', b.getAttribute('data-condition')===c);
        b.setAttribute('aria-pressed', b.getAttribute('data-condition')===c);
      });
    });

    // Gear
    dom.btnGear.addEventListener('click', function() {
      openGearOverlay();
      if (state.brand) {
        ensureCameras(state.brand).then(function() {
          refreshBodySelect();
          if (state.camera) {
            return ensureLenses(state.brand, state.camera);
          }
        }).then(function() {
          if (state.camera) refreshLensSelect();
        }).catch(function(){});
      }
    });
    dom.gearClose.addEventListener('click', closeAllOverlays);
    dom.gearDim.addEventListener('click', closeAllOverlays);

    dom.gearBrandGrid.addEventListener('click', function(e) {
      const btn = e.target.closest('[data-brand]');
      if (!btn) return;
      const b = btn.getAttribute('data-brand');
      if (b !== state.brand) {
        state.brand  = b;
        state.camera = '';
        state.lens   = '';
        cache.cameras = null;
        cache.lenses  = null;
      }
      dom.gearBrandGrid.querySelectorAll('[data-brand]').forEach(function(tb) {
        tb.classList.toggle('is-active', tb.getAttribute('data-brand')===b);
        tb.setAttribute('aria-pressed', tb.getAttribute('data-brand')===b);
      });
      dom.gearBody.innerHTML = '<option>Loading…</option>';
      dom.gearBody.disabled = true;
      dom.gearLens.innerHTML = '<option>Choose body first</option>';
      dom.gearLens.disabled = true;
      refreshGearConfirm();
      ensureCameras(b).then(function() {
        refreshBodySelect();
      }).catch(function(err){ showToast(err.message||'Could not load cameras'); });
    });

    dom.gearBody.addEventListener('change', function() {
      state.camera = dom.gearBody.value;
      state.lens   = '';
      cache.lenses = null;
      updateBodySpec();
      dom.gearLens.innerHTML = '<option>Loading…</option>';
      dom.gearLens.disabled = true;
      refreshGearConfirm();
      if (!state.camera) return;
      ensureLenses(state.brand, state.camera).then(function() {
        refreshLensSelect();
      }).catch(function(err){ showToast(err.message||'Could not load lenses'); });
    });

    dom.gearLens.addEventListener('change', function() {
      state.lens = dom.gearLens.value;
      updateLensSpec();
      refreshGearConfirm();
    });

    dom.gearSkillRow.addEventListener('click', function(e) {
      const btn = e.target.closest('[data-skill]');
      if (!btn) return;
      state.mode = btn.getAttribute('data-skill');
      dom.gearSkillRow.querySelectorAll('[data-skill]').forEach(function(b) {
        b.classList.toggle('is-active', b.getAttribute('data-skill')===state.mode);
        b.setAttribute('aria-pressed', b.getAttribute('data-skill')===state.mode);
      });
    });

    dom.gearConfirm.addEventListener('click', function() {
      if (!(state.brand && state.camera && state.lens)) return;
      state.gearConfirmed = true;
      persistBuilder();
      closeAllOverlays();
      updateHUD();
    });

    // Generate
    dom.btnGen.addEventListener('click', generateSession);

    // Brief
    dom.briefClose.addEventListener('click', closeAllOverlays);
    dom.briefDim.addEventListener('click', closeAllOverlays);
  }

  /* ── Generate ── */
  async function generateSession() {
    if (!(state.gearConfirmed && state.genre && state.condition)) return;
    if (state.generating) return;
    state.generating = true;
    dom.generating.classList.add('visible');

    try {
      const payload = await fetchJson('/presets/classic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand:       state.brand,
          cameraModel: state.camera,
          lensName:    state.lens,
          genre:       state.genre,
          condition:   state.condition,
          mode:        state.mode,
        }),
      });

      const preset = payload && payload.preset ? payload : { preset: payload };
      writeSt(STORAGE_KEY, {
        requestedAt: new Date().toISOString(),
        request: {
          brand: state.brand, cameraModel: state.camera, lensName: state.lens,
          genre: state.genre, condition: state.condition, mode: state.mode,
        },
        response: preset,
      });

      state.preset = preset.preset || payload;
      applyPresetToState(state.preset);

      state.generating = false;
      dom.generating.classList.remove('visible');

      repositionAllTapes();
      updateHUD();
      openBriefOverlay();
    } catch (err) {
      state.generating = false;
      dom.generating.classList.remove('visible');
      showToast(err && err.message ? err.message : 'Unable to build settings right now. Try again.');
    }
  }

  /* ── Canvas resize ── */
  function onResize() {
    if (dom.canvas) {
      dom.canvas.width  = window.innerWidth;
      dom.canvas.height = window.innerHeight;
    }
    repositionAllTapes();
  }

  /* ── Init ── */
  function init() {
    const root = document.getElementById('root');
    if (!root) return;

    // Load persisted state
    loadPersistedState();

    // Build DOM
    buildDOM(root);

    // Start canvas loop
    startCanvasLoop(dom.canvas);

    // Populate scene overlay from cached meta if available
    ensureMeta().then(function() {
      renderScenePanel();
      renderConditionSection();
    }).catch(function(){});

    // Initial tape positions
    requestAnimationFrame(function() {
      repositionAllTapes();
      updateHUD();
    });

    // Event bindings
    bindDialEvents();
    bindReadoutEvents();
    bindOverlayEvents();
    bindKeyboard();

    // If gear is confirmed, prime camera/lens caches silently
    if (state.brand) {
      ensureCameras(state.brand).catch(function(){});
      if (state.camera) ensureLenses(state.brand, state.camera).catch(function(){});
    }

    // If we have a preset from storage, allow brief open immediately
    if (state.preset) updateHUD();

    // Resize
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', function() {
      setTimeout(onResize, 120);
    });
  }

  /* ── Boot ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
