#!/usr/bin/env python3
"""
mug_gallery.py — a drawing on a white 11 oz ceramic mug, in the magnets' studio light.

The mug is drawn, not photographed and not generated: a lit cylinder with a glaze
highlight, the rim and the shadowed inside, a C handle, and a contact shadow on the
same wall-and-floor tones magnet_gallery.py uses. So a mug sits on the shelf in the
same light as the magnets, and a 3600 px mug is genuinely 3600 px.

The print is laid flat first (the park name in the store's orange, the drawing under
it, exactly as on a magnet) and then wrapped round the body: each pixel of the mug
looks up its point on the cylinder (arc length for x, height along the wall for y),
so the drawing compresses toward the edges the way ink on a real mug does. The ink is
multiplied into the glaze and the highlight is laid back on top of it.

  python3 mug_gallery.py ART.png --out DIR
  python3 mug_gallery.py 'folder/*.png' --out DIR --medallion     # round folk-ring art
"""
from __future__ import annotations
import argparse, glob, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

import magnet_gallery as mg   # key_background, trim, ring_clip, PARKS, NAME_RGB, TRACK, FONT

W, H = 3600, 3217                       # the magnets' canvas, so the grid lines up
GLAZE = np.array([247, 246, 243], np.float32)


def _smooth(x):                         # 0..1 edge with a one-pixel ramp: anti-aliasing
    return np.clip(x, 0.0, 1.0)


