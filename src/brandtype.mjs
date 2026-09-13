/* Brand-tone → team-type bands, footerless.
 *
 *   node src/brandtype.mjs      # → out/layouts-brandtype.html
 *
 * Each band starts at its hard-stop brand tone and runs into that team's
 * dominant type — a two-stop version of the earlier brand→type1→type2 hybrid.
 * The brand anchors the leading edge, where the bar and placement sit; the
 * team's colour fills the rest.
 *
 * Footer removed entirely, and the height it held redistributed into the
 * bands and the bar. See the note in the page header about what that drops.
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

/* ── Colour ──────────────────────────────────────────────────────────── */

const RAMP = [
  { p: 0.0, c: "#ffd7a0" },
  { p: 0.5, c: "#ff9e80" },
  { p: 1.0, c: "#cf3f22" },
];
const hx = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const toHex = a => "#" + a.map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
function sample(t) {
  for (let i = 1; i < RAMP.length; i++) {
    if (t <= RAMP[i].p) {
      const a = RAMP[i - 1], b = RAMP[i], k = (t - a.p) / (b.p - a.p);
      return toHex(hx(a.c).map((v, j) => v + (hx(b.c)[j] - v) * k));
    }
  }
  return RAMP[RAMP.length - 1].c;
}
const TONE = [0, 1, 2, 3].map(i => sample((i + 0.5) / 4));

const TYPE = {
  normal: "#a8a878", fire: "#ee7b34", water: "#4a90dd", electric: "#f6c945",
  grass: "#6fc25a", ice: "#7fd4d4", fighting: "#c03028", poison: "#ab5aa8",
  ground: "#d8b45c", flying: "#9bb4f0", psychic: "#f5548c", bug: "#99c022",
  rock: "#b8a038", ghost: "#7a6aae", dragon: "#6f52e8", dark: "#6b5a4e",
  steel: "#a9b8c6", fairy: "#f094c6",
};
const typesOf = s => MAP.entities[s]?.types || [];

/* The team's DOMINANT type — most common across both slots, not the most
   common slot-1 typing. Slot-1 would call teams 2 and 3 both "water" and give
   them near-identical bands; counting every slot separates them (steel vs
   water) and is the better read of "this team's type" anyway. */
function dominant(p) {
  const c = new Map();
  for (const s of p.team) for (const t of typesOf(s)) c.set(t, (c.get(t) || 0) + 1);
  const [top] = [...c.entries()].sort((a, b) => b[1] - a[1]);
  return { slug: top ? top[0] : "normal", hex: TYPE[top ? top[0] : "normal"] };
}

/* ── Geometry ────────────────────────────────────────────────────────── */

const CARD = 1080, PAD = 44, GAP = 10, INSET = 16, ICON_GAP = 10;
const TITLE_FS = 46, SUB_FS = 28, TITLE_SUB_GAP = 12, EDGE_GAP = 6;
const HEAD = Math.round(TITLE_FS * 1.05) + TITLE_SUB_GAP + Math.round(SUB_FS * 1.3) + EDGE_GAP;

/* No footer: the whole body below the header is the stack. */
const BODY = CARD - PAD * 2 - HEAD;
const BAND = Math.floor((BODY - GAP * 3) / 4);
const STACK_H = BAND * 4 + GAP * 3;
const STACK_W = CARD - PAD * 2 - INSET * 2;

const SHEAR = 9;
const SLOPE = Math.ceil((BAND / 2) * Math.tan(SHEAR * Math.PI / 180)) + 14;
const VPAD = 10, ROWGAP = 8;
const INNER_W = STACK_W - SLOPE * 2;

function geom(strip, recFs, cpFs, plFs, nmFs) {
  const byHeight = BAND - VPAD * 2 - strip - ROWGAP;
  const byWidth = Math.floor((INNER_W - ICON_GAP * 5) / 6);
  return {
    strip, recFs, cpFs, plFs, nmFs,
    icon: Math.min(byHeight, byWidth),
    recMin: Math.round(recFs * 3.3),   // holds "12-10"
    cpMin: Math.round(cpFs * 4.5),     // holds "999 CP"
  };
}
const BASE = geom(46, 38, 25, 32, 26);
const TALL = geom(60, 48, 28, 38, 30);

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

const bar = (p, i) => `<div class="strip"><span class="tab"><span class="tabin">
  <span class="pl">${i + 1}<sup>${ORD(i + 1)}</sup></span>
  <span class="nm">${esc(p.name)}</span><span class="spacer"></span>
  <span class="rec">${esc(p.record)}</span>
  ${DATA.showCp === false ? "" : `<span class="cp">${p.cp} CP</span>`}
</span></span></div>`;

function blocks() {
  return TOP4.map((p, i) => {
    const d = dominant(p);
    const vars = [`--tone:${TONE[i]}`, `--type:${d.hex}`].join(";");
    return `<section class="blk${i === 0 ? " blk--champ" : ""}" style="${vars}">
      <div class="inner">${bar(p, i)}${team(p)}</div></section>`;
  }).join("");
}

