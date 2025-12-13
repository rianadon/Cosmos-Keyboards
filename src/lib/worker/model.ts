import type { TopoDS_Shell } from '$assets/replicad_single'
import { BOARD_PROPERTIES, type BoardElement, boardElements, convertToCustomConnectors, holderOuterRadius, holderThickness, STOPPER_WIDTH } from '$lib/geometry/microcontrollers'
import { SCREWS } from '$lib/geometry/screws'
import { processPlate } from '@pro/art'
import { wallBezier } from '@pro/rounded'
import { makeStiltsPlate, makeStiltsPlateSimpleMesh, splitStiltsScrewInserts } from '@pro/stiltsModel'
import { cast, CornerFinder, downcast, draw, drawCircle, Drawing, drawRoundedRectangle, Face, loft, type Point, type Sketch, Sketcher, Solid } from 'replicad'
import type { TiltGeometry } from './cachedGeometry'
import { createTriangleMap } from './concaveman'
import { convertToMaybeCustomConnectors, type Cuttleform, type Geometry } from './config'
import type { ConnectorMaybeCustom, CustomConnector } from './config.cosmos'
import {
  bezierPatch,
  type CriticalPoints,
  joinWalls,
  keyCriticalPoints,
  lineToCurve,
  loftCurves,
  makeLine,
  microControllerRectangles,
  type Patch,
  reinforceTriangles,
  screwInsertDimensions,
  splineApproxLen,
  splitSplinesByApproxLenThrice,
  type WallCriticalPoints,
  wallCurve,
  wallSurfaces,
  wallSurfacesInner,
  wallSurfacesOuter,
  webThickness,
} from './geometry'
import { bezierFace, BezierSketch, BezierSketcher, CompBezierSurface } from './modeling/bezier'
import { makeCacher } from './modeling/cacher'
import { buildFixedSolid, buildSewnSolid, buildSolid, combine, getOC, makeQuad, makeTriangle } from './modeling/index'
import { Splitter } from './modeling/splitter'
import Trsf from './modeling/transformation'
import { Vector } from './modeling/transformation'
import { keyHole } from './socketsLoader'
import { mapObj, sum } from './util'

const ACCENT_HEIGHT = 1.5
const ACCENT_WIDTH = 0.8

export const WR_TOLERANCE = 0.25
const ACCENT_TOLERANCE = 0.05
const BOARD_TOLERANCE_XY = 0.5
const BOARD_TOLERANCE_Z = 0.1
const BOARD_COMPONENT_TOL = 0.1 // Added to sides of cutouts on board holder
const TILT_PARTS_SEPARATION = 0.05 // How far apart the two components of tilts plate should be

const SMOOTHAPEX = false

export async function keyHoles(c: Cuttleform, transforms: Trsf[]) {
  return combine(await Promise.all(transforms.map((t, i) => keyHole(c.keys[i], t))))
}

export function normalWallSurfaces(c: Cuttleform, geo: Geometry, bottomZ: number, worldZ: Vector, offset: number) {
  const walls = geo.allWallCriticalPoints(offset)
  const EXTRA_HEIGHT = 100
  return walls.map(w => {
    const surf = wallSurfacesOuter(c, w)
    return [
      makeLine(w.ti.translated(worldZ, EXTRA_HEIGHT), w.to, w, w.nRoundNext, w.nRoundPrev, false, false),
      surf[1],
      ...(c.shell.type == 'tilt' || c.shell.type == 'stilts'
        ? [makeLine(w.mo, w.bo.pretranslated(0, 0, -c.plateThickness), w), makeLine(w.bo.pretranslated(0, 0, -c.plateThickness), w.bo.translated(0, 0, -500), w)]
        : [makeLine(w.mo, w.bo.translated(0, 0, -c.plateThickness), w)]),
    ]
  })
}

export function wallInnerSurfaces(c: Cuttleform, geo: Geometry, offset: number) {
  // const walls = allWallCriticalPoints(c, pts, trsfs, bottomZ, worldZ, offset)
  const walls = geo.allWallCriticalPoints(offset)
  const EXTRA_HEIGHT = 100
  return walls.map(w => {
    const displacement = w.ti.axis(-offset, 0, 0)
    const wc = {
      ...w,
      bi: w.bi.translated(displacement.xyz()),
      mi: w.mi.pretranslated(displacement.xyz()),
      ki: w.ki.translated(w.ti.translated(w.ti.origin(), -1).apply(displacement).xyz()), // ki has no guaranteed rotation
      ti: w.ti.pretranslated(displacement.xyz()),
    }
    const surf = wallSurfacesInner(c, wc)
    return [
      ...(c.shell.type == 'tilt'
        ? [makeLine(wc.bi.translated(0, 0, -EXTRA_HEIGHT), wc.bi.pretranslated(0, 0, -c.plateThickness), wc), makeLine(wc.bi.pretranslated(0, 0, -c.plateThickness), wc.bi, wc)]
        : [makeLine(wc.bi.pretranslated(0, 0, -EXTRA_HEIGHT), wc.bi, wc)]),
      surf[1],
      surf[2],
      surf[3],
      makeLine(wc.ti, wc.ti.translated(0, 0, EXTRA_HEIGHT), wc, w.nRoundNext, w.nRoundPrev, false, false),
    ]
  })
}

export function accentWallSurfaces(c: Cuttleform, geo: Geometry, offset: number) {
  const EXTRA_HEIGHT = 100
  const height = ACCENT_HEIGHT + WR_TOLERANCE

  const walls = geo.allWallCriticalPoints(offset).map(w => {
    const bo = w.bo.translated(0, 0, height)
    const bi = w.bi.translated(0, 0, height)
    let mo = w.mo
    let mi = w.mi

    if (mo.origin().z < bo.origin().z) mo = mo.translated(0, 0, bo.origin().z - mo.origin().z + 0.01)
    if (mi.origin().z < bi.origin().z) mi = mi.translated(0, 0, bi.origin().z - mi.origin().z + 0.01)
    return { ...w, bo, bi, mo, mi }
  })
  // const loweredPts = pts.map(p => p.map(i => i.translated(0, 0, -height)))
  // const walls = allWallCriticalPoints(c, loweredPts, trsfs, bottomZ, worldZ, offset).map(p => {
  //   return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.translated ? v.translated(0, 0, height) : v])) as WallCriticalPoints
  // })
  // const extraWall = allWallCriticalPoints(c, pts, trsfs, bottomZ, worldZ, ACCENT_WIDTH + offset)
  const extraWall = geo.allWallCriticalPoints(ACCENT_WIDTH + offset)
  return walls.map((w, i) => {
    const surf = wallSurfacesOuter(c, w)
    return [
      makeLine(w.ti.translated(0, 0, EXTRA_HEIGHT), w.to, w, w.nRoundNext, w.nRoundPrev, false, false),
      surf[1],
      makeLine(w.mo, w.bo, w),
      makeLine(w.bo, extraWall[i].bo.translated(0, 0, height), w),
      makeLine(extraWall[i].bo.translated(0, 0, height), extraWall[i].bo.translated(0, 0, -c.plateThickness), w),
    ]
  })
}

