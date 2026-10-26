/**
 * inspect/inspect3d.js — hold a mug or a magnet and turn it over, the way the home
 * page's cards are held (24 Oct 2026).
 *
 * The same hand as the cards (js/pages/card.js, js/cards/attitude.js):
 *   - a drag turns it at once, a rigid body under the finger, both ways at once —
 *     side to side and up and down, on a phone exactly as under a mouse;
 *   - let go and it coasts on the finger's last angular speed, then settles on the
 *     same critically damped spring (smoothDamp);
 *   - a mug is round: it spins as far as you throw it, and tips so you can look in;
 *   - a magnet has nothing printed on its back, so it never turns round (Rohan, 24 Oct
 *     2026): it tilts in the light up to MAG_YAW / MAG_PITCH, the last stretch of that
 *     against a rubber band, and springs back to face you; a tap rocks it toward the
 *     finger;
 *   - a bottle is round too: it spins freely so the stamp can be read all the way round;
 *   - turning winds you in: the further the finger travels in one hold, the closer the
 *     camera comes to the printed design (up to ZOOM_MAX), and letting go eases it back
 *     out to the whole object (Rohan, 24 Oct 2026);
 *   - holding still lifts it a little.
 * On a phone a near-vertical swipe still scrolls the page (a page whose picture can
 * never be scrolled past is a trap); anything wider than SCROLL_RATIO takes the object,
 * and so does a hold.
 *
 * Real 3D (three.js, vendored at /js/vendor/three), lit by a studio drawn here — a
 * softbox high on the left, a strip light behind on the right — the same light as the
 * product photographs, so the photo and the object agree. Textures are made by
 * scripts/store_uploader/inspect_textures.py from the code that drew the photographs.
 *
 *   const stage = await mountInspect(el, { kind: 'mug', wrap: url, title });
 *   const stage = await mountInspect(el, { kind: 'magnet', faces: {round, square}, shape: 'round', title });
 *   const stage = await mountInspect(el, { kind: 'bottle', wrap: url, title });
 *   stage.setShape('square'); stage.destroy();
 */
import * as THREE from '/js/vendor/three/three.module.min.js';
import { smoothDamp, clamp } from '/js/cards/attitude.js';

const GAIN = 0.45;            // degrees per pixel of drag
const SETTLE = 0.46;          // seconds — the cards' INSPECT_SETTLE
const HOLD_MS = 240;          // holding still this long lifts it (the cards' HOLD_MS)
const SLOP = 8;               // px before a press is a turn rather than a tap
const MUG_PITCH = 34;         // how far a mug tips toward / away from you
const MAG_YAW = 50;           // how far a magnet tilts side to side — never far enough to show its back
const MAG_PITCH = 40;         // and up and down
const SCROLL_RATIO = 0.7;     // a touch drag with |dx| < 0.7·|dy| (within ~35° of vertical) is the page scrolling
const WIND = 140;             // degrees of finger travel that take the zoom ~63% of the way in
const ZOOM_MAX = { mug: 1.8, bottle: 2.3, magnet: 1.5 };
const D2R = Math.PI / 180;

/* ── the studio ────────────────────────────────────────────────────────────────
   An equirectangular picture of the room the object sits in, for the glaze to
   reflect: a big softbox up on the left, a narrow strip behind on the right, a
   pale ceiling, a darker floor. Drawn on a canvas — no image to fetch.          */
