/**
 * Extra functions for refining meshes generated from my modified concaveman.
 */
import type { Cuttleform } from '$lib/worker/config'
import type { WallCriticalPoints } from '$lib/worker/geometry'
/** Check if the walls from wall0-wall1 and wall1-wall2 intersect. */
export declare function doWallsIntersect(c: Cuttleform, wall0: WallCriticalPoints, wall1: WallCriticalPoints, wall2: WallCriticalPoints): boolean
