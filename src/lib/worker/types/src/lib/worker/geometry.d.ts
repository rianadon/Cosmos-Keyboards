import { ExtrudeGeometry } from 'three'
import type { Cuttleform, CuttleKey, Geometry } from './config'
import Trsf from './modeling/transformation'
import { Vector } from './modeling/transformation'
export declare const wallZOffset: (c: Cuttleform) => number
export declare const BOARD_HOLDER_OFFSET = 0.02
export type CriticalPoints = Trsf[]
export interface WallCriticalPoints {
  ti: Trsf
  to: Trsf
  mi: Trsf
  ki: Trsf
  mo: Trsf
  bi: Trsf
  bo: Trsf
  key?: CuttleKey
  si?: Trsf
  sm?: Trsf
  /** @deprecated */
  pt?: number
}
export declare const webThickness: (c: Cuttleform, key: CuttleKey) => any
export declare function offsetAxis(p1: Trsf, p2: Trsf, p3: Trsf, z: Vector): Vector
/** Return the point at the intersection of two lines some offset away from p1-p2 and p2-p3. */
export declare function offsetBisector(p1: Trsf, p2: Trsf, p3: Trsf, offset: number, z: Vector): Trsf
export declare function keyCriticalPoints(c: Cuttleform, key: CuttleKey, hole: Trsf): CriticalPoints
export declare function allKeyCriticalPoints(c: Cuttleform, holes: Trsf[]): CriticalPoints[]
export declare function wallCriticalPoints(
  c: Cuttleform,
  prevPt: KeyTrsf,
  pt: KeyTrsf,
  nextPt: KeyTrsf,
  ptIndex: number | undefined,
  offset: number,
  bottomZ: number,
  worldZ: Vector,
  height?: number,
): WallCriticalPoints
export declare function blockWallCriticalPoints(
  c: Cuttleform,
  prevPt: KeyTrsf,
  pt: KeyTrsf,
  nextPt: KeyTrsf,
  ptIndex: number | undefined,
  offset: number,
  bottomX: number,
  bottomZ: number,
): WallCriticalPoints
export declare function oldblockWallCriticalPoints(
  c: Cuttleform,
  prevPt: KeyTrsf,
  pt: KeyTrsf,
  nextPt: KeyTrsf,
  ptIndex: number | undefined,
  offset: number,
  bottomX: number,
  bottomZ: number,
): WallCriticalPoints
export interface KeyTrsf {
  key: CuttleKey
  trsf: Trsf
  keyTrsf: Trsf
}
export declare function flattenKeyCriticalPoints(c: Cuttleform, pts: CriticalPoints[], trsfs: Trsf[]): KeyTrsf[]
export declare function allWallCriticalPoints(c: Cuttleform, pts: CriticalPoints[], trsfs: Trsf[], bottomZ: number, worldZ: Vector, offset?: number): WallCriticalPoints[]
/** this is where the original position of the thumb switches defined.
 each and every thumb keys is derived from this value.
 the value itself is defined from the 'm' key's position in qwerty layout
 and then added by some values, including thumb-offsets above. */
