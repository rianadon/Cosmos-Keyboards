import type { Cuttleform } from '$lib/worker/config'
import { Vector } from '$lib/worker/modeling/transformation'

import { PLATE_HEIGHT, screwInsertDimensions } from '$lib/worker/model'
import { closestScrewHeight, SCREWS } from './screws'

const STOPPER_HEIGHT = 2 // Size of stopper used to align board
export const STOPPER_WIDTH = 2
const RAIL_WIDTH = 1.5 // Size of rails to add around the board
const RAIL_RADIUS = 1 // How far in the rails stick

const IN = 25.4 // in to mm

// Pi Pico Model: https://github.com/ncarandini/KiCad-RP-Pico
// Pro Micro Model: https://grabcad.com/library/arduino-pro-micro-4
// Pro Micro USB-C Model: https://grabcad.com/library/arduino-pro-micro-usb-type-c-1
// Black RP2040 Dimensions: https://99tech.com.au/product/rp2040-yd-n16/
// nrfmicro: use KiCad StepUp from freecad
// seeed studio xiao: https://wiki.seeedstudio.com/XIAO-RP2040/
// Adafruit RP2040 Feather Model: https://github.com/adafruit/Adafruit_CAD_Parts/tree/main/4884%20Feather%20RP2040
// Adafruit RP2040 Kee Boar Model: https://github.com/adafruit/Adafruit_CAD_Parts/tree/main/5302%20KB2040

interface BoardProperties {
  name: string
  offset: Vector
  size: Vector
  boundingBoxZ: number
  holes: Vector[]
  cutouts: { origin: Vector; size: Vector }[]
  sidecutout: number
  tappedHoleDiameter?: number
  /** Names of pins each on the sides of the microcontroller.
   * If it could be side OR rear, it's a side pin. */
  sidePins: number
  /** Names of pins on the rear side of the microcontroller (if any).
   * Connectors don't count. */
  rearPins?: number
  /** If the microcontroller has castellated holes. */
  castellated?: boolean
}

type Microcontroller = Exclude<Cuttleform['microcontroller'], null>

export const BOARD_PROPERTIES: Record<Microcontroller, BoardProperties> = {
  'pi-pico': {
    name: 'Pi Pico',
    offset: new Vector(0, 0, 3.2),
    size: new Vector(21, 51, 1),
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
    size: new Vector(0.9 * IN, 2.1 * IN, 1.57),
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
    name: 'Pro Micro (USB-C)',
    size: new Vector(18.3, 34.7, 1.57),
    boundingBoxZ: 5,
    offset: new Vector(0, 0, 1.835),
    holes: [],
    cutouts: [],
    sidecutout: 3.1,
    sidePins: 12,
  },
  'promicro': {
    name: 'Pro Micro',
    size: new Vector(0.7 * IN, 1.3 * IN, 1.57),
    boundingBoxZ: 5,
    offset: new Vector(0, 0, 1.835),
    holes: [],
    cutouts: [],
    sidecutout: 0.1 * IN,
    sidePins: 12,
  },
  'itsybitsy-adafruit': {
    name: 'Adafruit ItsyBitsy',
    size: new Vector(0.7 * IN, 1.4 * IN, 1.57),
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
    size: new Vector(0.7 * IN, 1.3 * IN, 1.57),
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
    size: new Vector(0.71 * IN, 1.31 * IN, 1.57),
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
    name: 'Seeed Studio Xiao',
    size: new Vector(17.5, 21, 1.2),
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
    size: new Vector(18.288, 25.908, 1.57),
    boundingBoxZ: 5,
    offset: new Vector(0, 0, 1.835),
    holes: [],
    cutouts: [],
    sidecutout: 3.1,
    sidePins: 10,
  },
  'adafruit-rp2040-feather': {
    name: 'Adafruit rp2040 feather',
    size: new Vector(0.9 * IN, 2 * IN, 1.57),
    boundingBoxZ: 0.28 * IN,
    offset: new Vector(0, 0, 1.835),
    tappedHoleDiameter: 0.1 * IN,
    holes: [new Vector(-5.7, -2, 0), new Vector(5.7, -2, 0), new Vector(-5.7, -49, 0), new Vector(5.7, -49, 0)],
    cutouts: [],
    sidecutout: 3.1,
    sidePins: 16,
  },
  'adafruit-rp2040-keeboar': {
    name: 'Adafruit rp2040 Kee Boar',
    size: new Vector(18.288, 25.908, 1.57),
    boundingBoxZ: 5,
    offset: new Vector(0, 0, 1.835),
    holes: [],
    cutouts: [],
    sidecutout: 3.1,
    sidePins: 10,
    castellated: true,
  },
}

// Use a constant set of board properties for layout so
// that no matter the microcontroller, the connector is
// always placed in the correct spot
function boardElementLayout(c: Cuttleform): BoardElement {
  return {
    model: 'layout',
    offset: new Vector(0, 0, 0),
    size: new Vector(
      Math.max(...Object.values(BOARD_PROPERTIES).map(p => p.size.x)),
      c.microcontroller
        ? BOARD_PROPERTIES[c.microcontroller].size.y
        : Math.min(...Object.values(BOARD_PROPERTIES).map(p => p.size.y)),
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
    backstop: boolean
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

export function boardOffsetInfo(config: Cuttleform): BoardOffset {
  if (!config.connector) return { connectors: [] }
  switch (config.connector) {
    case 'trrs':
      return {
        connectors: [
          {
            model: 'trrs',
            offset: new Vector(-14.5, 0, 2.5),
            size: new Vector(6.1, 12.2, 5),
            boundingBoxZ: 6,
            rails: {
              width: RAIL_WIDTH,
              backstop: true,
              clamps: [
                { side: 'left', radius: 0.4 },
                { side: 'right', radius: 0.4 },
                { side: 'back', radius: RAIL_RADIUS * 1.5 },
              ],
            },
          },
        ],
      }
    case 'usb':
      return { connectors: [] }
    default:
      throw new Error(`Connector type ${config.connector} is not supported`)
  }
}

export function boardElements(config: Cuttleform, layout: boolean): BoardElement[] {
  const offset = boardOffsetInfo(config)

  if (layout) return [boardElementLayout(config), ...offset.connectors]
  if (!config.microcontroller) return []

  return [
    {
      model: config.microcontroller,
      offset: BOARD_PROPERTIES[config.microcontroller].offset,
      size: BOARD_PROPERTIES[config.microcontroller].size,
      boundingBoxZ: BOARD_PROPERTIES[config.microcontroller].boundingBoxZ,
      rails: {
        width: RAIL_WIDTH,
        backstop: true,
        clamps: [
          { side: 'left', radius: RAIL_RADIUS },
          { side: 'right', radius: RAIL_RADIUS },
        ],
      },
    },
    ...offset.connectors,
  ]
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
  return {
    minx: Math.min(...elements.map(conn => conn.offset.x - sizePlusRails(conn) / 2)),
    maxx: Math.max(...elements.map(conn => conn.offset.x + sizePlusRails(conn) / 2)),
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