export function wallSolidSurface(c: Cuttleform, geo: Geometry, pts: CriticalPoints[], trsfs: Trsf[], bottomZ: number, worldZ: Vector, offset: number, accented = false) {
  const surfs = accented ? accentWallSurfaces(c, geo, offset) : normalWallSurfaces(c, geo, bottomZ, worldZ, offset)
  const surfaces = joinWalls(c, surfs, worldZ, bottomZ).map(bezierFace)

  const oc = getOC()
  const builder = new oc.BRep_Builder()
  const shell = new oc.TopoDS_Shell()
  builder.MakeShell(shell)
  for (const poly of surfaces) {
    builder.Add(shell, poly.wrapped)
  }
  const sewing = new oc.BRepBuilderAPI_Sewing(1e-6, true, true, true, false)
  sewing.Add(shell)
  sewing.Perform(new oc.Message_ProgressRange_1())
  return cast(downcast(sewing.SewedShape()) as TopoDS_Shell) as Solid
}

export function wallInnerSolidSurface(c: Cuttleform, geo: Geometry, offset: number) {
  const surfs = wallInnerSurfaces(c, geo, offset)
  const surfaces = joinWalls(c, surfs, geo.worldZ, geo.bottomZ).map(bezierFace)

  const oc = getOC()
  const builder = new oc.BRep_Builder()
  const shell = new oc.TopoDS_Shell()
  builder.MakeShell(shell)
  for (const poly of surfaces) {
    builder.Add(shell, poly.wrapped)
  }
  const sewing = new oc.BRepBuilderAPI_Sewing(1e-6, true, true, true, false)
  sewing.Add(shell)
  sewing.Perform(new oc.Message_ProgressRange_1())
  return downcast(sewing.SewedShape()) as TopoDS_Shell
}

export function boundarySplines<T>(
  c: Cuttleform,
  boundary: number[],
  pt: (i: number) => Trsf,
  f: (conf: Cuttleform, a: Trsf, b: Trsf, c: Trsf, d: Trsf, wb: WallCriticalPoints, wc: WallCriticalPoints, wz: Vector, bz: number) => T,
  walls: WallCriticalPoints[],
  worldZ: Vector,
  bottomZ: number,
  reverse = false,
) {
  const connectingSplines: Record<number, Record<number, T>> = {}
  for (let i = 0; i < boundary.length; i++) {
    const b0 = i
    const b1 = (i + 1) % boundary.length
    const b2 = (i + 2) % boundary.length
    const b3 = (i + 3) % boundary.length
    const spline = reverse
      ? f(c, pt(b3), pt(b2), pt(b1), pt(b0), walls[b2], walls[b1], worldZ, bottomZ)
      : f(c, pt(b0), pt(b1), pt(b2), pt(b3), walls[b1], walls[b2], worldZ, bottomZ)
    connectingSplines[boundary[b1]] = { [boundary[b2]]: spline }
  }
  return connectingSplines
}

export function webPolysTopOrBot(reinforced: ReturnType<typeof reinforceTriangles>, splines: Record<number, Record<number, Curve>>, top: boolean) {
  let { triangles, allPts } = reinforced
  const surface = new CompBezierSurface()

  for (let [a, b, c] of triangles) {
    const sp1 = splines[b] ? splines[b][a] : undefined
    const sp2 = splines[c] ? splines[c][b] : undefined
    const sp3 = splines[a] ? splines[a][c] : undefined
    if (sp1 || sp2 || sp3) {
      const e1 = sp1 || lineToCurve(allPts[a], allPts[b])
      const e2 = sp2 || lineToCurve(allPts[b], allPts[c])
      const e3 = sp3 || lineToCurve(allPts[c], allPts[a])
      if (top) surface.addPatch(bezierPatch(e1, e2, e3))
      else surface.addPatch(bezierPatch(e3, e2, e1))
    } else {
      if (top) surface.addTriangle(allPts[a], allPts[b], allPts[c])
      else surface.addTriangle(allPts[c], allPts[b], allPts[a])
    }
  }

  return surface
}

export function webSolid(c: Cuttleform, geo: Geometry) {
  let { triangles, boundary, removedTriangles, innerBoundary } = geo.solveTriangularization
  const surface = new CompBezierSurface()

  const triangleMap = createTriangleMap(triangles)

  const { topReinf, botReinf, topCPts, botCPts } = geo.reinforcedTriangles
  const walls = geo.allWallCriticalPoints()
  const topPts = topCPts.flat()
  const botPts = botCPts.flat()

  const topSplines = boundarySplines(c, boundary, i => walls[i].ti, wallCurve, walls!, geo.worldZ, geo.bottomZ, false)
  const bottomSplines = boundarySplines(c, boundary, i => walls[i].ki, wallCurve, walls!, geo.worldZ, geo.bottomZ, false)

  // Add top and bottom faces
  surface.extend(webPolysTopOrBot(topReinf, topSplines, true))
  surface.extend(webPolysTopOrBot(botReinf, bottomSplines, false))

  // If we encounter a wall on the boundary, use boundary make the wall
  for (let [a, b, c] of triangles) {
    const makeSide = (x: number, y: number) => surface.addPatch(loftCurves(topSplines[x][y]!, bottomSplines[x][y]!))
    if (topSplines[b] && topSplines[b][a]) makeSide(b, a)
    if (topSplines[c] && topSplines[c][b]) makeSide(c, b)
    if (topSplines[a] && topSplines[a][c]) makeSide(a, c)
  }

  // Add faces for removed triangles
  // If one of the current triangles shares an edge with a removed
  // triangle, loft the corresponding top & bottom edges to create a face.
  const removedTriMap = createTriangleMap(removedTriangles)
  for (let [a, b, c] of triangles) {
    const loftFace = (x: number, y: number) =>
      surface.addPatch(loftCurves(
        lineToCurve(topReinf.allPts[x], topReinf.allPts[y]),
        lineToCurve(botReinf.allPts[x], botReinf.allPts[y]),
      ))
    if (removedTriMap[b] && removedTriMap[b][a]) loftFace(b, a)
    if (removedTriMap[c] && removedTriMap[c][b]) loftFace(c, b)
    if (removedTriMap[a] && removedTriMap[a][c]) loftFace(a, c)
  }

  // Add extra walls
  for (const [a, b, other] of topReinf.extraWalls) {
    surface.addTriangle(topReinf.allPts[a], topReinf.allPts[b], botPts[other])
  }
  for (const [a, b, other] of botReinf.extraWalls) {
    surface.addTriangle(botReinf.allPts[b], botReinf.allPts[a], topPts[other])
  }

  // Make walls for key well
  // Also filler for keys with margin
  let i = 0
  topCPts.forEach((poly, k) => {
    const key = geo.c.keys[k]
    if (key.type !== 'blank' && (key.marginX || key.marginY)) {
      const topPtsWithoutMargin = keyCriticalPoints(geo.c, key, geo.keyHolesTrsfs[k], 0, false)
      const botPtsWithoutMargin = topPtsWithoutMargin.map(t => t.pretranslated(0, 0, -webThickness(geo.c, key)))

      for (let j = 0; j < poly.length; j++) {
        const n = (j + 1) % poly.length
        surface.addQuad(topPts[i + n], topPts[i + j], topPtsWithoutMargin[j], topPtsWithoutMargin[n])
        surface.addQuad(botPts[i + j], botPts[i + n], botPtsWithoutMargin[n], botPtsWithoutMargin[j])
        surface.addQuad(topPtsWithoutMargin[n], topPtsWithoutMargin[j], botPtsWithoutMargin[j], botPtsWithoutMargin[n])
        if (topSplines[i + j] && topSplines[i + j][i + n]) { // Add outer walls if margin lies on a wall
          surface.addPatch(loftCurves(topSplines[i + j][i + n]!, bottomSplines[i + j][i + n]!))
        }
      }
    } else {
      // Iterate through each side of the wall in pairs
      for (let j = 0; j < poly.length; j++) {
        const a = i + j
        const b = i + ((j + 1) % poly.length)
        if (triangleMap[a] && triangleMap[a][b]) {
          surface.addQuad(botPts[a], botPts[b], topPts[b], topPts[a])
        }
      }
    }
    i += poly.length
  })

  return surface
}

