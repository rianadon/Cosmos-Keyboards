import type { BasicShell, BlockShell, Cuttleform, SpecificCuttleform, TiltShell } from './config'
import Trsf from './modeling/transformation'
import { Vector } from './modeling/transformation'
export declare class BaseGeometry<C extends Cuttleform = SpecificCuttleform<BasicShell>> {
  protected c: C
  constructor(c: C)
  get keyHolesTrsfs(): Trsf[]
  get keyHolesTrsfs2D(): Trsf[]
  get allKeyCriticalPoints(): import('./geometry').CriticalPoints[]
  get allKeyCriticalPoints2D(): import('./geometry').CriticalPoints[]
  get worldZ(): Vector
  get worldX(): Vector
  get worldY(): Vector
  protected allWallCriticalPointsBottomZ(bottomZ?: number, wallOffset?: number): import('./geometry').WallCriticalPoints[]
  allWallCriticalPoints(wallOffset?: number): import('./geometry').WallCriticalPoints[]
  get justScrewIndices(): any[]
  get screwIndices(): any[]
  get justScrewPositions(): Trsf[]
  get screwPositions(): Trsf[]
  protected selectedBoardIndices: string[]
  get boardIndices(): import('./geometry').LabeledBoardInd
  get boardIndicesThatAreScrewsToo(): string[]
  get boardPositions(): {
    [k: string]: Trsf
  }
  get autoConnectorIndex(): number
  get connectorIndex(): number
  get connectorOrigin(): Trsf
  get solveTriangularization(): {
    boundary: number[]
    triangles: any
    allPts: [number, number, number][]
    allTrsfs: import('./geometry').KeyTrsf[]
    allIdx: number[]
  }
  get bottomZ(): number
  get floorZ(): number
  get bottomX(): number
}
export declare class BlockGeometry extends BaseGeometry<SpecificCuttleform<BlockShell>> {
  allWallCriticalPoints(wallOffset?: number): import('./geometry').WallCriticalPoints[]
  get justScrewIndices(): any[]
}
export declare class TiltGeometry extends BaseGeometry<SpecificCuttleform<TiltShell>> {
  get worldZ(): Vector
  get bottomZ(): number
  get floorZ(): number
  get plateScrewPositions(): Trsf[]
  get bottomScrewIndices(): any[]
  get bottomScrewPositions(): Trsf[]
}
