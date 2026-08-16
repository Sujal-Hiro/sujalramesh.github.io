/*===============================================
  Lightbox - zoom, pinch, pan, focus trap.

  Ported from the original script.js unchanged in
  behaviour. The only edits are the module wrapper
  and reading reduceMotion() live instead of from a
  load-time snapshot.

  Images zoom 1x-6x; videos deliberately do not.
  A video keeps its native controls, and
  transforming it would move the scrub bar out from
  under the pointer.
===============================================*/

import { reduceMotion } from '../core/env.js'

export function initLightbox() {
	const box = document.getElementById('lightbox')
	const boxImg = document.getElementById('lightboxImg')
	const boxVid = document.getElementById('lightboxVideo')
	const boxClose = document.getElementById('lightboxClose')

	if (!box || !boxImg || !boxVid || !boxClose) return

	const zoomBar = document.getElementById('zoomBar')
	const zoomIn = document.getElementById('zoomIn')
	const zoomOut = document.getElementById('zoomOut')
	const zoomReset = document.getElementById('zoomReset')

	const MIN = 1
	const MAX = 6

	let opener = null
	let scale = 1
	let tx = 0
	let ty = 0
	const pointers = new Map()
	let pinchStart = 0
	let pinchScale = 1
	let dragFrom = null

	const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

	// Keep the image overlapping the viewport: once it is smaller
	// than the frame in an axis, that axis snaps back to centred.
	const clampPan = () => {
		const w = boxImg.offsetWidth * scale
		const h = boxImg.offsetHeight * scale
		const limitX = Math.max(0, (w - box.clientWidth) / 2)
		const limitY = Math.max(0, (h - box.clientHeight) / 2)
		tx = clamp(tx, -limitX, limitX)
		ty = clamp(ty, -limitY, limitY)
	}

	const paintZoom = smooth => {
		clampPan()
		boxImg.style.transition =
			smooth && !reduceMotion() ? 'transform 0.22s cubic-bezier(0.16,1,0.3,1)' : 'none'
		boxImg.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`
		boxImg.classList.toggle('is-zoomed', scale > 1)

		if (!zoomBar) return
		zoomReset.textContent = `${Math.round(scale * 100)}%`
		zoomIn.disabled = scale >= MAX - 0.001
		zoomOut.disabled = scale <= MIN + 0.001
	}

	const resetZoom = () => {
		scale = 1
		tx = 0
		ty = 0
		paintZoom(false)
	}

	// Zoom about a screen point, so the pixel under the cursor
	// stays put.
	const zoomTo = (next, clientX, clientY, smooth) => {
		next = clamp(next, MIN, MAX)
		if (next === scale) return

		if (clientX == null) {
			// No anchor (buttons, keyboard): scale about the centre.
			tx *= next / scale
			ty *= next / scale
		} else {
			const r = boxImg.getBoundingClientRect()
			const cx = clientX - (r.left + r.width / 2)
			const cy = clientY - (r.top + r.height / 2)
			const ratio = next / scale
			tx += (1 - ratio) * cx
			ty += (1 - ratio) * cy
		}

		scale = next
		paintZoom(smooth)
	}

	if (zoomBar) {
		zoomIn.addEventListener('click', () => zoomTo(scale * 1.5, null, null, true))
		zoomOut.addEventListener('click', () => zoomTo(scale / 1.5, null, null, true))
		zoomReset.addEventListener('click', () => {
			scale = 1
			tx = 0
			ty = 0
			paintZoom(true)
		})
	}

	boxImg.addEventListener(
		'wheel',
		e => {
			e.preventDefault()
			// Trackpads report small deltas; exponentiate so both feel linear.
			zoomTo(scale * Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY, false)
		},
		{ passive: false }
	)

	boxImg.addEventListener('dblclick', e => {
		if (scale > 1) {
			scale = 1
			tx = 0
			ty = 0
			paintZoom(true)
		} else {
			zoomTo(2.5, e.clientX, e.clientY, true)
		}
	})

	boxImg.addEventListener('pointerdown', e => {
		boxImg.setPointerCapture(e.pointerId)
		pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

		if (pointers.size === 2) {
			const [a, b] = [...pointers.values()]
			pinchStart = Math.hypot(a.x - b.x, a.y - b.y)
			pinchScale = scale
			dragFrom = null
		} else if (scale > 1) {
			dragFrom = { x: e.clientX - tx, y: e.clientY - ty }
			boxImg.classList.add('is-dragging')
		}
	})

	boxImg.addEventListener('pointermove', e => {
		if (!pointers.has(e.pointerId)) return
		pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

		if (pointers.size === 2 && pinchStart) {
			const [a, b] = [...pointers.values()]
			const dist = Math.hypot(a.x - b.x, a.y - b.y)
			zoomTo(pinchScale * (dist / pinchStart), (a.x + b.x) / 2, (a.y + b.y) / 2, false)
		} else if (dragFrom) {
			tx = e.clientX - dragFrom.x
			ty = e.clientY - dragFrom.y
			paintZoom(false)
		}
	})

	const endPointer = e => {
		pointers.delete(e.pointerId)
		if (pointers.size < 2) pinchStart = 0
		if (!pointers.size) {
			dragFrom = null
			boxImg.classList.remove('is-dragging')
			paintZoom(true)
		}
	}

	boxImg.addEventListener('pointerup', endPointer)
	boxImg.addEventListener('pointercancel', endPointer)

	const openBox = (src, type, label) => {
		opener = document.activeElement
		const isVideo = type === 'video'

		boxImg.hidden = isVideo
		boxVid.hidden = !isVideo
		if (zoomBar) zoomBar.hidden = isVideo

		if (isVideo) {
			boxVid.src = src
			boxVid.setAttribute('aria-label', label || 'Video')
			boxVid.play().catch(() => {})
		} else {
			boxImg.src = src
			boxImg.alt = label || ''
			resetZoom()
		}

		box.classList.add('is-open')
		document.body.style.overflow = 'hidden'
		boxClose.focus()
	}

	const closeBox = () => {
		box.classList.remove('is-open')
		document.body.style.overflow = ''

		boxVid.pause()
		// Drop the source so a closed video stops buffering.
		boxVid.removeAttribute('src')
		boxVid.load()
		boxImg.removeAttribute('src')
		resetZoom()

		if (opener && typeof opener.focus === 'function') opener.focus()
		opener = null
	}

	// Delegated: every tile and shot carries data-src / data-type.
	document.addEventListener('click', e => {
		const trigger = e.target.closest('[data-src]')
		if (!trigger) return

		e.preventDefault()
		const label = (trigger.getAttribute('aria-label') || '').replace(/^View\s+/i, '').trim()
		openBox(trigger.dataset.src, trigger.dataset.type, label)
	})

	boxClose.addEventListener('click', closeBox)

	box.addEventListener('click', e => {
		if (e.target === box) closeBox()
	})

	document.addEventListener('keydown', e => {
		if (!box.classList.contains('is-open')) return

		if (e.key === 'Escape') {
			closeBox()
			return
		}

		if (boxImg.hidden) return

		if (e.key === '+' || e.key === '=') {
			e.preventDefault()
			zoomTo(scale * 1.5, null, null, true)
		} else if (e.key === '-' || e.key === '_') {
			e.preventDefault()
			zoomTo(scale / 1.5, null, null, true)
		} else if (e.key === '0') {
			e.preventDefault()
			scale = 1
			tx = 0
			ty = 0
			paintZoom(true)
		}
	})

	// Keep focus inside the dialog. `hidden` on a wrapper does not
	// set it on the children, so test the ancestor too or the zoom
	// buttons stay in the tab ring while the bar is hidden behind
	// a video.
	box.addEventListener('keydown', e => {
		if (e.key !== 'Tab') return

		const focusable = [...box.querySelectorAll('button, video[controls]')].filter(
			el => !el.hidden && !el.closest('[hidden]')
		)
		if (!focusable.length) return

		const first = focusable[0]
		const last = focusable[focusable.length - 1]

		if (e.shiftKey && document.activeElement === first) {
			e.preventDefault()
			last.focus()
		} else if (!e.shiftKey && document.activeElement === last) {
			e.preventDefault()
			first.focus()
		}
	})
}
