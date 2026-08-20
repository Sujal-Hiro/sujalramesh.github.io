/*===============================================
  The hero object.

  One photoreal gamepad, lit like a product shot,
  turning slowly. That is the entire 3D on the site.

  The restraint is the point. The previous version
  had a full-page neon deck and 150 drifting
  crystals; this has one object, correctly lit, with
  room around it - which reads as considered rather
  than as a demo.

  Model: "Gamepad" by Josh Dean, CC0, polyhaven.com
  1k textures, ~1.3 MB, loaded only after every gate
  in can3D() passes.
===============================================*/

import * as THREE from 'three'
import { GLTFLoader } from '../../lib/three/addons/loaders/GLTFLoader.js'
import { RoomEnvironment } from '../../lib/three/addons/environments/RoomEnvironment.js'
import { add } from '../core/loop.js'

const MODEL = './assets/models/gamepad/gamepad_1k.gltf'

/* A soft elliptical contact shadow. Without something under it the
   object reads as pasted on rather than sitting in the scene, and a
   real shadow map on a single floating object is not worth the
   depth pass. */
const SHADOW_FRAG = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = smoothstep(1.0, 0.15, d);
    gl_FragColor = vec4(0.09, 0.08, 0.06, a * 0.40);
  }
`

const SHADOW_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export function initGamepad(canvas) {
	const host = canvas.closest('.hero__object') || canvas.parentElement

	const renderer = new THREE.WebGLRenderer({
		canvas,
		alpha: true,
		antialias: true, // one small object on a light ground: silhouette
		// quality is the whole job, so MSAA earns its cost here
	})
	renderer.setClearColor(0x000000, 0)
	renderer.outputColorSpace = THREE.SRGBColorSpace
	// Without tone mapping the plastic highlights clip to flat white
	// and the model looks like a screenshot of a model.
	renderer.toneMapping = THREE.ACESFilmicToneMapping
	renderer.toneMappingExposure = 0.98

	const scene = new THREE.Scene()
	const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
	camera.position.set(0, 0, 6)

	/* Image-based lighting from a generated room. This is what makes
	   the plastic read as plastic - a couple of point lights would
	   give flat highlights and no sense of a surrounding space, and
	   an HDR file would be another megabyte on the wire. */
	const pmrem = new THREE.PMREMGenerator(renderer)
	scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

	// A single key light for direction, so the form has a clear
	// light side and shadow side rather than sitting in flat ambient.
	const key = new THREE.DirectionalLight(0xffffff, 2.6)
	key.position.set(2.5, 3.5, 2)
	scene.add(key)

	const fill = new THREE.DirectionalLight(0xffffff, 0.45)
	fill.position.set(-3, 0.5, -1.5)
	scene.add(fill)

	/*--------------------------- shadow ---------------------------*/

	const shadow = new THREE.Mesh(
		new THREE.PlaneGeometry(3.2, 3.2),
		new THREE.ShaderMaterial({
			vertexShader: SHADOW_VERT,
			fragmentShader: SHADOW_FRAG,
			transparent: true,
			depthWrite: false,
		})
	)
	shadow.rotation.x = -Math.PI / 2
	shadow.position.y = -1.35
	scene.add(shadow)

	/*---------------------------- model ----------------------------*/

	const pivot = new THREE.Group()
	scene.add(pivot)

	let loaded = false

	new GLTFLoader().load(
		MODEL,
		gltf => {
			const model = gltf.scene

			// Centre on its own bounds and scale to a known height, so
			// the framing does not depend on how the asset was authored.
			const box = new THREE.Box3().setFromObject(model)
			const size = box.getSize(new THREE.Vector3())
			const centre = box.getCenter(new THREE.Vector3())
			const scale = 3.6 / Math.max(size.x, size.y, size.z)

			model.position.sub(centre)
			model.scale.setScalar(scale)

			pivot.add(model)
			pivot.rotation.x = 0.34 // tipped toward the viewer
			loaded = true

			canvas.classList.add('is-live')
			if (host) host.classList.add('is-loaded')
		},
		undefined,
		() => {
			// Missing or corrupt asset. The plotted contour stays and
			// the column still reads as intentional.
			canvas.remove()
		}
	)

	/*---------------------------- resize ----------------------------*/

	const resize = () => {
		const w = host ? host.clientWidth : canvas.clientWidth
		const h = host ? host.clientHeight : canvas.clientHeight
		if (!w || !h) return
		renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2))
		renderer.setSize(w, h, false)
		camera.aspect = w / h
		camera.updateProjectionMatrix()
	}

	resize()
	const ro = new ResizeObserver(resize)
	if (host) ro.observe(host)

	/*----------------------------- input -----------------------------*/

	let targetX = 0
	let targetY = 0

	const onMove = e => {
		// Viewport-relative, so the object acknowledges the cursor
		// anywhere on the page rather than only directly over it.
		targetY = (e.clientX / innerWidth - 0.5) * 0.6
		targetX = (e.clientY / innerHeight - 0.5) * 0.3
	}

	addEventListener('pointermove', onMove, { passive: true })

	/*------------------------------ loop ------------------------------*/

	/* Only render while the object is actually on screen. It lives in
	   the hero, so this is idle for the whole rest of the page. */
	let visible = true
	if (host && 'IntersectionObserver' in window) {
		new IntersectionObserver(
			entries => entries.forEach(e => (visible = e.isIntersecting)),
			{ threshold: 0 }
		).observe(host)
	}

	let spin = 0

	add(dt => {
		if (!visible || !loaded) return

		spin += dt * 0.18 // a full turn every ~35s

		// Frame-rate independent damping. lerp(a, b, 0.05) is
		// dt-dependent and stutters at 144Hz.
		const k = 1 - Math.exp(-4 * dt)
		pivot.rotation.y += (spin + targetY - pivot.rotation.y) * k
		pivot.rotation.x += (0.34 + targetX - pivot.rotation.x) * k

		renderer.render(scene, camera)
	})

	canvas.addEventListener('webglcontextlost', e => {
		e.preventDefault()
		canvas.classList.remove('is-live')
	})
}
