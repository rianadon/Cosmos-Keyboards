import type { CuttleKey } from '../worker/config'
import { Vector } from '../worker/modeling/transformation'

export const BOM_PART_NAMES: Record<CuttleKey['type'], string> = {
  'mx-better': 'MX-Compatible Switches',
  'old-mx': 'MX-Compatible Switches',
  'mx-pcb': 'MX-Compatible Switches',
  'mx-hotswap': 'MX-Compatible Switches',
  'mx-pcb-twist': 'MX-Compatible Switches',
  'old-mx-snap-in': 'MX-Compatible Switches',
  'old-mx-hotswap': 'MX-Compatible Switches',
  'old-mx-snap-in-hotswap': 'MX-Compatible Switches',
  'alps': 'Alps Switches',
  'old-box': 'Kailh Box Switches',
  'choc': 'Kailh Choc Switches',
  'choc-hotswap': 'Kailh Choc Switches',
  'ec11': 'EC11 Encoders',
  'joystick-joycon-adafruit': 'Adafruit Mini Thumbsticks (Joycon style, #5628)',
  'evqwgd001': 'EVQWGD001 Encoders',
  'trackball': 'Trackballs',
  'blank': 'Ignore this',
  'oled-128x32-0.91in-adafruit': 'Adafruit 128x32 1" Diagonal OLEDs',
  'oled-128x32-0.91in-dfrobot': 'DFRobot 128x32 0.91" Diagonal OLEDs (DFR0647)',
  'trackpad-cirque': 'Cirque Flat Circle Trackpads',
  'joystick-ps2-40x45': 'PS2 style joystick modules',
}

export const PART_NAMES: Record<CuttleKey['type'], string> = {
  'mx-better': 'MX-Compatible (Cherry, Gateron, ...)',
  'old-mx': 'Old MX-Compatible',
  'mx-pcb': 'MX-Compatible PCB (Amoeba King)',
  'mx-hotswap': 'MX-Compatible with 3DP Hotswap',
  'mx-pcb-twist': 'MX-Compatible PCB (Amoeba Twist)',
  'old-mx-snap-in': 'Old MX-Compatible snap-in',
  'old-mx-hotswap': 'Old MX-Compatible',
  'old-mx-snap-in-hotswap': 'Old MX-Compatible Hotswap',
  'alps': 'Alps (and clones)',
  'old-box': 'Old Kailh Box Switches',
  'choc': 'Choc (Kailh)',
  'choc-hotswap': 'Old Choc (Kailh)',
  'ec11': 'EC11 Encoder',
  'joystick-joycon-adafruit': 'Adafruit Mini Thumbstick',
  'evqwgd001': 'EVQWGD001 Encoder',
  'trackball': 'Trackball',
  'blank': 'Blank',
  'oled-128x32-0.91in-adafruit': 'Adafruit 128x32 1" OLED',
  'oled-128x32-0.91in-dfrobot': 'DFRobot 128x32 0.91" OLED',
  'trackpad-cirque': 'Cirque Flat Circle Trackpad',
  'joystick-ps2-40x45': 'PS2 style joystick module',
}

export const PART_CATEGORIES: Record<CuttleKey['type'], string> = {
  'mx-better': 'Sockets',
  'mx-pcb': 'Sockets',
  'mx-hotswap': 'Sockets',
  'mx-pcb-twist': 'Sockets',
  'alps': 'Sockets',
  'choc': 'Sockets',
  'ec11': 'Encoders',
  'joystick-joycon-adafruit': 'Joysticks',
  'evqwgd001': 'Encoders',
  'trackball': 'Trackballs & Trackpads',
  'blank': 'Sockets',
  'oled-128x32-0.91in-adafruit': 'Displays',
  'oled-128x32-0.91in-dfrobot': 'Displays',
  'trackpad-cirque': 'Trackballs & Trackpads',
  'joystick-ps2-40x45': 'Joysticks',
  'old-mx': 'Backwards-Compatible',
  'old-mx-snap-in': 'Backwards-Compatible',
  'old-mx-hotswap': 'Backwards-Compatible',
  'old-mx-snap-in-hotswap': 'Backwards-Compatible',
  'old-box': 'Backwards-Compatible',
  'choc-hotswap': 'Backwards-Compatible',
}

export const SWITCHES: CuttleKey['type'][] = [
  'mx-better',
  'mx-pcb',
  'mx-hotswap',
  'mx-pcb-twist',
  'alps',
  'choc',
]

export function socketSize(key: CuttleKey): Vector {
  if (key.type == 'blank') return new Vector(key.size?.width ?? 18.5, key.size?.height ?? 18.5, 5)
  if (key.type == 'mx-pcb') return new Vector(19.2, 19.2, 4.7)
  if (key.type == 'mx-pcb-twist') return new Vector(18.7, 18.7, 9.52)
  if (key.type == 'mx-better') return new Vector(18, 18, 4.7)
  if (key.type == 'mx-hotswap') return new Vector(18, 18, 5.85)
  if (key.type == 'choc') return new Vector(17.5, 16.5, 2.2)
  if (key.type == 'ec11') return new Vector(14.5, 14.5, 4.5)
  if (key.type == 'joystick-joycon-adafruit') return new Vector(24.25, 24.4, 3.5)
  if (key.type == 'evqwgd001') return new Vector(19.2, 19.2, 4.7)
  if (key.type == 'oled-128x32-0.91in-adafruit') return new Vector(22.044, 33.22, 5)
  if (key.type == 'oled-128x32-0.91in-dfrobot') return new Vector(11.6, 41.18, 2.84)
  if (key.type == 'alps') return new Vector(18.6, 17, 5)
  if (key.type == 'joystick-ps2-40x45') return new Vector(40, 45, 4)
  if (key.type == 'trackball') return new Vector(0, 0, 4)
  if (key.type == 'trackpad-cirque') return new Vector(0, 0, 3)
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
    return [box(28.5, 21.3, 27), box(16, 11, 29.5)]
  }
  if (sw == 'ec11') {
    return [box(12, 12, 14.5)]
  }
  if (sw == 'joystick-joycon-adafruit') {
    return [box(24.25, 22.4, 3.5)]
  }
  if (sw == 'evqwgd001') {
    return [box(16, 16, 5.8)]
  }
  if (sw == 'oled-128x32-0.91in-dfrobot') {
    return [box(11.5, 24.4, 4.3)]
  }
  if (sw == 'joystick-ps2-40x45') {
    return [box(40, 45, 19.5)]
  }
  return [box(10, 10, 2)]
}

function box(width: number, length: number, depth: number): [number, number, number][] {
  return [[-width / 2, -length / 2, -depth], [width / 2, -length / 2, -depth], [width / 2, length / 2, -depth], [-width / 2, length / 2, -depth]]
}

export function variantOptions(type: CuttleKey['type']): Record<string, string[]> {
  if (type == 'trackpad-cirque') {
    return {
      size: ['23mm', '35mm', '40mm'],
    }
  } else if (type == 'trackball') {
    return {
      size: ['25mm', '34mm'],
      bearings: ['Roller', 'Ball'],
      sensor: ['Joe'],
    }
  }
  return {}
}

export function variantURL(key: CuttleKey) {
  if (key.type == 'trackpad-cirque') {
    return '-' + key.variant.size
  } else if (key.type == 'trackball') {
    return ('-' + key.variant.size + '-' + key.variant.bearings + '-' + key.variant.sensor).toLowerCase()
  }
  return ''
}