function plateSketch(c: Cuttleform, geo: PlateParams, offset = 0) {
  let sketch: BezierSketch
  const wall = geo.allWallCriticalPoints(offset)

  const planePtV = (v: Vector) => [v.dot(geo.worldX), v.dot(geo.worldY)] as [number, number]
  const planePt = (t: Trsf) => planePtV(t.origin())
  if (c.rounded.side) {
    let { boundary } = geo.solveTriangularization

    const splines = boundarySplines(c, boundary, i => wall[i].bo, wallBezier, wall, geo.worldZ, geo.bottomZ)
    const sketcher = new BezierSketcher().movePointerTo(planePt(wall[0].bo))
    for (let i = 0; i < boundary.length; i++) {
      const b0 = boundary[i]
      const b1 = boundary[(i + 1) % boundary.length]
      const spline = splines[b0][b1]
      if (spline) sketcher.bezierCurveTo(planePt(spline[3]), [planePt(spline[1]), planePt(spline[2])])
    }
    sketch = sketcher.close()
  } else {
    const points = geo.allWallCriticalPoints(offset).map(w => planePt(w.bo))
    const sketcher = new BezierSketcher().movePointerTo(points[0])
    for (let i = 1; i < points.length; i++) {
      sketcher.lineTo(points[i])
    }
    sketch = sketcher.close()
  }
  return sketch
}

function genericScrewCountersunkProfile(innerD: number, outerD: number, angle: number, height: number, margin: number) {
  const countersunkHeight = (outerD - innerD) / 2 / Math.tan(angle * Math.PI / 360)
  return draw()
    .movePointerTo([0, margin])
    .hLineTo(innerD / 2)
    .vLineTo(-height + countersunkHeight)
    .lineTo([outerD / 2, -height])
    .vLine(-margin)
    .lineTo([0, -height - margin])
    .close()
}

function screwCountersunkProfile(c: Cuttleform, height = c.plateThickness, margin = 1) {
  const { plateDiameter, countersunkDiameter, countersunkAngle } = SCREWS[c.screwSize]
  return genericScrewCountersunkProfile(plateDiameter, countersunkDiameter, countersunkAngle, height, margin)
}

export function screwStraightProfile(c: Cuttleform, height = c.plateThickness, diameter?: number) {
  const screwInfo = SCREWS[c.screwSize]
  return draw()
    .hLine(diameter ? diameter / 2 : screwInfo.plateDiameter / 2)
    .vLine(-height)
    .lineTo([0, -height])
    .close()
}

function cutPlateWithHoles(c: Cuttleform, plate: Solid, screwPositions: Trsf[]) {
  if (!c.screwIndices.length || !screwPositions.length) return plate

  const profile = c.screwCountersink
    ? screwCountersunkProfile(c)
    : screwStraightProfile(c)

  const hole = profile
    .sketchOnPlane('XZ')
    .revolve() as Solid

  const splitter = new Splitter()
  splitter.addArgument(plate)
  for (const pos of screwPositions) {
    splitter.addTool(new Trsf().translate(pos.xyz()).transform(hole))
  }
  splitter.perform()

  const result = splitter.takeBiggest()
  if (!result) throw new Error('Error cutting screw holes into plate')
  return result
}

interface PlateParams {
  worldX: Vector
  worldY: Vector
  worldZ: Vector
  bottomZ: number
  solveTriangularization: Geometry['solveTriangularization']
  allWallCriticalPoints: Geometry['allWallCriticalPoints']
  plateArtOrigin: Geometry['plateArtOrigin']
  footPositions: Geometry['footPositions']
}

async function makeNormalPlate(c: Cuttleform, geo: PlateParams) {
  const sketch = plateSketch(c, geo).sketchOnPlane('XY')
  const plate = sketch.extrude(-c.plateThickness) as Solid
  const trsf = new Trsf().coordSystemChange(new Vector(), geo.worldX, geo.worldZ).pretranslate(0, 0, geo.bottomZ)
  const transformedPlate = trsf.transform(plate)
  if (c.plate && c.shell.type !== 'tilt') return await processPlate(c, geo as Geometry, transformedPlate)
  return transformedPlate
}

async function makeAccentPlate(c: Cuttleform, geo: Geometry) {
  const height = c.plateThickness

  const sketch = plateSketch(c, geo, ACCENT_WIDTH).sketchOnPlane('XY')
  const trsf = new Trsf().coordSystemChange(new Vector(), geo.worldX, geo.worldZ).pretranslate(0, 0, geo.bottomZ)
  const plateUpper = trsf.transform((sketch as Sketch).clone().extrude(ACCENT_HEIGHT))
  const plateLower = trsf.transform(sketch.extrude(-height) as Solid)

  const solidWallSurface = wallSolidSurface(c, geo, geo.allKeyCriticalPoints, geo.keyHolesTrsfs, geo.bottomZ, geo.worldZ, ACCENT_TOLERANCE)
  const splitter = new Splitter()
  splitter.addArgument(plateUpper)
  splitter.addTool(solidWallSurface)
  splitter.perform()
  const plate = splitter.takeBiggest()!.fuse(plateLower)
  if (c.plate && c.shell.type !== 'tilt') return await processPlate(c, geo as Geometry, plate)
  return plate
}

interface Plate {
  top: () => Promise<Solid>
  bottom?: () => Promise<Solid>
}

export function makePlateMesh(c: Cuttleform, geo: Geometry, cut = false, inserts = false) {
  const makeThePlate = (geo: PlateParams) => {
    const sketch = plateSketch(c, geo)
    const plate = sketch.extrudeMesh(-c.plateThickness)
    const trsf = new Trsf().coordSystemChange(new Vector(), geo.worldX, geo.worldZ).pretranslate(0, 0, geo.bottomZ)
    const mat = trsf.Matrix4()
    for (let i = 0; i < plate.vertices.length; i += 3) {
      plate.vertices.set(new Vector().fromArray(plate.vertices, i).applyMatrix4(mat).xyz(), i)
    }
    return plate
  }

  if (c.shell.type == 'stilts') {
    return { top: makeStiltsPlateSimpleMesh(c, geo), bottom: null }
  } else if (c.shell.type == 'tilt') {
    return {
      top: makeThePlate(geo),
      bottom: makeThePlate(tiltBotGeo(c, geo as TiltGeometry)),
    }
  } else {
    return { top: makeThePlate(geo), bottom: null }
  }
}

