# sujalramesh.github.io

Personal portfolio of **Sujal Ramesh**, Unity developer in Bengaluru.

Static site, **no build step**. No `package.json`, no bundler, no CI: `git push`
is the deploy.

## Running it locally

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.

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

## Design system: PAPER

Warm paper, near-black ink, one accent, a lot of air. The thesis: almost every
game-developer portfolio is a dark neon page, and the work here — screenshots,
clips, two playable games — is loud enough on its own. The page around it stays
quiet and lets the work be the colour.

Five rules the CSS holds to:

1. **One accent**, spent sparingly — six or seven appearances per screen. A
   single vermillion, `oklch(0.55 0.185 32)`, ~5.4:1 on paper so it works as
   text as well as a mark. Everything else is ink on paper.
2. **Rules, not boxes.** Structure comes from hairlines and alignment. No cards
   inside cards, no drop shadows, no filled panels.
3. **Type carries the design.** Instrument Serif for display, Inter for reading,
   JetBrains Mono for every label, index, date and readout. The gap between the
   display and body sizes *is* the design.
4. **Space is a material.** Nothing is crowded to fit more in.
5. **Motion is short, small, and confirms an action.** Nothing loops, floats or
   cycles.

The single biggest structural decision: **the work is a numbered index, not a
grid of cards.** Rows on hairlines read as a considered list; six equal boxes
read as a template. The same logic turns the skills section into aligned text
rows rather than eight panels saying almost nothing.

### What was removed

This replaced a dark RGB design. Gone, deliberately: the hue-cycling palette,
the full-page WebGL deck, 150 drifting crystals, the atmosphere/vignette/grain
layers, scanlines, HUD corner brackets, the cursor spotlight, card tilt, glow
tokens, and the parallax masonry. `effects.css` is nearly empty now and that is
the point.

## The 3D

`assets/js/three/gamepad.js` renders exactly one object: a photoreal gamepad,
lit like a product shot, turning once every ~35s and leaning slightly toward the
cursor. That is all the 3D on the site.

- **Model**: "Gamepad" by Josh Dean, **CC0**, from [Poly Haven](https://polyhaven.com/a/gamepad).
  1k textures, ~1.3 MB across five files. No attribution required; the hero
  credits it anyway.
- **Lighting**: `RoomEnvironment` through `PMREMGenerator` for image-based
  lighting, plus one key and one fill light. The IBL is what makes the plastic
  read as plastic — point lights alone give flat highlights and no sense of a
  surrounding space, and an HDR file would be another megabyte.
- **Tone mapping**: ACES Filmic at 0.98 exposure. Without it the highlights clip
  to flat white and it looks like a screenshot of a model.
- **Shadow**: a single shader plane with a radial falloff. A real shadow map on
  one floating object is not worth the depth pass.
- The model is centred and scaled from its own bounding box, so framing does not
  depend on how the asset was authored.

### Gates and fallback

`can3D()` in `assets/js/core/env.js` requires ≥900px, a fine pointer, no
reduced-motion, ≥4 cores, no save-data, and WebGL2. Only then are three.js and
the model fetched, so mobile and reduced-motion visitors download **none** of
it.

When the gates fail, `.hero__object::before` shows a quiet plotted contour
instead — except below 900px, where the whole object column is hidden and the
hero is type only. A large empty shape on a phone is worse than no shape.

### Vendored three.js

`assets/lib/three/` holds `three.module.min.js`, `three.core.min.js`, the MIT
`LICENSE`, and `addons/` (GLTFLoader plus the two utils it imports).
**Both build files are required** — the module build's first statement imports
the core build, and they must stay in the same directory.

To bump the version:

```bash
V=0.185.1
B=https://unpkg.com/three@$V
curl -L -o assets/lib/three/three.module.min.js $B/build/three.module.min.js
curl -L -o assets/lib/three/three.core.min.js   $B/build/three.core.min.js
curl -L -o assets/lib/three/LICENSE             $B/LICENSE
curl -L -o assets/lib/three/addons/loaders/GLTFLoader.js        $B/examples/jsm/loaders/GLTFLoader.js
curl -L -o assets/lib/three/addons/utils/BufferGeometryUtils.js $B/examples/jsm/utils/BufferGeometryUtils.js
curl -L -o assets/lib/three/addons/utils/SkeletonUtils.js       $B/examples/jsm/utils/SkeletonUtils.js
curl -L -o assets/lib/three/addons/environments/RoomEnvironment.js $B/examples/jsm/environments/RoomEnvironment.js
```

There is no `package.json`, so this README is the only record of the version.
Currently **r185 (0.185.1)**.

## Games

Both keep their full original logic.

**Space Invaders** draws into a fixed 960×540 backing store scaled by CSS, with
sprites as pixel matrices rather than images. Its palette is **literal, not
taken from the CSS tokens** — the playfield is a dark screen inside a light
page, so ink-on-paper values would be invisible. It is near-monochrome by
design: paper-white fleet, one vermillion rank at the back worth the most.

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
- `prefers-contrast: more` darkens the muted inks and strengthens every rule.
  `forced-colors` and `prefers-reduced-data` are handled too.
- Anything already on screen at first paint is revealed immediately rather than
  waiting on the observer. The observer's `-10%` bottom margin creates a dead
  band along the viewport edge, and an element sitting in it at load would
  otherwise stay invisible permanently.
- Focus is a solid 2px ink outline with offset. On paper there is no need for
  the multi-band ring a neon theme requires.

## License

See [LICENSE](LICENSE). Vendored three.js is MIT, see
`assets/lib/three/LICENSE`. The gamepad model is CC0.
