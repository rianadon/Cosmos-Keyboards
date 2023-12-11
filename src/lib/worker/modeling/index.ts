import type { OpenCascadeInstance, TopoDS_Vertex } from '$assets/replicad_single'
import { type AnyShape, Compound, downcast, Face, getOC as ogetOC, Solid } from 'replicad'
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

export function buildSewnSolid(polygons: Face[]) {
  const oc = getOC()
  const builder = new oc.BRep_Builder()
  const shell = new oc.TopoDS_Shell()
  builder.MakeShell(shell)
  for (const poly of polygons) {
    builder.Add(shell, poly.wrapped)
  }
  const sewing = new oc.BRepBuilderAPI_Sewing(1e-6, true, true, true, false)
  sewing.Add(shell)
  sewing.Perform(new oc.Message_ProgressRange_1())
  const newShell = downcast(sewing.SewedShape())
  const solid = new oc.ShapeFix_Solid_1().SolidFromShell(newShell)
  return new Solid(solid)
}

export function buildFixedSolid(polygons: Face[]) {
  const oc = getOC()
  const builder = new oc.BRep_Builder()
  const shell = new oc.TopoDS_Shell()
  builder.MakeShell(shell)
  for (const poly of polygons) {
    builder.Add(shell, poly.wrapped)
  }
  const newShell = shell
  const solid = new oc.ShapeFix_Solid_1().SolidFromShell(newShell)
  return new Solid(solid)
}

export function buildSolid(polygons: Face[]) {
  const oc = getOC()
  const builder = new oc.BRep_Builder()
  const shell = new oc.TopoDS_Shell()
  builder.MakeShell(shell)
  for (const poly of polygons) {
    builder.Add(shell, poly.wrapped)
  }
  const solid = new oc.BRepBuilderAPI_MakeSolid_3(shell).Solid()
  return new Solid(solid)
}
