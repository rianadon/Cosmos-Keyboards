import type { gp_Trsf, OpenCascadeInstance } from '$assets/replicad_single'
import { buildSewnSolid, makeTriangle } from '$lib/worker/modeling/index'
import Trsf from '$lib/worker/modeling/transformation'
import { stat } from 'fs/promises'
import loadMF from 'manifold-3d'
import type { CrossSection, Manifold, ManifoldToplevel } from 'manifold-3d'
import {
  type AnyShape,
  cast,
  draw,
  drawCircle,
  Drawing,
  drawRectangle,
  Face,
  getOC,
  localGC,
  makeCylinder,
  makeFace,
  makePolygon,
  makeSolid,
  type Point,
  revolution,
  Sketch,
  Solid,
  Transformation,
} from 'replicad'
import { Matrix4, Triangle, Vector3 } from 'three'

let mf: ManifoldToplevel
export async function loadManifold(): Promise<void> {
  mf = await loadMF()
  mf.setup()
}

type subdivArgs = { fn: number; fa: number; fs: number }

type CircleOp = { op: 'circle'; r: number }
type SquareOp = { op: 'square'; x: number; y: number }

type CubeOp = { op: 'cube'; x: number; y: number; z: number }
type SphereOp = { op: 'sphere'; r: number } & subdivArgs
type CylinderOp = { op: 'cylinder'; r: number; h: number } & subdivArgs
type PolyhedronOp = { op: 'polyhedron'; points: Point[]; faces: number[][] }
type SideNubOp = { op: 'sidenub'; nubHeight: number }

type TranslateOp = { op: 'translate'; x: number; y: number; z: number; obj: Operation }
type MultmatrixOp = { op: 'multmatrix'; matrix: number[][]; obj: Operation }
type MirrorOp = { op: 'mirror'; x: number; y: number; z: number; obj: Operation }
type LinearExtrudeOp = { op: 'linear_extrude'; height: number; obj: Operation } & subdivArgs
type RotateExtrudeOp = { op: 'rotate_extrude'; angle: number; obj: Operation } & subdivArgs
type OffsetOp = { op: 'offset'; r?: number; delta?: number; chamfer?: boolean; obj: Operation } & subdivArgs

type UnionOp = { op: 'union'; shapes: Operation[] }
type DifferenceOp = { op: 'difference'; shapes: Operation[] }
type IntersectionOp = { op: 'intersection'; shapes: Operation[] }
type HullOp = { op: 'hull'; shapes: Operation[] }

export type PlaneOperation = CircleOp | SquareOp
export type GeometryOperation = CubeOp | CylinderOp | PolyhedronOp | SideNubOp | SphereOp
export type TransformOperation = TranslateOp | MultmatrixOp | MirrorOp | LinearExtrudeOp | OffsetOp | RotateExtrudeOp
export type GroupOperation = UnionOp | DifferenceOp | IntersectionOp | HullOp
export type Operation = PlaneOperation | GeometryOperation | TransformOperation | GroupOperation

function stringifyBlock(ops: Operation[], indent: number) {
  const ind0 = '\n' + '  '.repeat(indent)
  const ind1 = '\n' + '  '.repeat(indent + 1)
  return '{' + ops.map(o => ind1 + stringifyOperation(o, indent + 1)) + ind0 + '}'
}

export function simplify(op: Operation) {
  switch (op.op) {
    case 'union':
      if (op.shapes.length == 0) return null
      if (op.shapes.length == 1) return simplify(op.shapes[0])
    case 'difference':
    case 'intersection':
    case 'hull':
      op.shapes = op.shapes.map(simplify).filter(o => o != null)
      return op
    case 'mirror':
    case 'linear_extrude':
    case 'rotate_extrude':
    case 'offset':
    case 'multmatrix':
    case 'translate':
      op.obj = simplify(op.obj)
      if (op.obj == null) return null
      return op
  }
  return op
}

