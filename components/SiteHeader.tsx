import Link from "next/link";
import { Mark } from "@/components/Mark";
import { site } from "@/content/site";
import { docs } from "@/lib/paths";

export type NavSection = "adopting" | "design" | "changelog";

// The DocC reference and GitHub are not pages of this app, so they are plain
// links; the rest go through next/link, which adds the base path.
const nav: readonly (
  | { label: string; href: string; external: true }
  | { label: string; href: string; section: NavSection }
)[] = [
  { label: "Docs", href: docs(), external: true },
  { label: "Adopting", href: "/adopting/", section: "adopting" },
  { label: "Design", href: "/design/", section: "design" },
  { label: "Changelog", href: "/changelog/", section: "changelog" },
  { label: "GitHub", href: site.repository, external: true },
];

/** The wordmark and the primary navigation, on every page. */
export function SiteHeader({ current }: { current?: NavSection }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <Link
        href="/"
        aria-label="Stoic home"
        className="flex items-center gap-2.5 font-display text-[30px] leading-none tracking-[0.14em]"
      >
        <Mark className="size-7 shrink-0" />
        <span aria-hidden="true">STOIC</span>
      </Link>
      <nav
        aria-label="Primary"
        className="flex flex-wrap gap-5 font-mono text-[12.5px] text-dim"
      >
        {nav.map((item) => {
          const className =
            "section" in item && item.section === current
              ? "text-print"
              : "hover:text-print";
          return "external" in item ? (
            <a key={item.label} href={item.href} className={className}>
              {item.label}
            </a>
          ) : (
            <Link
              key={item.label}
              href={item.href}
              className={className}
              aria-current={item.section === current ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
