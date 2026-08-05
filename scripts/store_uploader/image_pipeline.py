"""Upscale source images and emit BOTH a full-resolution + a preview WebP.

Two-tier output per source:
  - Full:    3600px long edge, WebP q=88   → opened in zoom modal
  - Preview: 1600px long edge, WebP q=82   → carousel cards + hero default

Pipeline:
  1. AI upscaling via Real-ESRGAN (subprocess to dedicated venv) when available.
  2. LANCZOS + UnsharpMask fallback when AI deps are missing.
  3. Encode full WebP at TARGET_LONG_EDGE.
  4. Down-resize the same in-memory image to PREVIEW_LONG_EDGE and encode again.
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageFilter

# ── AI upscaler config ──────────────────────────────────────────────────────
AI_VENV_PYTHON = Path(os.environ.get(
    "KAAYKO_AI_PYTHON",
    "/Users/Rohan/.venv-upscale/bin/python"
))
AI_SCRIPT = Path(__file__).parent / "ai_upscale.py"

# ── Output config ───────────────────────────────────────────────────────────
TARGET_LONG_EDGE  = 3600    # full-res output (for zoom modal + retina-4K)
PREVIEW_LONG_EDGE = 1600    # preview output (carousel + hero default)
WEBP_QUALITY      = 88      # full-res quality
PREVIEW_QUALITY   = 82      # preview can take a touch more compression
WEBP_METHOD       = 6
UNSHARP_RADIUS    = 1.4
UNSHARP_PERCENT   = 60
UNSHARP_THRESHOLD = 3


def _ai_upscale(source: Path, is_alpha: bool) -> Image.Image | None:
    """Shell out to ai_upscale.py in the dedicated venv. Returns upscaled PIL
    Image on success, None if the venv is unavailable or the run failed."""
    if not AI_VENV_PYTHON.is_file():
        return None
    model = "anime" if is_alpha else "photo"
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        out_path = Path(tmp.name)
    try:
        proc = subprocess.run(
            [str(AI_VENV_PYTHON), str(AI_SCRIPT), str(source), str(out_path),
             "--model", model, "--scale", "4"],
            capture_output=True, text=True, timeout=180,
        )
        if proc.returncode != 0:
            tail = proc.stderr.strip().splitlines()[-1] if proc.stderr.strip() else "silent"
            print(f"  AI upscale failed (rc={proc.returncode}): {tail}", file=sys.stderr)
            return None
        return Image.open(out_path).copy()
    except subprocess.TimeoutExpired:
        print(f"  AI upscale timed out for {source.name}", file=sys.stderr)
        return None
    finally:
        try:
            out_path.unlink(missing_ok=True)
        except Exception:
            pass


def _save_webp(img: Image.Image, path: Path, quality: int) -> None:
    kwargs = {"quality": quality, "method": WEBP_METHOD}
    if img.mode == "RGBA":
        kwargs["lossless"] = False
    img.save(path, "WEBP", **kwargs)


def _resize(img: Image.Image, target_long: int, sharpen: bool = False) -> Image.Image:
    cur_w, cur_h = img.size
    long_edge = max(cur_w, cur_h)
    if long_edge == target_long:
        return img
    scale = target_long / long_edge
    out = img.resize((round(cur_w * scale), round(cur_h * scale)), Image.LANCZOS)
    if sharpen and scale > 1.0:
        out = out.filter(ImageFilter.UnsharpMask(
            radius=UNSHARP_RADIUS, percent=UNSHARP_PERCENT, threshold=UNSHARP_THRESHOLD,
        ))
    return out


@dataclass
class ProcessedImage:
    source_path: Path
    output_path: Path        # full-res WebP
    preview_path: Path       # 1600px preview WebP
    source_size: tuple[int, int]
    output_size: tuple[int, int]
    preview_size: tuple[int, int]
    source_bytes: int
    output_bytes: int
    preview_bytes: int
    upscaler: str = "lanczos"


def process_image(source: Path, output: Path) -> ProcessedImage:
    """Produce both <output> (full) and <output sibling>.preview.webp."""
    output.parent.mkdir(parents=True, exist_ok=True)
    preview_path = output.with_suffix(".preview.webp")

    with Image.open(source) as img:
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGBA")
        else:
            img = img.convert("RGB")
        src_w, src_h = img.size
        is_alpha = img.mode == "RGBA"

        # 1) AI upscale or LANCZOS to a working canvas (>= TARGET_LONG_EDGE).
        upscaler_used = "lanczos"
        if os.environ.get("KAAYKO_DISABLE_AI") != "1":
            ai_out = _ai_upscale(source, is_alpha=is_alpha)
            if ai_out is not None:
                img = ai_out.convert("RGBA" if is_alpha else "RGB")
                upscaler_used = "ai-anime" if is_alpha else "ai-photo"

        # 2) Resize to TARGET (capping AI output or upscaling LANCZOS fallback).
        cur_long = max(img.size)
        if cur_long > TARGET_LONG_EDGE:
            img = _resize(img, TARGET_LONG_EDGE, sharpen=False)
        elif cur_long < TARGET_LONG_EDGE and upscaler_used == "lanczos":
            img = _resize(img, TARGET_LONG_EDGE, sharpen=True)

        # 3) Save full + preview from the SAME in-memory image (preview is just
        #    a LANCZOS downscale; no need to re-AI).
        _save_webp(img, output, WEBP_QUALITY)
        preview = _resize(img, PREVIEW_LONG_EDGE)
        _save_webp(preview, preview_path, PREVIEW_QUALITY)

    return ProcessedImage(
        source_path=source,
        output_path=output,
        preview_path=preview_path,
        source_size=(src_w, src_h),
        output_size=img.size,
        preview_size=preview.size,
        source_bytes=source.stat().st_size,
        output_bytes=output.stat().st_size,
        preview_bytes=preview_path.stat().st_size,
        upscaler=upscaler_used,
    )
