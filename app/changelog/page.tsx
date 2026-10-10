import type { Metadata } from "next";
import { Doc, DocPage } from "@/components/DocPage";
import { loadReleases } from "@/lib/stoic";

export const metadata: Metadata = {
  title: "Changelog",
  description: "Every release of Stoic, newest first, from its GitHub releases.",
};

export default async function Changelog() {
  const releases = await loadReleases();
  return (
    <DocPage
      current="changelog"
      eyebrow="Changelog"
      title="Releases"
      toc={releases.map((release) => ({
        id: release.id,
        text: release.tag,
        depth: 2,
      }))}
    >
      {releases.length === 0 ? (
        <p className="max-w-[72ch] text-lg text-body">
          Nothing has been released yet.
        </p>
      ) : (
        <div className="grid gap-14">
          {releases.map((release) => (
            <article
              key={release.id}
              aria-labelledby={release.id}
              className="grid gap-4 border-t border-rule pt-5"
            >
              <header className="grid gap-2">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[12.5px] text-dim">
                  <time dateTime={release.date}>{release.date}</time>
                  {release.prerelease && (
                    <span className="border border-accent px-1.5 py-0.5 text-[11px] text-accent uppercase">
                      Pre-release
                    </span>
                  )}
                  <a
                    href={release.url}
                    className="hover:text-print"
                  >
                    On GitHub →
                  </a>
                </div>
                <h2
                  id={release.id}
                  className="scroll-mt-6 font-display text-[clamp(40px,4.4vw,64px)] leading-[0.9] uppercase"
                >
                  {release.tag}
                </h2>
                {!release.name.includes(release.tag) && (
                  <p className="text-xl text-print">{release.name}</p>
                )}
              </header>
              <Doc html={release.html} />
            </article>
          ))}
        </div>
      )}
    </DocPage>
  );
}
