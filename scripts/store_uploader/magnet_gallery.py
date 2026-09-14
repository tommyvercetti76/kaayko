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
FONT = HERE.parents[1] / "src" / "fonts" / "JosefinSans-Bold.ttf"
NAME_RGB = (214, 108, 46)     # the orange the live magnets use for the park name
TRACK = 0.115                 # letter-spacing as a fraction of the cap height: the store's label voice

# Proper one-word park names, the way the two live magnets already say "Pench" and "Gir".
PARKS = {
    "barasingha": "KANHA", "blackbuck": "VELAVADAR", "saltwater-crocodile": "RANGANATHITTU",
    "fishing-cat": "SUNDARBANS", "bengal-florican": "MANAS", "gaur": "PENCH",
    "asiatic-lion": "GIR", "gray-langur": "RANTHAMBORE", "peacock": "KEOLADEO",
    "indian-pitta": "TADOBA", "snow-leopard": "HEMIS", "raccoon": "",
}


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
    size = int(r * 0.092)
    if name:
        name = name.upper()
        font = ImageFont.truetype(str(FONT), size)
        track = size * TRACK
        tl = Image.new("RGB", canvas.size, (255, 255, 255)); td = ImageDraw.Draw(tl)
        tm = Image.new("L", canvas.size, 0); tmd = ImageDraw.Draw(tm)
        widths = [font.getlength(ch) for ch in name]
        x = cx - (sum(widths) + track * (len(name) - 1)) / 2
        y = top + size * 0.6
        for ch, w in zip(name, widths):
            td.text((x, y), ch, font=font, fill=NAME_RGB, anchor="lm")
            tmd.text((x, y), ch, font=font, fill=255, anchor="lm")
            x += w + track
        layer.paste(tl, (0, 0), tm); mask.paste(tm, (0, 0), tm)

    # the drawing, centred in the disc below the name
    a = trim(key_background(Image.open(art_path)))
    box_top = top + size * (1.9 if name else 0.0)
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


def diecut(art_path: Path, geo: dict) -> Image.Image:
    """A stamp magnet is cut to the stamp, not dropped inside a disc: the perforated edge
    IS the edge of the object. Same studio plate and the same light as the round magnets,
    with the shadow cast from the stamp's own outline."""
    W, H = geo["canvas"]
    # the studio wall, rebuilt from the blank's own corners (brighter left, cooler right)
    wall = Image.new("RGB", (2, 2)); wall.putpixel((0, 0), (230, 229, 227)); wall.putpixel((1, 0), (221, 219, 216))
    wall.putpixel((0, 1), (230, 229, 226)); wall.putpixel((1, 1), (220, 218, 214))
    plate = wall.resize((W, H), Image.BICUBIC)

    a = Image.open(art_path).convert("RGBA")
    # equal AREA, not equal bounding box: a landscape stamp and a portrait one are the
    # same physical magnet, so they must read the same size on the shelf
    target = (W * 0.60) * (H * 0.60)
    k = min((target / (a.width * a.height)) ** 0.5, W * 0.72 / a.width, H * 0.80 / a.height)
    a = a.resize((max(1, int(a.width * k)), max(1, int(a.height * k))), Image.LANCZOS)
    px, py = (W - a.width) // 2, (H - a.height) // 2
    alpha = a.split()[-1]

    # the cast shadow: the stamp's own silhouette, offset and softened like the disc's
    off = max(3, int(W * 0.012))
    sh = Image.new("L", (W, H), 0); sh.paste(alpha, (px + off, py + int(off * 1.2)))
    sh = sh.filter(ImageFilter.GaussianBlur(W * 0.016)).point(lambda v: int(v * 0.42))
    plate = Image.composite(ImageChops.multiply(plate, Image.new("RGB", (W, H), (120, 118, 114))), plate, sh)

    out = plate.convert("RGBA")
    out.alpha_composite(a, (px, py))
    # a hair of thickness: the top-left edge catches the light the way the disc does
    lip = Image.new("L", (W, H), 0); lip.paste(alpha, (px, py))
    edge = ImageChops.subtract(lip, lip.filter(ImageFilter.MinFilter(5))).filter(ImageFilter.GaussianBlur(1.2))
    out = Image.composite(Image.new("RGB", (W, H), (255, 255, 255)).convert("RGBA"), out, edge.point(lambda v: int(v * 0.30)))
    return out.convert("RGB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("art", nargs="+"); ap.add_argument("--out", required=True)
    ap.add_argument("--name", help="park name for a single magnet")
    ap.add_argument("--names", help="JSON file: {<art stem>: <park name>}; defaults to the PARKS table")
    ap.add_argument("--diecut", action="store_true", help="the magnet is the artwork's own shape (stamps), not a round disc")
    a = ap.parse_args()
    out = Path(a.out)
    if out.exists() and any(out.iterdir()):
        sys.exit(f"{out} already has files — pick a new folder")
    out.mkdir(parents=True, exist_ok=True)
    geo = json.loads((TDIR / "geometry.json").read_text())
    geo.setdefault("canvas", list(Image.open(TDIR / "0_front.png").size))
    names = json.loads(Path(a.names).read_text()) if a.names else {}
    paths = [Path(p) for pat in a.art for p in (glob.glob(pat) or [pat])]
    for p in paths:
        stem = p.stem.replace(".transparent", "").replace("_transparent_4096", "").replace("_4096", "")
        if a.diecut:
            name = ""
            im = diecut(p, geo)
        else:
            name = a.name if a.name is not None else (names.get(stem) or PARKS.get(stem, ""))
            im = render(p, name, geo)
        dst = out / f"{stem}_magnet.png"; im.save(dst, optimize=True)
        print(f"  {dst.name}  '{name}'  {im.size}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
