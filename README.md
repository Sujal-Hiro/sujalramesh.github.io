# sujalramesh.github.io

Personal portfolio of **Sujal Ramesh**, Unity developer in Bengaluru.

Static site, **no build step**. No `package.json`, no bundler, no CI: `git push`
is the deploy.

## Running it locally

```bash
python scripts/dev-server.py
```

Then open <http://localhost:8000>.

**Use this, not `python -m http.server`.** The site is plain ES modules
with no bundler, so filenames never change between builds. `http.server`
sends no `Cache-Control`, browsers cache heuristically, and a *cached
module* is far worse than a cached image: if `main.js` is fresh but the
`scroll.js` it imports is stale, the import fails on a missing export,
the entire module graph dies, and the page renders as unstyled,
half-invisible text with no obvious cause. `dev-server.py` sends
`no-store` on everything, so a plain reload is always a true reload.

**Opening `index.html` by double-clicking will not work.** The site uses ES
modules and an import map, and browsers block both over `file://`.

## Pages

| File | Purpose |
|---|---|
| `index.html` | Home: intro, work index, gallery, experience, skills, two games, contact |
| `projects.html` | Long-form write-ups for the eight main projects |
| `portfolio.html` | Full gallery of screenshots, clips and artwork |
| `404.html` | Not-found page (GitHub Pages serves this automatically) |

All four share the same `<head>`. There is no templating, so **adding a
stylesheet means editing four files** — `404.html` is the one people forget.

## Structure

```
assets/
  css/    tokens, base, layout, components, effects, games, pages, motion
  js/
    core/  env, loop, scroll
    ui/    nav, gallery, lightbox
    games/ invaders, target-rush
    three/ gamepad
  lib/three/     vendored three.js r185 + GLTFLoader
  models/gamepad/  CC0 model, 1.3 MB
Images/   media (unchanged)
scripts/  one-shot Node media optimisers (not a build step)
```

CSS is eight plain `<link>` tags rather than one file with `@import` — an
`@import` chain serialises downloads; parallel links over HTTP/2 do not.
**`motion.css` must stay last**: every user-preference query lives in it and has
to win.

JS is one entry module (`assets/js/main.js`). Every block guards its own DOM
lookups, so one entry serves all four pages and anything whose elements are
absent simply does not run.

## Design system: MATRIX

Phosphor green on near-black. A terminal, not a neon city.

That distinction is the whole design. Cyberpunk RGB means many saturated hues
competing; this is **one hue at six values**, the way a CRT has one colour, and
everything on the page is a value of it. The constraint is what makes it read as
designed rather than loud.

Five rules the CSS holds to:

1. **One hue**, 148°. No second accent, no hue cycling. Amber (`--warn`) exists
   only as a warning state, so it means something if it ever appears.
2. **Dots are the texture.** The page sits on a radial-gradient dot matrix at a
   `--dot` pitch, and the hero object is literally made of dots. One idea, all
   the way through.
3. **Mono carries the interface** — labels, indices, dates, nav, buttons. The
   serif appears once, on the name.
4. **Glow is restraint.** Display type gets a 1px core plus one wide faint halo.
   Never a 40px smear.
5. **Nothing cycles, strobes or rains.** Falling code would be a costume; a
   steady terminal is the real thing.

The background is `#050706`, not `#000`. A CRT's black is lifted by its own
glow, and on true black the green reads as floating in a void rather than
sitting on a surface.

The single biggest structural decision: **the work is a numbered index, not a
grid of cards.** Rows on hairlines read as a considered list; six equal boxes
read as a template. The same logic makes the skills section aligned text rows
rather than eight panels saying almost nothing.

### Contrast is measured, not eyeballed

Every ink value was computed against `--bg`, not chosen by eye:

| token | ratio | used for |
|---|---|---|
| `--fg` | 17.4:1 | body copy |
| `--fg-2` | 11.1:1 | bio, list items |
| `--fg-muted` | 6.2:1 | descriptions |
| `--fg-faint` | 4.95:1 | tags, dates, indices, filters |
| `--p-hi` | 16.7:1 | titles |
| `--p` | 11.8:1 | accent, rules |

`--fg-faint` was originally `L 0.48` and measured **3.18:1**, which fails AA for
small text — and it carries every ~11px mono label on the site. It is `L 0.585`
now. **Do not darken it again without re-measuring.**

### Earlier designs, and why they went

This is the third skin on the same structure. The first was dark RGB with a
hue-cycling palette, a full-page WebGL deck and 150 drifting crystals; the
second was a light editorial "paper" theme with a photoreal gamepad. The layout
underneath — the work index, the aligned timeline and skill rows, the section
mastheads — survived all three unchanged, which is the useful signal: structure
was never the problem, surface was.

If you dig through git history, note that CSS still reads some `--paper` /
`--ink` names. Those are **aliases** mapped onto the phosphor tokens at the top
of `tokens.css`, kept so the component sheets did not need rewriting. They are
not leftovers.

## The 3D

`assets/js/three/gamepad.js` renders one object: a gamepad as a **point cloud**.
Its geometry is sampled into ~110,000 dots and drawn as phosphor points, so it
reads as a 3D scan resolving out of the dark rather than as a product render. A
scan band sweeps up through it every 6.5s.

