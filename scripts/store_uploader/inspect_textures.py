#!/usr/bin/env python3
"""
inspect_textures.py — the flat textures the store's 3D inspect stage wraps onto its
models (js/inspect/inspect3d.js), written to src/assets/inspect/.

  magnet  <productId>.round.<hash>.webp, <productId>.square.<hash>.webp — the printed face alone, from
          magnet_gallery.badge_face (the same code that drew the product photographs),
          on the magnet's paper, transparent outside its outline.
  mug     <productId>.wrap.<hash>.webp — the mug's whole outer wall unrolled: circumference
          across, height down (82 mm x 95 mm, so 2.71:1). The print sits where it sits in
          the photographs: centred on the front, 0.92 rad either side, in the band from
          15% to 87% of the wall, on the glaze's white.

Plus src/js/inspect/index.json: {productId: {kind, round?, square?, wrap?}} — the page asks
it whether a product has a 3D view at all; anything not listed keeps its photographs only.
Hosting serves /assets/** as immutable for a year, so every texture carries the first 10
hex of its sha1 in its name (a re-render is a new URL), and the index lives under /js/,
which is no-cache. Textures this script wrote before and no longer lists are removed.

  python3 inspect_textures.py                    # every design in DESIGNS below
"""
from __future__ import annotations
import hashlib, io, json, math, re, sys
from pathlib import Path
from PIL import Image

import magnet_gallery as mg
import mug_gallery as mug

SRC = Path(__file__).resolve().parents[2] / "src"
OUT = SRC / "assets" / "inspect"
INDEX = SRC / "js" / "inspect" / "index.json"
C = Path("/Users/Rohan/Desktop/Kaayko_Catalogue_Sources")
M = Path("/Users/Rohan/Desktop/Forge/generated/madhubani_animals")

# upload name (product id = kaayko_<slug>_<type>) -> (art, medallion, has magnet product)
# 24 Oct 2026 evening, Rohan: new art for the giant squirrel, pangolin, skimmer and
# sloth bear (their round medallions looked poor as magnets); two new designs, the
# golden langur and the cheetah of Kuno; the Gir MUG carries the live Gir magnet's
# own drawing (lift_magnet_print.py), not the catalogue's newer lion; and the magnets
# of five designs are hidden from the store (chinkara, sarus crane, lion, blackbuck
# no. 2, african fish eagle) — their has_magnet is False here so no texture is built.
F4 = Path("/Users/Rohan/Desktop/Forge/generated/madhubani_animals")
DESIGNS = {
    "Barasingha": (C / "barasingha_tote/art/barasingha_barasingha.transparent.png", False, True),
    "Blackbuck": (C / "blackbuck_tote/art/04_blackbuck_madhubani_tshirt.transparent.png", False, True),
    "Blackbuck2": (C / "blackbuck_tote_no_2/art/minimalist-madhubani-inspired-blackbuck-t-shirt-illustration.transparent.png", False, False),
    "Crocodile": (C / "crocodile_tote/art/saltwater-crocodile_saltwater-crocodile.transparent.png", False, True),
    "FishingCat": (C / "fishing_cat_tote/art/fishing-cat_fishing-cat.transparent.png", False, True),
    "Florican": (C / "florican_tote/art/bengal-florican_bengal-florican.transparent.png", False, True),
    # the Gaur and Gir MAGNETS are the older live products: no new texture for them
    "Gaur": (C / "gaur_magnet/art/gaur_gaur.transparent.png", False, False),
    "Gir": (C / "gir_lion_magnet/art/asiatic-lion_gir-magnet-original.transparent.png", False, False),
    "Langur": (C / "langur_tote/art/gray-langur_gray-langur.transparent.png", False, True),
    "Peacock": (C / "peacock_tote/art/peacock_peacock.transparent.png", False, True),
    "Pitta": (C / "indian_pitta_tote/art/indian-pitta_indian-pitta.transparent.png", False, True),
    "Raccoon": (C / "racoon_tote/art/raccoon_raccoon.transparent.png", False, True),
    "Snow_Leopard": (C / "snow_leopard_tote/art/snow-leopard_snow-leopard.transparent.png", False, True),
    **{n: (M / "portfolio_v5_african_round_seed15000" / f"{f}.png", True, True) for n, f in {
        "Cheetah": "cheetah", "Secretary_Bird": "secretary-bird", "Plains_Zebra": "plains-zebra", "Hippo": "hippo",
        "African_Elephant": "african-elephant", "Giraffe": "giraffe",
        "Grey_Crowned_Crane": "grey-crowned-crane", "White_Rhino": "white-rhino"}.items()},
    "African_Fish_Eagle": (M / "portfolio_v5_african_round_seed15000" / "african-fish-eagle.png", True, False),
    "Lion": (M / "portfolio_v5_african_round_seed15000" / "lion.png", True, False),
    "Red_Panda": (M / "portfolio_v4_indian_round_seed15100" / "red-panda.png", True, True),
    "Chinkara": (M / "portfolio_v4_indian_round_seed15100" / "chinkara.png", True, False),
    "Sarus_Crane": (M / "portfolio_v4_indian_round_seed15100" / "sarus-crane.png", True, False),
    "Indian_Giant_Squirrel": (F4 / "portfolio_v4_guarded_seed9700" / "indian-giant-squirrel.png", False, True),
    "Indian_Pangolin": (C / "indian_pangolin/art/indian-pangolin.transparent.png", False, True),
    "Indian_Skimmer": (F4 / "portfolio_v4_hd1280_seed9600" / "indian-skimmer.png", False, True),
    "Sloth_Bear": (C / "sloth_bear/art/sloth-bear.transparent.png", False, True),
    "Golden_Langur": (C / "golden_langur/art/golden-langur.transparent.png", False, True),
    "Kuno_Cheetah": (C / "kuno_cheetah/art/cheetah.transparent.png", False, True),
}

