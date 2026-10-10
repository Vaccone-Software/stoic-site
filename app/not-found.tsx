import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { docs } from "@/lib/paths";

export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <>
      <div className="border-b border-rule">
        <div className="mx-auto w-full max-w-[1180px] px-5 py-5 md:px-10 lg:px-12">
          <SiteHeader />
        </div>
      </div>
      <main className="mx-auto grid min-h-[min(60svh,560px)] w-full max-w-[1180px] content-center gap-5 px-5 py-16 md:px-10 lg:px-12">
        <p className="font-mono text-[12.5px] text-accent">404</p>
        <h1 className="font-display text-[clamp(64px,10vw,150px)] leading-[0.86] uppercase">
          Nothing
          <br />
          <span className="text-accent">here.</span>
        </h1>
        <p className="max-w-[40ch] text-xl leading-snug">
          This address holds no page. It may have moved, or never been.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="bg-accent px-4 py-2.5 font-mono text-[13px] font-medium text-ground hover:brightness-110"
          >
            Back to the start
          </Link>
          <a
            href={docs()}
            className="border border-rule-strong px-4 py-2.5 font-mono text-[13px] hover:border-print"
          >
            Read the docs
          </a>
        </div>
      </main>
      <div className="border-t border-rule">
        <div className="mx-auto w-full max-w-[1180px]">
          <SiteFooter />
        </div>
      </div>
    </>
  );
}
