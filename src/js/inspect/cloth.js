/**
 * inspect/cloth.js — fabric that hangs, swings and settles: the t-shirt on its
 * hanger and the tote on its hook (Rohan, 25 Oct 2026: "T shirts must be given a
 * proper physics flowing treatment").
 *
 * Each garment is two layers of cloth, front and back, cut from the garment's own
 * outline and sewn together where a real one is sewn (sides, shoulders, sleeves;
 * a tote's sides and bottom) and left open where it is open (neck, hem, cuffs; the
 * tote's mouth). The cloth is a grid of particles moved by position-based dynamics:
 * Verlet steps under gravity, then rounds of constraints — stretch, shear and bend
 * links inside each layer, the seams, and a spacer that keeps the layers apart.
 *
 * What holds it up rides on the stage's pivot: the shoulders on the hanger, the
 * tote's strap ends on the hook. Turn the pivot and everything else follows only
 * through the fabric — the body lags, flares, swings past and settles. A little
 * shape memory (a weak pull toward the cut shape, stronger in sleeves and collar)
 * keeps a hung tee's sleeves out and its print readable at rest.
 *
 * Units are centimetres; gravity is 981 cm/s². The particles live in world space,
 * so the meshes are added to the scene, not to the pivot.
 */
import * as THREE from '/js/vendor/three/three.module.min.js';

const G = 981;
const SUBSTEPS = 2;
const ITER = 5;
const DAMP = 0.992;            // velocity kept per substep (~0.4 per second): fabric in air
const REST_EPS = 0.0025;       // cm per frame under which a frame counts as still

/* ── geometry helpers ─────────────────────────────────────────────────────── */
function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function polyDist(poly, x, y) {
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) d = Math.min(d, segDist(x, y, ...poly[j], ...poly[i]));
  return d;
}

/* ── one layer: the particles of a grid that fall in (or just outside) an outline ── */
function layer(poly, box, cell, z) {
  const cols = Math.ceil((box.x1 - box.x0) / cell) + 1, rows = Math.ceil((box.y1 - box.y0) / cell) + 1;
  const index = new Int32Array(cols * rows).fill(-1);
  const pts = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = box.x0 + c * cell, y = box.y1 - r * cell;
      // a particle within half a cell of the outline belongs to the cloth: the
      // texture's alpha cuts the exact edge, the grid only has to cover it
      if (inside(poly, x, y) || polyDist(poly, x, y) < cell * 0.75) { index[r * cols + c] = pts.length; pts.push([x, y, z]); }
    }
  }
  return { cols, rows, index, pts };
}

/**
 * A two-layer garment.
 * @param {object} spec
 *   front, back   outlines, [[x,y], …] in cm (y up; the hook is at 0)
 *   cell          grid spacing, cm
 *   gap           how far apart the layers hang, cm
 *   open(x,y)     true where the edge is not sewn
 *   pin(x,y)      true for the particles the pivot carries
 *   memory(x,y)   0…1, the pull back toward the cut shape, per substep
 *   frontMap, backMap, innerMap   textures (alpha cuts the outline)
 *   knit          normal map for the weave
 */
/** The rectangle a garment's grid and textures share (cm), a cell wider than the cut all round. */
export function garmentBox(front, back, cell) {
  const all = front.concat(back);
  return { x0: Math.min(...all.map((p) => p[0])) - cell, x1: Math.max(...all.map((p) => p[0])) + cell,
           y0: Math.min(...all.map((p) => p[1])) - cell, y1: Math.max(...all.map((p) => p[1])) + cell };
}

