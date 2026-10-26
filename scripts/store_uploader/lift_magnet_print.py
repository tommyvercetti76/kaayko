#!/usr/bin/env python3
"""
lift_magnet_print.py — take the printed drawing back off a photographed round magnet.

Written 24 Oct 2026: the Gir mug carried the newer orange lion from the catalogue's art
folder, while the live Gir magnet carries an older walking lion that exists only as the
magnet's photograph. Rohan wanted the magnet's design on the mug.

  1. the face: the largest near-white, low-chroma region, holes filled; its centre and
     radius from its area
  2. the light on it: a quadratic surface fitted per channel to the bare paper, so the
     photograph's shading is divided out rather than keyed at a threshold
  3. the ink: printed ink multiplies the paper, so after dividing, alpha is the darkest
     channel's loss and colour is what it was over white — composited back on white
     it reproduces the face exactly, and multiplied onto a mug it prints the same way
  4. the label: rows of ink above the first clear band of the face (the "Gir" in the
     magnet's own type) are dropped, so the mug carries its park name in the store's
     type like every other mug

  python3 lift_magnet_print.py PHOTO.webp OUT.png [--keep-label]
"""
from __future__ import annotations
import argparse, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage


def flat_face(src: Path, size: int = 1536, paper_rgb=(246, 246, 247)) -> Image.Image:
    """The whole printed face, flat-lit: the disc cut from the photograph with the light
    divided out, on the magnet's own paper, transparent outside the circle. Used for the
    3D view of the older Gaur and Gir magnets, whose faces exist only as photographs
    (25 Oct 2026) — label and all, exactly as printed."""
    a = np.asarray(Image.open(src).convert("RGB"), np.float32)
    cx, cy, r, paper = _disc_and_paper(a)
    C = np.clip(a / np.maximum(paper, 1), 0, 1) * np.array(paper_rgb, np.float32)
    k = 0.985 * r                                        # inside the rim's own shading
    x0, y0 = int(round(cx - k)), int(round(cy - k)); side = int(round(2 * k))
    im = Image.fromarray(C.astype(np.uint8)).crop((x0, y0, x0 + side, y0 + side)).resize((size, size), Image.LANCZOS)
    Y, X = np.mgrid[0:size, 0:size].astype(np.float32)
    rr = np.hypot(X - (size - 1) / 2, Y - (size - 1) / 2)
    alpha = np.clip((size / 2 - rr) / 1.5, 0, 1) * 255
    im = im.convert("RGBA"); im.putalpha(Image.fromarray(alpha.astype(np.uint8)))
    return im


def _disc_and_paper(a: np.ndarray):
    """The face's centre and radius, and the light on its bare paper (a quadratic per channel)."""
    H, W = a.shape[:2]
    luma = a.mean(axis=2); chroma = a.max(axis=2) - a.min(axis=2)
    lab, n = ndimage.label((luma > 236) & (chroma < 14))
    if not n:
        raise SystemExit("no white face found")
    sizes = ndimage.sum(np.ones_like(luma), lab, range(1, n + 1))
    disc = ndimage.binary_fill_holes(lab == (int(np.argmax(sizes)) + 1))
    cy, cx = ndimage.center_of_mass(disc)
    r = float(np.sqrt(disc.sum() / np.pi))
    Y, X = np.mgrid[0:H, 0:W].astype(np.float64)   # float64: the quadratic fit overflows float32 matmul
    rr = np.hypot(X - cx, Y - cy) / r
    bare = (rr < 0.95) & (luma > 236) & (chroma < 14)
    ys, xs = np.nonzero(bare)
    pick = np.random.default_rng(0).choice(len(xs), size=min(60000, len(xs)), replace=False)
    u = (xs[pick] - cx) / r; v = (ys[pick] - cy) / r
    A = np.stack([np.ones_like(u), u, v, u * u, u * v, v * v], 1)
    U = (X - cx) / r; V = (Y - cy) / r
    basis = np.stack([np.ones_like(U), U, V, U * U, U * V, V * V], -1)
    paper = np.stack([np.einsum('hwk,k->hw', basis, np.linalg.lstsq(A, a[ys[pick], xs[pick], c].astype(np.float64), rcond=None)[0]) for c in range(3)], -1)
    return cx, cy, r, paper