function studio(renderer) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, '#d9d7d2'); sky.addColorStop(0.5, '#bdbab4'); sky.addColorStop(0.62, '#8f8c87'); sky.addColorStop(1, '#5f5d59');
  g.fillStyle = sky; g.fillRect(0, 0, 1024, 512);
  const box = (x, y, w, h, a) => {
    const r = g.createRadialGradient(x + w / 2, y + h / 2, 4, x + w / 2, y + h / 2, Math.max(w, h) * 0.7);
    r.addColorStop(0, `rgba(255,255,255,${a})`); r.addColorStop(0.55, `rgba(255,255,255,${a * 0.85})`); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(x - w * 0.3, y - h * 0.3, w * 1.6, h * 1.6);
  };
  // equirect x: 512 is straight ahead (+z, behind the camera's view of the object
  // is 0/1024). The key sits up and to the front-left, the strip behind on the right.
  box(300, 120, 170, 150, 1.0);     // key softbox, front-left, high
  box(760, 150, 46, 220, 0.9);      // strip, behind-right
  box(470, 30, 260, 50, 0.5);       // ceiling bounce
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromEquirectangular(tex).texture;
  tex.dispose(); pm.dispose();
  return env;
}

const loadTexture = (url) => new Promise((resolve, reject) => {
  new THREE.TextureLoader().load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; resolve(t); }, undefined, reject);
});

/* ── the mug: 82 mm across, 95 mm tall, an ear handle on the right ──────────── */
function buildMug(wrap) {
  const R = 41, H = 95, T = 3.6;                       // radius, height, wall
  const group = new THREE.Group();
  const glaze = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.0 });
  const printed = glaze.clone(); printed.map = wrap;
  // the outer wall carries the print; u=0.5 (the print's centre) faces the camera
  const wall = new THREE.CylinderGeometry(R, R, H - 6, 160, 1, true, Math.PI, Math.PI * 2);
  const outer = new THREE.Mesh(wall, printed); outer.position.y = H / 2; group.add(outer);
  // the rest of the body, turned on a lathe: foot bevel, rounded lip, inner wall, floor
  const p = [];
  p.push(new THREE.Vector2(0.01, 0), new THREE.Vector2(R - 4, 0), new THREE.Vector2(R - 1.2, 0.6), new THREE.Vector2(R, 3.01));
  const lip = [];
  for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI; lip.push(new THREE.Vector2(R - T / 2 + (T / 2) * Math.cos(a), H - 3 + 3 * Math.sin(a) * 0.9)); }
  const body = new THREE.LatheGeometry([new THREE.Vector2(R, H - 3.01), ...lip, new THREE.Vector2(R - T, H - 6), new THREE.Vector2(R - T, 9), new THREE.Vector2(R - T - 2, 7), new THREE.Vector2(0.01, 7)], 160);
  const foot = new THREE.LatheGeometry(p, 160);
  group.add(new THREE.Mesh(body, glaze), new THREE.Mesh(foot, glaze));
  // the handle: a tube along an ear-shaped curve, thicker where it leaves the top
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(R - 2, 74, 0), new THREE.Vector3(R + 14, 79, 0), new THREE.Vector3(R + 25, 64, 0),
    new THREE.Vector3(R + 25, 40, 0), new THREE.Vector3(R + 16, 22, 0), new THREE.Vector3(R - 2, 21, 0),
  ]);
  const tube = new THREE.TubeGeometry(curve, 140, 5.4, 28, false);
  const pos = tube.attributes.position; const n = 141, rs = 29;   // taper: radius 5.4 at the top to 4.3 at the foot
  for (let i = 0; i < n; i++) {
    const c0 = curve.getPointAt(i / 140); const k = 1 - 0.2 * (i / 140);
    for (let j = 0; j < rs; j++) {
      const idx = i * rs + j;
      pos.setXYZ(idx, c0.x + (pos.getX(idx) - c0.x) * k, c0.y + (pos.getY(idx) - c0.y) * k, c0.z + (pos.getZ(idx) - c0.z) * k);
    }
  }
  tube.computeVertexNormals();
  group.add(new THREE.Mesh(tube, glaze));
  group.position.y = -H / 2;                        // turn about the mug's middle
  const pivot = new THREE.Group(); pivot.add(group);
  return { pivot, size: 150, materials: [glaze, printed], disposables: [wall, body, foot, tube] };
}

