"""Kaayko Animals upload CLI.

Drop transparent animal cut-outs into a folder, write the editorial content
into ``animals.yaml`` in the same folder, and run this script. It will:

  1. Read ``animals.yaml`` for editorial content (one entry per animal).
  2. Find any transparent PNGs in the folder, match them to YAML slugs by
     filename (Florican.png → slug ``florican``, Snow_Leopard.png → ``snow-leopard``).
  3. Upscale + WebP-encode each image (alpha preserved).
  4. Upload to Firebase Storage at ``kaaykoAnimalArt/<slug>_<hash>.webp``
     (hash-versioned for cache-busting on updates).
  5. Upsert ``kaayko_animals/{slug}`` Firestore docs with content + artUrl.
  6. Auto-link products: for each YAML ``productMatch`` token, find existing
     ``kaaykoproducts`` docs whose productID contains the token and patch
     ``animalSlug`` onto them.

USAGE
    python animal_upload.py /Users/Rohan/Desktop/Kaayko_Animals --dry-run
    python animal_upload.py /Users/Rohan/Desktop/Kaayko_Animals
    python animal_upload.py /Users/Rohan/Desktop/Kaayko_Animals --only florican
"""

from __future__ import annotations

import argparse
import hashlib
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import quote

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    import yaml
except ImportError:
    print("error: PyYAML is required. pip install PyYAML", file=sys.stderr)
    sys.exit(2)

from image_pipeline import process_image
from firestore_writer import init_app, COLLECTION as PRODUCTS_COLLECTION

import firebase_admin
from firebase_admin import firestore, storage

ANIMALS_COLLECTION = "kaayko_animals"
# Nested under the existing public prefix — Firebase Storage rules already grant
# public read on kaaykoStoreTShirtImages/**. Putting animal art there avoids a
# rules-deploy round trip.
STORAGE_PREFIX = "kaaykoStoreTShirtImages/_animalArt"
IMAGE_EXTS = {".png", ".webp", ".jpg", ".jpeg"}


@dataclass
class AnimalRecord:
    slug: str
    name: str
    scientific_name: str
    iucn_status: str
    population: str
    park: str
    regions: list[str]
    bio: str
    product_match: list[str]
    source_image: Path | None = None
    art_url: str | None = None
    art_preview_url: str | None = None


def slug_from_filename(stem: str) -> str:
    return re.sub(r"[_\s]+", "-", stem.strip()).lower()


def load_yaml(folder: Path) -> dict:
    path = folder / "animals.yaml"
    if not path.exists():
        print(f"error: {path} not found.", file=sys.stderr)
        sys.exit(2)
    with path.open() as fh:
        return yaml.safe_load(fh) or {}


def build_records(folder: Path, manifest: dict) -> list[AnimalRecord]:
    # Map filename slug → file path (so users can drop any transparent PNG).
    image_index: dict[str, Path] = {}
    for entry in folder.iterdir():
        if entry.is_file() and entry.suffix.lower() in IMAGE_EXTS:
            image_index[slug_from_filename(entry.stem)] = entry

    records: list[AnimalRecord] = []
    for slug, data in (manifest.get("animals", {}) or {}).items():
        rec = AnimalRecord(
            slug=slug,
            name=data.get("name", slug.replace("-", " ").title()),
            scientific_name=data.get("scientificName", ""),
            iucn_status=data.get("iucnStatus", ""),
            population=data.get("population", ""),
            park=data.get("park", ""),
            regions=list(data.get("regions", [])),
            bio=data.get("bio", "").strip(),
            product_match=[t.lower() for t in (data.get("productMatch") or [slug])],
            source_image=image_index.get(slug),
        )
        records.append(rec)
    return records


def upload_animal_art(record: AnimalRecord, processed_dir: Path, bucket) -> tuple[str, str] | tuple[None, None]:
    """Upload BOTH the full + the preview WebP. Returns (full_url, preview_url)."""
    if record.source_image is None:
        return (None, None)
    output = processed_dir / f"{record.slug}.webp"
    result = process_image(record.source_image, output)

    h_full = hashlib.sha1(output.read_bytes()).hexdigest()[:10]
    h_prev = hashlib.sha1(result.preview_path.read_bytes()).hexdigest()[:10]
    dest_full = f"{STORAGE_PREFIX}/{record.slug}_{h_full}.webp"
    dest_prev = f"{STORAGE_PREFIX}/{record.slug}_{h_prev}.preview.webp"

    # Clean up ALL old hash-versioned blobs for this slug (full + preview).
    for blob in bucket.list_blobs(prefix=f"{STORAGE_PREFIX}/{record.slug}_"):
        blob.delete()

    def _upload(local: Path, dest: str) -> str:
        blob = bucket.blob(dest)
        blob.cache_control = "public, max-age=31536000, immutable"
        blob.upload_from_filename(str(local), content_type="image/webp")
        return f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}/o/{quote(dest, safe='')}?alt=media"

    full_url = _upload(output, dest_full)
    prev_url = _upload(result.preview_path, dest_prev)
    print(
        f"  art  {record.source_image.name} {result.source_size[0]}x{result.source_size[1]} "
        f"→ {result.output_size[0]}x{result.output_size[1]} full / "
        f"{result.preview_size[0]}x{result.preview_size[1]} preview "
        f"({result.source_bytes // 1024}KB → {result.output_bytes // 1024}KB / "
        f"{result.preview_bytes // 1024}KB)"
    )
    return (full_url, prev_url)


