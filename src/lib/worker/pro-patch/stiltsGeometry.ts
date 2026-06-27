import type { Cuttleform } from '../config'
import type { WallCriticalPoints } from '../geometry'
import { errorMsg } from './index'

export function stiltsScrewOrigin(_c: Cuttleform, _i: number, _walls: WallCriticalPoints[]) {
  throw new Error(errorMsg)
}
