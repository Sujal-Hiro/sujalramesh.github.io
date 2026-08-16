/*===============================================
  20-second target rush.

  Targets are real <button>s, so the game is
  playable with Tab + Enter and not just a mouse.

  Ported unchanged apart from the hit burst, which
  is the game-feel detail the rest of the redesign
  earns.
===============================================*/

export function initTargetRush() {
	const board = document.getElementById('gameBoard')
	if (!board) return

	const startBtn = document.getElementById('gameStart')
	const scoreEl = document.getElementById('gameScore')
	const timeEl = document.getElementById('gameTime')
	const bestEl = document.getElementById('gameBest')
	const hint = document.getElementById('gameHint')

	const ROUND = 20
	const BEST_KEY = 'sr-game-best'

	let score = 0
	let left = ROUND
	let best = 0
	try {
		best = Number(localStorage.getItem(BEST_KEY)) || 0
	} catch (e) {
		/* storage unavailable; best stays session-only */
	}

	let tickId = null
	let spawnId = null
	let running = false

	bestEl.textContent = String(best)

	const rand = (min, max) => min + Math.random() * (max - min)

	const clearTargets = () =>
		board.querySelectorAll('.target, .floater, .burst').forEach(el => el.remove())

	const floater = (text, x, y, bonus) => {
		const f = document.createElement('span')
		f.className = 'floater' + (bonus ? ' is-bonus' : '')
		f.textContent = text
		f.style.left = `${x}px`
		f.style.top = `${y}px`
		board.append(f)
		setTimeout(() => f.remove(), 600)
	}

	const burst = (x, y, bonus) => {
		const b = document.createElement('span')
		b.className = 'burst' + (bonus ? ' is-bonus' : '')
		b.style.left = `${x}px`
		b.style.top = `${y}px`
		board.append(b)
		setTimeout(() => b.remove(), 320)
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
			burst(x, y, bonus)
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
			try {
				localStorage.setItem(BEST_KEY, String(best))
			} catch (e) {
				/* nothing to persist to */
			}
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
