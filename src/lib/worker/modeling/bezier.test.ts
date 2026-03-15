import { beforeAll, describe, expect, test } from 'bun:test'
import getManifold, { ManifoldToplevel } from 'manifold-3d'
import { calcNewP, CompBezierSurface as Surface } from './bezier'
import { ShapeMesh } from './index'
import { Vector } from './transformation'

let manifold: ManifoldToplevel

beforeAll(async () => {
  manifold = await getManifold()
  manifold.setup()
})

function assertManifold(mesh: ShapeMesh) {
  const emesh = new (manifold.Mesh)({
    numProp: 3,
    vertProperties: new Float32Array(mesh.vertices),
    triVerts: new Uint32Array(mesh.triangles),
  })

  try {
    new (manifold.Manifold)(emesh).delete()
    expect().pass()
  } catch (e) {
    expect().fail((e as Error).message)
  }
}

const makePatch = (vertices: Vector[], curvature = 0) => {
  const [v00, v03, v33, v30] = vertices
  const u = new Vector().subVectors(v33, v03)
  const v = new Vector().subVectors(v33, v30)
  const normal = u.cross(v).normalize()

  const center = new Vector().addVectors(v00, v03).add(v33).add(v30).divideScalar(4)
  const n0003 = new Vector().add(v00).add(v03).sub(center).sub(center).normalize().add(normal).multiplyScalar(curvature)
  const n0333 = new Vector().add(v03).add(v33).sub(center).sub(center).normalize().add(normal).multiplyScalar(curvature)
  const n3330 = new Vector().add(v33).add(v30).sub(center).sub(center).normalize().add(normal).multiplyScalar(curvature)
  const n3000 = new Vector().add(v30).add(v00).sub(center).sub(center).normalize().add(normal).multiplyScalar(curvature)

  const v01 = new Vector().lerpVectors(v00, v03, 1 / 3).add(n0003)
  const v02 = new Vector().lerpVectors(v00, v03, 2 / 3).add(n0003)
  const v31 = new Vector().lerpVectors(v30, v33, 1 / 3).add(n3330)
  const v32 = new Vector().lerpVectors(v30, v33, 2 / 3).add(n3330)

  const v10 = new Vector().lerpVectors(v00, v30, 1 / 3).add(n3000)
  const v20 = new Vector().lerpVectors(v00, v30, 2 / 3).add(n3000)
  const v13 = new Vector().lerpVectors(v03, v33, 1 / 3).add(n0333)
  const v23 = new Vector().lerpVectors(v03, v33, 2 / 3).add(n0333)

  const v11 = new Vector().lerpVectors(v01, v31, 1 / 3).addScaledVector(normal, curvature)
  const v21 = new Vector().lerpVectors(v01, v31, 2 / 3).addScaledVector(normal, curvature)
  const v12 = new Vector().lerpVectors(v10, v13, 2 / 3).addScaledVector(normal, curvature)
  const v22 = new Vector().lerpVectors(v20, v23, 2 / 3).addScaledVector(normal, curvature)

  return [
    [v00, v01, v02, v03],
    [v10, v11, v12, v13],
    [v20, v21, v22, v23],
    [v30, v31, v32, v33],
  ]
}

function makeCube(curvature: number) {
  const v000 = new Vector(0, 0, 0)
  const v001 = new Vector(0, 0, 1)
  const v010 = new Vector(0, 1, 0)
  const v011 = new Vector(0, 1, 1)
  const v100 = new Vector(1, 0, 0)
  const v101 = new Vector(1, 0, 1)
  const v110 = new Vector(1, 1, 0)
  const v111 = new Vector(1, 1, 1)
  const patches = [
    makePatch([v010, v011, v001, v000], curvature),
    makePatch([v100, v101, v111, v110], curvature),
    makePatch([v000, v001, v101, v100], curvature),
    makePatch([v110, v111, v011, v010], curvature),
    makePatch([v100, v110, v010, v000], curvature),
    makePatch([v001, v011, v111, v101], curvature),
  ]
  const s = new Surface()
  patches.forEach(p => s.addPatch(p))
  return s
}

describe('Point matching', () => {
  const div = 9
  const divP1 = 10

  test('Matches 3 2', () => {
    expect(calcNewP(5 * divP1, 3, 2, div)).toBe(div * divP1 + 4)
    expect(calcNewP(5 * divP1 + div, 3, 2, div)).toBe(null)
  })

  test('Matches 1 1', () => {
    expect(calcNewP(5 * divP1 + div, 1, 1, div)).toBe(4 * divP1 + div)
    expect(calcNewP(5 * divP1, 1, 1, div)).toBe(null)
  })

  test('Matches 1 0', () => {
    expect(calcNewP(5 * divP1 + div, 1, 0, div)).toBe(4)
    expect(calcNewP(5 * divP1, 1, 1, div)).toBe(null)
  })

  test('Matches 3 1', () => {
    expect(calcNewP(5 * divP1, 3, 1, div)).toBe(5 * divP1 + div)
    expect(calcNewP(5 * divP1 + div, 3, 1, div)).toBe(null)
  })
})

describe('Bezier surface manifold tests', () => {
  test('On a square cube', () => {
    const surface = makeCube(0)
    const mesh = surface.toMeshManifold(false, { maxDepth: 4, maxError: 1e-3 })

    // Expec the cube to not be subdivided
    expect(mesh.vertices.length / 3).toBe(8)
    expect(mesh.triangles.length / 3).toBe(12)

    assertManifold(mesh)
  })

  test.each([0, 1, 2, 3, 4])('On a rounded cube, max depth %d', (maxDepth) => {
    const surface = makeCube(0.3)
    const mesh = surface.toMeshManifold(false, { maxDepth, maxError: 1e-3 })
    const nVert = mesh.vertices.length / 3
    const nTri = mesh.triangles.length / 3
    if (maxDepth == 0) {
      expect(nVert).toBe(8)
      expect(nTri).toBe(12)
    } else if (maxDepth == 1) {
      if (nVert == 16) expect(nTri).toBe(4 * 4 + 6 * 2)
      else if (nVert == 24) expect(nTri).toBe(6 * 6)
      else expect().fail(`Should be either 16 or 24 vertices, got ${nVert}`)
    } else if (maxDepth == 2) {
      expect(nVert).toBe(26)
      expect(nTri).toBe(6 * 8)
    }
    assertManifold(mesh)
  })
})
