import { Face, type Point, Solid } from 'replicad'
import type { TiltGeometry } from './cachedGeometry'
import type { Cuttleform, Geometry } from './config'
import { type CriticalPoints, type Patch, type WallCriticalPoints } from './geometry'
import Trsf from './modeling/transformation'
import { Vector } from './modeling/transformation'
export declare const PLATE_HEIGHT = 3
export declare const WR_TOLERANCE = 0.25
export declare function keyHoles(c: Cuttleform, transforms: Trsf[]): Promise<import('replicad').Compound>
export declare function normalWallSurfaces(c: Cuttleform, geo: Geometry, bottomZ: number, worldZ: Vector, offset: number): any[][]
export declare function wallInnerSurfaces(c: Cuttleform, pts: CriticalPoints[], trsfs: Trsf[], bottomZ: number, worldZ: Vector, offset: number): any[][]
export declare function accentWallSurfaces(c: Cuttleform, pts: CriticalPoints[], trsfs: Trsf[], bottomZ: number, worldZ: Vector, offset: number): any[][]
export declare function wallSolidSurface(c: Cuttleform, geo: Geometry, pts: CriticalPoints[], trsfs: Trsf[], bottomZ: number, worldZ: Vector, offset: number, accented?: boolean): Solid
export declare function wallInnerSolidSurface(c: Cuttleform, pts: CriticalPoints[], trsfs: Trsf[], bottomZ: number, worldZ: Vector, offset: number): TopoDS_Shell
export declare function boundarySplines<T>(
  c: Cuttleform,
  boundary: number[],
  pt: (i: number) => Trsf,
  f: (conf: Cuttleform, a: Trsf, b: Trsf, c: Trsf, d: Trsf, wz: Vector, bz: number) => T,
  worldZ: Vector,
  bottomZ: number,
  reverse?: boolean,
): {
  [i: number]: {
    [j: number]: T
  }
}
export declare function webSolid(c: Cuttleform, geo: Geometry, sew: boolean): Solid
export declare function screwStraightProfile(c: Cuttleform, height?: number, diameter?: number): import('replicad').Drawing
interface Plate {
  top: Solid
  bottom?: Solid
}
export declare function makePlate(c: Cuttleform, geo: Geometry, cut?: boolean, inserts?: boolean): Plate
export declare function makeBottomestPlate(c: Cuttleform, geo: TiltGeometry): Solid
export declare function screwInsertDimensions(c: Cuttleform): {
  bottomRadius: number
  topRadius: number
  outerBottomRadius: number
  outerTopRadius: number
  height: any
}
export type ScrewInsertTypes = ('base' | 'plate')[]
export declare function makerScrewInserts(c: Cuttleform, geo: Geometry, types?: ScrewInsertTypes): any
export declare const connectors: Record<string, {
  positive: (c: Cuttleform) => Solid | null
  negative: (c: Cuttleform) => Solid
}>
export declare function cutWithConnector(c: Cuttleform, wall: Solid, conn: keyof typeof connectors, origin: Trsf): import('replicad').Shape3D
export declare function makeConnector(c: Cuttleform, conn: keyof typeof connectors, origin: Point): import('replicad').Shell | Solid | import('replicad').CompSolid | import('replicad').Compound
export declare function makeWalls(c: Cuttleform, wallPts: WallCriticalPoints[], worldZ: Vector, bottomZ: number, sew: boolean): Solid
export declare function boardHolder(c: Cuttleform, geo: Geometry): Solid
export declare function bezierFace(patch: Patch): Face
export {}
