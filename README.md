# sujalramesh.github.io

Personal portfolio of **Sujal Ramesh** — game developer and designer.
Live at <https://sujalramesh.github.io>.

Static site, no build step. Open `index.html` directly, or serve the folder:

```bash
python -m http.server 8000
```

## Pages

| File | Purpose |
|---|---|
| `index.html` | Home — intro, project carousel, portfolio carousel, skills, contact |
| `projects.html` | Long-form write-ups for the eight main projects |
| `portfolio.html` | Full gallery of screenshots, gameplay clips and artwork |
| `404.html` | Not-found page (GitHub Pages serves this automatically) |

`styles.css`, `script.js` and `particles.js` are shared by all pages, so every
DOM lookup in the scripts is guarded — the three pages have different markup.

## Responsive tiers

Defined once in `styles.css` and used consistently:

| Tier | Query |
|---|---|
| Phone | `max-width: 640px` |
| Tablet | `max-width: 1024px` |
| Wide | `min-width: 1440px` |

`--header-h` drives both the header height and `scroll-padding-top`, so nav
anchors land correctly at every size.

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

Keep the originals somewhere outside the repo — the pipeline replaces files in
place.

## Gallery tiles

Each clickable tile is a `<button>` carrying `data-src` and `data-type`
(`image` or `video`); `script.js` opens the lightbox from a single delegated
listener. Buttons may only contain phrasing content, so overlay markup uses
`<span>`, not `<div>`/`<h3>`/`<p>`.

## License

See [LICENSE](LICENSE).
