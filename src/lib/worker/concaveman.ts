/** Adapted from the source of mapbox/concaveman.
    Lisenced under the ISC License: https://github.com/mapbox/concaveman/blob/master/LICENSE.

    The code works similarly to concaveman at a high-level:
    given a convex hull of a region, it collapses in this hull according to certain
    heuristics of concavity. With Cosmos, there's an extra requirement that every time
    the boundary is collapsed, it must not lead to intersecting walls (i.e. bad geometry).

    While the concaveman library uses optimized distance checking to collapse walls,
    Cosmos uses the delaunay triangularization since it's already been calculated
    for creating the mesh inbetween keys.
*/

import type { Cuttleform } from '$lib/worker/config'
import { inside, type KeyTrsf, wallCriticalPoints } from '$lib/worker/geometry'
import type { Vector } from '$lib/worker/modeling/transformation'
import type Trsf from '$lib/worker/modeling/transformation'
import { doWallsIntersect } from './concaveman-extra'
import { thickness } from './thickness'

interface Node {
  p: number
  next: Node
  prev: Node
}

export default function concaveman(
  conf: any,
  trsfs: KeyTrsf[],
  points: number[][],
  triangles: number[][],
  bnd: number[][],
  bottomZ: number,
  worldZ: Vector,
  filter2d: boolean,
  concavity: number,
  lengthThreshold?: number,
  noCut?: boolean,
  bottomPts2D?: Trsf[],
) {
  // a relative measure of concavity; higher value means simpler hull
  concavity = Math.max(0, concavity === undefined ? 2 : concavity)

  // when a segment goes below this length threshold, it won't be drilled down further
  lengthThreshold = lengthThreshold || 0

  const triangleMap = {}
  triangles.forEach(([a, b, c], i) => {
    if (!triangleMap[a]) triangleMap[a] = {}
    if (!triangleMap[b]) triangleMap[b] = {}
    if (!triangleMap[c]) triangleMap[c] = {}
    triangleMap[a][b] = [c, i]
    triangleMap[b][c] = [a, i]
    triangleMap[c][a] = [b, i]
  })

  const beginning = bnd[0][0]

  const next = {}
  for (const [a, b] of bnd) {
    next[a] = b
  }

  const queue: Node[] = []

  let point = beginning
  let last: Node | null = null
  do {
    last = insertNode(point, last)
    queue.push(last)
    point = next[point]
    if (queue.length > trsfs.length) {
      throw new Error('Invalid wall boundary.')
    }
  } while (point != beginning)

  var sqConcavity = concavity * concavity
  var sqLenThreshold = lengthThreshold * lengthThreshold

  // process edges one by one
  const deletedTriangles = new Set()
  while (queue.length) {
    const node = queue.shift()!
    if (noCut) continue
    const [ok, k, tri] = canSplitEdge(conf, node, triangleMap, trsfs, points, sqConcavity, sqLenThreshold, bottomPts2D)
    if (!ok) continue

    const wallsOk = checkWallGeometryWithSplit(conf, trsfs, node, k, node.next, bottomZ, worldZ)
    if (!filter2d || wallsOk || canFixBadWalls(conf, k, node, triangleMap, trsfs, points, sqConcavity, sqLenThreshold, bottomPts2D, bottomZ, worldZ)) {
      // connect the edge endpoints through this point and add 2 new edges to the queue
      queue.push(node)
      queue.push(insertNode(k, node))
      deletedTriangles.add(tri)
    }
  }

  // convert the resulting hull linked list to an array of points
  let node = last
  const concave: number[] = []
  do {
    concave.push(node.p)
    node = node.next
  } while (node !== last)

  return {
    boundary: concave.reverse(),
    triangles: triangles.filter((_, i) => !deletedTriangles.has(i)),
  }
}

function canFixBadWalls(
  conf: Cuttleform,
  inserted: number,
  node: Node,
  triangleMap: any,
  trsfs: KeyTrsf[],
  points: number[][],
  sqConcavity: number,
  sqLenThreshold: number,
  bottomPts2D: Trsf[] | undefined,
  bottomZ: number,
  worldZ: Vector,
): boolean {
  if (checkWallGeometryWithSplit(conf, trsfs, node, inserted, node.next, bottomZ, worldZ)) return true

  // Assume we've added the node
  const choice1 = node
  const choice2 = insertNode(inserted, node)

  const result = (() => {
    const [ok1, k1] = canSplitEdge(conf, choice1, triangleMap, trsfs, points, sqConcavity, sqLenThreshold, bottomPts2D)
    if (ok1 && canFixBadWalls(conf, k1, choice1, triangleMap, trsfs, points, sqConcavity, sqLenThreshold, bottomPts2D, bottomZ, worldZ)) {
      return true
    }
    const [ok2, k2] = canSplitEdge(conf, choice2, triangleMap, trsfs, points, sqConcavity, sqLenThreshold, bottomPts2D)
    if (ok2 && canFixBadWalls(conf, k2, choice2, triangleMap, trsfs, points, sqConcavity, sqLenThreshold, bottomPts2D, bottomZ, worldZ)) {
      return true
    }
    return false
  })()

  // Remove the node so that state isn't changed
  removeNode(choice2)
  return result
}

