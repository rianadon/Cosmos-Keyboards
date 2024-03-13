import { Compound, downcast, getOC, makeSolid, setOC, type ShapeMesh, Shell, Solid } from 'replicad'
/// <reference lib="webworker" />
// declare const self: DedicatedWorkerGlobalScope;

import loadOC, { type OpenCascadeInstance } from '$assets/replicad_single'
import wasmUrl from '$assets/replicad_single.wasm?url'
// import loadOC from 'replicad-opencascadejs/src/replicad_single';
// import wasmUrl from 'replicad-opencascadejs/src/replicad_single.wasm?url';
// import loadOC from 'opencascade/dist/opencascade.full';
// import wasmUrl from 'opencascade/dist/opencascade.full.wasm?url';
import { ASYMMETRIC_PARTS } from '$lib/geometry/socketsParts'
import { keyHoleMeshes } from '$lib/loaders/sockets'
import { wristRest } from '@pro/wristRest'
import type { BufferAttribute, BufferGeometry } from 'three'
import { getUser } from '../../routes/beta/lib/login'
import { ITriangle } from '../loaders/simplekeys'
import { type ConfError, isPro, keycapIntersections, partIntersections, socketIntersections } from './check'
import { type Cuttleform, type CuttleKey, type Geometry, newGeometry } from './config'
import { boardHolder, cutWithConnector, keyHoles, makeConnector, makePlate, makerScrewInserts, makeWalls, type ScrewInsertTypes, webSolid } from './model'
import { Assembly } from './modeling/assembly'
import { blobSTL, combine } from './modeling/index'
import { supportMesh } from './modeling/supports'
import Trsf, { Vector } from './modeling/transformation'

let oc: OpenCascadeInstance
let web: Solid
let walls: Solid
let model: Solid
let ocTime = 0

const NULL = { mesh: null, mass: 0 }

async function ensureOC() {
  if (!oc) {
    const start = performance.now()
    // @ts-ignore
    oc = await loadOC({
      locateFile: () => wasmUrl,
    })
    setOC(oc)
    ocTime = performance.now() - start
  } // @ts-ignore
  else console.debug('OC memory', oc.asm.oa.buffer.byteLength / 1e6 + ' MB')
}

// export async function modelCenter(config: Cuttleform) {
//   await ensureOC();
//   const transforms = keyHolesTrsfs(config, new Trsf());
//   return estimatedCenter(transforms.flat());
// }

// export async function generateKeyPos(config: Cuttleform) {
//   await ensureOC();
//   const transforms = keyHolesTrsfs(config, new Trsf());
//   return transforms.map((t,i) => ({
//     trsf: t.pretranslated(0, 0, config.keys[i].type == "trackball" ? 2.5 : 10).matrix(),
//     type: config.keys[i].type,
//     aspect: config.keys[i].aspect,
//     keycap: config.keys[i].keycap,
//     trackballRadius: config.keys[i].trackball?.radius
//   }))
// }

const toMesh = (mesh: BufferGeometry) =>
  ({
    vertices: (mesh.attributes['position'] as BufferAttribute).array as number[],
    normals: (mesh.attributes['normal'] as BufferAttribute).array as number[],
    triangles: mesh.index!.array as number[],
    faceGroups: [],
  }) satisfies ShapeMesh

export async function generateKeys(config: Cuttleform) {
  const geo = newGeometry(config)
  const keys = await keyHoleMeshes(config, geo.keyHolesTrsfs.flat())

  const supports: { vertices: number[]; normals: number[]; volume: number } = {
    vertices: [],
    normals: [],
    volume: 0,
  }
  for (const key of keys.keys) {
    const mesh = key.mesh.clone().applyMatrix4(key.matrix)
    const sups = supportMesh(toMesh(mesh), geo.bottomZ)
    supports.vertices.push(...sups.vertices)
    supports.normals.push(...sups.normals)
    supports.volume += sups.volume
  }
  const mass = keys.mass
  // const supports = supportMesh(mesh, geo.bottomZ)
  return { keys: keys.keys.map(k => ({ ...k, mesh: toMesh(k.mesh) })), mass, supports }
}

export async function generateWeb(config: Cuttleform) {
  await ensureOC()
  const geo = newGeometry(config)
  web = webSolid(config, geo, false)
  return meshWithVolumeAndSupport(web, geo.bottomZ)
}

export async function generateWalls(config: Cuttleform) {
  await ensureOC()
  const geo = newGeometry(config)
  walls = makeWalls(config, geo.allWallCriticalPoints(), geo.worldZ, geo.bottomZ, false)
  return meshWithVolume(walls)
}

export async function generatePlate(config: Cuttleform, cut = false) {
  await ensureOC()
  const geo = newGeometry(config)
  const { top, bottom } = makePlate(config, geo, cut)
  const topMesh = meshWithVolume(top())
  return {
    top: topMesh,
    bottom: bottom ? meshWithVolume(bottom()) : { mesh: null, mass: 0 },
    ocTime: topMesh.ocTime,
  }
}

