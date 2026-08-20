/*===============================================
  Mobile navigation, the rotating hero role, the
  footer year, and inline-video autoplay.

  Small, unrelated behaviours that each cost a few
  lines and would be silly as separate files.
===============================================*/

import { reduceMotion } from '../core/env.js'

export function initNav() {
	const nav = document.getElementById('nav')
	const navBtn = document.getElementById('navBtn')
	if (!nav || !navBtn) return

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

export function initRole() {
	const el = document.getElementById('role')
	if (!el || reduceMotion()) return

	const roles = ['Unity Developer', 'Gameplay Programmer', 'Game Designer', 'Technical Artist']
	let i = 0

	setInterval(() => {
		i = (i + 1) % roles.length
		el.textContent = roles[i]
		// Restart the entrance animation on the same node.
		el.style.animation = 'none'
		void el.offsetWidth
		el.style.animation = ''
	}, 2800)
}

export function initYear() {
	const year = document.getElementById('year')
	if (year) year.textContent = new Date().getFullYear()
}

/* Every clip ships preload="none" plus a poster, so nothing
   downloads until it scrolls into view. */
export function initVideo() {
	const videos = document.querySelectorAll('video:not(#lightboxVideo)')
	if (!videos.length || !('IntersectionObserver' in window)) return

	const io = new IntersectionObserver(
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

	videos.forEach(v => io.observe(v))
}
