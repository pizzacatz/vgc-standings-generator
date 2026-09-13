/* Sliced-gradient Medal bands.
 *
 *   node src/sliced.mjs      # → out/layouts-sliced.html
 *
 * Settled with the client:
 *   · ONE gradient across the whole stack, each band a window onto its slice,
 *     so the four bands read as a single object and rank falls out of position
 *   · shear kept, stairstepping removed — every band the same width, so the
 *     six icons are spaced identically on all four rows
 *   · burnt orange dropped: the root is gold → coral, and burnt was both
 *     non-root and the only step dark enough to force an ink flip
 *   · record and CP inline, on reserved widths, so 8-5 / 12-1 and 8 / 128 CP
 *     all line up down the column
 *
 * Open question being tested here: how the text survives the band. Three
 * treatments (dark ink / black tab / outlined light) crossed with two
 * gradient sources (brand slice / team typing).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAP = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/sprite-map.json"), "utf8"));
const SPRITE_ROOT = process.env.CHAMPIONS_SPRITES || MAP.root;
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data/sample-large.json"), "utf8"));
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

/* ── Geometry ────────────────────────────────────────────────────────
 * Solved here rather than left to flex, because the slice offsets need the
 * exact band tops and the stack's total height. */

const CARD = 1080, PAD = 44, HEAD = 136, FOOT = 56, GAP = 10, INSET = 16;
const BODY = CARD - PAD * 2 - HEAD - FOOT;          // 800
const BAND = Math.floor((BODY - GAP * 3) / 4);      // 192
const STACK_H = BAND * 4 + GAP * 3;                 // 798
const STACK_W = CARD - PAD * 2 - INSET * 2;         // 960

/* A -9° shear displaces each corner by (h/2)·tan9° ≈ 15px, so the icon row is
   held inside an upright rectangle inset past the slope — otherwise the end
   icons crowd the diagonal edge, which is what read as "compression". */
const SHEAR = 9;
const SLOPE = Math.ceil((BAND / 2) * Math.tan(SHEAR * Math.PI / 180)) + 14;  // ≈ 30
const STRIP = 40, VPAD = 10, ROWGAP = 8;
const ICON = BAND - VPAD * 2 - STRIP - ROWGAP;      // 124

/* ── Colour ──────────────────────────────────────────────────────────── */

const GOLD = "#ffd180", CORAL = "#ff9e80";