def print_sheet(art_path: Path, name: str, medallion: bool, px: int) -> Image.Image:
    """The flat print: name across the top, the drawing under it, on transparent."""
    a = mg.key_background(Image.open(art_path))
    if medallion:
        a = mg.ring_clip(a)
    a = mg.trim(a)
    size = int(px * 0.055)
    gap = int(size * 1.4) if name else 0
    k = min(px / a.width, (px * 0.86 - gap) / a.height)
    a = a.resize((max(1, int(a.width * k)), max(1, int(a.height * k))), Image.LANCZOS)
    sheet = Image.new("RGBA", (px, gap + a.height), (0, 0, 0, 0))
    if name:
        name = name.upper()
        font = ImageFont.truetype(str(mg.FONT), size); track = size * mg.TRACK
        widths = [font.getlength(ch) for ch in name]
        x = px / 2 - (sum(widths) + track * (len(name) - 1)) / 2
        d = ImageDraw.Draw(sheet)
        for ch, w in zip(name, widths):
            d.text((x, size * 0.6), ch, font=font, fill=mg.NAME_RGB + (255,), anchor="lm"); x += w + track
    sheet.alpha_composite(a, ((px - a.width) // 2, gap))
    return sheet


def bilinear(img: np.ndarray, xs: np.ndarray, ys: np.ndarray) -> np.ndarray:
    h, w = img.shape[:2]
    x0 = np.clip(np.floor(xs).astype(np.int32), 0, w - 2); y0 = np.clip(np.floor(ys).astype(np.int32), 0, h - 2)
    fx = np.clip(xs - x0, 0, 1)[..., None]; fy = np.clip(ys - y0, 0, 1)[..., None]
    a = img[y0, x0] * (1 - fx) + img[y0, x0 + 1] * fx
    b = img[y0 + 1, x0] * (1 - fx) + img[y0 + 1, x0 + 1] * fx
    return a * (1 - fy) + b * fy


def render(art_path: Path, name: str, medallion: bool = False) -> Image.Image:
    Y, X = np.mgrid[0:H, 0:W].astype(np.float32)

    # ── the room: the magnets' wall falling to a slightly darker floor ──────────
    wall = np.array(mg.WALL, np.float32)
    t = (Y / H)[..., None]; s = (X / W)[..., None]
    top = wall[0] * (1 - s) + wall[1] * s; bot = wall[2] * (1 - s) + wall[3] * s
    room = top * (1 - t) + bot * t
    room *= (1 - 0.05 * np.clip((Y - H * 0.72) / (H * 0.28), 0, 1))[..., None]   # the floor, a touch darker

    # ── geometry: 11 oz, 82 mm across, 95 mm tall, seen from a little above ────
    # Framed as one object: body + handle centred across, rim-to-shadow centred down.
    R = W * 0.195
    e = R * 0.20                                   # ellipse depth of the rim
    Hb = 2 * R * 1.16
    cx = W / 2 - R * 0.22                          # the handle reaches ~1.4 R to the right
    yt = (H - (Hb + 2.4 * e)) / 2 + e
    yb = yt + Hb
    u = (X - cx) / R
    inside_u = np.abs(u) < 1
    root = np.sqrt(np.clip(1 - u * u, 0, 1))
    y_front_top = yt + e * root
    y_front_bot = yb + e * root * 0.92

    # contact shadow, offset away from the upper-left light
    sh = Image.new("L", (W, H), 0)
    ImageDraw.Draw(sh).ellipse([cx - R * 1.05 + R * 0.18, yb + e * 0.15, cx + R * 1.25 + R * 0.18, yb + e * 1.55], fill=255)
    sh = np.asarray(sh.filter(ImageFilter.GaussianBlur(R * 0.10)), np.float32)[..., None] / 255
    room = room * (1 - 0.30 * sh)

    out = room.copy()

    # ── the handle (drawn first; the body covers where it joins) ───────────────
    hx, hy = cx + R * 0.96, yt + Hb * 0.46
    ax, by = R * 0.44, Hb * 0.31
    rho = np.sqrt(((X - hx) / ax) ** 2 + ((Y - hy) / by) ** 2)
    k_in = 0.50                                    # a thumb-thick handle
    band = _smooth((1 - rho) * ax) * _smooth((rho - k_in) * ax) * (X > cx + R * 0.70)
    across = np.clip((rho - k_in) / (1 - k_in), 0, 1)            # 0 inner edge .. 1 outer edge
    up = np.clip(-(Y - hy) / by, -1, 1)
    h_shade = 0.66 + 0.26 * np.sin(np.pi * across) + 0.08 * up
    h_spec = 0.22 * np.exp(-((across - 0.62) / 0.12) ** 2) * np.clip(up + 0.3, 0, 1)
    h_col = GLAZE * h_shade[..., None] + 255 * h_spec[..., None]
    out = out * (1 - band[..., None]) + h_col * band[..., None]
    # where the handle meets the wall, a soft occlusion on the body's right edge
    join = np.exp(-(((X - (cx + R * 0.97)) / (R * 0.06)) ** 2)) * (np.abs(Y - hy) < by * 0.95)

    # ── the body ────────────────────────────────────────────────────────────────
    cover = _smooth((1 - np.abs(u)) * R) * _smooth(Y - y_front_top) * _smooth(y_front_bot - Y)
    theta = np.arcsin(np.clip(u, -1, 1))
    light = -0.62                                                # from the upper left
    diff = np.clip(np.cos(theta - light), 0, 1)
    v = np.clip((Y - yt) / Hb, 0, 1)
    shade = (0.60 + 0.40 * diff) * (1 - 0.07 * v ** 2) * (1 - 0.10 * join)
    spec = 0.30 * np.exp(-((theta + 0.50) / 0.085) ** 2) * (0.75 + 0.25 * (1 - v))
    bounce = 0.05 * np.exp(-((theta - 1.30) / 0.14) ** 2)
    body = GLAZE * shade[..., None]

    # the print, wrapped: x by arc length, y by height along the wall
    sheet = print_sheet(art_path, name, medallion, px=1800)
    sa = np.asarray(sheet, np.float32) / 255
    arc_half = 0.98                                             # radians each side of the front
    band_top = Hb * 0.14; band_h = Hb * 0.72
    scale = min((2 * arc_half * R) / sheet.width, band_h / sheet.height)
    pw, ph = sheet.width * scale, sheet.height * scale
    arc = theta * R
    hgt = Y - (yt + e * root)                               # same thing, stated plainly
    off_y = band_top + (band_h - ph) / 2
    sx = (arc + pw / 2) / scale
    sy = (hgt - off_y) / scale
    inside_print = (sx >= 0) & (sx < sheet.width - 1) & (sy >= 0) & (sy < sheet.height - 1) & inside_u & (np.abs(theta) < arc_half + 0.02)
    ink = np.zeros((H, W, 4), np.float32)
    ink[inside_print] = bilinear(sa, sx[inside_print], sy[inside_print])
    ia = ink[..., 3:4]
    body = body * (1 - ia) + (body * ink[..., :3]) * ia          # multiplied into the glaze
    body = body + 255 * (spec + bounce)[..., None]               # the glaze shines over the ink
    out = out * (1 - cover[..., None]) + body * cover[..., None]

    # ── rim and inside ──────────────────────────────────────────────────────────
    ell = ((X - cx) / R) ** 2 + ((Y - yt) / e) ** 2
    Ri = R * 0.945; ei = e * 0.945
    ell_i = ((X - cx) / Ri) ** 2 + ((Y - yt) / ei) ** 2
    rim = _smooth((1 - np.sqrt(ell)) * e * 1.2) * _smooth((np.sqrt(ell_i) - 1) * ei * 1.2)
    rim_col = GLAZE * (0.94 + 0.06 * np.clip(-(X - cx) / R, -1, 1))[..., None]
    out = out * (1 - rim[..., None]) + rim_col * rim[..., None]
    inner = _smooth((1 - np.sqrt(ell_i)) * ei * 1.2)
    vy = np.clip((Y - (yt - ei)) / (2 * ei), 0, 1)                # 0 far wall .. 1 near wall
    in_shade = 0.93 - 0.30 * vy - 0.10 * np.clip((X - cx) / Ri, 0, 1)
    in_col = GLAZE * in_shade[..., None]
    out = out * (1 - inner[..., None]) + in_col * inner[..., None]

    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("art", nargs="+"); ap.add_argument("--out", required=True)
    ap.add_argument("--medallion", action="store_true", help="round folk-ring art: clip to its ring before printing")
    ap.add_argument("--name", help="park name for a single mug")
    a = ap.parse_args()
    out = Path(a.out)
    if out.exists() and any(out.iterdir()):
        sys.exit(f"{out} already has files — pick a new folder")
    out.mkdir(parents=True, exist_ok=True)
    for p in [Path(p) for pat in a.art for p in (glob.glob(pat) or [pat])]:
        stem = p.stem.replace(".transparent", "").replace("_transparent_4096", "").replace("_4096", "")
        if a.name is not None:
            name = a.name
        else:
            hit = next((k for k in sorted(mg.PARKS, key=len, reverse=True) if k in stem), None)
            name = mg.PARKS.get(hit, "") if hit else ""
        im = render(p, name, medallion=a.medallion)
        dst = out / f"{stem}_mug.png"; im.save(dst, optimize=True)
        print(f"  {dst.name}  '{name}'  {im.size}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