export function stringifyOperation(op: Operation, indent = 0): string {
  // dprint-ignore
  switch (op.op) {
    case 'circle': return `circle(r=${op.r}))`
    case 'square': return `square(x=${op.x}, y=${op.y}))`
    case 'sphere': return `sphere(r=${op.r}))`
    case 'cube': return `cube(x=${op.x}, y=${op.y}, z=${op.z}))`
    case 'cylinder': return `cylinder(r=${op.r}, h=${op.h})`
    case 'polyhedron': return `polyhedron(points=${op.points}, faces=${op.faces})`
    case 'translate': return `translate(x=${op.x}, y=${op.y}, z=${op.z}) ` + stringifyOperation(op.obj, indent)
    case 'multmatrix': return `multmatrix(matrix=${op.matrix}) ` + stringifyOperation(op.obj, indent)
    case 'offset': return `offset(r=${op.r}, delta=${op.delta}, chamfer=${op.chamfer}) ` + stringifyOperation(op.obj, indent)
    case 'linear_extrude': return `linear_extrude(height=${op.height}) ` + stringifyOperation(op.obj, indent)
    case 'rotate_extrude': return `rotate_extrude(angle=${op.angle}) ` + stringifyOperation(op.obj, indent)
    case 'mirror': return `mirror() ` + stringifyOperation(op.obj, indent)
    case 'union': return `union() ` + stringifyBlock(op.shapes, indent)
    case 'difference': return `difference() ` + stringifyBlock(op.shapes, indent)
    case 'intersection': return `intersection() ` + stringifyBlock(op.shapes, indent)
    case 'hull': return `hull() ` + stringifyBlock(op.shapes, indent)
    default: throw new Error('Unmatched op')
  }
}

const filter = (x) => x.filter(s => s && s.length !== 0)

// Build a syntax tree! Helps deal with duplicated nodes
export const cube = (x, y, z) => ({ op: 'cube', x, y, z })
export const cylinder = (r, h) => ({ op: 'cylinder', r, h })
export const translate = (x, y, z, obj) => ({ op: 'translate', x, y, z, obj })
export const mirror = (x, y, z, obj) => ({ op: 'mirror', x, y, z, obj })
export const union = (shapes) => ({ op: 'union', shapes: filter(shapes) })
export const difference = (shapes) => ({ op: 'difference', shapes: filter(shapes) })
export const hull = (shapes) => ({ op: 'hull', shapes: filter(shapes) })
export const square = (x, y) => ({ op: 'square', x, y })
export const circle = (r) => ({ op: 'circle', r })
export const extrudeLinear = (c, obj) => ({ op: 'linear_extrude', height: c.height, obj })
export const extrudeRotate = (c, obj) => ({ op: 'rotate_extrude', angle: c.angle, obj })
export const scale = (x, y, z, obj) => ({ op: 'multmatrix', matrix: to2d(new Matrix4().makeScale(x, y, z).transpose().elements), obj })
export const rotate = (a, x, y, z, obj) => ({ op: 'multmatrix', matrix: to2d(new Trsf().rotate(a * 180 / Math.PI, [0, 0, 0], [x, y, z]).matrix()), obj })

const to2d = (m: number[]) => [m.slice(0, 4), m.slice(4, 8), m.slice(8, 12), m.slice(12, 16)]

export function sideNub(nubHeight: number) {
  return { op: 'sidenub', nubHeight }
}

function makeSidenub(nubHeight: number): Solid {
  const nub = draw().ellipse(-1, 1, 1, 1).lineTo([0, 5 - nubHeight])
    .close().translate(14 / 2, nubHeight).sketchOnPlane('XZ', -2.75 / 2)
    .extrude(2.75)
  return nub as Solid
}

function makePolyhedron(points: Point[], faces: number[][]) {
  console.log('start poly')
  const oc = getOC() as OpenCascadeInstance

  const fcs = faces.map(f => {
    return makePolygon(f.map(p => points[p]))
  })

  const solid = makeSolid(fcs)
  console.log('end poly')
  return solid
}

