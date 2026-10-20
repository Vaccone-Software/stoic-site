import type { Metadata } from "next";
import { DocPage } from "@/components/DocPage";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "Credits",
  description:
    "Where the engraved plates on the Stoic homepage come from, and their licences.",
};

export default function Credits() {
  return (
    <DocPage eyebrow="Credits" title="Image credits">
      <div className="doc">
        <p>
          Each plate on the homepage is re-printed as live static, in two
          colours and cropped to its tile; the gold seams and cracks are drawn.
        </p>
        <ul>
          {site.plates.map((plate) => (
            <li key={plate.id}>
              Pl. {plate.numeral}: {plate.credit} ({plate.license}).
              {plate.source && (
                <>
                  {" "}
                  <a href={plate.source}>Source</a>.
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </DocPage>
  );
}
