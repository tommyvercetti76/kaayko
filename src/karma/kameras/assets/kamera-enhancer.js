(function () {
  const STORAGE_KEY = 'kameraQuest:lastClassicPreset';
  const BUILDER_KEY = 'kameraQuest:builderState';
  const SCENE_KEY = 'kameraQuest:sceneState';
  const ROUTE_PREFIX = '/karma/kameras';
  const ROOT_SELECTOR = '#root';
  const API_BASE = window.__KAMERA_QUEST_API_BASE__ || 'https://api-vwcc5j4qda-uc.a.run.app';

  const IDS = {
    home: 'kamera-quest-home',
    shoot: 'kamera-quest-shoot',
    result: 'kamera-quest-result',
  };

  const HTML_CLASSES = {
    home: 'kamera-enhancer-home-mounted',
    shoot: 'kamera-enhancer-shoot-mounted',
    result: 'kamera-enhancer-result-mounted',
  };

  const SELECTORS = {
    homePage: '[class*="_page_yg7xn_"]',
    homeForm: '[class*="_form_yg7xn_"]',
    homeCta: '[class*="_cta_yg7xn_"]',
    homeModeButton: '[class*="_modeBtn_yg7xn_"]',
    shootPage: '[class*="_page_9b4bw_"]',
    shootInner: '[class*="_inner_9b4bw_"]',
    resultPage: '[class*="_page_ihqg1_"]',
    resultInner: '[class*="_inner_ihqg1_"]',
  };

  const BRAND_META = {
    canon: {
      label: 'Canon',
      mount: 'RF / EF',
      note: 'Canon mirrorless bodies plus legacy EF glass.',
    },
    sony: {
      label: 'Sony',
      mount: 'E-mount',
      note: 'Sony full-frame and APS-C bodies on E-mount.',
    },
  };

  const MODE_META = {
    apprentice: {
      label: 'Apprentice',
      note: 'Crisp guidance, plain English, and only the moves that matter first.',
    },
    enthusiast: {
      label: 'Enthusiast',
      note: 'Balanced output with the why behind the recommendation and a few watchouts.',
    },
    craftsperson: {
      label: 'Craftsperson',
      note: 'Technical tradeoffs, lens-fit context, and more detailed working notes.',
    },
    professional: {
      label: 'Professional',
      note: 'Full structured brief with the deeper reliability and science layers exposed.',
    },
  };

  const PRIMARY_GENRES = [
    'portrait',
    'landscape',
    'astro',
    'wildlife',
    'sports',
    'macro',
    'indoorlowlight',
    'goldenhour',
    'street',
    'architecture',
    'event',
    'travel',
  ];

  const GENRE_META = {
    portrait: { label: 'Portrait', icon: '◐', note: 'Faces, eye focus, background separation, and skin exposure drive the result.' },
    landscape: { label: 'Landscape', icon: '△', note: 'Depth, dynamic range, and scene layering matter more than dramatic settings on paper.' },
    astro: { label: 'Astro', icon: '✦', note: 'Stability, star control, and color consistency matter more than chasing extreme ISO blindly.' },
    wildlife: { label: 'Wildlife', icon: '◆', note: 'Reach, tracking stability, and motion control come before everything else.' },
    sports: { label: 'Sports', icon: '◈', note: 'The scene lives or dies on shutter speed, autofocus, and venue light behavior.' },
    macro: { label: 'Macro', icon: '◎', note: 'Tiny shifts in focus and depth of field change the frame immediately.' },
    indoorlowlight: { label: 'Indoor / Low Light', icon: '◌', note: 'The engine should protect clean color and handheld viability in dim scenes.' },
    goldenhour: { label: 'Golden Hour', icon: '☼', note: 'Backlight, flare, highlight protection, and warmth become the dominant variables.' },
    street: { label: 'Street', icon: '↗', note: 'Pace, discretion, and contrast control matter more than studio-perfect precision.' },
    architecture: { label: 'Architecture', icon: '▥', note: 'Geometry, line control, and repeatable perspective matter more than gimmicks.' },
    event: { label: 'Event', icon: '◍', note: 'Mixed light, movement, and moments make reliability more important than theory.' },
    travel: { label: 'Travel', icon: '✧', note: 'Flexibility and speed matter, but the scene still needs a clean visual priority.' },
    food: { label: 'Food', icon: '◔', note: 'Shape, color, steam, and background restraint matter more than sheer sharpness.' },
    realestate: { label: 'Real Estate', icon: '▣', note: 'The setup must stay straight, spacious, and repeatable from frame to frame.' },
    automotive: { label: 'Automotive', icon: '▶', note: 'Surface reflections and motion intent decide whether the image feels premium.' },
    product: { label: 'Product', icon: '■', note: 'Controlled light, color accuracy, and repeatability are the real priorities.' },
    concert: { label: 'Concert', icon: '♫', note: 'Stage light, flicker risk, and subject motion can break otherwise solid settings.' },
    underwater: { label: 'Underwater', icon: '≈', note: 'Color loss, particulate haze, and distance control dominate the session.' },
    drone: { label: 'Drone', icon: '◇', note: 'Wind, subject movement, and safe shutter speed matter more than aesthetic excess.' },
    newborn: { label: 'Newborn', icon: '○', note: 'Comfort, safety, gentle light, and consistent focus matter most here.' },
    fashion: { label: 'Fashion', icon: '⬒', note: 'Expression, fabric detail, and intentional styling matter more than generic portrait rules.' },
  };

  const cache = {
    brandDocs: new Map(),
    lenses: new Map(),
    meta: null,
    resultContext: null,
  };

  const uiState = {
    sceneLoading: false,
    sceneError: '',
  };

  let mountToken = 0;

  function normalizePath(value) {
    const path = String(value || '').replace(/\/+$/, '');
    return path || '/';
  }

  function currentPath() {
    return normalizePath(window.location.pathname);
  }

  function isHomeRoute() {
    return currentPath() === normalizePath(ROUTE_PREFIX);
  }

  function isShootRoute() {
    return currentPath() === normalizePath(`${ROUTE_PREFIX}/shoot`);
  }

  function isResultRoute() {
    return currentPath() === normalizePath(`${ROUTE_PREFIX}/result`);
  }

  function safeJsonParse(value) {
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }

  function readStorage(key) {
    try {
      return safeJsonParse(sessionStorage.getItem(key));
    } catch (error) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      return;
    }
  }

  function readStoredPayload() {
    return readStorage(STORAGE_KEY);
  }

  function readPresetPayload(stored) {
    return stored && stored.response && stored.response.preset ? stored.response.preset : null;
  }

  function normalizeBuilderState(value) {
    return Object.assign({
      brand: '',
      cameraModel: '',
      lensName: '',
      mode: 'enthusiast',
    }, value || {});
  }

  function readBuilderState() {
    return normalizeBuilderState(readStorage(BUILDER_KEY));
  }

  function persistBuilderState(value) {
    writeStorage(BUILDER_KEY, normalizeBuilderState(value));
  }

  function readSceneState() {
    return Object.assign({
      genre: '',
      condition: '',
    }, readStorage(SCENE_KEY) || {});
  }

  function persistSceneState(value) {
    writeStorage(SCENE_KEY, Object.assign(readSceneState(), value || {}));
  }

  function titleCase(value) {
    return String(value || '')
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]+/g, ' ')
      .trim()
      .replace(/\b\w/g, function (match) {
        return match.toUpperCase();
      });
  }

  function normalizeToken(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function compact(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function firstSentence(value) {
    const text = compact(value);
    if (!text) return '';
    const match = text.match(/^.+?[.!?](?:\s|$)/);
    return match ? match[0].trim() : text;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toList(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
  }

  async function fetchJson(endpoint, init) {
    const response = await fetch(`${API_BASE}${endpoint}`, init);
    const payload = await response.json().catch(function () {
      return null;
    });

    if (!response.ok) {
      const errorMessage = payload && payload.error && payload.error.message
        ? payload.error.message
        : payload && payload.message
          ? payload.message
          : `Request failed: ${response.status}`;
      throw new Error(errorMessage);
    }

    return payload;
  }

  async function loadBrandData(brand) {
    const key = normalizeToken(brand);
    if (!key) return null;
    if (cache.brandDocs.has(key)) return cache.brandDocs.get(key);
    const data = await fetchJson(`/cameras/${key}`);
    cache.brandDocs.set(key, data);
    return data;
  }

  async function loadLenses(brand, cameraModel) {
    const key = `${normalizeToken(brand)}::${compact(cameraModel)}`;
    if (!brand || !cameraModel) return null;
    if (cache.lenses.has(key)) return cache.lenses.get(key);
    const data = await fetchJson(`/cameras/${normalizeToken(brand)}/${encodeURIComponent(cameraModel)}/lenses`);
    cache.lenses.set(key, data);
    return data;
  }

  async function loadMeta() {
    if (cache.meta) return cache.meta;
    cache.meta = await fetchJson('/presets/meta');
    return cache.meta;
  }

  function removeContainer(id) {
    const node = document.getElementById(id);
    if (node) node.remove();
  }

  function upsertContainer(parent, id, tagName) {
    if (!parent) return null;
    let node = document.getElementById(id);
    if (!node) {
      node = document.createElement(tagName || 'section');
      node.id = id;
      parent.appendChild(node);
    } else if (node.parentElement !== parent) {
      parent.appendChild(node);
    }
    return node;
  }

  function clearRouteState() {
    removeContainer(IDS.home);
    removeContainer(IDS.shoot);
    removeContainer(IDS.result);
    document.documentElement.classList.remove(HTML_CLASSES.home, HTML_CLASSES.shoot, HTML_CLASSES.result);
  }

  function prepareRouteState(activeRoute) {
    const nextClass = activeRoute ? HTML_CLASSES[activeRoute] : null;

    Object.keys(HTML_CLASSES).forEach(function (key) {
      if (HTML_CLASSES[key] !== nextClass) {
        document.documentElement.classList.remove(HTML_CLASSES[key]);
      }
    });

    if (nextClass) {
      document.documentElement.classList.add(nextClass);
    }

    if (activeRoute !== 'home') removeContainer(IDS.home);
    if (activeRoute !== 'shoot') removeContainer(IDS.shoot);
    if (activeRoute !== 'result') removeContainer(IDS.result);
    if (activeRoute !== 'result') cache.resultContext = null;
  }

  function navigateTo(path) {
    window.location.assign(path);
  }

  function startOver() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(BUILDER_KEY);
      sessionStorage.removeItem(SCENE_KEY);
    } catch (error) {
      return;
    }
    navigateTo(ROUTE_PREFIX);
  }

  function shortGearLine(builder) {
    if (!builder.cameraModel && !builder.lensName) return 'Choose gear first';
    if (!builder.lensName) return builder.cameraModel;
    return `${builder.cameraModel} + ${builder.lensName}`;
  }

  function formatMegapixels(camera) {
    return camera && camera.effectiveMegapixels
      ? `${camera.effectiveMegapixels}MP`
      : 'Resolution unknown';
  }

  function formatCameraFacts(camera) {
    if (!camera) return 'Select a body to preview sensor, resolution, and stabilization.';
    return [
      camera.sensorFormat || camera.sensorType || 'Sensor unknown',
      formatMegapixels(camera),
      camera.IBIS ? 'In-body stabilization' : 'No in-body stabilization',
    ].join(' · ');
  }

  function formatFocalRange(lens) {
    if (!lens || !lens.minFocalLength || !lens.maxFocalLength) return 'Focal range unknown';
    return lens.minFocalLength === lens.maxFocalLength
      ? `${lens.minFocalLength}mm`
      : `${lens.minFocalLength}-${lens.maxFocalLength}mm`;
  }

  function formatMaxAperture(lens) {
    if (!lens || !lens.maxAperture) return 'Aperture unknown';
    if (lens.maxApertureAtTele && Number(lens.maxApertureAtTele) !== Number(lens.maxAperture)) {
      return `f/${lens.maxAperture}-${lens.maxApertureAtTele}`;
    }
    return `f/${lens.maxAperture}`;
  }

  function formatLensFacts(lens) {
    if (!lens) return 'Select a lens to preview aperture range, focal length, and stabilization.';
    return [
      formatMaxAperture(lens),
      formatFocalRange(lens),
      lens.hasOIS ? 'Optical stabilization' : 'No lens stabilization',
    ].join(' · ');
  }

  function renderStepIndicator(activeStep) {
    const steps = [
      { number: 1, label: 'Gear' },
      { number: 2, label: 'Scene' },
      { number: 3, label: 'Settings' },
    ];

    return `
      <nav class="kamera-stepper" aria-label="Progress">
        ${steps.map(function (step) {
          const state = step.number === activeStep
            ? 'current'
            : step.number < activeStep
              ? 'complete'
              : 'upcoming';

          return `
            <div class="kamera-step kamera-step--${state}">
              <span class="kamera-step-index">${step.number}</span>
              <span class="kamera-step-label">${escapeHtml(step.label)}</span>
            </div>
          `;
        }).join('')}
      </nav>
    `;
  }

  function modeMeta(mode) {
    return MODE_META[mode] || MODE_META.enthusiast;
  }

  function orderGenres(meta) {
    const available = Object.keys(meta || {});
    const extras = available.filter(function (key) {
      return PRIMARY_GENRES.indexOf(key) === -1;
    });
    return {
      primary: PRIMARY_GENRES.filter(function (key) {
        return available.indexOf(key) !== -1;
      }),
      extras: extras,
    };
  }

  function genreMeta(key) {
    return Object.assign({
      label: titleCase(key),
      icon: '•',
      note: 'Choose the scene family that best matches the subject and visual priority.',
    }, GENRE_META[key] || {});
  }

  function describeCondition(item) {
    if (!item) return '';
    const haystack = `${item.key || ''} ${item.displayName || ''}`.toLowerCase();
    const has = function () {
      return Array.prototype.slice.call(arguments).some(function (term) {
        return haystack.indexOf(term) !== -1;
      });
    };

    if (has('night', 'dim', 'low light', 'candle', 'dusk', 'twilight', 'blue hour', 'ambient')) {
      return 'Leans toward cleaner low-light handling, steadier shutter choices, and realistic color control.';
    }

    if (has('fast', 'running', 'flight', 'tracking', 'panning', 'sports', 'mma', 'jump', 'action')) {
      return 'Biases the preset toward motion control and autofocus reliability before everything else.';
    }

    if (has('studio', 'white background', 'product', 'formal', 'posed', 'headshot', 'macro focus stack')) {
      return 'Assumes a controlled setup where repeatability, color stability, and intentional framing matter most.';
    }

    if (has('backlit', 'golden', 'sunset', 'sunrise', 'silhouette', 'pyrotechnics')) {
      return 'Protects highlights and keeps the mood of strong backlight or transition light intact.';
    }

    if (has('cloudy', 'overcast', 'shade', 'fog', 'diffused')) {
      return 'Treats the light as softer and flatter, so separation and color need extra care.';
    }

    if (has('sunny', 'bright', 'daylight', 'beach', 'snow', 'desert')) {
      return 'Protects bright highlights and keeps the frame from washing out in hard light.';
    }

    if (has('indoor', 'arena', 'gym', 'museum', 'concert', 'restaurant', 'bar', 'artificial')) {
      return 'Assumes unstable artificial light, so flicker, mixed color, and shutter timing stay in play.';
    }

    return `Tuned for ${compact(item.displayName || titleCase(item.key)).toLowerCase()} so the recommendation matches the scene more closely.`;
  }

  function selectedCamera(catalog, builder) {
    return catalog && Array.isArray(catalog.cameras)
      ? catalog.cameras.find(function (item) {
        return item.modelName === builder.cameraModel;
      }) || null
      : null;
  }

  function selectedLens(lenses, builder) {
    return lenses && Array.isArray(lenses.lenses)
      ? lenses.lenses.find(function (item) {
        return item.lensName === builder.lensName;
      }) || null
      : null;
  }

  function renderHomeMarkup(builder, catalog, lenses) {
    const camera = selectedCamera(catalog, builder);
    const lens = selectedLens(lenses, builder);
    const mode = builder.mode || 'enthusiast';
    const modeInfo = modeMeta(mode);
    const cameraOptions = catalog && Array.isArray(catalog.cameras) ? catalog.cameras : [];
    const lensOptions = lenses && Array.isArray(lenses.lenses) ? lenses.lenses : [];
    const ctaDisabled = !(builder.brand && builder.cameraModel && builder.lensName);

    return `
      <section class="kamera-ui kamera-ui--home" data-mode="${escapeHtml(mode)}">
        ${renderStepIndicator(1)}

        <div class="kamera-shell kamera-shell--compact">
          <header class="kamera-screen-head">
            <p class="kamera-screen-kicker">Kamera Quest</p>
            <h1 class="kamera-screen-title">Perfect settings for every shot, instantly.</h1>
            <p class="kamera-screen-copy">Choose the gear once. The scene and recommendation layers adapt from there.</p>
          </header>

          <div class="kamera-card kamera-card--form">
            <section class="kamera-field">
              <label class="kamera-label">Brand</label>
              <div class="kamera-brand-grid" role="radiogroup" aria-label="Brand">
                ${Object.keys(BRAND_META).map(function (brandKey) {
                  const brand = BRAND_META[brandKey];
                  const active = builder.brand === brandKey;
                  return `
                    <button
                      class="kamera-brand-card ${active ? 'is-active' : ''}"
                      type="button"
                      data-brand="${escapeHtml(brandKey)}"
                      aria-pressed="${active ? 'true' : 'false'}"
                    >
                      <span class="kamera-brand-name">${escapeHtml(brand.label)}</span>
                      <span class="kamera-brand-mount">${escapeHtml(brand.mount)}</span>
                      <span class="kamera-brand-note">${escapeHtml(brand.note)}</span>
                    </button>
                  `;
                }).join('')}
              </div>
            </section>

            <section class="kamera-field">
              <label class="kamera-label" for="kamera-home-body">Body</label>
              <div class="kamera-select-wrap">
                <select id="kamera-home-body" class="kamera-select" data-home-body>
                  <option value="">${builder.brand ? 'Select body…' : 'Choose brand first'}</option>
                  ${cameraOptions.map(function (item) {
                    return `<option value="${escapeHtml(item.modelName)}" ${item.modelName === builder.cameraModel ? 'selected' : ''}>${escapeHtml(item.modelName)}</option>`;
                  }).join('')}
                </select>
                <span class="kamera-select-glyph" aria-hidden="true">⌄</span>
              </div>
              <p class="kamera-inline-facts">${escapeHtml(formatCameraFacts(camera))}</p>
            </section>

            <section class="kamera-field">
              <label class="kamera-label" for="kamera-home-lens">Lens</label>
              <div class="kamera-select-wrap">
                <select id="kamera-home-lens" class="kamera-select" data-home-lens ${builder.cameraModel ? '' : 'disabled'}>
                  <option value="">${builder.cameraModel ? 'Select lens…' : 'Choose body first'}</option>
                  ${lensOptions.map(function (item) {
                    return `<option value="${escapeHtml(item.lensName)}" ${item.lensName === builder.lensName ? 'selected' : ''}>${escapeHtml(item.lensName)}</option>`;
                  }).join('')}
                </select>
                <span class="kamera-select-glyph" aria-hidden="true">⌄</span>
              </div>
              <p class="kamera-inline-facts">${escapeHtml(formatLensFacts(lens))}</p>
            </section>

            <section class="kamera-field">
              <label class="kamera-label">Your level</label>
              <div class="kamera-pill-row" role="radiogroup" aria-label="Your level">
                ${Object.keys(MODE_META).map(function (modeKey) {
                  const active = modeKey === mode;
                  return `
                    <button
                      class="kamera-pill ${active ? 'is-active' : ''}"
                      type="button"
                      data-mode="${escapeHtml(modeKey)}"
                      aria-pressed="${active ? 'true' : 'false'}"
                    >
                      ${escapeHtml(MODE_META[modeKey].label)}
                    </button>
                  `;
                }).join('')}
              </div>
              <p class="kamera-mode-note">${escapeHtml(modeInfo.note)}</p>
            </section>

            ${ctaDisabled
              ? '<button class="kamera-primary-cta" type="button" data-action="home-cta" disabled>Choose your scene</button>'
              : `<a class="kamera-primary-cta" href="${ROUTE_PREFIX}/shoot" data-action="home-cta" role="button">Choose your scene</a>`}
          </div>
        </div>
      </section>
    `;
  }

  function renderGenreButtons(keys, selectedGenre) {
    return keys.map(function (genreKey) {
      const info = genreMeta(genreKey);
      const active = genreKey === selectedGenre;
      return `
        <button
          class="kamera-genre-card ${active ? 'is-active' : ''}"
          type="button"
          data-genre="${escapeHtml(genreKey)}"
          aria-pressed="${active ? 'true' : 'false'}"
        >
          <span class="kamera-genre-icon" aria-hidden="true">${escapeHtml(info.icon)}</span>
          <span class="kamera-genre-text">${escapeHtml(info.label)}</span>
        </button>
      `;
    }).join('');
  }

  function renderShootMarkup(builder, scene, meta) {
    const ordered = orderGenres(meta || {});
    const extrasOpen = ordered.extras.indexOf(scene.genre) !== -1;
    const conditions = scene.genre && meta && meta[scene.genre] ? meta[scene.genre] : [];
    const selectedGenreInfo = scene.genre ? genreMeta(scene.genre) : null;
    const selectedCondition = conditions.find(function (item) {
      return item.key === scene.condition;
    }) || null;
    const canSubmit = Boolean(builder.brand && builder.cameraModel && builder.lensName && scene.genre && scene.condition);

    if (!(builder.brand && builder.cameraModel && builder.lensName)) {
      return `
        <section class="kamera-ui kamera-ui--shoot" data-mode="${escapeHtml(builder.mode || 'enthusiast')}">
          ${renderStepIndicator(2)}

          <div class="kamera-shell kamera-shell--wide">
            <div class="kamera-card kamera-card--form kamera-card--empty">
              <h1 class="kamera-screen-title kamera-screen-title--small">Choose gear first</h1>
              <p class="kamera-screen-copy">The scene screen depends on the body, lens, and experience level from step one.</p>
              <button class="kamera-secondary-cta" type="button" data-action="back-home">Back to gear</button>
            </div>
          </div>
        </section>
      `;
    }

    return `
      <section class="kamera-ui kamera-ui--shoot" data-mode="${escapeHtml(builder.mode || 'enthusiast')}">
        ${renderStepIndicator(2)}

        <div class="kamera-shell kamera-shell--wide">
          <header class="kamera-screen-head kamera-screen-head--tight">
            <div class="kamera-topline">
              <button class="kamera-link-button" type="button" data-action="change-gear">Change gear</button>
              <span class="kamera-gear-pill">${escapeHtml(shortGearLine(builder))}</span>
            </div>
            <h1 class="kamera-screen-title kamera-screen-title--small">Pick the scene</h1>
            <p class="kamera-screen-copy">Choose what you are shooting first, then the condition that best matches the actual light and pace.</p>
          </header>

          <div class="kamera-card kamera-card--form kamera-card--scene">
            <section class="kamera-field kamera-field--tight">
              <label class="kamera-label">What are you shooting?</label>
              <div class="kamera-genre-grid">
                ${renderGenreButtons(ordered.primary, scene.genre)}
              </div>
              ${selectedGenreInfo ? `<p class="kamera-selection-note">${escapeHtml(selectedGenreInfo.note)}</p>` : ''}
            </section>

            ${ordered.extras.length ? `
              <details class="kamera-more-scenes" ${extrasOpen ? 'open' : ''}>
                <summary>More scenes (${ordered.extras.length})</summary>
                <div class="kamera-genre-grid kamera-genre-grid--extras">
                  ${renderGenreButtons(ordered.extras, scene.genre)}
                </div>
              </details>
            ` : ''}

            ${scene.genre ? `
              <section class="kamera-field kamera-field--tight kamera-field--condition">
                <label class="kamera-label">Condition</label>
                <div class="kamera-condition-grid">
                  ${conditions.map(function (item) {
                    const active = item.key === scene.condition;
                    return `
                      <button
                        class="kamera-condition-chip ${active ? 'is-active' : ''}"
                        type="button"
                        data-condition="${escapeHtml(item.key)}"
                        title="${escapeHtml(describeCondition(item))}"
                        aria-pressed="${active ? 'true' : 'false'}"
                      >
                        ${escapeHtml(item.displayName || titleCase(item.key))}
                      </button>
                    `;
                  }).join('')}
                </div>
                ${selectedCondition ? `<p class="kamera-selection-note kamera-selection-note--condition">${escapeHtml(describeCondition(selectedCondition))}</p>` : ''}
              </section>
            ` : ''}

            ${uiState.sceneError ? `<p class="kamera-inline-error">${escapeHtml(uiState.sceneError)}</p>` : ''}

            <button
              class="kamera-primary-cta ${canSubmit ? 'is-ready' : ''}"
              type="button"
              data-action="scene-cta"
              ${canSubmit && !uiState.sceneLoading ? '' : 'disabled'}
            >
              ${uiState.sceneLoading ? 'Building your settings…' : 'Get my settings'}
            </button>
          </div>
        </div>
      </section>
    `;
  }

  function formatShutterDisplay(value) {
    const seconds = typeof value === 'number' ? value : parseShutterSeconds(value);
    if (!seconds || !Number.isFinite(seconds)) return '—';
    if (seconds >= 1) {
      const rounded = seconds >= 10 ? Math.round(seconds) : Number(seconds.toFixed(seconds % 1 ? 1 : 0));
      return `${rounded} sec`;
    }
    return `1/${Math.round(1 / seconds)} sec`;
  }

  function parseShutterSeconds(value) {
    const text = compact(value);
    if (!text) return 0;
    if (/^\d+\/\d+/.test(text)) {
      const parts = text.split('/').map(Number);
      return parts[1] ? parts[0] / parts[1] : 0;
    }
    const normalized = text.replace(/sec|secs|seconds|second|s$/i, '').trim();
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function parseApertureNumber(value) {
    if (typeof value === 'number') return value;
    const match = String(value || '').match(/(\d+(\.\d+)?)/);
    return match ? Number(match[1]) : 0;
  }

  function uniqueSorted(values, compare) {
    return Array.from(new Set(values.filter(function (value) {
      return value != null && value !== '';
    }))).sort(compare);
  }

  function apertureStopsForLens(lens, baselineAperture) {
    const known = [1.2, 1.4, 1.8, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
    const widest = lens && lens.maxAperture ? Number(lens.maxAperture) : baselineAperture || 2.8;
    const values = known.filter(function (stop) {
      return stop >= widest - 0.01;
    });

    if (widest && values.indexOf(widest) === -1) values.push(widest);
    if (baselineAperture && values.indexOf(baselineAperture) === -1) values.push(baselineAperture);

    return uniqueSorted(values, function (left, right) {
      return left - right;
    });
  }

  function isoStops(baselineIso) {
    const defaults = [100, 200, 400, 800, 1600, 3200, 6400, 12800];
    if (baselineIso && defaults.indexOf(baselineIso) === -1) defaults.push(baselineIso);
    return uniqueSorted(defaults, function (left, right) {
      return left - right;
    });
  }

  function shutterStops(baselineSeconds) {
    const defaults = [
      1,
      1 / 2,
      1 / 4,
      1 / 8,
      1 / 15,
      1 / 30,
      1 / 60,
      1 / 125,
      1 / 250,
      1 / 500,
      1 / 1000,
      1 / 2000,
      1 / 4000,
      1 / 8000,
    ];

    if (baselineSeconds && defaults.indexOf(baselineSeconds) === -1) defaults.push(baselineSeconds);

    return uniqueSorted(defaults, function (left, right) {
      return right - left;
    });
  }

  function nearestIndex(values, target) {
    let bestIndex = 0;
    let bestDistance = Infinity;

    values.forEach(function (value, index) {
      const distance = Math.abs(value - target);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    return bestIndex;
  }

  function scoreForBand(band) {
    switch (normalizeToken(band)) {
      case 'high':
        return 92;
      case 'mediumhigh':
        return 84;
      case 'medium':
        return 72;
      case 'low':
        return 58;
      default:
        return 68;
    }
  }

  function confidenceScore(validity) {
    const checks = toList(validity && validity.checks);
    if (!checks.length) return 83;

    const weights = {
      gearlimits: 0.32,
      exposurebaseline: 0.26,
      colorandrepeatability: 0.14,
      colorcontrol: 0.14,
      compositionandaesthetics: 0.16,
      genrefieldadvice: 0.12,
    };

    let weighted = 0;
    let totalWeight = 0;

    checks.forEach(function (check) {
      const key = normalizeToken(check.label);
      const weight = weights[key] || 0.1;
      weighted += scoreForBand(check.confidence) * weight;
      totalWeight += weight;
    });

    return Math.round(weighted / (totalWeight || 1));
  }

  function confidenceExplanation(validity) {
    const summary = compact(validity && validity.summary);
    return summary || 'Reliable on gear limits and exposure baseline, but still something to validate against the real scene.';
  }

  function prettyMode(mode) {
    const key = normalizeToken(mode);
    if (key === 'av' || key === 'a' || key === 'aperturepriority') {
      return {
        label: 'Aperture Priority',
        code: mode || 'Av',
      };
    }

    if (key === 'tv' || key === 's' || key === 'shutterpriority') {
      return {
        label: 'Shutter Priority',
        code: mode || 'Tv',
      };
    }

    if (key === 'm' || key === 'manual') {
      return {
        label: 'Manual',
        code: mode || 'M',
      };
    }

    if (key === 'p' || key === 'program') {
      return {
        label: 'Program',
        code: mode || 'P',
      };
    }

    return {
      label: titleCase(mode || 'Auto'),
      code: mode || '',
    };
  }

  function apertureImplication(value) {
    if (value <= 2) return 'Very shallow depth of field and maximum light.';
    if (value <= 2.8) return 'Strong subject separation with generous light.';
    if (value <= 5.6) return 'Balanced separation with safer depth.';
    if (value <= 11) return 'Deeper focus across the frame.';
    return 'Maximum depth of field, but diffraction starts to build.';
  }

  function shutterImplication(seconds, session) {
    if (!seconds) return 'Use the starting shutter that the scene can actually support.';
    if (seconds <= 1 / 1000) return 'Built to freeze very fast motion cleanly.';
    if (seconds <= 1 / 250) return 'Good for active subjects with modest movement.';
    if (seconds <= 1 / 60) return 'Watch for subject motion even if stabilization is strong.';
    if (seconds < 1) return 'Use stabilization or support and check every first frame closely.';
    return session && session.stabilization && session.stabilization.tripodAdvice
      ? firstSentence(session.stabilization.tripodAdvice)
      : 'Tripod or very steady support is the safer move here.';
  }

  function isoImplication(value) {
    if (value <= 200) return 'Clean file quality with strong editing headroom.';
    if (value <= 800) return 'Very manageable noise for most current bodies.';
    if (value <= 1600) return 'Some grain may appear, but detail should stay solid.';
    if (value <= 6400) return 'Visible noise is likely, but the shot may still be worth it.';
    return 'Heavy noise tradeoff. Use only when the shutter or aperture has to hold.';
  }

  function modeImplication(mode) {
    const info = prettyMode(mode);
    if (normalizeToken(info.label) === 'aperturepriority') return 'Lets you control depth of field while the camera manages the rest.';
    if (normalizeToken(info.label) === 'shutterpriority') return 'Lets you protect motion first and accept aperture movement.';
    if (normalizeToken(info.label) === 'manual') return 'Locks the whole baseline so nothing drifts without your permission.';
    return 'Useful when speed matters more than strict manual control.';
  }

  function exposureDeltaStops(current, baseline) {
    const currentValue = (current.shutter * current.iso) / (current.aperture * current.aperture);
    const baselineValue = (baseline.shutter * baseline.iso) / (baseline.aperture * baseline.aperture);
    return Math.log2(currentValue / baselineValue);
  }

  function buildImpactNote(current, baseline) {
    const notes = [];

    if (current.iso > baseline.iso) {
      notes.push(`Raising ISO from ${baseline.iso} to ${current.iso} buys light at the cost of more visible grain.`);
    } else if (current.iso < baseline.iso) {
      notes.push(`Dropping ISO from ${baseline.iso} to ${current.iso} cleans the file up, but the scene has to give that light back elsewhere.`);
    }

    if (current.aperture < baseline.aperture) {
      notes.push(`Opening from f/${baseline.aperture} to f/${current.aperture} brightens the frame and makes depth of field shallower.`);
    } else if (current.aperture > baseline.aperture) {
      notes.push(`Stopping down from f/${baseline.aperture} to f/${current.aperture} deepens focus but costs light.`);
    }

    if (current.shutter < baseline.shutter) {
      notes.push(`Using ${formatShutterDisplay(current.shutter)} instead of ${formatShutterDisplay(baseline.shutter)} freezes motion better, but darkens the frame.`);
    } else if (current.shutter > baseline.shutter) {
      notes.push(`Slowing to ${formatShutterDisplay(current.shutter)} adds light, but raises motion and handshake risk.`);
    }

    const delta = exposureDeltaStops(current, baseline);
    if (Math.abs(delta) < 0.2) {
      notes.push('Overall exposure stays close to the recommended starting point.');
    } else {
      notes.push(`Overall this sits about ${Math.abs(delta).toFixed(1)} stop${Math.abs(delta) >= 1.5 ? 's' : ''} ${delta > 0 ? 'brighter' : 'darker'} than the starting recommendation.`);
    }

    return notes.slice(0, 2).join(' ');
  }

  function detailCardCopy(context) {
    const session = context.session;

    return [
      {
        title: 'Starting Exposure',
        body: [
          `${prettyMode(session.exposure.mode).label} is the baseline here with ${session.exposure.aperture}, ${formatShutterDisplay(session.exposure.shutterSpeed)}, and ISO ${session.exposure.ISO}.`,
          firstSentence(session.exposure.exposureCompensation),
        ].filter(Boolean).join(' '),
      },
      {
        title: 'Stabilization & Shutter Floor',
        body: [
          firstSentence(session.stabilization.support),
          session.stabilization.staticHandheldFloor ? `Static handheld floor: ${session.stabilization.staticHandheldFloor}.` : '',
          session.stabilization.stabilizedStaticFloor ? `With stabilization: ${session.stabilization.stabilizedStaticFloor}.` : '',
        ].filter(Boolean).join(' '),
      },
      {
        title: 'White Balance & Metering',
        body: [
          firstSentence(session.exposure.whiteBalance),
          `Metering: ${titleCase(session.exposure.metering)}.`,
          firstSentence(session.exposure.bracketing),
        ].filter(Boolean).join(' '),
      },
      {
        title: 'Focus Mode',
        body: [
          firstSentence(session.focus.autofocusMode),
          firstSentence(session.focus.focusArea),
          firstSentence(session.focus.subjectDetection),
        ].filter(Boolean).join(' '),
      },
    ];
  }

  function interpolatePoint(from, to, amount) {
    return {
      x: from.x + ((to.x - from.x) * amount),
      y: from.y + ((to.y - from.y) * amount),
    };
  }

  function renderTriangle(explorer, context) {
    const center = { x: 170, y: 164 };
    const points = {
      aperture: { x: 170, y: 34 },
      shutter: { x: 54, y: 262 },
      iso: { x: 286, y: 262 },
    };

    const isoAmount = explorer.isoIndex / Math.max(1, context.isoValues.length - 1);
    const apertureAmount = 1 - (explorer.apertureIndex / Math.max(1, context.apertureValues.length - 1));
    const shutterAmount = 1 - (explorer.shutterIndex / Math.max(1, context.shutterValues.length - 1));
    const baselineIsoAmount = context.baselineIsoIndex / Math.max(1, context.isoValues.length - 1);
    const baselineApertureAmount = 1 - (context.baselineApertureIndex / Math.max(1, context.apertureValues.length - 1));
    const baselineShutterAmount = 1 - (context.baselineShutterIndex / Math.max(1, context.shutterValues.length - 1));

    const currentDots = {
      aperture: interpolatePoint(center, points.aperture, 0.28 + (0.62 * apertureAmount)),
      shutter: interpolatePoint(center, points.shutter, 0.28 + (0.62 * shutterAmount)),
      iso: interpolatePoint(center, points.iso, 0.28 + (0.62 * isoAmount)),
    };

    const baselineDots = {
      aperture: interpolatePoint(center, points.aperture, 0.28 + (0.62 * baselineApertureAmount)),
      shutter: interpolatePoint(center, points.shutter, 0.28 + (0.62 * baselineShutterAmount)),
      iso: interpolatePoint(center, points.iso, 0.28 + (0.62 * baselineIsoAmount)),
    };

    return `
      <svg class="kamera-triangle-svg" viewBox="0 0 340 300" aria-hidden="true">
        <polygon class="kamera-triangle-shape" points="170,28 40,272 300,272"></polygon>
        <line x1="170" y1="164" x2="170" y2="34" class="kamera-triangle-axis"></line>
        <line x1="170" y1="164" x2="54" y2="262" class="kamera-triangle-axis"></line>
        <line x1="170" y1="164" x2="286" y2="262" class="kamera-triangle-axis"></line>

        <circle cx="${baselineDots.aperture.x}" cy="${baselineDots.aperture.y}" r="7" class="kamera-triangle-dot kamera-triangle-dot--baseline"></circle>
        <circle cx="${baselineDots.shutter.x}" cy="${baselineDots.shutter.y}" r="7" class="kamera-triangle-dot kamera-triangle-dot--baseline"></circle>
        <circle cx="${baselineDots.iso.x}" cy="${baselineDots.iso.y}" r="7" class="kamera-triangle-dot kamera-triangle-dot--baseline"></circle>

        <circle cx="${currentDots.aperture.x}" cy="${currentDots.aperture.y}" r="9" class="kamera-triangle-dot kamera-triangle-dot--aperture"></circle>
        <circle cx="${currentDots.shutter.x}" cy="${currentDots.shutter.y}" r="9" class="kamera-triangle-dot kamera-triangle-dot--shutter"></circle>
        <circle cx="${currentDots.iso.x}" cy="${currentDots.iso.y}" r="9" class="kamera-triangle-dot kamera-triangle-dot--iso"></circle>

        <text x="170" y="18" class="kamera-triangle-label">Aperture</text>
        <text x="22" y="288" class="kamera-triangle-label">Shutter</text>
        <text x="268" y="288" class="kamera-triangle-label">ISO</text>
      </svg>
    `;
  }

  function renderSlider(track) {
    return `
      <div class="kamera-slider" data-slider="${escapeHtml(track.key)}">
        <div class="kamera-slider-head">
          <label class="kamera-slider-label" for="${escapeHtml(track.id)}">${escapeHtml(track.label)}</label>
          <span class="kamera-slider-value">${escapeHtml(track.currentLabel)}</span>
        </div>
        <input
          class="kamera-slider-input"
          id="${escapeHtml(track.id)}"
          type="range"
          min="0"
          max="${track.values.length - 1}"
          step="1"
          value="${track.index}"
          data-explorer="${escapeHtml(track.key)}"
        >
        <div class="kamera-slider-stops">
          ${track.values.map(function (value, index) {
            const label = track.format(value);
            const emphasized = index === track.index;
            return `<span class="${emphasized ? 'is-active' : ''}">${escapeHtml(label)}</span>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderAdvancedSections(context, mode) {
    const briefing = context.briefing;
    const sections = toList(briefing.advancedSections);
    if (!sections.length || mode === 'apprentice') return '';

    return `
      <details class="kamera-advanced" ${mode === 'professional' ? 'open' : ''}>
        <summary>Technical detail</summary>
        <div class="kamera-advanced-grid">
          ${sections.map(function (section) {
            return `
              <article class="kamera-detail-card kamera-detail-card--advanced">
                <h3>${escapeHtml(section.title)}</h3>
                <ul class="kamera-bullets kamera-bullets--tight">
                  ${toList(section.items).map(function (item) {
                    return `<li>${escapeHtml(firstSentence(item) || compact(item))}</li>`;
                  }).join('')}
                </ul>
              </article>
            `;
          }).join('')}
        </div>
      </details>
    `;
  }

  function renderResultMarkup(context, explorer) {
    const briefing = context.briefing;
    const current = {
      iso: context.isoValues[explorer.isoIndex],
      aperture: context.apertureValues[explorer.apertureIndex],
      shutter: context.shutterValues[explorer.shutterIndex],
    };
    const deltaFromBase = Math.abs(exposureDeltaStops(current, context.baseline)) > 0.15;
    const modeInfo = prettyMode(context.session.exposure.mode);
    const confidence = confidenceScore(context.session.validity);
    const detailCards = detailCardCopy(context);
    const watchouts = toList(briefing.watchouts).slice(0, context.mode === 'apprentice' ? 2 : 4);
    const primaryActions = toList(briefing.primaryActions).slice(0, context.mode === 'apprentice' ? 3 : 5);
    const sliderTracks = [
      {
        key: 'isoIndex',
        id: 'kamera-slider-iso',
        label: 'ISO',
        currentLabel: `ISO ${current.iso}`,
        values: context.isoValues,
        index: explorer.isoIndex,
        format: function (value) {
          return String(value);
        },
      },
      {
        key: 'apertureIndex',
        id: 'kamera-slider-aperture',
        label: 'Aperture',
        currentLabel: `f/${current.aperture}`,
        values: context.apertureValues,
        index: explorer.apertureIndex,
        format: function (value) {
          return `f/${value}`;
        },
      },
      {
        key: 'shutterIndex',
        id: 'kamera-slider-shutter',
        label: 'Shutter',
        currentLabel: formatShutterDisplay(current.shutter),
        values: context.shutterValues,
        index: explorer.shutterIndex,
        format: function (value) {
          return formatShutterDisplay(value).replace(' sec', 's');
        },
      },
    ];

    return `
      <section class="kamera-ui kamera-ui--result" data-mode="${escapeHtml(context.mode)}" data-detail="${escapeHtml(context.detailLevel)}">
        ${renderStepIndicator(3)}

        <div class="kamera-shell kamera-shell--result">
          <header class="kamera-result-head">
            <div class="kamera-topline kamera-topline--spread">
              <span class="kamera-result-crumb">${escapeHtml(titleCase(context.request.genre || context.preset.genre || 'scene'))} / ${escapeHtml(context.preset.displayName || titleCase(context.request.condition || 'recommended setup'))}</span>
              <span class="kamera-gear-pill">${escapeHtml(shortGearLine(readBuilderState()))}</span>
            </div>

            <h1 class="kamera-screen-title kamera-screen-title--small">${escapeHtml(briefing.heading || 'Session brief')}</h1>
            <p class="kamera-screen-copy">${escapeHtml(compact(briefing.summary || 'Use this as a starting point, validate the first frames, and adjust from the scene.'))}</p>

            <div class="kamera-confidence">
              <div class="kamera-confidence-head">
                <span>Match confidence</span>
                <strong>${confidence}%</strong>
              </div>
              <div class="kamera-confidence-track" aria-hidden="true">
                <span style="width:${confidence}%"></span>
              </div>
              <p>${escapeHtml(confidenceExplanation(context.session.validity))}</p>
            </div>
          </header>

          <section class="kamera-settings-band">
            <article class="kamera-setting-tile">
              <span class="kamera-setting-kicker">Aperture</span>
              <strong>f/${escapeHtml(String(current.aperture))}</strong>
              <p>${escapeHtml(apertureImplication(current.aperture))}</p>
              ${current.aperture !== context.baseline.aperture ? `<span class="kamera-setting-meta">Recommended: f/${escapeHtml(String(context.baseline.aperture))}</span>` : ''}
            </article>
            <article class="kamera-setting-tile">
              <span class="kamera-setting-kicker">Shutter</span>
              <strong>${escapeHtml(formatShutterDisplay(current.shutter))}</strong>
              <p>${escapeHtml(shutterImplication(current.shutter, context.session))}</p>
              ${current.shutter !== context.baseline.shutter ? `<span class="kamera-setting-meta">Recommended: ${escapeHtml(formatShutterDisplay(context.baseline.shutter))}</span>` : ''}
            </article>
            <article class="kamera-setting-tile">
              <span class="kamera-setting-kicker">ISO</span>
              <strong>ISO ${escapeHtml(String(current.iso))}</strong>
              <p>${escapeHtml(isoImplication(current.iso))}</p>
              ${current.iso !== context.baseline.iso ? `<span class="kamera-setting-meta">Recommended: ISO ${escapeHtml(String(context.baseline.iso))}</span>` : ''}
            </article>
            <article class="kamera-setting-tile">
              <span class="kamera-setting-kicker">Mode</span>
              <strong>${escapeHtml(modeInfo.label)}${modeInfo.code ? ` <span class="kamera-setting-code">(${escapeHtml(modeInfo.code)})</span>` : ''}</strong>
              <p>${escapeHtml(modeImplication(context.session.exposure.mode))}</p>
            </article>
          </section>

          <section class="kamera-card kamera-card--explorer">
            <div class="kamera-section-head">
              <div>
                <p class="kamera-section-kicker">Interactive exposure explorer</p>
                <h2>Explore the tradeoffs</h2>
              </div>
              ${deltaFromBase ? '<span class="kamera-explorer-flag">Custom balance</span>' : '<span class="kamera-explorer-flag kamera-explorer-flag--base">Recommended balance</span>'}
            </div>

            <div class="kamera-explorer-grid">
              <div class="kamera-slider-stack">
                ${sliderTracks.map(renderSlider).join('')}
              </div>

              <div class="kamera-triangle-card">
                ${renderTriangle(explorer, context)}
                <p class="kamera-impact-note">${escapeHtml(buildImpactNote(current, context.baseline))}</p>
              </div>
            </div>
          </section>

          <section class="kamera-coach-grid">
            <article class="kamera-coach-card">
              <span class="kamera-section-kicker">Coach note</span>
              <p>${escapeHtml(compact(briefing.coachTip || context.preset.proTip || 'Use the preset as a baseline, then validate it on the first controlled frames.'))}</p>
            </article>
            ${watchouts.length ? `
              <article class="kamera-coach-card">
                <span class="kamera-section-kicker">Watch for</span>
                <ul class="kamera-bullets">
                  ${watchouts.map(function (item) {
                    return `<li>${escapeHtml(item)}</li>`;
                  }).join('')}
                </ul>
              </article>
            ` : ''}
          </section>

          <section class="kamera-detail-grid">
            ${detailCards.map(function (card) {
              return `
                <article class="kamera-detail-card">
                  <h3>${escapeHtml(card.title)}</h3>
                  <p>${escapeHtml(card.body)}</p>
                </article>
              `;
            }).join('')}
          </section>

          ${primaryActions.length ? `
            <section class="kamera-card kamera-card--actions">
              <div class="kamera-section-head">
                <div>
                  <p class="kamera-section-kicker">Action steps</p>
                  <h2>What to do first</h2>
                </div>
              </div>
              <ol class="kamera-action-list">
                ${primaryActions.map(function (item) {
                  return `<li>${escapeHtml(item)}</li>`;
                }).join('')}
              </ol>
            </section>
          ` : ''}

          ${renderAdvancedSections(context, context.mode)}

          <nav class="kamera-result-nav">
            <button class="kamera-secondary-cta" type="button" data-action="start-over">Start over</button>
            <button class="kamera-secondary-cta" type="button" data-action="change-scene">Change scene</button>
            <button class="kamera-secondary-cta" type="button" data-action="change-gear">Change gear</button>
          </nav>
        </div>
      </section>
    `;
  }

  function buildBriefingFallback(preset, session, mode) {
    return {
      heading: `${titleCase(preset.genre)} Session Brief`,
      summary: firstSentence(preset.rationale) || 'Use the preset as a disciplined starting point and validate it from the real scene.',
      primaryActions: toList(session.checklist).slice(0, mode === 'apprentice' ? 3 : 5),
      watchouts: toList(session.caveats),
      coachTip: firstSentence(preset.proTip || preset.commonMistake),
      advancedSections: [],
    };
  }

  function baseResultState(context) {
    return {
      isoIndex: context.baselineIsoIndex,
      apertureIndex: context.baselineApertureIndex,
      shutterIndex: context.baselineShutterIndex,
    };
  }

  async function prepareResultContext() {
    const stored = readStoredPayload();
    const preset = readPresetPayload(stored);
    if (!stored || !preset || !preset.sessionOptimization) return null;

    const request = stored.request || {};
    const session = preset.sessionOptimization;
    const mode = session.meta && session.meta.audienceMode ? session.meta.audienceMode : (request.mode || 'enthusiast');
    const detailLevel = session.meta && session.meta.detailLevel ? session.meta.detailLevel : 'guided';

    let camera = null;
    let lens = null;

    if (request.brand && request.cameraModel) {
      const brandData = await loadBrandData(request.brand);
      camera = selectedCamera(brandData, { cameraModel: request.cameraModel });

      const lensData = await loadLenses(request.brand, request.cameraModel);
      lens = selectedLens(lensData, { lensName: request.lensName });
    }

    const baseline = {
      iso: Number(preset.ISO) || Number(session.exposure.ISO) || 100,
      aperture: parseApertureNumber(preset.aperture || session.exposure.aperture) || 2.8,
      shutter: parseShutterSeconds(preset.shutterSpeedWithIBIS || preset.shutterSpeed || session.exposure.shutterSpeed) || (1 / 125),
    };

    const isoValues = isoStops(baseline.iso);
    const apertureValues = apertureStopsForLens(lens, baseline.aperture);
    const shutterValues = shutterStops(baseline.shutter);

    return {
      stored: stored,
      request: request,
      preset: preset,
      session: session,
      mode: mode,
      detailLevel: detailLevel,
      briefing: session.briefing || buildBriefingFallback(preset, session, mode),
      camera: camera,
      lens: lens,
      baseline: baseline,
      isoValues: isoValues,
      apertureValues: apertureValues,
      shutterValues: shutterValues,
      baselineIsoIndex: nearestIndex(isoValues, baseline.iso),
      baselineApertureIndex: nearestIndex(apertureValues, baseline.aperture),
      baselineShutterIndex: nearestIndex(shutterValues, baseline.shutter),
    };
  }

  function bindHomeEvents(container) {
    if (!container || container.dataset.bound === 'true') return;
    container.dataset.bound = 'true';

    container.addEventListener('click', async function (event) {
      const brandButton = event.target.closest('[data-brand]');
      if (brandButton) {
        const builder = readBuilderState();
        const brand = brandButton.getAttribute('data-brand');
        persistBuilderState({
          brand: brand,
          cameraModel: brand === builder.brand ? builder.cameraModel : '',
          lensName: brand === builder.brand ? builder.lensName : '',
          mode: builder.mode || 'enthusiast',
        });
        scheduleMount();
        return;
      }

      const modeButton = event.target.closest('[data-mode]');
      if (modeButton) {
        const builder = readBuilderState();
        persistBuilderState(Object.assign({}, builder, {
          mode: modeButton.getAttribute('data-mode'),
        }));
        scheduleMount();
        return;
      }

      const cta = event.target.closest('[data-action="home-cta"]');
      if (cta) {
        const builder = readBuilderState();
        if (!(builder.brand && builder.cameraModel && builder.lensName)) return;

        persistSceneState({ genre: '', condition: '' });
        navigateTo(`${ROUTE_PREFIX}/shoot`);
      }
    });

    container.addEventListener('change', function (event) {
      const target = event.target;
      const builder = readBuilderState();

      if (target.matches('[data-home-body]')) {
        persistBuilderState(Object.assign({}, builder, {
          cameraModel: target.value,
          lensName: '',
        }));
        scheduleMount();
      }

      if (target.matches('[data-home-lens]')) {
        persistBuilderState(Object.assign({}, builder, {
          lensName: target.value,
        }));
        scheduleMount();
      }
    });
  }

  function bindShootEvents(container) {
    if (!container || container.dataset.bound === 'true') return;
    container.dataset.bound = 'true';

    container.addEventListener('click', async function (event) {
      const backButton = event.target.closest('[data-action="back-home"], [data-action="change-gear"]');
      if (backButton) {
        navigateTo(ROUTE_PREFIX);
        return;
      }

      const genreButton = event.target.closest('[data-genre]');
      if (genreButton) {
        persistSceneState({
          genre: genreButton.getAttribute('data-genre'),
          condition: '',
        });
        uiState.sceneError = '';
        scheduleMount();
        return;
      }

      const conditionButton = event.target.closest('[data-condition]');
      if (conditionButton) {
        persistSceneState({
          condition: conditionButton.getAttribute('data-condition'),
        });
        uiState.sceneError = '';
        scheduleMount();
        return;
      }

      const cta = event.target.closest('[data-action="scene-cta"]');
      if (!cta || uiState.sceneLoading) return;

      const builder = readBuilderState();
      const scene = readSceneState();
      if (!(builder.brand && builder.cameraModel && builder.lensName && scene.genre && scene.condition)) return;

      uiState.sceneLoading = true;
      uiState.sceneError = '';
      scheduleMount();

      try {
        const payload = await fetchJson('/presets/classic', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            brand: builder.brand,
            cameraModel: builder.cameraModel,
            lensName: builder.lensName,
            genre: scene.genre,
            condition: scene.condition,
            mode: builder.mode || 'enthusiast',
          }),
        });

        uiState.sceneLoading = false;
        cache.resultContext = null;
        writeStorage(STORAGE_KEY, {
          requestedAt: new Date().toISOString(),
          request: {
            brand: builder.brand,
            cameraModel: builder.cameraModel,
            lensName: builder.lensName,
            genre: scene.genre,
            condition: scene.condition,
            mode: builder.mode || 'enthusiast',
          },
          response: payload && payload.preset ? payload : { preset: payload },
        });
        navigateTo(`${ROUTE_PREFIX}/result`);
      } catch (error) {
        uiState.sceneLoading = false;
        uiState.sceneError = error && error.message ? error.message : 'Unable to build settings right now.';
        scheduleMount();
      }
    });
  }

  function bindResultEvents(container) {
    if (!container || container.dataset.bound === 'true') return;
    container.dataset.bound = 'true';

    container.addEventListener('input', function (event) {
      const target = event.target;
      if (!target.matches('[data-explorer]') || !cache.resultContext) return;

      const explorer = cache.resultContext.explorer || baseResultState(cache.resultContext);
      explorer[target.getAttribute('data-explorer')] = Number(target.value);
      cache.resultContext.explorer = explorer;
      container.innerHTML = renderResultMarkup(cache.resultContext, explorer);
    });

    container.addEventListener('click', function (event) {
      if (event.target.closest('[data-action="start-over"]')) {
        startOver();
        return;
      }

      if (event.target.closest('[data-action="change-gear"]')) {
        navigateTo(ROUTE_PREFIX);
        return;
      }

      if (event.target.closest('[data-action="change-scene"]')) {
        navigateTo(`${ROUTE_PREFIX}/shoot`);
      }
    });
  }

  async function mountHome(root, token) {
    const page = root.querySelector(SELECTORS.homePage);
    if (!page) return false;

    document.documentElement.classList.add(HTML_CLASSES.home);
    const container = upsertContainer(page, IDS.home, 'section');
    if (!container) return false;

    const builder = readBuilderState();
    const cachedCatalog = builder.brand ? (cache.brandDocs.get(normalizeToken(builder.brand)) || null) : null;
    const cachedLenses = builder.brand && builder.cameraModel
      ? (cache.lenses.get(`${normalizeToken(builder.brand)}::${compact(builder.cameraModel)}`) || null)
      : null;

    container.innerHTML = renderHomeMarkup(builder, cachedCatalog, cachedLenses);
    bindHomeEvents(container);

    const catalog = builder.brand ? await loadBrandData(builder.brand) : null;
    if (token !== mountToken) return true;

    const lenses = builder.brand && builder.cameraModel
      ? await loadLenses(builder.brand, builder.cameraModel)
      : null;
    if (token !== mountToken) return true;

    container.innerHTML = renderHomeMarkup(builder, catalog, lenses);
    return true;
  }

  async function mountShoot(root, token) {
    const inner = root.querySelector(SELECTORS.shootInner);
    if (!inner) return false;

    document.documentElement.classList.add(HTML_CLASSES.shoot);
    const container = upsertContainer(inner, IDS.shoot, 'section');
    if (!container) return false;

    const builder = readBuilderState();
    const scene = readSceneState();
    container.innerHTML = renderShootMarkup(builder, scene, cache.meta || {});
    bindShootEvents(container);

    const meta = await loadMeta();
    if (token !== mountToken) return true;

    container.innerHTML = renderShootMarkup(builder, scene, meta);
    return true;
  }

  async function mountResult(root, token) {
    const inner = root.querySelector(SELECTORS.resultInner);
    if (!inner) return false;

    document.documentElement.classList.add(HTML_CLASSES.result);
    const container = upsertContainer(inner, IDS.result, 'section');
    if (!container) return false;

    if (!cache.resultContext) {
      container.innerHTML = `
        <section class="kamera-ui kamera-ui--result">
          ${renderStepIndicator(3)}
          <div class="kamera-shell kamera-shell--result">
            <div class="kamera-card kamera-card--empty">
              <h1 class="kamera-screen-title kamera-screen-title--small">Building your settings</h1>
              <p class="kamera-screen-copy">Loading the session brief and the interactive exposure explorer.</p>
            </div>
          </div>
        </section>
      `;
    }

    const context = await prepareResultContext();
    if (token !== mountToken) return true;

    if (!context) {
      container.innerHTML = `
        <section class="kamera-ui kamera-ui--result">
          ${renderStepIndicator(3)}
          <div class="kamera-shell kamera-shell--result">
            <div class="kamera-card kamera-card--empty">
              <h1 class="kamera-screen-title kamera-screen-title--small">No session loaded</h1>
              <p class="kamera-screen-copy">Generate a session first so the result screen has real settings to work with.</p>
              <button class="kamera-secondary-cta" type="button" data-action="change-scene">Back to scene</button>
            </div>
          </div>
        </section>
      `;
      bindResultEvents(container);
      return true;
    }

    context.explorer = context.explorer || baseResultState(context);
    cache.resultContext = context;
    container.innerHTML = renderResultMarkup(context, context.explorer);
    bindResultEvents(container);
    return true;
  }

  async function mountEnhancers() {
    const root = document.querySelector(ROOT_SELECTOR);
    if (!root) return;

    const token = ++mountToken;
    const activeRoute = isHomeRoute()
      ? 'home'
      : isShootRoute()
        ? 'shoot'
        : isResultRoute()
          ? 'result'
          : null;

    if (!activeRoute) {
      clearRouteState();
      return;
    }

    prepareRouteState(activeRoute);

    try {
      let mounted = false;

      if (isHomeRoute()) {
        mounted = await mountHome(root, token);
      } else if (isShootRoute()) {
        mounted = await mountShoot(root, token);
      } else if (isResultRoute()) {
        mounted = await mountResult(root, token);
      }

      if (!mounted && token === mountToken) {
        window.setTimeout(scheduleMount, 60);
      }
    } catch (error) {
      return;
    }
  }

  function scheduleMount() {
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        mountEnhancers();
      });
    });
  }

  function wrapHistoryMethod(methodName) {
    const original = history[methodName];
    history[methodName] = function wrappedHistoryMethod() {
      const result = original.apply(this, arguments);
      window.dispatchEvent(new Event('kameraquest:navigation'));
      scheduleMount();
      return result;
    };
  }

  wrapHistoryMethod('pushState');
  wrapHistoryMethod('replaceState');

  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    scheduleMount();
  }

  window.addEventListener('DOMContentLoaded', scheduleMount);
  window.addEventListener('popstate', scheduleMount);
  window.addEventListener('load', scheduleMount);
  window.addEventListener('kameraquest:navigation', scheduleMount);
  window.addEventListener('kameraquest:preset-updated', scheduleMount);
})();
