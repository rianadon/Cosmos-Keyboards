import type { TopoDS_Vertex } from '$assets/replicad_single'
import { type AnyShape, Transformation as OCCTransformation } from 'replicad'
import { Matrix4, Vector3 } from 'three'
type Point = [number, number, number]
export declare class Vector extends Vector3 {
  constructor(v?: Vector3)
  constructor(x: number, y: number, z: number)
  gp_Vec(): any
  xy(): [number, number]
  xyz(): Point
  /** Check for approximate equality. **/
  approxEq(v: Vector): boolean
  /** Returns the length of the vector after being projected onto a plane **/
  lengthOnPlane(n: Vector): number
}
export default class Trsf {
  wrapped: Matrix4
  private _vertex
  private _point
  constructor(transform?: Matrix4)
  translate(xDist: number, yDist: number, zDist: number): Trsf
  translate(vec: Vector, scale: number): Trsf
  translate(vector: Point): Trsf
  translated(xDist: number, yDist: number, zDist: number): Trsf
  translated(vec: Vector, scale: number): Trsf
  translated(vector: Point): Trsf
  preTranslate(xDist: number, yDist: number, zDist: number): Trsf
  preTranslate(vector: Point): Trsf
  pretranslated(xDist: number, yDist: number, zDist: number): Trsf
  pretranslated(vector: Point): Trsf
  rotate(angle: number, position?: Point, direction?: Point): this
  rotated(angle: number, position?: Point, direction?: Point): Trsf
  mirror(axis: Point, origin?: Point): this
  multiply(t: Trsf): this
  preMultiply(t: Trsf): this
  preMultiplied(t: Trsf): Trsf
  invert(): this
  inverted(): Trsf
  /** Return the elements of the transformation matrix in row-major order. */
  matrix(): number[]
  fromMatrix(matrix: number[]): this
  origin(): Vector
  xyz(): Point
  axis(x: number, y: number, z: number): Vector
  apply(v: Vector): Vector
  xy(): [number, number]
  yz(): [number, number]
  cleared(): Trsf
  occTrsf(): OCCTransformation
  transform<T extends AnyShape>(shape: T): T
  get vertex(): TopoDS_Vertex
  coordSystemChange(origin: Vector, xDir: Vector, zDir: Vector): this
  gp_Pnt(): any
  Matrix4(): Matrix4
  clone(): Trsf
}
export {}
