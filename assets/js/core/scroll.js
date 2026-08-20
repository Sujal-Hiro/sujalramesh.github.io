/*===============================================
  Scroll: the header rule, and entrance reveals.

  The previous design drove a reading-progress bar,
  a --sp parallax value and a timeline observer from
  here. None of that survives: on a paper page the
  only thing scroll needs to do is bring the header
  rule in and let content arrive once.
===============================================*/

import { reduceMotion } from './env.js'
import { add } from './loop.js'

/*------------------------- header -------------------------*/

/* The header has no border at rest and gains a hairline once it
   starts overlapping content, so it is invisible at the top of
   the page and defined everywhere else. */
export function initHeader() {
	const header = document.getElementById('siteHeader')
	if (!header) return

	let dirty = true
	let stuck = null

	const paint = () => {
		if (!dirty) return
		dirty = false
		const next = scrollY > 8
		if (next === stuck) return
		stuck = next
		header.classList.toggle('is-stuck', next)
	}

	const mark = () => {
		dirty = true
	}

	paint()
	addEventListener('scroll', mark, { passive: true })
	addEventListener('resize', mark)
	add(paint)
}

/*------------------------- reveals -------------------------*/

export function initReveal() {
	const reveals = document.querySelectorAll('.reveal, .rule-draw')
	if (!reveals.length) return

	if (!('IntersectionObserver' in window)) {
		reveals.forEach(el => el.classList.add('is-visible'))
		return
	}

	const io = new IntersectionObserver(
		(entries, obs) => {
			entries.forEach(entry => {
				if (!entry.isIntersecting) return
				entry.target.classList.add('is-visible')
				obs.unobserve(entry.target)
			})
		},
		/* The -10% holds a reveal back until the element is
		   meaningfully into view, which reads better while
		   scrolling. It also creates a dead band along the bottom
		   edge - see the pass below. */
		{ rootMargin: '0px 0px -10% 0px' }
	)

	/* Anything already on screen at load is revealed directly and
	   never observed.

	   Without this, an element sitting in that bottom 10% band at
	   first paint never intersects and stays at opacity 0 forever:
	   above-the-fold content that is simply invisible, and the
	   shorter the viewport the more of it. */
	const vh = innerHeight
	reveals.forEach(el => {
		const r = el.getBoundingClientRect()
		if (r.top < vh && r.bottom > 0) el.classList.add('is-visible')
		else io.observe(el)
	})

	// Nothing to stagger toward if motion is off; make sure the
	// inline --i delays never hold anything back.
	if (reduceMotion()) reveals.forEach(el => el.classList.add('is-visible'))
}