export async function generate(config: Cuttleform, geo: Geometry, stitchWalls: boolean, flip: boolean) {
  if (isPro(config) && !(await getUser()).sponsor) {
    throw new Error('No pro account')
  }
  await ensureOC()
  const assembly = new Assembly()

  console.time('Calculating geometry')
  const transforms = geo.keyHolesTrsfs
  const pts = geo.allKeyCriticalPoints
  const wallPts = geo.allWallCriticalPoints()
  const connOrigin = geo.connectorOrigin
  console.timeEnd('Calculating geometry')

  console.time('Creating walls')
  try {
    walls = makeWalls(config, wallPts, geo.worldZ, geo.bottomZ, stitchWalls)
  } catch (e) {
    throw new Error('Error Generating the Walls: ' + e + "\n\nThis is caused by bad geometry. Check that the walls don't intersect themselves.")
  }

  console.timeEnd('Creating walls')

  console.time('Making web')
  let web: Solid
  try {
    web = webSolid(config, geo, true)
  } catch (e) {
    throw new Error('Error Generating the Key Web: ' + e + "\n\nThis is caused by bad geometry. Check that the walls don't intersect the key sockets in any part of the model.")
  }
  console.timeEnd('Making web')
  console.time('Creating holes')
  const flipper = (key: CuttleKey) => (flip && ASYMMETRIC_PARTS.includes(key.type)) ? new Trsf().scaleIsDangerous(-1, 1, 1) : new Trsf()
  const holes = await keyHoles(config, transforms.map((t, i) => t.multiply(flipper(config.keys[i]))))
  console.timeEnd('Creating holes')
  console.time('Creating connector')
  // let connector = null
  if (config.connector && connOrigin) {
    // connector = makeConnector(config, config.connector, connOrigin)
    walls = cutWithConnector(config, walls, config.connector, connOrigin)
  }
  console.timeEnd('Creating connector')
  console.time('Creating screw inserts')
  const screwPos = geo.screwPositions
  let inserts: Compound | null = null
  if (screwPos.length) {
    inserts = makerScrewInserts(config, geo, ['base'])
  }
  console.timeEnd('Creating screw inserts')
  // console.time('Creating plate')
  // const plate = makePlate(config, geo)
  // console.timeEnd('Creating plate')
  // console.time('Putting everything together')
  assembly.add('Walls', walls)
  assembly.add('Web', web)
  assembly.add('Switch Holders', holes)
  // if (connector) assembly.add('Connector', connector)
  if (inserts) assembly.add('Screw Attachments', inserts)
  // model = combine([walls, web, holes, connector, inserts]);
  // model = web //combine([connector]);
  // console.timeEnd('Putting everything together')
  // console.time('Meshing')
  // const wallMesh = walls.mesh({ tolerance: 0.1, angularTolerance: 10 });
  // const mesh = model.mesh({ tolerance: 0.1, angularTolerance: 10 });
  // const plateMesh = plate.mesh({ tolerance: 0.1, angularTolerance: 10 });
  // console.timeEnd('Meshing')
  return { assembly }
}

// export async function generateConnector(config: Cuttleform) {
//   await ensureOC();
//   if (config.connector == "none" || !config.connector) return NULL;
//   const transforms = keyHolesTrsfs(config, new Trsf());
//   const pts = allKeyCriticalPoints(config, transforms);
//   const wallPts = allWallCriticalPoints(config, pts, transforms);
//   const connOrigin = connectorOrigin(config, wallPts);
//   const connector = makeConnector(config, config.connector, connOrigin)
//   if (!connector) return NULL;
//   const result = meshWithVolume(connector)
//   connector.delete()
//   return result
// }

export async function generateScrewInserts(config: Cuttleform) {
  await ensureOC()
  const geo = newGeometry(config)
  if (!geo.screwIndices.length) return { baseInserts: NULL, plateInserts: NULL }
  let baseInsertsM = makerScrewInserts(config, geo, ['base'])
  let plateInsertsM = makerScrewInserts(config, geo, ['plate'])

  // if (config.connector!== "none" && config.connector) {
  //   const connOrigin = connectorOrigin(config, geo.allWallCriticalPoints);
  //   inserts = cutWithConnector(config, inserts, config.connector, connOrigin)
  // }

  const baseInserts = meshWithVolume(baseInsertsM)
  const plateInserts = meshWithVolume(plateInsertsM)
  baseInsertsM.delete()
  plateInsertsM.delete()
  return { baseInserts, plateInserts }
}

export async function generateBoardHolder(config: Cuttleform) {
  if (!config.microcontroller) return null
  await ensureOC()
  const holder = boardHolder(config, newGeometry(config))
  const result = meshWithVolume(holder)
  holder.delete()
  return result
}

export async function generateWristRest(config: Cuttleform) {
  await ensureOC()
  if (!config.wristRest) return NULL
  const rest = wristRest(config, newGeometry(config)) as Solid
  const result = meshWithVolume(rest)
  rest.delete()
  return result
}

