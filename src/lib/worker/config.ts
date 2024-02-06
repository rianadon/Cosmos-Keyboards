import type manuform from '$assets/manuform.json'
import { hasPro } from '@pro/index'
import { StiltsGeometry } from '@pro/stiltsGeo'
import { Matrix4, Vector3 } from 'three'
import {
  CONNECTOR,
  CONNECTOR_SIZE,
  type Cuttleform as CuttleformProtoP,
  Cuttleform_CarbonfetThumb,
  Cuttleform_CurvedThumb,
  type Cuttleform_CustomThumb,
  Cuttleform_CustomThumb_Key,
  Cuttleform_DefaultThumb,
  Cuttleform_DefaultThumb_KEY_COUNT as DTKEYS,
  type Cuttleform_OrbylThumb,
  ENCODER,
  EXTRA_COLUMN,
  KEY_SIZE,
  KEYCAP,
  LAST_ROW,
  MICROCONTROLLER,
  SCREW_SIZE,
  SCREW_TYPE,
  SWITCH,
} from '../../../target/proto/cuttleform'
import { BaseGeometry, BlockGeometry, TiltGeometry } from './cachedGeometry'
import Trsf from './modeling/transformation'
import ETrsf, { Constant, keyPosition, mirror } from './modeling/transformation-ext'
import { for2, match, range, reverseMap } from './util'

type DeepRequired<T> = Required<
  {
    [K in keyof T]: DeepRequired<T[K]>
  }
>

export type CuttleformProto = DeepRequired<CuttleformProtoP>

// const MANUFORM_KEYCAP_TYPE = "xda"

export type Manuform = typeof manuform.options
type Point = [number, number, number]

const CENTER: Point = [0, 0, 0]
const X: Point = [1, 0, 0]
const Y: Point = [0, 1, 0]
const Z: Point = [0, 0, 1]

type _ETrsf = ETrsf // For code gen
export interface SpecificCuttleform<S> {
  wallThickness: number
  wallShrouding: number
  webThickness: number
  keys: CuttleKey[]
  connector: 'usb' | 'trrs' | null
  connectorSizeUSB: 'slim' | 'average' | 'big'
  /** The index of the wall by which the connector is placed. */
  connectorIndex: number
  /** The indices of the walls at which to place screw inserts. */
  screwIndices: number[]
  screwType: 'screw insert' | 'tapered screw insert' | 'expanding screw insert' | 'tapped hole'
  screwSize: 'M3' | 'M4' | '#4-40' | '#6-32'
  screwCountersink: boolean
  wristRest?: {
    length: number
    angle: number
    maxWidth: number
    xOffset: number
    zOffset: number
    tenting: number
    stilts?: boolean
  }
  wristRestOrigin: ETrsf
  microcontroller:
    | 'pi-pico'
    | 'promicro'
    | 'promicro-usb-c'
    | 'itsybitsy-adafruit'
    | 'kb2040-adafruit'
    | 'rp2040-black-usb-c-aliexpress'
    | 'nrfmicro-or-nicenano'
    | 'seeed-studio-xiao'
    | 'waveshare-rp2040-zero'
    | 'weact-studio-ch552t'
    | null
  fastenMicrocontroller: boolean
  /** Additional height to add to the model. */
  verticalClearance: number
  clearScrews: boolean
  rounded: {
    side?: {
      /**
       * The tangents of the walls have length <segment length>/divisor.
       * Smaller divisors make the walls more rounded.
       */
      divisor: number
    }
    top?: {
      /** Length of the horizontal tangent of the top walls, at the top vertex. */
      horizontal: number
      /** Length of the vertical tangent of the top walls, at the bottom vertex. */
      vertical: number
    }
  }
  shell: S
}

export type Cuttleform = SpecificCuttleform<AnyShell>

export interface BasicShell {
  type: 'basic'
  lip: boolean
}
export interface StiltsShell {
  type: 'stilts'
  inside: boolean
}
export interface BlockShell {
  type: 'block'
}
export interface TiltShell {
  type: 'tilt'
  tilt: [number, number, number] | number
  raiseBy: number
  pattern: null | number[]
}
export type AnyShell = BasicShell | StiltsShell | BlockShell | TiltShell

interface CuttleBaseKey {
  /** The position at which to place the key. */
  position: ETrsf
  /** Aspect ratio of the key. Use 1.5 for 1.5u keys, etc. If the aspect is <1, the key will be placed vertically. */
  aspect: number
  cluster: string
}

export interface Keycap {
  profile: 'dsa' | 'mt3' | 'oem' | 'sa' | 'xda' | 'choc' | 'cherry' | 'des'
  /** Some keycaps (eg mt3) have different profiles depending on the row the keycap is meant for. */
  row: number
  /** The QWERTY keyboard letter this key is for. */
  letter?: string
  /** The finger that rests on this key in home position. */
  home?: 'thumb' | 'index' | 'middle' | 'ring' | 'pinky'
}

interface CuttleKeycapKey extends CuttleBaseKey {
  type: 'old-box' | 'old-mx' | 'mx-better' | 'old-mx-snap-in' | 'alps' | 'choc' | 'mx-pcb' | 'old-mx-hotswap' | 'old-mx-snap-in-hotswap' | 'choc-hotswap' | 'mx-hotswap'
  keycap: Keycap
}

interface CuttleBasicKey extends CuttleBaseKey {
  type: 'ec11' | 'oled-128x32-0.91in-adafruit' | 'oled-128x32-0.91in-dfrobot' | 'evqwgd001'
}

interface CuttleBlankKey extends CuttleBaseKey {
  type: 'blank'
  keycap?: Keycap
  size: { width: number; height: number }
}

type RoundSize = { radius: number; sides: number }
interface CuttleTrackballKey extends CuttleBaseKey {
  type: 'trackball'
  size: RoundSize
}

interface CuttleTrackpadKey extends CuttleBaseKey {
  type: 'cirque-23mm' | 'cirque-35mm' | 'cirque-40mm'
  size: { sides: number }
}

export type CuttleKey = CuttleKeycapKey | CuttleBasicKey | CuttleTrackballKey | CuttleTrackpadKey | CuttleBlankKey

export function keyRoundSize(key: CuttleKey): RoundSize | undefined {
  switch (key.type) {
    case 'trackball':
      // @ts-ignore: for backwards compatibility.
      return key.size ?? key.trackball
    case 'cirque-23mm':
    case 'cirque-35mm':
    case 'cirque-40mm':
      return {
        // @ts-ignore: for backwards compatibility.
        sides: key.size?.sides ?? key.trackball.sides,
        radius: cirqueRadius(key.type),
      }
    default:
      return undefined
  }
}

export const MAP_SCREW_SIZE: Record<SCREW_SIZE, Cuttleform['screwSize']> = {
  [SCREW_SIZE.M3]: 'M3',
  [SCREW_SIZE.M4]: 'M4',
  [SCREW_SIZE.I4_40]: '#4-40',
  [SCREW_SIZE.I6_32]: '#6-32',
}

export const MAP_SCREW_TYPE: Record<SCREW_TYPE, Cuttleform['screwType']> = {
  [SCREW_TYPE.STRAIGHT_INSERT]: 'screw insert',
  [SCREW_TYPE.TAPERED_INSERT]: 'tapered screw insert',
  [SCREW_TYPE.EXPANDING_INSERT]: 'expanding screw insert',
  [SCREW_TYPE.TAPPED]: 'tapped hole',
}

