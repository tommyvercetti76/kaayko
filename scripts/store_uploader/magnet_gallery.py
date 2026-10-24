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
  python3 magnet_gallery.py ART.png --shape square --out DIR    # a rounded square (24 Oct 2026); --shape rect is 3:2
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
    # 24 Oct 2026 additions: the park each render was COMPOSED for (Forge
    # brand/madhubani/animals.json), so the name on the magnet matches its habitat.
    "cheetah": "KGALAGADI", "secretary-bird": "TSAVO", "plains-zebra": "ETOSHA",
    "hippo": "CHOBE", "white-rhino": "KRUGER", "african-elephant": "AMBOSELI",
    "giraffe": "TARANGIRE", "lion": "SERENGETI", "grey-crowned-crane": "AKAGERA",
    "african-fish-eagle": "MURCHISON", "chinkara": "GIR", "sarus-crane": "KEOLADEO",
    "sloth-bear": "BANDHAVGARH", "red-panda": "NAMDAPHA", "indian-pangolin": "TADOBA",
    "indian-giant-squirrel": "ANAMALAI", "indian-skimmer": "KUTCH",
    "golden-langur": "MANAS",   # 24 Oct 2026 evening (Forge animals.json: manas, Assam)
}


# ── the blank, rebuilt at any size ──────────────────────────────────────────────
# Measured off the live Gaur magnet photograph (960x858, disc r=290 at 466,427):
#   wall 230 top-left falling to 220 bottom-right; light from the upper-left, so the
#   upper-left arc casts nothing and the right arc drops to 145 right at the edge and
#   recovers to the wall about 0.31r away. The disc's paper is 246,246,247.
# It is drawn, not upscaled, so a 3600 px magnet is genuinely 3600 px — no AI, no mush.
WALL = ((230, 229, 227), (221, 219, 216), (230, 229, 226), (220, 218, 214))   # TL TR BL BR
PAPER = (246, 246, 247)
SHADOW = {"dx": 0.085, "dy": 0.055, "blur": 0.098, "strength": 0.40}          # in units of r