export function makeGarment(spec) {
  const { front, back, cell, gap } = spec;
  const box = spec.box || garmentBox(front, back, cell);
  // the grids share one origin so a front particle and the back one behind it line up
  const fl = layer(front, box, cell, gap / 2), bl = layer(back, box, cell, -gap / 2);
  const nF = fl.pts.length, n = nF + bl.pts.length;
  const rest = new Float32Array(n * 3), pos = new Float32Array(n * 3), prev = new Float32Array(n * 3);
  const inv = new Float32Array(n), mem = new Float32Array(n);
  [...fl.pts, ...bl.pts].forEach(([x, y, z], i) => {
    rest.set([x, y, z], i * 3);
    const pinned = spec.pin(x, y);
    inv[i] = pinned ? 0 : 1;
    mem[i] = pinned ? 0 : spec.memory(x, y);
  });

  // constraints: i, j, rest length, stiffness, mode (0 = hold the length, 1 = only resist
  // stretching, 2 = keep between min and max)
  const ci = [], cj = [], cl = [], cm = [], ck = [], mode = [];
  const link = (i, j, k, md = 0, lmax = 0) => {
    const dx = rest[j * 3] - rest[i * 3], dy = rest[j * 3 + 1] - rest[i * 3 + 1], dz = rest[j * 3 + 2] - rest[i * 3 + 2];
    ci.push(i); cj.push(j); cl.push(Math.hypot(dx, dy, dz)); cm.push(lmax); ck.push(k); mode.push(md);
  };
  const within = (L, off) => {
    const at = (r, c) => (r >= 0 && c >= 0 && r < L.rows && c < L.cols ? L.index[r * L.cols + c] : -1);
    for (let r = 0; r < L.rows; r++) {
      for (let c = 0; c < L.cols; c++) {
        const a = at(r, c); if (a < 0) continue;
        const A = a + off;
        // stretch (neighbours), shear (diagonals), bend (two apart: soft, so it folds)
        [[0, 1, 1], [1, 0, 1], [1, 1, 0.5], [1, -1, 0.5], [0, 2, spec.bend ?? 0.12], [2, 0, spec.bend ?? 0.12]].forEach(([dr, dc, k]) => {
          const b = at(r + dr, c + dc); if (b >= 0) link(A, b + off, k);
        });
      }
    }
    return at;
  };
  const atF = within(fl, 0), atB = within(bl, nF);

  // the seams and the spacer between the layers
  const edge = (at, r, c) => [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dr, dc]) => at(r + dr, c + dc) < 0);
  for (let r = 0; r < fl.rows; r++) {
    for (let c = 0; c < fl.cols; c++) {
      const a = atF(r, c), b = atB(r, c);
      if (a < 0 || b < 0) continue;
      const x = rest[a * 3], y = rest[a * 3 + 1];
      const B = b + nF;
      if ((edge(atF, r, c) || edge(atB, r, c)) && !spec.open(x, y)) {
        ci.push(a); cj.push(B); cl.push(0.25); cm.push(0); ck.push(1); mode.push(0);           // sewn
      } else {
        ci.push(a); cj.push(B); cl.push(0.35); cm.push(gap * 1.5); ck.push(0.7); mode.push(2);  // spacer: apart, never a balloon
      }
    }
  }
  const C = {
    i: Int32Array.from(ci), j: Int32Array.from(cj), l: Float32Array.from(cl), lmax: Float32Array.from(cm),
    k: Float32Array.from(ck), mode: Uint8Array.from(mode), n: ci.length,
  };

  // meshes: one geometry per layer, positions rewritten every frame
  const tri = (L, at, off) => {
    const ix = [];
    for (let r = 0; r < L.rows - 1; r++) {
      for (let c = 0; c < L.cols - 1; c++) {
        const a = at(r, c), b = at(r, c + 1), d = at(r + 1, c), e = at(r + 1, c + 1);
        // two triangles a quad, wound to face +z; a corner short of a quad still makes one
        if (a >= 0 && d >= 0 && b >= 0) ix.push(a, d, b);
        if (b >= 0 && d >= 0 && e >= 0) ix.push(b, d, e);
        else if (a >= 0 && d >= 0 && e >= 0 && b < 0) ix.push(a, d, e);
        if (a >= 0 && b >= 0 && e >= 0 && d < 0) ix.push(a, e, b);
      }
    }
    const g = new THREE.BufferGeometry();
    const count = L.pts.length;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const uv = new Float32Array(count * 2);
    L.pts.forEach(([x, y], i) => { uv[i * 2] = (x - box.x0) / (box.x1 - box.x0); uv[i * 2 + 1] = (y - box.y0) / (box.y1 - box.y0); });
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(ix);
    return { g, off, count };
  };
  const F = tri(fl, atF, 0), Bk = tri(bl, atB, nF);

  const fabric = (map, side, extra = {}) => new THREE.MeshPhysicalMaterial({
    // the outline is cut by the texture's alpha; alpha-to-coverage smooths that cut with
    // the renderer's multisampling (alphaTest alone left stair-steps along the hem)
    map, side, alphaTest: 0.5, alphaToCoverage: true, roughness: 0.94, metalness: 0,
    sheen: 1, sheenRoughness: 0.55, sheenColor: new THREE.Color(spec.sheen || 0x8a8a8a),
    normalMap: spec.knit || null, normalScale: new THREE.Vector2(0.45, 0.45), ...extra,
  });
  const mats = [
    fabric(spec.frontMap, THREE.FrontSide), fabric(spec.innerMap, THREE.BackSide),   // front layer: outside, inside
    fabric(spec.backMap, THREE.BackSide), fabric(spec.innerMap, THREE.FrontSide),    // back layer: outside, inside
  ];
  const meshes = [new THREE.Mesh(F.g, mats[0]), new THREE.Mesh(F.g, mats[1]), new THREE.Mesh(Bk.g, mats[2]), new THREE.Mesh(Bk.g, mats[3])];
  meshes.forEach((m) => { m.frustumCulled = false; });

  /* the solver */
  const tgt = new THREE.Vector3();
  let started = false, still = 0;
  function place(matrix) {
    for (let p = 0; p < n; p++) {
      tgt.set(rest[p * 3], rest[p * 3 + 1], rest[p * 3 + 2]).applyMatrix4(matrix);
      pos[p * 3] = prev[p * 3] = tgt.x; pos[p * 3 + 1] = prev[p * 3 + 1] = tgt.y; pos[p * 3 + 2] = prev[p * 3 + 2] = tgt.z;
    }
    started = true;
  }

  function solve() {
    for (let it = 0; it < ITER; it++) {
      for (let c = 0; c < C.n; c++) {
        const a = C.i[c] * 3, b = C.j[c] * 3;
        const wa = inv[C.i[c]], wb = inv[C.j[c]], w = wa + wb;
        if (w === 0) continue;
        const dx = pos[b] - pos[a], dy = pos[b + 1] - pos[a + 1], dz = pos[b + 2] - pos[a + 2];
        const L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        let want = C.l[c];
        const md = C.mode[c];
        if (md === 1 && L <= want) continue;
        if (md === 2) { if (L >= want && L <= C.lmax[c]) continue; want = L < want ? want : C.lmax[c]; }
        const s = (C.k[c] * (L - want)) / (L * w);
        pos[a] += dx * s * wa; pos[a + 1] += dy * s * wa; pos[a + 2] += dz * s * wa;
        pos[b] -= dx * s * wb; pos[b + 1] -= dy * s * wb; pos[b + 2] -= dz * s * wb;
      }
    }
  }

  /** Advance by dt seconds with the pivot at `matrix`. Returns true while the cloth still moves. */
  function step(dt, matrix) {
    if (!started) { place(matrix); return true; }
    const h = Math.min(dt, 1 / 30) / SUBSTEPS;
    let travel = 0;
    for (let s = 0; s < SUBSTEPS; s++) {
      for (let p = 0; p < n; p++) {
        const o = p * 3;
        tgt.set(rest[o], rest[o + 1], rest[o + 2]).applyMatrix4(matrix);
        if (inv[p] === 0) {                        // carried by the hanger
          prev[o] = pos[o]; prev[o + 1] = pos[o + 1]; prev[o + 2] = pos[o + 2];
          pos[o] = tgt.x; pos[o + 1] = tgt.y; pos[o + 2] = tgt.z;
          continue;
        }
        const vx = (pos[o] - prev[o]) * DAMP, vy = (pos[o + 1] - prev[o + 1]) * DAMP, vz = (pos[o + 2] - prev[o + 2]) * DAMP;
        prev[o] = pos[o]; prev[o + 1] = pos[o + 1]; prev[o + 2] = pos[o + 2];
        pos[o] += vx; pos[o + 1] += vy - G * h * h; pos[o + 2] += vz;
        const m = mem[p];
        if (m > 0) { pos[o] += (tgt.x - pos[o]) * m; pos[o + 1] += (tgt.y - pos[o + 1]) * m; pos[o + 2] += (tgt.z - pos[o + 2]) * m; }
      }
      solve();
    }
    for (let p = 0; p < n; p++) {
      if (inv[p] === 0) continue;
      const o = p * 3;
      travel = Math.max(travel, Math.abs(pos[o] - prev[o]) + Math.abs(pos[o + 1] - prev[o + 1]) + Math.abs(pos[o + 2] - prev[o + 2]));
    }
    // write the meshes
    for (const L of [F, Bk]) {
      const a = L.g.attributes.position.array;
      a.set(pos.subarray(L.off * 3, (L.off + L.count) * 3));
      L.g.attributes.position.needsUpdate = true;
      L.g.computeVertexNormals();
    }
    still = travel < REST_EPS ? still + 1 : 0;
    return still < 20;
  }

  return {
    meshes, materials: mats, disposables: [F.g, Bk.g],
    step, settle: () => { still = 0; },
  };
}