export const MAP_KEY_SIZE: Record<KEY_SIZE, number> = {
  [KEY_SIZE.U1]: 1,
  [KEY_SIZE.U125]: 1.25,
  [KEY_SIZE.U15]: 1.5,
  [KEY_SIZE.U2]: 2,
}

export const MAP_MICROCONTROLLER: Record<MICROCONTROLLER, Cuttleform['microcontroller'] | null> = {
  [MICROCONTROLLER.NOMC]: null,
  [MICROCONTROLLER.PIPICO]: 'pi-pico',
  [MICROCONTROLLER.PROMICRO]: 'promicro',
  [MICROCONTROLLER.PROMICRO_C]: 'promicro-usb-c',
  [MICROCONTROLLER.ITSYBITSY]: 'itsybitsy-adafruit',
  [MICROCONTROLLER.ITSYBITSY_BT]: 'itsybitsy-adafruit',
  [MICROCONTROLLER.KB2040]: 'kb2040-adafruit',
  [MICROCONTROLLER.RP2040_BLACK]: 'rp2040-black-usb-c-aliexpress',
  [MICROCONTROLLER.NRFMICRO]: 'nrfmicro-or-nicenano',
  [MICROCONTROLLER.XIAO]: 'seeed-studio-xiao',
  [MICROCONTROLLER.XIAO_BT]: 'seeed-studio-xiao',
  [MICROCONTROLLER.RP2040_ZERO]: 'waveshare-rp2040-zero',
  [MICROCONTROLLER.WEACT_CH552T]: 'weact-studio-ch552t',
}

export const MAP_CONNECTOR: Record<CONNECTOR, Cuttleform['connector']> = {
  [CONNECTOR.NONE]: null,
  [CONNECTOR.TRRS]: 'trrs',
  [CONNECTOR.USB]: 'usb',
}

export const MAP_ENCODER: Record<ENCODER, 'ec11' | 'evqwgd001'> = {
  [ENCODER.EC11]: 'ec11',
  [ENCODER.EVQWGD001]: 'evqwgd001',
}

export const MAP_CONNECTOR_SIZE: Record<CONNECTOR_SIZE, Cuttleform['connectorSizeUSB']> = {
  [CONNECTOR_SIZE.SLIM]: 'slim',
  [CONNECTOR_SIZE.AVERAGE]: 'average',
  [CONNECTOR_SIZE.BIG]: 'big',
}

export function cScrewHeight(size: string) {
  switch (size) {
    case 'M3':
      return '6mm'
    case 'M4':
      return '6mm'
    case '#4-40':
      return '0.25"'
    case '#6-32':
      return '0.25"'
  }
}
export function screwHeight(c: CuttleformProto) {
  return cScrewHeight(MAP_SCREW_SIZE[c.wall.screwSize])
}

// export function cuttleConfFromManuform(m: Manuform): Cuttleform {
//     return {
//         wallThickness: wallThickness(m),
//         webThickness: webThickness(m),
//         keys: [
//             ...manuformFingers(m),
//             ...manuformThumbs(m)
//         ],
//         screwIndices: m.form.screwInserts ? [-1,-1,-1,-1] : [],
//         rounded: {
//             top: m.misc.roundedtop ? { horizontal: 1/4, vertical: 2/3 } : undefined,
//             side: m.misc.roundedside? { divisor: 3 } : undefined,
//         },
//         connector: m.connector.external ? "external" : m.connector.type,
//         connectorIndex: -1,
//         wristRest: true,
//         wristRestOrigin: null,
//         verticalClearance: 2,
//     }
// }

function cuttleConfShell(c: DeepRequired<CuttleformProto>): AnyShell {
  if (c.shell.oneofKind == 'basicShell') {
    return {
      type: 'basic',
      lip: c.shell.basicShell.lip,
    }
  }
  if (c.shell.oneofKind == 'tiltShell') {
    return {
      type: 'tilt',
      tilt: c.shell.tiltShell.tilt / 45,
      raiseBy: c.shell.tiltShell.raiseBy / 10,
      pattern: c.shell.tiltShell.pattern
        ? [c.shell.tiltShell.patternWidth / 10, c.shell.tiltShell.patternGap / 10]
        : null,
    }
  }
  if (c.shell.oneofKind == 'stiltsShell') {
    return {
      type: 'stilts',
      inside: c.shell.stiltsShell.inside,
    }
  }
  throw new Error('Unknown shell type')
}

function maybeMirror(c: DeepRequired<CuttleformProto>, keys: CuttleKey[]) {
  if (c.wall.unibody) return mirror(keys, c.wall.unibodyGap / 10, c.wall.unibodyAngle / 45)
  return keys
}

export function cuttleConf(c: DeepRequired<CuttleformProto>): Cuttleform {
  return {
    wallThickness: c.wall.wallThickness / 10,
    wallShrouding: c.wall.wallShrouding / 10,
    webThickness: c.wall.webThickness / 10,
    keys: maybeMirror(c, [
      ...fingers(c),
      ...thumbs(c),
    ]),
    screwIndices: c.wall.screwInserts ? c.wall.screwIndices.map(i => (i - 1)) : [],
    screwType: MAP_SCREW_TYPE[c.wall.screwType],
    screwSize: MAP_SCREW_SIZE[c.wall.screwSize],
    screwCountersink: c.wall.countersinkScrews,
    rounded: {
      top: c.wall.roundedTop ? { horizontal: 1 / 4, vertical: 2 / 3 } : undefined,
      side: c.wall.roundedSide ? { divisor: 3 } : undefined,
    },
    connector: MAP_CONNECTOR[c.wall.connector],
    connectorSizeUSB: MAP_CONNECTOR_SIZE[c.wall.connectorSizeUsb],
    connectorIndex: -1,
    wristRest: c.wall.wristRest && hasPro
      ? {
        length: c.wall.wristRestLength / 10,
        maxWidth: c.wall.wristRestMaxWidth / 10,
        xOffset: c.wall.wristRestXOffset / 10,
        zOffset: c.wall.wristRestZOffset / 10,
        angle: c.wall.wristRestAngle / 45,
        tenting: c.curvature.tenting / 45 / 2 + c.wall.wristRestTenting / 45,
      }
      : undefined,
    wristRestOrigin: thumbOrigin(c, true),
    microcontroller: MAP_MICROCONTROLLER[c.wall.microcontroller],
    fastenMicrocontroller: c.wall.fastenMicrocontroller,
    verticalClearance: c.wall.verticalClearance / 10,
    clearScrews: c.wall.clearScrews,
    shell: cuttleConfShell(c),
  }
}

type Config = typeof manuform.options

const alpha = (c: Config) => c.curve.alpha / 45
const pinkyAlpha = (c: Config) => c.curve.pinkyAlpha / 45
const beta = (c: Config) => c.curve.beta / 45
const tentingAngle = (c: Config) => c.curve.tenting / 45
const rotateXAngle = (c: Config) => c.curve.rotateX / 45

