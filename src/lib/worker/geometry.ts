import { keyInfo } from '$lib/geometry/keycaps'
import { boardElements, holderBoundsOrigin, holderOuterRadius, holderThickness, localHolderBounds } from '$lib/geometry/microcontrollers'
import { SCREWS } from '$lib/geometry/screws'
import { partBottom, socketSize } from '$lib/geometry/socketsParts'
import { switchInfo } from '$lib/geometry/switches'
import { wallBezier, wallCurveRounded, wallSurfacesInnerRoundedTop, wallSurfacesOuterRoundedTop } from '@pro/rounded'
import cdt2d from 'cdt2d'
import findBoundary from 'simplicial-complex-boundary'
import { ExtrudeGeometry, Matrix3, Shape, Triangle } from 'three'
import { Vector2 } from 'three/src/math/Vector2'
import concaveman from './concaveman'
import { type Cuttleform, type CuttleKey, type Geometry, keyRoundSize } from './config'
import { intersectLineCircle, intersectPolyPoly, intersectPtPoly, intersectTriCircle } from './geometry.intersections'
import { PLATE_HEIGHT, screwInsertDimensions } from './model'
import Trsf from './modeling/transformation'
import { Vector } from './modeling/transformation'
import ETrsf, { keyBase } from './modeling/transformation-ext'
import { DefaultMap, filterObj, mapObj, sum } from './util'

export { flipAllTriangles, reinforceTriangles } from './geometry.thickWebs'

const Zv = new Vector(0, 0, 1)

const wallThickness = (c: Cuttleform) => c.wallThickness
const wallXYOffset = (c: Cuttleform) => {
  if (c.shell.type == 'stilts') return 0
  return 5
}
export const wallZOffset = (c: Cuttleform) => {
  if (c.shell.type == 'stilts') return 15
  return 15
}

export const BOARD_HOLDER_OFFSET = 0.02
const BOARD_TOLERANCE_Z = 0.1

export type CriticalPoints = Trsf[]

export interface WallCriticalPoints {
  ti: Trsf
  to: Trsf
  mi: Trsf
  ki: Trsf
  mo: Trsf
  bi: Trsf
  bo: Trsf
  key?: CuttleKey
  si?: Trsf
  sm?: Trsf
  /** @deprecated */
  pt?: number
  nRoundNext: boolean
  nRoundPrev: boolean
}

export const webThickness = (c: Cuttleform, key: CuttleKey) => {
  if (c.webThickness > 0) return c.webThickness
  return socketSize(key).z
}

/** Like offsetAxisLerp(..., 0.5) = offsetAxis. The lerp parameter controsl which normal the given normal is closest to. */
export function offsetAxisLerp(p1: Trsf, p2: Trsf, p3: Trsf, z: Vector, f: number) {
  const p2Vec = p2.origin()
  z.normalize()

  // Find 2 vectors describing the edges of the model
  const a = p1.origin().sub(p2Vec)
  const b = p3.origin().sub(p2Vec)

  // Project onto XY Plane by subtracting projection of each vector onto Z
  const aProj = new Vector().subVectors(a, new Vector(z).multiplyScalar(a.dot(z)))
  const bProj = new Vector().subVectors(b, new Vector(z).multiplyScalar(b.dot(z)))
  if (aProj.length() == 0 || bProj.length() == 0) throw new Error('Vectors are zero length')
  aProj.normalize()
  bProj.normalize()

  // Find 2 vectors normal to these edges (both point out)
  const c = new Vector().crossVectors(a, z).normalize()
  const d = new Vector().crossVectors(z, b).normalize()

  return c.lerp(d, f).normalize()
}

export function offsetAxis(p1: Trsf, p2: Trsf, p3: Trsf, z: Vector) {
  const p2Vec = p2.origin()
  z.normalize()

  // Find 2 vectors describing the edges of the model
  const a = p1.origin().sub(p2Vec)
  const b = p3.origin().sub(p2Vec)

  // Project onto XY Plane by subtracting projection of each vector onto Z
  const aProj = new Vector().subVectors(a, new Vector(z).multiplyScalar(a.dot(z)))
  const bProj = new Vector().subVectors(b, new Vector(z).multiplyScalar(b.dot(z)))
  if (aProj.length() == 0 || bProj.length() == 0) throw new Error('Vectors are zero length')
  aProj.normalize()
  bProj.normalize()

  // Find 2 vectors normal to these edges (both point out)
  const c = new Vector().crossVectors(a, z).normalize()
  const d = new Vector().crossVectors(z, b).normalize()

  // Special case: c == d
  if (c.y == d.y && c.z == d.z) return c
  // Special case: aProj == bProj
  if (aProj.x == bProj.x) return a.normalize()

  d.sub(c)
  bProj.sub(aProj)

  // Find the location of the point at the intersection of original a & b
  // offset by some distance along the normal vectors
  // It can be proved b.X/d.X = b.Y/d.Y = b.Z/d.Z
  let sideLen = -d.x / bProj.x
  aProj.multiplyScalar(sideLen)

  // add c to a so that a becomes the vector from the point to the offset point
  aProj.add(c)

  if (isNaN(aProj.x)) {
    console.log(c, sideLen, a, b, z, bProj)
    throw new Error('Invalid offset bisector')
  }
  return aProj.normalize()
}

/** Return the point at the intersection of two lines some offset away from p1-p2 and p2-p3. */
export function offsetBisector(p1: Trsf, p2: Trsf, p3: Trsf, offset: number, z: Vector) {
  const a = offsetAxis(p1, p2, p3, z)
  return p2.cleared().coordSystemChange(p2.origin(), a, z)
}

export function keyCriticalPoints(c: Cuttleform, key: CuttleKey, hole: Trsf, offset = 0): CriticalPoints {
  const roundSize = keyRoundSize(key)
  if (roundSize) {
    const pts: Trsf[] = []
    const r = roundSize.radius
    const sides = roundSize.sides
    for (let j = 0; j < sides; j++) {
      pts.push(hole.pretranslated(r * Math.cos(2 * Math.PI / sides * -j), r * Math.sin(2 * Math.PI / sides * -j), 0))
    }
    return pts
  }

  // Compute width and height of the key based on its aspect ratio
  const width = socketSize(key).x * Math.max(1, key.aspect)
  const height = socketSize(key).y * Math.max(1, 1 / key.aspect)

  // Return the points!
  return [
    hole.pretranslated(-width / 2 - offset, height / 2 + offset, 0),
    hole.pretranslated(width / 2 + offset, height / 2 + offset, 0),
    hole.pretranslated(width / 2 + offset, -height / 2 - offset, 0),
    hole.pretranslated(-width / 2 - offset, -height / 2 - offset, 0),
  ]
}

export function allKeyCriticalPoints(c: Cuttleform, holes: Trsf[]): CriticalPoints[] {
  return holes.map((h, i) => keyCriticalPoints(c, c.keys[i], h))
}

function p(v: any) {
  return [v.X(), v.Y(), v.Z()]
}

function xyAngle(a: Vector, b: Vector) {
  return Math.abs(a.x * b.x + a.y * b.y)
}

function offsetScale(c: Cuttleform, bisector: Trsf, pt: Trsf) {
  if (!c.rounded.side) return 1
  const axis = bisector.axis(1, 0, 0)

  return Math.max(xyAngle(axis, pt.axis(1, 0, 0)), xyAngle(axis, pt.axis(0, 1, 0)))
}

export function wallCriticalPoints(
  c: Cuttleform,
  prevPt: KeyTrsf,
  pt: KeyTrsf,
  nextPt: KeyTrsf,
  ptIndex: number | undefined,
  offset: number,
  bottomZ: number,
  worldZ: Vector,
  height?: number,
): WallCriticalPoints {
  const worldX = new Vector(0, 1, 0).addScaledVector(worldZ, -worldZ.y).normalize()
  const thickness = wallThickness(c) + offset
  // Take z as the average of the three axes, only if they are close enough.
  let z = pt.trsf.axis(0, 0, 1).add(prevPt.trsf.axis(0, 0, 0.5)).add(nextPt.trsf.axis(0, 0, 0.5))

  // This stops the wall from running into the key!
  // Is it really necessary?

  // It's a nice idea: Stop the walls from clipping the key
  // But in practice it just leads to bad-looking, misbehaving models.

  // if (c.wallShrouding) {
  //     const displacement = pt.trsf.origin().sub(pt.trsf.origin())
  //     const keyInv = pt.trsf.inverted()
  //     const keyZ = keyInv.axis(...z.xyz())
  //     const keyDisplacement = keyInv.axis(...displacement.xyz())
  //     if (keyZ.x * keyDisplacement.x > 0 || keyZ.y * keyDisplacement.y > 0) {
  //         if (keyZ.x * keyDisplacement.x > 0) keyZ.x = 0
  //         if (keyZ.y * keyDisplacement.y > 0) keyZ.y = 0
  //         keyZ.normalize()
  //         z = pt.trsf.axis(...keyZ.xyz())
  //     }
  // }

  // This produces uniform thickness shrouds
  if (c.wallShrouding) z = pt.trsf.axis(0, 0, 1)
  if (c.shell.type == 'stilts') {
    z = pt.trsf.axis(0, 0, 1) // new Vector(0, 0, 1)
    // const displacement = pt.trsf.origin().sub(pt.keyTrsf.origin())
    // const keyInv = pt.trsf.inverted()
    // const keyZ = keyInv.axis(...z.xyz())
    // const keyDisplacement = keyInv.axis(...displacement.xyz())
    // if (keyZ.x * keyDisplacement.x > 0 || keyZ.y * keyDisplacement.y > 0) {
    //     if (keyZ.x * keyDisplacement.x > 0) keyZ.x = 0
    //     if (keyZ.y * keyDisplacement.y > 0) keyZ.y = 0
    //     keyZ.normalize()
    //     z = pt.trsf.axis(...keyZ.xyz())
    // }
  }

  const bisect = offsetBisector(prevPt.trsf, pt.trsf, nextPt.trsf, thickness, z)
  const mul = offsetScale(c, bisect, pt.trsf)
  const xOut = wallXYOffset(c) * mul
  const zOut = height ? height : wallZOffset(c)

  const ti = bisect
  const ki = pt.trsf.pretranslated(0, 0, -webThickness(c, pt.key))

  // Find the X offset that makes the thickness of the wall exactly = thickness
  const cos_th = zOut / Math.sqrt(xOut ** 2 + zOut ** 2)
  const tan_th = xOut / zOut
  const xOffset = thickness / cos_th - webThickness(c, pt.key) * tan_th

  const to = bisect.pretranslated(xOffset, 0, 0)
  let mo = to.pretranslated(xOut, 0, -zOut)
  let bo = mo.translated(worldZ, -mo.origin().dot(worldZ) + bottomZ)
  bo = bo.cleared().coordSystemChange(bo.origin(), worldX, worldZ)

  let mi = ti.pretranslated(xOut, 0, -zOut)
  // Ensure that mi is in enough to create a bottom wall at exactly = thickness
  const yAxis = bisect.axis(0, 1, 0)
  const xAxis = new Vector(yAxis.y, -yAxis.x, 0) // The x axis projected onto the floor
  const moX = mo.origin().dot(xAxis) // Find x coordinates of mo and mi
  const miX = mi.origin().dot(xAxis)
  const xAdj = thickness - moX + miX // mi needs to move in this amount
  const yAdj = xAdj * Math.tan(Math.asin(bisect.axis(0, 0, 1).z)) // and up this amount
  // in order to ensure that the upper wall remains constant thickness
  mi.translate(xAxis.multiplyScalar(-xAdj).xyz())
  // mi.translate(0, 0, yAdj)

  // Orient bi upwards
  let bi = mi.translated(worldZ, -mi.origin().dot(worldZ) + bottomZ)
  bi = bi.cleared().coordSystemChange(bi.origin(), worldX, worldZ)

  // If the middle points are below the axis, push them up

  if (false) { // c.rounded.side) {
    // This is how I used to do it.
    if (mo.origin().z < 0) {
      mo = bo.translated(0, 0, 0.001)
    }
    if (mi.origin().z < 0) {
      mi = bi.translated(0, 0, 0.001)
    }
  } else {
    // This is the proper way to do it. Both mo and bo need to change,
    // because I'm shifting mo up and down its axis.
    if (mo.origin().dot(worldZ) < bottomZ) {
      const ax = ti.origin().sub(mi.origin())
      const t = new Vector().addScaledVector(ax, -(mo.origin().dot(worldZ) - bottomZ) / ax.dot(worldZ))
      bo = bo.cleared().coordSystemChange(mo.origin().add(t), worldX, worldZ)
      mo = mo.translated(t.addScaledVector(worldZ, 0.001).xyz())
    }
    if (mi.origin().dot(worldZ) < bottomZ) {
      const ax = ti.origin().sub(mi.origin())
      const t = new Vector().addScaledVector(ax, -(mi.origin().dot(worldZ) - bottomZ) / ax.dot(worldZ))
      bi = bi.cleared().coordSystemChange(mi.origin().add(t), worldX, worldZ)
      mi = mi.translated(t.addScaledVector(worldZ, 0.001).xyz())
    }
  }

  if (c.shell.type == 'stilts') {
    bo = to.pretranslated(xOut, 0, -zOut)
    mo = to.pretranslated(xOut, 0, -zOut / 2)
    bi = ti.pretranslated(xOut, 0, -zOut)
    mi = ti.pretranslated(xOut, 0, -zOut / 2)
  }

  // 1e-6 is the tolerance used for modeling
  // While it's ok to adjust the layout for very tiny wall shrouding,
  // it is not ok to add extra points to the model, for they will intersect and cause problems.
  if (c.wallShrouding > 1e-6) {
    const dy = pt.trsf.axis(0, 0, c.wallShrouding).xyz()
    const si = ti.pretranslated(0.5, 0, 0)
    const sm = ti.pretranslated(0.5, 0, 0).translate(dy)
    to.pretranslate(0, 0, c.wallShrouding)

    // Move mo up a little. This helps
    // mo = to.pretranslated(xOut, 0, -zOut - c.wallShrouding)
    // const bonew = mo.translated(0, 0, -mo.origin().z)
    // const bproj = bonew.origin().sub(bo.origin()).dot(mo.axis(1, 0, 0))
    // if (bproj > 0) bo = bonew.cleared().translate(bonew.xyz())

    // if (mo.origin().z < 0)
    // mo = bo.translated(0, 0, 0.001)

    return { si, sm, ti, ki, mi, bi, to, mo, bo, key: pt.key, pt: ptIndex, nRoundNext: pt.key == nextPt.key, nRoundPrev: pt.key == prevPt.key }
  }

  return { ti, ki, mi, bi, to, mo, bo, key: pt.key, pt: ptIndex, nRoundNext: pt.key == nextPt.key, nRoundPrev: pt.key == prevPt.key }
}

