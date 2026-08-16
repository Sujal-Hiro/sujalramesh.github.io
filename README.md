# sujalramesh.github.io

Personal portfolio of **Sujal Ramesh**, game developer and designer.

Static site, **no build step**. There is no `package.json`, no bundler and no CI:
`git push` is the deploy.

## Running it locally

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.

**You can no longer open `index.html` directly by double-clicking it.** The site
uses ES modules and an import map, and browsers block both over `file://`. It
must be served over HTTP.

## Pages

| File | Purpose |
|---|---|
| `index.html` | Home: intro, Space Invaders, work, gallery, experience, skills, target rush, contact |
| `projects.html` | Long-form write-ups for the eight main projects |
| `portfolio.html` | Full gallery of screenshots, gameplay clips and artwork |
| `404.html` | Not-found page (GitHub Pages serves this automatically) |

All four share the same `<head>`. There is no templating, so **adding a
stylesheet means editing four files** — `404.html` is the one people forget.

## Structure

```
assets/
  css/     tokens, base, layout, components, effects, games, pages, motion
  js/
    core/  env, loop, hue, scroll
    ui/    nav, pointer, masonry, lightbox
    games/ invaders, target-rush
    three/ hero-deck
  lib/three/  vendored three.js r185
Images/    media (unchanged)
scripts/   one-shot Node media optimisers (not a build step)
```

CSS is loaded as eight plain `<link>` tags rather than one file with `@import`.
An `@import` chain serialises downloads; parallel links over HTTP/2 do not.
**`motion.css` must stay last** — every user-preference query lives in it and
has to win.

JS is one entry module (`assets/js/main.js`). Every block guards its own DOM
lookups, so one entry serves all four pages and anything whose elements are
absent simply does not run.

## Design system: UNDERGLOW

Black equipment on a dark desk, lit from behind. **Structure is monochrome;
light is chromatic.** Five rules the CSS holds to:

1. **One hue is live at a time.** `--hue-base` drifts through the spectrum on a
   24s loop and every section offsets from it, so the page has chromatic
   structure without ever showing a rainbow.
2. **Lightness is locked, hue moves.** Colours are `oklch()` at a fixed `L`. The
   same sweep in HSL swings contrast from 3:1 to 16:1 and visibly pulses — that
   pulsing *is* what tacky RGB looks like. Do not port these tokens to HSL.
3. **Colour is light, never paint.** No more than ~15% of a viewport should be
   saturated pixels. Neon appears on glows, borders, rules and indices.
4. **Text never cycles.** Body copy is achromatic. Cycling colour is allowed on
   type only at `--step-2` (28px) and above.
5. **Some colours must hold still.** `--rgb-*` and `--ok` never cycle: a red
   error must be red at every scroll position, and a 40-point alien must stay
   magenta or the game's colour coding means nothing.

Two variables, not one: sections shadow `--hue`, and `--hue-base` is what
drifts. Writing `--hue: calc(var(--hue) + 40)` is a self-reference cycle and
silently greys out every accent on the page.

`--glow` is a registered `<number>` multiplied into every alpha of the `--edge`
shadow stack, so an entire multi-layer glow ramps from one declaration.

The old "motion never loops" rule is **retired**. The hue drift, the process
rail, the contact aurora and the 3D wave all loop. Every looping animation has a
period of at least 1.6s, i.e. under 0.63 flashes/second against the WCAG 2.3.1
limit of three.

### Typography

One Google Fonts request: **Chakra Petch** (display), **Inter** (body),
**JetBrains Mono** (all HUD labels, indices, tags, dates and numerals).
`.hud-label` and `.hud-num` are the two workhorse classes; `.hud-num` carries
`tabular-nums`, without which a live score counter jitters its own layout.

## The 3D hero

`assets/js/three/hero-deck.js` draws a 48 × 44 field of tiles — keycaps, a
heightfield and a Unity scene grid at once — with a travelling three-octave wave
and a hue that sweeps diagonally. That is an RGB keyboard's "wave" preset,
rendered literally.

- **One draw call**, one `InstancedBufferGeometry`, no postprocessing. The
  edge-only emission on near-black *is* the bloom; `UnrealBloomPass` would cost
  six vendored addon files and ten fullscreen passes for the same look.
- Only the **top face** emits (`vTop = step(0.5, normal.y)`). Without that gate
  every box face gets the rim and the field reads as a wireframe cage.
- The palette comes from a 360×1 LUT built by filling a canvas with
  `oklch(0.78 0.19 h)` and letting the **browser** parse it, so WebGL and CSS are
  provably the same colour ring.
- The deck is masked to the lower half of the hero and held at `opacity: .72`.
  It is atmosphere; the type is the subject.

### It is heavily gated

