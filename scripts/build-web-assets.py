#!/usr/bin/env python3
"""Copy sprites and fonts into web/ and write the roster the app reads.

    python3 scripts/build-web-assets.py [path/to/champions_logic]

Rerun when the regulation changes. The Georgia Play Events logo comes from
the GeorgiaPlayEventsAssets repo (GPE_ASSETS overrides its location). Writes:
  web/sprites/<slug>.png     menu icon per legal species and Mega
  web/sprites/_filler.png    Pikachu silhouette for unknown team slots
  web/fonts/*.woff2          the Latin faces the card uses
  web/brand/gpe-logo.png     the logo, downscaled for the card's corner mark
  web/data/roster.json       names, typing and Mega Stones per slug
  web/data/fonts.json        the @font-face list for those files
"""

import json
import os
import re
import shutil
import sqlite3
import sys

from PIL import Image

DEFAULT_REPO = "/home/nuc1/Documents/Coding Projects/champions_logic"
GPE_ASSETS = os.environ.get("GPE_ASSETS", "/home/nuc1/Documents/Coding Projects/GeorgiaPlayEventsAssets")
LOGO_H = 168                           # 3× the ~56px it is drawn at
repo = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("CHAMPIONS_LOGIC", DEFAULT_REPO)
db = os.path.join(repo, "data", "champions_logic.db")
if not os.path.exists(db):
    sys.exit(f"no database at {db}")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, "web")
for d in ("sprites", "fonts", "data", "brand"):
    os.makedirs(os.path.join(WEB, d), exist_ok=True)

con = sqlite3.connect(db)
con.row_factory = sqlite3.Row
menu = {r["entity_slug"]: r["path"] for r in con.execute(
    "SELECT entity_slug, path FROM sprite WHERE variant = 'menu'")}
silhouette = {r["entity_slug"]: r["path"] for r in con.execute(
    "SELECT entity_slug, path FROM sprite WHERE variant = 'silhouette'")}
regulation = con.execute(
    "SELECT regulation FROM regulation ORDER BY active_from DESC LIMIT 1").fetchone()[0]

roster, skipped = {}, []
for r in con.execute("SELECT slug, name, type1, type2 FROM species ORDER BY national_dex, slug"):
    if r["slug"] not in menu:
        skipped.append(r["slug"])
        continue
    roster[r["slug"]] = {"name": r["name"], "types": [t for t in (r["type1"], r["type2"]) if t]}

stones = {r["slug"]: r["name"] for r in con.execute("SELECT slug, name FROM item")}
for r in con.execute("SELECT slug, base_slug, name, mega_stone, type1, type2 FROM mega_evolution"):
    if r["slug"] not in menu:
        skipped.append(r["slug"])
        continue
    roster[r["slug"]] = {
        "name": r["name"], "types": [t for t in (r["type1"], r["type2"]) if t],
        "base": r["base_slug"], "stone": stones.get(r["mega_stone"], r["mega_stone"]),
    }

# Replace wholesale so a species dropped from the regulation loses its sprite.
sprite_dir = os.path.join(WEB, "sprites")
for f in os.listdir(sprite_dir):
    os.remove(os.path.join(sprite_dir, f))
for slug in roster:
    shutil.copyfile(os.path.join(repo, menu[slug]), os.path.join(sprite_dir, f"{slug}.png"))
shutil.copyfile(os.path.join(repo, silhouette["pikachu"]), os.path.join(sprite_dir, "_filler.png"))

with open(os.path.join(WEB, "data", "roster.json"), "w") as fh:
    json.dump({"regulation": regulation, "species": roster}, fh, separators=(",", ":"))

# Fonts: only the Latin subsets at the weights the card sets.
WANT = {"Inter": {"500", "600", "700", "800"}, "Montserrat": {"700", "800"}}
css = open(os.path.join(ROOT, "assets", "fonts.css")).read()
fonts = []
for body in re.findall(r"/\*\s*latin\s*\*/\s*@font-face\s*\{([^}]*)\}", css):
    fam = re.search(r"font-family:\s*'([^']+)'", body).group(1)
    wght = re.search(r"font-weight:\s*([^;]+);", body).group(1).strip()
    file = re.search(r"url\(\./fonts/([^)]+)\)", body).group(1)
    if wght in WANT.get(fam, ()):
        shutil.copyfile(os.path.join(ROOT, "assets", "fonts", file), os.path.join(WEB, "fonts", file))
        fonts.append({"family": fam, "weight": wght, "file": f"fonts/{file}"})
with open(os.path.join(WEB, "data", "fonts.json"), "w") as fh:
    json.dump(fonts, fh, indent=1)

logo = Image.open(os.path.join(GPE_ASSETS, "logo.png")).convert("RGBA")
logo = logo.crop(logo.getbbox())
logo = logo.resize((round(logo.width * LOGO_H / logo.height), LOGO_H), Image.LANCZOS)
logo.save(os.path.join(WEB, "brand", "gpe-logo.png"), optimize=True)

print(f"regulation {regulation}: {len(roster)} species/Megas -> web/sprites, web/data/roster.json")
print(f"  fonts: {len(fonts)} faces")
print(f"  logo: {logo.width}x{logo.height} -> web/brand/gpe-logo.png")
if skipped:
    print(f"  WARNING no menu sprite, left out: {', '.join(skipped)}")