export function blockWallCriticalPoints(
  c: Cuttleform,
  prevPt: KeyTrsf,
  pt: KeyTrsf,
  nextPt: KeyTrsf,
  ptIndex: number | undefined,
  offset: number,
  bottomX: number,
  bottomZ: number,
): WallCriticalPoints {
  const thickness = wallThickness(c) + offset
  // Take z as the average of the three axes, only if they are close enough.
  let z = pt.trsf.axis(0, 0, 1).add(prevPt.trsf.axis(0, 0, 0.5)).add(nextPt.trsf.axis(0, 0, 0.5))
  if (c.wallShrouding) z = pt.trsf.axis(0, 0, 1)

  const bisect = offsetBisector(prevPt.trsf, pt.trsf, nextPt.trsf, thickness, z)
  const mul = offsetScale(c, bisect, pt.trsf)
  const xOut = wallXYOffset(c) * mul
  const zOut = wallZOffset(c)

  const ti = bisect
  const ki = pt.trsf.pretranslated(0, 0, -webThickness(c, pt.key))

  // Find the X offset that makes the thickness of the wall exactly = thickness
  const cos_th = zOut / Math.sqrt(xOut ** 2 + zOut ** 2)
  const tan_th = xOut / zOut
  const xOffset = thickness / cos_th - webThickness(c, pt.key) * tan_th

  const to = bisect.pretranslated(xOffset, 0, 0)
  let mo = to.pretranslated(xOut, 0, -zOut)
  let bo = mo.translated(-mo.origin().x + bottomX, 0, 0)
  bo = bo.cleared().translate(bo.xyz())

  let mi = ti.pretranslated(xOut, 0, -zOut)
  // Ensure that mi is in enough to create a bottom wall at exactly = thickness
  const yAxis = bisect.axis(0, 1, 0)
  const xAxis = new Vector(0, yAxis.z, -yAxis.y) // The x axis projected onto the floor
  const moX = mo.origin().dot(xAxis) // Find x coordinates of mo and mi
  const miX = mi.origin().dot(xAxis)
  const xAdj = thickness - moX + miX // mi needs to move in this amount
  const yAdj = xAdj * Math.tan(Math.asin(bisect.axis(0, 0, 1).z)) // and up this amount
  // in order to ensure that the upper wall remains constant thickness
  mi.translate(xAxis.multiplyScalar(-xAdj).xyz())
  // mi.translate(0, 0, yAdj)

  // Orient bi upwards
  let bi = mi.translated(-mi.origin().x + bottomX, 0, 0)
  bi = bi.cleared().translate(bi.xyz())

  // If the middle points are below the axis, push them up

  if (mo.origin().x < bottomX) {
    const ax = ti.origin().sub(mi.origin())
    const t = new Vector(0.001, 0, 0).addScaledVector(ax, -(mo.origin().x - bottomX) / ax.x)
    mo = mo.translated(t.xyz())
    bo = bo.cleared().translate([bottomX, ...mo.yz()])
  }
  if (mi.origin().x < bottomX) {
    const ax = ti.origin().sub(mi.origin())
    const t = new Vector(0.001, 0, 0).addScaledVector(ax, -(mi.origin().x - bottomX) / ax.x)
    mi = mi.translated(t.xyz())
    bi = bi.cleared().translate([bottomX, ...mi.yz()])
  }

  if (mi.origin().z < bottomZ) {
    mi.translate(0, 0, bottomZ - mi.origin().z)
  }
  if (bi.origin().z < bottomZ) {
    bi.translate(0, 0, bottomZ - bi.origin().z)
  }
  if (bo.origin().z < bottomZ - PLATE_HEIGHT) {
    bo.translate(0, 0, bottomZ - PLATE_HEIGHT - bo.origin().z)
  }
  if (mo.origin().z < bottomZ - PLATE_HEIGHT) {
    mo.translate(0, 0, bottomZ - PLATE_HEIGHT - mo.origin().z)
  }

  // 1e-6 is the tolerance used for modeling
  // While it's ok to adjust the layout for very tiny wall shrouding,
  // it is not ok to add extra points to the model, for they will intersect and cause problems.
  if (c.wallShrouding > 1e-6) {
    const dy = pt.trsf.axis(0, 0, c.wallShrouding).xyz()
    const si = ti.pretranslated(0.5, 0, 0)
    const sm = ti.pretranslated(0.5, 0, 0).translate(dy)
    to.pretranslate(0, 0, c.wallShrouding)

    // Move mo up a little. This helps
    // mo = to.pretranslated(xOut, 0, -zOut - c.wallShrouding)
    // const bonew = mo.translated(0, 0, -mo.origin().z)
    // const bproj = bonew.origin().sub(bo.origin()).dot(mo.axis(1, 0, 0))
    // if (bproj > 0) bo = bonew.cleared().translate(bonew.xyz())

    // if (mo.origin().z < 0)
    // mo = bo.translated(0, 0, 0.001)

    return { si, sm, ti, ki, mi, bi, to, mo, bo, key: pt.key, pt: ptIndex, nRoundNext: pt.key == nextPt.key, nRoundPrev: pt.key == prevPt.key }
  }

  return { ti, ki, mi, bi, to, mo, bo, key: pt.key, pt: ptIndex, nRoundNext: pt.key == nextPt.key, nRoundPrev: pt.key == prevPt.key }
}

export function oldblockWallCriticalPoints(
  c: Cuttleform,
  prevPt: KeyTrsf,
  pt: KeyTrsf,
  nextPt: KeyTrsf,
  ptIndex: number | undefined,
  offset: number,
  bottomX: number,
  bottomZ: number,
): WallCriticalPoints {
  const thickness = wallThickness(c) + offset
  // Take z as the average of the three axes, only if they are close enough.
  let z = pt.trsf.axis(0, 0, 1).add(prevPt.trsf.axis(0, 0, 0.5)).add(nextPt.trsf.axis(0, 0, 0.5))
  if (c.wallShrouding) z = pt.trsf.axis(0, 0, 1)

  const bisect = offsetBisector(prevPt.trsf, pt.trsf, nextPt.trsf, thickness, z)
  const mul = offsetScale(c, bisect, pt.trsf)
  const xOut = 0 // wallXYOffset(c)*mul
  const zOut = wallZOffset(c)

  const ti = bisect
  const ki = pt.trsf.pretranslated(0, 0, -webThickness(c, pt.key))

  // Find the X offset that makes the thickness of the wall exactly = thickness
  const cos_th = zOut / Math.sqrt(xOut ** 2 + zOut ** 2)
  const tan_th = xOut / zOut
  const xOffset = thickness / cos_th - webThickness(c, pt.key) * tan_th
  const to = bisect.pretranslated(xOffset, 0, 0)

  // A vector of distances to each plane
  const intersectionDistance = to.origin().sub(new Vector(bottomX, 0, bottomZ)).divide(to.axis(0, 0, 1))
  const iintersectionDistance = ti.origin().sub(new Vector(bottomX, 0, bottomZ)).divide(to.axis(0, 0, 1))

  const xPlane = (v: Vector) => to.cleared().coordSystemChange(v, new Vector(1, 0, 0), new Vector(0, 1, 0))

  let bo: Trsf, mo: Trsf, bi: Trsf, mi: Trsf
  if (intersectionDistance.x < 0) {
    // bo = xPlane(new Vector(bottomX, to.origin().y, bottomZ))
    // mo = xPlane(new Vector(bottomX, to.origin().y, bottomZ))
    // bi = xPlane(new Vector(bottomX, ti.origin().y, bottomZ))
    // mi = xPlane(new Vector(bottomX, ti.origin().y, bottomZ))
    bo = to.pretranslated(0, 0, -18)
    mo = to.pretranslated(0, 0, -15)
    bi = ti.pretranslated(0, 0, -18)
    mi = ti.pretranslated(0, 0, -15)
  } else if (intersectionDistance.x < intersectionDistance.z) {
    bo = xPlane(to.pretranslated(xOut, 0, -intersectionDistance.x).origin())
    mo = xPlane(to.pretranslated(xOut, 0, -intersectionDistance.x / 2).origin())
    bi = xPlane(ti.pretranslated(xOut, 0, -iintersectionDistance.x).origin())
    mi = xPlane(ti.pretranslated(xOut, 0, -iintersectionDistance.x / 2).origin())
  } else {
    // mo = to.cleared().translate(to.pretranslated(xOut, 0, -intersectionDistance.z).xyz())
    // bo = to.cleared().translate(to.pretranslated(xOut, 0, -intersectionDistance.z).xyz())
    // bi = ti.cleared().translate(ti.pretranslated(xOut, 0, -iintersectionDistance.z).xyz())
    // mi = ti.cleared().translate(ti.pretranslated(xOut, 0, -iintersectionDistance.z/2).xyz())
    mo = to.cleared().translate(to.pretranslated(xOut, 0, -intersectionDistance.z).xyz()).translate(0, 0, -PLATE_HEIGHT)
    mi = ti.cleared().translate(ti.pretranslated(xOut, 0, -iintersectionDistance.z).xyz())
    bo = xPlane(new Vector(bottomX, mo.origin().y, bottomZ - PLATE_HEIGHT))
    bi = xPlane(new Vector(bottomX, mi.origin().y, bottomZ))
  }

  // 1e-6 is the tolerance used for modeling
  // While it's ok to adjust the layout for very tiny wall shrouding,
  // it is not ok to add extra points to the model, for they will intersect and cause problems.
  if (c.wallShrouding > 1e-6) {
    const dy = pt.trsf.axis(0, 0, c.wallShrouding).xyz()
    const si = ti.pretranslated(0.5, 0, 0)
    const sm = ti.pretranslated(0.5, 0, 0).translate(dy)
    to.pretranslate(0, 0, c.wallShrouding)

    // Move mo up a little. This helps
    // mo = to.pretranslated(xOut, 0, -zOut - c.wallShrouding)
    // const bonew = mo.translated(0, 0, -mo.origin().z)
    // const bproj = bonew.origin().sub(bo.origin()).dot(mo.axis(1, 0, 0))
    // if (bproj > 0) bo = bonew.cleared().translate(bonew.xyz())

    // if (mo.origin().z < 0)
    // mo = bo.translated(0, 0, 0.001)

    return { si, sm, ti, ki, mi, bi, to, mo, bo, key: pt.key, pt: ptIndex, nRoundNext: pt.key == nextPt.key, nRoundPrev: pt.key == prevPt.key }
  }

  return { ti, ki, mi, bi, to, mo, bo, key: pt.key, pt: ptIndex, nRoundNext: pt.key == nextPt.key, nRoundPrev: pt.key == prevPt.key }
}

export interface KeyTrsf {
  key: CuttleKey
  trsf: Trsf
  keyTrsf: Trsf
}

export function flattenKeyCriticalPoints(c: Cuttleform, pts: CriticalPoints[], trsfs: Trsf[]): KeyTrsf[] {
  return pts.flatMap((p, i) => p.map(x => ({ key: c.keys[i], trsf: x, keyTrsf: trsfs[i] })))
}

// Unused!
// export function allWallCriticalPoints(c: Cuttleform, pts: CriticalPoints[], trsfs: Trsf[], bottomZ: number, worldZ: Vector, offset = 0): WallCriticalPoints[] {
//   const pts2D = allKeyCriticalPoints(c, keyHolesTrsfs2D(c, pts[0][0].cleared()))
//   const allPts = flattenKeyCriticalPoints(c, pts, trsfs)

//   const { boundary, removedTriangles } = solveTriangularization(c, pts2D, pts, trsfs, bottomZ, worldZ, {
//     noBadWalls: true,
//     constrainKeys: true,
//     noKeyTriangles: true,
//   })
//   const b = boundary

//   const fullWall = b.map((pt, i) => {
//     const prevPt = b[(i - 1 + b.length) % b.length]
//     const nextPt = b[(i + 1) % b.length]
//     const pts = wallCriticalPoints(c, allPts[prevPt], allPts[pt], allPts[nextPt], pt, offset, bottomZ, worldZ)
//     if (removedTriangles.find(x => x.includes(pt) && x.includes(nextPt))) pts.nRoundNext = true
//     if (removedTriangles.find(x => x.includes(pt) && x.includes(prevPt))) pts.nRoundPrev = true
//     return pts
//   })
//   return fullWall
// }

