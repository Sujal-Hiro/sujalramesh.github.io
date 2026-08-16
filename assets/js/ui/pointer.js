/*===============================================
  ONE pointermove handler for the whole page.

  It drives three separate effects that all need
  the same event:

    --mx / --my  the cursor spotlight (px, local)
    --tx / --ty  card + skill tilt   (-0.5 .. 0.5)
    --px / --py  the hero text stage (-1 .. 1)

  Adding a second listener for any of these would
  mean two rect reads per frame for one gesture.
===============================================*/

import { canHover } from '../core/env.js'

export function initPointer() {
	// No tilt on touch: there is no hover state to preview it with,
	// and a transform that only fires mid-tap reads as a glitch.
	if (!canHover()) return

	const stage = document.querySelector('.hero__stage')
	const tiltables = document.querySelectorAll('.card, .skill-group')
	const spotlights = document.querySelectorAll('.spotlight')

	if (!stage && !tiltables.length && !spotlights.length) return

	let frame = 0
	let ev = null
	let tilted = null

	const paint = () => {
		frame = 0
		const e = ev
		if (!e) return

		// --- hero stage: viewport-relative, damped by the small
		//     rotation cap in CSS (3deg max).
		if (stage) {
			stage.style.setProperty('--px', (e.clientX / innerWidth - 0.5).toFixed(3))
			stage.style.setProperty('--py', (e.clientY / innerHeight - 0.5).toFixed(3))
		}

		// --- tilt: only the card actually under the pointer.
		const card = e.target.closest ? e.target.closest('.card, .skill-group') : null

		if (tilted && tilted !== card) {
			tilted.style.setProperty('--tx', 0)
			tilted.style.setProperty('--ty', 0)
		}

		if (card) {
			const r = card.getBoundingClientRect()
			card.style.setProperty('--tx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3))
			card.style.setProperty('--ty', ((e.clientY - r.top) / r.height - 0.5).toFixed(3))
		}

		tilted = card

		// --- spotlight: local pixel coords on the grid container.
		const spot = e.target.closest ? e.target.closest('.spotlight') : null
		if (spot) {
			const r = spot.getBoundingClientRect()
			spot.style.setProperty('--mx', `${e.clientX - r.left}px`)
			spot.style.setProperty('--my', `${e.clientY - r.top}px`)
		}
	}

	addEventListener(
		'pointermove',
		e => {
			ev = e
			if (frame) return
			frame = requestAnimationFrame(paint)
		},
		{ passive: true }
	)

	// Flatten everything when the pointer leaves the window, or a
	// card stays frozen mid-tilt.
	addEventListener('pointerleave', () => {
		if (!tilted) return
		tilted.style.setProperty('--tx', 0)
		tilted.style.setProperty('--ty', 0)
		tilted = null
	})
}