export declare function connectorIndex(c: Cuttleform, walls: WallCriticalPoints[], innerSurfaces: Line[][], selectB: string[], screwDiameter?: number): number
export declare function wallXToY(walls: WallCriticalPoints[], x: number, start: number, direction: number, checkDirection: number, component?: string): {
  wall: number
  next: number
  first: any
  second: any
  y: any
}
export declare function originForConnector(c: Cuttleform, walls: WallCriticalPoints[], surfaces: Line[][], wall: number): Trsf
export declare function minWallYAlongVector(c: Cuttleform, surfaces: Line[][], idx: number, v: Vector): number
/** The connector origin is right after the leftmost wall segment on the back of the model. */
export declare function connectorOrigin(c: Cuttleform, walls: WallCriticalPoints[], innerSurfaces: Line[][], selectB: string[]): Trsf
export declare function applyKeyAdjustment(k: CuttleKey, t: Trsf): Trsf
export declare function bottomByNormal(c: Cuttleform, normal: Vector, t: Trsf): number
export declare function additionalHeight(c: Cuttleform, t: Trsf): number
export declare function keyHolesTrsfs(c: Cuttleform, t: Trsf): Trsf[]
export declare function keyHolesTrsfs2D(c: Cuttleform, t: Trsf): Trsf[]
interface TriangularizationOptions {
  noBadWalls: boolean
  constrainKeys: boolean
  noKeyTriangles: boolean
  boundary?: number[]
  bottomPts2D?: Trsf[]
  noCut?: boolean
}
export declare function solveTriangularization(c: Cuttleform, pts2D: CriticalPoints[], pts: CriticalPoints[], trsfs: Trsf[], bottomZ: number, worldZ: Vector, opts: TriangularizationOptions): {
  boundary: number[]
  triangles: any
  allPts: [number, number, number][]
  allTrsfs: KeyTrsf[]
  allIdx: number[]
}
export declare function estimatedCenter(geometry: Geometry, wristRest?: boolean): [number, number, number]
export declare function boardIndices(c: Cuttleform, connOrigin: Trsf, walls: WallCriticalPoints[], select: string[], optimize?: boolean): LabeledBoardInd
export declare function screwOrigin(c: Cuttleform, i: number, walls: WallCriticalPoints[]): Vector
export interface LabeledBoardInd {
  topLeft?: number
  bottomLeft?: number
  topRight?: number
}
export declare function allScrewIndices(
  c: Cuttleform,
  walls: WallCriticalPoints[],
  connOrigin: Trsf | null,
  boardInd: LabeledBoardInd,
  initialPositions: number[],
  worldZ: Vector,
  bottomZ: number,
  minDisplacement?: number,
): Generator<number, void, unknown>
export declare function screwIndices(
  c: Cuttleform,
  walls: WallCriticalPoints[],
  connOrigin: Trsf | null,
  boardIdx: LabeledBoardInd,
  boardsScrewsToo: string[],
  worldZ: Vector,
  bottomZ: number,
  minDisplacement?: number,
): any[]
export declare function positionImpl(c: Cuttleform, walls: WallCriticalPoints[], z: Vector, i: number): Trsf
export declare function positionsImpl(c: Cuttleform, walls: WallCriticalPoints[], z: Vector, positions: number[]): Trsf[]
export declare function positionsImplMap(c: Cuttleform, walls: WallCriticalPoints[], z: Vector, positions: Record<string, number>): {
  [k: string]: Trsf
}
export declare function boardPositions(c: Cuttleform, connOrigin: Trsf, walls: WallCriticalPoints[], z: Vector, select: string[]): any[] | {
  [k: string]: Trsf
}
export declare function wristRestGeometry(c: Cuttleform, geo: Geometry): {
  leftStart: Vector
  leftEnd: Vector
  rightStart: Vector
  rightEnd: Vector
  intermediatePoints: Vector[]
  zOffset: number
  origin: [number, number, number]
  minY: number
}
export declare function inside(point: [number, number, number], vs: [number, number, number][]): boolean
export type Curve = [Trsf, Trsf, Trsf, Trsf]
export type Patch = Vector[][]
export declare function bezierPatch(p1: Curve, p2: Curve, p3: Curve, p4?: Curve): Patch
/** Evaluate the bezier surface at a given (u, v) point. */
export declare function evalPatch(K: number[][], u: number, v: number): number
/** Calculates the Gradient of a bezier patch.
 * The Gradient is defined as the vector [dB / du, dB / dv].
 * This is only valid for the bilinearly interpolated patches given by bezierPatch()
 */
export declare function patchGradient(K: number[][], u: number, v: number): number[]
/** Calculates the Hessian of a bezier patch.
 * The Hessian is defined as the matrix [[d^2 B / du^2, d^2 B / dudv], [d^2 B / dvdu, d^2 B / dv^2]].
 * To simplify deconstructing the array, it is returned as a flat array.
 * This is only valid for the bilinearly interpolated patches given by bezierPatch()
 */
