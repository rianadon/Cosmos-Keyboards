import type { Compound, Solid } from 'replicad'
import type { Cuttleform, Geometry, SpecificCuttleform, StiltsShell } from '../config'
import type { ShapeMesh } from '../modeling/index'
import { errorMsg } from './index'
import type { StiltsGeometry } from './stiltsGeo'

export function splitStiltsScrewInserts(_c: SpecificCuttleform<StiltsShell>, _geo: StiltsGeometry, _inserts: Solid[]): Compound {
  throw new Error(errorMsg)
}

export function makeStiltsPlate(_c: Cuttleform, _geo: Geometry, _cut = false): { top: () => Promise<Solid>; bottom?: () => Promise<Solid> } {
  throw new Error(errorMsg)
}

export function makeStiltsPlateSimpleMesh(_c: Cuttleform, _geo: Geometry, _cut = false): ShapeMesh {
  throw new Error(errorMsg)
}
