import { convertToMaybeCustomConnectors, type Cuttleform } from '$lib/worker/config'
import { Vector } from '$lib/worker/modeling/transformation'

import type { ConnectorMaybeCustom, CustomConnector } from '$lib/worker/config.cosmos'
import { PLATE_HEIGHT, screwInsertDimensions } from '$lib/worker/geometry'
import { closestScrewHeight, SCREWS } from './screws'

const STOPPER_HEIGHT = 2 // Size of stopper used to align board
export const STOPPER_WIDTH = 2
const RAIL_WIDTH = 1.5 // Size of rails to add around the board
const RAIL_RADIUS = 0.75 // How far in the rails stick
const BACKSTOP_HEIGHT = 0.5 // How much extra backstop height to add

const IN = 25.4 // in to mm

export const MICROCONTROLLER_SIZES = ['Cosmos', 'Small', 'Medium', 'Large'] as const

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
  countersinkHoles?: { diameter: number; angle: number }
  cutouts: { origin: Vector; size: Vector }[]
  notches?: { origin: Vector; width: number; height: number }[]
  /** Amount to carve into the side to create the cutouts for pins */
  sidecutout: number | number[]
  /** (optional) to how far in the positive Y direction the side cutout goes. */
  sidecutoutMaxY?: number
  /** Diameter of holes cut into the board holder used to attach the microcontroller. These should be tapped. */
  tappedHoleDiameter?: number
  /** Names of pins each on the left side of the microcontroller, when the USB is facing up.
   * If it could be side OR rear, it's a side pin. */
  leftSidePins: string[]
  /** Names of pins each on the right side of the microcontroller, when the USB is facing up.
   * If it could be side OR rear, it's a side pin. */
  rightSidePins: string[]
  /** Names of pins on the rear side of the microcontroller (if any).
   * Connectors don't count. */
  rearPins?: string[]
  /** Names of pins on the connectors on the rear side of the microcontroller (if any). */
  rearConnectorPins?: string[]
  /** Regular expression to determine if a pin is gpio */
  isGPIO: RegExp
  /** If the microcontroller has castellated holes. */
  castellated?: boolean
  /** Override height of the backstop. */
  backstopHeight?: number
  /** Only enabled when ?draftuc is added to the url */
  draft?: boolean
  dontCount?: boolean
  description?: string
  soldByCosmos?: boolean
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
    leftSidePins: ['GP0', 'GP1', 'GND', 'GP2', 'GP3', 'GP4', 'GP5', 'GND', 'GP6', 'GP7', 'GP8', 'GP9', 'GND', 'GP10', 'GP11', 'GP12', 'GP13', 'GND', 'GP14', 'GP15'],
    rightSidePins: ['VBUS', 'VSYS', 'GND', '3V3_EN', '3V3', 'ADC_VREF', 'GP28_A2', 'AGND', 'GP27_A1', 'GP26_A0', 'RUN', 'GP22', 'GND', 'GP21', 'GP20', 'GP19', 'GP18', 'GND', 'GP17', 'GP16'],
    rearPins: ['SWCLK', 'GND', 'SWIO'],
    isGPIO: /GP.*/,
    castellated: true,
    description: 'Why. Are. They. Still. Using. Micro-USB??',
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
    leftSidePins: ['0', '1', 'GND', '2', '3', '4', '5', 'GND', '6', '7', '8', '9', 'GND', '10', '11', '12', '13', 'GND', '14', '15'],
    rightSidePins: ['Vout', 'Vin', 'GND', '23', '3V3', '29', '28', 'GND', '27', '26', 'RUN', '22', 'GND', '21', '20', '19', '18', 'GND', '17', '16'],
    rearPins: ['3V3', 'SWDIO', 'SWDCLK', 'GND'],
    isGPIO: /\d+/,
    description: 'My personal favorite. You can get these dirt cheap on AliExpress.',
  },
  'promicro-usb-c': {
    name: 'Pro Micro - 34.7mm',
    extraName: '(USB-C, Low Storage)',
    size: new Vector(18.3, 34.7, 1.57),
    sizeName: 'Medium',
    boundingBoxZ: 5,
    offset: new Vector(0, 0, 1.835),
    holes: [],
    cutouts: [],
    sidecutout: 3.1,
    leftSidePins: ['TX', 'RX', 'GND', 'GND', '2', '3', '4', '5', '6', '7', '8', '9'],
    rightSidePins: ['RAW', 'GND', 'RST', 'VCC', 'A3', 'A2', 'A1', 'A0', '15', '14', '16', '10'],
    isGPIO: /TX|RX|A?\d+/,
  },
  'promicro-usb-c-long': {
    name: 'Pro Micro - 37mm',
    extraName: '(USB-C, Low Storage)',
    size: new Vector(18.3, 37, 1.57),
    sizeName: 'Medium',
    boundingBoxZ: 5,
    offset: new Vector(0, 0, 1.835),
    holes: [],
    cutouts: [],
    sidecutout: 3.1,
    leftSidePins: ['TX', 'RX', 'GND', 'GND', '2', '3', '4', '5', '6', '7', '8', '9'],
    rightSidePins: ['RAW', 'GND', 'RST', 'VCC', 'A3', 'A2', 'A1', 'A0', '15', '14', '16', '10'],
    isGPIO: /TX|RX|A?\d+/,
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
    leftSidePins: ['TX', 'RX', 'GND', 'GND', '2', '3', '4', '5', '6', '7', '8', '9'],
    rightSidePins: ['RAW', 'GND', 'RST', 'VCC', 'A3', 'A2', 'A1', 'A0', '15', '14', '16', '10'],
    isGPIO: /TX|RX|A?\d+/,
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
    leftSidePins: ['RST', '3.3V', 'VHI', 'A0', 'A1', 'A2', 'A3', '24', '25', 'SCK', 'M0', 'MI'],
    rightSidePins: ['BAT', 'G', 'USB', '13', '12', '11', '10', '9', '5', 'SCL', 'SDA', 'TX'],
    rearPins: ['2', 'EN', 'SWDIO', 'SWCLK', '3', '4', 'RX'],
    isGPIO: /TX|RX|S..|M.|A?\d+/,
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
    leftSidePins: ['RST', '3.3V', 'EN', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'SCK', 'M0', 'MI', 'D2'],
    rightSidePins: ['BAT', 'G', 'USB', '13', '12', '11', '10', '9', '7', '5', 'SCL', 'SDA', 'TX', 'RX'],
    isGPIO: /TX|RX|S..|M.|A?\d+/,
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
    castellated: true,
    leftSidePins: ['D+', 'TX', 'RX', 'GND', 'GND', '2', '3', '4', '5', '6', '7', '8', '9'],
    rightSidePins: ['D-', 'RAW', 'G', 'RST', '3V', 'A3', 'A2', 'A1', 'A0', 'CLK', 'MI', 'MO', '10'],
    isGPIO: /TX|RX|CLK|M.|A?\d+/,
    description: `A good balance of price, capability, and size.`,
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
    leftSidePins: ['GND', 'D1', 'D0', 'GND', 'GND', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9'],
    rightSidePins: ['BAT+', 'BAT-', 'GND', 'RST', '3V3', 'D21', 'D20', 'D19', 'D18', 'D15', 'D14', 'D16', 'D10'],
    isGPIO: /D\d+/,
    description: "The best option if you're willing to spend on Bluetooth.",
  },
  'seeed-studio-xiao': {
    name: 'Seeed Studio Xiao RP2040/SAMD21',
    size: new Vector(17.5, 21, 1.2),
    sizeName: 'Small',
    boundingBoxZ: 5,
    offset: new Vector(0, 0, 2.2),
    holes: [],
    cutouts: [],
    sidecutout: 2,
    leftSidePins: ['0', '1', '2', '3', '4', '5', '6'],
    rightSidePins: ['VCC', 'GND', '3V3', '10', '9', '8', '7'],
    isGPIO: /\d+/,
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
    leftSidePins: ['0', '1', '2', '3', '4', '5', '6'],
    rightSidePins: ['VUSB', 'GND', '3V3', '10', '9', '8', '7'],
    isGPIO: /\d+/,
    description: `The cheapest Bluetooth board here. It's also ridiculously small.`,
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
    leftSidePins: ['5V', 'GND', '3V3', '29', '28', '27', '26', '15', '14'],
    rightSidePins: ['0', '1', '2', '3', '4', '5', '6', '7', '8'],
    rearPins: ['13', '12', '11', '10', '9'],
    isGPIO: /\d+/,
    castellated: true,
    description: `A good option if you need lots of pins in a small space.`,
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
    leftSidePins: ['32', '14', '15', '16', '17', 'RST', '10', '11', '31', '30'],
    rightSidePins: ['3V3', '5V', 'GND', '12', '13', '37', '36', '35', '34', '33'],
    isGPIO: /\d+/,
    description:
      `Likely the cheapest board here, but it lacks processing power, storage, and it can only be re-programmed 200 times. You'll need to use <a href="https://github.com/semickolon/fak">FAK</a> to program it.`,
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
    leftSidePins: ['RST', '3V3', '3V3', 'GND', 'A0', 'A1', 'A2', 'A3', 'D24', 'D25', 'SCK', 'MOSI', 'MISO', 'RX', 'TX', 'D4'],
    rightSidePins: ['VBAT', 'EN', 'VBUS', 'D13', 'D12', 'D11', 'D10', 'D9', 'D6', 'D5', 'SCL', 'SDA'],
    isGPIO: /SCK|MOSI|MISO|RX|TX|SCL|SDA|(A|D)?\d+/,
    backstopHeight: 0,
  },
  'cyboard-assimilator': {
    name: 'Cyboard Assimilator',
    extraName: '(USB-C, Flex PCB)',
    size: new Vector(29.9, 41.13, 1.57),
    sizeName: 'Large',
    boundingBoxZ: 5,
    offset: new Vector(0, 0, 5 - 3.21),
    tappedHoleDiameter: 3.4,
    holes: [new Vector(-11.45, -9.09, 0)],
    countersinkHoles: { diameter: 6.3, angle: 90 },
    notches: [{ origin: new Vector(13.9, -10.9, 0), width: 2.3, height: 2.6 }],
    cutouts: [{ origin: new Vector(-4.538, -15.418, 0), size: new Vector(4.5, 2.5, 0) }],
    sidecutout: 2,
    sidecutoutMaxY: -13,
    leftSidePins: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'],
    rightSidePins: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'],
    isGPIO: /(R|C)\d+/,
    backstopHeight: 0,
    dontCount: true,
    description:
      "For use with Cyboard's Dactyl Flex PCBs. The Microcontroller has one native USB-C port and one fake one (good for connecting halves but not for plugging in).\nSupports both wired and wireless (longer) versions.",
  },
  'lemon-wired': {
    name: 'Lemon Wired',
    extraName: '(Dual USB-C, Flex PCB) ☆',
    size: new Vector(31.94, 36, 1.57),
    sizeName: 'Cosmos',
    boundingBoxZ: 5,
    offset: new Vector(0, 0, 1.835),
    holes: [],
    cutouts: [{ origin: new Vector(0, -16, 0), size: new Vector(11, 11, 0) }],
    sidecutout: 0.1 * IN,
    leftSidePins: ['VRGB', 'GND', 'RGB', 'GP3', 'GP4', 'GP5', 'GP6', 'GP7', 'GP8', 'GP9', 'GP10', 'RESET'],
    rightSidePins: ['5V', '3V3', 'GND', 'GP29', 'GP28', 'GP27', 'GP26', 'GP25', 'GP24', 'GP23', 'GP22', 'GP21', 'GP20'],
    rearConnectorPins: ['GP18', 'GP19', 'GP15', 'GP13', 'GP12', 'GP14'],
    isGPIO: /GP\d+/,
    backstopHeight: 0,
    draft: true,
    soldByCosmos: true,
    description:
      'A fast & feature-packed microcontroller with two USB-C ports to link together your keyboard halves (avoids TRRS hotplug issues). Based on the RP2040.\n<a href="https://ryanis.cool/cosmos/lemon">Lemon Microcontrollers</a> are sold from the <a href="https://cosmos-store.ryanis.cool">Cosmos Store</a> and shipped from the US. They are <a href="https://github.com/rianadon/Cosmos-Keyboard-PCBs">open source</a> too.',
  },
  'lemon-wireless': {
    name: 'Lemon Wireless',
    extraName: '(Bluetooth, Flex PCB) ☆',
    size: new Vector(29.9, 42, 1.57),
    sizeName: 'Cosmos',
    boundingBoxZ: 5,
    offset: new Vector(0, 0, 1.835),
    holes: [],
    cutouts: [{ origin: new Vector(-3.6, -31.1, 0), size: new Vector(9, 9, 0) }],
    sidecutout: [0, 6],
    leftSidePins: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'],
    rightSidePins: ['GP2', 'GP1', 'R7', 'R4', 'R6', 'R2', 'R3', 'R5', 'R1', 'RESET'],
    rearConnectorPins: ['SDA', 'SCL', 'RGB', 'MOSI', 'CS', 'MISO', 'SCK'],
    isGPIO: /R\d+|C\d+|GP\d+|SDA|SCL|MOSI|MISO|CS|SCK/,
    backstopHeight: 0,
    draft: true,
    soldByCosmos: true,
    description:
      'Lots of I/Os, Bluetooth, and affordable! You can have all three.\n<a href="https://ryanis.cool/cosmos/lemon">Lemon Microcontrollers</a> are sold from the <a href="https://cosmos-store.ryanis.cool">Cosmos Store</a> and shipped from the US. They are <a href="https://github.com/rianadon/Cosmos-Keyboard-PCBs">open source</a> too.',
  },
  'elite-c': {
    name: 'Elite-C',
    extraName: '(USB-C, Low Storage)',
    size: new Vector(18.71, 33.45, 1.57),
    sizeName: 'Medium',
    boundingBoxZ: 5,
    offset: new Vector(0, 0, 3.4),
    holes: [],
    cutouts: [],
    sidecutout: 3.1,
    leftSidePins: ['D3', 'D2', 'GND', 'GND', 'D1', 'D0', 'D4', 'C6', 'D7', 'E6', 'B4', 'B5'],
    rightSidePins: ['B0', 'GND', 'RST', 'VCC', 'F4', 'F5', 'F6', 'F7', 'B1', 'B3', 'B2', 'B6'],
    rearPins: ['F0', 'F1', 'C7', 'D5', 'B7'],
    isGPIO: /TX|RX|A?\d+/,
  },
}

