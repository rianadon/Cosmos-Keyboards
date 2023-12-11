/** Functions for modeling the keyboard from Node.js */

import loadOC from '$assets/replicad_single'
import type { Cuttleform, CuttleKey } from '$lib/worker/config'
import { allKeyCriticalPoints, allWallCriticalPoints, connectorOrigin, estimatedCenter, keyHolesTrsfs, screwPositions } from '$lib/worker/geometry'
import { combine, cutWithConnector, joinWalls, keyHoles, makeConnector, makePlate, wallSurfaces, webSolid } from '$lib/worker/model'
import { readFile } from 'fs/promises'
import gl from 'gl'
import { cast, getOC, setOC, Solid } from 'replicad'
import sharp from 'sharp'
import * as THREE from 'three'

// patch require and __dirname so that opencascade can import
globalThis.__dirname = 'src/assets'
import { CaseMaterial, KeyMaterial } from '$lib/3d/materials'
import { boundingSize } from '$lib/loaders/geometry'
import Trsf from '$lib/worker/transfoccmation'
import { createRequire } from 'module'
import { WebGLRenderer } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
globalThis.require = createRequire(import.meta.url)

export async function setup() {
  // @ts-ignore
  const oc = await loadOC({
    locateFile: () => 'src/assets/replicad_single.wasm',
  })
  setOC(oc)
}

function importSTEP(fileName: string, file: Uint8Array) {
  const oc = getOC()
  oc.FS.writeFile(`/${fileName}`, file)

  const reader = new oc.STEPControl_Reader_1()
  if (reader.ReadFile(fileName)) {
    oc.FS.unlink('/' + fileName)
    reader.TransferRoots(new oc.Message_ProgressRange_1())
    const stepShape = reader.OneShape()

    const shape = cast(stepShape)
    return shape as Solid
  } else {
    oc.FS.unlink('/' + fileName)
    throw new Error('Failed to load STEP file')
  }
}

async function fetchKey(key: CuttleKey) {
  const t = key.type.replace('-snap-in', 'SnapIn')
  let name = `target/key-${t}.step`
  if (key.type === 'trackball') name = 'src/assets/trackball_holder.step'
  const file = await readFile(name)
  return importSTEP(key.type, file)
}

export async function generate(config: Cuttleform) {
  const transforms = keyHolesTrsfs(config, new Trsf())
  const pts = allKeyCriticalPoints(config, transforms)
  const wallPts = allWallCriticalPoints(config, pts)
  const connOrigin = connectorOrigin(config, wallPts)

  const holes = await keyHoles(config, transforms.flat(), fetchKey)
  const keys = await keyGeometries(transforms as Trsf[], config.keys, 1)
  const switches = await switchGeometries(transforms as Trsf[], config.keys, 1)

  let polygons = joinWalls(config, wallPts.map(w => wallSurfaces(config, w)))
  const oc = getOC()
  const builder = new oc.BRep_Builder()
  const shell = new oc.TopoDS_Shell()
  builder.MakeShell(shell)
  for (const poly of polygons) {
    builder.Add(shell, poly.wrapped)
  }
  const newShell = shell // downcast(sewing.SewedShape())
  const solid = new oc.ShapeFix_Solid_1().SolidFromShell(newShell)
  let walls = new Solid(solid)

  const web = webSolid(config, transforms)

  let connector: Solid | null = null
  if (config.connector !== 'none') {
    connector = makeConnector(config, config.connector, connOrigin)
    walls = cutWithConnector(config, walls, config.connector, connOrigin)
  }
  const screwPos = config.screwInserts ? screwPositions(config, wallPts) : []
  let inserts: Solid | null = null
  // if (screwPos.length) {
  //     const inners = makeInnerScrewInserts(screwPos)
  //     inserts = makerScrewInserts(screwPos)
  //     inners.forEach(i => { walls = walls.cut(i) })
  // }
  const plate = makePlate(config, wallPts, screwPos)
  const model = combine([walls, web, holes, connector, inserts] as Solid[])

  const mesh = model.mesh({ tolerance: 0.1, angularTolerance: 10 })
  const plateMesh = plate.mesh({ tolerance: 0.1, angularTolerance: 10 })
  const center = estimatedCenter(transforms)
  return { mesh, plateMesh, center, keys, switches }
}

const loader = new GLTFLoader()

function closestAspect(aspect: number) {
  if (aspect < 1) aspect = 1 / aspect
  if (aspect < 1.125) return 1
  if (aspect < 1.375) return 1.25
  if (aspect < 1.75) return 1.5
  return 2
}

const glbCache: Record<string, Promise<THREE.BufferGeometry>> = {}