const nRows = (c: Config) => c.keys.rows
const nCols = (c: Config) => c.keys.columns
const inner = (c: Config) => c.keys.innerColumn
const lastRowCount = (c: Config) => c.keys.lastRow
const hideLastPinky = (c: Config) => c.keys.hideLastPinky

/** extra width between two keys in a row. */
const extraWidth = (c: Config) => c.shaping.extraWidth
/** extra height between two keys in a column. */
const extraHeight = (c: Config) => c.shaping.extraHeight

const webThickness = (c: Config) => c.form.webThickness
const wallThickness = (c: Config) => c.form.wallThickness

const stagger = (c: Config) => c.shaping.stagger
const staggerIndex = (c: Config) => [0, c.shaping.staggerIndexY, c.shaping.staggerIndexZ] as Point
const staggerMiddle = (c: Config) => [0, c.shaping.staggerMiddleY, c.shaping.staggerMiddleZ] as Point
const staggerRing = (c: Config) => [0, c.shaping.staggerRingY, c.shaping.staggerRingZ] as Point
const staggerPinky = (c: Config) => [0, c.shaping.staggerPinkyY, c.shaping.staggerPinkyZ] as Point

/** Determines where the last row should be located at. */
const lastRow = (c: Config) => nRows(c) - 1
/** Determines where the penultimate row should be located at. */
const cornerRow = (c: Config) => nRows(c) - 2
/** Determines where the last column should be located at. With 0 being inner index finger, 1 being index finger, and so on. */
const lastCol = (c: Config) => nCols(c) - 1

const keyboardZOffset = (c: Config) => c.form.heightOffset
const useWidePinky = (c: Config) => c.form.widePinky
const usesWidePinky = (c: Config, col: number, row: number) => (useWidePinky(c) && row != lastRow(c) && col == lastCol(c))

/** an array of columns from 0 to number of columns. */
const columns = (c: Config) =>
  range(
    match(inner(c), { outie: -1, normie: 0, innie: 1 }),
    nCols(c),
  )

/** it creates an array for row placement. where 0 being top-most row, 1 second top-most row, and so on. */
const rows = (c: Config) => range(0, nRows(c))

const centerRow = (c: Config) =>
  nRows(c) - match(nRows(c), {
    3: 2.5,
    2: 2,
  }, 3)

const centerCol = (c: Config) => c.curve.centercol

/** Determines how much 'stagger' the columns are for dm.
    0 = inner index finger's column.
    1 = index finger's column.
    2 = middle finger's column.
    3 = ring finger's column.
    4 >= pinky finger's column.
    [x y z] means that it will be staggered by 'x'mm in X axis (left/right),
    'y'mm in Y axis (front/back), and 'z'mm in Z axis (up/down). */
function dmColumnOffset(c: Config, column: number): Point {
  if (stagger(c)) {
    if (column == 2) return staggerMiddle(c)
    if (column == 3) return staggerRing(c)
    if (column >= 4) return staggerPinky(c)
    else return staggerIndex(c)
  } else {
    if (column == 2) return [0, 0, -6.5]
    if (column == 4) return [0, 0, 6]
    else return [0, 0, 0]
  }
}

function keyType(m: Manuform): CuttleKey['type'] {
  let t = m.keys.switchType
  if (m.form.hotswap) t += '-hotswap'
  return t as any
}

function keycapType(c: DeepRequired<CuttleformProto>): Required<CuttleKeycapKey>['keycap']['profile'] {
  if (c.upperKeys.keycapType == KEYCAP.MT3) return 'mt3'
  if (c.upperKeys.keycapType == KEYCAP.OEM) return 'oem'
  if (c.upperKeys.keycapType == KEYCAP.CHERRY) return 'cherry'
  if (c.upperKeys.keycapType == KEYCAP.SA) return 'sa'
  if (c.upperKeys.keycapType == KEYCAP.XDA) return 'xda'
  if (c.upperKeys.keycapType == KEYCAP.KCHOC) return 'choc'
  if (c.upperKeys.keycapType == KEYCAP.DES) return 'des'
  return 'dsa'
}

function switchType(c: DeepRequired<CuttleformProto>): Required<CuttleKeycapKey>['type'] {
  if (c.upperKeys.switchType == SWITCH.MX) return 'old-mx'
  if (c.upperKeys.switchType == SWITCH.MX_HOTSWAP) return 'mx-hotswap'
  if (c.upperKeys.switchType == SWITCH.MX_BETTER) return 'mx-better'
  if (c.upperKeys.switchType == SWITCH.MX_PCB) return 'mx-pcb'
  if (c.upperKeys.switchType == SWITCH.CHOC) return 'choc'
  if (c.upperKeys.switchType == SWITCH.ALPS) return 'alps'
  return 'box'
}

export function curvature(pinky: boolean, c: DeepRequired<CuttleformProto>) {
  return {
    merged: {
      curvatureOfColumn: pinky ? c.curvature.pinkyAlpha / 45 : c.curvature.alpha / 45,
      curvatureOfRow: c.curvature.beta / 45,
      spacingOfRows: c.upperKeys.verticalSpacing / 10,
      spacingOfColumns: c.upperKeys.horizontalSpacing / 10,
    },
    unmerged: {
      curvatureOfColumn: pinky ? c.curvature.pinkyAlpha / 45 : c.curvature.alpha / 45,
    },
    name: 'curvature',
  }
}

function mergeCurvature(base: any, opts: any, name: string): any {
  return {
    merged: { ...base, ...opts },
    unmerged: opts,
    name,
  }
}

function mergedCurvature(c: CuttleformProto, pinky: boolean, curv: any): any {
  return {
    merged: { ...curv, ...curvature(pinky, c).merged },
    unmerged: curv,
    name: pinky ? 'pinkyCurvature' : 'curvature',
  }
}

function keycapInfo(c: CuttleformProto, row: number, column: number): CuttleKeycapKey['keycap'] {
  let home: CuttleKeycapKey['keycap']['home']
  if (row == 3) {
    home = ({
      1: 'index',
      2: 'middle',
      3: 'ring',
      4: 'pinky',
    } as Record<number, CuttleKeycapKey['keycap']['home']>)[column]
  }
  const letter = {
    1: '67890',
    2: 'yuiop',
    3: "hjkl;'",
    4: 'nm,./',
  }[row]?.charAt(column) || undefined
  return { profile: keycapType(c), row, home, letter }
}

export function decodeTuple(tuple: bigint) {
  if (typeof tuple === 'string') tuple = BigInt(tuple)
  const sint32 = (u: number) => u >>> 1 ^ -(u & 1) | 0

  let i = 0
  /** Read from position i */
  function decode() {
    const short = Number(BigInt.asUintN(16, tuple >> BigInt(i * 8)))
    if ((short & 255) < 128) {
      i += 1
      return sint32(short & 127)
    } else {
      i += 2
      return sint32((short & 127) | ((short & 32512) >> 1))
    }
  }
  return [decode(), decode(), decode(), decode()]
}

export function encodeTuple(values: number[]) {
  const sint32 = (s: number) => (s << 1 ^ s >> 31) >>> 0

  let i = 0
  /** Read from position i */
  function encode(s: number) {
    const u = sint32(s)
    if (u < 128) {
      i += 1
      return BigInt(u) << BigInt((i - 1) * 8)
    } else {
      i += 2
      return BigInt(((u << 1) & 32512) | 128 | (u & 127)) << BigInt((i - 2) * 8)
    }
  }
  let result = encode(values[0]) | encode(values[1]) | encode(values[2])
  if (values.length > 3 && values[3]) result |= encode(values[3])
  console.log('Encoded tuple', result)
  return result
}

