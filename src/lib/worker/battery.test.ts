import { localBatteryBounds } from '$lib/geometry/batteries'
import { expect, test } from 'bun:test'
import { type Cuttleform, newGeometry } from './config'
import { fromCosmosConfig } from './config.cosmos'
import { decodeConfigIdk } from './config.serialize'
import { batteryCandidates } from './geometry'
import { intersectPtPoly } from './geometry.intersections'
import { Vector } from './modeling/transformation'

// The default model
const URL =
  'Cp0BChUSBRCAPyAnEgIgExICIAASADgxQAAKFRIFEIBLICcSAiATEgIgABIAOB1AAAoiEgUQgFcgJxICIBMSAiAAEgMQsC8SBRCwayAoOAlAgPC8AgofEgUQgGMgJxICIBMSAiAAEgMQsDsSBRCwIyAoOApAAAoZEgUQgG8gJxICIBMSAiAAEgA4HkCAhorABxgAQOiFoK7wVUjc8KKgAQqOAQorEhMQwIACQICAmAJIwpmglZC8AVBDEhJAgIDMAkjCmaCVkLwBUIYBWDo4CAoVEhAQQECAgCBI0JWA3ZD1A1ALUJ4CCicSEBBAQICA+AFI5pn8p5ALUFcSEUCAgKQDSPCZxLXQMFB0WJUBUH8YAiIOCMgBEMgBGAAgADAAOABAy4v8n9AxSK2R3I3BkwaCAQIEAg=='

function config(battery: Cuttleform['battery']): Cuttleform {
  return { ...fromCosmosConfig(decodeConfigIdk(URL)).right!, battery }
}

test('No battery means no placement', () => {
  expect(newGeometry(config(null)).batteryPlacement).toBeNull()
})

test('The tray sits inside the case, on the plate, with its back edge against a wall', () => {
  for (const cell of ['lipo-301230', 'lipo-502030', 'lipo-603040'] as const) {
    const geo = newGeometry(config({ cell, mount: 'fused' }))
    const { origin, alongWall } = geo.batteryPlacement!
    const bnd = localBatteryBounds(cell, alongWall)
    const walls = geo.allWallCriticalPoints().map(w => w.bi.xyz())

    const floor = origin.apply(new Vector(0, 0, 0))
    expect(floor.z).toBeGreaterThan(geo.bottomZ)
    expect(floor.z).toBeLessThan(geo.bottomZ + 1)
    expect(origin.axis(0, 0, 1).z).toBeCloseTo(1)

    // Every corner away from the wall is inside the case, and just behind the back edge is the wall itself.
    for (const [x, y] of [[bnd.minx, bnd.miny], [bnd.maxx, bnd.miny], [bnd.minx, -1], [bnd.maxx, -1]]) {
      expect(intersectPtPoly(origin.apply(new Vector(x, y, 0)).xyz(), walls)).toBe(true)
    }
    const behind = [-1, 0, 1].map(f => intersectPtPoly(origin.apply(new Vector(f * bnd.maxx * 0.9, 1, 0)).xyz(), walls))
    expect(behind).toContain(false)
  }
})

test('Placement prefers fitting candidates closest to the microcontroller', () => {
  const c = config({ cell: 'lipo-301230', mount: 'fused' })
  const geo = newGeometry(c)
  const fits = [...batteryCandidates(c, geo)].filter(x => x.fits)
  const best = Math.min(...fits.map(f => f.score))
  const chosen = fits.find(f => f.score == best)!
  expect(geo.batteryPlacement!.origin.xyz()).toEqual(chosen.origin.xyz())
})

test('The offset is applied in the tray frame', () => {
  const plain = newGeometry(config({ cell: 'lipo-301230', mount: 'fused' })).batteryPlacement!
  const moved = newGeometry(config({ cell: 'lipo-301230', mount: 'fused', offset: { x: 3, y: -2, z: 1, rotation: 0 } })).batteryPlacement!
  const expected = plain.origin.apply(new Vector(3, -2, 1))
  moved.origin.xyz().forEach((v, i) => expect(v).toBeCloseTo(expected.xyz()[i]))
  expect(moved.alongWall).toBe(plain.alongWall)
})

test('A battery too big for the case throws, unless an offset is given', () => {
  const huge = { custom: { length: 400, width: 300, thickness: 5 } }
  expect(() => newGeometry(config({ cell: huge, mount: 'fused' })).batteryPlacement).toThrow(/battery tray/)
  expect(newGeometry(config({ cell: huge, mount: 'fused', offset: { x: 0, y: 0, z: 0, rotation: 10 } })).batteryPlacement).not.toBeNull()
})

test('Fused trays have no screws', () => {
  expect(newGeometry(config({ cell: 'lipo-301230', mount: 'fused' })).batteryPlacement!.screws).toEqual([])
})

test('Separate trays get a screw beside each end of their back edge, inside the case', () => {
  // Without the microcontroller, the default model has room beside the tray for screws.
  for (const cell of ['lipo-301230', 'lipo-502030', 'lipo-503035', 'lipo-603040'] as const) {
    const geo = newGeometry({ ...config({ cell, mount: 'separate' }), microcontroller: null })
    const { origin, alongWall, screws } = geo.batteryPlacement!
    const bnd = localBatteryBounds(cell, alongWall)
    const walls = geo.allWallCriticalPoints().map(w => w.bi.xyz())
    expect(screws.length).toBe(2)
    const xs = screws.map(s => origin.inverted().apply(s.position.origin()).x).sort((a, b) => a - b)
    expect(xs[0]).toBeLessThan(bnd.minx)
    expect(xs[1]).toBeGreaterThan(bnd.maxx)
    for (const s of screws) expect(intersectPtPoly(s.position.xyz(), walls)).toBe(true)
  }
})

test('Bigger trays reach over to share a base screw when there is no room for their own insert', () => {
  const geo = newGeometry({ ...config({ cell: 'lipo-603040', mount: 'separate' }), microcontroller: null })
  const shared = geo.batteryPlacement!.screws.filter(s => s.base !== undefined)
  expect(shared.length).toBeGreaterThan(0)
  for (const s of shared) {
    const base = geo.justScrewPositions[s.base!].origin()
    expect(s.position.origin().x).toBeCloseTo(base.x)
    expect(s.position.origin().y).toBeCloseTo(base.y)
    expect(s.position.origin().z).toBeGreaterThan(base.z)
  }
})
