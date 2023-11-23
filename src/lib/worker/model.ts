import type { TopoDS_Shell } from '$assets/replicad_single'
import { BOARD_PROPERTIES, type BoardElement, boardElements, holderOuterRadius, holderThickness } from '$lib/geometry/microcontrollers'
import { SCREWS } from '$lib/geometry/screws'
import { wallBezier } from '@pro/rounded'
import { makeStiltsPlate, splitStiltsScrewInserts } from '@pro/stiltsModel'
import { cast, CornerFinder, downcast, draw, drawCircle, drawRoundedRectangle, Face, loft, type Point, type Sketch, Sketcher, Solid } from 'replicad'
import type { TiltGeometry } from './cachedGeometry'
import type { Cuttleform, Geometry } from './config'
import {
  allKeyCriticalPoints,
  allWallCriticalPoints,
  bezierPatch,
  type CriticalPoints,
  flattenKeyCriticalPoints,
  joinWalls,
  lineToCurve,
  loftCurves,
  makeLine,
  microControllerRectangles,
  type Patch,
  splineApproxLen,
  splitSplinesByApproxLenThrice,
  type WallCriticalPoints,
  wallCurve,
  wallSurfaces,
  wallSurfacesInner,
  wallSurfacesOuter,
  webThickness,
} from './geometry'
import { buildFixedSolid, buildSewnSolid, buildSolid, combine, getOC, makeQuad, makeTriangle } from './modeling'
import { makeCacher } from './modeling/cacher'
import { Splitter } from './modeling/splitter'
import Trsf from './modeling/transformation'
import { Vector } from './modeling/transformation'
import { keyHole } from './socketsLoader'
import { mapObj, sum } from './util'

export const PLATE_HEIGHT = 3
const ACCENT_HEIGHT = 1.5
const ACCENT_WIDTH = 0.8

export const WR_TOLERANCE = 0.25
const ACCENT_TOLERANCE = 0.05
const BOARD_TOLERANCE_XY = 0.5
const BOARD_TOLERANCE_Z = 0.1
const BOARD_COMPONENT_TOL = 0.1 // Added to sides of cutouts on board holder

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
      makeLine(w.ti.translated(worldZ, EXTRA_HEIGHT), w.to, w.key, null),
      surf[1],
      ...(c.shell.type == 'tilt' || c.shell.type == 'stilts'
        ? [makeLine(w.mo, w.bo.pretranslated(0, 0, -PLATE_HEIGHT)), makeLine(w.bo.pretranslated(0, 0, -PLATE_HEIGHT), w.bo.translated(0, 0, -500))]
        : [makeLine(w.mo, w.bo.translated(0, 0, -PLATE_HEIGHT))]),
    ]
  }).reverse()
}

export function wallInnerSurfaces(c: Cuttleform, pts: CriticalPoints[], trsfs: Trsf[], bottomZ: number, worldZ: Vector, offset: number) {
  const walls = allWallCriticalPoints(c, pts, trsfs, bottomZ, worldZ, offset)
  const EXTRA_HEIGHT = 100
  return walls.map(w => {
    const displacement = w.ti.axis(-offset, 0, 0)
    const wc = {
      ...w,
      bi: w.bi.translated(displacement.xyz()),
      mi: w.mi.pretranslated(displacement.xyz()),
      ki: w.ki.pretranslated(displacement.xyz()),
      ti: w.ti.pretranslated(displacement.xyz()),
    }
    const surf = wallSurfacesInner(c, wc)
    return [
      ...(c.shell.type == 'tilt'
        ? [makeLine(wc.bi.translated(0, 0, -EXTRA_HEIGHT), wc.bi.pretranslated(0, 0, -PLATE_HEIGHT)), makeLine(wc.bi.pretranslated(0, 0, -PLATE_HEIGHT), wc.bi)]
        : [makeLine(wc.bi.pretranslated(0, 0, -EXTRA_HEIGHT), wc.bi)]),
      surf[1],
      surf[2],
      surf[3],
      makeLine(wc.ti, wc.ti.translated(0, 0, EXTRA_HEIGHT), w.key, null),
    ]
  }).reverse()
}

