// Renders every icon from lib/mark.ts: the favicons and touch icon in app/,
// the Open Graph card, and the brand files (mark SVGs, GitHub social preview).
//
//   bun run icons
import { chromium, type Page } from "playwright";
import { join } from "node:path";
import { colours, markSvg } from "../lib/mark";

const root = join(import.meta.dir, "..");
const app = (name: string) => join(root, "app", name);
const brand = (name: string) => join(root, "brand", name);

async function png(page: Page, html: string, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${width}px;height:${height}px}</style>${html}`
  );
  await page.evaluate(() => document.fonts.ready);
  return page.screenshot({ omitBackground: true, type: "png" });
}

/** An .ico holding PNG images, which every current browser reads. */
function ico(images: { size: number; data: Uint8Array }[]): Uint8Array {
  const header = 6 + 16 * images.length;
  const total = header + images.reduce((n, i) => n + i.data.length, 0);
  const out = new Uint8Array(total), view = new DataView(out.buffer);
  view.setUint16(2, 1, true);
  view.setUint16(4, images.length, true);
  let offset = header;
  images.forEach(({ size, data }, k) => {
    const e = 6 + 16 * k;
    out[e] = size % 256;
    out[e + 1] = size % 256;
    view.setUint16(e + 4, 1, true);
    view.setUint16(e + 6, 32, true);
    view.setUint32(e + 8, data.length, true);
    view.setUint32(e + 12, offset, true);
    out.set(data, offset);
    offset += data.length;
  });
  return out;
}

/** A card with the mark, the wordmark and the line under it. */
const card = (width: number, height: number) => `
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=League+Gothic&family=EB+Garamond&family=Geist+Mono&display=block">
<div style="width:${width}px;height:${height}px;background:${colours.ground};color:${colours.print};display:grid;grid-template-columns:auto 1fr;align-items:center;gap:${width * 0.05}px;padding:0 ${width * 0.09}px;box-sizing:border-box">
  <div style="width:${height * 0.5}px;height:${height * 0.5}px">${markSvg().replace("<svg ", `<svg style="width:100%;height:100%" `)}</div>
  <div style="display:grid;gap:${height * 0.03}px">
    <div style="font-family:'Geist Mono';font-size:${height * 0.035}px;color:${colours.accent}">Swift package · Apache-2.0</div>
    <div style="font-family:'League Gothic';font-size:${height * 0.3}px;line-height:.85;letter-spacing:.12em">STOIC</div>
    <div style="font-family:'EB Garamond';font-size:${height * 0.058}px;line-height:1.25;color:#cfc6b3;max-width:22ch">Reliable async code for Swift: timeouts, retries, cleanup and restarts that hold under failure.</div>
  </div>
</div>`;

const browser = await chromium.launch();
const page = await browser.newPage();
const small = markSvg({ small: true, tile: true });
const large = markSvg({ tile: true });

await Bun.write(app("icon.svg"), small + "\n");
await Bun.write(
  app("favicon.ico"),
  ico([
    { size: 16, data: await png(page, small, 16, 16) },
    { size: 32, data: await png(page, small, 32, 32) },
    { size: 48, data: await png(page, large, 48, 48) },
  ])
);
await Bun.write(app("apple-icon.png"), await png(page, large, 180, 180));
await Bun.write(app("opengraph-image.png"), await png(page, card(1200, 630), 1200, 630));
await Bun.write(app("opengraph-image.alt.txt"), "Stoic's mark, an arched niche sheltering a green sphere, beside the name Stoic and the line: reliable async code for Swift.\n");

await Bun.write(brand("stoic-mark.svg"), markSvg() + "\n");
await Bun.write(
  brand("stoic-mark-on-paper.svg"),
  markSvg({ colours: { print: colours.ink, accent: colours.accentOnPaper } }) + "\n"
);
await Bun.write(brand("stoic-favicon.svg"), small + "\n");
await Bun.write(brand("social-preview.png"), await png(page, card(1280, 640), 1280, 640));
await browser.close();
console.log("icons written");
