// The plate renderer: an image set in an arched marble niche between two
// fluted columns, with rays behind and an optional scraped treatment, printed
// in two colours as live static. Pure functions over luminance buffers; the
// component owns the canvas and the animation.

export const BONE: readonly [number, number, number] = [0xe6, 0xdd, 0xca];
export const LAMP_BLACK: readonly [number, number, number] = [0x13, 0x11, 0x0f];

/** A deterministic random stream (SplitMix32), so a seed always prints the same grain. */
export function stream(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return ((z ^ (z >>> 16)) >>> 0) / 4294967296;
  };
}

const NOISE_SIZE = 128;
const noiseGrid = (() => {
  const next = stream(17);
  return Float32Array.from({ length: NOISE_SIZE * NOISE_SIZE }, () => next());
})();

function noise(x: number, y: number): number {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    xf = x - xi,
    yf = y - yi;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const at = (a: number, b: number) =>
    noiseGrid[
      (((b % NOISE_SIZE) + NOISE_SIZE) % NOISE_SIZE) * NOISE_SIZE +
        (((a % NOISE_SIZE) + NOISE_SIZE) % NOISE_SIZE)
    ];
  const a = at(xi, yi),
    b = at(xi + 1, yi),
    c = at(xi, yi + 1),
    d = at(xi + 1, yi + 1);
  const u = smooth(xf),
    v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, y: number): number {
  let value = 0,
    amplitude = 0.5;
  for (let octave = 0; octave < 4; octave++) {
    value += noise(x, y) * amplitude;
    x *= 2.03;
    y *= 2.03;
    amplitude *= 0.5;
  }
  return value;
}

/** Dark stone with bright veins; `scale` keeps the veins the same size at any canvas size. */
function marble(x: number, y: number, seed: number, scale: number): number {
  const v = Math.abs(
    Math.sin(
      x * 0.011 * scale +
        y * 0.019 * scale +
        fbm(x * 0.012 * scale + seed, y * 0.012 * scale) * 7.5
    )
  );
  if (v < 0.035) return 0.9;
  if (v < 0.09) return 0.38;
  return 0.05 + fbm(x * 0.05, y * 0.05) * 0.1;
}

/**
 * The image as normalised luminance, contained in w × h; inverted when asked,
 * so that a line engraving's dark lines print bright.
 */
function engraving(
  image: CanvasImageSource & { width: number; height: number },
  w: number,
  h: number,
  invert: boolean
) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  const scale = Math.min(w / image.width, h / image.height);
  const dw = image.width * scale,
    dh = image.height * scale;
  context.fillStyle = "#fff";
  context.fillRect(0, 0, w, h);
  context.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);
  const data = context.getImageData(0, 0, w, h).data;
  let lo = 255,
    hi = 0;
  for (let i = 0; i < w * h; i += 3) {
    const v = data[i * 4];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const values = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const v = Math.min(
      1,
      Math.max(0, (data[i * 4] - lo) / Math.max(1, hi - lo))
    );
    values[i] = invert ? 1 - v : v;
  }
  return { values, x: (w - dw) / 2, y: (h - dh) / 2, w: dw, h: dh };
}

function drawRays(
  target: Float32Array,
  w: number,
  h: number,
  cx: number,
  cy: number,
  seed: number,
  count: number,
  strength: number
) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.fillStyle = "#000";
  context.fillRect(0, 0, w, h);
  const next = stream(seed),
    reach = Math.hypot(w, h);
  for (let k = 0; k < count; k++) {
    const angle = (k / count) * Math.PI * 2;
    const long = k % 7 === 0;
    const inner = reach * (0.08 + next() * 0.04);
    const outer = reach * (0.3 + (long ? 0.45 : next() * 0.2));
    context.strokeStyle = `rgba(255,255,255,${long ? 0.85 : 0.38})`;
    context.lineWidth = long ? 1.1 : 0.6;
    context.beginPath();
    context.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    context.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    context.stroke();
  }
  const data = context.getImageData(0, 0, w, h).data;
  for (let i = 0; i < w * h; i++)
    target[i] = Math.max(target[i], (data[i * 4] / 255) * strength);
}

export interface NicheOptions {
  readonly seed: number;
  /** How much of the figure is scraped back to the stone, 0 to 1. */
  readonly scrape: number;
  readonly rays: boolean;
  /** Print the image as a negative (for line engravings on white paper). */
  readonly invert: boolean;
}

