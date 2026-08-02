# sujalramesh.github.io

Personal portfolio of **Sujal Ramesh**, game developer and designer.
Live at <https://sujalramesh.github.io>.

Static site, no build step. Open `index.html` directly, or serve the folder:

```bash
python -m http.server 8000
```

## Pages

| File | Purpose |
|---|---|
| `index.html` | Home: intro, selected work, gallery, skills, contact |
| `projects.html` | Long-form write-ups for the eight main projects |
| `portfolio.html` | Full gallery of screenshots, gameplay clips and artwork |
| `404.html` | Not-found page (GitHub Pages serves this automatically) |

`styles.css` and `script.js` are shared by all four pages, so every DOM lookup
in the script is guarded. Each page carries different markup and any block
whose elements are absent simply does not run.

## Design system

All tokens live in `:root` at the top of `styles.css`. Four rules the design
holds to:

1. **One accent colour.** It appears a handful of times per screen: the
   primary button, the dot in the eyebrow pill, the nav underline, the period
   in the logo. Neutrals carry everything else.
2. **Hairlines, not shadows.** Surfaces separate with a 1px border. The card
   grid uses a 1px `gap` over a border-coloured background, so dividers never
   double up.
3. **Motion is short (≤400ms), small (≤12px), and never loops** except the
   marquee, which pauses on hover. Scroll reveals fire once and then unobserve.
4. **One fluid type scale** (`--step--1` … `--step-3`), no magic pixel sizes.

The site is **dark-only**. There is one palette on `:root`, with no theme class,
no `prefers-color-scheme` branch, and no toggle, so first paint is always
correct and there is no flash to guard against.

### Breakpoints

| Tier | Query | What changes |
|---|---|---|
| Phone | `max-width: 560px` | single-column masonry, stacked section heads |
| Tablet | `max-width: 900px` | nav collapses to a slide-down panel, 2-column masonry, project rows stack |

`--header-h` drives the sticky header height, `scroll-padding-top`, and the
mobile nav panel offset, so anchors land correctly at every size.

## Media pipeline

Source footage and Photoshop exports are far too heavy to ship as-is
(the originals were ~750 MB). `scripts/optimize-media.mjs` rewrites them:

- **Videos** → 1280px-box H.264, CRF 28, audio stripped. Fetched only when a
  visitor opens the lightbox.
- **Previews** → `preview_video_N.mp4`, first 10s in a 640px box. This is what
  loops inline in the carousels, so a page of "videos" costs a few hundred KB.
- **Posters** → `poster_video_N.jpg`, so `<video preload="none">` still paints
  instantly without downloading any video.
- **Images** → WebP, max 1920px wide.

Every inline `<video>` must keep `playsinline`, `poster` and `preload="none"`.
Dropping `playsinline` breaks inline playback on iOS entirely.

To re-run after adding new media:

```bash
npm install ffmpeg-static sharp
node scripts/optimize-media.mjs      # re-encode; skips already-optimized videos
node scripts/rewrite-media-refs.mjs  # point HTML at .webp, verify every ref resolves
node scripts/find-unused-assets.mjs  # list anything in Images/ nothing references
```

Keep the originals somewhere outside the repo, because the pipeline replaces files in
place.

## Gallery tiles and the viewer

Every clickable piece of media, whether a `.tile` in the masonry grids or a
`.shot` beside a project write-up, is a `<button>` carrying `data-src` and
`data-type` (`image` or `video`); `script.js` opens the viewer from a single
delegated listener. Buttons may only contain phrasing content, so overlay
markup uses `<span>`, never `<div>`/`<h3>`/`<p>`/`<figcaption>`.

`data-src` points at the **full** asset while the inline element shows the
cheap one: a tile showing `preview_video_7.mp4` opens `video_7.mp4`.

Images in the viewer zoom (1×–6×) via wheel, pinch, double-click, the
`+ / − / 0` keys, or the control bar. Videos deliberately do not: they keep
their native controls, and transforming the element would move the scrub bar
out from under the pointer. `openBox` hides `#zoomBar` for video and resets
the transform on every open and close.

## License

See [LICENSE](LICENSE).
