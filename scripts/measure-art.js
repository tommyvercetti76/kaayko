#!/usr/bin/env node
/**
 * Print ART_EXTENT for src/js/cards/render.js: the bounding box of every pixel
 * in each card art file that is not the cream ground. The back of the card
 * frames the animal at this extent instead of showing the whole file, so when
 * an art file changes this has to be re-run and the constant updated.
 *
 * Needs Python 3 with Pillow, which is what produced the files in the first
 * place; node has no image decoder of its own.
 */
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const py = `
from PIL import Image, ImageChops
import os, json
d = ${JSON.stringify(path.join(__dirname, '..', 'src', 'assets', 'cards', 'art'))}
out = {}
for f in sorted(os.listdir(d)):
    if not f.endswith('.png'): continue
    im = Image.open(os.path.join(d, f)).convert('RGB')
    ground = im.getpixel((3, 3))
    mask = ImageChops.difference(im, Image.new('RGB', im.size, ground)).convert('L').point(lambda v: 255 if v > 28 else 0)
    x0, y0, x1, y1 = mask.getbbox()
    out[f[:-4]] = dict(x=x0, y=y0, w=x1 - x0, h=y1 - y0)
for k, v in out.items():
    print(f"  {k + ':':<13}Object.freeze({{ x: {v['x']:>3}, y: {v['y']:>3}, w: {v['w']:>3}, h: {v['h']:>4} }}),")
`;
// `python3` on PATH here is a shell alias with no Pillow; the framework build
// and the system one both have it. Try each until one answers.
const candidates = [
  process.env.PYTHON,
  '/Library/Frameworks/Python.framework/Versions/3.13/bin/python3',
  '/usr/bin/python3',
  'python3',
].filter(Boolean);
let out = null, lastErr = null;
for (const exe of candidates) {
  try { out = execFileSync(exe, ['-c', py], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); break; }
  catch (e) { lastErr = e; }
}
if (out === null) { console.error('measure-art: no python with Pillow found'); process.exit(1); }
process.stdout.write('export const ART_EXTENT = Object.freeze({\n');
process.stdout.write(out);
process.stdout.write('});\n');