function canSplitEdge(
  conf: Cuttleform,
  node: Node,
  triangleMap: any,
  trsfs: KeyTrsf[],
  points: number[][],
  sqConcavity: number,
  sqLenThreshold: number,
  bottomPts2D?: Trsf[],
): [boolean, number, number, string] {
  const g = node.prev.p
  const i = node.p
  const j = node.next.p
  const l = node.next.next.p
  const a = points[i], b = points[j]

  if (!triangleMap[i] || !triangleMap[j]) return [false, 0, 0, 'no triangle']
  const triangle = triangleMap[i][j] || triangleMap[j][i]
  if (!triangle) return [false, 0, 0, 'no triangle']
  const [k, tri] = triangle

  if (bottomPts2D) {
    for (let pt = 0; pt < bottomPts2D.length; pt++) {
      if (pt == i || pt == j || pt == k) continue
      const triangle = [bottomPts2D[i].xyz(), bottomPts2D[j].xyz(), bottomPts2D[k].xyz()]
      if (inside(bottomPts2D[pt].xyz(), triangle)) return [false, 0, 0, 'discards bottom point']
    }
  }

  // skip the edge if it's already short enough
  const sqLen = getSqDist(points[i], points[j])
  const maxSqLen = sqLen / sqConcavity
  if (sqLen < sqLenThreshold) {
    // Don't miss the opportunity to cut a thin triangle!
    // If the triangle is thick enough, then skip the edge
    const thick = thickness(
      trsfs[i].trsf.origin(),
      trsfs[j].trsf.origin(),
      trsfs[k].trsf.origin(),
      trsfs[i].trsf.pretranslated(0, 0, -conf.webThickness).origin(),
      trsfs[j].trsf.pretranslated(0, 0, -conf.webThickness).origin(),
      trsfs[k].trsf.pretranslated(0, 0, -conf.webThickness).origin(),
    )
    if (thick > 2) {
      return [false, k, tri, 'length threshold']
    }
  }

  const c = points[k]

  const d0 = sqSegDist(c, points[g], points[i])
  const d1 = sqSegDist(c, points[j], points[l])
  const dist = sqSegDist(c, points[i], points[j])

  if (dist < d0 && dist < d1 && Math.min(getSqDist(c, a), getSqDist(c, b)) <= maxSqLen) {
    return [true, k, tri, '']
  }
  return [false, k, tri, 'concavity']
}

/**
 * Adding the point middle to the wall boundary is going to change the geometry.
 * This function checks that the wall are well-formed. A wall depends on 5 adjacent points,
 * so 5 checks need to be run. Every check includes the new middle point.
 */
function checkWallGeometryWithSplit(conf: Cuttleform, trsfs: KeyTrsf[], prev: Node, middle: number, next: Node, bottomZ: number, worldZ: Vector) {
  const e = prev.prev.prev.prev.p
  const f = prev.prev.prev.p
  const g = prev.prev.p
  const i = prev.p
  const k = middle
  const j = next.p
  const l = next.next.p
  const m = next.next.next.p
  const n = next.next.next.next.p
  return isOk2D(conf, trsfs[g], trsfs[i], trsfs[k], trsfs[j], trsfs[l], bottomZ, worldZ)
    && isOk2D(conf, trsfs[i], trsfs[k], trsfs[j], trsfs[l], trsfs[m], bottomZ, worldZ)
    && isOk2D(conf, trsfs[f], trsfs[g], trsfs[i], trsfs[k], trsfs[j], bottomZ, worldZ)
    && isOk2D(conf, trsfs[k], trsfs[j], trsfs[l], trsfs[m], trsfs[n], bottomZ, worldZ)
    && isOk2D(conf, trsfs[e], trsfs[f], trsfs[g], trsfs[i], trsfs[k], bottomZ, worldZ)
}

// create a new node in a doubly linked list
function insertNode(p: number, prev: Node | null): Node {
  const node: any = {
    p: p,
    prev: null,
    next: null,
  }

  if (!prev) {
    node.prev = node
    node.next = node
  } else {
    node.next = prev.next
    node.prev = prev
    prev.next.prev = node
    prev.next = node
  }
  return node
}

function removeNode(node: Node) {
  node.prev.next = node.next
  node.next.prev = node.prev
}

// square distance between 2 points
function getSqDist(p1, p2) {
  var dx = p1[0] - p2[0],
    dy = p1[1] - p2[1]

  return dx * dx + dy * dy
}

// square distance from a point to a segment
function sqSegDist(p, p1, p2) {
  var x = p1[0],
    y = p1[1],
    dx = p2[0] - x,
    dy = p2[1] - y

  if (dx !== 0 || dy !== 0) {
    var t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy)

    if (t > 1) {
      x = p2[0]
      y = p2[1]
    } else if (t > 0) {
      x += dx * t
      y += dy * t
    }
  }

  dx = p[0] - x
  dy = p[1] - y

  return dx * dx + dy * dy
}

function isOk2D(c: Cuttleform, t0: KeyTrsf, t1: KeyTrsf, t2: KeyTrsf, t3: KeyTrsf, t4: KeyTrsf, bottomZ: number, worldZ: Vector) {
  const pts0 = wallCriticalPoints(c, t4, t3, t2, undefined, 0, bottomZ, worldZ)
  const pts1 = wallCriticalPoints(c, t3, t2, t1, undefined, 0, bottomZ, worldZ)
  const pts2 = wallCriticalPoints(c, t2, t1, t0, undefined, 0, bottomZ, worldZ)

  return !doWallsIntersect(c, pts0, pts1, pts2)
}
