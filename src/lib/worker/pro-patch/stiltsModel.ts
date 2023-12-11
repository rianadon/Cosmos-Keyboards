import type { Compound, Solid } from 'replicad'
import type { Cuttleform, Geometry, SpecificCuttleform, StiltsShell } from '../config'
import type { StiltsGeometry } from './stiltsGeo'

export function splitStiltsScrewInserts(_c: SpecificCuttleform<StiltsShell>, _geo: StiltsGeometry, _inserts: Solid[]): Compound {
  throw new Error('Not implemented')
}

export function makeStiltsPlate(_c: Cuttleform, _geo: Geometry, _cut = false): { top: Solid; bottom?: Solid } {
  throw new Error('Not implemented')
}
