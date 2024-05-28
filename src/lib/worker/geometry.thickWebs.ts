/**
 * Geometry helpers for thickening the webs.
 *
 * There are a lot of helper functions so I've split this into its own file.
 * There are several things this is responsible for:
 * - calculating how thick spots in the web are
 * - determining a maximum of how much material can be added to thicken the web
 * - determining what amount of material gives the web a certain thickness
 * - splitting triangles in the web to add new faces
 * - flipping triangles post-flip if the mesh would benefit
 * - moving walls to match the thickened webs
 *
 * All this is called through reinforceTriangles.
 */

import { socketSize } from '$lib/geometry/socketsParts'
import { switchInfo } from '$lib/geometry/switches'
import { Matrix3 } from 'three/src/math/Matrix3'
import { createTriangleMap, type TriangleMap } from './concaveman'
import { doWallsIntersect } from './concaveman-extra'
import type { Cuttleform, CuttleKey, Geometry } from './config'
import { type CriticalPoints, triangleNormTrsf, type WallCriticalPoints, wallUpDir, webThickness } from './geometry'
import type Trsf from './modeling/transformation'
import { Vector } from './modeling/transformation'

export const DEFAULT_MWT_FACTOR = 0.8
const MAX_WEB_THICKNESS = 5 // Maximum web thickness used for calculating the reinforced web. Very large web thicknesses cause things to go wacky.

type WallShifts = Record<number, { direction: Vector; offset: number }>

const shiftWallTop = (wall: WallCriticalPoints, direction: Vector, amount: number) => ({
  ...wall,
  ti: wall.ti.translated(direction, amount),
  to: wall.to.translated(direction, amount),
  si: wall.si?.translated(direction, amount),
  sm: wall.sm?.translated(direction, amount),
})

const shiftWallBot = (c: Cuttleform, wall: WallCriticalPoints, direction: Vector, amount: number, worldZ: Vector, bottomZ: number) => {
  // Subtract vertical component from the direction vector for moving the bottom points
  const up = wallUpDir(c, wall)
  const directionsubmobo = direction.clone().addScaledVector(up, -direction.dot(up))
  const newWall = {
    ...wall,
    ki: wall.ki.translated(direction, amount),
    bi: wall.bi.translated(directionsubmobo, amount),
    bo: wall.bo.translated(directionsubmobo, amount),
    mi: wall.mi.translated(direction, amount),
    mo: wall.mo.translated(direction, amount),
  }
  const moZ = newWall.mo.origin().dot(worldZ)
  const miZ = newWall.mi.origin().dot(worldZ)
  if (moZ < bottomZ) newWall.mo.translate(worldZ, bottomZ - moZ)
  if (miZ < bottomZ) newWall.mi.translate(worldZ, bottomZ - miZ)

  return newWall
}

const shiftWall = (c: Cuttleform, wall: WallCriticalPoints, direction: Vector, amount: number, top: boolean, worldZ: Vector, bottomZ: number) => (
  top ? shiftWallTop(wall, direction, amount) : shiftWallBot(c, wall, direction, amount, worldZ, bottomZ)
)

export const shiftWalls = (c: Cuttleform, walls: WallCriticalPoints[], shifts: WallShifts, top: boolean, worldZ: Vector, bottomZ: number) => (
  walls.map((w, i) => shifts[i] ? shiftWall(c, w, shifts[i].direction, shifts[i].offset, top, worldZ, bottomZ) : w)
)

/**
 * Based on two adjacent points on a key hole, find the two closest neighboring points on neighboring keyholes.
 * If there is only one neighboring point from a keyhole, returns that point twice.
 */
