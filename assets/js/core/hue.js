/*===============================================
  The RGB clock - single source of truth for hue.

  JS owns the number and writes it to the document.
  CSS reads it through --hue-base; the WebGL scene
  reads it through getHue(). Both are frame-identical
  by construction, with no polling and no drift.

  The tempting alternative - animate --hue-base with
  @keyframes and have JS read it back with
  getComputedStyle() - is wrong: getComputedStyle
  forces a style recalc, and doing that every frame
  inside a render loop is measurable jank.
===============================================*/

import { reduceMotion, onMotionChange } from './env.js'
import { add, remove } from './loop.js'

const START = 265
const DEG_PER_SEC = 15 // 360 / 24s
const WRITE_HZ = 10 // writes per second

let hue = START
let sinceWrite = 0
let running = false

const root = document.documentElement

/** Current hue in degrees, 0-360. Synchronous, zero DOM cost. */
export const getHue = () => hue

const write = () => root.style.setProperty('--hue-base', hue.toFixed(1))

const step = dt => {
	hue = (hue + DEG_PER_SEC * dt) % 360

	// Writing 10x/sec instead of 60x is 1.5 degrees per step at this
	// speed - imperceptible - for a sixth of the style invalidation.
	sinceWrite += dt
	if (sinceWrite >= 1 / WRITE_HZ) {
		sinceWrite = 0
		write()
	}
}

const startClock = () => {
	if (running) return
	running = true
	add(step)
}

const stopClock = () => {
	if (!running) return
	running = false
	remove(step)
	hue = START
	write()
}

export function initHue() {
	write()

	if (!reduceMotion()) startClock()

	// Honour a mid-session preference change in both directions.
	onMotionChange(reduced => (reduced ? stopClock() : startClock()))
}

/*-----------------------------------------------
  Canvas palette resolver.

  Canvas2D SILENTLY IGNORES an invalid fillStyle and
  keeps the previous value, so on a browser without
  oklch() support the games would render in whatever
  colour was last assigned - a silent, hue-dependent
  bug that is painful to track down.

  So: probe once, and fall back to literal hex if
  oklch does not take.
-----------------------------------------------*/

let supportsOklch = null

const probeOklch = () => {
	if (supportsOklch !== null) return supportsOklch

	try {
		const ctx = document.createElement('canvas').getContext('2d')
		ctx.fillStyle = '#000000'
		ctx.fillStyle = 'oklch(0.72 0.18 340)'
		supportsOklch = ctx.fillStyle !== '#000000'
	} catch (e) {
		supportsOklch = false
	}

	return supportsOklch
}

/* Hard fallbacks matching the @supports block in tokens.css. */
const FALLBACK = {
	'--rgb-cyan': '#3ad9f0',
	'--rgb-blue': '#6f9bff',
	'--rgb-violet': '#a68cff',
	'--rgb-magenta': '#ff67b0',
	'--rgb-lime': '#4ef2a0',
	'--rgb-amber': '#ffbe4d',
	'--rgb-red': '#ff5a5a',
	'--fg': '#eeeef4',
	'--fg-muted': '#8f8f9d',
	'--neon-hi': '#c9b8ff',
}

/**
 * Read a set of custom properties into plain colour strings that
 * Canvas2D will definitely accept. Called ONCE at game init, not
 * per frame: these are the fixed semantic neons, and they are
 * fixed precisely so a player can learn what each colour means.
 */
export function readPalette(names) {
	const ok = probeOklch()
	const css = getComputedStyle(document.documentElement)
	const out = {}

	names.forEach(name => {
		const raw = css.getPropertyValue(name).trim()
		out[name] = ok && raw ? raw : FALLBACK[name] || '#ffffff'
	})

	return out
}
