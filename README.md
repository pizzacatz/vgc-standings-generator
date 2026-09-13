# Champions Standings Generator

Final-standings graphics for Pokémon Champions events (Regulation M-C) — Top 4,
Top 8 and Top 16 — built against
`GeorgiaPlayEventsAssets/docs/BRACKET-GRAPHIC-GUIDE.md`.

**Web app: https://pizzacatz.github.io/vgc-standings-generator/**

## Web app (`web/`)

A static, client-only page — no build step, no backend; nothing leaves the
browser. Fill in the event, pick the cut, enter each player's record, points and
team, and download the PNG.

- **Paste event listing** — paste a listing like the one below and the event
  name, date and location fill in as you paste. The address becomes
  "City, ST"; the link isn't drawn but is kept in the exported JSON.

  ```
  VGC Challenge @ BATTLE AND BREW
  When: Sun, Sep 13, 2026, 12:00 PM – 4:00 PM ET
  Where: 5920 ROSWELL RD A120, SANDY SPRINGS, GA 30328
  Link: https://www.pokemon.com/us/pokemon-trainer-club/play-pokemon-tournaments/26-09-004853/
  ```
- **Date** is a date picker. Dates are stored as ISO (`2026-09-13`) and always
  drawn as "13 September 2026" (`formatDate` in `web/card.js`). Older saves and
  JSON with a written-out date are converted on load; the CLI draws a non-ISO
  date as written.
- **Teams** — type species with autocomplete, or **Paste team** from a
  Showdown / PokePaste export. A species holding its own Mega Stone is shown
  as the Mega form, as on the rendered cards.
- **Preview** is the real card in an iframe; **Download PNG** (1080 wide) and
  **@2x** rasterise the same markup through an SVG `foreignObject`, so the
  export matches the preview. On phones that support it, **Share** hands the
  PNG to the share sheet.
- **Warnings** list species not in the regulation and missing names. Event and
  player names always show whole (see *Fitted names* below).
- **Import / Export JSON** uses the same shape as `data/*.json`, so an event
  saved from the page renders with `node src/card.mjs --data`.
- The event autosaves to `localStorage`.

Run it locally with any static server:

```
python3 -m http.server -d web 8000     # → http://localhost:8000
```

Pushing a change under `web/` to `main` deploys it via
`.github/workflows/pages.yml`.

| File | Role |
|---|---|
| `web/card.js` | Card builder — **shared** by the web app and `src/card.mjs` |
| `web/card.css` | Card styles, scoped under `.card` |
| `web/export.js` | Card → PNG in the browser |
| `web/app.js`, `app.css`, `index.html` | The form, preview and toolbar |
| `web/data/roster.json` | Names, typing and Mega Stones per legal slug |
| `web/sprites/`, `web/fonts/` | Menu icons and the card's typefaces |
| `web/brand/gpe-logo.png` | Corner logo, from `GeorgiaPlayEventsAssets/logo.png` |

`web/data`, `web/sprites`, `web/fonts` and `web/brand` are generated — rerun
when the regulation (or the logo) changes:

```
python3 scripts/build-web-assets.py    # needs champions_logic + GeorgiaPlayEventsAssets
```

## Command line

```
node src/card.mjs                       # settled design, Top 4/8/16 → out/card-*
node src/card.mjs story-16 --data event.json
python3 scripts/build-sprite-map.py     # for render.mjs and the exploration scripts
node src/render.mjs                     # original table design → out/
```

