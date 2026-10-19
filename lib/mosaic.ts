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

// MARK: Fractures

const fixed = ([x, y]: Point) => `${x.toFixed(1)} ${y.toFixed(1)}`;

/** A number in [0, 1) from a point: the same for the same place, whichever piece asks. */
function placeHash(...points: readonly Point[]): number {
  let h = 0x811c9dc5;
  for (const [x, y] of points) {
    h = Math.imul(h ^ Math.round(x * 8), 0x01000193);
    h = Math.imul(h ^ Math.round(y * 8), 0x85ebca6b);
    h ^= h >>> 15;
  }
  return h >>> 0;
}

/** The finest step of a fracture, in pixels: below this a break is not split further. */
const GRAIN = 2.4;

/**
 * A break from `a` to `b`, found by halving: the middle of each piece is
 * pushed sideways by a seeded amount, then each half is halved again. The
 * push is small against a long piece, so the whole keeps its course and turns
 * only a little at a time; it is larger against a short one, so up close the
 * edge is ragged, with the small steps and notches of a coast. `bend` widens
 * the large turns. `texture` says how ragged the break is, from 0 to 1, a
 * fraction of the way along it: a real break is clean for long runs and
 * ragged in places. Without it the break is ragged all along.
 */
export function fracture(
  a: Point,
  b: Point,
  rnd: () => number,
  bend = 1,
  texture?: (along: number) => number
): Point[] {
  const span = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  let line: Point[] = [a, b];
  for (let level = 0; level < 12; level++) {
    const next: Point[] = [line[0]!];
    let split = false;
    for (let i = 0; i < line.length - 1; i++) {
      const p = line[i]!,
        q = line[i + 1]!,
        dx = q[0] - p[0],
        dy = q[1] - p[1],
        length = Math.hypot(dx, dy);
      if (length < GRAIN * 2) {
        next.push(q);
        continue;
      }
      split = true;
      const mask = texture
        ? texture(
            Math.min(
              1,
              Math.max(
                0,
                ((((p[0] + q[0]) / 2 - a[0]) * (b[0] - a[0]) +
                  ((p[1] + q[1]) / 2 - a[1]) * (b[1] - a[1])) /
                  (span * span))
              )
            )
          )
        : 1;
      const k =
        length > 48
          ? 0.055 * bend
          : length > 14
          ? 0.08 * Math.sqrt(bend) * (texture ? 0.55 + 0.45 * mask : 1)
          : (length > 5 ? 0.13 : 0.2) * (texture ? 0.5 * (0.15 + 0.85 * mask) : 1);
      // Large pieces turn by a rounded amount, clustered near nothing; small
      // ones step by anything up to the full amount, which is what makes an edge ragged.
      const push =
        (length > 14 ? rnd() + rnd() - 1 : (rnd() - 0.5) * 2) * k * length;
      next.push(
        [
          (p[0] + q[0]) / 2 - (dy / length) * push,
          (p[1] + q[1]) / 2 + (dx / length) * push,
        ],
        q
      );
    }
    line = next;
    if (!split) break;
  }
  return line;
}

/**
 * The break between two lattice nodes, the same whichever end it is asked
 * from, so a tile's edge and the gold along it agree to the pixel. A floor
 * edge stays straight.
 */
function breakBetween(a: Point, b: Point, straight: boolean): Point[] {
  if (straight) return [a, b];
  const flip = a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]);
  const [p, q] = flip ? [b, a] : [a, b];
  const seed = placeHash(p, q),
    length = Math.hypot(q[0] - p[0], q[1] - p[1]);
  // Where this break is ragged: a stretch or two somewhere along it, and near its ends, where it meets others.
  const marks = stream(seed ^ 0x7e57);
  const stretches = Array.from({ length: marks() < 0.4 ? 2 : 1 }, () => ({
    at: 0.12 + 0.76 * marks(),
    reach: 0.07 + 0.09 * marks(),
  }));
  const texture = (t: number) =>
    Math.max(
      0.8 * Math.exp(-(Math.min(t, 1 - t) * length) / 14),
      ...stretches.map(({ at, reach }) => Math.exp(-(((t - at) / reach) ** 2)))
    );
  const line = fracture(p, q, stream(seed), 1, texture);
  return flip ? line.reverse() : line;
}