function tupleToXYZA(tuple: bigint) {
  const decoded = decodeTuple(tuple)
  return { x: decoded[0] / 10, y: decoded[1] / 10, z: decoded[2] / 10, a: decoded[3] / 45 }
}

export function tupleToRot(tuple: bigint) {
  const decoded = decodeTuple(tuple)
  return { alpha: decoded[0] / 45, beta: decoded[1] / 45, gamma: decoded[2] / 45, extra: decoded[3] }
}

export function tupleToXYZ(tuple: bigint) {
  const decoded = decodeTuple(tuple)
  return [decoded[0] / 10, decoded[1] / 10, decoded[2] / 10] as Point
}

export function fingers(c: DeepRequired<CuttleformProto>): CuttleKey[] {
  const columns = range(0, c.upperKeys.columns)
  const rows = range(0, c.upperKeys.rows)

  const lastRow = c.upperKeys.rows - 1
  const cornerRow = c.upperKeys.rows - 2
  const lastCol = c.upperKeys.columns - 1
  const usesWidePinky = (col: number, row: number) => (row != lastRow && col == lastCol && col > 4)
  const pinkySize = MAP_KEY_SIZE[c.upperKeys.pinkySize] || 1

  function dmColumnOffset(column: number): Point {
    if (column == 1) return tupleToXYZ(c.stagger.staggerIndex)
    if (column == 2) return tupleToXYZ(c.stagger.staggerMiddle)
    if (column == 3) return tupleToXYZ(c.stagger.staggerRing)
    if (column >= 4) return tupleToXYZ(c.stagger.staggerPinky)
    else return tupleToXYZ(c.stagger.staggerInnerIndex)
  }

  const centerCol = c.upperKeys.columns / 2
  const centerRow = c.upperKeys.rows - match(c.upperKeys.rows, {
    3: 2.5,
    2: 2,
  }, 3)

  const keyPlane = upperKeysPlane(c)

  // Row 5 is used for thumb keys (in MT3, the 5th row key has zero tilt)
  // So don't use it for the non-thumb keys since it is special!
  // (hence the Math.min(x, 4)
  const row2Row = (r: number) => Math.min(6 - c.upperKeys.rows + r, 4)

  let modifierKeys: CuttleKey[] = []
  if (c.upperKeys.extraColumn == EXTRA_COLUMN.KEYS) {
    modifierKeys = range(0, cornerRow).map(row => ({
      type: switchType(c),
      keycap: { profile: keycapType(c), row: row2Row(row) },
      aspect: 1,
      cluster: 'fingers',
      position: new ETrsf().placeOnMatrix(mergedCurvature(c, false, {
        column: -1 - centerCol,
        row: row - centerRow,
      })).translate(dmColumnOffset(0)).transformBy(keyPlane),
    }))
  }
  if (c.upperKeys.extraColumn == EXTRA_COLUMN.CIRQUE_23) {
    modifierKeys = [{
      type: 'cirque-23mm',
      aspect: 1,
      cluster: 'fingers',
      size: { sides: 20 },
      position: new ETrsf().placeOnMatrix(mergedCurvature(c, false, {
        column: -1 - centerCol,
        row: 2.2 - centerRow,
      })).translate(dmColumnOffset(0)).translate(-3, 0, 0).transformBy(keyPlane).rotateToVertical(0.8),
    }]
  }
  if (c.upperKeys.extraColumn == EXTRA_COLUMN.CIRQUE_35) {
    modifierKeys = [{
      type: 'cirque-35mm',
      aspect: 1,
      cluster: 'fingers',
      size: { sides: 20 },
      position: new ETrsf().placeOnMatrix(mergedCurvature(c, false, {
        column: -1 - centerCol,
        row: 2.5 - centerRow,
      })).translate(dmColumnOffset(0)).translate(-7, 0, 0).transformBy(keyPlane).rotateToVertical(0.8),
    }]
  }
  if (c.upperKeys.extraColumn == EXTRA_COLUMN.CIRQUE_40) {
    modifierKeys = [{
      type: 'cirque-40mm',
      aspect: 1,
      cluster: 'fingers',
      size: { sides: 20 },
      position: new ETrsf().placeOnMatrix(mergedCurvature(c, false, {
        column: -1 - centerCol,
        row: 2.2 - centerRow,
      })).translate(dmColumnOffset(0)).translate(-10, 0, 0).transformBy(keyPlane).rotateToVertical(0.8),
    }]
  }
  if (c.upperKeys.extraColumn == EXTRA_COLUMN.OLED) {
    /* @ts-ignore */
    modifierKeys = [{
      type: 'oled-128x32-0.91in-adafruit',
      aspect: 1,
      cluster: 'fingers',
      position: new ETrsf().placeOnMatrix(mergedCurvature(c, false, {
        column: -1.1 - centerCol,
        row: 0.5 - centerRow,
      })).translate(dmColumnOffset(0)).transformBy(keyPlane).rotateToVertical(0.5),
    }].concat(
      range(2, cornerRow).map(row => ({
        type: 'blank',
        aspect: 1,
        cluster: 'fingers',
        position: new ETrsf().placeOnMatrix(mergedCurvature(c, false, {
          column: -1 - centerCol,
          row: row - centerRow,
        })).translate(dmColumnOffset(0)).transformBy(keyPlane).rotateToVertical(0.3),
      })),
    )
  }
  if (c.upperKeys.extraColumn == EXTRA_COLUMN.OLED_DF) {
    /* @ts-ignore */
    modifierKeys = [{
      type: 'oled-128x32-0.91in-dfrobot',
      aspect: 1,
      cluster: 'fingers',
      position: new ETrsf().placeOnMatrix(mergedCurvature(c, false, {
        column: -1 - centerCol,
        row: 0.5 - centerRow,
      })).translate(dmColumnOffset(0)).translate(0, 0, -4).transformBy(keyPlane).rotateToVertical(0.5),
    }]
  }

  const normalKeys = for2<number, number, CuttleKey>(columns, rows, (column, row) =>
    match(c.upperKeys.lastRow, {
      [LAST_ROW.ZERO]: row != lastRow,
      [LAST_ROW.TWO]: row != lastRow || [2, 3].includes(column),
      [LAST_ROW.FULL]: row != lastRow || ![0, 1].includes(column),
    }, true))(
      (column, row) => {
        const isBlank = c.upperKeys.lastRow == LAST_ROW.FULL && c.upperKeys.hideLastPinky
          && row == lastRow && column == lastCol
        return {
          type: isBlank ? 'blank' : switchType(c),
          keycap: keycapInfo(c, row2Row(row), column),
          aspect: usesWidePinky(column, row) ? pinkySize : 1,
          size: isBlank ? { width: 18.5, height: 18.5 } : undefined,
          cluster: 'fingers',
          position: new ETrsf().placeOnMatrix(mergedCurvature(c, column >= 4, {
            column: column - centerCol + (usesWidePinky(column, row) ? (pinkySize - 1) / 2 : 0),
            row: row - centerRow,
          })).translate(dmColumnOffset(column)).transformBy(keyPlane),
        } as CuttleKey
      },
    )

  // Compute finger splay after all the keys have been laid out with stagger etc.
  // Each finger is rotated about the bottom right corner of the column
  // (or top right if the spread angle is negative)
  // But there's a catch!
  // The finger splay should be applied BEFORE the keys are translated by their keyPlane.
  // This means I need to compute the inverse of keyPlane and apply that to the positions.
  // k.position.insertBeforeLast does the heavy lifting here and puts the rotation
  // right beore the keyPlane transformation in the stack of transformations.
  const keyPlaneInv = keyPlane.evaluate({ flat: true }, new Trsf()).invert()
  const stag = c.stagger
  // I need to remind myself that premultiply and translate apply their transformations last
  // While multiply and pretranslate go first.
  const spreadOriginsBot = normalKeys.map(col => col.length > 0 ? keyPosition(col[col.length - 1], false).pretranslate(8.75, -8.75, 0).premultiply(keyPlaneInv) : null)
  const spreadOriginsTop = normalKeys.map(col => col.length > 0 ? keyPosition(col[0], false).pretranslate(8.75, 8.75, 0).premultiply(keyPlaneInv) : null)
  const spreadAngles = [stag.staggerInnerIndex, stag.staggerIndex, stag.staggerMiddle, stag.staggerRing, stag.staggerPinky].map(s => decodeTuple(s)[3] / 45)
  console.log(spreadAngles)
  normalKeys.forEach((col, i) => {
    for (let j = Math.min(i, spreadAngles.length - 1); j >= 0; j--) {
      const angle = spreadAngles[j]
      const origin = angle < 0 ? spreadOriginsTop[j] : spreadOriginsBot[j]
      if (origin !== null && angle !== 0) {
        col.forEach(k =>
          k.position.insertBeforeLast(
            t => t.rotate(-angle, origin.xyz(), [0, 0, 1]),
          )
        )
      }
    }
  })

  return modifierKeys.concat(normalKeys.flat())
}

