/*===============================================
  Space Invaders

  Drawn in a fixed 960x540 space and scaled by CSS,
  so there is one coordinate system regardless of
  how wide the section renders. Sprites are pixel
  matrices rather than images, so no extra requests.

  The playfield is the one dark surface on a paper
  site, so its palette is literal rather than taken
  from the CSS tokens - those follow the light theme
  and would be invisible here.

  It is near-monochrome by design: paper-white fleet,
  one vermillion rank at the back worth the most.
  Colour still carries the scoring information, but
  with one accent rather than five.
===============================================*/

import { reduceMotion } from '../core/env.js?v=6'

export function initInvaders() {
	const siCanvas = document.getElementById('siCanvas')
	if (!siCanvas || !siCanvas.getContext) return

	const ctx = siCanvas.getContext('2d')
	const W = siCanvas.width
	const H = siCanvas.height

	const scoreEl = document.getElementById('siScore')
	const waveEl = document.getElementById('siWave')
	const livesEl = document.getElementById('siLives')
	const bestEl = document.getElementById('siBest')
	const startBtn = document.getElementById('siStart')
	const pauseBtn = document.getElementById('siPause')
	const hint = document.getElementById('siHint')
	const pad = document.getElementById('siPad')

	const BEST_KEY = 'sr-invaders-best'

	/* Literal, and deliberately not read from CSS: this canvas is a
	   dark screen inside a light page, so the page's ink-on-paper
	   tokens do not apply. Canvas2D also silently ignores an invalid
	   fillStyle and keeps the previous value, which makes any colour
	   bug here near-impossible to spot. */
	const PAPER = '#f5f3ee'
	const ACCENT = '#e06046'
	const FLEET = '#cfcabd'
	const DIM = '#6f6a5e'

	// Row 0 sits furthest back and is worth the most, so it is the
	// only rank that gets the accent.
	const ROW_COLOUR = [ACCENT, FLEET, FLEET, DIM, DIM]
	const SHIP_COLOUR = PAPER
	const BULLET_COLOUR = ACCENT
	const BOMB_COLOUR = FLEET
	const MUTED = DIM

	// Two frames of the same 8x5 invader, giving the classic
	// marching wobble.
	const ALIEN = [
		['..X..X..', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', 'X.X..X.X'],
		['..X..X..', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', '.X.XX.X.'],
	]
	const SHIP = ['...XX...', '..XXXX..', '.XXXXXX.', 'XXXXXXXX']

	const PX = 4
	const ALIEN_W = 8 * PX
	const ALIEN_H = 5 * PX
	const SHIP_W = 8 * PX
	const SHIP_H = 4 * PX
	const GAP_X = 22
	const GAP_Y = 18
	const STEP_X = ALIEN_W + GAP_X
	const STEP_Y = ALIEN_H + GAP_Y

	const SHIP_Y = H - 56
	const GROUND = SHIP_Y + SHIP_H + 10
	const POINTS = [40, 30, 20, 10]
	const pointsFor = row => POINTS[Math.min(row, POINTS.length - 1)]

	/* Bloom: one composite per frame against an offscreen buffer.
	   Per-sprite ctx.shadowBlur across ~50 sprites is far too
	   expensive - shadow is the single costliest Canvas2D op.
	   Blur-drawing a canvas onto itself is not reliably specified,
	   hence the separate buffer. */
	let bloom = null
	let bloomCtx = null

	const canBloom = (() => {
		try {
			const probe = document.createElement('canvas').getContext('2d')
			probe.filter = 'blur(2px)'
			return probe.filter === 'blur(2px)'
		} catch (e) {
			return false
		}
	})()

	if (canBloom) {
		bloom = document.createElement('canvas')
		bloom.width = W
		bloom.height = H
		bloomCtx = bloom.getContext('2d')
	}

	let score = 0
	let wave = 1
	let lives = 3
	let best = 0
	try {
		best = Number(localStorage.getItem(BEST_KEY)) || 0
	} catch (e) {
		/* storage unavailable; best stays session-only */
	}

	let running = false
	let paused = false
	let loopId = 0
	let last = 0

	let shipX = W / 2
	let aliens = []
	let bullets = []
	let bombs = []
	let fleetX = 0
	let fleetY = 0
	let dir = 1
	let wobble = 0
	let wobbleFrame = 0
	let bombClock = 0
	let fireClock = 0
	let invuln = 0
	let breakClock = 0
	let fleetRows = 4
	let fleetCols = 8

	const held = { left: false, right: false }

	const clampNum = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

	const blit = (rows, x, y, colour) => {
		ctx.fillStyle = colour
		for (let r = 0; r < rows.length; r++) {
			for (let c = 0; c < rows[r].length; c++) {
				if (rows[r][c] === 'X') ctx.fillRect(x + c * PX, y + r * PX, PX, PX)
			}
		}
	}

	const alienX = a => fleetX + a.col * STEP_X
	const alienY = a => fleetY + a.row * STEP_Y

	/* Waves differ in shape, not just pace. Speed alone is
	   invisible: you feel it but the board looks identical. So each
	   wave is also wider, deeper, starts lower and opens the other
	   way.

	   Width and depth cap at 10x5 or the fleet would not fit and
	   would open on top of the player. Armour is what keeps
	   escalating past that: one more rank takes two hits every
	   third wave, so there is always something new happening. */
	const buildFleet = () => {
		fleetCols = Math.min(10, 7 + Math.ceil(wave / 2))
		fleetRows = Math.min(5, 3 + Math.ceil(wave / 3))
		const armoured = Math.floor((wave - 1) / 3)

		aliens = []
		for (let row = 0; row < fleetRows; row++) {
			for (let col = 0; col < fleetCols; col++) {
				const hp = row < armoured ? 2 : 1
				aliens.push({ row, col, alive: true, hp, maxHp: hp })
			}
		}

		const width = fleetCols * ALIEN_W + (fleetCols - 1) * GAP_X
		fleetX = (W - width) / 2
		// Cap the head start, or wave 8 would open on top of the player.
		fleetY = 70 + Math.min(5, wave - 1) * 12
		dir = wave % 2 ? 1 : -1
		bullets = []
		bombs = []
	}

	const setStats = () => {
		scoreEl.textContent = String(score)
		waveEl.textContent = String(wave)
		livesEl.textContent = String(lives)
		bestEl.textContent = String(best)
	}

	function haltLoop() {
		cancelAnimationFrame(loopId)
		loopId = 0
	}

	const gameOver = () => {
		running = false
		haltLoop()

		if (score > best) {
			best = score
			try {
				localStorage.setItem(BEST_KEY, String(best))
			} catch (e) {
				/* nothing to persist to */
			}
		}
		setStats()

		hint.hidden = false
		hint.innerHTML =
			'<strong>' +
			score +
			' point' +
			(score === 1 ? '' : 's') +
			'</strong>' +
			'<span>' +
			(score >= best && score > 0 ? 'New best.' : 'Best: ' + best + '.') +
			' Reached wave ' +
			wave +
			'. Go again?</span>'

		startBtn.textContent = 'Play again'
		startBtn.disabled = false
		pauseBtn.hidden = true
		draw()
	}

	const loseLife = () => {
		lives--
		setStats()
		bombs = []
		invuln = 1.4
		shipX = W / 2
		if (lives <= 0) gameOver()
	}

	// The gun runs itself, so steering is the whole game. The
	// cooldown is the only thing rationing shots, so it doubles as
	// the difficulty dial.
	const fire = () => {
		if (fireClock > 0 || bullets.length >= 4) return
		bullets.push({ x: shipX, y: SHIP_Y - 4 })
		fireClock = 0.22
	}

	const update = dt => {
		if (breakClock > 0) {
			breakClock -= dt
			if (breakClock <= 0) buildFleet()
			return
		}

		fireClock = Math.max(0, fireClock - dt)
		invuln = Math.max(0, invuln - dt)

		// --- ship
		const move = (held.right ? 1 : 0) - (held.left ? 1 : 0)
		shipX = clampNum(shipX + move * 400 * dt, SHIP_W / 2, W - SHIP_W / 2)
		fire()

		// --- fleet: the fewer left alive, the faster it comes
		const alive = aliens.filter(a => a.alive)
		if (!alive.length) {
			wave++
			setStats()
			// Clear leftovers now, not when the next fleet builds.
			// update() returns early during the break, so anything
			// still in flight would hang frozen for the whole beat.
			bullets = []
			bombs = []
			breakClock = 0.9
			return
		}

		const pressure = 1 + ((aliens.length - alive.length) / aliens.length) * 2.4
		const speed = (26 + wave * 9) * pressure
		fleetX += dir * speed * dt

		const minCol = Math.min.apply(
			null,
			alive.map(a => a.col)
		)
		const maxCol = Math.max.apply(
			null,
			alive.map(a => a.col)
		)
		const leftEdge = fleetX + minCol * STEP_X
		const rightEdge = fleetX + maxCol * STEP_X + ALIEN_W

		if (leftEdge < 16 || rightEdge > W - 16) {
			dir *= -1
			fleetX = clampNum(fleetX, 16 - minCol * STEP_X, W - 16 - maxCol * STEP_X - ALIEN_W)
			fleetY += 18
		}

		wobble += dt
		if (wobble > 0.45) {
			wobble = 0
			wobbleFrame ^= 1
		}

		// Reaching the player's line ends it outright.
		if (alive.some(a => alienY(a) + ALIEN_H >= SHIP_Y)) {
			lives = 0
			gameOver()
			return
		}

		// --- bombs
		bombClock -= dt
		if (bombClock <= 0) {
			bombClock = Math.max(0.32, 1.5 - wave * 0.13) * (0.6 + Math.random() * 0.8)
			// Only the lowest alien in a column can drop one.
			const shooters = alive.filter(a => !alive.some(b => b.col === a.col && b.row > a.row))
			const pick = shooters[Math.floor(Math.random() * shooters.length)]
			if (pick) bombs.push({ x: alienX(pick) + ALIEN_W / 2, y: alienY(pick) + ALIEN_H })
		}

		bombs = bombs.filter(b => {
			b.y += (170 + wave * 12) * dt
			if (b.y > GROUND) return false

			if (
				!invuln &&
				b.x > shipX - SHIP_W / 2 &&
				b.x < shipX + SHIP_W / 2 &&
				b.y > SHIP_Y &&
				b.y < SHIP_Y + SHIP_H
			) {
				loseLife()
				return false
			}
			return true
		})

		// --- bullets
		bullets = bullets.filter(bullet => {
			bullet.y -= 640 * dt
			if (bullet.y < -12) return false

			for (const a of alive) {
				// `alive` is a snapshot; two bullets in the same frame
				// must not both score the alien one of them already killed.
				if (!a.alive) continue
				const ax = alienX(a)
				const ay = alienY(a)
				if (bullet.x > ax && bullet.x < ax + ALIEN_W && bullet.y < ay + ALIEN_H && bullet.y > ay) {
					a.hp--
					if (a.hp <= 0) {
						a.alive = false
						score += pointsFor(a.row)
						setStats()
					}
					return false
				}
			}
			return true
		})
	}

	function draw() {
		ctx.clearRect(0, 0, W, H)

		ctx.globalAlpha = 0.35
		ctx.fillStyle = MUTED
		ctx.fillRect(0, GROUND, W, 1)
		ctx.globalAlpha = 1

		aliens.forEach(a => {
			if (!a.alive) return
			const colour = ROW_COLOUR[Math.min(a.row, ROW_COLOUR.length - 1)]
			// A chipped alien fades rather than changing hue, so the
			// row colours keep meaning what they meant.
			ctx.globalAlpha = a.hp < a.maxHp ? 0.45 : 1
			blit(ALIEN[wobbleFrame], alienX(a), alienY(a), colour)
		})
		ctx.globalAlpha = 1

		/* Blink the ship while it is briefly invulnerable.

		   The original used invuln * 12, which flips parity 12x/sec
		   = 6 flashes/sec, double the WCAG 2.3.1 limit of three. It
		   was technically exempt on area (the ship is ~32x16px, well
		   under the threshold) but it was the only rate violation on
		   the site.

		   Now: 4Hz, capped to the first 1.0s of the 1.4s window, and
		   under reduced motion it does not blink at all - it just
		   sits at half alpha for the duration. */
		if (reduceMotion()) {
			ctx.globalAlpha = invuln ? 0.55 : 1
			blit(SHIP, shipX - SHIP_W / 2, SHIP_Y, SHIP_COLOUR)
			ctx.globalAlpha = 1
		} else if (!invuln || invuln < 0.4 || Math.floor(invuln * 8) % 2) {
			blit(SHIP, shipX - SHIP_W / 2, SHIP_Y, SHIP_COLOUR)
		}

		ctx.fillStyle = BULLET_COLOUR
		bullets.forEach(b => ctx.fillRect(b.x - 1.5, b.y - 10, 3, 10))

		ctx.fillStyle = BOMB_COLOUR
		bombs.forEach(b => ctx.fillRect(b.x - 1.5, b.y, 3, 9))

		/* Composite the glow. Constant strength frame to frame - a
		   bloom that pulsed with sprite count would be an
		   unintended flash source. */
		if (bloomCtx) {
			bloomCtx.clearRect(0, 0, W, H)
			bloomCtx.filter = 'blur(6px)'
			bloomCtx.drawImage(siCanvas, 0, 0)
			bloomCtx.filter = 'none'

			ctx.save()
			ctx.globalCompositeOperation = 'lighter'
			ctx.globalAlpha = 0.55
			ctx.drawImage(bloom, 0, 0)
			ctx.restore()
		}
	}

	const tick = now => {
		loopId = requestAnimationFrame(tick)
		// Clamp dt so a backgrounded tab cannot teleport the fleet.
		const dt = Math.min(0.05, (now - last) / 1000)
		last = now
		update(dt)
		draw()
	}

	const runLoop = () => {
		if (loopId) return
		last = performance.now()
		loopId = requestAnimationFrame(tick)
	}

	/* Never burn frames on a game nobody is looking at, and say so,
	   or a round that silently froze reads as a bug. */
	const setPaused = (value, reason) => {
		if (!running || paused === value) return

		paused = value
		pauseBtn.textContent = value ? 'Resume' : 'Pause'

		if (!value) {
			hint.hidden = true
			// runLoop restamps `last`, so the frozen time never lands as dt.
			runLoop()
			return
		}

		haltLoop()
		held.left = held.right = false
		hint.hidden = false
		hint.innerHTML =
			'<strong>Paused</strong><span>' + (reason || 'Resume when you are ready.') + '</span>'
	}

	const start = () => {
		score = 0
		wave = 1
		lives = 3
		shipX = W / 2
		invuln = 0
		bombClock = 1
		fireClock = 0
		breakClock = 0
		held.left = held.right = false
		buildFleet()
		setStats()

		hint.hidden = true
		startBtn.disabled = true
		startBtn.textContent = 'Playing…'
		pauseBtn.hidden = false
		pauseBtn.textContent = 'Pause'
		running = true
		paused = false
		runLoop()
	}

	startBtn.addEventListener('click', start)
	pauseBtn.addEventListener('click', () => setPaused(!paused))

	/* Keyboard only claims keys while a round is live, so the arrows
	   still scroll the page for everyone who is not playing. */
	const MOVE = {
		ArrowLeft: 'left',
		ArrowRight: 'right',
		a: 'left',
		A: 'left',
		d: 'right',
		D: 'right',
	}

	document.addEventListener('keydown', e => {
		if (!running) return

		// Space does nothing now the gun is automatic, but it is
		// still swallowed mid-round so the page does not jump out
		// from under you and so it cannot re-trigger a focused
		// Pause button.
		if (e.key === ' ') {
			e.preventDefault()
			return
		}

		if (e.key === 'p' || e.key === 'P') {
			e.preventDefault()
			setPaused(!paused)
			return
		}

		if (paused) return

		const action = MOVE[e.key]
		if (!action) return
		e.preventDefault()
		held[action] = true
	})

	document.addEventListener('keyup', e => {
		const action = MOVE[e.key]
		if (action) held[action] = false
	})

	/* Hold-to-move pad. Only two buttons, since the gun is automatic. */
	if (pad) {
		let padPointer = null

		const apply = el => {
			const btn = paused || !el || !el.closest ? null : el.closest('[data-si]')
			held.left = !!btn && btn.dataset.si === 'left'
			held.right = !!btn && btn.dataset.si === 'right'
		}

		pad.addEventListener('pointerdown', e => {
			if (!e.target.closest('[data-si]')) return
			e.preventDefault()
			padPointer = e.pointerId
			pad.setPointerCapture(e.pointerId)
			apply(e.target)
		})

		pad.addEventListener('pointermove', e => {
			if (e.pointerId !== padPointer) return
			// The pointer is captured, so e.target is always the pad.
			// Resolve what is really under the thumb, or sliding from
			// one button to the other leaves the first one stuck down.
			apply(document.elementFromPoint(e.clientX, e.clientY))
		})

		const release = e => {
			if (e.pointerId !== padPointer) return
			padPointer = null
			held.left = held.right = false
		}

		pad.addEventListener('pointerup', release)
		pad.addEventListener('pointercancel', release)
	}

	/* Drag anywhere on the playfield to steer. */
	let steering = false

	const steer = e => {
		const r = siCanvas.getBoundingClientRect()
		shipX = clampNum(((e.clientX - r.left) * W) / r.width, SHIP_W / 2, W - SHIP_W / 2)
	}

	siCanvas.addEventListener('pointerdown', e => {
		if (!running || paused) return
		steering = true
		siCanvas.setPointerCapture(e.pointerId)
		steer(e)
	})

	siCanvas.addEventListener('pointermove', e => {
		if (steering && running && !paused) steer(e)
	})

	const stopSteering = () => {
		steering = false
	}

	siCanvas.addEventListener('pointerup', stopSteering)
	siCanvas.addEventListener('pointercancel', stopSteering)

	document.addEventListener('visibilitychange', () => {
		if (document.hidden) setPaused(true, 'You switched away from the tab.')
	})

	if ('IntersectionObserver' in window) {
		// Auto-pause never auto-resumes. Scrolling back into view
		// does not mean you are ready for the bomb already on its way.
		new IntersectionObserver(
			entries =>
				entries.forEach(entry => {
					if (!entry.isIntersecting) setPaused(true, 'The board scrolled out of view.')
				}),
			{ threshold: 0.15 }
		).observe(siCanvas)
	}

	setStats()
	buildFleet()
	draw()
}