/* ── the magnet: a printed face, a thin cream edge, a dark magnetic back ─────── */
function faceShape(shape, h) {
  const s = new THREE.Shape();
  if (shape === 'round') { s.absarc(0, 0, h, 0, Math.PI * 2, false); return s; }
  const r = h * 0.12;                                // magnet_gallery.RECT_RADIUS
  s.moveTo(-h + r, -h); s.lineTo(h - r, -h); s.quadraticCurveTo(h, -h, h, -h + r);
  s.lineTo(h, h - r); s.quadraticCurveTo(h, h, h - r, h); s.lineTo(-h + r, h);
  s.quadraticCurveTo(-h, h, -h, h - r); s.lineTo(-h, -h + r); s.quadraticCurveTo(-h, -h, -h + r, -h);
  return s;
}

function planarUV(geo, h) {
  const p = geo.attributes.position; const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / (2 * h) + 0.5; uv[i * 2 + 1] = p.getY(i) / (2 * h) + 0.5; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function backTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#26262a'; g.fillRect(0, 0, 512, 512);
  g.fillStyle = 'rgba(255,255,255,0.07)'; g.font = '600 34px "Josefin Sans", Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (g.letterSpacing !== undefined) g.letterSpacing = '9px';
  g.fillText('KAAYKO', 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function buildMagnet(face, shape) {
  const h = 38, d = 3.4;                           // 76 mm across, 3.4 mm thick
  const pivot = new THREE.Group();
  const sh = faceShape(shape, h);
  const edge = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelSegments: 4, curveSegments: 96 });
  edge.translate(0, 0, -d / 2);
  const edgeMat = new THREE.MeshPhysicalMaterial({ color: 0xf3f1ec, roughness: 0.55 });
  const front = new THREE.ShapeGeometry(sh, 96); planarUV(front, h); front.translate(0, 0, d / 2 + 0.51);
  // planar UVs taken before the half-turn: the turn itself un-mirrors the back
  const back = new THREE.ShapeGeometry(sh, 96); planarUV(back, h); back.rotateY(Math.PI); back.translate(0, 0, -d / 2 - 0.51);
  const frontMat = new THREE.MeshPhysicalMaterial({ map: face, roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.12 });
  const bt = backTexture();
  const backMat = new THREE.MeshStandardMaterial({ map: bt, roughness: 0.92, metalness: 0 });
  pivot.add(new THREE.Mesh(edge, edgeMat), new THREE.Mesh(front, frontMat), new THREE.Mesh(back, backMat));
  return { pivot, size: 92, materials: [edgeMat, frontMat, backMat], disposables: [edge, front, back, bt] };
}

/* ── the bottle: a 20 oz steel bottle, white satin coat, a stamp wrapped round it ──
   Rebuilt 25 Oct 2026 after Rohan found the first one "ordinary". What makes the real
   bottle read as one, from the product photographs at full size:
     - a polished steel cap, a touch wider at its rim than at its foot, with a softly
       domed top — mirror steel only reads as steel when it reflects strong lights
       against dark gaps, so the bottle gets its own studio (studioRoom, below);
     - a short white neck with a bead under the cap, and a broad, soft milk-bottle
       shoulder (an ogee, not a quarter circle);
     - a satin white coat with long vertical highlights from strip lights, the print
       under the same light;
     - a real shadow on the floor and a tight contact shadow where it stands.
   The print is the stamp scan itself, never stretched, on a fixed-width wrap (see the
   band, below). */
function bezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return new THREE.Vector2(
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]);
}

