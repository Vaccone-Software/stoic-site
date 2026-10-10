import type { NextConfig } from "next";

// A fully static site: `next build` writes plain HTML, CSS, JS and images to
// `out/`, which GitHub Pages serves as is. Under a project URL the site lives
// below `/stoic-site`; NEXT_PUBLIC_BASE_PATH says so at build time.
// Cache Components is off: its partial prerendering needs a server, and an
// export has none.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
