import cdt2d from 'cdt2d'
import { draw, Face, getOC, type PlaneName } from 'replicad'
import { BufferAttribute, ExtrudeGeometry, Shape } from 'three'
import { bezierPatch, type Curve, evalPatch, lineToCurve, loftCurves, type Patch, patchGradient, triangleNormTrsf } from '../geometry'
import { DefaultMap, sum } from '../util'
import { buildSewnShell, buildSewnSolid, buildShell, buildSolid, makeQuad, makeTriangle, type ShapeMesh } from './index'
import Trsf from './transformation'
import { Vector } from './transformation'

type Point = [number, number]
type Triangle = [Trsf, Trsf, Trsf]
type Quad = [Trsf, Trsf, Trsf, Trsf]

export class CompBezierSurface {
  private patches: Patch[] = []
  private triangles: Triangle[] = []
  private quads: Quad[] = []

  private faces: (Patch | Triangle | Quad)[] = []

  /** Combine this surface with another surface */
  extend(b: CompBezierSurface) {
    this.faces.push(...b.faces)
    this.patches.push(...b.patches)
    this.triangles.push(...b.triangles)
    this.quads.push(...b.quads)
    return this
  }

  addPatch(p: Patch) {
    this.faces.push(p)
    this.patches.push(p)
  }

  addTriangle(a: Trsf, b: Trsf, c: Trsf) {
    this.faces.push([a, b, c])
    this.triangles.push([a, b, c])
  }

  addQuad(a: Trsf, b: Trsf, c: Trsf, d: Trsf) {
    this.faces.push([a, b, c, d])
    this.quads.push([a, b, c, d])
  }

  toMesh(): ShapeMesh {
    return facesToMesh(this.faces.map(f => {
      if (f.length == 4 && Array.isArray(f[0])) return patchToMesh(f as any)
      else if (f.length == 3) return triangleToMesh(f as any)
      return quadToMesh(f as any)
    }))
  }

  patchAdjacencyMap() {
    const edgeMap = new DefaultMap<string, Patch[]>(() => [])
    const edgeKey = (a: Vector, b: Vector) => [a.xyz().join(','), b.xyz().join(',')].sort().join('-')
    const adjacencyMap = new Map<Patch, Patch[]>()
    for (const face of this.faces) {
      const patch = face as Patch
      edgeMap.get(edgeKey(patch[0][0], patch[3][0])).push(patch)
      edgeMap.get(edgeKey(patch[3][0], patch[3][3])).push(patch)
      edgeMap.get(edgeKey(patch[3][3], patch[0][3])).push(patch)
      edgeMap.get(edgeKey(patch[0][3], patch[0][0])).push(patch)
    }

    for (const [k, v] of edgeMap.entries()) {
      // Validate edgeMap
      if (v.length != 2) throw new Error('BezierSurface edges not manifold')
      const edgeA = [v[0][0], v[0][3], v[0].map(q => q[0]), v[0].map(q => q[3])].find(e => edgeKey(e[0], e[3]) == k || edgeKey(e[3], e[0]) == k)!
      const edgeB = [v[1][0], v[1][3], v[1].map(q => q[0]), v[1].map(q => q[3])].find(e => edgeKey(e[0], e[3]) == k || edgeKey(e[3], e[0]) == k)!
      if (!edgeA.every((a, i) => a.approxEq(edgeB[i])) && !edgeA.every((a, i) => a.approxEq(edgeB[3 - i]))) {
        console.log(edgeA.map(a => a.xyz()), edgeB.map(b => b.xyz()))
        throw new Error('Edges do not match exactly')
      }
    }

    const findOpposite = ([a, b]: Patch[], p: Patch) => {
      if (a != p) return a
      if (b != p) return b
      throw new Error('BezierSurface faces not manifold')
    }

    for (const face of this.faces) {
      const patch = face as Patch
      adjacencyMap.set(patch, [
        findOpposite(edgeMap.get(edgeKey(patch[0][0], patch[3][0])), patch),
        findOpposite(edgeMap.get(edgeKey(patch[3][0], patch[3][3])), patch),
        findOpposite(edgeMap.get(edgeKey(patch[3][3], patch[0][3])), patch),
        findOpposite(edgeMap.get(edgeKey(patch[0][3], patch[0][0])), patch),
      ])
    }
    return adjacencyMap
  }

  // toMeshManifold(calculateNormals = true, quick: boolean): ShapeMesh {
  //   const vertices: number[] = []
  //   const triangles: number[] = []
  //   const normals: number[] = []
  //   const faceGroups: ShapeMesh['faceGroups'] = []

  //   const blocks: number[] = []
  //   const nblock = quick ? 3 : 9
  //   for (let i = 0; i <= nblock; i++) {
  //     blocks.push(i / nblock)
  //   }

  //   const edgeMap = new DefaultMap<Vector, Map<Vector, number[]>>(() => new Map())
  //   ;(this.faces as Patch[]).forEach((patch, faceIndex) => {
  //     const patchVertices = blocks.map(() => new Array(blocks.length))
  //     const n = blocks.length - 1

