'use strict'

/*===============================================
  Shared behaviour for index / portfolio / projects
  Every lookup is guarded: the three pages have
  different DOM and this file is loaded by all of them.
===============================================*/

const body = document.body

/*-----------------------------------------------
  Theme
-----------------------------------------------*/

const btnThemeIcon = document.querySelector('#btn-theme')
const btnThemeButton = btnThemeIcon ? btnThemeIcon.closest('button') : null

const prefersDark = () =>
	window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches

const applyTheme = theme => {
	const isDark = theme === 'dark'

	body.classList.remove('light', 'dark')
	body.classList.add(isDark ? 'dark' : 'light')

	if (btnThemeIcon) {
		btnThemeIcon.classList.remove('fa-moon', 'fa-sun')
		btnThemeIcon.classList.add(isDark ? 'fa-sun' : 'fa-moon')
	}

	if (btnThemeButton) {
		btnThemeButton.setAttribute('aria-pressed', String(isDark))
	}

	window.dispatchEvent(new Event('themeChanged'))
}

// Stored preference wins; otherwise fall back to the OS setting.
const storedTheme = localStorage.getItem('portfolio-theme')
applyTheme(storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : prefersDark() ? 'dark' : 'light')

const toggleTheme = () => {
	const next = body.classList.contains('dark') ? 'light' : 'dark'
	applyTheme(next)
	localStorage.setItem('portfolio-theme', next)
}

if (btnThemeButton) btnThemeButton.addEventListener('click', toggleTheme)

// Follow the OS if the visitor has never made an explicit choice.
if (window.matchMedia) {
	window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
		if (!localStorage.getItem('portfolio-theme')) applyTheme(e.matches ? 'dark' : 'light')
	})
}

/*-----------------------------------------------
  Mobile navigation
-----------------------------------------------*/

const navHamburger = document.querySelector('.nav__hamburger')
const navList = document.querySelector('.nav__list')
const navHamburgerIcon = navHamburger ? navHamburger.querySelector('i') : null

const setNavOpen = open => {
	if (!navList) return

	navList.classList.toggle('display-nav-list', open)

	if (navHamburger) navHamburger.setAttribute('aria-expanded', String(open))

	if (navHamburgerIcon) {
		navHamburgerIcon.classList.remove('fa-bars', 'fa-times')
		navHamburgerIcon.classList.add(open ? 'fa-times' : 'fa-bars')
	}
}

if (navHamburger && navList) {
	setNavOpen(false)

	navHamburger.addEventListener('click', () =>
		setNavOpen(!navList.classList.contains('display-nav-list'))
	)

	// Close after following an in-page link, and on Escape.
	navList.addEventListener('click', e => {
		if (e.target.closest('a')) setNavOpen(false)
	})

	document.addEventListener('keydown', e => {
		if (e.key === 'Escape' && navList.classList.contains('display-nav-list')) {
			setNavOpen(false)
			navHamburger.focus()
		}
	})
}

/*-----------------------------------------------
  Scroll to top
-----------------------------------------------*/

const btnScrollTop = document.querySelector('.scroll-top')

if (btnScrollTop) {
	const scrollUp = () => {
		const scrolled = window.scrollY || document.documentElement.scrollTop
		btnScrollTop.style.display = scrolled > 500 ? 'block' : 'none'
	}

	scrollUp()
	document.addEventListener('scroll', scrollUp, { passive: true })
}

/*-----------------------------------------------
  Lightbox modal (images + video)
-----------------------------------------------*/

const modal = document.getElementById('myModal')
const modalImg = document.getElementById('modalImage')
const modalVideo = document.getElementById('modalVideo')
let modalOpener = null

function openModal(src, type) {
	if (!modal) return

	modalOpener = document.activeElement

	if (type === 'image' && modalImg) {
		modalImg.style.display = 'block'
		modalImg.src = src
		modalImg.alt = ''
		if (modalVideo) modalVideo.style.display = 'none'
	} else if (type === 'video' && modalVideo) {
		if (modalImg) modalImg.style.display = 'none'
		modalVideo.style.display = 'block'
		modalVideo.src = src
		modalVideo.preload = 'auto'
		modalVideo.load()
		modalVideo.play().catch(() => {
			/* autoplay may be blocked; controls are visible either way */
		})
	}

	modal.style.display = 'block'
	body.style.overflow = 'hidden'

	const closeBtn = modal.querySelector('.close')
	if (closeBtn) closeBtn.focus()
}

