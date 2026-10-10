import type { Metadata } from "next";
import Link from "next/link";
import { Doc, DocPage } from "@/components/DocPage";
import {
  contractBySlug,
  loadContracts,
  renderDoc,
  type Contract,
} from "@/lib/stoic";

type Params = { params: Promise<{ slug: string }> };

// Only the contracts in design/ exist; anything else is the 404.
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await loadContracts()).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { contract } = await contractBySlug((await params).slug);
  return {
    title: `${contract.number} · ${contract.title}`,
    description: contract.summary,
  };
}

function Neighbour({
  contract,
  label,
  align,
}: {
  contract: Contract | undefined;
  label: string;
  align: "left" | "right";
}) {
  if (!contract) return <span />;
  return (
    <Link
      href={`/design/${contract.slug}/`}
      className={`group grid min-w-0 gap-1 border-t border-rule-strong pt-3 hover:border-accent ${
        align === "right" ? "text-right sm:col-start-2" : ""
      }`}
    >
      <span className="font-mono text-xs text-dim">
        {align === "left" ? "← " : ""}
        {label} · {contract.number}
        {align === "right" ? " →" : ""}
      </span>
      <span className="text-[1.2rem] leading-tight text-print group-hover:text-accent">
        {contract.title}
      </span>
    </Link>
  );
}

export default async function ContractPage({ params }: Params) {
  const { slug } = await params;
  const { contract, previous, next } = await contractBySlug(slug);
  const { html, headings } = await renderDoc(`design/${slug}.md`);
  return (
    <DocPage
      current="design"
      eyebrow={`Contract ${contract.number}`}
      title={contract.title}
      toc={headings.filter((heading) => heading.depth === 2)}
    >
      <Doc html={html} />
      <nav
        aria-label="Contracts"
        className="mt-16 grid max-w-[72ch] gap-6 sm:grid-cols-2"
      >
        <Neighbour contract={previous} label="Previous" align="left" />
        <Neighbour contract={next} label="Next" align="right" />
      </nav>
      <p className="mt-8 font-mono text-xs">
        <Link href="/design/" className="text-accent hover:underline">
          All contracts
        </Link>
      </p>
    </DocPage>
  );
}
