import { BOARD_PROPERTIES } from '$lib/geometry/microcontrollers'
import { SCREWS } from '$lib/geometry/screws'
import { socketSize } from '$lib/geometry/socketsParts'
import { switchInfo } from '$lib/geometry/switches'
import { simpleSocketTris } from '$lib/loaders/simpleparts'
import type { Triangle } from 'three'
import { Octree } from 'three/examples/jsm/math/Octree'
import { Vector2 } from 'three/src/math/Vector2'
import { calcTravel, ITriangle, simpleKey, simpleKeyPosition } from '../loaders/simplekeys'
import type { Cuttleform, CuttleKey, Geometry } from './config'
import type { CriticalPoints } from './geometry'
import { intersectPolyPoly } from './geometry.intersections'
import Trsf, { Vector } from './modeling/transformation'
import ETrsf from './modeling/transformation-ext'

interface IntersectionError {
  type: 'intersection'
  what: 'keycap' | 'socket' | 'part'
  i: number
  j: number
  travel?: number[]
}
interface MissingError {
  type: 'missing'
  key?: CuttleKey
  item: string
}
interface InvalidError {
  type: 'invalid'
  item: string
  value: string
  valid: string[]
}
interface WrongError {
  type: 'wrong'
  key: CuttleKey
  item: string
  value: any
}
interface OobError {
  type: 'oob'
  idx: number
  len: number
  item: string
}
interface ExceptionError {
  type: 'exception'
  when: string
  error: Error
}
interface NanError {
  type: 'nan'
  key: CuttleKey
}
interface NoKeysError {
  type: 'nokeys'
}
interface WallBoundsError {
  type: 'wallBounds'
  i: number
}

const PROPERTIES = ['aspect', 'type', 'position']

export type ConfError = (IntersectionError | MissingError | WrongError | OobError | InvalidError | ExceptionError | NanError | NoKeysError | WallBoundsError) & {
  side: 'left' | 'right' | 'unibody'
}

export function isRenderable(e: ConfError | undefined) {
  if (!e) return true
  return e.type == 'intersection' || e.type == 'wallBounds'
}

export function isWarning(e: ConfError) {
  return e.type == 'wallBounds' || (e.type == 'intersection' && e.what == 'socket')
}

export function checkConfig(conf: Cuttleform, geometry: Geometry, check3d = true, side: 'left' | 'right' | 'unibody'): ConfError | undefined {
  if (!conf.keys.length) return { type: 'nokeys', side }

  for (const key of conf.keys) {
    for (const property of PROPERTIES) {
      if (!key.hasOwnProperty(property)) {
        return { type: 'missing', key, item: property, side }
      }
      if (key.type == 'trackball' && !key.size) {
        return { type: 'missing', key, item: 'size', side }
      }
    }
    if (!(key.position instanceof ETrsf)) {
      return { type: 'wrong', key, item: 'position', value: key.position, side }
    }
    if (key.position.evaluate({ flat: false }, new Trsf()).origin().xyz().some(isNaN)) {
      return { type: 'nan', key, side }
    }
  }

  if (isNaN(conf.verticalClearance)) return { type: 'missing', item: 'verticalClearance', side }
  if (conf.microcontroller && !BOARD_PROPERTIES[conf.microcontroller]) {
    return { type: 'invalid', item: 'microcontroller', value: conf.microcontroller, valid: Object.keys(BOARD_PROPERTIES), side }
  }
  if (!SCREWS[conf.screwSize]) {
    return { type: 'invalid', item: 'screwSize', value: conf.screwSize, valid: Object.keys(SCREWS), side }
  }
  if (!SCREWS[conf.screwSize].mounting[conf.screwType]) {
    return { type: 'invalid', item: 'screwType', value: conf.screwType, valid: Object.keys(SCREWS[conf.screwSize].mounting), side }
  }
  if (!['average', 'slim', 'big', undefined].includes(conf.connectorSizeUSB)) {
    return { type: 'invalid', item: 'connectorSizeUSB', value: conf.connectorSizeUSB, valid: ['average', 'slim', 'big'], side }
  }

  const cpts = geometry.allKeyCriticalPoints2D
  const pts = cpts.map(a => a.map(x => new Vector2(...x.xy())))

  // for (const intersection of holeIntersections(pts)) {
  //   return intersection
  // }

  if (!check3d) return undefined

  try {
    // const trsfs3d = geometry.keyHolesTrsfs
    // const cpts3d = geometry.allKeyCriticalPoints
    // const { triangles } = geometry.solveTriangularization
    // const flatpts = cpts3d.flat()
    // const tris = triangles.map(([a, b, c]) => new ITriangle(flatpts[a].origin(), flatpts[b].origin(), flatpts[c].origin(), -1))

    // @ts-ignore
    // for (const intersection of keycapIntersections(conf, trsfs3d, tris)) {
    //   console.log(intersection)
    //   return intersection
    // }
    const wallPts = geometry.allWallCriticalPointsBase()
    for (const idx of conf.screwIndices) {
      if (idx >= wallPts.length) return { type: 'oob', idx, item: 'screwIndices', len: wallPts.length, side }
    }
    if (conf.connectorIndex >= wallPts.length) {
      return { type: 'oob', idx: conf.connectorIndex, item: 'connectorIndex', len: wallPts.length, side }
    }
  } catch (e) {
    console.error(e)
    return { type: 'exception', when: 'laying out the walls', error: e as Error, side }
  }

  try {
    const boardInd = geometry.boardIndices
  } catch (e) {
    console.error(e)
    return { type: 'exception', when: 'positioning the board', error: e as Error, side }
  }
}

