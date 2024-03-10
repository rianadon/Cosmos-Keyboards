import type { Geometry } from '$lib/worker/config'
import { triangleNormTrsf } from '$lib/worker/geometry.thickWebs'
import type Trsf from '$lib/worker/modeling/transformation'

function boundarySplines(boundary: number[]) {
  const connectingSplines: Record<number, Record<number, boolean>> = {}
  for (let i = 0; i < boundary.length; i++) {
    const b1 = (i + 1) % boundary.length
    const b2 = (i + 2) % boundary.length
    connectingSplines[boundary[b1]] = { [boundary[b2]]: true }
  }
  return connectingSplines
}

export function webPolys(geo: Geometry) {
  let { triangles, boundary } = geo.solveTriangularization
  const polygons: number[][][] = []

  // Only add polygons that are facing in the +Y direction
  const addPolygon = (sides: Trsf[]) => {
    const normal = triangleNormTrsf(sides[0], sides[1], sides[2])
    if (normal.y <= 0) polygons.push(sides.map(s => s.xyz()))
  }

  const { topReinf, botReinf } = geo.reinforcedTriangles

  const splines = boundarySplines(boundary)

  // If we encounter a wall on the boundary, use boundary make the wall
  for (let [a, b, c] of triangles) {
    const makeSide = (x: number, y: number) => addPolygon([topReinf.allPts[x], topReinf.allPts[y], botReinf.allPts[y], botReinf.allPts[x]])
    if (splines[b] && splines[b][a]) makeSide(b, a)
    if (splines[c] && splines[c][b]) makeSide(c, b)
    if (splines[a] && splines[a][c]) makeSide(a, c)
  }

  // Add extra walls
  for (const [a, b, other] of topReinf.extraWalls) {
    addPolygon([topReinf.allPts[a], topReinf.allPts[b], botReinf.allPts[other]])
  }
  for (const [a, b, other] of botReinf.extraWalls) {
    addPolygon([botReinf.allPts[b], botReinf.allPts[a], topReinf.allPts[other]])
  }

  return polygons
}

export function polyToD(poly: number[][]) {
  const toStr = (p: number[]) => p[0] + ' ' + (-p[2])
  return 'M' + toStr(poly[0]) + poly.slice(1).map(p => 'L' + toStr(p)).join(' ')
}

/** Returns a CSS transformation matrix for a given Trsf */
export function cssMatrix(t: Trsf) {
  const e = t.Matrix4().elements
  return `matrix(${[e[0], -e[2], -e[8], e[10], e[12], -e[14]].join(' ')})`
}

let n = Date.now()
export function seqid() {
  return (++n).toString(36)
}
