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
 *
 * Names are fitted to their columns by measuring them, which needs a layout
 * engine: each card is built once with a recording measurer to learn which
 * strings it needs, those are measured in headless Chrome, and the card is
 * built again from the real widths.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { capture, dumpDom } from "./shoot.mjs";
import { PRESETS, buildCard, cardDocument, domMeasurer } from "../web/card.js";

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
  logo: dataUri("brand/gpe-logo.png", "image/png"),
};

/* Reads back a JSON value a page wrote to a data- attribute on <body>. */
const bodyData = (dom, attr) => {
  const raw = new RegExp(`data-${attr}="([^"]*)"`).exec(dom)?.[1];
  return raw === undefined ? undefined : JSON.parse(raw.replace(/&quot;/g, '"').replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&nbsp;/g, "\u00a0").replace(/&amp;/g, "&"));
};

const measureKey = (text, spec, px) => JSON.stringify([text, spec.family, spec.weight, spec.ls, !!spec.tabular, px]);

/* Measures every string `preset` asks for, in Chrome, with the card's fonts. */
function chromeMeasure(preset) {
  const wanted = new Map();
  buildCard(data, preset, { ...env, measure: (t, spec, px) => (wanted.set(measureKey(t, spec, px), [t, spec, px]), 1) });

  const faces = env.fonts.map(f => `@font-face{font-family:'${f.family}';font-weight:${f.weight};` +
    `font-display:block;src:url(${f.url}) format('woff2')}`).join("\n");
  const loads = JSON.stringify([...new Set(env.fonts.map(f => `${f.weight} 16px '${f.family}'`))]);
  const page = `<!doctype html><html><head><meta charset="utf-8"><style>${faces}</style></head><body><script>
const domMeasurer = ${domMeasurer.toString()};
const wanted = ${JSON.stringify([...wanted])};
Promise.all(${loads}.map(f => document.fonts.load(f))).then(() => {
  const m = domMeasurer(document);
  document.body.dataset.widths = JSON.stringify(wanted.map(([k, [t, spec, px]]) => [k, m(t, spec, px)]));
});
</script></body></html>`;
  const file = path.join(ROOT, "out", "_measure.html");
  fs.writeFileSync(file, page);
  const dom = dumpDom(file, { w: 1200, h: 800 });
  fs.unlinkSync(file);
  const measured = bodyData(dom, "widths");
  if (!measured) throw new Error("text measurement in Chrome produced no result");
  const widths = new Map(measured);
  return (t, spec, px) => {
    const w = widths.get(measureKey(t, spec, px));
    if (w === undefined) throw new Error(`unmeasured text: ${t}`);
    return w;
  };
}

for (const s of data.standings.flatMap(p => p.team)) {
  if (!roster[s]) throw new Error(`"${s}" is not in the roster (web/data/roster.json)`);
}

/* Lists any name the ellipsis still cut, for the console. Fitting should
   leave this empty; it is here to catch a measurement that disagrees with paint. */
const TRUNC_PROBE = `<script>addEventListener("load",()=>document.fonts.ready.then(()=>{
  const cut=[...document.querySelectorAll(".nm,.title")].filter(e=>e.scrollWidth>e.clientWidth).map(e=>e.textContent);
  document.body.dataset.trunc=JSON.stringify(cut)}))</script>`;

fs.mkdirSync(path.join(ROOT, "out"), { recursive: true });

for (const name of want) {
  const c = PRESETS[name];
  if (data.standings.length < c.cut) {
    throw new Error(`Top ${c.cut} needs ${c.cut} standings, got ${data.standings.length} in ${dataPath}`);
  }
  const card = buildCard(data, name, { ...env, measure: chromeMeasure(name) });
  const base = path.join(ROOT, "out", `card-${name}`);
  fs.writeFileSync(`${base}.html`, cardDocument(card, TRUNC_PROBE));
  capture(`${base}.html`, base, c);
  const trunc = bodyData(dumpDom(`${base}.html`, c), "trunc") || [];
  console.log(`card-${name.padEnd(11)} ${c.w}x${c.h}  band ${card.g.band}px/${card.g.icon}px icons` +
    (c.cut > 4 ? `  rows ${card.g.rowH}px/${card.g.rowIcon}px icons` : ""));
  for (const t of trunc) console.log(`  ! still truncated: ${t}`);
}
console.log(`<- ${path.relative(ROOT, dataPath)}`);
