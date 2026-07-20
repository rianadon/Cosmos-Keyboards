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

/** Returns all corners of the face */
function faceCorners(face: Face): [number, number, number][] {
  if (Array.isArray(face[0])) {
    const p = face as Patch // It's a Bezier patch
    return [p[0][0], p[0][3], p[3][3], p[3][0]].map(v => v.xyz() as [number, number, number])
  }
  // Otherwise, it's a triangle or quad of Trsfs.
  return (face as Trsf[]).map(t => t.xyz())
}

/**
 * Check that the given web faces form one or more closed, watertight manifolds.
 *
 * We compare undirected edges so the result doesn't depend on each face's
 * winding order (top/bottom faces and triangular bezier patches don't share a
 * single global orientation).
 *
 * Returns a description of the first violation found, or null if manifold.
 */
function findNonManifold(faces: readonly Face[]): string | null {
  // Weld coincident corners to shared vertex ids (rounded to 0.001mm).
  const ids = new Map<string, number>()
  const vid = (p: [number, number, number]) => {
    const key = p.map(n => Math.round(n * 1000)).join(',')
    let id = ids.get(key)
    if (id === undefined) ids.set(key, id = ids.size)
    return id
  }

  // Count how many faces use each undirected edge.
  const edgeFaces = new Map<string, number[]>()
  for (let fi = 0; fi < faces.length; fi++) {
    const verts = faceCorners(faces[fi]).map(vid)
    for (let k = 0; k < verts.length; k++) {
      const a = verts[k]
      const b = verts[(k + 1) % verts.length]
      if (a === b) continue // skip degenerate edges (collapsed corner)
      const edge = a < b ? `${a}-${b}` : `${b}-${a}`
      const list = edgeFaces.get(edge)
      if (list) list.push(fi)
      else edgeFaces.set(edge, [fi])
    }
  }

  for (const [edge, fs] of edgeFaces) {
    if (fs.length === 1) return `open boundary edge ${edge} on face ${fs[0]} (hole in the shell)`
    if (fs.length > 2) return `non-manifold edge ${edge} shared by ${fs.length} faces ${JSON.stringify(fs)} (overlapping/coincident faces)`
  }
  return null
}

describe('Web is manifold', () => {
  test.each(WEB_TEST_URLS)('for url %s', (url) => {
    const config = fromCosmosConfig(decodeConfigIdk(url)).right!
    const geo = newGeometry(config)
    const web = webSolid(config, geo)
    expect(findNonManifold(web.allFaces)).toBeNull()
  })
})