async function fetchGLB(name: string) {
  if (name in glbCache) return await glbCache[name]
  glbCache[name] = readFile(name).then(c => loader.parseAsync(c.buffer, '')).then(g => (g.scene.children[0] as THREE.Mesh).geometry)
  return await glbCache[name]
}

async function fetchKeyBy(profile: string, aspect: number, row: number) {
  if (profile === 'dsa') return await fetchGLB(`target/key-${profile}-${aspect}.glb`)
  return await fetchGLB(`target/key-${profile}-${row}-${aspect}.glb`)
}

async function keyGeometries(trsfs: Trsf[], keys: CuttleKey[], opacity: number) {
  return await Promise.all(
    keys.filter(k => (k.keycap || k.type == 'trackball') && k.type != 'blank').map(async k => {
      const trsf = trsfs[keys.indexOf(k)]
      let key: THREE.BufferGeometry
      if (k.keycap) {
        const origKey = await fetchKeyBy(k.keycap.profile, closestAspect(k.aspect), k.keycap.row)
        key = origKey.clone()
        if (k.aspect < 1) key.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2))
      } else {
        key = new THREE.SphereGeometry(17.5, 64, 32)
      }
      key.applyMatrix4(trsf.pretranslated(0, 0, k.type == 'trackball' ? 2.5 : 10).Matrix4())
      return key
    }),
  )
}

export async function fetchSwitch(sw: string): Promise<THREE.BufferGeometry> {
  return fetchGLB('target/switch-cherry-mx.glb')
}

export function offsetSwitch(sw: string): [number, number, number] {
  if (sw == 'mx' || sw == 'box' || sw == 'mx-snap-in') return [0, 0, 15]
  return [0, 0, 10]
}

export async function switchGeometries(trsfs: Trsf[], keys: CuttleKey[], opacity: number) {
  return await Promise.all(
    keys.filter(k => k.type in { 'box': 1, 'mx': 1 }).map(async k => {
      const origSwitch = await fetchSwitch(k.type)
      const sw = origSwitch.clone()
      sw.applyMatrix4(trsfs[keys.indexOf(k)].pretranslated(offsetSwitch(k.type)).Matrix4())
      return sw
    }),
  )
}

export interface Geo {
  geometry: THREE.BufferGeometry
  material: THREE.Material
}

export function modelZoom(model: Geo, aspect: number) {
  const size = boundingSize([model.geometry])
  const fov = 50 * (Math.PI / 180)
  const fovh = 2 * Math.atan(Math.tan(fov / 2) * aspect)
  let dx = size.z / 2 + Math.abs(size.x / 2 / Math.tan(fovh / 2))
  let dy = size.z / 2 + Math.abs(size.y / 2 / Math.tan(fov / 2))
  return Math.max(dx, dy) * 1.2
}

interface RenderOptions {
  switches?: THREE.BufferGeometry[]
  keys?: THREE.BufferGeometry[]
  zoom?: number
  rotation?: number
  plate?: THREE.BufferGeometry
}

export function render(model: Geo, width = 500, height = 500, center: any, opts: RenderOptions) {
  const zoom = opts.zoom ?? modelZoom(model, width / height)
  const switches = opts.switches ?? []
  const keys = opts.keys ?? []

  const camera = new THREE.PerspectiveCamera(50, width / height, 1, 1000)
  const scene = new THREE.Scene()

  const renderer = new WebGLRenderer({
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

  camera.position.set(0, -1, 0.8).normalize().multiplyScalar(zoom)
  camera.lookAt(new THREE.Vector3(0, 0, 0))

  const M = new THREE.Matrix4().makeTranslation(-center[0], -center[1], -center[2]).premultiply(new THREE.Matrix4().makeRotationZ(opts.rotation ?? 0))
  const material = new CaseMaterial(1, 1, 'green')
  scene.add(new THREE.Mesh(model.geometry.clone().applyMatrix4(M), material))

  keys.forEach(k => scene.add(new THREE.Mesh(k.clone().applyMatrix4(M), new KeyMaterial(1, 1, 'green'))))
  switches.forEach(g => scene.add(new THREE.Mesh(g.clone().applyMatrix4(M), new KeyMaterial(0.7, 1, 'green'))))
  if (opts.plate) scene.add(new THREE.Mesh(opts.plate.clone().applyMatrix4(M), new KeyMaterial(1, 1, 'green')))
  renderer.render(scene, camera)

  return extractPixels(renderer.getContext())
}

function extractPixels(context: WebGLRenderingContext | WebGL2RenderingContext) {
  const width = context.drawingBufferWidth
  const height = context.drawingBufferHeight
  const frameBufferPixels = new Uint8Array(width * height * 4)
  context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, frameBufferPixels)
  return sharp(frameBufferPixels, { raw: { width, height, channels: 4 } }).flip()
}
