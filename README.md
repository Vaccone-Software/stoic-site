# stoic-site

The website for [Stoic](https://github.com/Vaccone-Software/stoic), robustness primitives for Swift apps.

A static Next.js site, built with Bun and deployed to GitHub Pages on every push to `main`. It lives apart from the library so that apps depending on Stoic never download the site's images and tooling.

## Working on it

```sh
bun install
bun run dev            # http://localhost:3000
bun run build          # static export to out/
bun run shots          # photographs every page at phone, laptop and wide widths
bun run links          # checks every internal link and #fragment in out/
```

`bun run docc-plates ../stoic/Sources/Stoic/Stoic.docc/Resources` reprints the plates for the guide chapters in Stoic's DocC catalog, as 1-bit PNGs.

`bun run shots` also fails on console errors and on anything wider than the page. Look at the screenshots in `screenshots/` before calling a visual change done.

## How it is put together

- `content/site.ts`: everything the pages say, declared with Effect Schema and decoded at build time. Bad content fails the build.
- `lib/stoic.ts`: reads the library's Markdown (`docs/Adopting.md`, `DESIGN.md`, `design/*.md`) from a Stoic checkout at build time, and the GitHub releases for `/changelog/`. `STOIC_DIR` names the checkout (default `../stoic`); `GITHUB_TOKEN` lifts the API rate limit. Links inside the Markdown are rewritten to this site's routes or to GitHub. A missing checkout, a malformed contract or a failed fetch stops the build.
- `lib/markdown.ts`, `lib/highlight.ts`: Markdown to HTML with `marked`, GitHub heading ids, and code highlighted with `shiki` in a theme drawn from the palette.
- `app/adopting`, `app/design`, `app/changelog`, `app/not-found.tsx`: the reading pages, framed by `components/DocPage.tsx`; the header and footer are shared with the landing page.
- `lib/plates.ts`: the plate renderer. An engraving set in an arched marble niche, printed in two colours as live static.
- `components/`: the plate canvas (animates only while on screen, still for reduced motion) and the install box.
- `public/plates/`: the images, all public domain or CC0, credited on the page.
- `/docs`: Stoic's DocC reference. The deploy workflow builds it from the library's `main` on an Xcode 27 runner and copies it into the export; it is not in this repository.

## Style

Lamp black and bone, one accent (verdigris). Text says plainly what Stoic does; the myths stay in the art and the captions. Static only inside the plates; the ground is always flat.
