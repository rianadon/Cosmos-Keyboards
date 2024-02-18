import { Memoize } from 'typescript-memoize'
import type { BasicShell, BlockShell, Cuttleform, SpecificCuttleform, TiltShell } from './config'
import {
  additionalHeight,
  allKeyCriticalPoints,
  blockWallCriticalPoints,
  boardIndices,
  bottomByNormal,
  connectorIndex,
  flattenKeyCriticalPoints,
  keyHolesTrsfs,
  keyHolesTrsfs2D,
  type LabeledBoardInd,
  originForConnector,
  positionsImpl,
  positionsImplMap,
  reinforceTriangles,
  screwIndices,
  separateSockets2D,
  solveTriangularization,
  wallCriticalPoints,
  wallSurfacesInner,
  webThickness,
} from './geometry'
import { shiftWalls } from './geometry.thickWebs'
import { PLATE_HEIGHT } from './model'
import Trsf from './modeling/transformation'
import { Vector } from './modeling/transformation'

export class BaseGeometry<C extends Cuttleform = SpecificCuttleform<BasicShell>> {
  constructor(protected c: C) {}

  @Memoize()
  get keyHolesTrsfs() {
    return keyHolesTrsfs(this.c, new Trsf())
  }
  @Memoize()
  get keyHolesTrsfs2D(): Trsf[] {
    const trsfs = keyHolesTrsfs2D(this.c, new Trsf())
    return separateSockets2D(trsfs, allKeyCriticalPoints(this.c, trsfs))
  }
  @Memoize()
  get allKeyCriticalPoints() {
    return allKeyCriticalPoints(this.c, this.keyHolesTrsfs)
  }
  @Memoize()
  get allKeyCriticalPoints2D() {
    return allKeyCriticalPoints(this.c, this.keyHolesTrsfs2D)
  }

  get worldZ() {
    return new Vector(0, 0, 1)
  }
  get worldX() {
    return new Vector(1, 0, 0).addScaledVector(this.worldZ, -this.worldZ.x).normalize()
  }
  get worldY() {
    return new Vector(0, 1, 0).addScaledVector(this.worldZ, -this.worldZ.y).normalize()
      .addScaledVector(this.worldX, -this.worldX.y).normalize()
  }
  protected allWallCriticalPointsBottomZ(bottomZ = 0, wallOffset = 0) {
    const allPts = flattenKeyCriticalPoints(this.c, this.allKeyCriticalPoints, this.keyHolesTrsfs)

    const { boundary: b, removedTriangles } = this.solveTriangularization
    return b.map((pt, i) => {
      const prevPt = b[(i - 1 + b.length) % b.length]
      const nextPt = b[(i + 1) % b.length]
      const pts = wallCriticalPoints(this.c, allPts[prevPt], allPts[pt], allPts[nextPt], pt, wallOffset, bottomZ, this.worldZ)
      if (removedTriangles.find(x => x.includes(pt) && x.includes(nextPt))) pts.nRoundNext = true
      if (removedTriangles.find(x => x.includes(pt) && x.includes(prevPt))) pts.nRoundPrev = true
      return pts
    })
  }

  @Memoize()
  allWallCriticalPointsBase(wallOffset = 0) {
    return this.allWallCriticalPointsBottomZ(this.bottomZ, wallOffset)
  }

  @Memoize()
  get reinforcedTriangles() {
    const walls = this.allWallCriticalPointsBase()
    const topCPts = this.allKeyCriticalPoints
    const botCPts = topCPts.map((pts, i) => pts.map(t => t.pretranslated(0, 0, -webThickness(this.c, this.c.keys[i]))))
    const topReinf = reinforceTriangles(this.c, this, topCPts, true, walls)
    const botReinf = reinforceTriangles(this.c, this, botCPts, false, walls)
    return { topReinf, botReinf, topCPts, botCPts }
  }

  @Memoize()
  allWallCriticalPoints(wallOffset = 0) {
    // return this.allWallCriticalPointsBase(wallOffset)
    // TODO: Eventually uncomment this
    let walls = this.allWallCriticalPointsBase(wallOffset)
    walls = shiftWalls(walls, this.reinforcedTriangles.topReinf.wallOffsets, true)
    walls = shiftWalls(walls, this.reinforcedTriangles.botReinf.wallOffsets, false)
    return walls
  }

