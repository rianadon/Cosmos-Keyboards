import { convertToMaybeCustomConnectors, type Cuttleform } from '$lib/worker/config'
import { Vector } from '$lib/worker/modeling/transformation'

import type { ConnectorMaybeCustom, CustomConnector } from '$lib/worker/config.cosmos'
import { PLATE_HEIGHT, screwInsertDimensions } from '$lib/worker/model'
import { closestScrewHeight, SCREWS } from './screws'

const STOPPER_HEIGHT = 2 // Size of stopper used to align board
export const STOPPER_WIDTH = 2
const RAIL_WIDTH = 1.5 // Size of rails to add around the board
const RAIL_RADIUS = 0.75 // How far in the rails stick
const BACKSTOP_HEIGHT = 0.5 // How much extra backstop height to add

const IN = 25.4 // in to mm

export const MICROCONTROLLER_SIZES = ['Small', 'Medium', 'Large'] as const

// Pi Pico Model: https://github.com/ncarandini/KiCad-RP-Pico
// Pro Micro Model: https://grabcad.com/library/arduino-pro-micro-4
// Pro Micro USB-C Model: https://grabcad.com/library/arduino-pro-micro-usb-type-c-1
// Black RP2040 Dimensions: https://99tech.com.au/product/rp2040-yd-n16/
// nrfmicro: use KiCad StepUp from freecad
// seeed studio xiao: https://wiki.seeedstudio.com/XIAO-RP2040/
// Adafruit RP2040 Feather Model: https://github.com/adafruit/Adafruit_CAD_Parts/tree/main/4884%20Feather%20RP2040
// Adafruit KB2040 Kee Boar Model: https://github.com/adafruit/Adafruit_CAD_Parts/tree/main/5302%20KB2040

interface BoardProperties {
  name: string
  extraName?: string
  offset: Vector
  size: Vector
  sizeName: typeof MICROCONTROLLER_SIZES[number]
  boundingBoxZ: number
  holes: Vector[]
  cutouts: { origin: Vector; size: Vector }[]
  /** Amount to carve into the side to create the cutouts for pins */
  sidecutout: number
  /** (optional) to how far in the positive Y direction the side cutout goes. */
  sidecutoutMaxY?: number
  /** Diameter of holes cut into the board holder used to attach the microcontroller. These should be tapped. */
  tappedHoleDiameter?: number
  /** Names of pins each on the sides of the microcontroller.
   * If it could be side OR rear, it's a side pin. */
  sidePins: number
  /** Names of pins on the rear side of the microcontroller (if any).
   * Connectors don't count. */
  rearPins?: number
  /** If the microcontroller has castellated holes. */
  castellated?: boolean
  /** Override height of the backstop. */
  backstopHeight?: number
  /** Only enabled when ?draftuc is added to the url */
  draft?: boolean
  dontCount?: boolean
}

type Microcontroller = Exclude<Cuttleform['microcontroller'], null>

