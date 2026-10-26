#!/usr/bin/env python3
"""
inspect_textures.py — the flat textures the store's 3D inspect stage wraps onto its
models (js/inspect/inspect3d.js), written to src/assets/inspect/.

  magnet  <productId>.round.<hash>.webp, <productId>.square.<hash>.webp — the printed face alone, from
          magnet_gallery.badge_face (the same code that drew the product photographs),
          on the magnet's paper, transparent outside its outline.
  bottle  <docId>.bottle.<hash>.webp — the stamp scan the bottle carries, on the bottle's white,
          its perforated edge drawn as the faint line the product photographs show. Wrapped
          by inspect3d.js at its own proportions (never stretched).
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
    # 25 Oct 2026: the cheetah's round medallion replaced by Forge's HD render (Rohan);
    # the cut-out is cut_pockets.py on portfolio_v5_african_hd1280_seed13000/cheetah.png
    # (the card under its belly printed as a beige patch)
    "Cheetah": (C / "cheetah_hd/art/cheetah.transparent.png", False, True),
    **{n: (M / "portfolio_v5_african_round_seed15000" / f"{f}.png", True, True) for n, f in {
        "Secretary_Bird": "secretary-bird", "Plains_Zebra": "plains-zebra", "Hippo": "hippo",
        "African_Elephant": "african-elephant", "Giraffe": "giraffe",
        "Grey_Crowned_Crane": "grey-crowned-crane", "White_Rhino": "white-rhino"}.items()},
    "Red_Panda": (M / "portfolio_v4_indian_round_seed15100" / "red-panda.png", True, True),
    "Indian_Giant_Squirrel": (F4 / "portfolio_v4_guarded_seed9700" / "indian-giant-squirrel.png", False, True),
    "Indian_Pangolin": (C / "indian_pangolin/art/indian-pangolin.transparent.png", False, True),
    "Indian_Skimmer": (F4 / "portfolio_v4_hd1280_seed9600" / "indian-skimmer.png", False, True),
    "Sloth_Bear": (C / "sloth_bear/art/sloth-bear.transparent.png", False, True),
    "Golden_Langur": (C / "golden_langur/art/golden-langur.transparent.png", False, True),
    "Kuno_Cheetah": (C / "kuno_cheetah/art/cheetah.transparent.png", False, True),
    # 25 Oct 2026, Rohan: five new designs, each a mug and a magnet
    "Canyon_Wren": (F4.parent / "us_parks_20x8_tshirts_v1/parks/zion/canyon-wren/effort_01/render.png", False, True),
    "Himalayan_Marmot": (F4 / "portfolio_v3/himalayan-marmot/base.png", False, True),
    "Masked_Finfoot": (F4 / "portfolio_v3/masked-finfoot/base.png", False, True),
    "Small_Clawed_Otter": (F4 / "portfolio_v3/small-clawed-otter/base.png", False, True),
    "Bobcat": (C / "bobcat/art/bobcat.png", False, True),          # was ~/Desktop/BOBCat.png
}
# Hidden from the store (mug and magnet) on 24-25 Oct 2026 at Rohan's request, so no
# textures are built for them: Sarus_Crane, Lion, Chinkara, African_Fish_Eagle, Blackbuck2.

# The four C/... cut-outs above are cut_pockets.py runs on the Forge files (pockets of
# card the edge flood could not reach printed as cream patches): golden-langur from
# portfolio_v4_guarded_seed9700, indian-pangolin from portfolio_v4_hd1280_seed9600,
# sloth-bear from portfolio_v4_hd1280_seed9700, cheetah from
# portfolio_v5_african_fix_hd1280_seed13200.

# Bottles: Firestore doc id -> the stamp scan printed on it (24 Oct 2026; paired by eye
# against each bottle's photographs). Batch one's art is ~/Bottles/*stamp_x4.png (the
# README in Forge/generated/kaayko_bottles calls these the source artwork); batch two's
# is ~/Desktop/Kaayko_Stamps_v2.
BOT = Path("/Users/Rohan/Bottles"); ST2 = Path("/Users/Rohan/Desktop/Kaayko_Stamps_v2")
BOTTLES = {
    "2GlQkjNqJH1NyOIUmQ0J": BOT / "Poststamp_x4.png",            # India Postage
    "BeL1gqbF5Y6kWWJWeHFc": BOT / "AerialPoststamp_x4.png",      # First Aerial Post (portrait: a panel)
    "RWVJFJK0Q6tGeLawtRuY": BOT / "Evreststamp_x4.png",          # Conquest of Everest (the purple 2 As)
    "Z1vamuFaTPvjkWHFJhle": BOT / "Tiger2stamp_x4.png",          # Bengal Tiger (the walking tiger, 50 nP)
    "kGg8Q8df5bbcN8tLFx6Z": BOT / "Tigerstamp_x4.png",           # Tiger Conservation (IUCN, 1969)
    "mydE423HVE2f3rrpxcM6": BOT / "IndianRailwaysstamp_x4.png",  # Indian Railways
    "QKF9TpsYM6bCl8De4M9n": ST2 / "BlueMagpie_HD.png",           # Blue Magpie
    "5tAMxZe9eHJmwIjp9nJL": ST2 / "k2_HD.png",                   # K2
    "L0ZawQe4EOrDrk3EvG16": ST2 / "RiverDolphin.png",            # River Dolphin
    "yzCMEUlvYkoAdDInOgEE": ST2 / "Woodpecker_HD.png",           # Woodpecker
}

# The two older live magnets (Gaur, Gir): their faces exist only as photographs, so the
# 3D face is lifted off the original photograph, flat-lit, label and all (25 Oct 2026).
OLD_MAGNETS = {
    "kaayko_gaur_magnet": Path("/Users/Rohan/Desktop/Kaayko_Tote/_processed/kaayko_gaur_magnet/0.webp"),
    "kaayko_gir_magnet": Path("/Users/Rohan/Desktop/Kaayko_Tote/_processed/kaayko_gir_magnet/0.webp"),
}

# Totes (25 Oct 2026, Rohan: 3D for every product): product id -> the drawing printed on it
TOTE_ART = {
    "kaayko_barahsingha_tote": C / "barasingha_tote/art/barasingha_barasingha.transparent.png",
    "kaayko_blackbuck_tote": C / "blackbuck_tote/art/04_blackbuck_madhubani_tshirt.transparent.png",
    "kaayko_blackbuck2_tote": C / "blackbuck_tote_no_2/art/minimalist-madhubani-inspired-blackbuck-t-shirt-illustration.transparent.png",
    "kaayko_croc_tote": C / "crocodile_tote/art/saltwater-crocodile_saltwater-crocodile.transparent.png",
    "kaayko_fishingcat_tote": C / "fishing_cat_tote/art/fishing-cat_fishing-cat.transparent.png",
    "kaayko_florican_tote": C / "florican_tote/art/bengal-florican_bengal-florican.transparent.png",
    "kaayko_langur_tote": C / "langur_tote/art/gray-langur_gray-langur.transparent.png",
    "kaayko_peacock_tote": C / "peacock_tote/art/peacock_peacock.transparent.png",
    "kaayko_pitta_tote": C / "indian_pitta_tote/art/indian-pitta_indian-pitta.transparent.png",
    "kaayko_racoon_tote": C / "racoon_tote/art/raccoon_raccoon.transparent.png",
    "kaayko_snow-leopard_tote": C / "snow_leopard_tote/art/snow-leopard_snow-leopard.transparent.png",
}
# Stamp tees with the stamp scan on disk: doc id -> (scan, the tee's flat-lay photograph,
# from which the print's size and place on the chest are measured)
TS = Path("/Users/Rohan/Desktop/Kaayko_TShirts_v2")
STAMP_TEES = {
    "u1y09H1U1ozUasNKwOrU": (TS / "Revolution.jpg", TS / "Revolution1.png"),    # Freedom
    "ILCeSIYh1FI7K13Ur8ez": (TS / "Queen.jpg", TS / "Queen4.png"),              # Queen
    "MHLoIviEod8xPRHoEwj4": (TS / "Beethoven.jpg", TS / "Beethoven1.png"),      # Pt. Beethoven
    "8PnFf6bH3fwiH1dTCkFR": (TS / "Maurya.jpg", TS / "Chandragupta1.png"),      # Sandrokoptos
}

# Tees whose artwork exists only as photographs (MANIFEST.md): the print is lifted off
# the photo named here (a flat-lay where there is one), keyed off its fabric, and
# upscaled. doc id -> (photo, the colour the tee is in that photo)
U = C
LIFTED_TEES = {
    "qCI4Eiyxdt6SI9VT45qX": (U / "abe/upload_set/Abe1.png", "black"),                       # Abe
    "fByEJnlvdwayXv4OhIER": (U / "assault_bae/upload_set/AssaultBae_3.png", "black"),        # Assault Bae
    # every photograph of Broke is a WHITE tee; the catalogue lists Black (GAPS.md, 25 Oct 2026)
    "hYOk6UuqAoKChJ1dU9Tc": (U / "broke/upload_set/Broke_3.png", "white"),                  # Broke
    "XxOtSWqOLvFzLEVSSAwQ": (U / "hurry_up_and_live/upload_set/Live_3.png", "black"),        # Hurry Up and Live
    "y2ROcdW0AbjKCDDDV0bv": (U / "life_is_opinion/upload_set/Lifeisopinion_1.png", "black"), # Life is opinion
    "wV77tYkmibVgOQqEezX4": (U / "nagpur/upload_set/Nagpur_1.png", "black"),                 # Nagpur
    "LY46yu4JYwulIRmSAEg3": (U / "no_running_your/upload_set/NoRunning_1.png", "black"),     # No running your..
    "ceTDbeFfKG7UppCbUBM7": (U / "pikachu/upload_set/Pikachutya_1.png", "black"),            # Pikachu
    "Pqtt6rIQVbTBtKj4TQYh": (U / "self_aint_body/upload_set/nobody1.webp", "black"),        # Self ain't body
    "3uIpQlJEnvR1sDqaBLj5": (U / "straight_outta_sabarmati/upload_set/StraightOutta_2.png", "black"),
    "xyVsWqTkPcVbaiOCX0vv": (U / "the_great_climb/upload_set/Everest1.png", "black"),       # The Great Climb
}
# HTMLK is black ink on a charcoal tee, too close to its fabric to be found on its own:
# its area on the flat-lay is given by hand
TONAL_TEES = {"48NMICFJI5p0JeHDfzqA": (U / "htmlk/upload_set/HTMLK1.png", (0.35, 0.19, 0.70, 0.54))}
# Not in 3D: Courage (gFWf7rDGw8bNxxRz2yTf) — every photograph of it is a HOODIE, and a
# hoodie is not a tee; it waits for the right garment (GAPS.md, 25 Oct 2026).
UPSCALE_PY = Path("/Users/Rohan/.venv-upscale/bin/python")


def upscaled(img: Image.Image, tag: str) -> Image.Image:
    """A lifted print, 4x through Real-ESRGAN's graphics model (ai_upscale.py), capped at
    1600 px; as it is when the upscaler is not installed."""
    import subprocess, tempfile
    if not UPSCALE_PY.exists():
        return img
    with tempfile.TemporaryDirectory() as td:
        src, dst = Path(td) / f"{tag}.png", Path(td) / f"{tag}.x4.png"
        img.save(src)
        r = subprocess.run([str(UPSCALE_PY), str(Path(__file__).with_name("ai_upscale.py")), str(src), str(dst), "--model", "anime", "--scale", "4"],
                           capture_output=True, text=True)
        if r.returncode != 0 or not dst.exists():
            print("   upscale failed:", (r.stderr or r.stdout)[-300:]); return img
        out = Image.open(dst).convert("RGBA"); out.load()
    s = max(out.size)
    return out if s <= 1600 else out.resize((round(out.width * 1600 / s), round(out.height * 1600 / s)), Image.LANCZOS)

# a design whose park is not the one its art file was composed for
NAME_OVERRIDE = {"Kuno_Cheetah": "KUNO", "Canyon_Wren": "ZION", "Himalayan_Marmot": "HEMIS",
                 "Masked_Finfoot": "SUNDARBANS", "Small_Clawed_Otter": "SUNDARBANS", "Bobcat": "BIG BEND"}
# (the parks Forge composed each render for: brand/madhubani/animals.json, the us_parks folder)

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


def bottle_wrap(stamp: Path, width: int = 2048) -> Image.Image:
    """The stamp on white, its perforated outline a faint line, at its own proportions.

    The scan's paper is cream; printed on the bottle's white coat it reads as white (the
    photographs show a white margin, and a cream one looked like a stuck-on label in 3D,
    25 Oct 2026), so the scan is white-balanced on its own margin first."""
    from PIL import ImageFilter
    import numpy as np
    s = Image.open(stamp).convert("RGBA")
    s = s.resize((width, round(width * s.height / s.width)), Image.LANCZOS)
    a = np.asarray(s).astype(np.float32)
    H, W = a.shape[:2]; m = max(4, int(min(H, W) * 0.035))
    edge = np.zeros((H, W), bool); edge[:m] = edge[-m:] = True; edge[:, :m] = edge[:, -m:] = True
    paper = a[..., :3][edge & (a[..., 3] > 200)]
    paper = paper[paper.mean(axis=1) > np.percentile(paper.mean(axis=1), 40)]   # the paper, not the art's edge
    if len(paper):
        gain = np.clip(252.0 / np.median(paper, axis=0), 1.0, 1.15)
        a[..., :3] = np.clip(a[..., :3] * gain, 0, 255)
        s = Image.fromarray(a.astype(np.uint8), "RGBA")
    al = s.split()[-1]
    edge = al.filter(ImageFilter.MaxFilter(5)).point(lambda v: 255 if v > 128 else 0)
    inner = al.filter(ImageFilter.MinFilter(3)).point(lambda v: 255 if v > 128 else 0)
    from PIL import ImageChops
    line = ImageChops.subtract(edge, inner).filter(ImageFilter.GaussianBlur(0.8))
    out = Image.new("RGB", s.size, (255, 255, 255))
    out.paste(Image.new("RGB", s.size, (214, 211, 205)), (0, 0), line.point(lambda v: int(v * 0.55)))
    out.paste(s.convert("RGB"), (0, 0), al)
    return out


def save(img: Image.Image, stem: str, quality: int, exact: bool = False) -> str:
    """Write <stem>.<sha1[:10]>.webp and return its site path. `exact` keeps the colour
    under transparent pixels (a garment print's soft edge); off, the bytes — and so the
    names — of the textures already live stay what they were."""
    buf = io.BytesIO(); img.save(buf, "WEBP", quality=quality, method=6, exact=exact)
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
    import lift_magnet_print as lmp
    for pid, photo in OLD_MAGNETS.items():
        if not photo.exists():
            print("missing photo", photo); return 1
        index[pid] = {"kind": "magnet", "round": save(lmp.flat_face(photo), f"{pid}.round", 90)}
        print("  ", pid, "face lifted from", photo.name)
    for doc, stamp in BOTTLES.items():
        if not stamp.exists():
            print("missing stamp", stamp); return 1
        index[doc] = {"kind": "bottle", "wrap": save(bottle_wrap(stamp), f"{doc}.bottle", 90)}
        print("  ", doc, stamp.name)
    import garment_prints as gp
    for pid, art in TOTE_ART.items():
        if not art.exists():
            print("missing art", art); return 1
        index[pid] = {"kind": "tote", "print": save(gp.tote_print(art), f"{pid}.print", 90, exact=True)}
        print("  ", pid, art.name)
    for doc, (scan, flat) in STAMP_TEES.items():
        if not scan.exists() or not flat.exists():
            print("missing", scan, flat); return 1
        w, top = gp.measure_print(flat)
        index[doc] = {"kind": "tee", "print": save((lambda st: upscaled(st, doc) if max(st.size) < 900 else st)(gp.stamp_print(scan)), f"{doc}.print", 90, exact=True),
                      "printW": float(w), "printTop": float(top), "color": "black"}
        print("  ", doc, scan.name, f"{w} cm wide, {top} cm below the collar")
    for doc, (photo, color) in LIFTED_TEES.items():
        if not photo.exists():
            print("missing photo", photo); return 1
        img, w, top, _ = gp.lift_print(photo, color)
        # a print-on-demand tee prints at most 12 in (30 cm) across; a photograph of
        # someone wearing it measures less surely than a flat-lay
        w = min(w, 30.0)
        index[doc] = {"kind": "tee", "print": save(upscaled(img, doc), f"{doc}.print", 90, exact=True),
                      "printW": float(w), "printTop": float(top), "color": color}
        print("  ", doc, photo.name, f"lifted, {w} cm wide, {top} cm below the collar")
    for doc, (photo, box) in TONAL_TEES.items():
        img, w, top, fabric = gp.lift_tonal(photo, box)
        index[doc] = {"kind": "tee", "print": save(upscaled(img, doc), f"{doc}.print", 90, exact=True),
                      "printW": float(w), "printTop": float(top), "color": fabric}
        print("  ", doc, photo.name, f"tonal, {w} cm wide, fabric {fabric}")
    INDEX.write_text(json.dumps(index, indent=1, sort_keys=True) + "\n")
    keep = {Path(u).name for e in index.values() for u in e.values() if isinstance(u, str) and u.startswith("/assets/")}
    for old in OUT.glob("*.webp"):
        if old.name not in keep: old.unlink()
    (OUT / "index.json").unlink(missing_ok=True)
    print(len(index), "products,", len(keep), "textures ->", OUT, "; index ->", INDEX)
    return 0


if __name__ == "__main__":
    sys.exit(main())
