/**
 * The path prefix the site is served under: empty on a custom domain,
 * `/stoic-site` on GitHub Pages' project URL. Set at build time.
 */
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** A public asset's URL under the base path. */
export const asset = (path: string) => `${basePath}${path}`;

/** A page of the DocC documentation, which is published under `/docs`. */
export const docs = (path = "") =>
  `${basePath}/docs/documentation/stoic/${path ? `${path}/` : ""}`;
