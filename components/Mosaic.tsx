"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  SEED,
  SWELL,
  failures,
  layout,
  mend,
  spell,
  type Cells,
  type Crack,
  type Inlay,
} from "@/lib/mosaic";
import { asset } from "@/lib/paths";
import { printStatic, tileTones, type Crop } from "@/lib/plates";

/** One tile, with everything the legend says about it. */
export interface MosaicTile extends Cells {
  readonly id: string;
  readonly name: string;
  readonly plate: string;
  readonly invert: boolean;
  readonly crop?: Crop;
  readonly what: string;
  readonly use: string;
  readonly failure: string;
  readonly recovery: string;
}

interface Props {
  readonly rows: number;
  readonly columns: number;
  readonly seal: Cells;
  readonly tiles: readonly MosaicTile[];
  readonly motto: string;
  readonly summary: string;
  readonly emphasis: string;
  /** The package's address and the version to depend on: shown as the line that adds it, and copied. */
  readonly repository: string;
  readonly version: string;
}

/** Below this the floor is a two-column grid and a tap opens a tile; above it is the mosaic. */
const MOBILE = "(max-width: 900px)";
const REDUCED = "(prefers-reduced-motion: reduce)";

/** A failure takes this long to tear and settle, and another is due this long after the last began. */
const FAILING_MS = 1300;
const FAILURE_EVERY_MS = 3400;
const FIRST_FAILURE_MS = 1800;
/** Failures already mended when motion is reduced, so the floor has its scars at once. */
const SETTLED_FAILURES = 8;

const FRAME_MS = 1000 / 6;
/** If a frame of every visible tile costs more than this on average, only the tile in hand re-rolls. */
const FRAME_BUDGET_MS = 28;

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const list = matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    () => matchMedia(query).matches,
    () => false
  );
}

function usePageVisible(): boolean {
  return useSyncExternalStore(
    (notify) => {
      document.addEventListener("visibilitychange", notify);
      return () => document.removeEventListener("visibilitychange", notify);
    },
    () => !document.hidden,
    () => true
  );
}

const images = new Map<string, Promise<HTMLImageElement>>();
function loadImage(src: string): Promise<HTMLImageElement> {
  let image = images.get(src);
  if (!image) {
    image = new Promise((resolve, reject) => {
      const element = new Image();
      element.decoding = "async";
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error(`Cannot load ${src}`));
      element.src = asset(src);
    });
    images.set(src, image);
  }
  return image;
}

/** What the loop knows of each tile: its canvas, the tones to print, and whether it can be seen. */
interface Printing {
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D;
  readonly seed: number;
  width: number;
  height: number;
  tones: Float32Array | null;
  blank: Float32Array | null;
  buffer: ImageData | undefined;
  image: HTMLImageElement | null;
  visible: boolean;
}

interface Failing {
  readonly tile: number;
  readonly start: number;
}

/** The failures a reduced-motion visitor sees at once: the first few, already mended. */
function settle(tiles: number) {
  const next = failures(tiles);
  const cracks: Crack[][] = Array.from({ length: tiles }, () => []);
  let last = -1;
  for (let k = 0; k < SETTLED_FAILURES; k++) {
    const failure = next();
    cracks[failure.tile]!.push(failure.crack);
    last = failure.tile;
  }
  return { cracks, repairs: SETTLED_FAILURES, event: { tile: last, ok: true } };
}

function Gold({ inlay }: { readonly inlay: Inlay }) {
  return (
    <>
      <path d={inlay.shape} fill="url(#mosaic-gold)" />
      {inlay.flecks.map((fleck, i) => (
        <circle
          key={i}
          cx={fleck.x}
          cy={fleck.y}
          r={fleck.r}
          fill="url(#mosaic-gold)"
        />
      ))}
    </>
  );
}

/**
 * Stoic's parts as a floor of engraved tiles around the name. Each plate is
 * printed as live static; every seam is a gold inlay; every few seconds a
 * seeded failure tears one tile and leaves it mended in gold. Hover a tile,
 * or on a phone tap it, to read what it is.
 */