// MARK: The floor

/**
 * The corners of the floor's cells, one more row and column than there are
 * cells. Laid in order, then each interior corner is nudged by a seeded
 * amount, so every tile is a slightly irregular quadrilateral.
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

/**
 * Where the cracks of the floor meet. A real break rarely crosses another in
 * a plus; it runs on and the next one ends against it. So at each interior
 * corner the lines across are continuous and the lines down are shifted along
 * them: the block above reaches the corner at `above`, the block below at
 * `below`, and between the two is a short step of the line across.
 */
interface Node {
  readonly above: Point;
  readonly below: Point;
}

/** Every node of one line across, in order, and where each corner's nodes are in it. */
interface Line {
  readonly points: readonly Point[];
  /** The column of the corner that each node belongs to. */
  readonly corner: readonly number[];
  readonly above: readonly number[];
  readonly below: readonly number[];
}

interface Grid {
  readonly rows: number;
  readonly columns: number;
  readonly nodes: readonly (readonly Node[])[];
  readonly lines: readonly Line[];
}

function grid(
  v: readonly (readonly Point[])[],
  rows: number,
  columns: number
): Grid {
  const next = stream(0x57a9),
    cw = v[0]![columns]![0] / columns;
  const nodes = v.map((line, r) =>
    line.map((at, c): Node => {
      const interior = r > 0 && r < rows && c > 0 && c < columns;
      if (!interior) return { above: at, below: at };
      const side = next() < 0.5 ? -1 : 1,
        shift = side * cw * (0.085 + 0.11 * next()),
        lift = (next() - 0.5) * 3;
      return {
        above: [at[0] - shift / 2, at[1] - lift / 2],
        below: [at[0] + shift / 2, at[1] + lift / 2],
      };
    })
  );
  const lines = nodes.map((line): Line => {
    const points: Point[] = [],
      corner: number[] = [],
      above: number[] = [],
      below: number[] = [];
    line.forEach((node, c) => {
      const same = node.above === node.below;
      const ordered = same
        ? [node.above]
        : node.above[0] < node.below[0]
        ? [node.above, node.below]
        : [node.below, node.above];
      for (const p of ordered) {
        if (p === node.above) above[c] = points.length;
        if (p === node.below) below[c] = points.length;
        points.push(p);
        corner.push(c);
      }
    });
    return { points, corner, above, below };
  });
  return { rows, columns, nodes, lines };
}

/**
 * The outline of a block of cells, clockwise from its top left corner, and
 * the index in it of its bottom left corner. Every edge between two blocks is
 * a fracture; the floor's own edge stays straight.
 */
function ring(g: Grid, at: Cells): { outline: Point[]; corner: number } {
  const { row, column, rows, columns } = at;
  const bottom = row + rows,
    right = column + columns;
  const out: Point[] = [];
  const across = (r: number, from: number, to: number) => {
    const line = g.lines[r]!,
      step = to > from ? 1 : -1;
    for (let k = from; k !== to; k += step)
      out.push(
        ...breakBetween(
          line.points[k]!,
          line.points[k + step]!,
          r === 0 || r === g.rows
        ).slice(0, -1)
      );
  };
  const down = (c: number, a: Point, b: Point) =>
    out.push(...breakBetween(a, b, c === 0 || c === g.columns).slice(0, -1));
  // The step between the two nodes of a corner, where the line down passes through the line across.
  const step = (from: Point, to: Point) => {
    if (from !== to) out.push(...breakBetween(from, to, false).slice(0, -1));
  };

  across(row, g.lines[row]!.below[column]!, g.lines[row]!.below[right]!);
  for (let r = row; r < bottom; r++) {
    down(right, g.nodes[r]![right]!.below, g.nodes[r + 1]![right]!.above);
    if (r + 1 < bottom)
      step(g.nodes[r + 1]![right]!.above,
        g.nodes[r + 1]![right]!.below
      );
  }
  across(
    bottom,
    g.lines[bottom]!.above[right]!,
    g.lines[bottom]!.above[column]!
  );
  const corner = out.length;
  for (let r = bottom; r > row; r--) {
    down(column, g.nodes[r]![column]!.above, g.nodes[r - 1]![column]!.below);
    if (r - 1 > row)
      step(g.nodes[r - 1]![column]!.below,
        g.nodes[r - 1]![column]!.above
      );
  }
  return { outline: out, corner };
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
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [px, py] of polygon) {
    minX = Math.min(minX, px);
    minY = Math.min(minY, py);
    maxX = Math.max(maxX, px);
    maxY = Math.max(maxY, py);
  }
  const x = Math.floor(minX),
    y = Math.floor(minY),
    right = Math.ceil(maxX),
    bottom = Math.ceil(maxY);
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
  /** The tile's cell, un-inset: the accent outline follows it, wide enough to cover the seam. */
  readonly outline: readonly Point[];
  /**
   * Where the name sits: near the bottom left corner, clear of the slanted
   * edges, and wrapping rather than running past the right one.
   */
  readonly label: {
    readonly left: number;
    readonly bottom: number;
    readonly maxWidth: number;
  };
}