function buildBottle(stamp) {
  // Proportions from the photographs (25 Oct 2026): 3.9 diameters tall with the cap; the
  // cap 0.67 across on a neck nearly as wide; the shoulder full by a quarter of the way
  // down. (The first build was 4.37 tall with a thin neck and read as a wine bottle.)
  const R = 35, C = 2 * Math.PI * R, WALL_TOP = 202, TOP = 271.5;
  const group = new THREE.Group();
  const coat = new THREE.MeshPhysicalMaterial({ color: 0xf7f7f4, roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.14 });
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xe4e4e0, metalness: 1, roughness: 0.2, envMapIntensity: 1.2 });
  // the body on a lathe: a rounded foot, the straight wall, the ogee shoulder, the neck and its bead
  const prof = [[0.01, 1.0], [R - 8, 0.5], [R - 4.5, 0.12], [R - 2.2, 0.8], [R - 0.7, 2.4], [R, 5.2], [R, WALL_TOP]].map(([r, y]) => new THREE.Vector2(r, y));
  for (let k = 1; k <= 30; k++) prof.push(bezier([R, WALL_TOP], [R, 228], [21, 230], [20.5, 242], k / 30));
  [[20.5, 244.5], [21.3, 245.1], [21.6, 246.2], [21.3, 247.3], [20.4, 247.7], [20.4, 249.5], [0.01, 249.5]].forEach(([r, y]) => prof.push(new THREE.Vector2(r, y)));
  const body = new THREE.LatheGeometry(prof, 192);
  // the cap: a steel shell, flaring a little to a rolled rim, domed on top
  const capP = [[20.2, 248.2], [22.6, 248.2], [23.05, 248.7], [23.25, 249.6], [23.35, 262], [23.7, 266.8], [23.85, 268],
    [23.65, 269.4], [23.0, 270.2], [20.8, 270.8], [12, 271.3], [0.01, TOP]].map(([r, y]) => new THREE.Vector2(r, y));
  const cap = new THREE.LatheGeometry(capP, 160);
  // the stamp: a print-on-demand wrap is a fixed WIDTH — three quarters of the way round
  // (every photograph shows white coat at the back and a stamp edge at the side) — and the
  // stamp's own proportions set its height, so a wide stamp is a short band and the portrait
  // Aerial Post a tall panel, as the photographs show; never stretched. Centred 47% up.
  const aspect = stamp.image.width / stamp.image.height;
  const ARC = 0.75;
  const h = Math.min((ARC * C) / aspect, WALL_TOP - 14);
  const f = (h * aspect) / C;                           // how far round it goes
  const mid = Math.max(9 + h / 2, Math.min(0.47 * TOP, WALL_TOP - 2 - h / 2));
  const wall = new THREE.CylinderGeometry(R + 0.08, R + 0.08, h, 192, 1, true, -Math.PI * f, 2 * Math.PI * f);
  const printed = coat.clone(); printed.map = stamp;   // the stamp already sits on the coat's white
  const meshes = [new THREE.Mesh(body, coat), new THREE.Mesh(cap, steel), new THREE.Mesh(wall, printed)];
  meshes[2].position.y = mid;
  meshes.forEach((m) => { m.castShadow = true; group.add(m); });
  group.position.y = -TOP / 2;                      // turn about the bottle's middle
  const pivot = new THREE.Group(); pivot.add(group);
  return { pivot, size: TOP + 6, focusY: mid - TOP / 2, base: -TOP / 2, materials: [coat, steel, printed], disposables: [body, cap, wall] };
}

/* ── the bottle's studio ───────────────────────────────────────────────────────
   A room for the bottle to reflect, rendered once into an environment map: dark walls,
   a pale floor, and area lights the way a product photographer sets them — a tall
   strip softbox front-left (the long highlight down the coat), a hotter strip
   behind-right (the bright edge that separates the silhouette), a kicker behind-left,
   an overhead box (the cap's top) and a dim card behind the camera. Built from planes,
   like three's RoomEnvironment, so nothing is fetched. */