export function sortMicrocontrollers(a: Microcontroller, b: Microcontroller) {
  const score = (m: Microcontroller) => {
    let s = 0
    if (BOARD_PROPERTIES[m].extraName?.includes('☆')) s += 100
    if (BOARD_PROPERTIES[m].extraName?.includes('Low Storage')) s -= 10
    if (BOARD_PROPERTIES[m].extraName?.includes('USB-C')) s += 1
    if (BOARD_PROPERTIES[m].extraName?.includes('Flex PCB')) s += 1
    if (BOARD_PROPERTIES[m].extraName?.includes('Bluetooth')) s += 1
    if (m.includes('promicro')) return 0.9 // Pro Micro is still popular
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
        clamps: config.fastenMicrocontroller && !BOARD_PROPERTIES[config.microcontroller].notches
          ? [
            { side: 'left', radius: RAIL_RADIUS },
            { side: 'right', radius: RAIL_RADIUS },
          ]
          : [],
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

export function numGPIO(mcu: Microcontroller) {
  const info = BOARD_PROPERTIES[mcu]
  const pins: string[] = []
  if (info.leftSidePins) pins.push(...info.leftSidePins)
  if (info.rightSidePins) pins.push(...info.rightSidePins)
  if (info.rearPins) pins.push(...info.rearPins)
  if (info.rearConnectorPins) pins.push(...info.rearConnectorPins)

  const isGPIO = new RegExp('^' + info.isGPIO.source + '$')
  return pins.filter(p => isGPIO.test(p)).length
}

export function microcontrollerConnectors(mcu: Microcontroller, connectors: ConnectorMaybeCustom[]) {
  const isBluetooth = mcu != null && BOARD_PROPERTIES[mcu].extraName?.toLowerCase().includes('bluetooth')

  if (mcu == null) connectors = []
  else if (mcu == 'cyboard-assimilator') {
    connectors = [
      { width: 2.3, height: 2.3, x: -12.1, y: 5, radius: 100 },
      { preset: 'usb', size: 'average', x: -3.2 },
      { preset: 'usb', size: 'average', x: 9.4 },
    ]
  } else if (mcu == 'lemon-wired') {
    connectors = [
      { preset: 'usb', size: 'average', x: -7 },
      { preset: 'usb', size: 'average', x: 7 },
    ]
  } else if (mcu == 'lemon-wireless') {
    connectors = [
      { width: 7, height: 3, x: -9.3, y: 4, radius: 1 },
      { preset: 'usb', size: 'average', x: 5.4 },
    ]
  } else if (isBluetooth) connectors = [{ preset: 'usb', size: 'average' }]
  else connectors = [{ preset: 'trrs' }, { preset: 'usb', size: 'average' }]

  const mirrorConnectors = mcu != 'cyboard-assimilator'
    && mcu != 'lemon-wireless'

  return { connectors, mirrorConnectors }
}
