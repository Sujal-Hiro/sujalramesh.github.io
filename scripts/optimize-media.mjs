/**
 * One-shot media optimizer for the portfolio.
 *
 * The repo shipped ~750 MB of raw capture footage and Photoshop exports.
 * Two problems: the files are huge, and the homepage used to eagerly fetch
 * ~263 MB of it before the visitor had done anything.
 *
 * The fix is an architecture change, not just recompression. Each video now
 * produces three artifacts:
 *
 *   Images/video_N.mp4          full clip, fits a 1280x1280 box, CRF 28, no audio.
 *                               Only ever fetched when the visitor clicks to open
 *                               the lightbox.
 *   Images/preview_video_N.mp4  first 10s, fits a 640x640 box, CRF 32, no audio.
 *                               This is what loops inline in the carousels/grids,
 *                               so a page of "videos" costs a few hundred KB.
 *   Images/poster_video_N.jpg   single frame, so <video preload="none"> still
 *                               paints instantly with zero video bytes.
 *
 * Every player on the site is muted, so the audio track is stripped throughout.
 * A 1280x1280 *box* (rather than a 1280x720 one) is deliberate: three of these
 * clips are portrait phone captures at 720x1616, and a landscape box squashes
 * them to 320px wide.
 *
 * Images over 300 KB are resized to max 1920px and converted to WebP.
 * Videos keep their filename; images change extension, so the renames are
 * recorded in scripts/media-manifest.json for the HTML rewrite step.
 *
 * Requires: npm i ffmpeg-static sharp
 * Run:      node scripts/optimize-media.mjs
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync, renameSync, unlinkSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { join, resolve, extname, basename } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ffmpeg = require('ffmpeg-static')
const sharp = require('sharp')

const root = resolve(import.meta.dirname, '..')
const imagesDir = join(root, 'Images')
const tmpDir = join(root, '.media-tmp')

const IMAGE_MIN_BYTES = 300 * 1024
const IMAGE_MAX_WIDTH = 1920
const FULL_BOX = 1280
const PREVIEW_BOX = 640
const PREVIEW_SECONDS = 10
const SKIP_IMAGES = new Set(['Icon-Website.png'])

const mb = b => (b / 1024 / 1024).toFixed(2)

// Fit inside a square box without distorting, then round to even dimensions (H.264 requires it).
const fitBox = size =>
	`scale=w=${size}:h=${size}:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2`

const run = args =>
	execFileSync(ffmpeg, ['-y', '-loglevel', 'error', ...args], { stdio: ['ignore', 'ignore', 'inherit'] })

if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true })
mkdirSync(tmpDir)

const manifest = { images: {}, previews: {}, posters: {} }
let before = 0
let after = 0

/*--------------------------------- videos ---------------------------------*/

const videos = readdirSync(imagesDir)
	.filter(f => /\.mp4$/i.test(f) && !f.startsWith('preview_'))
	.sort()

for (const name of videos) {
	const src = join(imagesDir, name)
	const stem = basename(name, '.mp4')
	const startSize = statSync(src).size
	before += startSize

	// Resumable: a finished video already has its preview beside it.
	if (existsSync(join(imagesDir, `preview_${stem}.mp4`))) {
		after += startSize
		manifest.previews[`Images/${name}`] = `Images/preview_${stem}.mp4`
		manifest.posters[`Images/${name}`] = `Images/poster_${stem}.jpg`
		console.log(`video  ${name}  already optimized, skipping`)
		continue
	}

	process.stdout.write(`video  ${name}  ${mb(startSize)} MB `)

	const fullTmp = join(tmpDir, name)
	const previewName = `preview_${stem}.mp4`
	const posterName = `poster_${stem}.jpg`

	// Full-quality clip, for the lightbox.
	run([
		'-i', src,
		'-vf', fitBox(FULL_BOX),
		'-c:v', 'libx264', '-crf', '28', '-preset', 'slow',
		'-profile:v', 'high', '-pix_fmt', 'yuv420p',
		'-movflags', '+faststart', '-an',
		fullTmp,
	])

	// Short, cheap loop for inline playback.
	run([
		'-ss', '1', '-t', String(PREVIEW_SECONDS), '-i', src,
		'-vf', fitBox(PREVIEW_BOX),
		'-c:v', 'libx264', '-crf', '32', '-preset', 'slow',
		'-profile:v', 'main', '-pix_fmt', 'yuv420p',
		'-movflags', '+faststart', '-an',
		join(tmpDir, previewName),
	])

	// Poster frame — 1s in, since frame 0 is often black on captured footage.
	run([
		'-ss', '1', '-i', src,
		'-frames:v', '1',
		'-vf', `scale=w=1280:h=1280:force_original_aspect_ratio=decrease`,
		'-q:v', '5',
		join(tmpDir, posterName),
	])

	unlinkSync(src)
	renameSync(fullTmp, src)
	renameSync(join(tmpDir, previewName), join(imagesDir, previewName))
	renameSync(join(tmpDir, posterName), join(imagesDir, posterName))

	const fullSize = statSync(src).size
	const previewSize = statSync(join(imagesDir, previewName)).size
	const posterSize = statSync(join(imagesDir, posterName)).size
	after += fullSize + previewSize + posterSize

	manifest.previews[`Images/${name}`] = `Images/${previewName}`
	manifest.posters[`Images/${name}`] = `Images/${posterName}`

	console.log(
		`-> full ${mb(fullSize)} MB | inline ${(previewSize / 1024).toFixed(0)} KB + poster ${(posterSize / 1024).toFixed(0)} KB`
	)
}

/*--------------------------------- images ---------------------------------*/

const images = readdirSync(imagesDir)
	.filter(f => /\.(png|jpe?g)$/i.test(f) && !f.startsWith('poster_') && !SKIP_IMAGES.has(f))
	.sort()

for (const name of images) {
	const src = join(imagesDir, name)
	const startSize = statSync(src).size
	before += startSize

	if (startSize < IMAGE_MIN_BYTES) {
		after += startSize
		continue
	}

	const webpName = `${basename(name, extname(name))}.webp`
	const dest = join(imagesDir, webpName)

	// Read into a buffer rather than letting sharp open the path directly:
	// on Windows the open handle makes the subsequent unlink fail with EPERM.
	await sharp(readFileSync(src))
		.rotate()
		.resize({ width: IMAGE_MAX_WIDTH, withoutEnlargement: true })
		.webp({ quality: 82, effort: 5 })
		.toFile(dest)

	unlinkSync(src)

	const endSize = statSync(dest).size
	after += endSize
	manifest.images[`Images/${name}`] = `Images/${webpName}`

	console.log(`image  ${name}  ${mb(startSize)} -> ${mb(endSize)} MB  (${(100 - (endSize / startSize) * 100).toFixed(0)}% smaller)`)
}

rmSync(tmpDir, { recursive: true })
writeFileSync(join(root, 'scripts', 'media-manifest.json'), JSON.stringify(manifest, null, 2))

console.log(`\nTotal: ${mb(before)} MB -> ${mb(after)} MB  (${(100 - (after / before) * 100).toFixed(1)}% smaller)`)
console.log('Manifest written to scripts/media-manifest.json')
