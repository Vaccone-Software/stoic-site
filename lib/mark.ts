// Stoic's mark: an arched niche between two columns, on a plinth, sheltering
// the sphere Atlas carries. Bone on lamp black; the sphere is the one part in
// verdigris.
//
// Two drawings: one on a 64 grid for anything 32 px and up, and one fitted to
// a 16 px grid so the favicon stays crisp (scaled down, the large drawing's
// arch and columns run together).

export interface MarkColours {
  readonly print: string;
  readonly accent: string;
}

export const colours = {
  ground: "#13110f",
  print: "#e6ddca",
  accent: "#78a08d",
  paper: "#f2ede2",
  ink: "#1b1813",
  accentOnPaper: "#3d6b58",
} as const;

/** The mark's shapes on a 64 grid, without the outer `<svg>`. */
export const markShapes = ({ print, accent }: MarkColours) =>
  `<rect x="7" y="24" width="7" height="31" fill="${print}"/>` +
  `<rect x="50" y="24" width="7" height="31" fill="${print}"/>` +
  `<path d="M19 55V31a13 13 0 0 1 26 0v24" fill="none" stroke="${print}" stroke-width="3.5"/>` +
  `<circle cx="32" cy="39" r="6" fill="${accent}"/>` +
  `<rect x="4" y="55" width="56" height="5" fill="${print}"/>`;

/** The mark fitted to whole pixels on a 16 grid, for the favicon. */
export const smallMarkShapes = ({ print, accent }: MarkColours) =>
  `<rect x="1" y="6" width="2" height="8" fill="${print}"/>` +
  `<rect x="13" y="6" width="2" height="8" fill="${print}"/>` +
  `<path d="M5 14V8a3 3 0 0 1 6 0v6" fill="none" stroke="${print}" stroke-width="2"/>` +
  `<circle cx="8" cy="10.5" r="1.5" fill="${accent}"/>` +
  `<rect x="0" y="14" width="16" height="2" fill="${print}"/>`;

/** A standalone SVG of the mark, optionally on a lamp-black tile. */
export function markSvg(options: {
  readonly colours?: MarkColours;
  readonly tile?: boolean;
  readonly small?: boolean;
} = {}): string {
  const c = options.colours ?? colours;
  const grid = options.small ? 16 : 64;
  const shapes = options.small ? smallMarkShapes(c) : markShapes(c);
  // On a tile the mark sits inset, so the plinth does not touch the edge.
  const body = options.tile
    ? `<rect width="${grid}" height="${grid}" fill="${colours.ground}"/>` +
      (options.small ? shapes : `<g transform="translate(6 4) scale(0.8125)">${shapes}</g>`)
    : shapes;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${grid} ${grid}">${body}</svg>`;
}
