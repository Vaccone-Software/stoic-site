// The geometry of the mosaic, as pure functions: where each tile lies on a
// floor of a given size, the gold inlay along every seam, a mended crack
// across a tile, and the seeded sequence of failures. The component owns the
// DOM; given the same floor, tiles and seed, this gives the same drawing.

import { stream } from "./plates";

export type Point = readonly [x: number, y: number];

/** A block of cells on the floor, counted from the top left. */
export interface Cells {
  readonly row: number;
  readonly column: number;
  readonly rows: number;
  readonly columns: number;
}

/** The seed of the failure sequence; Replay starts it again. */
export const SEED = 0x5eed;

// MARK: The floor

/**
 * The corners of the floor's cells, one more row and column than there are
 * cells. Laid in order, then each interior corner is nudged by a seeded
 * amount, so every tile is a slightly irregular quadrilateral; the edge stays
 * straight.
 */
export function vertices(
  width: number,
  height: number,
  columns: number,
  rows: number
): Point[][] {
  const next = stream(0xa5a5);
  const jitter = Array.from({ length: rows + 1 }, () =>
    Array.from(
      { length: columns + 1 },
      () => [next() - 0.5, next() - 0.5] as const
    )
  );
  const cw = width / columns,
    ch = height / rows;
  return jitter.map((line, r) =>
    line.map(([jx, jy], c): Point => {
      const edgeX = c === 0 || c === columns,
        edgeY = r === 0 || r === rows;
      return [
        c * cw + (edgeX ? 0 : jx * cw * 0.14),
        r * ch + (edgeY ? 0 : jy * ch * 0.12),
      ];
    })
  );
}

/** The outline of a block of cells, clockwise from its top left corner. */
export function ring(v: readonly (readonly Point[])[], at: Cells): Point[] {
  const { row, column, rows, columns } = at;
  const out: Point[] = [];
  for (let k = column; k <= column + columns; k++) out.push(v[row]![k]!);
  for (let k = row + 1; k <= row + rows; k++)
    out.push(v[k]![column + columns]!);
  for (let k = column + columns - 1; k >= column; k--)
    out.push(v[row + rows]![k]!);
  for (let k = row + rows - 1; k > row; k--) out.push(v[k]![column]!);
  return out;
}

/** The outline drawn in towards its centre by `gap`, so a seam shows between neighbours. */
export function inset(outline: readonly Point[], gap: number): Point[] {
  const cx = outline.reduce((sum, [x]) => sum + x, 0) / outline.length,
    cy = outline.reduce((sum, [, y]) => sum + y, 0) / outline.length;
  return outline.map(([x, y]): Point => {
    const dx = cx - x,
      dy = cy - y,
      length = Math.hypot(dx, dy) || 1;
    return [x + (dx / length) * gap, y + (dy / length) * gap];
  });
}

/** A polygon's bounding box in whole pixels, and the polygon in the box's own coordinates. */
export interface Placement {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** A CSS `clip-path` that cuts the box to the polygon. */
  readonly clip: string;
  readonly local: readonly Point[];
}

export function place(polygon: readonly Point[]): Placement {
  const xs = polygon.map(([x]) => x),
    ys = polygon.map(([, y]) => y);
  const x = Math.floor(Math.min(...xs)),
    y = Math.floor(Math.min(...ys)),
    right = Math.ceil(Math.max(...xs)),
    bottom = Math.ceil(Math.max(...ys));
  const local = polygon.map(([px, py]): Point => [px - x, py - y]);
  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
    clip: `polygon(${local
      .map(([px, py]) => `${px.toFixed(1)}px ${py.toFixed(1)}px`)
      .join(",")})`,
    local,
  };
}

/** One tile on a floor of a given size. */
export interface TilePlacement {
  readonly placement: Placement;
  /** The tile's cell, un-inset: the verdigris outline follows it, wide enough to cover the seam. */
  readonly outline: readonly Point[];
  /**
   * Where the name sits: near the bottom left corner, clear of the slanted
   * edges, and wrapping rather than running past the right one.
   */
  readonly label: { readonly left: number; readonly bottom: number; readonly maxWidth: number };
}

export interface Floor {
  readonly seal: Placement;
  readonly tiles: readonly TilePlacement[];
  readonly seams: readonly Inlay[];
}

const SEAM_GAP = 1.5;

