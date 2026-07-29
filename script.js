'use strict'

/*===============================================
  Shared behaviour for every page.
  Each page carries different markup, so every
  lookup is guarded and every block is optional.
===============================================*/

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

/*-----------------------------------------------
  Header: border on scroll + reading-progress rule
-----------------------------------------------*/

const header = document.getElementById('siteHeader')

if (header) {
	let ticking = false

	const paint = () => {
		const max = document.documentElement.scrollHeight - innerHeight
		const pct = max > 0 ? (scrollY / max) * 100 : 0

		header.classList.toggle('is-stuck', scrollY > 8)
		header.style.setProperty('--progress', `${pct.toFixed(2)}%`)
		ticking = false
	}

	// Coalesce scroll events into one paint per frame.
	const onScroll = () => {
		if (ticking) return
		ticking = true
		requestAnimationFrame(paint)
	}

	paint()
	addEventListener('scroll', onScroll, { passive: true })
	addEventListener('resize', onScroll)
}

/*-----------------------------------------------
  Mobile navigation
-----------------------------------------------*/

const nav = document.getElementById('nav')
const navBtn = document.getElementById('navBtn')

if (nav && navBtn) {
	const setNav = open => {
		nav.classList.toggle('is-open', open)
		navBtn.setAttribute('aria-expanded', String(open))
	}

	navBtn.addEventListener('click', () => setNav(!nav.classList.contains('is-open')))

	nav.addEventListener('click', e => {
		if (e.target.closest('a')) setNav(false)
	})

	document.addEventListener('keydown', e => {
		if (e.key === 'Escape' && nav.classList.contains('is-open')) {
			setNav(false)
			navBtn.focus()
		}
	})
}

/*-----------------------------------------------
  Rotating role in the hero
-----------------------------------------------*/

const roleWrap = document.getElementById('role')

if (roleWrap && !reduceMotion) {
	const roles = ['Unity Developer', 'Gameplay Programmer', 'Game Designer', 'Technical Artist']
	let index = 0

	setInterval(() => {
		index = (index + 1) % roles.length
		roleWrap.textContent = roles[index]
		// Restart the entrance animation on the same node.
		roleWrap.style.animation = 'none'
		void roleWrap.offsetWidth
		roleWrap.style.animation = ''
	}, 2800)
}

/*-----------------------------------------------
  Scroll reveal — fires once per element
-----------------------------------------------*/

const reveals = document.querySelectorAll('.reveal')

if (reveals.length) {
	if ('IntersectionObserver' in window && !reduceMotion) {
		const revealObserver = new IntersectionObserver(
			(entries, obs) => {
				entries.forEach(entry => {
					if (!entry.isIntersecting) return
					entry.target.classList.add('is-visible')
					obs.unobserve(entry.target)
				})
			},
			{ rootMargin: '0px 0px -10% 0px' }
		)
		reveals.forEach(el => revealObserver.observe(el))
	} else {
		reveals.forEach(el => el.classList.add('is-visible'))
	}
}

/*-----------------------------------------------
  Cursor spotlight on the card / skill grids.
  JS only writes two custom properties; the glow
  itself is a CSS radial-gradient.
-----------------------------------------------*/

const spotlights = document.querySelectorAll('.spotlight')

if (spotlights.length && !reduceMotion && matchMedia('(hover: hover)').matches) {
	spotlights.forEach(el => {
		let frame = 0

		el.addEventListener(
			'pointermove',
			e => {
				if (frame) return
				frame = requestAnimationFrame(() => {
					const r = el.getBoundingClientRect()
					el.style.setProperty('--mx', `${e.clientX - r.left}px`)
					el.style.setProperty('--my', `${e.clientY - r.top}px`)
					frame = 0
				})
			},
			{ passive: true }
		)
	})
}

/*-----------------------------------------------
  Index children so CSS can stagger them
-----------------------------------------------*/

document.querySelectorAll('.skill-group ul').forEach(list => {
	[...list.children].forEach((li, i) => li.style.setProperty('--i', i))
})

document.querySelectorAll('.masonry').forEach(grid => {
	[...grid.children].forEach((tile, i) => tile.style.setProperty('--i', i % 6))
})

/*-----------------------------------------------
  Inline video: play only while on screen.
  Every clip ships preload="none" + a poster, so
  nothing downloads until it scrolls into view.
-----------------------------------------------*/

const inlineVideos = document.querySelectorAll('video:not(#lightboxVideo)')

if (inlineVideos.length && 'IntersectionObserver' in window) {
	const videoObserver = new IntersectionObserver(
		entries => {
			entries.forEach(entry => {
				const video = entry.target

				if (entry.isIntersecting) {
					if (video.preload === 'none') video.preload = 'metadata'
					video.play().catch(() => {
						/* autoplay can be refused; the poster still shows */
					})
				} else {
					video.pause()
				}
			})
		},
		{ threshold: 0.3 }
	)

	inlineVideos.forEach(v => videoObserver.observe(v))
}

/*-----------------------------------------------
  Gallery filters
-----------------------------------------------*/

const filters = document.querySelectorAll('.filter')