/** Convert OpenCascade B-REP to triangle mesh for Manifold */
function solidToMF(solid: Solid): Manifold {
  const occmesh = solid.mesh({ tolerance: 0.1, angularTolerance: 10 })

  // OpenCascade likes to return duplicated points.
  // However, manifold does not accept these!
  // So I need to merge points that have the same vertices
  const points: string[] = []
  const vertices: number[] = []
  function ptIndex(i: number) {
    const vert = new Vector3().fromArray(occmesh.vertices, i * 3).toArray()
    const pt = vert.join(',')
    let idx = points.indexOf(pt)
    if (idx >= 0) return idx
    idx = points.length
    points.push(pt)
    vertices.push(...vert)
    return idx
  }

  for (let i = 0; i < occmesh.triangles.length; i += 3) {
    occmesh.triangles[i] = ptIndex(occmesh.triangles[i])
    occmesh.triangles[i + 1] = ptIndex(occmesh.triangles[i + 1])
    occmesh.triangles[i + 2] = ptIndex(occmesh.triangles[i + 2])
  }

  const mesh = new mf.Mesh({
    numProp: 3,
    vertProperties: new Float32Array(vertices),
    triVerts: new Uint32Array(occmesh.triangles),
  })
  return new mf.Manifold(mesh)
}

/** Convert Manifold triangle mesh to OpenCascade B-REP */
function mfToSolid(man: Manifold): Solid {
  const mesh = man.getMesh()
  const tv = mesh.triVerts
  const vp = mesh.vertProperties
  const polygons: Face[] = []
  for (let i = 0; i < tv.length; i += 3) {
    const p1 = new Trsf().translate(new Vector3().fromArray(vp, tv[i] * 3).toArray())
    const p2 = new Trsf().translate(new Vector3().fromArray(vp, tv[i + 1] * 3).toArray())
    const p3 = new Trsf().translate(new Vector3().fromArray(vp, tv[i + 2] * 3).toArray())
    polygons.push(makeTriangle(p1, p2, p3))
  }
  const sol = buildSewnSolid(polygons, false)
  return sol
}

/** Hulls by converting to triangles, then converting back to B-Rep. */
function makeHull(shapes: Solid[]) {
  const manifolds = shapes.map(solidToMF)
  const hull = mf.Manifold.hull(manifolds)
  return mfToSolid(hull)
}

export function compute(op: Operation): Solid {
  const oc = getOC() as OpenCascadeInstance
  switch (op.op) {
    case 'cube': {
      const { x, y, z } = op
      const corner = new oc.gp_Pnt_3(-x / 2, -y / 2, -z / 2)
      return new Solid(new oc.BRepPrimAPI_MakeBox_3(corner, x, y, z).Shape())
    }
    case 'square':
      return drawRectangle(op.x, op.y) as any
    case 'circle':
      return drawCircle(op.r) as any
    case 'cylinder':
      return makeCylinder(op.r, op.h, [0, 0, -op.h / 2])
    case 'translate':
      return compute(op.obj).translate(op.x, op.y, op.z)
    case 'mirror':
      return compute(op.obj).mirror([op.x, op.y, op.z], [0, 0, 0])
    case 'union':
      return op.shapes.map(compute).reduce((a, b) => a.fuse(b))
    case 'difference':
      return op.shapes.map(compute).reduce((a, b) => a.cut(b))
    case 'sidenub':
      return makeSidenub(op.nubHeight)
    case 'polyhedron':
      return makePolyhedron(op.points, op.faces)
    case 'hull':
      return makeHull(op.shapes.map(compute))
    case 'linear_extrude':
      return ((compute(op.obj) as any as Drawing).sketchOnPlane('XY') as Sketch).extrude(op.height)
    case 'rotate_extrude': {
      const sketch = (compute(op.obj) as any as Drawing).sketchOnPlane('XY') as Sketch
      const face = makeFace(sketch.wire)
      const solid = revolution(face, sketch.defaultOrigin, undefined, op.angle)
      face.delete()
      sketch.delete()
      return solid
    }
    case 'multmatrix': {
      const transform = new Transformation() // @ts-ignore
      ;(transform.wrapped as gp_Trsf).SetValues(...op.matrix.slice(0, 3).flat())
      return new Solid(transform.transform(compute(op.obj).wrapped))
    }
    default:
      throw new Error(`Cannot compute unknown op ${op.op}`)
  }
}

