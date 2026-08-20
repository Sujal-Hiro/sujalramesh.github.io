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
import { GLTFLoader } from '../../lib/three/addons/loaders/GLTFLoader.js?v=6'
import { add } from '../core/loop.js?v=6'

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
	/* Everything lives in flat typed arrays.

	   The obvious version allocates a Vector3 per corner, a Triangle
	   to call getArea(), and an object per triangle. On a model with
	   tens of thousands of triangles that is hundreds of thousands of
	   short-lived objects, and the GC pressure alone pushed the hero
	   load into seconds. Flat arrays and inline maths make it
	   effectively instant. */
	const meshes = []
	let triCount = 0

	root.updateWorldMatrix(true, true)
	root.traverse(node => {
		if (!node.isMesh || !node.geometry) return
		const geo = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry
		if (!geo.getAttribute('position')) return
		meshes.push({ geo, m: node.matrixWorld })
		triCount += Math.floor(geo.getAttribute('position').count / 3)
	})

	if (!triCount) return null

	const tri = new Float32Array(triCount * 9) // 3 corners xyz
	const triN = new Float32Array(triCount * 3) // one normal per tri
	const cum = new Float64Array(triCount)

	const v = new THREE.Vector3()
	const n = new THREE.Vector3()
	let t = 0
	let total = 0

	for (const { geo, m } of meshes) {
		const pos = geo.getAttribute('position')
		const nor = geo.getAttribute('normal')

		for (let i = 0; i + 2 < pos.count; i += 3) {
			const o = t * 9
			for (let k = 0; k < 3; k++) {
				v.fromBufferAttribute(pos, i + k).applyMatrix4(m)
				tri[o + k * 3] = v.x
				tri[o + k * 3 + 1] = v.y
				tri[o + k * 3 + 2] = v.z
			}

			// Cross product of two edges; half its length is the area.
			const ax = tri[o + 3] - tri[o]
			const ay = tri[o + 4] - tri[o + 1]
			const az = tri[o + 5] - tri[o + 2]
			const bx = tri[o + 6] - tri[o]
			const by = tri[o + 7] - tri[o + 1]
			const bz = tri[o + 8] - tri[o + 2]
			const cx = ay * bz - az * by
			const cy = az * bx - ax * bz
			const cz = ax * by - ay * bx
			total += 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz)
			cum[t] = total

			if (nor) {
				n.fromBufferAttribute(nor, i).transformDirection(m)
				triN[t * 3] = n.x
				triN[t * 3 + 1] = n.y
				triN[t * 3 + 2] = n.z
			} else {
				triN[t * 3 + 1] = 1
			}
			t++
		}
	}

	if (!(total > 0)) return null

	const positions = new Float32Array(count * 3)
	const normals = new Float32Array(count * 3)
	const rands = new Float32Array(count)

	for (let i = 0; i < count; i++) {
		const target = Math.random() * total

		// Binary search the cumulative-area table: a triangle ten
		// times larger takes ten times the dots.
		let lo = 0
		let hi = t - 1
		while (lo < hi) {
			const mid = (lo + hi) >> 1
			if (cum[mid] < target) lo = mid + 1
			else hi = mid
		}

		const o = lo * 9

		// Uniform barycentric sampling. The fold is what keeps points
		// from piling into one corner of the triangle.
		let u = Math.random()
		let w = Math.random()
		if (u + w > 1) {
			u = 1 - u
			w = 1 - w
		}

		const p = i * 3
		positions[p] = tri[o] + u * (tri[o + 3] - tri[o]) + w * (tri[o + 6] - tri[o])
		positions[p + 1] = tri[o + 1] + u * (tri[o + 4] - tri[o + 1]) + w * (tri[o + 7] - tri[o + 1])
		positions[p + 2] = tri[o + 2] + u * (tri[o + 5] - tri[o + 2]) + w * (tri[o + 8] - tri[o + 2])

		normals[p] = triN[lo * 3]
		normals[p + 1] = triN[lo * 3 + 1]
		normals[p + 2] = triN[lo * 3 + 2]

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