export declare function patchHessian(K: number[][], u: number, v: number): number[]
/** Return the minimu point on a patch, when looking at it by a certain vector. */
export declare function patchMinAlongVector(p: Patch, vec: Vector): number
export interface Line {
  a: Trsf
  b: Trsf
  ainner: CuttleKey | null
  binner: CuttleKey | null
  curve: Curve
}
export declare function splitSpline(c: Curve, t: number): [Curve, Curve]
export declare function splineApproxLen(curves: Curve[]): number
export declare function splitSplinesByApproxLen(curves: Curve[], curves2: Curve[], length: number): [Curve[], Curve[], Curve[], Curve[]]
export declare function splitSplinesByApproxLenThrice(curves: Curve[], curves2: Curve[], lengthA: number, lengthB: number): [Curve[], Curve[]]
export declare function lineToCurve(a: Trsf, b: Trsf): Curve
export declare function loftCurves(a: Curve, b: Curve): Patch
export declare function makeLine(a: Trsf, b: Trsf, ainner?: CuttleKey | null, binner?: CuttleKey | null): Line
export declare function wallSurfacesOuter(c: Cuttleform, wall: WallCriticalPoints): any
export declare function wallSurfacesInner(c: Cuttleform, wall: WallCriticalPoints): any
export declare function wallSurfaces(c: Cuttleform, wall: WallCriticalPoints): any[]
export declare function wallCurve(conf: Cuttleform, a: Trsf, b: Trsf, c: Trsf, d: Trsf, worldZ: Vector, bottomZ: number): any
export declare function joinWalls(conf: Cuttleform, surfaces: Line[][], worldZ: Vector, bottomZ: number): Patch[]
export interface ComponentBox {
  origin: Trsf
  points: Vector[]
}
export interface ComponentMultiBox {
  origin: Trsf
  points: Vector[][]
  direction: Vector
}
export interface ComponentPoint {
  included: boolean
  pos: Trsf
  direction: Vector
}
export declare function multiBoxToBoxes(b: ComponentMultiBox): {
  origin: Trsf
  points: Vector[]
}[]
export declare function bottomComponentBoxes(c: Cuttleform, geo: Geometry): ComponentMultiBox[]
export declare function topComponentBoxes(c: Cuttleform, keyholes: Trsf[]): ComponentBox[]
export declare function componentBoxes(c: Cuttleform, geo: Geometry): ComponentBox[]
export declare function componentGeometry(box: ComponentBox): ExtrudeGeometry
/** Move one set of boxes until they no longer intersect a second set of boxes. */
export declare function moveBoxes(boxes: ComponentMultiBox[], test: ComponentBox[], refiner?: (v: Trsf) => Trsf): void
/** Move a point until it no longer intersects a set of boxes. */
export declare function movePointBox(point: ComponentPoint, test: ComponentBox[]): void
export declare function microControllerRectangles(c: Cuttleform, connOrigin: Trsf, boardPosWorld: Record<string, Trsf>): [number, number, number, number][]
export declare function microcontrollerBottomBox(c: Cuttleform, connOrigin: Trsf, boardPositions: Record<string, Trsf>, direction: Vector): {
  origin: Trsf
  direction: Vector
  points: Vector[][]
}
export declare function microcontrollerTopBox(c: Cuttleform, connOrigin: Trsf, boardPositions: Record<string, Trsf>, direction: Vector, top?: boolean): ComponentMultiBox
export declare function triangleMap(triangles: [number, number, number][]): Record<
  number,
  Record<number, {
    next: any
    triangle: any
  }>
>
/** Yield all points that may have minimum or maximum Z coordinates
    when intersecting a circle with the given triangles on the XY plane */
export declare function extremaCircleZOnBT(origin: Vector, radius: number, points: Trsf[], triangles: number[][]): Generator<any, void, unknown>
export declare function adjustedStiltsScrewOrigin(walls: WallCriticalPoints[], origin: Vector, radius: number): Vector
export {}