function closestPts(allPts: Trsf[], pi1: number, pi2: number, triangleMap: ReturnType<typeof createTriangleMap>, normal: Vector, binormal: Vector) {
  const thisP = triangleMap[pi1][pi2][0]
  const len = (a: number, b: number) => allPts[a].origin().distanceTo(allPts[b].origin())
  let opposites: [number, number] = [-1, -1]
  let oppositeLen = Infinity

  /** Try a combination of two neighbors. If they lead to minimal thickness, keep them */
  const tryCombo = (a: number, b: number) => {
    const lenA = len(pi1, a)
    const lenB = len(pi2, b)
    const lenT = lenA * lenB
    // Make sure the two segments are similar in length. Prevents from choosing really far away neighbors.
    // The reasoning behind math.max is that small segments (< 1mm) should all get treated the same.
    // This way the algorithm doesn't get confused if there's a really small segment (say 0.01mm) next to 1mm segments.
    if (lenT < oppositeLen && lenA < Math.max(1, lenB) * 3 && lenB < Math.max(1, lenA) * 3) {
      oppositeLen = lenT
      opposites = [a, b]
    }
  }

  // Initial heuristic: try to choose which point gets assigned to thisP
  // by comparing both lengths. There's a chance both get assigned to thisP
  // if thisP is relatively in the center
  const len1 = len(pi1, thisP)
  const len2 = len(pi2, thisP)
  if (len1 < len2 * 3) opposites[0] = thisP
  if (len2 < len1 * 3) opposites[1] = thisP
  // Set oppositeLen if both got assigned
  if (len1 < len2 * 3 && len2 < len1 * 3) oppositeLen = len1 + len2

  const thisP2 = triangleMap[pi1][thisP]
  const thisP3 = triangleMap[thisP] ? triangleMap[thisP][pi2] : undefined
  if (thisP2) {
    tryCombo(thisP, thisP2[0])
    tryCombo(thisP2[0], thisP)
  }
  if (thisP3) {
    tryCombo(thisP, thisP3[0])
    tryCombo(thisP3[0], thisP)
  }
  if (thisP2 && thisP3) {
    tryCombo(thisP2[0], thisP3[0])
    tryCombo(thisP3[0], thisP2[0])
  }

  return opposites
}

/**
 * See reinforcementOffset. This is a copy-ish of the first 10 lines of code there.
 * The difference is that it takes in a parameter ot, the added offset.
 */
function calcThickness(thisTop: Trsf, thisThick: number, nextTop: Trsf, normal: Vector, binormal: Vector, ot: number, top: boolean) {
  const rotation = new Matrix3().set(normal.x, normal.y, normal.z, binormal.x, binormal.y, binormal.z, 0, 0, 0)
  const _thisTop = thisTop.origin()
  const _thisBot = thisTop.origin().add(thisTop.axis(0, 0, top ? -thisThick : thisThick))
  const _nextTop = nextTop.origin()
  const pab = _thisBot.sub(_thisTop).applyMatrix3(rotation)
  const pbt = _nextTop.sub(_thisTop).applyMatrix3(rotation)

  // This formula comes from the one below, but solving for the thickness.
  return Math.abs(ot * (pbt.y - pab.y) + pab.y * pbt.x) / Math.sqrt((ot - pbt.x) * (ot - pbt.x) + pbt.y * pbt.y)
}

/**
 * Calculate how much the key's edge will be offset outwards from the edge of the socket.
 * This allows the reinforcement, when set to the maximum, to clear nearby keycaps,
 * since the keycaps stick out from where the switch thing is
 */
function maxReinfMargin(key: CuttleKey) {
  const keyWidth = (key.type == 'choc') ? 17.5 : 18.5
  const socketWidth = socketSize(key).x
  return (keyWidth - socketWidth) / 2 + 0.25
}
/**
 * Returns the needed amount of offset to reinforce a keyhole's surface.
 * thisTop and nextTop are the tops of both keypoints.
 * thisThick and nextThick are the thickness of the two key sockets.
 * @param normal should point in the direction the offset is added.
 * @param binormal points in the direction of the keyhole's surface (i.e. the keyhole normal).
 */