export function layout(
  width: number,
  height: number,
  mosaic: {
    readonly rows: number;
    readonly columns: number;
    readonly seal: Cells;
  },
  tiles: readonly Cells[]
): Floor {
  const v = vertices(width, height, mosaic.columns, mosaic.rows);
  return {
    seal: place(inset(ring(v, mosaic.seal), SEAM_GAP)),
    tiles: tiles.map((tile) => {
      const outline = ring(v, tile),
        placement = place(inset(outline, SEAM_GAP));
      const [left, top] = placement.local[tile.columns + tile.rows + tile.columns]!;
      const at = Math.max(10, left + 12);
      return {
        placement,
        outline,
        label: {
          left: at,
          bottom: Math.max(6, placement.height - top + 6),
          maxWidth: Math.max(40, placement.width - at - 14),
        },
      };
    }),
    seams: seams(v, mosaic, [mosaic.seal, ...tiles]),
  };
}

// MARK: Gold

/** A piece of gold inlay: a tapering shape, a fine highlight along its spine, and flecks beside it. */
export interface Inlay {
  readonly shape: string;
  readonly spine: string;
  readonly flecks: readonly {
    readonly x: number;
    readonly y: number;
    readonly r: number;
  }[];
}

const fixed = ([x, y]: Point) => `${x.toFixed(1)} ${y.toFixed(1)}`;

/**
 * A polyline thickened into a shape that tapers to nothing at both ends and
 * swells and thins between, `maxWidth` at the widest.
 */
export function inlay(
  points: readonly Point[],
  maxWidth: number,
  rnd: () => number,
  flecks: number
): Inlay {
  const n = points.length;
  let swell = points.map(() => rnd());
  for (let pass = 0; pass < 3; pass++) {
    const was = swell;
    swell = was.map(
      (v, i) =>
        (was[Math.max(0, i - 1)]! + v * 2 + was[Math.min(n - 1, i + 1)]!) / 4
    );
  }
  const left: Point[] = [],
    right: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)]!,
      b = points[Math.min(n - 1, i + 1)]!,
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      length = Math.hypot(dx, dy) || 1;
    const t = i / (n - 1),
      taper = Math.pow(Math.sin(Math.PI * t), 0.6),
      half = Math.max(0.4, maxWidth * taper * (0.45 + 1.1 * swell[i]!)) / 2;
    const nx = -dy / length,
      ny = dx / length,
      [px, py] = points[i]!;
    left.push([px + nx * half, py + ny * half]);
    right.push([px - nx * half, py - ny * half]);
  }
  const scatter = Array.from({ length: flecks }, () => {
    const [px, py] = points[1 + Math.floor(rnd() * (n - 2))]!;
    return {
      x: Number((px + (rnd() - 0.5) * 14).toFixed(1)),
      y: Number((py + (rnd() - 0.5) * 14).toFixed(1)),
      r: Number((0.5 + rnd() * 1.1).toFixed(2)),
    };
  });
  return {
    shape: `M${left.concat(right.reverse()).map(fixed).join(" L")} Z`,
    spine: `M${points.slice(1, -1).map(fixed).join(" L")}`,
    flecks: scatter,
  };
}

/** `n` + 1 points from a to b, the inner ones pushed sideways by up to `wobble`. */
function sampleLine(
  a: Point,
  b: Point,
  n: number,
  wobble: number,
  rnd: () => number
): Point[] {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    length = Math.hypot(dx, dy) || 1,
    nx = -dy / length,
    ny = dx / length;
  return Array.from({ length: n + 1 }, (_, i): Point => {
    const t = i / n,
      offset = i === 0 || i === n ? 0 : (rnd() - 0.5) * wobble;
    return [a[0] + dx * t + nx * offset, a[1] + dy * t + ny * offset];
  });
}

