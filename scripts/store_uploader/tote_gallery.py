#!/usr/bin/env python3
"""
tote_gallery.py — the permanent tote mockup set: one drawing in, six photographs out.

Templates live in templates/tote/ (six blank totes, AI-upscaled from the sample sheet)
with placements.json saying where the front panel is on each. A transparent drawing is
trimmed, fitted into that panel, tilted for the worn views, and MULTIPLIED onto the
canvas so the weave and the folds show through the ink the way a real print does — a
plain paste sits on top of the fabric and looks like a sticker.

  python3 tote_gallery.py art.transparent.png                 # six frames next to the art
  python3 tote_gallery.py art.png --out /path/dir --frames hanging_front shoulder_a carry
  python3 tote_gallery.py /folder/of/*.transparent.png --out /gallery   # one subfolder each
  python3 tote_gallery.py --sheet /gallery                     # contact sheet of everything
  python3 tote_gallery.py art.png --fabric natural             # on unbleached cotton, not white

Output per drawing: <out>/<slug>/<n>_<template>.png at template resolution, plus
<slug>/preview.png (1600px) of the first frame. Feed <out>/<slug>/ to store_upload.py.
"""
from __future__ import annotations
import argparse, glob, json, os, sys
from pathlib import Path
from PIL import Image, ImageChops, ImageFilter

HERE = Path(__file__).resolve().parent
TDIR = HERE / "templates" / "tote"
PRINT_SCALE = 0.96      # how much of the panel the drawing may fill
INK = 0.96              # ink opacity: a little fabric shows through even solid colour
FABRICS = {             # blank canvas colours the trade actually sells
    "white":   None,
    "natural": (239, 227, 200),   # unbleached cotton, the most common blank
    "cream":   (245, 239, 227),
    "oat":     (226, 214, 190),
}


def load_manifest():
    m = json.loads((TDIR / "placements.json").read_text())
    return {t["id"]: t for t in m["templates"]}, m.get("default_frames")


def key_background(im: Image.Image, tol: int = 30) -> Image.Image:
    """A drawing saved on a flat cream or white card, with no real alpha, gets its
    card removed. A file that already has transparency is returned untouched.

    Fast version: the flood-fill from the corners runs on a 512px copy (PIL's fill is
    per-pixel Python and takes minutes at 4096), and that coarse "card" mask is then
    intersected at full resolution with a numpy colour-distance mask, so edges stay
    exact. Interior whites (an eye, a stripe) survive: the fill cannot reach them."""
    import numpy as np
    from PIL import ImageDraw
    im = im.convert("RGBA")
    if im.split()[-1].getextrema()[0] < 250:
        return im
    rgb = np.asarray(im.convert("RGB")).astype(np.int16)
    H, W = rgb.shape[:2]
    corner = np.median(np.stack([rgb[2, 2], rgb[2, W - 3], rgb[H - 3, 2], rgb[H - 3, W - 3]]), axis=0)
    near = (np.abs(rgb - corner).max(axis=2) <= tol)          # full-res: card-coloured pixels
    small = im.convert("RGB").resize((512, int(512 * H / W)), Image.BILINEAR)
    for pt in ((1, 1), (small.width - 2, 1), (1, small.height - 2), (small.width - 2, small.height - 2)):
        ImageDraw.floodfill(small, pt, (255, 0, 255), thresh=tol)
    sm = np.asarray(small)
    reach = (sm[:, :, 0] > 200) & (sm[:, :, 1] < 60) & (sm[:, :, 2] > 200)   # reached by the fill
    reach = np.asarray(Image.fromarray(reach.astype(np.uint8) * 255).resize((W, H), Image.BILINEAR)) > 64
    card = near & reach
    alpha = np.where(card, 0, 255).astype(np.uint8)
    a = Image.fromarray(alpha).filter(ImageFilter.MinFilter(3))
    im.putalpha(a)
    return im


def trim(im: Image.Image) -> Image.Image:
    bbox = im.split()[-1].getbbox()
    return im.crop(bbox) if bbox else im


def bag_mask(canvas: Image.Image, tpl: dict) -> Image.Image:
    """Where the blank canvas is. The photographs put a white bag on a wall of almost
    the same brightness, so no threshold alone can find it; placements.json carries
    hand-drawn polygons for the bag and its straps, and inside them a pixel is canvas
    when it is neutral (grey, not khaki sleeve or blue jeans) and not dark."""
    import numpy as np
    from PIL import ImageDraw
    W, H = canvas.size
    a = np.asarray(canvas).astype(np.int16)
    mn, mx = a.min(axis=2), a.max(axis=2)
    neutral = ((mx - mn) < 18) & (mn > 150)
    region = Image.new("L", (W, H), 0); d = ImageDraw.Draw(region)
    for pg in tpl.get("fabric_polys", []):
        d.polygon([(x * W, y * H) for x, y in pg], fill=255)
    m = (np.asarray(region) > 0) & neutral
    return Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.5))


