import type { gp_Trsf, OpenCascadeInstance } from '$assets/replicad_single'
import { draw, getOC, makeCylinder, makePolygon, makeSolid, type Point, Solid, Transformation } from 'replicad'

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
type OffsetOp = { op: 'offset'; r?: number; delta?: number; chamfer?: boolean; obj: Operation } & subdivArgs

type UnionOp = { op: 'union'; shapes: Operation[] }
type DifferenceOp = { op: 'difference'; shapes: Operation[] }
type IntersectionOp = { op: 'intersection'; shapes: Operation[] }
type HullOp = { op: 'hull'; shapes: Operation[] }

export type PlaneOperation = CircleOp | SquareOp
export type GeometryOperation = CubeOp | CylinderOp | PolyhedronOp | SideNubOp | SphereOp
export type TransformOperation = TranslateOp | MultmatrixOp | MirrorOp | LinearExtrudeOp | OffsetOp
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

export function sideNub(nubHeight: number) {
  return { op: 'sidenub', nubHeight }
}

function makeSidenub(nubHeight: number): Solid {
  const nub = draw().ellipse(-1, 1, 1, 1).lineTo([0, 5 - nubHeight])
    .close().translate(14 / 2, 0).sketchOnPlane('XZ', -2.75 / 2)
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

export function compute(op: Operation): Solid {
  const oc = getOC()
  switch (op.op) {
    case 'cube': {
      const { x, y, z } = op
      const corner = new oc.gp_Pnt_3(-x / 2, -y / 2, -z / 2)
      return new Solid(new oc.BRepPrimAPI_MakeBox_3(corner, x, y, z).Shape())
    }
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
    case 'multmatrix': {
      const transform = new Transformation() // @ts-ignore
      ;(transform.wrapped as gp_Trsf).SetValues(...op.matrix.slice(0, 3).flat())
      return new Solid(transform.transform(compute(op.obj).wrapped))
    }
    default:
      throw new Error(`Cannot compute unknown op`)
  }
}

export function serialize(filename: string, model: Solid) {
  const oc = getOC()

  const writer = new oc.STEPControl_Writer_1()
  oc.Interface_Static.SetIVal('write.step.schema', 5)
  oc.Interface_Static.SetIVal('write.surfacecurve.mode', 0)
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
  const oc = getOC()

  const progress = new oc.Message_ProgressRange_1()
  oc.BRepTools.Write_3(model.wrapped, `./${filename}.txt`, progress)
  progress.delete()

  // Read the STEP File from the filesystem and clean up
  const file = oc.FS.readFile(`/${filename}.txt`)
  oc.FS.unlink(`/${filename}.txt`)
  return file
}

export function serialize3(filename: string, model: Solid) {
  const oc = getOC()

  const progress = new oc.Message_ProgressRange_1()
  oc.BinTools.Write_3(model.wrapped, `./${filename}.bin`, progress)
  progress.delete()

  // Read the STEP File from the filesystem and clean up
  const file = oc.FS.readFile(`/${filename}.bin`)
  oc.FS.unlink(`/${filename}.bin`)
  return file
}