/* ── textures: the garment drawn flat, its print, its weave ──────────────────── */
export function knitMap(kind) {
  // a fine weave as a normal map: jersey knit for a tee (vertical columns of loops),
  // canvas for a tote (an even over-under)
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'); const img = g.createImageData(S, S);
  const h = (x, y) => kind === 'tote'
    ? 0.5 + 0.25 * Math.sin((x / S) * Math.PI * 2 * 16) * Math.sin((y / S) * Math.PI * 2 * 16) + 0.25 * Math.sin(((x + y) / S) * Math.PI * 2 * 3)
    : 0.5 + 0.35 * Math.abs(Math.sin((x / S) * Math.PI * 24)) * (0.6 + 0.4 * Math.sin((y / S) * Math.PI * 2 * 20));
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = h(x + 1, y) - h(x - 1, y), dy = h(x, y + 1) - h(x, y - 1);
      const nx = -dx * 2, ny = -dy * 2, nz = 1, l = Math.hypot(nx, ny, nz);
      const i = (y * S + x) * 4;
      img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[i + 2] = (nz / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(kind === 'tote' ? 14 : 20, kind === 'tote' ? 14 : 20);
  return t;
}

/**
 * Draw a garment panel: the outline filled with the cloth's colour, stitching at the
 * hems, and — on the front — the print.
 * @param {object} o  outline, box {x0,x1,y0,y1} (cm), color, print (Image|null),
 *                    printRect {x, y, w} (cm: centre x, top y, width), stitches [[x0,y0,x1,y1],…], label
 */
export function panelTexture(o) {
  const W = 2048, cmW = o.box.x1 - o.box.x0, cmH = o.box.y1 - o.box.y0;
  const k = W / cmW, H = Math.round(cmH * k);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const X = (x) => (x - o.box.x0) * k, Y = (y) => (o.box.y1 - y) * k;
  g.beginPath();
  o.outline.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
  g.closePath();
  g.fillStyle = o.color; g.fill();
  g.save(); g.clip();
  // a faint cloth mottle, so a flat colour reads as fabric under the light
  const tone = g.createRadialGradient(W * 0.45, H * 0.3, W * 0.05, W * 0.5, H * 0.5, W * 0.8);
  tone.addColorStop(0, 'rgba(255,255,255,0.05)'); tone.addColorStop(1, 'rgba(0,0,0,0.08)');
  g.fillStyle = tone; g.fillRect(0, 0, W, H);
  (o.stitches || []).forEach(([x0, y0, x1, y1]) => {
    g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 0.09 * k; g.setLineDash([0.35 * k, 0.22 * k]);
    g.beginPath(); g.moveTo(X(x0), Y(y0)); g.lineTo(X(x1), Y(y1)); g.stroke();
  });
  g.setLineDash([]);
  if (o.print && o.printRect) {
    const { x, y, w } = o.printRect;
    const hgt = (w * o.print.height) / o.print.width;
    g.globalAlpha = 0.96;                                  // ink sits in the weave, not on glass
    g.drawImage(o.print, X(x - w / 2), Y(y), w * k, hgt * k);
    g.globalAlpha = 1;
  }
  if (o.label) {                                           // the woven label inside the back neck
    const lw = 5.2, lh = 2.2;
    g.fillStyle = '#efe9dc'; g.fillRect(X(-lw / 2), Y(o.label), lw * k, lh * k);
    g.fillStyle = '#2a2622'; g.font = `600 ${Math.round(0.95 * k)}px "Josefin Sans", Arial, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('KAAYKO', X(0), Y(o.label - lh / 2));
  }
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