export function makePlate(c: Cuttleform, geo: Geometry, cut = false, inserts = false): Plate {
  const positions = [...geo.screwPositions]
  if (c.shell.type == 'stilts') {
    return makeStiltsPlate(c, geo, cut)
  }
  if (c.shell.type == 'tilt') {
    const tiltGeo = geo as TiltGeometry
    return {
      top: async () =>
        combine([
          // cutPlateWithHoles(c, makeNormalPlate(c, geo), positions),
          joinTiltPlates(c, geo as any),
          plateRing(c, geo, -c.plateThickness),
          plateRing(c, tiltBotGeo(c, tiltGeo), c.plateThickness).translateZ(TILT_PARTS_SEPARATION),
          inserts ? makerScrewInserts(c, geo, ['plate']) : null,
        ]),
      bottom: async () => cutPlateWithHoles(c, await makeBottomestPlate(c, tiltGeo), tiltGeo.bottomScrewPositions),
    }
  }
  if (c.shell.type == 'basic' && c.shell.lip) {
    return { top: async () => cutPlateWithHoles(c, await makeAccentPlate(c, geo), positions) }
  }
  return { top: async () => cutPlateWithHoles(c, await makeNormalPlate(c, geo), positions) }
}

export async function makeBottomestPlate(c: Cuttleform, geo: TiltGeometry) {
  const plate = await makeNormalPlate(c, tiltBotGeo(c, geo))
  if (c.plate) return processPlate(c, geo as Geometry, plate)
  return plate
}

function wallBoundaryBeziers(c: Cuttleform, geo: PlateParams, pt: 'bo' | 'bi' = 'bo', offset = 0) {
  const wall = geo.allWallCriticalPoints(offset)
  const beziers: Curve[] = []

  if (c.rounded.side) {
    let { boundary } = geo.solveTriangularization

    const splines = boundarySplines(c, boundary, i => wall[i][pt], wallBezier, wall, geo.worldZ, geo.bottomZ)
    for (let i = 0; i < boundary.length; i++) {
      const b0 = boundary[i]
      const b1 = boundary[(i + 1) % boundary.length]
      beziers.push(splines[b0][b1])
    }
  } else {
    const points = geo.allWallCriticalPoints(offset).map(w => w[pt])
    let lastPt = points[points.length - 1]
    for (let i = 0; i < points.length; i++) {
      beziers.push(lineToCurve(lastPt, points[i]))
      lastPt = points[i]
    }
  }
  return beziers
}

function ocBSpline(c: Curve) {
  const oc = getOC()
  const knots = new oc.TColStd_Array1OfReal_2(0, 1)
  knots.SetValue(0, 0)
  knots.SetValue(1, 1)
  const multiplicities = new oc.TColStd_Array1OfInteger_2(0, 1)
  multiplicities.SetValue(0, 4)
  multiplicities.SetValue(1, 4)
  const arrayOfPoints = new oc.TColgp_Array1OfPnt_2(0, 3)
  arrayOfPoints.SetValue(0, c[0].gp_Pnt())
  arrayOfPoints.SetValue(1, c[1].gp_Pnt())
  arrayOfPoints.SetValue(2, c[2].gp_Pnt())
  arrayOfPoints.SetValue(3, c[3].gp_Pnt())
  return new oc.Handle_Geom_BSplineCurve_2(new oc.Geom_BSplineCurve_1(arrayOfPoints, knots, multiplicities, 3, false))
}

function ocBSplineFromCurves(cs: Curve[]) {
  const oc = getOC()
  const knots = new oc.TColStd_Array1OfReal_2(0, cs.length)
  knots.SetValue(0, 0)
  for (let i = 0; i < cs.length; i++) {
    knots.SetValue(i + 1, (i + 1) / cs.length)
  }
  const multiplicities = new oc.TColStd_Array1OfInteger_2(0, cs.length)
  for (let i = 0; i < cs.length + 1; i++) {
    multiplicities.SetValue(i, i == 0 || i == cs.length ? 4 : 3)
  }
  const arrayOfPoints = new oc.TColgp_Array1OfPnt_2(0, 3 * cs.length)
  arrayOfPoints.SetValue(0, cs[0][0].gp_Pnt())
  for (let i = 0; i < cs.length; i++) {
    for (let j = 1; j < 4; j++) {
      arrayOfPoints.SetValue(i * 3 + j, cs[i][j].gp_Pnt())
    }
  }
  return new oc.Handle_Geom_BSplineCurve_2(new oc.Geom_BSplineCurve_1(arrayOfPoints, knots, multiplicities, 3, false))
}

function plateRing(c: Cuttleform, geo: PlateParams, height: number) {
  const outer = wallBoundaryBeziers(c, geo, 'bo')
  const inner = wallBoundaryBeziers(c, geo, 'bi')
  const faces = outer.flatMap((out, i) => {
    const inn = inner[i]
    const innTop = inner[i].map(t => t.translated(geo.worldZ, height)) as Curve
    const outTop = outer[i].map(t => t.translated(geo.worldZ, height)) as Curve
    return [
      bezierPatch(out, lineToCurve(inn[0], out[0]), inn, lineToCurve(inn[3], out[3])),
      bezierPatch(outTop, lineToCurve(innTop[0], outTop[0]), innTop, lineToCurve(innTop[3], outTop[3])),
      bezierPatch(outTop, lineToCurve(outTop[0], out[0]), out, lineToCurve(outTop[3], out[3])),
      bezierPatch(innTop, lineToCurve(innTop[0], inn[0]), inn, lineToCurve(innTop[3], inn[3])),
    ].map(bezierFace)
  })
  return buildSewnSolid(faces, false)
}

function tiltBotGeo(c: Cuttleform, geo: TiltGeometry): PlateParams {
  return {
    worldX: new Vector(1, 0, 0),
    worldY: new Vector(0, 1, 0),
    worldZ: new Vector(0, 0, 1),
    bottomZ: geo.floorZ + c.plateThickness,
    solveTriangularization: geo.solveTriangularization,
    plateArtOrigin: geo.plateArtOrigin,
    footPositions: geo.footPositions,
    allWallCriticalPoints: (offset?: number) =>
      geo.allWallCriticalPoints(offset).map(w => ({
        ...w,
        bi: w.bi.translated(0, 0, -w.bi.origin().z + geo.floorZ + c.plateThickness),
        bo: w.bo.translated(0, 0, -w.bo.origin().z + geo.floorZ + c.plateThickness),
      })),
  }
}

function joinTiltPlatesLoft(c: Cuttleform, geo: TiltGeometry) {
  const topTrsf = new Trsf().coordSystemChange(new Vector(), geo.worldX, geo.worldZ).pretranslate(0, 0, geo.bottomZ)
  const topSketch = (plateSketch(c, geo).sketchOnPlane('XY') as Sketch).wire
  const topSurface = topTrsf.transform(topSketch)

  const bottomTrsf = new Trsf().pretranslate(0, 0, geo.floorZ)
  const bottomSketch = (plateSketch(c, {
    worldX: new Vector(1, 0, 0),
    worldY: new Vector(0, 1, 0),
    worldZ: new Vector(0, 0, 1),
    bottomZ: geo.floorZ,
    solveTriangularization: geo.solveTriangularization,
    allWallCriticalPoints: geo.allWallCriticalPoints.bind(geo),
    plateArtOrigin: geo.plateArtOrigin,
    footPositions: geo.footPositions,
  }).sketchOnPlane('XY') as Sketch).wire
  const bottomSurface = bottomTrsf.transform(bottomSketch)
  return loft([topSurface, bottomSurface])
}

