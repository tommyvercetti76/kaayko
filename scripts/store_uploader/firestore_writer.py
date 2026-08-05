"""Idempotent uploader for the Kaayko store.

Writes WebP files to Firebase Storage under ``kaaykoStoreTShirtImages/{productID}/``
and upserts the matching ``kaaykoproducts`` Firestore document. Re-running with
the same productID overwrites cleanly: old images at the same path are removed
so that switching from a 3-image SKU to a 2-image SKU doesn't leave orphans.
"""

from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import firebase_admin
from firebase_admin import credentials, firestore, storage

COLLECTION = "kaaykoproducts"
STORAGE_PREFIX = "kaaykoStoreTShirtImages"
DEFAULT_BUCKET = "kaaykostore.firebasestorage.app"


def price_to_symbol(price: float) -> str:
    if price >= 50:
        return "$$$$"
    if price >= 35:
        return "$$$"
    if price >= 20:
        return "$$"
    return "$"


@dataclass
class ProductRecord:
    product_id: str
    title: str
    description: str
    actual_price: float
    product_type: str
    category: str
    tags: list[str]
    available_sizes: list[str]
    available_colors: list[str]
    max_quantity: int
    is_available: bool
    webp_files: list[Path]            # full-res WebPs (3600px)
    preview_files: list[Path] = None  # 1600px previews, parallel to webp_files


_initialized = False


def init_app(service_account_path: str, bucket_name: Optional[str] = None) -> None:
    global _initialized
    if _initialized:
        return
    cred = credentials.Certificate(service_account_path)
    firebase_admin.initialize_app(cred, {"storageBucket": bucket_name or DEFAULT_BUCKET})
    _initialized = True


def upload_product(record: ProductRecord) -> dict:
    """Upload images + upsert Firestore doc. Returns the written payload."""
    bucket = storage.bucket()
    db = firestore.client()

    prefix = f"{STORAGE_PREFIX}/{record.product_id}/"

    # Remove old objects so the on-read storage listing reflects the new image set.
    for blob in bucket.list_blobs(prefix=prefix):
        blob.delete()

    from urllib.parse import quote

    def _upload(local: Path, dest: str) -> str:
        blob = bucket.blob(dest)
        blob.cache_control = "public, max-age=31536000, immutable"
        blob.upload_from_filename(str(local), content_type="image/webp")
        return f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}/o/{quote(dest, safe='')}?alt=media"

    # Include a short content hash in the filename so the URL changes when the
    # image content changes. The CDN/browser caches are keyed by URL, and we set
    # `immutable, max-age=1y` on uploads — without a hash in the path, edits to a
    # product would never reach end users until their cache expired.
    #
    # Each image yields TWO uploaded files:
    #   <index>_<hash>.webp          → full-res (3600px) — used in zoom modal
    #   <index>_<hash>.preview.webp  → preview (1600px)  — used in carousels
    img_src: list[str] = []
    preview_src: list[str] = []
    previews = record.preview_files or []
    for index, full in enumerate(record.webp_files):
        h = hashlib.sha1(full.read_bytes()).hexdigest()[:10]
        full_dest = f"{prefix}{index}_{h}.webp"
        img_src.append(_upload(full, full_dest))
        if index < len(previews):
            preview_dest = f"{prefix}{index}_{h}.preview.webp"
            preview_src.append(_upload(previews[index], preview_dest))

    payload = {
        "title": record.title,
        "description": record.description,
        "actualPrice": record.actual_price,
        "price": price_to_symbol(record.actual_price),
        "productType": record.product_type,
        "category": record.category,
        "tags": record.tags,
        "availableSizes": record.available_sizes,
        "availableColors": record.available_colors,
        "maxQuantity": record.max_quantity,
        "stockQuantity": record.max_quantity,
        "isAvailable": record.is_available,
        "productID": record.product_id,
        "imgSrc": img_src,
        "previewSrc": preview_src,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }

    doc_ref = db.collection(COLLECTION).document(record.product_id)
    snap = doc_ref.get()
    if not snap.exists:
        payload["votes"] = 0
        payload["createdAt"] = firestore.SERVER_TIMESTAMP
    doc_ref.set(payload, merge=True)

    return {
        "product_id": record.product_id,
        "doc_id": doc_ref.id,
        "imgSrc": img_src,
        "previewSrc": preview_src,
    }