export const BOARD_PROPERTIES: Record<Microcontroller, BoardProperties> = {
  'pi-pico': {
    name: 'Pi Pico',
    offset: new Vector(0, 0, 3.2),
    size: new Vector(21, 51, 1),
    sizeName: 'Large',
    boundingBoxZ: 5,
    holes: [new Vector(-5.7, -2, 0), new Vector(5.7, -2, 0), new Vector(-5.7, -49, 0), new Vector(5.7, -49, 0)],
    cutouts: [
      { origin: new Vector(0, -51 / 2, 0), size: new Vector(6, 23, 0) },
    ],
    sidecutout: 3,
    tappedHoleDiameter: 1.6,
    sidePins: 20,
    rearPins: 3,
    castellated: true,
  },
  'rp2040-black-usb-c-aliexpress': {
    name: 'RP2040 Black Board USB-C (Aliexpress)',
    extraName: '(USB-C) ☆',
    size: new Vector(0.9 * IN, 2.1 * IN, 1.57),
    sizeName: 'Large',
    boundingBoxZ: 5,
    offset: new Vector(0, 0, 1.835),
    holes: [],
    cutouts: [
      { origin: new Vector(0, -2.1 * IN / 2, 0), size: new Vector(6, 23, 0) },
    ],
    sidecutout: 4,
    sidePins: 20,
    rearPins: 4,
  },
  'promicro-usb-c': {
    name: 'Pro Micro - 34.7mm (USB-C)',
    extraName: '(Low Storage) ☆',
    size: new Vector(18.3, 34.7, 1.57),
    sizeName: 'Medium',
    boundingBoxZ: 5,
    offset: new Vector(0, 0, 1.835),
    holes: [],
    cutouts: [],
    sidecutout: 3.1,
    sidePins: 12,
  },
  'promicro-usb-c-long': {
    name: 'Pro Micro - 37mm (USB-C)',
    extraName: '(Low Storage) ☆',
    size: new Vector(18.3, 37, 1.57),
    sizeName: 'Medium',
    boundingBoxZ: 5,
    offset: new Vector(0, 0, 1.835),
    holes: [],
    cutouts: [],
    sidecutout: 3.1,
    sidePins: 12,
  },
  'promicro': {
    name: 'Pro Micro - 33mm',
    extraName: '(Low Storage)',
    size: new Vector(0.7 * IN, 1.3 * IN, 1.57),
    sizeName: 'Medium',
    boundingBoxZ: 5,
    offset: new Vector(0, 0, 1.835),
    holes: [],
    cutouts: [],
    sidecutout: 0.1 * IN,
    sidePins: 12,
  },
  'itsybitsy-adafruit': {
    name: 'Adafruit ItsyBitsy RP2040/M0/M4/32u4',
    size: new Vector(0.7 * IN, 1.4 * IN, 1.57),
    sizeName: 'Medium',
    boundingBoxZ: 5,
    offset: new Vector(0, 0, 2.015),
    holes: [],
    cutouts: [],
    sidecutout: 0.1 * IN,
    sidePins: 14,
    rearPins: 5,
  },
  'itsybitsy-adafruit-nrf52840': {
    name: 'Adafruit ItsyBitsy nRF52840',
    extraName: '(Bluetooth)',
    size: new Vector(0.7 * IN, 1.4 * IN, 1.57),
    sizeName: 'Medium',
    boundingBoxZ: 5,
    offset: new Vector(0, 0, 2.015),
    holes: [],
    cutouts: [],
    sidecutout: 0.1 * IN,
    sidePins: 14,
    rearPins: 5,
  },
  'kb2040-adafruit': {
    name: 'Adafruit KB2040',
    extraName: '(USB-C) ☆',
    size: new Vector(0.7 * IN, 1.3 * IN, 1.57),
    sizeName: 'Medium',
    boundingBoxZ: 5,
    offset: new Vector(0, 0, 1.835),
    holes: [],
    cutouts: [],
    sidecutout: 0.1 * IN,
    sidePins: 13,
    castellated: true,
  },
  'nrfmicro-or-nicenano': {
    name: 'nRFMicro or Nice!Nano',
    extraName: '(USB-C, Bluetooth)',
    size: new Vector(0.71 * IN, 1.31 * IN, 1.57),
    sizeName: 'Medium',
    boundingBoxZ: 5,
    offset: new Vector(0, 0, 3.4),
    holes: [],
    cutouts: [
      { size: new Vector(0.36 * IN, 100, 0), origin: new Vector(0, 50 - 2, 0) },
    ],
    sidecutout: 0.105 * IN,
    sidePins: 13,
  },
  'seeed-studio-xiao': {
    name: 'Seeed Studio Xiao RP2040/SAMD21',
    extraName: '☆',
    size: new Vector(17.5, 21, 1.2),
    sizeName: 'Small',
    boundingBoxZ: 5,
    offset: new Vector(0, 0, 2.2),
    holes: [],
    cutouts: [],
    sidecutout: 2,
    sidePins: 7,
  },
  'seeed-studio-xiao-nrf52840': {
    name: 'Seeed Studio Xiao nRF52840',
    extraName: '(Bluetooth) ☆',
    size: new Vector(17.5, 21, 1.2),
    sizeName: 'Small',
    boundingBoxZ: 5,
    offset: new Vector(0, 0, 2.2),
    holes: [],
    cutouts: [],
    sidecutout: 2,
    sidePins: 7,
  },
  'waveshare-rp2040-zero': {
    name: 'WaveShare RP2040-Zero',
    size: new Vector(18.1, 23.5, 1 + 0.9), // Add extra 0.9mm for the rp2040 chip on underside
    sizeName: 'Small',
    boundingBoxZ: 5,
    offset: new Vector(0, 0, 2.4 - 0.9),
    holes: [],
    cutouts: [],
    sidecutout: 2.1,
    sidePins: 9,
    rearPins: 5,
    castellated: true,
  },
  'weact-studio-ch552t': {
    name: 'WeAct Studio CH552T',
    extraName: '(Low Storage)',
    size: new Vector(18.288, 25.908, 1.57),
    sizeName: 'Small',
    boundingBoxZ: 5,
    offset: new Vector(0, 0, 1.835),
    holes: [],
    cutouts: [],
    sidecutout: 3.1,
    sidePins: 10,
  },
  'feather-rp2040-adafruit': {
    name: 'Adafruit RP2040 Feather',
    extraName: '(USB-C)',
    size: new Vector(0.9 * IN, 2 * IN, 1.57),
    sizeName: 'Large',
    boundingBoxZ: 0.28 * IN,
    offset: new Vector(0, 0, 1.835),
    tappedHoleDiameter: 0.1 * IN,
    holes: [new Vector(0.35 * IN, -0.1 * IN, 0), new Vector(-0.35 * IN, -0.1 * IN, 0), new Vector(0.35 * IN, -1.9 * IN, 0), new Vector(-0.35 * IN, -1.9 * IN, 0)],
    cutouts: [],
    sidecutout: 0.1 * IN,
    sidePins: 16, // asymmetrical; only 12 on the I2C connector side
    backstopHeight: 0,
  },
  'cyboard-assimilator': {
    name: 'Cyboard Assimilator',
    extraName: '(Flex PCB)',
    size: new Vector(29.9, 31.13, 1.57),
    sizeName: 'Large',
    boundingBoxZ: 5,
    offset: new Vector(0, 0, 5 - 3.21),
    tappedHoleDiameter: 2.5,
    holes: [new Vector(-11.45, -9.09, 0), new Vector(11.45, -9.09, 0)],
    cutouts: [],
    sidecutout: 2,
    sidecutoutMaxY: -13,
    sidePins: 3, // asymmetrical; only 6 on one side
    backstopHeight: 0,
    draft: true,
    dontCount: true,
  },
}