# The four C/... cut-outs above are cut_pockets.py runs on the Forge files (pockets of
# card the edge flood could not reach printed as cream patches): golden-langur from
# portfolio_v4_guarded_seed9700, indian-pangolin from portfolio_v4_hd1280_seed9600,
# sloth-bear from portfolio_v4_hd1280_seed9700, cheetah from
# portfolio_v5_african_fix_hd1280_seed13200.

# a design whose park is not the one its art file was composed for
NAME_OVERRIDE = {"Kuno_Cheetah": "KUNO"}

PAPER = tuple(mg.PAPER)
GLAZE = (249, 248, 245)


def slug(t: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")


def park(path: Path) -> str:
    stem = path.stem.replace(".transparent", "")
    hit = next((k for k in sorted(mg.PARKS, key=len, reverse=True) if k in stem), None)
    return mg.PARKS.get(hit, "") if hit else ""


def magnet_face(art: Path, name: str, shape: str, medallion: bool, size: int = 1536) -> Image.Image:
    layer, mask, outline = mg.badge_face(art, name, shape, medallion, size=size)
    paper = Image.new("RGB", (size, size), PAPER)
    face = Image.composite(Image.composite(layer, paper, mask), paper, mask)   # ink where inked, paper elsewhere
    face = face.convert("RGBA"); face.putalpha(outline)
    return face


def mug_wrap(art: Path, name: str, medallion: bool, width: int = 4096) -> Image.Image:
    height = round(width * 95 / (math.pi * 82))
    wrap = Image.new("RGB", (width, height), GLAZE)
    sheet = mug.print_sheet(art, name, medallion, px=2000)
    arc_w = width * (2 * 0.92) / (2 * math.pi)
    band_top, band_h = height * 0.15, height * 0.72
    k = min(arc_w / sheet.width, band_h / sheet.height)
    s = sheet.resize((max(1, int(sheet.width * k)), max(1, int(sheet.height * k))), Image.LANCZOS)
    x = int(width / 2 - s.width / 2); y = int(band_top + (band_h - s.height) / 2)
    ink = Image.new("RGB", s.size, (255, 255, 255))   # white, so where there is no ink the glaze is untouched
    ink.paste(s.convert("RGB"), (0, 0), s.split()[-1])
    # multiplied, as on the mug: ink over the glaze's white
    from PIL import ImageChops
    wrap.paste(ImageChops.multiply(wrap.crop((x, y, x + s.width, y + s.height)), ink), (x, y))
    return wrap


def save(img: Image.Image, stem: str, quality: int) -> str:
    """Write <stem>.<sha1[:10]>.webp and return its site path."""
    buf = io.BytesIO(); img.save(buf, "WEBP", quality=quality, method=6)
    data = buf.getvalue()
    name = f"{stem}.{hashlib.sha1(data).hexdigest()[:10]}.webp"
    (OUT / name).write_bytes(data)
    return f"/assets/inspect/{name}"


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    index = {}
    for up, (art, medallion, has_magnet) in DESIGNS.items():
        if not art.exists():
            print("missing art", art); return 1
        name = NAME_OVERRIDE.get(up) or park(art)
        mug_id = f"kaayko_{slug(up)}_mug"
        index[mug_id] = {"kind": "mug", "wrap": save(mug_wrap(art, name, medallion), f"{mug_id}.wrap", 88)}
        if has_magnet:
            mid = f"kaayko_{slug(up)}_magnet"
            entry = {"kind": "magnet"}
            for shape in ("round", "square"):
                entry[shape] = save(magnet_face(art, name, shape, medallion), f"{mid}.{shape}", 90)
            index[mid] = entry
        print("  ", up, name or "(no park)")
    INDEX.write_text(json.dumps(index, indent=1, sort_keys=True) + "\n")
    keep = {Path(u).name for e in index.values() for k, u in e.items() if k != "kind"}
    for old in OUT.glob("kaayko_*.webp"):
        if old.name not in keep: old.unlink()
    (OUT / "index.json").unlink(missing_ok=True)
    print(len(index), "products,", len(keep), "textures ->", OUT, "; index ->", INDEX)
    return 0


if __name__ == "__main__":
    sys.exit(main())
