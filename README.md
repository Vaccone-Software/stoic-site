# stoic-site

The website for [Stoic](https://github.com/Vaccone-Software/stoic), robustness primitives for Swift apps.

A static Next.js site, built with Bun and deployed to GitHub Pages on every push to `main`. It lives apart from the library so that apps depending on Stoic never download the site's images and tooling.

## Working on it

```sh
bun install
bun run dev            # http://localhost:3000
bun run build          # static export to out/
bun run shots          # photographs every page at phone, laptop and wide widths
```

`bun run shots` also fails on console errors and on anything wider than the page. Look at the screenshots in `screenshots/` before calling a visual change done.

## How it is put together

- `content/site.ts`: everything the pages say, declared with Effect Schema and decoded at build time. Bad content fails the build.
- `lib/plates.ts`: the plate renderer. An engraving set in an arched marble niche, printed in two colours as live static.
- `components/`: the plate canvas (animates only while on screen, still for reduced motion) and the install box.
- `public/plates/`: the images, all public domain or CC0, credited on the page.

## Style

Lamp black and bone, one accent (verdigris). Text says plainly what Stoic does; the myths stay in the art and the captions. Static only inside the plates; the ground is always flat.
