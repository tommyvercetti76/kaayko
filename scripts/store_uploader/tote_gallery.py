#!/usr/bin/env python3
"""
tote_gallery.py — the tote mockup set. One drawing in, the same three photographs out,
for every product, so the shelf reads as one shelf.

WHY IT ALWAYS WORKS
  1. The bag is MEASURED, not guessed. `--calibrate` reads the natural-cotton templates
     (beige bag on a grey wall — separable by colour), finds the bag body on each, its
     tilt, and writes geometry.json. The white set is the same six photographs, so one
     geometry serves both.
  2. The print panel is DERIVED from the body: a fixed fraction of the bag's width, a fixed
     distance below its top edge. The same fraction on every view means the same visual
     size on every product.
  3. Every drawing is fitted to the panel WIDTH (or height, if taller than the panel), so a
     peacock and a crocodile take the same room on the bag.
  4. Before a frame is written, the printed rectangle is checked against the bag mask
     eroded by a margin. A breach raises, it is never saved.
  5. No AI upscale. The photographs are enlarged 2× with Lanczos and a light unsharp,
     so the canvas keeps its grain instead of turning to plastic.

USAGE
  python3 tote_gallery.py --calibrate                      # once, after templates change
  python3 tote_gallery.py art.png --set natural --out DIR  # three frames, DIR/<slug>/
  python3 tote_gallery.py 'folder/*.png' --set white --all --out DIR
  python3 tote_gallery.py --sheet DIR                      # contact sheet

Templates: templates/tote/{white,natural}/<n>_<view>.png (2× Lanczos from the sample
sheets in Desktop/New_Totets), templates/tote/geometry.json, templates/tote/calibration.png.
"""
from __future__ import annotations
import argparse, glob, json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
TROOT = HERE / "templates" / "tote"
SETS = {"white": TROOT / "white", "natural": TROOT / "natural"}
VIEWS = ["0_flat_wall", "1_hanging_front", "2_hanging_side", "3_shoulder_a", "4_shoulder_b", "5_carry"]
DEFAULT_FRAMES = ["1_hanging_front", "3_shoulder_a", "5_carry"]

PANEL_W = 0.60      # panel width as a fraction of the bag body's width
PANEL_TOP = 0.20    # panel top, as a fraction of body height below the body's top edge
PANEL_H = 0.58      # panel height as a fraction of body height
MARGIN = 0.03       # the printed rectangle must stay this far (of body width) inside the bag
INK = 0.96          # ink opacity: a little canvas shows through even solid colour


# ── templates ──────────────────────────────────────────────────────────────────
def build_templates(white_sheet: Path, natural_sheet: Path) -> None:
    """Cut both sample sheets on the same gutters and enlarge 2× without AI."""
    for name, sheet in (("white", white_sheet), ("natural", natural_sheet)):
        im = Image.open(sheet).convert("RGB"); W, H = im.size
        cols, rows = [0, 483, 967, W], [0, 518, H]
        k = 0
        for r in range(2):
            for c in range(3):
                t = im.crop((cols[c] + 3, rows[r] + 3, cols[c + 1] - 3, rows[r + 1] - 3))
                t = t.resize((t.width * 2, t.height * 2), Image.LANCZOS)
                t = t.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
                SETS[name].mkdir(parents=True, exist_ok=True)
                t.save(SETS[name] / f"{VIEWS[k]}.png", optimize=True); k += 1
        print(f"{name}: 6 templates at {t.size}")


