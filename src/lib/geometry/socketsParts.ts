import type { CuttleKey } from '$lib/worker/config'
import { Vector } from '$lib/worker/modeling/transformation'

export const PART_NAMES: Record<CuttleKey['type'], string> = {
  'mx-better': 'MX-Compatible Switches',
  'mx-original': 'MX-Compatible Switches',
  'mx-pcb': 'MX-Compatible Switches',
  'mx-snap-in': 'MX-Compatible Switches',
  'mx-hotswap': 'MX-Compatible Switches',
  'mx-snap-in-hotswap': 'MX-Compatible Switches',
  'alps': 'Alps Switches',
  'box': 'Kailh Box Switches',
  'choc': 'Kailh Choc Switches',
  'choc-hotswap': 'Kailh Choc Switches',
  'ec11': 'EC11 Encoders',
  'trackball': '34 mm (1.34") Trackballs',
  'blank': 'Ignore this',
  'oled-128x32-0.91in-adafruit': 'Adafruit 128x32 1" Diagonal OLEDs',
  'cirque-23mm': 'Cirque 23 mm Flat Circle Trackpads',
  'cirque-35mm': 'Cirque 35 mm Flat Circle Trackpads',
  'cirque-40mm': 'Cirque 40 mm Flat Circle Trackpads',
}

export function socketSize(key: CuttleKey): Vector {
  if (key.type == 'blank') return new Vector(18.5, 18.5, 5)
  if (key.type == 'mx-pcb') return new Vector(19.2, 19.2, 4.7)
  if (key.type == 'mx-better') return new Vector(18, 18, 4.7)
  if (key.type == 'choc') return new Vector(18, 18, 2.2)
  if (key.type == 'ec11') return new Vector(14.5, 14.5, 4.5)
  if (key.type == 'oled-128x32-0.91in-adafruit') return new Vector(22.044, 33.22, 5)
  if (key.type == 'alps') return new Vector(18.6, 17, 5)
  if (key.type.startsWith('cirque')) return new Vector(0, 0, 3)
  return new Vector(18, 18, 5)
}

export function partBottom(sw: CuttleKey['type'] | undefined): [number, number, number][][] {
  if (sw == 'mx-pcb') {
    return [box(14, 14, 8.5), box(19.4, 19.4, 6.6)]
  }
  if (sw == 'box' || sw?.startsWith('mx')) {
    return [box(14, 14, 8.5)]
  }
  if (sw == 'choc') {
    return [box(12, 12, 5.2)]
  }
  if (sw == 'alps') {
    return [box(15, 13, 8.6)]
  }
  if (sw == 'trackball') {
    // box = pcb then chip
    return [box(21.3, 28.5, 27), box(11, 16, 29.5)]
  }
  return [box(10, 10, 2)]
}

function box(width: number, length: number, depth: number): [number, number, number][] {
  return [[-width / 2, -length / 2, -depth], [width / 2, -length / 2, -depth], [width / 2, length / 2, -depth], [-width / 2, length / 2, -depth]]
}