  @Memoize()
  get justScrewIndices() {
    return screwIndices(this.c, this.allWallCriticalPoints(), this.connectorOrigin, this.boardIndices, this.boardIndicesThatAreScrewsToo, this.worldZ, this.bottomZ)
  }
  get screwIndices() {
    return this.boardIndicesThatAreScrewsToo.map((i) => this.boardIndices[i as keyof LabeledBoardInd]!).concat(this.justScrewIndices)
  }
  @Memoize()
  get justScrewPositions() {
    return positionsImpl(this.c, this.allWallCriticalPoints(), this.worldZ, this.justScrewIndices)
  }
  @Memoize()
  get screwPositions() {
    return this.boardIndicesThatAreScrewsToo.map(i => this.boardPositions[i]).concat(this.justScrewPositions)
  }
  protected selectedBoardIndices = ['topLeft', 'topRight', 'bottomLeft']
  @Memoize()
  get boardIndices() {
    if (!this.c.microcontroller) return {}
    return boardIndices(this.c, this.connectorOrigin, this.allWallCriticalPoints(), this.worldZ, this.bottomZ, this.selectedBoardIndices)
  }
  get boardIndicesThatAreScrewsToo() {
    return this.c.microcontroller ? ['topLeft'] : []
  }
  @Memoize()
  get boardPositions() {
    return positionsImplMap(this.c, this.allWallCriticalPoints(), this.worldZ, this.boardIndices as any)
  }

  @Memoize()
  get autoConnectorIndex() {
    const innerSurfaces = this.allWallCriticalPoints().map(w => wallSurfacesInner(this.c, w))
    return connectorIndex(this.c, this.allWallCriticalPoints(), innerSurfaces, this.worldZ, this.bottomZ, this.selectedBoardIndices)
  }

  get connectorIndex() {
    return this.c.connectorIndex < 0 ? this.autoConnectorIndex : this.c.connectorIndex
  }

  @Memoize()
  get connectorOrigin() {
    if (!this.c.microcontroller && !this.c.connector) return null
    const wall = this.c.connectorIndex < 0 ? this.autoConnectorIndex : this.c.connectorIndex
    const innerSurfaces = this.allWallCriticalPoints().map(w => wallSurfacesInner(this.c, w))
    return originForConnector(this.c, this.allWallCriticalPoints(), innerSurfaces, wall)
  }

  @Memoize()
  get solveTriangularization() {
    return solveTriangularization(this.c, this.allKeyCriticalPoints2D, this.allKeyCriticalPoints, this.keyHolesTrsfs, this.bottomZ, this.worldZ, {
      noBadWalls: true,
      constrainKeys: true,
      noKeyTriangles: true,
    })
  }

  @Memoize()
  get bottomZ() {
    return -additionalHeight(this.c, new Trsf())
  }
  get floorZ() {
    return this.bottomZ - PLATE_HEIGHT
  }
  @Memoize()
  get bottomX() {
    return bottomByNormal(this.c, new Vector(1, 0, 0), new Trsf())
  }
}

export class BlockGeometry extends BaseGeometry<SpecificCuttleform<BlockShell>> {
  @Memoize()
  allWallCriticalPoints(wallOffset = 0) {
    const allPts = flattenKeyCriticalPoints(this.c, this.allKeyCriticalPoints, this.keyHolesTrsfs)

    const { boundary: b } = this.solveTriangularization
    return b.map((pt, i) => {
      const prevPt = b[(i - 1 + b.length) % b.length]
      const nextPt = b[(i + 1) % b.length]
      return blockWallCriticalPoints(this.c, allPts[prevPt], allPts[pt], allPts[nextPt], pt, wallOffset, this.bottomX, this.bottomZ)
    })
  }

  get justScrewIndices() {
    return []
  }
}

export class TiltGeometry extends BaseGeometry<SpecificCuttleform<TiltShell>> {
  get worldZ() {
    if (Array.isArray(this.c.shell.tilt)) return new Vector(...this.c.shell.tilt).normalize()
    const angle = this.c.shell.tilt / 180 * Math.PI
    return new Vector(Math.sin(angle), 0, Math.cos(angle))
  }

  @Memoize()
  get bottomZ() {
    return bottomByNormal(this.c, this.worldZ, new Trsf()) - this.c.verticalClearance
  }
  @Memoize()
  get floorZ() {
    return Math.min(...this.allWallCriticalPoints().map(b => b.bo.origin().z)) - this.c.shell.raiseBy - PLATE_HEIGHT
  }

  @Memoize()
  get plateScrewPositions() {
    return positionsImpl(this.c, this.allWallCriticalPoints(), this.worldZ.clone().negate(), this.screwIndices)
  }
  @Memoize()
  get bottomScrewIndices() {
    return screwIndices(this.c, this.allWallCriticalPoints(), null, this.screwIndices as any, [], new Vector(0, 0, 1), this.floorZ)
  }
  @Memoize()
  get bottomScrewPositions() {
    return positionsImpl(this.c, this.allWallCriticalPoints(), new Vector(0, 0, 1), this.bottomScrewIndices).map(t => t.translate(0, 0, -t.origin().z + this.floorZ + PLATE_HEIGHT))
  }
}
