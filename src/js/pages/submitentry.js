/**
 * pages/submitentry.js — controller for /paddlingout/submitentry
 * Extracted from the page 12 Sep 2026. Depends on prod-config, prefs, util, geo, PinPicker, PoHeader (loaded before).
 */
(function () {
  const API_BASE = window.KaaykoUtil.apiBase();

  const form = document.getElementById('submit-entry-form');
  const statusEl = document.getElementById('form-status');
  const submitBtn = document.getElementById('submit-btn');
  const todoEl = document.getElementById('todo');
  const successPanel = document.getElementById('success-panel');
  const successCopy = document.getElementById('success-copy');
  const emailWrap = document.getElementById('email-wrap');
  const emailInput = document.getElementById('email');
  const imageInput = document.getElementById('images');
  const imageDrop = document.getElementById('image-drop');
  const imagePreviews = document.getElementById('image-previews');
  const imageCount = document.getElementById('image-count');
  const locLock = document.getElementById('loc-lock');
  const locLockText = document.getElementById('loc-lock-text');
  // Mirrors the API: 2 photos minimum so a reviewer can see water AND launch,
  // 5 maximum, ≤5 MB each after the in-browser resize.
  const MIN_IMAGES = 2;
  const MAX_IMAGES = 5;
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  let selectedImages = [];
  let previewUrls = [];
  let optimizing = false;
  let submitting = false;
  // Fields the user has interacted with — errors only show for these until
  // they press submit, so an empty form doesn't open covered in red.
  const touched = new Set();
  let submitAttempted = false;
  let locationLocked = false;

  // Phone cameras produce 3-12 MB photos (and iOS shoots HEIC), which the
  // 5 MB / JPEG-PNG-WebP limits reject. Downscale + re-encode to JPEG in the
  // browser so a normal phone photo always fits, before we validate/upload.
  // Canvas re-encoding also drops EXIF (GPS, device) from anything it touches;
  // the API strips it from pass-through files too.
  const MAX_DIMENSION = 1800;                       // longest edge, px — cards never show more
  const COMPRESS_TARGET_BYTES = 900 * 1024;         // ~0.9 MB: anything bigger is re-encoded
  const PASS_THROUGH_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

  function loadImageEl(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
      img.src = url;
    });
  }

  function canvasToBlob(canvas, quality) {
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  }

  async function compressImage(file) {
    if (PASS_THROUGH_TYPES.has(file.type) && file.size <= COMPRESS_TARGET_BYTES) return file;
    let img;
    try {
      img = await loadImageEl(file);
    } catch {
      return file;
    }
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    if (!w || !h) return file;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(w, h));
    w = Math.round(w * scale);
    h = Math.round(h * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    let quality = 0.82;
    let blob = await canvasToBlob(canvas, quality);
    while (blob && blob.size > COMPRESS_TARGET_BYTES && quality > 0.5) {
      quality -= 0.08;
      blob = await canvasToBlob(canvas, quality);
    }
    if (!blob) return file;
    const base = (file.name || 'photo').replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], base + '.jpg', { type: 'image/jpeg', lastModified: Date.now() });
  }

  function setStatus(message, type) {
    statusEl.textContent = message || '';
    statusEl.className = 'form-status' + (type ? ' ' + type : '');
  }

  function field(id) {
    return document.getElementById(id);
  }

  // ── Country / State dropdowns ─────────────────────────────────────
  var COUNTRIES = ['United States','India','Canada','United Kingdom','Australia','New Zealand','Ireland',
    'Argentina','Austria','Bangladesh','Belgium','Bhutan','Brazil','Chile','China','Colombia','Croatia',
    'Czechia','Denmark','Egypt','Estonia','Fiji','Finland','France','Germany','Greece','Hungary','Iceland',
    'Indonesia','Israel','Italy','Japan','Kenya','Latvia','Lithuania','Malaysia','Mexico','Nepal',
    'Netherlands','Norway','Pakistan','Peru','Philippines','Poland','Portugal','Romania','Singapore',
    'Slovakia','Slovenia','South Africa','South Korea','Spain','Sri Lanka','Sweden','Switzerland',
    'Thailand','Turkey','Ukraine','United Arab Emirates','Vietnam'];
  var US_STATES = ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware',
    'District of Columbia','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas',
    'Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi',
    'Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York',
    'North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island',
    'South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington',
    'West Virginia','Wisconsin','Wyoming'];
  var INDIA_STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
    'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur',
    'Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
    'Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh',
    'Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'];
  // Nominatim names a few countries differently from our list.
  var COUNTRY_ALIASES = { 'United States of America': 'United States', 'USA': 'United States', 'UK': 'United Kingdom', 'Czech Republic': 'Czechia' };

  function makeOption(value, label, selected) {
    var o = document.createElement('option');
    o.value = value; o.textContent = label || value; if (selected) o.selected = true;
    return o;
  }
  function populateCountries() {
    var sel = field('country');
    sel.innerHTML = '';
    COUNTRIES.forEach(function (c) { sel.appendChild(makeOption(c, c, c === 'United States')); });
  }
  function populateRegions(country) {
    var sel = field('region');
    var wrap = document.getElementById('region-select-wrap');
    var txt = field('regionText');
    var list = country === 'United States' ? US_STATES : (country === 'India' ? INDIA_STATES : null);
    if (list) {
      sel.innerHTML = '';
      sel.appendChild(makeOption('', country === 'India' ? 'Select a state / UT' : 'Select a state'));
      list.forEach(function (s) { sel.appendChild(makeOption(s, s)); });
      wrap.hidden = false; sel.disabled = false;
      txt.hidden = true; txt.value = '';
    } else {
      wrap.hidden = true; sel.disabled = true; sel.value = '';
      txt.hidden = false;
    }
  }
  function regionValue() {
    var txt = field('regionText');
    return (!txt.hidden ? txt.value : field('region').value).trim();
  }
  function setRegionValue(value) {
    var txt = field('regionText');
    var sel = field('region');
    if (!txt.hidden) { txt.value = value; return true; }
    var match = Array.from(sel.options).find(function (o) { return o.value && o.value.toLowerCase() === String(value).toLowerCase(); });
    sel.value = match ? match.value : '';
    return !!match;
  }
  function setCountryValue(name) {
    var sel = field('country');
    var canonical = COUNTRY_ALIASES[name] || name;
    var match = COUNTRIES.find(function (c) { return c.toLowerCase() === String(canonical).toLowerCase(); });
    if (!match && canonical) {
      // Not in our short list — add it rather than forcing a wrong country.
      sel.appendChild(makeOption(canonical, canonical));
      match = canonical;
    }
    if (match) { sel.value = match; populateRegions(match); }
    return !!match;
  }
  populateCountries();
  populateRegions('United States');
  field('country').addEventListener('change', function () {
    populateRegions(field('country').value);
    touched.add('region');
    refreshReadiness();
  });

  // ── Validation model ──────────────────────────────────────────────
  // One place decides what "complete" means. The checklist by the submit
  // button, the inline messages and the submit gate all read from here, so
  // the button can never say "ready" while a field is missing.
  function parseCoord(value) {
    // Number('') is 0, which used to make an EMPTY field read as a valid
    // coordinate on the equator; blank must mean "not set".
    const raw = String(value == null ? '' : value).trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  const CHECKS = [
    { key: 'images', label: () => selectedImages.length ? ('Add ' + (MIN_IMAGES - selectedImages.length) + ' more photo' + (MIN_IMAGES - selectedImages.length === 1 ? '' : 's')) : 'Add 2 photos',
      focus: () => imageDrop,
      test: () => optimizing ? 'Still optimizing your photos.' : validateImageFiles(selectedImages) },
    { key: 'coords', label: 'Drop the pin', focus: 'lat',
      test: () => {
        const lat = parseCoord(field('lat').value);
        const lng = parseCoord(field('lng').value);
        if (lat === null || lng === null) return 'Place the pin: tap Find, Use my location, or the map.';
        if (lat < -85 || lat > 85 || lng < -180 || lng > 180) return 'Those coordinates are off the map.';
        if (Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01) return 'That pin is in the ocean off Africa. Drop it on the water you mean.';
        return '';
      } },
    { key: 'lakeName', label: 'Name the water', focus: 'lakeName',
      test: () => field('lakeName').value.trim().length >= 2 ? '' : 'Lake or water body name is required.' },
    { key: 'city', label: 'Nearest town', focus: 'city',
      test: () => field('city').value.trim().length >= 2 ? '' : 'City or nearest town is required.' },
    { key: 'region', label: 'State / region', focus: () => field('regionText').hidden ? field('region') : field('regionText'),
      test: () => regionValue().length >= 2 ? '' : 'State or region is required.' },
    { key: 'country', label: 'Country', focus: 'country',
      test: () => field('country').value.trim() ? '' : 'Country is required.' },
    { key: 'email', label: 'Your email', focus: 'email',
      test: () => {
        if (currentPreference() !== 'email') return '';
        const v = emailInput.value.trim();
        if (!v) return 'Email is required to be notified.';
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Enter a valid email address.';
      } }
  ];

  function currentPreference() {
    return form.querySelector('input[name="contactPreference"]:checked')?.value || 'anonymous';
  }

  function focusTarget(check) {
    return typeof check.focus === 'function' ? check.focus() : field(check.focus);
  }

  function showFieldMessage(key, message) {
    const msg = document.getElementById(key + '-msg');
    const wrap = form.querySelector('[data-field="' + key + '"]');
    if (msg) msg.textContent = message || '';
    if (wrap) wrap.classList.toggle('is-invalid', !!message);
    const target = CHECKS.find(c => c.key === key);
    const el = target ? focusTarget(target) : null;
    if (el && el.setAttribute) el.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  // Recompute the checklist. Inline messages appear only for touched
  // fields (or all of them once submit was attempted).
  function refreshReadiness() {
    const missing = [];
    CHECKS.forEach(check => {
      const message = check.test();
      if (message) missing.push(check);
      showFieldMessage(check.key, (submitAttempted || touched.has(check.key)) ? message : '');
    });
    todoEl.innerHTML = '';
    missing.forEach(check => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#';
      a.textContent = typeof check.label === 'function' ? check.label() : check.label;
      a.addEventListener('click', e => {
        e.preventDefault();
        touched.add(check.key);
        refreshReadiness();
        scrollToCheck(check);
      });
      li.appendChild(a);
      todoEl.appendChild(li);
    });
    const n = missing.length;
    submitBtn.classList.toggle('is-incomplete', n > 0);
    submitBtn.textContent = submitting ? 'Submitting…' : (n > 0 ? (n === 1 ? '1 item left' : n + ' items left') : 'Submit entry');
    submitBtn.setAttribute('aria-describedby', n > 0 ? 'todo' : '');
    return missing;
  }

  function scrollToCheck(check) {
    const el = focusTarget(check);
    if (!el) return;
    const wrap = el.closest('[data-field]') || el;
    wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => { try { el.focus({ preventScroll: true }); } catch (_) { el.focus(); } }, 320);
  }

  // Any interaction marks the field touched, then re-evaluates.
  form.addEventListener('input', onFieldInteraction);
  form.addEventListener('change', onFieldInteraction);
  function onFieldInteraction(e) {
    const wrap = e.target.closest('[data-field]');
    if (wrap) touched.add(wrap.getAttribute('data-field'));
    if (e.target.name === 'contactPreference') {
      const wantsEmail = e.target.value === 'email';
      emailWrap.hidden = !wantsEmail;
      if (!wantsEmail) { emailInput.value = ''; touched.delete('email'); }
    }
    refreshReadiness();
  }

  // ── Images ────────────────────────────────────────────────────────
  function validateImageFiles(files) {
    const list = Array.from(files || []);
    if (list.length < MIN_IMAGES) {
      return list.length === 0
        ? 'Add at least ' + MIN_IMAGES + ' photos: the water and the launch.'
        : 'Add ' + (MIN_IMAGES - list.length) + ' more photo' + (MIN_IMAGES - list.length === 1 ? '' : 's') + ' (' + MIN_IMAGES + ' minimum).';
    }
    if (list.length > MAX_IMAGES) return 'Up to ' + MAX_IMAGES + ' photos. Remove ' + (list.length - MAX_IMAGES) + '.';
    const invalidType = list.find(file => !ALLOWED_IMAGE_TYPES.has(file.type));
    if (invalidType) return 'Photos must be JPEG, PNG, or WebP (' + (invalidType.name || 'one file') + ' is not).';
    const oversized = list.find(file => file.size > MAX_IMAGE_BYTES);
    if (oversized) return 'Each photo must be 5 MB or smaller (' + (oversized.name || 'one file') + ' is not).';
    return '';
  }

  function syncImageInput() {
    try {
      const transfer = new DataTransfer();
      selectedImages.forEach(file => transfer.items.add(file));
      imageInput.files = transfer.files;
    } catch {
      // selectedImages is the source of truth for submit.
    }
  }

  function renderImagePreviews() {
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    previewUrls = [];
    imagePreviews.innerHTML = '';
    selectedImages.forEach((file, index) => {
      const url = URL.createObjectURL(file);
      previewUrls.push(url);
      const preview = document.createElement('span');
      preview.className = 'image-preview';
      const img = document.createElement('img');
      img.src = url;
      img.alt = 'Selected lake image ' + (index + 1);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.setAttribute('aria-label', 'Remove image ' + (index + 1));
      remove.textContent = '×';
      remove.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        selectedImages.splice(index, 1);
        syncImageInput();
        renderImagePreviews();
        touched.add('images');
        refreshReadiness();
      });
      preview.append(img, remove);
      imagePreviews.append(preview);
    });
    const n = selectedImages.length;
    imageCount.textContent = n + ' of ' + MAX_IMAGES + (n < MIN_IMAGES ? ' · ' + (MIN_IMAGES - n) + ' more needed' : '');
  }

  // Adding photos APPENDS to the current selection (so a second picker
  // ── Name suggestions ──────────────────────────────────────────────────
  // The same geocoder the Search page types into. Searching for a lake and
  // adding one are the same gesture from opposite ends, so this is the same
  // service, the same ranking and the same list — not a second implementation
  // that drifts. Pick one and the pin, the city, the state and the country
  // all arrive with it.
  const U = window.KaaykoUtil;
  const nameInput = field('lakeName');
  const nameSuggest = document.getElementById('lakeName-suggest');
  let nameOptions = [];
  let nameIndex = -1;
  let namePicked = '';

  function renderNameSuggest() {
    nameInput.setAttribute('aria-expanded', nameOptions.length ? 'true' : 'false');
    if (!nameOptions.length) { nameSuggest.hidden = true; nameSuggest.innerHTML = ''; return; }
    nameSuggest.innerHTML = nameOptions.map(function (o, i) {
      return '<div class="search-suggest-item" role="option" id="ns-' + i + '" data-i="' + i + '"' +
        ' aria-selected="' + (i === nameIndex) + '"><span>' + U.escapeHtml(o.value) + '</span>' +
        (o.water ? '<span class="tag">Water</span>' : '') + '</div>';
    }).join('');
    nameSuggest.hidden = false;
  }
  function closeNameSuggest() { nameOptions = []; nameIndex = -1; renderNameSuggest(); }

  async function pickName(option) {
    // The field asks for the water body, so it gets "Dillon Reservoir" — not
    // "Dillon Reservoir, Dillon, Summit County". The rest of that string is
    // the city/state/country, and those have their own fields below.
    const name = option.name || option.value;
    namePicked = name;
    nameInput.value = name;
    touched.add('lakeName');
    closeNameSuggest();

    // A pin lifted out of a ramp photo is a better launch point than the
    // centre of a lake polygon, so a name never overrules it — it just fills
    // in the words around it.
    if (coordsFromPhoto) {
      setStatus('Name set. The pin stays where your photo put it.', 'ok');
      refreshReadiness();
      return;
    }
    writeCoords(option.lat, option.lng);
    centerPin(option.lat, option.lng, 14);   // lake scale; the ramp is a drag away
    touched.add('coords');
    refreshReadiness();
    setStatus('Pin dropped on ' + name + '. Drag it onto the launch or boat ramp.', 'ok');
    await reverseFill(option.lat, option.lng, { overwrite: true, lock: true });
    // reverseFill takes the water name when the field is empty; it is not.
    nameInput.value = name;
    refreshReadiness();
  }

  const updateNameSuggest = U.debounce(function () {
    const q = nameInput.value.trim();
    if (q.length < 3 || q === namePicked) { closeNameSuggest(); return; }
    window.KaaykoGeo.suggest(q).then(function (list) {
      if (nameInput.value.trim() !== q) return;            // stale
      nameOptions = (list || []).slice(0, 6);
      nameIndex = -1;
      renderNameSuggest();
    }).catch(closeNameSuggest);
  }, 300);

  nameInput.addEventListener('input', function () { namePicked = ''; updateNameSuggest(); });
  nameInput.addEventListener('keydown', function (e) {
    if (!nameOptions.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      nameIndex = (nameIndex + (e.key === 'ArrowDown' ? 1 : -1) + nameOptions.length) % nameOptions.length;
      renderNameSuggest();
    } else if (e.key === 'Enter' && nameIndex >= 0) {
      e.preventDefault(); pickName(nameOptions[nameIndex]);
    } else if (e.key === 'Escape') { closeNameSuggest(); }
  });
  nameSuggest.addEventListener('mousedown', function (e) {
    // mousedown, not click: blur would close the list first.
    const item = e.target.closest('[data-i]');
    if (!item) return;
    e.preventDefault();
    pickName(nameOptions[Number(item.dataset.i)]);
  });
  nameInput.addEventListener('blur', function () { setTimeout(closeNameSuggest, 120); });

  // ── Location from the photo itself ────────────────────────────────────
  // These photos are taken standing on the ramp, so the fix baked into the
  // first one IS the launch point. Read it before compressImage re-encodes
  // the file and throws EXIF away, place the pin, and let the map do what it
  // already does: reverse-geocode the place and hand the pin back to be
  // dragged. Nothing about the upload changes — the bytes that leave the
  // browser are still stripped.
  let coordsFromPhoto = false;
  const photoFix = document.getElementById('photo-fix');
  const photoFixText = document.getElementById('photo-fix-text');

  function showPhotoFix(note) {
    if (!photoFix) return;
    photoFixText.textContent = note;
    photoFix.classList.add('visible');
  }
  function hidePhotoFix() {
    if (photoFix) photoFix.classList.remove('visible');
  }

  function fixNote(fix) {
    const bits = [];
    if (fix.takenAt) {
      bits.push('taken ' + fix.takenAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }));
    }
    if (fix.accuracyM && fix.accuracyM > 0) bits.push('\u00b1' + Math.round(fix.accuracyM) + '\u2009m');
    return 'Pin placed from your photo' + (bits.length ? ' (' + bits.join(', ') + ')' : '') + '. Drag it if the ramp is a few steps off.';
  }

  // A pin the person placed themselves always wins; a photo only fills an
  // empty launch point, or corrects one an earlier photo put there.
  function mayTakeFixFromPhoto() {
    if (coordsFromPhoto) return true;
    return !field('lat').value.trim() && !field('lng').value.trim();
  }

  async function applyPhotoFix(files) {
    if (!window.KaaykoExif || !mayTakeFixFromPhoto()) return;
    let hit = null;
    try { hit = await window.KaaykoExif.firstGps(files); } catch { return; }

    if (!hit) {
      // Only worth saying when there is still no pin to speak of.
      if (!field('lat').value.trim()) {
        showPhotoFix('No location in these photos. On an iPhone, tap \u201cOptions\u201d in the photo picker and turn Location on, or place the pin on the map below.');
      }
      return;
    }
    if (!mayTakeFixFromPhoto()) return;

    const fix = hit.fix;
    coordsFromPhoto = true;
    writeCoords(fix.lat, fix.lng);
    centerPin(fix.lat, fix.lng, 17);           // ramp scale, not lake scale
    touched.add('coords');
    refreshReadiness();
    showPhotoFix(fixNote(fix));
    await reverseFill(fix.lat, fix.lng, { overwrite: true, lock: true });
    refreshReadiness();
  }

  if (photoFix) {
    document.getElementById('photo-fix-clear').addEventListener('click', function () {
      coordsFromPhoto = false;
      field('lat').value = '';
      field('lng').value = '';
      setLocationLock(false);
      hidePhotoFix();
      refreshReadiness();
      setStatus('Location from the photo removed. Place the pin on the map instead.', '');
    });
  }

  // visit adds rather than replaces), up to the cap.
  async function addImages(files) {
    let incoming = Array.from(files || []);
    if (!incoming.length) return;
    touched.add('images');
    const room = MAX_IMAGES - selectedImages.length;
    let dropped = 0;
    if (incoming.length > room) { dropped = incoming.length - room; incoming = incoming.slice(0, Math.max(room, 0)); }

    // Before compression: the resize re-encodes through a canvas, which is
    // exactly what destroys the GPS tag we want.
    const fixPending = applyPhotoFix(incoming);

    optimizing = true;
    imageCount.textContent = 'Optimizing…';
    refreshReadiness();
    try {
      incoming = await Promise.all(incoming.map(compressImage));
    } catch {
      // fall through with whatever we have
    }
    optimizing = false;

    const rejected = incoming.filter(f => !ALLOWED_IMAGE_TYPES.has(f.type) || f.size > MAX_IMAGE_BYTES);
    const accepted = incoming.filter(f => !rejected.includes(f));
    selectedImages = selectedImages.concat(accepted);
    syncImageInput();
    renderImagePreviews();
    refreshReadiness();
    try { await fixPending; } catch { /* the pin is still the user's to place */ }

    if (rejected.length) {
      showFieldMessage('images', rejected.length + ' photo' + (rejected.length === 1 ? ' was' : 's were') + ' skipped: not JPEG/PNG/WebP or over 5 MB.');
    } else if (dropped) {
      showFieldMessage('images', 'Only ' + MAX_IMAGES + ' photos allowed; ' + dropped + ' skipped.');
    }
  }

  imageInput.addEventListener('change', function () {
    addImages(imageInput.files);
    imageInput.value = '';
  });
  imageDrop.addEventListener('dragover', function (event) {
    event.preventDefault();
    imageDrop.classList.add('dragging');
  });
  imageDrop.addEventListener('dragleave', function () {
    imageDrop.classList.remove('dragging');
  });
  imageDrop.addEventListener('drop', function (event) {
    event.preventDefault();
    imageDrop.classList.remove('dragging');
    addImages(event.dataTransfer.files);
  });
  imageDrop.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); imageInput.click(); }
  });

  // ── Location: geocode, reverse geocode, lock ───────────────────────
  function applyUrlPrefill() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('name')) field('lakeName').value = params.get('name');
    if (params.get('lat')) field('lat').value = params.get('lat');
    if (params.get('lng')) field('lng').value = params.get('lng');
    if (params.get('place')) {
      const parts = params.get('place').split(',').map(part => part.trim()).filter(Boolean);
      if (parts[0]) field('city').value = parts[0];
      if (parts[1]) setRegionValue(parts[1]);
    }

    // Arriving from Search with a coordinate already in hand, the city, state
    // and country are derivable — so derive them. Asking someone to type what
    // we can read off the pin they just handed us is the difference between a
    // handoff and a second form. Blanks only: an explicit ?place= wins.
    const la = parseCoord(field('lat').value), ln = parseCoord(field('lng').value);
    if (la !== null && ln !== null) {
      touched.add('coords');
      reverseFill(la, ln, { overwrite: false, lock: true }).then(function () {
        centerPin(la, ln, 14);
        refreshReadiness();
      });
    }
  }

  // Fill city / region / country from a Nominatim address block. Only
  // overwrites when `overwrite` is set (Use my location) — Find fills blanks.
  function fillPlace(place, overwrite) {
    if (!place) return false;
    let filled = 0;
    if (place.country && (overwrite || !field('country').value)) { if (setCountryValue(place.country)) filled++; }
    if (place.region && (overwrite || !regionValue())) { if (setRegionValue(place.region)) filled++; }
    if (place.city && (overwrite || !field('city').value.trim())) { field('city').value = place.city; filled++; }
    ['city', 'region', 'country'].forEach(k => touched.add(k));
    return filled > 0;
  }

  function setLocationLock(on, note) {
    locationLocked = on;
    ['city', 'region', 'country'].forEach(key => {
      const wrap = form.querySelector('[data-field="' + key + '"]');
      if (wrap) wrap.classList.toggle('locked', on);
      wrap.querySelectorAll('input, select').forEach(el => {
        if (el.tagName === 'SELECT') el.disabled = on || (el.id === 'region' && field('regionText').hidden === false);
        else el.readOnly = on;
      });
    });
    if (on && note) locLockText.textContent = note;
    locLock.classList.toggle('visible', on);
  }

  document.getElementById('loc-unlock').addEventListener('click', function () {
    setLocationLock(false);
    populateRegions(field('country').value);
    setStatus('Place fields unlocked. Edit anything that looks off.', '');
    field('city').focus();
  });

  // ── Place fill (reverse geocode) — one service, one map ───────────────
  let reverseSeq = 0;
  async function reverseFill(lat, lng, opts) {
    opts = opts || {};
    const seq = ++reverseSeq;
    const place = await window.KaaykoGeo.reverse(lat, lng);
    if (seq !== reverseSeq || !place) return null;      // superseded or unknown
    const changed = fillPlace(place, !!opts.overwrite);
    if (opts.lock) {
      const parts = [place.city, place.region, place.country].filter(Boolean).join(', ');
      setLocationLock(true, parts ? 'Filled from the pin: ' + parts : 'Place filled from the pin');
    }
    if (place.water && !field('lakeName').value.trim()) { field('lakeName').value = place.water; touched.add('lakeName'); }
    refreshReadiness();
    return changed ? place : null;
  }

  async function inferCoordinates() {
    const query = [field('lakeName').value, field('city').value, regionValue(), field('country').value]
      .map(v => v.trim()).filter(Boolean).join(', ');
    if (!query) { setStatus('Add the lake name and place first.', 'error'); return false; }
    setStatus('Finding coordinates…', '');
    const geo = await window.KaaykoGeo.forward(query);
    if (!geo) { setStatus('No match for that name. Tap the map to place the pin, or use your location.', 'error'); return false; }
    writeCoords(geo.lat, geo.lng);
    centerPin(geo.lat, geo.lng, 14);
    fillPlace(geo.address, false);
    touched.add('coords'); refreshReadiness();
    setStatus('Pin dropped. Drag it to the exact launch or boat ramp.', 'ok');
    return true;
  }

  document.getElementById('find-coords').addEventListener('click', inferCoordinates);

  // "Use my location" — opt-in, one-shot. Read once, place the pin, fill
  // the place fields from the coordinate, lock them so they can't drift
  // from the pin. Never watched, never stored beyond what is submitted.
  var useLocBtn = document.getElementById('use-location');
  useLocBtn.addEventListener('click', function () {
    if (!navigator.geolocation || window.isSecureContext === false) {
      setStatus('Location needs a secure (https) connection. Use Find, or tap the map instead.', 'error');
      return;
    }
    function requestOnce() {
      var label = useLocBtn.textContent;
      useLocBtn.disabled = true; useLocBtn.textContent = 'Locating…';
      setStatus('Reading your location once to place the pin.', '');
      navigator.geolocation.getCurrentPosition(
        async function (pos) {
          useLocBtn.disabled = false; useLocBtn.textContent = label;
          var la = pos.coords.latitude, ln = pos.coords.longitude, acc = Math.round(pos.coords.accuracy || 0);
          writeCoords(la, ln); centerPin(la, ln, acc > 500 ? 12 : 15);
          touched.add('coords'); refreshReadiness();
          setStatus('Pin placed. Looking up the place…', '');
          const place = await reverseFill(la, ln, { overwrite: true, lock: true });
          setStatus(place
            ? (acc && acc > 150 ? 'Approximate fix (±' + acc + ' m). ' : '') + 'Place filled in. Drag the pin onto the exact put-in, then add photos.'
            : 'Pin placed. Could not look up the place name; fill city, state and country by hand.', place ? 'ok' : '');
        },
        function (err) {
          useLocBtn.disabled = false; useLocBtn.textContent = label;
          setStatus(err && err.code === 1 ? 'No problem, location stays private. Use Find, or tap the map to place the pin.'
            : err && err.code === 3 ? 'Location timed out. Use Find, or tap the map to place the pin.'
            : 'Couldn’t get your location. Use Find, or tap the map to place the pin.', 'error');
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    }
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' })
        .then(function (st) { if (st.state === 'denied') setStatus('Location is blocked for this site in your browser settings. Use Find, or tap the map instead.', 'error'); else requestOnce(); })
        .catch(requestOnce);
    } else requestOnce();
  });

  // ── Map: the shared PinPicker (tap to place, drag to fine-tune) ─────────
  var picker = null;
  function writeCoords(lat, lng) {
    field('lat').value = Number(lat).toFixed(5);
    field('lng').value = Number(lng).toFixed(5);
  }
  // When the place fields are locked to the pin, a moved pin re-derives
  // them (debounced) so city/state never disagree with the coordinate.
  let pinMoveTimer = null;
  function onPinMoved(lat, lng, message) {
    touched.add('coords'); refreshReadiness(); setStatus(message, 'ok');
    if (!locationLocked) return;
    clearTimeout(pinMoveTimer);
    pinMoveTimer = setTimeout(function () { reverseFill(lat, lng, { overwrite: true, lock: true }); }, 700);
  }
  function centerPin(lat, lng, zoom) { if (picker) picker.setPin(lat, lng, { zoom: zoom || 14 }); }
  function initMap() {
    var el = document.getElementById('pin-map');
    if (!el || !window.PinPicker) { if (el) el.style.display = 'none'; return; }
    var lat0 = parseCoord(field('lat').value), lng0 = parseCoord(field('lng').value);
    var has = lat0 !== null && lng0 !== null;
    picker = window.PinPicker.create(el, {
      center: has ? [lat0, lng0] : [39.5, -98.35], zoom: has ? 13 : 4,
      pickable: true, draggable: true, scrollWheelZoom: false,
      onPick: function (lat, lng, how) {
        writeCoords(lat, lng);
        onPinMoved(lat, lng, how === 'drag' ? 'Pin moved. Coordinates updated.' : 'Pin placed. Coordinates updated.');
        if (how === 'tap') picker.setPin(lat, lng, {});
      }
    });
    if (has) picker.setPin(lat0, lng0, {});
  }
  ['lat', 'lng'].forEach(function (id) {
    field(id).addEventListener('change', function () {
      var la = parseCoord(field('lat').value), ln = parseCoord(field('lng').value);
      if (la !== null && ln !== null) { centerPin(la, ln, 13); if (locationLocked) onPinMoved(la, ln, 'Coordinates updated.'); }
    });
  });

  // ── Submit ────────────────────────────────────────────────────────
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (submitting) return;
    submitAttempted = true;
    const missing = refreshReadiness();
    if (missing.length) {
      setStatus(missing.length === 1 ? 'One thing still needed.' : missing.length + ' things still needed.', 'error');
      scrollToCheck(missing[0]);
      return;
    }

    const lat = parseCoord(field('lat').value);
    const lng = parseCoord(field('lng').value);
    const preference = currentPreference();

    const payload = new FormData();
    payload.append('lakeName', field('lakeName').value.trim());
    payload.append('city', field('city').value.trim());
    payload.append('region', regionValue());
    payload.append('country', field('country').value.trim());
    payload.append('lat', String(lat));
    payload.append('lng', String(lng));
    payload.append('launchHint', field('launchHint').value.trim());
    payload.append('description', field('description').value.trim());
    payload.append('parkingAvl', field('parkingAvl').value);
    payload.append('restroomsAvl', field('restroomsAvl').value);
    payload.append('contactPreference', preference);
    payload.append('anonymous', preference !== 'email' ? 'true' : 'false');
    payload.append('email', preference === 'email' ? emailInput.value.trim() : '');
    payload.append('website', form.querySelector('input[name="website"]').value);
    payload.append('pageUrl', window.location.href);
    payload.append('referrer', document.referrer);
    payload.append('source', 'paddlingout_submitentry');
    selectedImages.forEach(file => payload.append('images', file, file.name));

    submitting = true;
    submitBtn.disabled = true;
    refreshReadiness();
    setStatus('Uploading ' + selectedImages.length + ' photos…', '');
    try {
      const res = await fetch(API_BASE + '/paddlingOut/submitEntry', { method: 'POST', body: payload });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || (res.status === 429
          ? 'Daily submission limit reached. Try again tomorrow.'
          : res.status === 409 ? 'This entry was already submitted recently.' : 'Submission failed. Please try again.'));
      }

      form.closest('.submit-card').style.display = 'none';
      successCopy.textContent = preference === 'email'
        ? 'Your entry is in the review queue. We will email you when it is live, or if we cannot use it.'
        : 'Your entry is in the review queue. It will appear on the map once a person has checked it.';
      successPanel.classList.add('visible');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      submitting = false;
      submitBtn.disabled = false;
      refreshReadiness();
      setStatus(err.message || 'Could not submit entry.', 'error');
    }
  });

  applyUrlPrefill();
  initMap();
  renderImagePreviews();
  refreshReadiness();
}());