export function Mosaic({
  rows,
  columns,
  seal,
  tiles,
  motto,
  summary,
  emphasis,
  repository,
  version,
}: Props) {
  const mobile = useMedia(MOBILE);
  const reduced = useMedia(REDUCED);
  const pageVisible = usePageVisible();

  const floorRef = useRef<HTMLElement>(null);
  const sealRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const codeRef = useRef<HTMLElement>(null);

  const [floorSize, setFloorSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [sizes, setSizes] = useState<
    readonly { width: number; height: number }[]
  >([]);
  const [floorVisible, setFloorVisible] = useState(true);
  const [sealVisible, setSealVisible] = useState(true);
  const [hover, setHover] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [copy, setCopy] = useState<"Copy" | "Copied" | "Selected">("Copy");

  // The failure sequence.
  const [round, setRound] = useState(0);
  const [cracks, setCracks] = useState<readonly (readonly Crack[])[]>(() =>
    tiles.map(() => [])
  );
  const [repairs, setRepairs] = useState(0);
  const [event, setEvent] = useState<{ tile: number; ok: boolean } | null>(
    null
  );
  const [failing, setFailing] = useState<Failing | null>(null);
  const engine = useRef(failures(tiles.length));
  const pending = useRef<{ tile: number; crack: Crack } | null>(null);

  const settled = useMemo(
    () => (reduced ? settle(tiles.length) : null),
    [reduced, tiles.length]
  );
  const shown = {
    cracks: settled?.cracks ?? cracks,
    repairs: settled?.repairs ?? repairs,
    event: settled?.event ?? event,
    failing: settled ? null : failing,
  };

  const active = pageVisible && floorVisible;
  useEffect(() => {
    if (reduced || !active) return;
    const mended = () => {
      const done = pending.current;
      if (!done) return;
      pending.current = null;
      setCracks((all) =>
        all.map((list, i) => (i === done.tile ? [...list, done.crack] : list))
      );
      setRepairs((n) => n + 1);
      setEvent({ tile: done.tile, ok: true });
      setFailing(null);
    };
    let settling: ReturnType<typeof setTimeout> | undefined;
    const fail = () => {
      mended();
      const next = engine.current();
      pending.current = next;
      setEvent({ tile: next.tile, ok: false });
      setFailing({ tile: next.tile, start: performance.now() });
      settling = setTimeout(mended, FAILING_MS);
    };
    // A failure that a pause interrupted is mended before the next begins.
    mended();
    let every: ReturnType<typeof setInterval> | undefined;
    const first = setTimeout(() => {
      fail();
      every = setInterval(fail, FAILURE_EVERY_MS);
    }, FIRST_FAILURE_MS);
    return () => {
      clearTimeout(first);
      clearTimeout(settling);
      clearInterval(every);
    };
  }, [reduced, active, round]);

  const replay = () => {
    engine.current = failures(tiles.length);
    pending.current = null;
    setCracks(tiles.map(() => []));
    setRepairs(0);
    setEvent(null);
    setFailing(null);
    setRound((n) => n + 1);
  };

  // The size of the floor, for the mosaic's geometry.
  useLayoutEffect(() => {
    const floor = floorRef.current;
    if (!floor) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setFloorSize((was) =>
          was?.width === floor.clientWidth && was.height === floor.clientHeight
            ? was
            : { width: floor.clientWidth, height: floor.clientHeight }
        )
      );
    });
    observer.observe(floor);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  // What is on screen: the floor (the failures wait while it is not) and the
  // seal (on a phone, a one-line status takes over when it has scrolled away).
  useEffect(() => {
    const floor = floorRef.current,
      sealElement = sealRef.current;
    if (!floor || !sealElement) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === floor) setFloorVisible(entry.isIntersecting);
        else setSealVisible(entry.isIntersecting);
      }
    });
    observer.observe(floor);
    observer.observe(sealElement);
    return () => observer.disconnect();
  }, []);

  const floor = useMemo(
    () =>
      floorSize && !mobile
        ? layout(
            floorSize.width,
            floorSize.height,
            { rows, columns, seal },
            tiles
          )
        : null,
    [floorSize, mobile, rows, columns, seal, tiles]
  );

  // The static. The loop reads what React last rendered through `live`.
  const live = useRef({ hover, open, mobile, failing: shown.failing });
  useEffect(() => {
    live.current = { hover, open, mobile, failing: shown.failing };
  });

  useEffect(() => {
    const buttons = tileRefs.current;
    const printing: Printing[] = tiles.map((_, i) => {
      const canvas = buttons[i]!.querySelector("canvas")!;
      return {
        canvas,
        context: canvas.getContext("2d")!,
        seed: 101 + i * 7919,
        width: 0,
        height: 0,
        tones: null,
        blank: null,
        buffer: undefined,
        image: null,
        visible: false,
      };
    });

    // One frame of a tile; while it fails, with chance in its tones and rows torn.
    const print = (
      p: Printing,
      seed: number,
      disturbance: { noise?: number; tear?: number } = {}
    ) => {
      if (!p.width || !p.height) return;
      p.blank ??= new Float32Array(p.width * p.height);
      p.buffer = printStatic(
        p.context,
        p.width,
        p.height,
        p.tones ?? p.blank,
        seed,
        {
          ...disturbance,
          buffer: p.buffer,
        }
      );
    };
    const prepare = (p: Printing, tile: MosaicTile) => {
      p.canvas.width = p.width;
      p.canvas.height = p.height;
      p.buffer = undefined;
      p.blank = null;
      p.tones = p.image
        ? tileTones(p.image, p.width, p.height, tile.crop, tile.invert)
        : null;
      print(p, p.seed, p.tones ? {} : { noise: 1 });
    };

    let cancelled = false;
    tiles.forEach((tile, i) => {
      loadImage(`/plates/${tile.plate}.jpg`).then(
        (image) => {
          if (cancelled) return;
          printing[i]!.image = image;
          if (printing[i]!.width) prepare(printing[i]!, tile);
        },
        () => {
          // A plate that will not load leaves its tile as static, which still reads as a tile.
        }
      );
    });

    // Tiles change size with the window and, on a phone, when one opens.
    let flush: ReturnType<typeof setTimeout> | undefined;
    const resized = new Set<number>();
    const sizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const i = buttons.indexOf(entry.target as HTMLButtonElement),
          p = printing[i]!,
          width = (entry.target as HTMLElement).clientWidth,
          height = (entry.target as HTMLElement).clientHeight;
        if (width === p.width && height === p.height) continue;
        p.width = width;
        p.height = height;
        resized.add(i);
      }
      if (resized.size === 0) return;
      clearTimeout(flush);
      flush = setTimeout(() => {
        for (const i of resized) prepare(printing[i]!, tiles[i]!);
        resized.clear();
        setSizes(printing.map((p) => ({ width: p.width, height: p.height })));
      }, 60);
    });
    buttons.forEach((button) => button && sizeObserver.observe(button));

    // A tile that cannot be seen is not printed.
    const visibility = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const i = buttons.indexOf(entry.target as HTMLButtonElement);
        printing[i]!.visible = entry.isIntersecting;
      }
    });
    buttons.forEach((button) => button && visibility.observe(button));

    // Every visible tile re-rolls a few times a second, unless the machine
    // cannot keep up, in which case only the tile in hand does; a visitor who
    // prefers reduced motion gets the still frame.
    let mode: "all" | "hand" | "still" = reduced ? "still" : "all",
      frame = 0,
      last = 0,
      cost = 0,
      frames = 0,
      tearing = -1;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (document.hidden) return;
      const { hover, open, mobile, failing } = live.current;
      if (failing) {
        const p = printing[failing.tile]!;
        const k = (now - failing.start) / FAILING_MS;
        if (k < 1 && p.visible) {
          const s = Math.sin(k * Math.PI);
          print(p, p.seed + Math.floor(now / 70), { noise: 0.7 * s, tear: s });
        }
      }
      // A tile that has stopped failing is printed whole again at once.
      if (tearing >= 0 && failing?.tile !== tearing)
        print(printing[tearing]!, printing[tearing]!.seed);
      tearing = failing?.tile ?? -1;
      if (mode === "still" || now - last < FRAME_MS) return;
      last = now;
      const began = performance.now(),
        rolled = Math.floor(now / 166);
      const inHand = mobile ? open : hover;
      printing.forEach((p, i) => {
        if (failing?.tile === i) return;
        if (mode === "all" ? p.visible : inHand === i)
          print(p, p.seed + rolled * 131);
      });
      cost += performance.now() - began;
      if (++frames === 12) {
        if (mode === "all" && cost / frames > FRAME_BUDGET_MS) mode = "hand";
        cost = 0;
        frames = 0;
      }
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearTimeout(flush);
      sizeObserver.disconnect();
      visibility.disconnect();
    };
  }, [tiles, reduced]);

  // A tile opened on a phone is brought fully into view.
  useEffect(() => {
    if (!mobile || open === null) return;
    const button = tileRefs.current[open];
    const frame = requestAnimationFrame(() =>
      button?.scrollIntoView({
        block: "nearest",
        behavior: reduced ? "auto" : "smooth",
      })
    );
    return () => cancelAnimationFrame(frame);
  }, [open, mobile, reduced]);

  const copyDependency = async () => {
    try {
      await navigator.clipboard.writeText(`.package(url: "${repository}", from: "${version}")`);
      setCopy("Copied");
    } catch {
      // Clipboard access can be refused; select the line so it can be copied by hand.
      const code = codeRef.current;
      if (code) {
        const range = document.createRange();
        range.selectNodeContents(code);
        const selection = getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      setCopy("Selected");
    }
    setTimeout(() => setCopy("Copy"), 1600);
  };

  // Mended cracks, drawn to each tile's size.
  const crackList = shown.cracks;
  const mended = useMemo(
    () =>
      tiles.map((_, i) => {
        const size = sizes[i];
        return size && size.width > 0 && size.height > 0
          ? crackList[i]!.map((crack) =>
              mend(size.width, size.height, crack, floor?.tiles[i]?.placement.local)
            )
          : [];
      }),
    [tiles, sizes, crackList, floor]
  );

  const hovered = !mobile && hover !== null ? tiles[hover] : undefined;
  const eventTile = shown.event ? tiles[shown.event.tile] : undefined;
  const ready = mobile || floor !== null;

  return (
    <section
      ref={floorRef}
      aria-label="The parts of Stoic"
      className={`mosaic${ready ? " ready" : ""}`}
    >
      <svg
        className="mosaic-defs"
        width="0"
        height="0"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient
            id="mosaic-gold"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2="900"
            y2="520"
            spreadMethod="reflect"
          >
            <stop offset="0" stopColor="#9a7830" />
            <stop offset="0.2" stopColor="#c9a444" />
            <stop offset="0.34" stopColor="#e0c46c" />
            <stop offset="0.5" stopColor="#bb9a3d" />
            <stop offset="0.68" stopColor="#d2b252" />
            <stop offset="0.84" stopColor="#a8832f" />
            <stop offset="1" stopColor="#c9a444" />
          </linearGradient>
          <filter
            id="mosaic-gilt"
            x="-10%"
            y="-10%"
            width="120%"
            height="120%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur
              in="SourceAlpha"
              stdDeviation="1"
              result="relief"
            />
            <feDiffuseLighting
              in="relief"
              surfaceScale="1.2"
              diffuseConstant="1"
              lightingColor="#ffffff"
              result="shade"
            >
              <feDistantLight azimuth="225" elevation="52" />
            </feDiffuseLighting>
            <feComposite
              in="SourceGraphic"
              in2="shade"
              operator="arithmetic"
              k1="1.28"
              k2="0"
              k3="0"
              k4="0"
              result="modelled"
            />
            <feSpecularLighting
              in="relief"
              surfaceScale="2"
              specularConstant="0.4"
              specularExponent="9"
              lightingColor="#ffe9b0"
              result="sheen"
            >
              <feDistantLight azimuth="225" elevation="42" />
            </feSpecularLighting>
            <feComposite
              in="modelled"
              in2="sheen"
              operator="arithmetic"
              k1="0"
              k2="1"
              k3="0.5"
              k4="0"
              result="lit"
            />
            <feComposite
              in="lit"
              in2="SourceAlpha"
              operator="in"
              result="gold"
            />
            <feDropShadow
              in="gold"
              dx="0.2"
              dy="0.6"
              stdDeviation="0.6"
              floodColor="#000"
              floodOpacity="0.4"
            />
          </filter>
        </defs>
      </svg>

      <div
        ref={sealRef}
        className="seal"
        style={
          floor
            ? {
                left: floor.seal.x,
                top: floor.seal.y,
                width: floor.seal.width,
                height: floor.seal.height,
                clipPath: floor.seal.clip,
              }
            : undefined
        }
      >
        <div className="in">
          <h1>STOIC</h1>
          <p className="motto">{motto}</p>
          <p className="muted">
            {summary} <b>{emphasis}</b>
          </p>
          <div className="pkg">
            <code ref={codeRef}>
              {".package(url: "}
              <em>{`"${repository}"`}</em>
              {", from: "}
              <em>{`"${version}"`}</em>
              {")"}
            </code>
            <button type="button" onClick={copyDependency}>
              {copy}
            </button>
          </div>
          <div className="legend" aria-live={hovered ? "polite" : "off"}>
            {hovered ? (
              <>
                <span className="name">{hovered.name}</span>
                <span className="what">{hovered.what}</span>
                <span className="use">{hovered.use}</span>
              </>
            ) : eventTile && shown.event ? (
              <>
                <span className="name">{eventTile.name}</span>
                <span className="ev">
                  <span className={shown.event.ok ? "ok" : "x"}>
                    {shown.event.ok
                      ? `✓ ${eventTile.recovery}`
                      : `✗ ${eventTile.failure}`}
                  </span>
                </span>
                <span className="use">
                  {shown.event.ok
                    ? "Mended in gold, and the seam kept."
                    : "Failing…"}
                </span>
              </>
            ) : (
              <>
                <span className="name">{`${spell(tiles.length)} parts`}</span>
                <span className="what">
                  {`Each tile is one part of Stoic. ${
                    mobile ? "Tap one to read it" : "Hover one to read it"
                  }, or watch one fail and be mended.`}
                </span>
                <span className="use" />
              </>
            )}
          </div>
          <div className="meta">
            <span>{`repairs ${shown.repairs} · lost 0`}</span>
            <span>{`seed 0x${SEED.toString(16).toUpperCase()}`}</span>
            <button type="button" onClick={replay}>
              Replay
            </button>
          </div>
        </div>
      </div>

      {tiles.map((tile, i) => {
        const placed = floor?.tiles[i];
        const isOpen = mobile && open === i;
        const classes = [
          "tile",
          tile.columns > 1 ? "w2" : "",
          tile.rows > 1 ? "h2" : "",
          isOpen ? "open" : "",
          shown.failing?.tile === i ? "failing" : "",
        ];
        return (
          <button
            key={tile.id}
            ref={(element) => {
              tileRefs.current[i] = element;
            }}
            type="button"
            className={classes.filter(Boolean).join(" ")}
            aria-label={`${tile.name}. ${tile.what} ${tile.use}`}
            aria-expanded={mobile ? isOpen : undefined}
            style={
              placed
                ? {
                    left: placed.placement.x,
                    top: placed.placement.y,
                    width: placed.placement.width,
                    height: placed.placement.height,
                    clipPath: placed.placement.clip,
                  }
                : undefined
            }
            onMouseEnter={() => !mobile && setHover(i)}
            onMouseLeave={() => setHover((was) => (was === i ? null : was))}
            onFocus={() => !mobile && setHover(i)}
            onBlur={() => setHover((was) => (was === i ? null : was))}
            onClick={() => {
              if (mobile) setOpen((was) => (was === i ? null : i));
            }}
          >
            <canvas aria-hidden="true" />
            <svg
              aria-hidden="true"
              viewBox={`0 0 ${sizes[i]?.width ?? 1} ${sizes[i]?.height ?? 1}`}
            >
              {mended[i]!.map((pieces, k) => (
                <g key={k} filter="url(#mosaic-gilt)">
                  {pieces.map((piece, j) => (
                    <Gold key={j} inlay={piece} />
                  ))}
                </g>
              ))}
            </svg>
            <span
              className="label"
              style={
                placed
                  ? {
                      left: placed.label.left,
                      bottom: placed.label.bottom,
                      maxWidth: placed.label.maxWidth,
                    }
                  : undefined
              }
            >
              {tile.name}
            </span>
            <span className="desc">
              <b>{tile.name}</b>
              <span>{tile.what}</span>
              <i>{tile.use}</i>
            </span>
          </button>
        );
      })}

      {floor && floorSize && (
        <>
          <svg
            className="seams"
            viewBox={`0 0 ${floorSize.width} ${floorSize.height}`}
            aria-hidden="true"
          >
            <g filter="url(#mosaic-gilt)">
              {floor.seams.map((inlay, i) => (
                <Gold key={i} inlay={inlay} />
              ))}
            </g>
          </svg>
          <svg
            className="outline"
            viewBox={`0 0 ${floorSize.width} ${floorSize.height}`}
            aria-hidden="true"
          >
            {floor.tiles.map((placed, i) => (
              <polygon
                key={tiles[i]!.id}
                className={hover === i ? "on" : undefined}
                style={{ strokeWidth: floor.weight * SWELL + 3.4 }}
                points={placed.outline
                  .map((point) => point.join(","))
                  .join(" ")}
              />
            ))}
          </svg>
        </>
      )}

      {mobile && floorVisible && !sealVisible && (
        <p className="status" aria-hidden="true">
          <span>
            {eventTile && shown.event ? (
              <>
                <b className={shown.event.ok ? "ok" : "x"}>
                  {shown.event.ok ? "✓" : "✗"}
                </b>{" "}
                {eventTile.name} ·{" "}
                {shown.event.ok ? eventTile.recovery : eventTile.failure}
              </>
            ) : (
              <>{spell(tiles.length)} parts</>
            )}
          </span>
          <span>{`repairs ${shown.repairs}`}</span>
        </p>
      )}
    </section>
  );
}
