/* Card → PNG in the browser.
 *
 * The card is self-contained (fonts and sprites as data: URIs), so it can be
 * wrapped in an SVG <foreignObject>, loaded as an image, and drawn to a
 * canvas — the browser's own layout engine does the rendering, so the export
 * matches the preview exactly.
 */

/* HTML markup → XHTML, since foreignObject content is parsed as XML
   (entities like &nbsp; are not valid there). */
function toXhtml(style, markup) {
  const doc = document.implementation.createHTMLDocument("");
  doc.body.innerHTML = `<style>${style}</style>${markup}`;
  const xs = new XMLSerializer();
  return [...doc.body.childNodes].map(n => xs.serializeToString(n)).join("");
}

export async function cardToPng(card, scale = 1) {
  const W = card.w * scale, H = card.h * scale;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" ` +
    `viewBox="0 0 ${card.w} ${card.h}"><foreignObject x="0" y="0" width="${card.w}" height="${card.h}">` +
    toXhtml(card.style, card.markup) + `</foreignObject></svg>`;

  const img = new Image();
  img.decoding = "sync";
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  await img.decode();

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0d0d0d";
  ctx.fillRect(0, 0, W, H);
  /* WebKit can paint an SVG image before its embedded fonts and images have
     settled; the first draw primes it, the second is the one kept. */
  ctx.drawImage(img, 0, 0, W, H);
  await new Promise(r => setTimeout(r, 60));
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);

  return new Promise((resolve, reject) =>
    canvas.toBlob(b => b ? resolve(b) : reject(new Error("PNG encoding failed")), "image/png"));
}
