import { markShapes } from "@/lib/mark";

/**
 * Stoic's mark, drawn in the text colour with the sphere in the accent, so it
 * follows whatever it is set in.
 */
export function Mark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      dangerouslySetInnerHTML={{
        __html: markShapes({ print: "currentColor", accent: "var(--color-accent)" }),
      }}
    />
  );
}
