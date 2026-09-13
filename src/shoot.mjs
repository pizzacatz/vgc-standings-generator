/* Headless-Chrome screenshot pipeline shared by the renderers.
 *
 * Screenshots at deviceScaleFactor 2, then crops and box-downsamples to the
 * nominal canvas. Supersampling is what keeps small type crisp at 400px.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const CHROME = "/usr/bin/google-chrome";
/* New headless reserves ~87px of --window-size for window chrome, so the
   inner viewport falls short and the bottom of the card never paints. Ask
   for extra height and crop it back off. */
const VP_SLACK = 140;

function shoot(htmlPath, rawPath, c) {
  execFileSync(CHROME, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
    "--allow-file-access-from-files",
    "--force-device-scale-factor=2",
    `--window-size=${c.w},${c.h + VP_SLACK}`,
    `--screenshot=${rawPath}`,
    "--virtual-time-budget=6000",
    `file://${htmlPath}`,
  ], { stdio: ["ignore", "ignore", "pipe"] });
}

function finish(rawPath, base, c) {
  execFileSync("python3", ["-c", `
from PIL import Image
im = Image.open(${JSON.stringify(rawPath)}).convert("RGB").crop((0, 0, ${c.w * 2}, ${c.h * 2}))
im.save("${base}@2x.png")
one = im.resize((${c.w}, ${c.h}), Image.LANCZOS)
one.save("${base}.png")
one.resize((400, round(${c.h} * 400 / ${c.w})), Image.LANCZOS).save(
    "${path.dirname(base)}/thumb-${path.basename(base)}.png")
`], { stdio: ["ignore", "ignore", "pipe"] });
  fs.unlinkSync(rawPath);
}

/* Writes <base>@2x.png, <base>.png and thumb-<name>.png from an HTML file. */
export function capture(htmlPath, base, c) {
  shoot(htmlPath, `${base}@raw.png`, c);
  finish(`${base}@raw.png`, base, c);
}

/* The DOM after load, for reading back measurements a page writes to itself. */
export function dumpDom(htmlPath, c) {
  return execFileSync(CHROME, [
    "--headless=new", "--disable-gpu", "--no-sandbox",
    `--window-size=${c.w},${c.h + VP_SLACK}`,
    "--virtual-time-budget=6000", "--dump-dom",
    `file://${htmlPath}`,
  ], { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 }).toString();
}