/** this is where the original position of the thumb switches defined.
 each and every thumb keys is derived from this value.
 the value itself is defined from the 'm' key's position in qwerty layout
 and then added by some values, including thumb-offsets above. */
// export function thumbOrigin(c: Cuttleform) {
//     const origins = c.keys.filter(k => k.isOrigin)
//     if (origins.length !== 1) throw new Error('There should be one and only 1 key marked as the thumb origin.')

//     return keyHoleTrsf(c, origins[0])
//         .translate(mountWidth(c)/2, -mountWidth(c)/2, 0)
//         .xyz()
// }

export function connectorIndex(c: Cuttleform, walls: WallCriticalPoints[], innerSurfaces: Line[][], worldZ: Vector, bottomZ: number, selectB: string[], screwDiameter?: number): number {
  const ys = walls.map(w => w.bo.xyz()[1])
  if (ys.some(isNaN)) throw new Error('NaN point coordinates')
  const midY = (Math.min(...ys) + Math.max(...ys)) / 2

  // First find the wall with the highest score.
  let bestError = Infinity
  let bestWall = 0

  function calcError(wall: number) {
    const origin = originForConnector(c, walls, innerSurfaces, wall)
    const hBnd = localHolderBounds(c, true)
    const hMinX = origin.apply(new Vector(hBnd.minx, hBnd.miny, 0))
    const hMaxX = origin.apply(new Vector(hBnd.maxx, hBnd.miny, 0))

    let { error } = findBoardWalls(c, walls, origin, selectB, worldZ, bottomZ)
    if (c.shell.type == 'basic') {
      const ind = Math.floor(wall)
      const leftWall = wallXToY(walls, hMinX.x, ind, -1, -1, 'bo')
      const rightWall = wallXToY(walls, hMaxX.x, ind, 1, 1, 'bo')
      if (!leftWall || !rightWall) return Infinity
      error += 10 * (leftWall.y - hMinX.y) ** 2
      error += 10 * (rightWall.y - hMaxX.y) ** 2
    }
    if (c.shell.type == 'stilts') {
      try {
        const screwIdx = screwIndices(c, walls, origin, boardIndices(c, origin, walls, new Vector(0, 0, 1), -100, selectB), [], new Vector(0, 0, 1), -100, screwDiameter)
        const tippage = maxTip(c, screwIdx, walls)
        if (tippage > 20) return 1000000
        // console.log(wall, 'error', error, 'tippage', tippage, screwIdx, screwDiameter)
      } catch (e) {
        // console.log(wall, 'does not work')
      }
    }
    return error
  }

  walls.forEach((_, i) => {
    if (walls[i].bi.origin().y < midY) return // Only work with walls in upper half of model
    const error = calcError(i)
    if (error < bestError) {
      bestWall = i
      bestError = error
    }
  })
  if (bestError == Infinity) throw new Error('Could not find a spot to place the microcontroller holder. Try setting both the microcontroller and connector to None (basic/adanced) or null (expert)".')

  // Then interpolate between walls to refine the index into decimals.
  let refinedWall = bestWall
  let refinedError = bestError
  for (let i = -9; i < 10; i++) {
    if (i == 0) continue
    const wall = (bestWall + (i / 10) + walls.length) % walls.length
    const error = calcError(wall)
    if (error < refinedError) {
      refinedWall = wall
      refinedError = error
    }
  }

  if (refinedError < bestError) { // Only return if it's better
    return Math.round(refinedWall * 100) / 100
  }
  return bestWall
}

export function wallXToY(walls: WallCriticalPoints[], x: number, start: number, direction: number, checkDirection: number, component = 'bi') {
  let ind = (start + walls.length) % walls.length
  for (let k = 0; k < walls.length; k++) {
    const first = walls[ind][component].origin()
    if (first.x * checkDirection > x * checkDirection) {
      const nextind = (ind - direction + walls.length) % walls.length
      const second = walls[nextind][component].origin()
      return {
        wall: ind,
        next: nextind,
        first,
        second,
        y: (x - first.x) / (second.x - first.x) * (second.y - first.y) + first.y,
      }
    }
    ind = (ind + direction + walls.length) % walls.length
  }
  return null
}

export function originForConnector(c: Cuttleform, walls: WallCriticalPoints[], surfaces: Line[][], wall: number) {
  const idx = Math.floor(wall)
  // const surf = surfaces[idx]
  // const next = surfaces[(idx + 1) % surfaces.length]
  // const nextnext = surfaces[(idx + 2) % surfaces.length]
  // const prev = surfaces[(idx - 1 + surfaces.length) % surfaces.length]
  // const wallBiMi = joinedWall(c, prev, surf, next, nextnext)[1]

  // let [horizTangent, vertTangent] = bezierTangentAtZ1(wallBiMi, idx)
  // vertTangent.normalize()
  let vertTangent = walls[idx].mi.origin().sub(walls[idx].bi.origin()).normalize()
  let horizTangent = new Vector(vertTangent.z, 0, -vertTangent.x).normalize()
  // if (vertTangent.z < 0) vertTangent.negate()
  vertTangent.normalize().add(new Vector(0, 0, 1))
  vertTangent.addScaledVector(horizTangent, -vertTangent.dot(horizTangent)).normalize()

  const fraction = wall - idx
  const pos = walls[idx].bi.origin().lerp(walls[(idx + 1) % walls.length].bi.origin(), fraction)

  // Gather the set of all important boundary y coordinates the board will be placed under
  const bounds = holderBoundsOrigin(c, pos, true)
  const yLeft = wallXToY(walls, bounds.minx, idx + 1, -1, -1)
  const yRight = wallXToY(walls, bounds.maxx, idx, 1, 1)
  if (yLeft && yRight) {
    const ys = [yLeft.y, yRight.y]
    for (let i = yLeft.wall!; i != yRight.wall!; i = (i + 1) % walls.length) {
      ys.push(minWallY(c, walls, i))
    }
    pos.add(new Vector(0, Math.min(...ys) - pos.y + BOARD_HOLDER_OFFSET, 0))
  }
  return walls[0].bi.cleared()
    .coordSystemChange(pos, horizTangent, vertTangent)
}

