/* High-colour, high-contrast variants of the two layouts that survived:
 * 06 "sheared bands" and 12 "slot plates" from out/layouts-bigicons.html.
 *
 *   node src/colorvariants.mjs      # → out/layouts-color.html
 *
 * Eight of each, all pushed well past the warm-only brand ramp. Three colour
 * systems are in play:
 *   medal  — placement colour (gold / silver / bronze / slate)
 *   type   — the team's real typing, read from the Champions database via
 *            assets/sprite-map.json, so the colour carries meta signal
 *   neon   — a saturated set used purely for contrast
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAP = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/sprite-map.json"), "utf8"));
const SPRITE_ROOT = process.env.CHAMPIONS_SPRITES || MAP.root;
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data/sample-top16.json"), "utf8"));
const TOP4 = DATA.standings.slice(0, 4);

const b64 = f => fs.readFileSync(f).toString("base64");
const slugs = [...new Set(TOP4.flatMap(p => p.team))];
const spriteCss = slugs.map(s =>
  `.s-${s}{background-image:url(data:image/png;base64,${b64(path.join(SPRITE_ROOT, MAP.entities[s].menu))})}`
).join("\n");
const pikaMask = `url(data:image/png;base64,${b64(path.join(SPRITE_ROOT, MAP.entities.pikachu.silhouette))})`;

const fontsSrc = fs.readFileSync(path.join(ROOT, "assets/fonts.css"), "utf8");
const faces = [];
for (const m of fontsSrc.matchAll(/\/\*\s*latin\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)) {
  const body = m[1];
  const fam = /font-family:\s*'([^']+)'/.exec(body)?.[1];
  const wght = /font-weight:\s*([^;]+);/.exec(body)?.[1].trim();
  const file = /url\(\.\/fonts\/([^)]+)\)/.exec(body)?.[1];
  if (!fam || !file) continue;
  if (fam === "Montserrat" && !["700", "800"].includes(wght)) continue;
  if (fam === "Inter" && !["500", "600", "700", "800"].includes(wght)) continue;
  faces.push(`@font-face{font-family:'${fam}';font-style:normal;font-weight:${wght};font-display:block;` +
    `src:url(data:font/woff2;base64,${b64(path.join(ROOT, "assets/fonts", file))}) format('woff2')}`);
}

/* ── Colour systems ──────────────────────────────────────────────────── */

/* Placement colour. Dark text sits on all four — 7.0:1 or better. */
const MEDAL = [
  { fill: "#ffcf4d", ink: "#1a1a1a", name: "gold" },
  { fill: "#d5dde8", ink: "#1a1a1a", name: "silver" },
  { fill: "#e08b4a", ink: "#1a1a1a", name: "bronze" },
  { fill: "#8fa3b8", ink: "#1a1a1a", name: "slate" },
];

/* Saturated purely for contrast — dark text on every one. */
const NEON = ["#22e0d6", "#ff4fa3", "#b6ff3d", "#ffb020"];

const TYPE = {
  normal: "#a8a878", fire: "#ee7b34", water: "#4a90dd", electric: "#f6c945",
  grass: "#6fc25a", ice: "#7fd4d4", fighting: "#c03028", poison: "#ab5aa8",
  ground: "#d8b45c", flying: "#9bb4f0", psychic: "#f5548c", bug: "#99c022",
  rock: "#b8a038", ghost: "#7a6aae", dragon: "#6f52e8", dark: "#6b5a4e",
  steel: "#a9b8c6", fairy: "#f094c6",
};

const typesOf = slug => MAP.entities[slug]?.types || [];

/* The team's signature type — the most common primary, ties broken by order
   of appearance. Used wherever a whole band takes one colour. */