- **Model**: "Gamepad" by Josh Dean, **CC0**, from [Poly Haven](https://polyhaven.com/a/gamepad).
  1k textures, ~1.3 MB. No attribution required; the hero credits it anyway.
  Only the geometry is used — the PBR textures are never bound.
- **Area-weighted sampling, not vertices.** A model's vertices bunch wherever it
  was detailed and leave flat panels bare, so sampling them would describe the
  buttons and none of the body. Points are drawn across triangle surfaces
  weighted by area, via a cumulative-area table and a binary search.
- **Flat typed arrays throughout.** The obvious version allocates a `Vector3`
  per corner and a `THREE.Triangle` just to call `getArea()` — hundreds of
  thousands of short-lived objects, and the GC pressure alone pushed the hero
  load past fifteen seconds. It resolves in under three now.
- **One hue, brightness does the work.** Each dot is lit by a single
  normal·light term, giving the cloud a light and shadow side using nothing but
  values of the same green.
- **Dot size is calibrated to camera distance** (`9.0 / -mv.z`). A stock `300.0`
  falloff produced 75px dots that merged into a solid blob. The cloud only reads
  as a cloud while the dots stay separable.

### Gates and fallback

`can3D()` in `assets/js/core/env.js` requires ≥900px, a fine pointer, no
reduced-motion, ≥4 cores, no save-data, and WebGL2. Only then are three.js and
the model fetched, so mobile and reduced-motion visitors download **none** of
it.

When the gates fail, `.hero__object::before` shows a quiet plotted contour —
except below 900px, where the whole object column is hidden and the hero is type
only. A large empty shape on a phone is worse than no shape.

The placeholder is cleared by two selectors: the `is-loaded` class set in the
load callback, **and** `:has(.hero__gl.is-live)`. Whichever lands first wins, so
there is never a frame where the contour and the cloud are both painted.

### Failing loudly

An inline non-module script catches `error` and `unhandledrejection`, prints the
message in a fixed banner, and sets `html.js-failed`, which forces all `.reveal`
content visible.

This exists because the failure mode is genuinely invisible: if the entry module
throws, nothing ever adds `.is-visible`, every `.reveal` stays at opacity 0, and
the page renders as blank space that looks like a design problem rather than a
dead script. Content beats choreography — if the script is gone the page must
still be readable.

## Games

Both keep their full original logic.

**Space Invaders** draws into a fixed 960×540 backing store scaled by CSS, with
sprites as pixel matrices rather than images. Its palette is **literal, not read
from the CSS tokens** — Canvas2D silently ignores an invalid `fillStyle` and
keeps the previous value, which makes any colour bug there near-impossible to
spot. It is the same phosphor ramp at four values, and brightness carries the
scoring: the back rank is worth the most and is brightest, the front rank is
worth least and is nearly submerged.

Note the colour constant is `LIT`, not `SHIP` — `SHIP` is already the sprite
pixel-matrix in the same scope, and a second `const SHIP` is a duplicate
declaration that kills the whole module.

The two canvases take **opposite** scaling: the Invaders canvas is deliberately
not DPR-scaled and uses `image-rendering: pixelated`; the gamepad canvas is
DPR-scaled and must never be pixelated. This is a prime copy-paste bug.

## Media pipeline

Source footage and Photoshop exports are far too heavy to ship as-is (the
originals were ~750 MB). `scripts/optimize-media.mjs` rewrites them:

- **Videos** → 1280px-box H.264, CRF 28, audio stripped. Fetched only when a
  visitor opens the lightbox.
- **Previews** → `preview_video_N.mp4`, first 10s in a 640px box.
- **Posters** → `poster_video_N.jpg`, so `<video preload="none">` still paints.
- **Images** → WebP, max 1920px wide.

Every inline `<video>` must keep `playsinline`, `poster` and `preload="none"`.
Dropping `playsinline` breaks inline playback on iOS entirely.

```bash
npm install ffmpeg-static sharp
node scripts/optimize-media.mjs      # re-encode; skips already-optimized videos
node scripts/rewrite-media-refs.mjs  # point HTML at .webp, verify every ref
node scripts/find-unused-assets.mjs  # list anything nothing references
```

Keep the originals outside the repo — the pipeline replaces files in place.

## Gallery and the viewer

Every clickable piece of media, whether a `.tile` or a `.shot`, is a `<button>`
carrying `data-src` and `data-type`; one delegated listener opens the viewer.
Buttons may only contain phrasing content, so tile markup uses `<span>`, never
`<div>`/`<p>`.

`data-src` points at the **full** asset while the inline element shows the cheap
one: a tile showing `preview_video_7.mp4` opens `video_7.mp4`.

Images zoom (1×–6×) via wheel, pinch, double-click, the `+ / − / 0` keys, or the
control bar. Videos deliberately do not: they keep their native controls, and
transforming the element would move the scrub bar out from under the pointer.

## Accessibility

- `prefers-reduced-motion` genuinely stops things. The model is never fetched,
  reveals fade without travelling, and hover transforms are removed. It is read
  **live**, not snapshotted at load, so toggling it mid-session takes effect.
- `prefers-contrast: more` lifts every ink toward white, strengthens the rules
  and drops the dot-matrix background. It previously carried the light theme's
  values, which would have painted dark ink on a dark page — i.e. the
  accessibility mode was the least readable state on the site.
  `forced-colors` and `prefers-reduced-data` are handled too.
- Anything already on screen at first paint is revealed immediately rather than
  waiting on the observer. The observer's `-10%` bottom margin creates a dead
  band along the viewport edge, and an element sitting in it at load would
  otherwise stay invisible permanently.
- Focus is a solid 2px phosphor outline with offset.

## License

See [LICENSE](LICENSE). Vendored three.js is MIT, see
`assets/lib/three/LICENSE`. The gamepad model is CC0.
