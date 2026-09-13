#!/usr/bin/env python3
"""Regenerate assets/sprite-map.json from the champions_logic sprite table.

    python3 scripts/build-sprite-map.py [path/to/champions_logic]

The MCP server returns sprite paths that are relative to its repo root, and
does not expose that root (see the P1 item in champions_logic's
IMPROVEMENT_PROMPT.md). Until it does, the root is recorded here so the
renderer can resolve the files; CHAMPIONS_SPRITES overrides it at run time.
"""

import json
import os
import sqlite3
import sys

DEFAULT_REPO = "/home/nuc1/Documents/Coding Projects/champions_logic"
repo = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("CHAMPIONS_LOGIC", DEFAULT_REPO)

db = os.path.join(repo, "data", "champions_logic.db")
if not os.path.exists(db):
    sys.exit(f"no database at {db}")

con = sqlite3.connect(db)
con.row_factory = sqlite3.Row
rows = con.execute(
    "SELECT entity_kind, entity_slug, variant, path FROM sprite "
    "WHERE variant IN ('menu', 'silhouette')"
).fetchall()

entities = {}
for r in rows:
    e = entities.setdefault(r["entity_slug"], {"kind": r["entity_kind"]})
    e[r["variant"]] = r["path"]

# Typing travels with the sprite so colour treatments can key off real data
# rather than a hand-copied table.
for tbl in ("species", "mega_evolution"):
    for r in con.execute(f"SELECT slug, type1, type2 FROM {tbl}"):
        if r["slug"] in entities:
            entities[r["slug"]]["types"] = [t for t in (r["type1"], r["type2"]) if t]

# Fail loud on anything the renderer would later trip over.
missing = sorted(s for s, v in entities.items() if "menu" not in v)

out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "assets", "sprite-map.json")
with open(out, "w") as fh:
    json.dump({"root": repo, "entities": entities}, fh, indent=0)

print(f"{len(entities)} entities -> {out}")
print(f"  with silhouette: {sum(1 for v in entities.values() if 'silhouette' in v)}")
print(f"  with types: {sum(1 for v in entities.values() if 'types' in v)}")
if missing:
    print(f"  WARNING no menu sprite: {', '.join(missing)}")
