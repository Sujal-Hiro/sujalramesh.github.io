// Lists files in Images/ that no HTML/CSS/JS file references.
// Run: node scripts/find-unused-assets.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

const sourceFiles = readdirSync(root)
	.filter(f => /\.(html|css|js)$/i.test(f))
	.map(f => readFileSync(join(root, f), 'utf8'))
	.join('\n')

const assets = readdirSync(join(root, 'Images'))

const unused = assets.filter(name => {
	// Match the bare filename anywhere in the sources, comments included.
	// Being generous here is deliberate: a false "used" is harmless, a false
	// "unused" deletes a live asset.
	return !sourceFiles.includes(name)
})

let total = 0
for (const name of unused.sort()) {
	const size = statSync(join(root, 'Images', name)).size
	total += size
	console.log(`${(size / 1024 / 1024).toFixed(2).padStart(8)} MB  ${name}`)
}
console.log(`\n${unused.length} unused of ${assets.length} files, ${(total / 1024 / 1024).toFixed(1)} MB`)