// function manuformFingers(m: Manuform): CuttleKey[] {
//     const c = m
//     return for2<number, number, CuttleKey>(columns(c),
//                                            rows(c),
//                                            (column, row) => match(lastRowCount(c), {
//                                                zero: row != lastRow(c),
//                                                two: row != lastRow(c) || [2, 3].includes(column),
//                                                full: row != lastRow(c) || ![0, 1].includes(column)
//                                            }),
//                                            (column, row) => match(inner(c), {
//                                                outie: !(column == -1 && cornerRow(c) <= row)
//                                            }, true))(
//         (column, row) => ({
//             type: (lastRowCount(c) == 'full' && hideLastPinky(c) &&
//                 row == lastRow(c) && column == lastCol(c)) ? 'blank' : keyType(m),
//             aspect: usesWidePinky(c, column, row) ? 1.667 : 1,
//             position: new ETrsf().placeOnMatrix({
//                 column: column - centerCol(c) + (usesWidePinky(c, column, row) ? (1.667-1)/2 : 0),
//                 row: row - centerRow(c),
//                 curvatureOfColumn: column >= 4 ? pinkyAlpha(c) : alpha(c),
//                 curvatureOfRow: beta(c),
//                 spacingOfRows: extraHeight(c) + 17.5,
//                 spacingOfColumns: extraWidth(c) + 17.5,
//             }).translate(dmColumnOffset(c, column)),
//             keycap: {
//                 profile: MANUFORM_KEYCAP_TYPE,
//                 row: row+1
//             },
//             // isOrigin: row == cornerRow(c) && column == 1
//         })).flat();
// }

export function upperKeysPlane(c: CuttleformProto) {
  return new Constant('upperKeysPlane')
    .rotate(c.curvature.tenting / 45, CENTER, Y, false)
    .rotate(c.curvature.rotateX / 45, CENTER, X, false)
    .translate(0, 0, 0, false) as Constant
}

export function thumbOrigin(c: DeepRequired<CuttleformProto>, wristRest = false) {
  const centerCol = c.upperKeys.columns / 2
  const centerRow = c.upperKeys.rows - match(c.upperKeys.rows, {
    3: 2.5,
    2: 2,
  }, 3)
  const cornerRow = c.upperKeys.rows - 2

  const thumbStagger = tupleToXYZA(c.stagger.staggerThumb)
  const origin = new Constant('thumbOrigin').rotate(thumbStagger.a, [0, 0, 0], [0, 0, 1])
  if (wristRest) {}
  else if (c.thumbCluster.oneofKind === 'carbonfetThumb') {
    origin.rotate(-9, [0, 0, 0], [1, 0, 0])
      .rotate(32, [0, 0, 0], [0, 1, 0])
      .rotate(-160, [0, 0, 0], [0, 0, 1])
      .translate(-26.2, -27.8, -8.9)
  } else if (c.thumbCluster.oneofKind === 'orbylThumb') {
    origin.translate(0, 0, -8)
      .rotate(10, CENTER, X)
      .rotate(-15, CENTER, Y)
      .rotate(5, CENTER, Z)
      .translate(-6 - 0.9 * 75 / 2 + 27 - 45, 3 - 0.1 * 75 / 2 + 3 - 21, -7 + 5)
  } else if (c.thumbCluster.oneofKind == 'customThumb') {
    const custom = c.thumbCluster.customThumb
    const rot = tupleToRot(custom.plane.rotation)
    origin.rotate(rot.alpha, CENTER, X)
      .rotate(rot.beta, CENTER, Y)
      .rotate(rot.gamma, CENTER, Z)
      .translate(tupleToXYZ(custom.plane.position))
  } else if (c.thumbCluster.oneofKind == 'defaultThumb') {
    // The first two rotations used to be marked as 3d-only (last optional arg = false)
    // However, this caused issues confusion with custom thumbs mode, which does not
    // support distinctions between 3d-only and 3d+2d transforms (see issue #7).
    origin
      .rotate(28.868421430528564, [0, 0, 0], [1, 0, 0])
      .rotate(12.366106707859005, [0, 0, 0], [0, 1, 0])
      .rotate(-47.28407717451374, [0, 0, 0], [0, 0, 1])
      .translate(-42, -43, -8)
      .translate(5, 10, 0) // Above comment applies to this translate too
  } else if (c.thumbCluster.oneofKind == 'curvedThumb') {
    origin
      .rotate(-11.890346750358203, [0, 0, 0], [1, 0, 0])
      .rotate(-24.800771474656102, [0, 0, 0], [0, 1, 0])
      .rotate(34.450218909733955, [0, 0, 0], [0, 0, 1])
      .translate(-35.78333333333333, -25.666666666666668, -7.083333333333333)
  }

  origin.translateBy(
    new ETrsf()
      .placeOnMatrix(mergedCurvature(c, false, {
        row: cornerRow - centerRow,
        column: 1 - centerCol,
      })).transformBy(upperKeysPlane(c)).translate(17.5 / 2, -17.5 / 2, 0),
  )

  origin.translate(thumbStagger.x, thumbStagger.y, thumbStagger.z)

  return origin
}