// export function* holeIntersections(polys: Vector2[][]): Generator<IntersectionError> {
//   for (let i = 0; i < polys.length; i++) {
//     for (let j = i + 1; j < polys.length; j++) {
//       if (intersectPolyPoly(polys[i], polys[j])) {
//         yield {
//           type: 'intersection',
//           what: 'hole',
//           i,
//           j,
//         }
//       }
//     }
//   }
// }

/** Return triangles covering a prism defined by its top face & depth.
 * The triangle is centered at XY and extrudes down, like a socket */
function prismTriangles(facePoints: Trsf[], center: Trsf, depth: number, index: number) {
  const topCenter = center.origin()
  const botCenter = center.pretranslated(0, 0, -depth).origin()
  const topPts = facePoints.map(p => p.origin())
  const botPts = facePoints.map(p => p.pretranslated(0, 0, -depth).origin())
  return facePoints.flatMap((_, i) => {
    const j = (i + 1) % facePoints.length
    return [
      new ITriangle(topPts[i], topPts[j], topCenter, index), // Top
      new ITriangle(botPts[j], botPts[i], botCenter, index), // Bottom
      new ITriangle(topPts[i], botPts[i], topPts[j], index), // First side
      new ITriangle(botPts[i], botPts[j], topPts[j], index), // Second side
    ]
  })
}

export function* keycapIntersections(conf: Cuttleform, trsfs: Trsf[], web: ITriangle[], side: 'left' | 'right' | 'unibody') {
  const tree = new Octree()
  for (const tri of web) {
    tree.addTriangle(tri)
  }
  for (let i = 0; i < trsfs.length; i++) {
    const key = conf.keys[i]
    const position = simpleKeyPosition(key, trsfs[i])
    const skey = simpleKey(key, position.Matrix4(), i, true)
    if (!skey) continue
    for (const triangle of skey) {
      tree.addTriangle(triangle)
    }
  }
  tree.build()
  yield* treeIntersections(conf, tree, 'keycap', side)
}

export function* partIntersections(conf: Cuttleform, trsfs: Trsf[], side: 'left' | 'right' | 'unibody') {
  const tree = new Octree()
  for (let i = 0; i < trsfs.length; i++) {
    const key = conf.keys[i]
    const skey = simpleSocketTris(key.type, trsfs[i].Matrix4(), i)
    for (const triangle of skey) {
      tree.addTriangle(triangle)
    }
  }
  if (tree.triangles.length == 0) return
  tree.build()
  yield* treeIntersections(conf, tree, 'part', side)
}

export function* unsortedSocketIntersections(conf: Cuttleform, trsfs: Trsf[], critPts: CriticalPoints[], web: ITriangle[], side: 'left' | 'right' | 'unibody') {
  const tree = new Octree()
  for (const tri of web) {
    tree.addTriangle(tri)
  }
  for (let i = 0; i < trsfs.length; i++) {
    const size = socketSize(conf.keys[i])
    const prism = prismTriangles(critPts[i], trsfs[i], size.z, i)
    for (const triangle of prism) {
      tree.addTriangle(triangle)
    }
  }
  tree.build()
  yield* treeIntersections(conf, tree, 'socket', side, true)
}

/**
 * Sort socket intersections so that socket<-->socket intersections are returned first.
 *
 * Every socket-socket intersection will generate a socket->wall intersection as well,
 * but the socket-socket intersections are easier to debug so they should get priority.
 */
