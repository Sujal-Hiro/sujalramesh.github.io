/*===============================================
  Scroll: reading progress, reveals, and the
  --sp parallax driver.

  One scroll listener and one shared-loop job for
  the whole page. Everything that wants to react to
  scroll reads from here rather than adding its own
  listener.
===============================================*/

import { reduceMotion } from './env.js'
import { add } from './loop.js'

let progress = 0

/** Page scroll 0-1. Read by the WebGL camera. */
export const getProgress = () => progress

/*------------------------ progress ------------------------*/

export function initProgress() {
	const header = document.getElementById('siteHeader')
	let dirty = true

	const paint = () => {
		if (!dirty) return
		dirty = false

		const max = document.documentElement.scrollHeight - innerHeight
		progress = max > 0 ? scrollY / max : 0

		if (header) {
			header.classList.toggle('is-stuck', scrollY > 8)
			header.style.setProperty('--progress', `${(progress * 100).toFixed(2)}%`)
		}
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
	const reveals = document.querySelectorAll('.reveal')
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
		{ rootMargin: '0px 0px -10% 0px' }
	)

	reveals.forEach(el => io.observe(el))
}

/*------------------------ parallax ------------------------*/

/* Writes --sp (-1 .. 1) on each registered element, where 0 means
   the element's centre is at viewport centre. Ghost numerals and
   the gallery columns both read it.

   Only elements currently on screen are measured, so the
   getBoundingClientRect cost stays proportional to what is
   visible rather than to page length. */
export function initParallax() {
	if (reduceMotion()) return

	/* Observe the CONTAINERS, not the columns. --sp inherits, so all
	   three masonry columns share one scroll parameter and differ
	   only by their own --drift multiplier - which is what makes
	   them drift against each other rather than each computing its
	   own offset and sitting permanently misaligned at rest. */
	const targets = [...document.querySelectorAll('.section[data-index], .masonry')]
	if (!targets.length) return

	const visible = new Set()

	const io = new IntersectionObserver(
		entries => {
			entries.forEach(entry => {
				if (entry.isIntersecting) visible.add(entry.target)
				else {
					visible.delete(entry.target)
					entry.target.style.setProperty('--sp', 0)
				}
			})
		},
		{ rootMargin: '20% 0px 20% 0px' }
	)

	targets.forEach(el => io.observe(el))

	let lastY = -1

	add(() => {
		if (scrollY === lastY || !visible.size) return
		lastY = scrollY

		const mid = innerHeight / 2

		visible.forEach(el => {
			const r = el.getBoundingClientRect()
			const centre = r.top + r.height / 2
			// Normalised distance from viewport centre, clamped.
			const sp = Math.max(-1, Math.min(1, (centre - mid) / innerHeight))
			el.style.setProperty('--sp', sp.toFixed(3))
		})
	})
}

/*---------------------- timeline nodes ----------------------*/

/* A timeline item lights up as it crosses viewport centre. */
export function initTimeline() {
	const items = document.querySelectorAll('.tl-item')
	if (!items.length || !('IntersectionObserver' in window)) {
		items.forEach(el => el.classList.add('is-active'))
		return
	}

	const io = new IntersectionObserver(
		entries => {
			entries.forEach(entry => {
				entry.target.classList.toggle('is-active', entry.isIntersecting)
			})
		},
		{ rootMargin: '-45% 0px -45% 0px' }
	)

	items.forEach(el => io.observe(el))
}
