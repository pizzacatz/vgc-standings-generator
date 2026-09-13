/* Champions Standings Generator — web app.
 *
 * Static and client-only: the form edits one event object (the same shape as
 * data/*.json), card.js turns it into card markup, the preview iframe shows
 * it, and export.js rasterises it to PNG. State lives in localStorage.
 */

import { PRESETS, presetForCut, buildCard, cardDocument, domMeasurer, esc, parseDate } from "./card.js";
import { cardToPng } from "./export.js";

const STORE = "champions-standings:v1";
const MAX = 16;
const $ = s => document.querySelector(s);

/* ── Assets ──────────────────────────────────────────────────────────── */

const [rosterFile, fonts, cardCss, sample] = await Promise.all([
  fetch("data/roster.json").then(r => r.json()),
  fetch("data/fonts.json").then(r => r.json()),
  fetch("card.css").then(r => r.text()),
  fetch("data/sample.json").then(r => r.json()),
]);
const roster = rosterFile.species;

/* The UI uses the card's own faces. */
const uiFaces = document.createElement("style");
uiFaces.textContent = fonts.map(f => `@font-face{font-family:'${f.family}';font-weight:${f.weight};` +
  `font-display:swap;src:url(${f.file}) format('woff2')}`).join("\n");
document.head.append(uiFaces);

/* Names are fitted to their columns by measuring them against this page's
   layout, so the card's faces must be loaded first — a fallback face would
   give the wrong widths. */
await Promise.all([...new Set(fonts.map(f => `${f.weight} 16px '${f.family}'`))]
  .map(f => document.fonts.load(f)));
const measure = domMeasurer(document);

/* Export needs every asset inline, so everything the card uses is fetched
   once and kept as a data: URI. */
const uris = new Map();
function dataUri(url) {
  if (!uris.has(url)) {
    uris.set(url, fetch(url).then(r => {
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      return r.blob();
    }).then(b => new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(b);
    })));
  }
  return uris.get(url);
}

async function envFor(data, cut) {
  const slugs = [...new Set(data.standings.slice(0, cut).flatMap(p => p.team).filter(s => roster[s]))];
  const [fontUris, fillerUri, logoUri, spriteUris] = await Promise.all([
    Promise.all(fonts.map(f => dataUri(f.file))),
    dataUri("sprites/_filler.png"),
    dataUri("brand/gpe-logo.png"),
    Promise.all(slugs.map(s => dataUri(`sprites/${s}.png`))),
  ]);
  const sprites = Object.fromEntries(slugs.map((s, i) => [s, spriteUris[i]]));
  return {
    roster, css: cardCss, measure,
    fonts: fonts.map((f, i) => ({ ...f, url: fontUris[i] })),
    sprite: s => sprites[s], filler: fillerUri, logo: logoUri,
  };
}

/* ── Species lookup ──────────────────────────────────────────────────── */

const toId = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const megaByStone = {};
for (const [slug, e] of Object.entries(roster)) if (e.stone) megaByStone[toId(e.stone)] = slug;

const resolve = text => (roster[toId(text)] ? toId(text) : null);
const display = v => roster[v]?.name ?? v ?? "";

/* Showdown / PokePaste export → up to six slugs. The first line of each set
   is "Nickname (Species) (M) @ Item" with every part but Species optional. A
   species holding its own Mega Stone becomes the Mega form. */
function parsePaste(text) {
  const team = [];
  for (const block of text.split(/\r?\n\s*\r?\n/)) {
    const first = block.trim().split(/\r?\n/)[0];
    if (!first) continue;
    const at = first.lastIndexOf(" @ ");
    let head = (at >= 0 ? first.slice(0, at) : first).trim();
    const item = at >= 0 ? first.slice(at + 3).trim() : "";
    head = head.replace(/\s*\((M|F)\)\s*$/, "");
    const paren = /\(([^()]+)\)\s*$/.exec(head);
    const species = paren ? paren[1] : head;
    let slug = resolve(species);
    const mega = megaByStone[toId(item)];
    if (slug && mega && roster[mega].base === slug) slug = mega;
    team.push(slug || species);
    if (team.length === 6) break;
  }
  return team;
}

/* ── Event listing ───────────────────────────────────────────────────── */