export function serialize(filename: string, model: AnyShape) {
  const oc = getOC() as OpenCascadeInstance

  const writer = new oc.STEPControl_Writer_1()
  oc.Interface_Static.SetIVal('write.step.schema', 5)
  writer.Model(true).delete()
  const progress = new oc.Message_ProgressRange_1()

  writer.Transfer(model.wrapped, oc.STEPControl_StepModelType.STEPControl_AsIs, true, progress)

  // Convert to a .STEP File
  const done = writer.Write(filename + '.step')
  writer.delete()
  progress.delete()

  if (done === oc.IFSelect_ReturnStatus.IFSelect_RetDone) {
    // Read the STEP File from the filesystem and clean up
    const file = oc.FS.readFile(`/${filename}.step`)
    oc.FS.unlink(`/${filename}.step`)
    return file
  } else {
    throw new Error('WRITE STEP FILE FAILED.')
  }
}

export function serialize2(filename: string, model: Solid) {
  const oc = getOC() as OpenCascadeInstance

  const progress = new oc.Message_ProgressRange_1()
  oc.BRepTools.Write_3(model.wrapped, `./${filename}.txt`, progress)
  progress.delete()

  // Read the STEP File from the filesystem and clean up
  const file = oc.FS.readFile(`/${filename}.txt`)
  oc.FS.unlink(`/${filename}.txt`)
  return file
}

export function serialize3(filename: string, model: Solid) {
  const oc = getOC() as OpenCascadeInstance

  const progress = new oc.Message_ProgressRange_1()
  oc.BinTools.Write_3(model.wrapped, `./${filename}.bin`, progress)
  progress.delete()

  // Read the STEP File from the filesystem and clean up
  const file = oc.FS.readFile(`/${filename}.bin`)
  oc.FS.unlink(`/${filename}.bin`)
  return file
}

export async function importSTEPSpecifically(blob: Blob, name: string) {
  const oc = getOC() as OpenCascadeInstance
  const [r, gc] = localGC()

  const text = await blob.text()
  const re = new RegExp(`(#\\d*)\\s*=\\s*NEXT_ASSEMBLY_USAGE_OCCURRENCE\\([^\n;]*,'${name}'`)
  const label = text.match(re)![1]

  const fileName = Date.now().toString(36) + Math.random().toString(36).substring(2)
  const bufferView = new Uint8Array(await blob.arrayBuffer())
  oc.FS.writeFile(`/${fileName}`, bufferView)

  const reader = r(new oc.STEPControl_Reader_1())
  if (reader.ReadFile(fileName)) {
    oc.FS.unlink('/' + fileName)

    const model = reader.StepModel().get()
    const rank = model.NextNumberForLabel(label, 0, false)
    if (rank == 0) throw new Error(`Model ${label} not found`)
    reader.TransferOne(rank, r(new oc.Message_ProgressRange_1()))
    const stepShape = r(reader.OneShape())

    const shape = cast(stepShape)
    gc()
    return shape
  } else {
    oc.FS.unlink('/' + fileName)
    gc()
    throw new Error('Failed to load STEP file')
  }
}

export const maybeStat = (file: string) =>
  stat(file).catch(err => {
    if (err.code !== 'ENOENT') throw err
    return undefined
  })