export function thumbs(c: DeepRequired<CuttleformProto>): CuttleKey[] {
  const cluster = c.thumbCluster
  const offset = thumbOrigin(c)

  if (cluster.oneofKind === 'defaultThumb') {
    return theDefaultThumbs(switchType(c), keycapType(c), cluster.defaultThumb.thumbCount, false, offset, cluster.defaultThumb.encoder && MAP_ENCODER[cluster.defaultThumb.encoderType])
  }
  if (cluster.oneofKind == 'curvedThumb') {
    return defaultThumbs(
      switchType(c),
      keycapType(c),
      cluster.curvedThumb.thumbCount as any,
      true,
      cluster.curvedThumb,
      offset,
      cluster.curvedThumb.encoder && MAP_ENCODER[cluster.curvedThumb.encoderType],
    )
  }
  if (cluster.oneofKind == 'orbylThumb') return orbylThumbs(switchType(c), keycapType(c), cluster.orbylThumb, offset)
  if (cluster.oneofKind == 'carbonfetThumb') return carbonfetThumbs(switchType(c), keycapType(c), cluster.carbonfetThumb, offset)
  if (cluster.oneofKind == 'customThumb') return customThumbs(switchType(c), keycapType(c), cluster.customThumb, offset)
  throw new Error(`Unknown thumb cluster type ${cluster.oneofKind}`)
}

export function manuformThumbs(m: Manuform): CuttleKey[] {
  const offset: Point = [m.shaping.thumbClusterOffsetX, m.shaping.thumbClusterOffsetY, m.shaping.thumbClusterOffsetZ]

  // if (m.keys.thumbType == "default") return defaultThumbs(keyType(m), MANUFORM_KEYCAP_TYPE, thumbCount(m), false, m.shaping, offset)
  // if (m.keys.thumbType == "curved") return defaultThumbs(keyType(m), MANUFORM_KEYCAP_TYPE, thumbCount(m), true, curvedShaping as any, offset)
  // if (m.keys.thumbType == "orbyl") return orbylThumbs(keyType(m), MANUFORM_KEYCAP_TYPE, offset)
  // if (m.keys.thumbType == "carbonfet") return carbonfetThumbs(keyType(m), MANUFORM_KEYCAP_TYPE, offset)
  throw new Error(`Unknown thumb cluster type ${m.keys.thumbType}`)
}

function thumbCount(m: Manuform): DTKEYS {
  return {
    'two': DTKEYS.TWO,
    'three-mini': DTKEYS.THREE,
    'three': DTKEYS.THREE_15,
    'four': DTKEYS.FOUR,
    'five': DTKEYS.FIVE,
    'six': DTKEYS.SIX,
  }[m.keys.thumbCount]!
}

const ID_TO_TYPE: Record<number, CuttleKey['type']> = {
  1: 'ec11',
  2: 'trackball',
  3: 'cirque-23mm',
  4: 'cirque-35mm',
  5: 'cirque-40mm',
  6: 'evqwgd001',
}
const TYPE_TO_ID = reverseMap(ID_TO_TYPE)

const ML_THUMBS = [DTKEYS.SIX, DTKEYS.FOUR, DTKEYS.THREE, DTKEYS.THREE_15]
const MR_THUMBS = [DTKEYS.SIX, DTKEYS.FIVE, DTKEYS.FOUR]
const BL_THUMBS = [DTKEYS.SIX, DTKEYS.FIVE]
const BR_THUMBS = [DTKEYS.SIX, DTKEYS.FIVE]

type KeyType = CuttleKeycapKey['type']
type CapType = Required<CuttleKeycapKey>['keycap']['profile']

function customThumbs(keyType: KeyType, capType: CapType, custom: Cuttleform_CustomThumb, offset: ETrsf): CuttleKey[] {
  return custom.key.map(k => {
    const customId = decodeTuple(k.position!)[3]
    const customType = ID_TO_TYPE[customId] ?? keyType

    const rot = tupleToRot(k.rotation!)
    console.log('decode aspect', rot.extra)
    let newKey = {
      type: customType,
      aspect: rot.extra < 0 ? -100 / rot.extra : rot.extra / 100,
      cluster: 'thumbs',
      position: new ETrsf()
        .rotate(rot.alpha, CENTER, X)
        .rotate(rot.beta, CENTER, Y)
        .rotate(rot.gamma, CENTER, Z)
        .translate(tupleToXYZ(k.position!))
        .transformBy(offset),
    }
    if (customType.startsWith('cirque')) {
      return {
        ...newKey,
        type: customType,
        size: { sides: k.trackballSides },
      } as CuttleTrackpadKey
    }
    if (k.trackballRadius && k.trackballSides) {
      return {
        ...newKey,
        type: 'trackball',
        size: {
          radius: k.trackballRadius / 10,
          sides: k.trackballSides,
        },
      }
    } else if (customId > 0) return newKey as CuttleKey
    else {return {
        ...newKey,
        keycap: { profile: capType, row: 5 },
      } as CuttleKey}
  })
}

function theDefaultThumbs(keyType: KeyType, capType: CapType, count: DTKEYS, five: boolean, offset: ETrsf, encoder?: 'ec11' | 'evqwgd001' | false): CuttleKey[] {
  if (count == DTKEYS.ZERO) return []

  const topAspect = five || count == DTKEYS.THREE ? 1 : 1.5
  const topTrsf = () => topAspect > 1 ? new ETrsf().rotate(90) : new ETrsf()
  const thumbBase = {
    type: keyType,
    keycap: {
      profile: capType,
      row: 5,
    },
    cluster: 'thumbs',
  }

  let topLeft: CuttleKey = {
    ...thumbBase,
    keycap: { profile: capType, row: 5, letter: ' ', home: 'thumb' },
    aspect: topAspect,
    position: topTrsf()
      // .rotate(-15, [0, 0, 0], [1, 0, 0])
      .rotate(-3, [0, 0, 0], [0, 1, 0])
      .rotate(66, [0, 0, 0], [0, 0, 1])
      .translate(-13.4, 17, -0.1)
      .transformBy(offset),
  }
  let topRight: CuttleKey = {
    ...thumbBase,
    aspect: topAspect,
    position: topTrsf()
      // .rotate(-15, [0, 0, 0], [1, 0, 0])
      .rotate(-3, [0, 0, 0], [0, 1, 0])
      .rotate(66, [0, 0, 0], [0, 0, 1])
      .translate(1.3, 33.6, -0.1)
      .transformBy(offset),
  }
  let middleLeft: CuttleKey = {
    ...thumbBase,
    aspect: 1,
    position: new ETrsf()
      .rotate(-6, [0, 0, 0], [1, 0, 0])
      .rotate(-5, [0, 0, 0], [0, 1, 0])
      .rotate(95, [0, 0, 0], [0, 0, 1])
      .translate(-15, -6, 0)
      .transformBy(offset),
  }
  let middleRight: CuttleKey = {
    ...thumbBase,
    aspect: 1,
    position: new ETrsf()
      .rotate(-14, [0, 0, 0], [1, 0, 0])
      .rotate(-4, [0, 0, 0], [0, 1, 0])
      .rotate(101, [0, 0, 0], [0, 0, 1])
      .translate(11.3, 1.0, 1.3)
      .transformBy(offset),
  }
  let bottomLeft: CuttleKey = {
    ...thumbBase,
    aspect: 1,
    position: new ETrsf()
      .rotate(-10, [0, 0, 0], [1, 0, 0])
      .rotate(-4, [0, 0, 0], [0, 1, 0])
      .rotate(105, [0, 0, 0], [0, 0, 1])
      .translate(-4, -25, -0.4)
      .transformBy(offset),
  }
  let bottomRight: CuttleKey = {
    ...thumbBase,
    aspect: 1,
    position: new ETrsf()
      .rotate(-21, [0, 0, 0], [1, 0, 0])
      .rotate(-2, [0, 0, 0], [0, 1, 0])
      .rotate(106, [0, 0, 0], [0, 0, 1])
      .translate(18.4, -18.5, -0.6)
      .transformBy(offset),
  }

  if (encoder) {
    if (count == DTKEYS.SIX || count == DTKEYS.FIVE) {
      bottomLeft = {
        type: encoder,
        aspect: bottomLeft.aspect,
        position: bottomLeft.position,
        cluster: 'thumbs',
      }
    } else if (count == DTKEYS.FOUR || count == DTKEYS.THREE || count == DTKEYS.THREE_15) {
      middleLeft = {
        type: encoder,
        aspect: middleLeft.aspect,
        position: middleLeft.position,
        cluster: 'thumbs',
      }
    } else {
      topLeft = {
        type: encoder,
        aspect: topLeft.aspect,
        position: topLeft.position,
        cluster: 'thumbs',
      }
    }
  }

  // if (encoder) {
  // bottomLeft = {
  // type: "ec11",
  // aspect: bottomLeft.aspect,
  // position: bottomLeft.position,
  // }
  // }

  const thumbs: CuttleKey[] = [topLeft, topRight]
  if (ML_THUMBS.includes(count) && !(five && count == DTKEYS.SIX)) thumbs.push(middleLeft)
  if (MR_THUMBS.includes(count)) thumbs.push(middleRight)
  if (BL_THUMBS.includes(count)) thumbs.push(bottomLeft)
  if (BR_THUMBS.includes(count)) thumbs.push(bottomRight)
  return thumbs
}

