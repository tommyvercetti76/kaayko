#!/usr/bin/env python3
"""
garment_prints.py — the prints the 3D tees and totes wear (25 Oct 2026).

The fabric, its colour and its outline are drawn in the browser (js/inspect/cloth.js);
all a garment needs from here is its print, as a transparent image, and — for a tee —
where that print sits, measured off the product's own flat-lay photograph so the 3D tee
and the photo agree.

  tote_print(art)          the drawing, trimmed to its ink, at most 1600 px
  stamp_print(scan)        a stamp scan cropped to the stamp, perforations cut as alpha
  measure_print(mockup)    (width_cm, top_cm) of the print on the tee in a flat-lay photo

inspect_textures.py calls these; nothing here writes files.
"""
from __future__ import annotations
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

TEE_BODY_CM = 54.0      # cloth.js's tee across the chest (26.5 cm a side at the armpit, 27.5 at the hem)
TEE_LENGTH_CM = 72.0    # and from the collar to the hem
MAX_SIDE = 1600


def _cap(im: Image.Image, side: int = MAX_SIDE) -> Image.Image:
    s = max(im.size)
    return im if s <= side else im.resize((round(im.width * side / s), round(im.height * side / s)), Image.LANCZOS)


def tote_print(art: Path) -> Image.Image:
    """The drawing trimmed to its ink, at most 1600 px on its long side. The catalogue's
    cut-outs carry a faint haze of alpha over the whole canvas (alpha ~10–40 everywhere),
    which would print as a pale square on the canvas and kept the trim at full size:
    it is cleared first."""
    im = Image.open(art).convert("RGBA")
    a = im.split()[-1].point(lambda v: 0 if v < 48 else v)
    im.putalpha(a)
    box = a.point(lambda v: 255 if v > 96 else 0).getbbox()
    if box:
        pad = round(0.02 * max(im.size))
        box = (max(0, box[0] - pad), max(0, box[1] - pad), min(im.width, box[2] + pad), min(im.height, box[3] + pad))
    return _cap(im.crop(box) if box else im)


def _ink_box(rgb: np.ndarray) -> tuple[int, int, int, int]:
    """Bounding box of the printed design on a stamp scan: coloured or dark pixels,
    the largest block of them (a thin album frame line round the scan is not it)."""
    r, g, b = [rgb[..., i].astype(np.int16) for i in range(3)]
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
    ink = ((mx - mn) > 28) | (mx < 170)
    # thin lines (a frame) vanish under an opening; the design survives
    m = Image.fromarray((ink * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(9))
    a = np.array(m) > 0
    rows, cols = np.where(a.any(1))[0], np.where(a.any(0))[0]
    return int(cols[0]), int(rows[0]), int(cols[-1]) + 1, int(rows[-1]) + 1


def stamp_print(scan: Path, margin: float = 0.075) -> Image.Image:
    """The stamp: its design plus the white paper round it, with perforation teeth cut
    into the edge as transparency — the way the stamp sits on the tee in the photos."""
    im = Image.open(scan).convert("RGB")
    rgb = np.array(im)
    x0, y0, x1, y1 = _ink_box(rgb)
    m = round(margin * (x1 - x0))
    box = (max(0, x0 - m), max(0, y0 - m), min(im.width, x1 + m), min(im.height, y1 + m))
    st = im.crop(box)
    # the scan's paper can be grey or cream: lift it to stamp-paper white without
    # touching the design (only near-neutral, light pixels move)
    a = np.array(st).astype(np.float32)
    light = (a.min(2) > 200) & ((a.max(2) - a.min(2)) < 22)
    a[light] = a[light] * 0.25 + np.array([247, 246, 241]) * 0.75
    st = Image.fromarray(a.clip(0, 255).astype(np.uint8))
    W, H = st.size
    alpha = Image.new("L", (W, H), 255)
    d = ImageDraw.Draw(alpha)
    r = max(3, round(min(W, H) * 0.014)); step = 2.7 * r
    for edge in ("top", "bottom", "left", "right"):
        length = W if edge in ("top", "bottom") else H
        n = max(2, round(length / step))
        for i in range(n + 1):
            t = i * length / n
            cx, cy = {"top": (t, 0), "bottom": (t, H), "left": (0, t), "right": (W, t)}[edge]
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=0)
    st.putalpha(alpha)
    return _cap(st.convert("RGBA"))


