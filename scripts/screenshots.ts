// Serves the static export and photographs every page at phone, laptop and
// wide widths, so a change is reviewed as people will see it. Also fails on
// console errors and on any element wider than the page.
//
//   bun run build && bun run shots
import { chromium } from "playwright";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";

const root = join(import.meta.dir, "..", "out");
const outDir = join(import.meta.dir, "..", "screenshots");
const pages = [
  "/",
  "/adopting/",
  "/design/",
  "/design/01-time-and-deadlines/",
  "/design/06-validation/",
  "/changelog/",
  "/no-such-page/",
];
// Paths that must answer 404 with the site's own page.
const missing = new Set(["/no-such-page/"]);
const viewports = [
  { name: "phone", width: 390, height: 844 },
  { name: "laptop", width: 1440, height: 900 },
  { name: "wide", width: 1920, height: 1080 },
];

const server = Bun.serve({
  port: 0,
  async fetch(request) {
    let path = new URL(request.url).pathname;
    if (path.endsWith("/")) path += "index.html";
    const file = Bun.file(join(root, decodeURIComponent(path)));
    // Like GitHub Pages: a missing path answers 404 with the site's 404.html.
    return (await file.exists())
      ? new Response(file)
      : new Response(Bun.file(join(root, "404.html")), {
          status: 404,
          headers: { "Content-Type": "text/html" },
        });
  },
});

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
const problems: string[] = [];
for (const viewport of viewports) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
  });
  let navigating = "";
  page.on("console", (message) => {
    // The browser logs a 404 document as a console error; that one is expected.
    if (message.location().url === navigating && missing.has(new URL(navigating).pathname))
      return;
    if (message.type() === "error")
      problems.push(`${viewport.name}: console error: ${message.text()}`);
  });
  page.on("pageerror", (error) =>
    problems.push(`${viewport.name}: page error: ${error.message}`)
  );
  for (const path of pages) {
    navigating = `http://localhost:${server.port}${path}`;
    const response = await page.goto(navigating, { waitUntil: "networkidle" });
    const expected = missing.has(path) ? 404 : 200;
    if (response?.status() !== expected)
      problems.push(
        `${viewport.name} ${path}: answered ${response?.status()}, expected ${expected}`
      );
    await page.waitForTimeout(1200);
    const name =
      path === "/" ? "home" : path.replaceAll("/", "-").replace(/^-|-$/g, "");
    await page.screenshot({
      path: join(outDir, `${name}-${viewport.name}-fold.png`),
    });
    await page.screenshot({
      path: join(outDir, `${name}-${viewport.name}-full.png`),
      fullPage: true,
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    if (overflow > 0)
      problems.push(
        `${viewport.name} ${path}: page is ${overflow}px wider than the viewport`
      );
  }
  await page.close();
}
await browser.close();
server.stop();

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`Screenshots in ${outDir}`);