export function sortMicrocontrollers(a: Microcontroller, b: Microcontroller) {
  const score = (m: Microcontroller) => {
    let s = 0
    if (BOARD_PROPERTIES[m].extraName?.includes('☆')) s += 100
    if (BOARD_PROPERTIES[m].extraName?.includes('Low Storage')) s -= 10
    if (BOARD_PROPERTIES[m].extraName?.includes('USB-C')) s += 1
    if (m == 'promicro') return 1 // Pro Micro is still popular
    return s
  }
  return score(b) - score(a)
}

// Use a constant set of board properties for layout so
// that no matter the microcontroller, the connector is
// always placed in the correct spot
// TODO: Only consider boards in same size class.
function boardElementLayout(c: Cuttleform): BoardElement {
  return {
    model: 'layout',
    offset: new Vector(0, 0, 0),
    size: new Vector(
      Math.max(...Object.values(BOARD_PROPERTIES).filter(p => !p.dontCount).map(p => p.size.x)),
      c.microcontroller
        ? BOARD_PROPERTIES[c.microcontroller].size.y
        : Math.min(...Object.values(BOARD_PROPERTIES).filter(p => !p.dontCount).map(p => p.size.y)),
      0,
    ),
    boundingBoxZ: 5,
  }
}

export interface BoardElement {
  model: Connector | Microcontroller | 'box' | 'layout'
  offset: Vector
  size: Vector
  boundingBoxZ: number
  rails?: {
    /** Width of the rails in mm */
    width: number
    /** Include a backstop so the part doesn't slip backwards */
    backstopHeight: number
    /** The nubs that hold in the part */
    clamps: {
      side: 'left' | 'right' | 'back'
      /** Radius of the nub (how far in it sticks) */
      radius: number
    }[]
  }
}

interface BoardOffset {
  connectors: BoardElement[]
}

export type Connector = 'trrs'

export function convertToCustomConnectors(c: Cuttleform, conn: ConnectorMaybeCustom): CustomConnector {
  const flip = c.flipConnectors ? -1 : 1
  if (conn.preset == 'trrs') {
    return {
      width: 6.4,
      height: 6.4,
      radius: 3.2,
      x: flip * (conn.x ?? (c.microcontroller && BOARD_PROPERTIES[c.microcontroller].sizeName == 'Large' ? -16.5 : -14.5)),
      y: 5,
    }
  }
  if (conn.preset == 'usb') {
    return {
      width: { slim: 10.5, average: 12, big: 13 }[conn.size],
      height: { slim: 6.5, average: 7, big: 8 }[conn.size],
      radius: 3,
      x: flip * (conn.x ?? 0),
      y: 5,
    }
  }
  return {
    ...conn,
    x: flip * conn.x,
  }
}

