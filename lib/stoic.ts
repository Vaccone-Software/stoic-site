import { existsSync, statSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { posix, resolve } from "node:path";
import { Schema } from "effect";
import { inlineText, renderMarkdown, type Rendered } from "./markdown";
import { route } from "./paths";

// Everything the site reads from the library: the Markdown in a Stoic
// checkout and the repository's releases. Read at build time, decoded with
// Effect Schema, and fatal when wrong: a page built from nothing would ship
// quietly, which is worse than a failed build.

export const repository = "Vaccone-Software/stoic";
const repositoryUrl = `https://github.com/${repository}`;

/** The Stoic checkout: `STOIC_DIR`, or `../stoic` beside this site. */
export const stoicDir = () =>
  resolve(process.cwd(), process.env.STOIC_DIR ?? "../stoic");

async function readStoic(path: string): Promise<string> {
  const file = resolve(stoicDir(), path);
  try {
    return await readFile(file, "utf8");
  } catch (cause) {
    throw new Error(
      `Cannot read ${file}. The site builds its pages from a checkout of ${repositoryUrl}: ` +
        `point STOIC_DIR at one (default: ../stoic).`,
      { cause }
    );
  }
}

// MARK: Links

const scheme = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
const contractPath = /^design\/(\d{2}-[a-z0-9-]+)\.md$/;

/**
 * Where a link written in one of the library's Markdown files should go on
 * this site. Relative paths resolve against the file's own directory; the
 * pages that exist here map to routes, and any other path in the repository
 * to its page on GitHub.
 */
export function rewriteHref(href: string, from: string, slugs: ReadonlySet<string>): string {
  if (href === "" || href.startsWith("#") || scheme.test(href)) return href;
  const [target = "", ...rest] = href.split(/(?=[#?])/);
  const suffix = rest.join("");
  const anchor = suffix.startsWith("#") ? suffix : "";

  const path = target.startsWith("/")
    ? posix.normalize(target.slice(1))
    : posix.normalize(posix.join(posix.dirname(from), target));
  const where = `"${href}" in ${from}`;
  if (path.startsWith("..")) throw new Error(`Link ${where} leaves the repository.`);

  if (path === "DESIGN.md") return `${route("/design/")}${anchor}`;
  if (path === "docs/Adopting.md") return `${route("/adopting/")}${anchor}`;
  const contract = contractPath.exec(path)?.[1];
  if (contract) {
    if (!slugs.has(contract))
      throw new Error(`Link ${where} names a contract that does not exist.`);
    return `${route(`/design/${contract}/`)}${anchor}`;
  }

  const file = resolve(stoicDir(), path);
  if (!existsSync(file)) throw new Error(`Link ${where} points at a missing file.`);
  const kind = statSync(file).isDirectory() ? "tree" : "blob";
  return `${repositoryUrl}/${kind}/main/${path.replace(/\/$/, "")}${suffix}`;
}

function rewriteSrc(src: string, from: string): string {
  if (scheme.test(src)) return src;
  const path = posix.normalize(posix.join(posix.dirname(from), src));
  return `https://raw.githubusercontent.com/${repository}/main/${path}`;
}

/** A Markdown file of the library, as HTML, with the site's links. */
export async function renderDoc(path: string): Promise<Rendered> {
  const [file, contracts] = await Promise.all([readStoic(path), loadContracts()]);
  // A hand-written "Contents" list repeats the page's own table of contents.
  const source = file.replace(/^## Contents\n[\s\S]*?(?=^## )/m, "");
  const slugs = new Set(contracts.map((contract) => contract.slug));
  return renderMarkdown(source, {
    rewriteHref: (href) => rewriteHref(href, path, slugs),
    rewriteSrc: (src) => rewriteSrc(src, path),
    dropTitle: true,
  });
}

// MARK: Contracts

/** One design contract: `design/NN-name.md`. */
export class Contract extends Schema.Class<Contract>("Contract")({
  /** The filename without `.md`, and the page's address. */
  slug: Schema.String.check(Schema.isPattern(/^\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/)),
  /** The two-digit number, as written. */
  number: Schema.String.check(Schema.isPattern(/^\d{2}$/)),
  title: Schema.NonEmptyString,
  /** The contract's first paragraph, as plain text. */
  summary: Schema.NonEmptyString,
}) {}

const Contracts = Schema.NonEmptyArray(Contract);

async function readContract(file: string): Promise<unknown> {
  const slug = file.replace(/\.md$/, "");
  const source = await readStoic(`design/${file}`);
  const [heading = "", ...lines] = source.replace(/^\s+/, "").split("\n");
  const title = /^#\s+(\d{2})\s+·\s+(.+?)\s*$/.exec(heading);
  if (!title)
    throw new Error(
      `design/${file} must open with "# NN · Title"; it opens with "${heading}".`
    );
  const paragraph: string[] = [];
  const start = lines.findIndex((line) => line.trim() !== "");
  for (const line of start < 0 ? [] : lines.slice(start)) {
    if (line.trim() === "") break;
    paragraph.push(line.trim());
  }
  return {
    slug,
    number: title[1],
    title: inlineText(title[2]!),
    summary: inlineText(paragraph.join(" ")),
  };
}

let contracts: Promise<readonly Contract[]> | undefined;

/** Every contract in `design/`, in number order. */
export const loadContracts = (): Promise<readonly Contract[]> =>
  (contracts ??= (async () => {
    const dir = resolve(stoicDir(), "design");
    let names: string[];
    try {
      names = await readdir(dir);
    } catch (cause) {
      throw new Error(
        `Cannot list ${dir}. Point STOIC_DIR at a checkout of ${repositoryUrl}.`,
        { cause }
      );
    }
    const files = names.filter((name) => /^\d{2}-.+\.md$/.test(name)).sort();
    const decoded = Schema.decodeUnknownSync(Contracts)(
      await Promise.all(files.map(readContract))
    );
    for (const contract of decoded) {
      if (!contract.slug.startsWith(`${contract.number}-`))
        throw new Error(
          `design/${contract.slug}.md is numbered ${contract.number} in its title.`
        );
    }
    return decoded;
  })());

export async function contractBySlug(slug: string) {
  const all = await loadContracts();
  const index = all.findIndex((contract) => contract.slug === slug);
  if (index < 0) throw new Error(`No contract ${slug}`);
  return { contract: all[index]!, previous: all[index - 1], next: all[index + 1] };
}

// MARK: Releases

/** The parts of a GitHub release the changelog shows. */
export class Release extends Schema.Class<Release>("Release")({
  tag_name: Schema.NonEmptyString,
  name: Schema.NullOr(Schema.String),
  html_url: Schema.NonEmptyString,
  published_at: Schema.NullOr(Schema.String),
  prerelease: Schema.Boolean,
  draft: Schema.Boolean,
  body: Schema.NullOr(Schema.String),
}) {}

const Releases = Schema.Array(Release);

/** A release with its notes rendered. */
export interface RenderedRelease {
  readonly tag: string;
  readonly id: string;
  readonly name: string;
  readonly url: string;
  /** `YYYY-MM-DD`, in UTC. */
  readonly date: string;
  readonly prerelease: boolean;
  readonly html: string;
}

const perPage = 100;

async function fetchReleases(): Promise<readonly Release[]> {
  const token = process.env.GITHUB_TOKEN;
  const all: Release[] = [];
  for (let page = 1; ; page++) {
    const url = `https://api.github.com/repos/${repository}/releases?per_page=${perPage}&page=${page}`;
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "stoic-site-build",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(30_000),
      });
    } catch (cause) {
      throw new Error(
        `Could not reach the GitHub API to list the releases of ${repository} (${url}). ` +
          `The changelog is built from them, so the build stops here.`,
        { cause }
      );
    }
    if (!response.ok) {
      const hint =
        response.status === 403 || response.status === 429
          ? " This is usually the unauthenticated rate limit: set GITHUB_TOKEN to a token that can read public repositories."
          : "";
      throw new Error(
        `GitHub answered ${response.status} ${response.statusText} for the releases of ${repository} (${url}).${hint}`
      );
    }
    const batch = Schema.decodeUnknownSync(Releases)(await response.json());
    all.push(...batch);
    if (batch.length < perPage) return all;
  }
}

let releases: Promise<readonly RenderedRelease[]> | undefined;

/** The repository's published releases, newest first, notes rendered. */
export const loadReleases = (): Promise<readonly RenderedRelease[]> =>
  (releases ??= (async () => {
    const published = (await fetchReleases())
      .filter((release) => !release.draft && release.published_at !== null)
      .sort((a, b) => b.published_at!.localeCompare(a.published_at!));
    return Promise.all(
      published.map(async (release) => {
        const id = `release-${release.tag_name.replace(/[^A-Za-z0-9._-]+/g, "-")}`;
        const { html } = await renderMarkdown(release.body ?? "", {
          // Notes are written on GitHub, where links are already absolute.
          rewriteHref: (href) => href,
          rewriteSrc: (src) => src,
          idPrefix: id,
          headingOffset: 1,
        });
        return {
          tag: release.tag_name,
          id,
          name: release.name || release.tag_name,
          url: release.html_url,
          date: release.published_at!.slice(0, 10),
          prerelease: release.prerelease,
          html,
        };
      })
    );
  })());
