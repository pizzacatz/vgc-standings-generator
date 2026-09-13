/* Standings card builder, shared by the web app (web/app.js) and the Node
 * renderer (src/card.mjs). Pure: data and assets in, markup out.
 *
 * Variant 04 from the layout exploration: brand-tone → team-type sheared
 * bands, footerless, with the TALL semi-transparent bar (60px, record 48px,
 * name 30px) so the gradient reads through behind the stats.
 *
 * Places 1–4 always get that full two-line band (bar, then the team beneath).
 * Places 5+ get a one-line band: a bar holding place, name, team, and the
 * record stacked over CP. Sixteen full bands on 1920px would leave ~30px
 * icons, below the 44px at which Megas stop reading as Megas. Place and name
 * columns are shared across both band kinds, and CP ends at the bar's edge on
 * every row, so the card still scans as a table.
 *
 * Every selector in card.css is scoped under .card and every geometry value
 * is set on .card itself, so the same markup renders in a document, an
 * iframe, or an SVG <foreignObject> (which is how the browser exports PNGs).
 */

export const PRESETS = {
  "square-4":   { w: 1080, h: 1080, cut: 4 },
  /* rowH: height of each one-line band. Top 8 has room to spare, so its
     rows grow; Top 16 keeps them tight to leave the top four their icons. */
  "portrait-8": { w: 1080, h: 1350, cut: 8, rowH: 92 },
  "story-16":   { w: 1080, h: 1920, cut: 16, rowH: 76 },
};
export const presetForCut = cut =>
  Object.keys(PRESETS).find(k => PRESETS[k].cut === Number(cut));

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
/* One ramp across the whole stack, so rank also reads as tone. */
const tone = (i, cut) => sample((i + 0.5) / cut);

const TYPE = {
  normal: "#a8a878", fire: "#ee7b34", water: "#4a90dd", electric: "#f6c945",
  grass: "#6fc25a", ice: "#7fd4d4", fighting: "#c03028", poison: "#ab5aa8",
  ground: "#d8b45c", flying: "#9bb4f0", psychic: "#f5548c", bug: "#99c022",
  rock: "#b8a038", ghost: "#7a6aae", dragon: "#6f52e8", dark: "#6b5a4e",
  steel: "#a9b8c6", fairy: "#f094c6",
};

/* The team's DOMINANT type, counted across both type slots of every member —
   slot-1 alone gives near-identical bands to teams that differ in slot 2. */
export function dominant(team, roster) {
  const c = new Map();
  for (const s of team) for (const t of roster[s]?.types || []) c.set(t, (c.get(t) || 0) + 1);
  const [top] = [...c.entries()].sort((a, b) => b[1] - a[1]);
  const slug = top ? top[0] : "normal";
  return { slug, hex: TYPE[slug] };
}

/* ── Geometry ────────────────────────────────────────────────────────── */

const PAD = 44, GAP = 10, INSET = 16, SHEAR = 9;
const TITLE_FS = 46, SUB_FS = 28, TITLE_SUB_GAP = 12, EDGE_GAP = 6;
const HEAD = Math.round(TITLE_FS * 1.05) + TITLE_SUB_GAP + Math.round(SUB_FS * 1.3) + EDGE_GAP;
const FULL = 4;                        // places that get the two-line band

/* Full band: the tall bar, the team on its own line beneath. */
const VPAD = 10, ROWGAP = 8, ICON_GAP = 10, STRIP = 60;
const F = { pl: 38, nm: 30, rec: 48, cp: 28 };

/* One-line band: team inside the bar, record stacked over CP. */
const ROW_VPAD = 8, ROW_ICON_GAP = 4, ROW_ICON_INSET = 4;
const R = { pl: 32, nm: 22, rec: 34, cp: 18 };
const ROW_NAME_W = 290;                // ~16 uppercase characters at R.nm
const ROW_STATS_W = Math.round(R.rec * 2.9); // holds "12-10"
const TAB_PAD = 16, TAB_GAP = 14;

/* Shared columns — sized for the widest content either band kind holds, so
   names start and CP ends at the same x on every row. */
const PL_MIN = 60;                     // holds "16th" at the row size
const CP_MIN = Math.round(F.cp * 4.5); // holds "999 CP" at the full size

export function geometry(c) {
  const body = c.h - PAD * 2 - HEAD;
  const rows = c.cut - FULL;
  const rowH = c.rowH || 0;
  const band = Math.floor((body - GAP * (c.cut - 1) - rows * rowH) / FULL);
  const stackW = c.w - PAD * 2 - INSET * 2;
  const slope = Math.ceil((band / 2) * Math.tan(SHEAR * Math.PI / 180)) + 14;
  const innerW = stackW - slope * 2;
  const icon = Math.min(band - VPAD * 2 - STRIP - ROWGAP,
    Math.floor((innerW - ICON_GAP * 5) / 6));

  /* Row icons: as tall as the bar allows, as wide as the name budget allows. */
  const rowStrip = rowH - ROW_VPAD * 2;
  const tabW = innerW - TAB_PAD * 2;
  const rowTeamW = tabW - PL_MIN - ROW_NAME_W - ROW_STATS_W - TAB_GAP * 3;
  const rowIcon = rows ? Math.min(rowStrip - ROW_ICON_INSET * 2,
    Math.floor((rowTeamW - ROW_ICON_GAP * 5) / 6)) : 0;

  return {
    band, slope, icon, rowH, rowStrip, rowIcon,
    stackH: band * FULL + rows * rowH + GAP * (c.cut - 1),
    stackW,
  };
}

