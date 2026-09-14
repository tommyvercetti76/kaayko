#!/usr/bin/env python3
"""
magnet_gallery.py — a drawing on the round magnet blank, the way the two live magnets look.

The blank in templates/magnet/ was derived from the photograph of the live Gaur magnet:
the disc wiped to its own paper, the studio shadow and the disc's edge shading kept. So a
new magnet sits in the same light as the two that are already on the shelf.

Layout, measured from the live pair: the park name in Josefin across the top of the disc,
the drawing centred under it, the whole print inside 80% of the disc so nothing runs to
the edge. The art is multiplied into the paper, not pasted, so the disc's shading survives.

  python3 magnet_gallery.py ART.png --name "Hemis" --out DIR
  python3 magnet_gallery.py 'folder/*.transparent.png' --names names.json --out DIR
"""
from __future__ import annotations
import argparse, glob, json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
TDIR = HERE / "templates" / "magnet"
FONT = HERE.parents[1] / "src" / "fonts" / "JosefinSans-SemiBold.ttf"
NAME_RGB = (214, 108, 46)     # the orange the live magnets use for the park name


def key_background(im: Image.Image, tol: int = 30) -> Image.Image:
    im = im.convert("RGBA")
    if im.split()[-1].getextrema()[0] < 250:
        return im
    rgb = np.asarray(im.convert("RGB")).astype(np.int16); H, W = rgb.shape[:2]
    corner = np.median(np.stack([rgb[2, 2], rgb[2, W - 3], rgb[H - 3, 2], rgb[H - 3, W - 3]]), axis=0)
    near = np.abs(rgb - corner).max(axis=2) <= tol
    small = im.convert("RGB").resize((512, int(512 * H / W)), Image.BILINEAR)
    for pt in ((1, 1), (small.width - 2, 1), (1, small.height - 2), (small.width - 2, small.height - 2)):
        ImageDraw.floodfill(small, pt, (255, 0, 255), thresh=tol)
    sm = np.asarray(small)
    reach = (sm[..., 0] > 200) & (sm[..., 1] < 60) & (sm[..., 2] > 200)
    reach = np.asarray(Image.fromarray(reach.astype(np.uint8) * 255).resize((W, H), Image.BILINEAR)) > 64
    im.putalpha(Image.fromarray(np.where(near & reach, 0, 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)))
    return im


def trim(im: Image.Image) -> Image.Image:
    bb = im.split()[-1].getbbox()
    return im.crop(bb) if bb else im


def render(art_path: Path, name: str, geo: dict) -> Image.Image:
    canvas = Image.open(TDIR / "0_front.png").convert("RGB")
    cx, cy, r = geo["disc"]["cx"], geo["disc"]["cy"], geo["disc"]["r"]
    inset = r * geo["print"]["inset"]

    layer = Image.new("RGB", canvas.size, (255, 255, 255))
    mask = Image.new("L", canvas.size, 0)

    # park name across the top of the disc
    top = cy - inset
    size = int(r * 0.135)
    font = ImageFont.truetype(str(FONT), size)
    tl = Image.new("RGB", canvas.size, (255, 255, 255)); td = ImageDraw.Draw(tl)
    tm = Image.new("L", canvas.size, 0); tmd = ImageDraw.Draw(tm)
    for d, fill in ((td, NAME_RGB), (tmd, 255)):
        d.text((cx, top + size * 0.5), name, font=font, fill=fill, anchor="mm")
    layer.paste(tl, (0, 0), tm); mask.paste(tm, (0, 0), tm)

    # the drawing, centred in the disc below the name
    a = trim(key_background(Image.open(art_path)))
    box_top = top + size * 1.5
    box_h = (cy + inset) - box_top
    box_w = 2 * inset * 0.94
    k = min(box_w / a.width, box_h / a.height)
    a = a.resize((max(1, int(a.width * k)), max(1, int(a.height * k))), Image.LANCZOS)
    px, py = int(cx - a.width / 2), int(box_top + (box_h - a.height) / 2)
    layer.paste(a.convert("RGB"), (px, py), a.split()[-1])
    am = Image.new("L", canvas.size, 0); am.paste(a.split()[-1], (px, py))
    mask = ImageChops.lighter(mask, am)

    # clip to the disc, then multiply so the disc's own shading shows through the ink
    disc = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(disc).ellipse([cx - r + 2, cy - r + 2, cx + r - 2, cy + r - 2], fill=255)
    mask = ImageChops.multiply(mask, disc).filter(ImageFilter.GaussianBlur(0.6))
    return Image.composite(ImageChops.multiply(canvas, layer), canvas, mask)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("art", nargs="+"); ap.add_argument("--out", required=True)
    ap.add_argument("--name", help="park name for a single magnet")
    ap.add_argument("--names", help="JSON file: {<art stem>: <park name>}")
    a = ap.parse_args()
    out = Path(a.out)
    if out.exists() and any(out.iterdir()):
        sys.exit(f"{out} already has files — pick a new folder")
    out.mkdir(parents=True, exist_ok=True)
    geo = json.loads((TDIR / "geometry.json").read_text())
    names = json.loads(Path(a.names).read_text()) if a.names else {}
    paths = [Path(p) for pat in a.art for p in (glob.glob(pat) or [pat])]
    for p in paths:
        stem = p.stem.replace(".transparent", "").replace("_transparent_4096", "").replace("_4096", "")
        name = a.name or names.get(stem) or names.get(p.stem) or ""
        im = render(p, name, geo)
        dst = out / f"{stem}_magnet.png"; im.save(dst, optimize=True)
        print(f"  {dst.name}  '{name}'  {im.size}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
