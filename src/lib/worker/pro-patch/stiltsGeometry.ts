import { Cuttleform } from '../config'
import { WallCriticalPoints } from '../geometry'
import { errorMsg } from './index'

export function stiltsScrewOrigin(_c: Cuttleform, _i: number, _walls: WallCriticalPoints[]) {
  throw new Error(errorMsg)
}