if (filters.length) {
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

/*-----------------------------------------------
  Lightbox
-----------------------------------------------*/

const box = document.getElementById('lightbox')
const boxImg = document.getElementById('lightboxImg')
const boxVid = document.getElementById('lightboxVideo')
const boxClose = document.getElementById('lightboxClose')
let opener = null

if (box) {
	/* --- zoom + pan, images only -------------------------------------
	   The video keeps its native controls, so transforming it would put
	   the scrub bar somewhere the pointer can no longer reach. --------*/

	const zoomBar = document.getElementById('zoomBar')
	const zoomIn = document.getElementById('zoomIn')
	const zoomOut = document.getElementById('zoomOut')
	const zoomReset = document.getElementById('zoomReset')

	const MIN = 1
	const MAX = 6
	let scale = 1
	let tx = 0
	let ty = 0
	const pointers = new Map()
	let pinchStart = 0
	let pinchScale = 1
	let dragFrom = null

	const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

	// Keep the image overlapping the viewport: once it is smaller than the
	// frame in an axis, that axis snaps back to centred.
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
		boxImg.style.transition = smooth && !reduceMotion ? 'transform 0.22s var(--ease)' : 'none'
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

	// Zoom about a screen point, so the pixel under the cursor stays put.
	const zoomTo = (next, clientX, clientY, smooth) => {
		next = clamp(next, MIN, MAX)
		if (next === scale) return

		if (clientX == null) {
			// No anchor (buttons, keyboard): scale about the current centre.
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

	// Delegated: every tile carries data-src / data-type.
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

	// Keep focus inside the dialog. `hidden` on a wrapper does not set it on
	// the children, so test the ancestor too or the zoom buttons stay in the
	// tab ring while the bar is hidden behind a video.
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

/*-----------------------------------------------
  Footer year
-----------------------------------------------*/

const year = document.getElementById('year')
if (year) year.textContent = new Date().getFullYear()

/*-----------------------------------------------
  Mini game — 20s target rush
  Targets are real <button>s so the game is
  playable with Tab + Enter, not just a mouse.
-----------------------------------------------*/

const board = document.getElementById('gameBoard')

if (board) {
	const startBtn = document.getElementById('gameStart')
	const scoreEl = document.getElementById('gameScore')
	const timeEl = document.getElementById('gameTime')
	const bestEl = document.getElementById('gameBest')
	const hint = document.getElementById('gameHint')

	const ROUND = 20
	const BEST_KEY = 'sr-game-best'

	let score = 0
	let left = ROUND
	let best = Number(localStorage.getItem(BEST_KEY) || 0)
	let tickId = null
	let spawnId = null
	let running = false

	bestEl.textContent = String(best)

	const rand = (min, max) => min + Math.random() * (max - min)

	const clearTargets = () => board.querySelectorAll('.target, .floater').forEach(el => el.remove())

	const floater = (text, x, y, bonus) => {
		const f = document.createElement('span')
		f.className = 'floater' + (bonus ? ' is-bonus' : '')
		f.textContent = text
		f.style.left = `${x}px`
		f.style.top = `${y}px`
		board.append(f)
		setTimeout(() => f.remove(), 600)
	}

	const spawn = () => {
		if (!running) return

		const rect = board.getBoundingClientRect()
		// Bonus targets are smaller, rarer and worth more.
		const bonus = Math.random() < 0.18
		const size = bonus ? rand(26, 34) : rand(38, 56)
		const pad = size / 2 + 8

		const x = rand(pad, rect.width - pad)
		const y = rand(pad, rect.height - pad)

		const t = document.createElement('button')
		t.type = 'button'
		t.className = 'target' + (bonus ? ' is-bonus' : '')
		t.style.setProperty('--size', `${size}px`)
		t.style.left = `${x}px`
		t.style.top = `${y}px`
		t.setAttribute('aria-label', bonus ? 'Bonus target, 3 points' : 'Target, 1 point')

		const life = setTimeout(() => t.remove(), bonus ? 900 : 1400)

		t.addEventListener('click', () => {
			clearTimeout(life)
			const points = bonus ? 3 : 1
			score += points
			scoreEl.textContent = String(score)
			floater(`+${points}`, x, y, bonus)
			t.remove()
		})

		board.append(t)
	}

	const stop = () => {
		running = false
		clearInterval(tickId)
		clearInterval(spawnId)
		clearTargets()

		if (score > best) {
			best = score
			localStorage.setItem(BEST_KEY, String(best))
			bestEl.textContent = String(best)
		}

		hint.hidden = false
		hint.innerHTML =
			`<strong>${score} point${score === 1 ? '' : 's'}</strong>` +
			`<span>${score >= best && score > 0 ? 'New best.' : `Best: ${best}.`} Go again?</span>`

		startBtn.textContent = 'Play again'
		startBtn.disabled = false
	}

	const start = () => {
		score = 0
		left = ROUND
		running = true

		scoreEl.textContent = '0'
		timeEl.textContent = String(ROUND)
		hint.hidden = true
		startBtn.disabled = true
		startBtn.textContent = 'Playing…'
		clearTargets()

		tickId = setInterval(() => {
			left--
			timeEl.textContent = String(left)
			if (left <= 0) stop()
		}, 1000)

		spawnId = setInterval(spawn, 620)
		spawn()
	}

	startBtn.addEventListener('click', start)

	// Don't keep spawning into a tab nobody is looking at.
	document.addEventListener('visibilitychange', () => {
		if (document.hidden && running) stop()
	})
}