function signature(p) {
  const counts = new Map();
  for (const s of p.team) {
    const t = typesOf(s)[0];
    if (t) counts.set(t, (counts.get(t) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "normal";
}
/* Two most common types across the whole team, for gradients. */
function pair(p) {
  const counts = new Map();
  for (const s of p.team) for (const t of typesOf(s)) counts.set(t, (counts.get(t) || 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
  return [top[0] || "normal", top[1] || top[0] || "normal"];
}

/* ── Content ─────────────────────────────────────────────────────────── */

const esc = s => String(s).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ORD = n => ["th", "st", "nd", "rd"][n] || "th";

const icons = (p, opts = {}) => {
  const slots = [...p.team];
  while (slots.length < 6) slots.push(null);
  return slots.map(s => {
    if (!s) return `<i class="pk pk--empty"></i>`;
    const t = typesOf(s)[0] || "normal";
    if (opts.plate) return `<span class="plate" style="--t:${TYPE[t]}"><i class="pk s-${s}"></i></span>`;
    if (opts.strip) return `<span class="cell"><i class="pk s-${s}"></i><b class="tstrip" style="--t:${TYPE[t]}"></b></span>`;
    return `<i class="pk s-${s}"></i>`;
  }).join("");
};

const team = (p, opts) => `<div class="team">${icons(p, opts)}</div>`;

const chips = p => {
  const seen = [...new Set(p.team.flatMap(typesOf))].slice(0, 5);
  return `<div class="chips">${seen.map(t =>
    `<span class="chip" style="--t:${TYPE[t]}">${t}</span>`).join("")}</div>`;
};

const label = (p, i, extra = "") => `<div class="lab">
  <span class="pl">${i + 1}<sup>${ORD(i + 1)}</sup></span>
  <span class="nm">${esc(p.name)}</span>${extra}
  <span class="rule"></span>
  <span class="rc">${esc(p.record)}</span>
</div>`;

function blocks(opts = {}) {
  return TOP4.map((p, i) => {
    const med = MEDAL[i], sig = TYPE[signature(p)], [a, b] = pair(p);
    const vars = [
      `--med:${med.fill}`, `--med-ink:${med.ink}`,
      `--sig:${sig}`, `--ta:${TYPE[a]}`, `--tb:${TYPE[b]}`,
      `--neon:${NEON[i]}`,
    ].join(";");
    return `<section class="blk ${i === 0 ? "blk--champ" : ""}" style="${vars}">
      ${label(p, i, opts.chips ? chips(p) : "")}${team(p, opts)}
    </section>`;
  }).join("");
}

const head = () => `<header class="head">
  <div class="head__row"><h1 class="title">${esc(DATA.event)}</h1>
  <span class="cut">Top 4</span></div>
  <p class="sub">${[DATA.location, DATA.date, `${DATA.players} ${DATA.division}`, DATA.format]
    .map(esc).join(" &nbsp;·&nbsp; ")}</p>
</header>`;

const foot = `<footer class="foot"><span class="mark">Georgia<span>Play</span>Events</span>
  <p class="disclaim">Fan-made content. Not affiliated with or endorsed by Nintendo,
  Creatures Inc., GAME FREAK, or The Pok&eacute;mon Company.</p></footer>`;

const card = opts => head() + `<main class="stack">${blocks(opts)}</main>` + foot;

/* ── Variants ────────────────────────────────────────────────────────── */

const V = [
  /* ── shear family ── */
  { id: "sh-medal", fam: "shear", icon: 144, sys: "medal", title: "Medal bands",
    note: "Each sheared band takes its placement colour as a solid fill, with dark text and icons over it. The highest-contrast reading of the shear." },
  { id: "sh-type", fam: "shear", icon: 138, sys: "type", title: "Team-type bands", chips: true,
    note: "Band colour is the team's signature type, pulled from the Champions database. Type chips sit under the name — colour that means something." },
  { id: "sh-neon", fam: "shear", icon: 140, sys: "neon", title: "Neon rails",
    note: "Dark bands, a thick saturated rail and a glow per placement. Colour carried entirely by edges rather than fills." },
  { id: "sh-split", fam: "shear", icon: 106, sys: "medal", title: "Split bands",
    note: "Band divided: a solid colour block holds placement and name, the dark half holds the team. Costs the most icon size of the eight." },
  { id: "sh-reverse", fam: "shear", icon: 144, sys: "medal", title: "Reverse shear",
    note: "Skewed the other way and stepped from the right, alternating solid and dark. The zig-zag makes the ranking direction unmistakable." },
  { id: "sh-plates", fam: "shear", icon: 128, sys: "type", title: "Type plates", plate: true,
    note: "Every Pokémon sits on its own type-coloured plate — up to twenty-four colours at once. Maximum colour density in the set." },
  { id: "sh-numplate", fam: "shear", icon: 118, sys: "medal", title: "Numeral plates",
    note: "A large colour-blocked numeral plate leads each band. Rank reads instantly; the plate is what costs the icons their width." },
  { id: "sh-ribbon", fam: "shear", icon: 150, sys: "medal", title: "Ribbon stack",
    note: "A thin coloured name ribbon rides above a wider dark team ribbon, both sheared. Name and team fully separated — biggest icons in the family." },

  /* ── slot family ── */
  { id: "sl-medal", fam: "slot", icon: 136, sys: "medal", title: "Medal slots",
    note: "Clipped plates with the numeral and border in placement colour. The most restrained of the slot eight." },
  { id: "sl-typegrad", fam: "slot", icon: 136, sys: "type", title: "Type gradient slots",
    note: "Plate fills with a gradient between the team's two commonest types. Every card is differently coloured by its own data." },
  { id: "sl-neon", fam: "slot", icon: 136, sys: "neon", title: "Neon outline slots",
    note: "Black plates, heavy saturated outlines and glow. Closest thing here to an arcade select screen." },
  { id: "sl-solid", fam: "slot", icon: 126, sys: "medal", title: "Solid plates",
    note: "Plate fully saturated in placement colour, icons dropped onto an inset dark panel so they stay readable against it." },
  { id: "sl-typestrip", fam: "slot", icon: 134, sys: "type", title: "Type underlines", strip: true,
    note: "Dark plates, each icon underlined in its own type colour. Colour at the slot level rather than the band level." },
  { id: "sl-grid", fam: "slot", icon: 140, sys: "medal", title: "Quad grid",
    note: "Two-by-two plates with each team wrapped 3×2. The layout change actually KEEPS icons large — wrapping beats a single long row." },
  { id: "sl-numtab", fam: "slot", icon: 146, sys: "neon", title: "Corner tabs",
    note: "Numeral clipped into a colour tab at the plate's corner, name across the top. Tab costs no row width, so icons stay big." },
  { id: "sl-invert", fam: "slot", icon: 136, sys: "medal", title: "Inverted plates",
    note: "Light plates with dark text — breaks the dark-only brand rule outright, and is the highest-contrast card in the set." },
];

/* ── Page ────────────────────────────────────────────────────────────── */

const css = fs.readFileSync(path.join(ROOT, "src/colorvariants.css"), "utf8");

const cards = V.map((v, i) => `<figure class="demo">
  <figcaption>
    <span class="demo__n">${String(i + 1).padStart(2, "0")}</span>
    <span class="demo__title">${esc(v.title)}</span>
    <span class="demo__fam demo__fam--${v.fam}">${v.fam === "shear" ? "from 06 shear" : "from 12 slot"}</span>
    <span class="demo__sys demo__sys--${v.sys}">${v.sys}</span>
    <span class="demo__icon">${v.icon}px</span>
    <span class="demo__note">${esc(v.note)}</span>
  </figcaption>
  <div class="frame"><div class="card C-${v.id}" style="--icon:${v.icon}px">${
    card({ chips: v.chips, plate: v.plate, strip: v.strip })}</div></div>
</figure>`).join("\n");

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Top 4 — colour variants of 06 and 12</title>
<style>
${faces.join("\n")}
${spriteCss}
.pk--empty{--mask:${pikaMask}}
${css}
</style></head><body>
<header class="page">
  <h1>Top 4 — colour variants</h1>
  <p>Eight variations on <b>06 sheared bands</b> and eight on <b>12 slot plates</b>, all pushed for
  colour and contrast. Three colour systems: <b>medal</b> (gold / silver / bronze / slate by
  placement), <b>type</b> (the team's real typing, read from the Champions database — so the colour
  carries meta signal), and <b>neon</b> (saturated, purely for contrast). Every coloured fill takes
  dark text. This deliberately leaves the warm-only brand ramp behind.</p>
</header>
<div class="grid">${cards}</div>
</body></html>`;

fs.mkdirSync(path.join(ROOT, "out"), { recursive: true });
const outPath = path.join(ROOT, "out/layouts-color.html");
fs.writeFileSync(outPath, html);
console.log(`${V.length} variants -> ${outPath}  (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
console.log("signatures: " + TOP4.map((p, i) => `${i + 1}=${signature(p)}`).join("  "));
