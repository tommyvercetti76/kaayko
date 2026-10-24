#!/usr/bin/env python3
"""
mug_gallery.py — a drawing on a white 11 oz ceramic mug, shot like a product photograph.

The mug is drawn, not photographed and not generated, and lit the way a studio lights
white ceramic (rebuilt 24 Oct 2026 after Rohan found the first pass "inauthentic"; that
evening whitened, because beside the 3D view the photo read grey — its front wall sat
at 220, the studio wall's own value; it now sits ~244, above the wall, as white ceramic
does in a studio, and the turn into shadow is gentler, ~222 at u=0.6, not 166):

  key     a large softbox high on the left — diffuse shading round the cylinder, and its
          reflection as a soft vertical band in the glaze
  strip   a narrow light behind on the right — the thin bright rim down that edge
  inside  lit from the same key: the inner RIGHT wall catches the light, the inside
          darkens with depth
  lip     a rounded rim with thickness, brightest on the far side
  handle  an ear-shaped tube that tapers from top to bottom, shaded by its own normals
  ground  a tight contact shadow under the foot and a soft cast shadow to the right
  camera  a little above the rim, so the base curves slightly more than the rim

Rendered at 2x and reduced, with a fine grain, on the magnets' wall-and-floor tones so
mugs and magnets share one shelf. The print (park name above the drawing, laid flat) is
wrapped by arc length and by height along the wall, multiplied into the glaze, and the
glaze's reflections lie over the ink as they do on a real mug.

  python3 mug_gallery.py ART.png --out DIR
  python3 mug_gallery.py 'folder/*.png' --out DIR --medallion     # round folk-ring art
"""
from __future__ import annotations
import argparse, glob, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from scipy import ndimage

import magnet_gallery as mg   # key_background, trim, ring_clip, PARKS, NAME_RGB, TRACK, FONT

W, H = 3600, 3217                       # the magnets' canvas, so the grid lines up
SS = 2                                  # supersampling
GLAZE = np.array([249, 248, 245], np.float32)
KEY = np.array([-0.55, -0.42, 0.72], np.float32); KEY /= np.linalg.norm(KEY)


def soft(x, w=1.0):
    """0..1 coverage across an edge w pixels wide (anti-aliasing)."""
    return np.clip(x / w + 0.5, 0.0, 1.0)


def print_sheet(art_path: Path, name: str, medallion: bool, px: int) -> Image.Image:
    """The flat print: the name above, the drawing below, never touching."""
    a = mg.key_background(Image.open(art_path))
    if medallion:
        a = mg.ring_clip(a)
    a = mg.trim(a)
    size = int(px * 0.052)
    gap = int(size * 2.1) if name else 0
    k = min(px * 0.92 / a.width, (px * 0.84 - gap) / a.height)
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


def bilinear(img, xs, ys):
    h, w = img.shape[:2]
    x0 = np.clip(np.floor(xs).astype(np.int32), 0, w - 2); y0 = np.clip(np.floor(ys).astype(np.int32), 0, h - 2)
    fx = np.clip(xs - x0, 0, 1)[..., None]; fy = np.clip(ys - y0, 0, 1)[..., None]
    a = img[y0, x0] * (1 - fx) + img[y0, x0 + 1] * fx
    b = img[y0 + 1, x0] * (1 - fx) + img[y0 + 1, x0 + 1] * fx
    return a * (1 - fy) + b * fy


def band(x, centre, half, edge):
    """A soft-edged top hat: 1 inside centre±half, falling to 0 over `edge`."""
    return np.clip((half - np.abs(x - centre)) / edge + 0.5, 0, 1)


def room() -> np.ndarray:
    Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
    wall = np.array(mg.WALL, np.float32)
    t = (Y / H)[..., None]; s = (X / W)[..., None]
    top = wall[0] * (1 - s) + wall[1] * s; bot = wall[2] * (1 - s) + wall[3] * s
    out = top * (1 - t) + bot * t
    # a seamless sweep: the floor falls a few percent darker, no horizon line
    out *= (1 - 0.06 * np.clip((Y - H * 0.55) / (H * 0.45), 0, 1) ** 1.5)[..., None]
    # a gentle lens falloff toward the corners
    r2 = ((X - W / 2) / (W / 2)) ** 2 + ((Y - H / 2) / (H / 2)) ** 2
    out *= (1 - 0.035 * r2)[..., None]
    return out


