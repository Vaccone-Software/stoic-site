import type { Metadata } from "next";
import Link from "next/link";
import { Doc, DocPage } from "@/components/DocPage";
import { loadContracts, renderDoc } from "@/lib/stoic";

export const metadata: Metadata = {
  title: "Design",
  description:
    "The design of Stoic: its principles, its architecture, and one written contract for each primitive.",
};

export default async function Design() {
  const [{ html, title, headings }, contracts] = await Promise.all([
    renderDoc("DESIGN.md"),
    loadContracts(),
  ]);
  const toc = [
    ...headings.filter((heading) => heading.depth === 2 && heading.text !== "Contents"),
    { id: "contracts", text: "Every contract", depth: 2 },
  ];
  return (
    <DocPage
      current="design"
      eyebrow="Design"
      title={title ?? "Stoic design"}
      toc={toc}
    >
      <Doc html={html} />
      <section aria-labelledby="contracts" className="doc-index mt-[2.4em]">
        <h2
          id="contracts"
          className="scroll-mt-6 border-t border-rule pt-[0.9em] font-display text-[clamp(32px,3.2vw,44px)] leading-[0.95] tracking-[0.01em] uppercase"
        >
          Every contract
        </h2>
        <p className="mt-3 max-w-[72ch] text-lg text-body">
          Each primitive has its own contract: where the idea comes from, the
          API, what happens when things fail, and how it is tested.
        </p>
        <ol className="mt-6 border-t border-rule">
          {contracts.map((contract) => (
            <li key={contract.slug} className="border-b border-rule">
              <Link
                href={`/design/${contract.slug}/`}
                className="group grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-4 py-4 sm:grid-cols-[3.5rem_minmax(0,1fr)]"
              >
                <span className="pt-1 font-mono text-[12.5px] text-accent">
                  {contract.number}
                </span>
                <span className="grid min-w-0 gap-1">
                  <span className="text-[1.35rem] leading-tight text-print group-hover:text-accent">
                    {contract.title}
                  </span>
                  <span className="line-clamp-2 max-w-[72ch] text-base leading-snug text-dim">
                    {contract.summary}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </DocPage>
  );
}
