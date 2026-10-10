// Prints the plate for each guide chapter of Stoic's DocC catalog, once, and
// writes it as a 1-bit two-colour PNG (static compresses badly as
// colour, and these ship inside the Swift package).
//
//   bun run docc-plates ../stoic/Sources/Stoic/Stoic.docc/Resources
import { chromium } from "playwright";
import { deflateSync } from "node:zlib";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import type * as Plates from "../lib/plates";

const destination = process.argv[2];
if (!destination) throw new Error("usage: bun run docc-plates <docc Resources folder>");
const chapters = [
  { name: "plate-time", plate: "time", invert: true, seed: 21 },
  { name: "plate-failure", plate: "sisyphus", invert: false, seed: 22 },
  { name: "plate-resources", plate: "atlas", invert: false, seed: 23 },
  { name: "plate-lifecycle", plate: "hydra", invert: true, seed: 24 },
  { name: "plate-testing", plate: "reason", invert: true, seed: 25 },
];
const width = 240, height = 320;

const bundle = await Bun.build({ entrypoints: [join(import.meta.dir, "docc-entry.ts")], target: "browser", format: "iife" });
const script = await bundle.outputs[0].text();
const publicDir = join(import.meta.dir, "..", "public");
const server = Bun.serve({
  port: 0,
  fetch: (request) => new Response(Bun.file(join(publicDir, new URL(request.url).pathname))),
});

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (bytes: Uint8Array) => { let c = 0xffffffff; for (const b of bytes) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length), view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
/** A 1-bit palette PNG: `bits[i]` true prints bone, false lamp black. */
function png(bits: boolean[], w: number, h: number): Uint8Array {
  const stride = Math.ceil(w / 8), raw = new Uint8Array((stride + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (bits[y * w + x]) raw[y * (stride + 1) + 1 + (x >> 3)] |= 0x80 >> (x & 7);
  const header = new Uint8Array(13), hv = new DataView(header.buffer);
  hv.setUint32(0, w); hv.setUint32(4, h); header[8] = 1; header[9] = 3;
  const palette = new Uint8Array([0x13, 0x11, 0x0f, 0xe6, 0xdd, 0xca]);
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("PLTE", palette), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", new Uint8Array())];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0; for (const p of parts) { out.set(p, offset); offset += p.length; }
  return out;
}

await mkdir(destination, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://localhost:${server.port}/plates/atlas.jpg`);
await page.addScriptTag({ content: script });
for (const chapter of chapters) {
  for (const scale of [1, 2]) {
    const w = width * scale, h = height * scale;
    const bits: boolean[] = await page.evaluate(async ({ src, w, h, seed, invert }) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      const p = (window as unknown as { plates: typeof Plates }).plates;
      const luminance = p.composeNiche(w, h, image, { seed, scrape: 0, rays: true, invert });
      const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
      const context = canvas.getContext("2d")!;
      p.printStatic(context, w, h, luminance, seed);
      const data = context.getImageData(0, 0, w, h).data, out: boolean[] = [];
      for (let i = 0; i < w * h; i++) out.push(data[i * 4] > 128);
      return out;
    }, { src: `/plates/${chapter.plate}.jpg`, w, h, seed: chapter.seed, invert: chapter.invert });
    const file = join(destination, `${chapter.name}${scale === 2 ? "@2x" : ""}.png`);
    await Bun.write(file, png(bits, w, h));
    console.log(file, (await Bun.file(file).size / 1024).toFixed(0) + " KB");
  }
}
await browser.close();
server.stop();
