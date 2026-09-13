/* Four finalist layouts × six palettes each.
 *
 *   node src/finalists.mjs      # → out/layouts-finalists.html
 *
 * Layouts carried over verbatim from out/layouts-color.html:
 *   01 sh-medal      sheared bands, solid placement fill
 *   05 sh-reverse    reverse shear, alternating solid/outline
 *   09 sl-medal      clipped slot plates, outlined numeral
 *   10 sl-typegrad   slot plates filled by team typing
 *
 * Per layout: the original, then three palettes drawn ONLY from the
 * GeorgiaPlayEvents warm root (COLOR-SCHEME.md §8.3) and two that leave it
 * deliberately. Layout CSS is reused unchanged from colorvariants.css — only
 * the injected colour variables differ, which is the point of driving them
 * through custom properties in the first place.
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

/* ── Colour helpers ──────────────────────────────────────────────────── */

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const lum = h => {
  const [r, g, b] = hex(h).map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
/* Pick whichever brand ink clears more contrast on a given fill, so no
   palette can quietly ship unreadable text. */
const inkOn = fill => ratio("#1a1a1a", fill) >= ratio("#f8efe5", fill) ? "#1a1a1a" : "#f8efe5";
const mix = (a, b, t) => "#" + hex(a).map((v, i) =>
  Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, "0")).join("");

/* A fill can double as ink on the dark plate only if it clears 4.5:1 there.
   Lift it toward white until it does — otherwise the bottom of a value ramp
   disappears against the surface it is drawn on. */
function liftOnDark(fill, bg = "#1e1e1e") {
  let c = fill;
  for (let t = 0; t <= 0.9 && ratio(c, bg) < 4.5; t += 0.05) c = mix(fill, "#ffffff", t);
  return c;
}