function closeModal() {
	if (!modal) return

	modal.style.display = 'none'
	body.style.overflow = ''

	if (modalVideo) {
		modalVideo.pause()
		modalVideo.currentTime = 0
		// Drop the source so the browser stops buffering a closed video.
		modalVideo.removeAttribute('src')
		modalVideo.load()
	}

	if (modalImg) modalImg.removeAttribute('src')

	if (modalOpener && typeof modalOpener.focus === 'function') modalOpener.focus()
	modalOpener = null
}

if (modal) {
	// Delegated: every gallery tile carries data-src / data-type.
	document.addEventListener('click', e => {
		const trigger = e.target.closest('[data-src]')
		if (!trigger) return

		e.preventDefault()
		openModal(trigger.dataset.src, trigger.dataset.type || 'image')
	})

	const closeBtn = modal.querySelector('.close')
	if (closeBtn) closeBtn.addEventListener('click', closeModal)

	// Click the backdrop (but not the media itself) to dismiss.
	modal.addEventListener('click', e => {
		if (e.target === modal) closeModal()
	})

	document.addEventListener('keydown', e => {
		if (e.key === 'Escape' && modal.style.display === 'block') closeModal()
	})

	// Keep focus inside the dialog while it is open.
	modal.addEventListener('keydown', e => {
		if (e.key !== 'Tab') return

		const focusable = modal.querySelectorAll('button, [href], video[controls], [tabindex]:not([tabindex="-1"])')
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
  Hero: rotating role + tagline (index only)
-----------------------------------------------*/

const roleText = document.querySelector('.second-text')

if (roleText) {
	const roles = ['Game Developer', 'Game Designer', 'Sports Enthusiast', 'Gamer']
	let roleIndex = 0

	roleText.textContent = roles[0]
	setInterval(() => {
		roleIndex = (roleIndex + 1) % roles.length
		roleText.textContent = roles[roleIndex]
	}, 4000)
}

const taglineElement = document.getElementById('dailyTagline')

if (taglineElement) {
	const taglines = [
		"Turning the 'what if' moments into games you can actually play.",
		"Making games that I'd lose sleep playing.",
		'Creating the experiences I dreamed about as a kid.',
		'Crafting digital chaos and calling it entertainment.',
		'From playing games all night to making them all day.',
	]

	let taglineIndex = 0

	const dropIn = () => {
		taglineElement.classList.add('tagline-drop-in')
		setTimeout(() => taglineElement.classList.remove('tagline-drop-in'), 1000)
	}

	taglineElement.textContent = taglines[0]
	dropIn()

	setInterval(() => {
		taglineElement.classList.add('tagline-fly-out')

		setTimeout(() => {
			taglineIndex = (taglineIndex + 1) % taglines.length
			taglineElement.textContent = taglines[taglineIndex]
			taglineElement.classList.remove('tagline-fly-out')
			dropIn()
		}, 500)
	}, 10000)
}

/*-----------------------------------------------
  Scroll reveal
-----------------------------------------------*/

const revealTargets = document.querySelectorAll('.reveal')

if (revealTargets.length) {
	if ('IntersectionObserver' in window) {
		const revealObserver = new IntersectionObserver(
			entries => entries.forEach(entry => entry.target.classList.toggle('active', entry.isIntersecting)),
			{ rootMargin: '0px 0px -150px 0px' }
		)
		revealTargets.forEach(el => revealObserver.observe(el))
	} else {
		revealTargets.forEach(el => el.classList.add('active'))
	}
}

/*-----------------------------------------------
  Play inline videos only while they are on screen.
  Every <video> ships with preload="none" + a poster,
  so nothing is fetched until it actually scrolls in.
-----------------------------------------------*/

const inlineVideos = document.querySelectorAll('video:not(#modalVideo)')

if (inlineVideos.length && 'IntersectionObserver' in window) {
	const videoObserver = new IntersectionObserver(
		entries => {
			entries.forEach(entry => {
				const video = entry.target

				if (entry.isIntersecting) {
					if (video.preload === 'none') video.preload = 'metadata'
					video.play().catch(() => {
						/* ignore autoplay rejection */
					})
				} else {
					video.pause()
				}
			})
		},
		{ threshold: 0.25 }
	)

	inlineVideos.forEach(video => videoObserver.observe(video))
}