function joinTiltPlates(c: Cuttleform, geo: TiltGeometry) {
  if (c.shell.type !== 'tilt') throw new Error('oops')

  // Create boundaries for both the top and bottom of the joining surface.
  // These will later get joined.
  const topTranslation = new Trsf().coordSystemChange(new Vector(), geo.worldX, geo.worldZ).pretranslate(0, 0, -c.plateThickness).xyz()
  const topBoundary = wallBoundaryBeziers(c, geo).map(c => c.map(t => t.translated(topTranslation))) as Curve[]
  const topBoundaryInner = wallBoundaryBeziers(c, geo, 'bi').map(c => c.map(t => t.translated(topTranslation))) as Curve[]

  const botTranslation = [0, 0, c.plateThickness + TILT_PARTS_SEPARATION] as [number, number, number]
  const botGeo = tiltBotGeo(c, geo)
  const bottomBoundary = wallBoundaryBeziers(c, botGeo).map(c => c.map(t => t.translated(botTranslation))) as Curve[]
  const bottomBoundaryInner = wallBoundaryBeziers(c, botGeo, 'bi').map(c => c.map(t => t.translated(botTranslation))) as Curve[]

  const boLen = splineApproxLen(bottomBoundary)
  const toLen = splineApproxLen(topBoundary)
  let pattern = c.shell.pattern
  if (!pattern) {
    const faces: Patch[] = []
    for (let i = 0; i < bottomBoundary.length; i++) {
      faces.push(loftCurves(topBoundary[i], bottomBoundary[i]))
      faces.push(loftCurves(bottomBoundaryInner[i], topBoundaryInner[i]))
      faces.push(loftCurves(bottomBoundaryInner[i], bottomBoundary[i]))
      faces.push(loftCurves(topBoundaryInner[i], topBoundary[i]))
    }
    return buildSewnSolid(faces.map(bezierFace), false)
  }
  if (pattern.length % 2 !== 0) throw new Error('Pattern must have an even number of elements')

  const totalPatternLength = sum(pattern)
  const patternTimes = Math.round(boLen / totalPatternLength)
  const normPattern = pattern.map(p => p / totalPatternLength)

  const oc = getOC()
  const bodies: Solid[] = []

  for (let i = 0; i < patternTimes; i++) {
    let patternOffset = 0
    for (let j = 0; j < pattern.length; j += 2) {
      const [boSeg, biSeg] = splitSplinesByApproxLenThrice(bottomBoundary, bottomBoundaryInner, (i + patternOffset) * boLen / patternTimes, (i + patternOffset + normPattern[j]) * boLen / patternTimes)
      const [toSeg, tiSeg] = splitSplinesByApproxLenThrice(
        topBoundary,
        topBoundaryInner,
        (i + normPattern[j + 1] + patternOffset) * toLen / patternTimes,
        (i + patternOffset + normPattern[j] + normPattern[j + 1]) * toLen / patternTimes,
      )
      patternOffset += normPattern[j] + normPattern[j + 1]

      const faces: Face[] = []

      const lControl = boSeg[0][0].origin().distanceTo(toSeg[0][0].origin()) / 3
      const rControl = boSeg[boSeg.length - 1][3].origin().distanceTo(toSeg[toSeg.length - 1][3].origin()) / 3
      const lo: Curve = [boSeg[0][0], boSeg[0][0].pretranslated(0, 0, lControl), toSeg[0][0].pretranslated(0, 0, -lControl), toSeg[0][0]]
      const lob = ocBSpline(lo)
      const ro: Curve = [boSeg[boSeg.length - 1][3], boSeg[boSeg.length - 1][3].pretranslated(0, 0, rControl), toSeg[toSeg.length - 1][3].pretranslated(0, 0, -rControl), toSeg[toSeg.length - 1][3]]
      const rob = ocBSpline(ro)
      const li: Curve = [biSeg[0][0], biSeg[0][0].pretranslated(0, 0, lControl), tiSeg[0][0].pretranslated(0, 0, -lControl), tiSeg[0][0]]
      const lib = ocBSpline(li)
      const ri: Curve = [biSeg[biSeg.length - 1][3], biSeg[biSeg.length - 1][3].pretranslated(0, 0, rControl), tiSeg[tiSeg.length - 1][3].pretranslated(0, 0, -rControl), tiSeg[tiSeg.length - 1][3]]
      const rib = ocBSpline(ri)

      const boComp = ocBSplineFromCurves(boSeg)
      const toComp = ocBSplineFromCurves(toSeg)
      const biComp = ocBSplineFromCurves(biSeg)
      const tiComp = ocBSplineFromCurves(tiSeg)

      let fill = new oc.GeomFill_BSplineCurves_2(toComp, lob, boComp, rob, oc.GeomFill_FillingStyle.GeomFill_CoonsStyle as any)
      faces.push(new Face(new oc.BRepBuilderAPI_MakeFace_8(new oc.Handle_Geom_Surface_2(fill.Surface().get()), 1e-3).Face()))

      fill = new oc.GeomFill_BSplineCurves_2(rib, biComp, lib, tiComp, oc.GeomFill_FillingStyle.GeomFill_CoonsStyle as any)
      faces.push(new Face(new oc.BRepBuilderAPI_MakeFace_8(new oc.Handle_Geom_Surface_2(fill.Surface().get()), 1e-3).Face()))

      const lb = lineToCurve(boSeg[0][0], biSeg[0][0])
      const lt = lineToCurve(toSeg[0][0], tiSeg[0][0])
      const rb = lineToCurve(boSeg[boSeg.length - 1][3], biSeg[biSeg.length - 1][3])
      const rt = lineToCurve(toSeg[toSeg.length - 1][3], tiSeg[tiSeg.length - 1][3])
      faces.push(bezierFace(bezierPatch(li, lt, lo, lb)))
      faces.push(bezierFace(bezierPatch(rb, ro, rt, ri)))

      fill = new oc.GeomFill_BSplineCurves_2(ocBSpline(rb), biComp, ocBSpline(lb), boComp, oc.GeomFill_FillingStyle.GeomFill_CoonsStyle as any)
      faces.push(new Face(new oc.BRepBuilderAPI_MakeFace_8(new oc.Handle_Geom_Surface_2(fill.Surface().get()), 1e-3).Face()))
      fill = new oc.GeomFill_BSplineCurves_2(ocBSpline(lt), tiComp, ocBSpline(rt), toComp, oc.GeomFill_FillingStyle.GeomFill_CoonsStyle as any)
      faces.push(new Face(new oc.BRepBuilderAPI_MakeFace_8(new oc.Handle_Geom_Surface_2(fill.Surface().get()), 1e-3).Face()))

      try {
        bodies.push(buildSewnSolid(faces, false))
      } catch (e) {
        // Ignore if this fails
      }
    }
  }
  return combine(bodies)
}

function screwInsert(c: Cuttleform, bottomRadius: number, topRadius: number, height: number) {
  return draw()
    .hLine(bottomRadius)
    .lineTo([topRadius, height])
    .ellipse(-topRadius, topRadius, topRadius, topRadius, 0, false, true)
    .close()
    .sketchOnPlane('XZ')
    .revolve() as Solid
}