const TYPE = {
  normal: "#a8a878", fire: "#ee7b34", water: "#4a90dd", electric: "#f6c945",
  grass: "#6fc25a", ice: "#7fd4d4", fighting: "#c03028", poison: "#ab5aa8",
  ground: "#d8b45c", flying: "#9bb4f0", psychic: "#f5548c", bug: "#99c022",
  rock: "#b8a038", ghost: "#7a6aae", dragon: "#6f52e8", dark: "#6b5a4e",
  steel: "#a9b8c6", fairy: "#f094c6",
};
const typesOf = s => MAP.entities[s]?.types || [];
function signature(p) {
  const c = new Map();
  for (const s of p.team) { const t = typesOf(s)[0]; if (t) c.set(t, (c.get(t) || 0) + 1); }
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "normal";
}
function pairOf(p) {
  const c = new Map();
  for (const s of p.team) for (const t of typesOf(s)) c.set(t, (c.get(t) || 0) + 1);
  const top = [...c.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
  return [top[0] || "normal", top[1] || top[0] || "normal"];
}

/* ── Palettes ────────────────────────────────────────────────────────── */

const PALETTES = {
  /* The original from layouts-color.html — silver and slate are cool, so
     this already sits outside the warm root. */
  medal: { scope: "original", label: "Medal",
    note: "Gold / silver / bronze / slate by placement.",
    fills: ["#ffcf4d", "#d5dde8", "#e08b4a", "#8fa3b8"] },

  /* ── warm root only (COLOR-SCHEME.md §8.3 primitives) ── */
  warmramp: { scope: "warm", label: "Warm ramp",
    note: "The brand gradient walked down as four steps: gold, peach, coral, burnt orange. Nothing here is outside tokens.css.",
    fills: ["#ffd180", "#ffb072", "#ff9e80", "#a85526"] },

  warmdepth: { scope: "warm", label: "Warm depth",
    note: "One hue, four values. Rank reads by lightness rather than colour, so it still separates in greyscale.",
    fills: ["#ffd180", "#c98f4e", "#6b4a2e", "#33241a"] },

  warmlight: { scope: "warm", label: "Warm light", light: true,
    note: "The family's LIGHT palette — cream page, warm fills, dark ink. Same tokens, opposite surface. Breaks dark-only, not warm-only.",
    fills: ["#ffd180", "#ffb072", "#ff9e80", "#a85526"] },

  /* ── outside the brand root ── */
  cool: { scope: "outside", label: "Cool neon",
    note: "Cyan, magenta, lime, violet — the direct opposite of the warm-only rule, and the most 'esports' of the six.",
    fills: ["#22e0d6", "#ff4fa3", "#b6ff3d", "#8b7dff"] },

  type: { scope: "outside", label: "Team typing",
    note: "Each band takes its team's signature type colour from the Champions database. Whatever hue that lands on, it is telling you something true.",
    byType: true },

  mono: { scope: "outside", label: "Monochrome",
    note: "Pure greyscale, maximum luminance separation. No hue at all — the extreme end of contrast-over-colour.",
    fills: ["#ffffff", "#b4b4b4", "#6e6e6e", "#3a3a3a"] },
};

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

function blocks(pal) {
  return TOP4.map((p, i) => {
    const fill = pal.byType ? TYPE[signature(p)] : pal.fills[i];
    const ink = inkOn(fill);
    const [a, b] = pairOf(p);
    /* --ta/--tb drive the gradient layout (10); for non-type palettes the
       gradient runs from the fill into a darkened sibling so the layout keeps
       working whatever palette is applied. */
    const ta = pal.byType ? TYPE[a] : fill;
    const tb = pal.byType ? TYPE[b] : mix(fill, "#0d0d0d", 0.42);
    const vars = [
      `--med:${fill}`, `--med-ink:${ink}`, `--sig:${fill}`,
      `--ta:${ta}`, `--tb:${tb}`, `--tb-ink:${inkOn(tb)}`, `--neon:${fill}`,
      `--med-lift:${liftOnDark(fill)}`,
    ].join(";");
    return `<section class="blk ${i === 0 ? "blk--champ" : ""}" style="${vars}">
      <div class="lab"><span class="pl">${i + 1}<sup>${ORD(i + 1)}</sup></span>
      <span class="nm">${esc(p.name)}</span><span class="rule"></span>
      <span class="rc">${esc(p.record)}</span></div>${team(p)}
    </section>`;
  }).join("");
}

const card = pal => `<header class="head">
  <div class="head__row"><h1 class="title">${esc(DATA.event)}</h1>
  <span class="cut">Top 4</span></div>
  <p class="sub">${[DATA.location, DATA.date, `${DATA.players} ${DATA.division}`, DATA.format]
    .map(esc).join(" &nbsp;·&nbsp; ")}</p>
</header><main class="stack">${blocks(pal)}</main>
<footer class="foot"><span class="mark">Georgia<span>Play</span>Events</span>
  <p class="disclaim">Fan-made content. Not affiliated with or endorsed by Nintendo,
  Creatures Inc., GAME FREAK, or The Pok&eacute;mon Company.</p></footer>`;

/* ── Layouts × palettes ──────────────────────────────────────────────── */

const LAYOUTS = [
  { n: "01", cls: "C-sh-medal", icon: 144, title: "Medal bands",
    blurb: "Sheared bands, solid placement fill, dark content over it.",
    order: ["medal", "warmramp", "warmdepth", "warmlight", "cool", "type"] },
  { n: "05", cls: "C-sh-reverse", icon: 144, title: "Reverse shear",
    blurb: "Skewed the other way, stepped from the right, alternating solid and outlined.",
    order: ["medal", "warmramp", "warmdepth", "warmlight", "cool", "type"] },
  { n: "09", cls: "C-sl-medal", icon: 136, title: "Medal slots",
    blurb: "Clipped slot plates with an outlined numeral and a coloured border.",
    order: ["medal", "warmramp", "warmdepth", "warmlight", "cool", "type"] },
  /* This one's original already IS the type palette, so monochrome takes the
     second outside slot rather than repeating it. */
  { n: "10", cls: "C-sl-typegrad", icon: 136, title: "Type gradient slots",
    blurb: "Slot plates filled with a gradient between the team's two commonest types.",
    order: ["type", "warmramp", "warmdepth", "warmlight", "cool", "mono"] },
];

const css = fs.readFileSync(path.join(ROOT, "src/colorvariants.css"), "utf8");
const extra = fs.readFileSync(path.join(ROOT, "src/finalists.css"), "utf8");

const sections = LAYOUTS.map(L => {
  const cards = L.order.map((pk, idx) => {
    const pal = PALETTES[pk];
    const scope = idx === 0 ? "original" : pal.scope;
    return `<figure class="demo">
      <figcaption>
        <span class="demo__title">${esc(pal.label)}</span>
        <span class="demo__scope demo__scope--${scope}">${scope === "warm" ? "warm root" : scope}</span>
        <span class="demo__note">${esc(pal.note)}</span>
      </figcaption>
      <div class="frame"><div class="card ${L.cls} P-${pk}${pal.light ? " is-light" : ""}"
        style="--icon:${L.icon}px">${card(pal)}</div></div>
    </figure>`;
  }).join("\n");
  return `<section class="sect">
    <h2><span class="sect__n">${L.n}</span> ${esc(L.title)}
      <span class="sect__blurb">${esc(L.blurb)}</span></h2>
    <div class="grid">${cards}</div>
  </section>`;
}).join("\n");

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Top 4 — four layouts, six palettes each</title>
<style>
${faces.join("\n")}
${spriteCss}
.pk--empty{--mask:${pikaMask}}
${css}
${extra}
</style></head><body>
<header class="page">
  <h1>Four layouts &times; six palettes</h1>
  <p>Layouts <b>01</b>, <b>05</b>, <b>09</b> and <b>10</b> from the colour set, each shown as its
  original plus five repalettings: <b>three drawn only from the GeorgiaPlayEvents warm root</b>
  (gold <code>#ffd180</code>, peach <code>#ffb072</code>, coral <code>#ff9e80</code>, burnt
  <code>#a85526</code> and the cream light surfaces) and <b>two that leave it deliberately</b>.
  Text colour on every fill is chosen by measured contrast, not by eye.</p>
</header>
${sections}
</body></html>`;

fs.mkdirSync(path.join(ROOT, "out"), { recursive: true });
const outPath = path.join(ROOT, "out/layouts-finalists.html");
fs.writeFileSync(outPath, html);

const total = LAYOUTS.reduce((n, L) => n + L.order.length, 0);
console.log(`${LAYOUTS.length} layouts × 6 = ${total} cards -> ${outPath}  (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
for (const k of ["warmramp", "warmdepth", "warmlight", "cool", "mono"]) {
  const p = PALETTES[k];
  console.log(`  ${k.padEnd(10)} ${p.fills.map(f => `${f}/${inkOn(f)} ${ratio(f, inkOn(f)).toFixed(1)}:1`).join("  ")}`);
}
