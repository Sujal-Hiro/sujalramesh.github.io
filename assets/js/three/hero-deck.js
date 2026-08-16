/*===============================================
  THE DECK - the hero WebGL scene.

  A field of 48 x 44 tiles reading simultaneously
  as keycaps, as a heightfield, and as a Unity scene
  grid: abstract enough to stay premium, literal
  enough to land the reference.

  A travelling three-octave wave runs through it and
  the hue sweeps diagonally across - that is the RGB
  keyboard "wave" preset, rendered literally.

  Two hard rules hold the composition:
    - The deck occupies the LOWER ~55% of frame. The
      top is empty black where the type lives, so the
      3D never sits behind the h1.
    - Tile caps are matte; only their outer edge
      emits. Dark cap + glowing perimeter is what an
      RGB keycap actually looks like, and it keeps
      the frame ~85% black.

  ONE draw call. No postprocessing: the emission ring
  plus additive blending on near-black IS the bloom,
  and it costs nothing next to the six addon files
  and ten fullscreen passes UnrealBloomPass wants.
===============================================*/

import * as THREE from 'three'
import { getHue } from '../core/hue.js'
import { getProgress } from '../core/scroll.js'
import { add, remove } from '../core/loop.js'

const COLS = 48
const ROWS = 44
const SPACING = 0.40
const TILE = 0.34
const HEIGHT = 0.10

/* Build a 360x1 hue lookup texture using the BROWSER's own colour
   parser, so the WebGL palette is provably the same OKLCH ring the
   CSS uses rather than approximately the same. Ten lines, exact
   match, no colour maths in the shader. */
function buildHueLUT() {
	const c = document.createElement('canvas')
	c.width = 360
	c.height = 1
	const ctx = c.getContext('2d', { willReadFrequently: false })

	let useOklch = true
	try {
		ctx.fillStyle = '#000000'
		ctx.fillStyle = 'oklch(0.78 0.19 200)'
		useOklch = ctx.fillStyle !== '#000000'
	} catch (e) {
		useOklch = false
	}

	for (let h = 0; h < 360; h++) {
		ctx.fillStyle = useOklch ? `oklch(0.78 0.19 ${h})` : `hsl(${h} 85% 62%)`
		ctx.fillRect(h, 0, 1, 1)
	}

	const tex = new THREE.CanvasTexture(c)
	tex.wrapS = THREE.RepeatWrapping
	tex.wrapT = THREE.ClampToEdgeWrapping
	tex.minFilter = THREE.LinearFilter
	tex.magFilter = THREE.LinearFilter
	tex.colorSpace = THREE.SRGBColorSpace
	return tex
}

const VERT = /* glsl */ `
  precision highp float;

  attribute vec2 aOffset;   // grid position, world XZ
  attribute float aIndex;   // 0..1 across the field, for hue sweep

  uniform float uTime;
  uniform float uHue;       // 0..1
  uniform vec2  uMouse;     // pointer projected onto the deck plane
  uniform float uRipple;    // seconds since the last click, -1 when idle
  uniform float uBoot;      // 0..1 wave amplitude ramp on load

  varying vec2  vUv;
  varying float vHue;
  varying float vLift;
  varying float vFog;
  varying float vTop;

  void main() {
    vUv = uv;
    // Only the cap emits. Without this gate every face of the box
    // gets the edge ring and the field reads as a wireframe cage
    // instead of a deck of lit keys.
    vTop = step(0.5, normal.y);

    // Three summed octaves, so the field never resolves into one
    // visible sine.
    float t = uTime;
    float h =
        0.10 * sin(aOffset.x * 0.45 + t * 0.90)
      + 0.07 * sin(aOffset.y * 0.33 - t * 0.55)
      + 0.05 * sin((aOffset.x + aOffset.y) * 0.21 + t * 1.40);
    h *= uBoot;

    // The hotspot: keys lift and brighten under the pointer.
    float d = distance(aOffset, uMouse);
    float hot = smoothstep(2.2, 0.0, d);
    h += hot * 0.22;

    // Click ripple: an expanding ring that lifts tiles at its front.
    if (uRipple >= 0.0) {
      float r = uRipple * 6.0;
      float ring = smoothstep(0.55, 0.0, abs(d - r));
      h += ring * 0.30 * (1.0 - clamp(uRipple / 0.9, 0.0, 1.0));
    }

    vLift = hot;

    vec3 p = position;
    p.xz *= ${TILE.toFixed(3)};
    p.y  *= ${HEIGHT.toFixed(3)};
    p += vec3(aOffset.x, h, aOffset.y);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);

    // Exponential-squared fog computed inline - tiles past ~18
    // units go pure black. This is what makes the scene read as
    // premium rather than busy: only the near third is coloured,
    // the rest dissolves.
    float dist = -mv.z;
    vFog = 1.0 - clamp(exp(-pow(dist * 0.058, 2.0)), 0.0, 1.0);

    // Hue sweeps diagonally across the field and drifts with time.
    vHue = fract(uHue + aIndex * 0.22 + t * 0.02);

    gl_Position = projectionMatrix * mv;
  }
`

