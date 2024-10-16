import type { BOPAlgo_Splitter, OpenCascadeInstance, TopAbs_ShapeEnum, TopoDS_Shape } from '$assets/replicad_single'
import { type AnyShape, cast, Face, getOC, Shell, Solid, Surface } from 'replicad'
import { Vector } from './transformation'

/** Splits geometry by other pieces of geometry. */
export class Splitter {
  private oc: OpenCascadeInstance
  private splitter: BOPAlgo_Splitter
  private performed = false

  constructor() {
    this.oc = getOC()
    this.splitter = new this.oc.BOPAlgo_Splitter_1()
  }

  /**
   * Add a shape to be split.
   * @param del Whether to delete this shape after the split operation
   */
  addArgument(shape: AnyShape | TopoDS_Shape, del = true) {
    this.splitter.AddArgument('wrapped' in shape ? shape.wrapped : shape)
    if (del) shape.delete()
  }

  /**
   * Add a shape that does splitting.
   * @param del Whether to delete this shape after the split operation
   */
  addTool(shape: AnyShape | TopoDS_Shape, del = true) {
    this.splitter.AddTool('wrapped' in shape ? shape.wrapped : shape)
    if (del) shape.delete()
  }

  /** Perform the split operation */
  perform() {
    if (this.performed) throw new Error('Split already performed')
    this.performed = true
    this.splitter.Perform(new this.oc.Message_ProgressRange_1())
  }

  /** Iterates over the shapes resulting from the split then cleans up. */
  private *results<T>(typeClass: new(...args: any[]) => T, typeEnum: TopAbs_ShapeEnum) {
    if (!this.performed) throw new Error('Split has not yet been performed')
    const explorer = new this.oc.TopExp_Explorer_2(this.splitter.Shape(), typeEnum, this.oc.TopAbs_ShapeEnum.TopAbs_COMPSOLID as TopAbs_ShapeEnum)
    while (explorer.More()) {
      const shape = cast(explorer.Value())
      if (shape instanceof typeClass) {
        yield shape as T
      } else {
        shape.delete()
      }
      explorer.Next()
    }
    explorer.delete()
    this.splitter.delete()
  }

  solidResults() {
    return this.results(Solid, this.oc.TopAbs_ShapeEnum.TopAbs_SOLID as TopAbs_ShapeEnum)
  }
  shellResults() {
    return this.results(Shell, this.oc.TopAbs_ShapeEnum.TopAbs_SHELL as TopAbs_ShapeEnum)
  }

  takeBiggest() {
    // Find the shape with its center furthest from the origin in the -y direction
    let bestShape: Solid | undefined = undefined
    let bestScore = -Infinity
    for (const shape of this.solidResults()) {
      const sc = shape.edges.length
      if (sc > bestScore) {
        if (bestShape) bestShape.delete()
        bestShape = shape
        bestScore = sc
      } else {
        shape.delete()
      }
    }
    return bestShape
  }

  takeBy(score: (v: Vector) => number, cond: (v: Vector) => boolean = () => true, condShape: (s: Solid) => boolean = () => true) {
    return this.takeTopNBy(Infinity, score, cond, condShape)
  }

  takeTopNBy(num: number, score: (v: Vector) => number, cond: (v: Vector) => boolean = () => true, condShape: (s: Solid) => boolean = () => true) {
    // Find the shape with its center furthest from the origin in the -y direction
    let bestShape: Solid | undefined = undefined
    let bestScore = -Infinity
    const allResults = [...this.solidResults()]
    const results = allResults.filter(condShape).sort((a, b) => b.edges.length - a.edges.length).slice(0, num)
    for (const shape of results) {
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
        bestShape = shape
        bestScore = sc
      }
    }
    for (const shape of allResults) {
      if (shape != bestShape) shape.delete()
    }
    return bestShape
  }
}

export function splitShell(face: Face) {
  const oc = getOC() as OpenCascadeInstance
  const splitter = new oc.BOPAlgo_ShellSplitter_1()
  splitter.AddStartElement(face.wrapped)
  console.log('performing')
  splitter.Perform(new oc.Message_ProgressRange_1())
  console.log('done performing', splitter.HasErrors(), splitter.HasWarnings())
  const shells = splitter.Shells()
  console.log('Shells', shells.Size())
  const shell = splitter.Shells().First_1()
  splitter.delete()
  return new Shell(shell)
}
