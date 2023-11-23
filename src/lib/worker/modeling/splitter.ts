import type { BOPAlgo_Splitter, OpenCascadeInstance, TopAbs_ShapeEnum, TopoDS_Shape } from '$assets/replicad_single'
import { type AnyShape, cast, getOC, Solid } from 'replicad'
import { Vector } from './transformation'

export class Splitter {
  private oc: OpenCascadeInstance
  private splitter: BOPAlgo_Splitter

  constructor() {
    this.oc = getOC()
    this.splitter = new this.oc.BOPAlgo_Splitter_1()
  }

  addArgument(shape: AnyShape | TopoDS_Shape, del = true) {
    this.splitter.AddArgument('wrapped' in shape ? shape.wrapped : shape)
    if (del) shape.delete()
  }

  addTool(shape: AnyShape | TopoDS_Shape, del = true) {
    this.splitter.AddTool('wrapped' in shape ? shape.wrapped : shape)
    if (del) shape.delete()
  }

  perform() {
    this.splitter.Perform(new this.oc.Message_ProgressRange_1())
  }

  takeBiggest() {
    const explorer = new this.oc.TopExp_Explorer_2(this.splitter.Shape(), this.oc.TopAbs_ShapeEnum.TopAbs_SOLID as TopAbs_ShapeEnum, this.oc.TopAbs_ShapeEnum.TopAbs_COMPSOLID as TopAbs_ShapeEnum)

    // Find the shape with its center furthest from the origin in the -y direction
    let bestShape: Solid | undefined = undefined
    let bestScore = -Infinity
    while (explorer.More()) {
      const shape = cast(explorer.Value())
      if (!(shape instanceof Solid)) continue
      const sc = shape.edges.length
      if (sc > bestScore) {
        if (bestShape) bestShape.delete()
        bestShape = shape
        bestScore = sc
      } else {
        shape.delete()
      }
      explorer.Next()
    }

    explorer.delete()
    this.splitter.delete()
    return bestShape
  }

  takeBy(score: (v: Vector) => number, cond: (v: Vector) => boolean = () => true) {
    const explorer = new this.oc.TopExp_Explorer_2(this.splitter.Shape(), this.oc.TopAbs_ShapeEnum.TopAbs_SOLID as TopAbs_ShapeEnum, this.oc.TopAbs_ShapeEnum.TopAbs_COMPSOLID as TopAbs_ShapeEnum)

    // Find the shape with its center furthest from the origin in the -y direction
    let bestShape: Solid | undefined = undefined
    let bestScore = -Infinity
    while (explorer.More()) {
      const shape = cast(explorer.Value())
      if (!(shape instanceof Solid)) continue
      let center = new Vector()
      let n = 0
      shape.edges.forEach(e => {
        const v = new Vector(e.startPoint.x, e.startPoint.y, e.startPoint.z)
        if (cond(v)) {
          center.add(v)
          n++
        }
      })
      center.divideScalar(n)
      const sc = score(center)
      if (sc > bestScore) {
        if (bestShape) bestShape.delete()
        bestShape = shape
        bestScore = sc
      } else {
        shape.delete()
      }
      explorer.Next()
    }

    explorer.delete()
    this.splitter.delete()
    return bestShape
  }
}