function defaultThumbs(keyType: KeyType, capType: CapType, count: DTKEYS, five: boolean, opts: Required<Cuttleform_CurvedThumb>, offset: ETrsf, encoder?: 'ec11' | 'evqwgd001' | false): CuttleKey[] {
  if (count == DTKEYS.ZERO) return []

  const topAspect = five || count == DTKEYS.THREE ? 1 : 1 / 1.5
  const thumbBase = {
    type: keyType,
    keycap: {
      profile: capType,
      row: 5,
    },
    cluster: 'thumbs',
  }

  const curvature = thumbCurvature({ oneofKind: 'curvedThumb', curvedThumb: opts })

  let topLeft: CuttleKey = {
    ...thumbBase,
    keycap: { profile: capType, row: 5, letter: ' ', home: 'thumb' },
    aspect: topAspect,
    position: new ETrsf()
      .rotate(17.8, [0, 0, 0], [1, 0, 0])
      .rotate(3.3, [0, 0, 0], [0, 1, 0])
      .rotate(-8.2, [0, 0, 0], [0, 0, 1])
      .placeOnMatrix(mergeCurvature(curvature, {
        column: 0.4,
        row: -0.34,
      }, 'thumbCurvature'))
      .translate(0, 0, 3.4)
      .transformBy(offset),
  }
  let topRight: CuttleKey = {
    ...thumbBase,
    aspect: topAspect,
    position: new ETrsf()
      .rotate(15.1, [0, 0, 0], [1, 0, 0])
      .rotate(16, [0, 0, 0], [0, 1, 0])
      .rotate(-21.8, [0, 0, 0], [0, 0, 1])
      .placeOnMatrix(mergeCurvature(curvature, {
        column: 1.43,
        row: -0.06,
      }, 'thumbCurvature'))
      .translate(0, 0, 0.3)
      .transformBy(offset),
  }
  let middleLeft: CuttleKey = {
    ...thumbBase,
    aspect: 1,
    position: new ETrsf()
      .rotate(20.4, CENTER, X)
      .rotate(-10.1, CENTER, Y)
      .rotate(2.6, CENTER, Z)
      .placeOnMatrix(mergeCurvature(curvature, {
        column: -0.72,
        row: -0.42,
      }, 'thumbCurvature'))
      .translate(0, 0, 3.0)
      .transformBy(offset),
  }
  let middleRight: CuttleKey = {
    ...thumbBase,
    aspect: 1,
    position: new ETrsf()
      .rotate(17.8, CENTER, X)
      .rotate(3.3, CENTER, Y)
      .rotate(-8.2, CENTER, Z)
      .placeOnMatrix(mergeCurvature(curvature, {
        column: 0.29,
        row: 0.67,
      }, 'thumbCurvature'))
      .translate(0, 0, -4.3)
      .transformBy(offset),
  }
  let bottomLeft: CuttleKey = {
    ...thumbBase,
    aspect: 1,
    position: new ETrsf()
      .rotate(18.2, CENTER, X)
      .rotate(-7.1, CENTER, Y)
      .rotate(-1, CENTER, Z)
      .placeOnMatrix(mergeCurvature(curvature, {
        column: -0.64,
        row: -0.44,
      }, 'thumbCurvature'))
      .translate(0, 0, 3.0)
      .transformBy(offset),
  }
  let bottomRight: CuttleKey = {
    ...thumbBase,
    aspect: 1,
    position: new ETrsf()
      .rotate(18.3, CENTER, X)
      .rotate(-9.1, CENTER, Y)
      .rotate(-1.5, CENTER, Z)
      .placeOnMatrix(mergeCurvature(curvature, {
        column: -0.75,
        row: 0.58,
      }, 'thumbCurvature'))
      .translate(0, 0, -5.4)
      .transformBy(offset),
  }
  if (encoder) {
    if (count == DTKEYS.FIVE) {
      bottomLeft = {
        type: encoder,
        aspect: bottomLeft.aspect,
        position: bottomLeft.position,
        cluster: 'thumbs',
      }
    } else if (count == DTKEYS.FOUR || count == DTKEYS.THREE) {
      middleLeft = {
        type: encoder,
        aspect: middleLeft.aspect,
        position: middleLeft.position,
        cluster: 'thumbs',
      }
    } else {
      topLeft = {
        type: encoder,
        aspect: topLeft.aspect,
        position: topLeft.position,
        cluster: 'thumbs',
      }
    }
  }

  const thumbs: CuttleKey[] = [topLeft, topRight]
  if (ML_THUMBS.includes(count) && !(five && count == DTKEYS.SIX)) thumbs.push(middleLeft)
  if (MR_THUMBS.includes(count)) thumbs.push(middleRight)
  if (BL_THUMBS.includes(count)) thumbs.push(bottomLeft)
  if (BR_THUMBS.includes(count)) thumbs.push(bottomRight)
  return thumbs
}