export function* socketIntersections(conf: Cuttleform, trsfs: Trsf[], critPts: CriticalPoints[], web: ITriangle[], side: 'left' | 'right' | 'unibody') {
  const socketSocketIntersections: ConfError[] = []
  const socketWallIntersections: ConfError[] = []
  for (const intersection of unsortedSocketIntersections(conf, trsfs, critPts, web, side)) {
    if (intersection.type != 'intersection') throw new Error('Only intersection errors expected')
    if (intersection.i == -1 || intersection.j == -1) {
      socketWallIntersections.push(intersection)
    } else {
      socketSocketIntersections.push(intersection)
    }
  }
  yield* socketSocketIntersections
  yield* socketWallIntersections
}

function* treeIntersections(conf: Cuttleform, tree: Octree, what: 'keycap' | 'socket' | 'part', side: 'left' | 'right' | 'unibody', ignoreTouching = false): Generator<ConfError> {
  const triangles = tree.triangles as ITriangle[]
  for (let i = 0; i < triangles.length; i++) {
    for (let j = 0; j < i; j++) {
      const ti = triangles[i].i, tj = triangles[j].i
      if (tj == ti) continue
      if (doTrianglesIntersect(triangles[i], triangles[j], ignoreTouching)) {
        let trvl: number[] = []
        if (ti >= 0) trvl.push(calcTravel(conf.keys[ti]))
        if (tj >= 0) trvl.push(calcTravel(conf.keys[tj]))
        yield {
          type: 'intersection',
          what,
          i: ti,
          j: tj,
          travel: trvl,
          side,
        }
      }
    }
  }
  for (const sub of tree.subTrees) {
    yield* treeIntersections(conf, sub, what, side, ignoreTouching)
  }
}

export function isPro(conf: Cuttleform) {
  return conf.rounded.side || conf.rounded.top || conf.shell?.type == 'stilts'
}

