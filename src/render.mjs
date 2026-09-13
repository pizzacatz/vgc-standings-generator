/* Pokémon Champions final-standings graphic renderer.
 *
 *   node src/render.mjs                       # every preset in PRESETS
 *   node src/render.mjs portrait-8 square-4   # a subset
 *
 * Emits HTML per preset into out/, screenshots each with headless Chrome at
 * deviceScaleFactor 2, then crops and box-downsamples to the nominal canvas.
 * Type sizes are derived from the resolved row height, so the guide's
 * name-size floor (§7) is checked rather than assumed.
 *
 * Art comes from the champions_logic sprite repo (128×128 RGBA menu icons).
 * assets/sprite-map.json is generated from that repo's SQLite `sprite` table
 * by scripts/build-sprite-map.py. Override the repo location with
 * CHAMPIONS_SPRITES if it moves.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { capture } from "./shoot.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAP = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/sprite-map.json"), "utf8"));
const SPRITE_ROOT = process.env.CHAMPIONS_SPRITES || MAP.root;

if (!fs.existsSync(SPRITE_ROOT)) {
  throw new Error(`sprite repo not found: ${SPRITE_ROOT}\nSet CHAMPIONS_SPRITES to its location.`);
}

/* Unknown team slots. Pikachu's silhouette, tinted — a real species used as a
   null value would be indistinguishable from an actual pick, and these icons
   are meant to be read as data. */
const FILLER = "pikachu";

/* ── Canvases ─────────────────────────────────────────────────────────── */

const CANVAS = {
  portrait:  { w: 1080, h: 1350, pad: 56, headH: 208, footH: 92,
               titleFs: 56, subFs: 25, cutFs: 22, footFs: 16,
               gapIn: 10, gapOut: 20, nameFloor: 32 },
  square:    { w: 1080, h: 1080, pad: 56, headH: 196, footH: 90,
               titleFs: 54, subFs: 24, cutFs: 22, footFs: 16,
               gapIn: 10, gapOut: 20, nameFloor: 32 },
  story:     { w: 1080, h: 1920, pad: 48, headH: 168, footH: 74,
               titleFs: 50, subFs: 23, cutFs: 21, footFs: 15,
               gapIn: 6, gapOut: 12, nameFloor: 32 },
  /* 630px tall leaves so little body box that the header has to collapse to
     one row — see .head--compact. */
  landscape: { w: 1200, h: 630,  pad: 36, headH: 92, footH: 46, compact: true,
               titleFs: 42, subFs: 19, cutFs: 18, footFs: 13,
               gapIn: 8,  gapOut: 14, nameFloor: 28 },
};

/* Placement tiers. Placements are concrete (1st…8th) — a tier only governs
   row height, bar width and opacity, i.e. the visual banding. */
const TIERS = [
  { key: "champ",  from: 1, span: 1, weight: 2.00, bar: 0,  op: 1    },
  { key: "second", from: 2, span: 1, weight: 1.20, bar: 10, op: 1    },
  { key: "t34",    from: 3, span: 2, weight: 1.00, bar: 7,  op: 0.94 },
  { key: "t58",    from: 5, span: 4, weight: 1.00, bar: 5,  op: 0.85 },
  { key: "t916",   from: 9, span: 8, weight: 1.00, bar: 4,  op: 0.76 },
];

/* Megas only read as Megas at ~44px — below that Charizard and
   Charizard-Mega-Y are the same orange blob. Showing Mega forms is the whole
   point, so this is a hard minimum rather than a preference. */
const ICON_MIN = 44;

const PRESETS = {
  "portrait-8":  { canvas: "portrait",  cut: 8 },
  "portrait-4":  { canvas: "portrait",  cut: 4 },
  "square-4":    { canvas: "square",    cut: 4 },
  "landscape-4": { canvas: "landscape", cut: 4 },
  "story-16":    { canvas: "story",     cut: 16, champWeight: 1.85 },
};

/* ── Layout solver ───────────────────────────────────────────────────── */

function solve(c, cut, champWeight) {
  const tiers = TIERS.filter(t => t.from <= cut).map(t => ({
    ...t,
    span: Math.min(t.span, cut - t.from + 1),
    weight: t.key === "champ" && champWeight ? champWeight : t.weight,
  }));

  const body = c.h - c.pad * 2 - c.headH - c.footH;
  let gaps = 0;
  tiers.forEach((t, i) => {
    gaps += (t.span - 1) * c.gapIn;
    if (i) gaps += c.gapOut;
  });

  const totalWeight = tiers.reduce((s, t) => s + t.span * t.weight, 0);
  const unit = (body - gaps) / totalWeight;
  for (const t of tiers) t.h = Math.floor(unit * t.weight);
  return tiers;
}

