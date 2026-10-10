import type { ReactNode } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader, type NavSection } from "@/components/SiteHeader";
import type { Heading } from "@/lib/markdown";

/** The width of a reading page: the header, rail, article and footer share it. */
const frame = "mx-auto w-full max-w-[1180px]";
const gutter = "px-5 md:px-10 lg:px-12";

/**
 * The frame of a reading page: chrome, an eyebrow and a title, the article,
 * and on wide screens a sticky table of contents in a left rail.
 */
export function DocPage({
  current,
  eyebrow,
  title,
  toc = [],
  children,
}: {
  current?: NavSection;
  eyebrow: string;
  title: string;
  /** The page's h2s. Without two or more, there is no rail. */
  toc?: readonly Heading[];
  children: ReactNode;
}) {
  const rail = toc.length > 1;
  return (
    <>
      <div className="border-b border-rule">
        <div className={`${frame} ${gutter} py-5`}>
          <SiteHeader current={current} />
        </div>
      </div>
      <main
        className={`${frame} ${gutter} grid grid-cols-[minmax(0,1fr)] gap-x-12 pt-12 pb-20 ${
          rail ? "lg:grid-cols-[11.5rem_minmax(0,56rem)]" : "lg:grid-cols-[minmax(0,56rem)]"
        }`}
      >
        {rail && (
          <nav
            aria-label="On this page"
            className="sticky top-8 row-span-2 hidden self-start font-mono text-[12px] leading-snug lg:block"
          >
            <p className="mb-3 text-dim">On this page</p>
            <ol className="grid gap-2 border-l border-rule">
              {toc.map((heading) => (
                <li key={heading.id}>
                  <a
                    href={`#${heading.id}`}
                    className="-ml-px block border-l border-transparent pl-3 text-dim hover:border-accent hover:text-print"
                  >
                    {heading.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}
        <header
          className={`mb-10 grid min-w-0 gap-3 ${rail ? "lg:col-start-2" : ""}`}
        >
          <p className="font-mono text-[12.5px] text-accent">{eyebrow}</p>
          <h1 className="font-display text-[clamp(44px,6.4vw,92px)] leading-[0.88] uppercase">
            {title}
          </h1>
        </header>
        <div className={`min-w-0 ${rail ? "lg:col-start-2" : ""}`}>{children}</div>
      </main>
      <div className="border-t border-rule">
        <div className={frame}>
          <SiteFooter />
        </div>
      </div>
    </>
  );
}

/** Rendered Markdown, set in the reading style of `.doc`. */
export function Doc({ html }: { html: string }) {
  return <div className="doc" dangerouslySetInnerHTML={{ __html: html }} />;
}
