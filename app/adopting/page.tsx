import type { Metadata } from "next";
import { Doc, DocPage } from "@/components/DocPage";
import { renderDoc } from "@/lib/stoic";

export const metadata: Metadata = {
  title: "Adopting Stoic",
  description:
    "How to adopt Stoic in an existing Swift app one call site at a time: the package, the lint plugin, and what to replace first.",
};

export default async function Adopting() {
  const { html, title, headings } = await renderDoc("docs/Adopting.md");
  return (
    <DocPage
      current="adopting"
      eyebrow="Adopting"
      title={title ?? "Adopting Stoic"}
      toc={headings.filter((heading) => heading.depth === 2)}
    >
      <Doc html={html} />
    </DocPage>
  );
}
