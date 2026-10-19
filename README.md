# stoic-site

The website for [Stoic](https://github.com/Vaccone-Software/stoic), robustness primitives for Swift apps.

A static Next.js site, built with Bun and deployed to GitHub Pages on every push to `main`. It lives apart from the library so that apps depending on Stoic never download the site's images and tooling.

## Working on it

```sh
bun install
bun run dev            # http://localhost:3000
bun run build          # static export to out/
bun run shots          # photographs every page at phone, tablet, laptop and wide sizes
bun run links          # checks every internal link and #fragment in out/
```

`bun run docc-plates ../stoic/Sources/Stoic/Stoic.docc/Resources` reprints the plates for the guide chapters in Stoic's DocC catalog, as 1-bit PNGs.

`bun run shots` also fails on console errors and on anything wider than the page, and checks the home page's mosaic: that the seal is never cut off or moved (at the photographed sizes and a sweep of others), that no tile label is clipped, that hovering a tile reads it, and that on a phone a tap opens it in place. Look at the screenshots in `screenshots/` before calling a visual change done.

## How it is put together

- `content/site.ts`: everything the pages say, declared with Effect Schema and decoded at build time. Bad content fails the build.
- `lib/stoic.ts`: reads the library's Markdown (`docs/Adopting.md`, `DESIGN.md`, `design/*.md`) from a Stoic checkout at build time, and the GitHub releases for `/changelog/`. `STOIC_DIR` names the checkout (default `../stoic`); `GITHUB_TOKEN` lifts the API rate limit. Links inside the Markdown are rewritten to this site's routes or to GitHub. A missing checkout, a malformed contract or a failed fetch stops the build.
- `lib/markdown.ts`, `lib/highlight.ts`: Markdown to HTML with `marked`, GitHub heading ids, and code highlighted with `shiki` in a theme drawn from the palette.
- `app/adopting`, `app/design`, `app/changelog`, `app/not-found.tsx`: the reading pages, framed by `components/DocPage.tsx`; the header and footer are shared with the landing page.
- `lib/plates.ts`: the plate renderer: an engraving printed in two colours as live static, set in an arched marble niche (the DocC plates and icons) or cropped to fill a tile (the home page).
- `lib/mosaic.ts`: the home page's geometry as pure functions: the jittered floor, the gold inlay along each seam, a mended crack, and the seeded failure sequence (seed 0x5EED).
- `components/Mosaic.tsx`: the home page, a client component: tiles of live static (only tiles that are on screen are printed; a still frame for reduced motion; only the tile in hand if the machine is slow), the failure sequence, the legend and, on a phone, the two-column grid where a tap opens a tile. `content/site.ts` holds the tiles, and the build fails if they leave a hole in the floor or crop outside their plate.
- `public/plates/`: the images, credited under "Image credits" in the footer of the home page. All are public domain or CC0 except one, which its source licenses CC BY-SA 4.0 (see `content/site.ts`). Crops in `content/site.ts` are in each image's pixels, so replacing an image with one of another size means updating its `width` and `height`.
- The version on the home page and in the footer is the tag of Stoic's newest release, read with the changelog's releases at build time.
- `/docs`: Stoic's DocC reference. The deploy workflow builds it from the library's `main` on an Xcode 27 runner and copies it into the export; it is not in this repository.

## Style

Lamp black and bone, one accent (verdigris). Text says plainly what Stoic does; the myths stay in the art and the captions. Static only inside the plates; the ground is always flat.
