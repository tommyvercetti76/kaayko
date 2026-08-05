"""Kaayko store upload CLI.

Drop product images into a folder and run this script to push them to the
Kaayko store. The script:

  1. Scans the folder for ``<Name>_<Type>[_<index>].<ext>`` files.
  2. Groups files into products (multi-image SKUs share a name + type prefix).
  3. Upscales each image to ~2400px on the long edge and re-encodes as WebP.
  4. Uploads to Firebase Storage at ``kaaykoStoreTShirtImages/<productID>/``.
  5. Upserts a Firestore doc in ``kaaykoproducts`` so the store page picks it up.

Re-runs are idempotent: the same source folder produces the same productIDs
and overwrites old images cleanly.

USAGE
    python store_upload.py /path/to/folder --dry-run    # preview, no writes
    python store_upload.py /path/to/folder              # do it

CONFIG
    KAAYKO_SA_PATH   — service account JSON path
                       (default: /Users/Rohan/Desktop/Kaayko_TShirts_v2/key/store_key.json)
    KAAYKO_BUCKET    — Storage bucket (default: kaaykostore.appspot.com)

Optional ``manifest.yaml`` in the source folder overrides defaults per product.
See ``manifest.example.yaml``.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    import yaml
except ImportError:
    yaml = None

from image_pipeline import process_image
from firestore_writer import ProductRecord, init_app, upload_product

KNOWN_TYPES = {"tote", "magnet", "tshirt", "print", "sticker", "mug", "cap", "poster"}
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}

TYPE_DEFAULTS = {
    "tote":    {"price": 34.99, "availableSizes": ["One Size"], "category": "accessories"},
    "magnet":  {"price": 9.99,  "availableSizes": [],            "category": "accessories"},
    "tshirt":  {"price": 29.99, "availableSizes": ["S", "M", "L", "XL"], "category": "apparel"},
    "print":   {"price": 24.99, "availableSizes": ["A4", "A3"], "category": "art"},
    "sticker": {"price": 4.99,  "availableSizes": [],            "category": "accessories"},
    "mug":     {"price": 14.99, "availableSizes": [],            "category": "accessories"},
    "cap":     {"price": 19.99, "availableSizes": ["One Size"], "category": "apparel"},
    "poster":  {"price": 29.99, "availableSizes": ["A2", "A1"], "category": "art"},
}

GLOBAL_DEFAULTS = {
    "tags": [],
    "availableColors": [],
    "isAvailable": True,
    "maxQuantity": 50,
}


@dataclass
class ParsedFile:
    path: Path
    base: str           # e.g. "Blackbuck_Tote"
    name: str           # e.g. "Blackbuck"
    type_token: str     # e.g. "tote"
    index: int          # 1-based; 0 if single-image SKU


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def parse_filename(path: Path) -> ParsedFile | None:
    """Parse ``Name_Type[_index].ext`` into its parts. Returns None if it doesn't match."""
    stem = path.stem
    parts = stem.split("_")
    if len(parts) < 2:
        return None
    if parts[-1].isdigit() and len(parts) >= 3:
        index = int(parts[-1])
        type_token = parts[-2].lower()
        name = "_".join(parts[:-2])
    else:
        index = 0
        type_token = parts[-1].lower()
        name = "_".join(parts[:-1])
    if type_token not in KNOWN_TYPES:
        return None
    base = f"{name}_{parts[-2] if index else parts[-1]}"
    return ParsedFile(path=path, base=base, name=name, type_token=type_token, index=index)


def scan_folder(folder: Path) -> dict[str, list[ParsedFile]]:
    groups: dict[str, list[ParsedFile]] = {}
    for entry in sorted(folder.iterdir()):
        if not entry.is_file() or entry.suffix.lower() not in IMAGE_EXTS:
            continue
        parsed = parse_filename(entry)
        if parsed is None:
            print(f"  skip (filename pattern not recognized): {entry.name}", file=sys.stderr)
            continue
        groups.setdefault(parsed.base, []).append(parsed)
    for files in groups.values():
        files.sort(key=lambda f: f.index)
    return groups


def load_manifest(folder: Path) -> dict:
    manifest_path = folder / "manifest.yaml"
    if not manifest_path.exists():
        return {}
    if yaml is None:
        print("warning: manifest.yaml present but PyYAML is not installed; ignoring it.")
        return {}
    with manifest_path.open() as fh:
        return yaml.safe_load(fh) or {}