  //     // Look up preexisting vertices for edges
  //     const e00_03 = edgeMap.get(patch[0][0]).get(patch[0][3])
  //     const e03_33 = edgeMap.get(patch[0][3]).get(patch[3][3])
  //     const e33_30 = edgeMap.get(patch[3][3]).get(patch[3][0])
  //     const e30_00 = edgeMap.get(patch[3][0]).get(patch[0][0])
  //     if (e00_03) patchVertices.forEach((r, i) => r[0] = e00_03[i])
  //     if (e03_33) patchVertices[n] = e03_33
  //     if (e33_30) patchVertices.forEach((r, i) => r[n] = e33_30[n - i])
  //     if (e30_00) patchVertices[0] = e30_00.toReversed()

  //     for (let i = 0; i < blocks.length; i++) {
  //       for (let j = 0; j < blocks.length; j++) {
  //         if (typeof patchVertices[i][j] !== 'undefined') continue
  //         patchVertices[i][j] = vertices.length / 3
  //         vertices.push(...evalPatchV(patch, blocks[i], blocks[j]).xyz())
  //         if (calculateNormals) normals.push(...patchNormal(patch, blocks[i], blocks[j]).xyz())
  //       }
  //     }

  //     // Set edgemap for opposite edges
  //     edgeMap.get(patch[0][3]).set(patch[0][0], patchVertices.map(r => r[0]).toReversed())
  //     edgeMap.get(patch[3][3]).set(patch[0][3], patchVertices[n].toReversed())
  //     edgeMap.get(patch[3][0]).set(patch[3][3], patchVertices.map(r => r[n]))
  //     edgeMap.get(patch[0][0]).set(patch[3][0], patchVertices[0])

  //     // Add triangles
  //     const trianglesStart = triangles.length
  //     for (let i = 0; i < blocks.length - 1; i++) {
  //       for (let j = 0; j < blocks.length - 1; j++) {
  //         triangles.push(
  //           patchVertices[i][j],
  //           patchVertices[i][j + 1],
  //           patchVertices[i + 1][j],
  //         )
  //         triangles.push(
  //           patchVertices[i][j + 1],
  //           patchVertices[i + 1][j + 1],
  //           patchVertices[i + 1][j],
  //         )
  //       }
  //     }

  //     // Add facegroup
  //     faceGroups.push({
  //       start: trianglesStart / 3,
  //       count: (triangles.length - trianglesStart) / 3,
  //       faceId: faceIndex,
  //     })
  //   })
  //   return {
  //     vertices: new Float32Array(vertices),
  //     normals: new Float32Array(normals),
  //     triangles: new Uint16Array(triangles),
  //     faceGroups,
  //   }
  // }
  static tMMConfig(quick: boolean) {
    if (quick) return { maxDepth: 4, maxError: 0.3 }
    else return { maxDepth: 8, maxError: 0.2 }
  }