function cubicBezier(t: number, a: number, b: number, c: number, d: number) {
  return (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d
}

/** Find the extrema points (first derivative = 0) on a cubic bezier curve.
 * We know that these points are either minima or maxima on the curve.
 */
function bezierExtrema(k: number[]) {
  // Solve a quadratic equation... ish!
  const a = k[1] - k[0]
  const b = k[2] - k[1]
  const c = k[3] - k[2]
  const denominator = a + 2 * b - c
  const Q = Math.sqrt(a * a + 2 * a * b - a * c + b * b)

  const ts: number[] = []
  if (denominator == 0) {
    ts.push(1 - 0.5 * c / b)
  } else {
    ts.push((b - Q) / denominator)
    ts.push((b + Q) / denominator)
  }
  return ts.filter(t => t >= 0 && t <= 1) // Only take valid values of t
}

function minWallY(conf: Cuttleform, walls: WallCriticalPoints[], beginning: number) {
  const end = (beginning + 1) % walls.length
  if (conf.rounded.side) {
    const pre = (beginning - 1 + walls.length) % walls.length
    const post = (end + 1) % walls.length
    const bezier = wallBezier(conf, walls[pre].bi, walls[beginning].bi, walls[end].bi, walls[post].bi, walls[beginning], walls[end], new Vector(0, 0, 1), -Infinity)
    const bezierPnts = bezier.map(b => b.origin().y) as [number, number, number, number]
    // To find the minimum y, take the first derivative of the cubic bezier curve formula = 0.
    // This gives t in the bezier curve formula.
    // It's a quadratic equation, so there are 2 solutions with form (b += Q)/denominator.
    const ys = bezierExtrema(bezierPnts).map(t => cubicBezier(t, ...bezierPnts))
    // Also check the start and end points. The derivative won't capture these possible extrema.
    return Math.min(walls[beginning].bi.origin().y, walls[end].bi.origin().y, ...ys)
  } else {
    return Math.min(walls[beginning].bi.origin().y, walls[end].bi.origin().y)
  }
}

export function minWallYAlongVector(c: Cuttleform, surfaces: Line[][], idx: number, v: Vector) {
  const surf = surfaces[idx]
  const next = surfaces[(idx + 1) % surfaces.length]
  const nextnext = surfaces[(idx + 2) % surfaces.length]
  const prev = surfaces[(idx - 1 + surfaces.length) % surfaces.length]
  const wallBiMi = joinedWall(c, nextnext, next, surf, prev, new Vector(0, 0, 1), -Infinity)[1]

  console.log(wallBiMi)
  return patchMinAlongVector(wallBiMi, v)
}

/** The connector origin is right after the leftmost wall segment on the back of the model. */
export function connectorOrigin(c: Cuttleform, walls: WallCriticalPoints[], innerSurfaces: Line[][], selectB: string[], worldZ: Vector, bottomZ: number) {
  const wall = c.connectorIndex < 0 ? connectorIndex(c, walls, innerSurfaces, worldZ, bottomZ, selectB) : c.connectorIndex
  return originForConnector(c, walls, innerSurfaces, wall)
}

export function applyKeyAdjustment(c: Cuttleform, k: CuttleKey, t: Trsf) {
  const deg = keyInfo(k).tilt
  return t.cleared()
    .translate(0, 0, -keyInfo(k).depth - switchInfo(k.type).height)
    .rotate(deg, [0, 0, 0], [1, 0, 0])
    .translate(0, 0, keyBase(c))
    .premultiply(t)
}

function keyHoleTrsf(c: Cuttleform, k: CuttleKey, t: Trsf): Trsf {
  // if (!k.finger  && k.isOrigin) return k.offset.cleared().translate(0, 0, 20)
  // if (!k.finger) return k.offset.translated(thumbOrigin(c))

  // // const t = k.offset.cleared()
  // const t = k.position.evaluate({})

  // return t.preMultiply(k.offset)
  //     .rotate(c.tenting, CENTER, Y)
  //     .rotate(c.rotateX, CENTER, X)
  //     .translate(0, 0, c.zOffset);
  const deg = keyInfo(k).tilt

  // This is the radius of rotation
  const depth = keyInfo(k).depth + switchInfo(k.type).height
  // There is a compromise between rotating about the top of the key and the bottom
  // of the key. One keeps the top of the key in the same place, which is great for
  // the curvature. The other one keeps the base in place, which minimizes the chance
  // keys collide.
  // Translating by -depth*Math.tan(deg*Math.PI/180)/2 is a compromise between these two modes.
  // -depth*Math.tan(deg*Math.PI/180) = how much I'd need to translate to keep the base in
  // the same spot. I divide by 2 to keep the key halfway between where it started and where
  // it would otherwise end up.
  return new ETrsf(k.position.history).evaluate(
    { flat: false, key: k },
    t
      .translate(0, -depth * Math.tan(deg * Math.PI / 180) / 2, -depth)
      .rotate(deg, [0, 0, 0], [1, 0, 0])
      .translate(0, 0, keyBase(c)),
  )
}

export function bottomByNormal(c: Cuttleform, normal: Vector, t: Trsf) {
  // Use both the bottom of the switch part
  // and the bottom of the web to calculate the lowest point on the model
  let j = Math.min(...c.keys.flatMap(k => {
    const swTop = keyHoleTrsf(c, k, t.cleared())
    const swBottom = keyHoleTrsf(c, k, t.cleared()).pretranslated(0, 0, -webThickness(c, k))
    const pts = partBottom(k.type).flat()
    return pts.map(p => swTop.pretranslated(p).origin().dot(normal))
      // See comment in additionalHeight about adding c.wallThickness / 2 as offset.
      .concat(keyCriticalPoints(c, k, swBottom, c.wallThickness / 2).map(p => p.origin().dot(normal)))
  }))

  return j
}

export function additionalHeight(c: Cuttleform, t: Trsf) {
  // Use both the bottom of the switch part
  // and the bottom of the web to calculate the lowest point on the model
  let z = Math.min(...c.keys.flatMap(k => {
    const swTop = keyHoleTrsf(c, k, t.cleared())
    const swBottom = keyHoleTrsf(c, k, t.cleared()).pretranslated(0, 0, -webThickness(c, k))
    const pts = partBottom(k.type).flat()
    return pts.map(p => swTop.pretranslated(p).origin().z)
      // The c.wallThickness/2 is added as an additional offset because when keys are rotated vertically,
      // the wall will stick out below the key. However, the ti on these walls is not quite translated out by wallThickness
      // due to thickness correcting factors. Hence c.wallThickness / 2 tries to approximate this amount.
      .concat(keyCriticalPoints(c, k, swBottom, c.wallThickness / 2).map(p => p.origin().z))
  }))

  const pts2D = allKeyCriticalPoints(c, keyHolesTrsfs2D(c, t))
  const keyholes = c.keys.map(k => keyHoleTrsf(c, k, t.cleared()))
  const pts3D = allKeyCriticalPoints(c, keyholes)
  const pts3Df = flattenKeyCriticalPoints(c, pts3D, [])
  const { boundary } = solveTriangularization(c, pts2D, pts3D, keyholes, 0, new Vector(0, 0, 1), {
    noBadWalls: false,
    constrainKeys: false,
    noKeyTriangles: false,
  })

  // If clear screws is turned off, then z adjustment = negate what's below the ground!
  let adjustment = -z
  if (!c.clearScrews || c.screwIndices.length == 0) {
    return c.verticalClearance + adjustment
  }

  // Find approximate positions of screw inserts.
  // Do this by taking the convex hull. Don't bother with following up with a concave hull.
  // Calculate wall ki points given this boundary.
  // Then adjust height so 75% of the screw inserts will fit.
  const insertDim = screwInsertDimensions(c)
  const insertHeight = insertDim.height + insertDim.outerTopRadius + 5

  // const allPts = pts2D.flatMap(a => a.map(p => p.xyz()))
  // const allTris = cdt2d(allPts, [])
  // const bnd = boundary(allTris)
  const boundaryZ: number[] = boundary.map(b => pts3Df[b].trsf.pretranslated(0, 0, -webThickness(c, pts3Df[b].key)).origin().z + adjustment)
  const screwholeZ = boundaryZ.map((b, i) => (b + boundaryZ[(i + 1) % boundaryZ.length]) / 2)
  // const screwholeZ = boundaryZ
  screwholeZ.sort((a, b) => b - a)
  const percentile75 = screwholeZ[Math.round((screwholeZ.length - 1) * 0.75)]
  if (percentile75 < insertHeight) {
    adjustment += insertHeight - percentile75
  }

  return adjustment + c.verticalClearance
}

export function keyHolesTrsfs(c: Cuttleform, t: Trsf): Trsf[] {
  const base = c.keys.map(k => keyHoleTrsf(c, k, t.cleared()))
  // const additional = additionalHeight(c, t)
  // base.forEach(b => b.translate(0, 0, additional))
  return base
}

function range(x: number[]): number {
  return Math.max(...x) - Math.min(...x)
}

function fingerKeys(c: Cuttleform): CuttleKey[] {
  // @ts-ignore
  return c.keys.filter(k => !!k.finger)
}

export function keyHolesTrsfs2D(c: Cuttleform, t: Trsf) {
  return c.keys.map(k => new ETrsf(k.position.history).evaluate({ flat: true }, t.cleared()))
}

interface TriangularizationOptions {
  noBadWalls: boolean
  constrainKeys: boolean
  noKeyTriangles: boolean
  boundary?: number[]
  bottomPts2D?: Trsf[]
  noCut?: boolean
}

export function solveTriangularization(c: Cuttleform, pts2D: CriticalPoints[], pts: CriticalPoints[], trsfs: Trsf[], bottomZ: number, worldZ: Vector, opts: TriangularizationOptions) {
  const allPolys = pts2D.map(a => a.map(p => p.xyz()))
  let allPts = allPolys.flat()
  let allTrsfs = flattenKeyCriticalPoints(c, pts, trsfs)
  const removedTriangles: number[][] = []

  const edges: number[][] = []
  if (opts.constrainKeys) {
    for (const p of allPolys) {
      for (let i = 0; i < p.length; i++) {
        edges.push([allPts.indexOf(p[i]), allPts.indexOf(p[(i + 1) % p.length])])
      }
    }
    if (opts.boundary) throw new Error('Using boundary + constrain not supported')
  }
  const boundaryPts: number[] = []
  const allIdx: number[] = []
  if (opts.boundary) {
    const newAllPts: typeof allPts = []
    const newAllTrsfs: typeof allTrsfs = []
    for (let i = 0; i < allPts.length; i++) {
      if (intersectPtPoly(allPts[i], opts.boundary.map(i => allPts[i]))) {
        newAllPts.push(allPts[i])
        newAllTrsfs.push(allTrsfs[i])
        allIdx.push(i)
      }
    }
    for (let i = 0; i < opts.boundary.length; i++) {
      const idx1 = newAllPts.indexOf(allPts[opts.boundary[i]])
      const idx2 = newAllPts.indexOf(allPts[opts.boundary[(i + 1) % opts.boundary.length]])
      boundaryPts.push(idx1)
      edges.push([idx1, idx2])
    }
    allPts = newAllPts
    allTrsfs = newAllTrsfs
  }

  let allTris: number[][] = cdt2d(allPts, edges)
  const bnd = findBoundary(allTris)

  if (opts.noKeyTriangles) {
    allTris = allTris.filter(([a, b, c]) => {
      for (const poly of allPolys) {
        if (poly.includes(allPts[a]) && poly.includes(allPts[b]) && poly.includes(allPts[c])) {
          return false
        }
      }
      return true
    })
  }
  const lengthThresh = c.rounded.side ? 40 : undefined
  const concavity = c.rounded.side?.concavity ?? 1.5
  if (opts.boundary) {
    // Special case: since the boundary is already fixed,
    // we can filter triangles inside the boundary using the knowledge that
    // all non-boundary points are inside the boundary
    return {
      boundary: boundaryPts,
      triangles: allTris.filter(([a, b, c]) => {
        const idxA = boundaryPts.indexOf(a)
        const idxB = boundaryPts.indexOf(b)
        const idxC = boundaryPts.indexOf(c)
        if (idxA < 0 || idxB < 0 || idxC < 0) return true
        return (idxA > idxB && idxB > idxC)
          || (idxB > idxC && idxC > idxA)
          || (idxC > idxA && idxA > idxB)
      }),
      allPts,
      allPolys,
      allTrsfs,
      allIdx,
      removedTriangles,
      innerBoundary: boundaryPts,
    }
  }
  let { boundary, triangles } = concaveman(c, allTrsfs, allPts, allTris, bnd, bottomZ, worldZ, opts.noBadWalls, concavity, lengthThresh, opts.noCut, opts.bottomPts2D)
  const innerBoundary: number[] = [...boundary]
  triangles = triangles.filter(([a, b, c]) => {
    // @ts-ignore
    const isBoundary = boundary.includes(a) + boundary.includes(b) + boundary.includes(c) >= 2
    if (!isBoundary) return true
    const u = new Vector(allPts[b][0], allPts[b][1], 0).sub(new Vector(allPts[a][0], allPts[a][1], 0))
    const v = new Vector(allPts[c][0], allPts[c][1], 0).sub(new Vector(allPts[a][0], allPts[a][1], 0))
    const perimeter = u.length() + v.length()
    const area = u.cross(v).length() / 2
    if (area > 5 || area / perimeter > 0.1) {
      return true
    }
    removedTriangles.push([a, b, c])
    const idxA = boundary.indexOf(a)
    const idxB = boundary.indexOf(b)
    const idxC = boundary.indexOf(c)
    if (idxA >= 0 && idxB >= 0) {
      innerBoundary.splice(Math.min(idxA, idxB), 0, c)
    } else if (idxB >= 0 && idxC >= 0) {
      innerBoundary.splice(Math.min(idxB, idxC), 0, a)
    } else if (idxC >= 0 && idxA >= 0) {
      innerBoundary.splice(Math.min(idxC, idxA), 0, b)
    } else {
      throw new Error('Unexpected')
    }
    return false
  })
  return {
    boundary,
    triangles,
    allPts,
    allPolys,
    allTrsfs,
    allIdx,
    removedTriangles,
    innerBoundary,
  }
}

export function estimatedCenter(geometry: Geometry, wristRest = false): [number, number, number] {
  const pts = geometry.keyHolesTrsfs.map(t => t.xyz())
  const x = pts.map(p => p[0])
  const y = pts.map(p => p[1])
  const z = pts.map(p => p[2])

  const cx = (Math.min(...x) + Math.max(...x)) / 2
  let cy = (Math.min(...y) + Math.max(...y)) / 2
  if (wristRest) cy -= 20
  const cz = Math.max(...z) / 2 + geometry.floorZ / 2
  return [cx, cy, cz]
}

function findClosestWall(
  c: Cuttleform,
  walls: WallCriticalPoints[],
  p: (v: Vector) => number,
  cond: (v: Vector) => boolean,
  transform: Trsf,
  worldZ: Vector,
  bottomZ: number,
  optimize = false,
): [number, number] {
  let bestError = Infinity
  let bestWall = 0

  const insertDim = screwInsertDimensions(c)
  const insertHeight = insertDim.height + insertDim.outerTopRadius + 5
  walls.forEach((_, i) => {
    const center = transform.apply(screwOrigin(c, i + 0.5, walls))
    if (!cond(center)) return

    const avgKi = walls[i].ki.origin().lerp(walls[(i + 1) % walls.length].ki.origin(), 0.5)
    const avgHeight = avgKi.dot(worldZ) - bottomZ
    if (avgHeight < insertHeight) return

    const error = p(center)
    if (error < bestError) {
      bestError = error
      bestWall = i + 0.5
    }
  })
  // Refine the estimate by looking at 0.1 increments
  if (optimize) {
    for (let i = -9; i < 10; i++) {
      if (i == 0) continue
      const wall = (bestWall + (i / 10) + walls.length) % walls.length
      const error = p(transform.apply(screwOrigin(c, wall, walls)))
      if (error < bestError) {
        bestError = error
        bestWall = wall
      }
    }
  }

  // if (bestError == Infinity)
  //     throw new Error('Could not find an attachment point for the bold holder. Perhaps the board is too close to the edge?')
  return [bestWall, bestError]
}

function findBoardWalls(c: Cuttleform, walls: WallCriticalPoints[], origin: Trsf, select: string[], worldZ: Vector, bottomZ: number, optimize = false) {
  const hBnd = localHolderBounds(c, true)
  const bottomRadius = screwInsertDimensions(c).outerBottomRadius

  const p1 = new Vector(hBnd.minx - bottomRadius, hBnd.maxy, 0)
  const p2 = new Vector(hBnd.maxx + bottomRadius, hBnd.maxy, 0)
  const p3 = new Vector(hBnd.minx - bottomRadius, hBnd.miny, 0)
  const originInv = origin.inverted()
  const [i1, e1] = findClosestWall(c, walls, p => p.sub(p1).lengthSq(), p => p.x < p1.x, originInv, worldZ, bottomZ, optimize)
  const [i2, e2] = findClosestWall(c, walls, p => p.sub(p2).lengthSq(), p => p.x > p2.x, originInv, worldZ, bottomZ, optimize)
  const [i3, e3] = findClosestWall(c, walls, p => Math.abs(p.sub(p3).y), p => p.x < p3.x, originInv, worldZ, bottomZ, optimize)

  const indices = [i1, i2, i3]
  let error = e1 + e2 + originInv.apply(screwOrigin(c, i3, walls)).sub(p3).lengthSq()
  if (new Set(indices).size < 3) error = Infinity

  const labeledIdx = filterObj({ topLeft: i1, topRight: i2, bottomLeft: i3 }, k => select.includes(k))

  return { indices: labeledIdx, error, errors: [e1, e2, e3] }
}

export function boardIndices(c: Cuttleform, connOrigin: Trsf | null, walls: WallCriticalPoints[], worldZ: Vector, bottomZ: number, select: string[], optimize = false): LabeledBoardInd {
  if (!c.microcontroller || !connOrigin) return {}
  const { indices, error } = findBoardWalls(c, walls, connOrigin, select, worldZ, bottomZ, optimize)

  if (error == Infinity) throw new Error('Could not find attachment points for the bold holder. Perhaps the board is too close to the edge?')
  return indices
}

export function screwOrigin(c: Cuttleform, i: number, walls: WallCriticalPoints[]) {
  const whole = Math.floor(i)
  const fraction = i - whole
  const thisWall = walls[whole].bi.origin()
  const nextWall = walls[(whole + 1) % walls.length].bi.origin()

  // Compute the center in the middle of the wall
  const center = new Vector(thisWall).lerp(nextWall, fraction)

  // Add the normal vector to the screw sits inside the wall
  const normal = new Vector(thisWall).sub(nextWall).normalize().cross(Zv).negate()

  const bottomRadius = screwInsertDimensions(c).outerBottomRadius
  return center.addScaledVector(normal, bottomRadius)
}

export interface LabeledBoardInd {
  topLeft?: number
  bottomLeft?: number
  topRight?: number
}

interface ScoreParams {
  kiMax: number
  insertHeight: number
  minDisplacement: number
  minHolderDisp: number
  boardInd: LabeledBoardInd
  otherPositions: Set<number>
  worldZ: Vector
  bottomZ: number
  holderBnd?: ReturnType<typeof holderBoundsOrigin>
}

function screwScoreStilts(c: Cuttleform, walls: WallCriticalPoints[], s: number, params: ScoreParams) {
  const { kiMax, insertHeight, minDisplacement, minHolderDisp, boardInd, holderBnd, worldZ, bottomZ } = params
  // The score is based on how high the key is and displacement from the nearest
  // neighboring screw insert
  const idx = Math.floor(s)
  const avgKi = walls[idx].ki.origin().lerp(walls[(idx + 1) % walls.length].ki.origin(), s - idx)
  const avgHeight = avgKi.dot(worldZ) - bottomZ
  if (avgHeight < insertHeight) return -Infinity
  for (const i of params.otherPositions) {
    // Return -Infinity if it intersects any screws
    const displMM = screwOrigin(c, i, walls).sub(screwOrigin(c, s, walls)).lengthOnPlane(worldZ)
    if (displMM < minDisplacement) return -Infinity
  }
  const minBoardDisplacement = minDisplacement / 2 + holderOuterRadius(c)
  for (const i of Object.values(boardInd)) {
    // Return -Infinity if it intersects any board screws
    const displMM = screwOrigin(c, i, walls).sub(screwOrigin(c, s, walls)).lengthOnPlane(worldZ)
    if (displMM < minBoardDisplacement) return -Infinity
  }
  // Return -Infinity if it intersects the board
  // Disregard this if there is no microcontroller and no connector
  if (holderBnd) {
    const miny = boardInd.bottomLeft ? Math.min(screwOrigin(c, boardInd.bottomLeft, walls).y - holderOuterRadius(c), holderBnd.miny) : holderBnd.miny
    const maxy = boardInd.topLeft
      ? Math.max(
        screwOrigin(c, boardInd.topLeft, walls).y + holderOuterRadius(c),
        screwOrigin(c, boardInd.topRight!, walls).y + holderOuterRadius(c),
        holderBnd.maxy,
      )
      : holderBnd.maxy
    const pos = screwOrigin(c, s, walls)
    if (
      pos.y + minHolderDisp / 2 > miny
      && pos.y - minHolderDisp / 2 < maxy
      && pos.x + minHolderDisp > holderBnd.minx
      && pos.x - minHolderDisp < holderBnd.maxx
    ) {
      return -Infinity
    }
  }

  // Case of 0 other positions: find the hole furthest from the centroid (ie center of model)
  if (params.otherPositions.size == 0) {
    const centroid = walls.reduce((v, w) => v.add(w.bi.origin()), new Vector()).divideScalar(walls.length)
    return screwOrigin(c, s, walls).distanceTo(centroid)
  }

  // Case of 1 other position: find the hole furthest away from both
  // the original hole and centroid
  if (params.otherPositions.size == 1) {
    const firstPosition = [...params.otherPositions][0]
    const centroid = walls.reduce((v, w) => v.add(w.bi.origin()), new Vector()).divideScalar(walls.length)
    return screwOrigin(c, firstPosition, walls).distanceTo(screwOrigin(c, s, walls)) + 5 * screwOrigin(c, s, walls).distanceTo(centroid)
  }

  // Case of >= 2 positions:
  // Find the tippage when pressing on this position
  // Since the screw score = the tippage, the position with max tippage will be picked.
  const origins = walls.map((_, i) => screwOrigin(c, i + 0.5, walls))
  for (const other of params.otherPositions) {
    origins[other] = screwOrigin(c, other, walls)
  }
  const avgBo = walls[idx].bo.origin().lerp(walls[(idx + 1) % walls.length].bo.origin(), s - idx)
  const tips = [...tippingLines(params.otherPositions, origins, avgBo)]
  let minTippage = tips.length >= 1 ? Math.min(...tips.map(t => t.tippage)) : 0

  return minTippage
}

function* tippingLines(possibilities: Iterable<number>, origins: Record<number, Vector>, wallPos: Vector) {
  for (const i of possibilities) {
    // const radial = wallPos.clone().sub(origins[i])
    // radial.z = 0
    // if (radial.length() < minTippage) minTippage = radial.length()

    for (const j of possibilities) {
      if (i <= j) continue
      const origin1 = origins[i]
      const origin2 = origins[j]
      const line = origin2.clone().sub(origin1)
      line.z = 0
      line.normalize()

      const normal = line.cross(new Vector(0, 0, 1))
      const tippage = wallPos.clone().sub(origin1).dot(normal)

      const good = [...possibilities].every(k => {
        if (k == i || k == j) return true // Don't bother checking
        // Tip and the third pillar should lie on opposite sides
        return (tippage * origins[k].clone().sub(origin1).dot(normal) <= 0)
      })
      if (good) yield { i, j, tippage: Math.abs(tippage) }
    }
  }
}

function maxTip(c: Cuttleform, screwIndices: number[], walls: WallCriticalPoints[]) {
  const origins = walls.map((_, i) => screwOrigin(c, i, walls))
  for (const idx of screwIndices) {
    origins[idx] = screwOrigin(c, idx, walls)
  }
  return Math.max(...walls.flatMap(w => [...tippingLines(screwIndices, origins, w.bo.origin())]).map(t => t.tippage))
}

function screwScore(c: Cuttleform, walls: WallCriticalPoints[], s: number, params: ScoreParams) {
  const { kiMax, insertHeight, minDisplacement, boardInd, holderBnd, bottomZ, worldZ } = params
  // The score is based on how high the key is and displacement from the nearest
  // neighboring screw insert
  const idx = Math.floor(s)
  const avgKi = walls[idx].ki.origin().lerp(walls[(idx + 1) % walls.length].ki.origin(), s - idx)
  const avgHeight = avgKi.dot(worldZ) - bottomZ
  if (avgHeight < insertHeight) return -Infinity
  const height = Math.sqrt(avgHeight / kiMax)
  let nearestDispl = Infinity
  for (const i of params.otherPositions) {
    const diff = Math.abs(i - s)
    const displ = Math.min(diff, walls.length - diff) % walls.length
    nearestDispl = Math.min(nearestDispl, displ / walls.length)

    const displMM = screwOrigin(c, i, walls).sub(screwOrigin(c, s, walls)).length()
    if (displMM < minDisplacement) return -Infinity
  }
  const minBoardDisplacement = minDisplacement / 2 + holderOuterRadius(c)
  for (const i of Object.values(boardInd)) {
    // Return -Infinity if it intersects any board screws
    const displMM = screwOrigin(c, i, walls).sub(screwOrigin(c, s, walls)).length()
    if (displMM < minBoardDisplacement) return -Infinity
  }
  // Return -Infinity if it intersects the board
  // Disregard this if there is no microcontroller and no connector
  if (holderBnd) {
    const miny = boardInd[2] ? Math.min(screwOrigin(c, boardInd[2], walls).y - holderOuterRadius(c), holderBnd.miny) : holderBnd.miny
    const maxy = boardInd[0]
      ? Math.max(
        screwOrigin(c, boardInd[0], walls).y + holderOuterRadius(c),
        screwOrigin(c, boardInd[1], walls).y + holderOuterRadius(c),
        holderBnd.maxy,
      )
      : holderBnd.maxy
    const pos = screwOrigin(c, s, walls)
    if (
      pos.y + minDisplacement / 2 > miny
      && pos.y - minDisplacement / 2 < maxy
      && pos.x + minDisplacement > holderBnd.minx
      && pos.x - minDisplacement < holderBnd.maxx
    ) {
      return -Infinity
    }
  }
  return 10 * Math.sqrt(nearestDispl) + height
}

export function* allScrewIndices(
  c: Cuttleform,
  walls: WallCriticalPoints[],
  connOrigin: Trsf | null,
  boardInd: LabeledBoardInd,
  initialPositions: number[],
  worldZ: Vector,
  bottomZ: number,
  minDisplacement?: number,
) {
  // How far away each screw insert must be from each other, in mm
  const minHolderDisp = screwInsertDimensions(c).outerBottomRadius * 2
  if (!minDisplacement) minDisplacement = minHolderDisp
  // Maximum key height. Used for scaling.
  const kiMax = Math.max(...walls.map(w => w.ki.origin().dot(worldZ)))

  const insertDim = screwInsertDimensions(c)
  const insertHeight = insertDim.height

  const positions = new Set(initialPositions)
  const holderBnd = (c.microcontroller || c.connector) && connOrigin ? holderBoundsOrigin(c, connOrigin.origin(), true) : undefined
  while (true) {
    // Find position with the highest score
    let highestScore = -Infinity
    let bestPosition = 0
    for (let i = 0; i < walls.length; i++) {
      const iCenter = i + 0.5
      if (positions.has(iCenter)) continue
      const fn = c.shell.type == 'stilts' ? screwScoreStilts : screwScore
      const sc = fn(c, walls, iCenter, {
        kiMax,
        insertHeight,
        minDisplacement,
        boardInd,
        holderBnd,
        bottomZ,
        minHolderDisp,
        worldZ,
        otherPositions: positions,
      })
      if (sc > highestScore) {
        bestPosition = iCenter
        highestScore = sc
      }
    }

    if (highestScore == -Infinity) {
      // Exit early: all the possible screw positions have been taken.
      return
    }

    positions.add(bestPosition)
    yield bestPosition
  }
}

export function screwIndices(
  c: Cuttleform,
  walls: WallCriticalPoints[],
  connOrigin: Trsf | null,
  boardIdx: LabeledBoardInd,
  boardsScrewsToo: string[],
  worldZ: Vector,
  bottomZ: number,
  minDisplacement?: number,
) {
  // Include first board index if it exists and screw indices
  let screwPositions = [...boardsScrewsToo.map(b => boardIdx[b]), ...c.screwIndices]
  const positiveInd = screwPositions.filter(i => i != -1)

  if (true || positiveInd.length) {
    for (const pos of allScrewIndices(c, walls, connOrigin, boardIdx, positiveInd, worldZ, bottomZ, minDisplacement)) {
      // Find next position with index -1. It will be replaced.
      const nextIndex = screwPositions.indexOf(-1)
      if (nextIndex == -1) break

      screwPositions[nextIndex] = pos
    }
  } else {
    // TIL this doesn't really add much, and comes at the expense of lots of computation
    // Therefore it's disabled.

    // In the case that there are no initial guesses, there is no helpful information to help
    // the algorithm choose the spot of the first screw index.
    // Therefore, we iterate through all possibilities for that first index, and choose
    // the first index that leads to the minimum possible tippage after all screws have been placed.
    let bestScore = Infinity
    for (let firstIdx = 0; firstIdx < walls.length; firstIdx++) {
      const screwPositionsAttempt = [...boardsScrewsToo.map(b => boardIdx[b]), ...c.screwIndices]
      for (const pos of allScrewIndices(c, walls, connOrigin, boardIdx, [firstIdx], worldZ, bottomZ, minDisplacement)) {
        // Find next position with index -1. It will be replaced.
        const nextIndex = screwPositionsAttempt.indexOf(-1)
        if (nextIndex == -1) break

        screwPositionsAttempt[nextIndex] = pos
      }
      const score = maxTip(c, screwPositionsAttempt, walls)
      if (score < bestScore) screwPositions = screwPositionsAttempt
    }
  }
  let nextIndex = screwPositions.lastIndexOf(-1)
  while (nextIndex != -1) {
    screwPositions.splice(nextIndex, 1)
    nextIndex = screwPositions.lastIndexOf(-1)
  }
  return screwPositions.slice(boardsScrewsToo.length)
}

export function positionImpl(c: Cuttleform, walls: WallCriticalPoints[], z: Vector, i: number) {
  const whole = Math.floor(i)
  const fraction = i - whole

  const thisWall = walls[whole].bi.origin()
  const nextWall = walls[(whole + 1) % walls.length].bi.origin()

  if (c.shell.type == 'stilts') {
    z = new Vector()
      .addScaledVector(walls[whole].mi.origin(), 1 - fraction)
      .addScaledVector(walls[(whole + 1) % walls.length].mi.origin(), fraction)
      .addScaledVector(thisWall, -(1 - fraction))
      .addScaledVector(nextWall, -fraction)
      .normalize()
  }

  // Compute the center in the middle of the wall
  const center = new Vector(thisWall).lerp(nextWall, fraction)

  // Add the normal vector to the screw sits inside the wall
  const normal = new Vector(thisWall).sub(nextWall).normalize().cross(z)
  if (z.z > 0) normal.negate() // Ensures correct orientation if the insert faces down

  const counterRadius = SCREWS[c.screwSize].countersunkDiameter / 2 + 1
  const bottomRadius = screwInsertDimensions(c).outerBottomRadius
  center.addScaledVector(normal, Math.max(bottomRadius, counterRadius))
  return walls[whole].bi.cleared().coordSystemChange(center, normal, z)
}

export function positionsImpl(c: Cuttleform, walls: WallCriticalPoints[], z: Vector, positions: number[]) {
  return positions.map(i => positionImpl(c, walls, z, i))
}

export function positionsImplMap(c: Cuttleform, walls: WallCriticalPoints[], z: Vector, positions: Record<string, number>) {
  return Object.fromEntries(Object.entries(positions).map(([p, i]) => [p, positionImpl(c, walls, z, i)]))
}

// export function screwPositions(c: Cuttleform, walls: WallCriticalPoints[]) {
// return positionsImpl(c, walls, screwIndices(c, walls))
// }

export function boardPositions(c: Cuttleform, connOrigin: Trsf, walls: WallCriticalPoints[], z: Vector, bottomZ: number, select: string[]) {
  if (!c.microcontroller) return []
  return positionsImplMap(c, walls, z, boardIndices(c, connOrigin, walls, z, bottomZ, select) as any)
}

export function wristRestGeometry(c: Cuttleform, geo: Geometry) {
  if (!c.wristRest) throw new Error('Wrist rest is not enabled')

  // Move walls out by 0.5mm so there's some margin
  const trsfs = geo.keyHolesTrsfs
  const pts = geo.allKeyCriticalPoints
  const walls = geo.allWallCriticalPoints()

  const xMin = new Set<number>()
  const xMax = new Set<number>()
  const frontWalls = walls.filter((wall, i) => {
    const w = wall.bo.xyz()
    const wNext = walls[(i + 1) % walls.length].bo.xyz()

    const isHorizontal = Math.abs(w[0] - wNext[0]) > Math.abs(w[1] - wNext[1])
    if (w[0] > wNext[0] && isHorizontal) {
      xMax.add(Math.min(w[0], wall.to.xyz()[0] - 0.1))
      xMin.add(Math.max(wNext[0], walls[(i + 1) % walls.length].to.xyz()[0] + 0.1))
    }
    return w[0] > wNext[0] && isHorizontal
  })
  const midFrontWall = frontWalls[Math.floor(frontWalls.length / 2)]

  const origin = new ETrsf(c.wristRestOrigin.history).evaluate({ flat: false }, pts[0][0].cleared()).xyz()
  origin[2] += additionalHeight(c, pts[0][0])
  console.log('origin', origin)
  const left = Math.max(origin[0] + c.wristRest.xOffset - c.wristRest.maxWidth / 2, Math.min(...xMin))
  const right = Math.min(origin[0] + c.wristRest.xOffset + c.wristRest.maxWidth / 2, Math.max(...xMax))
  if (left > right) throw new Error('Wrist rest is not wide enough')

  const leftWallY = wallXToY(walls, left, walls.indexOf(midFrontWall), 1, -1, 'to')
  const rightWallY = wallXToY(walls, right, walls.indexOf(midFrontWall), -1, 1, 'to')
  const leftWallY2 = wallXToY(walls, left, walls.indexOf(midFrontWall), 1, -1, 'bo')
  const rightWallY2 = wallXToY(walls, right, walls.indexOf(midFrontWall), -1, 1, 'bo')

  if (!leftWallY || !rightWallY || !leftWallY2 || !rightWallY2) throw new Error('Could not locate walls for wrist rest')

  const sinAngle = Math.sin(c.wristRest.angle * Math.PI / 180)
  const cosAngle = Math.cos(c.wristRest.angle * Math.PI / 180)
  const tanAngle = Math.tan(c.wristRest.angle * Math.PI / 180)

  const leftStart = new Vector(left, Math.max(leftWallY.y, leftWallY2.y), 0)
  const rightStart = new Vector(right, Math.max(rightWallY.y, rightWallY2.y), 0)

  const intermediatePoints: Vector[] = []
  for (let i = rightWallY.next; i <= leftWallY.next; i++) {
    const to = walls[i].to.origin()
    // Only add the intermediate point if it lies within the taper
    if (
      to.x > left + tanAngle * (leftStart.y - to.y)
      && to.x < right - tanAngle * (rightStart.y - to.y)
    ) {
      intermediatePoints.push(new Vector(to.x, to.y, 0))
    }
  }

  const minY = Math.min(leftStart.y, rightStart.y)
  const leftLength = (c.wristRest.length + leftStart.y - minY) / cosAngle
  const rightLength = (c.wristRest.length + rightStart.y - minY) / cosAngle

  const leftEnd = new Vector(leftStart.x + sinAngle * leftLength, leftStart.y - cosAngle * leftLength, 0)
  const rightEnd = new Vector(rightStart.x - sinAngle * rightLength, rightStart.y - cosAngle * rightLength, 0)

  if (leftEnd.x > rightEnd.x) throw new Error('Wrist rest width is not big enough to support taper angle')
  return {
    leftStart,
    leftEnd,
    rightStart,
    rightEnd,
    intermediatePoints,
    zOffset: origin[2] - 30 + c.wristRest.zOffset,
    origin,
    minY,
  }
}

export type Curve = [Trsf, Trsf, Trsf, Trsf]
export type Patch = Vector[][]
// https://github.com/Open-Cascade-SAS/OCCT/blob/28b505b27baa09dfba68242534a89a55960b19ac/src/GeomFill/GeomFill_Coons.cxx
export function bezierPatch(p1: Curve, p2: Curve, p3: Curve, p4?: Curve) {
  const poles: Patch = [[], [], [], []]

  let c1 = p1.map(p => p.origin())
  let c2 = p2.map(p => p.origin())
  let c3 = p3.map(p => p.origin())
  let c4: Vector[]

  // Try to correct curves that are in the wrong directions
  // First get c1 and c2 connected.
  if (c1[0].approxEq(c2[0])) c1.reverse()
  else if (c1[0].approxEq(c2[3])) c1.reverse() && c2.reverse()
  else if (c1[3].approxEq(c2[3])) c2.reverse()
  else if (!c1[3].approxEq(c2[0])) {
    throw new Error('Could not connect 1st and 2nd curves')
  }

  // c2 and c2 are guaranteed to be pointing the right way. Now connect c3 and c4
  if (c3[0].approxEq(c2[3])) c3.reverse()
  if (p4) {
    c4 = p4.map(p => p.origin())
    if (c1[0].approxEq(c4[3])) c4.reverse()
  } else {
    c4 = [c1[0], c1[0].clone().lerp(c3[0], 1 / 3), c1[0].clone().lerp(c3[0], 2 / 3), c3[0]]
  }

  // Borrowing from the opencascade documentation, the curves are to be laid out
  // like this.
  //                      CC3
  //                  ----->-----
  //                 |           |
  //                 |           |
  //                 |           |
  //             CC4 ^           ^ CC2
  //                 |           |
  //                 |           |
  //                  ----->-----
  //                   CC1 = C1
  if (!c1[0].approxEq(c4[0])) throw new Error('1st and 4th curves are not attached properly')
  if (!c1[3].approxEq(c2[0])) throw new Error('1st and 2nd curves are not attached properly')
  if (!c2[3].approxEq(c3[3])) throw new Error('2nd and 3rd curves are not attached properly')
  if (!c3[0].approxEq(c4[3])) throw new Error('3rd and 4th curves are not attached properly')

  for (let i = 0; i < 4; i++) {
    poles[i][0] = c1[i]
    poles[i][3] = c3[i]
    poles[0][i] = c4[i]
    poles[3][i] = c2[i]
  }
  poles[1][1] = new Vector().add(poles[1][0]).add(poles[0][1]).sub(poles[0][0])
  poles[1][2] = new Vector().add(poles[1][3]).add(poles[0][2]).sub(poles[0][3])
  poles[2][1] = new Vector().add(poles[2][0]).add(poles[3][1]).sub(poles[3][0])
  poles[2][2] = new Vector().add(poles[2][3]).add(poles[3][2]).sub(poles[3][3])
  return poles
}

/** Evaluate the bezier surface at a given (u, v) point. */
export function evalPatch(K: number[][], u: number, v: number) {
  const u3 = u * u * u
  const u2 = u * u
  const v3 = v * v * v
  const v2 = v * v
  return -u * v * K[3][3] - u * (1 - v) * K[0][3] + u * (v3 * K[3][3] + 3 * v2 * (1 - v) * K[2][3] + 3 * v * (1 - v) ** 2 * K[1][3] + (1 - v) ** 3 * K[0][3]) - v * (1 - u) * K[3][0]
    + v * (u3 * K[3][3] + 3 * u2 * (1 - u) * K[3][2] + 3 * u * (1 - u) ** 2 * K[3][1] + (1 - u) ** 3 * K[3][0]) - (1 - u) * (1 - v) * K[0][0]
    + (1 - u) * (v3 * K[3][0] + 3 * v2 * (1 - v) * K[2][0] + 3 * v * (1 - v) ** 2 * K[1][0] + (1 - v) ** 3 * K[0][0])
    + (1 - v) * (u3 * K[0][3] + 3 * u2 * (1 - u) * K[0][2] + 3 * u * (1 - u) ** 2 * K[0][1] + (1 - u) ** 3 * K[0][0])
}

/** Calculates the Gradient of a bezier patch.
 * The Gradient is defined as the vector [dB / du, dB / dv].
 * This is only valid for the bilinearly interpolated patches given by bezierPatch()
 */
export function patchGradient(K: number[][], u: number, v: number) {
  const u3 = u * u * u
  const u2 = u * u
  const v3 = v * v * v
  const v2 = v * v
  return [
    -v3 * K[3][0] + v3 * K[3][3] + 3 * v2 * (v - 1) * K[2][0] - 3 * v2 * (v - 1) * K[2][3] - 3 * v * (v - 1) ** 2 * K[1][0] + 3 * v * (v - 1) ** 2 * K[1][3]
    - 3 * v * (u2 * K[3][2] - u2 * K[3][3] - 2 * u * (u - 1) * K[3][1] + 2 * u * (u - 1) * K[3][2] + (u - 1) ** 2 * K[3][0] - (u - 1) ** 2 * K[3][1]) + v * K[3][0] - v * K[3][3]
    + (v - 1) ** 3 * K[0][0] - (v - 1) ** 3 * K[0][3]
    + 3 * (v - 1) * (u2 * K[0][2] - u2 * K[0][3] - 2 * u * (u - 1) * K[0][1] + 2 * u * (u - 1) * K[0][2] + (u - 1) ** 2 * K[0][0] - (u - 1) ** 2 * K[0][1]) - (v - 1) * K[0][0] + (v - 1) * K[0][3],
    -u3 * K[0][3] + u3 * K[3][3] + 3 * u2 * (u - 1) * K[0][2] - 3 * u2 * (u - 1) * K[3][2] - 3 * u * (u - 1) ** 2 * K[0][1] + 3 * u * (u - 1) ** 2 * K[3][1]
    - 3 * u * (v2 * K[2][3] - v2 * K[3][3] - 2 * v * (v - 1) * K[1][3] + 2 * v * (v - 1) * K[2][3] + (v - 1) ** 2 * K[0][3] - (v - 1) ** 2 * K[1][3]) + u * K[0][3] - u * K[3][3]
    + (u - 1) ** 3 * K[0][0] - (u - 1) ** 3 * K[3][0]
    + 3 * (u - 1) * (v2 * K[2][0] - v2 * K[3][0] - 2 * v * (v - 1) * K[1][0] + 2 * v * (v - 1) * K[2][0] + (v - 1) ** 2 * K[0][0] - (v - 1) ** 2 * K[1][0]) - (u - 1) * K[0][0] + (u - 1) * K[3][0],
  ]
}

/** Calculates the Hessian of a bezier patch.
 * The Hessian is defined as the matrix [[d^2 B / du^2, d^2 B / dudv], [d^2 B / dvdu, d^2 B / dv^2]].
 * To simplify deconstructing the array, it is returned as a flat array.
 * This is only valid for the bilinearly interpolated patches given by bezierPatch()
 */
export function patchHessian(K: number[][], u: number, v: number) {
  const u2 = u * u
  const v2 = v * v

  const du2 = v * (6 * u * K[3][1] - 12 * u * K[3][2] + 6 * u * K[3][3] + 6 * (1 - u) * K[3][2] - 3 * (2 * u - 2) * K[3][0] + 6 * (2 * u - 2) * K[3][1])
    + (1 - v) * (6 * u * K[0][1] - 12 * u * K[0][2] + 6 * u * K[0][3] + 6 * (1 - u) * K[0][2] - 3 * (2 * u - 2) * K[0][0] + 6 * (2 * u - 2) * K[0][1])
  const dv2 = u * (6 * v * K[1][3] - 12 * v * K[2][3] + 6 * v * K[3][3] + 6 * (1 - v) * K[2][3] - 3 * (2 * v - 2) * K[0][3] + 6 * (2 * v - 2) * K[1][3])
    + (1 - u) * (6 * v * K[1][0] - 12 * v * K[2][0] + 6 * v * K[3][0] + 6 * (1 - v) * K[2][0] - 3 * (2 * v - 2) * K[0][0] + 6 * (2 * v - 2) * K[1][0])
  const dudv = 3 * u2 * K[0][2] - 3 * u2 * K[0][3] - 3 * u2 * K[3][2] + 3 * u2 * K[3][3] - 6 * u * (1 - u) * K[0][2] + 6 * u * (1 - u) * K[3][2] - 3 * u * (2 * u - 2) * K[0][1]
    + 3 * u * (2 * u - 2) * K[3][1] + 3 * v2 * K[2][0] - 3 * v2 * K[2][3] - 3 * v2 * K[3][0] + 3 * v2 * K[3][3] - 6 * v * (1 - v) * K[2][0] + 6 * v * (1 - v) * K[2][3] - 3 * v * (2 * v - 2) * K[1][0]
    + 3 * v * (2 * v - 2) * K[1][3] + 3 * (1 - u) ** 2 * K[0][0] - 3 * (1 - u) ** 2 * K[0][1] - 3 * (1 - u) ** 2 * K[3][0] + 3 * (1 - u) ** 2 * K[3][1] + 3 * (1 - v) ** 2 * K[0][0]
    - 3 * (1 - v) ** 2 * K[0][3] - 3 * (1 - v) ** 2 * K[1][0] + 3 * (1 - v) ** 2 * K[1][3] - K[0][0] + K[0][3] + K[3][0] - K[3][3]
  return [du2, dudv, dudv, dv2]
}

/** Invert a 2x2 matrix. **/
function inv2by2(mat: number[]) {
  const [a, b, c, d] = mat
  const det = a * d - b * c
  return [d / det, -b / det, -c / det, a / det]
}

/** Use Newton's method to find a extrema point on the patch near a given (u, v) coordinate. **/
function localPatchExtrema(K: number[][], u: number, v: number, accuracy = 0.01) {
  let n = 0
  let maxDifference: number
  do {
    const [a, b, c, d] = inv2by2(patchHessian(K, u, v))
    const [up, vp] = patchGradient(K, u, v)
    const uUpdate = up * a + vp * b
    const vUpdate = up * c + vp * d
    maxDifference = Math.max(Math.abs(uUpdate), Math.abs(vUpdate))
    u -= uUpdate
    v -= vUpdate
    if (n++ > 100) throw new Error('Could not converge when finding Bezier patch extrema. Last diff=' + maxDifference)
  } while (maxDifference > accuracy)
  return [u, v]
}

/** Return the minimu point on a patch, when looking at it by a certain vector. */
export function patchMinAlongVector(p: Patch, vec: Vector) {
  const K = p.map(pi => pi.map(k => k.dot(vec)))
  // Try to find extrema on the corners and on the edges
  const ts = [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
    ...bezierExtrema([K[0][0], K[0][1], K[0][2], K[0][3]]).map(u => [u, 0]),
    ...bezierExtrema([K[3][0], K[3][1], K[3][2], K[3][3]]).map(u => [u, 1]),
    ...bezierExtrema([K[0][0], K[1][0], K[2][0], K[3][0]]).map(v => [0, v]),
    ...bezierExtrema([K[0][3], K[1][3], K[2][3], K[3][3]]).map(v => [1, v]),
  ]
  // Try to find an extrema in the middle
  // FIXME: There very rarely happens to be a minimum on the surface.
  // try {
  //     const [u, v] = localPatchExtrema(K, 0.5, 0.5)
  //     if (u >= 0 && v >= 0 && u <= 1 && v <= 1)
  //         ts.push([u, v])
  // } catch (e) {
  //     console.warn(e)
  // }
  return Math.min(...ts.map(([u, v]) => evalPatch(K, u, v)))
}

/** Returns 2 tangent vectors of a bezier surface at (u, 1).
 * The first is tangent with u varying, and the second is with v varying.
 */
function bezierTangentAtZ1(p: Patch, u: number) {
  return [
    new Vector().addScaledVector(p[0][3], -3 * u ** 2 + 6 * u - 3)
      .addScaledVector(p[1][3], 9 * u ** 2 - 12 * u + 3)
      .addScaledVector(p[2][3], -9 * u ** 2 + 6 * u)
      .addScaledVector(p[3][3], 3 * u ** 2),
    new Vector().addScaledVector(p[0][2], 3 * u ** 3 - 9 * u ** 2 + 9 * u - 3)
      .addScaledVector(p[0][3], -3 * u ** 3 + 9 * u ** 2 - 9 * u + 3)
      .addScaledVector(p[1][2], -9 * u ** 3 + 18 * u ** 2 - 9 * u)
      .addScaledVector(p[1][3], 9 * u ** 3 - 18 * u ** 2 + 9 * u)
      .addScaledVector(p[2][2], 9 * u ** 3 - 9 * u ** 2)
      .addScaledVector(p[2][3], -9 * u ** 3 + 9 * u ** 2)
      .addScaledVector(p[3][2], -3 * u ** 3)
      .addScaledVector(p[3][3], 3 * u ** 3),
  ]
}

export interface Line {
  a: Trsf
  b: Trsf
  aNRoundNext: boolean
  aNRoundPrev: boolean
  bNRoundNext: boolean
  bNRoundPrev: boolean
  curve: Curve
  wall: WallCriticalPoints
}

function interpolate(a: Trsf, b: Trsf, t: number) {
  return a.cleared().translate(
    a.origin().multiplyScalar(1 - t).addScaledVector(b.origin(), t).xyz(),
  )
}

export function splitSpline(c: Curve, t: number): [Curve, Curve] {
  const c01 = interpolate(c[0], c[1], t)
  const c12 = interpolate(c[1], c[2], t)
  const c23 = interpolate(c[2], c[3], t)
  const c012 = interpolate(c01, c12, t)
  const c123 = interpolate(c12, c23, t)
  const c0123 = interpolate(c012, c123, t)
  return [[c[0], c01, c012, c0123], [c0123, c123, c23, c[3]]]
}

export function splineApproxLen(curves: Curve[]) {
  return sum(curves.map(c => c[0].origin().distanceTo(c[3].origin())))
}

export function splitSplinesByApproxLen(curves: Curve[], curves2: Curve[], length: number): [Curve[], Curve[], Curve[], Curve[]] {
  let len = 0
  for (let i = 0; i < curves.length; i++) {
    const lineLen = curves[i][0].origin().distanceTo(curves[i][3].origin())
    if (len + lineLen >= length) {
      const [before, after] = splitSpline(curves[i], (length - len) / lineLen)
      const [before2, after2] = splitSpline(curves2[i], (length - len) / lineLen)
      return [
        curves.slice(0, i).concat([before]),
        [after].concat(curves.slice(i + 1)),
        curves2.slice(0, i).concat([before2]),
        [after2].concat(curves2.slice(i + 1)),
      ]
    }
    len += lineLen
  }
  return [curves, [], curves2, []]
}
export function splitSplinesByApproxLenThrice(curves: Curve[], curves2: Curve[], lengthA: number, lengthB: number): [Curve[], Curve[]] {
  const [first, second, first2, second2] = splitSplinesByApproxLen(curves, curves2, lengthA)
  const [third, _, third2, _2] = splitSplinesByApproxLen([...second, ...first], [...second2, ...first2], lengthB - lengthA)
  return [third, third2]
}

export function lineToCurve(a: Trsf, b: Trsf) {
  return [a, interpolate(a, b, 1 / 3), interpolate(a, b, 2 / 3), b] as Curve
}

export function loftCurves(a: Curve, b: Curve) {
  return bezierPatch(
    a,
    lineToCurve(a[3], b[3]),
    [b[3], b[2], b[1], b[0]],
    lineToCurve(b[0], a[0]),
  )
}

export function makeLine(a: Trsf, b: Trsf, wall: WallCriticalPoints, aNRoundPrev = false, aNRoundNext = false, bNRoundPrev = false, bNRoundNext = false): Line {
  return { a, b, aNRoundNext, aNRoundPrev, bNRoundNext, bNRoundPrev, curve: lineToCurve(a, b), wall }
}

export function wallSurfacesOuter(c: Cuttleform, wall: WallCriticalPoints) {
  if (c.rounded.top) return wallSurfacesOuterRoundedTop(c, wall)
  const ti = wall.ti
  const to = wall.to
  const mo = wall.mo
  const bo = wall.bo

  return [
    makeLine(ti, to, wall, wall.nRoundNext, wall.nRoundPrev, false, false),
    makeLine(to, mo, wall),
    makeLine(mo, bo, wall),
  ]
}

export function wallSurfacesInner(c: Cuttleform, wall: WallCriticalPoints) {
  if (c.rounded.top) return wallSurfacesInnerRoundedTop(c, wall)
  const ti = wall.ti
  const bo = wall.bo
  const bi = wall.bi
  const mi = wall.mi
  const ki = wall.ki

  return [
    makeLine(bo, bi, wall),
    makeLine(bi, mi, wall),
    makeLine(mi, ki, wall, false, false, wall.nRoundNext, wall.nRoundPrev),
    makeLine(ki, ti, wall, wall.nRoundNext, wall.nRoundPrev, wall.nRoundNext, wall.nRoundPrev),
  ]
}

export function wallSurfaces(c: Cuttleform, wall: WallCriticalPoints) {
  if (!('si' in wall && wall.si)) { // the wall is not shrouded
    return [...wallSurfacesOuter(c, wall), ...wallSurfacesInner(c, wall)]
  }

  // Accomplish wall shrouding by first moving out DX from the keyboard,
  // Then move up DY, then move over to to, which has been moved up DY.
  // const w = { ...wall, to: wall.to.pretranslated(0, 0, DY) }
  const w = wall
  const inner1 = makeLine(w.ti, w.si!, wall, wall.nRoundNext, wall.nRoundPrev, false, false)
  const inner2 = makeLine(w.si!, w.sm!, wall)
  const inner3 = makeLine(w.sm!, w.to, wall)
  const outer = wallSurfacesOuter(c, w)
  return [inner1, inner2, inner3, ...outer.slice(1), ...wallSurfacesInner(c, w)]
}

export function wallCurve(conf: Cuttleform, a: Trsf, b: Trsf, c: Trsf, d: Trsf, wb: WallCriticalPoints, wc: WallCriticalPoints, worldZ: Vector, bottomZ: number) {
  if (conf.rounded.side) return wallCurveRounded(conf, a, b, c, d, wb, wc, worldZ, bottomZ)
  return lineToCurve(b, c)
}

function wallCurve2(conf: Cuttleform, a: Trsf, b: Trsf, c: Trsf, d: Trsf, wb: WallCriticalPoints, wc: WallCriticalPoints, x: boolean, y: boolean, worldZ: Vector, bottomZ: number) {
  if (x != y) throw new Error('expected round prev to match next')
  if (x) {
    return lineToCurve(b, c)
  }
  return wallCurve(conf, a, b, c, d, wb, wc, worldZ, bottomZ)
}

function joinedWall(conf: Cuttleform, prev: Line[], surf: Line[], next: Line[], nextnext: Line[], worldZ: Vector, bottomZ: number) {
  let lastBottom = wallCurve2(conf, prev[0].a, surf[0].a, next[0].a, nextnext[0].a, surf[0].wall, next[0].wall, surf[0].aNRoundNext, next[0].aNRoundPrev, worldZ, bottomZ)
  return surf.map((line, j) => {
    const left = surf[j].curve
    const right = next[j].curve
    // lastRight[j] = right
    const top = lastBottom
    const bottom = wallCurve2(conf, prev[j].b, line.b, next[j].b, nextnext[j].b, line.wall, next[j].wall, surf[j].bNRoundNext, next[j].bNRoundPrev, worldZ, bottomZ)
    lastBottom = bottom
    return bezierPatch(bottom, right, top, left)
  })
}

export function joinWalls(conf: Cuttleform, surfaces: Line[][], worldZ: Vector, bottomZ: number) {
  // The walls stack in a grid. They all get combined!
  return surfaces.flatMap((surf, i) => {
    const next = surfaces[(i + 1) % surfaces.length]
    const nextnext = surfaces[(i + 2) % surfaces.length]
    const prev = surfaces[(i - 1 + surfaces.length) % surfaces.length]
    return joinedWall(conf, nextnext, next, surf, prev, worldZ, bottomZ)
  })
}

export interface ComponentBox {
  origin: Trsf
  points: Vector[]
}

export interface ComponentMultiBox {
  origin: Trsf
  points: Vector[][]
  direction: Vector
}

export interface ComponentPoint {
  included: boolean
  pos: Trsf
  direction: Vector
}

export function multiBoxToBoxes(b: ComponentMultiBox) {
  return b.points.map(p => ({
    origin: b.origin,
    points: p,
  }))
}

export function bottomComponentBoxes(c: Cuttleform, geo: Geometry): ComponentMultiBox[] {
  const screwDims = screwInsertDimensions(c)
  const boxes: ComponentMultiBox[] = geo.screwIndices.map((screwIdx, i) => {
    const position = geo.screwPositions[i]
    const walls = geo.allWallCriticalPoints()
    const wall = walls[Math.floor(screwIdx)]
    const wallNext = walls[(Math.floor(screwIdx) + 1) % walls.length]
    const down = wall.bi.origin().sub(wall.mi.origin()).normalize().lerp(wallNext.bi.origin().sub(wallNext.mi.origin()).normalize(), screwIdx - Math.floor(screwIdx))
    const pos = position.origin().addScaledVector(down, -screwDims.height)
    const x = position.axis(1, 0, 0)
    x.addScaledVector(down, -down.dot(x))
    return {
      origin: new Trsf().coordSystemChange(pos, x, down),
      points: [[
        new Vector(screwDims.outerTopRadius, screwDims.outerTopRadius, 0),
        new Vector(screwDims.outerTopRadius, -screwDims.outerTopRadius, 0),
        new Vector(-screwDims.outerTopRadius, -screwDims.outerTopRadius, 0),
        new Vector(-screwDims.outerTopRadius, screwDims.outerTopRadius, 0),
      ]],
      direction: down,
    }
  })
  boxes.length = 0
  const connOrigin = geo.connectorOrigin
  if (c.microcontroller && connOrigin) {
    const origin = new Trsf().coordSystemChange(connOrigin.origin(), connOrigin.axis(-1, 0, 0), connOrigin.axis(0, 0, -1))
    const floorConnIndex = Math.floor(geo.connectorIndex)
    const walls = geo.allWallCriticalPoints()
    const direction = walls[floorConnIndex].bi.origin().sub(walls[floorConnIndex].mi.origin())
    boxes.push({
      origin,
      direction,
      points: boardElements(c, false).map(e => {
        const offset = e.offset.clone().negate()
        offset.z -= e.boundingBoxZ
        return [
          new Vector(e.size.x / 2, 0, 0).add(offset),
          new Vector(e.size.x / 2, -e.size.y, 0).add(offset),
          new Vector(-e.size.x / 2, -e.size.y, 0).add(offset),
          new Vector(-e.size.x / 2, 0, 0).add(offset),
        ]
      }),
    })
  }
  return boxes
}

export function topComponentBoxes(c: Cuttleform, keyholes: Trsf[]): ComponentBox[] {
  const holePts = keyholes.map((trsf, i) => {
    const points = keyCriticalPoints(c, c.keys[i], new Trsf()).map(t => t.origin())
    const origin = trsf.pretranslated(0, 0, -webThickness(c, c.keys[i]))
    return { origin, points }
  })
  const swPoints = keyholes.flatMap((trsf, i) => {
    const boxes = partBottom(c.keys[i].type)
    return boxes.map(box => ({ origin: trsf, points: box.map(p => new Vector(...p)) }))
  })
  return holePts.concat(swPoints)
}

export function componentBoxes(c: Cuttleform, geo: Geometry): ComponentBox[] {
  // bottomComponentBoxes(c, geo).flatMap(b => b.points.map(p => ({ origin: b.origin, points: p })))
  const ucBoxes = geo.connectorOrigin ? multiBoxToBoxes(microcontrollerBottomBox(c, geo.connectorOrigin, geo.boardPositions, null as any)) : []
  return ucBoxes.concat(topComponentBoxes(c, geo.keyHolesTrsfs)) // .concat(stiltsComponentBoxes(c, geo.keyHolesTrsfs))
}

export function componentGeometry(box: ComponentBox) {
  const shape = new Shape()
  shape.moveTo(box.points[0].x, box.points[0].y)
  for (let i = 0; i < box.points.length; i++) {
    shape.lineTo(box.points[i].x, box.points[i].y)
  }
  const geo = new ExtrudeGeometry(shape, { depth: 10 })
  geo.applyMatrix4(box.origin.pretranslated(0, 0, box.points[0].z).Matrix4())
  return geo
}

// https://stackoverflow.com/a/1968345
function lineIntersection(p0: Vector, p1: Vector, p2: Vector, p3: Vector): Vector | null {
  const s1_x = p1.x - p0.x
  const s1_y = p1.y - p0.y
  const s2_x = p3.x - p2.x
  const s2_y = p3.y - p2.y

  const s = (-s1_y * (p0.x - p2.x) + s1_x * (p0.y - p2.y)) / (-s2_x * s1_y + s1_x * s2_y)
  const t = (s2_x * (p0.y - p2.y) - s2_y * (p0.x - p2.x)) / (-s2_x * s1_y + s1_x * s2_y)

  if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
    return p0.clone().lerp(p1, t)
  }

  return null
}

