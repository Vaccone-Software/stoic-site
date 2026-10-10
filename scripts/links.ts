// Crawls the static export and checks that every internal link and asset
// resolves to a file, and that every #fragment names an id on its page.
// Links into /docs are skipped: the DocC reference is built by another job
// and copied in after the export.
//
//   bun run build && bun run links      (same NEXT_PUBLIC_BASE_PATH as the build)
import { Glob } from "bun";
import { existsSync, statSync } from "node:fs";
import { join, posix } from "node:path";

const root = join(import.meta.dir, "..", "out");
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
if (!existsSync(root)) {
  console.error(`No ${root}. Run \`bun run build\` first.`);
  process.exit(1);
}

type Page = { links: string[]; ids: Set<string> };
const pages = new Map<string, Page>();

for await (const file of new Glob("**/*.html").scan(root)) {
  const links: string[] = [];
  const ids = new Set<string>();
  await new HTMLRewriter()
    .on("a[href], link[href], script[src], img[src], source[src]", {
      element(element) {
        const value = element.getAttribute("href") ?? element.getAttribute("src");
        if (value) links.push(value);
      },
    })
    .on("[id]", {
      element(element) {
        ids.add(element.getAttribute("id")!);
      },
    })
    .transform(new Response(await Bun.file(join(root, file)).text()))
    .text();
  pages.set(file, { links, ids });
}

/** The file in `out/` that a site path is served from, if there is one. */
function fileFor(path: string): string | undefined {
  const clean = decodeURIComponent(path).replace(/^\//, "");
  const candidates = clean === "" || clean.endsWith("/")
    ? [`${clean}index.html`]
    : [clean, `${clean}/index.html`, `${clean}.html`];
  return candidates.find((candidate) => {
    const full = join(root, candidate);
    return existsSync(full) && statSync(full).isFile();
  });
}

const problems: string[] = [];
let checked = 0;
let skipped = 0;
let external = 0;

for (const [file, page] of pages) {
  const here = `/${file}`;
  for (const raw of page.links) {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(raw)) {
      external++;
      continue;
    }
    // Relative links resolve against where the page is served, base path included.
    const url = new URL(raw, `http://site${basePath}${here}`);
    let path = url.pathname;
    if (basePath) {
      if (path !== basePath && !path.startsWith(`${basePath}/`)) {
        problems.push(`${file}: ${raw} is missing the base path ${basePath}`);
        continue;
      }
      path = path.slice(basePath.length) || "/";
    }
    if (path.startsWith("/docs/")) {
      skipped++;
      continue;
    }
    checked++;
    const target = fileFor(path);
    if (!target) {
      problems.push(`${file}: ${raw} does not resolve to a file`);
      continue;
    }
    const fragment = decodeURIComponent(url.hash.slice(1));
    if (fragment && target.endsWith(".html")) {
      const ids = pages.get(target)?.ids;
      if (!ids?.has(fragment))
        problems.push(`${file}: ${raw} names #${fragment}, which ${posix.join("/", target)} does not have`);
    }
  }
}

console.log(
  `${pages.size} pages, ${checked} internal links checked, ${skipped} into /docs skipped, ${external} external.`
);
if (problems.length > 0) {
  console.error([...new Set(problems)].join("\n"));
  process.exit(1);
}
