/*===============================================
  Entry point.

  Every module guards its own lookups, so one entry
  serves all four pages and any block whose elements
  are absent simply does not run.

  Modules are deferred by definition, so the DOM is
  parsed before this executes - no DOMContentLoaded
  wrapper needed.
===============================================*/

import { can3D } from './core/env.js'
import { initHue } from './core/hue.js'
import { initProgress, initReveal, initParallax, initTimeline } from './core/scroll.js'
import { initNav, initRole, initYear, initVideo, initStagger } from './ui/nav.js'
import { initPointer } from './ui/pointer.js'
import { initMasonry, initFilters } from './ui/masonry.js'
import { initLightbox } from './ui/lightbox.js'
import { initInvaders } from './games/invaders.js'
import { initTargetRush } from './games/target-rush.js'

/*--------------------------- core ---------------------------*/

initHue()
initProgress()
initNav()
initRole()
initYear()

/* Masonry must rebuild the columns BEFORE reveal and parallax
   observe anything, or they bind to tiles that are about to be
   moved into new parents. */
initMasonry()
initFilters()
initStagger()

initReveal()
initTimeline()
initParallax()
initPointer()
initVideo()
initLightbox()

/*-------------------------- games --------------------------*/

initInvaders()
initTargetRush()

/*--------------------------- 3D ---------------------------*/

/* three.js is only fetched when every gate in can3D() passes, so
   mobile, reduced-motion, save-data and no-WebGL2 visitors never
   download a byte of it. The CSS fallback deck is already on
   screen either way. */
const heroCanvas = document.getElementById('heroGl')

if (heroCanvas && can3D()) {
	import('./three/hero-deck.js')
		.then(m => m.initHeroDeck(heroCanvas))
		.catch(() => {
			// Vendored file missing or a shader failed to compile.
			// The CSS deck is still there; just drop the canvas.
			heroCanvas.remove()
		})
} else if (heroCanvas) {
	heroCanvas.remove()
}

/*------------------------ boot sequence ------------------------*/

/* One class removal brings the whole page's neon up at once, like
   a rig powering on. */
requestAnimationFrame(() => {
	setTimeout(() => document.documentElement.classList.remove('is-booting'), 700)
})