  toMeshManifold(calculateNormals = true, options: { maxDepth: number; maxError: number }): ShapeMesh {
    type KDTree = { depth: number; patch: Patch; u0: number; u2: number; v0: number; v2: number; children?: [KDTree, KDTree]; cache: UVCache }
    const { maxDepth, maxError } = options
    const divisor = 2 << maxDepth
    const divP1 = divisor + 1

    const adjacency = this.patchAdjacencyMap()
    const centroid = new Vector()
    const normal = new Vector()
    const dist = new Vector()
    const points = new Map<Patch, Set<number>>()
    const outPoints = new Map<Patch, Map<number, number>>()
    const caches = new Map<Patch, UVCache>()
    for (const face of this.faces) {
      const patch = face as Patch
      const tree: KDTree = { patch, depth: 0, u0: 0, u2: divisor, v0: 0, v2: divisor, cache: new UVCache(patch, divisor) }
      const work: KDTree[] = [tree]
      const pointSet = new Set<number>()
      points.set(patch, pointSet)
      caches.set(patch, tree.cache)
      while (work.length) {
        const item = work.pop()!
        const { u0, u2, v0, v2 } = item
        pointSet.add(u0 * divP1 + v0)
        pointSet.add(u2 * divP1 + v0)
        pointSet.add(u0 * divP1 + v2)
        pointSet.add(u2 * divP1 + v2)
        const v00 = item.cache.getUV(u0, v0)
        const v02 = item.cache.getUV(u0, v2)
        const v20 = item.cache.getUV(u2, v0)
        const v22 = item.cache.getUV(u2, v2)
        if (item.depth >= maxDepth) continue
        centroid.addVectors(v00, v02).add(v20).add(v22).divideScalar(4)
        normalFromFourPoints(normal, v00, v02, v20, v22)
        const u1 = (u0 + u2) / 2
        const v1 = (v0 + v2) / 2
        const v10 = item.cache.getUV(u1, v0)
        const v01 = item.cache.getUV(u0, v1)
        const v12 = item.cache.getUV(u1, v2)
        const v21 = item.cache.getUV(u2, v1)
        const uError = Math.abs(dist.subVectors(v10, centroid).dot(normal)) + Math.abs(dist.subVectors(v12, centroid).dot(normal))
        const vError = Math.abs(dist.subVectors(v01, centroid).dot(normal)) + Math.abs(dist.subVectors(v21, centroid).dot(normal))
        // console.log('error (u,v)', uError, vError  )
        if (uError < maxError && vError < maxError) continue
        if (uError > vError) {
          item.children = [
            { patch: item.patch, depth: item.depth + 1, u0, u2: u1, v0, v2, cache: item.cache },
            { patch: item.patch, depth: item.depth + 1, u0: u1, u2, v0, v2, cache: item.cache },
          ]
          work.push(item.children[0], item.children[1])
        } else {
          item.children = [
            { patch: item.patch, depth: item.depth + 1, u0, u2, v0, v2: v1, cache: item.cache },
            { patch: item.patch, depth: item.depth + 1, u0, u2, v0: v1, v2, cache: item.cache },
          ]
          work.push(item.children[0], item.children[1])
        }
      }
    }
    for (const face of this.faces) {
      const patch = face as Patch
      const outMap = new Map<number, number>()
      outPoints.set(patch, outMap)
      for (const pt of points.get(patch)!) {
        outMap.set(pt, -1)
      }
    }

    let vertices = 0
    const outVert: number[] = []
    const outTri: number[] = []
    for (const face of this.faces) {
      const patch = face as Patch
      const pt = new Set(points.get(patch))
      const cache = caches.get(patch)!
      const [a0003, a0333, a3330, a3000] = adjacency.get(patch)!
      const e0003 = adjacency.get(a0003)!.indexOf(patch)
      const e0333 = adjacency.get(a0333)!.indexOf(patch)
      const e3330 = adjacency.get(a3330)!.indexOf(patch)
      const e3000 = adjacency.get(a3000)!.indexOf(patch)
      const outMap = outPoints.get(patch)!
      // console.log(pt.size, 'points')
      // for (const newP of pt) {
      //   console.log('pt', cache.getUVAssertExists(Math.floor(newP / divP1), newP % divP1).xyz())
      // }
      for (const p of outMap.keys()) {
        if (outMap.get(p) == -1) {
          outVert.push(...cache.getUVAssertExists(Math.floor(p / divP1), p % divP1).xyz())
          outMap.set(p, vertices++)
        }
      }
      for (const apt of points.get(a0003)!) {
        const newP = calcNewP(apt, e0003, 0, divisor)
        if (newP === null) continue
        // console.log(cache.getUVAssertExists(Math.floor(newP / divP1), newP % divP1).xyz(), newP, apt, this.faces.indexOf(a0003), e0003, 0)
        if (pt.has(newP)) outPoints.get(a0003)!.set(apt, outMap.get(newP)!)
        else {
          if (outPoints.get(a0003)!.get(apt) == -1) {
            outVert.push(...caches.get(a0003)!.getUVAssertExists(Math.floor(apt / divP1), apt % divP1).xyz())
            outPoints.get(a0003)!.set(apt, vertices++)
          }
          pt.add(newP)
          outMap.set(newP, outPoints.get(a0003)!.get(apt)!)
        }
      }
      for (const apt of points.get(a0333)!) {
        const newP = calcNewP(apt, e0333, 1, divisor)
        if (newP === null) continue
        // console.log(cache.getUVAssertExists(Math.floor(newP / divP1), newP % divP1).xyz(), newP, apt, this.faces.indexOf(a0333))
        if (pt.has(newP)) outPoints.get(a0333)!.set(apt, outMap.get(newP)!)
        else {
          if (outPoints.get(a0333)!.get(apt) == -1) {
            outVert.push(...caches.get(a0333)!.getUVAssertExists(Math.floor(apt / divP1), apt % divP1).xyz())
            outPoints.get(a0333)!.set(apt, vertices++)
          }
          pt.add(newP)
          outMap.set(newP, outPoints.get(a0333)!.get(apt)!)
        }
      }
      for (const apt of points.get(a3330)!) {
        const newP = calcNewP(apt, e3330, 2, divisor)
        if (newP === null) continue
        // console.log(cache.getUVAssertExists(Math.floor(newP / divP1), newP % divP1).xyz(), newP, apt, this.faces.indexOf(a3330), e3330, 2)
        if (pt.has(newP)) outPoints.get(a3330)!.set(apt, outMap.get(newP)!)
        else {
          if (outPoints.get(a3330)!.get(apt) == -1) {
            outVert.push(...caches.get(a3330)!.getUVAssertExists(Math.floor(apt / divP1), apt % divP1).xyz())
            outPoints.get(a3330)!.set(apt, vertices++)
          }
          pt.add(newP)
          outMap.set(newP, outPoints.get(a3330)!.get(apt)!)
        }
      }
      for (const apt of points.get(a3000)!) {
        const newP = calcNewP(apt, e3000, 3, divisor)
        if (newP === null) continue
        // console.log(cache.getUVAssertExists(Math.floor(newP / divP1), newP % divP1).xyz(), newP, apt, this.faces.indexOf(a3000), e3000, 3)
        if (pt.has(newP)) outPoints.get(a3000)!.set(apt, outMap.get(newP)!)
        else {
          if (outPoints.get(a3000)!.get(apt) == -1) {
            outVert.push(...caches.get(a3000)!.getUVAssertExists(Math.floor(apt / divP1), apt % divP1).xyz())
            outPoints.get(a3000)!.set(apt, vertices++)
          }
          pt.add(newP)
          outMap.set(newP, outPoints.get(a3000)!.get(apt)!)
        }
      }
      // console.log(this.faces.map(f => outPoints.get(f)))
      const allInd = Array.from(pt)
      const allPoints = allInd.map(p => [Math.floor(p / divP1), p % divP1])
      // console.log(allPoints.map(p => p.join(',')).join('\n') + '\n')
      const triangulation = cdt2d(allPoints, [])
      for (const triangle of triangulation) {
        outTri.push(outMap.get(allInd[triangle[2]])!)
        outTri.push(outMap.get(allInd[triangle[1]])!)
        outTri.push(outMap.get(allInd[triangle[0]])!)
      }
      // console.log(triangulation, outMap)
      // console.log()
      // for (const [newP, vert] of outMap) {
      //   console.log('end', cache.getUVAssertExists(Math.floor(newP / divP1), newP % divP1).xyz(), newP, vert)
      // }
      // console.log()
    }
    return {
      vertices: new Float32Array(outVert),
      normals: new Float32Array(),
      triangles: new Uint16Array(outTri),
      faceGroups: [],
    }
  }
  /** Create a Solid that can be used in opencascade from this surface. */
  toSolid(sew: boolean, nonManifold: boolean) {
    const faces: Face[] = []
    this.patches.forEach(p => faces.push(bezierFace(p)))
    this.triangles.forEach(([a, b, c]) => faces.push(makeTriangle(a, b, c)))
    this.quads.forEach(([a, b, c, d]) => faces.push(makeQuad(a, b, c, d)))
    return sew ? buildSewnSolid(faces, nonManifold) : buildSolid(faces)
  }