const TYPE = {
  normal: "#a8a878", fire: "#ee7b34", water: "#4a90dd", electric: "#f6c945",
  grass: "#6fc25a", ice: "#7fd4d4", fighting: "#c03028", poison: "#ab5aa8",
  ground: "#d8b45c", flying: "#9bb4f0", psychic: "#f5548c", bug: "#99c022",
  rock: "#b8a038", ghost: "#7a6aae", dragon: "#6f52e8", dark: "#6b5a4e",
  steel: "#a9b8c6", fairy: "#f094c6",
};
const typesOf = s => MAP.entities[s]?.types || [];
function pairOf(p) {
  const c = new Map();
  for (const s of p.team) for (const t of typesOf(s)) c.set(t, (c.get(t) || 0) + 1);
  const top = [...c.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
  return [TYPE[top[0]] || "#a8a878", TYPE[top[1]] || TYPE[top[0]] || "#a8a878"];
}

/* ── Content ─────────────────────────────────────────────────────────── */

const esc = s => String(s).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ORD = n => ["th", "st", "nd", "rd"][n] || "th";

const team = p => {
  const slots = [...p.team];
  while (slots.length < 6) slots.push(null);
  return `<div class="team">` + slots.map(s =>
    s ? `<i class="pk s-${s}"></i>` : `<i class="pk pk--empty"></i>`).join("") + `</div>`;
};

/* place + name on the left, record + CP on the right. `tab` wraps each group
   in its own dark plate; `tabfull` runs one plate the width of the strip. */
function strip(p, i, mode) {
  const left = `<span class="pl">${i + 1}<sup>${ORD(i + 1)}</sup></span>` +
    `<span class="nm">${esc(p.name)}</span>`;
  const right = `<span class="rec">${esc(p.record)}</span>` +
    (DATA.showCp === false ? "" : `<span class="cp">${p.cp} CP</span>`);

  if (mode === "tab") {
    return `<div class="strip strip--tab">
      <span class="tab tab--l">${left}</span>
      <span class="tab tab--r">${right}</span></div>`;
  }
  if (mode === "tabfull") {
    return `<div class="strip strip--tabfull"><span class="tab tab--wide">
      ${left}<span class="spacer"></span>${right}</span></div>`;
  }
  return `<div class="strip">${left}<span class="spacer"></span>${right}</div>`;
}

function blocks(v) {
  return TOP4.map((p, i) => {
    const top = i * (BAND + GAP);
    const [ta, tb] = pairOf(p);
    const vars = [`--slice-y:${-top}px`, `--ta:${ta}`, `--tb:${tb}`].join(";");
    return `<section class="blk${i === 0 ? " blk--champ" : ""}" style="${vars}">
      <div class="inner">${strip(p, i, v.text)}${team(p)}</div>
    </section>`;
  }).join("");
}

const card = v => `<header class="head">
  <div class="head__row"><h1 class="title">${esc(DATA.event)}</h1>
  <span class="cut">Top 4</span></div>
  <p class="sub">${[DATA.location, DATA.date, `${DATA.players} ${DATA.division}`, DATA.format]
    .map(esc).join(" &nbsp;·&nbsp; ")}</p>
</header><main class="stack">${blocks(v)}</main>
<footer class="foot"><span class="mark">Georgia<span>Play</span>Events</span>
  <p class="disclaim">Fan-made content. Not affiliated with or endorsed by Nintendo,
  Creatures Inc., GAME FREAK, or The Pok&eacute;mon Company.</p></footer>`;

/* ── Variants ────────────────────────────────────────────────────────── */

const V = [
  { id: "brand-ink", grad: "brand", text: "ink", title: "Brand slice · dark ink",
    note: "Gold→coral sliced across the stack, dark ink straight on it. Dropping burnt orange means every slice stays light, so the ink never has to flip — the transition you disliked simply cannot occur." },
  { id: "brand-tab", grad: "brand", text: "tab", title: "Brand slice · tabs",
    note: "Light text on black plates that hug each group. Legibility stops depending on what colour the band happens to be at that point." },
  { id: "brand-tabfull", grad: "brand", text: "tabfull", title: "Brand slice · full bar",
    note: "One black bar across the whole strip. Strongest structure, but the gradient is reduced to a frame around the icons rather than a fill." },
  { id: "brand-outline", grad: "brand", text: "outline", title: "Brand slice · outlined",
    note: "Light text with a dark outline, no plate. Holds on any background and keeps the gradient uninterrupted; the outline thickens the letterforms at small sizes." },
  { id: "brand-diag", grad: "diag", text: "tab", title: "Diagonal slice · tabs",
    note: "The same slice run at the site's 45° headline angle instead of straight down. Closer to the marketing page's actual treatment." },
  { id: "type-ink", grad: "type", text: "ink", title: "Team typing · dark ink",
    note: "Per-team gradients with dark ink — shown because it FAILS. Team 4's ghost/dark gradient is too dark to carry #1a1a1a, which is the argument for a plate or an outline." },
  { id: "type-tab", grad: "type", text: "tab", title: "Team typing · tabs",
    note: "The pairing that actually works: typing carries the colour, the plate guarantees the text regardless of which types a team ran." },
  { id: "type-outline", grad: "type", text: "outline", title: "Team typing · outlined",
    note: "Same protection without the plate, so more of the type colour survives. Compare against the tab for which reads cleaner at size." },
];

/* ── Page ────────────────────────────────────────────────────────────── */

const css = fs.readFileSync(path.join(ROOT, "src/sliced.css"), "utf8");

const cards = V.map((v, i) => `<figure class="demo">
  <figcaption>
    <span class="demo__n">${String(i + 1).padStart(2, "0")}</span>
    <span class="demo__title">${esc(v.title)}</span>
    <span class="demo__g demo__g--${v.grad}">${v.grad === "type" ? "team typing" : v.grad === "diag" ? "brand 45°" : "brand slice"}</span>
    <span class="demo__t">${v.text === "tabfull" ? "full bar" : v.text}</span>
    <span class="demo__note">${esc(v.note)}</span>
  </figcaption>
  <div class="frame"><div class="card G-${v.grad} T-${v.text}">${card(v)}</div></div>
</figure>`).join("\n");

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Medal bands — sliced gradient</title>
<style>
:root{
  --gold:${GOLD}; --coral:${CORAL};
  --band:${BAND}px; --gap:${GAP}px; --stack-h:${STACK_H}px; --stack-w:${STACK_W}px;
  --inset:${INSET}px; --slope:${SLOPE}px; --strip:${STRIP}px; --vpad:${VPAD}px;
  --rowgap:${ROWGAP}px; --icon:${ICON}px; --shear:${SHEAR}deg;
  --head:${HEAD}px; --foot:${FOOT}px; --pad:${PAD}px;
}
${faces.join("\n")}
${spriteCss}
.pk--empty{--mask:${pikaMask}}
${css}
</style></head><body>
<header class="page">
  <h1>Medal bands &mdash; sliced gradient</h1>
  <p>One gold&rarr;coral gradient spanning the whole stack; each band is a window onto its slice, so
  rank falls out of position. <b>Shear kept, stairstepping removed</b> &mdash; every band is the
  same width, so the six icons sit on an identical rhythm on all four rows, and the icon row is held
  inside an upright rectangle clear of the sloped edges. Burnt orange is gone: the root is gold and
  coral, and burnt was the only step dark enough to force the ink flip.
  Record and CP are inline on reserved widths &mdash; <b>12-1</b> and <b>8-5</b>, <b>128 CP</b> and
  <b>8 CP</b> all align down the column. Icons ${ICON}px.</p>
</header>
<div class="grid">${cards}</div>
</body></html>`;

fs.mkdirSync(path.join(ROOT, "out"), { recursive: true });
const outPath = path.join(ROOT, "out/layouts-sliced.html");
fs.writeFileSync(outPath, html);
console.log(`${V.length} variants -> ${outPath}  (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
console.log(`band ${BAND}px  stack ${STACK_H}px  strip ${STRIP}px  icon ${ICON}px  slope inset ${SLOPE}px`);
