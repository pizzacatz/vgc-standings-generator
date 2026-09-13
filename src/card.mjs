/* Standings cards from the command line — same builder as the web app.
 *
 *   node src/card.mjs                            # every preset
 *   node src/card.mjs portrait-8                 # a subset
 *   node src/card.mjs --data path/to/event.json  # any event file
 *
 * The card itself is built by web/card.js from the assets in web/ (run
 * scripts/build-web-assets.py when the regulation changes). Writes
 * out/card-<preset>.html (self-contained) plus @2x, 1× and 400px thumb PNGs,
 * and reports any name the ellipsis cut.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { capture, dumpDom } from "./shoot.mjs";
import { PRESETS, buildCard, cardDocument } from "../web/card.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB = path.join(ROOT, "web");

const args = process.argv.slice(2);
const di = args.indexOf("--data");
const dataPath = path.resolve(di >= 0 ? args.splice(di, 2)[1] : path.join(ROOT, "data/sample-large.json"));
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const want = args.length ? args : Object.keys(PRESETS);
for (const w of want) if (!PRESETS[w]) throw new Error(`unknown preset "${w}"`);

const dataUri = (f, type) => `data:${type};base64,${fs.readFileSync(path.join(WEB, f)).toString("base64")}`;
const { species: roster } = JSON.parse(fs.readFileSync(path.join(WEB, "data/roster.json"), "utf8"));
const env = {
  roster,
  css: fs.readFileSync(path.join(WEB, "card.css"), "utf8"),
  fonts: JSON.parse(fs.readFileSync(path.join(WEB, "data/fonts.json"), "utf8"))
    .map(f => ({ ...f, url: dataUri(f.file, "font/woff2") })),
  sprite: s => dataUri(`sprites/${s}.png`, "image/png"),
  filler: dataUri("sprites/_filler.png", "image/png"),
};

for (const s of data.standings.flatMap(p => p.team)) {
  if (!roster[s]) throw new Error(`"${s}" is not in the roster (web/data/roster.json)`);
}

/* Lists every name the ellipsis rule cut, for the console. */
const TRUNC_PROBE = `<script>addEventListener("load",()=>document.fonts.ready.then(()=>{
  const cut=[...document.querySelectorAll(".nm")].filter(e=>e.scrollWidth>e.clientWidth).map(e=>e.textContent);
  document.body.dataset.trunc=JSON.stringify(cut)}))</script>`;

fs.mkdirSync(path.join(ROOT, "out"), { recursive: true });

for (const name of want) {
  const c = PRESETS[name];
  if (data.standings.length < c.cut) {
    throw new Error(`Top ${c.cut} needs ${c.cut} standings, got ${data.standings.length} in ${dataPath}`);
  }
  const card = buildCard(data, name, env);
  const base = path.join(ROOT, "out", `card-${name}`);
  fs.writeFileSync(`${base}.html`, cardDocument(card, TRUNC_PROBE));
  capture(`${base}.html`, base, c);
  const trunc = JSON.parse(/data-trunc="([^"]*)"/.exec(dumpDom(`${base}.html`, c))?.[1]
    .replace(/&quot;/g, '"') || "[]");
  console.log(`card-${name.padEnd(11)} ${c.w}x${c.h}  band ${card.g.band}px/${card.g.icon}px icons` +
    (c.cut > 4 ? `  rows ${card.g.rowH}px/${card.g.rowIcon}px icons` : ""));
  for (const t of trunc) console.log(`  ! name truncated: ${t}`);
}
console.log(`<- ${path.relative(ROOT, dataPath)}`);
