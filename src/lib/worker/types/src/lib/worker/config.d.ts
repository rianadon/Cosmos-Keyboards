import type manuform from '$assets/manuform.json'
import { Matrix4 } from 'three'
import {
  CONNECTOR,
  type Cuttleform as CuttleformProtoP,
  Cuttleform_CarbonfetThumb,
  Cuttleform_CustomThumb_Key,
  type Cuttleform_OrbylThumb,
  KEY_SIZE,
  MICROCONTROLLER,
  SCREW_SIZE,
  SCREW_TYPE,
} from '../../../target/proto/cuttleform'
import { BaseGeometry } from './cachedGeometry'
import ETrsf, { Constant } from './modeling/transformation-ext'
type DeepRequired<T> = Required<
  {
    [K in keyof T]: DeepRequired<T[K]>
  }
>
export type CuttleformProto = DeepRequired<CuttleformProtoP>
export type Manuform = typeof manuform.options
type Point = [number, number, number]
export interface SpecificCuttleform<S> {
  wallThickness: number
  wallShrouding: number
  webThickness: number
  keys: CuttleKey[]
  connector: 'usb' | 'trrs' | null
  connectorIndex: number
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
    | null
  verticalClearance: number
  clearScrews: boolean
  rounded: {
    side?: {
      divisor: number
    }
    top?: {
      horizontal: number
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
  position: ETrsf
  aspect: number
  cluster: string
}
export interface Keycap {
  profile: 'dsa' | 'mt3' | 'oem' | 'sa' | 'xda' | 'choc' | 'cherry'
  row: number
  letter?: string
  home?: 'thumb' | 'index' | 'middle' | 'ring' | 'pinky'
}
interface CuttleKeycapKey extends CuttleBaseKey {
  type: 'box' | 'mx-original' | 'mx-better' | 'mx-snap-in' | 'alps' | 'choc' | 'mx-pcb' | 'mx-hotswap' | 'mx-snap-in-hotswap' | 'choc-hotswap'
  keycap: Keycap
}
interface CuttleBasicKey extends CuttleBaseKey {
  type: 'blank' | 'ec11' | 'oled-128x32-0.91in-adafruit'
}
interface CuttleTrackballKey extends CuttleBaseKey {
  type: 'trackball' | 'cirque-23mm' | 'cirque-35mm' | 'cirque-40mm'
  trackball: {
    radius: number
    sides: number
  }
}
export type CuttleKey = CuttleKeycapKey | CuttleBasicKey | CuttleTrackballKey
export declare const MAP_SCREW_SIZE: Record<SCREW_SIZE, Cuttleform['screwSize']>
export declare const MAP_SCREW_TYPE: Record<SCREW_TYPE, Cuttleform['screwType']>
export declare const MAP_KEY_SIZE: Record<KEY_SIZE, number>
export declare const MAP_MICROCONTROLLER: Record<MICROCONTROLLER, Cuttleform['microcontroller'] | null>
export declare const MAP_CONNECTOR: Record<CONNECTOR, Cuttleform['connector']>
export declare function cScrewHeight(size: string): '6mm' | '0.25"'
export declare function screwHeight(c: CuttleformProto): '6mm' | '0.25"'
export declare function cuttleConf(c: DeepRequired<CuttleformProto>): Cuttleform
export declare function curvature(pinky: boolean, c: DeepRequired<CuttleformProto>): {
  merged: {
    curvatureOfColumn: number
    curvatureOfRow: number
    spacingOfRows: number
    spacingOfColumns: number
  }
  unmerged: {
    curvatureOfColumn: number
  }
  name: string
}
export declare function decodeTuple(tuple: bigint): number[]
export declare function encodeTuple(values: number[]): bigint
export declare function tupleToRot(tuple: bigint): {
  alpha: number
  beta: number
  gamma: number
  extra: number
}
export declare function tupleToXYZ(tuple: bigint): Point
export declare function fingers(c: DeepRequired<CuttleformProto>): CuttleKey[]
export declare function upperKeysPlane(c: CuttleformProto): Constant
export declare function thumbOrigin(c: DeepRequired<CuttleformProto>, wristRest?: boolean): Constant
export declare function thumbs(c: DeepRequired<CuttleformProto>): CuttleKey[]
export declare function manuformThumbs(m: Manuform): CuttleKey[]
type KeyType = CuttleKeycapKey['type']
type CapType = Required<CuttleKeycapKey>['keycap']['profile']
export declare function thumbCurvature(t: CuttleformProto['thumbCluster']): {
  curvature: number
  spacing: number
  curvatureOfRow?: undefined
  curvatureOfColumn?: undefined
  spacingOfColumns?: undefined
  spacingOfRows?: undefined
} | {
  curvatureOfRow: number
  curvatureOfColumn: number
  spacingOfColumns: number
  spacingOfRows: number
  curvature?: undefined
  spacing?: undefined
}
export declare function carbonfetThumbs(keyType: KeyType, capType: CapType, opts: Required<Cuttleform_CarbonfetThumb>, offset: ETrsf): CuttleKey[]
export declare function orbylThumbs(keyType: KeyType, capType: CapType, opts: Cuttleform_OrbylThumb, offset: ETrsf): CuttleKey[]
export declare function matrixToRPY(R: Matrix4): [number, number, number]
export declare function matrixToConfig(m: Matrix4, key?: CuttleKey | undefined): Cuttleform_CustomThumb_Key
export declare function findKeyByAttr(config: Cuttleform, attr: 'home' | 'letter', value: string): CuttleKey
export type Geometry = BaseGeometry<Cuttleform>
export declare function newGeometry(c: Cuttleform): Geometry
export {}