export function boardOffsetInfo(config: Cuttleform): BoardOffset {
  let elements: BoardElement[] = []
  const connectors = convertToMaybeCustomConnectors(config)
  if (connectors.find(c => c.preset == 'trrs')) {
    const connector = connectors.find(c => c.preset == 'trrs')!
    const defaultOffset = config.microcontroller && BOARD_PROPERTIES[config.microcontroller].sizeName == 'Large'
      ? new Vector(-16.5, 0, 2.5) // Extra space for large microcontrollers
      : new Vector(-14.5, 0, 2.5)
    elements.push({
      model: 'trrs',
      offset: typeof connector.x == 'undefined' ? defaultOffset : new Vector(connector.x, 0, 2.5),
      size: new Vector(6.1, 12.2, 5),
      boundingBoxZ: 6,
      rails: {
        width: RAIL_WIDTH,
        backstopHeight: BACKSTOP_HEIGHT,
        clamps: [
          { side: 'left', radius: 0.4 },
          { side: 'right', radius: 0.4 },
          { side: 'back', radius: RAIL_RADIUS * 1.5 },
        ],
      },
    })
  }
  return { connectors: elements }
}

export function boardElements(config: Cuttleform, layout: boolean): BoardElement[] {
  const offset = boardOffsetInfo(config)

  const maybeFlip = (b: BoardElement) => config.flipConnectors ? { ...b, offset: new Vector(-b.offset.x, b.offset.y, b.offset.z) } : b

  if (layout) return [boardElementLayout(config), ...offset.connectors].map(maybeFlip)
  if (!config.microcontroller) return []

  return ([
    {
      model: config.microcontroller,
      offset: BOARD_PROPERTIES[config.microcontroller].offset,
      size: BOARD_PROPERTIES[config.microcontroller].size,
      boundingBoxZ: BOARD_PROPERTIES[config.microcontroller].boundingBoxZ,
      rails: {
        width: RAIL_WIDTH,
        backstopHeight: BOARD_PROPERTIES[config.microcontroller].backstopHeight ?? BACKSTOP_HEIGHT,
        clamps: [
          { side: 'left', radius: RAIL_RADIUS },
          { side: 'right', radius: RAIL_RADIUS },
        ],
      },
    },
    ...offset.connectors,
  ] as BoardElement[]).map(maybeFlip)
}

export function holderThickness(elements: BoardElement[]) {
  return Math.max(...elements.map(e => e.offset.z))
}

export function boardConnectorOffset(config: Cuttleform): Vector {
  return BOARD_PROPERTIES[config.microcontroller!].offset
}

const sizePlusRails = (b: BoardElement) => b.size.x + (b.rails?.width || 0) * 2
export function localHolderBounds(c: Cuttleform, layout: boolean) {
  const elements = boardElements(c, layout)
  const connectors = convertToMaybeCustomConnectors(c).map(conn => convertToCustomConnectors(c, conn))
  return {
    minx: Math.min(
      ...elements.map(conn => conn.offset.x - sizePlusRails(conn) / 2),
      ...connectors.map(conn => conn.x - conn.width / 2),
    ),
    maxx: Math.max(
      ...elements.map(conn => conn.offset.x + sizePlusRails(conn) / 2),
      ...connectors.map(conn => conn.x + conn.width / 2),
    ),
    miny: Math.min(...elements.map(conn => conn.offset.y - conn.size.y)) - STOPPER_HEIGHT,
    maxy: Math.max(...elements.map(conn => conn.offset.y)),
  }
}

/** @deprecated */
export function holderBoundsOrigin(c: Cuttleform, origin: Vector, layout: boolean) {
  const bnd = localHolderBounds(c, layout)
  return {
    minx: origin.x + bnd.minx,
    maxx: origin.x + bnd.maxx,
    miny: origin.y + bnd.miny,
    maxy: origin.y + bnd.maxy,
  }
}

export function holderOuterRadius(c: Cuttleform) {
  return SCREWS[c.screwSize].countersunkDiameter / 2 + 1.5
}

export function holderScrewHeight(c: Cuttleform) {
  const elements = boardElements(c, false)
  const thickness = holderThickness(elements) + screwInsertDimensions(c).height * 0.75
  const min = holderThickness(elements) + screwInsertDimensions(c).height * 0.25
  const max = holderThickness(elements) + screwInsertDimensions(c).height
  return closestScrewHeight(c, thickness, min, max)
}

export function holderTallScrewHeight(c: Cuttleform) {
  const elements = boardElements(c, false)
  const preferred = PLATE_HEIGHT + holderThickness(elements) + screwInsertDimensions(c).height * 0.75
  const min = PLATE_HEIGHT + holderThickness(elements) + screwInsertDimensions(c).height * 0.25
  const max = PLATE_HEIGHT + holderThickness(elements) + screwInsertDimensions(c).height * 0.25
  return closestScrewHeight(c, preferred, min, max)
}
