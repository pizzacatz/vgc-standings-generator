/* Variants of "brand slice · full bar" (03 from layouts-sliced.html).
 *
 *   node src/bars.mjs      # → out/layouts-bars.html
 *
 * Settled:
 *   · greater range within the ramp — the black bar decouples text from the
 *     band, so the gradient is free to travel much further than before
 *   · per-band team typing (not sliced typing)
 *   · an experiment: hard-stop brand tone → team's primary type → secondary
 *   · every bar treatment shown side by side
 *
 * Header spacing rebuilt: it was a fixed 136px block holding ~74px of content,
 * leaving 62px of dead air above a stack whose own rhythm is 10px. The header
 * is now measured from its actual type and closed to a gap that MATCHES THE
 * BAND RHYTHM VISUALLY (~6px measured, since text carries leading below its
 * baseline and a literal 10 reads as more). The footer gap matches.
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

/* ── Ramp ────────────────────────────────────────────────────────────
 * Wider than the root two-stop: it still passes through brand coral at the
 * midpoint, but opens up at both ends. Safe now only because the bar carries
 * the text — nothing here has to stay light enough for dark ink. */

const RAMP = [
  { p: 0.0, c: "#ffd7a0" },   // opened up above gold
  { p: 0.5, c: "#ff9e80" },   // brand coral, held as the midpoint
  { p: 1.0, c: "#cf3f22" },   // deep coral-red
];

const hx = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const toHex = a => "#" + a.map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
function sample(t) {
  t = Math.min(1, Math.max(0, t));
  for (let i = 1; i < RAMP.length; i++) {
    if (t <= RAMP[i].p) {
      const a = RAMP[i - 1], b = RAMP[i];
      const k = (t - a.p) / (b.p - a.p);
      return toHex(hx(a.c).map((v, j) => v + (hx(b.c)[j] - v) * k));
    }
  }
  return RAMP[RAMP.length - 1].c;
}
const RAMP_CSS = RAMP.map(s => `${s.c} ${(s.p * 100).toFixed(0)}%`).join(",");
/* Hard stops sampled at each band's centre, so the flat tones sit where the
   smooth slice would have put them. */
const TONE = [0, 1, 2, 3].map(i => sample((i + 0.5) / 4));

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

/* ── Geometry ────────────────────────────────────────────────────────
 * Header height is DERIVED from its type sizes rather than hardcoded, so
 * changing the subtitle reflows the bands instead of leaving a hole. */

const CARD = 1080, PAD = 44, GAP = 10, INSET = 16;
const TITLE_FS = 46, SUB_FS = 28;
const TITLE_H = Math.round(TITLE_FS * 1.05);
const SUB_H = Math.round(SUB_FS * 1.3);
const TITLE_SUB_GAP = 12;
/* ~6px measured reads as ~10px of visual gap, because the subtitle's line box
   already carries leading beneath its baseline. */
const EDGE_GAP = 6;
const HEAD = TITLE_H + TITLE_SUB_GAP + SUB_H + EDGE_GAP;
const FOOT_GAP = EDGE_GAP, FOOT = 50;

const BODY = CARD - PAD * 2 - HEAD - FOOT - FOOT_GAP;
const BAND = Math.floor((BODY - GAP * 3) / 4);
const STACK_H = BAND * 4 + GAP * 3;
const STACK_W = CARD - PAD * 2 - INSET * 2;

const SHEAR = 9;
const SLOPE = Math.ceil((BAND / 2) * Math.tan(SHEAR * Math.PI / 180)) + 14;
const VPAD = 10, ROWGAP = 8;

/* Per-variant, because a taller bar costs icon height 1:1. */
const geom = (strip, recFs, cpFs) => ({
  strip, recFs, cpFs,
  icon: BAND - VPAD * 2 - strip - ROWGAP,
  recMin: Math.round(recFs * 3.3),   // holds "12-10" in tabular Inter 800
  cpMin: Math.round(cpFs * 4.5),     // holds "999 CP"
});
const BASE = geom(40, 34, 23);
const TALL = geom(52, 42, 26);

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