export interface Floor {
  readonly seal: Placement;
  readonly tiles: readonly TilePlacement[];
  readonly seams: readonly Inlay[];
  /** The width of the gold on the seams; the accent outline is drawn wider than its widest. */
  readonly weight: number;
}

const SEAM_GAP = 1.5;

/** The stretch of x, from the most to the least that every row of a band between y0 and y1 holds, across a polygon. */
function span(polygon: readonly Point[], y0: number, y1: number): [number, number] {
  let near = -Infinity,
    far = Infinity;
  for (let k = 0; k <= 6; k++) {
    const y = y0 + ((y1 - y0) * k) / 6;
    let low = Infinity,
      high = -Infinity;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i]!,
        b = polygon[(i + 1) % polygon.length]!;
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        const x = a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]);
        low = Math.min(low, x);
        high = Math.max(high, x);
      }
    }
    if (low <= high) {
      near = Math.max(near, low);
      far = Math.min(far, high);
    }
  }
  return [near, far];
}

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
  const g = grid(v, mosaic.rows, mosaic.columns);
  const weight = seamWeight(width);
  return {
    seal: place(inset(ring(g, mosaic.seal).outline, SEAM_GAP)),
    tiles: tiles.map((tile) => {
      const { outline, corner } = ring(g, tile),
        placement = place(inset(outline, SEAM_GAP));
      const [cornerX, top] = placement.local[corner]!;
      // The band the name lies in, and the span of tile that is there: the
      // edges are broken, so they can lean in over the name.
      const [near, far] = span(placement.local, top - 6 - 36, top - 6);
      const at = Math.max(10, cornerX + 12, near + 6);
      return {
        placement,
        outline,
        label: {
          left: at,
          bottom: Math.max(6, placement.height - top + 6),
          maxWidth: Math.max(40, Math.min(placement.width, far) - at - 8),
        },
      };
    }),
    seams: seams(g, [mosaic.seal, ...tiles], weight),
    weight,
  };
}

// MARK: Gold

/**
 * A piece of gold inlay: a filled shape, and the few flecks of gold dust that
 * landed beside it.
 */
export interface Inlay {
  readonly shape: string;
  readonly flecks: readonly {
    readonly x: number;
    readonly y: number;
    readonly r: number;
  }[];
}

/** The width of a seam's gold on a floor `width` wide: it keeps its weight as the floor grows. */
export function seamWeight(width: number): number {
  return 4.2 * Math.min(1.9, Math.max(1.15, width / 1000));
}

/** The widest the gold swells, against its nominal width. */
export const SWELL = 1.5;

const smooth = (t: number) => t * t * (3 - 2 * t);

interface RibbonOptions {
  /** The width at each end, against the nominal; "tip" thins to a point. */
  readonly start: number | "tip";
  readonly end: number | "tip";
  /** An end that runs into other gold runs on by half its width, so nothing is left bare between. */
  readonly overlap: boolean;
  /** Places where the lacquer pooled, on top of the slow swell and thinning. */
  readonly pools: number;
  /** Extra gold at given distances from the start: the lacquer flares where a crack meets an edge. */
  readonly bumps?: readonly {
    readonly at: number;
    readonly sigma: number;
    readonly amount: number;
  }[];
  readonly flecks?: number;
}