  /** Create a Shell that can be used in opencascade from this surface. */
  toShell(sew: boolean, nonManifold: boolean) {
    const faces: Face[] = []
    this.patches.forEach(p => faces.push(bezierFace(p)))
    this.triangles.forEach(([a, b, c]) => faces.push(makeTriangle(a, b, c)))
    this.quads.forEach(([a, b, c, d]) => faces.push(makeQuad(a, b, c, d)))
    return sew ? buildSewnShell(faces, nonManifold) : buildShell(faces)
  }

  transform(t: Trsf) {
    const mat = t.Matrix4()
    this.patches.forEach(p => {
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          p[i][j].applyMatrix4(mat)
        }
      }
    })
    this.triangles.forEach(tr => {
      tr[0] = tr[0].premultiplied(t)
      tr[1] = tr[1].premultiplied(t)
      tr[2] = tr[2].premultiplied(t)
    })
    this.quads.forEach(q => {
      q[0] = q[0].premultiplied(t)
      q[1] = q[1].premultiplied(t)
      q[2] = q[2].premultiplied(t)
      q[3] = q[3].premultiplied(t)
    })
  }
}

interface FaceMesh {
  triangles: number[]
  vertices: number[]
  normals: number[]
}

function triangleToMesh([a, b, c]: Triangle): FaceMesh {
  const normal = triangleNormTrsf(a, b, c)
  return {
    vertices: [...a.xyz(), ...b.xyz(), ...c.xyz()],
    normals: [...normal.xyz(), ...normal.xyz(), ...normal.xyz()],
    triangles: [0, 1, 2],
  }
}

function quadToMesh([a, b, c, d]: Quad): FaceMesh {
  const normal = triangleNormTrsf(a, b, c)
  return {
    vertices: [...a.xyz(), ...b.xyz(), ...c.xyz(), ...d.xyz()],
    normals: [...normal.xyz(), ...normal.xyz(), ...normal.xyz(), ...normal.xyz()],
    triangles: [0, 1, 3, 1, 2, 3],
  }
}

function evalPatchV(p: Patch, u: number, v: number) {
  return new Vector(
    evalPatch(p.map(a => a.map(b => b.x)), u, v),
    evalPatch(p.map(a => a.map(b => b.y)), u, v),
    evalPatch(p.map(a => a.map(b => b.z)), u, v),
  )
}