function reinforcementOffset(thisTop: Trsf, thisThick: number, nextTop: Trsf, nextTrsf: Trsf, nextKey: CuttleKey, normal: Vector, binormal: Vector, thickness: number, top: boolean) {
  // Use a rotation matrix to transform everything into the reference frame of the top socket
  // X points in the direction of normal (the direction of the offset)
  // Y points in the direction of binormal (up from the socket)
  // Z is unused and will be all zeros. Everything in this reference frame is 2D.
  const rotation = new Matrix3().set(normal.x, normal.y, normal.z, binormal.x, binormal.y, binormal.z, 0, 0, 0)
  const _thisTop = thisTop.origin()
  const _thisBot = thisTop.origin().add(thisTop.axis(0, 0, top ? -thisThick : thisThick))
  const _nextTop = nextTop.origin()
  const pab = _thisBot.sub(_thisTop).applyMatrix3(rotation) // Bottom point of first socket
  const pbt = _nextTop.sub(_thisTop).applyMatrix3(rotation) // Top point of second socket
  const nextAx = nextTop.axis(0, 0, 1).applyMatrix3(rotation) // Binormal of the second socket, in this frame

  // Find existing thickness. Break early if possible
  // This formula comes from the one below, but setting the added offset to zero
  // and solving for the thickness.
  const currentThickenss = Math.abs(pab.y * pbt.x) / Math.sqrt(pbt.x * pbt.x + pbt.y * pbt.y)
  if (currentThickenss > thickness) return 0

  // Bottom faces: don't cross the projected surface of the next key socket
  let projOffset = pbt.x - nextAx.x * pbt.y / nextAx.y
  if (nextAx.y * pbt.y < 0) projOffset = thickness // In cases where the surface will never cross the projected surface, use thickness as offset.
  // I could/should make this larger, but the aesthetics aren't great when one of these such keys is next to a wall
  if (projOffset < 0) projOffset = 0
  projOffset = Math.max(thickness / 2, projOffset) // I've come to realize it's okay to have a little projOffset.

  // Compute the position of the adjacent keycap's corner.
  // This is slightly simplified, as we assume the keycap extends in the direction of this socket's's normal.
  // i.e. we disregard the relative rotation of the next keycap
  let keyOffset = thickness
  // Only check when the next key is below this one and when key is facing in the right direction
  if (top && pbt.y < 0 && nextTop.origin().sub(nextTrsf.origin()).dot(normal) < 0) {
    const margin = maxReinfMargin(nextKey)
    const _nextKeycap = nextTop.origin().addScaledVector(normal, -margin).add(nextTop.axis(0, 0, switchInfo('mx-better').pressedHeight))
    const pkey = _nextKeycap.sub(_thisTop).applyMatrix3(rotation)
    keyOffset = pbt.x - pbt.y * (pkey.x - pbt.x) / (pkey.y - pbt.y)
    // If the key is facing the wrong direction, then ignore it.
    if (pkey.y < pbt.y) keyOffset = thickness
    if (keyOffset < 0) keyOffset = 0 // otherwise the offsets should never be negative
  }

  // Top faces: use keyoffset.
  const maxOffset = top ? keyOffset : projOffset

  // This equation is derived from the distance between two parallel lines, but solving for x offset given the distance.
  // This results in a quadratic equation.
  // Note: I don't care about the bottom offset, so s0 and s1 are the two solutions for the quadratic equation of top offset.
  // Solve t^2 = b^2/(m^2 + 1) for s
  // Unfortunately, I cannot simplify more than this.
  const thickSq = thickness * thickness
  const pabypbtSq = (pab.y - pbt.y) ** 2
  const pmTerm = pbt.y * thickness * Math.sqrt(pbt.x ** 2 - thickSq + pabypbtSq)
  const firstTerm = pbt.x * (pab.y * pbt.y + thickSq - pab.y ** 2)
  const denom = thickSq - pabypbtSq
  const s0 = (firstTerm + pmTerm) / denom
  const s1 = (firstTerm - pmTerm) / denom
  if (isNaN(pmTerm)) return maxOffset // No solution found
  if (s0 < 0 && s1 < 0) return maxOffset / 2
  if (s0 < 0) return Math.min(s1, maxOffset)
  if (s1 < 0) return Math.min(s0, maxOffset)
  return Math.min(s0, s1, maxOffset)
}

/** Unused: this solves for the point at the end of the arc going from key top -> adjusted segment. */
function reinforcementOffsetVec(thisTop: Trsf, thisThick: number, nextTop: Trsf, nextTrsf: Trsf, nextKey: CuttleKey, normal: Vector, binormal: Vector, thickness: number, top: boolean) {
  const offset = reinforcementOffset(thisTop, thisThick, nextTop, nextTrsf, nextKey, normal, binormal, thickness, top)
  const rotation = new Matrix3().set(normal.x, normal.y, normal.z, binormal.x, binormal.y, binormal.z, 0, 0, 0)
  const _thisTop = thisTop.origin()
  const _nextTop = nextTop.origin()
  const pbt = _nextTop.sub(_thisTop).applyMatrix3(rotation)
  const m = pbt.y / (pbt.x - offset)
  const vec = new Vector(1, -1 / m, 0).normalize().multiplyScalar(thisThick)
  vec.y -= thisThick
  // vec.x += offset
  return { offset, vec }
}

