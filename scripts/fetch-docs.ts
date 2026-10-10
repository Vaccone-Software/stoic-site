// Adds Stoic's DocC reference to a static export served from the domain root
// (Vercel). The reference needs Xcode 27 to build, so GitHub Actions builds
// it and publishes it as docs-root.tgz alongside the GitHub Pages site; this
// unpacks it into public/docs before `next build`, so Next copies it into the
// export like any other static file. (Vercel collects the build output inside
// `next build`, so files added to out/ afterwards would not deploy.)
//
// The GitHub Pages build (base path /stoic-site) unpacks its own copy in the
// workflow, so this does nothing there. A failed download leaves the site
// without /docs and says so, rather than failing the whole deploy.
import { existsSync } from "node:fs";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const docs = join(process.cwd(), "public", "docs");
const url = "https://vaccone-software.github.io/stoic-site/docs-root.tgz";

if (process.env.NEXT_PUBLIC_BASE_PATH) {
  console.log("Docs: base path set, so the workflow adds them");
} else if (existsSync(docs)) {
  console.log("Docs: already in public/docs");
} else {
  const response = await fetch(url).catch((error: unknown) => error as Error);
  if (response instanceof Error || !response.ok) {
    const reason = response instanceof Error ? response.message : `${response.status} ${response.statusText}`;
    console.warn(`Docs: cannot download ${url} (${reason}); /docs will be missing from this deploy`);
  } else {
    const archive = join(process.cwd(), ".docs-root.tgz");
    await Bun.write(archive, response);
    await mkdir(docs, { recursive: true });
    const tar = Bun.spawnSync(["tar", "-xzf", archive, "-C", docs]);
    await rm(archive);
    if (tar.exitCode !== 0) {
      await rm(docs, { recursive: true, force: true });
      console.warn(`Docs: cannot unpack the reference: ${tar.stderr.toString()}`);
    } else {
      // The docs wear the site's favicon, not DocC's.
      await copyFile(join(process.cwd(), "app", "favicon.ico"), join(docs, "favicon.ico"));
      await copyFile(join(process.cwd(), "app", "icon.svg"), join(docs, "favicon.svg"));
      console.log("Docs: unpacked into public/docs");
    }
  }
}