function patchGradientV(p: Patch, u: number, v: number) {
  const [ux, vx] = patchGradient(p.map(a => a.map(b => b.x)), u, v)
  const [uy, vy] = patchGradient(p.map(a => a.map(b => b.y)), u, v)
  const [uz, vz] = patchGradient(p.map(a => a.map(b => b.z)), u, v)
  return [new Vector(ux, uy, uz), new Vector(vx, vy, vz)]
}

function patchNormal(p: Patch, u: number, v: number) {
  if (u == 0) u = 1e-5
  if (v == 0) v = 1e-5
  if (u == 1) u -= 1e-5
  if (v == 1) v -= 1e-5
  const [x, y] = patchGradientV(p, u, v)
  return y.cross(x)
}

// function patchToMesh(p: Patch): FaceMesh {
//   const mesh: FaceMesh = { vertices: [], normals: [], triangles: [] }

//   let ind = 4
//   function process(i00: number, i02: number, i22: number, i20: number, x0 = 0, x2 = 1, y0 = 0, y2 = 1, level = 0) {
//     const x1 = (x0 + x2) / 2
//     const y1 = (y0 + y2) / 2
//     const p11 = evalPatchV(p, x1, y1)
//     const midpoint = new Vector().fromArray(mesh.vertices, i00 * 3)
//       .add(new Vector().fromArray(mesh.vertices, i02 * 3))
//       .add(new Vector().fromArray(mesh.vertices, i20 * 3))
//       .add(new Vector().fromArray(mesh.vertices, i22 * 3))
//       .divideScalar(4)
//     if (level >= 2 || midpoint.distanceTo(p11) < 3e-2) {
//       mesh.triangles.push(i00, i02, i22, i00, i22, i20)
//       return
//     }
//     const i11 = ind++
//     mesh.vertices.push(...p11.xyz())
//     const i10 = ind++
//     mesh.vertices.push(...evalPatchV(p, x1, y0).xyz())
//     const i12 = ind++
//     mesh.vertices.push(...evalPatchV(p, x1, y2).xyz())
//     const i01 = ind++
//     mesh.vertices.push(...evalPatchV(p, x0, y1).xyz())
//     const i21 = ind++
//     mesh.vertices.push(...evalPatchV(p, x2, y1).xyz())
//     mesh.normals.push(...patchNormal(p, x1, y1).xyz())
//     mesh.normals.push(...patchNormal(p, x1, y0).xyz())
//     mesh.normals.push(...patchNormal(p, x1, y2).xyz())
//     mesh.normals.push(...patchNormal(p, x0, y1).xyz())
//     mesh.normals.push(...patchNormal(p, x2, y1).xyz())

//     process(i00, i01, i11, i10, x0, x1, y0, y1, level + 1)
//     process(i01, i02, i12, i11, x0, x1, y1, y2, level + 1)
//     process(i10, i11, i21, i20, x1, x2, y0, y1, level + 1)
//     process(i11, i12, i22, i21, x1, x2, y1, y2, level + 1)
//   }

//   mesh.vertices.push(...p[0][0].xyz())
//   mesh.vertices.push(...p[3][0].xyz())
//   mesh.vertices.push(...p[3][3].xyz())
//   mesh.vertices.push(...p[0][3].xyz())

//   mesh.normals.push(...patchNormal(p, 0, 0).xyz())
//   mesh.normals.push(...patchNormal(p, 0, 1).xyz())
//   mesh.normals.push(...patchNormal(p, 1, 1).xyz())
//   mesh.normals.push(...patchNormal(p, 1, 0).xyz())
//   process(0, 1, 2, 3, 0, 1, 0, 1)
//   return mesh
// }

function patchToMesh(p: Patch): FaceMesh {
  const mesh: FaceMesh = { vertices: [], normals: [], triangles: [] }
  let blocks: number[] = []
  for (let i = 0; i <= 7; i++) {
    blocks.push(i / 7)
  }
  for (let i = 0; i < blocks.length; i++) {
    for (let j = 0; j < blocks.length; j++) {
      mesh.vertices.push(...evalPatchV(p, blocks[i], blocks[j]).xyz())
      mesh.normals.push(...patchNormal(p, blocks[i], blocks[j]).xyz())
    }
  }
  const n = blocks.length
  for (let i = 0; i < blocks.length - 1; i++) {
    for (let j = 0; j < blocks.length - 1; j++) {
      mesh.triangles.push(i * n + j, i * n + (j + 1), (i + 1) * n + j)
      mesh.triangles.push(i * n + (j + 1), (i + 1) * n + (j + 1), (i + 1) * n + j)
    }
  }
  return mesh
}

function facesToMesh(faces: FaceMesh[]): ShapeMesh {
  const nVertices = sum(faces.map(f => f.vertices.length))
  const nTriangles = sum(faces.map(f => f.triangles.length))
  const mesh: ShapeMesh = {
    vertices: new Float32Array(nVertices),
    normals: new Float32Array(nVertices),
    triangles: new Uint16Array(nTriangles),
    faceGroups: [],
  }

  let vertexIndex = 0, triangleIndex = 0
  faces.forEach((face, i) => {
    mesh.vertices.set(face.vertices, vertexIndex)
    mesh.normals.set(face.normals, vertexIndex)
    for (let i = 0; i < face.triangles.length; i++) {
      mesh.triangles[i + triangleIndex] = face.triangles[i] + vertexIndex / 3
    }

    mesh.faceGroups.push({
      start: triangleIndex / 3,
      count: face.triangles.length / 3,
      faceId: i,
    })

    vertexIndex += face.vertices.length
    triangleIndex += face.triangles.length
  })
  return mesh
}