/** Calculate the thickness between two wall cross sections using the same formula I
 * use for triangles. Surprisingly, this works.
 */
export function wallThickness(c: Cuttleform, prev: WallCriticalPoints, next: WallCriticalPoints) {
  const out = prev.bo.origin().sub(prev.bi.origin()).normalize()
  const up = wallUpDir(c, prev)
  const side = out.clone().cross(up)
  const rotation = new Matrix3().set(side.x, side.y, side.z, out.x, out.y, out.z, 0, 0, 0)
  const _thisTop = prev.bo.origin()
  const _thisBot = prev.bi.origin()
  const _nextTop = next.bo.origin()
  const pab = _thisBot.sub(_thisTop).applyMatrix3(rotation)
  const pbt = _nextTop.sub(_thisTop).applyMatrix3(rotation)

  const currentThickenss = Math.abs(pab.y * pbt.x) / Math.sqrt(pbt.x * pbt.x + pbt.y * pbt.y)
  return currentThickenss
}

/**
 * An offset too big might lead to an invalid wall.
 * This function returns the approximate max amount a wall can be shifted while maintaining
 * correct wall geometry.
 *
 * This only applies to the points that will affect the wall bottom. The wall top can be shifted pretty mercilessly.
 */
function maxOffsetForWall(c: Cuttleform, walls: WallCriticalPoints[], i: number, offset: number, direction: Vector, worldZ: Vector, bottomZ: number) {
  const prevWall = walls[(i - 1 + walls.length) % walls.length]
  const nextWall = walls[(i + 1) % walls.length]
  for (let divisor = 1; divisor <= 4; divisor *= 2) {
    const newWall = shiftWallBot(c, walls[i], direction, offset / divisor, worldZ, bottomZ)
    if (doWallsIntersect(c, prevWall, newWall, nextWall)) continue
    const minThick = Math.min(wallThickness(c, newWall, prevWall), wallThickness(c, newWall, nextWall))
    if (minThick < c.wallThickness / 2) continue
    return offset / divisor
  }
  return 0
}

const OFFSET_THRESH = 0.1 // Offset must be at least this big to add it

function angleAbout(v1: Vector, v2: Vector, about: Vector) {
  return Math.atan2(new Vector().crossVectors(v2, v1).dot(about), v1.dot(v2))
}

/** Flip a triangle across edge e0 -> e1. v and vTri represent triangleMap[e0][e1] */
function maybeFlip(v: number, vTri: number, e0: number, e1: number, triangles: number[][], triangleMap: ReturnType<typeof createTriangleMap>, allPts: Trsf[], ignore2 = false) {
  const adj = triangleMap[e1] ? triangleMap[e1][e0] : undefined
  if (!adj) return

  const [adjP, adjTri] = adj
  const pAdj = allPts[adjP].origin(), pV = allPts[v].origin()
  const pe0 = allPts[e0].origin(), pe1 = allPts[e1].origin()

  // Compute the angles opposite the edge to split
  const _s0 = new Vector(), _s1 = new Vector() // Scratch vectors used for computation
  const angle1 = Math.acos(_s0.subVectors(pe1, pAdj).normalize().dot(_s1.subVectors(pe0, pAdj).normalize()))
  const angle2 = Math.acos(_s0.subVectors(pe1, pV).normalize().dot(_s1.subVectors(pe0, pV).normalize()))

  // Delaunay condition: opposite angles must add to less than 180 degrees
  // If this is not true, the edge should be flipped to produce better triangles.
  if (angle1 + angle2 > Math.PI) {
    if (!ignore2) {
      const ang1 = angleAbout(triangleNormTrsf(allPts[v], allPts[e0], allPts[e1]), triangleNormTrsf(allPts[e1], allPts[e0], allPts[adjP]), _s0.subVectors(pe1, pe0))
      const ang2 = angleAbout(triangleNormTrsf(allPts[adjP], allPts[e1], allPts[v]), triangleNormTrsf(allPts[e0], allPts[adjP], allPts[v]), _s0.subVectors(pV, pAdj))

      // Second condition: The mesh with the flipped edge must be more "convex" than the original one.
      // i.e. the angle between the two faces, from normal to normal, must have increased.
      if (ang2 < ang1) return false
    }

    triangles[vTri] = [adjP, e1, v]
    triangles[adjTri] = [e0, adjP, v]

    // Update the triangle map
    delete triangleMap[e0][e1]
    delete triangleMap[e1][e0]
    if (!triangleMap[v]) triangleMap[v] = {}
    if (!triangleMap[adjP]) triangleMap[adjP] = {}
    triangleMap[v][adjP] = [e1, vTri]
    triangleMap[adjP][v] = [e0, adjTri]
    return true
  }
  return false
}

