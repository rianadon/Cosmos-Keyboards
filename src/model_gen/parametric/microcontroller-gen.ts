/** Parametrically Generate Microcontroller Models */
import { BOARD_PROPERTIES } from '$lib/geometry/microcontrollers'
import { makeAsyncCacher } from '$lib/loaders/cacher'
import type { Cuttleform } from '$lib/worker/config'
import { combine } from '$lib/worker/modeling/index'
import { readFile } from 'fs/promises'
import { drawCircle, Drawing, drawRoundedRectangle, importSTEP, Solid } from 'replicad'
import type { Vector3 } from 'three'

export interface Holes {
  /** Offset between edge and first hole center */
  start: number
  /** Offset between edge and last hole center */
  end?: number
  align: {
    side: 'top' | 'left' | 'right' | 'bottom'
    offset: number
  }
  /** Spacing between two hole centers */
  spacing: number
  /** Diameter of each hole */
  diameter: number
}

export interface MicrocontrollerProps {
  /* Fillet of corners */
  fillet: number
  connector: 'usb-c' | 'micro-usb'
  connector_y_offset: number
}

export const DEFAULT_PROPS: MicrocontrollerProps = {
  fillet: 0,
  connector: 'usb-c',
  connector_y_offset: 0,
}

// For loading STEP files and caching them
const cacher = makeAsyncCacher(async (name: string) => {
  const file = await readFile(`src/assets/${name}`)
  return await importSTEP(new Blob([file]))
})
const loadModel = (name: string) => cacher(name, name)

/** Cut a solid with holes specified in the holes interface */
function cutWithHoles(base: Drawing, holes: Holes, size: Vector3) {
  const { side, offset } = holes.align
  const direction = side == 'left' || side == 'right' ? 'y' : 'x'
  const length = size[direction]
  const span = length - holes.start - (holes.end || holes.diameter / 2) + 0.001
  for (let i = 0; i < span / holes.spacing; i++) {
    const circle = drawCircle(holes.diameter / 2)
    const pos = i * holes.spacing + holes.start
    if (side == 'left') {
      base = base.cut(circle.translate(offset - size.x / 2, -pos))
    } else if (side == 'right') {
      base = base.cut(circle.translate(size.x / 2 - offset, -pos))
    } else if (side == 'top') {
      base = base.cut(circle.translate(pos - size.x / 2, -offset))
    } else if (side == 'bottom') {
      base = base.cut(circle.translate(pos - size.x / 2, offset - size.y))
    }
  }
  return base
}

type Microcontroller = Exclude<Cuttleform['microcontroller'], null>
export async function ucModel(name: Microcontroller, opts: MicrocontrollerProps, allHoles: Holes[]): Promise<Solid> {
  const { size } = BOARD_PROPERTIES[name]
  let base = drawRoundedRectangle(size.x, size.y, opts.fillet).translate(0, -size.y / 2)
  for (const holes of allHoles) {
    base = cutWithHoles(base, holes, size)
  }
  const uc = base.sketchOnPlane('XY').extrude(size.z)

  // Add the connector
  let connector = (await loadModel(opts.connector + '.step')).clone()
  connector = connector.translate(0, opts.connector_y_offset, size.z)
  return combine([uc, connector]) as Solid
}
