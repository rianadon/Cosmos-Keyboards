/**
 * Various intersection-finding algorithms.
 *
 * The general naming convertion is intersect<A><B>, where A and B are two shapes.
 */

import { Vector2 } from 'three/src/math/Vector2.js'
import Trsf, { Vector } from './modeling/transformation'

/** Determine whether two 2D polygons intersect each other. */
export function intersectPolyPoly(a: Vector2[], b: Vector2[]) {
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

// https://stackoverflow.com/a/29915728
export function intersectPtPoly(point: number[], vs: number[][]) {
  if (vs.includes(point)) return true
  // ray-casting algorithm based on
  // https://wrf.ecse.rpi.edu/Research/Short_Notes/pnpoly.html

  var x = point[0], y = point[1]

  var inside = false
  for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    var xi = vs[i][0], yi = vs[i][1]
    var xj = vs[j][0], yj = vs[j][1]

    var intersect = ((yi > y) != (yj > y))
      && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }

  return inside
}

export function* intersectLineCircle(pa: Vector, pb: Vector, porigin: Vector, radius: number) {
  const origin = porigin.clone().sub(pb)
  const a = pa.clone().sub(pb)

  const qa = a.x * origin.x + a.y * origin.y
  const qb = Math.sqrt((a.x * radius) ** 2 + (a.y * radius) ** 2 - (a.x * origin.y - a.y * origin.x) ** 2)
  const qc = a.x ** 2 + a.y ** 2

  for (const solution of [(qa + qb) / qc, (qa - qb) / qc]) {
    if (solution >= 0 && solution <= 1) {
      yield pb.clone().addScaledVector(a, solution)
    }
  }
}

/** Intersection of a 3D line and sphere centered at the origin. */
export function* intersectLineSphereTs(o: Vector, d: Vector, radius: number) {
  const a = d.dot(d)
  const b = 2 * o.dot(d)
  const c = o.dot(o) - radius * radius

  const discriminant = b * b - 4 * a * c
  if (discriminant < 0) return // no intersection

  const sqrtD = Math.sqrt(discriminant)
  const t1 = (-b - sqrtD) / (2 * a)
  const t2 = (-b + sqrtD) / (2 * a)

  yield t1
  yield t2
}

/** Intersection of a 3d line and cylinder (curved surface only) */
export function* intersectLineCylinderTs(pt: Vector, direction: Vector, cylinderA: Vector, cylinderB: Vector, radius: number) {
  const n = new Vector().subVectors(cylinderB, cylinderA)
  const length = n.length()
  n.divideScalar(length)
  const origin = new Vector().subVectors(pt, cylinderA)
  const ptNoAxis = origin.addScaledVector(n, -n.dot(origin))
  const directionNoAxis = direction.clone().addScaledVector(n, -n.dot(direction))
  for (const t of intersectLineSphereTs(ptNoAxis, directionNoAxis, radius)) {
    const intersection = new Vector().subVectors(pt, cylinderA).addScaledVector(direction, t)
    const interN = intersection.dot(n)
    if (interN >= 0 && interN <= length) yield t
  }
}

export function* intersectTriCircle(a: Vector, b: Vector, c: Vector, origin: Vector, radius: number) {
  yield* intersectLineCircle(a, b, origin, radius)
  yield* intersectLineCircle(b, c, origin, radius)
  yield* intersectLineCircle(c, a, origin, radius)
}

export function* intersectPolyCircle(poly: Vector[], origin: Vector, radius: number) {
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length
    yield* intersectLineCircle(poly[i], poly[j], origin, radius)
  }
}

/**
 * Returns the intersection point between a bezier curve
 * and a plane containing both its endpoints, in approximate
 * direction xDir.
 *
 * To simplify the math, I first perform a rotation that fixes
 * the first point at (0, 0, 0) and the second point at (0, 0, 1).
 * The intersection point is when the line crosses the x axis.
 */