function screwInsertOuter(c: Cuttleform, bottomRadius: number, topRadius: number, height: number) {
  const margin = 100
  const base = new Sketcher('XY')
    .movePointerTo([-bottomRadius - margin, -bottomRadius])
    .hLine(margin + bottomRadius)
    .ellipse(0, 2 * bottomRadius, bottomRadius, bottomRadius, 0, false, true)
    .hLine(-margin - bottomRadius)
    .close()
    .loftWith(
      new Sketcher('XY', height)
        .movePointerTo([-(topRadius + 0.001) - margin, -(topRadius + 0.001)])
        .hLine(margin + (topRadius + 0.001))
        .ellipse(0, 2 * (topRadius + 0.001), topRadius + 0.001, topRadius + 0.001, 0, false, true)
        .hLine(-margin - (topRadius + 0.001))
        .close(),
    )
  const top = draw()
    .hLine(topRadius)
    .ellipse(-topRadius, topRadius, topRadius, topRadius, 0, false, true)
    .close()
    .sketchOnPlane('XZ')
    .revolve() as Solid
  // Slightly below hight. Helps keep top surface pointing up.
  return base // .fuse(top.translateZ(height-0.001))
}

function screwInsertModel(c: Cuttleform, throughHole: boolean) {
  const { bottomRadius, topRadius, outerBottomRadius, outerTopRadius, height } = screwInsertDimensions(c)
  if (throughHole) {
    const radius = SCREWS[c.screwSize].plateDiameter / 2
    const outerRadius = radius + 1.6
    const inner = screwInsert(c, radius, radius, height)
    const outer = screwInsertOuter(c, outerRadius, outerRadius, height)
    return outer.cut(inner)
  } else {
    const inner = screwInsert(c, bottomRadius, topRadius, height)
    const outer = screwInsertOuter(c, outerBottomRadius, outerTopRadius, height)
    return outer.cut(inner)
  }
}

export type ScrewInsertTypes = ('base' | 'plate')[]
export function makerScrewInserts(c: Cuttleform, geo: Geometry, types: ScrewInsertTypes = ['base', 'plate']) {
  const inserts = makeScrewInserts(c, geo, types)
  if (c.shell.type == 'stilts') {
    return splitStiltsScrewInserts(c as any, geo as any, inserts.filter(insert => !!insert) as Solid[])
  }
  return combine(inserts)
}

function makeScrewInserts(c: Cuttleform, geo: Geometry, types: ScrewInsertTypes) {
  const solidWallSurface = wallInnerSolidSurface(c, geo, 0)

  const holderThick = holderThickness(boardElements(c, false))
  const inserts: (Solid | undefined)[] = []
  if (types.includes('base')) {
    inserts.push(
      ...geo.justScrewPositions.map(p => makeScrewInsert(c, solidWallSurface, p, false)),
      ...Object.values(geo.boardPositions).map(p => p.pretranslated(0, 0, holderThick))
        .map(p => makeScrewInsert(c, solidWallSurface, p, false)),
    )
  }
  if (c.shell.type == 'tilt' && types.includes('plate')) {
    inserts.push(
      ...(geo as TiltGeometry).plateScrewPositions.map(p => makeScrewInsert(c, solidWallSurface, p, true)),
      ...(geo as TiltGeometry).bottomScrewPositions.map(p => makeScrewInsert(c, solidWallSurface, p, false)?.translateZ(TILT_PARTS_SEPARATION)),
    )
  }
  return inserts
}

const screwCache = makeCacher(screwInsertModel)

function makeScrewInsert(c: Cuttleform, solidWallSurface: TopoDS_Shell, pos: Trsf, throughHole: boolean) {
  const cacheKey = c.screwSize + ',' + (throughHole ? 'th' : c.screwType)
  const model = screwCache(cacheKey, pos, c, throughHole)

  const splitter = new Splitter()
  splitter.addArgument(model)
  splitter.addTool(solidWallSurface, false)

  try {
    splitter.perform()
    const m4 = pos.Matrix4().invert()
    const split = splitter.takeBy(p => p.applyMatrix4(m4).x)
    for (const e of split?.edges || []) {
      // Avoid fly swatters by discarding the insert
      if (e.startPoint.sub(e.endPoint).Length > 20) {
        return undefined
      }
    }

    return split
  } catch (e) {
    console.error('Error making screw insert at', pos.xyz(), e)
    return undefined
  }
}

function rectangleForUSB(c: Cuttleform) {
  switch (c.connectorSizeUSB) {
    case 'slim':
      return drawRoundedRectangle(10.5, 6.5, 3)
    case 'big':
      return drawRoundedRectangle(13, 8, 3)
    default: // average
      return drawRoundedRectangle(12, 7, 3)
  }
}

// export const connectors: Record<string, { positive: (c: Cuttleform) => Solid | null; negative: (c: Cuttleform) => Solid }> = {
//   rj9: {
//     positive(c: Cuttleform) {
//       return drawRoundedRectangle(14.78, 22.38).translate(0, 22.38 / 2)
//         .fuse(drawRoundedRectangle(10.5, 17.6).translate(12.64, 17.6 / 2))
//         .sketchOnPlane('XZ')
//         .extrude(13)
//         .translate(0, 6.5, 0) as Solid
//     },
//     negative(c: Cuttleform) {
//       const throughHole = drawRoundedRectangle(10.78, 5).sketchOnPlane('XZ')
//         .extrude(13)
//         .translate(0, 6.5, 16) as Solid
//       const shallowHole = drawRoundedRectangle(10.78, 18.38).sketchOnPlane('XZ')
//         .extrude(9)
//         .translate(0, 6.5, 11.19) as Solid
//       const usbHole = drawRoundedRectangle(6.5, 13.6).sketchOnPlane('XZ')
//         .extrude(13)
//         .translate(12.64, 6.5, 17.6 / 2) as Solid
//       return throughHole.fuse(shallowHole).fuse(usbHole)
//     },
//   },
//   trrs: {
//     positive(c: Cuttleform) {
//       return null
//     },
//     negative(c: Cuttleform) {
//       const lg = BOARD_PROPERTIES[c.microcontroller].sizeName == 'Large'
//       return drawCircle(3.2).translate(lg ? -16.5 : -14.5, 0) // trrs hole
//         .fuse(rectangleForUSB(c)) // usb hole
//         .sketchOnPlane('XZ')
//         .extrude(c.wallThickness * 10)
//         .translate(0, c.wallThickness * 10, 5) as Solid
//     },
//   },
//   usb: {
//     positive(c: Cuttleform) {
//       return null
//     },
//     negative(c: Cuttleform) {
//       return rectangleForUSB(c) // usb hole
//         .sketchOnPlane('XZ')
//         .extrude(c.wallThickness * 10)
//         .translate(0, c.wallThickness * 10, 5) as Solid
//     },
//   },
//   external: {
//     positive(c: Cuttleform) {
//       return null
//     },
//     negative(c: Cuttleform) {
//       return drawRoundedRectangle(29.1661, 12.6)
//         .sketchOnPlane('XZ')
//         .extrude(c.wallThickness * 10)
//         .translate(10, c.wallThickness * 10, 12.6 / 2) as Solid
//     },
//   },
// }