export async function cutWall(config: Cuttleform) {
  await ensureOC()
  const geometry = newGeometry(config)
  await generateWalls(config)
  if (config.connector && geometry.connectorOrigin) {
    walls = cutWithConnector(config, walls, config.connector, geometry.connectorOrigin)
  }
  const result = meshWithVolumeAndSupport(walls, geometry.bottomZ)
  // walls.delete()
  return result
}

async function getModel(conf: Cuttleform, name: string, stitchWalls: boolean, flip: boolean) {
  await ensureOC()
  const geometry = newGeometry(conf)
  if (name == 'model') {
    const geo = newGeometry(conf)
    let { assembly } = await generate(conf, geo, stitchWalls, flip)
    if (conf.shell.type == 'tilt') {
      // Invert the tilt cases's tilting to the model lies flat
      assembly = assembly.transform(new Trsf().coordSystemChange(new Vector(), geo.worldX, geo.worldZ).invert())
    }
    assembly = assembly.transform(new Trsf().translate(0, 0, -geo.floorZ))
    return assembly
  } else if (name == 'plate' || name == 'platetop') {
    return makePlate(conf, geometry, true, true).top()
  } else if (name == 'platebottom') {
    const bot = makePlate(conf, geometry, true, true).bottom
    return bot ? bot() : undefined
  } else if (name == 'holder') {
    return boardHolder(conf, geometry)
  } else if (name == 'wristrest') {
    return wristRest(conf, geometry)
  } else {
    throw new Error("I don't know what model you want")
  }
}

export async function getSTL(conf: Cuttleform, name: string, flip: boolean) {
  let model = await getModel(conf, name, true, flip)
  if (!model) throw new Error(`Model ${name} is empty`)
  if (flip) model = model.mirror('YZ', [0, 0, 0])
  return blobSTL(model, { tolerance: 1e-2, angularTolerance: 1 })
}

export async function getSTEP(conf: Cuttleform, flip: boolean, stitchWalls: boolean) {
  const geometry = newGeometry(conf)
  let { assembly } = await generate(conf, geometry, stitchWalls, flip)
  const { top, bottom } = makePlate(conf, geometry, true, true)
  assembly.add('Bottom Plate', combine([top(), bottom ? bottom() : undefined]))
  if (conf.microcontroller) {
    assembly.add('Microcontroller Holder', boardHolder(conf, geometry))
  }

  if (conf.wristRest && (await getUser()).sponsor) {
    assembly.add('Wrist Rest', wristRest(conf, geometry))
  }

  assembly = assembly.transform(new Trsf().translate(0, 0, -geometry.floorZ))
  if (flip) assembly = assembly.mirror('YZ', [0, 0, 0])
  return assembly.blobSTEP()
}

function meshWithVolume(solid: Solid) {
  const mesh = solid.mesh({ tolerance: 0.1, angularTolerance: 10 })
  const props = new oc.GProp_GProps_1()
  oc.BRepGProp.VolumeProperties_2(solid.wrapped, props, 0.01, false, true)
  const mass = props.Mass()
  props.delete()
  const originalTime = ocTime
  ocTime = 0 // Only report once
  return { mesh, mass, ocTime: originalTime }
}

function meshWithVolumeAndSupport(solid: Solid, minZ: number) {
  const { mesh, mass, ocTime } = meshWithVolume(solid)
  const supports = supportMesh(mesh, minZ)
  return { mesh, mass, supports, ocTime }
}

export async function volume() {
  if (!model) throw new Error('No model created yet')
  const oc = getOC()
  const props = new oc.GProp_GProps_1()
  oc.BRepGProp.VolumeProperties_2(model.wrapped, props, 0.01, false, true)
  return props.Mass()
}

export async function intersections(conf: Cuttleform): Promise<ConfError | undefined> {
  try {
    const geometry = newGeometry(conf)
    const trsfs3d = geometry.keyHolesTrsfs
    const { botReinf, topReinf } = geometry.reinforcedTriangles

    const toTriangles = (r: typeof botReinf) =>
      r.triangles.map(([a, b, c]) =>
        new ITriangle(
          r.allPts[a].origin(),
          r.allPts[b].origin(),
          r.allPts[c].origin(),
          -1,
        )
      )
    const tris = [...toTriangles(topReinf), ...toTriangles(botReinf)]
    for (const intersection of keycapIntersections(conf, trsfs3d, tris)) {
      return intersection
    }
    for (const intersection of partIntersections(conf, trsfs3d)) {
      return intersection
    }
    // if (geometry.reinforcedTriangles.topReinf.error) return geometry.reinforcedTriangles.topReinf.error

    for (const intersection of socketIntersections(conf, trsfs3d, geometry.allKeyCriticalPoints, tris)) {
      return intersection
    }
  } catch (e) {
    console.error(e)
    return { type: 'exception', when: 'laying out the walls', error: e as Error }
  }
}
