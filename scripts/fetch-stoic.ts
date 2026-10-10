// Downloads Stoic's main branch into .stoic when the build has no checkout to
// read: no STOIC_DIR and no ../stoic beside this site. That is the case on
// Vercel, which clones this repository alone. Runs before `next build`.
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { stoicDir } from "../lib/stoic";

const dir = stoicDir();
if (existsSync(dir)) {
  console.log(`Stoic: using ${dir}`);
} else {
  const target = resolve(process.cwd(), ".stoic");
  const url = "https://codeload.github.com/Vaccone-Software/stoic/tar.gz/refs/heads/main";
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Cannot download ${url}: ${response.status} ${response.statusText}`);
  const archive = join(process.cwd(), ".stoic.tgz");
  await Bun.write(archive, response);
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  const tar = Bun.spawnSync(["tar", "-xzf", archive, "-C", target, "--strip-components=1"]);
  await rm(archive);
  if (tar.exitCode !== 0) throw new Error(`Cannot unpack Stoic: ${tar.stderr.toString()}`);
  console.log(`Stoic: downloaded main into ${target}`);
}
