import { Schema } from "effect";

// The site's content, declared once and decoded when the site builds: a
// plate with a missing credit, a tile on an unknown plate, or a mosaic with a
// hole in it fails `next build`, rather than shipping a broken page.

const PlateId = Schema.Literals([
  "atlas",
  "time",
  "sisyphus",
  "hydra",
  "reason",
  "clock",
  "machine",
  "lathe",
  "case",
  "rope",
  "iron",
]);
export type PlateId = (typeof PlateId)["Type"];

const Pixels = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1));
const Offset = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

/** One engraving or painting, with where it came from. */
export class Plate extends Schema.Class<Plate>("Plate")({
  id: PlateId,
  numeral: Schema.NonEmptyString,
  caption: Schema.NonEmptyString,
  /** Shown to assistive technology in place of the image. */
  description: Schema.NonEmptyString,
  credit: Schema.NonEmptyString,
  /**
   * The licence the source file page states. Everything but a CC BY-SA file
   * is public domain or CC0, which ask for nothing; CC BY-SA asks for credit
   * and for an adaptation to be shared under the same licence.
   */
  license: Schema.Literals(["Public domain", "CC0", "CC BY-SA 4.0"]),
  /** The file's page at the source, where the credit above can be checked. */
  source: Schema.optionalKey(Schema.NonEmptyString),
  /** The size of the file in `public/plates`, which a tile's crop is measured in. */
  width: Pixels,
  height: Pixels,
  /**
   * Whether to print the image as a negative. Line engravings on white paper
   * are inverted so their lines print bright; tonal works (paintings,
   * mezzotints, dark skies) print as they are.
   */
  invert: Schema.Boolean,
}) {}

const Crop = Schema.Tuple([Offset, Offset, Pixels, Pixels]);

/** One part of Stoic, as a tile of the mosaic. */
export class Tile extends Schema.Class<Tile>("Tile")({
  id: Schema.String.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/)),
  name: Schema.NonEmptyString,
  /** Where it lies on the floor, in cells from the top left, and how many it covers. */
  row: Offset,
  column: Offset,
  rows: Pixels,
  columns: Pixels,
  plate: PlateId,
  /** The part of the plate to print, as x, y, width, height in the plate's pixels; the whole plate if absent. */
  crop: Schema.optionalKey(Crop),
  /** What it is, and when to use it: the legend reads these on hover. */
  what: Schema.NonEmptyString,
  use: Schema.NonEmptyString,
  /** The failure the tile suffers when it cracks, and what is said once it is mended. */
  failure: Schema.NonEmptyString,
  recovery: Schema.NonEmptyString,
}) {}

const Cells = Schema.Struct({
  row: Offset,
  column: Offset,
  rows: Pixels,
  columns: Pixels,
});

const Mosaic = Schema.Struct({
  rows: Pixels,
  columns: Pixels,
  /** The block in the middle that holds the name and the legend. */
  seal: Cells,
  tiles: Schema.NonEmptyArray(Tile),
});

const Content = Schema.Struct({
  repository: Schema.NonEmptyString,
  seal: Schema.Struct({
    motto: Schema.NonEmptyString,
    summary: Schema.NonEmptyString,
    emphasis: Schema.NonEmptyString,
  }),
  plates: Schema.NonEmptyArray(Plate),
  mosaic: Mosaic,
}).check(
  Schema.makeFilter((content) => {
    const issues: Array<Schema.FilterIssue> = [];
    const plates = new Map(content.plates.map((plate) => [plate.id, plate]));
    if (plates.size !== content.plates.length)
      issues.push({ path: ["plates"], issue: "A plate is declared twice." });

    const { rows, columns, seal, tiles } = content.mosaic;
    // Every cell of the floor belongs to the seal or to exactly one tile.
    const owner = new Map<string, string>();
    const claim = (name: string, at: typeof seal, path: ReadonlyArray<PropertyKey>) => {
      if (at.row + at.rows > rows || at.column + at.columns > columns)
        issues.push({ path, issue: `${name} runs off the ${columns} by ${rows} floor.` });
      for (let r = at.row; r < at.row + at.rows; r++)
        for (let c = at.column; c < at.column + at.columns; c++) {
          const key = `${r},${c}`;
          const other = owner.get(key);
          if (other !== undefined)
            issues.push({ path, issue: `${name} overlaps ${other} at row ${r}, column ${c}.` });
          owner.set(key, name);
        }
    };
    claim("the seal", seal, ["mosaic", "seal"]);
    const ids = new Set<string>();
    tiles.forEach((tile, index) => {
      const path = ["mosaic", "tiles", index];
      if (ids.has(tile.id)) issues.push({ path, issue: `Tile ${tile.id} is declared twice.` });
      ids.add(tile.id);
      claim(`tile ${tile.id}`, tile, path);
      const plate = plates.get(tile.plate);
      if (!plate) {
        issues.push({ path: [...path, "plate"], issue: `Tile ${tile.id} names a plate that is not declared.` });
        return;
      }
      const [x, y, w, h] = tile.crop ?? [0, 0, plate.width, plate.height];
      if (x + w > plate.width || y + h > plate.height)
        issues.push({
          path: [...path, "crop"],
          issue: `Tile ${tile.id} crops outside plate ${plate.id}, which is ${plate.width} by ${plate.height}.`,
        });
    });
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < columns; c++)
        if (!owner.has(`${r},${c}`))
          issues.push({ path: ["mosaic"], issue: `Row ${r}, column ${c} is covered by nothing.` });
    return issues;
  })
);

