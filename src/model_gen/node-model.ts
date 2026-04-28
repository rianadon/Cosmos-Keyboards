/** Functions for modeling the keyboard from Node.js */

import loadOC from '$assets/replicad_single'
import { fromGeometry } from '$lib/loaders/geometry'
import { type Cuttleform, newGeometry } from '$lib/worker/config'
import { estimatedCenter } from '$lib/worker/geometry'
import { cutWithConnector, keyHoles, makePlate, makerScrewInserts, makeWalls, webSolid } from '$lib/worker/model'
import { combine } from '$lib/worker/modeling/index'
import fg from 'fast-glob'
import { createRequire } from 'module'
import { type AnyShape, setOC } from 'replicad'
import type { BufferGeometry } from 'three'

// patch require and __dirname so that opencascade can import
globalThis.__dirname = 'src/assets'
globalThis.require = createRequire(import.meta.url)

// Set socket urls
process.env.SOCKET_URLS = JSON.stringify(Object.fromEntries(
  fg.sync(['target/*.step', 'src/assets/*.step']).map(u => ['/' + u, { default: u }]),
))
process.env.GLB_URLS = JSON.stringify(Object.fromEntries(
  fg.sync(['target/*.glb', 'src/assets/*.glb']).map(u => ['/' + u, { default: u }]),
))
process.env.FS = 'fs/promises'

export async function setup() {
  // @ts-ignore
  const oc = await loadOC({
    locateFile: () => 'src/assets/replicad_single.wasm',
    print: () => {},
    printErr: () => {},
  })
  setOC(oc)
}

export type Part = 'walls' | 'web' | 'holes' | 'inserts' | 'plate'
type Models = Partial<Record<Part, BufferGeometry>>
export const DEFAULT_PARTS: Part[] = ['walls', 'web', 'holes', 'inserts', 'plate']

export async function generate(config: Cuttleform, parts = DEFAULT_PARTS) {
  const geo = newGeometry(config)

  const components: Record<Part, () => Promise<AnyShape | undefined>> = {
    walls: async () => {
      let walls = makeWalls(config, geo.allWallCriticalPoints(), geo.worldZ, geo.bottomZ).toSolid(true, false)
      if (geo.connectorOrigin) {
        walls = cutWithConnector(config, walls, geo.connectorOrigin)
      }
      return walls
    },
    web: async () => webSolid(config, geo).toSolid(false, true),
    holes: async () => keyHoles(config, geo.keyHolesTrsfs.flat()),
    inserts: async () => geo.screwPositions.length ? makerScrewInserts(config, geo, ['base']) : undefined,
    plate: async () => combine(Object.values(makePlate(config, geo, true, true)).map(a => a())),
  }

  const models: Models = {}
  const center = estimatedCenter(geo)
  for (const p of parts) {
    const mesh = (await components[p]())?.mesh({ tolerance: 0.1, angularTolerance: 10 })
    models[p] = fromGeometry(mesh)
  }

  return { models, center, geo }
}