export function intersectBezierSamePlane(curve: [Vector, Vector, Vector, Vector], xDir: Vector) {
  const axZ = curve[3].clone().sub(curve[0]).normalize()
  const axX = xDir.clone().addScaledVector(axZ, -xDir.dot(axZ)).normalize()
  if (axX.x == 0 && axX.y == 0 && axX.z == 0) return // If the line is exactly straight

  const rotationMat = new Trsf().coordSystemChange(curve[0], axX, axZ)
  const rotMatInv = rotationMat.inverted()

  const p1 = rotMatInv.apply(curve[1])
  const p2 = rotMatInv.apply(curve[2])
  const p3 = rotMatInv.apply(curve[3])

  let tsol = p1.x / (p1.x - p2.x)
  if (tsol <= 0 || tsol >= 1) return

  const pt = new Vector()
    .addScaledVector(p1, (1 - tsol) ** 2 * tsol)
    .addScaledVector(p2, (1 - tsol) * tsol * tsol)
    .addScaledVector(p3, tsol * tsol * tsol)
  return pt.applyMatrix4(rotationMat.Matrix4())
}

export function intersectBezierTSamePlane(curve: [Trsf, Trsf, Trsf, Trsf], xDir: Vector) {
  return intersectBezierSamePlane([curve[0].origin(), curve[1].origin(), curve[2].origin(), curve[3].origin()], xDir)
}

/** Checks if a point is to the left of a directed edge (from a to b). */
function isLeft(a: Vector, b: Vector, point: Vector): number {
  return (b.x - a.x) * (point.y - a.y) - (point.x - a.x) * (b.y - a.y)
}

/** Determines if a point is inside a polygon using the winding number algorithm. */
export function pointInPolygon(point: Vector, polygon: Vector[]): boolean {
  let windingNumber = 0
  for (let i = 0; i < polygon.length; i++) {
    const curr = polygon[i]
    const next = polygon[(i + 1) % polygon.length]

    if (curr.y <= point.y) {
      if (next.y > point.y && isLeft(curr, next, point) > 0) {
        windingNumber++
      }
    } else {
      if (next.y <= point.y && isLeft(curr, next, point) < 0) {
        windingNumber--
      }
    }
  }
  return windingNumber !== 0
}

/** Returns the point on the line at a given z position */
function lineAtZ(a: Vector, b: Vector, z: number) {
  const direction = b.clone().sub(a)
  const t = (z - a.z) / direction.z
  return direction.multiplyScalar(t).add(a)
}

/**
 * Intersects a triangle with a downwards-facing half-cylinder-space on the z axis.
 * That is, a cylinder extruded infinitely downwards from a circle at the given origin and with given radius.
 *
 * Algorithm is a simplified version of https://www.geometrictools.com/Documentation/IntersectionTriangleCylinder.pdf.
 * I consider 5 cases based on sorting the z coordinates: 3a, 3e, 3d, 4f, and 0b. "Touching" as in 2b and 1b is not counted as an intersection.
 *
 * Cases where the triangle is fully contained within the cylinder or the cylinder is fully contained within the triangle will result in false negative.
 */
export function* intersectTriangleHalfCylinder(a: Vector, b: Vector, c: Vector, origin: Vector, radius: number) {
  const points = [a, b, c].sort((a, b) => a.z - b.z)
  if (points[0].z > origin.z) {
    // Case 0b
    // console.log('0b')
    return
  } else if (points[2].z < origin.z) {
    // Case 3a: Triangle is fuly contained within cylinder
    // console.log('3a')
    yield* intersectTriCircle(points[0], points[1], points[2], origin, radius)
  } else if (points[1].z >= origin.z) {
    // Case 3e / 3d
    // console.log('3e/d')
    const pa = lineAtZ(points[0], points[1], origin.z)
    const pb = lineAtZ(points[0], points[2], origin.z)
    yield* intersectTriCircle(points[0], pa, pb, origin, radius)
  } else {
    // Case 4f
    // console.log('4f')
    const pa = lineAtZ(points[0], points[2], origin.z)
    const pb = lineAtZ(points[1], points[2], origin.z)
    yield* intersectTriCircle(points[0], pa, pb, origin, radius)
  }
}

export function* intersectQuadHalfCylinder(a: Vector, b: Vector, c: Vector, d: Vector, origin: Vector, radius: number) {
  yield* intersectTriangleHalfCylinder(a, b, c, origin, radius)
  yield* intersectTriangleHalfCylinder(a, c, d, origin, radius)
}
