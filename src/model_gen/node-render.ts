// @ts-nocheck Unmaintained file

import { CaseMaterial, COLORCONFIG, type ColorScheme, drawLetter, FRAGMENT_SHADER, KeyMaterial, VERTEX_SHADER } from '$lib/3d/materials'
import { boundingSize, fromGeometry } from '$lib/loaders/geometry'
import { keyGeometries } from '$lib/loaders/keycaps'
import { partGeometries } from '$lib/loaders/parts'
import type { Cuttleform, CuttleKey } from '$lib/worker/config'
import { notNull } from '$lib/worker/util'
import { readFileSync } from 'fs'
import { GLTFExporter } from 'node-three-gltf'
import { chromium, type Page } from 'playwright'
import sharp from 'sharp'
import * as THREE from 'three'
import { fileURLToPath } from 'url'
import { DEFAULT_PARTS, generate } from './node-model'

export async function assembleGroup(window: Window, config: Cuttleform, parts = DEFAULT_PARTS, opts: RenderOptions) {
  console.log(config)

  const group = new THREE.Group()
  const mat = new THREE.Matrix4().makeTranslation(-center[0], -center[1], -center[2]).premultiply(new THREE.Matrix4().makeRotationZ(opts.rotation ?? 0))
  mat.decompose(group.position, group.quaternion, group.scale)

  if (models.holes) group.add(new THREE.Mesh(models.holes, new CaseMaterial(1, 1, opts.color)))
  if (models.web) group.add(new THREE.Mesh(models.web, new CaseMaterial(1, 1, opts.color)))
  if (models.walls) group.add(new THREE.Mesh(models.walls, new CaseMaterial(1, 1, opts.color)))
  if (models.plate) group.add(new THREE.Mesh(models.plate, new KeyMaterial(1, 1, opts.color)))
  group.add(
    ...keys.map(k => mesh(k.geometry, keyMaterialLetter(window, 0.99, 1, opts.color, k.key), k.matrix)),
    ...switches.map(k => mesh(k.geometry, new KeyMaterial(1, 0.7, opts.color), k.matrix)),
  )
  return { group, zoomModels: [models.holes, models.web] }
}

const webglRenderer = (width: number, height: number) =>
  new THREE.WebGLRenderer({
    antialias: true,
    canvas: document.createElement('canvas'),
  })

export interface RenderOptions {
  switches?: THREE.BufferGeometry[]
  keys?: THREE.BufferGeometry[]
  zoom?: number
  rotation?: number
  cameraPos?: [number, number, number]
  plate?: THREE.BufferGeometry
  color: ColorScheme
}

export async function render(config: Cuttleform, parts = DEFAULT_PARTS, width = 500, height = 500, opts: RenderOptions) {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  const { models, center, geo } = await generate(config, parts)
  const keys = await keyGeometries(geo.keyHolesTrsfs, config.keys)
  const switches = await partGeometries(geo.keyHolesTrsfs, config.keys, false)
  const data = { models, center, geo, keys, switches }
  await page.evaluate(async (dat: typeof data) => {
    console.log(models)

    const zoom = opts.zoom ?? modelZoom(zoomModels, width / height)
    const cameraPos = opts.cameraPos ?? [0, 0.8, 1]

    const camera = new THREE.PerspectiveCamera(50, width / height, 1, 1000)
    const scene = new THREE.Scene()
    const renderer = webglRenderer(width, height)

    camera.position.set(...cameraPos).normalize().multiplyScalar(zoom)
    camera.lookAt(new THREE.Vector3(0, 0, 0))
    const viewport = new THREE.Group()
    viewport.rotation.set(-Math.PI / 2, 0, 0)
    scene.add(viewport)

    viewport.add(group)
    renderer.render(scene, camera)
    return extractPixels(renderer.getContext())
  }, data)
}

export async function renderMulti(configs: Cuttleform[], parts = DEFAULT_PARTS, width = 500, height = 500, opts: RenderOptions) {
  const results = await Promise.all(configs.map(c => assembleGroup(c, parts, opts)))
  const groups = results.map(r => r.group)
  const avgTranslation = groups
    .reduce((a, b) => a.add(b.position), new THREE.Vector3())
    .divideScalar(groups.length)
  groups.forEach(g => g.position.copy(avgTranslation))
  if (!opts.zoom) throw new Error('Zoom required')
  const cameraPos = opts.cameraPos ?? [0, 0.8, 1]

  const camera = new THREE.PerspectiveCamera(50, width / height, 1, 1000)
  const scene = new THREE.Scene()
  const renderer = webglRenderer(width, height)

  camera.position.set(...cameraPos).normalize().multiplyScalar(opts.zoom)
  camera.lookAt(new THREE.Vector3(0, 0, 0))
  const viewport = new THREE.Group()
  viewport.rotation.set(-Math.PI / 2, 0, 0)
  scene.add(viewport)

  viewport.add(...groups)
  renderer.render(scene, camera)
  return extractPixels(renderer.getContext())
}

const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, mat: THREE.Matrix4) => {
  const m = new THREE.Mesh(geometry, material)
  mat.decompose(m.position, m.quaternion, m.scale)
  return m
}
function keyMaterialLetter(window: Window, opacity: number, brightness: number, color: ColorScheme, key: CuttleKey) {
  const letter = 'keycap' in key && key.keycap ? key.keycap.letter : undefined
  const material = new KeyMaterial(0.97, 1, color)
  if (letter) {
    const canvas: HTMLCanvasElement = new window.OffscreenCanvas(512, 512) as any
    drawLetter(canvas, letter, false)
    material.uniforms.tLetter.value = new THREE.CanvasTexture(canvas)
  }
  return material
}