export function cutWithConnector(c: Cuttleform, wall: Solid, origin: Trsf) {
  // if (!conn) return wall
  // const pos = connectors[conn].positive(c)
  // if (pos) return wall.cut(origin.transform(pos))
  // return wall.cut(origin.transform(connectors[conn].negative(c)))
  const connectors = convertToMaybeCustomConnectors(c).map(conn => convertToCustomConnectors(c, conn))
  if (connectors.length == 0) return wall

  const connectorSketches = connectors.map(k =>
    (k.width <= k.radius * 2 && k.height <= k.radius * 2 ? drawCircle(Math.min(k.width, k.height) / 2) : drawRoundedRectangle(k.width, k.height, k.radius))
      .translate(k.x, k.y)
  )
  const fusedSketch = connectorSketches.reduce((a, b) => a.fuse(b))
  return wall.cut(origin.transform(
    fusedSketch.sketchOnPlane('XZ').extrude(c.wallThickness * 10)
      .translate(0, c.wallThickness * 10, 0) as Solid,
  ))
}

// export function makeConnector(c: Cuttleform, conn: keyof typeof connectors, origin: Point) {
//   if (!conn) return null
//   const pos = connectors[conn].positive(c)
//   if (pos) return pos.cut(connectors[conn].negative(c)).translate(origin)
//   return null
// }

export function makeWalls(c: Cuttleform, wallPts: WallCriticalPoints[], worldZ: Vector, bottomZ: number) {
  const surface = new CompBezierSurface()
  const patches = joinWalls(c, wallPts.map(w => wallSurfaces(c, w)), worldZ, bottomZ)
  patches.forEach(p => surface.addPatch(p))
  return surface
}

function drawRectangleByBounds(minx: number, maxx: number, miny: number, maxy: number) {
  return drawRoundedRectangle(maxx - minx, maxy - miny)
    .translate((minx + maxx) / 2, (miny + maxy) / 2)
}

function boardBox(element: BoardElement, tol: number, infinite = false): Solid {
  let yExtra = infinite ? 100 : 0
  const bottom = drawRectangleByBounds(
    element.offset.x - element.size.x / 2 - tol,
    element.offset.x + element.size.x / 2 + tol,
    element.offset.y - element.size.y - tol,
    element.offset.y + tol + yExtra,
  )
  return bottom.sketchOnPlane('XY').extrude(element.size.z + 2 * tol).translateZ(element.offset.z - tol) as Solid
}
function boardBoxBox({ offset, size }: { offset: Vector; size: Vector }) {
  return boardBox({ model: 'box', offset, size, boundingBoxZ: 5 }, 0)
}

class FilletFinder extends CornerFinder {
  constructor(minsize = 0, maxsize = Infinity) {
    super()
    this.filters.push(({ element }) => {
      const tgt1 = element.firstCurve.tangentAt(1)
      const tgt2 = element.secondCurve.tangentAt(0)

      if (element.firstCurve.geomType !== 'LINE') return false
      if (element.secondCurve.geomType !== 'LINE') return false
      const l1 = new Vector(...element.firstCurve.firstPoint, 0).sub(new Vector(...element.firstCurve.lastPoint, 0)).length()
      const l2 = new Vector(...element.secondCurve.firstPoint, 0).sub(new Vector(...element.secondCurve.lastPoint, 0)).length()
      if ((l1 < minsize || l2 < minsize) || (l1 > maxsize && l2 > maxsize)) return false

      return tgt1[0] != tgt2[0] || tgt1[1] != tgt2[1]
    })
  }
}

/**
 * Creates the following shape:
 *
 *     y
 *     |###\\
 *     |#####|
 *     |###//
 *     |______________ x
 */
function railJig(railWidth: number, r: number, h: number): Solid {
  return draw()
    .movePointerTo([0, -r])
    .hLineTo(railWidth)
    .ellipse(0, 2 * r, r, r, 0, false, true)
    .hLineTo(0)
    .close()
    .sketchOnPlane('XY')
    .extrude(h) as Solid
}

function addRails(c: Cuttleform, solid: Solid, element: BoardElement): Solid {
  if (!element.rails) return solid

  solid = solid.fuse(boardBoxBox({
    offset: new Vector(
      element.offset.x + element.size.x / 2 + element.rails.width / 2 + BOARD_COMPONENT_TOL / 2,
      element.offset.y - STOPPER_WIDTH,
      BOARD_TOLERANCE_Z,
    ),
    size: new Vector(element.rails.width - BOARD_COMPONENT_TOL, element.size.y, element.size.z + element.offset.z),
  }))
  solid = solid.fuse(boardBoxBox({
    offset: new Vector(
      element.offset.x - element.size.x / 2 - element.rails.width / 2 - BOARD_COMPONENT_TOL / 2,
      element.offset.y - STOPPER_WIDTH,
      BOARD_TOLERANCE_Z,
    ),
    size: new Vector(element.rails.width - BOARD_COMPONENT_TOL, element.size.y, element.size.z + element.offset.z),
  }))

  // Add backstop
  if (typeof element.rails.backstopHeight !== 'undefined') {
    solid = solid.fuse(boardBoxBox({
      offset: new Vector(element.offset.x, element.offset.y - element.size.y, BOARD_TOLERANCE_Z),
      size: new Vector(element.size.x + BOARD_COMPONENT_TOL * 2, STOPPER_WIDTH, element.size.z + element.offset.z + element.rails.backstopHeight),
    }))
  }

  for (const clamp of c.fastenMicrocontroller ? element.rails.clamps : []) {
    const jig = railJig(element.rails.width, clamp.radius, clamp.radius * 2 < 1 ? 0.5 : 1)
    const transformations: Trsf[] = []
    if (clamp.side == 'left') {
      transformations.push(
        new Trsf().translate(
          element.offset.x - element.size.x / 2 - element.rails.width,
          element.offset.y - clamp.radius - STOPPER_WIDTH,
          element.size.z + element.offset.z + BOARD_COMPONENT_TOL,
        ),
        new Trsf().translate(
          element.offset.x - element.size.x / 2 - element.rails.width,
          element.offset.y - element.size.y + clamp.radius,
          element.size.z + element.offset.z + BOARD_COMPONENT_TOL,
        ),
      )
    } else if (clamp.side == 'right') {
      transformations.push(
        new Trsf().mirror([1, 0, 0]).translate(
          element.offset.x + element.size.x / 2 + element.rails.width,
          element.offset.y - clamp.radius - STOPPER_WIDTH,
          element.size.z + element.offset.z + BOARD_COMPONENT_TOL,
        ),
        new Trsf().mirror([1, 0, 0]).translate(
          element.offset.x + element.size.x / 2 + element.rails.width,
          element.offset.y - element.size.y + clamp.radius,
          element.size.z + element.offset.z + BOARD_COMPONENT_TOL,
        ),
      )
    } else if (clamp.side == 'back') {
      const backJig = railJig(STOPPER_WIDTH, clamp.radius, 1)
      solid = solid.fuse(
        new Trsf().rotate(90).translate(
          element.offset.x,
          element.offset.y - element.size.y - STOPPER_WIDTH,
          element.size.z + element.offset.z + BOARD_COMPONENT_TOL,
        ).transform(backJig),
      )
      backJig.delete()
    }
    transformations.forEach(t => {
      solid = solid.fuse(t.transform(jig))
    })
    jig.delete()
  }
  return solid
}

