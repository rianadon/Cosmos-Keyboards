import type { gp_Pnt, OpenCascadeInstance, TopoDS_Vertex } from '$assets/replicad_single'
import { type AnyShape, cast, getOC, type Solid, Transformation as OCCTransformation } from 'replicad'
import { Matrix4 } from 'three/src/math/Matrix4.js'
import { Vector3 } from 'three/src/math/Vector3.js'

type Point = [number, number, number]

export class Vector extends Vector3 {
  constructor(v?: Vector3)
  constructor(x: number, y: number, z: number)
  constructor(x?: Vector3 | number, y?: number, z?: number) {
    if (typeof x === 'undefined') super()
    else if (x instanceof Vector3) super(x.x, x.y, x.z)
    else super(x, y, z)
  }

  gp_Vec() {
    const oc = getOC() as OpenCascadeInstance
    return new oc.gp_Vec_4(this.x, this.y, this.z)
  }

  xy(): [number, number] {
    return [this.x, this.y]
  }
  xyz(): Point {
    return [this.x, this.y, this.z]
  }

  /** Check for approximate equality. **/
  approxEq(v: Vector) {
    return Math.abs(this.x - v.x) < 1e-6 && Math.abs(this.y - v.y) < 1e-6 && Math.abs(this.z - v.z) < 1e-6
  }

  /** Returns the length of the vector after being projected onto a plane **/
  lengthOnPlane(n: Vector) {
    const projLen = this.dot(n)
    return Math.sqrt(this.lengthSq() - projLen * projLen)
  }
}

export default class Trsf {
  public wrapped: Matrix4
  private _vertex: TopoDS_Vertex | null
  private _point: gp_Pnt | null

  constructor(transform?: Matrix4) {
    this.wrapped = transform ?? new Matrix4()
    this._vertex = null
    this._point = null
  }

  translate(xDist: number, yDist: number, zDist: number): Trsf
  translate(vec: Vector, scale: number): Trsf
  translate(vector: Point): Trsf
  translate(...args: any[]) {
    const translation = new Matrix4()
    if (args.length == 1) translation.makeTranslation(args[0][0], args[0][1], args[0][2])
    if (args.length == 2) translation.makeTranslation(args[0].x * args[1], args[0].y * args[1], args[0].z * args[1])
    if (args.length == 3) translation.makeTranslation(args[0], args[1], args[2])
    this.wrapped.premultiply(translation)
    this._vertex = null
    this._point = null
    return this
  }

  translated(xDist: number, yDist: number, zDist: number): Trsf
  translated(vec: Vector, scale: number): Trsf
  translated(vector: Point): Trsf
  translated(...args: any[]) {
    const t = new Matrix4()
    if (args.length == 1) t.makeTranslation(args[0][0], args[0][1], args[0][2])
    if (args.length == 2) t.makeTranslation(args[0].x * args[1], args[0].y * args[1], args[0].z * args[1])
    if (args.length == 3) t.makeTranslation(args[0], args[1], args[2])
    return new Trsf(t.multiply(this.wrapped))
  }

  pretranslate(xDist: number, yDist: number, zDist: number): Trsf
  pretranslate(vector: Point): Trsf
  pretranslate(...args: any[]) {
    const t = new Matrix4()
    if (args.length == 1) t.makeTranslation(args[0][0], args[0][1], args[0][2])
    if (args.length == 3) t.makeTranslation(args[0], args[1], args[2])
    this.wrapped.multiply(t)
    this._vertex = null
    this._point = null
    return this
  }

  pretranslated(xDist: number, yDist: number, zDist: number): Trsf
  pretranslated(vector: Point): Trsf
  pretranslated(...args: any[]) {
    const t = new Matrix4()
    if (args.length == 1) t.makeTranslation(args[0][0], args[0][1], args[0][2])
    if (args.length == 3) t.makeTranslation(args[0], args[1], args[2])
    return new Trsf(t.premultiply(this.wrapped))
  }

  rotate(angle: number, position: Point = [0, 0, 0], direction: Point = [0, 0, 1]) {
    const t1 = new Matrix4().makeTranslation(-position[0], -position[1], -position[2])
    const t2 = new Matrix4().makeRotationAxis(new Vector(...direction), angle * Math.PI / 180)
    const t3 = new Matrix4().makeTranslation(position[0], position[1], position[2])
    const t = t3.multiply(t2).multiply(t1)
    this.wrapped.premultiply(t)
    this._vertex = null
    this._point = null
    return this
  }

  rotated(angle: number, position: Point = [0, 0, 0], direction: Point = [0, 0, 1]) {
    const t1 = new Matrix4().makeTranslation(-position[0], -position[1], -position[2])
    const t2 = new Matrix4().makeRotationAxis(new Vector(...direction), angle * Math.PI / 180)
    const t3 = new Matrix4().makeTranslation(position[0], position[1], position[2])
    const t = t3.multiply(t2).multiply(t1)
    return new Trsf(t.multiply(this.wrapped))
  }