def render(art_path: Path, name: str, medallion: bool = False) -> Image.Image:
    # ── geometry (in final pixels): 11 oz, 82 mm across, 95 mm tall ──────────────
    R = W * 0.19
    Hb = 2 * R * 1.16
    e_top, e_bot = R * 0.17, R * 0.20          # camera a little above the rim
    cx = W / 2 - R * 0.24                      # body + handle centred as one object
    yt = H * 0.47 - (Hb + e_top + e_bot) / 2 + e_top
    yb = yt + Hb

    # the working window, supersampled
    wx0, wx1 = int(cx - R * 1.25), int(cx + R * 1.75)
    wy0, wy1 = int(yt - e_top - R * 0.10), int(yb + e_bot + R * 0.55)
    ww, wh = (wx1 - wx0) * SS, (wy1 - wy0) * SS
    yy, xx = np.mgrid[0:wh, 0:ww].astype(np.float32)
    X = xx / SS + wx0; Y = yy / SS + wy0
    px = 1.0 / SS                              # one supersample, in final pixels

    bg = room()[wy0:wy1, wx0:wx1]
    bg = np.asarray(Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8)).resize((ww, wh), Image.BILINEAR), np.float32)

    u = (X - cx) / R
    root = np.sqrt(np.clip(1 - u * u, 0, 1))

    # ── the handle: an ear-shaped tube, tapering, shaded by its normals ─────────
    P = np.array([[cx + R * 0.93, yt + Hb * 0.19], [cx + R * 1.62, yt + Hb * 0.08],
                  [cx + R * 1.64, yt + Hb * 0.72], [cx + R * 0.93, yt + Hb * 0.80]], np.float32)
    tt = np.linspace(0, 1, 1600, dtype=np.float32)[:, None]
    curve = ((1 - tt) ** 3) * P[0] + 3 * ((1 - tt) ** 2) * tt * P[1] + 3 * (1 - tt) * tt ** 2 * P[2] + tt ** 3 * P[3]
    cl = np.zeros((wh, ww), bool)
    ci = np.clip(((curve[:, 1] - wy0) * SS).astype(int), 0, wh - 1); cj = np.clip(((curve[:, 0] - wx0) * SS).astype(int), 0, ww - 1)
    cl[ci, cj] = True
    dist, (ni, nj) = ndimage.distance_transform_edt(~cl, return_indices=True)
    dist = dist.astype(np.float32) / SS
    # tube radius along the curve: thicker where it leaves the top, finer at the foot
    tidx = np.zeros((wh, ww), np.float32); tidx[ci, cj] = tt[:, 0]
    # The nearest-point field steps from pixel to pixel; normals taken from it striate
    # the tube. Smooth the distance field and take its gradient instead.
    tnear = ndimage.gaussian_filter(tidx[ni, nj], 3 * SS)
    rad = R * (0.118 - 0.030 * tnear)
    dist = ndimage.gaussian_filter(dist, 2.5 * SS)
    hcov = soft(rad - dist, 1.2)
    rho = np.clip(dist / np.maximum(rad, 1), 0, 1)
    gy, gx = np.gradient(dist)
    nrm = np.sqrt(gx * gx + gy * gy) + 1e-6
    nx, ny = gx / nrm * rho, gy / nrm * rho
    dx = dy = None
    nz = np.sqrt(np.clip(1 - nx * nx - ny * ny, 0, 1))
    lam = np.clip(nx * KEY[0] + ny * KEY[1] + nz * KEY[2], 0, 1)
    hv = KEY + np.array([0, 0, 1], np.float32); hv /= np.linalg.norm(hv)
    spec = np.clip(nx * hv[0] + ny * hv[1] + nz * hv[2], 0, 1) ** 40
    h_col = GLAZE * (0.80 + 0.20 * lam)[..., None] + 255 * (0.40 * spec)[..., None]
    h_col *= (1 - 0.10 * rho ** 4)[..., None]           # the tube's own edge falls off
    del dist, ni, nj, tidx, tnear, gx, gy, nrm

    # ── shadows on the floor ─────────────────────────────────────────────────────
    sh = Image.new("L", (ww, wh), 0); d = ImageDraw.Draw(sh)
    fx0 = (cx - R * 0.98 - wx0) * SS; fx1 = (cx + R * 1.06 - wx0) * SS
    d.ellipse([fx0, (yb - e_bot * 0.85 - wy0) * SS, fx1, (yb + e_bot * 1.05 - wy0) * SS], fill=255)
    contact = np.asarray(sh.filter(ImageFilter.GaussianBlur(R * 0.035 * SS)), np.float32) / 255
    cast = Image.new("L", (ww, wh), 0)
    ImageDraw.Draw(cast).ellipse([fx0 + R * 0.20 * SS, (yb - e_bot * 0.4 - wy0) * SS, fx1 + R * 0.55 * SS, (yb + e_bot * 1.9 - wy0) * SS], fill=255)
    cast = np.asarray(cast.filter(ImageFilter.GaussianBlur(R * 0.20 * SS)), np.float32) / 255
    out = bg * (1 - 0.18 * cast - 0.34 * contact)[..., None]

    out = out * (1 - hcov[..., None]) + h_col * hcov[..., None]

    # ── the body ─────────────────────────────────────────────────────────────────
    y_top = yt + e_top * root
    y_bot = yb + e_bot * root
    cov = soft((1 - np.abs(u)) * R, px * 1.5) * soft(Y - y_top, px * 1.5) * soft(y_bot - Y, px * 1.5)
    theta = np.arcsin(np.clip(u, -1, 1))
    lam = np.clip(u * KEY[0] + root * KEY[2], 0, 1)
    hgt = (Y - yt - e_top * root) / (1 + (e_bot - e_top) * root / Hb)   # height down the wall
    v = np.clip(hgt / Hb, 0, 1)
    shade = 0.843 + 0.19 * lam                              # front (u=0) ~0.98 of the glaze
    shade *= 1 - 0.10 * (1 - root) ** 2                     # the cylinder turning away
    shade *= 1 - 0.07 * np.clip((v - 0.80) / 0.20, 0, 1) ** 2  # the floor's darker bounce near the foot
    shade *= 1 - 0.10 * soft(R * 0.035 - (y_bot - Y), 2)    # the foot's bevel
    shade *= 1 + 0.03 * np.clip((0.12 - v) / 0.12, 0, 1)    # bright just under the lip
    for j in (P[0], P[3]):                                  # occlusion where the handle meets the wall
        shade *= 1 - 0.10 * np.exp(-(((X - (cx + R * 0.99)) / (R * 0.05)) ** 2 + ((Y - j[1]) / (R * 0.16)) ** 2))
    body = GLAZE * shade[..., None]

    # the print, wrapped by arc length and wall height
    sheet = print_sheet(art_path, name, medallion, px=2000)
    sa = np.asarray(sheet, np.float32) / 255
    arc_half = 0.92
    band_top, band_h = Hb * 0.15, Hb * 0.72
    scale = min((2 * arc_half * R) / sheet.width, band_h / sheet.height)
    pw, ph = sheet.width * scale, sheet.height * scale
    sx = (theta * R + pw / 2) / scale
    sy = (hgt - (band_top + (band_h - ph) / 2)) / scale
    inside = (sx >= 0) & (sx < sheet.width - 1) & (sy >= 0) & (sy < sheet.height - 1) & (np.abs(u) < 0.999)
    ink = np.zeros((wh, ww, 4), np.float32)
    ink[inside] = bilinear(sa, sx[inside], sy[inside])
    ia = ink[..., 3:4] * 0.97
    rgb = ink[..., :3]
    grey = rgb.mean(axis=2, keepdims=True)
    rgb = grey + (rgb - grey) * 0.94                        # sublimation sits a touch under the screen's colour
    body = body * (1 - ia) + body * rgb * ia
    del ink, rgb, grey, ia

    # the glaze's reflections, over the ink
    vfade = np.clip(v / 0.06, 0, 1) * np.clip((0.97 - v) / 0.12, 0, 1)
    softbox = band(theta, -0.50, 0.11, 0.07) * 0.34 * vfade
    softbox += band(theta, -0.70, 0.025, 0.02) * 0.18 * vfade
    strip = band(theta, 1.30, 0.035, 0.03) * 0.30 * vfade
    bounce = band(theta, 0.95, 0.12, 0.12) * -0.035         # the dark studio side, seen in the glaze
    body = body + 255 * (softbox + strip)[..., None]
    body = body * (1 + bounce)[..., None]
    out = out * (1 - cov[..., None]) + body * cov[..., None]
    del body

    # ── the lip and the inside ───────────────────────────────────────────────────
    ri = 0.935
    eo = ((X - cx) / R) ** 2 + ((Y - yt) / e_top) ** 2
    ei = ((X - cx) / (R * ri)) ** 2 + ((Y - yt) / (e_top * ri)) ** 2
    lip = soft((1 - np.sqrt(eo)) * e_top, px * 1.5) * soft((np.sqrt(ei) - 1) * e_top * ri, px * 1.5)
    far = np.clip(-(Y - yt) / e_top, 0, 1)                   # 1 at the far edge of the lip
    lip_col = GLAZE * (0.90 + 0.10 * far + 0.04 * np.clip(-u, 0, 1))[..., None]
    lip_col += 255 * (0.10 * np.exp(-((u + 0.45) / 0.18) ** 2) * far)[..., None]
    out = out * (1 - lip[..., None]) + lip_col * lip[..., None]

    inner = soft((1 - np.sqrt(ei)) * e_top * ri, px * 1.5)
    ui = np.clip((X - cx) / (R * ri), -1, 1)
    rooti = np.sqrt(np.clip(1 - ui * ui, 0, 1))
    y_back = yt - e_top * ri * rooti; y_front = yt + e_top * ri * rooti
    depth = np.clip((Y - y_back) / np.maximum(y_front - y_back, 1e-3), 0, 1)
    lam_in = np.clip(-ui * KEY[0] + rooti * KEY[2], 0, 1)    # the inner right wall faces the key
    in_shade = (0.70 + 0.28 * lam_in) * (1 - 0.30 * depth ** 1.4)
    out = out * (1 - inner[..., None]) + (GLAZE * in_shade[..., None]) * inner[..., None]

    # ── reduce, add grain, put back in the room ──────────────────────────────────
    win = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB").resize((wx1 - wx0, wy1 - wy0), Image.LANCZOS)
    full = room()
    full[wy0:wy1, wx0:wx1] = np.asarray(win, np.float32)
    rng = np.random.default_rng(11)
    full += rng.normal(0, 1.4, full.shape[:2]).astype(np.float32)[..., None]
    return Image.fromarray(np.clip(full, 0, 255).astype(np.uint8), "RGB")


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