export function boardHolder(c: Cuttleform, geo: Geometry): Solid {
  const boardPosWorld = geo.boardPositions
  const connOrigin = geo.connectorOrigin!

  const connOriginInv = connOrigin.inverted()
  const boardPos = mapObj(boardPosWorld, t => t.premultiplied(connOriginInv))

  let rect = microControllerRectangles(c, connOrigin, boardPosWorld)
    .map(r => drawRectangleByBounds(...r))
    .reduce((a, b) => a.fuse(b))

  const outerRadius = holderOuterRadius(c)

  const elements = boardElements(c, false)
  const boardProps = BOARD_PROPERTIES[c.microcontroller!]
  const offset = holderThickness(elements)

  // Cut out the cutout!
  for (const { origin, size } of boardProps.cutouts) {
    const location = c.flipConnectors ? new Vector(-origin.x, origin.y, origin.z) : origin
    rect = rect.cut(drawRoundedRectangle(size.x, size.y).translate(new Vector().add(location).add(elements[0].offset).xy()))
  }
  if (boardProps.sidecutout) {
    const minx = elements[0].offset.x - elements[0].size.x / 2
    const maxx = elements[0].offset.x + elements[0].size.x / 2
    const miny = elements[0].offset.y - elements[0].size.y + 5 // +5 so the parts are still connected
    const maxy = Math.min(elements[0].offset.y - 5, boardProps.sidecutoutMaxY ?? Infinity) // -5 so the parts are still connected
    const miny12 = boardPos.bottomLeft ? Math.max(boardPos.bottomLeft.origin().y + outerRadius, miny) : miny

    const maxy1 = boardPos.topLeft ? Math.min(maxy, boardPos.topLeft.origin().y - outerRadius) : maxy
    const maxy2 = boardPos.topRight ? Math.min(maxy, boardPos.topRight.origin().y - outerRadius) : maxy
    const leftCutout = Array.isArray(boardProps.sidecutout) ? boardProps.sidecutout[c.flipConnectors ? 1 : 0] : boardProps.sidecutout
    const rightCutout = Array.isArray(boardProps.sidecutout) ? boardProps.sidecutout[c.flipConnectors ? 0 : 1] : boardProps.sidecutout
    if (maxy - miny > 4 && leftCutout) {
      rect = rect.cut(drawRectangleByBounds(minx, minx + leftCutout, miny, maxy))
    }
    if (maxy - miny > 4 && rightCutout) {
      rect = rect.cut(drawRectangleByBounds(maxx - rightCutout, maxx, miny, maxy))
    }
  }

  // Draw fillets before cutting holes
  rect = rect.fillet(2, () => new FilletFinder(4))
  rect = rect.fillet(1, () => new FilletFinder(2, 4))
  rect = rect.fillet(0.5, () => new FilletFinder(0, 2))

  if (!boardProps.countersinkHoles) {
    for (const hole of boardProps.holes) {
      const location = c.flipConnectors ? new Vector(-hole.x, hole.y, hole.z) : hole
      if (!boardProps.tappedHoleDiameter) throw new Error('Missing hole diameter')
      rect = rect.cut(drawCircle(boardProps.tappedHoleDiameter / 2).translate(location.xy()))
    }
  }

  // Normal size hole for first boardPos
  // The other two get countersunk holes
  if (boardPos.topLeft) {
    rect = rect.cut(drawCircle(SCREWS[c.screwSize].plateDiameter / 2).translate(boardPos.topLeft.xy()))
  }

  // The solid should be BOARD_TOLERANCE_Z off the floor + top.
  let solid = rect.sketchOnPlane('XY').extrude(offset - BOARD_TOLERANCE_Z)
    .translateZ(BOARD_TOLERANCE_Z) as Solid
  const solidWallSurface = wallInnerSolidSurface(c, geo, BOARD_TOLERANCE_XY)

  // Countersink the holes
  if (boardProps.countersinkHoles) {
    if (!boardProps.tappedHoleDiameter) throw new Error('Missing hole diameter')
    const holeBody = genericScrewCountersunkProfile(
      boardProps.tappedHoleDiameter,
      boardProps.countersinkHoles.diameter,
      boardProps.countersinkHoles.angle,
      offset,
      1,
    ).sketchOnPlane('XZ').revolve().translateZ(offset) as Solid

    for (const hole of boardProps.holes) {
      const location = c.flipConnectors ? new Vector(-hole.x, hole.y, hole.z) : hole
      solid = solid.cut(new Trsf().translate(...location.xy(), 0).transform(holeBody))
    }
  }

  // Carve out channels under the side channels for solder to slide through
  if (boardProps.sidecutout) {
    const minx = elements[0].offset.x - elements[0].size.x / 2
    const maxx = elements[0].offset.x + elements[0].size.x / 2
    const miny = elements[0].offset.y - elements[0].size.y
    const maxy = Math.min(elements[0].offset.y + 100, boardProps.sidecutoutMaxY ?? Infinity) // Add extra material to clear everything in the holder
    const depth = Math.max(-0.6, 1 - elements[0].offset.z) // Leave minimum 1mm material at bottom

    const leftCutout = Array.isArray(boardProps.sidecutout) ? boardProps.sidecutout[c.flipConnectors ? 1 : 0] : boardProps.sidecutout
    const rightCutout = Array.isArray(boardProps.sidecutout) ? boardProps.sidecutout[c.flipConnectors ? 0 : 1] : boardProps.sidecutout
    if (leftCutout) {
      solid = solid.cut(drawRectangleByBounds(minx - BOARD_COMPONENT_TOL, minx + leftCutout, miny, maxy).sketchOnPlane('XY', elements[0].offset.z).extrude(depth) as Solid)
    }
    if (rightCutout) {
      solid = solid.cut(drawRectangleByBounds(maxx - rightCutout, maxx + BOARD_COMPONENT_TOL, miny, maxy).sketchOnPlane('XY', elements[0].offset.z).extrude(depth) as Solid)
    }
  }

  for (const element of elements) {
    if (element.model !== 'box') continue
    solid = solid.fuse(boardBox(element, 0))
  }

  // Add rails
  for (const element of elements) {
    solid = addRails(c, solid, element)
  }

  solid = connOrigin.transform(solid)

  const hole = screwCountersunkProfile(c, offset)
    .sketchOnPlane('XZ')
    .revolve() as Solid

  const splitter = new Splitter()
  splitter.addArgument(solid)
  splitter.addTool(solidWallSurface)
  for (const pos of [boardPosWorld.topRight, boardPosWorld.bottomLeft]) {
    const transform = pos.pretranslated(0, 0, offset)
    splitter.addTool(transform.transform(hole))
  }
  for (const element of elements) {
    if (element.model !== 'box') {
      // The 0.99 is a hack to deal with other elements offset a board_component_toler away from the board
      splitter.addTool(connOrigin.transform(boardBox(element, BOARD_COMPONENT_TOL * 0.99, true)))
    }
  }
  splitter.perform()

  let bestShape = splitter.takeBiggest()
  if (!bestShape) throw new Error('Could not generate a valid Microcontroller Holder')

  // Add notches
  for (const notch of boardProps.notches || []) {
    bestShape = bestShape.fuse(
      connOrigin.transform(boardBoxBox({
        offset: new Vector(
          c.flipConnectors ? -notch.origin.x : notch.origin.x,
          notch.origin.y + notch.height / 2,
          BOARD_TOLERANCE_Z,
        ),
        size: new Vector(notch.width, notch.height, elements[0].size.z + elements[0].offset.z),
      })),
    )
  }

  return bestShape
}

type Curve = [Trsf, Trsf, Trsf, Trsf]
