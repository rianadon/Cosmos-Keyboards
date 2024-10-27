import type { CuttleBlankKey, TrackballVariant, TrackpadCirqueVariant } from '$target/cosmosStructs'
import type { CuttleKey } from '../worker/config'

const MX_BOTTOM = box(14, 14, 8.5)
const CHOC_BOTTOM = box(12, 12, 5.2)

// To reduce the number of assets needed, all switch mounts share the same switch models
const MX_PART = '/target/switch-cherry-mx.glb'
const CHOC_PART = '/src/assets/switch-choc.glb'

const BOM_MX_HOTSWAP = { 'pcb-hotswap': { item: 'Kailh Hotswap Sockets', icon: 'hotswap', count: 1 } }
const BOM_CHOC_HOTSWAP = { 'pcb-hotswap': { item: 'Kailh Choc Hotswap Sockets', icon: 'hotswap', count: 1 } }
const BOM_DIODE = { 'xdiodes': { item: '1N4148 Diodes', icon: 'diode', count: 1 } }

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
    extraBomItems: { ...BOM_DIODE },
  },
  'mx-pcb-twist': {
    partName: 'MX-Compat + Plum Twist PCBs (1.6mm)',
    bomName: 'MX-Compatible Switches',
    category: 'Sockets',
    stepFile: '/src/assets/key-mx-pcb-twist.step',
    partOverride: MX_PART,
    socketSize: [18.7, 18.7, 8],
    partBottom: [box(18.7, 18.7, 9.5)],
    keycap: true,
    extraBomItems: { 'pcb': { item: 'Plum Twist PCBs, 1.6mm Thick', icon: 'pcb', count: 1 } },
  },
  'mx-pcb': {
    partName: 'MX-Compatible + Amoeba King PCBs',
    bomName: 'MX-Compatible Switches',
    category: 'Sockets',
    stepFile: '/src/assets/key-mx-pcb.step',
    partOverride: MX_PART,
    socketSize: [19.2, 19.2, 4.7],
    partBottom: [MX_BOTTOM, box(19.4, 19.4, 6.6)],
    keycap: true,
    extraBomItems: {
      'xdiodes-pcb': { item: '1N4148 Diodes (SOD-123)', icon: 'diode', count: 1 },
      'pcb': { item: 'Amoeba King PCBs', icon: 'pcb', count: 1 },
      'pcb-hotswap': { item: 'Kailh Hotswap Sockets', icon: 'hotswap', count: 1 },
      'pcb-led': { item: 'SK6812MINI-E LEDs (Optional)', icon: 'led', count: 1 },
    },
  },
  'mx-hotswap': {
    partName: 'MX-Compatible + 3DP Hotswap',
    bomName: () => 'MX-Compatible Switches',
    category: 'Sockets',
    stepFile: '/target/key-mx-hotswap.step',
    partOverride: MX_PART,
    singlePartForVariants: true,
    socketSize: () => [18, 18, 5.85],
    partBottom: () => [box(16.9, 16.8, 8)],
    keycap: true,
    extraBomItems: { ...BOM_MX_HOTSWAP, ...BOM_DIODE },
    variants: {
      hotswap: ['Kailh', 'Gateron', 'Outemu'],
    },
    encodeVariant: (variant: Variant) => {
      return ['Kailh', 'Gateron', 'Outemu'].indexOf(variant.hotswap)
    },
    decodeVariant: (variant: number) => {
      return {
        hotswap: ['Kailh', 'Gateron', 'Outemu'][variant] || 'Kailh',
      }
    },
  },
  'mx-klavgen': {
    partName: 'MX-Compatible + 3DP Klavgen Hotswap',
    bomName: 'MX-Compatible Switches',
    category: 'Sockets',
    stepFile: '/src/assets/key-mx-klavgen.step',
    partOverride: MX_PART,
    socketSize: [18.75, 18.75, 2.2],
    partBottom: [MX_BOTTOM, box(18.55, 18.55, 8)],
    keycap: true,
    extraBomItems: { ...BOM_MX_HOTSWAP, ...BOM_DIODE },
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
    extraBomItems: { ...BOM_DIODE },
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
    extraBomItems: { ...BOM_DIODE },
  },
  'choc-hotswap': {
    partName: 'Choc (Kailh) + 3DP Hotswap',
    bomName: 'Kailh Choc V1 & V2 Switches',
    category: 'Sockets',
    stepFile: '/src/assets/choc-hotswap.step',
    partOverride: CHOC_PART,
    socketSize: [18, 18, 2.2],
    partBottom: [CHOC_BOTTOM, box(18, 18, 1.2)],
    keycap: true,
    extraBomItems: { ...BOM_DIODE, ...BOM_CHOC_HOTSWAP },
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
    extraBomItems: { ...BOM_DIODE },
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
    extraBomItems: { ...BOM_DIODE },
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
    extraBomItems: { ...BOM_DIODE, ...BOM_MX_HOTSWAP },
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
    extraBomItems: { ...BOM_DIODE, ...BOM_MX_HOTSWAP },
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
    extraBomItems: { ...BOM_DIODE },
  },
  'old-choc-hotswap': {
    partName: 'Old Choc (Kailh)',
    bomName: 'Kailh Choc Switches',
    category: 'Backwards-Compatible',
    stepFile: '/target/key-old-choc-hotswap.step',
    partOverride: CHOC_PART,
    socketSize: [18, 18, 5],
    partBottom: [CHOC_BOTTOM],
    keycap: true,
    extraBomItems: { ...BOM_DIODE, ...BOM_CHOC_HOTSWAP },
  },
    'mx-skree': {
      partName: 'MX Skree Flexible',
      bomName: 'MX-Compatible Switches',
      category: 'Sockets',
      stepFile: '/src/assets/key-mx-skree.step',
      partOverride: MX_PART,
      socketSize: [18, 18, 4.7],
      partBottom: [box(18.7, 18.7,7.5)],
      keycap: true,
      extraBomItems: { ...BOM_DIODE },
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
    partName: 'Adafruit 128x32 1" I2C OLED',
    bomName: 'Adafruit 128x32 1" Diagonal OLEDs, I2C (Part No. 4440)',
    category: 'Displays',
    stepFile: '/src/assets/key-oled-128x32-0.91in-adafruit.step',
    socketSize: [22.044, 33.22, 5],
    partBottom: [box(22, 33.2, 4.1)],
  },
  'oled-128x32-0.91in-spi-adafruit': {
    partName: 'Adafruit 128x32 1" SPI OLED',
    bomName: 'Adafruit 128x32 1" Diagonal OLEDs, SPI (Part No. 661)',
    category: 'Displays',
    stepFile: '/target/key-oled-128x32-0.91in-spi-adafruit.step',
    partOverride: '/target/switch-oled-128x32-0.91in-spi-adafruit.glb',
    socketSize: [23.6, 33.1, 2.5],
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
    bomName: (v: Variant) => `${v.size} Trackballs`,
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
      const pcbWidth = { 'Joe (QMK)': 28.5, 'Skree (ZMK)': 32 }[v.sensor as TrackballVariant['sensor']]
      const pcbHeight = { 'Joe (QMK)': 21.3, 'Skree (ZMK)': 24 }[v.sensor as TrackballVariant['sensor']]

      if (v.size == '25mm') return [box(pcbWidth, pcbHeight, 23.8), box(16, 11, 26.3)]
      if (v.size == '55mm') return [box(pcbWidth, pcbHeight, 38.8), box(16, 11, 41.3)]
      return [box(pcbWidth, pcbHeight, 28.3), box(16, 11, 30.8)] // 34mm variant
    },
    variants: {
      size: ['25mm', '34mm', '55mm'],
      bearings: ['Roller', 'Ball', 'BTU (7.5mm)', 'BTU (9mm)'],
      sensor: ['Joe (QMK)', 'Skree (ZMK)'],
    },
    encodeVariant: (variant: Variant) => {
      const size = ['34mm', '25mm', '55mm'].indexOf(variant.size)
      const bearings = ['Roller', 'Ball', 'BTU (7.5mm)', 'BTU (9mm)'].indexOf(variant.bearings)
      const sensor = ['Joe (QMK)', 'Skree (ZMK)'].indexOf(variant.sensor)
      return size + (bearings << 3) + (sensor << 6)
    },
    decodeVariant: (variant: number) => {
      const size = variant & 0x7
      const bearings = (variant >> 3) & 0x7
      const sensor = (variant >> 6) & 0x3
      return {
        size: ['34mm', '25mm', '55mm'][size] || '34mm',
        bearings: ['Roller', 'Ball', 'BTU (7.5mm)', 'BTU (9mm)'][bearings] || 'Roller',
        sensor: ['Joe (QMK)', 'Skree (ZMK)'][sensor] || 'Joe (QMK)',
      }
    },
    extraBomItems(v: Variant) {
      const variant = v as TrackballVariant
      const btuInfo = 'Use <a class="underline" href="https://www.aliexpress.us/item/3256805224793948.html">these BTUs from AliExpress</a>'
      const joeInfo = 'Supports <a class="underline" href="https://www.tindie.com/products/citizenjoe/pmw3389-motion-sensor/">these PCBs</a> from Tindie'
      const skreeInfo = 'Supports <a class="underline" href="https://skree.us/products/zmk-compatible-pmw3610-board">these PCBs</a> from Skree'
      const items: Record<string, BomItem> = {}
      if (variant.bearings == 'Roller') {
        items['trackball-dowel'] = { item: '3 x 8 mm Dowel Pins', icon: 'trackball', count: 3 }
        items['trackball-bearing'] = { item: '3 x 6 x 2.5 mm Bearings', icon: 'trackball', count: 3 }
      } else if (variant.bearings == 'Ball') {
        items['trackball-bearing'] = { item: '1/8" diameter (3.175mm) Ceramic Ball Bearings', icon: 'trackball', count: 3 }
      } else if (variant.bearings == 'BTU (7.5mm)') {
        items['trackball-bearing'] = { item: '7.5mm diameter BTUs', icon: 'trackball', count: 3, info: btuInfo }
      } else if (variant.bearings == 'BTU (9mm)') {
        items['trackball-bearing'] = { item: '9mm diameter BTUs', icon: 'trackball', count: 3, info: btuInfo }
      }
      if (variant.sensor == 'Joe (QMK)') {
        items['trackball-sensor'] = { item: 'PMW3360 or PMW3389 Sensors', icon: 'trackball', info: joeInfo, count: 1 }
      } else if (variant.sensor == 'Skree (ZMK)') {
        items['trackball-sensor'] = { item: 'PMW3610 Sensor', icon: 'trackball', info: skreeInfo, count: 1 }
      }
      return items
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
export type BomItem = { item: string; icon: string; count: number; info?: string }

type PartInfoNonVariant = {
  bomName: string
  socketSize: PartSize | ((k: CuttleKey) => PartSize)
  partBottom: [number, number, number][][]
  extraBomItems?: Record<string, BomItem>
}
type PartInfoVariant = {
  bomName: (v: Variant) => string
  socketSize: (v: Variant, k: CuttleKey) => PartSize
  partBottom: (v: Variant) => [number, number, number][][]
  variants: Record<string, string[]>
  decodeVariant: (n: number) => Variant
  encodeVariant: (v: Variant) => number
  extraBomItems?: (v: Variant) => Record<string, BomItem>
}
type PartInfo = (PartInfoNonVariant | PartInfoVariant) & {
  partName: string
  stepFile: string
  partOverride?: string | null
  singlePartForVariants?: boolean
  category: string
  keycap?: boolean
  draft?: boolean
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
export function extraBomItems(k: CuttleKey): Record<string, BomItem> {
  const info = PART_INFO[k.type]
  if ('variants' in info) return info.extraBomItems ? info.extraBomItems(k.variant!) : {}
  return info.extraBomItems || {}
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