function* boxIntersections(onto: ComponentMultiBox, test: ComponentBox) {
  // Project the box of test onto the plane of onto.
  // Then find all intersections!
  const map = onto.origin.inverted().multiply(test.origin)
  for (let i = 0; i < test.points.length; i++) {
    const p0 = map.apply(test.points[i])
    const p1 = map.apply(test.points[(i + 1) % test.points.length])
    for (const box of onto.points) {
      for (let j = 0; j < box.length; j++) {
        // Because of the transformations, the box points are in the same space as the mapped test points
        const p2 = box[j]
        const p3 = box[(j + 1) % box.length]
        const intersection = lineIntersection(p0, p1, p2, p3)
        // Only return the intersection if it lies above the box point's Z plane
        if (intersection && intersection.z > box[j].z) {
          // console.log(test.origin.apply(test.points[i]), test.origin.apply(test.points[(i+1) % test.points.length]), onto.origin.apply(p2), onto.origin.apply(p3))
          // console.log('intersection', p0, p1, p2, p3, intersection, test.letter)
          intersection.z -= box[j].z
          yield intersection
        }
      }
    }
  }

  // Now check for full intersection
  const projPoints = test.points.map(p => map.apply(p).xyz())
  const z = Math.max(...projPoints.map(p => p[2]))
  for (const box of onto.points) {
    if (z > box[0].z) {
      const boxPts = box.map(b => b.xyz())
      if (projPoints.every(p => intersectPtPoly(p, boxPts))) {
        yield new Vector(0, 0, z)
      }
    }
  }
}