export function bezierFace(patch: Patch) {
  const oc = getOC()
  const pts = new oc.TColgp_Array2OfPnt_2(1, 4, 1, 4)
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const pt = new oc.gp_Pnt_3(patch[i][j].x, patch[i][j].y, patch[i][j].z)
      pts.SetValue(i + 1, j + 1, pt)
    }
  }
  const surface = new oc.Geom_BezierSurface_1(pts)
  const face = new oc.BRepBuilderAPI_MakeFace_8(new oc.Handle_Geom_Surface_2(surface), 1e-3).Face()
  return new Face(face)
}

// export class BezierSketch {
//   constructor(private lines: Point[][]) {
//   }

//   sketchOnPlane(plane: 'XY') {
//     const sketcher = new Sketcher(plane)
//     sketcher.movePointerTo(this.lines[0][0])
//     for (const line of this.lines) {
//       if (line.length == 2) sketcher.lineTo(line[1])
//       if (line.length == 4) sketcher.bezierCurveTo(line[3], [line[1], line[2]])
//     }
//     return sketcher.close()
//   }

//   extrudeMesh(height: number) {
//     const surface = new CompBezierSurface()
//     const pts = this.lines.map(l => l[0])
//     const trsfsTop = pts.map(p => new Trsf().translate(p[0], p[1], 0))
//     const trsfsBot = pts.map(p => new Trsf().translate(p[0], p[1], height))
//     // Enforce the boundary as the constraint
//     const triangulation = cdt2d(pts, pts.map((_, i) => [i, (i + 1) % pts.length]))
//     const toTrsf = (p: Point) => new Trsf().translate(p[0], p[1], 0)
//     for (const [a, b, c] of triangulation) {
//       // Skip triangles outside the boundary
//       if (!(a > b && b > c) && !(b > c && c > a) && !(c > a && a > b)) continue
//       // Find matching edges
//       const e0 = this.lines.find(l => l[0] == pts[b] && l[l.length - 1] == pts[a])
//       const e1 = this.lines.find(l => l[0] == pts[c] && l[l.length - 1] == pts[b])
//       const e2 = this.lines.find(l => l[0] == pts[a] && l[l.length - 1] == pts[c])
//       if (e0?.length == 4 || e1?.length == 4 || e2?.length == 4) {
//         const le0: Curve = e0 ? [trsfsTop[b], toTrsf(e0[1]), toTrsf(e0[2]), trsfsTop[a]] : lineToCurve(trsfsTop[b], trsfsTop[a])
//         const le1: Curve = e1 ? [trsfsTop[c], toTrsf(e1[1]), toTrsf(e1[2]), trsfsTop[b]] : lineToCurve(trsfsTop[c], trsfsTop[b])
//         const le2: Curve = e2 ? [trsfsTop[a], toTrsf(e2[1]), toTrsf(e2[2]), trsfsTop[c]] : lineToCurve(trsfsTop[a], trsfsTop[c])
//         surface.addPatch(bezierPatch(le0, le1, le2))
//         const le0b = le0.map(e => e.translated(0, 0, height)) as Curve
//         const le1b = le1.map(e => e.translated(0, 0, height)) as Curve
//         const le2b = le2.map(e => e.translated(0, 0, height)) as Curve
//         surface.addPatch(bezierPatch(le2b, le1b, le0b))
//         if (e0) surface.addPatch(loftCurves(le0, le0b))
//         if (e1) surface.addPatch(loftCurves(le1, le1b))
//         if (e2) surface.addPatch(loftCurves(le2, le2b))
//       } else {
//         surface.addTriangle(trsfsTop[a], trsfsTop[b], trsfsTop[c])
//         surface.addTriangle(trsfsBot[c], trsfsBot[b], trsfsBot[a])
//         if (e0) surface.addQuad(trsfsTop[b], trsfsTop[a], trsfsBot[a], trsfsBot[b])
//         if (e1) surface.addQuad(trsfsTop[c], trsfsTop[b], trsfsBot[b], trsfsBot[c])
//         if (e2) surface.addQuad(trsfsTop[a], trsfsTop[c], trsfsBot[c], trsfsBot[a])
//       }
//     }
//     return surface
//   }
// }

// export class BezierSketcher {
//   private beginning: Point = [0, 0]
//   private pointer: Point = [0, 0]
//   private lines: Point[][] = []

//   movePointerTo(point: Point) {
//     this.beginning = point
//     this.pointer = point
//     return this
//   }