export function accentWallSurfaces(c: Cuttleform, pts: CriticalPoints[], trsfs: Trsf[], bottomZ: number, worldZ: Vector, offset: number) {
  const EXTRA_HEIGHT = 100
  const height = ACCENT_HEIGHT + WR_TOLERANCE
  const loweredPts = pts.map(p => p.map(i => i.translated(0, 0, -height)))
  const walls = allWallCriticalPoints(c, loweredPts, trsfs, bottomZ, worldZ, offset).map(p => {
    return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.translated ? v.translated(0, 0, height) : v])) as WallCriticalPoints
  })
  const extraWall = allWallCriticalPoints(c, pts, trsfs, bottomZ, worldZ, ACCENT_WIDTH + offset)
  return walls.map((w, i) => {
    const surf = wallSurfacesOuter(c, w)
    return [
      makeLine(w.ti.translated(0, 0, EXTRA_HEIGHT), w.to, w.key, null),
      surf[1],
      makeLine(w.mo, w.bo),
      makeLine(w.bo, extraWall[i].bo.translated(0, 0, height)),
      makeLine(extraWall[i].bo.translated(0, 0, height), extraWall[i].bo.translated(0, 0, -PLATE_HEIGHT)),
    ]
  }).reverse()
}

export function wallSolidSurface(c: Cuttleform, geo: Geometry, pts: CriticalPoints[], trsfs: Trsf[], bottomZ: number, worldZ: Vector, offset: number, accented = false) {
  const surfs = accented ? accentWallSurfaces(c, pts, trsfs, bottomZ, worldZ, offset) : normalWallSurfaces(c, geo, bottomZ, worldZ, offset)
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

export function wallInnerSolidSurface(c: Cuttleform, pts: CriticalPoints[], trsfs: Trsf[], bottomZ: number, worldZ: Vector, offset: number) {
  const surfs = wallInnerSurfaces(c, pts, trsfs, bottomZ, worldZ, offset)
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
  return downcast(sewing.SewedShape()) as TopoDS_Shell
}

export function boundarySplines<T>(
  c: Cuttleform,
  boundary: number[],
  pt: (i: number) => Trsf,
  f: (conf: Cuttleform, a: Trsf, b: Trsf, c: Trsf, d: Trsf, wz: Vector, bz: number) => T,
  worldZ: Vector,
  bottomZ: number,
  reverse = false,
) {
  const connectingSplines: { [i: number]: { [j: number]: T } } = {}
  for (let i = 0; i < boundary.length; i++) {
    const b0 = i
    const b1 = (i + 1) % boundary.length
    const b2 = (i + 2) % boundary.length
    const b3 = (i + 3) % boundary.length
    const spline = reverse
      ? f(c, pt(b3), pt(b2), pt(b1), pt(b0), worldZ, bottomZ)
      : f(c, pt(b0), pt(b1), pt(b2), pt(b3), worldZ, bottomZ)
    connectingSplines[boundary[b1]] = { [boundary[b2]]: spline }
  }
  return connectingSplines
}

export function webSolid(c: Cuttleform, geo: Geometry, sew: boolean) {
  const topCPts = geo.allKeyCriticalPoints
  const botCPts = allKeyCriticalPoints(
    c,
    geo.keyHolesTrsfs.map((t, i) => {
      return t.pretranslated(0, 0, -webThickness(c, c.keys[i]))
    }),
  )
  const pts2D = flattenKeyCriticalPoints(c, geo.allKeyCriticalPoints2D, geo.keyHolesTrsfs)

  const topPts = topCPts.flat()
  const botPts = botCPts.flat()

  let { triangles, boundary } = geo.solveTriangularization
  const polygons: Face[] = []

  const triangleMap = {}
  triangles.forEach(([a, b, c]) => {
    if (!triangleMap[a]) triangleMap[a] = {}
    if (!triangleMap[b]) triangleMap[b] = {}
    if (!triangleMap[c]) triangleMap[c] = {}
    triangleMap[a][b] = true
    triangleMap[a][c] = true
    triangleMap[b][a] = true
    triangleMap[b][c] = true
    triangleMap[c][a] = true
    triangleMap[c][b] = true
  })

  const polyMap = {}
  let polyI = 0
  for (const poly of topCPts) {
    // Iterate through each side of the wall in pairs
    for (let j = 0; j < poly.length; j++) {
      const a = polyI + j
      const b = polyI + ((j + 1) % poly.length)
      if (!polyMap[a]) polyMap[a] = {}
      if (!polyMap[b]) polyMap[b] = {}
      polyMap[a][b] = true
      polyMap[b][a] = true
    }
    polyI += poly.length
  }

  const walls = geo.allWallCriticalPoints()

  const topSplines = boundarySplines(c, boundary, i => walls[i].ti, wallCurve, geo.worldZ, geo.bottomZ, true)
  const bottomSplines = boundarySplines(c, boundary, i => walls[i].ki, wallCurve, geo.worldZ, geo.bottomZ, false)

  // const smoothtrianglestop: SmoothTriangle[] = []
  // const smoothtrianglesbot: SmoothTriangle[] = []

  // Use normal ordering for top triangle, reverse ordering for bottom so it faces the opposite direction.
  // If we encounter a wall on the boundary, use boundary make the wall
  for (let [a, b, c] of triangles) {
    if (topSplines[b] && topSplines[b][a]) {
      ;[a, b] = [b, a]
    } else if (topSplines[b] && topSplines[b][c]) {
      ;[a, b, c] = [b, c, a]
    } else if (topSplines[c] && topSplines[c][b]) {
      ;[a, b, c] = [c, b, a]
    } else if (topSplines[a] && topSplines[a][c]) {
      ;[a, b, c] = [a, c, b]
    } else if (topSplines[c] && topSplines[c][a]) {
      ;[a, b, c] = [c, a, b]
    }

    if (topSplines[a] && topSplines[a][b] && triangleMap[a][b]) {
      let l0 = topSplines[a][b]
      const l0b = bottomSplines[a][b]

      if (topSplines[b] && topSplines[b][c] && triangleMap[b][c]) {
        let l1 = topSplines[b][c]
        let l2 = lineToCurve(topPts[a], topPts[c])
        polygons.push(bezierFace(bezierPatch(l0, l2, l1)))
        const l1b = bottomSplines[b][c]
        const l2b = lineToCurve(botPts[c], botPts[a])
        polygons.push(bezierFace(bezierPatch(l0b, l1b, l2b)))

        // Extra side for extra wall
        const left = lineToCurve(topPts[b], botPts[b])
        const right = lineToCurve(topPts[c], botPts[c])
        polygons.push(bezierFace(bezierPatch(l1b, left, l1, right)))
      } else {
        let l1 = lineToCurve(topPts[c], topPts[b])
        let l2 = lineToCurve(topPts[a], topPts[c])
        polygons.push(bezierFace(bezierPatch(l0, l2, l1)))
        const l1b = lineToCurve(botPts[b], botPts[c])
        const l2b = lineToCurve(botPts[c], botPts[a])
        polygons.push(bezierFace(bezierPatch(l0b, l1b, l2b)))
      }

      const left = lineToCurve(topPts[a], botPts[a])
      const right = lineToCurve(topPts[b], botPts[b])
      polygons.push(bezierFace(bezierPatch(l0b, left, l0, right)))
    } else {
      if (SMOOTHAPEX) {
        // const tri = makeSmoothTriangle(topPts, pts2D, a, b, c, polyMap, true)
        // const pt = new oc.gp_Pnt_1()
        // console.log(tri)
        // (0,1) is repetitive - goes to (0,0)
        // tri.D0(1, 1, pt)
        // console.log(pt.X(), pt.Y(), pt.Z(), topPts[a].xyz(), topPts[b].xyz(), topPts[c].xyz())
        // polygons.push(makeSmoothTriangle(topPts, pts2D, a, b, c, polyMap))
        // polygons.push(makeSmoothTriangle(botPts, pts2D, c, b, a, polyMap))
        // smoothtrianglestop.push({ a, b, c})

        // UNCOMMENT THIS
        // polygons.push(...makeSmoothTriangle(topPts, pts2D, a, b, c, polyMap))
        polygons.push(makeTriangle(botPts[c], botPts[b], botPts[a]))
        // smoothtrianglesbot.push({ c: a, b: b, a: c})
      } else {
        polygons.push(makeTriangle(topPts[a], topPts[b], topPts[c]))
        polygons.push(makeTriangle(botPts[c], botPts[b], botPts[a]))
      }
    }
  }

  // if (SMOOTHAPEX) {
  //     const subdividedTop = smoothTriangles(smoothtrianglestop, topPts.map(p => p.origin()), topPts, pts2D, polyMap)
  //     for (const { a, b, c } of subdividedTop) {
  //         polygons.push(makeTriangle(a, b, c))
  //     }
  //     // const subdividedBot = smoothTriangles(smoothtrianglestop, topPts.map(p => p.origin()))
  //     // for (const { a, b, c } of subdividedBot) {
  //     //     polygons.push(makeTriangle(a, b, c))
  //     // }
  // }

  // Make walls for key well
  let i = 0
  for (const poly of topCPts) {
    // Iterate through each side of the wall in pairs
    for (let j = 0; j < poly.length; j++) {
      const a = i + j
      const b = i + ((j + 1) % poly.length)
      if (triangleMap[a] && triangleMap[a][b]) {
        polygons.push(makeQuad(topPts[a], topPts[b], botPts[b], botPts[a]))
      }
    }
    i += poly.length
  }

  return sew ? buildSewnSolid(polygons) : buildSolid(polygons)
}

function plateSketch(c: Cuttleform, geo: PlateParams, offset = 0) {
  let sketch: Sketch
  const wall = geo.allWallCriticalPoints(offset)

  const planePtV = (v: Vector) => [v.dot(geo.worldX), v.dot(geo.worldY)] as [number, number]
  const planePt = (t: Trsf) => planePtV(t.origin())
  if (c.rounded.side) {
    let { boundary } = geo.solveTriangularization

    const splines = boundarySplines(c, boundary, i => wall[i].bo, wallBezier, geo.worldZ, geo.bottomZ)
    const sketcher = new Sketcher('XY').movePointerTo(planePt(wall[0].bo))
    for (let i = 0; i < boundary.length; i++) {
      const b0 = boundary[i]
      const b1 = boundary[(i + 1) % boundary.length]
      const spline = splines[b0][b1]
      sketcher.bezierCurveTo(planePt(spline[3]), [planePt(spline[1]), planePt(spline[2])])
    }
    sketch = sketcher.close()
  } else {
    const points = geo.allWallCriticalPoints(offset).map(w => planePt(w.bo))
    const sketcher = new Sketcher('XY').movePointerTo(points[0])
    for (let i = 1; i < points.length; i++) {
      sketcher.lineTo(points[i])
    }
    sketch = sketcher.close()
  }
  return sketch
}

function screwCountersunkProfile(c: Cuttleform, height = PLATE_HEIGHT, margin = 1) {
  const screwInfo = SCREWS[c.screwSize]
  const countersunkHeight = (screwInfo.countersunkDiameter - screwInfo.plateDiameter) / 2 / Math.tan(screwInfo.countersunkAngle * Math.PI / 360)
  return draw()
    .hLine(screwInfo.plateDiameter / 2)
    .vLine(-height + countersunkHeight)
    .lineTo([screwInfo.countersunkDiameter / 2, -height])
    .vLine(-margin)
    .lineTo([0, -height - margin])
    .close()
}
export function screwStraightProfile(c: Cuttleform, height = PLATE_HEIGHT, diameter?: number) {
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
}

function makeNormalPlate(c: Cuttleform, geo: PlateParams) {
  const sketch = plateSketch(c, geo)
  const plate = sketch.extrude(-PLATE_HEIGHT) as Solid
  const trsf = new Trsf().coordSystemChange(new Vector(), geo.worldX, geo.worldZ).preTranslate(0, 0, geo.bottomZ)
  return trsf.transform(plate)
}

function makeAccentPlate(c: Cuttleform, geo: Geometry) {
  const height = PLATE_HEIGHT

  const sketch = plateSketch(c, geo, ACCENT_WIDTH)
  const trsf = new Trsf().coordSystemChange(new Vector(), geo.worldX, geo.worldZ).preTranslate(0, 0, geo.bottomZ)
  const plateUpper = trsf.transform(sketch.clone().extrude(ACCENT_HEIGHT))
  const plateLower = trsf.transform(sketch.extrude(-height))

  const solidWallSurface = wallSolidSurface(c, geo, geo.allKeyCriticalPoints, geo.keyHolesTrsfs, geo.bottomZ, geo.worldZ, ACCENT_TOLERANCE)
  const splitter = new Splitter()
  splitter.addArgument(plateUpper)
  splitter.addTool(solidWallSurface)
  splitter.perform()
  return splitter.takeBiggest()!.fuse(plateLower)
}

interface Plate {
  top: Solid
  bottom?: Solid
}
export function makePlate(c: Cuttleform, geo: Geometry, cut = false, inserts = false): Plate {
  const positions = [...geo.screwPositions]
  if (c.shell.type == 'stilts') {
    return makeStiltsPlate(c, geo, cut)
  }
  if (c.shell.type == 'tilt') {
    const tiltGeo = geo as TiltGeometry
    return {
      top: combine([
        // cutPlateWithHoles(c, makeNormalPlate(c, geo), positions),
        joinTiltPlates(c, geo as any),
        plateRing(c, geo, -PLATE_HEIGHT),
        plateRing(c, tiltBotGeo(c, tiltGeo), PLATE_HEIGHT),
        inserts ? makerScrewInserts(c, geo, ['plate']) : null,
      ]),
      bottom: cutPlateWithHoles(c, makeBottomestPlate(c, tiltGeo), tiltGeo.bottomScrewPositions).translateZ(-0.01),
    }
  }
  if (c.shell.type == 'basic' && c.shell.lip) {
    return { top: cutPlateWithHoles(c, makeAccentPlate(c, geo), positions) }
  }
  return { top: cutPlateWithHoles(c, makeNormalPlate(c, geo), positions) }
}

export function makeBottomestPlate(c: Cuttleform, geo: TiltGeometry) {
  return makeNormalPlate(c, tiltBotGeo(c, geo))
}

function wallBoundaryBeziers(c: Cuttleform, geo: PlateParams, pt: 'bo' | 'bi' = 'bo', offset = 0) {
  const wall = geo.allWallCriticalPoints(offset)
  const beziers: Curve[] = []

  if (c.rounded.side) {
    let { boundary } = geo.solveTriangularization

    const splines = boundarySplines(c, boundary, i => wall[i][pt], wallBezier, geo.worldZ, geo.bottomZ)
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
  return buildSewnSolid(faces)
}

function tiltBotGeo(c: Cuttleform, geo: TiltGeometry): PlateParams {
  return {
    worldX: new Vector(1, 0, 0),
    worldY: new Vector(0, 1, 0),
    worldZ: new Vector(0, 0, 1),
    bottomZ: geo.floorZ + PLATE_HEIGHT,
    solveTriangularization: geo.solveTriangularization,
    allWallCriticalPoints: (offset?: number) =>
      geo.allWallCriticalPoints(offset).map(w => ({
        ...w,
        bi: w.bi.translated(0, 0, -w.bi.origin().z + geo.floorZ + PLATE_HEIGHT),
        bo: w.bo.translated(0, 0, -w.bo.origin().z + geo.floorZ + PLATE_HEIGHT),
      })),
  }
}

function joinTiltPlatesLoft(c: Cuttleform, geo: TiltGeometry) {
  const topTrsf = new Trsf().coordSystemChange(new Vector(), geo.worldX, geo.worldZ).preTranslate(0, 0, geo.bottomZ)
  const topSketch = plateSketch(c, geo).wire
  const topSurface = topTrsf.transform(topSketch)

  const bottomTrsf = new Trsf().preTranslate(0, 0, geo.floorZ)
  const bottomSketch = plateSketch(c, {
    worldX: new Vector(1, 0, 0),
    worldY: new Vector(0, 1, 0),
    worldZ: new Vector(0, 0, 1),
    bottomZ: geo.floorZ,
    solveTriangularization: geo.solveTriangularization,
    allWallCriticalPoints: geo.allWallCriticalPoints.bind(geo),
  }).wire
  const bottomSurface = bottomTrsf.transform(bottomSketch)
  return loft([topSurface, bottomSurface])
}

function joinTiltPlates(c: Cuttleform, geo: TiltGeometry) {
  if (c.shell.type !== 'tilt') throw new Error('oops')

  const topTranslation = new Trsf().coordSystemChange(new Vector(), geo.worldX, geo.worldZ).preTranslate(0, 0, -PLATE_HEIGHT).xyz()
  const topBoundary = wallBoundaryBeziers(c, geo).map(c => c.map(t => t.translated(topTranslation))) as Curve[]
  const topBoundaryInner = wallBoundaryBeziers(c, geo, 'bi').map(c => c.map(t => t.translated(topTranslation))) as Curve[]

  const botTranslation = [0, 0, PLATE_HEIGHT] as [number, number, number]
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
    return buildSewnSolid(faces.map(bezierFace))
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
        bodies.push(buildSewnSolid(faces))
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

export function screwInsertDimensions(c: Cuttleform) {
  const dimensions = SCREWS[c.screwSize].mounting[c.screwType]
  const taperIndent = dimensions.height * Math.tan((dimensions.taper || 0) / 180 * Math.PI)
  const bottomRadius = dimensions.diameter / 2
  const topRadius = bottomRadius - taperIndent
  const outerBottomRadius = Math.max(...Object.values(SCREWS[c.screwSize].mounting).map(m => m.diameter)) / 2 + 1.6
  const outerTopRadius = outerBottomRadius - taperIndent
  const height = dimensions.height
  return { bottomRadius, topRadius, outerBottomRadius, outerTopRadius, height }
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
  const solidWallSurface = wallInnerSolidSurface(c, geo.allKeyCriticalPoints, geo.keyHolesTrsfs, geo.bottomZ, geo.worldZ, 0)

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
      ...(geo as TiltGeometry).bottomScrewPositions.map(p => makeScrewInsert(c, solidWallSurface, p, false)),
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

export const connectors: Record<string, { positive: (c: Cuttleform) => Solid | null; negative: (c: Cuttleform) => Solid }> = {
  rj9: {
    positive(c: Cuttleform) {
      return drawRoundedRectangle(14.78, 22.38).translate(0, 22.38 / 2)
        .fuse(drawRoundedRectangle(10.5, 17.6).translate(12.64, 17.6 / 2))
        .sketchOnPlane('XZ')
        .extrude(13)
        .translate(0, 6.5, 0) as Solid
    },
    negative(c: Cuttleform) {
      const throughHole = drawRoundedRectangle(10.78, 5).sketchOnPlane('XZ')
        .extrude(13)
        .translate(0, 6.5, 16) as Solid
      const shallowHole = drawRoundedRectangle(10.78, 18.38).sketchOnPlane('XZ')
        .extrude(9)
        .translate(0, 6.5, 11.19) as Solid
      const usbHole = drawRoundedRectangle(6.5, 13.6).sketchOnPlane('XZ')
        .extrude(13)
        .translate(12.64, 6.5, 17.6 / 2) as Solid
      return throughHole.fuse(shallowHole).fuse(usbHole)
    },
  },
  trrs: {
    positive(c: Cuttleform) {
      return null
    },
    negative(c: Cuttleform) {
      return drawCircle(3.2).translate(-14.5, 0) // trrs hole
        .fuse(drawRoundedRectangle(10.5, 6.5, 3)) // usb hole
        .sketchOnPlane('XZ')
        .extrude(c.wallThickness * 10)
        .translate(0, c.wallThickness * 10, 5) as Solid
    },
  },
  usb: {
    positive(c: Cuttleform) {
      return null
    },
    negative(c: Cuttleform) {
      return drawRoundedRectangle(10.5, 6.5, 3) // usb hole
        .sketchOnPlane('XZ')
        .extrude(c.wallThickness * 10)
        .translate(0, c.wallThickness * 10, 5) as Solid
    },
  },
  external: {
    positive(c: Cuttleform) {
      return null
    },
    negative(c: Cuttleform) {
      return drawRoundedRectangle(29.1661, 12.6)
        .sketchOnPlane('XZ')
        .extrude(c.wallThickness * 10)
        .translate(10, c.wallThickness * 10, 12.6 / 2) as Solid
    },
  },
}

export function cutWithConnector(c: Cuttleform, wall: Solid, conn: keyof typeof connectors, origin: Trsf) {
  if (!conn) return wall
  const pos = connectors[conn].positive(c)
  if (pos) return wall.cut(origin.transform(pos))
  return wall.cut(origin.transform(connectors[conn].negative(c)))
}

export function makeConnector(c: Cuttleform, conn: keyof typeof connectors, origin: Point) {
  if (!conn) return null
  const pos = connectors[conn].positive(c)
  if (pos) return pos.cut(connectors[conn].negative(c)).translate(origin)
  return null
}

export function makeWalls(c: Cuttleform, wallPts: WallCriticalPoints[], worldZ: Vector, bottomZ: number, sew: boolean) {
  const polygons = joinWalls(c, wallPts.map(w => wallSurfaces(c, w)), worldZ, bottomZ).map(bezierFace)
  return sew ? buildSewnSolid(polygons) : buildFixedSolid(polygons)
}

function drawRectangleByBounds(minx: number, maxx: number, miny: number, maxy: number) {
  return drawRoundedRectangle(maxx - minx, maxy - miny)
    .translate((minx + maxx) / 2, (miny + maxy) / 2)
}

function boardBox(element: BoardElement, origin: Vector, tol: number, infinite = false): Solid {
  let yExtra = infinite ? 100 : 0
  const bottom = drawRectangleByBounds(
    origin.x + element.offset.x - element.size.x / 2 - tol,
    origin.x + element.offset.x + element.size.x / 2 + tol,
    origin.y + element.offset.y - element.size.y - tol,
    origin.y + element.offset.y + tol + yExtra,
  )
  return bottom.sketchOnPlane('XY').extrude(element.size.z + 2 * tol).translateZ(element.offset.z - tol) as Solid
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

export function boardHolder(c: Cuttleform, geo: Geometry): Solid {
  const boardPosWorld = geo.boardPositions
  const connOrigin = geo.connectorOrigin

  const connOriginInv = geo.connectorOrigin.inverted()
  const boardPos = mapObj(boardPosWorld, t => t.preMultiplied(connOriginInv))

  let rect = microControllerRectangles(c, connOrigin, boardPosWorld)
    .map(r => drawRectangleByBounds(...r))
    .reduce((a, b) => a.fuse(b))

  const outerRadius = holderOuterRadius(c)

  const elements = boardElements(c, false)
  const boardProps = BOARD_PROPERTIES[c.microcontroller!]
  const offset = holderThickness(elements)

  // Cut out the cutout!
  for (const { origin, size } of boardProps.cutouts) {
    rect = rect.cut(drawRoundedRectangle(size.x, size.y).translate(new Vector().add(origin).add(elements[0].offset).xy()))
  }
  if (boardProps.sidecutout) {
    const minx = elements[0].offset.x - elements[0].size.x / 2
    const maxx = elements[0].offset.x + elements[0].size.x / 2
    const miny = elements[0].offset.y - elements[0].size.y + 5 // +5 so the parts are still connected
    const maxy = elements[0].offset.y - 5 // -5 so the parts are still connected
    const miny12 = boardPos.bottomLeft ? Math.max(boardPos.bottomLeft.origin().y + outerRadius, miny) : miny

    const maxy1 = boardPos.topLeft ? Math.min(maxy, boardPos.topLeft.origin().y - outerRadius) : maxy
    const maxy2 = boardPos.topRight ? Math.min(maxy, boardPos.topRight.origin().y - outerRadius) : maxy
    if (maxy1 - miny12 > 4) {
      rect = rect.cut(drawRectangleByBounds(minx, minx + boardProps.sidecutout, miny12, maxy1))
    }
    if (maxy2 - miny12 > 4) {
      rect = rect.cut(drawRectangleByBounds(maxx - boardProps.sidecutout, maxx, miny12, maxy2))
    }
  }

  // Draw fillets before cutting holes
  rect = rect.fillet(2, () => new FilletFinder(4))
  rect = rect.fillet(1, () => new FilletFinder(2, 4))
  rect = rect.fillet(0.5, () => new FilletFinder(0, 2))

  for (const hole of boardProps.holes) {
    const location = hole
    rect = rect.cut(drawCircle(boardProps.tappedHoleDiameter! / 2).translate(location.xy()))
  }

  // Normal size hole for first boardPos
  // The other two get countersunk holes
  if (boardPos.topLeft) {
    rect = rect.cut(drawCircle(SCREWS[c.screwSize].plateDiameter / 2).translate(boardPos.topLeft.xy()))
  }

  // The solid should be BOARD_TOLERANCE_Z off the floor + top.
  let solid = rect.sketchOnPlane('XY').extrude(offset - BOARD_TOLERANCE_Z)
    .translateZ(BOARD_TOLERANCE_Z) as Solid
  const solidWallSurface = wallInnerSolidSurface(c, geo.allKeyCriticalPoints, geo.keyHolesTrsfs, geo.bottomZ, geo.worldZ, BOARD_TOLERANCE_XY)

  for (const element of elements) {
    if (element.model !== 'box') continue
    solid = solid.fuse(boardBox(element, new Vector(), 0))
  }

  // Add backstop
  solid = solid.fuse(boardBox(
    {
      model: 'box',
      offset: new Vector(0, -elements[0].size.y, BOARD_TOLERANCE_Z),
      size: new Vector(elements[0].size.x, 2, elements[0].size.z + elements[0].offset.z + 0.5),
      boundingBoxZ: 5,
    },
    new Vector(),
    0,
  ))

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
      splitter.addTool(connOrigin.transform(boardBox(element, new Vector(), BOARD_COMPONENT_TOL, true)))
    }
  }
  splitter.perform()

  const bestShape = splitter.takeBiggest()
  if (!bestShape) throw new Error('Could not generate a valid Microcontroller Holder')
  return bestShape
}

type Curve = [Trsf, Trsf, Trsf, Trsf]

export function bezierFace(patch: Patch) {
  const oc = getOC()
  const pts = new oc.TColgp_Array2OfPnt_2(1, 4, 1, 4)
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const pt = new oc.gp_Pnt_3(patch[i][j].x, patch[i][j].y, patch[i][j].z)
      pts.SetValue(i + 1, j + 1, pt)
    }
  }
  const surface = new oc.Geom_BezierSurface_1(pts)
  const face = new oc.BRepBuilderAPI_MakeFace_8(new oc.Handle_Geom_Surface_2(surface), 1e-3).Face()
  return new Face(face)
}
