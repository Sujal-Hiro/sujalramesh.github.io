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
	const openBox = (src, type, label) => {
		opener = document.activeElement
		const isVideo = type === 'video'

		boxImg.hidden = isVideo
		boxVid.hidden = !isVideo

		if (isVideo) {
			boxVid.src = src
			boxVid.setAttribute('aria-label', label || 'Video')
			boxVid.play().catch(() => {})
		} else {
			boxImg.src = src
			boxImg.alt = label || ''
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
		if (e.key === 'Escape' && box.classList.contains('is-open')) closeBox()
	})

	// Keep focus inside the dialog.
	box.addEventListener('keydown', e => {
		if (e.key !== 'Tab') return

		const focusable = [...box.querySelectorAll('button, video[controls]')].filter(el => !el.hidden)
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