Needs Node 22, Google Chrome and Pillow. Each preset writes
`out/<name>.html`, `<name>@2x.png`, `<name>.png` and `thumb-<name>.png` (400px
— the guide's ship test). `render.mjs` also **reports any row whose name falls
below the guide's §7 size floor**.

## Standings cards (`src/card.mjs`)

The settled design from the layout exploration: variant 04 of
`out/layouts-brandtype.html`, **taller, semi-transparent bar**. Sheared bands
open at a hard-stop brand tone and run into each team's dominant type; the bar
is 72% black so the gradient reads through behind the stats. Footerless, with
no disclaimer — by decision. The Georgia Play Events logo sits small (38×48px)
in the bottom-right corner, in the triangle the shear leaves beside the last
band; it clears the stack's right edge at every preset.

| Preset | Canvas | Places 1–4 | Places 5+ |
|---|---|---|---|
| `square-4` | 1080×1080 | 215px band, 119px icons | — |
| `portrait-8` | 1080×1350 | 180px band, 84px icons | 92px row, 59px icons |
| `story-16` | 1080×1920 | 167px band, 71px icons | 76px row, 52px icons |

Places 1–4 get the full two-line band: a 68px bar (name up to 30px, record
40px over points 21px) with the team on its own line beneath. Places 5+ get a
one-line band: place, name and team inside the bar (name up to 22px, record
34px over points 18px). Sixteen full bands would leave ~30px icons, under the
44px Mega-legibility floor. Every bar ends in the same arrangement — record on
top, "N Pts" below, flush to the bar's edge on a width reserved for
"12-10" / "999 Pts" — and the place and name columns are shared, so the card
scans as a table. The tone ramp runs across the whole stack. (The data field
is still `cp`, and `showCp` hides the points line.)

**Fitted names.** The event name and each player name are shown whole: each is
measured at its full size and, if it overflows its column, drawn at the
largest size that fits. There is no minimum, so an extremely long name gets
very small rather than cut. Measuring needs a layout engine, so `web/card.js`
takes a `measure` function and bakes the sizes into the markup: the web app
measures against its own DOM once the card fonts load; `src/card.mjs` builds
each card once to collect the strings, measures them in headless Chrome, then
builds it for real. Both give identical sizes.

`src/card.mjs` reads `data/sample-large.json` (16 players, large-event
records) by default, building the card with `web/card.js` from the assets in
`web/`. The HTML inlines sprites and fonts, so it is self-contained. After
rendering, the page is loaded again to **report any name or title still cut
off** — fitting should leave that empty.

`render.mjs` still produces the original table design for its presets; the
`gallery` / `bigicons` / `colorvariants` / `finalists` / `sliced` / `bars` /
`brandtype` scripts are the exploration that led here. Those read sprites
straight from a local `champions_logic` checkout via `assets/sprite-map.json`. Both renderers share
the Chrome capture pipeline in `src/shoot.mjs`.

---

## What this is

A **monument**, not a broadcast: rendered once, at the end, complete. Aimed at
people who **weren't at the event**, which is why the team icons are treated as
data to be read rather than as decoration.

It is a **table**. Place, name, icon rail and stats align down the whole card
so a reader can scan a column. That alignment is load-bearing — see the shared
metrics note below.

Placements are **concrete** (1st…8th). Tiers still exist, but only as visual
banding — they govern row height, bar width and opacity, never the label.

## State model

| Placement | Colour | Second signal |
|---|---|---|
| 1st | `#ffd180 → #ff9e80` gradient fill, dark text | tallest row; team on its own line |
| 2nd | `--advance` bar, 10px | full opacity |
| 3rd–4th | `--advance` bar, 7px | 94% opacity |
| 5th–8th | `--advance` bar, 5px | 85% opacity |
| 9th–16th | `--advance` bar, 4px | 76% opacity |

Bar **width** carries rank, so the order survives with colour removed. The
opacity ramp stops at 76%, above the guide's 70% floor — everyone in a top cut
earned their place and stays readable.

## Presets

| Preset | Canvas | Rows | Min name | Floor | |
|---|---|---|---|---|---|
| `portrait-8` | 1080×1350 | 182/109/91 | 35px | 32 | ✅ |
| `portrait-4` | 1080×1350 | 341/204/170 | 44px | 32 | ✅ |
| `square-4` | 1080×1080 | 243/145/121 | 39px | 32 | ✅ |
| `landscape-4` | 1200×630 | 147/88/73 | 28px | 28 | ✅ |
| `story-16` | 1080×1920 | 159/103/86 | 33px | 32 | ✅ |

Top 4 and Top 8 are the priority formats. **Top 16 needs 1080×1920** — at
1080×1350 sixteen rows carrying six 44px icons each land around 22px names
against a 32px floor. Landscape is a **Top 4 format** for the same reason.

## Art

Icons come from the `champions_logic` sprite repo — 128×128 RGBA menu sprites
covering the Regulation M-C roster — **346 entities**, including the six
Megas M-C added (Salamence, Golisopod, Baxcalibur, and the Z Megas of Absol,
Garchomp and Lucario). Rerun `build-sprite-map.py` when the regulation changes.
`gourgeistsuper` has no menu sprite upstream. The sprites carry dark outlines,
so they hold on both the `#1a1a1a` node and the gold champion gradient without
needing a tile behind each slot.

**Megas are shown as their Mega form**, including teams carrying more than one
Mega Stone. That is why `ICON_MIN` is 44px and not lower: below ~44px Charizard
and Charizard-Mega-Y are the same orange blob, and the Mega signal — the whole
reason to render the Mega form — is lost. Colour-changing Megas (Mega-X)
survive smaller; silhouette-only changes do not.

**Unknown team slots** use Pikachu's silhouette, masked and tinted to `--rule`.
The silhouettes ship solid black, which is invisible on a near-black node, so
they are drawn as a mask rather than as an image. A real species used as a null
value would be indistinguishable from an actual pick.

`assets/sprite-map.json` records the sprite repo root because the MCP server
returns paths relative to a root it does not expose — filed as a P1 in
`champions_logic/IMPROVEMENT_PROMPT.md`. `CHAMPIONS_SPRITES` overrides it.

## Layout solver

`solve()` distributes the body box across tiers by weight, so row heights adapt
to the cut size. Three rules keep that from misfiring:

- **Shared column metrics.** `metrics()` is called once for the champion and
  once for every other row, using the *shortest* of them. Per-tier geometry
  made each band a different width — which stops it being a table.
- **Absolute caps on chrome.** Icon size, place column, stats column, numeral
  size and column gaps are all capped in px. Scaling them purely by row height
  meant Top 4 — the roomiest layout — truncated names that Top 8 fit fine, and
  overflowed its own place numerals.
- **Name capped by width as well as height.** Budgeting 16 characters at Inter
  600's ~0.52em average. Without it, tall rows pick a size the column cannot
  hold and every name ellipsises.

Truncation rule (guide §9.7): single line, ellipsis, applied consistently.

## Rendering note

New headless Chrome reserves ~87px of `--window-size` for window chrome, so the
inner viewport comes up short and the bottom of the card never paints.
`shoot()` requests 140px extra and `finish()` crops it back off, then
box-downsamples 2× → 1×. Supersampling is what keeps 32px names crisp at 400px.

## Still open

- **Data source.** `data/sample-top16.json` is hand-authored against the legal
  roster. Real event results would be better — sample data quietly encodes
  assumptions about name length and team composition.
- **5th–8th ordering** comes from Swiss standing, not head-to-head. The graphic
  does not say so; deliberate.

Settled: the sprites may be posted publicly, and the cards carry no disclaimer
(a deliberate departure from BRACKET-GRAPHIC-GUIDE §4); the logo is a small
corner mark rather than a footer.