/**
 * A line thickened into gold lacquer. The width drifts along it, swells where
 * the lacquer pooled and thins elsewhere; each edge is a little ragged of its
 * own, as the edge of a bead of lacquer on a rough break is; an end may thin
 * away to a point.
 */
export function ribbon(
  line: readonly Point[],
  width: number,
  rnd: () => number,
  o: RibbonOptions
): Inlay {
  const n = line.length;
  if (n < 2) return { shape: "", flecks: [] };
  const along = [0];
  for (let i = 1; i < n; i++)
    along.push(
      along[i - 1]! +
        Math.hypot(line[i]![0] - line[i - 1]![0], line[i]![1] - line[i - 1]![1])
    );
  const total = along[n - 1]! || 1;

  // The slow drift: values at knots about 30 pixels apart, blended.
  const knots = Array.from(
    { length: Math.ceil(total / 30) + 2 },
    () => (rnd() - 0.5) * 0.4
  );
  const drift = (s: number) => {
    const at = s / 30,
      i = Math.floor(at);
    return knots[i]! + (knots[i + 1]! - knots[i]!) * smooth(at - i);
  };
  const pools = Array.from({ length: o.pools }, () => ({
    at: total * (0.15 + 0.7 * rnd()),
    sigma: 7 + rnd() * 14,
    amount: 0.3 + rnd() * 0.25,
  }));
  const bumps = [...pools, ...(o.bumps ?? [])];
  const zone = (end: number | "tip") =>
    end === "tip" ? Math.min(total * 0.8, 40 + width * 3) : 0;
  const tipStart = zone(o.start),
    tipEnd = zone(o.end);
  const ends = (s: number) => {
    const t = smooth(Math.min(1, s / (total * 0.5)));
    const a = o.start === "tip" ? 1 : o.start,
      b = o.end === "tip" ? 1 : o.end;
    let k = a + (b - a) * t;
    // The ends fall off over a length, not in one step.
    if (tipStart > 0)
      k *= Math.max(0.07, Math.pow(smooth(Math.min(1, s / tipStart)), 0.8));
    if (tipEnd > 0)
      k *= Math.max(
        0.07,
        Math.pow(smooth(Math.min(1, (total - s) / tipEnd)), 0.8)
      );
    return k;
  };

  const raggedness = 0.045 * width + 0.1;
  const left: Point[] = [],
    right: Point[] = [];
  const half = width / 2;
  const edge = (i: number, sign: 1 | -1) => {
    const a = line[Math.max(0, i - 2)]!,
      b = line[Math.min(n - 1, i + 2)]!,
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      length = Math.hypot(dx, dy) || 1;
    const s = along[i]!;
    let k = 1 + drift(s);
    for (const bump of bumps)
      k += bump.amount * Math.exp(-(((s - bump.at) / bump.sigma) ** 2) / 2);
    k =
      Math.min(SWELL, Math.max(0.62, k)) * ends(s) * (1 + (rnd() - 0.5) * 0.12);
    const reach =
      half * k + (rnd() - 0.5) * 2 * raggedness * Math.min(1, ends(s) * 2);
    const [px, py] = line[i]!;
    return [
      px - (dy / length) * reach * sign,
      py + (dx / length) * reach * sign,
    ] as Point;
  };
  for (let i = 0; i < n; i++) {
    left.push(edge(i, 1));
    right.push(edge(i, -1));
  }
  if (o.overlap) {
    // Run on along the line's own direction, so the end lies over what it meets.
    const on = (p: Point, from: Point, q: Point): Point => {
      const length = Math.hypot(p[0] - from[0], p[1] - from[1]) || 1;
      return [q[0] + ((p[0] - from[0]) / length) * half, q[1] + ((p[1] - from[1]) / length) * half];
    };
    if (o.start !== "tip") {
      left.unshift(on(line[0]!, line[1]!, left[0]!));
      right.unshift(on(line[0]!, line[1]!, right[0]!));
    }
    if (o.end !== "tip") {
      left.push(on(line[n - 1]!, line[n - 2]!, left[left.length - 1]!));
      right.push(on(line[n - 1]!, line[n - 2]!, right[right.length - 1]!));
    }
  }
  const scatter = Array.from({ length: o.flecks ?? 0 }, () => {
    const [px, py] = line[1 + Math.floor(rnd() * (n - 2))]!,
      angle = rnd() * Math.PI * 2,
      distance = width * (0.7 + rnd() * 1.1);
    return {
      x: Number((px + Math.cos(angle) * distance).toFixed(1)),
      y: Number((py + Math.sin(angle) * distance).toFixed(1)),
      r: Number((0.45 + rnd() * 0.5).toFixed(2)),
    };
  });
  return {
    shape: `M${left.concat(right.reverse()).map(fixed).join(" L")} Z`,
    flecks: scatter,
  };
}