function studioRoom(renderer) {
  const room = new THREE.Scene();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(24, 14, 24), new THREE.MeshBasicMaterial({ color: 0x34322f, side: THREE.BackSide }));
  walls.position.y = 3; room.add(walls);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshBasicMaterial({ color: 0xb9b6b0 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -3.9; room.add(floor);
  const light = (w, h, x, y, z, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    m.material.color.setScalar(k); m.position.set(x, y, z); m.lookAt(0, 0, 0); room.add(m);
  };
  light(2.6, 9, -7, 2, 3.6, 8);       // key strip, front-left
  light(1.3, 9, 7.6, 2, -2.6, 13);    // rim strip, behind-right
  light(1.0, 8, -6.4, 2, -5, 4);      // kicker, behind-left
  light(9, 6, 0, 9.6, 1.2, 3.2);      // overhead
  light(12, 5, 0, 1, 11.6, 0.9);      // fill card behind the camera
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(room, 0.025).texture;
  pm.dispose();
  room.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
  return env;
}

/* ── the stage ──────────────────────────────────────────────────────────────── */
export async function mountInspect(host, opts) {
  const kind = opts.kind;
  const canvas = document.createElement('canvas');
  canvas.className = 'insp-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `${opts.title || 'The piece'} in 3D. Drag to ${kind === 'magnet' ? 'tilt it in the light' : 'turn it'}; turning draws you in to the design. The arrow keys turn it too.`);
  canvas.tabIndex = 0;
  host.appendChild(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (_) { canvas.remove(); return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.12;
  const scene = new THREE.Scene();
  host.classList.add(`kind-${kind}`);
  const bottle = kind === 'bottle';
  scene.environment = bottle ? studioRoom(renderer) : studio(renderer);
  const keyLight = new THREE.DirectionalLight(0xffffff, bottle ? 1.3 : 1.1);
  if (bottle) {
    // the key casts a real shadow on the floor: high and soft, the way a studio box
    // throws one — short and pale, not a late-afternoon wedge
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;    // PCF honours radius (the blur); PCFSoft does not
    keyLight.position.set(-120, 560, 260);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    Object.assign(keyLight.shadow.camera, { left: -300, right: 300, top: 300, bottom: -300, near: 100, far: 1400 });
    keyLight.shadow.radius = 14; keyLight.shadow.blurSamples = 16; keyLight.shadow.bias = -0.0004;
  } else {
    keyLight.position.set(-1.1, 1.3, 1.4);
  }
  scene.add(keyLight);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8782, bottle ? 0.18 : 0.35));
  let catcher = null;
  if (bottle) {
    catcher = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.ShadowMaterial({ opacity: 0.13 }));
    catcher.rotation.x = -Math.PI / 2; catcher.receiveShadow = true; scene.add(catcher);
  }
  const camera = new THREE.PerspectiveCamera(bottle ? 23 : 26, 1, 1, 3000);

  // the object
  let obj, shape = opts.shape || 'round';
  const faces = {};
  async function build() {
    if (obj) { scene.remove(obj.pivot); obj.disposables.forEach((x) => x.dispose()); obj.materials.forEach((m) => m.dispose()); }
    if (kind === 'mug') obj = buildMug(await loadTexture(opts.wrap));
    else if (kind === 'bottle') obj = buildBottle(await loadTexture(opts.wrap));
    else {
      faces[shape] = faces[shape] || await loadTexture(opts.faces[shape]);
      obj = buildMagnet(faces[shape], shape);
    }
    scene.add(obj.pivot);
    if (obj.base !== undefined) {                   // the floor sits where the bottle stands
      if (catcher) catcher.position.y = obj.base - 0.1;
      if (floor) floor.position.y = obj.base + 0.2;
    }
    fit();
  }

  // a soft contact shadow under a mug or a bottle, so it stands on something
  let floor = null;
  if (kind === 'mug' || kind === 'bottle') {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'); const r = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    r.addColorStop(0, 'rgba(0,0,0,0.42)'); r.addColorStop(0.55, 'rgba(0,0,0,0.16)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, 256, 256);
    const ft = new THREE.CanvasTexture(c);
    const span = kind === 'mug' ? 150 : 96;          // the bottle's is a tight contact shadow; its cast shadow is real
    floor = new THREE.Mesh(new THREE.PlaneGeometry(span, span), new THREE.MeshBasicMaterial({ map: ft, transparent: true, depthWrite: false }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = kind === 'mug' ? -47.6 : -152.6; scene.add(floor);
  }

  // camera: a little above, telephoto, framed to the host
  const restPitch = 0;
  const round = kind !== 'magnet';                   // mugs and bottles spin freely
  const basePos = new THREE.Vector3(), baseLook = new THREE.Vector3(), focus = new THREE.Vector3(), look = new THREE.Vector3();
  function fit() {
    const w = host.clientWidth || 400, hgt = host.clientHeight || w;
    renderer.setSize(w, hgt, false);
    camera.aspect = w / hgt;
    // the bottle is tall: fit its height; the others fit whichever side is tighter
    // the bottle stands tall in its frame, the way a product shot frames it
    const dist = (obj ? obj.size : 120) / 2 / Math.tan((camera.fov * D2R) / 2) / (kind === 'bottle' ? 1 : Math.min(1, camera.aspect)) * (kind === 'bottle' ? 1.07 : 1.12);
    const lift = kind === 'mug' ? 0.32 : kind === 'bottle' ? 0.08 : 0.0;
    basePos.set(0, dist * lift, dist);
    baseLook.set(0, kind === 'mug' ? -3 : 0, 0);
    focus.set(0, obj?.focusY ?? 0, 0);              // where the winding-in aims: the print
    camera.updateProjectionMatrix();
    place();
    wake();
  }
  // the camera at the current zoom: closer by 1/zoom, aimed from the whole object toward
  // the print, and levelling off as it comes in — from above, a close mug shows you its
  // inside, not its design
  const offset = new THREE.Vector3();
  function place() {
    const k = (zoom - 1) / Math.max(0.001, zMax - 1);
    look.copy(baseLook).lerp(focus, k);
    offset.copy(basePos).sub(baseLook); offset.y *= 1 - 0.85 * k;
    camera.position.copy(offset).multiplyScalar(1 / zoom).add(look);
    camera.lookAt(look);
  }

  /* motion: yaw (unbounded) and pitch (bounded), each on its own spring */
  const yaw = { a: kind === 'mug' ? -18 : 0, t: kind === 'mug' ? -18 : 0, v: { v: 0 } };
  const zMax = ZOOM_MAX[kind] || 1.5;
  let zoom = 1; const zoomV = { v: 0 };
  const pitch = { a: restPitch, t: restPitch, v: { v: 0 } };
  const lean = { x: 0, y: 0 };
  const grab = { on: false, lifted: false, id: null, x: 0, y: 0, t: 0, wx: 0, wy: 0, ry: 0, rp: 0, sx: 0, sy: 0, moved: 0, timer: 0, wind: 0 };
  const maxPitch = round ? MUG_PITCH : MAG_PITCH;
  const maxYaw = round ? Infinity : MAG_YAW;
  // the rubber band: the finger's raw angle maps onto lim·tanh(raw/lim) — free near the
  // middle, stiffer toward the limit, never past it
  const band = (raw, lim) => (lim === Infinity ? raw : lim * Math.tanh(raw / lim));
  const unband = (a, lim) => (lim === Infinity ? a : lim * Math.atanh(clamp(a / lim, 0.999)));
  let raf = 0, last = 0, lift = 0, liftV = { v: 0 };

  function draw(t) {
    raf = 0;
    const dt = last ? Math.min(0.25, (t - last) / 1000) : 1 / 60; last = t;
    if (!grab.on) {
      yaw.a = smoothDamp(yaw.a, yaw.t + lean.x, yaw.v, SETTLE, dt);
      pitch.a = smoothDamp(pitch.a, pitch.t + lean.y, pitch.v, SETTLE, dt);
      if (kind === 'magnet') {          // a hard throw must not carry it round to its back
        yaw.a = clamp(yaw.a, maxYaw * 1.08); pitch.a = clamp(pitch.a, maxPitch * 1.08);
      }
    }
    lift = smoothDamp(lift, grab.on ? 1 : 0, liftV, 0.14, dt);
    const zoomTo = grab.on ? 1 + (zMax - 1) * (1 - Math.exp(-grab.wind / WIND)) : 1;
    zoom = smoothDamp(zoom, zoomTo, zoomV, grab.on ? 0.3 : 0.55, dt);
    place();
    if (obj) {
      // 'XYZ': spin about the object's own axis first, then tip about the SCREEN's
      // horizontal, so a tip always comes toward you whichever way it has been spun
      obj.pivot.rotation.set(pitch.a * D2R, yaw.a * D2R, 0, 'XYZ');
      const s = 1 + 0.035 * lift; obj.pivot.scale.setScalar(s);
      obj.pivot.position.y = 2.5 * lift;
    }
    if (floor) floor.material.opacity = 1 - 0.35 * lift;
    renderer.render(scene, camera);
    const moving = grab.on || Math.abs(yaw.a - (yaw.t + lean.x)) > 0.02 || Math.abs(pitch.a - (pitch.t + lean.y)) > 0.02
      || Math.abs(yaw.v.v) > 0.05 || Math.abs(pitch.v.v) > 0.05 || Math.abs(lift - (grab.on ? 1 : 0)) > 0.002
      || Math.abs(zoom - zoomTo) > 0.002 || Math.abs(zoomV.v) > 0.002;
    if (moving) raf = requestAnimationFrame(draw);
    else last = 0;
  }
  function wake() { if (!raf) raf = requestAnimationFrame(draw); }

  /* the hand */
  function take(e) {
    grab.on = true; grab.id = e.pointerId; grab.x = e.clientX; grab.y = e.clientY; grab.t = performance.now();
    grab.wx = grab.wy = 0; grab.wind = 0;
    grab.ry = unband(yaw.a, maxYaw); grab.rp = unband(pitch.a, maxPitch);
    grab.trail = [[performance.now(), grab.ry, grab.rp]];   // where the throw is measured from
    yaw.t = yaw.a; pitch.t = pitch.a; yaw.v.v = pitch.v.v = 0; lean.x = lean.y = 0;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    host.classList.add('is-held'); wake();
  }
  function down(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    grab.sx = e.clientX; grab.sy = e.clientY; grab.moved = 0; grab.id = e.pointerId; grab.lifted = false;
    if (e.pointerType === 'mouse') { take(e); return; }
    clearTimeout(grab.timer);
    grab.timer = setTimeout(() => { if (!grab.on && grab.id === e.pointerId) { grab.lifted = true; take({ pointerId: e.pointerId, clientX: grab.sx, clientY: grab.sy }); try { navigator.vibrate?.(8); } catch (_) {} } }, HOLD_MS);
  }
  function move(e) {
    if (e.pointerId !== grab.id) { if (e.pointerType === 'mouse' && !grab.on) hover(e); return; }
    grab.moved = Math.max(grab.moved, Math.hypot(e.clientX - grab.sx, e.clientY - grab.sy));
    if (!grab.on) {
      if (grab.moved > SLOP) {
        clearTimeout(grab.timer);
        // anything but a near-vertical start takes the object; that one is the page scrolling
        if (Math.abs(e.clientX - grab.sx) >= SCROLL_RATIO * Math.abs(e.clientY - grab.sy)) take({ pointerId: e.pointerId, clientX: grab.sx, clientY: grab.sy });
        else { grab.id = null; return; }
      } else return;
    }
    const now = performance.now();
    const dx = e.clientX - grab.x, dy = e.clientY - grab.y;
    grab.x = e.clientX; grab.y = e.clientY; grab.t = now;
    // both axes follow the finger, on a phone as under a mouse (Rohan, 24 Oct 2026: a
    // phone turned it in one plane only)
    grab.ry += dx * GAIN; grab.rp += dy * GAIN;
    grab.wind += Math.hypot(dx, dy) * GAIN;          // the winding: total travel, any direction
    yaw.a = band(grab.ry, maxYaw); yaw.t = yaw.a;
    pitch.a = band(grab.rp, maxPitch); pitch.t = pitch.a;
    // the throw: angle covered over the last ~80 ms, not a smoothed per-event rate —
    // Safari on a phone delivers few, uneven moves for a quick flick, and an average
    // of them under-counted the throw (a fast flick turned the mug ~50°, not ~85°)
    grab.trail.push([now, grab.ry, grab.rp]);
    while (grab.trail.length > 2 && now - grab.trail[0][0] > 80) grab.trail.shift();
    const [t0, ry0, rp0] = grab.trail[0], span = Math.max(1 / 240, (now - t0) / 1000);
    grab.wy = (grab.ry - ry0) / span;
    grab.wx = (grab.rp - rp0) / span;
    wake();
  }
  function up(e) {
    clearTimeout(grab.timer);
    if (e.pointerId !== grab.id) return;
    const wasTap = !grab.on || grab.moved <= SLOP;
    if (grab.on) {
      grab.on = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      host.classList.remove('is-held');
      if (kind === 'magnet') {
        // back to facing you, carrying a little of the throw so it does not just stop
        yaw.v.v = grab.wy * 0.4; pitch.v.v = grab.wx * 0.4;
        yaw.t = 0;
      } else {
        yaw.v.v = grab.wy; pitch.v.v = grab.wx;
        yaw.t = yaw.a + grab.wy * SETTLE * 0.75;       // a mug stops where its spin runs out
      }
      pitch.t = restPitch;
    }
    if (wasTap && kind === 'magnet' && e.type === 'pointerup') {
      // a tap rocks it toward the finger: the side you press goes in, then it settles
      const r = canvas.getBoundingClientRect();
      yaw.v.v = ((e.clientX - r.left) / r.width - 0.5) * 320;
      pitch.v.v = ((e.clientY - r.top) / r.height - 0.5) * 320;
      yaw.t = 0; pitch.t = restPitch;
    }
    grab.id = null; grab.lifted = false;
    wake();
  }
  // under a mouse at rest, it leans a little toward the pointer, as the cards do
  function hover(e) {
    if (grab.on) return;
    const r = canvas.getBoundingClientRect();
    lean.x = ((e.clientX - r.left) / r.width - 0.5) * 14;
    lean.y = ((e.clientY - r.top) / r.height - 0.5) * 10;
    wake();
  }
  function leave() { if (!grab.on) { lean.x = lean.y = 0; wake(); } }
  // once it has the finger on a touch screen, the page must not scroll under it
  function touchmove(e) { if (grab.on) e.preventDefault(); }
  function onKey(e) {
    const step = { ArrowLeft: -30, ArrowRight: 30 }[e.key];
    if (step && round) { e.preventDefault(); yaw.t += step; wake(); }
    if (step && kind === 'magnet') { e.preventDefault(); yaw.t = clamp(step, maxYaw); wake(); setTimeout(() => { yaw.t = 0; wake(); }, 900); }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); pitch.t = clamp(pitch.t + (e.key === 'ArrowUp' ? -12 : 12), maxPitch); wake(); setTimeout(() => { pitch.t = restPitch; wake(); }, 900); }
  }
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', leave);
  canvas.addEventListener('touchmove', touchmove, { passive: false });
  canvas.addEventListener('keydown', onKey);
  const ro = new ResizeObserver(() => fit()); ro.observe(host);

  await build();
  host.classList.add('is-ready');
  wake();

  return {
    async setShape(next) {
      if (kind !== 'magnet' || next === shape || !opts.faces[next]) return;
      shape = next; await build(); wake();
    },
    destroy() {
      cancelAnimationFrame(raf); ro.disconnect();
      if (obj) { obj.disposables.forEach((x) => x.dispose()); obj.materials.forEach((m) => m.dispose()); }
      Object.values(faces).forEach((t) => t.dispose());
      scene.environment?.dispose(); renderer.dispose(); canvas.remove();
    },
  };
}