/* ── Markup ──────────────────────────────────────────────────────────── */

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ORD = n =>
  ["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th";

/* Sprite class names are derived from roster slugs, which are [a-z0-9] —
   anything else in a team is treated as an unknown slot. */
const known = (s, roster) => typeof s === "string" && /^[a-z0-9]+$/.test(s) && roster[s];

/*
 * data   — event JSON (same shape as data/*.json)
 * preset — a key of PRESETS
 * env    — { roster, css, fonts: [{family, weight, url}], sprite: slug => url, filler: url }
 *
 * Returns { w, h, g, style, markup }: `style` is the full stylesheet text and
 * `markup` the .card element. Asset URLs are used verbatim, so pass data:
 * URIs wherever the result must be self-contained.
 */
export function buildCard(data, preset, env) {
  const c = PRESETS[preset];
  if (!c) throw new Error(`unknown preset "${preset}"`);
  const { roster } = env;
  const rows = (data.standings || []).slice(0, c.cut);
  while (rows.length < c.cut) rows.push({ name: "", record: "", cp: "", team: [] });
  const g = geometry(c);
  const showCp = data.showCp !== false;

  const teamOf = p => {
    const slots = (p.team || []).slice(0, 6).map(s => known(s, roster) ? s : null);
    while (slots.length < 6) slots.push(null);
    return slots;
  };

  const team = p => `<div class="team">` + teamOf(p).map(s =>
    s ? `<i class="pk s-${s}"></i>` : `<i class="pk pk--empty"></i>`).join("") + `</div>`;

  /* Full bands carry the team below the bar; one-line bands carry it inside,
     between the name and the record. */
  const bar = (p, place, inline) => `<div class="strip"><span class="tab"><span class="tabin">` +
    `<span class="pl">${place}<sup>${ORD(place)}</sup></span>` +
    `<span class="nm">${esc(p.name)}</span>${inline ? team(p) : `<span class="spacer"></span>`}` +
    (inline ? `<span class="stats">` : "") + `<span class="rec">${esc(p.record)}</span>` +
    (showCp ? `<span class="cp">${esc(p.cp)} CP</span>` : "") + (inline ? `</span>` : "") +
    `</span></span></div>`;

  const blocks = rows.map((p, i) => {
    const full = i < FULL;
    const cls = ["blk", full ? "blk--full" : "blk--row", i === 0 && "blk--champ"].filter(Boolean).join(" ");
    const vars = `--tone:${tone(i, c.cut)};--type:${dominant(teamOf(p).filter(Boolean), roster).hex}`;
    return `<section class="${cls}" style="${vars}"><div class="inner">` +
      (full ? bar(p, i + 1, false) + team(p) : bar(p, i + 1, true)) + `</div></section>`;
  }).join("");

  const players = data.players ? `${data.players} ${data.division || ""}`.trim() : data.division;
  const meta = [data.location, data.date, players, data.format]
    .filter(Boolean).map(esc).join(" &nbsp;·&nbsp; ");

  const vars = {
    w: c.w, h: c.h, band: g.band, gap: GAP, "stack-h": g.stackH, "stack-w": g.stackW,
    inset: INSET, slope: g.slope, head: HEAD, pad: PAD,
    "title-fs": TITLE_FS, "sub-fs": SUB_FS, "title-gap": TITLE_SUB_GAP,
    strip: STRIP, "pl-min": PL_MIN, "cp-min": CP_MIN,
    "f-vpad": VPAD, "f-rowgap": ROWGAP, "f-icon": g.icon, "f-icon-gap": ICON_GAP,
    "f-pl": F.pl, "f-nm": F.nm, "f-rec": F.rec, "f-cp": F.cp, "f-rec-min": Math.round(F.rec * 3.3),
    "r-h": g.rowH, "r-vpad": ROW_VPAD, "r-strip": g.rowStrip, "r-icon": g.rowIcon, "r-icon-gap": ROW_ICON_GAP,
    "r-pl": R.pl, "r-nm": R.nm, "r-rec": R.rec, "r-cp": R.cp, "r-stats-w": ROW_STATS_W,
    "tab-pad": TAB_PAD, "tab-gap": TAB_GAP,
  };
  const cardVars = Object.entries(vars).map(([k, v]) => `--${k}:${v}px`).join(";") + `;--shear:${SHEAR}deg`;

  const slugs = [...new Set(rows.flatMap(p => teamOf(p).filter(Boolean)))];
  const style = [
    ...env.fonts.map(f => `@font-face{font-family:'${f.family}';font-style:normal;` +
      `font-weight:${f.weight};font-display:block;src:url(${f.url}) format('woff2')}`),
    ...slugs.map(s => `.card .s-${s}{background-image:url(${env.sprite(s)})}`),
    `.card .pk--empty{--mask:url(${env.filler})}`,
    env.css,
  ].join("\n");

  const markup = `<div class="card" style="${cardVars}">` +
    `<header class="head"><div class="head__row"><h1 class="title">${esc(data.event)}</h1>` +
    `<span class="cut">Top ${c.cut}</span></div><p class="sub">${meta}</p></header>` +
    `<main class="stack">${blocks}</main></div>`;

  return { w: c.w, h: c.h, g, style, markup };
}

/* A standalone HTML document for the card, viewport-sized to the canvas. */
export function cardDocument(card, extraHead = "") {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=${card.w}">` +
    `<style>html,body{margin:0;background:#0d0d0d}\n${card.style}</style>${extraHead}</head>` +
    `<body>${card.markup}</body></html>`;
}
