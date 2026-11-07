#!/usr/bin/env python3
"""Forge one-ink render (black mark on cream) -> gold SVG for the Scouts rules picture book.

Run with the Frameworks python (Pillow, numpy, scipy, vtracer live there):
  /Library/Frameworks/Python.framework/Versions/3.13/bin/python3 scripts/scouts-rules-svg.py <render.png> src/assets/scouts/rules/<rule>-v<date>.svg

Usage: scripts/scouts-rules-svg.py <in.png> <out.svg> [--thresh 130] [--gold d9bd7b] [--speckle 6]

Keying at the solid-ink cut (130, the value gold_mark.py treated as fully opaque). The mark
is every ink component at least a fifth of the largest, plus anything inside their joint box
(grid cells, letter lines, perforation dots); signatures and grain outside it go, as does a
thin frame spanning the canvas. vtracer's paper path is dropped. Square crop with a 7% margin
(paper beyond the canvas, never ink), traced into viewBox 0 0 1024 1024, one gold fill.
"""
import re, sys, tempfile
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage
import vtracer

OUT = 1024

def clean(ink: np.ndarray) -> np.ndarray:
    """Keep the mark: every component at least a fifth of the largest, plus anything inside
    their joint bounding box (grid cells, letter lines, perforation dots). Signatures and
    grain outside it go; so does a thin frame spanning the canvas."""
    lab, n = ndimage.label(ink)
    if n == 0:
        raise SystemExit('no ink')
    sizes = ndimage.sum(ink, lab, range(1, n + 1))
    objs = ndimage.find_objects(lab); H, W = ink.shape
    big = sizes.max()
    main = [objs[i] for i in range(n) if sizes[i] >= 0.2 * big
            and not (objs[i][1].stop - objs[i][1].start > 0.9 * W and objs[i][0].stop - objs[i][0].start > 0.9 * H
                     and sizes[i] < 0.1 * (objs[i][1].stop - objs[i][1].start) * (objs[i][0].stop - objs[i][0].start))]
    t = min(o[0].start for o in main); b = max(o[0].stop for o in main)
    l = min(o[1].start for o in main); r = max(o[1].stop for o in main)
    py, px = int((b - t) * 0.3), int((r - l) * 0.1)
    keep = np.zeros(n + 1, bool)
    for i in range(n):
        o = objs[i]
        inside = o[0].start >= t - py and o[0].stop <= b + py and o[1].start >= l - px and o[1].stop <= r + px
        keep[i + 1] = (o in main) or (inside and sizes[i] >= big * 0.0002)
    return keep[lab]

def main(src, dst, thresh=130, gold='d9bd7b', speckle=6):
    im = np.asarray(Image.open(src).convert('L'))
    ink = clean(im < thresh)
    ys, xs = np.nonzero(ink)
    l, r, t, b = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    side = int(max(r - l, b - t) * 1.14)
    cx, cy = (l + r) // 2, (t + b) // 2
    m = Image.fromarray(np.where(ink, 0, 255).astype(np.uint8))
    pad = side
    big_m = Image.new('L', (m.width + 2 * pad, m.height + 2 * pad), 255); big_m.paste(m, (pad, pad))
    sq = big_m.crop((pad + cx - side // 2, pad + cy - side // 2, pad + cx - side // 2 + side, pad + cy - side // 2 + side))
    sq = sq.resize((OUT, OUT), Image.LANCZOS).point(lambda v: 0 if v < 128 else 255)
    with tempfile.TemporaryDirectory() as td:
        p = Path(td) / 'sq.png'; sq.convert('RGB').save(p)
        raw = Path(td) / 'raw.svg'
        vtracer.convert_image_to_svg_py(str(p), str(raw), colormode='binary', hierarchical='stacked',
                                        mode='spline', filter_speckle=speckle, corner_threshold=60,
                                        length_threshold=4.0, splice_threshold=45, path_precision=0)
        svg = raw.read_text()
    paths = []
    for tag in re.findall(r'<path\b[^>]*>', svg):
        d = re.search(r'\sd="([^"]+)"', tag); tr = re.search(r'\stransform="([^"]+)"', tag)
        fill = (re.search(r'\sfill="([^"]+)"', tag) or [None, ''])[1].upper()
        if fill in ('#FFFFFF', '#FFF', 'WHITE'): continue
        if d: paths.append('<path d="%s"%s/>' % (d.group(1), (' transform="%s"' % tr.group(1)) if tr else ''))
    if not paths:
        raise SystemExit('vtracer produced no paths')
    out = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" fill="#%s" fill-rule="evenodd">'
           % (OUT, OUT, OUT, OUT, gold) + ''.join(paths) + '</svg>')
    Path(dst).write_text(out)
    return len(out), len(paths)

if __name__ == '__main__':
    a = sys.argv[1:]; kw = {}
    for flag, key, cast in (('--thresh', 'thresh', int), ('--gold', 'gold', str), ('--speckle', 'speckle', int)):
        if flag in a:
            i = a.index(flag); kw[key] = cast(a[i + 1]); del a[i:i + 2]
    n, k = main(a[0], a[1], **kw)
    print(f'{a[1]}: {n} bytes, {k} paths')
