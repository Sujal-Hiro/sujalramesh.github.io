/**
 * Points the HTML at the optimized assets produced by optimize-media.mjs.
 *
 *  - Images/foo.png|jpg -> Images/foo.webp, wherever the .webp actually exists
 *    on disk (so unconverted small icons are left alone).
 *  - Reports any Images/... reference that no longer resolves.
 *
 * Run: node scripts/rewrite-media-refs.mjs
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve, basename, extname } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const imagesDir = join(root, 'Images')

const webpStems = new Set(
	readdirSync(imagesDir)
		.filter(f => f.endsWith('.webp'))
		.map(f => basename(f, '.webp'))
)

const htmlFiles = readdirSync(root).filter(f => f.endsWith('.html'))

let rewrites = 0

for (const file of htmlFiles) {
	const path = join(root, file)
	const original = readFileSync(path, 'utf8')

	const updated = original.replace(/Images\/([\w .-]+)\.(png|jpe?g)/gi, (match, stem) => {
		if (!webpStems.has(stem)) return match
		rewrites++
		return `Images/${stem}.webp`
	})

	if (updated !== original) {
		writeFileSync(path, updated)
		console.log(`${file}: updated`)
	}
}

console.log(`\n${rewrites} references rewritten to WebP\n`)

/*----------------------- integrity check -----------------------*/

const missing = new Map()

for (const file of htmlFiles) {
	const html = readFileSync(join(root, file), 'utf8')
	// Only check live markup, not commented-out blocks.
	const live = html.replace(/<!--[\s\S]*?-->/g, '')

	for (const [, ref] of live.matchAll(/["'(](Images\/[^"')]+)["')]/g)) {
		if (!existsSync(join(root, decodeURIComponent(ref)))) {
			if (!missing.has(ref)) missing.set(ref, new Set())
			missing.get(ref).add(file)
		}
	}
}

if (missing.size === 0) {
	console.log('All Images/ references resolve.')
} else {
	console.log(`MISSING (${missing.size}):`)
	for (const [ref, files] of missing) console.log(`  ${ref}  <- ${[...files].join(', ')}`)
	process.exitCode = 1
}