# ── geometry ───────────────────────────────────────────────────────────────────
def bag_mask(natural_template: Image.Image) -> np.ndarray:
    """The beige canvas against the grey wall: warm (R − B) and bright. Sleeve is darker
    and greener, jeans blue, skin darker. Then keep the largest blob: the bag body."""
    a = np.asarray(natural_template.convert("RGB")).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    warm = ((r - b) > 10) & ((r - b) < 60) & (r > 170) & ((r - g) < 30)
    m = Image.fromarray((warm * 255).astype(np.uint8))
    m = m.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))
    arr = np.asarray(m) > 0
    # largest connected component, by a cheap two-pass label on a 4× downsample
    small = np.asarray(m.resize((m.width // 4, m.height // 4), Image.NEAREST)) > 0
    lab = _label(small)
    if lab.max() == 0:
        raise SystemExit("no bag found in template")
    sizes = np.bincount(lab.ravel()); sizes[0] = 0
    keep = lab == sizes.argmax()
    keep_full = np.asarray(Image.fromarray((keep * 255).astype(np.uint8)).resize(m.size, Image.NEAREST)) > 0
    return arr & keep_full


def _label(binary: np.ndarray) -> np.ndarray:
    """Connected components (4-neighbour), no scipy."""
    H, W = binary.shape
    lab = np.zeros((H, W), dtype=np.int32); cur = 0
    for y in range(H):
        for x in range(W):
            if binary[y, x] and lab[y, x] == 0:
                cur += 1; stack = [(y, x)]; lab[y, x] = cur
                while stack:
                    cy, cx = stack.pop()
                    for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                        if 0 <= ny < H and 0 <= nx < W and binary[ny, nx] and lab[ny, nx] == 0:
                            lab[ny, nx] = cur; stack.append((ny, nx))
    return lab


def body_geometry(mask: np.ndarray) -> dict:
    """The bag BODY (straps excluded): rows whose filled width is at least 55% of the
    widest row. Returns the body box and the tilt of its top edge."""
    widths = mask.sum(axis=1)
    wide = np.where(widths >= 0.55 * widths.max())[0]
    top, bottom = int(wide.min()), int(wide.max())
    cols = np.where(mask[top:bottom + 1].any(axis=0))[0]
    left, right = int(cols.min()), int(cols.max())
    # tilt: fit a line through the topmost canvas pixel of each column across the middle 60%
    xs = np.arange(left + int((right - left) * 0.2), right - int((right - left) * 0.2))
    ys = []
    for x in xs:
        col = np.where(mask[top:bottom + 1, x])[0]
        ys.append(top + (col.min() if len(col) else 0))
    ys = np.array(ys, dtype=float)
    ok = ys > top
    slope = np.polyfit(xs[ok], ys[ok], 1)[0] if ok.sum() > 10 else 0.0
    tilt = float(np.degrees(np.arctan(slope)))
    return {"left": left, "top": top, "right": right, "bottom": bottom, "tilt": round(tilt, 2)}


def panel_from_body(body: dict) -> dict:
    bw, bh = body["right"] - body["left"], body["bottom"] - body["top"]
    w, h = int(bw * PANEL_W), int(bh * PANEL_H)
    x = body["left"] + (bw - w) // 2
    y = body["top"] + int(bh * PANEL_TOP)
    return {"x": x, "y": y, "w": w, "h": h}


def calibrate() -> None:
    geo = {}
    sheet = None
    for i, v in enumerate(VIEWS):
        t = Image.open(SETS["natural"] / f"{v}.png")
        m = bag_mask(t)
        body = body_geometry(m)
        panel = panel_from_body(body)
        geo[v] = {"size": t.size, "body": body, "panel": panel}
        Image.fromarray((m * 255).astype(np.uint8)).save(TROOT / f"{v}.mask.png", optimize=True)
        # overlay for the eye: mask edge in green, body in blue, panel in red
        ov = t.copy(); d = ImageDraw.Draw(ov, "RGBA")
        edge = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.FIND_EDGES)
        ov.paste((0, 200, 0), mask=edge)
        d.rectangle([body["left"], body["top"], body["right"], body["bottom"]], outline=(0, 90, 255, 255), width=3)
        d.rectangle([panel["x"], panel["y"], panel["x"] + panel["w"], panel["y"] + panel["h"]], outline=(230, 0, 0, 255), width=4)
        d.text((10, 10), f"{v} tilt {body['tilt']}°", fill=(0, 0, 0))
        ov.thumbnail((480, 560))
        if sheet is None: sheet = Image.new("RGB", (3 * 490, 2 * 575), (50, 50, 50))
        sheet.paste(ov, ((i % 3) * 490 + 5, (i // 3) * 575 + 5))
        print(f"{v}: body {body} panel {panel}")
    (TROOT / "geometry.json").write_text(json.dumps({"panel_rule": {"PANEL_W": PANEL_W, "PANEL_TOP": PANEL_TOP, "PANEL_H": PANEL_H, "MARGIN": MARGIN}, "views": geo}, indent=1))
    sheet.save(TROOT / "calibration.png")
    print("wrote geometry.json and calibration.png")


# ── art ────────────────────────────────────────────────────────────────────────
def key_background(im: Image.Image, tol: int = 30) -> Image.Image:
    """A drawing saved on a flat card with no real alpha gets the card removed: a
    flood-fill from the corners on a 512px copy says which card-coloured pixels are
    connected to the outside; the cut itself is made at full resolution."""
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
    alpha = np.where(near & reach, 0, 255).astype(np.uint8)
    im.putalpha(Image.fromarray(alpha).filter(ImageFilter.MinFilter(3)))
    return im


def trim(im: Image.Image) -> Image.Image:
    bbox = im.split()[-1].getbbox()
    return im.crop(bbox) if bbox else im


# ── compose ────────────────────────────────────────────────────────────────────
def compose(art: Image.Image, view: str, set_name: str, geo: dict) -> Image.Image:
    canvas = Image.open(SETS[set_name] / f"{view}.png").convert("RGB")
    g = geo["views"][view]; p, body = g["panel"], g["body"]
    a = trim(key_background(art))
    # fit to panel width; fall back to height for tall drawings
    ratio = min(p["w"] / a.width, p["h"] / a.height)
    a = a.resize((max(1, int(a.width * ratio)), max(1, int(a.height * ratio))), Image.LANCZOS)
    if abs(body["tilt"]) >= 0.5:
        a = a.rotate(-body["tilt"], resample=Image.BICUBIC, expand=True)
    px, py = p["x"] + (p["w"] - a.width) // 2, p["y"] + (p["h"] - a.height) // 2

    # the guarantee: the printed rectangle sits inside the bag, with a margin
    mask = np.asarray(Image.open(TROOT / f"{view}.mask.png")) > 0
    margin = int((body["right"] - body["left"]) * MARGIN)
    er = np.asarray(Image.fromarray(mask.astype(np.uint8) * 255).filter(ImageFilter.MinFilter(2 * margin + 1))) > 0
    box = er[py:py + a.height, px:px + a.width]
    alpha = np.asarray(a.split()[-1]) > 8
    if box.shape != alpha.shape or not er[py:py + a.height, px:px + a.width][alpha].all():
        raise RuntimeError(f"{view}: drawing would leave the bag — not written")

    layer = Image.new("RGB", canvas.size, (255, 255, 255))
    layer.paste(a.convert("RGB"), (px, py), a.split()[-1])
    mult = ImageChops.multiply(canvas, layer)
    m = Image.new("L", canvas.size, 0)
    m.paste(a.split()[-1].point(lambda v: int(v * INK)), (px, py))
    m = m.filter(ImageFilter.GaussianBlur(0.8))
    return Image.composite(mult, canvas, m)


def slug_of(p: Path) -> str:
    s = p.name
    for suf in (".transparent.png", ".png", ".webp", ".jpg"):
        if s.endswith(suf): s = s[: -len(suf)]; break
    return s.replace("_4096", "").replace("_transparent", "").replace(" ", "_").lower()


def render(art_path: Path, out_root: Path, frames: list[str], set_name: str, geo: dict) -> Path:
    art = Image.open(art_path)
    d = out_root / slug_of(art_path); d.mkdir(parents=True, exist_ok=True)
    for n, v in enumerate(frames):
        out = compose(art, v, set_name, geo)
        out.save(d / f"{n}_{v.split('_', 1)[1]}.png", optimize=True)
        print(f"  {d.name}/{n}_{v.split('_', 1)[1]}.png {out.size}")
    return d


def sheet(root: Path, T: int = 300) -> Path:
    dirs = sorted(p for p in root.iterdir() if p.is_dir())
    rows = [(d, sorted(d.glob("[0-9]_*.png"))) for d in dirs]
    cols = max(len(f) for _, f in rows) if rows else 3
    im = Image.new("RGB", (cols * T, len(rows) * (T + 18)), (60, 60, 60)); dr = ImageDraw.Draw(im)
    for r, (d, files) in enumerate(rows):
        for c, f in enumerate(files):
            t = Image.open(f); t.thumbnail((T - 6, T - 6)); im.paste(t, (c * T + 3, r * (T + 18) + 3))
        dr.text((4, r * (T + 18) + T + 2), d.name, fill="white")
    out = root / "contact_sheet.png"; im.save(out); return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("art", nargs="*")
    ap.add_argument("--out"); ap.add_argument("--set", default="natural", choices=list(SETS))
    ap.add_argument("--all", action="store_true", help="all six views, not the store's three")
    ap.add_argument("--frames", nargs="*")
    ap.add_argument("--build-templates", nargs=2, metavar=("WHITE_SHEET", "NATURAL_SHEET"))
    ap.add_argument("--calibrate", action="store_true")
    ap.add_argument("--sheet")
    a = ap.parse_args()
    if a.build_templates:
        build_templates(Path(a.build_templates[0]), Path(a.build_templates[1])); return 0
    if a.calibrate:
        calibrate(); return 0
    if a.sheet:
        print(sheet(Path(a.sheet))); return 0
    paths = [Path(p) for pat in a.art for p in (glob.glob(pat) or [pat])]
    if not paths: ap.error("no art given")
    geo = json.loads((TROOT / "geometry.json").read_text())
    frames = VIEWS if a.all else (a.frames or DEFAULT_FRAMES)
    for p in paths:
        render(p, Path(a.out) if a.out else p.parent, frames, a.set, geo)
    return 0


if __name__ == "__main__":
    sys.exit(main())