export function thumbCurvature(t: CuttleformProto['thumbCluster']) {
  if (t.oneofKind == 'orbylThumb') {
    return {
      curvature: t.orbylThumb.curvature / 45,
      spacing: 18.75,
    }
  } else if (t.oneofKind == 'carbonfetThumb') {
    return {
      curvatureOfRow: t.carbonfetThumb.rowCurve / 45,
      curvatureOfColumn: t.carbonfetThumb.columnCurve / 45,
      spacingOfColumns: t.carbonfetThumb.horizontalSpacing / 10,
      spacingOfRows: t.carbonfetThumb.verticalSpacing / 10,
    }
  } else if (t.oneofKind == 'curvedThumb') {
    return {
      curvatureOfRow: t.curvedThumb.rowCurve / 45,
      curvatureOfColumn: t.curvedThumb.columnCurve / 45,
      spacingOfColumns: t.curvedThumb.horizontalSpacing / 10,
      spacingOfRows: t.curvedThumb.verticalSpacing / 10,
    }
  }
  return {
    curvatureOfRow: 0,
    curvatureOfColumn: 0,
    spacingOfColumns: 20,
    spacingOfRows: 20,
  }
}

export function carbonfetThumbs(keyType: KeyType, capType: CapType, opts: Required<Cuttleform_CarbonfetThumb>, offset: ETrsf): CuttleKey[] {
  const thumbBase = {
    type: keyType,
    keycap: { profile: capType, row: 5 },
    cluster: 'thumbs',
  }
  const curvature = thumbCurvature({ oneofKind: 'carbonfetThumb', carbonfetThumb: opts })

  return [{
    ...thumbBase,
    aspect: 1,
    position: new ETrsf().placeOnMatrix(mergeCurvature(curvature, {
      column: -1,
      row: .7,
    }, 'thumbCurvature')).transformBy(offset),
  }, {
    ...thumbBase,
    aspect: 1,
    position: new ETrsf().placeOnMatrix(mergeCurvature(curvature, {
      column: -1,
      row: -0.3,
    }, 'thumbCurvature')).transformBy(offset),
  }, {
    ...thumbBase,
    keycap: { profile: capType, row: 5, home: 'thumb' },
    aspect: 1.5,
    position: new ETrsf().rotate(-90).placeOnMatrix(mergeCurvature(curvature, {
      column: 0,
      row: 0.575,
    }, 'thumbCurvature')).transformBy(offset),
  }, {
    ...thumbBase,
    aspect: 1,
    position: new ETrsf().placeOnMatrix(mergeCurvature(curvature, {
      column: 0,
      row: -0.675,
    }, 'thumbCurvature')).transformBy(offset),
  }, {
    ...thumbBase,
    aspect: 1.5,
    position: new ETrsf().rotate(-90).placeOnMatrix(mergeCurvature(curvature, {
      column: 1,
      row: 0.45,
    }, 'thumbCurvature')).transformBy(offset),
  }, {
    ...thumbBase,
    aspect: 1,
    position: new ETrsf().placeOnMatrix(mergeCurvature(curvature, {
      column: 1,
      row: -0.8,
    }, 'thumbCurvature')).transformBy(offset),
  }]
}

export function orbylThumbs(keyType: KeyType, capType: CapType, opts: Cuttleform_OrbylThumb, offset: ETrsf): CuttleKey[] {
  const thumbBase = {
    type: keyType,
    keycap: {
      profile: capType,
      row: 5,
    },
    cluster: 'thumbs',
  }
  const curvature = thumbCurvature({
    oneofKind: 'orbylThumb',
    orbylThumb: {
      curvature: opts.curvature!,
    },
  })

  // offset = [offset[0]-6 + -.9 * 75/2 + 27 - 45, offset[1]+3 + -.1 * 75 / 2 + 3 - 20, offset[2]-7 + 5]

  return [{
    ...thumbBase,
    aspect: 1,
    position: new ETrsf().placeOnSphere(mergeCurvature(curvature, {
      angle: 10,
      row: 1.85,
    }, 'thumbCurvature')).transformBy(offset),
  }, {
    ...thumbBase,
    aspect: 1,
    keycap: { profile: capType, row: 5, home: 'thumb' },
    position: new ETrsf().placeOnSphere(mergeCurvature(curvature, {
      angle: -40,
      row: 2,
    }, 'thumbCurvature')).transformBy(offset),
  }, {
    ...thumbBase,
    aspect: 1,
    position: new ETrsf().placeOnSphere(mergeCurvature(curvature, {
      angle: -90,
      row: 2,
    }, 'thumbCurvature')).transformBy(offset),
  }, {
    ...thumbBase,
    aspect: 1,
    position: new ETrsf().placeOnSphere(mergeCurvature(curvature, {
      angle: -140,
      row: 2,
    }, 'thumbCurvature')).transformBy(offset),
  }, {
    type: 'trackball',
    aspect: 1,
    cluster: 'thumbs',
    size: {
      radius: 20.9,
      sides: 20,
    },
    position: new ETrsf()
      .translate(0, 0, 8)
      .transformBy(offset),
  }]
}
export function matrixToRPY(R: Matrix4): [number, number, number] {
  const e = R.elements
  const Z_rot = Math.atan2(e[1], e[0])
  const Y_rot = Math.atan2(-e[2], Math.sqrt(Math.pow(e[6], 2) + Math.pow(e[10], 2)))
  const X_rot = Math.atan2(e[6], e[10])
  return [X_rot * 180 / Math.PI, Y_rot * 180 / Math.PI, Z_rot * 180 / Math.PI]
}

export function matrixToConfig(m: Matrix4, key: CuttleKey | undefined = undefined): Cuttleform_CustomThumb_Key {
  const translation = new Vector3().setFromMatrixPosition(m)
  const rpy = matrixToRPY(m)
  const aspect = key?.aspect || 1
  const keyType = key ? TYPE_TO_ID[key.type] : 0

  const roundSize = key ? keyRoundSize(key) : undefined
  return {
    position: encodeTuple([Math.round(translation.x * 10), Math.round(translation.y * 10), Math.round(translation.z * 10), keyType]),
    rotation: encodeTuple([Math.round(rpy[0] * 45), Math.round(rpy[1] * 45), Math.round(rpy[2] * 45), Math.round((aspect < 1 ? -1 / aspect : aspect) * 100)]),
    trackballRadius: key?.type == 'trackball' ? Math.round(roundSize!.radius * 10) : undefined,
    /* @ts-ignore */
    trackballSides: roundSize?.sides,
  }
}

export function findKeyByAttr(config: Cuttleform, attr: 'home' | 'letter', value: string) {
  return config.keys.find(k => 'keycap' in k && k.keycap && k.keycap[attr] == value)
}

function cirqueRadius(type: string) {
  if (type == 'cirque-23mm') return 12.4
  if (type == 'cirque-35mm') return 18.4
  if (type == 'cirque-40mm') return 20.9
  throw new Error('Unknown trackpad type ' + type)
}

export type Geometry = BaseGeometry<Cuttleform>

export function newGeometry(c: Cuttleform): Geometry {
  if (c.shell.type == 'stilts') {
    return new StiltsGeometry(c as SpecificCuttleform<StiltsShell>)
  }
  if (c.shell.type == 'block') {
    return new BlockGeometry(c as SpecificCuttleform<BlockShell>)
  }
  if (c.shell.type == 'tilt') {
    return new TiltGeometry(c as SpecificCuttleform<TiltShell>)
  }
  return new BaseGeometry(c)
}
