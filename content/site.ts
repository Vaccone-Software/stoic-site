import { Schema } from "effect";

// The site's content, declared once and decoded when the site builds: a
// plate with a missing credit or a primitive with an unknown plate fails
// `next build`, rather than shipping a broken page.

const PlateId = Schema.Literals([
  "atlas",
  "time",
  "sisyphus",
  "hydra",
  "reason",
]);
export type PlateId = (typeof PlateId)["Type"];

const Fraction = Schema.Finite.check(
  Schema.isBetween({ minimum: 0, maximum: 1 })
);

/** One engraving or painting, with where it came from. */
export class Plate extends Schema.Class<Plate>("Plate")({
  id: PlateId,
  numeral: Schema.NonEmptyString,
  caption: Schema.NonEmptyString,
  /** Shown to assistive technology in place of the image. */
  description: Schema.NonEmptyString,
  credit: Schema.NonEmptyString,
  license: Schema.Literals(["Public domain", "CC0"]),
  /** How much of the figure is scraped back to the stone, 0 to 1. */
  scrape: Fraction,
  /**
   * Whether to print the image as a negative. Line engravings on white paper
   * are inverted so their lines print bright; tonal works (paintings,
   * mezzotints, dark skies) print as they are.
   */
  invert: Schema.Boolean,
}) {}

/** One primitive on the landing page. */
export class Primitive extends Schema.Class<Primitive>("Primitive")({
  area: Schema.NonEmptyString,
  title: Schema.NonEmptyString,
  summary: Schema.NonEmptyString,
  code: Schema.NonEmptyString,
  apis: Schema.NonEmptyArray(Schema.NonEmptyString),
  plate: PlateId,
}) {}

/** A figure that is easy to check against the repository. */
export class Fact extends Schema.Class<Fact>("Fact")({
  value: Schema.NonEmptyString,
  label: Schema.NonEmptyString,
}) {}

const Content = Schema.Struct({
  version: Schema.NonEmptyString,
  repository: Schema.NonEmptyString,
  install: Schema.Struct({
    terminal: Schema.NonEmptyString,
    manifest: Schema.NonEmptyString,
    xcode: Schema.NonEmptyString,
  }),
  capabilities: Schema.NonEmptyArray(Schema.NonEmptyString),
  plates: Schema.NonEmptyArray(Plate),
  primitives: Schema.NonEmptyArray(Primitive),
  facts: Schema.NonEmptyArray(Fact),
});

const repository = "https://github.com/Vaccone-Software/stoic";

export const site = Schema.decodeUnknownSync(Content)({
  version: "0.1.0",
  repository,
  install: {
    terminal: `swift package add-dependency ${repository} --from 0.1.0`,
    manifest: `.package(url: "${repository}", from: "0.1.0")`,
    xcode:
      "File › Add Package Dependencies… › github.com/Vaccone-Software/stoic",
  },
  capabilities: [
    "Timeouts that cancel",
    "Retries with budgets",
    "Cleanup that always runs",
    "Restarts for failed work",
    "Validated, crash-safe data",
    "Race conditions replayed",
  ],
  plates: [
    {
      id: "atlas",
      numeral: "I",
      caption: "Atlas bears the heavens",
      description:
        "An engraving of Atlas on a mountaintop carrying the starry sky, set in an arched marble niche between two columns.",
      credit: "Atlas porte le ciel sur ses épaules, Paris Musées GB00202",
      license: "Public domain",
      scrape: 0,
      invert: false,
    },
    {
      id: "time",
      numeral: "II",
      caption: "Time among the statues",
      description:
        "An engraving of winged Time raising his scythe among classical statues, in an arched niche, partly scraped back to the stone.",
      credit:
        "Prudence restrains Time from destroying ancient statues, Rijksmuseum RP-P-1878-A-1201",
      license: "CC0",
      scrape: 0.1,
      invert: true,
    },
    {
      id: "sisyphus",
      numeral: "III",
      caption: "Sisyphus and the stone",
      description:
        "A mezzotint of Sisyphus carrying his boulder, in an arched niche, partly scraped back to the stone.",
      credit:
        "Sisyphus carries a boulder up the hill, Rijksmuseum RP-P-OB-29.224",
      license: "CC0",
      scrape: 0.1,
      invert: false,
    },
    {
      id: "hydra",
      numeral: "IV",
      caption: "The Hydra of Lerna",
      description:
        "An engraving of a sculpture of Hercules fighting the Hydra, in an arched niche, partly scraped back to the stone.",
      credit:
        "Hercules kills the Hydra of Lerna, Rijksmuseum RP-P-1888-A-13803",
      license: "CC0",
      scrape: 0.1,
      invert: true,
    },
    {
      id: "reason",
      numeral: "V",
      caption: "The sleep of reason, after Goya",
      description:
        "Goya's etching of a sleeping figure surrounded by owls and bats, in an arched niche, partly scraped back to the stone.",
      credit:
        "Francisco de Goya, El sueño de la razón produce monstruos, Los Caprichos plate 43, The Metropolitan Museum of Art",
      license: "CC0",
      scrape: 0.1,
      invert: true,
    },
  ],
  primitives: [
    {
      area: "Deadlines",
      title: "Timeouts that cancel",
      summary:
        "Bound how long any async work may take. Work past its deadline is cancelled with a reason, and calls that ignore cancellation are abandoned and counted.",
      code: "try await withTimeout(.seconds(2)) { … }",
      apis: ["withTimeout", "Deadline", "abandoningAfter"],
      plate: "time",
    },
    {
      area: "Retries",
      title: "Retries with a policy",
      summary:
        "Exponential backoff with jitter and a shared budget. Errors declare whether a retry can help, and retrying stops when it cannot.",
      code: "try await retry(.exponential(base: .milliseconds(200)).attempts(4)) { … }",
      apis: ["retry", "Schedule", "RetryBudget", "CircuitBreaker"],
      plate: "sisyphus",
    },
    {
      area: "Supervision",
      title: "Restarts for failed work",
      summary:
        "Long-running work restarts with backoff when it fails or stops sending heartbeats, and escalates when restarting stops helping.",
      code: 'try await Supervisor(label: "app") { Child("sync") { … } }.run()',
      apis: ["Supervisor", "StateMachine", "ServiceGraph"],
      plate: "hydra",
    },
    {
      area: "Testing",
      title: "Race conditions, replayed",
      summary:
        "Run a test across hundreds of seeded interleavings with virtual time. A failure reports the seed that reproduces it exactly.",
      code: "try await simulate(seeds: 0..<500) { … }",
      apis: ["simulate", "TestClock", "expectTrace"],
      plate: "reason",
    },
  ],
  facts: [
    { value: "17", label: "written contracts" },
    { value: "168", label: "failure cases specified" },
    { value: "1,400+", label: "tests" },
    { value: "90", label: "named events" },
    { value: "0", label: "warnings allowed" },
  ],
});

export const plateById = (id: PlateId): Plate => {
  const plate = site.plates.find((p) => p.id === id);
  if (!plate) throw new Error(`No plate ${id}`);
  return plate;
};
