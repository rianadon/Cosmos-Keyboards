import type { CuttleBlankKey, TrackballVariant, TrackpadCirqueVariant } from '$target/cosmosStructs'
import type { CuttleKey } from '../worker/config'

const MX_BOTTOM = box(14, 14, 8.5)
const CHOC_BOTTOM = box(12, 12, 5.2)

// To reduce the number of assets needed, all switch mounts share the same switch models
const MX_PART = '/target/switch-cherry-mx.glb'
const CHOC_PART = '/src/assets/switch-choc.glb'

export const PART_INFO: Record<CuttleKey['type'], PartInfo> = {
  'mx-better': {
    partName: 'MX-Compatible (Cherry, Gateron, ...)',
    bomName: 'MX-Compatible Switches',
    category: 'Sockets',
    stepFile: '/src/assets/key-mx-better.step',
    partOverride: MX_PART,
    socketSize: [18, 18, 4.7],
    partBottom: [MX_BOTTOM],
    keycap: true,
  },
  'mx-pcb': {
    partName: 'MX-Compatible PCB (Amoeba King)',
    bomName: 'MX-Compatible Switches',
    category: 'Sockets',
    stepFile: '/src/assets/key-mx-pcb.step',
    partOverride: MX_PART,
    socketSize: [19.2, 19.2, 4.7],
    partBottom: [MX_BOTTOM, box(19.4, 19.4, 6.6)],
    keycap: true,
  },
  'mx-hotswap': {
    partName: 'MX-Compatible with 3DP Hotswap',
    bomName: 'MX-Compatible Switches',
    category: 'Sockets',
    stepFile: '/target/key-mx-hotswap.step',
    partOverride: MX_PART,
    socketSize: [18, 18, 5.85],
    partBottom: [box(16.9, 16.8, 8)],
    keycap: true,
  },
  'mx-klavgen': {
    partName: 'MX-Compatible with Klavgen Hotswap',
    bomName: 'MX-Compatible Switches',
    category: 'Sockets',
    stepFile: '/src/assets/key-mx-klavgen.step',
    partOverride: MX_PART,
    socketSize: [18.75, 18.75, 2.2],
    partBottom: [MX_BOTTOM, box(18.55, 18.55, 8)],
    keycap: true,
  },
  'mx-pcb-twist': {
    partName: 'MX-Compatible PCB (EXPERIMENTAL TWISTY)',
    bomName: 'MX-Compatible Switches',
    category: 'Sockets',
    stepFile: '/src/assets/key-mx-pcb-twist.step',
    partOverride: MX_PART,
    socketSize: [18.7, 18.7, 8],
    partBottom: [MX_BOTTOM, box(19.4, 19.4, 6.6)],
    keycap: true,
  },
  'alps': {
    partName: 'Alps (and clones)',
    bomName: 'Alps Switches',
    category: 'Sockets',
    stepFile: '/src/assets/key-alps.step',
    partOverride: '/src/assets/switch-alps.glb',
    socketSize: [18.6, 17, 5],
    partBottom: [box(15, 13, 8.6)],
    keycap: true,
  },
  'choc': {
    partName: 'Choc (Kailh)',
    bomName: 'Kailh Choc Switches',
    category: 'Sockets',
    stepFile: '/src/assets/key-choc.step',
    partOverride: CHOC_PART,
    socketSize: [17.5, 16.5, 2.2],
    partBottom: [CHOC_BOTTOM],
    keycap: true,
  },
  'blank': {
    partName: 'Shaper (Blank key)',
    bomName: 'Ignore this',
    category: 'Sockets',
    // @ts-ignore blank has a custom model
    stepFile: null,
    partOverride: null,
    // @ts-ignore
    socketSize: (k: CuttleBlankKey) => [k.size?.width ?? 18.5, k.size?.height ?? 18.5, 5],
    partBottom: [],
    keycap: true,
  },
  'old-mx': {
    partName: 'Old MX-Compatible',
    bomName: 'MX-Compatible Switches',
    category: 'Backwards-Compatible',
    stepFile: '/target/key-old-mx.step',
    partOverride: MX_PART,
    socketSize: [18, 18, 5],
    partBottom: [MX_BOTTOM],
    keycap: true,
  },
  'old-mx-snap-in': {
    partName: 'Old MX-Compatible snap-in',
    bomName: 'MX-Compatible Switches',
    category: 'Backwards-Compatible',
    stepFile: '/target/key-mxSnapIn.step',
    partOverride: MX_PART,
    socketSize: [18, 18, 5],
    partBottom: [MX_BOTTOM],
    keycap: true,
  },
  'old-mx-hotswap': {
    partName: 'Old MX-Compatible',
    bomName: 'MX-Compatible Switches',
    category: 'Backwards-Compatible',
    stepFile: '/target/key-old-mx-hotswap.step',
    partOverride: MX_PART,
    socketSize: [18, 18, 5],
    partBottom: [MX_BOTTOM],
    keycap: true,
  },
  'old-mx-snap-in-hotswap': {
    partName: 'Old MX-Compatible Hotswap',
    bomName: 'MX-Compatible Switches',
    category: 'Backwards-Compatible',
    stepFile: '/target/key-old-mxSnapIn-hotswap.step',
    partOverride: MX_PART,
    socketSize: [18, 18, 5],
    partBottom: [MX_BOTTOM],
    keycap: true,
  },
  'old-box': {
    partName: 'Old Kailh Box Switches',
    bomName: 'Kailh Box Switches',
    category: 'Backwards-Compatible',
    stepFile: '/target/key-old-box.step',
    partOverride: MX_PART,
    socketSize: [18, 18, 5],
    partBottom: [MX_BOTTOM],
    keycap: true,
  },
  'choc-hotswap': {
    partName: 'Old Choc (Kailh)',
    bomName: 'Kailh Choc Switches',
    category: 'Backwards-Compatible',
    stepFile: '/target/key-choc-hotswap.step',
    partOverride: CHOC_PART,
    socketSize: [18, 18, 5],
    partBottom: [CHOC_BOTTOM],
    keycap: true,
  },
  'ec11': {
    partName: 'EC11 Encoder',
    bomName: 'EC11 Encoders',
    category: 'Encoders',
    stepFile: '/src/assets/key-ec11.step',
    socketSize: [14.5, 14.5, 4.5],
    partBottom: [box(12, 12, 14.5)],
  },
  'evqwgd001': {
    partName: 'EVQWGD001 Encoder',
    bomName: 'EVQWGD001 Encoders',
    category: 'Encoders',
    stepFile: '/src/assets/key-evqwgd001.step',
    partOverride: '/target/switch-evqwgd001.glb',
    socketSize: [19.2, 19.2, 4.7],
    partBottom: [box(16, 16, 5.8)],
  },
  'oled-128x32-0.91in-adafruit': {
    partName: 'Adafruit 128x32 1" OLED',
    bomName: 'Adafruit 128x32 1" Diagonal OLEDs',
    category: 'Displays',
    stepFile: '/src/assets/key-oled-128x32-0.91in-adafruit.step',
    socketSize: [22.044, 33.22, 5],
    partBottom: [box(22, 33.2, 4.1)],
  },
  'oled-128x32-0.91in-dfrobot': {
    partName: 'DFRobot 128x32 0.91" OLED',
    bomName: 'DFRobot 128x32 0.91" Diagonal OLEDs (DFR0647)',
    category: 'Displays',
    stepFile: '/target/key-oled-128x32-0.91in-dfrobot.step',
    partOverride: '/target/switch-oled-128x32-0.91in-dfrobot.glb',
    socketSize: [11.6, 41.18, 2.84],
    partBottom: [box(11.5, 24.4, 4.3)],
  },
  'trackball': {
    partName: 'Trackball',
    bomName: () => 'Trackballs',
    category: 'Trackballs & Trackpads',
    stepFile: '/target/key-trackball.step',
    partOverride: '/target/switch-trackball.glb',
    socketSize: (v: Variant) => ({
      radius: { '25mm': 16.4, '34mm': 20.9, '55mm': 31.4 }[v.size as TrackballVariant['size']],
      height: 4,
      sides: 20,
    }),
    partBottom: (v: Variant) => {
      // box = pcb then chip
      if (v.size == '25mm') return [box(28.5, 21.3, 23.8), box(16, 11, 26.3)]
      if (v.size == '55mm') return [box(28.5, 21.3, 38.8), box(16, 11, 41.3)]
      return [box(28.5, 21.3, 28.3), box(16, 11, 30.8)] // 34mm variant
    },
    variants: {
      size: ['25mm', '34mm', '55mm'],
      bearings: ['Roller', 'Ball', 'BTU (7.5mm)', 'BTU (9mm)'],
      sensor: ['Joe'],
    },
    encodeVariant: (variant: Variant) => {
      const size = ['34mm', '25mm', '55mm'].indexOf(variant.size)
      const bearings = ['Roller', 'Ball', 'BTU (7.5mm)', 'BTU (9mm)'].indexOf(variant.bearings)
      const sensor = ['Joe'].indexOf(variant.sensor)
      return size + (bearings << 3) + (sensor << 6)
    },
    decodeVariant: (variant: number) => {
      const size = variant & 0x7
      const bearings = (variant >> 3) & 0x7
      const sensor = (variant >> 6) & 0x3
      return {
        size: ['34mm', '25mm', '55mm'][size] || '34mm',
        bearings: ['Roller', 'Ball', 'BTU (7.5mm)', 'BTU (9mm)'][bearings] || 'Roller',
        sensor: ['Joe'][sensor] || 'Joe',
      }
    },
  },
  'trackpad-cirque': {
    partName: 'Cirque Flat Circle Trackpad',
    bomName: (v: Variant) => `Cirque Flat Circle ${v.size} Trackpads`,
    category: 'Trackballs & Trackpads',
    stepFile: '/src/assets/key-cirque.step',
    partOverride: '/src/assets/switch-cirque.glb',
    socketSize: (v: Variant) => ({
      radius: { '23mm': 12.4, '35mm': 18.4, '40mm': 20.9 }[v.size as TrackpadCirqueVariant['size']],
      height: 3,
      sides: 20,
    }),
    partBottom: () => [box(10, 10, 2)],
    variants: {
      size: ['23mm', '35mm', '40mm'],
    },
    encodeVariant: (variant: Variant) => {
      return ['23mm', '35mm', '40mm'].indexOf(variant.size)
    },
    decodeVariant: (variant: number) => {
      return {
        size: ['23mm', '35mm', '40mm'][variant] || '23mm',
      }
    },
  },
  'joystick-joycon-adafruit': {
    partName: 'Adafruit Mini Thumbstick',
    bomName: 'Adafruit Mini Thumbsticks (Joycon style, #5628)',
    category: 'Joysticks',
    stepFile: '/src/assets/key-joystick-joycon-adafruit.step',
    partOverride: '/target/switch-joystick-joycon-adafruit.glb',
    socketSize: [24.25, 24.4, 3.5],
    partBottom: [box(24.25, 22.4, 3.5)],
  },
  'joystick-ps2-40x45': {
    partName: 'PS2 style joystick module',
    bomName: 'PS2 style joystick modules',
    category: 'Joysticks',
    stepFile: '/src/assets/key-joystick-ps2-40x45.step',
    partOverride: '/target/switch-joystick-ps2-40x45.glb',
    socketSize: [40, 45, 4],
    partBottom: [box(40, 45, 19.5)],
  },
}

