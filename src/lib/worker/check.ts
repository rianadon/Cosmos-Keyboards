import { BOARD_PROPERTIES } from '$lib/geometry/microcontrollers'
import { SCREWS } from '$lib/geometry/screws'
import { switchInfo } from '$lib/geometry/switches'
import { Triangle, Vector2, Vector3 } from 'three'
import { Octree } from 'three/examples/jsm/math/Octree'
import type { Cuttleform, CuttleKey, Geometry } from './config'
import { allKeyCriticalPoints, allWallCriticalPoints, boardIndices, keyHolesTrsfs, keyHolesTrsfs2D, solveTriangularization } from './geometry'
import Trsf from './modeling/transformation'
import ETrsf from './modeling/transformation-ext'
import { ITriangle, simpleKey, simplekeyGeo, simpleTris } from './simplekeys'

interface IntersectionError {
  type: 'intersection'
  what: 'hole' | 'keycap'
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

const PROPERTIES = ['aspect', 'type', 'position']

export type ConfError = IntersectionError | MissingError | WrongError | OobError | InvalidError | ExceptionError | NanError | NoKeysError

export function checkConfig(conf: Cuttleform, geometry: Geometry, check3d = true): ConfError | null {
  if (!conf.keys.length) return { type: 'nokeys' }

  for (const key of conf.keys) {
    for (const property of PROPERTIES) {
      if (!key.hasOwnProperty(property)) {
        return { type: 'missing', key, item: property }
      }
      if (key.type == 'trackball' && !key.size) {
        return { type: 'missing', key, item: 'size' }
      }
    }
    if (!(key.position instanceof ETrsf)) {
      return { type: 'wrong', key, item: 'position', value: key.position }
    }
    if (key.position.evaluate({ flat: false }, new Trsf()).origin().xyz().some(isNaN)) {
      return { type: 'nan', key }
    }
  }

  if (isNaN(conf.verticalClearance)) return { type: 'missing', item: 'verticalClearance' }
  if (conf.microcontroller && !BOARD_PROPERTIES[conf.microcontroller]) {
    return { type: 'invalid', item: 'microcontroller', value: conf.microcontroller, valid: Object.keys(BOARD_PROPERTIES) }
  }
  if (!SCREWS[conf.screwSize]) {
    return { type: 'invalid', item: 'screwSize', value: conf.screwSize, valid: Object.keys(SCREWS) }
  }
  if (!SCREWS[conf.screwSize].mounting[conf.screwType]) {
    return { type: 'invalid', item: 'screwType', value: conf.screwType, valid: Object.keys(SCREWS[conf.screwSize].mounting) }
  }

  const cpts = geometry.allKeyCriticalPoints2D
  const pts = cpts.map(a => a.map(x => new Vector2(...x.xy())))

  for (const intersection of holeIntersections(pts)) {
    return intersection
  }

  if (!check3d) return null

  try {
    const trsfs3d = geometry.keyHolesTrsfs
    const cpts3d = geometry.allKeyCriticalPoints
    const { triangles } = geometry.solveTriangularization
    const flatpts = cpts3d.flat()
    const tris = triangles.map(([a, b, c]) => new ITriangle(flatpts[a].origin(), flatpts[b].origin(), flatpts[c].origin(), -1))

    // @ts-ignore
    for (const intersection of keycapIntersections(conf, trsfs3d, tris)) {
      console.log(intersection)
      return intersection
    }
    const wallPts = geometry.allWallCriticalPoints()
    for (const idx of conf.screwIndices) {
      if (idx >= wallPts.length) return { type: 'oob', idx, item: 'screwIndices', len: wallPts.length }
    }
    if (conf.connectorIndex >= wallPts.length) {
      return { type: 'oob', idx: conf.connectorIndex, item: 'connectorIndex', len: wallPts.length }
    }
  } catch (e) {
    console.error(e)
    return { type: 'exception', when: 'laying out the walls', error: e }
  }

  try {
    const boardInd = geometry.boardIndices
  } catch (e) {
    console.error(e)
    return { type: 'exception', when: 'positioning the board', error: e }
  }

  return null
}

export function* holeIntersections(polys: Vector2[][]): Generator<IntersectionError> {
  for (let i = 0; i < polys.length; i++) {
    for (let j = i + 1; j < polys.length; j++) {
      if (intersects(polys[i], polys[j])) {
        yield {
          type: 'intersection',
          what: 'hole',
          i,
          j,
        }
      }
    }
  }
}

function travel(k: CuttleKey) {
  const swInfo = switchInfo(k.type)
  return swInfo.height - swInfo.pressedHeight
}

function* keycapIntersections(conf: Cuttleform, trsfs: Trsf[], web: ITriangle[]) {
  const tree = new Octree()
  for (const tri of web) {
    tree.addTriangle(tri)
  }
  simplekeyGeo.update(() => [])
  simpleTris.update(() => [])
  for (let i = 0; i < trsfs.length; i++) {
    const key = conf.keys[i]
    if (key.type == 'blank' || key.type == 'ec11' || 'trackball' in key) continue
    if (!('keycap' in key)) continue
    const position = trsfs[i].pretranslated(0, 0, switchInfo(key.type).height).Matrix4()
    const skey = simpleKey(key.keycap.profile, key.aspect, key.keycap.row, position, i, travel(key))
    if (!skey) continue
    for (const triangle of skey) {
      tree.addTriangle(triangle)
    }
  }
  tree.build()
  yield* treeIntersections(conf, tree)
}

function* treeIntersections(conf: Cuttleform, tree: Octree) {
  const triangles = tree.triangles as ITriangle[]
  for (let i = 0; i < triangles.length; i++) {
    for (let j = 0; j < i; j++) {
      const ti = triangles[i].i, tj = triangles[j].i
      if (tj == ti) continue
      if (doTrianglesIntersect(triangles[i], triangles[j])) {
        let trvl: number[] = []
        if (ti >= 0) trvl.push(travel(conf.keys[ti]))
        if (tj >= 0) trvl.push(travel(conf.keys[tj]))
        simpleTris.update(t => [...t, triangles[i], triangles[j]])
        yield {
          type: 'intersection',
          what: 'keycap',
          i: ti,
          j: tj,
          travel: trvl,
        }
      }
    }
  }
  for (const sub of tree.subTrees) {
    yield* treeIntersections(conf, sub)
  }
}

/** Determine whether two 2D polygons intersect each other. */
function intersects(a: Vector2[], b: Vector2[]) {
  for (let i = 0; i < a.length; i++) {
    const side = new Vector2().copy(a[i]).sub(a[(i + 1) % a.length]).normalize()
    const normal = new Vector2(-side.y, side.x)

    const projA = a.map(p => p.dot(normal))
    const projB = b.map(p => p.dot(normal))
    if (Math.max(...projA) < Math.min(...projB) || Math.min(...projA) > Math.max(...projB)) {
      return false
    }
  }
  for (let i = 0; i < b.length; i++) {
    const side = new Vector2().copy(b[i]).sub(b[(i + 1) % b.length]).normalize()
    const normal = new Vector2(-side.y, side.x)

    const projA = a.map(p => p.dot(normal))
    const projB = b.map(p => p.dot(normal))
    if (Math.max(...projA) < Math.min(...projB) || Math.min(...projA) > Math.max(...projB)) {
      return false
    }
  }
  return true
}

export function isPro(conf: Cuttleform) {
  return conf.rounded.side || conf.rounded.top || conf.shell?.type == 'stilts'
}

// https://stackoverflow.com/questions/7113344/find-whether-two-triangles-intersect-or-not
export function doTrianglesIntersect(t1: Triangle, t2: Triangle) {
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
  const n1 = new Vector3().copy(N).normalize()
  const n2 = new Vector3().copy(M).normalize()

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
    const b = new Vector3().copy(F1).addScaledVector(a, -a.dot(F1)).normalize()
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
    return intersects(ptsA, ptsB)
  }

  // END ADDITIONS

  function areProjectionsSeparated(p0, p1, p2, q0, q1, q2) {
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