  mirror(axis: Point, origin: Point = [0, 0, 0]) {
    const [x, y, z] = axis
    const t1 = new Matrix4().makeTranslation(-origin[0], -origin[1], -origin[2])
    const t2 = new Matrix4().set(1 - 2 * x * x, 2 * x * y, 2 * x * z, 0, 2 * y * x, 1 - 2 * y * y, 2 * y * z, 0, 2 * z * x, 2 * z * y, 1 - 2 * z * z, 0, 0, 0, 0, 1)
    const t3 = new Matrix4().makeTranslation(origin[0], origin[1], origin[2])
    const t = t3.multiply(t2).multiply(t1)
    this.wrapped.premultiply(t)
    return this
  }

  /** Scales up the entire model. Useful when working with individual parts, otherwise probably not what you want. */
  scaleIsDangerous(x: number, y: number, z: number) {
    this.wrapped.scale(new Vector(x, y, z))
    return this
  }

  /** Returns a new Transformation that scaled the entire model. Useful when working with individual parts, otherwise probably not what you want. */
  scaledIsDangerous(x: number, y: number, z: number) {
    return new Trsf(this.wrapped.clone().scale(new Vector(x, y, z)))
  }

  multiply(t: Trsf) {
    this.wrapped = this.wrapped.multiply(t.wrapped)
    this._vertex = null
    this._point = null
    return this
  }

  premultiply(t: Trsf) {
    this.wrapped = this.wrapped.premultiply(t.wrapped)
    this._vertex = null
    this._point = null
    return this
  }

  premultiplied(t: Trsf) {
    return new Trsf(new Matrix4().multiplyMatrices(t.wrapped, this.wrapped))
  }

  invert() {
    this.wrapped.invert()
    this._vertex = null
    this._point = null
    return this
  }

  inverted() {
    return new Trsf(new Matrix4().copy(this.wrapped).invert())
  }

  /** Return the elements of the transformation matrix in row-major order. */
  matrix() {
    const el = this.wrapped.elements
    // Return the transpose, as three stores matrices in column major order.
    return [el[0], el[4], el[8], el[12], el[1], el[5], el[9], el[13], el[2], el[6], el[10], el[14], el[3], el[7], el[11], el[15]]
  }

  fromMatrix(matrix: number[]) {
    this.wrapped.set(
      matrix[0],
      matrix[1],
      matrix[2],
      matrix[3],
      matrix[4],
      matrix[5],
      matrix[6],
      matrix[7],
      matrix[8],
      matrix[9],
      matrix[10],
      matrix[11],
      matrix[12],
      matrix[13],
      matrix[14],
      matrix[15],
    )
    this._vertex = null
    this._point = null
    return this
  }

  origin() {
    return new Vector().setFromMatrixPosition(this.wrapped)
  }

  xyz(): Point {
    const origin = this.origin()
    return [origin.x, origin.y, origin.z]
  }

  axis(x: number, y: number, z: number): Vector {
    const transformed = new Vector(x, y, z).applyMatrix4(this.wrapped)
    return transformed.sub(this.origin())
  }

  apply(v: Vector): Vector {
    return v.clone().applyMatrix4(this.wrapped)
  }

  xy(): [number, number] {
    const origin = this.origin()
    return [origin.x, origin.y]
  }
  yz(): [number, number] {
    const origin = this.origin()
    return [origin.y, origin.z]
  }

  cleared() {
    return new Trsf()
  }

  occTrsf() {
    const ocTrsf = new OCCTransformation()
    ocTrsf.wrapped.SetValues(...this.matrix().slice(0, 12))
    return ocTrsf
  }

  transform<T extends AnyShape>(shape: T): T {
    const trsf = this.occTrsf()
    const result = cast(trsf.transform(shape.wrapped)) as T
    trsf.delete()
    return result
  }

  get vertex(): TopoDS_Vertex {
    const oc = getOC()
    if (this._vertex == null) {
      this._vertex = new oc.BRepBuilderAPI_MakeVertex(this.gp_Pnt()).Vertex()
    }
    return this._vertex!
  }

  coordSystemChange(origin: Vector, xDir: Vector, zDir: Vector) {
    const yDir = new Vector().crossVectors(zDir, xDir)
    this._vertex = null
    this._point = null
    return this.fromMatrix([xDir.x, yDir.x, zDir.x, origin.x, xDir.y, yDir.y, zDir.y, origin.y, xDir.z, yDir.z, zDir.z, origin.z, 0, 0, 0, 1])
  }

  gp_Pnt() {
    if (this._point == null) {
      const oc = getOC() as OpenCascadeInstance
      const [x, y, z] = this.xyz()
      this._point = new oc.gp_Pnt_3(x, y, z)
    }
    return this._point
  }

  Matrix4() {
    return this.wrapped
  }

  clone() {
    return new Trsf(new Matrix4().copy(this.wrapped))
  }
}