/** Move one set of boxes until they no longer intersect a second set of boxes. */
export function moveBoxes(boxes: ComponentMultiBox[], test: ComponentBox[], refiner?: (v: Trsf) => Trsf) {
  let converged: boolean
  let iterations = 0
  do {
    converged = true
    for (const box of boxes) {
      let maxZ = 0
      for (const otherBox of test) {
        for (const intersection of boxIntersections(box, otherBox)) {
          if (intersection.z > maxZ) maxZ = intersection.z
        }
      }
      if (maxZ > 1e-6) {
        converged = false

        // Add 0.1 to help it converge faster
        const scale = box.origin.axis(0, 0, 1).dot(box.direction)
        box.origin.translate(new Vector().addScaledVector(box.direction, maxZ * scale + 0.1).xyz())
        if (refiner) box.origin = refiner(box.origin)
      }
    }
    iterations++
    if (iterations == 100) throw new Error('Failed to converge when performing collision avoidance')
  } while (!converged)
}

/** Move a point until it no longer intersects a set of boxes. */
export function movePointBox(point: ComponentPoint, test: ComponentBox[]) {
  let converged: boolean
  let iterations = 0
  do {
    converged = true
    let maxZ = 0
    for (const otherBox of test) {
      const transformed = otherBox.origin.inverted().apply(point.pos.origin())
      const z = transformed.z - otherBox.points[0].z
      if (z > maxZ && intersectPtPoly(transformed.xyz(), otherBox.points.map(p => p.xyz()))) {
        const scale = -otherBox.origin.axis(0, 0, 1).dot(point.direction)
        if (z > maxZ) maxZ = z * scale
      }
    }
    if (maxZ > 2) {
      point.included = false
    } else if (maxZ > 1e-6) {
      converged = false
      // Add 0.1 to help it converge faster
      point.pos.translate(new Vector().addScaledVector(point.direction, maxZ + 0.1).xyz())
    }
    iterations++
    if (iterations == 100) throw new Error('Failed to converge when performing point collision avoidance')
  } while (!converged)
}

