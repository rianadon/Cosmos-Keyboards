import { draw, Face, getOC, type PlaneName } from 'replicad'
import { BufferAttribute, ExtrudeGeometry, Shape } from 'three'
import { bezierPatch, type Curve, evalPatch, lineToCurve, loftCurves, type Patch, patchGradient, triangleNormTrsf } from '../geometry'
import { sum } from '../util'
import { buildSewnSolid, buildSolid, makeQuad, makeTriangle, type ShapeMesh } from './index'
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

  /** Create a Solid that can be used in opencascade from this surface. */
  toSolid(sew: boolean, nonManifold: boolean) {
    const faces: Face[] = []
    this.patches.forEach(p => faces.push(bezierFace(p)))
    this.triangles.forEach(([a, b, c]) => faces.push(makeTriangle(a, b, c)))
    this.quads.forEach(([a, b, c, d]) => faces.push(makeQuad(a, b, c, d)))
    return sew ? buildSewnSolid(faces, nonManifold) : buildSolid(faces)
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

function patchToMesh(p: Patch): FaceMesh {
  const mesh: FaceMesh = { vertices: [], normals: [], triangles: [] }

  let ind = 4
  function process(i00: number, i02: number, i22: number, i20: number, x0 = 0, x2 = 1, y0 = 0, y2 = 1, level = 0) {
    const x1 = (x0 + x2) / 2
    const y1 = (y0 + y2) / 2
    const p11 = evalPatchV(p, x1, y1)
    const midpoint = new Vector().fromArray(mesh.vertices, i00 * 3)
      .add(new Vector().fromArray(mesh.vertices, i02 * 3))
      .add(new Vector().fromArray(mesh.vertices, i20 * 3))
      .add(new Vector().fromArray(mesh.vertices, i22 * 3))
      .divideScalar(4)
    if (level >= 2 || midpoint.distanceTo(p11) < 3e-2) {
      mesh.triangles.push(i00, i02, i22, i00, i22, i20)
      return
    }
    const i11 = ind++
    mesh.vertices.push(...p11.xyz())
    const i10 = ind++
    mesh.vertices.push(...evalPatchV(p, x1, y0).xyz())
    const i12 = ind++
    mesh.vertices.push(...evalPatchV(p, x1, y2).xyz())
    const i01 = ind++
    mesh.vertices.push(...evalPatchV(p, x0, y1).xyz())
    const i21 = ind++
    mesh.vertices.push(...evalPatchV(p, x2, y1).xyz())
    mesh.normals.push(...patchNormal(p, x1, y1).xyz())
    mesh.normals.push(...patchNormal(p, x1, y0).xyz())
    mesh.normals.push(...patchNormal(p, x1, y2).xyz())
    mesh.normals.push(...patchNormal(p, x0, y1).xyz())
    mesh.normals.push(...patchNormal(p, x2, y1).xyz())

    process(i00, i01, i11, i10, x0, x1, y0, y1, level + 1)
    process(i01, i02, i12, i11, x0, x1, y1, y2, level + 1)
    process(i10, i11, i21, i20, x1, x2, y0, y1, level + 1)
    process(i11, i12, i22, i21, x1, x2, y1, y2, level + 1)
  }

  mesh.vertices.push(...p[0][0].xyz())
  mesh.vertices.push(...p[3][0].xyz())
  mesh.vertices.push(...p[3][3].xyz())
  mesh.vertices.push(...p[0][3].xyz())

  mesh.normals.push(...patchNormal(p, 0, 0).xyz())
  mesh.normals.push(...patchNormal(p, 0, 1).xyz())
  mesh.normals.push(...patchNormal(p, 1, 1).xyz())
  mesh.normals.push(...patchNormal(p, 1, 0).xyz())
  process(0, 1, 2, 3, 0, 1, 0, 1)
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
