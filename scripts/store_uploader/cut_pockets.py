#!/usr/bin/env python3
"""
cut_pockets.py — a cut-out of a drawing on a card, with the card's enclosed pockets
removed too.

magnet_gallery.key_background floods the card in from the edges, so a pocket of card
the drawing closes off (between a langur's tail and legs, inside a pangolin's tail
curl) survives the key and prints as a cream or grey patch on the magnet's white paper
(24 Oct 2026). This keys those pockets as well: regions within --tol of the card colour,
larger than --min-area of the image, that the edge flood could not reach.

Opt-in, per file, and checked by eye: a pocket can be part of the drawing (the pale
lines between a skimmer's water strokes), so it is run only on files that need it.

  python3 cut_pockets.py ART.png OUT.transparent.png [--tol 12] [--min-area 0.002] [--preview P.jpg]
"""
from __future__ import annotations
import argparse, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

import magnet_gallery as mg


def card_colour(rgb: np.ndarray) -> np.ndarray:
    """The commonest colour round the border, the same rule as key_background."""
    border = np.concatenate([rgb[2, :], rgb[-3, :], rgb[:, 2], rgb[:, -3]])
    q = (border // 8).astype(np.int32); k = q[:, 0] * 1024 + q[:, 1] * 32 + q[:, 2]
    vals, cnt = np.unique(k, return_counts=True)
    return np.median(border[k == vals[cnt.argmax()]], axis=0)


def cut(art: Path, tol: int = 12, min_area: float = 0.002) -> tuple[Image.Image, np.ndarray]:
    keyed = mg.key_background(Image.open(art))
    rgb = np.asarray(Image.open(art).convert("RGB")).astype(np.int16)
    al = np.asarray(keyed.split()[-1]).astype(np.float32)
    card = card_colour(rgb)
    dist = np.abs(rgb - card).max(axis=2)
    lab, n = ndimage.label((dist <= tol) & (al > 0))
    sizes = ndimage.sum(np.ones_like(dist), lab, range(1, n + 1)) if n else np.array([])
    pockets = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > rgb.shape[0] * rgb.shape[1] * min_area])
    # the pocket's anti-aliased rim: card-ish pixels just outside it go with it, faded by
    # how far they are from the card colour, as key_background fades its own edge
    rim = ndimage.binary_dilation(pockets, iterations=3) & ~pockets
    fade = np.clip((dist - tol) / 30.0, 0, 1)
    al = np.where(pockets, 0, np.where(rim, al * np.maximum(fade, 0.0), al))
    out = keyed.copy(); out.putalpha(Image.fromarray(al.astype(np.uint8)))
    return out, pockets


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("art"); ap.add_argument("out")
    ap.add_argument("--tol", type=int, default=12); ap.add_argument("--min-area", type=float, default=0.002)
    ap.add_argument("--preview", help="write the cut-out over mid grey, for checking by eye")
    a = ap.parse_args()
    out = Path(a.out)
    if out.exists():
        sys.exit(f"{out} exists — pick a new name")
    im, pockets = cut(Path(a.art), a.tol, a.min_area)
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, optimize=True)
    print(f"  {out}  {im.size}  pockets cut: {int(pockets.sum())} px")
    if a.preview:
        bg = Image.new("RGB", im.size, (110, 110, 110)); bg.paste(im, (0, 0), im)
        bg.thumbnail((700, 700)); bg.save(a.preview)
    return 0


if __name__ == "__main__":
    sys.exit(main())
