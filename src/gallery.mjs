/* Layout exploration — 16 takes on a Top 4 standings card.
 *
 *   node src/gallery.mjs        # → out/layouts.html
 *
 * Emits ONE self-contained HTML file: sprites and fonts are inlined as data
 * URIs so it can be opened or sent anywhere. Every card is the same 1080×1080
 * canvas so the layouts are actually comparable; the gallery scales them down.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAP = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/sprite-map.json"), "utf8"));
const SPRITE_ROOT = process.env.CHAMPIONS_SPRITES || MAP.root;
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data/sample-top16.json"), "utf8"));
const TOP4 = DATA.standings.slice(0, 4);

/* ── Inlined assets ──────────────────────────────────────────────────── */

const b64 = f => fs.readFileSync(f).toString("base64");

const slugs = [...new Set(TOP4.flatMap(p => p.team))];
const spriteCss = slugs.map(s => {
  const e = MAP.entities[s];
  if (!e || !e.menu) throw new Error(`no menu sprite for "${s}"`);
  return `.s-${s}{background-image:url(data:image/png;base64,${b64(path.join(SPRITE_ROOT, e.menu))})}`;
}).join("\n");

const pikaMask = `url(data:image/png;base64,${b64(path.join(SPRITE_ROOT, MAP.entities.pikachu.silhouette))})`;

/* Latin subsets only — enough for the sample data, a fraction of the weight. */
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

/* ── Content helpers ─────────────────────────────────────────────────── */

const esc = s => String(s).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ORD = n => ["th", "st", "nd", "rd"][n] || "th";

const team = (p, cls = "") => {
  const slots = [...p.team];
  while (slots.length < 6) slots.push(null);
  return `<div class="team ${cls}">` + slots.map(s =>
    s ? `<i class="pk s-${s}"></i>` : `<i class="pk pk--empty"></i>`).join("") + `</div>`;
};
const place = n => `<div class="place"><b>${n}</b><sup>${ORD(n)}</sup></div>`;
const stats = (p, cp = true) => `<div class="stats"><span class="rec">${esc(p.record)}</span>` +
  (cp ? `<span class="cp">${p.cp} CP</span>` : "") + `</div>`;
const nameOf = p => `<h2 class="pname">${esc(p.name)}</h2>`;

const head = (cut = 4) => `<header class="head">
  <h1 class="title">${esc(DATA.event)}</h1>
  <p class="sub">${[DATA.location, DATA.date, `${DATA.players} ${DATA.division}`, DATA.format]
    .map(esc).join(" &nbsp;·&nbsp; ")}</p>
  <div class="cutbar"><span class="cutbar__label">Final Standings</span>
  <span class="cutbar__rule"></span><span class="cutbar__cut">Top ${cut}</span></div>
</header>`;

const foot = `<footer class="foot"><span class="mark">Georgia<span>Play</span>Events</span>
  <p class="disclaim">Fan-made content. Not affiliated with or endorsed by Nintendo,
  Creatures Inc., GAME FREAK, or The Pok&eacute;mon Company.</p></footer>`;

/* A plain ranked row — most list layouts restyle this rather than replace it. */
const row = (p, i, opts = {}) => `<article class="row ${i === 0 ? "row--champ" : ""}">
  <span class="bar"></span>${place(i + 1)}
  <div class="who">${nameOf(p)}${opts.stackTeam ? team(p) : ""}</div>
  ${opts.stackTeam ? "" : team(p)}${opts.cp === false ? stats(p, false) : stats(p)}
</article>`;

const list = (opts = {}) =>
  `<main class="rows">${TOP4.map((p, i) => row(p, i, { ...opts, stackTeam: opts.stackTeam && i === 0 })).join("")}</main>`;

/* ── The sixteen ─────────────────────────────────────────────────────── */