// https://stackoverflow.com/questions/7113344/find-whether-two-triangles-intersect-or-not
export function doTrianglesIntersect(t1: Triangle, t2: Triangle, ignoreTouching = false) {
  if (ignoreTouching) {
    // Return false if any triangles share a vertex
    if (
      t1.a.equals(t2.a) || t1.a.equals(t2.b) || t1.a.equals(t2.c)
      || t1.b.equals(t2.a) || t1.b.equals(t2.b) || t1.b.equals(t2.c)
      || t1.c.equals(t2.a) || t1.c.equals(t2.b) || t1.c.equals(t2.c)
    ) {
      return false
    }
  }

  /*
    Adapated from section "4.1 Separation of Triangles" of:

    - [Dynamic Collision Detection using Oriented Bounding Boxes](https://www.geometrictools.com/Documentation/DynamicCollisionDetection.pdf)
  */

  // Triangle 1:

  var A0 = t1.a
  var A1 = t1.b
  var A2 = t1.c

  var E0 = A1.clone().sub(A0)
  var E1 = A2.clone().sub(A0)
  var E2 = A2.clone().sub(A1)

  // var E2 = E1.clone().sub(E0);

  var N = E0.clone().cross(E1)

  // Triangle 2:

  var B0 = t2.a
  var B1 = t2.b
  var B2 = t2.c

  var F0 = B1.clone().sub(B0)
  var F1 = B2.clone().sub(B0)
  var F2 = B2.clone().sub(B1)

  // var F2 = F1.clone().sub(F0);

  var M = F0.clone().cross(F1)

  var D = B0.clone().sub(A0)

  // START ADDITIONS: Detect coplanar
  const n1 = new Vector().copy(N).normalize()
  const n2 = new Vector().copy(M).normalize()

  // They have the same normal vector
  if (1 - n1.dot(n2) < 1e-9) {
    // If the triangles lie on different planes, they do not intersect
    if (Math.abs(t1.a.dot(n1) - t2.a.dot(n2)) > 1e-5) {
      return false
    }
    // They are coplanar!
    // Create two axes perpendicular to the normal vector. I'll use Gram–Schmidt.
    // F0 and F1 are already perpendicular to the normal vector, so there's no need
    // to subtract out their projections
    const a = F0
    const b = new Vector().copy(F1).addScaledVector(a, -a.dot(F1)).normalize()
    // Project the triangle points onto these axes
    const ptsA = [
      new Vector2(t1.a.dot(a), t1.a.dot(b)),
      new Vector2(t1.b.dot(a), t1.b.dot(b)),
      new Vector2(t1.c.dot(a), t1.c.dot(b)),
    ]
    const ptsB = [
      new Vector2(t2.a.dot(a), t2.a.dot(b)),
      new Vector2(t2.b.dot(a), t2.b.dot(b)),
      new Vector2(t2.c.dot(a), t2.c.dot(b)),
    ]
    return intersectPolyPoly(ptsA, ptsB)
  }

  // END ADDITIONS

  function areProjectionsSeparated(p0: number, p1: number, p2: number, q0: number, q1: number, q2: number) {
    var min_p = Math.min(p0, p1, p2),
      max_p = Math.max(p0, p1, p2),
      min_q = Math.min(q0, q1, q2),
      max_q = Math.max(q0, q1, q2)

    return ((min_p > max_q) || (max_p < min_q))
  }

  // Only potential separating axes for non-parallel and non-coplanar triangles are tested.

  // Seperating axis: N

  {
    var p0 = 0,
      p1 = 0,
      p2 = 0,
      q0 = N.dot(D),
      q1 = q0 + N.dot(F0),
      q2 = q0 + N.dot(F1)

    if (areProjectionsSeparated(p0, p1, p2, q0, q1, q2)) {
      return false
    }
  }

  // Separating axis: M

  {
    var p0 = 0,
      p1 = M.dot(E0),
      p2 = M.dot(E1),
      q0 = M.dot(D),
      q1 = q0,
      q2 = q0

    if (areProjectionsSeparated(p0, p1, p2, q0, q1, q2)) {
      return false
    }
  }

  // Seperating axis: E0 × F0

  {
    var p0 = 0,
      p1 = 0,
      p2 = -(N.dot(F0)),
      q0 = E0.clone().cross(F0).dot(D),
      q1 = q0,
      q2 = q0 + M.dot(E0)

    if (areProjectionsSeparated(p0, p1, p2, q0, q1, q2)) {
      return false
    }
  }

  // Seperating axis: E0 × F1

  {
    var p0 = 0,
      p1 = 0,
      p2 = -(N.dot(F1)),
      q0 = E0.clone().cross(F1).dot(D),
      q1 = q0 - M.dot(E0),
      q2 = q0

    if (areProjectionsSeparated(p0, p1, p2, q0, q1, q2)) {
      return false
    }
  }

  // Seperating axis: E0 × F2

  {
    var p0 = 0,
      p1 = 0,
      p2 = -(N.dot(F2)),
      q0 = E0.clone().cross(F2).dot(D),
      q1 = q0 - M.dot(E0),
      q2 = q1

    if (areProjectionsSeparated(p0, p1, p2, q0, q1, q2)) {
      return false
    }
  }

  // Seperating axis: E1 × F0

  {
    var p0 = 0,
      p1 = N.dot(F0),
      p2 = 0,
      q0 = E1.clone().cross(F0).dot(D),
      q1 = q0,
      q2 = q0 + M.dot(E1)

    if (areProjectionsSeparated(p0, p1, p2, q0, q1, q2)) {
      return false
    }
  }

  // Seperating axis: E1 × F1

  {
    var p0 = 0,
      p1 = N.dot(F1),
      p2 = 0,
      q0 = E1.clone().cross(F1).dot(D),
      q1 = q0 - M.dot(E1),
      q2 = q0

    if (areProjectionsSeparated(p0, p1, p2, q0, q1, q2)) {
      return false
    }
  }

  // Seperating axis: E1 × F2

  {
    var p0 = 0,
      p1 = N.dot(F2),
      p2 = 0,
      q0 = E1.clone().cross(F2).dot(D),
      q1 = q0 - M.dot(E1),
      q2 = q1

    if (areProjectionsSeparated(p0, p1, p2, q0, q1, q2)) {
      return false
    }
  }

  // Seperating axis: E2 × F0

  {
    var p0 = 0,
      p1 = N.dot(F0),
      p2 = p1,
      q0 = E2.clone().cross(F0).dot(D),
      q1 = q0,
      q2 = q0 + M.dot(E2)

    if (areProjectionsSeparated(p0, p1, p2, q0, q1, q2)) {
      return false
    }
  }

  // Seperating axis: E2 × F1

  {
    var p0 = 0,
      p1 = N.dot(F1),
      p2 = p1,
      q0 = E2.clone().cross(F1).dot(D),
      q1 = q0 - M.dot(E2),
      q2 = q0

    if (areProjectionsSeparated(p0, p1, p2, q0, q1, q2)) {
      return false
    }
  }

  // Seperating axis: E2 × F2

  {
    var p0 = 0,
      p1 = N.dot(F2),
      p2 = p1,
      q0 = E2.clone().cross(F2).dot(D),
      q1 = q0 - M.dot(E2),
      q2 = q1

    if (areProjectionsSeparated(p0, p1, p2, q0, q1, q2)) {
      return false
    }
  }

  return true
}