const repository = "https://github.com/Vaccone-Software/stoic";

export const site = Schema.decodeUnknownSync(Content)({
  repository,
  seal: {
    motto: "Swift that keeps working",
    summary: "A Swift framework for the parts of an app that fail.",
    emphasis: "Written for coding agents.",
  },
  plates: [
    {
      id: "atlas",
      numeral: "I",
      caption: "Atlas bears the heavens",
      description:
        "An engraving of Atlas on a mountaintop carrying the starry sky.",
      credit: "Atlas porte le ciel sur ses épaules, Paris Musées GB00202",
      license: "Public domain",
      width: 711,
      height: 1000,
      invert: false,
    },
    {
      id: "time",
      numeral: "II",
      caption: "Time among the statues",
      description:
        "An engraving of winged Time raising his scythe among classical statues.",
      credit:
        "Prudence restrains Time from destroying ancient statues, Rijksmuseum RP-P-1878-A-1201",
      license: "CC0",
      width: 656,
      height: 1000,
      invert: true,
    },
    {
      id: "sisyphus",
      numeral: "III",
      caption: "Sisyphus and the stone",
      description: "A mezzotint of Sisyphus carrying his boulder.",
      credit:
        "Sisyphus carries a boulder up the hill, Rijksmuseum RP-P-OB-29.224",
      license: "CC0",
      width: 1000,
      height: 900,
      invert: false,
    },
    {
      id: "hydra",
      numeral: "IV",
      caption: "The Hydra of Lerna",
      description:
        "An engraving of a sculpture of Hercules fighting the Hydra.",
      credit:
        "Hercules kills the Hydra of Lerna, Rijksmuseum RP-P-1888-A-13803",
      license: "CC0",
      width: 697,
      height: 1000,
      invert: true,
    },
    {
      id: "reason",
      numeral: "V",
      caption: "The sleep of reason, after Goya",
      description:
        "Goya's etching of a sleeping figure surrounded by owls and bats.",
      credit:
        "Francisco de Goya, El sueño de la razón produce monstruos, Los Caprichos plate 43, The Metropolitan Museum of Art",
      license: "CC0",
      width: 678,
      height: 1000,
      invert: true,
    },
    {
      id: "clock",
      numeral: "VI",
      caption: "A weight-driven alarm",
      description:
        "An engraving of the works of a weight-driven alarm clock: gears, a ratchet, and two cords hung with weights.",
      credit:
        "Réveil à poids, Horlogerie, in Diderot and d'Alembert, Encyclopédie, c. 1766, BnF Gallica",
      license: "Public domain",
      source: "https://commons.wikimedia.org/wiki/File:R%C3%A9veil_%C3%A0_poids.jpg",
      width: 960,
      height: 2053,
      invert: true,
    },
    {
      id: "machine",
      numeral: "VII",
      caption: "The mirror-polishing machine",
      description:
        "An engraved cutaway of a workshop at San Ildefonso, showing the machine that polishes plate glass.",
      credit:
        "Glaces, Élévation perspective de la Machine à polir les Glaces, Établie à St. Ildefonse, engraved by Robert Bénard, in Diderot and d'Alembert, Recueil de planches, 1765, Internet Archive Book Images",
      license: "Public domain",
      source:
        "https://commons.wikimedia.org/wiki/File:Recueil_de_planches,_sur_les_sciences,_les_arts_lib%C3%A9raux,_et_les_arts_m%C3%A9chaniques_-_avec_leur_explication_(1765)_(14761524246).jpg",
      width: 960,
      height: 752,
      invert: true,
    },
    {
      id: "lathe",
      numeral: "VIII",
      caption: "A machine for rounding ratchets",
      description:
        "An engraving of a watchmaker's machine for cutting ratchet wheels, drawn in plan with its parts beside it.",
      credit:
        "Horlogerie, Machine pour arrondir les Rochets, in Diderot and d'Alembert, Recueil de planches, 1765, Internet Archive Book Images",
      license: "Public domain",
      source:
        "https://commons.wikimedia.org/wiki/File:Recueil_de_planches,_sur_les_sciences,_les_arts_lib%C3%A9raux,_et_les_arts_m%C3%A9chaniques_-_avec_leur_explication_(1765)_(14597925199).jpg",
      width: 960,
      height: 1602,
      invert: true,
    },
    {
      id: "case",
      numeral: "IX",
      caption: "The compositor's case",
      description:
        "An engraving of a printer's type case: the layout of its boxes of letters, and the sloping frame that holds it.",
      credit:
        "Imprimerie, Casse, Planche III, in Diderot and d'Alembert, Encyclopédie, BnF Gallica, as published on Wikimedia Commons under CC BY-SA 4.0. Printed here in two colours and cropped, an adaptation that is shared under the same licence",
      license: "CC BY-SA 4.0",
      source:
        "https://commons.wikimedia.org/wiki/File:Planche_encyclop%C3%A9die_imprimerie_3_Casse.jpg",
      width: 763,
      height: 1207,
      invert: true,
    },
    {
      id: "rope",
      numeral: "X",
      caption: "The ropewalk",
      description:
        "An engraving of a covered ropewalk where workers twist hemp into rope, and below it the spinning wheel and the parts of a rope.",
      credit:
        "Corderie, Planche II, in Diderot and d'Alembert, Encyclopédie, planches vol. III, 1763, Bibliothèque Mazarine",
      license: "Public domain",
      source:
        "https://commons.wikimedia.org/wiki/File:EncycloBibMaz_Tome03_Corderie_Pl02-a.png",
      width: 960,
      height: 757,
      invert: true,
    },
    {
      id: "iron",
      numeral: "XI",
      caption: "Wrought-iron ornament",
      description:
        "An engraving of ironwork designs: a garland of vines with a goat, a vase on a capital, and scrolling brackets.",
      credit:
        "Serrurerie, Grands Ouvrages, Couronnement, Vase et Porte-Enseignes, Pl. XVII, Rijksmuseum RP-P-1998-89",
      license: "CC0",
      source:
        "https://commons.wikimedia.org/wiki/File:Hekwerk_en_sloten_Serrurerie,_Grands_Ouvrages,_Couronnement,_Vase_et_Porte-Enseignes._(titel_op_object),_RP-P-1998-89.jpg",
      width: 960,
      height: 1491,
      invert: true,
    },
  ],
  mosaic: {
    rows: 5,
    columns: 10,
    seal: { row: 1, column: 3, rows: 3, columns: 4 },
    tiles: [
      {
        id: "deadlines",
        name: "Deadlines",
        row: 0,
        column: 0,
        rows: 1,
        columns: 2,
        plate: "clock",
        crop: [60, 240, 840, 560],
        what:
          "Every await gets a time limit. When it passes, the work is cancelled and its cleanup still runs.",
        use: "For any call to something you do not control.",
        failure: "no answer in 5 s",
        recovery: "cancelled · cleanup ran",
      },
      {
        id: "retries",
        name: "Retries",
        row: 0,
        column: 2,
        rows: 1,
        columns: 1,
        plate: "sisyphus",
        what:
          "Tries again with backoff, within a budget, and never past the caller's deadline.",
        use: "For calls that fail now and then: the network, a busy server.",
        failure: "attempt 1 failed: offline",
        recovery: "attempt 3 · succeeded",
      },
      {
        id: "downloads",
        name: "Downloads",
        row: 0,
        column: 3,
        rows: 1,
        columns: 2,
        plate: "rope",
        crop: [0, 15, 960, 300],
        what:
          "Large files that resume where they stopped and are checked as the bytes arrive.",
        use: "For models, updates, anything too big to fetch twice.",
        failure: "connection lost at 41%",
        recovery: "resumed · checksum verified",
      },
      {
        id: "supervision",
        name: "Supervision",
        row: 0,
        column: 5,
        rows: 1,
        columns: 1,
        plate: "hydra",
        what:
          "Watches long-running services and restarts one that crashes, with limits so a broken one stops.",
        use: "For background engines: sync, indexers, taps.",
        failure: "sync crashed",
        recovery: "restarted by its supervisor",
      },
      {
        id: "graph",
        name: "Service graph",
        row: 0,
        column: 6,
        rows: 1,
        columns: 2,
        plate: "machine",
        crop: [0, 60, 960, 500],
        what:
          "Starts services in the order they depend on each other, and stops them in reverse.",
        use: "For an app whose database, sync and model need each other.",
        failure: "database failed to open",
        recovery: "nothing that needs it started",
      },
      {
        id: "scopes",
        name: "Scopes",
        row: 0,
        column: 8,
        rows: 1,
        columns: 1,
        plate: "lathe",
        crop: [250, 350, 640, 700],
        what:
          "Whatever a scope opens is closed when it ends, on success, error or cancel.",
        use: "For sockets, files and sessions.",
        failure: "cancelled mid-request",
        recovery: "socket closed anyway",
      },
      {
        id: "shaping",
        name: "Debounce & throttle",
        row: 0,
        column: 9,
        rows: 2,
        columns: 1,
        plate: "time",
        what:
          "Runs the last of a burst once it is quiet, lets one call through per interval, serves a stale value while fetching a fresh one.",
        use: "For search as you type, scrolling, refreshing.",
        failure: "40 keystrokes in 2 s",
        recovery: "1 search, after the pause",
      },
      {
        id: "breakers",
        name: "Circuit breakers",
        row: 1,
        column: 0,
        rows: 2,
        columns: 1,
        plate: "machine",
        crop: [250, 80, 480, 660],
        what:
          "Stops calling a service that keeps failing, so your app fails fast instead of waiting.",
        use: "For any dependency that can go down: an API, a payment provider.",
        failure: "api failing",
        recovery: "breaker open · refused fast",
      },
      {
        id: "outbox",
        name: "Outbox",
        row: 1,
        column: 1,
        rows: 1,
        columns: 2,
        plate: "rope",
        crop: [0, 380, 960, 370],
        what:
          "Saves a request to disk first, then delivers it exactly once, across offline spells and restarts.",
        use: "For orders, feedback, anything that must arrive once.",
        failure: "sent while offline",
        recovery: "delivered once on reconnect",
      },
      {
        id: "http",
        name: "HTTP",
        row: 1,
        column: 7,
        rows: 1,
        columns: 1,
        plate: "rope",
        crop: [480, 380, 470, 370],
        what:
          "A client with deadlines, retries, breakers and idempotency keys built in.",
        use: "For talking to your API without writing that plumbing.",
        failure: "503 from the server",
        recovery: "retried with backoff · 200",
      },
      {
        id: "limits",
        name: "Rate limits",
        row: 1,
        column: 8,
        rows: 1,
        columns: 1,
        plate: "clock",
        crop: [150, 1450, 660, 560],
        what:
          "Keeps you under what a service will accept, and caps how much runs at once.",
        use: "For third-party APIs with quotas.",
        failure: "burst of 400 requests",
        recovery: "paced to 50 a second",
      },
      {
        id: "atomic",
        name: "Atomic files",
        row: 2,
        column: 1,
        rows: 1,
        columns: 1,
        plate: "case",
        crop: [40, 70, 680, 420],
        what:
          "A write lands whole or not at all, even if the power goes mid-write.",
        use: "For any file you cannot afford to lose half of.",
        failure: "power lost mid-write",
        recovery: "old file whole",
      },
      {
        id: "journals",
        name: "Journals",
        row: 2,
        column: 2,
        rows: 2,
        columns: 1,
        plate: "case",
        crop: [60, 560, 660, 620],
        what:
          "An append-only log that survives crashes: a torn last record is cut, never misread.",
        use: "For history, queues and event logs.",
        failure: "crash mid-append",
        recovery: "torn tail cut · 0 lost",
      },
      {
        id: "sealed",
        name: "Sealed storage",
        row: 2,
        column: 7,
        rows: 2,
        columns: 2,
        plate: "iron",
        crop: [60, 80, 840, 1170],
        what:
          "Encrypts data at rest with keys kept in the Keychain. Deleting a record destroys its key.",
        use: "For clipboards, health data, anything private.",
        failure: "folder copied by another app",
        recovery: "ciphertext only",
      },
      {
        id: "keychain",
        name: "Keychain",
        row: 2,
        column: 9,
        rows: 1,
        columns: 1,
        plate: "iron",
        crop: [500, 100, 400, 400],
        what:
          "Secrets that outlive a launch, and a locked keychain is never mistaken for a missing key.",
        use: "For tokens, keys and passwords.",
        failure: "keychain locked",
        recovery: "paused, nothing overwritten",
      },
      {
        id: "settings",
        name: "Settings",
        row: 3,
        column: 0,
        rows: 1,
        columns: 1,
        plate: "case",
        crop: [380, 70, 330, 330],
        what:
          "A settings file people can edit by hand, never overwritten when they break it.",
        use: "For config files and preferences.",
        failure: "file broken by hand",
        recovery: "last good value kept",
      },
      {
        id: "schema",
        name: "Schema",
        row: 3,
        column: 1,
        rows: 1,
        columns: 1,
        plate: "case",
        crop: [40, 330, 680, 300],
        what:
          "Decodes, validates and repairs data, naming every problem with its line and column.",
        use: "For config, payloads, anything people type.",
        failure: "\"scrol\": 99999",
        recovery: "did you mean scroll? · clamped",
      },
      {
        id: "events",
        name: "Observability",
        row: 3,
        column: 9,
        rows: 2,
        columns: 1,
        plate: "atlas",
        what:
          "Every retry, timeout and restart is a named event you can log, count and alert on.",
        use: "For seeing what your app did in production.",
        failure: "3 restarts in a minute",
        recovery: "reported, by name",
      },
      {
        id: "simulation",
        name: "Simulation",
        row: 4,
        column: 0,
        rows: 1,
        columns: 2,
        plate: "reason",
        crop: [0, 200, 678, 380],
        what:
          "Runs a test across thousands of seeded schedules. A failing seed replays exactly.",
        use: "For races and timing bugs.",
        failure: "seed 4,812 · race in the cache",
        recovery: "same failure, every run",
      },
      {
        id: "clock",
        name: "Test clock",
        row: 4,
        column: 2,
        rows: 1,
        columns: 1,
        plate: "clock",
        crop: [200, 40, 560, 420],
        what:
          "Time you move by hand, so a 30-second timeout is tested in microseconds.",
        use: "For anything that waits.",
        failure: "waiting 30 s",
        recovery: "advanced by hand · 0.2 ms",
      },
      {
        id: "machines",
        name: "State machines",
        row: 4,
        column: 3,
        rows: 1,
        columns: 1,
        plate: "lathe",
        crop: [100, 100, 700, 500],
        what:
          "States, inputs and timeouts declared in one place, so every transition is explicit.",
        use: "For flows: dictation, onboarding, connection.",
        failure: "no input in .listening",
        recovery: "timed out · back to .idle",
      },
      {
        id: "channels",
        name: "Channels",
        row: 4,
        column: 4,
        rows: 1,
        columns: 2,
        plate: "machine",
        crop: [0, 100, 480, 400],
        what:
          "A bounded queue between producers and consumers, so a fast producer waits instead of filling memory.",
        use: "For pipelines and work queues.",
        failure: "producer 10× faster",
        recovery: "waits · memory flat",
      },
      {
        id: "platform",
        name: "Network & background",
        row: 4,
        column: 6,
        rows: 1,
        columns: 1,
        plate: "lathe",
        crop: [300, 1100, 600, 450],
        what:
          "The network that comes and goes, and the background time the system grants and takes back.",
        use: "For pausing sync offline and finishing work as the app leaves the screen.",
        failure: "app moved to background",
        recovery: "work finished in time",
      },
      {
        id: "lint",
        name: "Lint",
        row: 4,
        column: 7,
        rows: 1,
        columns: 2,
        plate: "atlas",
        crop: [0, 600, 711, 300],
        what:
          "A build plugin that flags blocking calls in async code, swallowed cancellation and other patterns that hang apps.",
        use: "For keeping a codebase, or an agent, honest.",
        failure: "semaphore.wait() in async code",
        recovery: "flagged at build time",
      },
    ],
  },
});

export const plateById = (id: PlateId): Plate => {
  const plate = site.plates.find((p) => p.id === id);
  if (!plate) throw new Error(`No plate ${id}`);
  return plate;
};
