import { Memoize } from 'typescript-memoize'
import type { BasicShell, BlockShell, Cuttleform, SpecificCuttleform, TiltShell } from './config'
import {
  additionalHeight,
  allKeyCriticalPoints,
  blockWallCriticalPoints,
  boardIndices,
  bottomByNormal,
  connectorErrorFn,
  connectorIndex,
  flattenKeyCriticalPoints,
  footIndices,
  footOrigin,
  footWalls,
  keyHolesTrsfs,
  keyHolesTrsfs2D,
  type LabeledBoardInd,
  originForConnector,
  plateArtOrigin,
  positionsImplMap,
  reinforceTriangles,
  screwIndices,
  screwOriginTrsf,
  separateSockets2D,
  solveTriangularization,
  wallCriticalPoints,
  wallSurfacesInner,
  webThickness,
} from './geometry'
import { flipAllTriangles, shiftWalls } from './geometry.thickWebs'
import Trsf from './modeling/transformation'
import { Vector } from './modeling/transformation'

export class BaseGeometry<C extends Cuttleform = SpecificCuttleform<BasicShell>> {
  constructor(public c: C) {}

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
    const triangles = flipAllTriangles(this.solveTriangularization.triangles, topCPts.flat())
    const topReinf = reinforceTriangles(this.c, this, triangles, topCPts, this.worldZ, this.bottomZ, true, walls)
    const botReinf = reinforceTriangles(this.c, this, triangles, botCPts, this.worldZ, this.bottomZ, false, walls)
    return { topReinf, botReinf, topCPts, botCPts }
  }

  @Memoize()
  allWallCriticalPoints(wallOffset = 0) {
    let walls = this.allWallCriticalPointsBase(wallOffset)
    walls = shiftWalls(this.c, walls, this.reinforcedTriangles.topReinf.wallOffsets, true, this.worldZ, this.bottomZ)
    walls = shiftWalls(this.c, walls, this.reinforcedTriangles.botReinf.wallOffsets, false, this.worldZ, this.bottomZ)
    return walls
  }

  @Memoize()
  get possibleScrewIndices() {
    const pos: number[] = []
    for (let i = 0; i < this.screwWalls.length; i++) {
      pos.push(i + 0.5)
    }
    return pos
  }

  get screwWalls() {
    return this.allWallCriticalPoints()
  }
  get boardWalls() {
    return this.allWallCriticalPoints()
  }
  @Memoize()
  get justScrewIndices() {
    return screwIndices(this.c, this.screwWalls, this.boardWalls, this.possibleScrewIndices, this.connectorOrigin, this.boardIndices, this.boardIndicesThatAreScrewsToo, this.worldZ, this.bottomZ)
  }
  get screwIndices() {
    return this.boardIndicesThatAreScrewsToo.map((i) => this.boardIndices[i as keyof LabeledBoardInd]!).concat(this.justScrewIndices)
  }
  @Memoize()
  get justScrewPositions() {
    const walls = this.screwWalls
    return this.justScrewIndices.map(i => screwOriginTrsf(this.c, i, walls, this.worldZ))
  }
  @Memoize()
  get screwPositions() {
    return this.boardIndicesThatAreScrewsToo.map(i => this.boardPositions[i]).concat(this.justScrewPositions)
  }
  protected selectedBoardIndices = ['topLeft', 'topRight', 'bottomLeft']
  @Memoize()
  get boardIndices() {
    if (!this.c.microcontroller) return {}
    return boardIndices(this.c, this.connectorOrigin, this.boardWalls, this.worldZ, this.bottomZ, this.selectedBoardIndices)
  }
  get boardIndicesThatAreScrewsToo(): (keyof LabeledBoardInd)[] {
    return this.c.microcontroller ? ['topLeft'] : []
  }
  @Memoize()
  get boardPositions() {
    return positionsImplMap(this.c, this.boardWalls, this.worldZ, this.boardIndices as any)
  }

  @Memoize()
  get footWalls() {
    return footWalls(this.c, this.allWallCriticalPoints(), this.floorZ)
  }

  @Memoize()
  get footIndices() {
    return footIndices(this.c, this.screwIndices, this.footWalls, this.screwWalls, this.worldZ)
  }

  @Memoize()
  get footPositions() {
    return this.footIndices.map(i => footOrigin(this.c, i, this.footWalls))
  }

  @Memoize()
  get autoConnectorIndex() {
    const walls = this.allWallCriticalPoints()
    const innerSurfaces = walls.map(w => wallSurfacesInner(this.c, w))
    const errorFn = connectorErrorFn(this.c, walls, innerSurfaces, this.worldZ, this.bottomZ, this.selectedBoardIndices)
    return connectorIndex(this.c, walls, errorFn)
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
    return this.c.bottomZ ?? -additionalHeight(this.c, new Trsf())
  }
  get floorZ() {
    return this.bottomZ - this.c.plateThickness
  }
  @Memoize()
  get bottomX() {
    return bottomByNormal(this.c, new Vector(1, 0, 0), new Trsf())
  }

  @Memoize()
  get plateArtOrigin() {
    return plateArtOrigin(this.c, this.keyHolesTrsfs)
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
  @Memoize()
  get worldZ() {
    console.log(this.keyHolesTrsfs.map(t => t.xyz()))
    if (Array.isArray(this.c.shell.tilt)) return new Vector(...this.c.shell.tilt).normalize()
    const angle = this.c.shell.tilt / 180 * Math.PI
    return new Vector(Math.sin(angle), 0, Math.cos(angle))
  }

  @Memoize()
  get bottomZ() {
    return this.c.bottomZ ?? bottomByNormal(this.c, this.worldZ, new Trsf()) - this.c.verticalClearance
  }
  @Memoize()
  get floorZ() {
    return Math.min(...this.allWallCriticalPoints().map(b => b.bo.origin().z)) - this.c.shell.raiseBy - this.c.plateThickness
  }

  @Memoize()
  get plateScrewPositions() {
    const walls = this.allWallCriticalPoints()
    return this.screwIndices.map(i => screwOriginTrsf(this.c, i, walls, this.worldZ.clone().negate()))
  }
  @Memoize()
  get bottomScrewIndices() {
    return screwIndices(this.c, this.screwWalls, this.boardWalls, this.possibleScrewIndices, null, this.screwIndices as any, [], new Vector(0, 0, 1), this.floorZ)
  }
  @Memoize()
  get bottomScrewPositions() {
    const walls = this.allWallCriticalPoints()
    return this.bottomScrewIndices
      .map(i => screwOriginTrsf(this.c, i, walls, new Vector(0, 0, 1)))
      .map(t => t.translate(0, 0, -t.origin().z + this.floorZ + this.c.plateThickness))
  }

  @Memoize()
  get footIndices() {
    return footIndices(this.c, this.bottomScrewIndices, this.footWalls, this.allWallCriticalPoints(), new Vector(0, 0, 1))
  }
}
