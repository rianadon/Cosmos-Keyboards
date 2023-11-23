/** Adapted from the source of mapbox/concaveman.
    Lisenced under the ISC License: https://github.com/mapbox/concaveman/blob/master/LICENSE.

    Modified to take in a delaunay triangularization.
*/
import { type KeyTrsf } from '$lib/worker/geometry'
import type { Vector } from '$lib/worker/modeling/transformation'
import type Trsf from '$lib/worker/modeling/transformation'
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
): {
  boundary: number[]
  triangles: number[][]
}