/* .tabin exists so the bleed variant can re-shear the bar to the band's angle
   and still hold its content upright. */
const bar = (p, i) => `<div class="strip"><span class="tab"><span class="tabin">
  <span class="pl">${i + 1}<sup>${ORD(i + 1)}</sup></span>
  <span class="nm">${esc(p.name)}</span><span class="spacer"></span>
  <span class="rec">${esc(p.record)}</span>
  ${DATA.showCp === false ? "" : `<span class="cp">${p.cp} CP</span>`}
</span></span></div>`;

function blocks() {
  return TOP4.map((p, i) => {
    const [ta, tb] = pairOf(p);
    const vars = [
      `--slice-y:${-(i * (BAND + GAP))}px`,
      `--tone:${TONE[i]}`, `--ta:${ta}`, `--tb:${tb}`,
    ].join(";");
    return `<section class="blk${i === 0 ? " blk--champ" : ""}" style="${vars}">
      <div class="inner">${bar(p, i)}${team(p)}</div></section>`;
  }).join("");
}

const card = () => `<header class="head">
  <div class="head__row"><h1 class="title">${esc(DATA.event)}</h1>
  <span class="cut">Top 4</span></div>
  <p class="sub">${[DATA.location, DATA.date, `${DATA.players} ${DATA.division}`, DATA.format]
    .map(esc).join(" &nbsp;·&nbsp; ")}</p>
</header><main class="stack">${blocks()}</main>
<footer class="foot"><span class="mark">Georgia<span>Play</span>Events</span>
  <p class="disclaim">Fan-made content. Not affiliated with or endorsed by Nintendo,
  Creatures Inc., GAME FREAK, or The Pok&eacute;mon Company.</p></footer>`;

/* ── Variants ────────────────────────────────────────────────────────── */

const V = [
  /* — gradient range, bar held constant — */
  { id: "slice", grad: "slice", bar: "base", g: BASE, group: "gradient",
    title: "Wide slice", tag: "brand",
    note: "The root ramp opened up at both ends — lighter above gold, down to a deep coral-red — still passing through brand coral at the midpoint. Far more travel top to bottom than the original two-stop." },
  { id: "hard", grad: "hard", bar: "base", g: BASE, group: "gradient",
    title: "Hard-stop banding", tag: "brand",
    note: "The same ramp sampled at each band's centre and laid down flat. Adjacent placements now separate hard instead of blending, which is the biggest gain in ranking legibility here." },
  { id: "type", grad: "type", bar: "base", g: BASE, group: "gradient",
    title: "Per-band typing", tag: "typing",
    note: "Each band runs its own team's two commonest types. Colour is per-player and carries real information, at the cost of the four bands no longer reading as one object." },
  { id: "brandtype", grad: "brandtype", bar: "base", g: BASE, group: "gradient",
    title: "Brand → type 1 → type 2", tag: "hybrid",
    note: "The experiment: each band STARTS at its hard-stop brand tone, then runs into the team's primary type and out to its secondary. Brand identity anchors the left edge where the bar sits; team identity fills the rest." },

  /* — bar treatment, gradient held constant — */
  { id: "bar-base", grad: "slice", bar: "base", g: BASE, group: "bar",
    title: "Bar · inset solid", tag: "reference",
    note: "The reference: solid #101010, inset clear of the sheared edges, 40px tall, softly rounded." },
  { id: "bar-bleed", grad: "slice", bar: "bleed", g: BASE, group: "bar",
    title: "Bar · bleed to edges", tag: "bar",
    note: "Re-sheared to the band's own angle and run edge to edge, so it reads as a broadcast lower-third rather than a label floating on a panel." },
  { id: "bar-cap", grad: "slice", bar: "cap", g: BASE, group: "bar",
    title: "Bar · accent cap", tag: "bar",
    note: "A peach block caps the leading edge — reintroduces the interaction accent the palette otherwise loses, and gives the eye a start point on each row." },
  { id: "bar-ghost", grad: "slice", bar: "ghost", g: BASE, group: "bar",
    title: "Bar · semi-transparent", tag: "bar",
    note: "72% black, so the gradient ghosts through the bar and the band stays continuous behind it. Softest option; also the weakest contrast guarantee." },
  { id: "bar-tall", grad: "slice", bar: "tall", g: TALL, group: "bar",
    title: "Bar · taller", tag: "bar",
    note: `52px instead of 40, letting the record grow to 42px. Costs exactly what it takes: icons drop ${BASE.icon}px → ${TALL.icon}px.` },
];