export function microControllerRectangles(c: Cuttleform, connOrigin: Trsf, boardPosWorld: Record<string, Trsf>): [number, number, number, number][] {
  const connOriginInv = connOrigin.inverted()
  const boardPos = mapObj(boardPosWorld, t => t.premultiplied(connOriginInv))

  const hBounds = localHolderBounds(c, false)
  const rects: [number, number, number, number][] = [
    [hBounds.minx, hBounds.maxx, Math.min(hBounds.miny, boardPos.bottomLeft.origin().y), hBounds.maxy],
  ]
  const outerRadius = holderOuterRadius(c)

  if (boardPos.topLeft) {
    rects.push([
      boardPos.topLeft.origin().x - outerRadius,
      hBounds.maxx,
      Math.min(boardPos.topLeft.origin().y - outerRadius, hBounds.maxy),
      boardPos.topLeft.origin().y + outerRadius,
    ])
  }

  if (boardPos.topRight) {
    rects.push([
      hBounds.minx,
      boardPos.topRight.origin().x + outerRadius,
      Math.min(boardPos.topRight.origin().y - outerRadius, hBounds.maxy),
      boardPos.topRight.origin().y + outerRadius,
    ])
  }

  if (boardPos.bottomLeft) {
    rects.push([
      boardPos.bottomLeft.origin().x - outerRadius,
      hBounds.maxx,
      boardPos.bottomLeft.origin().y - outerRadius,
      Math.max(boardPos.bottomLeft.origin().y + outerRadius, hBounds.miny),
    ])
  }

  return rects
}

