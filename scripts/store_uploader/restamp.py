#!/usr/bin/env python3
"""
restamp.py — a scanned stamp, re-perforated cleanly, in its own paper.

The scans (Forge's forge_stamps.py output, *stamp_x4.png) are cut along the ORIGINAL
teeth, and those teeth are what the scanner saw: torn, uneven, sometimes a photograph of
a stamp inside a square. This tool:

  1. reads the tooth pitch and tooth depth from the alpha edge of the scan itself
     (autocorrelation of the edge profile — no guessing, no constants per stamp)
  2. crops the body INSIDE the old teeth, keeping the stamp's own printed paper margin
  3. samples the paper colour and grain from that margin
  4. lays a fresh band of that paper around the body and punches a clean perforation
     at the ORIGINAL pitch, phased so a hole sits on every corner
  5. writes <slug>.restamped.png (transparent, print-ready) and an audit line

  python3 restamp.py ~/Bottles/BottleImages/*/*stamp_x4.png --out ~/Desktop/Kaayko_Stamps
  python3 restamp.py --sheet ~/Desktop/Kaayko_Stamps
"""
from __future__ import annotations
import argparse, glob, json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

LAYOUT = "flat"   # or "v2": <out>/<slug>/{hd.transparent.png, simple.png, simple.transparent.png, audit.json}
LAYOUT = "flat"   # or "v2": <out>/<slug>/{hd.transparent.png, simple.png, simple.transparent.png, audit.json}
HOLE = 0.30      # hole radius as a fraction of pitch: hole ≈ 60% of pitch, as on Indian definitives
BAND = 1.10      # fresh paper band beyond the body, in hole radii (the tooth zone + a hair)


def edge_profile(alpha: np.ndarray, side: str) -> np.ndarray:
    """Distance from the bbox edge to the first opaque pixel, per column (top/bottom)
    or per row (left/right)."""
    H, W = alpha.shape
    if side in ("top", "bottom"):
        a = alpha if side == "top" else alpha[::-1]
        first = np.argmax(a, axis=0); first[~a.any(axis=0)] = H
        return first.astype(float)
    a = alpha if side == "left" else alpha[:, ::-1]
    first = np.argmax(a, axis=1); first[~a.any(axis=1)] = W
    return first.astype(float)


def pitch_of(profile: np.ndarray) -> float | None:
    """Dominant period of the tooth profile by autocorrelation, within a sane band."""
    p = profile[np.isfinite(profile)]
    p = p[int(len(p) * 0.08): int(len(p) * 0.92)]           # skip the corners
    p = p - np.convolve(p, np.ones(51) / 51, mode="same")   # detrend
    p = p - p.mean()
    if p.std() < 0.5: return None
    ac = np.correlate(p, p, mode="full")[len(p) - 1:]
    ac /= ac[0]
    lo, hi = 20, min(400, len(ac) - 1)                       # 20–400 px per tooth at x4
    seg = ac[lo:hi]
    k = int(np.argmax(seg)) + lo
    return float(k) if ac[k] > 0.25 else None


def measure(alpha: np.ndarray) -> dict:
    ys, xs = np.where(alpha)
    box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    sub = alpha[box[1]:box[3], box[0]:box[2]]
    pitches, depths = [], {}
    for side in ("top", "bottom", "left", "right"):
        prof = edge_profile(sub, side)
        core = prof[int(len(prof) * 0.08): int(len(prof) * 0.92)]
        depths[side] = float(core.max() - np.percentile(core, 3))     # the DEEPEST tooth, not a percentile
        pt = pitch_of(prof)
        if pt: pitches.append(pt)
    pitch = float(np.median(pitches)) if pitches else None
    return {"bbox": box, "pitch": pitch, "depth": depths}


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


