// Serves the static export and photographs every page at phone, tablet,
// laptop and wide sizes, so a change is reviewed as people will see it. Also
// fails on console errors and on any element wider than the page, and checks
// the home page's mosaic: that its seal is never cut off or moved, that no
// tile label is clipped, and that a tile can be read by hover or by tap.
//
//   bun run build && bun run shots
import { chromium, type Page } from "playwright";
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
  { name: "tablet", width: 768, height: 1024 },
  { name: "small", width: 1280, height: 720 },
  { name: "laptop", width: 1440, height: 900 },
  { name: "wide", width: 1920, height: 1080 },
];
// The mosaic has its phone layout at this width and below.
const phoneLayout = 900;
// Sizes between and beyond the photographed ones, for the seal alone.
const sealSizes = [
  [901, 600], [960, 540], [1024, 768], [1100, 560], [1366, 768], [1600, 700],
  [2560, 1300], [900, 1200], [360, 640], [320, 568], [600, 900],
] as const;

/** A tile by the name on its label. */
const tileNamed = (page: Page, name: string) =>
  page.locator(".mosaic .tile").filter({ has: page.locator(".label", { hasText: new RegExp(`^${name}$`) }) });

type Box = { x: number; y: number; width: number; height: number };

/**
 * The home page's mosaic, at the page's current size. Reports a problem for
 * anything cut off, and photographs a tile being read.
 */
async function checkHome(page: Page, name: string, width: number, problems: string[]) {
  const phone = width <= phoneLayout;
  const where = `${name} /`;
  const box = async (selector: string): Promise<Box> => {
    const found = await page.locator(selector).first().boundingBox();
    if (!found) throw new Error(`${where}: no ${selector}`);
    return found;
  };

  // The seal holds all it shows: nothing in it runs past its edge or is
  // clipped by a container.
  const sealProblems = await page.evaluate(() => {
    const seal = document.querySelector<HTMLElement>(".mosaic .seal")!;
    const edge = seal.getBoundingClientRect();
    const out: string[] = [];
    if (seal.scrollHeight > seal.clientHeight + 1 || seal.scrollWidth > seal.clientWidth + 1)
      out.push(`the seal's content is ${seal.scrollWidth} by ${seal.scrollHeight} in a ${seal.clientWidth} by ${seal.clientHeight} seal`);
    for (const el of seal.querySelectorAll<HTMLElement>("h1, .motto, .muted, .pkg, .legend, .meta, .meta *, .legend *")) {
      if (getComputedStyle(el).display === "none") continue;
      const r = el.getBoundingClientRect();
      if (r.left < edge.left - 0.5 || r.right > edge.right + 0.5 || r.top < edge.top - 0.5 || r.bottom > edge.bottom + 0.5)
        out.push(`.${el.className || el.tagName.toLowerCase()} lies outside the seal`);
      // Text in a box of its own must not be cut off by it.
      if (el.matches(".legend") && (el.scrollHeight > el.clientHeight + 1))
        out.push(`the legend's text is ${el.scrollHeight}px tall in ${el.clientHeight}px`);
    }
    return out;
  });
  for (const problem of sealProblems) problems.push(`${where}: ${problem}`);

  // A tile's name sits inside the tile.
  const labelProblems = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".mosaic .tile")].flatMap((tile) => {
      const label = tile.querySelector<HTMLElement>(".label")!.getBoundingClientRect();
      const t = tile.getBoundingClientRect();
      return label.left < t.left - 0.5 || label.right > t.right + 0.5 || label.top < t.top - 0.5 || label.bottom > t.bottom + 0.5
        ? [`the label of ${tile.getAttribute("aria-label")?.split(".")[0]} is outside its tile`]
        : [];
    })
  );
  for (const problem of labelProblems) problems.push(`${where}: ${problem}`);

  const before = await box(".mosaic .seal");
  if (phone) {
    // Tap a tall tile: it opens in place, full width and two rows, and its
    // text is on it; tap it again and it closes.
    const tile = tileNamed(page, "Sealed storage");
    await tile.scrollIntoViewIfNeeded();
    await tile.tap();
    await page.waitForTimeout(500);
    const opened = await tile.boundingBox();
    const floor = await box(".mosaic");
    if (!opened || Math.abs(opened.width - (floor.width - 8)) > 2)
      problems.push(`${where}: an opened tile is ${opened?.width}px wide in a ${floor.width}px floor`);
    const text = await tile.locator(".desc").boundingBox();
    if (!text || !(await tile.locator(".desc").isVisible()))
      problems.push(`${where}: an opened tile does not show its text`);
    else if (text.height > opened!.height + 1)
      problems.push(`${where}: an opened tile's text is cut off`);
    if ((await page.locator(".mosaic .tile.open").count()) !== 1)
      problems.push(`${where}: ${await page.locator(".mosaic .tile.open").count()} tiles are open, not one`);
    await page.screenshot({ path: join(outDir, `home-${name}-open.png`) });
    await tileNamed(page, "Deadlines").tap();
    await page.waitForTimeout(300);
    if ((await page.locator(".mosaic .tile.open").count()) !== 1 || (await tile.evaluate((e) => e.classList.contains("open"))))
      problems.push(`${where}: tapping another tile did not move the open one`);
    await page.locator(".mosaic .tile.open").tap();
    await page.waitForTimeout(300);
    if ((await page.locator(".mosaic .tile.open").count()) !== 0)
      problems.push(`${where}: tapping an open tile did not close it`);
    // Scrolled away from the seal, one line of status follows the page.
    await page.evaluate(() => window.scrollTo(0, 1400));
    await page.waitForTimeout(500);
    if (!(await page.locator(".mosaic .status").isVisible()))
      problems.push(`${where}: no status line once the seal has scrolled away`);
    await page.screenshot({ path: join(outDir, `home-${name}-scrolled.png`) });
    await page.evaluate(() => window.scrollTo(0, 0));
  } else {
    // Hover a tile: it is outlined and the legend reads it, and the seal does not move.
    const tile = tileNamed(page, "Journals");
    const at = (await tile.boundingBox())!;
    await page.mouse.move(at.x + at.width * 0.45, at.y + at.height * 0.45);
    await page.waitForTimeout(400);
    if (!(await page.locator(".mosaic .legend .name", { hasText: "Journals" }).isVisible()))
      problems.push(`${where}: hovering Journals did not put it in the legend`);
    if ((await page.locator(".mosaic .outline polygon.on").count()) !== 1)
      problems.push(`${where}: hovering a tile did not outline it`);
    const during = await box(".mosaic .seal");
    for (const key of ["x", "y", "width", "height"] as const)
      if (Math.abs(during[key] - before[key]) > 0.5) problems.push(`${where}: the seal moved when a tile was hovered`);
    await page.screenshot({ path: join(outDir, `home-${name}-hover.png`) });
    await page.mouse.move(2, 2);
  }
}