/** A smooth curve through the control points, `per` samples between each pair. */
function catmull(control: readonly Point[], per: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < control.length - 1; i++) {
    const p0 = control[Math.max(0, i - 1)]!,
      p1 = control[i]!,
      p2 = control[i + 1]!,
      p3 = control[Math.min(control.length - 1, i + 2)]!;
    for (let s = 0; s < per; s++) {
      const t = s / per,
        t2 = t * t,
        t3 = t2 * t;
      const at = (k: 0 | 1) =>
        0.5 *
        (2 * p1[k] +
          (-p0[k] + p2[k]) * t +
          (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
          (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      out.push([at(0), at(1)]);
    }
  }
  out.push(control[control.length - 1]!);
  return out;
}

/**
 * The gold along every seam: one inlay for each edge between two blocks of
 * cells, shared by the pair, none along the floor's own edge.
 */
function seams(
  v: readonly (readonly Point[])[],
  floor: { readonly rows: number; readonly columns: number },
  blocks: readonly Cells[]
): Inlay[] {
  const rnd = stream(0x601d),
    done = new Set<string>(),
    out: Inlay[] = [];
  // The gold keeps its weight as the floor grows: thicker on a wide screen.
  const scale = Math.min(1.9, Math.max(1.15, v[0]![floor.columns]![0] / 1000));
  const edge = (a: Point, b: Point, key: string) => {
    if (done.has(key)) return;
    done.add(key);
    out.push(inlay(sampleLine(a, b, 9, 2.2 * scale, rnd), 4.2 * scale, rnd, 0));
  };
  // An edge is named by its two ends, whichever way round it is walked.
  const key = (r1: number, c1: number, r2: number, c2: number) =>
    [r1, c1, r2, c2].join(",") < [r2, c2, r1, c1].join(",")
      ? `${r1},${c1}-${r2},${c2}`
      : `${r2},${c2}-${r1},${c1}`;
  for (const { row: r, column: c, rows: rs, columns: cs } of blocks) {
    for (let k = c; k < c + cs; k++) {
      if (r > 0) edge(v[r]![k]!, v[r]![k + 1]!, key(r, k, r, k + 1));
      if (r + rs < floor.rows)
        edge(v[r + rs]![k]!, v[r + rs]![k + 1]!, key(r + rs, k, r + rs, k + 1));
    }
    for (let k = r; k < r + rs; k++) {
      if (c > 0) edge(v[k]![c]!, v[k + 1]![c]!, key(k, c, k + 1, c));
      if (c + cs < floor.columns)
        edge(v[k]![c + cs]!, v[k + 1]![c + cs]!, key(k, c + cs, k + 1, c + cs));
    }
  }
  return out;
}

// MARK: Failures

/** Twelve numbers in [0, 1) that decide where a crack runs; they are all a crack is. */
export type Crack = readonly number[];

/**
 * A crack across a w × h tile: a smooth meandering line filled with gold, a
 * short branch off it, and flecks beside both.
 */
export function mend(
  width: number,
  height: number,
  f: Crack
): readonly Inlay[] {
  const across = f[0]! < 0.5,
    rnd = stream(Math.floor(f[11]! * 1e9));
  const control = Array.from({ length: 6 }, (_, i): Point => {
    const k = i / 5;
    return across
      ? [
          k * width,
          height * (0.2 + f[1]! * 0.6) + (f[2 + i]! - 0.5) * height * 0.34,
        ]
      : [
          width * (0.2 + f[1]! * 0.6) + (f[2 + i]! - 0.5) * width * 0.3,
          k * height,
        ];
  });
  const main = catmull(control, 8);
  const scale = Math.min(1.8, Math.max(1.1, Math.min(width, height) / 110));
  const trunk = inlay(main, 5.6 * scale, rnd, 7);
  const a = main[Math.floor(main.length * (0.3 + f[9]! * 0.4))]!,
    b: Point = [
      a[0] + (f[10]! - 0.5) * width * 0.34,
      a[1] + (f[8]! - 0.2) * height * 0.42,
    ],
    mid: Point = [(a[0] + b[0]) / 2 + (f[7]! - 0.5) * 24, (a[1] + b[1]) / 2];
  return [trunk, inlay(catmull([a, mid, b], 8), 2.8 * scale, rnd, 3)];
}

/** One failure of the sequence: which tile fails, and the crack it is mended with. */
export interface Failure {
  readonly tile: number;
  readonly crack: Crack;
}

/**
 * The failures of `SEED`, one at a time, never the same tile twice running.
 * Every call to this starts the same sequence again.
 */
export function failures(tiles: number): () => Failure {
  const rnd = stream(SEED);
  let last = -1;
  return () => {
    let tile: number;
    do tile = Math.floor(rnd() * tiles);
    while (tile === last && tiles > 1);
    last = tile;
    return { tile, crack: Array.from({ length: 12 }, () => rnd()) };
  };
}

// MARK: Words

const ones = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const tens = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];

/** A whole number from 0 to 99 in words: 24 is "twenty-four". Larger numbers stay digits. */
export function spell(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 99) return String(n);
  if (n < 20) return ones[n]!;
  const rest = n % 10;
  return rest === 0
    ? tens[n / 10]!
    : `${tens[Math.floor(n / 10)]}-${ones[rest]}`;
}