/* ── Page ────────────────────────────────────────────────────────────── */

const css = fs.readFileSync(path.join(ROOT, "src/bars.css"), "utf8");

const group = (name, label, blurb) => {
  const items = V.filter(v => v.group === name);
  const cards = items.map((v, i) => `<figure class="demo">
    <figcaption>
      <span class="demo__n">${String(V.indexOf(v) + 1).padStart(2, "0")}</span>
      <span class="demo__title">${esc(v.title)}</span>
      <span class="demo__tag demo__tag--${v.tag}">${v.tag}</span>
      <span class="demo__icon">${v.g.icon}px</span>
      <span class="demo__note">${esc(v.note)}</span>
    </figcaption>
    <div class="frame"><div class="card X-${v.grad} B-${v.bar}"
      style="--strip:${v.g.strip}px;--icon:${v.g.icon}px;--rec-fs:${v.g.recFs}px;--cp-fs:${v.g.cpFs}px;--rec-min:${v.g.recMin}px;--cp-min:${v.g.cpMin}px">${card()}</div></div>
  </figure>`).join("\n");
  return `<section class="sect"><h2>${label}<span class="sect__blurb">${blurb}</span></h2>
    <div class="grid">${cards}</div></section>`;
};

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Full-bar variants</title>
<style>
:root{
  --ramp:${RAMP_CSS};
  --band:${BAND}px; --gap:${GAP}px; --stack-h:${STACK_H}px; --stack-w:${STACK_W}px;
  --inset:${INSET}px; --slope:${SLOPE}px; --vpad:${VPAD}px; --rowgap:${ROWGAP}px;
  --shear:${SHEAR}deg; --head:${HEAD}px; --foot:${FOOT}px; --foot-gap:${FOOT_GAP}px;
  --pad:${PAD}px; --title-fs:${TITLE_FS}px; --sub-fs:${SUB_FS}px;
  --title-gap:${TITLE_SUB_GAP}px;
}
${faces.join("\n")}
${spriteCss}
.pk--empty{--mask:${pikaMask}}
${css}
</style></head><body>
<header class="page">
  <h1>Full-bar variants</h1>
  <p>Nine takes on <b>03</b>. The first four vary the gradient with the bar held constant; the last
  five vary the bar with the gradient held constant, so each dimension can be judged on its own.
  <b>Header rebuilt:</b> it was a fixed 136px block holding ~74px of type, leaving 62px of dead air
  above a stack whose rhythm is 10px. It is now measured from its own type — subtitle
  <b>17&nbsp;&rarr;&nbsp;${SUB_FS}px</b>, title <b>40&nbsp;&rarr;&nbsp;${TITLE_FS}px</b> — and closed
  to a gap matching the band rhythm, top and bottom. That alone returned band height
  192&nbsp;&rarr;&nbsp;${BAND}px and icons 124&nbsp;&rarr;&nbsp;<b>${BASE.icon}px</b>.</p>
</header>
${group("gradient", "Gradient range", "Bar held at the inset-solid reference.")}
${group("bar", "Bar treatment", "Gradient held at the wide brand slice.")}
</body></html>`;

fs.mkdirSync(path.join(ROOT, "out"), { recursive: true });
const outPath = path.join(ROOT, "out/layouts-bars.html");
fs.writeFileSync(outPath, html);
console.log(`${V.length} variants -> ${outPath}  (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
console.log(`head ${HEAD}px (was 136)  band ${BAND}px (was 192)  icon ${BASE.icon}px (was 124), tall-bar ${TALL.icon}px`);
console.log(`hard stops: ${TONE.join("  ")}`);