`can3D()` in `assets/js/core/env.js` requires ≥900px, a fine pointer, no
reduced-motion, ≥4 cores, no save-data, and WebGL2. Only then is three.js
dynamically imported, so mobile and reduced-motion visitors download **none** of
it. The CSS fallback deck (`.hero::before`) is the default state that the canvas
fades in over, so there is no failure mode where the hero looks broken — not
with JS off, not without WebGL2, not on context loss.

### three.js is vendored, not CDN'd

`assets/lib/three/` holds `three.module.min.js`, `three.core.min.js` and the
MIT `LICENSE`. **Both JS files are required** — the module build's first
statement imports the core build, and they must stay in the same directory.

To bump the version:

```bash
V=0.185.1
curl -L -o assets/lib/three/three.module.min.js https://unpkg.com/three@$V/build/three.module.min.js
curl -L -o assets/lib/three/three.core.min.js   https://unpkg.com/three@$V/build/three.core.min.js
curl -L -o assets/lib/three/LICENSE             https://unpkg.com/three@$V/LICENSE
```

There is no `package.json`, so this README is the only record of the version.
It is currently **r185 (0.185.1)**, ~85 KB gzipped over the wire.

## Games

Both games keep their full original logic.

**Space Invaders** (`assets/js/games/invaders.js`) draws into a fixed 960×540
backing store scaled by CSS, with sprites as pixel matrices rather than images.
Row colours are the **fixed** `--rgb-*` neons — magenta 40, violet 30, cyan 20,
lime 10 — read once through an `oklch()` probe, because Canvas2D *silently
ignores* an invalid `fillStyle` and keeps the previous value. Glow is one
blurred offscreen composite per frame, not per-sprite `shadowBlur`.

Note the two canvases take **opposite** scaling: the Invaders canvas is
deliberately not DPR-scaled and uses `image-rendering: pixelated`; the hero
canvas is DPR-scaled and must never be pixelated. This is a prime copy-paste
bug.

## Media pipeline

Source footage and Photoshop exports are far too heavy to ship as-is (the
originals were ~750 MB). `scripts/optimize-media.mjs` rewrites them:

- **Videos** → 1280px-box H.264, CRF 28, audio stripped. Fetched only when a
  visitor opens the lightbox.
- **Previews** → `preview_video_N.mp4`, first 10s in a 640px box. This is what
  loops inline, so a page of "videos" costs a few hundred KB.
- **Posters** → `poster_video_N.jpg`, so `<video preload="none">` still paints
  instantly.
- **Images** → WebP, max 1920px wide.

Every inline `<video>` must keep `playsinline`, `poster` and `preload="none"`.
Dropping `playsinline` breaks inline playback on iOS entirely.

```bash
npm install ffmpeg-static sharp
node scripts/optimize-media.mjs      # re-encode; skips already-optimized videos
node scripts/rewrite-media-refs.mjs  # point HTML at .webp, verify every ref resolves
node scripts/find-unused-assets.mjs  # list anything in Images/ nothing references
```

Keep the originals outside the repo — the pipeline replaces files in place.

## Gallery tiles and the viewer

Every clickable piece of media, whether a `.tile` or a `.shot`, is a `<button>`
carrying `data-src` and `data-type`; one delegated listener opens the viewer.
Buttons may only contain phrasing content, so overlay markup uses `<span>`.

`data-src` points at the **full** asset while the inline element shows the cheap
one: a tile showing `preview_video_7.mp4` opens `video_7.mp4`.

`.masonry` is rebuilt from CSS columns into JS-balanced flex columns at runtime.
CSS `columns` gives no per-column handle, and without real columns the scroll
parallax is impossible. Balancing is one batched height read, never a measure
inside the append loop — that would be 44 forced reflows on the gallery page.

Images in the viewer zoom (1×–6×) via wheel, pinch, double-click, the `+ / − / 0`
keys, or the control bar. Videos deliberately do not: they keep their native
controls, and transforming the element would move the scrub bar out from under
the pointer.

## Accessibility

- `prefers-reduced-motion` genuinely stops things. WebGL is never initialised,
  the hue clock never starts, pointer 3D is never attached, and reveals fade
  without travelling. It is read **live**, not snapshotted at load, so toggling
  the OS setting mid-session takes effect.
- `prefers-contrast: more` drops `--glow` to 0, pins the hue and removes the
  atmosphere layers. `forced-colors` and `prefers-reduced-data` are handled too.
- The focus ring is three bands — white, dark, neon — so it stays visible
  against both dark surfaces and the brightest neon fill.
- Decorative canvases are `aria-hidden`; `#siCanvas` keeps its `role="img"`.

## License

See [LICENSE](LICENSE). Vendored three.js is MIT, see
`assets/lib/three/LICENSE`.