def lift(src: Path, keep_label: bool = False) -> Image.Image:
    a = np.asarray(Image.open(src).convert("RGB"), np.float32)
    H, W = a.shape[:2]
    luma = a.mean(axis=2); chroma = a.max(axis=2) - a.min(axis=2)
    lab, n = ndimage.label((luma > 236) & (chroma < 14))
    if not n:
        raise SystemExit("no white face found")
    sizes = ndimage.sum(np.ones_like(luma), lab, range(1, n + 1))
    disc = ndimage.binary_fill_holes(lab == (int(np.argmax(sizes)) + 1))
    cy, cx = ndimage.center_of_mass(disc)
    r = float(np.sqrt(disc.sum() / np.pi))
    Y, X = np.mgrid[0:H, 0:W].astype(np.float64)   # float64: the quadratic fit overflows float32 matmul
    rr = np.hypot(X - cx, Y - cy) / r

    # the light across the paper: fit where the face is bare
    bare = (rr < 0.95) & (luma > 236) & (chroma < 14)
    ys, xs = np.nonzero(bare)
    pick = np.random.default_rng(0).choice(len(xs), size=min(60000, len(xs)), replace=False)
    u = (xs[pick] - cx) / r; v = (ys[pick] - cy) / r
    A = np.stack([np.ones_like(u), u, v, u * u, u * v, v * v], 1)
    U = (X - cx) / r; V = (Y - cy) / r
    basis = np.stack([np.ones_like(U), U, V, U * U, U * V, V * V], -1)
    paper = np.stack([np.einsum('hwk,k->hw', basis, np.linalg.lstsq(A, a[ys[pick], xs[pick], c].astype(np.float64), rcond=None)[0]) for c in range(3)], -1)

    C = np.clip(a / np.maximum(paper, 1), 0, 1)
    alpha = (1 - C).max(axis=2)
    alpha = np.clip((alpha - 0.06) / 0.94, 0, 1)            # the paper's own grain, not ink
    alpha[rr > 0.96] = 0                                      # the rim and beyond
    F = 1 - (1 - C) / np.maximum(alpha, 1e-3)[..., None]
    F = np.clip(F, 0, 1)

    if not keep_label:
        ink_rows = (alpha > 0.25).sum(axis=1) > 2
        top = int(cy - 0.96 * r); bottom = int(cy + 0.96 * r)
        rows = np.nonzero(ink_rows[top:bottom])[0] + top
        if len(rows):
            gap_need = int(0.04 * r)
            first = rows[0]; cut = None; run = 0
            for y in range(first, bottom):
                run = run + 1 if not ink_rows[y] else 0
                if run >= gap_need:
                    cut = y; break
            # only a label if the band above the gap is short: a drawing that starts at the
            # top of the face has no gap until its end
            if cut is not None and (cut - first) < 0.35 * r:
                alpha[:cut] = 0

    out = np.dstack([F * 255, alpha[..., None] * 255]).astype(np.uint8)
    im = Image.fromarray(out, "RGBA")
    bb = im.split()[-1].point(lambda p: 255 if p > 8 else 0).getbbox()
    return im.crop(bb) if bb else im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("photo"); ap.add_argument("out")
    ap.add_argument("--keep-label", action="store_true", help="keep the magnet's own name lettering")
    a = ap.parse_args()
    out = Path(a.out)
    if out.exists():
        sys.exit(f"{out} exists — pick a new name")
    im = lift(Path(a.photo), a.keep_label)
    im.save(out, optimize=True)
    print(f"  {out}  {im.size}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
