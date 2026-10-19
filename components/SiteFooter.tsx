import type { ReactNode } from "react";
import { loadVersion } from "@/lib/stoic";

/** The sign-off, on every page. A page may add its own notes below it. */
export async function SiteFooter({ children }: { children?: ReactNode }) {
  const version = await loadVersion();
  return (
    <footer className="grid gap-6 px-5 pt-10 pb-8 md:px-10 lg:px-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="font-display text-[clamp(36px,4.4vw,60px)] leading-[0.88] uppercase">
          Reliable async code
          <br />
          <span className="text-accent">for Swift.</span>
        </p>
        <span className="font-mono text-xs text-dim">
          Stoic {version} · Vaccone Software · Apache-2.0
        </span>
      </div>
      {children}
    </footer>
  );
}
