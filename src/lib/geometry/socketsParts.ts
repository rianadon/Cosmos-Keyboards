import type { CuttleKey } from '../worker/config'
import { Vector } from '../worker/modeling/transformation'

export const PART_NAMES: Record<CuttleKey['type'], string> = {
  'mx-better': 'MX-Compatible Switches',
  'old-mx': 'MX-Compatible Switches',
  'mx-pcb': 'MX-Compatible Switches',
  'mx-hotswap': 'MX-Compatible Switches',
  'old-mx-snap-in': 'MX-Compatible Switches',
  'old-mx-hotswap': 'MX-Compatible Switches',
  'old-mx-snap-in-hotswap': 'MX-Compatible Switches',
  'alps': 'Alps Switches',
  'old-box': 'Kailh Box Switches',
  'choc': 'Kailh Choc Switches',
  'choc-hotswap': 'Kailh Choc Switches',
  'ec11': 'EC11 Encoders',
  'adafruit-mini-thumbstick': 'Adafruit Mini Thumsticks (#5628)',
  'evqwgd001': 'EVQWGD001 Encoders',
  'trackball': '34 mm (1.34") Trackballs',
  'blank': 'Ignore this',
  'oled-128x32-0.91in-adafruit': 'Adafruit 128x32 1" Diagonal OLEDs',
  'oled-128x32-0.91in-dfrobot': 'DFRobot 128x32 0.91" Diagonal OLEDs (DFR0647)',
  'cirque-23mm': 'Cirque 23 mm Flat Circle Trackpads',
  'cirque-35mm': 'Cirque 35 mm Flat Circle Trackpads',
  'cirque-40mm': 'Cirque 40 mm Flat Circle Trackpads',
}

export const ASYMMETRIC_PARTS: CuttleKey['type'][] = [
  'mx-hotswap',
  'old-mx-hotswap',
  'old-mx-snap-in-hotswap',
]

export function socketSize(key: CuttleKey): Vector {
  if (key.type == 'blank') return new Vector(key.size?.width ?? 18.5, key.size?.height ?? 18.5, 5)
  if (key.type == 'mx-pcb') return new Vector(19.2, 19.2, 4.7)
  if (key.type == 'mx-better') return new Vector(18, 18, 4.7)
  if (key.type == 'mx-hotswap') return new Vector(18, 18, 5.85)
  if (key.type == 'choc') return new Vector(17.5, 16.5, 2.2)
  if (key.type == 'ec11') return new Vector(14.5, 14.5, 4.5)
  if (key.type == 'adafruit-mini-thumbstick') return new Vector(24.25, 24.4, 3.5)
  if (key.type == 'evqwgd001') return new Vector(19.2, 19.2, 4.7)
  if (key.type == 'oled-128x32-0.91in-adafruit') return new Vector(22.044, 33.22, 5)
  if (key.type == 'oled-128x32-0.91in-dfrobot') return new Vector(11.6, 41.18, 2.84)
  if (key.type == 'alps') return new Vector(18.6, 17, 5)
  if (key.type.startsWith('cirque')) return new Vector(0, 0, 3)
  return new Vector(18, 18, 5)
}

export function partBottom(sw: CuttleKey['type'] | undefined): [number, number, number][][] {
  if (sw == 'mx-pcb') {
    return [box(14, 14, 8.5), box(19.4, 19.4, 6.6)]
  }
  if (sw == 'mx-hotswap') {
    return [box(16.9, 16.8, 8)]
  }
  if (sw == 'box' || sw?.startsWith('mx') || sw?.startsWith('old-mx')) {
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
  if (sw == 'ec11') {
    return [box(12, 12, 14.5)]
  }
  if (sw == 'adafruit-mini-thumbstick') {
    return [box(24.25, 22.4, 3.5)]
  }
  if (sw == 'evqwgd001') {
    return [box(16, 16, 5.8)]
  }
  if (sw == 'oled-128x32-0.91in-dfrobot') {
    return [box(11.5, 24.4, 4.3)]
  }
  return [box(10, 10, 2)]
}

function box(width: number, length: number, depth: number): [number, number, number][] {
  return [[-width / 2, -length / 2, -depth], [width / 2, -length / 2, -depth], [width / 2, length / 2, -depth], [-width / 2, length / 2, -depth]]
}
