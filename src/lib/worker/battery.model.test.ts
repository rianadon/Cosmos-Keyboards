import loadOC from '$assets/replicad_single'
import { BATTERY_BRIDGE_DEPTH, batteryTrayWallHeight, localBatteryBounds } from '$lib/geometry/batteries'
import { beforeAll, describe, expect, test } from 'bun:test'
import { createRequire } from 'module'
import { getOC, measureVolume, setOC, type Solid } from 'replicad'
import { type Cuttleform, newGeometry } from './config'
import { fromCosmosConfig } from './config.cosmos'
import { decodeConfigIdk } from './config.serialize'
import { batteryHolder, makerScrewInserts } from './model'
import { Vector } from './modeling/transformation'

// The default model
const URL =
  'Cp0BChUSBRCAPyAnEgIgExICIAASADgxQAAKFRIFEIBLICcSAiATEgIgABIAOB1AAAoiEgUQgFcgJxICIBMSAiAAEgMQsC8SBRCwayAoOAlAgPC8AgofEgUQgGMgJxICIBMSAiAAEgMQsDsSBRCwIyAoOApAAAoZEgUQgG8gJxICIBMSAiAAEgA4HkCAhorABxgAQOiFoK7wVUjc8KKgAQqOAQorEhMQwIACQICAmAJIwpmglZC8AVBDEhJAgIDMAkjCmaCVkLwBUIYBWDo4CAoVEhAQQECAgCBI0JWA3ZD1A1ALUJ4CCicSEBBAQICA+AFI5pn8p5ALUFcSEUCAgKQDSPCZxLXQMFB0WJUBUH8YAiIOCMgBEMgBGAAgADAAOABAy4v8n9AxSK2R3I3BkwaCAQIEAg=='

beforeAll(async () => {
  // @ts-ignore Let opencascade load its wasm the way it does in node
  globalThis.__dirname = 'src/assets'
  // @ts-ignore
  globalThis.require = createRequire(import.meta.url)
  // @ts-ignore
  setOC(await loadOC({ locateFile: () => 'src/assets/replicad_single.wasm', print: () => {}, printErr: () => {} }))
})

function config(battery: Cuttleform['battery']): Cuttleform {
  return { ...fromCosmosConfig(decodeConfigIdk(URL)).right!, battery }
}

/** Lowest and highest Z of the tessellated solid. OpenCascade's bounding boxes can be loose after booleans. */
function zRange(solid: Solid) {
  const v = solid.mesh({ tolerance: 0.01, angularTolerance: 5 }).vertices
  const zs: number[] = []
  for (let i = 2; i < v.length; i += 3) zs.push(v[i])
  return [Math.min(...zs), Math.max(...zs)]
}

function isValid(solid: Solid) {
  const oc = getOC()
  const analyzer = new oc.BRepCheck_Analyzer(solid.wrapped, true, false)
  const valid = analyzer.IsValid_2()
  analyzer.delete()
  return valid
}

test('No battery means no tray', () => {
  const c = config(null)
  expect(batteryHolder(c, newGeometry(c))).toBeNull()
})

describe.each(['lipo-301230', 'lipo-603040'] as const)('Tray for %s', (cell) => {
  test('separate tray is a valid solid at the placement', () => {
    const c = config({ cell, mount: 'separate' })
    const geo = newGeometry(c)
    const tray = batteryHolder(c, geo)!
    expect(isValid(tray)).toBe(true)

    const { origin, alongWall } = geo.batteryPlacement!
    const bnd = localBatteryBounds(cell, alongWall)
    const box = tray.boundingBox
    const floor = origin.origin().z
    const [minZ, maxZ] = zRange(tray)
    expect(minZ).toBeCloseTo(floor, 3)
    expect(maxZ).toBeCloseTo(floor + batteryTrayWallHeight(cell), 3)
    // Rotated about Z only, so the horizontal diagonal is preserved.
    const diag = Math.hypot(box.width, box.height)
    expect(diag).toBeGreaterThanOrEqual(Math.hypot(bnd.maxx - bnd.minx, bnd.maxy - bnd.miny) - 0.01)
    tray.delete()
  })

  test('fused tray is a valid solid that reaches the bottom of the walls and the case wall', () => {
    const c = config({ cell, mount: 'fused' })
    const geo = newGeometry(c)
    const tray = batteryHolder(c, geo)!
    const separate = batteryHolder({ ...c, battery: { cell, mount: 'separate' } }, geo)!
    expect(isValid(tray)).toBe(true)
    expect(zRange(tray)[0]).toBeCloseTo(geo.bottomZ, 3)
    // The bridge adds material behind the tray, but never more than the bridge depth.
    const inv = geo.batteryPlacement!.origin.inverted()
    const maxLocalY = Math.max(...tray.edges.map(e => inv.apply(new Vector(e.startPoint.x, e.startPoint.y, e.startPoint.z)).y))
    expect(maxLocalY).toBeGreaterThan(0)
    expect(maxLocalY).toBeLessThanOrEqual(BATTERY_BRIDGE_DEPTH + 1e-3)
    expect(measureVolume(tray)).toBeGreaterThan(measureVolume(separate))
    tray.delete()
    separate.delete()
  })
})

test.each(['lipo-301230', 'lipo-603040'] as const)('Separate %s tray screws get inserts above the holes in its arms', (cell) => {
  const c = { ...config({ cell, mount: 'separate' }), microcontroller: null }
  const geo = newGeometry(c)
  const screws = geo.batteryPlacement!.screws.map(s => s.position.origin())
  expect(screws.length).toBe(2)
  const withBattery = makerScrewInserts(c, geo, ['base'])
  const without = makerScrewInserts({ ...c, battery: null }, newGeometry({ ...c, battery: null }), ['base'])
  // Building the inserts must not move the screw positions the tray's ears are built from.
  expect(geo.batteryPlacement!.screws.map(s => s.position.origin().xyz())).toEqual(screws.map(s => s.xyz()))
  const v = withBattery.mesh({ tolerance: 0.1, angularTolerance: 10 }).vertices
  for (const s of screws) {
    const zs: number[] = []
    for (let i = 0; i < v.length; i += 3) if (Math.hypot(v[i] - s.x, v[i + 1] - s.y) < 3) zs.push(v[i + 2])
    expect(Math.min(...zs)).toBeCloseTo(s.z, 1)
  }
  expect(measureVolume(withBattery)).toBeGreaterThan(measureVolume(without))
})
