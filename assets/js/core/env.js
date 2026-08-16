/*===============================================
  Environment + capability gates.

  The old script read prefers-reduced-motion ONCE
  at parse time. Both macOS and Windows let users
  toggle that without reloading, so a snapshot is
  wrong the moment someone changes it mid-session.
  Everything here stays live.
===============================================*/

const mqReduceMotion = matchMedia('(prefers-reduced-motion: reduce)')
const mqHover = matchMedia('(hover: hover) and (pointer: fine)')
const mqWide = matchMedia('(min-width: 900px)')

const listeners = new Set()

/** Live, never a load-time snapshot. */
export const reduceMotion = () => mqReduceMotion.matches

/** True only for real pointing devices - no tilt on touch. */
export const canHover = () => mqHover.matches && !reduceMotion()

export const isWide = () => mqWide.matches

/** Notify subscribers when the motion preference flips. */
export const onMotionChange = fn => {
	listeners.add(fn)
	return () => listeners.delete(fn)
}

mqReduceMotion.addEventListener('change', () => {
	listeners.forEach(fn => {
		try {
			fn(reduceMotion())
		} catch (e) {
			/* one bad subscriber must not break the rest */
		}
	})
})

/* WebGL2 probe. Creates a 1x1 context, tests it, then releases it
   immediately - browsers cap live contexts and a leaked probe
   counts against that budget. */
let webglCached = null

export const hasWebGL2 = () => {
	if (webglCached !== null) return webglCached

	try {
		const c = document.createElement('canvas')
		const gl = c.getContext('webgl2')
		webglCached = !!gl
		if (gl) {
			const lose = gl.getExtension('WEBGL_lose_context')
			if (lose) lose.loseContext()
		}
	} catch (e) {
		webglCached = false
	}

	return webglCached
}

/* Every gate the 3D scene has to clear before a single byte of
   three.js is fetched. Deliberately conservative: a portfolio's
   audience includes recruiters on hotel wifi and mid-range
   Android phones, and a static gradient page that loads instantly
   beats a 3D page that stutters. */
export const can3D = () =>
	isWide() &&
	canHover() &&
	!reduceMotion() &&
	(navigator.hardwareConcurrency || 4) >= 4 &&
	!(navigator.connection && navigator.connection.saveData) &&
	hasWebGL2()