//   bezierCurveTo(point: Point, [a, b]: [Point, Point]) {
//     this.lines.push([this.pointer, a, b, point])
//     this.pointer = point
//     return this
//   }

//   lineTo(point: Point) {
//     this.lines.push([this.pointer, point])
//     this.pointer = point
//     return this
//   }

//   close() {
//     if (this.pointer[0] != this.beginning[0] || this.pointer[1] != this.beginning[1]) {
//       this.lineTo(this.beginning)
//     }
//     return new BezierSketch(this.lines)
//   }
// }

export class BezierSketch {
  constructor(private sketcher: Shape, private ops: [string, any[]][]) {
  }

  extrudeMesh(depth: number): ShapeMesh {
    const shape = new ExtrudeGeometry(this.sketcher, {
      curveSegments: 24,
      depth: -depth,
      steps: 1,
      bevelEnabled: false,
    }).translate(0, 0, depth)
    const index = new Uint16Array((shape.attributes['position'] as BufferAttribute).array.length / 3)
    for (let i = 0; i < index.length; i++) index[i] = i
    return {
      vertices: (shape.attributes['position'] as BufferAttribute).array as Float32Array,
      normals: (shape.attributes['normal'] as BufferAttribute).array as Float32Array,
      triangles: index,
      faceGroups: [],
    }
  }

  sketchOnPlane(inputPlane?: PlaneName, origin?: number | Point) {
    const sketch = draw()
    // @ts-ignore
    this.ops.forEach(([op, args]) => sketch[op].apply(sketch, args))
    return sketch.close().sketchOnPlane(inputPlane, origin)
  }
}

export class BezierSketcher {
  private shape = new Shape()
  private ops: [string, any[]][] = []

  movePointerTo(p: Point) {
    this.shape.moveTo(p[0], p[1])
    this.ops.push(['movePointerTo', [p]])
    return this
  }

  lineTo(point: Point) {
    this.shape.lineTo(point[0], point[1])
    this.ops.push(['lineTo', [point]])
    return this
  }

  bezierCurveTo(point: Point, [a, b]: [Point, Point]) {
    this.shape.bezierCurveTo(a[0], a[1], b[0], b[1], point[0], point[1])
    this.ops.push(['bezierCurveTo', [point, [a, b]]])
    return this
  }

  close() {
    return new BezierSketch(this.shape, this.ops)
  }
}

class UVCache extends Map<number, Vector> {
  private divP1: number

  constructor(private patch: Patch, private divisor: number) {
    super()
    this.setUV(0, 0, patch[0][0])
    this.setUV(0, divisor, patch[3][0])
    this.setUV(divisor, 0, patch[0][3])
    this.setUV(divisor, divisor, patch[3][3])
    this.divP1 = divisor + 1
  }

  private _key(u: number, v: number) {
    return u * this.divP1 + v
  }

  setUV(u: number, v: number, vec: Vector) {
    this.set(this._key(u, v), vec)
  }

  getUV(u: number, v: number) {
    const key = this._key(u, v)
    const existing = this.get(key)
    if (existing) return existing
    const value = evalPatchV(this.patch, u / this.divisor, v / this.divisor)
    this.set(key, value)
    return value
  }

  getUVAssertExists(u: number, v: number) {
    const key = this._key(u, v)
    const existing = this.get(key)
    if (!existing) throw new Error('UV not in cache')
    return existing
  }
}

function normalFromFourPoints(out: Vector, p1: Vector, p2: Vector, p3: Vector, p4: Vector) {
  // p2 - p1
  const a1x = p2.x - p1.x
  const a1y = p2.y - p1.y
  const a1z = p2.z - p1.z

  // p3 - p1
  const b1x = p3.x - p1.x
  const b1y = p3.y - p1.y
  const b1z = p3.z - p1.z

  // p3 - p1
  const a2x = p3.x - p1.x
  const a2y = p3.y - p1.y
  const a2z = p3.z - p1.z

  // p4 - p1
  const b2x = p4.x - p1.x
  const b2y = p4.y - p1.y
  const b2z = p4.z - p1.z

  // p4 - p1
  const a3x = p4.x - p1.x
  const a3y = p4.y - p1.y
  const a3z = p4.z - p1.z

  // p2 - p1
  const b3x = p2.x - p1.x
  const b3y = p2.y - p1.y
  const b3z = p2.z - p1.z

  // p3 - p2
  const a4x = p3.x - p2.x
  const a4y = p3.y - p2.y
  const a4z = p3.z - p2.z

  // p4 - p2
  const b4x = p4.x - p2.x
  const b4y = p4.y - p2.y
  const b4z = p4.z - p2.z

  out.x = a1y * b1z - a1z * b1y + a2y * b2z - a2z * b2y + a3y * b3z - a3z * b3y + a4y * b4z - a4z * b4y
  out.y = a1z * b1x - a1x * b1z + a2z * b2x - a2x * b2z + a3z * b3x - a3x * b3z + a4z * b4x - a4x * b4z
  out.z = a1x * b1y - a1y * b1x + a2x * b2y - a2y * b2x + a3x * b3y - a3y * b3x + a4x * b4y - a4y * b4x
  return out.normalize()
}