const card = () => `<header class="head">
  <div class="head__row"><h1 class="title">${esc(DATA.event)}</h1>
  <span class="cut">Top 4</span></div>
  <p class="sub">${[DATA.location, DATA.date, `${DATA.players} ${DATA.division}`, DATA.format]
    .map(esc).join(" &nbsp;·&nbsp; ")}</p>
</header><main class="stack">${blocks()}</main>`;

/* ── Variants ────────────────────────────────────────────────────────── */

const V = [
  /* Control — not requested, included because the other three are all
     departures from it and there is no solid/standard bar on this gradient
     anywhere else to compare them against. */
  { id: "solid", bar: "solid", g: BASE, tag: "control", title: "Solid bar",
    note: "The reference point: solid #101010 at the standard height. Everything below is a departure from this, so it is here to make the comparison possible." },
  { id: "ghost", bar: "ghost", g: BASE, tag: "requested", title: "Semi-transparent bar",
    note: "72% black, so the brand→type gradient runs continuously behind the bar instead of being interrupted by it." },
  { id: "tall", bar: "solid", g: TALL, tag: "requested", title: "Taller bar",
    note: `60px rather than 46, with the record at 48px and the name at 30px. Icons ${BASE.icon}px → ${TALL.icon}px.` },
  { id: "tallghost", bar: "ghost", g: TALL, tag: "requested", title: "Taller, semi-transparent",
    note: "Both at once — the largest stat type in the set, with the gradient still reading through. The most exposed to the transparency's weaker contrast." },
];

/* ── Page ────────────────────────────────────────────────────────────── */

const css = fs.readFileSync(path.join(ROOT, "src/brandtype.css"), "utf8");

const cards = V.map((v, i) => `<figure class="demo">
  <figcaption>
    <span class="demo__n">${String(i + 1).padStart(2, "0")}</span>
    <span class="demo__title">${esc(v.title)}</span>
    <span class="demo__tag demo__tag--${v.tag}">${v.tag}</span>
    <span class="demo__icon">${v.g.icon}px icons &middot; ${v.g.strip}px bar</span>
    <span class="demo__note">${esc(v.note)}</span>
  </figcaption>
  <div class="frame"><div class="card K-${v.bar}"
    style="--strip:${v.g.strip}px;--icon:${v.g.icon}px;--rec-fs:${v.g.recFs}px;--cp-fs:${v.g.cpFs}px;--pl-fs:${v.g.plFs}px;--nm-fs:${v.g.nmFs}px;--rec-min:${v.g.recMin}px;--cp-min:${v.g.cpMin}px">${card()}</div></div>
</figure>`).join("\n");

const sig = TOP4.map((p, i) => `${i + 1}&nbsp;${dominant(p).slug}`).join(" &middot; ");

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Brand tone &rarr; team type, footerless</title>
<style>
:root{
  --band:${BAND}px; --gap:${GAP}px; --stack-h:${STACK_H}px; --stack-w:${STACK_W}px;
  --inset:${INSET}px; --slope:${SLOPE}px; --vpad:${VPAD}px; --rowgap:${ROWGAP}px;
  --icon-gap:${ICON_GAP}px; --shear:${SHEAR}deg; --head:${HEAD}px; --pad:${PAD}px;
  --title-fs:${TITLE_FS}px; --sub-fs:${SUB_FS}px; --title-gap:${TITLE_SUB_GAP}px;
}
${faces.join("\n")}
${spriteCss}
.pk--empty{--mask:${pikaMask}}
${css}
</style></head><body>
<header class="page">
  <h1>Brand tone &rarr; team type &mdash; footerless</h1>
  <p>Each band opens at its hard-stop brand tone (<code>${TONE.join("</code> <code>")}</code>) and
  runs into that team's dominant type (${sig}). <b>Footer removed</b> and the 56px it held pushed
  back into the bands and the bar: band 201&nbsp;&rarr;&nbsp;<b>${BAND}px</b>, icons
  133&nbsp;&rarr;&nbsp;<b>${BASE.icon}px</b>, bar 40&nbsp;&rarr;&nbsp;46px, record
  34&nbsp;&rarr;&nbsp;38px.</p>
  <p class="warn">Dropping the footer also drops the <b>fan-content disclaimer</b> and the
  <b>GeorgiaPlayEvents wordmark</b>. BRACKET-GRAPHIC-GUIDE §4 asks for both on anything published,
  on the grounds that this graphic travels further than the map does. Flagging rather than
  overriding &mdash; say the word and I can fold a single small line back in without giving up the
  height.</p>
</header>
<div class="grid">${cards}</div>
</body></html>`;

fs.mkdirSync(path.join(ROOT, "out"), { recursive: true });
const outPath = path.join(ROOT, "out/layouts-brandtype.html");
fs.writeFileSync(outPath, html);
console.log(`${V.length} variants -> ${outPath}  (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
console.log(`head ${HEAD}px  band ${BAND}px (was 201)  icon base ${BASE.icon}px (was 133)  tall ${TALL.icon}px`);
console.log(`tones ${TONE.join(" ")}`);
console.log(`dominant types: ${TOP4.map((p, i) => `${i + 1}=${dominant(p).slug}`).join("  ")}`);