def measure_print(mockup: Path) -> tuple[float, float]:
    """Width and top (cm below the collar) of the print on a flat-lay tee photograph.

    The fabric is the colour of the tee's chest; the tee is every row's span of
    fabric-coloured pixels (its drop shadow on the backdrop is not fabric-coloured,
    which a plain "unlike the backdrop" test got wrong); its body width is the median
    span of its lower half; the print is the dense block of pixels inside the tee that
    are far from the fabric colour, found by row and column density, so folds and
    highlights scattered over the cloth do not stretch it."""
    im = Image.open(mockup).convert("RGB")
    a = np.array(im).astype(np.int16)
    h, w = a.shape[:2]
    bg = np.median(np.concatenate([a[:8, :8].reshape(-1, 3), a[:8, -8:].reshape(-1, 3)]), 0)
    rough = np.abs(a - bg).sum(2) > 160
    fabric = np.median(a[rough].reshape(-1, 3), 0)
    cloth = np.abs(a - fabric).sum(2) < 110
    rows = np.where(cloth.sum(1) > w * 0.08)[0]
    top, bottom = int(rows[0]), int(rows[-1])
    spans = {}
    for y in range(top, bottom + 1):
        xs = np.where(cloth[y])[0]
        if xs.size > w * 0.08: spans[y] = (int(xs[0]), int(xs[-1]))
    lower = [(x0, x1) for y, (x0, x1) in spans.items() if top + (bottom - top) * 0.55 < y < bottom - (bottom - top) * 0.08]
    bx0, bx1 = int(np.median([p[0] for p in lower])), int(np.median([p[1] for p in lower]))
    body = float(bx1 - bx0)
    # the chest only: between the body's own sides (a span across the armpits reaches the
    # sleeve tips, and the backdrop under a sleeve is "unlike the fabric" too), below the
    # collar and its label, above the hem
    pad = int(0.04 * body)
    inner = np.zeros((h, w), bool)
    inner[top + int(0.12 * body): bottom - pad, bx0 + pad: bx1 - pad] = True   # below the collar and its label
    inner &= np.array([[y in spans] for y in range(h)])
    unlike = (np.abs(a - fabric).sum(2) > 200) & inner
    # the print is the biggest solid block of it: fold highlights are thin and scattered
    from scipy import ndimage
    blob = ndimage.binary_closing(unlike, iterations=4)
    blob = ndimage.binary_opening(blob, iterations=2)
    lab, n = ndimage.label(blob)
    if n == 0:
        return 24.0, 9.5
    sizes = ndimage.sum(blob, lab, range(1, n + 1))
    big = sizes >= sizes.max() * 0.08                     # a design in parts (lines of type) keeps its parts
    keep = np.isin(lab, np.where(big)[0] + 1)
    ys, xs = np.where(keep)
    measure_print.last = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1, top, bottom, bx0, bx1)
    # across by the chest, down by the length: a mockup's tee is longer for its width
    # than the real one (1027 x 569 px against 72 x 54 cm), so one scale for both put
    # every print a hand too low
    return round((xs.max() - xs.min() + 1) * TEE_BODY_CM / body, 1), round((ys.min() - top) * TEE_LENGTH_CM / (bottom - top), 1)




