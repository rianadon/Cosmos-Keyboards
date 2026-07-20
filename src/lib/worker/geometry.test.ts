import { describe, expect, test } from 'bun:test'
import { newGeometry } from './config'
import { fromCosmosConfig } from './config.cosmos'
import { decodeConfigIdk } from './config.serialize'
import type { Patch } from './geometry'
import { webSolid } from './model'
import type { Face } from './modeling/bezier'
import type Trsf from './modeling/transformation'

const WEB_TEST_URLS = [
  'CiIKGhILEEAgAECrhbyc8DgSCSAAQKyFvJzwODgAGABAgJAXCgIYAiIKCMgBEMgBGAAgAFhAaACCAQIEAvIBAggC',
  'Ci4KJhIKEDAgE0CIno64HBILEEAgAECrhbyc8DgSCSAAQKyFvJzwODgAGABAgJAXCgIYAiIKCMgBEMgBGAAgAFhAaACCAQIEAvIBAggC',
  'Ck8KRxIWCAgQMCATKGQw9ANAgOaQHEiAgJD9AxIVCBIQQCAAQIC8uAxIgLaqofoHiAFQEgkgAECrhbyc8DgSCSAAQKyFvJzwODgAGABAgJAXCgIYAiIKCMgBEMgBGAAgAGgAggECBALyAQIIAg==',
  'Cp0BChUSBRCAPyAnEgIgExICIAASADgxQAAKFRIFEIBLICcSAiATEgIgABIAOB1AAAoiEgUQgFcgJxICIBMSAiAAEgMQsC8SBRCwayAoOAlAgPC8AgofEgUQgGMgJxICIBMSAiAAEgMQsDsSBRCwIyAoOApAAAoZEgUQgG8gJxICIBMSAiAAEgA4HkCAhorABxgAQOiFoK7wVUjc8KKgAQqOAQorEhMQwIACQICAmAJIwpmglZC8AVBDEhJAgIDMAkjCmaCVkLwBUIYBWDo4CAoVEhAQQECAgCBI0JWA3ZD1A1ALUJ4CCicSEBBAQICA+AFI5pn8p5ALUFcSEUCAgKQDSPCZxLXQMFB0WJUBUH8YAiIOCMgBEMgBGAAgADAAOABAy4v8n9AxSK2R3I3BkwaCAQIEAg==', // The default model
]

type Vec3 = [number, number, number]

/** Returns all corners of the face in winding order. */
function faceCorners(face: Face): Vec3[] {
  if (Array.isArray(face[0])) {
    const p = face as Patch // It's a Bezier patch
    return [p[0][0], p[3][0], p[3][3], p[0][3]].map(v => v.xyz() as Vec3)
  }
  // Otherwise, it's a triangle or quad of Trsfs.
  return (face as Trsf[]).map(t => t.xyz())
}

/**
 * Check that the given web faces form one or more closed, watertight manifolds
 * with consistent winding.
 *
 * Returns a description of the violations found, or null if the shell is a
 * consistently-wound manifold.
 */
function findNonManifold(faces: readonly Face[]): string | null {
  // Weld coincident corners to shared vertex ids (rounded to 0.001mm).
  const ids = new Map<string, number>()
  const coords: Vec3[] = []
  const vid = (p: Vec3) => {
    const key = p.map(n => Math.round(n * 1000)).join(',')
    let id = ids.get(key)
    if (id === undefined) {
      ids.set(key, id = ids.size)
      coords[id] = p.map(n => Math.round(n * 100) / 100) as Vec3
    }
    return id
  }

  // Boundary loop of vertex ids per face, with any collapsed corners removed
  // (triangular bezier patches repeat a corner).
  const loops = faces.map(f => {
    const raw = faceCorners(f).map(vid)
    const loop: number[] = []
    for (const v of raw) if (loop[loop.length - 1] !== v) loop.push(v)
    if (loop.length > 1 && loop[0] === loop[loop.length - 1]) loop.pop()
    return loop
  })

  const holes: string[] = []
  const nonManifold: string[] = []
  const windingConflicts: string[] = []
  const degenerate: string[] = []

  // For each undirected edge, record the faces using it and their direction.
  type Use = { fi: number; forward: boolean } // forward = traversed low->high id
  const edgeUses = new Map<string, Use[]>()
  for (let fi = 0; fi < loops.length; fi++) {
    const loop = loops[fi]
    // After welding, a real face keeps >=3 distinct corners. Fewer means the
    // face collapsed to a point or line and has no well-defined winding.
    if (loop.length < 3) {
      degenerate.push(`  face ${fi} collapsed to ${loop.map(v => JSON.stringify(coords[v])).join(', ') || 'a point'}`)
      continue
    }
    for (let k = 0; k < loop.length; k++) {
      const a = loop[k]
      const b = loop[(k + 1) % loop.length]
      const edge = a < b ? `${a}-${b}` : `${b}-${a}`
      const use: Use = { fi, forward: a < b }
      const list = edgeUses.get(edge)
      if (list) list.push(use)
      else edgeUses.set(edge, [use])
    }
  }

  const describeEdge = (edge: string) => {
    const [a, b] = edge.split('-').map(Number)
    return `edge ${JSON.stringify(coords[a])}->${JSON.stringify(coords[b])}`
  }

  for (const [edge, uses] of edgeUses) {
    if (uses.length === 1) {
      holes.push(`  ${describeEdge(edge)} used by only 1 face`)
    } else if (uses.length > 2) {
      nonManifold.push(`  ${describeEdge(edge)} shared by ${uses.length} faces`)
    } else if (uses[0].forward === uses[1].forward) {
      // Both faces traverse the shared edge the same way => one is wound backwards.
      windingConflicts.push(`  ${describeEdge(edge)} traversed the same direction by 2 faces`)
    }
  }

  if (!holes.length && !nonManifold.length && !windingConflicts.length && !degenerate.length) return null

  const cap = (label: string, lines: string[]) => lines.length ? `${lines.length} ${label}:\n${lines.slice(0, 10).join('\n')}${lines.length > 10 ? `\n  ...and ${lines.length - 10} more` : ''}` : ''

  return [
    cap('open boundary edges (holes in the shell)', holes),
    cap('non-manifold edges (overlapping/coincident faces)', nonManifold),
    cap('winding conflicts (faces wound backwards vs. their neighbour)', windingConflicts),
    cap('degenerate faces (collapsed to a point or line)', degenerate),
  ].filter(Boolean).join('\n')
}

describe('Web is a consistently-wound manifold', () => {
  test.each(WEB_TEST_URLS)('for url %s', (url) => {
    const config = fromCosmosConfig(decodeConfigIdk(url)).right!
    const geo = newGeometry(config)
    const web = webSolid(config, geo)
    expect(findNonManifold(web.allFaces)).toBeNull()
  })
})