/** A filled polygon of gold: a missing shard made good, or lacquer pooled at a junction. */
export function chip(points: readonly Point[]): Inlay {
  return { shape: `M${points.map(fixed).join(" L")} Z`, flecks: [] };
}

/** Lacquer pooled where cracks meet: a rounded, uneven lump of about `radius`. */
function pool(at: Point, radius: number, rnd: () => number): Inlay {
  const count = 11,
    turn = rnd() * Math.PI * 2;
  return chip(
    Array.from({ length: count }, (_, i): Point => {
      const angle = turn + (i / count) * Math.PI * 2 + (rnd() - 0.5) * 0.35,
        r = radius * (0.8 + rnd() * 0.4);
      return [at[0] + Math.cos(angle) * r, at[1] + Math.sin(angle) * r];
    })
  );
}

/**
 * The gold along every seam: one run of lacquer for each stretch of break
 * between two blocks of cells, none along the floor's own edge. The width at
 * each corner depends on the corner alone, so the runs that meet agree; where
 * three or more meet, the lacquer pooled.
 */
function seams(g: Grid, blocks: readonly Cells[], weight: number): Inlay[] {
  const owner = Array.from({ length: g.rows }, () =>
    Array.from({ length: g.columns }, () => -1)
  );
  blocks.forEach((b, i) => {
    for (let r = b.row; r < b.row + b.rows; r++)
      for (let c = b.column; c < b.column + b.columns; c++) owner[r]![c] = i;
  });
  const at = (r: number, c: number) => owner[r]?.[c] ?? -2;

  const runs: { a: Point; b: Point }[] = [];
  // Along each line across: between two corners, or at a corner between its two nodes.
  for (let r = 1; r < g.rows; r++) {
    const line = g.lines[r]!;
    for (let k = 0; k < line.points.length - 1; k++) {
      const ca = line.corner[k]!;
      let above: number, below: number;
      if (ca === line.corner[k + 1]) {
        const node = g.nodes[r]![ca]!,
          rightwards = node.below[0] > node.above[0];
        above = at(r - 1, rightwards ? ca : ca - 1);
        below = at(r, rightwards ? ca - 1 : ca);
      } else {
        above = at(r - 1, ca);
        below = at(r, ca);
      }
      if (above !== below)
        runs.push({ a: line.points[k]!, b: line.points[k + 1]! });
    }
  }
  // Down each line between two columns.
  for (let c = 1; c < g.columns; c++)
    for (let r = 0; r < g.rows; r++)
      if (at(r, c - 1) !== at(r, c))
        runs.push({ a: g.nodes[r]![c]!.below, b: g.nodes[r + 1]![c]!.above });

  const key = ([x, y]: Point) => `${x.toFixed(1)},${y.toFixed(1)}`;
  const meeting = new Map<string, { at: Point; count: number }>();
  for (const { a, b } of runs)
    for (const p of [a, b]) {
      const found = meeting.get(key(p));
      if (found) found.count++;
      else meeting.set(key(p), { at: p, count: 1 });
    }
  // How wide the gold is where it reaches a corner: a function of the corner.
  const atCorner = (p: Point) => 0.9 + 0.22 * ((placeHash(p) % 997) / 997);

  const out: Inlay[] = [];
  for (const { a, b } of runs) {
    const rnd = stream(placeHash(a, b) ^ 0x601d);
    out.push(
      ribbon(breakBetween(a, b, false), weight, rnd, {
        start: atCorner(a),
        end: atCorner(b),
        overlap: true,
        pools: rnd() < 0.35 ? 1 : 0,
      })
    );
  }
  const rnd = stream(0x9001);
  for (const { at: p, count } of meeting.values())
    if (count >= 3) out.push(pool(p, weight * (0.62 + 0.1 * count), rnd));
  return out;
}
// MARK: Failures