/* Column geometry for a row of height `h`. Called ONCE for the champion and
 * ONCE for every other row (using the shortest of them), so the place, name,
 * icon and stats columns line up down the whole card. Per-tier geometry would
 * make each band a different width — which stops it being a table. */
function metrics(h, c, colW, showCp, champ) {
  const icon = Math.max(ICON_MIN,
    Math.min(Math.round(h * (champ ? 0.46 : 0.52)), champ ? 112 : 84));
  const iconGap = Math.max(3, Math.round(h * 0.045));
  const teamW = 6 * icon + 5 * iconGap + (champ ? h * 0.14 : 0);

  /* Chrome, not content — past a point these stop reading better and only
     steal width from the name. Tall rows (a Top 4 card) are where that bites,
     so each is capped in absolute px. */
  const placeW = Math.min(Math.round(h * (champ ? 0.72 : 0.68)), 104);
  const recFs = Math.min(Math.round(h * 0.21), 40);
  const statsW = Math.round(recFs * (showCp ? 4.4 : 2.9));
  const colGap = Math.min(Math.round(h * 0.15), 32);

  /* Reserve the widest bar on every row so the place column starts at the
     same x regardless of which tier's bar is drawn. */
  const barSlot = Math.round(10 * (c.nameFloor / 32));

  const fixed = barSlot + placeW + statsW + h * 0.22;
  const inlineW = colW - fixed - colGap * 3 - teamW;
  const stack = inlineW < colW * 0.28;
  const nameW = stack ? colW - fixed - colGap * 2 : inlineW;

  return { icon, iconGap, teamW, placeW, recFs, statsW, colGap, barSlot, stack, nameW };
}

/* Name size varies with the row's own height, but is bounded by the SHARED
 * name column — so a taller band gets a bigger name without breaking the
 * alignment. Inter 600 averages ~0.52em per character; a name should reach
 * NAME_BUDGET characters before the ellipsis rule applies. */
function nameSize(h, m, champ) {
  const NAME_BUDGET = 16;
  let fs = Math.min(
    Math.round(h * (m.stack ? (champ ? 0.34 : 0.30) : 0.39)),
    Math.floor(m.nameW / (NAME_BUDGET * 0.52)),
  );
  if (m.stack) {
    const fits = v => v * 1.20 + v * 0.28 + m.icon + h * 0.12 <= h;
    while (fs > 8 && !fits(fs)) fs -= 1;
  }
  return fs;
}

/* ── HTML ────────────────────────────────────────────────────────────── */

