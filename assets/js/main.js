/*===============================================
  Entry point.

  Every module guards its own lookups, so one entry
  serves all four pages and any block whose elements
  are absent simply does not run.

  Modules are deferred by definition, so the DOM is
  parsed before this executes.
===============================================*/

import { can3D } from './core/env.js?v=7'
import { initHeader, initReveal } from './core/scroll.js?v=7'
import { initNav, initRole, initYear, initVideo } from './ui/nav.js?v=7'
import { initFilters, initStagger } from './ui/gallery.js?v=7'
import { initLightbox } from './ui/lightbox.js?v=7'
import { initInvaders } from './games/invaders.js?v=7'
import { initTargetRush } from './games/target-rush.js?v=7'

initHeader()
initNav()
initRole()
initYear()

initStagger()
initFilters()
initReveal()

initVideo()
initLightbox()

initInvaders()
initTargetRush()

/*--------------------------- 3D ---------------------------*/

/* three.js and the 1.3 MB model are only fetched once every gate
   in can3D() passes, so mobile, reduced-motion, save-data and
   no-WebGL2 visitors download none of it and keep the plotted
   contour instead. */
const glCanvas = document.getElementById('heroGl')

if (glCanvas && can3D()) {
	import('./three/gamepad.js?v=7')
		.then(m => m.initGamepad(glCanvas))
		.catch(() => glCanvas.remove())
} else if (glCanvas) {
	glCanvas.remove()
}