/** Twelve numbers in [0, 1) that decide where a crack runs; they are all a crack is. */
export type Crack = readonly number[];

const cross = (a: Point, b: Point) => a[0] * b[1] - a[1] * b[0];

/** Where a ray from `from` (inside the outline) first leaves it. */
function leave(from: Point, angle: number, outline: readonly Point[]): Point {
  const d: Point = [Math.cos(angle), Math.sin(angle)];
  let best = Infinity;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!,
      b = outline[(i + 1) % outline.length]!,
      s: Point = [b[0] - a[0], b[1] - a[1]],
      denom = cross(d, s);
    if (Math.abs(denom) < 1e-9) continue;
    const ap: Point = [a[0] - from[0], a[1] - from[1]],
      t = cross(ap, s) / denom,
      u = cross(ap, d) / denom;
    if (t > 1e-6 && u >= 0 && u <= 1) best = Math.min(best, t);
  }
  const t = Number.isFinite(best) ? best : 30;
  return [from[0] + d[0] * t, from[1] + d[1] * t];
}

/** A point carried on past the edge, so the gold runs under whatever clips it. */
const beyond = (p: Point, angle: number, by: number): Point => [
  p[0] + Math.cos(angle) * by,
  p[1] + Math.sin(angle) * by,
];

/** How far a crack runs on past the tile's edge, where the tile's clip cuts it. */
const RUN_ON = 7;

/** The part of a closed outline from `from` to `to` pixels along it, every couple of pixels. */
function along(outline: readonly Point[], from: number, to: number): Point[] {
  const out: Point[] = [];
  let at = 0;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!,
      b = outline[(i + 1) % outline.length]!,
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let s = Math.max(from, at); s < Math.min(to, at + length); s += 2.5) {
      const t = (s - at) / (length || 1);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
    at += length;
  }
  return out;
}

/**
 * A mended failure of a w × h tile (`outline` is the tile's own shape, in
 * its coordinates; a rectangle if absent), as real kintsugi looks: one to
 * three cracks that run from edge to edge and cut the tile into a few shards,
 * each a fractured line filled with gold that swells and thins; where one
 * crack ends against another the lacquer pooled in a Y. Some tiles have a
 * crack that dies out part way instead, and some only a chip made good.
 */
