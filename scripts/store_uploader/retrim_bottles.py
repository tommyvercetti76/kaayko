"""
retrim_bottles.py — cut the flat floor off the bottle mockups, and give them previews.

The bottle mockups came with a plain band across the bottom 10–12% of every frame
(the studio floor, one flat tone). On a 4:5 card with `object-fit: cover` a square
source keeps its full height, so that band showed on every bottle and on nothing
else. And bottles had no 1600px preview tier, so the grid was pulling the 3600px
originals. This script fixes both, in place of the pipeline that should have:

  for every kaaykoproducts doc with productType == "bottle":
    for every frame in imgSrc:
      download → measure the flat band from the bottom → crop it (1.5% margin)
      → image_pipeline.process_image (3600 full + 1600 preview, WebP)
      → upload NEW hashed blobs next to the old ones
    write imgSrc + previewSrc on the doc

Old blobs are NOT deleted: order lines froze the old URLs at purchase and receipts
still point at them.

Usage:
  KAAYKO_DISABLE_AI=1 python3 retrim_bottles.py [--dry-run] [--only <docId>]
"""
import argparse, hashlib, io, os, sys, tempfile
from pathlib import Path
from urllib.parse import quote
from urllib.request import urlopen

import numpy as np
from PIL import Image

os.environ.setdefault("KAAYKO_DISABLE_AI", "1")
sys.path.insert(0, str(Path(__file__).parent))
from image_pipeline import process_image  # noqa: E402
from firestore_writer import init_app, STORAGE_PREFIX, COLLECTION  # noqa: E402
from firebase_admin import firestore, storage  # noqa: E402

SA = os.environ.get("KAAYKO_SA_PATH", "/Users/Rohan/Desktop/Kaayko_TShirts_v2/key/store_key.json")
MIN_BAND = 0.04      # ignore anything smaller than 4% — that is just a shadow, not a floor
MARGIN = 0.025       # keep a sliver of floor under the objects so nothing sits on the edge


def flat_band_rows(img: Image.Image) -> int:
    """How many rows, counted from the bottom, are one flat tone."""
    a = np.asarray(img.convert("L")).astype(np.int16)
    h = a.shape[0]
    base = a[-8:].mean()
    n = 0
    for y in range(h - 1, -1, -1):
        row = a[y]
        if row.std() < 7 and abs(row.mean() - base) < 10:
            n += 1
        else:
            break
    return n


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--only")
    args = ap.parse_args()

    init_app(SA)
    db = firestore.client()
    bucket = storage.bucket()

    q = db.collection(COLLECTION).where("productType", "==", "bottle")
    docs = [d for d in q.stream() if not args.only or d.id == args.only]
    print(f"{len(docs)} bottle products")

    for doc in docs:
        data = doc.to_dict() or {}
        frames = data.get("imgSrc") or []
        pid = data.get("productID") or doc.id
        prefix = f"{STORAGE_PREFIX}/{pid}/"
        print(f"\n{doc.id} ({pid}): {len(frames)} frames")
        new_full, new_prev = [], []
        with tempfile.TemporaryDirectory() as td:
            for i, url in enumerate(frames):
                raw = urlopen(url, timeout=60).read()
                img = Image.open(io.BytesIO(raw))
                w, h = img.size
                band = flat_band_rows(img)
                frac = band / h
                cut = int(h * max(0.0, frac - MARGIN)) if frac >= MIN_BAND else 0
                print(f"  [{i}] {w}x{h} flat band {frac:.1%} → crop {cut}px")
                if cut:
                    img = img.crop((0, 0, w, h - cut))
                src = Path(td) / f"{i}.png"
                img.save(src)
                out = Path(td) / f"{i}.webp"
                res = process_image(src, out)
                if args.dry_run:
                    continue
                hsh = hashlib.sha1(out.read_bytes()).hexdigest()[:10]

                def up(local: Path, dest: str) -> str:
                    b = bucket.blob(dest)
                    b.cache_control = "public, max-age=31536000, immutable"
                    b.upload_from_filename(str(local), content_type="image/webp")
                    return f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}/o/{quote(dest, safe='')}?alt=media"

                new_full.append(up(out, f"{prefix}{i}_{hsh}.webp"))
                new_prev.append(up(res.preview_path, f"{prefix}{i}_{hsh}.preview.webp"))
                print(f"       → {res.output_size} full, {res.preview_size} preview")
        if args.dry_run or len(new_full) != len(frames):
            continue
        doc.reference.set({"imgSrc": new_full, "previewSrc": new_prev,
                           "updatedAt": firestore.SERVER_TIMESTAMP}, merge=True)
        print("  doc updated")
    return 0


if __name__ == "__main__":
    sys.exit(main())