const CATEGORY_SORT = [
  'Sockets',
  'Encoders',
  'Displays',
  'Trackballs & Trackpads',
  'Joysticks',
  'Backwards-Compatible',
]

export const sortedCategories = [...new Set(Object.values(PART_INFO).map((p) => p.category))]
  .sort((a, b) => CATEGORY_SORT.indexOf(a) - CATEGORY_SORT.indexOf(b))

// ------------------------------------------------------------------------------------------------------
// TYPES

type PartSize = [number, number, number] | { radius: number; sides: number; height: number }
type Variant = Record<string, any>

type PartInfoNonVariant = {
  bomName: string
  socketSize: PartSize | ((k: CuttleKey) => PartSize)
  partBottom: [number, number, number][][]
}
type PartInfoVariant = {
  bomName: (v: Variant) => string
  socketSize: (v: Variant, k: CuttleKey) => PartSize
  partBottom: (v: Variant) => [number, number, number][][]
  variants: Record<string, string[]>
  decodeVariant: (n: number) => Variant
  encodeVariant: (v: Variant) => number
}
type PartInfo = (PartInfoNonVariant | PartInfoVariant) & {
  partName: string
  stepFile: string
  partOverride?: string | null
  category: string
  keycap?: boolean
}

// ------------------------------------------------------------------------------------------------------
// OTHER FUNCTIONS

