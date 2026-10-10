"use client";

import { useEffect, useRef } from "react";
import { composeNiche, printStatic } from "@/lib/plates";
import { asset } from "@/lib/paths";

interface Props {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly description: string;
  readonly seed: number;
  readonly scrape?: number;
  readonly rays?: boolean;
  readonly invert: boolean;
  readonly className?: string;
}

const FRAMES_PER_SECOND = 7;

/**
 * A plate in live static. The grain re-rolls a few times a second while the
 * plate is on screen, stops when it is not, and holds a single still frame
 * for anyone who prefers reduced motion.
 */
export function PlateCanvas({
  src,
  width,
  height,
  description,
  seed,
  scrape = 0,
  rays = true,
  invert,
  className,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let luminance: Float32Array | null = null;
    let visible = false,
      frame = 0,
      last = 0,
      cancelled = false;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const draw = (time: number) => {
      if (!luminance) return;
      printStatic(
        context,
        width,
        height,
        luminance,
        Math.floor((time / 1000) * FRAMES_PER_SECOND) + seed * 131
      );
    };
    const loop = (time: number) => {
      if (time - last > 1000 / FRAMES_PER_SECOND) {
        last = time;
        draw(time);
      }
      if (visible) frame = requestAnimationFrame(loop);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !reduced && luminance) frame = requestAnimationFrame(loop);
      else cancelAnimationFrame(frame);
    });

    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (cancelled) return;
      luminance = composeNiche(width, height, image, { seed, scrape, rays, invert });
      draw(0);
      observer.observe(canvas);
    };
    image.src = asset(src);

    return () => {
      cancelled = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [src, width, height, seed, scrape, rays, invert]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      role="img"
      aria-label={description}
      className={className}
    />
  );
}
