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

const DESC_MX = '\nAll MX Sockets in Cosmos are compatible with Cherry MX switches and its clones. That includes Gateron switches (with the exception of low profile), Gazzew, Outemu, Akko, etc.'
const DESC_DISPLAY = 'Display your current layer, your keymap, battery information, or whatever you like.'
const DESC_BACKCOMPAT = 'Old models from the Dactyl Generator project. The Cosmos models improve upon these, so do not use these without good reason'

export const PART_INFO: Record<CuttleKey['type'], PartInfo> = {
  'mx-better': {
    partName: 'MX: Direct Solder',
    bomName: 'MX-Compatible Switches',
    category: 'Sockets',
    stepFile: '/src/assets/key-mx-better.step',
    partOverride: MX_PART,
    socketSize: [18, 18, 4.7],
    partBottom: [MX_BOTTOM],
    keycap: 'mx',
    extraBomItems: { ...BOM_DIODE },
    wiredInMatrix: true,
    description: 'The simplest and most compatible switch socket in Cosmos. Use these to if soldering directly to your MX switches, or if you are using SU120, MxLEDBit, or Cyboard PCBs.'
      + DESC_MX,
    icon: 'mx',
    bomIcon: 'switch',
  },
  'mx-pcb-twist': {
    partName: 'MX + Plum Twist PCBs (old version)',
    bomName: 'MX-Compatible Switches',
    category: 'Sockets',
    stepFile: '/src/assets/key-mx-pcb-twist.step',
    partOverride: MX_PART,
    socketSize: [18.7, 18.7, 8],
    partBottom: [box(18.7, 18.7, 9.5)],
    keycap: 'mx',
    extraBomItems: { 'pcb': { item: 'Plum Twist PCBs, 1.6mm Thick', icon: 'pcb', count: 1 } },
    wiredInMatrix: true,
    description: "Don't use this. Or do if you know what you're doing." + DESC_MX,
    icon: 'plum-twist',
    bomIcon: 'switch',
  },
  'mx-pcb-plum': {
    partName: 'MX + Plum Twist PCBs (1.2mm)',
    bomName: () => 'MX-Compatible Switches',
    category: 'Sockets',
    stepFile: '/target/key-mx-pcb-plum.step',
    partOverride: MX_PART,
    singlePartForVariants: true,
    socketSize: () => [18.7, 18.7, 7.6] as PartSize,
    partBottom: () => [box(18.7, 18.7, 9.1)],
    keycap: 'mx',
    extraBomItems: () => ({ 'pcb': { item: 'Plum Twist PCBs, 1.2mm Thick (Standard Size)', icon: 'pcb', count: 1 } }),
    variants: {
      led: ['North LED', 'South LED'],
    },
    encodeVariant: makeEncodeVariant('mx-pcb-plum', { led: 2 }),
    decodeVariant: makeDecodeVariant('mx-pcb-plum', { led: 2 }),
    wiredInMatrix: () => true,
    description:
      'The only PCB here that stays in without glue or screws. These PCBs twist into their socket.\n<a href="https://ryanis.cool/cosmos/plum-twist">Plum Twist PCBs</a> are sold from the <a href="https://cosmos-store.ryanis.cool">Cosmos Store</a> and shipped from the US. They are <a href="https://github.com/rianadon/Cosmos-Keyboard-PCBs">open source</a> too.'
      + DESC_MX,
    soldByCosmos: true,
    icon: 'plum-twist',
    bomIcon: 'switch',
  },
  'mx-skree': {
    partName: 'MX + Skree Flexible PCBs',
    bomName: () => 'MX-Compatible Switches',
    category: 'Sockets',
    stepFile: '/target/key-mx-skree.step',
    partOverride: MX_PART,
    singlePartForVariants: true,
    socketSize: () => [18, 18, 4.7] as PartSize,
    partBottom: () => [box(18.7, 18.7, 7.5)],
    keycap: 'mx',
    extraBomItems: () => ({ 'pcb': { item: 'Skree Flex PCBs', icon: 'pcb', count: 1 / 42 } }),
    variants: {
      led: ['North LED', 'South LED'],
    },
    encodeVariant: makeEncodeVariant('mx-skree', { led: 2 }),
    decodeVariant: makeDecodeVariant('mx-skree', { led: 2 }),
    wiredInMatrix: () => true,
    description:
      'Flex PCBs eliminate needing to carefully solder wires to every switch, saving you hours of time. These PCBs are sold by TheBigSkree, and the socket in Cosmos has alignment guides designed to line up and help hold in the flex PCBs.'
      + DESC_MX,
    icon: 'skree',
    bomIcon: 'switch',
  },
  'mx-pcb': {
    partName: 'MX + Amoeba King PCBs',
    bomName: 'MX-Compatible Switches',
    category: 'Sockets',
    stepFile: '/src/assets/key-mx-pcb.step',
    partOverride: MX_PART,
    socketSize: [19.2, 19.2, 4.7],
    partBottom: [MX_BOTTOM, box(19.4, 19.4, 6.6)],
    keycap: 'mx',
    extraBomItems: {
      'xdiodes-pcb': { item: '1N4148 Diodes (SOD-123)', icon: 'diode', count: 1 },
      'pcb': { item: 'Amoeba King PCBs', icon: 'pcb', count: 1 },
      'pcb-hotswap': { item: 'Kailh Hotswap Sockets', icon: 'hotswap', count: 1 },
      'pcb-led': { item: 'SK6812MINI-E LEDs (Optional)', icon: 'led', count: 1 },
    },
    wiredInMatrix: true,
    icon: 'amoeba-king',
    bomIcon: 'switch',
    description:
      'A socket with alignment guides for the open-source <a href="https://github.com/JKing-B16/keyboard-pcbs/tree/master/amoeba-king">Amoeba King PCB</a>. These only work with the Kings, so make sure you have the right PCBs.\n[warn]I do not recommend buying new Amoebas because there are better options (Skree Flexible PCBs or Plum Twists)'
      + DESC_MX,
  },
  'mx-hotswap': {
    partName: 'MX + 3DP Hotswap',
    bomName: () => 'MX-Compatible Switches',
    category: 'Sockets',
    stepFile: '/target/key-mx-hotswap.step',
    partOverride: MX_PART,
    singlePartForVariants: true,
    socketSize: () => [18, 18, 5.85] as [number, number, number],
    partBottom: () => [box(16.9, 16.8, 8)],
    keycap: 'mx',
    extraBomItems: () => ({ ...BOM_MX_HOTSWAP, ...BOM_DIODE }),
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
    wiredInMatrix: () => true,
    description: 'This socket integrates a 3D-printed diode and hotswap socket holder. Useful if you have a great 3D printer, want hotswap, but cannot buy PCBs.' + DESC_MX,
    icon: 'mx',
    bomIcon: 'switch',
  },
  'mx-klavgen': {
    partName: 'MX + 3DP Klavgen Hotswap',
    bomName: 'MX-Compatible Switches',
    category: 'Sockets',
    stepFile: '/src/assets/key-mx-klavgen.step',
    partOverride: MX_PART,
    socketSize: [18.75, 18.75, 2.2],
    partBottom: [MX_BOTTOM, box(18.55, 18.55, 8)],
    keycap: 'mx',
    extraBomItems: { ...BOM_MX_HOTSWAP, ...BOM_DIODE },
    wiredInMatrix: true,
    description:
      'This socket integrates a 3D-printed diode and hotswap socket holder, but you print the <a href="https://github.com/klavgen/klavgen/blob/main/example_stls/switch_holder.stl">holders</a> separately! This prints more reliably, but your keyboard is going to come in 20 different pieces. Great if you want hotswap but cannot buy PCBs.'
      + DESC_MX,
    icon: 'mx',
    bomIcon: 'switch',
  },
  'alps': {
    partName: 'Alps (and clones): Direct Solder',
    bomName: 'Alps Switches',
    category: 'Sockets',
    stepFile: '/src/assets/key-alps.step',
    partOverride: '/src/assets/switch-alps.glb',
    socketSize: [18.6, 17, 5],
    partBottom: [box(15, 13, 8.6)],
    keycap: 'mx',
    extraBomItems: { ...BOM_DIODE },
    wiredInMatrix: true,
    description:
      "For if you're feeling frisky and want to try something unusual. There are few Alps switches and clones of Alps switches on the market, but if you find some this socket will be waiting for you.\nAs far as I know there are no single-key or flex PCBs for Alps switches, so you'll need to directly solder to them.",
    icon: 'alps',
    bomIcon: 'switch',
  },
  'choc-v1': {
    partName: 'Choc V1: Direct Solder',
    bomName: 'Kailh Choc V1 Switches',
    category: 'Sockets',
    stepFile: '/target/key-choc-v1.step',
    partOverride: CHOC_PART,
    socketSize: [17.5, 16.5, 2.2],
    partBottom: [CHOC_BOTTOM],
    keycap: 'choc',
    extraBomItems: { ...BOM_DIODE },
    wiredInMatrix: true,
    description:
      'For the lowest profile boards! This thin socket supports the thin Kailh Choc switches and gives you a low-to-the-ground keyboard. It is meant to be used if you are soldering directly to your switches.\nYou can tell Choc V1 switches by their special stem design that looks like a pair of eyes.',
    icon: 'choc',
    bomIcon: 'switch',
  },
  'choc-v2': {
    partName: 'Choc V2: Direct Solder',
    bomName: 'Kailh Choc V2 Switches',
    category: 'Sockets',
    stepFile: '/target/key-choc-v2.step',
    partOverride: CHOC_PART,
    socketSize: [18, 18, 2.2],
    partBottom: [CHOC_BOTTOM],
    keycap: 'mx',
    extraBomItems: { ...BOM_DIODE },
    wiredInMatrix: true,
    description:
      "Choc V2 is quite similar to Kailh Choc V1 except for the fact that it uses taller MX-style keycaps instead of the smaller Choc-style keycaps. This socket is dimensionally equivalent to the Choc&nbsp;V1 socket but includes more clearance around the hole. It is meant to be used if you are soldering directly to your switches.\nIf your Choc Switches have the MX '+'-shaped stem, then they're V2.",
    icon: 'choc',
    bomIcon: 'switch',
  },
  'choc-v1-hotswap': {
    partName: 'Choc V1 + 3DP Hotswap',
    bomName: (v: Variant) => `Kailh Choc V1 Switches`,
    category: 'Sockets',
    stepFile: '/target/key-choc-v1-hotswap.step',
    partOverride: CHOC_PART,
    singlePartForVariants: true,
    socketSize: (v: Variant) => [17.5, 16.5, 2.2] as PartSize,
    partBottom: (v: Variant) => [CHOC_BOTTOM, box(17.5, 16.5, 3.3)],
    keycap: 'choc',
    extraBomItems: () => ({ ...BOM_DIODE, ...BOM_CHOC_HOTSWAP }),
    variants: {
      led: ['North LED', 'South LED'],
    },
    encodeVariant: makeEncodeVariant('choc-v1-hotswap', { led: 2 }),
    decodeVariant: makeDecodeVariant('choc-v1-hotswap', { led: 2 }),
    wiredInMatrix: () => true,
    description:
      'For the lowest profile boards! This thin socket supports the thin Kailh Choc switches and gives you a low-to-the-ground keyboard. It also has a nifty 3D-printed mount for hotswap sockets. \nYou can tell Choc V1 switches by their special stem design that looks like a pair of eyes.',
    icon: 'choc',
    bomIcon: 'switch',
  },
  'choc-v2-hotswap': {
    partName: 'Choc V2 + 3DP Hotswap',
    bomName: (v: Variant) => `Kailh Choc V2 Switches`,
    category: 'Sockets',
    stepFile: '/target/key-choc-v2-hotswap.step',
    partOverride: CHOC_PART,
    singlePartForVariants: true,
    socketSize: (v: Variant) => [18, 18, 2.2] as PartSize,
    partBottom: (v: Variant) => [CHOC_BOTTOM, box(18, 18, 3.3)],
    keycap: 'mx',
    extraBomItems: () => ({ ...BOM_DIODE, ...BOM_CHOC_HOTSWAP }),
    variants: {
      led: ['North LED', 'South LED'],
    },
    encodeVariant: makeEncodeVariant('choc-v2-hotswap', { led: 2 }),
    decodeVariant: makeDecodeVariant('choc-v2-hotswap', { led: 2 }),
    wiredInMatrix: () => true,
    description:
      "Choc V2 is quite similar to Kailh Choc V1 except for the fact that it uses taller MX-style keycaps instead of the smaller Choc-style keycaps. This socket is dimensionally equivalent to the Choc&nbsp;V1 socket but includes more clearance around the hole. It also has a 3D-printed mount for Choc hotswap sockets.\nIf your Choc Switches have the MX '+'-shaped stem, then they're V2.",
    icon: 'choc',
    bomIcon: 'switch',
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
    keycap: 'mx',
    pinsNeeded: 0,
    description:
      'Allocates an empty space on the keyboard. Useful filling in gaps and changing the keyboard boundary. <a target="_blank" href="https://ryanis.cool/cosmos/docs/tips-and-tricks/#shaper-keys">Read more in the docs</a>.',
    icon: 'shaper',
  },
  'old-mx': {
    partName: 'Old MX-Compatible',
    bomName: 'MX-Compatible Switches',
    category: 'Backwards-Compatible',
    stepFile: '/target/key-old-mx.step',
    partOverride: MX_PART,
    socketSize: [18, 18, 5],
    partBottom: [MX_BOTTOM],
    keycap: 'mx',
    extraBomItems: { ...BOM_DIODE },
    wiredInMatrix: true,
    description: DESC_BACKCOMPAT,
  },
  'old-mx-snap-in': {
    partName: 'Old MX-Compatible snap-in',
    bomName: 'MX-Compatible Switches',
    category: 'Backwards-Compatible',
    stepFile: '/target/key-old-mxSnapIn.step',
    partOverride: MX_PART,
    socketSize: [18, 18, 5],
    partBottom: [MX_BOTTOM],
    keycap: 'mx',
    extraBomItems: { ...BOM_DIODE },
    wiredInMatrix: true,
    description: DESC_BACKCOMPAT,
  },
  'old-mx-hotswap': {
    partName: 'Old MX-Compatible',
    bomName: 'MX-Compatible Switches',
    category: 'Backwards-Compatible',
    stepFile: '/target/key-old-mx-hotswap.step',
    partOverride: MX_PART,
    socketSize: [18, 18, 5],
    partBottom: [MX_BOTTOM],
    keycap: 'mx',
    extraBomItems: { ...BOM_DIODE, ...BOM_MX_HOTSWAP },
    wiredInMatrix: true,
    description: DESC_BACKCOMPAT,
  },
  'old-mx-snap-in-hotswap': {
    partName: 'Old MX-Compatible Hotswap',
    bomName: 'MX-Compatible Switches',
    category: 'Backwards-Compatible',
    stepFile: '/target/key-old-mxSnapIn-hotswap.step',
    partOverride: MX_PART,
    socketSize: [18, 18, 5],
    partBottom: [MX_BOTTOM],
    keycap: 'mx',
    extraBomItems: { ...BOM_DIODE, ...BOM_MX_HOTSWAP },
    wiredInMatrix: true,
    description: DESC_BACKCOMPAT,
  },
  'old-box': {
    partName: 'Old Kailh Box Switches',
    bomName: 'Kailh Box Switches',
    category: 'Backwards-Compatible',
    stepFile: '/target/key-old-box.step',
    partOverride: MX_PART,
    socketSize: [18, 18, 5],
    partBottom: [MX_BOTTOM],
    keycap: 'mx',
    extraBomItems: { ...BOM_DIODE },
    wiredInMatrix: true,
    description: DESC_BACKCOMPAT,
  },
  'old-choc-hotswap': {
    partName: 'Old Choc (Kailh)',
    bomName: 'Kailh Choc Switches',
    category: 'Backwards-Compatible',
    stepFile: '/target/key-old-choc-hotswap.step',
    partOverride: CHOC_PART,
    socketSize: [18, 18, 5],
    partBottom: [CHOC_BOTTOM],
    keycap: 'mx',
    extraBomItems: { ...BOM_DIODE, ...BOM_CHOC_HOTSWAP },
    wiredInMatrix: true,
    description: DESC_BACKCOMPAT,
  },
  'ec11': {
    partName: 'EC11 Encoder',
    bomName: 'EC11 Encoders',
    category: 'Encoders',
    stepFile: '/src/assets/key-ec11.step',
    socketSize: [14.5, 14.5, 4.5],
    partBottom: [box(12, 12, 14.5)],
    wiredInMatrix: true,
    pinsNeeded: 2,
    icon: 'knob',
    description: 'A vertical knob that you can tie to volume or navigation keys.',
  },
  'evqwgd001': {
    partName: 'EVQWGD001 Encoder',
    bomName: 'EVQWGD001 Encoders',
    category: 'Encoders',
    stepFile: '/src/assets/key-evqwgd001.step',
    partOverride: '/target/switch-evqwgd001.glb',
    socketSize: [19.2, 19.2, 4.7],
    partBottom: [box(16, 16, 5.8)],
    wiredInMatrix: true,
    pinsNeeded: 2,
    icon: 'knob',
    description: 'A horizontal knob that sits low to the keyboard. The part is no longer manufactured, so you will have to find a reseller online.',
  },
  'oled-128x32-0.91in-adafruit': {
    partName: 'Adafruit 128x32 1" I2C OLED',
    bomName: 'Adafruit 128x32 1" Diagonal OLEDs, I2C (Part No. 4440)',
    category: 'Displays',
    stepFile: '/src/assets/key-oled-128x32-0.91in-adafruit.step',
    socketSize: [22.044, 33.22, 5],
    partBottom: [box(22, 33.2, 4.1)],
    pinsNeeded: 2,
    icon: 'oled',
    description: DESC_DISPLAY,
  },
  'oled-128x32-0.91in-spi-adafruit': {
    partName: 'Adafruit 128x32 1" SPI OLED',
    bomName: 'Adafruit 128x32 1" Diagonal OLEDs, SPI (Part No. 661)',
    category: 'Displays',
    stepFile: '/target/key-oled-128x32-0.91in-spi-adafruit.step',
    partOverride: '/target/switch-oled-128x32-0.91in-spi-adafruit.glb',
    socketSize: [23.6, 33.1, 2.5],
    partBottom: [box(22, 33.2, 4.1)],
    pinsNeeded: 4,
    icon: 'oled',
    description: DESC_DISPLAY,
  },
  'oled-128x32-0.91in-dfrobot': {
    partName: 'DFRobot 128x32 0.91" OLED',
    bomName: 'DFRobot 128x32 0.91" Diagonal OLEDs (DFR0647)',
    category: 'Displays',
    stepFile: '/target/key-oled-128x32-0.91in-dfrobot.step',
    partOverride: '/target/switch-oled-128x32-0.91in-dfrobot.glb',
    socketSize: [11.6, 41.18, 2.84],
    partBottom: [box(11.5, 24.4, 4.3)],
    pinsNeeded: 2,
    icon: 'oled',
    description: DESC_DISPLAY,
  },
  'trackball': {
    partName: 'Trackball',
    bomName: (v: Variant) => `${v.size || '25/34/43/55mm'} Trackballs`,
    category: 'Trackballs & Trackpads',
    stepFile: '/target/key-trackball.step',
    partOverride: '/target/switch-trackball.glb',
    socketSize: (v: Variant) => ({
      radius: { '25mm': 16.4, '34mm': 20.9, '43mm': 25.4, '55mm': 31.4 }[v.size as TrackballVariant['size']],
      height: 4,
      sides: 20,
    }),
    partBottom: (v: Variant) => {
      // box = pcb then chip
      const pcbWidth = { 'Joe (QMK)': 28.5, 'Skree (ZMK)': 32 }[v.sensor as TrackballVariant['sensor']]
      const pcbHeight = { 'Joe (QMK)': 21.3, 'Skree (ZMK)': 24 }[v.sensor as TrackballVariant['sensor']]

      if (v.size == '25mm') return [box(pcbWidth, pcbHeight, 23.8), box(16, 11, 26.3)]
      if (v.size == '43mm') return [box(pcbWidth, pcbHeight, 33.0), box(16, 11, 35.6)]
      if (v.size == '55mm') return [box(pcbWidth, pcbHeight, 38.8), box(16, 11, 41.3)]
      return [box(pcbWidth, pcbHeight, 28.3), box(16, 11, 30.8)] // 34mm variant
    },
    variants: {
      size: ['25mm', '34mm', '55mm', '43mm'],
      bearings: ['Roller', 'Ball', 'BTU (7.5mm)', 'BTU (9mm)'],
      sensor: ['Joe (QMK)', 'Skree (ZMK)'],
    },
    encodeVariant: (variant: Variant) => {
      const size = ['34mm', '25mm', '55mm', '43mm'].indexOf(variant.size)
      const bearings = ['Roller', 'Ball', 'BTU (7.5mm)', 'BTU (9mm)'].indexOf(variant.bearings)
      const sensor = ['Joe (QMK)', 'Skree (ZMK)'].indexOf(variant.sensor)
      return size + (bearings << 3) + (sensor << 6)
    },
    decodeVariant: (variant: number) => {
      const size = variant & 0x7
      const bearings = (variant >> 3) & 0x7
      const sensor = (variant >> 6) & 0x3
      return {
        size: ['34mm', '25mm', '55mm', '43mm'][size] || '34mm',
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
        items['trackball-bearing'] = { item: '1/8" diameter (3.175mm) Si3N4/Zr02 Ceramic Ball Bearings', icon: 'trackball', count: 3 }
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
    pinsNeeded(v: Variant) {
      const variant = v as TrackballVariant
      if (variant.sensor == 'Skree (ZMK)') return 4 // 3 for "SPI" + Motion trigger
      return 4 // 4 for proper SPI
    },
    icon: 'trackball',
    description:
      'Move your mouse from your keyboard! Integrating a trackball to your keyboard can help you switch between typing and navigating faster and with less hand movement.\nI personally recommend using ball bearings with trackballs, as they are the most consistent. Roller Bearings and BTUs are more spinny but also more noisy.',
  },
  'trackpad-cirque': {
    partName: 'Cirque Flat Circle Trackpad',
    bomName: (v: Variant) => `Cirque Flat Circle ${v.size || '23/35/40mm'} Trackpads`,
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
    pinsNeeded: () => 4,
    icon: 'knob',
    description: 'A small circular trackpad. These only support a single touch (no multi-touch gestures), but you can still do a lot with them.',
  },
  'joystick-joycon-adafruit': {
    partName: 'Adafruit Mini Thumbstick',
    bomName: 'Adafruit Mini Thumbsticks (Joycon style, #5628)',
    category: 'Joysticks',
    stepFile: '/src/assets/key-joystick-joycon-adafruit.step',
    partOverride: '/target/switch-joystick-joycon-adafruit.glb',
    socketSize: [24.25, 24.4, 3.5],
    partBottom: [box(24.25, 22.4, 3.5)],
    wiredInMatrix: true,
    pinsNeeded: 2,
    icon: 'joystick',
    description: 'A small joystick from Adafruit for gaming or moving the mouse.',
  },
  'joystick-ps2-40x45': {
    partName: 'PS2 Style Joystick Module',
    bomName: 'PS2 Style Joystick Modules',
    category: 'Joysticks',
    stepFile: '/src/assets/key-joystick-ps2-40x45.step',
    partOverride: '/target/switch-joystick-ps2-40x45.glb',
    socketSize: [40, 45, 4],
    partBottom: [box(40, 45, 19.5)],
    wiredInMatrix: true,
    pinsNeeded: 2,
    icon: 'joystick',
    description: 'A large joystick for gaming or moving the mouse. Supports <a href="https://www.amazon.ca/gp/product/B089VXPHDH">this joystock on Amazon</a>.',
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
  wiredInMatrix?: boolean
  pinsNeeded?: number
}
type PartInfoVariant = {
  bomName: (v: Variant) => string
  socketSize: (v: Variant, k: CuttleKey) => PartSize
  partBottom: (v: Variant) => [number, number, number][][]
  variants: Record<string, string[]>
  decodeVariant: (n: number) => Variant
  encodeVariant: (v: Variant) => number
  extraBomItems?: (v: Variant) => Record<string, BomItem>
  wiredInMatrix?: (v: Variant) => boolean
  pinsNeeded?: (v: Variant) => number
}
export type PartInfo = (PartInfoNonVariant | PartInfoVariant) & {
  partName: string
  stepFile: string
  partOverride?: string | null
  singlePartForVariants?: boolean
  category: string
  keycap?: 'choc' | 'mx'
  /** Description used in part selection. */
  description?: string
  /** Icon used in BOM and parts list */
  icon?: string
  /** Override icon used in BOM */
  bomIcon?: string
  soldByCosmos?: boolean
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

function makeEncodeVariant(key: CuttleKey['type'], opts: Record<string, number>) {
  return (v: Variant) => {
    if (!('variants' in PART_INFO[key])) throw new Error(`Part ${key} has no variants`)
    const { variants } = PART_INFO[key]
    let encoded = 0
    let shift = 0
    for (const opt of Object.keys(opts)) {
      encoded |= variants[opt].indexOf(v[opt]) << shift
      shift += opts[opt]
    }
    return encoded
  }
}

function makeDecodeVariant(key: CuttleKey['type'], opts: Record<string, number>) {
  return (encoded: number) => {
    if (!('variants' in PART_INFO[key])) throw new Error(`Part ${key} has no variants`)
    const { variants } = PART_INFO[key]
    const decoded: Variant = {}
    for (const opt of Object.keys(opts)) {
      decoded[opt] = variants[opt][encoded & ((1 << opts[opt]) - 1)] || variants[opt][0]
      encoded >>= opts[opt]
    }
    return decoded
  }
}
