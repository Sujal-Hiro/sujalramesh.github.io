'use strict'

/*===============================================
  Shared behaviour for every page.
  Each page carries different markup, so every
  lookup is guarded and every block is optional.
===============================================*/

const root = document.documentElement
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

/*-----------------------------------------------
  Theme
-----------------------------------------------*/

const themeBtn = document.getElementById('themeBtn')
const themeIcon = document.getElementById('themeIcon')

const MOON = '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'
const SUN =
	'<circle cx="12" cy="12" r="4"/>' +
	'<path d="M12 3v2m0 14v2M5.6 5.6 7 7m10 10 1.4 1.4M3 12h2m14 0h2M5.6 18.4 7 17m10-10 1.4-1.4"/>'

const applyTheme = dark => {
	root.classList.toggle('dark', dark)
	root.classList.toggle('light', !dark)

	if (themeIcon) themeIcon.innerHTML = dark ? SUN : MOON
	if (themeBtn) themeBtn.setAttribute('aria-pressed', String(dark))
}

// Stored choice wins; otherwise follow the OS.
const storedTheme = localStorage.getItem('sr-theme')
applyTheme(storedTheme ? storedTheme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches)

if (themeBtn) {
	themeBtn.addEventListener('click', () => {
		const dark = !root.classList.contains('dark')
		applyTheme(dark)
		localStorage.setItem('sr-theme', dark ? 'dark' : 'light')
	})
}

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
	if (!localStorage.getItem('sr-theme')) applyTheme(e.matches)
})

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
	const roles = ['Game Developer', 'Game Designer', 'Gameplay Programmer', 'Gamer']
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
  Count-up stats, once, when scrolled into view
-----------------------------------------------*/

const stats = document.querySelectorAll('[data-count]')

if (stats.length) {
	const runCount = el => {
		const target = Number(el.dataset.count)

		if (reduceMotion) {
			el.textContent = String(target)
			return
		}

		const duration = 1100
		const start = performance.now()

		const step = now => {
			const t = Math.min((now - start) / duration, 1)
			// easeOutCubic — fast then settling, reads as deliberate
			const eased = 1 - Math.pow(1 - t, 3)
			el.textContent = String(Math.round(target * eased))
			if (t < 1) requestAnimationFrame(step)
		}

		requestAnimationFrame(step)
	}

	if ('IntersectionObserver' in window) {
		const countObserver = new IntersectionObserver(
			(entries, obs) => {
				entries.forEach(entry => {
					if (!entry.isIntersecting) return
					runCount(entry.target)
					obs.unobserve(entry.target)
				})
			},
			{ threshold: 0.6 }
		)
		stats.forEach(el => countObserver.observe(el))
	} else {
		stats.forEach(el => (el.textContent = el.dataset.count))
	}
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
