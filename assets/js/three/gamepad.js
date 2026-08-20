/*===============================================
  The hero object, as a point cloud.

  The gamepad is not rendered as a surface. Its
  geometry is sampled into ~110,000 dots and drawn as
  phosphor points, so the object reads as a 3D scan
  resolving out of the dark rather than as a product
  render.

  Two decisions carry it:

  1. AREA-WEIGHTED SAMPLING, not vertices. A model's
     vertices bunch wherever it was detailed - around
     buttons and bevels - and leave flat panels almost
     bare. Sampling points across triangle surfaces,
     weighted by area, gives an even cloud that
     describes the whole form.

  2. ONE HUE, brightness does the work. Each dot is
     lit by a fake normal-dot-light term, so the form
     has a light side and a shadow side using nothing
     but values of the same green.

  One draw call. A scan band sweeps the object every
  few seconds - the only motion besides the turn.

  Model: "Gamepad" by Josh Dean, CC0, polyhaven.com
===============================================*/

import * as THREE from 'three'
import { GLTFLoader } from '../../lib/three/addons/loaders/GLTFLoader.js'
import { add } from '../core/loop.js'

const MODEL = './assets/models/gamepad/gamepad_1k.gltf'
const POINTS = 110000

const VERT = /* glsl */ `
  precision highp float;

  attribute float aRand;

  uniform float uTime;
  uniform float uScan;
  uniform float uSize;

  varying float vShade;
  varying float vScan;
  varying float vRand;

  void main() {
    vRand = aRand;

    // Fake key light. One dot product is enough to give the cloud a
    // lit side and a shadow side, which is what stops a point cloud
    // reading as flat noise.
    vec3 L = normalize(vec3(0.55, 0.75, 0.5));
    vShade = clamp(dot(normalize(normal), L) * 0.5 + 0.5, 0.0, 1.0);

    vec4 mv = modelViewMatrix * vec4(position, 1.0);

    // The scan band: a horizontal sweep in object space that
    // brightens dots as it crosses them.
    vScan = smoothstep(0.16, 0.0, abs(position.y - uScan));

    // Perspective-correct dot size, plus a small per-dot variance
    // so the cloud has grain instead of looking machine-printed.
    //
    // The 9.0 is calibrated to this camera: the object sits ~6 units
    // out, so this yields ~2px dots. A larger constant merges every
    // dot into a solid blob - the cloud only reads as a cloud while
    // the dots stay separable.
    float size = uSize * (0.72 + aRand * 0.55) * (1.0 + vScan * 1.4);
    gl_PointSize = size * (9.0 / -mv.z);

    gl_Position = projectionMatrix * mv;
  }
`

const FRAG = /* glsl */ `
  precision highp float;

  uniform vec3 uColor;
  uniform vec3 uHot;
  uniform float uTime;

  varying float vShade;
  varying float vScan;
  varying float vRand;

  void main() {
    // Round dots. Without this every point is a hard square and the
    // cloud looks like a spreadsheet.
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c);
    if (d > 0.25) discard;
    float edge = smoothstep(0.25, 0.06, d);

    // A slow, tiny per-dot flicker. Phosphor is never perfectly
    // steady, and this is far below the rate anything could read as
    // strobing.
    float flick = 0.92 + 0.08 * sin(uTime * 1.6 + vRand * 40.0);

    float lum = (0.14 + vShade * 1.05) * flick;
    vec3 col = mix(uColor * lum, uHot, vScan * 0.75);

    gl_FragColor = vec4(col, edge * (0.35 + vShade * 0.65));
  }
`

/* Area-weighted surface sampling.

   Walks every triangle, builds a cumulative area table, then draws
   points with a binary search into it - so a triangle ten times
   larger receives ten times the dots. Uniform barycentric sampling
   inside each triangle (the sqrt is what keeps points from
   clustering at one corner). */