def lift_print(photo: Path, color: str = "black", dark_ink: bool = False) -> tuple[Image.Image, float, float, int]:
    """A tee's print lifted off one of its own photographs, for the tees whose artwork
    exists only as mockups (MANIFEST.md). Most are photographs of people wearing the tee,
    so the print is found as ink the tee's fabric ENCLOSES: the fabric mask with its
    holes filled is the tee; inside it, clear ink (further from the fabric's colour than
    the fabric's own folds and shading ever get) that does not touch the tee's edge is
    the print — hands, arms and a belt all touch an edge, and the woven neck label is
    too small to keep. Where the tee cannot be told from the backdrop (a white tee on a
    pale wall), a chest window stands in for the tee. The fabric is keyed out softly,
    and only on the print, so type keeps its edge and folds leave no grey haze.
    `dark_ink`: a tone-on-tone print, black ink on a charcoal tee (HTMLK), is darker than
    its fabric, not brighter; its ink is found by darkness instead.
    Returns (print RGBA, width_cm, top_cm, area_px) — area_px ranks the photographs."""
    from scipy import ndimage
    im = Image.open(photo).convert("RGB")
    a = np.array(im).astype(np.float32)
    h, w = a.shape[:2]
    lum = a.mean(2); sat = a.max(2) - a.min(2)
    dark = color.lower() != "white"
    mid = (slice(h // 5, h * 4 // 5), slice(w // 3, w * 2 // 3))
    pick = ((lum[mid] < 110) if dark else (lum[mid] > 200)) & (sat[mid] < 26)
    if pick.sum() < 50:
        raise ValueError("no fabric")
    fabric = np.median(a[mid][pick], 0)
    d = np.abs(a - fabric).sum(2)
    near = ndimage.binary_opening(d < (75 if dark else 30), iterations=2)
    lab, n = ndimage.label(near)
    tee = lab == (np.argmax(ndimage.sum(near, lab, range(1, n + 1))) + 1)
    borders = sum([tee[0].any(), tee[-1].any(), tee[:, 0].any(), tee[:, -1].any()])
    if borders >= 3:                                   # the tee ran into the backdrop
        filled = np.zeros((h, w), bool)
        filled[int(h * 0.12): int(h * 0.62), int(w * 0.22): int(w * 0.78)] = True
        edge = filled & ~ndimage.binary_erosion(filled, iterations=4)     # an arm crossing it is not print
    else:
        filled = ndimage.binary_fill_holes(ndimage.binary_closing(tee, iterations=3))
        edge = filled & ~ndimage.binary_erosion(filled, iterations=4)
    # clear ink: past what the fabric's own folds reach
    noise = float(np.percentile(d[ndimage.binary_erosion(tee, iterations=6)], 98)) if tee.sum() > 500 else 60.0
    thr = max(45.0, noise * 1.35)
    flum = float(fabric.mean())
    ink = filled & ((d > thr) | ((lum < flum - 13) if dark_ink else False))
    blobs = ndimage.binary_closing(ink, iterations=7)
    lab2, n2 = ndimage.label(blobs)
    sizes = ndimage.sum(ink, lab2, range(1, n2 + 1))
    rows_f = np.where(filled.any(1))[0]
    collar = rows_f[0] + 0.16 * (rows_f[-1] - rows_f[0])
    comps = []
    for k in range(1, n2 + 1):
        m = (lab2 == k)
        if sizes[k - 1] < 40 or (m & edge).any():
            continue
        mi = m & ink
        # print is unmistakable ink: far past the fabric's folds, or coloured. A fold's
        # highlight only just clears the threshold and is as grey as the cloth.
        clear = np.percentile(d[mi], 75) >= max(2.0 * thr, 190) or sat[mi].mean() >= 32
        if dark_ink: clear = clear or np.median(lum[mi]) < flum - 18
        if not clear:
            continue
        ys_ = np.where(mi)[0]
        if ys_.max() < collar and sizes[k - 1] < 2500:              # the woven neck label
            continue
        comps.append(k)
    if not comps:
        raise ValueError("no print enclosed by the tee")
    big = max(sizes[k - 1] for k in comps)
    comps = [k for k in comps if sizes[k - 1] >= 0.012 * big]   # specks
    keep = np.isin(lab2, comps)
    ys, xs = np.where(keep & ink)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    if borders >= 3:
        top, bottom, body = int(h * 0.08), int(h * 0.95), w * 0.56
    else:
        rows = np.where(filled.any(1))[0]; top, bottom = int(rows[0]), int(rows[-1])
        widths = [np.ptp(np.where(filled[y])[0]) for y in range(int(top + 0.55 * (bottom - top)), int(top + 0.8 * (bottom - top)))]
        body = float(np.median(widths))
    pad = round(0.04 * max(x1 - x0, y1 - y0)) + 2
    bx = (max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad))
    crop = a[bx[1]:bx[3], bx[0]:bx[2]]
    dc = d[bx[1]:bx[3], bx[0]:bx[2]]
    region = ndimage.binary_dilation(keep, iterations=3)[bx[1]:bx[3], bx[0]:bx[2]]
    alpha = np.clip((dc - thr * 0.7) / (thr * 0.6), 0, 1)
    if dark_ink:                                       # by darkness: ink to fabric
        alpha = np.maximum(alpha, np.clip((flum - 6 - lum[bx[1]:bx[3], bx[0]:bx[2]]) / 22, 0, 1))
    alpha = alpha * region
    alpha = np.array(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))) / 255.0
    al = alpha[..., None]
    rgb = np.where(al > 0.02, (crop - fabric * (1 - al)) / np.maximum(al, 0.02), crop)
    out = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)
    lift_print.last = (int(x0), int(y0), int(x1), int(y1), top, bottom)
    w_cm = (bx[2] - bx[0]) * TEE_BODY_CM / body
    top_cm = (bx[1] - top) * TEE_LENGTH_CM / (bottom - top)
    return _cap(Image.fromarray(out, "RGBA")), round(w_cm, 1), round(top_cm, 1), int((keep & ink).sum())