export function modelZoom(models: (THREE.BufferGeometry | undefined)[], aspect: number) {
  const size = boundingSize(notNull(models))
  const fov = 50 * (Math.PI / 180)
  const fovh = 2 * Math.atan(Math.tan(fov / 2) * aspect)
  let dx = size.z / 2 + Math.abs(size.x / 2 / Math.tan(fovh / 2))
  let dy = size.z / 2 + Math.abs(size.y / 2 / Math.tan(fov / 2))
  return Math.max(dx, dy) * 1.2
}

export function zoomForSize(size: THREE.Vector3, aspect: number) {
  const fov = 50 * (Math.PI / 180)
  const fovh = 2 * Math.atan(Math.tan(fov / 2) * aspect)
  let dx = size.z / 2 + Math.abs(size.x / 2 / Math.tan(fovh / 2))
  let dy = size.z / 2 + Math.abs(size.y / 2 / Math.tan(fov / 2))
  return Math.max(dx, dy) * 1.2
}

function extractPixels(context: WebGLRenderingContext | WebGL2RenderingContext) {
  const width = context.drawingBufferWidth
  const height = context.drawingBufferHeight
  const frameBufferPixels = new Uint8Array(width * height * 4)
  context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, frameBufferPixels)
  return sharp(frameBufferPixels, { raw: { width, height, channels: 4 } }).flip()
}

export async function createRenderPage() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.route('https://ryanis.cool/**', route => {
    let url = route.request().url().substring(19)
    if (url == '/three.js') url = '/three/build/three.module.js'
    route.fulfill({
      contentType: 'text/javascript',
      body: readFileSync(fileURLToPath(new URL('../../node_modules' + url, import.meta.url))),
    })
  })

  await page.addScriptTag({
    content: JSON.stringify({
      imports: { three: 'https://ryanis.cool/three.js', 'three/': 'https://ryanis.cool/three/' },
    }),
    type: 'importmap',
  })

  return { page, browser }
}

interface RenderOpts {
  width: number
  height: number
}

export async function renderGLTF(gltf: ArrayBuffer, page: Page, options: RenderOpts) {
  const opts = { COLORCONFIG, FRAGMENT_SHADER, VERTEX_SHADER }

  const url = await page.evaluate(
    async (args) => {
      const [g, width, height, opts] = args
      const THREE = await import('three')
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')

      const { COLORCONFIG, FRAGMENT_SHADER, VERTEX_SHADER } = opts
      function cosmosMaterial(kind: 'key' | 'case', opts: { opacity?: number; brightness?: number; texture?: THREE.Texture } = {}) {
        const saturation = COLORCONFIG.purple[(kind + 'Saturation') as 'keySaturation']
        const color = COLORCONFIG.purple[(kind + 'Color') as 'keyColor']

        return new THREE.ShaderMaterial({
          fragmentShader: FRAGMENT_SHADER,
          vertexShader: VERTEX_SHADER,
          uniforms: {
            uOpacity: { value: opts.opacity || 1 },
            uBrightness: { value: opts.brightness || 1 },
            uSaturation: { value: saturation },
            uAmbient: { value: 0.8 },
            uColor: { value: color },
            tLetter: { value: opts.texture },
          },
        })
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      // Patch getContext() in canvas so that the drawing buffer is preserved
      // This allows us to screenshot the canvas after it is rendered
      const origFn = canvas.getContext
      // @ts-ignore
      canvas.getContext = function(type, attributes) {
        if (type === 'webgl' || type === 'webgl2') {
          attributes = Object.assign({}, attributes, {
            preserveDrawingBuffer: true,
          })
        }
        return origFn.call(this, type, attributes)
      }

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        canvas: canvas, // new OffscreenCanvas(width, height),
      })
      renderer.setClearColor(0x000000, 0)

      const loader = new GLTFLoader()
      const { scene, cameras } = await loader.parseAsync(g, 'model.gltf')
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshBasicMaterial) {
          if (object.material.color.equals(new THREE.Color('pink'))) {
            object.material = cosmosMaterial('key')
          }
        }
      })

      renderer.render(scene, cameras[0])
      return canvas.toDataURL()
    },
    [gltf, options.width, options.height, opts] as const,
  )
  return {
    dataURL: url,
    data: dataURLToData(url),
  }
}

export function dataURLToData(url: string) {
  return Buffer.from(url.replace(/^data:image\/\w+;base64,/, ''), 'base64')
}

export async function renderScene(scene: THREE.Scene, camera: THREE.Camera, page: Page, options: RenderOpts) {
  const exporter = new GLTFExporter()
  const gltf = await exporter.parseAsync([scene, camera])
  return await renderGLTF(gltf, page, options)
}

export async function mergeDataURLs(urls: string[], page: Page, options: RenderOpts) {
  return await page.evaluate(async ([images, options]) => {
    const canvas = document.createElement('canvas')
    const n = Math.floor(Math.sqrt(images.length))
    const m = Math.ceil(images.length / n)
    canvas.width = options.width * n
    canvas.height = options.height * m

    const imageData = await Promise.all(images.map(i =>
      new Promise<HTMLImageElement>(r => {
        let img = new Image()
        img.onload = () => r(img)
        img.src = i
      })
    ))

    const ctx = canvas.getContext('2d')!
    images.forEach((u, i) => {
      ctx.drawImage(imageData[i], options.width * (i % n), options.height * Math.floor(i / n))
    })

    return canvas.toDataURL()
  }, [urls, options] as const)
}
