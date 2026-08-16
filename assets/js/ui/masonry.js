/*===============================================
  Masonry: CSS columns -> JS-balanced flex columns.

  CSS `columns` gives no per-column handle, so the
  gallery could never drift one column against
  another. Restructuring into real flex columns is
  what makes the scroll parallax possible.

  Tiles keep their original DOM order within a
  column, so tab order stays sensible.
===============================================*/

import { reduceMotion } from '../core/env.js'

const colCount = () => (innerWidth <= 560 ? 1 : innerWidth <= 900 ? 2 : 3)

export function initMasonry() {
	const grids = document.querySelectorAll('.masonry')
	if (!grids.length) return

	grids.forEach(grid => {
		// Snapshot the original tiles once; every rebuild works from
		// this list, so repeated resizes cannot lose or duplicate one.
		const tiles = [...grid.querySelectorAll('.tile')]
		if (!tiles.length) return

		let built = 0

		const build = () => {
			const n = colCount()
			if (n === built) return
			built = n

			const cols = []
			for (let i = 0; i < n; i++) {
				const col = document.createElement('div')
				col.className = 'masonry__col'
				cols.push(col)
			}

			// Round-robin first so the grid paints immediately with no
			// forced reflow, then rebalance once heights are knowable.
			tiles.forEach((tile, i) => cols[i % n].append(tile))

			grid.replaceChildren(...cols)
			requestAnimationFrame(() => balance(grid, tiles, cols))
		}

		const balance = (host, list, cols) => {
			if (cols.length < 2) return

			// One batched read of every tile height (a single reflow),
			// then one batched write. Never measure inside the append
			// loop - that is 44 forced reflows on the gallery page.
			const heights = list.map(t => t.offsetHeight || 220)

			cols.forEach(c => c.replaceChildren())
			const totals = new Array(cols.length).fill(0)

			list.forEach((tile, i) => {
				let shortest = 0
				for (let c = 1; c < totals.length; c++) {
					if (totals[c] < totals[shortest]) shortest = c
				}
				cols[shortest].append(tile)
				totals[shortest] += heights[i] + 14
			})
		}

		build()

		// Rebalance once late-loading media has settled.
		addEventListener('load', () => {
			const cols = [...grid.querySelectorAll('.masonry__col')]
			if (cols.length) balance(grid, tiles, cols)
		})

		let resizeTimer = 0
		addEventListener('resize', () => {
			clearTimeout(resizeTimer)
			resizeTimer = setTimeout(build, 150)
		})
	})

	// Indexing has to happen after the columns exist, or the stagger
	// runs down a column instead of across the grid.
	document.querySelectorAll('.masonry').forEach(grid => {
		;[...grid.querySelectorAll('.tile')].forEach((tile, i) => {
			tile.style.setProperty('--i', i % 6)
		})
	})

	if (reduceMotion()) {
		document.querySelectorAll('.masonry__col').forEach(c => c.style.setProperty('--drift', '0px'))
	}
}

/*------------------------- filters -------------------------*/

export function initFilters() {
	const filters = document.querySelectorAll('.filter')
	if (!filters.length) return

	filters.forEach(btn => {
		btn.addEventListener('click', () => {
			const want = btn.dataset.filter

			filters.forEach(b => b.setAttribute('aria-pressed', String(b === btn)))

			document.querySelectorAll('.tile').forEach(tile => {
				tile.classList.toggle('is-hidden', want !== 'all' && tile.dataset.type !== want)
			})
		})
	})
}
