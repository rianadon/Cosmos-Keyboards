import type { Cuttleform } from '../config'
import type { WallCriticalPoints } from '../geometry'
import { Vector } from '../modeling/transformation'
import { errorMsg } from './index'

export function stiltsScrewOrigin(_c: Cuttleform, _i: number, _walls: WallCriticalPoints[]): Vector {
  throw new Error(errorMsg)
}
