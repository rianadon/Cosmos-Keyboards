import type { TopoDS_Shape } from '$assets/replicad_single'
import { type AnyShape, Solid } from 'replicad'
import { Vector } from './transformation'
export declare class Splitter {
  private oc
  private splitter
  constructor()
  addArgument(shape: AnyShape | TopoDS_Shape, del?: boolean): void
  addTool(shape: AnyShape | TopoDS_Shape, del?: boolean): void
  perform(): void
  takeBiggest(): Solid
  takeBy(score: (v: Vector) => number, cond?: (v: Vector) => boolean): Solid
}
