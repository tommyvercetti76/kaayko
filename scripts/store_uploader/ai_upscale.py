"""AI upscaling helper. Runs in /Users/Rohan/.venv-upscale (Python 3.12 +
realesrgan + basicsr + torch). Invoked by image_pipeline.py via subprocess.

Usage:
    python ai_upscale.py <input> <output> [--model {anime|photo}] [--scale N]

Reads <input> image, runs Real-ESRGAN 4x upscale on MPS / CUDA / CPU,
writes <output> as PNG (preserves alpha channel). Main pipeline handles the
LANCZOS cap + WebP encode after.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Defensive: ensure basicsr import works on torchvision 0.17+ where
# functional_tensor was removed. Idempotent — does nothing if already patched.
try:
    from torchvision.transforms import functional_tensor  # noqa: F401
except ImportError:
    import sys as _sys
    import types as _types
    from torchvision.transforms import functional as _F
    _mod = _types.ModuleType("torchvision.transforms.functional_tensor")
    _mod.rgb_to_grayscale = _F.rgb_to_grayscale
    _sys.modules["torchvision.transforms.functional_tensor"] = _mod

import numpy as np
import torch
from PIL import Image
from basicsr.archs.rrdbnet_arch import RRDBNet
from realesrgan import RealESRGANer

MODEL_WEIGHTS = {
    "photo": (
        "RealESRGAN_x4plus",
        "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth",
        23,
    ),
    "anime": (
        "RealESRGAN_x4plus_anime_6B",
        "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth",
        6,
    ),
}


def pick_device() -> str:
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def upscale(input_path: Path, output_path: Path, model_kind: str, scale: int) -> None:
    name, url, num_block = MODEL_WEIGHTS[model_kind]
    arch = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64,
                   num_block=num_block, num_grow_ch=32, scale=4)
    upsampler = RealESRGANer(
        scale=4,
        model_path=url,
        model=arch,
        tile=512,
        tile_pad=10,
        pre_pad=0,
        half=False,            # half-precision can produce artefacts on MPS
        device=pick_device(),
    )
    img = Image.open(input_path)
    has_alpha = img.mode in ("RGBA", "LA", "PA") or "transparency" in img.info
    if has_alpha:
        img = img.convert("RGBA")
    else:
        img = img.convert("RGB")
    arr = np.array(img)
    if arr.shape[-1] == 4:
        arr_bgr = arr[..., [2, 1, 0, 3]]   # RGBA → BGRA for Real-ESRGAN
    else:
        arr_bgr = arr[..., [2, 1, 0]]      # RGB  → BGR

    out_bgr, _ = upsampler.enhance(arr_bgr, outscale=scale)

    if out_bgr.shape[-1] == 4:
        out_rgb = out_bgr[..., [2, 1, 0, 3]]
    else:
        out_rgb = out_bgr[..., [2, 1, 0]]

    Image.fromarray(out_rgb).save(output_path, "PNG", optimize=False)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="AI upscale a single image (Real-ESRGAN).")
    p.add_argument("input", type=Path)
    p.add_argument("output", type=Path)
    p.add_argument("--model", choices=["photo", "anime"], default="photo")
    p.add_argument("--scale", type=int, default=4)
    args = p.parse_args(argv)
    if not args.input.is_file():
        print(f"error: input not found: {args.input}", file=sys.stderr)
        return 2
    args.output.parent.mkdir(parents=True, exist_ok=True)
    upscale(args.input, args.output, args.model, args.scale)
    return 0


if __name__ == "__main__":
    sys.exit(main())