function box(width: number, length: number, depth: number): [number, number, number][] {
  return [[-width / 2, -length / 2, -depth], [width / 2, -length / 2, -depth], [width / 2, length / 2, -depth], [-width / 2, length / 2, -depth]]
}

export function variantURL(key: CuttleKey) {
  const info = PART_INFO[key.type]
  const keyVariant = key.variant as Variant
  if (!keyVariant || !('variants' in info)) return ''
  return '-' + Object.keys(info.variants).map(v =>
    keyVariant[v]
      .replace(/[\(\)]/g, '').replace(/[^\w.]/g, '-')
  ).join('-').toLowerCase()
}

export function socketSize(k: CuttleKey): PartSize {
  const info = PART_INFO[k.type]
  if ('variants' in info) return info.socketSize(k.variant!, k)
  if (typeof info.socketSize == 'function') return info.socketSize(k)
  return info.socketSize
}
export function socketHeight(k: CuttleKey): number {
  const size = socketSize(k)
  return 'height' in size ? size.height : size[2]
}
export function partBottom(k: CuttleKey): [number, number, number][][] {
  const info = PART_INFO[k.type]
  if ('variants' in info) return info.partBottom(k.variant!)
  return info.partBottom
}
export function bomName(k: CuttleKey): string {
  const info = PART_INFO[k.type]
  if ('variants' in info) return info.bomName(k.variant!)
  return info.bomName
}

export function decodeVariant(t: CuttleKey['type'], variant: number) {
  const info = PART_INFO[t]
  if (!('variants' in info)) return {}
  return info.decodeVariant(variant)
}
export function encodeVariant(t: CuttleKey['type'], variant: Variant) {
  const info = PART_INFO[t]
  if (!('variants' in info)) return 0
  return info.encodeVariant(variant)
}

/** [[a, [1,2]], [b, [3, 4]]] -> [{a: 1, b: 3}, {a: 1, b: 4}, {a: 2, b: 3}, {a: 3, b: 4}] */
function permutations(xs: [string, string[]][]): Record<string, string>[] {
  if (!xs.length) return [{}]
  const [key, options] = xs[0]
  return options.flatMap(opt => {
    return permutations(xs.slice(1)).map(vs => ({ ...vs, [key]: opt }))
  })
}

export function allVariants(socket: CuttleKey['type']) {
  const info = PART_INFO[socket]
  const options = 'variants' in info ? info.variants : {}
  return permutations(Object.entries(options))
}

export function variantURLs(socket: CuttleKey['type']) {
  return allVariants(socket).map(p => variantURL({ type: socket, variant: p } as any))
}
