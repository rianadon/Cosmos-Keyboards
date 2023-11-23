import type { CuttleKey } from '../config'
import Trsf from './transformation'
/**
 * Extended transfomation.
 *
 * Unlike the other trsfs that are meant to perform repeated mathematical computation within the codebase,
 * the extended trsf is meant to be used inside use configuration code.
 *
 * It keeps a history of transformations so that it can be reversed into TypeScript code and supports
 * extra operations for ease-of-use.
 *
 * It is also unique in that it does not immediately compute any thing.
 * Instead, operations are placed into the history stack, which is later evaluated
 * when the transformation has the necessary context.
 *
 * Right now the only implemented context is whether the keyboard is being rendered in 3d view
 * or 2d view. This choice affects the positions of the keys in not only Z but also X and Y.
 */
type Point = [number, number, number]
interface MatrixOptions {
  column: number
  row: number
  curvatureOfColumn: number
  curvatureOfRow: number
  spacingOfColumns: number
  spacingOfRows: number
}
interface SphereOptions {
  angle: number
  row: number
  curvature: number
  spacing: number
}
type Unmerged<T> = T | {
  merged: T
  unmerged: Partial<T>
  name: string
}
interface EvaluationContext {
  flat: boolean
  key?: CuttleKey
}
type Operation = {
  name: 'translate'
  args: [number, number, number, boolean]
} | {
  name: 'rotate'
  args: [number, Point | undefined, Point | undefined, boolean]
} | {
  name: 'mirror'
  args: [Point, Point | undefined]
} | {
  name: 'multiply'
  args: [ETrsf]
} | {
  name: 'transformBy'
  args: [ETrsf]
} | {
  name: 'translateBy'
  args: [ETrsf]
} | {
  name: 'placeOnMatrix'
  args: [Unmerged<MatrixOptions>]
} | {
  name: 'placeOnSphere'
  args: [Unmerged<SphereOptions>]
} | {
  name: 'rotateTowards'
  args: [Point, number]
}
export declare function stringifyObj(a: any, indent: number): any
export default class ETrsf {
  history: Operation[]
  constructor(history?: Operation[])
  /** Apply a given operations. */
  private apply
  /** Return a new ETrsf with the given operations applied, without changing this ETrsf. */
  private applied
  /** Apply the operations executed in the given function just before the final operation. */
  insertBeforeLast(f: (e: this) => void): void
  translate(xDist: number, yDist: number, zDist: number, inFlat?: boolean): ETrsf
  translate(vector: Point, inFlat?: boolean): ETrsf
  translated(xDist: number, yDist: number, zDist: number, inFlat?: boolean): ETrsf
  translated(vector: Point, inFlat?: boolean): ETrsf
  rotate(angle: number, position?: Point, direction?: Point, inFlat?: boolean): this
  rotated(angle: number, position?: Point, direction?: Point, inFlat?: boolean): ETrsf
  rotateTowards(vector: Point, angle: number): this
  rotateToVertical(angle: number): this
  mirror(axis: Point, origin?: Point): this
  mirrored(axis: Point, origin?: Point): ETrsf
  transformBy(t: ETrsf): this
  transformedBy(t: ETrsf): ETrsf
  translateBy(t: ETrsf): this
  placeOnMatrix(opts: MatrixOptions): this
  placeOnSphere(opts: SphereOptions): this
  evaluate(context: EvaluationContext, t: Trsf): Trsf
  toString(indent: number): any
}
export declare const KEY_BASE = 14.3
export declare class Constant extends ETrsf {
  name: string
  constructor(name: string)
}
export declare function keyPosition(key: CuttleKey, flat: boolean): Trsf
export declare function keyPositionTop(key: CuttleKey, flat: boolean): Trsf
export declare function mirror(keys: CuttleKey[], gap?: number, angle?: number): ({
  position: ETrsf
  type: 'box' | 'mx-original' | 'mx-better' | 'mx-snap-in' | 'alps' | 'choc' | 'mx-pcb' | 'mx-hotswap' | 'mx-snap-in-hotswap' | 'choc-hotswap'
  keycap: import('../config').Keycap
  aspect: number
  cluster: string
} | {
  position: ETrsf
  type: 'blank' | 'ec11' | 'oled-128x32-0.91in-adafruit'
  aspect: number
  cluster: string
} | {
  position: ETrsf
  type: 'trackball' | 'cirque-23mm' | 'cirque-35mm' | 'cirque-40mm'
  trackball: {
    radius: number
    sides: number
  }
  aspect: number
  cluster: string
})[]
export {}