def upsert_animal_doc(record: AnimalRecord, db) -> None:
    payload = {
        "slug": record.slug,
        "name": record.name,
        "scientificName": record.scientific_name,
        "iucnStatus": record.iucn_status,
        "population": record.population,
        "park": record.park,
        "regions": record.regions,
        "bio": record.bio,
        "productMatch": record.product_match,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    if record.art_url:
        payload["artUrl"] = record.art_url
        payload["artPreviewUrl"] = record.art_preview_url

    doc_ref = db.collection(ANIMALS_COLLECTION).document(record.slug)
    snap = doc_ref.get()
    if not snap.exists:
        payload["createdAt"] = firestore.SERVER_TIMESTAMP
    doc_ref.set(payload, merge=True)


def link_products_to_animal(record: AnimalRecord, db) -> int:
    """Patch kaaykoproducts docs whose productID contains any productMatch token."""
    snap = db.collection(PRODUCTS_COLLECTION).get()
    patched = 0
    for doc in snap:
        pid = (doc.to_dict().get("productID") or "").lower()
        if any(token in pid for token in record.product_match):
            doc.reference.set({"animalSlug": record.slug}, merge=True)
            patched += 1
    return patched


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Upload Kaayko animal pages.")
    parser.add_argument("folder", type=Path, help="Folder with animals.yaml + transparent PNGs.")
    parser.add_argument("--dry-run", action="store_true", help="Preview without uploading.")
    parser.add_argument("--only", action="append", help="Process only these slugs (repeatable).")
    parser.add_argument("--service-account", help="Path to Firebase service account JSON.")
    parser.add_argument("--bucket", help="Firebase Storage bucket name.")
    parser.add_argument("--skip-product-link", action="store_true", help="Skip patching kaaykoproducts.animalSlug.")
    args = parser.parse_args(argv)

    folder: Path = args.folder.resolve()
    if not folder.is_dir():
        print(f"error: {folder} is not a directory", file=sys.stderr)
        return 2

    manifest = load_yaml(folder)
    records = build_records(folder, manifest)
    if args.only:
        allow = set(args.only)
        records = [r for r in records if r.slug in allow]
    if not records:
        print("no animals matched.")
        return 1

    print(f"\nScanned: {folder}")
    print(f"Detected {len(records)} animal(s) in animals.yaml.\n")
    for r in records:
        art = "✓ image" if r.source_image else "— no transparent PNG (will upload text only)"
        print(f"  • {r.name:24} ({r.slug:14}) {art}")

    if args.dry_run:
        print("\n[dry-run] no images processed, no uploads performed.")
        return 0

    sa_path = args.service_account or os.environ.get(
        "KAAYKO_SA_PATH",
        "/Users/Rohan/Desktop/Kaayko_TShirts_v2/key/store_key.json",
    )
    if not Path(sa_path).is_file():
        print(f"error: service account file not found at {sa_path}", file=sys.stderr)
        return 2
    bucket_name = args.bucket or os.environ.get("KAAYKO_BUCKET", "kaaykostore.firebasestorage.app")
    init_app(sa_path, bucket_name)

    bucket = storage.bucket()
    db = firestore.client()

    processed_dir = folder / "_processed"
    print(f"\nProcessing transparent images → {processed_dir}/")
    for rec in records:
        rec.art_url, rec.art_preview_url = upload_animal_art(rec, processed_dir, bucket)

    print("\nUpserting Firestore docs...")
    for rec in records:
        upsert_animal_doc(rec, db)
        suffix = " (art: yes)" if rec.art_url else " (no art yet)"
        print(f"  ✓ {rec.name} → {ANIMALS_COLLECTION}/{rec.slug}{suffix}")

    if not args.skip_product_link:
        print("\nLinking products to animals...")
        for rec in records:
            n = link_products_to_animal(rec, db)
            print(f"  ✓ {rec.name}: linked {n} product(s)")

    print(f"\nDone. {len(records)} animal(s) live on /api/animals/<slug>.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