def dye(canvas: Image.Image, tpl: dict, rgb: tuple) -> Image.Image:
    """Multiply the fabric colour into the bag only: weave, folds and shadows survive."""
    tint = Image.new("RGB", canvas.size, rgb)
    return Image.composite(ImageChops.multiply(canvas, tint), canvas, bag_mask(canvas, tpl))


def compose(art: Image.Image, tpl: dict, fabric=None) -> Image.Image:
    canvas = Image.open(TDIR / tpl["file"]).convert("RGB")
    if fabric:
        canvas = dye(canvas, tpl, fabric)
    W, H = canvas.size
    b = tpl["box"]
    bx, by, bw, bh = int(b["x"] * W), int(b["y"] * H), int(b["w"] * W), int(b["h"] * H)
    a = trim(key_background(art))
    ratio = min(bw * PRINT_SCALE / a.width, bh * PRINT_SCALE / a.height)
    a = a.resize((max(1, int(a.width * ratio)), max(1, int(a.height * ratio))), Image.LANCZOS)
    if tpl.get("rotate"):
        a = a.rotate(tpl["rotate"], resample=Image.BICUBIC, expand=True)
    px, py = bx + (bw - a.width) // 2, by + (bh - a.height) // 2

    # Multiply the ink into the fabric: result = fabric × ink, masked by the drawing's alpha.
    layer = Image.new("RGB", canvas.size, (255, 255, 255))
    layer.paste(a.convert("RGB"), (px, py), a.split()[-1])
    mult = ImageChops.multiply(canvas, layer)
    mask = Image.new("L", canvas.size, 0)
    mask.paste(a.split()[-1].point(lambda v: int(v * INK)), (px, py))
    # A whisper of softness at the edge, as ink bleeds a hair into canvas.
    mask = mask.filter(ImageFilter.GaussianBlur(max(1, W // 1800)))
    return Image.composite(mult, canvas, mask)


def slug_of(p: Path) -> str:
    s = p.name
    for suf in (".transparent.png", ".png", ".webp", ".jpg"):
        if s.endswith(suf): s = s[: -len(suf)]; break
    return s.replace("_4096", "").replace(" ", "_").lower()


def parse_fabric(v):
    if not v or v in ("white",): return None
    if v in FABRICS: return FABRICS[v]
    v = v.lstrip("#"); return tuple(int(v[i:i + 2], 16) for i in (0, 2, 4))


def render(art_path: Path, out_root: Path, frames: list[str], fabric=None) -> Path:
    templates, default = load_manifest()
    frames = frames or default or list(templates)
    art = Image.open(art_path)
    d = out_root / slug_of(art_path); d.mkdir(parents=True, exist_ok=True)
    first = None
    for n, fid in enumerate(frames):
        out = compose(art, templates[fid], fabric)
        out.save(d / f"{n}_{fid}.png", optimize=True)
        if first is None:
            first = out.copy(); first.thumbnail((1600, 1600)); first.save(d / "preview.png")
        print(f"  {d.name}/{n}_{fid}.png {out.size}")
    return d


def sheet(root: Path, T: int = 300) -> Path:
    from PIL import ImageDraw
    dirs = sorted(p for p in root.iterdir() if p.is_dir())
    cols = 6
    rows = [(d, sorted(d.glob("[0-9]*_*.png"))) for d in dirs]
    im = Image.new("RGB", (cols * T, len(rows) * (T + 18)), (60, 60, 60)); dr = ImageDraw.Draw(im)
    for r, (d, files) in enumerate(rows):
        for c, f in enumerate(files[:cols]):
            t = Image.open(f); t.thumbnail((T - 6, T - 6)); im.paste(t, (c * T + 3, r * (T + 18) + 3))
        dr.text((4, r * (T + 18) + T + 2), d.name, fill="white")
    out = root / "contact_sheet.png"; im.save(out); return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("art", nargs="*", help="transparent PNG(s) or globs")
    ap.add_argument("--out", help="output root (default: next to the art)")
    ap.add_argument("--frames", nargs="*", help="template ids, in order (default: placements.json default_frames)")
    ap.add_argument("--all", action="store_true", help="every template, not just the default three")
    ap.add_argument("--sheet", help="build a contact sheet of an output root and exit")
    ap.add_argument("--fabric", default="white", help="white | natural | cream | oat | #rrggbb — the blank's colour")
    a = ap.parse_args()
    if a.sheet:
        print(sheet(Path(a.sheet))); return 0
    paths = [Path(p) for pat in a.art for p in (glob.glob(pat) or [pat])]
    if not paths: ap.error("no art given")
    templates, default = load_manifest()
    frames = list(templates) if a.all else a.frames
    for p in paths:
        out_root = Path(a.out) if a.out else p.parent
        render(p, out_root, frames, parse_fabric(a.fabric))
    return 0


if __name__ == "__main__":
    sys.exit(main())