def plate(W: int, H: int, cx: float, cy: float, r: float) -> Image.Image:
    wall = Image.new("RGB", (2, 2))
    for i, px in enumerate(WALL):
        wall.putpixel((i % 2, i // 2), px)
    out = wall.resize((W, H), Image.BICUBIC)
    sh = Image.new("L", (W, H), 0)
    ImageDraw.Draw(sh).ellipse([cx - r + r * SHADOW["dx"], cy - r + r * SHADOW["dy"],
                                cx + r + r * SHADOW["dx"], cy + r + r * SHADOW["dy"]], fill=255)
    sh = sh.filter(ImageFilter.GaussianBlur(r * SHADOW["blur"])).point(lambda v: int(v * (1 - SHADOW["strength"]) * 0 + v))
    dark = ImageChops.multiply(out, Image.new("RGB", (W, H), tuple(int(255 * (1 - SHADOW["strength"])) for _ in range(3))))
    out = Image.composite(dark, out, sh)
    disc = Image.new("L", (W, H), 0)
    ImageDraw.Draw(disc).ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    disc = disc.filter(ImageFilter.GaussianBlur(max(1.0, r * 0.004)))
    # the disc's face, a touch brighter where the light falls
    face = Image.new("RGB", (2, 2))
    face.putpixel((0, 0), tuple(min(255, c + 4) for c in PAPER)); face.putpixel((1, 0), PAPER)
    face.putpixel((0, 1), PAPER); face.putpixel((1, 1), tuple(c - 5 for c in PAPER))
    return Image.composite(face.resize((W, H), Image.BICUBIC), out, disc)


def key_background(im: Image.Image, tol: int = 30) -> Image.Image:
    im = im.convert("RGBA")
    al = np.asarray(im.split()[-1])
    # "transparent" files are not always transparent: some carry a cream card with a few
    # stray soft pixels, so min(alpha) alone says opaque when it is not. Key the card
    # whenever almost nothing is actually cut out.
    # Decide by the corners: a cut-out file has transparent corners. A file that is 2%
    # transparent somewhere but still sits on an opaque card (the gaur) was skipped by
    # the old whole-image test and plated with its card (24 Oct 2026).
    h_, w_ = al.shape
    if max(al[2, 2], al[2, w_ - 3], al[h_ - 3, 2], al[h_ - 3, w_ - 3]) < 16:
        # Transparent corners — but an opaque card can sit INSIDE a transparent margin
        # (the gaur). Look at the corners of what is left after trimming; if they are
        # opaque, key that card the same way.
        bb = im.split()[-1].point(lambda v: 255 if v >= 16 else 0).getbbox()
        if not bb:
            return im
        inner = im.crop(bb)
        ia = np.asarray(inner.split()[-1]); ih, iw = ia.shape
        if min(ia[2, 2], ia[2, iw - 3], ia[ih - 3, 2], ia[ih - 3, iw - 3]) < 200:
            return im
        flat = Image.new("RGBA", inner.size); flat.paste(inner.convert("RGB"))
        keyed = key_background(flat.convert("RGB"), tol)
        out = Image.new("RGBA", im.size, (0, 0, 0, 0)); out.paste(keyed, bb[:2])
        return out
    rgb = np.asarray(im.convert("RGB")).astype(np.int16); H, W = rgb.shape[:2]
    # The card's colour is the commonest colour round the border, not the median of the
    # four corners: a ground band that runs off the bottom (the gaur) put two of four
    # corners in red, the median landed between white and red, and nothing was keyed.
    border = np.concatenate([rgb[2, :], rgb[H - 3, :], rgb[:, 2], rgb[:, W - 3]])
    q = (border // 8).astype(np.int32)
    keys, counts = np.unique(q[:, 0] * 1024 + q[:, 1] * 32 + q[:, 2], return_counts=True)
    top = keys[counts.argmax()]
    corner = np.median(border[(q[:, 0] * 1024 + q[:, 1] * 32 + q[:, 2]) == top], axis=0)
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


def render(art_path: Path, name: str, geo: dict, scale: float = 1.0) -> Image.Image:
    W, H = (int(v * scale) for v in geo["canvas"])
    cx, cy, r = (geo["disc"][k] * scale for k in ("cx", "cy", "r"))
    canvas = plate(W, H, cx, cy, r)
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


def render_bleed(art_path: Path, name: str, geo: dict, scale: float = 1.0, medallion: bool = False) -> Image.Image:
    """Full-bleed magnet: a scene render (painted water, ground, sky) fills the disc edge to
    edge and is clipped by the circle, the way a photo magnet is made. Nothing floats on a
    white card. The park name sits in a small cream label at the top, inside the rim."""
    W, H = (int(v * scale) for v in geo["canvas"])
    cx, cy, r = (geo["disc"][k] * scale for k in ("cx", "cy", "r"))
    canvas = plate(W, H, cx, cy, r)
    layer = Image.new("RGB", canvas.size, (255, 255, 255))
    d = int(2 * r)
    if medallion:
        # a render composed as a round medallion: trim to its drawing, fit its own ring just
        # inside the rim, the park name on a chip at the bottom where the ground arc is
        a = trim(key_background(Image.open(art_path)))
        k = min(d * 0.97 / a.width, d * 0.97 / a.height)
        a = a.resize((max(1, int(a.width * k)), max(1, int(a.height * k))), Image.LANCZOS)
        layer.paste(a.convert("RGB"), (int(cx - a.width / 2), int(cy - a.height / 2)), a.split()[-1])
    else:
        a = Image.open(art_path).convert("RGB")
        k = max(d / a.width, d / a.height) * 1.02
        a = a.resize((int(a.width * k), int(a.height * k)), Image.LANCZOS)
        layer.paste(a, (int(cx - a.width / 2), int(cy - a.height / 2)))
    if name:
        name = name.upper(); size = int(r * 0.085)
        font = ImageFont.truetype(str(FONT), size); track = size * TRACK
        widths = [font.getlength(ch) for ch in name]; tw = sum(widths) + track * (len(name) - 1)
        y = (cy + r * 0.80) if medallion else (cy - r * 0.80); pad = size * 0.9
        ld = ImageDraw.Draw(layer, "RGBA")
        ld.rounded_rectangle([cx - tw / 2 - pad, y - size * 0.8, cx + tw / 2 + pad, y + size * 0.8], radius=size * 0.8, fill=(255, 253, 248, 255), outline=(NAME_RGB[0], NAME_RGB[1], NAME_RGB[2], 140), width=max(1, size // 14))
        x = cx - tw / 2
        for ch, w in zip(name, widths):
            ld.text((x, y), ch, font=font, fill=NAME_RGB, anchor="lm"); x += w + track
    disc = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(disc).ellipse([cx - r + 2, cy - r + 2, cx + r - 2, cy + r - 2], fill=255)
    disc = disc.filter(ImageFilter.GaussianBlur(0.6))
    return Image.composite(ImageChops.multiply(canvas, layer), canvas, disc)


def is_scene(art_path: Path, thresh: float = 0.45) -> bool:
    """A render whose drawing covers most of the frame after keying is a scene, not a
    figure on white: it goes full-bleed."""
    al = np.asarray(key_background(Image.open(art_path)).split()[-1]) > 10
    if al.mean() > thresh:
        return True
    ys, xs = np.where(al)
    if len(ys) == 0:
        return False
    y0, y1 = ys.min(), ys.max()
    # a painted water or ground band is a wide unbroken opaque row; a figure never is
    band = al[y0 + int((y1 - y0) * 0.6):y1 + 1]
    runs = 0
    for row in band[::4]:
        d = np.diff(np.concatenate([[0], row.astype(np.int8), [0]]))
        starts, ends = np.where(d == 1)[0], np.where(d == -1)[0]
        if len(starts):
            runs = max(runs, int((ends - starts).max()))
    return runs > 0.42 * al.shape[1]


def diecut(art_path: Path, geo: dict, scale: float = 1.0) -> Image.Image:
    """A stamp magnet is cut to the stamp, not dropped inside a disc: the perforated edge
    IS the edge of the object. Same studio plate and the same light as the round magnets,
    with the shadow cast from the stamp's own outline."""
    W, H = (int(v * scale) for v in geo["canvas"])
    wall = Image.new("RGB", (2, 2))
    for i, px in enumerate(WALL):
        wall.putpixel((i % 2, i // 2), px)
    base = wall.resize((W, H), Image.BICUBIC)

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
    base = Image.composite(ImageChops.multiply(base, Image.new("RGB", (W, H), (120, 118, 114))), base, sh)

    out = base.convert("RGBA")
    out.alpha_composite(a, (px, py))
    # a hair of thickness: the top-left edge catches the light the way the disc does
    lip = Image.new("L", (W, H), 0); lip.paste(alpha, (px, py))
    edge = ImageChops.subtract(lip, lip.filter(ImageFilter.MinFilter(5))).filter(ImageFilter.GaussianBlur(1.2))
    out = Image.composite(Image.new("RGB", (W, H), (255, 255, 255)).convert("RGBA"), out, edge.point(lambda v: int(v * 0.30)))
    return out.convert("RGB")


# ── the rectangle (24 Oct 2026) ────────────────────────────────────────────────
# The same plate as the disc — wall, light from the upper-left, cast shadow, paper —
# on a 3:2 card with rounded corners. A tall drawing (a secretary bird) gets the
# card on its end. Sizes are in units of s, half the card's short side, the way the
# disc's are in units of r.
RECT_RATIO = 1.5
RECT_RADIUS = 0.12          # corner radius, in units of s


def rect_box(W: int, H: int, portrait: bool, ratio: float = RECT_RATIO):
    if ratio == 1.0:                       # the square: the disc's own footprint
        w = h = min(W, H) * 0.66
    elif portrait:
        h = H * 0.84; w = h / ratio
    else:
        w = W * 0.80; h = w / ratio
        if h > H * 0.80: h = H * 0.80; w = h * ratio
    x0, y0 = (W - w) / 2, (H - h) / 2
    return (x0, y0, x0 + w, y0 + h), min(w, h) / 2


def rect_mask(size, box, rad, inset=0.0):
    m = Image.new("L", size, 0)
    x0, y0, x1, y1 = box
    ImageDraw.Draw(m).rounded_rectangle([x0 + inset, y0 + inset, x1 - inset, y1 - inset], radius=max(1, rad - inset), fill=255)
    return m


def rect_plate(W: int, H: int, box, s: float) -> Image.Image:
    wall = Image.new("RGB", (2, 2))
    for i, px in enumerate(WALL):
        wall.putpixel((i % 2, i // 2), px)
    out = wall.resize((W, H), Image.BICUBIC)
    rad = s * RECT_RADIUS
    x0, y0, x1, y1 = box
    dx, dy = s * SHADOW["dx"], s * SHADOW["dy"]
    sh = rect_mask((W, H), (x0 + dx, y0 + dy, x1 + dx, y1 + dy), rad).filter(ImageFilter.GaussianBlur(s * SHADOW["blur"]))
    dark = ImageChops.multiply(out, Image.new("RGB", (W, H), tuple(int(255 * (1 - SHADOW["strength"])) for _ in range(3))))
    out = Image.composite(dark, out, sh)
    card = rect_mask((W, H), box, rad).filter(ImageFilter.GaussianBlur(max(1.0, s * 0.004)))
    face = Image.new("RGB", (2, 2))
    face.putpixel((0, 0), tuple(min(255, c + 4) for c in PAPER)); face.putpixel((1, 0), PAPER)
    face.putpixel((0, 1), PAPER); face.putpixel((1, 1), tuple(c - 5 for c in PAPER))
    return Image.composite(face.resize((W, H), Image.BICUBIC), out, card)


def _name_row(layer, mask, name, cx, y, size):
    font = ImageFont.truetype(str(FONT), size); track = size * TRACK
    widths = [font.getlength(ch) for ch in name]
    x = cx - (sum(widths) + track * (len(name) - 1)) / 2
    ld, md = ImageDraw.Draw(layer), ImageDraw.Draw(mask)
    for ch, w in zip(name, widths):
        ld.text((x, y), ch, font=font, fill=NAME_RGB, anchor="lm")
        md.text((x, y), ch, font=font, fill=255, anchor="lm")
        x += w + track


def ring_clip(im: Image.Image) -> Image.Image:
    """A medallion's drawing lives inside its ring. The engine sometimes signs the
    corner outside it (a scrawl under the sloth bear, a spiral by the skimmer); the
    disc hides that, a square shows it. Keep only the centred circle."""
    im = im.convert("RGBA")
    w, h = im.size
    # The ring's radius, measured: the outermost radius at which the drawing covers most
    # of the circle. A signature covers a few degrees, so it never qualifies.
    al = np.asarray(im.split()[-1]) > 40
    cy, cx = h / 2, w / 2
    th = np.linspace(0, 2 * np.pi, 360, endpoint=False)
    ring = None
    for rr in np.arange(min(w, h) * 0.5, min(w, h) * 0.30, -max(1.0, min(w, h) / 400)):
        xs = np.clip((cx + rr * np.cos(th)).astype(int), 0, w - 1)
        ys = np.clip((cy + rr * np.sin(th)).astype(int), 0, h - 1)
        if al[ys, xs].mean() > 0.6:
            ring = rr; break
    r = (ring + min(w, h) * 0.006) if ring else min(w, h) * 0.495
    m = Image.new("L", im.size, 0)
    ImageDraw.Draw(m).ellipse([w / 2 - r, h / 2 - r, w / 2 + r, h / 2 + r], fill=255)
    im.putalpha(ImageChops.multiply(im.split()[-1], m))
    return im


def render_rect(art_path: Path, name: str, geo: dict, scale: float = 1.0, bleed: bool = False, ratio: float = RECT_RATIO, clip_ring: bool = False) -> Image.Image:
    W, H = (int(v * scale) for v in geo["canvas"])
    raw = key_background(Image.open(art_path))
    if clip_ring:
        raw = ring_clip(raw)
    a = trim(raw)
    portrait = (not bleed) and a.height > a.width * 1.08
    box, s = rect_box(W, H, portrait, ratio)
    x0, y0, x1, y1 = box
    canvas = rect_plate(W, H, box, s)
    layer = Image.new("RGB", canvas.size, (255, 255, 255))
    mask = Image.new("L", canvas.size, 0)
    size = int(s * 0.115)              # the disc's name is r * 0.092 on a larger face; this reads the same
    name = (name or "").upper()
    if bleed:
        # a scene fills the card edge to edge; the name sits on a chip at the top
        full = Image.open(art_path).convert("RGB")
        k = max((x1 - x0) / full.width, (y1 - y0) / full.height) * 1.02
        full = full.resize((int(full.width * k), int(full.height * k)), Image.LANCZOS)
        layer.paste(full, (int((x0 + x1 - full.width) / 2), int((y0 + y1 - full.height) / 2)))
        if name:
            font = ImageFont.truetype(str(FONT), size); track = size * TRACK
            tw = sum(font.getlength(ch) for ch in name) + track * (len(name) - 1); pad = size * 0.9
            yy = y0 + s * 0.30
            ImageDraw.Draw(layer, "RGBA").rounded_rectangle([(x0 + x1) / 2 - tw / 2 - pad, yy - size * 0.8, (x0 + x1) / 2 + tw / 2 + pad, yy + size * 0.8],
                radius=size * 0.8, fill=(255, 253, 248, 255), outline=(NAME_RGB[0], NAME_RGB[1], NAME_RGB[2], 140), width=max(1, size // 14))
            _name_row(layer, Image.new("L", canvas.size, 0), name, (x0 + x1) / 2, yy, size)
        mask = rect_mask(canvas.size, box, s * RECT_RADIUS, inset=2).filter(ImageFilter.GaussianBlur(0.6))
        return Image.composite(ImageChops.multiply(canvas, layer), canvas, mask)
    # a figure on the paper: name across the top, the drawing centred under it
    inset = s * 0.16
    top = y0 + inset
    if name:
        _name_row(layer, mask, name, (x0 + x1) / 2, top + size * 0.6, size)
    box_top = top + size * (1.9 if name else 0.0)
    box_h, box_w = (y1 - inset) - box_top, (x1 - x0) - 2 * inset
    k = min(box_w / a.width, box_h / a.height)
    a = a.resize((max(1, int(a.width * k)), max(1, int(a.height * k))), Image.LANCZOS)
    px, py = int((x0 + x1) / 2 - a.width / 2), int(box_top + (box_h - a.height) / 2)
    layer.paste(a.convert("RGB"), (px, py), a.split()[-1])
    am = Image.new("L", canvas.size, 0); am.paste(a.split()[-1], (px, py))
    mask = ImageChops.lighter(mask, am)
    mask = ImageChops.multiply(mask, rect_mask(canvas.size, box, s * RECT_RADIUS, inset=2)).filter(ImageFilter.GaussianBlur(0.6))
    return Image.composite(ImageChops.multiply(canvas, layer), canvas, mask)


# ── the badge layout (24 Oct 2026, Rohan: "names … KEEP them outside", "TOO hugging
# borders. Space out gracefully") ─────────────────────────────────────────────────
# One rule for every magnet: the name lives on the paper, never on the artwork — on an
# arc along the top rim of a disc, straight across the top of a square — and the
# drawing is fitted by its actual inked pixels into a safe zone well inside the edge.
SAFE_ROUND = 0.70           # no ink beyond 70% of the disc's radius
NAME_ARC = 0.835            # the name's baseline circle, in units of r
SAFE_SQUARE = 0.16          # margin on every side of a square, in units of the half-side


def _ink_points(a: Image.Image, step: int = 3):
    al = np.asarray(a.split()[-1])[::step, ::step] > 40
    ys, xs = np.nonzero(al)
    return xs.astype(np.float32) * step, ys.astype(np.float32) * step


def _prep_art(art_path: Path, medallion: bool) -> Image.Image:
    a = key_background(Image.open(art_path))
    if medallion:
        a = ring_clip(a)
    return trim(a)


def _arc_name(layer, mask, name, cx, cy, radius, size):
    """Letter-spaced name centred on the top of a circle, each glyph turned to the tangent."""
    font = ImageFont.truetype(str(FONT), size)
    track = size * TRACK
    widths = [font.getlength(ch) for ch in name]
    total = sum(widths) + track * (len(name) - 1)
    ang = -np.pi / 2 - (total / radius) / 2          # start left of top, run clockwise
    for ch, w in zip(name, widths):
        mid = ang + (w / 2) / radius
        gx, gy = cx + radius * np.cos(mid), cy + radius * np.sin(mid)
        g = Image.new("L", (int(size * 2.2), int(size * 2.2)), 0)
        ImageDraw.Draw(g).text((g.width / 2, g.height / 2), ch, font=font, fill=255, anchor="mm")
        g = g.rotate(-np.degrees(mid + np.pi / 2), resample=Image.BICUBIC)
        ox, oy = int(gx - g.width / 2), int(gy - g.height / 2)
        layer.paste(Image.new("RGB", g.size, NAME_RGB), (ox, oy), g)
        mask.paste(ImageChops.lighter(mask.crop((ox, oy, ox + g.width, oy + g.height)), g), (ox, oy))
        ang += (w + track) / radius


def badge_face(art_path: Path, name: str, shape: str = "round", medallion: bool = False, size: int = 2048):
    """The magnet's printed face alone, size x size, in its own frame: (ink layer on
    white, ink mask, outline). The photograph (render_badge) and the 3D inspect
    texture (inspect_textures.py) both come from here, so they can never disagree."""
    a = _prep_art(art_path, medallion)
    name = (name or "").upper()
    xs, ys = _ink_points(a)
    h = size / 2                                   # r of the disc, or s of the square
    cx = cy = h
    if shape == "round":
        outline = Image.new("L", (size, size), 0)
        ImageDraw.Draw(outline).ellipse([2, 2, size - 2, size - 2], fill=255)
        mx, my = (a.width / 2, a.height / 2) if medallion else ((xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2)
        reach = float(np.sqrt((xs - mx) ** 2 + (ys - my) ** 2).max()) or 1.0
        k = h * (SAFE_ROUND if name else SAFE_ROUND + 0.04) / reach
        acx, acy = cx, cy + (h * 0.05 if name else 0.0)
    else:
        outline = rect_mask((size, size), (0, 0, size, size), h * RECT_RADIUS, inset=2)
        m = SAFE_SQUARE * h * 2
        top = (h * 0.42 if name else m)
        rx0, ry0, rx1, ry1 = m, top, size - m, size - m
        if medallion:
            mx, my = a.width / 2, a.height / 2
            reach = float(np.sqrt((xs - mx) ** 2 + (ys - my) ** 2).max()) or 1.0
            k = min(rx1 - rx0, ry1 - ry0) / 2 / reach
        else:
            mx, my = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
            k = min((rx1 - rx0) / max(1.0, xs.max() - xs.min()), (ry1 - ry0) / max(1.0, ys.max() - ys.min()))
        acx, acy = (rx0 + rx1) / 2, (ry0 + ry1) / 2
    layer = Image.new("RGB", (size, size), (255, 255, 255))
    mask = Image.new("L", (size, size), 0)
    art = a.resize((max(1, int(a.width * k)), max(1, int(a.height * k))), Image.LANCZOS)
    px, py = int(acx - mx * k), int(acy - my * k)
    layer.paste(art.convert("RGB"), (px, py), art.split()[-1])
    am = Image.new("L", (size, size), 0); am.paste(art.split()[-1], (px, py))
    mask = ImageChops.lighter(mask, am)
    if name:
        if shape == "round":
            fs = int(h * 0.097)
            # a long name gets smaller type before it gets a longer arc (max ~110 degrees)
            font = ImageFont.truetype(str(FONT), fs)
            while fs > h * 0.05 and (sum(font.getlength(c) for c in name) + fs * TRACK * (len(name) - 1)) / (h * NAME_ARC) > np.radians(110):
                fs -= 2; font = ImageFont.truetype(str(FONT), fs)
            _arc_name(layer, mask, name, cx, cy, h * NAME_ARC, fs)
        else:
            _name_row(layer, mask, name, cx, h * 0.22, int(h * 0.115))
    return layer, ImageChops.multiply(mask, outline), outline


def render_badge(art_path: Path, name: str, geo: dict, scale: float = 1.0, shape: str = "round", medallion: bool = False) -> Image.Image:
    W, H = (int(v * scale) for v in geo["canvas"])
    if shape == "round":
        cx, cy, r = (geo["disc"][k] * scale for k in ("cx", "cy", "r"))
        canvas = plate(W, H, cx, cy, r)
        x0, y0, side = cx - r, cy - r, 2 * r
    else:
        box, s_ = rect_box(W, H, False, 1.0)
        canvas = rect_plate(W, H, box, s_)
        x0, y0, side = box[0], box[1], box[2] - box[0]
    layer_f, mask_f, _ = badge_face(art_path, name, shape, medallion, size=int(round(side)))
    layer = Image.new("RGB", canvas.size, (255, 255, 255)); layer.paste(layer_f, (int(round(x0)), int(round(y0))))
    mask = Image.new("L", canvas.size, 0); mask.paste(mask_f, (int(round(x0)), int(round(y0))))
    mask = mask.filter(ImageFilter.GaussianBlur(0.6))
    return Image.composite(ImageChops.multiply(canvas, layer), canvas, mask)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("art", nargs="+"); ap.add_argument("--out", required=True)
    ap.add_argument("--name", help="park name for a single magnet")
    ap.add_argument("--names", help="JSON file: {<art stem>: <park name>}; defaults to the PARKS table")
    ap.add_argument("--size", type=int, default=3600, help="output width in px; the blank is drawn at this size, never upscaled")
    ap.add_argument("--bleed", choices=["auto", "on", "off"], default="auto", help="scene renders fill the disc edge to edge (auto: decided per file)")
    ap.add_argument("--medallion", action="store_true", help="renders composed as round medallions: fit the ring inside the rim, name at the bottom")
    ap.add_argument("--diecut", action="store_true", help="the magnet is the artwork's own shape (stamps), not a round disc")
    ap.add_argument("--badge", action="store_true", help="the 24 Oct 2026 layout: name on the paper (arc on a disc, straight on a square), drawing fitted inside a safe zone")
    ap.add_argument("--ring-clip", action="store_true", help="medallion art: drop anything outside the drawn ring (engine signatures) before plating")
    ap.add_argument("--shape", choices=["round", "square", "rect"], default="round", help="round disc (default), a rounded square, or a 3:2 rounded rectangle")
    a = ap.parse_args()
    out = Path(a.out)
    if out.exists() and any(out.iterdir()):
        sys.exit(f"{out} already has files — pick a new folder")
    out.mkdir(parents=True, exist_ok=True)
    geo = json.loads((TDIR / "geometry.json").read_text())
    geo.setdefault("canvas", list(Image.open(TDIR / "0_front.png").size))
    scale = a.size / geo["canvas"][0]
    names = json.loads(Path(a.names).read_text()) if a.names else {}
    paths = [Path(p) for pat in a.art for p in (glob.glob(pat) or [pat])]
    for p in paths:
        stem = p.stem.replace(".transparent", "").replace("_transparent_4096", "").replace("_4096", "")
        if a.badge:
            hit = next((k for k in sorted(PARKS, key=len, reverse=True) if k in stem), None)
            name = a.name if a.name is not None else (PARKS.get(hit, "") if hit else "")
            im = render_badge(p, name, geo, scale, shape="round" if a.shape == "round" else "square", medallion=a.ring_clip)
            dst = out / f"{stem}_{'' if a.shape == 'round' else 'square_'}magnet.png"; im.save(dst, optimize=True)
            print(f"  {dst.name}  '{name}'  {im.size}")
            continue
        if a.diecut:
            name = ""
            im = diecut(p, geo, scale)
        else:
            if a.name is not None:
                name = a.name
            elif stem in names or stem in PARKS:
                name = names.get(stem) or PARKS.get(stem, "")
            else:   # file names vary ("gaur_gaur", "04_blackbuck_madhubani_tshirt"): match on the species
                hit = next((k for k in sorted(PARKS, key=len, reverse=True) if k in stem), None)
                name = PARKS.get(hit, "") if hit else ""
                if hit is None: print(f"  (no park known for {stem})")
            bleed = a.bleed == "on" or (a.bleed == "auto" and is_scene(p))
            if a.shape in ("rect", "square"):
                im = render_rect(p, name, geo, scale, bleed=bleed, ratio=1.0 if a.shape == "square" else RECT_RATIO, clip_ring=a.ring_clip)
            else:
                im = render_bleed(p, name, geo, scale, medallion=True) if a.medallion else (render_bleed(p, name, geo, scale) if bleed else render(p, name, geo, scale))
        dst = out / f"{stem}_{'' if a.shape == 'round' else a.shape + '_'}magnet.png"; im.save(dst, optimize=True)
        print(f"  {dst.name}  '{name}'  {im.size}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
