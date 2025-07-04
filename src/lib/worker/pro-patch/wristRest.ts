import type { Solid } from 'replicad'
import type { Cuttleform, Geometry } from '../config'
import { errorMsg } from './index'

export function wristRest(_c: Cuttleform, _geo: Geometry, _wrSide: 'wristRestLeft' | 'wristRestRight'): Solid {
  throw new Error(errorMsg)
}
