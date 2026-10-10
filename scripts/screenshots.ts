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
const pages = ["/"];
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
    return (await file.exists())
      ? new Response(file)
      : new Response("Not found", { status: 404 });
  },
});

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
const problems: string[] = [];
for (const viewport of viewports) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
  });
  page.on("console", (message) => {
    if (message.type() === "error")
      problems.push(`${viewport.name}: console error: ${message.text()}`);
  });
  page.on("pageerror", (error) =>
    problems.push(`${viewport.name}: page error: ${error.message}`)
  );
  for (const path of pages) {
    await page.goto(`http://localhost:${server.port}${path}`, {
      waitUntil: "networkidle",
    });
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