function sampleSurface(root, count) {
	const tris = []
	let total = 0

	const pA = new THREE.Vector3()
	const pB = new THREE.Vector3()
	const pC = new THREE.Vector3()

	root.updateWorldMatrix(true, true)

	root.traverse(node => {
		if (!node.isMesh || !node.geometry) return
		const geo = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry
		const pos = geo.getAttribute('position')
		const nor = geo.getAttribute('normal')
		if (!pos) return

		for (let i = 0; i < pos.count; i += 3) {
			pA.fromBufferAttribute(pos, i).applyMatrix4(node.matrixWorld)
			pB.fromBufferAttribute(pos, i + 1).applyMatrix4(node.matrixWorld)
			pC.fromBufferAttribute(pos, i + 2).applyMatrix4(node.matrixWorld)

			const area = new THREE.Triangle(pA, pB, pC).getArea()
			if (!(area > 0)) continue
			total += area

			tris.push({
				a: pA.clone(),
				b: pB.clone(),
				c: pC.clone(),
				n: nor
					? new THREE.Vector3().fromBufferAttribute(nor, i).transformDirection(node.matrixWorld)
					: new THREE.Vector3(0, 1, 0),
				cum: total,
			})
		}
	})

	if (!tris.length) return null

	const positions = new Float32Array(count * 3)
	const normals = new Float32Array(count * 3)
	const rands = new Float32Array(count)

	for (let i = 0; i < count; i++) {
		const target = Math.random() * total

		let lo = 0
		let hi = tris.length - 1
		while (lo < hi) {
			const mid = (lo + hi) >> 1
			if (tris[mid].cum < target) lo = mid + 1
			else hi = mid
		}
		const t = tris[lo]

		let u = Math.random()
		let v = Math.random()
		if (u + v > 1) {
			u = 1 - u
			v = 1 - v
		}

		positions[i * 3] = t.a.x + u * (t.b.x - t.a.x) + v * (t.c.x - t.a.x)
		positions[i * 3 + 1] = t.a.y + u * (t.b.y - t.a.y) + v * (t.c.y - t.a.y)
		positions[i * 3 + 2] = t.a.z + u * (t.b.z - t.a.z) + v * (t.c.z - t.a.z)

		normals[i * 3] = t.n.x
		normals[i * 3 + 1] = t.n.y
		normals[i * 3 + 2] = t.n.z

		rands[i] = Math.random()
	}

	const geo = new THREE.BufferGeometry()
	geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
	geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
	geo.setAttribute('aRand', new THREE.BufferAttribute(rands, 1))
	return geo
}

export function initGamepad(canvas) {
	const host = canvas.closest('.hero__object') || canvas.parentElement

	const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false })
	renderer.setClearColor(0x000000, 0)

	const scene = new THREE.Scene()
	const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
	camera.position.set(0, 0, 6)

	const uTime = { value: 0 }
	const uScan = { value: -10 }
	const uSize = { value: 1.5 }
	const uColor = { value: new THREE.Color(0x4ee08a) }
	const uHot = { value: new THREE.Color(0xd8ffe8) }

	const material = new THREE.ShaderMaterial({
		vertexShader: VERT,
		fragmentShader: FRAG,
		uniforms: { uTime, uScan, uSize, uColor, uHot },
		transparent: true,
		// Additive would blow out where the cloud is dense on the far
		// side; normal blending keeps the silhouette readable.
		depthWrite: false,
	})

	const pivot = new THREE.Group()
	scene.add(pivot)

	let loaded = false
	let bounds = 1

	new GLTFLoader().load(
		MODEL,
		gltf => {
			const box = new THREE.Box3().setFromObject(gltf.scene)
			const size = box.getSize(new THREE.Vector3())
			const centre = box.getCenter(new THREE.Vector3())
			const scale = 4.3 / Math.max(size.x, size.y, size.z)

			gltf.scene.position.sub(centre)
			gltf.scene.scale.setScalar(scale)

			const geo = sampleSurface(gltf.scene, POINTS)
			if (!geo) {
				canvas.remove()
				return
			}

			geo.computeBoundingBox()
			bounds = geo.boundingBox.max.y

			pivot.add(new THREE.Points(geo, material))
			pivot.rotation.x = 0.3
			loaded = true

			canvas.classList.add('is-live')
			if (host) host.classList.add('is-loaded')
		},
		undefined,
		() => canvas.remove()
	)

	/*---------------------------- resize ----------------------------*/

	const resize = () => {
		const w = host ? host.clientWidth : canvas.clientWidth
		const h = host ? host.clientHeight : canvas.clientHeight
		if (!w || !h) return
		const dpr = Math.min(devicePixelRatio || 1, 2)
		renderer.setPixelRatio(dpr)
		renderer.setSize(w, h, false)
		// Dots are sized in device pixels, so without this they halve
		// on a retina screen and the cloud goes thin.
		uSize.value = 1.5 * dpr
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
		targetY = (e.clientX / innerWidth - 0.5) * 0.7
		targetX = (e.clientY / innerHeight - 0.5) * 0.35
	}

	addEventListener('pointermove', onMove, { passive: true })

	/*------------------------------ loop ------------------------------*/

	let visible = true
	if (host && 'IntersectionObserver' in window) {
		new IntersectionObserver(
			entries => entries.forEach(e => (visible = e.isIntersecting)),
			{ threshold: 0 }
		).observe(host)
	}

	let spin = 0
	let scanClock = 0

	add(dt => {
		if (!visible || !loaded) return

		uTime.value += dt
		spin += dt * 0.16

		// Sweep up through the object, then wait. A continuous scan
		// would be a barber pole; the pause is what makes it read as
		// a scan.
		scanClock += dt
		const CYCLE = 6.5
		const p = (scanClock % CYCLE) / CYCLE
		uScan.value = p < 0.55 ? -bounds + (p / 0.55) * (bounds * 2.2) : -10

		const k = 1 - Math.exp(-4 * dt)
		pivot.rotation.y += (spin + targetY - pivot.rotation.y) * k
		pivot.rotation.x += (0.3 + targetX - pivot.rotation.x) * k

		renderer.render(scene, camera)
	})

	canvas.addEventListener('webglcontextlost', e => {
		e.preventDefault()
		canvas.classList.remove('is-live')
	})
}