export function mend(
  width: number,
  height: number,
  f: Crack,
  clip?: readonly Point[]
): readonly Inlay[] {
  const outline = clip ?? [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ];
  // Where a tile is clipped to its outline the gold runs on under the clip;
  // a plain rectangle is not clipped, so the gold stops at its edge.
  const PAST = clip ? RUN_ON : 0;
  const rnd = stream(Math.floor(f[11]! * 1e9));
  const scale = Math.min(1.8, Math.max(1.1, Math.min(width, height) / 110));
  const nominal = 4.8 * scale;
  const origin: Point = [
    width * (0.5 + (f[3]! - 0.5) * 0.36),
    height * (0.5 + (f[4]! - 0.5) * 0.36),
  ];
  const kind = f[0]!;
  const out: Inlay[] = [];

  if (kind < 0.12) {
    // A chip made good: a bite out of the edge, filled.
    const perimeter = outline.reduce(
      (sum, p, i) =>
        sum +
        Math.hypot(
          outline[(i + 1) % outline.length]![0] - p[0],
          outline[(i + 1) % outline.length]![1] - p[1]
        ),
      0
    );
    const length = Math.min(
      52,
      Math.max(26, Math.min(width, height) * (0.2 + 0.1 * f[7]!))
    );
    const s0 = perimeter * f[1]!;
    const edge = along(outline, s0, s0 + length);
    if (edge.length < 3) return [];
    const first = edge[0]!,
      last = edge[edge.length - 1]!,
      middle: Point = [(first[0] + last[0]) / 2, (first[1] + last[1]) / 2];
    const toward = Math.atan2(origin[1] - middle[1], origin[0] - middle[0]);
    const depth = length * (0.4 + 0.3 * f[8]!);
    const slide = (f[9]! - 0.5) * length * 0.4;
    const apex: Point = [
      middle[0] + Math.cos(toward) * depth - Math.sin(toward) * slide,
      middle[1] + Math.sin(toward) * depth + Math.cos(toward) * slide,
    ];
    const away = (p: Point): Point => beyond(p, toward + Math.PI, 2);
    out.push(
      chip([
        ...edge.map(away),
        ...fracture(last, apex, rnd, 1.4).slice(1, -1),
        apex,
        ...fracture(apex, first, rnd, 1.4).slice(1, -1),
      ])
    );
    return out;
  }

  // The main crack, from one edge across.
  const heading = f[1]! * Math.PI * 2;
  const adjacent = f[5]! < 0.25;
  const other =
    heading +
    (adjacent
      ? (f[6]! < 0.5 ? 1 : -1) * (Math.PI / 2 + (f[2]! - 0.5) * 0.6)
      : Math.PI + (f[2]! - 0.5));
  const from = leave(origin, heading, outline);
  const to = leave(origin, other, outline);
  const dies = kind < 0.3;
  const reach = 0.45 + 0.3 * f[7]!;
  const stop: Point = dies
    ? [from[0] + (to[0] - from[0]) * reach, from[1] + (to[1] - from[1]) * reach]
    : beyond(to, other, PAST);
  const line = fracture(beyond(from, heading, PAST), stop, rnd, 2);
  const flare = (at: number) => ({ at, sigma: 7, amount: 0.3 });
  out.push(
    ribbon(line, dies ? nominal * 0.62 : nominal, rnd, {
      start: 1,
      end: dies ? "tip" : 1,
      overlap: false,
      pools: 1 + (rnd() < 0.5 ? 1 : 0),
      bumps: dies ? [] : [flare(PAST), flare(-PAST - 0.01)],
      flecks: 2,
    })
  );
  if (dies) return out;

  // A Y: a second crack leaves the first and runs on to another edge, and
  // sometimes a third leaves it on the other side.
  const branches = kind < 0.7 ? 0 : kind < 0.92 ? 1 : 2;
  let first = 0.5,
    side = 1;
  for (let k = 0; k < branches; k++) {
    const t =
      k === 0
        ? 0.3 + 0.4 * f[8]!
        : first > 0.5
          ? first - 0.26 - 0.1 * f[9]!
          : first + 0.26 + 0.1 * f[9]!;
    if (k === 0) first = t;
    const i = Math.floor(t * (line.length - 1)),
      p = line[i]!,
      back = line[Math.max(0, i - 6)]!,
      ahead = line[Math.min(line.length - 1, i + 6)]!,
      course = Math.atan2(ahead[1] - back[1], ahead[0] - back[0]);
    // A little under a third of a turn off the way the crack was going: a Y.
    const spread = 0.75 + 0.3 * f[10]!;
    if (k === 0) {
      const a = leave(p, course + spread, outline),
        b = leave(p, course - spread, outline);
      side =
        Math.hypot(a[0] - p[0], a[1] - p[1]) > Math.hypot(b[0] - p[0], b[1] - p[1])
          ? 1
          : -1;
    } else side = -side;
    const heading = course + side * spread,
      target = leave(p, heading, outline);
    if (Math.hypot(target[0] - p[0], target[1] - p[1]) < 24) continue;
    out.push(
      ribbon(fracture(p, beyond(target, heading, PAST), rnd, 2), nominal * 0.72, rnd, {
        start: 1.2,
        end: 1,
        overlap: false,
        pools: 1,
        bumps: [flare(-PAST - 0.01)],
        flecks: 1,
      })
    );
    out.push(pool(p, nominal * 0.78, rnd));
  }
  return out;
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
