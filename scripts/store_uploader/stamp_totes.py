#!/usr/bin/env python3
"""
stamp_totes.py — tote designs made of scattered postage stamps.

Picks stamps from a restamped set (postage_stamps_v2/<slug>/hd.transparent.png), never
repeating a stamp across the totes it makes, and lays 3–5 of them on a transparent design
canvas with varied size, tilt and a slight overlap, like stamps dropped on a table. Each
design is then rendered through tote_gallery.py on the natural-cotton set.

  python3 stamp_totes.py --stamps ~/Desktop/Forge/generated/postage_stamps_v2 --out DIR --count 5 --seed 11

Outputs, never overwriting: DIR/design_<n>.png (the print, 3000px), DIR/totes/<design>/ (frames),
DIR/manifest.json (which stamps went where).
"""
from __future__ import annotations
import argparse, json, random, subprocess, sys
from pathlib import Path
from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
CANVAS = 3000


def load_stamps(root: Path) -> list[Path]:
    nested = sorted(p for p in root.glob("*/hd.transparent.png"))
    return nested or sorted(p for p in root.glob("*.png"))


def shadow(im: Image.Image, k: int) -> Image.Image:
    """A soft paper shadow under a stamp so the pile reads as objects, not decals."""
    a = im.split()[-1]
    sh = Image.new("RGBA", (im.width + 4 * k, im.height + 4 * k), (0, 0, 0, 0))
    dark = Image.new("RGBA", im.size, (20, 15, 10, 110))
    sh.paste(dark, (2 * k + k // 2, 2 * k + k), a)
    sh = sh.filter(ImageFilter.GaussianBlur(k))
    sh.alpha_composite(im, (2 * k, 2 * k))
    return sh


def overlap(a, b) -> float:
    """Fraction of the smaller box covered by the other."""
    x0, y0, x1, y1 = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, x1 - x0) * max(0, y1 - y0)
    area = min((a[2] - a[0]) * (a[3] - a[1]), (b[2] - b[0]) * (b[3] - b[1]))
    return inter / area if area else 0.0


STYLE = {"neat": {"tilt": 14, "overlap": 0.20, "ring": 0.05, "size": 1.0},
         "lazy": {"tilt": 28, "overlap": 0.45, "ring": 0.18, "size": 1.25}}   # lazy: bigger stamps, a tight pile
STYLE_NAME = "neat"


def compose(stamps: list[Path], rng: random.Random):
    """Stamps dropped on a table: varied size and tilt, a corner may touch or slightly
    overlap a neighbour (never more than a fifth of the smaller one), every stamp
    fully readable, the pile spread across the whole print panel."""
    import math
    n = len(stamps)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    base = int(CANVAS * (0.46 if n == 3 else 0.40 if n == 4 else 0.35) * STYLE[STYLE_NAME]["size"])
    boxes, placed = [], []
    for i, p in enumerate(stamps):
        im = Image.open(p).convert("RGBA")
        w = int(base * rng.uniform(0.85, 1.15)); h = int(im.height * w / im.width)
        im = im.resize((w, h), Image.LANCZOS)
        st = STYLE[STYLE_NAME]
        tilt = rng.uniform(-st["tilt"], st["tilt"])
        im = shadow(im, k=max(6, w // 140)).rotate(tilt, resample=Image.BICUBIC, expand=True)
        best = None
        for _ in range(400):
            x = rng.randint(40, CANVAS - im.width - 40); y = rng.randint(40, CANVAS - im.height - 40)
            box = (x, y, x + im.width, y + im.height)
            worst = max((overlap(box, b) for b in boxes), default=0.0)
            # prefer a little contact (a pile, not a grid) but never real occlusion
            score = (0 if worst <= st["overlap"] else 10) + abs(worst - st["ring"])
            if best is None or score < best[0]: best = (score, box)
            if worst <= st["overlap"] and worst >= st["ring"] * 0.6: break
        _, box = best
        canvas.alpha_composite(im, (box[0], box[1])); boxes.append(box)
        placed.append({"stamp": (p.parent.name if p.name == "hd.transparent.png" else p.stem), "width": w, "tilt": round(tilt, 1), "x": box[0], "y": box[1]})
    bbox = canvas.split()[-1].getbbox(); m = 40
    canvas = canvas.crop((max(0, bbox[0] - m), max(0, bbox[1] - m), min(CANVAS, bbox[2] + m), min(CANVAS, bbox[3] + m)))
    return canvas, placed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stamps", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--count", type=int, default=5); ap.add_argument("--seed", type=int, default=11)
    ap.add_argument("--set", default="natural"); ap.add_argument("--no-render", action="store_true")
    ap.add_argument("--style", choices=list(STYLE), default="neat", help="neat: a tidy pile; lazy: stuck like luggage labels, tilted and overlapping")
    ap.add_argument("--sizes", nargs="*", type=int, help="stamps per design, e.g. --sizes 5")
    a = ap.parse_args()
    global STYLE_NAME; STYLE_NAME = a.style
    out = Path(a.out)
    if out.exists() and any(out.iterdir()):
        sys.exit(f"{out} already has files — pick a new folder, nothing is overwritten")
    out.mkdir(parents=True, exist_ok=True)
    pool = load_stamps(Path(a.stamps))
    rng = random.Random(a.seed); rng.shuffle(pool)
    sizes = a.sizes or [rng.choice([3, 4, 5]) for _ in range(a.count)]
    if sum(sizes) > len(pool): sys.exit(f"need {sum(sizes)} distinct stamps, have {len(pool)}")
    manifest = []; k = 0
    for i, n in enumerate(sizes, 1):
        chosen = pool[k:k + n]; k += n
        design, placed = compose(chosen, rng)
        dp = out / f"design_{i:02d}.png"; design.save(dp, optimize=True)
        manifest.append({"design": dp.name, "style": STYLE_NAME, "stamps": placed})
        print(f"design_{i:02d}: {n} stamps — {', '.join(x['stamp'] for x in placed)}")
        if not a.no_render:
            subprocess.run([sys.executable, str(HERE / "tote_gallery.py"), str(dp), "--set", a.set, "--out", str(out / "totes")], check=False)
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