export function flipAllTriangles(triangles: number[][], allPts: Trsf[]) {
  triangles = [...triangles]
  const triangleMap = createTriangleMap(triangles)
  let tally = 0
  for (const a of Object.keys(triangleMap) as any as number[]) {
    for (const b of Object.keys(triangleMap[a]) as any as number[]) {
      if (b > a) {
        if (maybeFlip(triangleMap[a][b][0], triangleMap[a][b][1], a, b, triangles, triangleMap, allPts, true)) tally++
      }
    }
  }
  return triangles
}

/**
 * Adds extra triangles to the model to thicken web walls.
 * These triangles are addded to the tops and bottoms of key wells.
 *
 * In order to maintain corrrect topology, adjacent triangles need to be split when we add a new vertex.
 * This leads to a lot of logic for a seemingly simple concept.
 *
 * Adding extra triangles also affects neighboring walls, so these are optionally modified.
 * A few new walls will also need to be added. These are returned as `extraWalls`.
 *
 * I made the decision to use the original points when calculating opposite points and thicknesses
 * rather than the new points. Although maybe less efficient, this is more stable because the order
 * that points are moved around does not affect thickness.
 *
 * You'll see that when examing an edge of a socket, the code consideres separately the offset of the left side
 * and the offset of the right side. This adds a little more flexibility in the kind of geometry this method
 * can tackle.
 */
