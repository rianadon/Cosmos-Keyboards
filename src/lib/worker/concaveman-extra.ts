/**
 * Extra functions for refining meshes generated from my modified concaveman.
 *
 * This code performs the check for wall intersections.
 */

import type { Cuttleform } from '$lib/worker/config'
import { type WallCriticalPoints, wallUpDir } from '$lib/worker/geometry'
import type Trsf from '$lib/worker/modeling/transformation'
import { Triangle } from 'three/src/math/Triangle.js'
import { doTrianglesIntersect } from './check'

// function refineBoundary(c, Cuttleform, wallPts: WallCriticalPoints[]) {
//   let intersections: boolean[] = []

//   for (let i = 0; i < wallPts.length; i++) {
//     const wall = wallPts[i]
//     const prevWall = wallPts[(i - 1 + wallPts.length) % wallPts.length]
//     const nextWall = wallPts[(i + 1) % wallPts.length]
//     intersections.push(doWallsIntersect(c, prevWall, wall, nextWall))
//   }
//   return intersections
// }

function subtract(a: Trsf, b: Trsf): [number, number] {
  const ax = a.xyz()
  const bx = b.xyz()
  return [ax[0] - bx[0], ax[1] - bx[1]]
}

function dot(a: [number, number], b: [number, number]) {
  return a[0] * b[0] + a[1] * b[1]
}

/** Check if the walls from wall0-wall1 and wall1-wall2 intersect. */
export function doWallsIntersect(c: Cuttleform, wall0: WallCriticalPoints, wall1: WallCriticalPoints, wall2: WallCriticalPoints) {
  // They intersect if the bisector does not bisect in 2D!

  // Check that after projecting each wall onto the bisector, they lie on opposite sides!
  if (c.shell.type == 'stilts' || c.shell.type == 'block' || c.shell.type == 'tilt') {
    const out = wall1.bo.origin().sub(wall1.bi.origin())
    const up = wallUpDir(c, wall1)
    const normal = up.cross(out)
    const i0 = wall0.bi.origin().sub(wall1.bi.origin()).dot(normal)
    const i1 = wall2.bi.origin().sub(wall1.bi.origin()).dot(normal)
    if (i0 * i1 > 0) return true // They intersect if the projections lie on the same side

    const o0 = wall0.bo.origin().sub(wall1.bo.origin()).dot(normal)
    const o1 = wall2.bo.origin().sub(wall1.bo.origin()).dot(normal)
    if (o0 * o1 > 0) return true // They intersect if the projections lie on the same side
  } else {
    const seg = subtract(wall1.bo, wall1.bi)
    const normal: [number, number] = [-seg[1], seg[0]]

    const i0 = dot(subtract(wall0.bi, wall1.bi), normal)
    const i1 = dot(subtract(wall2.bi, wall1.bi), normal)
    if (i0 * i1 > 0) return true // They intersect if the projections lie on the same side

    const o0 = dot(subtract(wall0.bo, wall1.bo), normal)
    const o1 = dot(subtract(wall2.bo, wall1.bo), normal)
    if (o0 * o1 > 0) return true // They intersect if the projections lie on the same side
  }

  // if (c.shell.type == 'stilts') {
  //   // Also check the triangles
  //   const t0 = new Triangle(wall0.to.origin(), wall0.bo.origin(), wall0.bi.origin())
  //   const t1 = new Triangle(wall1.to.origin(), wall1.bo.origin(), wall1.bi.origin())
  //   const t2 = new Triangle(wall2.to.origin(), wall2.bo.origin(), wall2.bi.origin())
  //   if (doTrianglesIntersect(t0, t1) || doTrianglesIntersect(t1, t2)) return true
  // }

  // Check that the wall cross sections don't intersect
  // if (c.shell.type == 'stilts') {
  //   const t0a = { a: wall0.bi.origin(), b: wall0.ti.origin(), c: wall0.bo.origin() }
  //   const t0b = { a: wall0.ti.origin(), b: wall0.to.origin(), c: wall0.bo.origin() }
  //   const t1a = { a: wall1.bi.origin(), b: wall1.ti.origin(), c: wall1.bo.origin() }
  //   const t1b = { a: wall1.ti.origin(), b: wall1.to.origin(), c: wall1.bo.origin() }
  //   const t2a = { a: wall2.bi.origin(), b: wall2.ti.origin(), c: wall2.bo.origin() }
  //   const t2b = { a: wall2.ti.origin(), b: wall2.to.origin(), c: wall2.bo.origin() }

  //   console.log('check wall tri intersect')
  //   if (doTrianglesIntersect(t0a, t2a)) return true
  //   if (doTrianglesIntersect(t0a, t2b)) return true
  //   if (doTrianglesIntersect(t0b, t2a)) return true
  //   if (doTrianglesIntersect(t0b, t2b)) return true
  // }

  if (('si' in wall0) && wall0.si) {
    // Because everything is 3d I can't use the 2d shorcut dot/subtract methods here.
    const wall1sm = wall1.sm!.origin()
    const out = wall1.to.origin().sub(wall1sm)
    const up = wall1.si!.origin().sub(wall1sm)
    // This is probably pointing the wrong way but it doesn't matter. The signs all cancel out.
    const normal = up.cross(out)

    // console.log('has sm', 'sm' in wall0)
    const o0 = wall0.sm!.origin().sub(wall1sm).dot(normal)
    const o1 = wall2.sm!.origin().sub(wall1sm).dot(normal)
    if (o0 * o1 > 0) return true // They intersect if the projections lie on the same side
  }

  return false
}
