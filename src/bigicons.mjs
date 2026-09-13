/* Big-icon exploration — crossbreeds of layouts 02 (flat), 03 (hairline),
 * 05 (compact) and 12 (sheared) from out/layouts.html.
 *
 *   node src/bigicons.mjs      # → out/layouts-bigicons.html
 *
 * Premise: the team is the content. The player's name drops to a subdued
 * strip on its OWN line, which is what buys the icons their size — six icons
 * across 1080 is ~155px wide, and giving the row its own line means nothing
 * competes for that height either. No hero row, no node fills, no CP.
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

/* The name strip: placement, name, record. Deliberately quiet — it is a
   caption for the team, not the headline. */
const label = (p, i) => `<div class="lab">
  <span class="pl">${i + 1}<sup>${ORD(i + 1)}</sup></span>
  <span class="nm">${esc(p.name)}</span>
  <span class="rule"></span>
  <span class="rc">${esc(p.record)}</span>
</div>`;

const block = (p, i) => `<section class="blk ${i === 0 ? "blk--champ" : ""}">
  ${label(p, i)}${team(p)}<span class="nmtag">${esc(p.name)}</span>
</section>`;

const blocks = () => TOP4.map(block).join("");

const head = () => `<header class="head">
  <div class="head__row">
    <h1 class="title">${esc(DATA.event)}</h1>
    <span class="cut">Top 4</span>
  </div>
  <p class="sub">${[DATA.location, DATA.date, `${DATA.players} ${DATA.division}`, DATA.format]
    .map(esc).join(" &nbsp;·&nbsp; ")}</p>
</header>`;

const foot = `<footer class="foot"><span class="mark">Georgia<span>Play</span>Events</span>
  <p class="disclaim">Fan-made content. Not affiliated with or endorsed by Nintendo,
  Creatures Inc., GAME FREAK, or The Pok&eacute;mon Company.</p></footer>`;

const card = () => head() + `<main class="stack">${blocks()}</main>` + foot;

/* ── Variants ────────────────────────────────────────────────────────── */

const V = [
  { id: "strip", icon: 150, from: "03 + 05", title: "Name strip above",
    note: "The base move: name, placement and record collapse into one quiet hairline strip, and the team row gets everything left. No fills anywhere." },

  { id: "bleed", icon: 171, from: "05", title: "Full bleed",
    note: "Icons run edge to edge — the card's side padding is cancelled for the team rows only. The largest icons possible on this canvas at 171px." },

  { id: "rail", icon: 146, from: "03 + 12", title: "Vertical name rail",
    note: "Name rotated into a narrow left rail so it costs height instead of width. Icons take the full block height; the rail doubles as the placement marker." },

  { id: "ghost", icon: 150, from: "02 + 05", title: "Ghosted name",
    note: "The name is set large but nearly transparent, behind the team. Present if you look for it, invisible at a glance — the most subdued option here." },

  { id: "caption", icon: 152, from: "03", title: "Caption below",
    note: "Name moves under the team, like a plate under an exhibit. Reading order becomes team-first, which is what the audience actually came for." },

  { id: "shear", icon: 142, from: "12 + 05", title: "Sheared bands",
    note: "Each block skewed and stepped. Costs ~9px of icon size to the shear, and the name strip has to counter-skew to stay readable." },

  { id: "shearbleed", icon: 165, from: "12 + 05 bleed", title: "Sheared full bleed",
    note: "The loudest of the set: edge-to-edge sheared bands, name reduced to a tiny counter-skewed tag. Icons overrun the canvas edges by design." },

  { id: "barstrip", icon: 130, from: "02 + 12", title: "Placement bar",
    note: "The accent bar from 02 widens into a block carrying the numeral, name rides it as a small tag. Keeps a visible rank column without a table." },

  /* ── esports ── The genre's usual palette is cool neon; this brand is
     warm-only, so these push glow, shear and angular clipping inside the
     gold→coral ramp instead of importing cyan/magenta. */
  { id: "broadcast", icon: 120, from: "12", title: "Broadcast lower-third", esports: true,
    note: "Angular clipped bands with a chevron cap and a hard placement tab. The vocabulary of an on-stream lower-third, straight down the card." },

  { id: "hazard", icon: 132, from: "12 + 02", title: "Chevron rail", esports: true,
    note: "A hazard-stripe rail carries the placement, scanlines sit over the whole card, names go condensed uppercase. Loudest structural treatment." },

  { id: "bloom", icon: 152, from: "05", title: "Neon bloom", esports: true,
    note: "Icons carry a warm glow and the champion band blooms behind them, with a vignette pulling focus. Closest to a hype graphic without leaving the palette." },

  { id: "slot", icon: 132, from: "12 + 05", title: "Slot plates", esports: true,
    note: "Each player is a clipped slot plate with a huge outlined numeral. Reads like a team-select screen; the numeral does the ranking work." },
];

/* ── Page ────────────────────────────────────────────────────────────── */

const css = fs.readFileSync(path.join(ROOT, "src/bigicons.css"), "utf8");

const cards = V.map((v, i) => `<figure class="demo">
  <figcaption>
    <span class="demo__n">${String(i + 1).padStart(2, "0")}</span>
    <span class="demo__title">${esc(v.title)}</span>
    <span class="demo__icon">${v.icon}px icons</span>
    <span class="demo__from">from ${esc(v.from)}</span>
    ${v.esports ? '<span class="demo__tag">esports</span>' : ""}
    <span class="demo__note">${esc(v.note)}</span>
  </figcaption>
  <div class="frame"><div class="card B-${v.id}" style="--icon:${v.icon}px">${card()}</div></div>
</figure>`).join("\n");

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Top 4 — big-icon variants</title>
<style>
${faces.join("\n")}
${spriteCss}
.pk--empty{--mask:${pikaMask}}
${css}
</style></head><body>
<header class="page">
  <h1>Top 4 — team-first, big icons</h1>
  <p>Eight crossbreeds of <b>02 flat</b>, <b>03 hairline</b>, <b>05 compact</b> and <b>12 sheared</b>.
  Every one puts the player name on its own line as a subdued strip so the team row can take the
  height. Icons run <b>120–171px</b> against the 47px of the shipping design. No hero row, no CP.
  Note the pattern: every layout that puts the name in a <b>side rail</b> pays for it in icon
  size, because the rail eats the width the six icons need. Name-on-its-own-row keeps icons
  at 150–171px; a rail drops them to 120–146px.
  Same 1080×1080 canvas throughout. The last four push an <b>esports</b> treatment — angular
  clipping, shear, glow and scanlines — held inside the warm brand ramp rather than the genre's
  usual cool neon.</p>
</header>
<div class="grid">${cards}</div>
</body></html>`;

fs.mkdirSync(path.join(ROOT, "out"), { recursive: true });
const outPath = path.join(ROOT, "out/layouts-bigicons.html");
fs.writeFileSync(outPath, html);
console.log(`${V.length} variants -> ${outPath}  (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
console.log("icon sizes: " + V.map(v => `${v.id}:${v.icon}`).join("  "));