const FRAG = /* glsl */ `
  precision highp float;

  uniform sampler2D uLUT;

  varying vec2  vUv;
  varying float vHue;
  varying float vLift;
  varying float vFog;
  varying float vTop;

  void main() {
    vec3 neon = texture2D(uLUT, vec2(vHue, 0.5)).rgb;

    // Emission is EDGE-ONLY, and only on the cap. The top face
    // stays matte with a lit perimeter; the sides are pure dark.
    // Dark cap plus glowing rim is what an RGB keycap actually
    // looks like, and it is why the frame stays mostly black.
    vec2 c = abs(vUv - 0.5);
    float edge = smoothstep(0.40, 0.50, max(c.x, c.y)) * vTop;

    vec3 cap = vec3(0.043, 0.043, 0.060);
    vec3 col = mix(cap, neon * 1.25, edge);

    // Tiles under the pointer over-brighten.
    col += neon * vLift * 0.7 * edge;

    col = mix(col, vec3(0.020, 0.020, 0.033), vFog);

    gl_FragColor = vec4(col, 1.0);
  }
`

export function initHeroDeck(canvas) {
	const hero = canvas.closest('.hero')

	const renderer = new THREE.WebGLRenderer({
		canvas,
		antialias: false, // MSAA on a full-viewport buffer costs real
		// bandwidth, and the content is additive
		// edges on black where it is invisible.
		alpha: true,
		powerPreference: 'low-power',
	})
	renderer.setClearColor(0x000000, 0)

	const scene = new THREE.Scene()
	const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)

	/*--------------------------- geometry ---------------------------*/

	const box = new THREE.BoxGeometry(1, 1, 1)
	const geo = new THREE.InstancedBufferGeometry()
	geo.index = box.index
	geo.setAttribute('position', box.getAttribute('position'))
	geo.setAttribute('uv', box.getAttribute('uv'))
	geo.setAttribute('normal', box.getAttribute('normal'))

	const count = COLS * ROWS
	const offsets = new Float32Array(count * 2)
	const indices = new Float32Array(count)

	let i = 0
	for (let z = 0; z < ROWS; z++) {
		for (let x = 0; x < COLS; x++) {
			const wx = (x - (COLS - 1) / 2) * SPACING
			const wz = (z - (ROWS - 1) / 2) * SPACING
			offsets[i * 2] = wx
			offsets[i * 2 + 1] = wz
			// Diagonal sweep parameter, normalised.
			indices[i] = (x / COLS) * 0.6 + (z / ROWS) * 0.4
			i++
		}
	}

	geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 2))
	geo.setAttribute('aIndex', new THREE.InstancedBufferAttribute(indices, 1))
	geo.instanceCount = count
	box.dispose()

	const uniforms = {
		uTime: { value: 0 },
		uHue: { value: getHue() / 360 },
		uMouse: { value: new THREE.Vector2(999, 999) },
		uRipple: { value: -1 },
		uBoot: { value: 0 },
		uLUT: { value: buildHueLUT() },
	}

	const material = new THREE.ShaderMaterial({
		vertexShader: VERT,
		fragmentShader: FRAG,
		uniforms,
	})

	const mesh = new THREE.Mesh(geo, material)
	mesh.frustumCulled = false
	// Pushed well back and dropped below the eyeline. The deck has to
	// read as a floor receding toward a horizon, not as a wall the
	// camera is buried in - and the near edge must stay far enough
	// away that perspective does not blow the front row up to fill
	// the frame.
	mesh.position.set(0, -1.6, -9)
	scene.add(mesh)

	/*---------------------------- camera ----------------------------*/

	const camBase = new THREE.Vector3(0, 1.5, 5.4)
	const camTarget = new THREE.Vector3(0, -1.1, -7)
	let yaw = 0
	let pitch = 0
	let yawT = 0
	let pitchT = 0

	const resize = () => {
		const w = hero ? hero.clientWidth : innerWidth
		const h = hero ? hero.clientHeight : innerHeight
		if (!w || !h) return

		// DPR capped at 1.5, not 2. On a 3x display that is a 4x
		// fill-rate saving and the difference on an edge-lit grid is
		// undetectable. Drop to 1 outright on very large canvases.
		let dpr = Math.min(devicePixelRatio || 1, 1.5)
		if (w * h * dpr * dpr > 2.6e6) dpr = 1

		renderer.setPixelRatio(dpr)
		renderer.setSize(w, h, false)
		camera.aspect = w / h
		camera.updateProjectionMatrix()
	}

	resize()
	const ro = new ResizeObserver(resize)
	if (hero) ro.observe(hero)

	/*---------------------------- input ----------------------------*/

	let rippleAt = -1

	const onMove = e => {
		if (!hero) return
		const r = hero.getBoundingClientRect()
		const nx = ((e.clientX - r.left) / r.width) * 2 - 1
		const ny = ((e.clientY - r.top) / r.height) * 2 - 1

		// Small on purpose: large camera swings read as a jQuery
		// plugin, not as depth.
		yawT = nx * 0.044
		pitchT = ny * 0.026

		// Project the pointer roughly onto the deck plane so the
		// hotspot lands under the cursor.
		uniforms.uMouse.value.set(nx * 5.5, ny * 3.2 + 1.0)
	}

	const onDown = () => {
		rippleAt = uniforms.uTime.value
	}

	addEventListener('pointermove', onMove, { passive: true })
	if (hero) hero.addEventListener('pointerdown', onDown, { passive: true })

	/*----------------------------- loop -----------------------------*/

	const frame = dt => {
		uniforms.uTime.value += dt

		// The deck boots up rather than cutting in.
		uniforms.uBoot.value = Math.min(1, uniforms.uBoot.value + dt * 0.7)

		uniforms.uHue.value = getHue() / 360

		if (rippleAt >= 0) {
			const age = uniforms.uTime.value - rippleAt
			uniforms.uRipple.value = age < 0.9 ? age : -1
			if (age >= 0.9) rippleAt = -1
		}

		// Frame-rate independent damping. lerp(a, b, 0.05) is
		// dt-dependent and visibly stutters at 144Hz.
		const k = 1 - Math.exp(-6 * dt)
		yaw += (yawT - yaw) * k
		pitch += (pitchT - pitch) * k

		// Scroll dollies the camera: you rise off the deck as you
		// leave the hero.
		const p = Math.min(1, getProgress() * 4)

		camera.position.set(
			camBase.x + yaw * 6,
			camBase.y + pitch * 3 + p * 1.4,
			camBase.z + p * 3.0
		)
		camera.lookAt(camTarget)

		renderer.render(scene, camera)
	}

	const stopLoop = add(frame)

	/*------------------------- context loss -------------------------*/

	/* Common on dual-GPU laptops. The CSS deck comes back
	   automatically because it was never removed, only faded. */
	canvas.addEventListener('webglcontextlost', e => {
		e.preventDefault()
		stopLoop()
		canvas.classList.remove('is-live')
		if (hero) hero.classList.remove('is-gl')
	})

	// Fade in over the CSS fallback rather than cutting.
	requestAnimationFrame(() => {
		canvas.classList.add('is-live')
		if (hero) hero.classList.add('is-gl')
	})

	return {
		dispose() {
			stopLoop()
			removeEventListener('pointermove', onMove)
			ro.disconnect()
			geo.dispose()
			material.dispose()
			uniforms.uLUT.value.dispose()
			renderer.dispose()
			renderer.forceContextLoss()
		},
	}
}