/* A Play! Pokémon / venue listing → event fields. The expected shape is

     VGC Challenge @ BATTLE AND BREW
     When: Sun, Sep 13, 2026, 12:00 PM – 4:00 PM ET
     Where: 5920 ROSWELL RD A120, SANDY SPRINGS, GA 30328
     Link: https://www.pokemon.com/…

   with the labels in any order, on separate lines or run together. Nothing
   is returned until at least one label is present, so a half-typed paste
   doesn't overwrite the event name; after that, only fields actually found
   are returned. The link isn't drawn on the card but is kept in the JSON. */
const LABELS = /\b(When|Where|Link|Date|Location|Address)\s*:/gi;

const titleCase = s => s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());

/* A street address → "City, ST"; anything unrecognised is kept as written. */
function cityState(where) {
  const parts = where.split(",").map(p => p.trim()).filter(Boolean);
  const i = parts.findIndex(p => /^[A-Z]{2}(\s+\d{5}(-\d{4})?)?$/i.test(p));
  if (i > 0) return `${titleCase(parts[i - 1])}, ${parts[i].slice(0, 2).toUpperCase()}`;
  return where;
}

function parseListing(text) {
  const t = String(text || "").replace(/\r/g, "");
  const found = {};
  const marks = [...t.matchAll(LABELS)];
  const value = (k, i) => t.slice(marks[i].index + marks[i][0].length, marks[i + 1]?.index ?? t.length).trim();
  marks.forEach((m, i) => {
    const k = m[1].toLowerCase();
    const v = value(k, i).split("\n").map(x => x.trim()).filter(Boolean).join(" ");
    if (!v) return;
    if (k === "when" || k === "date") {
      const d = parseDate(v);
      if (d) found.date = d;
    } else if (k === "where" || k === "location" || k === "address") {
      found.location = cityState(v);
    } else if (k === "link") {
      found.link = v.split(/\s+/)[0];
    }
  });
  if (!marks.length) return found;
  const name = t.slice(0, marks[0].index).split("\n").map(x => x.trim()).find(Boolean);
  if (name) found.event = name;
  return found;
}

/* ── State ───────────────────────────────────────────────────────────── */

const blankPlayer = () => ({ name: "", record: "", cp: "", team: ["", "", "", "", "", ""] });
const blank = () => ({
  event: "", location: "", date: "", link: "", players: "", division: "Masters",
  format: `Reg ${rosterFile.regulation}`, showCp: true, cut: 8,
  standings: Array.from({ length: MAX }, blankPlayer),
});

function normalise(d) {
  const out = { ...blank(), ...d };
  out.cut = [4, 8, 16].includes(Number(d.cut)) ? Number(d.cut)
    : (d.standings?.length >= 16 ? 16 : d.standings?.length >= 8 ? 8 : 4);
  out.standings = Array.from({ length: MAX }, (_, i) => {
    const p = d.standings?.[i] || {};
    const team = Array.from({ length: 6 }, (_, j) => String(p.team?.[j] ?? ""));
    return { name: String(p.name ?? ""), record: String(p.record ?? ""), cp: String(p.cp ?? ""), team };
  });
  out.showCp = d.showCp !== false;
  /* Dates are ISO so the date picker can hold them; older saves and JSON
     files wrote them out ("12 September 2026"). */
  out.date = parseDate(d.date) || "";
  return out;
}

let state;
try { state = normalise(JSON.parse(localStorage.getItem(STORE))); } catch { state = null; }
if (!state || !localStorage.getItem(STORE)) state = normalise(sample);

const save = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch {} };

/* The event as exported: trimmed to the cut, numbers as numbers. */
function eventJson() {
  const { cut, ...rest } = state;
  return {
    ...rest, cut,
    players: Number(state.players) || state.players,
    standings: state.standings.slice(0, cut).map(p => ({
      name: p.name, record: p.record, cp: Number(p.cp) || p.cp,
      team: p.team.filter(Boolean),
    })),
  };
}

/* ── Form ────────────────────────────────────────────────────────────── */

$("#reg").textContent = `Pokémon Champions · Regulation ${rosterFile.regulation}`;
$("#species-list").innerHTML = Object.values(roster)
  .map(e => `<option value="${esc(e.name)}"></option>`).join("");

