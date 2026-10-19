import { Mosaic } from "@/components/Mosaic";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { plateById, site } from "@/content/site";
import { loadVersion } from "@/lib/stoic";

export default async function Home() {
  const version = await loadVersion();
  // Plain objects: a client component cannot be handed the schema's classes.
  const tiles = site.mosaic.tiles.map((tile) => ({
    id: tile.id,
    name: tile.name,
    row: tile.row,
    column: tile.column,
    rows: tile.rows,
    columns: tile.columns,
    plate: tile.plate,
    invert: plateById(tile.plate).invert,
    crop: tile.crop,
    what: tile.what,
    use: tile.use,
    failure: tile.failure,
    recovery: tile.recovery,
  }));
  return (
    <>
      {/* The first screen is the whole floor, under the header. */}
      <div className="flex min-h-svh flex-col">
        <div className="border-b border-rule">
          <div className="mx-auto w-full max-w-[1180px] px-5 py-5 md:px-10 lg:px-12">
            <SiteHeader />
          </div>
        </div>
        <main className="flex flex-1 flex-col">
          <Mosaic
            rows={site.mosaic.rows}
            columns={site.mosaic.columns}
            seal={site.mosaic.seal}
            tiles={tiles}
            motto={site.seal.motto}
            summary={site.seal.summary}
            emphasis={site.seal.emphasis}
            repository={site.repository}
            version={version}
          />
        </main>
      </div>

      <SiteFooter>
        <details className="font-mono text-xs text-dim">
          <summary className="cursor-pointer hover:text-print">
            Image credits
          </summary>
          <ul className="mt-3 grid gap-1">
            {site.plates.map((plate) => (
              <li key={plate.id}>
                Pl. {plate.numeral}: {plate.credit} ({plate.license}).
                {plate.source && (
                  <>
                    {" "}
                    <a
                      href={plate.source}
                      className="underline underline-offset-2 hover:text-print"
                    >
                      Source
                    </a>
                    .
                  </>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3">
            Each plate is re-printed as live static, in two colours and cropped
            to its tile; the gold seams and cracks are drawn.
          </p>
        </details>
      </SiteFooter>
    </>
  );
}
