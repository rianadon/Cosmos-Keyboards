import type { OpenCascadeInstance, TopAbs_ShapeEnum, TopoDS_Shell, TopoDS_Vertex } from '$assets/replicad_single'
import { type AnyShape, Compound, downcast, Face, getOC as ogetOC, type ShapeMesh as SM, shapeType, Solid } from 'replicad'
import { Assembly } from './assembly'
import type Trsf from './transformation'

export function getOC() {
  return ogetOC() as OpenCascadeInstance
}

export function combine(objs: (AnyShape | null | undefined)[]) {
  const oc = getOC()
  const builder = new oc.BRep_Builder()
  const compound = new oc.TopoDS_Compound()
  builder.MakeCompound(compound)
  objs.forEach(o => {
    if (o) {
      builder.Add(compound, o.wrapped)
      o.delete()
    }
  })
  return new Compound(compound)
}

export function makeTriangle(a: Trsf, b: Trsf, c: Trsf) {
  const oc = getOC()
  const wire = new oc.BRepBuilderAPI_MakePolygon_6(a.vertex, b.vertex, c.vertex, true).Wire()
  const face = new oc.BRepBuilderAPI_MakeFace_15(wire, true).Face()
  return new Face(face)
}

export function makeQuad(a: Trsf, b: Trsf, c: Trsf, d: Trsf) {
  const oc = getOC()
  const wire = new oc.BRepBuilderAPI_MakePolygon_7(d.vertex, c.vertex, b.vertex, a.vertex, true).Wire()
  const face = new oc.BRepBuilderAPI_MakeFace_15(wire, true).Face()
  return new Face(face)
}

export function makePolygon(pts: TopoDS_Vertex[]) {
  const oc = getOC()
  const mp = new oc.BRepBuilderAPI_MakePolygon_1()
  for (const p of pts) {
    mp.Add_2(p)
  }
  mp.Close()
  const face = new oc.BRepBuilderAPI_MakeFace_15(mp.Wire(), true).Face()
  return new Face(face)
}

/** Convert a list of replicad faces to a TopoDS_Shell. Side effect: deletes the original faces. */
function _facesToShell(polygons: Face[]) {
  const oc = getOC()
  const builder = new oc.BRep_Builder()
  const shell = new oc.TopoDS_Shell()
  builder.MakeShell(shell)
  polygons.forEach(poly => builder.Add(shell, poly.wrapped))
  builder.delete()
  polygons.forEach(poly => poly.delete())
  return shell
}

/** Builds a TopoDS_Shell into a replicad Solid object. Side effect: deletes the original shell. */
function _shellToSolid(shell: TopoDS_Shell, fix: boolean) {
  const oc = getOC()
  const solid = fix
    ? new oc.ShapeFix_Solid_1().SolidFromShell(shell)
    : new oc.BRepBuilderAPI_MakeSolid_3(shell).Solid()
  shell.delete()
  return new Solid(solid)
}

/**
 * Sew a shell together.
 *
 * If the shell is made up of multiple distinct bodies, then a compound object
 * with each solid body is returned.
 */
export function buildSewnSolid(polygons: Face[], nonManifold: boolean) {
  const oc = getOC()
  const shell = _facesToShell(polygons)
  const sewing = new oc.BRepBuilderAPI_Sewing(1e-6, true, true, true, nonManifold)
  sewing.Add(shell)
  sewing.Perform(new oc.Message_ProgressRange_1())
  shell.delete()
  const unknownShape = sewing.SewedShape()
  switch (shapeType(unknownShape)) {
    case oc.TopAbs_ShapeEnum.TopAbs_SHELL:
      return _shellToSolid(downcast(unknownShape), true)
    case oc.TopAbs_ShapeEnum.TopAbs_COMPOUND: {
      const explorer = new oc.TopExp_Explorer_2(downcast(unknownShape), oc.TopAbs_ShapeEnum.TopAbs_SHELL as TopAbs_ShapeEnum, oc.TopAbs_ShapeEnum.TopAbs_SHAPE as TopAbs_ShapeEnum)
      const solids: Solid[] = []
      while (explorer.More()) {
        solids.push(_shellToSolid(downcast(explorer.Value()), true))
        explorer.Next()
      }
      explorer.delete()
      unknownShape.delete()
      return combine(solids)
    }
    default:
      throw new Error('Sewn solid is of unexpected shape type')
  }
}

export function buildFixedSolid(polygons: Face[]) {
  return _shellToSolid(_facesToShell(polygons), true)
}

export function buildSolid(polygons: Face[]) {
  return _shellToSolid(_facesToShell(polygons), false)
}

export function blobSTL(shape: AnyShape | Assembly, opts?: {
  tolerance?: number | undefined
  angularTolerance?: number | undefined
}): Blob {
  if (shape instanceof Assembly) return shape.blobSTL(opts)
  const oc = getOC()

  // @ts-ignore
  shape._mesh(opts)
  const filename = 'blob.stl'
  // Convert to a .STEP File
  const done = oc.StlAPI.Write(shape.wrapped, filename, false)

  if (done) {
    // Read the STEP File from the filesystem and clean up
    const file = oc.FS.readFile('/' + filename)
    oc.FS.unlink('/' + filename)

    // Return the contents of the STEP File
    const blob = new Blob([file], { type: 'application/sla' })
    return blob
  } else {
    throw new Error('WRITE STL FILE FAILED.')
  }
}

export interface ShapeMesh {
  triangles: Uint16Array
  vertices: Float32Array
  normals: Float32Array
  faceGroups: {
    start: number
    count: number
    faceId: number
  }[]
  color?: Float32Array
}