const LAYOUTS = [
  { id: "baseline", tag: "conservative", title: "Hero + aligned table",
    note: "The shipping design. Gradient hero with the team on its own line; three aligned rows beneath.",
    html: () => head() + list({ stackTeam: true }) + foot },

  { id: "flat", tag: "conservative", title: "Flat table",
    note: "No hero. Four equal rows — the gradient shrinks to a left bar. Maximum restraint; the event is the subject, not the winner.",
    html: () => head() + list() + foot },

  { id: "hairline", tag: "conservative", title: "Hairline list",
    note: "No fills, no borders — rules only. The guide's stated minimalist alternative: if the node fills can't be seen, drop them rather than ship them.",
    html: () => head() + list() + foot },

  { id: "leftteams", tag: "conservative", title: "Teams follow the name",
    note: "Icons sit immediately after each name instead of in a right-aligned rail. Reads as four cards rather than a table — better for one row, worse for scanning.",
    html: () => head() + list() + foot },

  { id: "compact", tag: "conservative", title: "Compact, icon-forward",
    note: "Tight rows, oversized icons, CP dropped. Pushes as much space as possible to the thing that carries the meta signal.",
    html: () => head() + list({ cp: false }) + foot },

  { id: "podium", tag: "balanced", title: "Podium",
    note: "2nd / 1st / 3rd as podium blocks of descending height, 4th as a slim row. The one arrangement everyone reads instantly.",
    html: () => head() + `<main class="rows">
      <div class="podium">${[1, 0, 2].map(i => `<div class="pod pod--${i}">
        ${place(i + 1)}${nameOf(TOP4[i])}${team(TOP4[i], "team--wrap")}${stats(TOP4[i])}</div>`).join("")}</div>
      ${row(TOP4[3], 3)}</main>` + foot },

  { id: "spotlight", tag: "balanced", title: "Champion spotlight",
    note: "The winner takes the top half at full size; 2nd–4th compress underneath. Strongest hierarchy without abandoning the list.",
    html: () => head() + `<main class="rows">
      <article class="row row--champ hero">${place(1)}<div class="who">${nameOf(TOP4[0])}
        ${team(TOP4[0])}</div>${stats(TOP4[0])}</article>
      ${TOP4.slice(1).map((p, i) => row(p, i + 1)).join("")}</main>` + foot },

  { id: "split", tag: "balanced", title: "Vertical split",
    note: "Champion owns a full-height left column, 2nd–4th stack on the right. Gives the winner presence without a tall row.",
    html: () => `<main class="split">
      <div class="split__champ">${place(1)}${nameOf(TOP4[0])}${team(TOP4[0], "team--wrap")}${stats(TOP4[0])}</div>
      <div class="split__rest">${head()}${TOP4.slice(1).map((p, i) => row(p, i + 1)).join("")}${foot}</div>
    </main>` },

  { id: "quad", tag: "balanced", title: "Quadrant",
    note: "Four equal cards in a 2×2. Champion marked by the gradient alone. Suits a square canvas and gives every team the same room.",
    html: () => head() + `<main class="quad">${TOP4.map((p, i) =>
      `<div class="qcard ${i === 0 ? "qcard--champ" : ""}">${place(i + 1)}${nameOf(p)}
        ${team(p, "team--wrap")}${stats(p)}</div>`).join("")}</main>` + foot },

  { id: "watermark", tag: "balanced", title: "Numeral watermark",
    note: "Giant ghosted placement numerals sit behind each row. Placement becomes readable at any distance without stealing a column.",
    html: () => head() + `<main class="rows">${TOP4.map((p, i) =>
      `<article class="row ${i === 0 ? "row--champ" : ""}"><span class="bar"></span>
        <span class="ghost">${i + 1}</span><div class="who">${nameOf(p)}</div>
        ${team(p)}${stats(p)}</article>`).join("")}</main>` + foot },

  { id: "bracket", tag: "balanced", title: "Bracket echo",
    note: "A list with faint connectors implying the semis and final. Recovers the who-beat-whom the guide's tree gave up, without the density cost.",
    html: () => head() + `<main class="rows rows--bracket">${TOP4.map((p, i) =>
      row(p, i)).join("")}<svg class="tree" viewBox="0 0 100 400" preserveAspectRatio="none">
      <path d="M2 50 H60 V150 H2 M60 100 H92" /><path d="M2 250 H60 V350 H2 M60 300 H92" /></svg></main>` + foot },

  { id: "skew", tag: "experimental", title: "Sheared",
    note: "Rows sheared and overlapped. Borrows the motion language of esports lower-thirds — loud, and it fights the table reading.",
    html: () => head() + `<main class="rows">${TOP4.map((p, i) =>
      `<article class="row ${i === 0 ? "row--champ" : ""}"><span class="bar"></span>
        <div class="deskew">${place(i + 1)}<div class="who">${nameOf(p)}</div>${team(p)}${stats(p)}</div>
      </article>`).join("")}</main>` + foot },

  { id: "orbit", tag: "experimental", title: "Orbit",
    note: "Champion at the centre, 2nd–4th orbiting. Abandons ranking-as-a-column entirely — striking, and genuinely harder to read a placement from.",
    html: () => `<main class="orbit">
      <div class="orbit__ring"></div>
      <div class="orb orb--0">${place(1)}${nameOf(TOP4[0])}${team(TOP4[0], "team--wrap")}${stats(TOP4[0])}</div>
      ${TOP4.slice(1).map((p, i) => `<div class="orb orb--${i + 1}">${place(i + 2)}${nameOf(p)}
        ${team(p, "team--wrap")}</div>`).join("")}
      <div class="orbit__head">${head()}</div></main>`, },

  { id: "wall", tag: "experimental", title: "Team wall",
    note: "The champion's six Pokémon blown up as a full-bleed backdrop with the standings over it. Maximum scroll-stopping power, minimum restraint.",
    html: () => `<div class="wall">${TOP4[0].team.map(s => `<i class="pk s-${s}"></i>`).join("")}</div>
      <div class="wall__scrim"></div>` + head() + `<main class="rows rows--onwall">${TOP4.map((p, i) =>
      row(p, i)).join("")}</main>` + foot },

  { id: "typo", tag: "experimental", title: "Typographic",
    note: "The placement numerals ARE the graphic; names ride alongside and teams shrink to a strip. Treats the result as a poster, not a table.",
    html: () => head() + `<main class="rows rows--typo">${TOP4.map((p, i) =>
      `<article class="trow ${i === 0 ? "trow--champ" : ""}"><span class="tnum">${i + 1}</span>
        <div class="tbody">${nameOf(p)}${team(p)}</div>${stats(p, false)}</article>`).join("")}</main>` + foot },

  { id: "strip", tag: "experimental", title: "Filmstrip",
    note: "Four vertical lanes, teams stacked down each. Reads like a team-sheet comparison — the only layout here you could actually compare six-vs-six in.",
    html: () => head() + `<main class="strip">${TOP4.map((p, i) =>
      `<div class="lane ${i === 0 ? "lane--champ" : ""}">${place(i + 1)}${nameOf(p)}
        <div class="team team--col">${p.team.map(s => `<i class="pk s-${s}"></i>`).join("")}</div>
        ${stats(p, false)}</div>`).join("")}</main>` + foot },
];

