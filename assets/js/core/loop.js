/*===============================================
  One requestAnimationFrame for the whole page.

  The old script ran three independent rAF chains
  (header progress, cursor spotlight, invaders).
  Consolidating removes the redundant scheduling
  and, more importantly, gives one place to stop
  everything when the tab is hidden.

  Note the invaders game keeps its OWN loop: it
  needs to pause and resume on its own terms
  (P key, scrolled out of view) independently of
  the page's decorative animation.
===============================================*/

const jobs = new Set()

let frame = 0
let last = 0

const tick = now => {
	frame = requestAnimationFrame(tick)

	// Clamp so a backgrounded tab cannot hand anyone a huge dt.
	const dt = Math.min(0.05, (now - last) / 1000)
	last = now

	jobs.forEach(fn => {
		try {
			fn(dt, now)
		} catch (e) {
			/* a throwing job must not kill the loop for everyone */
		}
	})
}

const startLoop = () => {
	if (frame || !jobs.size || document.hidden) return
	last = performance.now()
	frame = requestAnimationFrame(tick)
}

const stopLoop = () => {
	cancelAnimationFrame(frame)
	frame = 0
}

/** Register a per-frame job. Returns an unsubscribe function. */
export const add = fn => {
	jobs.add(fn)
	startLoop()
	return () => remove(fn)
}

export const remove = fn => {
	jobs.delete(fn)
	if (!jobs.size) stopLoop()
}

/* Stop outright rather than relying on the browser's background
   throttling: stopping means zero GPU work and zero battery on a
   backgrounded laptop. */
document.addEventListener('visibilitychange', () => {
	if (document.hidden) stopLoop()
	else startLoop()
})