const esc = s => String(s).replace(/[&<>"]/g, ch =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

const fileUrl = rel =>
  "file://" + path.join(SPRITE_ROOT, rel).split(path.sep).map(encodeURIComponent).join("/");

function sprite(slug) {
  const e = MAP.entities[slug];
  if (!e || !e.menu) throw new Error(`no menu sprite for "${slug}"`);
  return `<i class="pk" style="--src:url('${fileUrl(e.menu)}')"></i>`;
}

function filler() {
  const e = MAP.entities[FILLER];
  if (!e || !e.silhouette) throw new Error(`no silhouette for filler "${FILLER}"`);
  return `<i class="pk pk--empty" style="--mask:url('${fileUrl(e.silhouette)}')"></i>`;
}

const ORD = n =>
  ["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th";

function rowHtml(p, place, t, m, nameFs, showCp) {
  const slots = [...p.team];
  while (slots.length < 6) slots.push(null);
  const team = `<div class="team">${slots.map(s => s ? sprite(s) : filler()).join("")}</div>`;
  const name = `<h2 class="pname">${esc(p.name)}</h2>`;

  const body = m.stack
    ? `<div class="body"><div style="min-width:0">${name}</div>${team}</div>`
    : `<div class="who">${name}</div>${team}`;

  const vars = [
    `--row-h:${t.h}px`, `--bar-w:${Math.round(t.bar * (m.barSlot / 10))}px`,
    `--bar-slot:${m.barSlot}px`, `--place-w:${m.placeW}px`,
    `--place-fs:${Math.min(Math.round(t.h * 0.40), 64)}px`, `--name-fs:${nameFs}px`,
    `--rec-fs:${m.recFs}px`, `--stats-w:${m.statsW}px`, `--col-gap:${m.colGap}px`,
    `--icon:${m.icon}px`, `--icon-gap:${m.iconGap}px`, `--row-op:${t.op}`,
  ].join(";");

  const cls = ["row", t.key === "champ" && "row--champ", m.stack && "row--stack"]
    .filter(Boolean).join(" ");

  const stats = `<div class="stats"><span class="rec">${esc(p.record)}</span>` +
    (showCp ? `<span class="cp">${p.cp} CP</span>` : "") + `</div>`;

  return `<article class="${cls}" style="${vars}">` +
    `<div class="place"><span class="place__n">${place}</span>` +
    `<span class="place__o">${ORD(place)}</span></div>` +
    body + stats + `</article>`;
}

function build(presetName, data) {
  const { canvas, cut, champWeight } = PRESETS[presetName];
  const c = CANVAS[canvas];
  const showCp = data.showCp !== false;
  const tiers = solve(c, cut, champWeight);
  const inner = c.w - c.pad * 2;
  const warnings = [];

  const rest = tiers.filter(t => t.key !== "champ");
  const champM = metrics(tiers[0].h, c, inner, showCp, true);
  const restM = rest.length
    ? metrics(Math.min(...rest.map(t => t.h)), c, inner, showCp, false)
    : null;

  let groups = "", n = 0;
  for (const t of tiers) {
    const champ = t.key === "champ";
    const m = champ ? champM : restM;
    const nameFs = nameSize(t.h, m, champ);
    if (nameFs < c.nameFloor) {
      warnings.push(`${t.from}${t.span > 1 ? `–${t.from + t.span - 1}` : ""}: ` +
        `name ${nameFs}px < ${c.nameFloor}px floor (row ${t.h}px)`);
    }
    const rows = data.standings.slice(n, n + t.span)
      .map((p, i) => rowHtml(p, n + i + 1, t, m, nameFs, showCp)).join("");
    n += t.span;
    groups += `<div class="grp">${rows}</div>`;
  }

  const cardVars = [
    `--w:${c.w}px`, `--h:${c.h}px`, `--pad:${c.pad}px`,
    `--head-h:${c.headH}px`, `--foot-h:${c.footH}px`,
    `--title-fs:${c.titleFs}px`, `--sub-fs:${c.subFs}px`,
    `--cut-fs:${c.cutFs}px`, `--foot-fs:${c.footFs}px`,
    `--gap-in:${c.gapIn}px`, `--gap-out:${c.gapOut}px`,
  ].join(";");

  const meta = [data.location, data.date, `${data.players} ${data.division}`, data.format]
    .filter(Boolean).map(esc).join(" &nbsp;·&nbsp; ");
  const sub = `<p class="sub">${meta}</p>`;

  const head = c.compact
    ? `<header class="head head--compact">
  <div class="head__main"><h1 class="title">${esc(data.event)}</h1>${sub}</div>
  <span class="cutbar__cut">Top ${cut}</span>
</header>`
    : `<header class="head">
  <h1 class="title">${esc(data.event)}</h1>
  ${sub}
  <div class="cutbar">
    <span class="cutbar__label">Final Standings</span>
    <span class="cutbar__rule"></span>
    <span class="cutbar__cut">Top ${cut}</span>
  </div>
</header>`;

  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>${esc(data.event)} — Top ${cut}</title>
<link rel="stylesheet" href="../src/standings.css"></head>
<body><div class="card" style="${cardVars}">
${head}
<main class="rows">${groups}</main>
<footer class="foot">
  <span class="mark">Georgia<span>Play</span>Events</span>
  <p class="disclaim">Fan-made content. Not affiliated with or endorsed by Nintendo, Creatures Inc., GAME FREAK, or The Pok&eacute;mon Company.</p>
</footer>
</div></body></html>`;

  return { html, c, warnings, tiers };
}

/* ── Render ──────────────────────────────────────────────────────────── */

const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data/sample-top16.json"), "utf8"));
const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(PRESETS);
fs.mkdirSync(path.join(ROOT, "out"), { recursive: true });

for (const name of want) {
  const { html, c, warnings, tiers } = build(name, data);
  const htmlPath = path.join(ROOT, "out", `${name}.html`);
  const base = path.join(ROOT, "out", name);
  fs.writeFileSync(htmlPath, html);
  capture(htmlPath, base, c);
  const rows = tiers.map(t => `${t.key}:${t.h}`).join(" ");
  console.log(`${name.padEnd(13)} ${c.w}x${c.h}  rows[${rows}]`);
  for (const w of warnings) console.log(`  ! ${w}`);
}