/** The seal at sizes of its own: never cut off, whatever the window. */
async function checkSealSizes(page: Page, problems: string[]) {
  for (const [width, height] of sealSizes) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(350);
    const found = await page.evaluate(() => {
      const seal = document.querySelector<HTMLElement>(".mosaic .seal")!;
      const edge = seal.getBoundingClientRect();
      const out: string[] = [];
      if (seal.scrollHeight > seal.clientHeight + 1 || seal.scrollWidth > seal.clientWidth + 1)
        out.push("its content overflows it");
      for (const el of seal.querySelectorAll<HTMLElement>("h1, .motto, .muted, .pkg, .legend, .meta")) {
        if (getComputedStyle(el).display === "none") continue;
        const r = el.getBoundingClientRect();
        if (r.left < edge.left - 0.5 || r.right > edge.right + 0.5 || r.top < edge.top - 0.5 || r.bottom > edge.bottom + 0.5)
          out.push(`.${el.className || el.tagName.toLowerCase()} lies outside it`);
      }
      return out;
    });
    for (const problem of found) problems.push(`${width}x${height} /: the seal: ${problem}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) problems.push(`${width}x${height} /: page is ${overflow}px wider than the viewport`);
  }
}

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
  const touch = viewport.width <= phoneLayout;
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
    hasTouch: touch,
    isMobile: touch,
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
    if (path === "/") await checkHome(page, viewport.name, viewport.width, problems);
  }
  await page.close();
}
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (error) => problems.push(`seal sizes: page error: ${error.message}`));
  await page.goto(`http://localhost:${server.port}/`, { waitUntil: "networkidle" });
  await checkSealSizes(page, problems);
  await page.close();
}
await browser.close();
server.stop();

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`Screenshots in ${outDir}`);
