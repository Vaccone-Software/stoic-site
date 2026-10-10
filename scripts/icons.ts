// Renders every icon from lib/mark.ts: the favicons and touch icon in app/,
// the Open Graph card, and the brand files (mark SVGs, GitHub social preview).
//
//   bun run icons
import { chromium, type Page } from "playwright";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { colours, markSvg } from "../lib/mark";

const root = join(import.meta.dir, "..");
const app = (name: string) => join(root, "app", name);
const brand = (name: string) => join(root, "brand", name);

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (bytes: Uint8Array) => {
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length), view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/**
 * The SVG rasterised to an RGBA PNG. Icon decoders (Turbopack's among them)
 * require RGBA inside an .ico, and a screenshot of an opaque image is RGB.
 */
async function rgbaPng(page: Page, svg: string, size: number): Promise<Uint8Array> {
  const pixels: number[] = await page.evaluate(
    async ({ svg, size }) => {
      const image = new Image();
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0, size, size);
      return Array.from(context.getImageData(0, 0, size, size).data);
    },
    { svg, size }
  );
  const raw = new Uint8Array((size * 4 + 1) * size);
  for (let y = 0; y < size; y++)
    raw.set(pixels.slice(y * size * 4, (y + 1) * size * 4), y * (size * 4 + 1) + 1);
  const header = new Uint8Array(13), view = new DataView(header.buffer);
  view.setUint32(0, size);
  view.setUint32(4, size);
  header[8] = 8;
  header[9] = 6;
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", new Uint8Array()),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
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

// The share cards print the Atlas plate with the site's own renderer, so it
// needs the renderer bundled for the page and the plate served over HTTP
// (a canvas will not read pixels from a file: URL).
const bundle = await Bun.build({
  entrypoints: [join(import.meta.dir, "docc-entry.ts")],
  target: "browser",
  format: "iife",
});
const renderer = await bundle.outputs[0].text();
const server = Bun.serve({
  port: 0,
  fetch: (request) => {
    const path = new URL(request.url).pathname;
    return path === "/"
      ? new Response("<!doctype html><title>card</title>", { headers: { "content-type": "text/html" } })
      : new Response(Bun.file(join(root, "public", path)));
  },
});

/**
 * A share card: the wordmark and what Stoic is on the left, the Atlas plate
 * in its niche on the right, in two-colour static.
 */
async function card(page: Page, width: number, height: number): Promise<Uint8Array> {
  const plateHeight = Math.round(height * 0.92);
  const plateWidth = Math.round(plateHeight * 0.74);
  await page.setViewportSize({ width, height });
  await page.goto(`http://localhost:${server.port}/`);
  await page.setContent(`
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=League+Gothic&family=EB+Garamond&family=Geist+Mono&display=block">
<style>html,body{margin:0;background:${colours.ground}}</style>
<div style="width:${width}px;height:${height}px;display:grid;grid-template-columns:1fr ${plateWidth}px;align-items:center;gap:${width * 0.04}px;padding:0 ${width * 0.04}px 0 ${width * 0.07}px;box-sizing:border-box;color:${colours.print};border-bottom:${height * 0.012}px solid ${colours.accent}">
  <div style="display:grid;gap:${height * 0.035}px">
    <div style="display:flex;align-items:center;gap:${height * 0.03}px">
      <div style="width:${height * 0.11}px;height:${height * 0.11}px">${markSvg().replace("<svg ", `<svg style="width:100%;height:100%;display:block" `)}</div>
      <div style="font-family:'Geist Mono';font-size:${height * 0.032}px;color:${colours.accent}">Swift package · Apache-2.0</div>
    </div>
    <div style="font-family:'League Gothic';font-size:${height * 0.34}px;line-height:.82;letter-spacing:.1em">STOIC</div>
    <div style="font-family:'EB Garamond';font-size:${height * 0.056}px;line-height:1.28;color:#cfc6b3;max-width:21ch">Reliable async code for Swift. Timeouts, retries, cleanup and restarts that hold when the network, the disk or a service fails.</div>
  </div>
  <canvas id="plate" width="${plateWidth}" height="${plateHeight}" style="align-self:end"></canvas>
</div>`);
  await page.addScriptTag({ content: renderer });
  await page.evaluate(
    async ({ w, h }) => {
      const image = new Image();
      image.src = "/plates/atlas.jpg";
      await image.decode();
      const plates = (window as unknown as { plates: typeof import("../lib/plates") }).plates;
      const luminance = plates.composeNiche(w, h, image, { seed: 7, scrape: 0, rays: true, invert: false });
      const canvas = document.getElementById("plate") as HTMLCanvasElement;
      plates.printStatic(canvas.getContext("2d")!, w, h, luminance, 7);
      await document.fonts.ready;
    },
    { w: plateWidth, h: plateHeight }
  );
  return page.screenshot({ type: "png" });
}

const browser = await chromium.launch();
const page = await browser.newPage();
const small = markSvg({ small: true, tile: true });
const large = markSvg({ tile: true });

await Bun.write(app("icon.svg"), small + "\n");
await Bun.write(
  app("favicon.ico"),
  ico([
    { size: 16, data: await rgbaPng(page, small, 16) },
    { size: 32, data: await rgbaPng(page, small, 32) },
    { size: 48, data: await rgbaPng(page, large, 48) },
  ])
);
await Bun.write(app("apple-icon.png"), await rgbaPng(page, large, 180));
await Bun.write(app("opengraph-image.png"), await card(page, 1200, 630));
await Bun.write(app("opengraph-image.alt.txt"), "The name Stoic and the line \"Reliable async code for Swift\", beside an engraving of Atlas carrying the sky, set in an arched niche and printed as two-colour static.\n");

await Bun.write(brand("stoic-mark.svg"), markSvg() + "\n");
await Bun.write(
  brand("stoic-mark-on-paper.svg"),
  markSvg({ colours: { print: colours.ink, accent: colours.accentOnPaper } }) + "\n"
);
await Bun.write(brand("stoic-favicon.svg"), small + "\n");
await Bun.write(brand("social-preview.png"), await card(page, 1280, 640));
await browser.close();
server.stop();
console.log("icons written");
