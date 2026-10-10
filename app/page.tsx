import { Install } from "@/components/Install";
import { PlateCanvas } from "@/components/PlateCanvas";
import { plateById, site } from "@/content/site";

const nav = [
  { label: "Guide", href: `${site.repository}/blob/main/docs/Adopting.md` },
  { label: "Design", href: `${site.repository}/blob/main/DESIGN.md` },
  { label: "Changelog", href: `${site.repository}/releases` },
  { label: "GitHub", href: site.repository },
];

export default function Home() {
  const atlas = plateById("atlas");
  return (
    <main>
      {/* First screen: everything needed to understand Stoic, without scrolling. */}
      <section className="grid min-h-[min(100svh,800px)] grid-cols-1 border-b border-rule md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr_auto] gap-5 px-5 pt-5 pb-8 md:px-10 lg:px-12">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-display text-[30px] leading-none tracking-[0.14em]">
              STOIC
            </span>
            <nav
              aria-label="Primary"
              className="flex flex-wrap gap-5 font-mono text-[12.5px] text-dim"
            >
              {nav.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="hover:text-print"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </header>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-center gap-5 py-6">
            <p className="font-mono text-[12.5px] text-accent">
              Swift package · {site.version} · Apache-2.0
            </p>
            <h1 className="font-display text-[clamp(64px,8.4vw,126px)] leading-[0.86] uppercase">
              Holds the
              <br />
              <span className="text-accent">weight.</span>
            </h1>
            <p className="max-w-[36ch] text-xl leading-snug">
              Stoic is a Swift library for async code that has to keep working
              when the network, the disk, or another service does not.
            </p>
            <ul className="grid max-w-[480px] grid-cols-1 gap-x-5 gap-y-1.5 font-mono text-[12.5px] text-body sm:grid-cols-2">
              {site.capabilities.map((capability) => (
                <li
                  key={capability}
                  className="before:mr-1 before:text-accent before:content-['—']"
                >
                  {capability}
                </li>
              ))}
            </ul>
            <Install
              options={[
                { label: "Terminal", command: site.install.terminal },
                { label: "Package.swift", command: site.install.manifest },
                { label: "Xcode", command: site.install.xcode },
              ]}
            />
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={`${site.repository}/blob/main/docs/Adopting.md`}
                className="bg-accent px-4 py-2.5 font-mono text-[13px] font-medium text-ground hover:brightness-110"
              >
                Read the guide
              </a>
              <a
                href={site.repository}
                className="border border-rule-strong px-4 py-2.5 font-mono text-[13px] hover:border-print"
              >
                View on GitHub
              </a>
              <span className="font-mono text-[11.5px] text-dim">
                Swift 6.4 · iOS, macOS and visionOS 27
              </span>
            </div>
          </div>
          <div />
        </div>
        <figure className="relative m-0 min-w-0 border-t border-rule md:border-t-0 md:border-l">
          <PlateCanvas
            src="/plates/atlas.jpg"
            width={700}
            height={760}
            seed={4}
            invert={atlas.invert}
            description={atlas.description}
            className="h-full max-h-[70svh] w-full object-cover md:max-h-none"
          />
          <figcaption className="absolute bottom-4 left-4 bg-ground/90 px-2.5 py-1 font-plate text-sm text-body italic">
            <span className="mr-2 text-accent not-italic">
              Pl. {atlas.numeral}
            </span>
            {atlas.caption}
          </figcaption>
        </figure>
      </section>

      {/* The colonnade: the whole library on one screen. */}
      <section
        aria-labelledby="what"
        className="grid gap-7 px-5 py-14 md:px-10 lg:px-12"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2
            id="what"
            className="font-display text-[clamp(48px,5.6vw,84px)] leading-[0.86] uppercase"
          >
            What it does
          </h2>
          <p className="max-w-[46ch] text-body">
            Each part is a small set of plain Swift functions and types, with a
            written contract for what happens when things fail. Use one, or all
            of them.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {site.primitives.map((primitive, index) => {
            const plate = plateById(primitive.plate);
            return (
              <article
                key={primitive.area}
                className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-2.5"
              >
                <figure className="relative m-0">
                  <PlateCanvas
                    src={`/plates/${plate.id}.jpg`}
                    width={400}
                    height={550}
                    seed={9 + index * 5}
                    scrape={plate.scrape}
                    invert={plate.invert}
                    description={plate.description}
                    className="w-full"
                  />
                </figure>
                <span className="font-mono text-xs text-accent">
                  {primitive.area}
                </span>
                <h3 className="font-display text-[clamp(32px,3vw,42px)] leading-[0.9] uppercase">
                  {primitive.title}
                </h3>
                <p className="text-base text-body">{primitive.summary}</p>
                <pre className="border border-rule bg-raised px-2.5 py-2 font-mono text-[11.5px] leading-relaxed break-words whitespace-pre-wrap">
                  <code>{primitive.code}</code>
                </pre>
                <p className="font-plate text-sm text-dim italic">
                  Pl. {plate.numeral} · {plate.caption}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section
        aria-label="How Stoic is held to account"
        className="mx-5 grid grid-cols-2 border-y border-rule md:mx-10 md:grid-cols-5 lg:mx-12"
      >
        {site.facts.map((fact, index) => (
          <div
            key={fact.label}
            className={`grid gap-1 py-6 pr-5 ${
              index > 0 ? "md:border-l md:border-rule md:pl-5" : ""
            } border-t border-rule md:border-t-0`}
          >
            <span className="font-display text-[clamp(44px,5vw,70px)] leading-[0.88]">
              {fact.value}
            </span>
            <span className="font-mono text-xs text-dim">{fact.label}</span>
          </div>
        ))}
      </section>

      <footer className="grid gap-6 px-5 pt-10 pb-8 md:px-10 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <p className="font-display text-[clamp(36px,4.4vw,60px)] leading-[0.88] uppercase">
            Reliable async code
            <br />
            <span className="text-accent">for Swift.</span>
          </p>
          <span className="font-mono text-xs text-dim">
            Stoic {site.version} · Vaccone Software · Apache-2.0
          </span>
        </div>
        <details className="font-mono text-xs text-dim">
          <summary className="cursor-pointer hover:text-print">
            Image credits
          </summary>
          <ul className="mt-3 grid gap-1">
            {site.plates.map((plate) => (
              <li key={plate.id}>
                Pl. {plate.numeral}: {plate.credit} ({plate.license}).
                Re-printed in two colours; marble, arches, rays and scraping are
                generated.
              </li>
            ))}
          </ul>
        </details>
      </footer>
    </main>
  );
}