const ORD = n => ["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th";

function monHtml(i, j, v) {
  const ok = roster[v];
  return `<label class="mon${v && !ok ? " mon--bad" : ""}">` +
    `<img alt="" src="${ok ? `sprites/${v}.png` : ""}">` +
    `<input list="species-list" data-p="${i}" data-t="${j}" value="${esc(display(v))}" ` +
    `placeholder="Pokémon ${j + 1}" aria-label="Place ${i + 1}, Pokémon ${j + 1}" autocomplete="off" spellcheck="false"></label>`;
}

function renderForm() {
  for (const el of document.querySelectorAll("[data-k]")) {
    const k = el.dataset.k;
    if (el.type === "checkbox") el.checked = !!state[k]; else el.value = state[k] ?? "";
  }
  for (const r of document.querySelectorAll('input[name="cut"]')) r.checked = Number(r.value) === state.cut;

  $("#standings").innerHTML = state.standings.slice(0, state.cut).map((p, i) => `
    <article class="player">
      <div class="player__place">${i + 1}<sup>${ORD(i + 1)}</sup></div>
      <div class="player__body">
        <div class="player__row">
          <label class="field">Player<input data-p="${i}" data-f="name" value="${esc(p.name)}" autocomplete="off"></label>
          <label class="field">Record<input data-p="${i}" data-f="record" value="${esc(p.record)}" placeholder="7-2" autocomplete="off"></label>
          <label class="field">Pts<input data-p="${i}" data-f="cp" value="${esc(p.cp)}" inputmode="numeric" autocomplete="off"></label>
          <button type="button" class="btn btn--small" data-paste="${i}">Paste team</button>
        </div>
        <div class="team-inputs">${p.team.map((v, j) => monHtml(i, j, v)).join("")}</div>
      </div>
    </article>`).join("");
}

document.addEventListener("input", e => {
  const el = e.target;
  if (el.dataset.k) {
    state[el.dataset.k] = el.type === "checkbox" ? el.checked : el.value;
  } else if (el.dataset.f) {
    state.standings[el.dataset.p][el.dataset.f] = el.value;
  } else if (el.dataset.t) {
    const slug = resolve(el.value);
    state.standings[el.dataset.p].team[el.dataset.t] = slug || el.value.trim();
    const mon = el.closest(".mon");
    mon.querySelector("img").src = slug ? `sprites/${slug}.png` : "";
    mon.classList.toggle("mon--bad", !!el.value.trim() && !slug);
  } else if (el.name === "cut") {
    state.cut = Number(el.value);
    renderForm();
  } else return;
  changed();
});

/* Snap a resolved species to its canonical spelling once the field is left. */
document.addEventListener("change", e => {
  const el = e.target;
  if (el.dataset.t && roster[state.standings[el.dataset.p].team[el.dataset.t]]) {
    el.value = display(state.standings[el.dataset.p].team[el.dataset.t]);
  }
});

const FIELD_NAMES = { event: "event name", date: "date", location: "location" };
$("#listing").addEventListener("input", e => {
  const found = parseListing(e.target.value);
  const keys = Object.keys(FIELD_NAMES).filter(k => k in found);
  if (!e.target.value.trim()) {
    $("#listing-status").textContent = "";
    return;
  }
  if (!keys.length) {
    $("#listing-status").textContent = "Nothing recognised yet — expecting a name line, then When:, Where: and Link:.";
    return;
  }
  Object.assign(state, found);
  renderForm();
  changed();
  $("#listing-status").innerHTML = `Filled ${keys.map(k => `<b>${FIELD_NAMES[k]}</b>`).join(", ")}.`;
});

let pasteFor = null;
document.addEventListener("click", e => {
  const b = e.target.closest("[data-paste]");
  if (!b) return;
  pasteFor = Number(b.dataset.paste);
  $("#paste-title").textContent = `Paste team — ${state.standings[pasteFor].name || `place ${pasteFor + 1}`}`;
  $("#paste-text").value = "";
  $("#paste-dialog").showModal();
});
$("#paste-dialog").addEventListener("close", () => {
  if ($("#paste-dialog").returnValue !== "ok" || pasteFor === null) return;
  const team = parsePaste($("#paste-text").value);
  if (!team.length) return;
  state.standings[pasteFor].team = Array.from({ length: 6 }, (_, j) => team[j] || "");
  renderForm();
  changed();
});

/* ── Toolbar ─────────────────────────────────────────────────────────── */

function download(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
const slugName = () =>
  (state.event || "standings").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") +
  `-top${state.cut}`;

$("#load-sample").onclick = () => {
  if (!confirm("Replace the current event with the sample?")) return;
  state = normalise(sample); renderForm(); changed();
};
$("#reset").onclick = () => {
  if (!confirm("Clear every field?")) return;
  state = blank(); renderForm(); changed();
};
$("#export-json").onclick = () =>
  download(new Blob([JSON.stringify(eventJson(), null, 2)], { type: "application/json" }), `${slugName()}.json`);
$("#import").onclick = () => $("#import-file").click();
$("#import-file").onchange = async e => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!Array.isArray(d.standings)) throw new Error("no standings array");
    state = normalise(d); renderForm(); changed();
  } catch (err) {
    alert(`Couldn't read ${f.name}: ${err.message}`);
  }
};