// export function calcNewPExact(aPt: number, aEdge: number, bEdge: number, div: number) {
//   const divP1 = div + 1

//   const aU = Math.floor(aPt / divP1)
//   const aV = aPt % divP1

//   let interp
//   if (aEdge == 0) {
//     if (aU != 0) return null
//     interp = aV
//   } else if (aEdge == 1) {
//     if (aV != div) return null
//     interp = aU
//   } else if (aEdge == 2) {
//     if (aU != div) return null
//     interp = aV
//   } else if (aEdge == 3) {
//     if (aV != 0) return null
//     interp = aU
//   } else {
//     return null
//   }

//   const v00 = [-1, -1]
//   const v01 = [-1, 1]
//   const v10 = [1, -1]
//   const v11 = [1, 1]
//   const vertices = [v00, v10, v11, v01]
//   const rotation = (aEdge - bEdge + 6) % 4
//   const angle = rotation * Math.PI / 2
//   let newV = vertices.map(([a, b]) => [Math.round(a * Math.cos(angle) - b * Math.sin(angle)), Math.round(a * Math.sin(angle) + b * Math.cos(angle))])
//   let edge: [number, number][]
//   if (bEdge == 0) {
//     newV = newV.map(([a, b]) => [a - 2, b])
//     edge = [vertices[3], vertices[0]]
//   }
//   if (bEdge == 1) {
//     newV = newV.map(([a, b]) => [a, b + 2])
//     edge = [vertices[2], vertices[3]]
//   }
//   if (bEdge == 3) {
//     newV = newV.map(([a, b]) => [a, b - 2])
//     edge = [vertices[0], vertices[1]]
//   }
//   if (bEdge == 2) {
//     newV = newV.map(([a, b]) => [a + 2, b])
//     edge = [vertices[1], vertices[2]]
//   }
//   // console.log('vnv', edge, newV)
//   // const adj = newV.findIndex((_, i) => edge[0][0] == newV[i][0] && edge[0][1] == newV[i][1] && edge[1][0] == newV[(i + 1) % 4][0] && edge[1][1] == newV[(i + 1) % 4][1])
//   const opp = newV.findIndex((_, i) => edge[1][0] == newV[i][0] && edge[1][1] == newV[i][1] && edge[0][0] == newV[(i + 1) % 4][0] && edge[0][1] == newV[(i + 1) % 4][1])
//   // console.log('try', opp)
//   // console.log(edge[1], edge[0], newV[opp], newV[(opp + 1) % 4])
//   const VS = ['00', '10', '11', '01']
//   // console.log(
//   //   aEdge,
//   //   bEdge,
//   //   VS[vertices.indexOf(edge[0])],
//   //   VS[vertices.indexOf(edge[1])],
//   //   '<-',
//   //   VS[(opp + 1) % 4],
//   //   VS[opp],
//   // )
//   const [mya, myb, yua, yub] = [VS[vertices.indexOf(edge[0])], VS[vertices.indexOf(edge[1])], VS[(opp + 1) % 4], VS[opp]]
//   const uExtract = yua[0] == yub[0] ? 1 : 0
//   const mExtract = mya[0] == myb[0] ? 1 : 0
//   const reversed = mya[mExtract] != yua[uExtract]
//   // console.log(mExtract, reversed)

//   const myU = mya[0] == '0' ? 0 : div
//   const myV = mya[1] == '0' ? 0 : div
//   // console.log('myuv', myU, myV)

//   if (reversed) interp = div - interp
//   if (mExtract == 0) {
//     return interp * divP1 + myV
//   } else {
//     return myU * divP1 + interp
//   }
// }

export function calcNewP(aPt: number, aEdge: number, bEdge: number, div: number) {
  const divP1 = div + 1

  const aU = Math.floor(aPt / divP1)
  const aV = aPt % divP1

  const bUV = (u: number, v: number) => u * divP1 + v

  let interp: number
  if (aEdge == 0) {
    if (aU != 0) return null
    interp = aV
  } else if (aEdge == 1) {
    if (aV != div) return null
    interp = aU
  } else if (aEdge == 2) {
    if (aU != div) return null
    interp = aV
  } else if (aEdge == 3) {
    if (aV != 0) return null
    interp = aU
  } else {
    return null
  }

  // True if a,b in {0,1} or a,b in {2,3}
  const reversed = (aEdge ^ bEdge) < 2
  if (reversed) interp = div - interp

  if (bEdge == 0) {
    return bUV(0, interp)
  } else if (bEdge == 1) {
    return bUV(interp, div)
  } else if (bEdge == 2) {
    return bUV(div, interp)
  } else if (bEdge == 3) {
    return bUV(interp, 0)
  } else {
    return null
  }
}