export function microcontrollerBottomBox(c: Cuttleform, connOrigin: Trsf, boardPositions: Record<string, Trsf>, direction: Vector) {
  let origin = connOrigin
  const boardElems = boardElements(c, false)

  const ucPoints = microControllerRectangles(c, connOrigin, boardPositions).map(([minX, maxX, minY, maxY], i) => {
    const offsetZ = -BOARD_TOLERANCE_Z // some extra margin between bottom + board holder
    const offsetY = i == 0 ? 50 : 0
    return [
      new Vector(minX, minY, offsetZ),
      new Vector(maxX, minY, offsetZ),
      new Vector(maxX, maxY + offsetY, offsetZ),
      new Vector(minX, maxY + offsetY, offsetZ),
    ]
  })
  const originInv = origin.inverted()
  const screwDims = screwInsertDimensions(c)
  const holderPoints = Object.values(boardPositions).map((pos) => {
    const p = originInv.apply(pos.origin())
    const offsetZ = -holderThickness(boardElems)
    const radius = screwDims.outerTopRadius
    return [
      new Vector(radius, radius, offsetZ),
      new Vector(radius, -radius, offsetZ),
      new Vector(-radius, -radius, offsetZ),
      new Vector(-radius, radius, offsetZ),
    ].map(v => v.add(p))
  })
  return {
    origin,
    direction,
    points: ucPoints.concat(holderPoints),
  }
}

export function microcontrollerTopBox(c: Cuttleform, connOrigin: Trsf, boardPositions: Record<string, Trsf>, direction: Vector, top = true): ComponentMultiBox {
  if (!top) return microcontrollerBottomBox(c, connOrigin, boardPositions, direction)
  let origin = connOrigin
  if (top) origin = new Trsf().coordSystemChange(connOrigin.origin(), connOrigin.axis(-1, 0, 0), connOrigin.axis(0, 0, -1))
  const boardElems = boardElements(c, false)
  const ucPoints = boardElems.map(e => {
    const offset = e.offset.clone()
    if (top) offset.negate()
    if (top) offset.z -= e.boundingBoxZ
    else offset.z -= holderThickness(boardElems)
    const connMargin = top ? 0 : 50
    return [
      new Vector(e.size.x / 2, connMargin, 0).add(offset),
      new Vector(e.size.x / 2, -e.size.y, 0).add(offset),
      new Vector(-e.size.x / 2, -e.size.y, 0).add(offset),
      new Vector(-e.size.x / 2, connMargin, 0).add(offset),
    ]
  })
  const originInv = origin.inverted()
  const screwDims = screwInsertDimensions(c)
  const holderPoints = Object.values(boardPositions).map((pos) => {
    const p = originInv.apply(pos.origin())
    const offsetZ = top ? -screwDims.height : -holderThickness(boardElems)
    const radius = screwDims.outerTopRadius
    return [
      new Vector(radius, radius, offsetZ),
      new Vector(radius, -radius, offsetZ),
      new Vector(-radius, -radius, offsetZ),
      new Vector(-radius, radius, offsetZ),
    ].map(v => v.add(p))
  })
  return {
    origin,
    direction,
    points: ucPoints.concat(holderPoints),
  }
}

export function triangleMap(triangles: [number, number, number][]) {
  const triangleMap: Record<number, Record<number, { next: number; triangle: [number, number, number] }>> = {}
  triangles.forEach(triangle => {
    const [a, b, c] = triangle
    if (!triangleMap[a]) triangleMap[a] = {}
    if (!triangleMap[b]) triangleMap[b] = {}
    if (!triangleMap[c]) triangleMap[c] = {}
    triangleMap[b][a] = triangleMap[a][b] = { next: c, triangle }
    triangleMap[c][a] = triangleMap[a][c] = { next: b, triangle }
    triangleMap[b][c] = triangleMap[c][b] = { next: a, triangle }
  })
  return triangleMap
}

/** Yield all points that may have minimum or maximum Z coordinates
    when intersecting a circle with the given triangles on the XY plane */
export function* extremaCircleZOnBT(origin: Vector, radius: number, points: Trsf[], triangles: number[][]) {
  for (const [a, b, c] of triangles) {
    const pa = points[a].origin()
    const pb = points[b].origin()
    const pc = points[c].origin()

    for (const intersection of intersectTriCircle(pa, pb, pc, origin, radius)) {
      yield intersection.z
    }

    const u = points[b].origin().sub(pa)
    const v = points[c].origin().sub(pa)
    const normal = u.cross(v).normalize()

    // Solutions to the optimization problem by finding the minimum and maximum z coordinates
    // on the triangle with the constraint that the solution lies on the circle
    const lambda = Math.sqrt(normal.x ** 2 + normal.y ** 2) / (2 * normal.z * radius)
    const z = (lambda: number) => {
      const x = origin.x + normal.x / (2 * lambda * normal.z)
      const y = origin.y + normal.y / (2 * lambda * normal.z)
      return new Vector(x, y, (normal.dot(pa) - normal.x * x - normal.y * y) / normal.z)
    }
    const sol0 = z(lambda)
    const sol1 = z(-lambda)
    if (intersectPtPoly(sol0.xyz(), [pa.xyz(), pb.xyz(), pc.xyz()])) yield sol0.z
    if (intersectPtPoly(sol1.xyz(), [pa.xyz(), pb.xyz(), pc.xyz()])) yield sol1.z
  }
}

export function adjustedStiltsScrewOrigin(walls: WallCriticalPoints[], origin: Vector, radius: number) {
  let converged: boolean
  let iterations = 0
  do {
    converged = true
    walls.forEach((wall, i) => {
      const nextWall = walls[(i + 1) % walls.length]

      const bo = wall.bo.origin()
      const bon = nextWall.bo.origin()

      const intersects = [...intersectLineCircle(bo, bon, origin, radius)]
      if (intersects.length > 0) {
        const normal = new Vector(bo.y - bon.y, bon.x - bo.x, 0).normalize()
        let distance = origin.clone().sub(bo).dot(normal) + radius
        origin.addScaledVector(normal, -distance * 0.5 - 0.1)
        converged = false
        iterations++
      }
    })
    if (iterations == 100) {
      console.warn('Failed to converge when positioning stilts')
      return null
    }
  } while (!converged)
  return origin
}

/** Move keys apart in 2D so that none of them collide. */
export function separateSockets2D(trsfs: Trsf[], criticalPts: CriticalPoints[]): Trsf[] {
  const polys = criticalPts.map(a => a.map(x => new Vector2(...x.xy())))

  for (let i = 0; i < 100; i++) {
    const displacements = new DefaultMap<number, Vector>(() => new Vector())

    // Iterate through all sokets, moving them if they intersect.
    for (let i = 0; i < polys.length; i++) {
      for (let j = i + 1; j < polys.length; j++) {
        if (intersectPolyPoly(polys[i], polys[j])) {
          const displacement = trsfs[i].origin().sub(trsfs[j].origin())
          displacement.z = 0 // ensure only moving in XY
          // Scale the displacement such that it's ~0.5mm at 20mm away and ~5mm at 0mm away, and falls off exponentially
          const newLength = 5 * Math.exp(displacement.length() / -9)
          displacement.normalize().multiplyScalar(newLength)

          displacements.get(i).add(displacement)
          displacements.get(j).addScaledVector(displacement, -1)
        }
      }
    }

    if (displacements.size == 0) {
      // console.log(`Separating sockets took ${i} iterations`)
      return trsfs // No intersections found
    }

    // Apply displacements to both trsfs and critical points
    for (const [i, x] of displacements.entries()) {
      trsfs[i].translate(x, 1)
      for (const p of polys[i]) {
        p.x += x.x
        p.y += x.y
      }
    }
  }

  throw new Error('Could not separate all sockets in 100 iterations')
}

/** Find the local "up" direction on a wall */
export function wallUpDir(c: Cuttleform, wall: WallCriticalPoints) {
  let up = new Vector(0, 0, 1)
  if (c.shell.type == 'stilts' || c.shell.type == 'tilt') up = wall.mo.origin().sub(wall.bo.origin()).normalize()
  if (c.shell.type == 'block') up = new Vector(1, 0, 0)
  return up
}
