import type { Solid } from 'replicad'
import type { Cuttleform, Geometry } from '../config'
import { errorMsg } from './index'

export async function processPlate(_c: Cuttleform, _geo: Geometry, _model: Solid): Promise<Solid> {
  throw new Error(errorMsg)
}
