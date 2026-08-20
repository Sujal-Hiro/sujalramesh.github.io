/*===============================================
  Gallery: media filters and stagger indexing.

  The old build rebuilt CSS columns into balanced
  flex columns so each could drift independently for
  a parallax. The grid is a plain CSS grid now and
  nothing drifts, so all of that is gone.
===============================================*/

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

/* Index children so CSS can stagger them. Capped in CSS, or the
   fortieth tile on the gallery page waits over a second. */
export function initStagger() {
	document.querySelectorAll('.media-grid').forEach(grid => {
		;[...grid.querySelectorAll('.tile')].forEach((tile, i) => {
			tile.style.setProperty('--i', i % 6)
		})
	})
}
