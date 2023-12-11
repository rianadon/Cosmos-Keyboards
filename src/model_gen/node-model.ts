/** Functions for modeling the keyboard from Node.js */

import loadOC from '$assets/replicad_single'
import { CaseMaterial, type ColorScheme, drawLetter, KeyMaterial } from '$lib/3d/materials'
import { boundingSize, fromGeometry } from '$lib/loaders/geometry'
import { keyGeometries } from '$lib/loaders/keycaps'
import { partGeometries } from '$lib/loaders/parts'
import { type Cuttleform, type CuttleKey, newGeometry } from '$lib/worker/config'
import { estimatedCenter } from '$lib/worker/geometry'
import { cutWithConnector, keyHoles, makePlate, makerScrewInserts, makeWalls, webSolid } from '$lib/worker/model'
import { combine } from '$lib/worker/modeling/index'
import { notNull } from '$lib/worker/util'
import { createCanvas } from 'canvas'
import fg from 'fast-glob'
import gl from 'gl'
import { createRequire } from 'module'
import { type AnyShape, setOC } from 'replicad'
import sharp from 'sharp'
import * as THREE from 'three'
import { WebGLRenderer } from 'three'

// patch require and __dirname so that opencascade can import
globalThis.__dirname = 'src/assets'
globalThis.require = createRequire(import.meta.url)

// Set socket urls
process.env.SOCKET_URLS = JSON.stringify(Object.fromEntries(
  fg.sync(['target/*.step', 'src/assets/*.step']).map(u => ['/' + u, u]),
))
process.env.GLB_URLS = JSON.stringify(Object.fromEntries(
  fg.sync(['target/*.glb', 'src/assets/*.glb']).map(u => ['/' + u, u]),
))

export async function setup() {
  // @ts-ignore
  const oc = await loadOC({
    locateFile: () => 'src/assets/replicad_single.wasm',
  })
  setOC(oc)
}

export type Part = 'walls' | 'web' | 'holes' | 'inserts' | 'plate'
type Models = Partial<Record<Part, THREE.BufferGeometry>>
const DEFAULT_PARTS: Part[] = ['walls', 'web', 'holes', 'inserts', 'plate']

export async function generate(config: Cuttleform, parts = DEFAULT_PARTS) {
  const geo = newGeometry(config)

  const components: Record<Part, () => Promise<AnyShape | undefined>> = {
    walls: async () => {
      let walls = makeWalls(config, geo.allWallCriticalPoints(), geo.worldZ, geo.bottomZ, true)
      if (config.connector) {
        walls = cutWithConnector(config, walls, config.connector, geo.connectorOrigin)
      }
      return walls
    },
    web: async () => webSolid(config, geo, false),
    holes: async () => keyHoles(config, geo.keyHolesTrsfs.flat()),
    inserts: async () => geo.screwPositions.length ? makerScrewInserts(config, geo, ['base']) : undefined,
    plate: async () => combine(Object.values(makePlate(config, geo, true, true))),
  }

  const models: Models = {}
  const center = estimatedCenter(geo)
  for (const p of parts) {
    const mesh = (await components[p]())?.mesh({ tolerance: 0.1, angularTolerance: 10 })
    models[p] = fromGeometry(mesh)
  }

  return { models, center, geo }
}

export interface RenderOptions {
  switches?: THREE.BufferGeometry[]
  keys?: THREE.BufferGeometry[]
  zoom?: number
  rotation?: number
  cameraPos?: [number, number, number]
  plate?: THREE.BufferGeometry
  color: ColorScheme
}

const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, mat: THREE.Matrix4) => {
  const m = new THREE.Mesh(geometry, material)
  mat.decompose(m.position, m.quaternion, m.scale)
  return m
}
const webglRenderer = (width: number, height: number) =>
  new WebGLRenderer({
    antialias: true,
    canvas: {
      width,
      height,
      style: {} as any,
      addEventListener() {},
      removeEventListener() {},
    } as any,
    context: gl(width, height, {
      preserveDrawingBuffer: true,
    }),
  })

function keyMaterialLetter(opacity: number, brightness: number, color: ColorScheme, key: CuttleKey) {
  const letter = 'keycap' in key ? key.keycap.letter : undefined
  const material = new KeyMaterial(0.97, 1, color)
  if (letter) {
    const canvas: HTMLCanvasElement = createCanvas(512, 512) as any
    drawLetter(canvas, letter, false)
    material.uniforms.tLetter.value = new THREE.CanvasTexture(canvas)
  }
  return material
}

async function assembleGroup(config: Cuttleform, parts = DEFAULT_PARTS, opts: RenderOptions) {
  const { models, center, geo } = await generate(config, parts)
  const keys = await keyGeometries(geo.keyHolesTrsfs, config.keys)
  const switches = await partGeometries(geo.keyHolesTrsfs, config.keys)

  const group = new THREE.Group()
  const mat = new THREE.Matrix4().makeTranslation(-center[0], -center[1], -center[2]).premultiply(new THREE.Matrix4().makeRotationZ(opts.rotation ?? 0))
  mat.decompose(group.position, group.quaternion, group.scale)

  if (models.holes) group.add(new THREE.Mesh(models.holes, new CaseMaterial(1, 1, opts.color)))
  if (models.web) group.add(new THREE.Mesh(models.web, new CaseMaterial(1, 1, opts.color)))
  if (models.walls) group.add(new THREE.Mesh(models.walls, new CaseMaterial(1, 1, opts.color)))
  if (models.plate) group.add(new THREE.Mesh(models.plate, new KeyMaterial(1, 1, opts.color)))
  group.add(
    ...keys.map(k => mesh(k.geometry, keyMaterialLetter(0.99, 1, opts.color, k.key), k.matrix)),
    ...switches.map(k => mesh(k.geometry, new KeyMaterial(1, 0.7, opts.color), k.matrix)),
  )
  return { group, zoomModels: [models.holes, models.web] }
}

export async function render(config: Cuttleform, parts = DEFAULT_PARTS, width = 500, height = 500, opts: RenderOptions) {
  const { group, zoomModels } = await assembleGroup(config, parts, opts)
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

export function modelZoom(models: (THREE.BufferGeometry | undefined)[], aspect: number) {
  const size = boundingSize(notNull(models))
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