def build_record(base: str, files: list[ParsedFile], manifest: dict) -> ProductRecord:
    type_token = files[0].type_token
    type_defaults = TYPE_DEFAULTS.get(type_token, {})
    file_count = len(files)

    pretty_name = files[0].name.replace("_", " ")
    pretty_type = type_token.capitalize()
    default_title = f"{pretty_name} {pretty_type}"
    default_description = (
        f"{default_title} — illustrated Kaayko original. "
        "Made for the wild. Edit this description after upload."
    )

    cfg = {**GLOBAL_DEFAULTS, **type_defaults}
    manifest_defaults = manifest.get("defaults", {}) or {}
    manifest_types = (manifest.get("types", {}) or {}).get(type_token, {}) or {}
    manifest_products = (manifest.get("products", {}) or {}).get(base, {}) or {}
    cfg = {**cfg, **manifest_defaults, **manifest_types, **manifest_products}

    product_id = f"kaayko_{slugify(files[0].name)}_{type_token}"

    return ProductRecord(
        product_id=product_id,
        title=cfg.get("title", default_title),
        description=cfg.get("description", default_description),
        actual_price=float(cfg.get("price", 0)),
        product_type=type_token,
        category=cfg.get("category", "other"),
        tags=list(cfg.get("tags", [])),
        available_sizes=list(cfg.get("availableSizes", [])),
        available_colors=list(cfg.get("availableColors", [])),
        max_quantity=int(cfg.get("maxQuantity", 50)),
        is_available=bool(cfg.get("isAvailable", True)),
        webp_files=[],
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Upload a folder of product images to the Kaayko store.")
    parser.add_argument("folder", type=Path, help="Folder containing product images.")
    parser.add_argument("--dry-run", action="store_true", help="Preview without uploading.")
    parser.add_argument("--service-account", help="Path to Firebase service account JSON.")
    parser.add_argument("--bucket", help="Firebase Storage bucket name.")
    parser.add_argument("--only", action="append", help="Only process products whose base matches (repeatable).")
    args = parser.parse_args(argv)

    folder: Path = args.folder.resolve()
    if not folder.is_dir():
        print(f"error: {folder} is not a directory", file=sys.stderr)
        return 2

    groups = scan_folder(folder)
    if args.only:
        groups = {k: v for k, v in groups.items() if k in set(args.only)}
    if not groups:
        print("no matching product images found.")
        return 1

    manifest = load_manifest(folder)
    records = [build_record(base, files, manifest) for base, files in groups.items()]

    print(f"\nScanned: {folder}")
    print(f"Detected {len(records)} product(s) across {sum(len(v) for v in groups.values())} image(s).\n")
    for base, files in groups.items():
        rec = next(r for r in records if r.product_id == f"kaayko_{slugify(files[0].name)}_{files[0].type_token}")
        print(f"  • {rec.title}  →  {rec.product_id}  ({rec.product_type}, ${rec.actual_price:.2f})")
        for f in files:
            print(f"      {f.path.name}")

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

    processed_dir = folder / "_processed"
    print(f"\nProcessing images → {processed_dir}/")
    for base, files in groups.items():
        rec = next(r for r in records if r.product_id == f"kaayko_{slugify(files[0].name)}_{files[0].type_token}")
        rec.preview_files = []
        for i, f in enumerate(files):
            output = processed_dir / rec.product_id / f"{i}.webp"
            result = process_image(f.path, output)
            rec.webp_files.append(output)
            rec.preview_files.append(result.preview_path)
            saved = (result.source_bytes - result.output_bytes) / result.source_bytes * 100
            print(
                f"  {f.path.name} {result.source_size[0]}x{result.source_size[1]} "
                f"→ {result.output_size[0]}x{result.output_size[1]} "
                f"({result.source_bytes // 1024}KB → {result.output_bytes // 1024}KB full / "
                f"{result.preview_bytes // 1024}KB preview, -{saved:.0f}%)"
            )

    print("\nUploading to Firestore + Storage...")
    for rec in records:
        result = upload_product(rec)
        print(f"  ✓ {rec.title} ({result['product_id']}) — {len(result['imgSrc'])} image(s)")

    print(f"\nDone. {len(records)} product(s) live on /api/products.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