/** Composes the luminance of a figure standing in an arched niche. */
export function composeNiche(
  w: number,
  h: number,
  image: CanvasImageSource & { width: number; height: number },
  options: NicheOptions
): Float32Array {
  const { seed, scrape, rays, invert } = options;
  const luminance = new Float32Array(w * h);
  const archWidth = w * 0.6,
    cx = w / 2,
    archLeft = cx - archWidth / 2,
    radius = archWidth / 2;
  const top = h * 0.07,
    bottom = h * 0.95;
  const scale = 520 / Math.max(w, 260);
  if (rays)
    drawRays(
      luminance,
      w,
      h,
      cx,
      top + radius * 0.9,
      seed,
      Math.round(140 + w / 4),
      0.5
    );

  const inArch = (x: number, y: number) =>
    x >= archLeft &&
    x < archLeft + archWidth &&
    y < bottom &&
    (y >= top + radius || Math.hypot(x - cx, y - (top + radius)) < radius);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (inArch(x, y)) luminance[y * w + x] = marble(x, y, seed, scale) * 0.4;

  // The arch's moulding: two hairlines following its outline.
  for (const offset of [5, 10]) {
    for (let a = Math.PI; a <= Math.PI * 2; a += 0.002) {
      const x = Math.round(cx + Math.cos(a) * (radius + offset)),
        y = Math.round(top + radius + Math.sin(a) * (radius + offset));
      if (x >= 0 && y >= 0 && x < w && y < h) luminance[y * w + x] = 0.95;
    }
    for (let y = Math.round(top + radius); y < bottom; y++) {
      for (const x of [
        Math.round(archLeft - offset),
        Math.round(archLeft + archWidth + offset - 1),
      ])
        if (x >= 0 && x < w) luminance[y * w + x] = 0.95;
    }
  }

  // Fluted columns either side.
  const columnWidth = Math.max(8, w * 0.08);
  for (const columnLeft of [
    archLeft - columnWidth - w * 0.04,
    archLeft + archWidth + w * 0.04,
  ]) {
    const flute = Math.max(2, columnWidth / 7);
    for (let y = Math.round(top + radius * 0.6); y < bottom; y++) {
      for (let x = Math.round(columnLeft); x < columnLeft + columnWidth; x++) {
        if (x < 0 || x >= w) continue;
        const u = (x - columnLeft) / columnWidth;
        const lit = Math.max(0, Math.cos((u - 0.35) * Math.PI));
        luminance[y * w + x] =
          lit *
          (0.5 + 0.5 * (Math.floor((x - columnLeft) / flute) % 2 ? 1 : 0.35));
      }
    }
  }

  // Plinth.
  for (let y = Math.round(bottom); y < h; y++) {
    for (
      let x = Math.round(archLeft - columnWidth - w * 0.06);
      x < archLeft + archWidth + columnWidth + w * 0.06;
      x++
    ) {
      if (x >= 0 && x < w)
        luminance[y * w + x] = y === Math.round(bottom) ? 0.95 : 0.22;
    }
  }

  // The figure, standing in the arch. Its lines are laid over the stone; its
  // paper mutes the stone a little so the figure reads. Where scraped, the
  // image is worn back to the marble with a bright edge.
  const figureWidth = Math.round(archWidth * 0.98),
    figureHeight = Math.round((bottom - top) * 0.98);
  const figureLeft = Math.round(cx - figureWidth / 2),
    figureTop = Math.round(bottom - figureHeight);
  const figure = engraving(image, figureWidth, figureHeight, invert);
  const edge = 0.66 - scrape * 0.3;
  for (let y = 0; y < figureHeight; y++) {
    for (let x = 0; x < figureWidth; x++) {
      if (
        x < figure.x ||
        x >= figure.x + figure.w ||
        y < figure.y ||
        y >= figure.y + figure.h
      )
        continue;
      const X = figureLeft + x,
        Y = figureTop + y;
      if (!inArch(X, Y)) continue;
      const i = Y * w + X;
      // The figure keeps all its tones: a soft curve lifts the forms, and the
      // stone shows faintly through the darks rather than being cut out.
      const raw = figure.values[y * figureWidth + x];
      const t = Math.min(1, Math.max(0, (raw - 0.04) / 0.9));
      const v = t * t * (3 - 2 * t) * 0.92 + luminance[i] * 0.25 * (1 - t);
      if (scrape > 0) {
        // Scraped: worn back to the stone, fading in over a soft margin
        // instead of a hard bright edge.
        const wear = fbm(X * 0.006 * scale + seed * 3, Y * 0.03 * scale);
        const worn = Math.min(1, Math.max(0, (wear - edge) / 0.05));
        luminance[i] =
          v * (1 - worn) + marble(X, Y, seed + 9, scale) * 0.7 * worn;
        continue;
      }
      luminance[i] = v;
    }
  }
  return luminance;
}

/** Prints luminance as static: each pixel against a fresh random threshold, in bone on lamp black. */
export function printStatic(
  context: CanvasRenderingContext2D,
  w: number,
  h: number,
  luminance: Float32Array,
  seed: number
) {
  const image = context.createImageData(w, h),
    data = image.data,
    next = stream(seed);
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    const v = Math.min(1, Math.max(0, (luminance[i] - 0.35) * 2.1 + 0.5));
    const colour = v > next() ? BONE : LAMP_BLACK;
    data[p] = colour[0];
    data[p + 1] = colour[1];
    data[p + 2] = colour[2];
    data[p + 3] = 255;
  }
  context.putImageData(image, 0, 0);
}