/* ── Page ────────────────────────────────────────────────────────────── */

const css = fs.readFileSync(path.join(ROOT, "src/gallery.css"), "utf8");

const cards = LAYOUTS.map((L, i) => `<figure class="demo">
  <figcaption>
    <span class="demo__n">${String(i + 1).padStart(2, "0")}</span>
    <span class="demo__title">${esc(L.title)}</span>
    <span class="demo__tag demo__tag--${L.tag}">${L.tag}</span>
    <span class="demo__note">${esc(L.note)}</span>
  </figcaption>
  <div class="frame"><div class="card L-${L.id}">${L.html()}</div></div>
</figure>`).join("\n");

const counts = LAYOUTS.reduce((a, L) => (a[L.tag] = (a[L.tag] || 0) + 1, a), {});

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Top 4 standings — 16 layouts</title>
<style>
${faces.join("\n")}
${spriteCss}
.pk--empty{--mask:${pikaMask}}
${css}
</style></head><body>
<header class="page">
  <h1>Top 4 standings — 16 layouts</h1>
  <p>Same event, same four results, same 1080×1080 canvas. Champions Regulation M-C.
  ${counts.conservative} conservative · ${counts.balanced} balanced · ${counts.experimental} experimental.</p>
</header>
<div class="grid">${cards}</div>
</body></html>`;

fs.mkdirSync(path.join(ROOT, "out"), { recursive: true });
const outPath = path.join(ROOT, "out/layouts.html");
fs.writeFileSync(outPath, html);
console.log(`${LAYOUTS.length} layouts -> ${outPath}  (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
console.log(Object.entries(counts).map(([k, v]) => `  ${k}: ${v}`).join("\n"));