export function reinforceTriangles(c: Cuttleform, geo: Geometry, triangles: number[][], allPolys: CriticalPoints[], worldZ: Vector, bottomZ: number, top = true, walls?: WallCriticalPoints[]) {
  // addExtraWallsForExtremeAngles(c, geo, allPolys, walls)

  const keyIdx = allPolys.flatMap((p, i) => p.map(_ => i))
  const thickness = allPolys.flatMap((p, i) => p.map(_ => Math.min(webThickness(c, c.keys[i]), MAX_WEB_THICKNESS)))
  const trsfs = allPolys.flatMap((p, i) => p.map(_ => geo.keyHolesTrsfs[i]))
  const keys = allPolys.flatMap((p, i) => p.map(_ => c.keys[i]))
  const allPts = allPolys.flat()
  const allPts2D = geo.allKeyCriticalPoints2D.flat()
  let { boundary, removedTriangles, innerBoundary } = geo.solveTriangularization
  const extraWalls: number[][] = []

  // Clone a few parameters that will be modified. Side effects are a no-no!
  triangles = [...triangles]
  allPolys = [...allPolys]
  const newThicknesses = triangles.map(_ => ({ thickness: -1 }))
  const newWallOffsets: WallShifts = {}

  const originalPts = [...allPts]
  const originalMap = createTriangleMap(triangles)
  let triangleMap = createTriangleMap(triangles)

  for (const poly of allPolys) {
    // Convert polygon's points to their indices
    const polyInd = poly.map(p => allPts.indexOf(p))
    const originalPolyInd = [...polyInd]
    const N = polyInd.length
    for (let i = 0; i < N; i++) {
      const i0 = i, i1 = (i + 1) % N, i2 = (i + 2) % N, i3 = (i + 3) % N
      let pi0 = polyInd[i0], pi1 = polyInd[i1], pi2 = polyInd[i2], pi3 = polyInd[i3]
      const oPi0 = originalPolyInd[i0], oPi1 = originalPolyInd[i1], oPi2 = originalPolyInd[i2], oPi3 = originalPolyInd[i3]

      if (!triangleMap[pi1] || !triangleMap[pi1][pi2]) continue

      // Check if the face is sloped downwards
      const [thisP, thisTri] = triangleMap[pi1][pi2]
      const tangent = allPts[oPi2].origin().sub(allPts[oPi1].origin())
      if (!top) tangent.negate()
      const binormal = allPts[oPi2].axis(0, 0, top ? 1 : -1)
      const normal = new Vector().crossVectors(binormal, tangent).normalize()
      const thisTriNorm = triangleNormTrsf(allPts[triangles[thisTri][0]], allPts[triangles[thisTri][1]], allPts[triangles[thisTri][2]], !top)
      const angle = Math.atan2(new Vector().crossVectors(binormal, thisTriNorm).dot(tangent), binormal.dot(thisTriNorm))

      // Ensure angle is sufficiently large and that it's pointing the right way
      // Because of the negations, the top will look the same as the bottom
      if (Math.abs(angle) < 0.01) newThicknesses[thisTri].thickness = thickness[oPi1]
      if (Math.abs(angle) < 0.01 || angle > 0) continue

      // I like the look of un-thickned circles better.
      if (N > 4) {
        newThicknesses[thisTri].thickness = calcThickness(allPts[polyInd[i1]], thickness[oPi1], allPts[thisP], normal, binormal, 0, top)
        continue
      }

      // Look at the triangles connected to the adjacent face. This determines, for two keys that are nearby, how the 2 are connected.
      const opposites = closestPts(originalPts, oPi1, oPi2, originalMap, normal, binormal)

      const th = (x: number) => thickness[x]
      const f = c.webMinThicknessFactor ?? DEFAULT_MWT_FACTOR
      // In addition to the opposite point being defined, it must also be oriented down wrt to the tangent.
      // Otherwise, this is a sign that the key is really twisty, and it should not be extended.
      const oppPrevOk = opposites[0] >= 0 ? angleAbout(normal, originalPts[opposites[0]].origin().sub(originalPts[oPi1].origin()), tangent) > 0 : false
      const oppNextOk = opposites[1] >= 0 ? angleAbout(normal, originalPts[opposites[1]].origin().sub(originalPts[oPi2].origin()), tangent) > 0 : false
      // Calculate the offsets
      let offsetPrev = oppPrevOk ? reinforcementOffset(originalPts[oPi1], th(oPi1), originalPts[opposites[0]], trsfs[opposites[0]], keys[opposites[0]], normal, binormal, f * th(pi1), top) : 0
      let offsetNext = oppNextOk ? reinforcementOffset(originalPts[oPi2], th(oPi2), originalPts[opposites[1]], trsfs[opposites[1]], keys[opposites[1]], normal, binormal, f * th(pi2), top) : 0

      // For 2D
      const tangent2 = allPts2D[pi2].origin().sub(allPts2D[pi1].origin())
      const normal2 = new Vector(0, 0, 1).cross(tangent2).normalize()

      // Adjust length if necessary to ensure wall stays valid
      const wallPrev = boundary.indexOf(pi1)
      if (!top && wallPrev >= 0 && walls) offsetPrev = maxOffsetForWall(c, walls, wallPrev, offsetPrev, normal, worldZ, bottomZ)

      if (offsetPrev > OFFSET_THRESH) {
        // Add the new point
        const newPrevInd = polyInd[i1] = allPts.length
        allPts.push(allPts[pi1].clone())
        allPts2D.push(allPts2D[pi1].clone())
        thickness.push(thickness[pi1])
        keyIdx.push(keyIdx[pi1])

        // Move original point to new, offset locations
        allPts[pi1] = allPts[pi1].translated(normal, offsetPrev)
        allPts2D[pi1] = allPts2D[pi1].translated(normal2, offsetPrev)

        // Add triangle for previous intersection
        if (triangleMap[pi0] && triangleMap[pi0][pi1]) {
          const [prev, prevTriInd] = triangleMap[pi0][pi1]
          triangles[prevTriInd] = [prev, pi0, newPrevInd]
          triangles.push([prev, newPrevInd, pi1])
          newThicknesses.push(newThicknesses[prevTriInd])

          // Check if the edges about the newly added edge need flipping
          maybeFlip(newPrevInd, prevTriInd, prev, pi0, triangles, triangleMap, allPts)
          maybeFlip(newPrevInd, triangles.length - 1, pi1, prev, triangles, triangleMap, allPts)
        }

        // Move wall connected to original point and add new triangular wall for the gap
        if (wallPrev >= 0) newWallOffsets[wallPrev] = { direction: normal, offset: offsetPrev }
        if (innerBoundary.includes(oPi1) && innerBoundary.includes(oPi0)) extraWalls.push([newPrevInd, pi1, pi1])

        // Add new triangle to connect old points to new points
        triangles.push([polyInd[i2], pi1, newPrevInd])
        newThicknesses.push(newThicknesses[thisTri])
      }

      // Adjust length if necessary to ensure wall stays valid
      const wallNext = boundary.indexOf(pi2)
      if (!top && wallNext >= 0 && walls) offsetNext = maxOffsetForWall(c, walls, wallNext, offsetNext, normal, worldZ)

      if (offsetNext > OFFSET_THRESH) {
        // Add the new point
        const newNextInd = polyInd[i2] = allPts.length
        allPts.push(allPts[pi2].clone())
        allPts2D.push(allPts2D[pi2].clone())
        thickness.push(thickness[pi2])
        keyIdx.push(keyIdx[pi2])

        // Move original point to new, offset locations
        allPts[pi2] = allPts[pi2].translated(normal, offsetNext)
        allPts2D[pi2] = allPts2D[pi2].translated(normal2, offsetNext)

        // Add triangle for next intersection
        if (triangleMap[pi2] && triangleMap[pi2][pi3]) {
          const [next, nextTriInd] = triangleMap[pi2][pi3]
          triangles[nextTriInd] = [next, newNextInd, pi3]
          triangles.push([newNextInd, next, pi2])
          newThicknesses.push(newThicknesses[nextTriInd])

          // Check if the edges about the newly added edge need flipping
          maybeFlip(newNextInd, nextTriInd, pi3, next, triangles, triangleMap, allPts)
          maybeFlip(newNextInd, triangles.length - 1, next, pi2, triangles, triangleMap, allPts)
        }

        // Move wall connected to original point and add new triangular wall for the gap
        if (wallNext >= 0) newWallOffsets[wallNext] = { direction: normal, offset: offsetNext }
        if (innerBoundary.includes(oPi2) && innerBoundary.includes(oPi3)) extraWalls.push([pi2, newNextInd, pi2])

        // Add new triangle to connect old points to new points
        triangles.push([newNextInd, pi2, polyInd[i1]])
        newThicknesses.push(newThicknesses[thisTri])
      }

      const th1 = opposites[0] < 0 ? -1 : calcThickness(originalPts[oPi1], th(oPi1), originalPts[opposites[0]], normal, binormal, offsetPrev, top)
      const th2 = opposites[1] < 0 ? -1 : calcThickness(originalPts[oPi2], th(oPi2), originalPts[opposites[1]], normal, binormal, offsetNext, top)
      let newThick = (th1 + th2) / 2
      if (th1 == -1) newThick = th2
      if (th2 == -1) newThick = th1
      newThicknesses[thisTri].thickness = newThick

      // Recreate triangle map
      triangleMap = createTriangleMap(triangles)
    }
  }

  return {
    triangles,
    allPts,
    allPts2D,
    triangleMap,
    boundary,
    extraWalls,
    removedTriangles,
    thickness: newThicknesses,
    wallOffsets: newWallOffsets,
  }
}

// Unused: this gives both a high number of false positives and false negatives.
// /** Returns an error if any of the thickened points lie outside the boundary. This is a sign of bad geometry */
// function checkBounds(keyIdx: number[], boundary: number[], pts2D: Trsf[], triangleMap: TriangleMap): ConfError | undefined {
//   boundary = [...boundary] // Clone the boundary
//   let boundaryPts = boundary.map(b => pts2D[b].xy())
//   for (let i = 0; i < boundary.length; i++) {
//     const b1 = boundary[i]
//     const b2 = boundary[(i + 1) % boundary.length]
//     const opposite = triangleMap[b2] ? triangleMap[b2][b1] : undefined
//     if (opposite && !intersectPtPoly(pts2D[opposite[0]].xy(), boundaryPts)) {
//       // The point lies outside the polygon formed by the boundary.
//       return {
//         type: 'wallBounds',
//         i: keyIdx[opposite[0]],
//       }
//     }
//   }
// }