async function png(scale) {
  const cut = state.cut;
  const card = buildCard(eventJson(), presetForCut(cut), await envFor(state, cut));
  return cardToPng(card, scale);
}
async function busy(btn, fn) {
  btn.disabled = true;
  try { await fn(); } catch (err) { alert(`Export failed: ${err.message}`); console.error(err); }
  finally { btn.disabled = false; }
}
$("#dl-1").onclick = e => busy(e.currentTarget, async () => download(await png(1), `${slugName()}.png`));
$("#dl-2").onclick = e => busy(e.currentTarget, async () => download(await png(2), `${slugName()}@2x.png`));

if (navigator.canShare?.({ files: [new File([""], "x.png", { type: "image/png" })] })) {
  $("#share").hidden = false;
  $("#share").onclick = e => busy(e.currentTarget, async () => {
    const file = new File([await png(2)], `${slugName()}.png`, { type: "image/png" });
    await navigator.share({ files: [file], title: state.event || "Standings" }).catch(err => {
      if (err.name !== "AbortError") throw err;
    });
  });
}

/* ── Preview ─────────────────────────────────────────────────────────── */

const frame = $("#frame"), wrap = $("#frame-wrap");
let size = PRESETS[presetForCut(state.cut)];

function fit() {
  const scale = Math.min(wrap.parentElement.clientWidth / size.w,
    window.innerWidth > 980 ? (window.innerHeight - 190) / size.h : Infinity);
  frame.style.width = `${size.w}px`;
  frame.style.height = `${size.h}px`;
  frame.style.transform = `scale(${scale})`;
  wrap.style.width = `${size.w * scale}px`;
  wrap.style.height = `${size.h * scale}px`;
}
new ResizeObserver(fit).observe(wrap.parentElement);
addEventListener("resize", fit);

function warn(truncated) {
  const items = [];
  state.standings.slice(0, state.cut).forEach((p, i) => {
    const where = `${i + 1}${ORD(i + 1)}`;
    if (!p.name.trim()) items.push(`<b>${where}</b>: no player name`);
    const bad = p.team.filter(v => v && !roster[v]);
    if (bad.length) items.push(`<b>${where}</b>: not in Regulation ${esc(rosterFile.regulation)} — ${bad.map(esc).join(", ")} (shown as a blank slot)`);
  });
  for (const n of truncated) items.push(`<b>${esc(n)}</b> didn't fit and is cut off with “…”`);
  $("#warnings").innerHTML = items.map(t => `<li>${t}</li>`).join("");
}

let seq = 0;
async function renderPreview() {
  const mine = ++seq;
  const cut = state.cut;
  const env = await envFor(state, cut);
  if (mine !== seq) return;
  const preset = presetForCut(cut);
  size = PRESETS[preset];
  $("#size").textContent = `${size.w} × ${size.h}`;
  const card = buildCard(eventJson(), preset, env);
  frame.onload = async () => {
    const doc = frame.contentDocument;
    await doc.fonts.ready;
    if (mine !== seq) return;
    const cutNames = [...doc.querySelectorAll(".nm, .title")]
      .filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent);
    /* Names are shrunk to fit, so this should stay empty — it reports the
       rare case where measuring and painting disagree. */
    warn(cutNames);
  };
  frame.srcdoc = cardDocument(card);
  fit();
}

let timer;
function changed() {
  save();
  clearTimeout(timer);
  timer = setTimeout(renderPreview, 180);
}

renderForm();
renderPreview();
