import { CaseMaterial, type ColorScheme, drawLetter, KeyMaterial } from '$lib/3d/materials'
import { boundingSize, fromGeometry } from '$lib/loaders/geometry'
import { keyGeometries } from '$lib/loaders/keycaps'
import { partGeometries } from '$lib/loaders/parts'
import type { Cuttleform, CuttleKey } from '$lib/worker/config'
import { notNull } from '$lib/worker/util'
import { createCanvas } from 'canvas'
import gl from 'gl'
import sharp from 'sharp'
import * as THREE from 'three'
import { DEFAULT_PARTS, generate } from './node-model'

export async function assembleGroup(config: Cuttleform, parts = DEFAULT_PARTS, opts: RenderOptions) {
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

const webglRenderer = (width: number, height: number) =>
  new THREE.WebGLRenderer({
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

const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, mat: THREE.Matrix4) => {
  const m = new THREE.Mesh(geometry, material)
  mat.decompose(m.position, m.quaternion, m.scale)
  return m
}
function keyMaterialLetter(opacity: number, brightness: number, color: ColorScheme, key: CuttleKey) {
  const letter = 'keycap' in key && key.keycap ? key.keycap.letter : undefined
  const material = new KeyMaterial(0.97, 1, color)
  if (letter) {
    const canvas: HTMLCanvasElement = createCanvas(512, 512) as any
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

function extractPixels(context: WebGLRenderingContext | WebGL2RenderingContext) {
  const width = context.drawingBufferWidth
  const height = context.drawingBufferHeight
  const frameBufferPixels = new Uint8Array(width * height * 4)
  context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, frameBufferPixels)
  return sharp(frameBufferPixels, { raw: { width, height, channels: 4 } }).flip()
}