def lift_tonal(photo: Path, box: tuple[float, float, float, float]) -> tuple[Image.Image, float, float, str]:
    """A tone-on-tone print (black ink on a charcoal tee: HTMLK) is too close to its
    fabric to be found on its own, so its area is given by hand (`box`, fractions of
    the photo) and the ink is keyed by how far it is from the fabric in tone, either
    way: the black ink, and the white of the K and the collar in the portrait.
    Returns (print RGBA, width_cm, top_cm, fabric hex) — the fabric colour is the
    tee's own, so the 3D tee can wear exactly it."""
    im = Image.open(photo).convert("RGB")
    a = np.array(im).astype(np.float32)
    h, w = a.shape[:2]
    lum = a.mean(2)
    x0, y0, x1, y1 = int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h)
    # the fabric: the tone of the box's own border, where there is no ink
    rim = np.concatenate([lum[y0:y1, x0:x0 + 6].ravel(), lum[y0:y1, x1 - 6:x1].ravel(), lum[y0:y0 + 6, x0:x1].ravel()])
    flum = float(np.median(rim))
    fabric = np.median(np.concatenate([a[y0:y1, x0:x0 + 6].reshape(-1, 3), a[y0:y1, x1 - 6:x1].reshape(-1, 3)]), 0)
    crop = a[y0:y1, x0:x1]; L = lum[y0:y1, x0:x1]
    alpha = np.clip((np.abs(L - flum) - 7) / 16, 0, 1)
    al = alpha[..., None]
    rgb = np.where(al > 0.02, (crop - fabric * (1 - al)) / np.maximum(al, 0.02), crop)
    out = Image.fromarray(np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8), "RGBA")
    # the tee's width and collar, from the photo, as measure_print finds them
    measure_print(photo)
    _, _, _, _, top, bottom, bx0, bx1 = measure_print.last
    w_cm = (x1 - x0) * TEE_BODY_CM / (bx1 - bx0)
    top_cm = (y0 - top) * TEE_LENGTH_CM / (bottom - top)
    hexcol = "#" + "".join(f"{int(v):02x}" for v in fabric)
    return _cap(out), round(w_cm, 1), round(top_cm, 1), hexcol