def restamp(src: Path, out_dir: Path) -> dict:
    im = Image.open(src).convert("RGBA")
    alpha = np.asarray(im.split()[-1]) > 128
    m = measure(alpha)
    if not m["pitch"]:
        # a scan cut along a straight album edge has no teeth to read: use the batch's
        # typical Indian-definitive pitch at x4 (gauge ~13) and cut nothing extra —
        # the design finder below does not need the teeth
        m["pitch"] = 140.0; m["depth"] = {k: 0.0 for k in m["depth"]}; m["pitch_source"] = "default"
    pitch = m["pitch"]; r = pitch * HOLE
    x0, y0, x1, y1 = m["bbox"]
    # body: inside the deepest tooth on each side, plus a safety of 6 px
    inset = {s: int(m["depth"][s] + 6) for s in m["depth"]}
    body_rgba = im.crop((x0 + inset["left"], y0 + inset["top"], x1 - inset["right"], y1 - inset["bottom"]))
    bw, bh = body_rgba.size
    # anything still translucent in the crop (the old cut's feathered fringe) becomes paper, never black
    arr = np.asarray(body_rgba.convert("RGB")).astype(np.float32)
    al = np.asarray(body_rgba.split()[-1]).astype(np.float32)[..., None] / 255.0
    k = max(4, int(min(bw, bh) * 0.03))
    ring = np.concatenate([arr[:k].reshape(-1, 3), arr[-k:].reshape(-1, 3), arr[:, :k].reshape(-1, 3), arr[:, -k:].reshape(-1, 3)])
    paper = np.median(ring, axis=0); grain = float(np.clip(ring.std(axis=0).mean(), 1.5, 8.0))
    body = Image.fromarray(np.clip(arr * al + paper * (1 - al), 0, 255).astype(np.uint8), "RGB")

    # THE DESIGN, not the scan. A scan can carry three borders — the stamp's own teeth,
    # the album mount's white margin, and the album's black rule. None of them is wanted.
    # Ink = not paper; a morphological opening at ~1.2% of the short side erases thin
    # rules and tooth stubs; the largest remaining blob is the printed design.
    ink = np.abs(np.asarray(body).astype(np.float32) - paper).max(axis=2) > 38
    kk = max(5, int(min(bw, bh) * 0.012)) | 1
    opened = Image.fromarray((ink * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(kk)).filter(ImageFilter.MaxFilter(kk))
    op = np.asarray(opened) > 0
    small = np.asarray(opened.resize((max(1, bw // 6), max(1, bh // 6)), Image.NEAREST)) > 0
    lab = _label(small)
    if lab.max():
        sizes = np.bincount(lab.ravel()); sizes[0] = 0; keep = lab == sizes.argmax()
        ys_, xs_ = np.where(keep)
        dy0, dy1 = int(ys_.min() * 6), int(min(bh, (ys_.max() + 1) * 6)); dx0, dx1 = int(xs_.min() * 6), int(min(bw, (xs_.max() + 1) * 6))
        # refine to exact ink edges inside that coarse box
        sub = op[dy0:dy1, dx0:dx1]; r_ = np.where(sub.any(axis=1))[0]; c_ = np.where(sub.any(axis=0))[0]
        dy0, dy1, dx0, dx1 = dy0 + int(r_.min()), dy0 + int(r_.max()) + 1, dx0 + int(c_.min()), dx0 + int(c_.max()) + 1
        # a little breathing room so the opening has not shaved soft edges of the design
        pad = kk // 2 + 2
        dy0, dy1, dx0, dx1 = max(0, dy0 - pad), min(bh, dy1 + pad), max(0, dx0 - pad), min(bw, dx1 + pad)
        # paper for the new margin: the ring just outside the design (the stamp's own white)
        ringw = max(6, int(min(bw, bh) * 0.02))
        rr = np.asarray(body).astype(np.float32)
        band_px = np.concatenate([rr[max(0, dy0 - ringw):dy0, dx0:dx1].reshape(-1, 3), rr[dy1:dy1 + ringw, dx0:dx1].reshape(-1, 3),
                                  rr[dy0:dy1, max(0, dx0 - ringw):dx0].reshape(-1, 3), rr[dy0:dy1, dx1:dx1 + ringw].reshape(-1, 3)])
        band_px = band_px[np.abs(band_px - paper).max(axis=1) < 60] if len(band_px) else band_px
        if len(band_px) > 50: paper = np.median(band_px, axis=0)
        m_new = int(max(pitch * 0.55, min(bw, bh) * 0.06))
        design = body.crop((dx0, dy0, dx1, dy1)); dw, dh = design.size
        rng0 = np.random.default_rng(3)
        sheet0 = np.clip(paper + rng0.normal(0, grain, (dh + 2 * m_new, dw + 2 * m_new, 3)), 0, 255).astype(np.uint8)
        rebuilt = Image.fromarray(sheet0, "RGB").filter(ImageFilter.GaussianBlur(0.6))
        # feather the design's edge into the new paper by a few pixels (the pad ring is real paper anyway)
        fm = Image.new("L", design.size, 255); ImageDraw.Draw(fm).rectangle([0, 0, dw - 1, dh - 1], outline=0, width=2)
        fm = fm.filter(ImageFilter.GaussianBlur(1.5))
        rebuilt.paste(design, (m_new, m_new), fm)
        body = rebuilt; bw, bh = body.size
        centre_note = {"design_px": [dw, dh], "margin_px": m_new}
    else:
        centre_note = {"design_px": None}

    band = int(round(r * BAND))
    W, H = bw + 2 * band, bh + 2 * band
    rng = np.random.default_rng(7)
    sheet = np.clip(paper + rng.normal(0, grain, (H, W, 3)), 0, 255).astype(np.uint8)
    canvas = Image.fromarray(sheet, "RGB").filter(ImageFilter.GaussianBlur(0.6))
    canvas.paste(body, (band, band))
    # soften the seam between old margin and new band so no hard line survives
    seam = Image.new("L", (W, H), 0); ImageDraw.Draw(seam).rectangle([band - 4, band - 4, band + bw + 3, band + bh + 3], outline=255, width=8)
    seam = seam.filter(ImageFilter.GaussianBlur(2))
    canvas = Image.composite(canvas.filter(ImageFilter.GaussianBlur(1.6)), canvas, seam)

    # perforation: holes centred on the outer edge, pitch adjusted so a hole lands on every corner
    mask = Image.new("L", (W, H), 255); d = ImageDraw.Draw(mask)
    def punch(n_len, fixed, horizontal):
        n = max(2, int(round(n_len / pitch)))
        step = n_len / n
        for i in range(n + 1):
            c = i * step
            cx, cy = (c, fixed) if horizontal else (fixed, c)
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=0)
    punch(W - 1, 0, True); punch(W - 1, H - 1, True); punch(H - 1, 0, False); punch(H - 1, W - 1, False)
    out = canvas.convert("RGBA"); out.putalpha(mask)

    slug = src.stem.replace("stamp_x4", "").rstrip("_-") or src.parent.name
    if LAYOUT == "v2":
        # Forge portfolio layout: one folder per stamp with the three deliverables
        d = out_dir / slug; d.mkdir(parents=True, exist_ok=True)
        dst = d / "hd.transparent.png"; out.save(dst, optimize=True)               # x4, transparent, print-ready
        simple = out.copy(); simple.thumbnail((1200, 1200), Image.LANCZOS)
        simple.save(d / "simple.transparent.png", optimize=True)                    # web size, transparent
        flat = Image.new("RGB", simple.size, (255, 255, 255)); flat.paste(simple, mask=simple.split()[-1])
        flat.save(d / "simple.png", optimize=True)                                  # web size, on white
        out_dir_audit = d
    else:
        out_dir.mkdir(parents=True, exist_ok=True)
        dst = out_dir / f"{slug}.restamped.png"; out.save(dst, optimize=True); out_dir_audit = out_dir
    audit = {"source": str(src), "out": str(dst), "pitch_px": round(pitch, 1), "pitch_source": m.get("pitch_source", "measured"), "hole_r_px": round(r, 1),
             "tooth_depth_px": {k: round(v, 1) for k, v in m["depth"].items()}, "paper_rgb": [int(v) for v in paper],
             "grain": round(grain, 2), "size": out.size, **centre_note}
    (out_dir_audit / (f"{slug}.audit.json" if LAYOUT != "v2" else "audit.json")).write_text(json.dumps(audit, indent=1))
    print(f"  {slug}: pitch {pitch:.0f}px, teeth {min(m['depth'].values()):.0f}–{max(m['depth'].values()):.0f}px, paper {audit['paper_rgb']}, {out.size}")
    return audit


def sheet(root: Path, T: int = 300, cols: int = 8) -> Path:
    files = sorted(root.glob("*.restamped.png")) or sorted(root.glob("*/simple.transparent.png"))
    rows = (len(files) + cols - 1) // cols
    im = Image.new("RGB", (T * cols, rows * (T + 20)), (60, 60, 60)); d = ImageDraw.Draw(im)
    for i, f in enumerate(files):
        t = Image.open(f); bg = Image.new("RGBA", t.size, (200, 200, 200, 255)); bg.alpha_composite(t); t = bg.convert("RGB"); t.thumbnail((T - 8, T - 8))
        x, y = (i % cols) * T, (i // cols) * (T + 20)
        im.paste(t, (x + 4, y + 4)); d.text((x + 4, y + T + 4), (f.parent.name if f.name.startswith("simple") else f.name)[:40], fill="white")
    out = root / "contact_sheet.png"; im.save(out); return out


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("scans", nargs="*"); ap.add_argument("--out", default="."); ap.add_argument("--sheet")
    ap.add_argument("--layout", choices=["flat", "v2"], default="flat")
    a = ap.parse_args()
    global LAYOUT; LAYOUT = a.layout
    if a.sheet: print(sheet(Path(a.sheet))); return 0
    paths = [Path(p) for pat in a.scans for p in (glob.glob(pat) or [pat])]
    if not paths: ap.error("no scans")
    bad = 0
    for p in paths:
        try: restamp(p, Path(a.out))
        except Exception as e: bad += 1; print(f"  !! {p.name}: {e}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
