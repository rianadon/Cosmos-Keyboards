/**
 * For now, the new serializationf format for Cosmos is kept in a separate file.
 */

import { UNIFORM } from '$lib/geometry/keycaps'
import ETrsf, { mirror } from '$lib/worker/modeling/transformation-ext'
import { T } from '@threlte/core'
// import { deserialize } from 'src/routes/beta/lib/serialize'
import { Matrix4, Vector3 } from 'three'
import { Cluster, Curvature, Key, Keyboard, KeyboardExtra } from '../../../target/proto/cosmos'
import { type Cuttleform, type CuttleKey, type CuttleKeycapKey, encodeTuple, type Keycap, matrixToRPY, tupleToRot, tupleToXYZ } from './config'
import { DEFAULT_MWT_FACTOR } from './geometry.thickWebs'
import Trsf from './modeling/transformation'
import { DefaultMap, TallyMap } from './util'

const CLUSTER_TYPE = ['matrix', 'sphere'] as const
const CLUSTER_NAME = ['fingers', 'thumbs' as const]
const CLUSTER_SIDE = ['right', 'left'] as const
type ClusterType = typeof CLUSTER_TYPE[number]
type ClusterName = typeof CLUSTER_NAME[number]
type ClusterSide = typeof CLUSTER_SIDE[number]

function calcOffsetId<E>(items: Record<number, E[]>, e: E, msg: string) {
  for (const [offset, elems] of Object.entries(items)) {
    if (elems.includes(e)) return Number(offset) + elems.indexOf(e)
  }
  throw new Error(`No id for ${msg} ${e}`)
}
function lookupOffsetId<E>(items: Record<number, E[]>, id: number, msg: string) {
  for (const [offset, elems] of Object.entries(items)) {
    const off = Number(offset)
    if (off <= id && id < off + elems.length) return elems[id - off]
  }
  throw new Error(`No ${msg} for id ${id}`)
}

function calcId<E>(items: readonly E[], e: E, msg: string) {
  const idx = items.indexOf(e)
  if (idx >= 0) return idx
  throw new Error(`No id for ${msg} ${e}`)
}

function lookupId<E>(items: readonly E[], id: number, msg: string) {
  const item = items[id]
  if (typeof item !== 'undefined') return item
  throw new Error(`No ${msg} for id ${id}`)
}

function makeBooleanEncoder<K extends string>(fields: K[]) {
  return function(map: Record<K, boolean>) {
    let bits = 0
    let shift = 0
    for (const field of fields) {
      bits |= Number(map[field]) << shift
      shift++
    }
    return bits
  }
}

function makeBooleanDecoder<K extends string>(fields: K[]) {
  return function(bits: number) {
    // @ts-ignore
    const decoded: Record<K, boolean> = {}
    for (const field of fields) {
      decoded[field] = !!(bits & 1)
      bits >>= 1
    }
    return decoded
  }
}

// ----------  PARTS ----------
// The part ids are designed as follows:
// (variant = 7bits) (id = 7bits)
// The variant can be omitted if it's inherited.

// For keys with keycaps, the variant field determins the aspect ratio.
// Otherwise, this is used for stuff like trackballs to determine the combination
// of sensor boards, size, etc.

/**
 * Mapping of offsets to list of parts at that offset.
 * The old parts are given a big offset so that new stuff gets lower ids,
 * which are more efficiently encoded.
 */
const PARTS: Record<number, (CuttleKey['type'] | 'inherit')[]> = {
  0: [
    // Things that get placed a lot in the model.
    'inherit', // Special type for inheriting the global type
    'mx-better',
    'mx-pcb',
    'mx-hotswap',
    'alps',
    'choc',
    'choc-hotswap',
    'blank',
  ],
  16: [
    // You wouldn't put many of these o a keyboard.
    'ec11',
    'oled-128x32-0.91in-adafruit',
    'oled-128x32-0.91in-dfrobot',
    'evqwgd001',
    'joystick-joycon-adafruit',
    'joystick-ps2-40x45',
    'trackball',
    'trackpad-cirque',
  ],
  16000: [
    // Old stuff no one should be using.
    'old-mx',
    'old-box',
    'old-mx-hotswap',
    'old-mx-hotswap',
    'old-mx-snap-in-hotswap',
  ],
}

/**
 * List of parts that are used with physical keys.
 * All of these have configurable key aspect ratios.
 */
const PARTS_WITH_KEYCAPS = [
  'mx-better',
  'mx-pcb',
  'mx-hotswap',
  'alps',
  'choc',
  'choc-hotswap',
  'old-mx',
  'old-box',
  'old-mx-hotswap',
  'old-mx-hotswap',
  'old-mx-snap-in-hotswap',
  'blank',
]

interface PartType {
  type?: CuttleKey['type']
  aspect?: number
}

function encodePartType(key: PartType) {
  const partId = calcOffsetId(PARTS, key.type, 'part type')
  let variant = 0
  if (typeof key.aspect !== 'undefined') {
    if (key.aspect == 0) throw new Error('Key aspect must be nonzero')
    if (key.aspect >= 0) variant = Math.round(key.aspect * 32)
    else variant = 0x40 | Math.round(-key.aspect * 32)
  }
  return (variant << 7) | partId
}

function decodePartType(type: number): PartType {
  const partId = type & 0x7F
  const variant = (type >> 7) & 0x7F
  const partType = lookupOffsetId(PARTS, partId, 'part type')
  if (PARTS_WITH_KEYCAPS.includes(partType)) {
    return {
      type: partType,
      aspect: (variant & 0x40) ? -(variant & 0x3F) / 32 : variant / 32,
    }
  }
  return {
    type: partType,
    aspect: 0,
  }
}

// ----------  PROFILES ----------
const PROFILES: (Keycap['profile'] | 'inherit')[] = ['inherit', 'dsa', 'mt3', 'oem', 'sa', 'xda', 'choc', 'cherry', 'des'] as any
const HOMING: (Keycap['home'] | null)[] = [null, 'thumb', 'index', 'middle', 'ring', 'pinky']
const LETTERS = ['F6', '6', 'y', 'h', 'n', '{', 'F7', '7', 'u', 'j', 'm', '}', 'F8', '8', 'i', 'k', ',', '[', 'F9', '9', 'o', 'l', '.', ']', 'F10', '0', 'p', ';', '/', '\\']
const INFERRED_HOMING = { [LETTERS.indexOf('j')]: 'index', [LETTERS.indexOf('k')]: 'middle', [LETTERS.indexOf('l')]: 'ring', [LETTERS.indexOf(';')]: 'pinky' } as const

interface Profile {
  profile: Keycap['profile'] // 4 bits
  row: number // 3 bits
  letter?: string // 7 bits
  home?: Keycap['home'] | null // 3 bits
}

function encodeProfile(p: Profile) {
  let row = p.row
  if (UNIFORM.includes(p.profile)) row = 1
  if (row < 1 || row > 8) throw new Error('Row out of bounds')
  let letter = 0
  let inferredHome: typeof INFERRED_HOMING[number] | undefined = undefined
  if (p.letter && p.letter.length) {
    if (LETTERS.includes(p.letter)) {
      letter = (LETTERS.indexOf(p.letter) << 1) | 1
      inferredHome = INFERRED_HOMING[letter >> 1]
    } else letter = p.letter.charCodeAt(0) << 1
  }
  return calcId(PROFILES, p.profile, 'profile')
    | ((row - 1) << 4)
    | (letter << 7)
    | (calcId(HOMING, diff(p.home, inferredHome) ?? null, 'home') << 14)
}

function decodeProfile(flags: number): Profile {
  const letterId = (flags >> 7) & 0x7F
  let letter = letterId > 0 ? String.fromCharCode(letterId >> 1) : undefined
  let inferredHoming = undefined
  if (letterId & 1) {
    letter = lookupId(LETTERS, letterId >> 1, 'letter')
    inferredHoming = INFERRED_HOMING[letterId >> 1]
  }
  const profile = lookupId(PROFILES, flags & 0xf, 'profile')
  let row = ((flags >> 4) & 0x7) + 1
  if (UNIFORM.includes(profile)) row = 5
  const homing = lookupId(HOMING, (flags >> 14) & 0x7, 'homing')
  return { profile, row, letter, home: homing || inferredHoming || undefined }
}

// ----------  CONNECTORS ----------
// Connector type is encoded with 3 bits (8 possible values) and size another 3 (8 possible values)

const CONNECTORS: Cuttleform['connector'][] = [null, 'usb', 'trrs']
const CONNECTOR_SIZES: Cuttleform['connectorSizeUSB'][] = ['slim', 'average', 'big']

interface Connector {
  connector: Cuttleform['connector']
  connectorSizeUSB: Cuttleform['connectorSizeUSB']
}

function encodeConnector(connector: Connector) {
  const connId = calcId(CONNECTORS, connector.connector, 'connector')
  const sizeId = calcId(CONNECTOR_SIZES, connector.connectorSizeUSB, 'connector size')
  return connId + (sizeId << 3)
}

function decodeConnector(id: number): Connector {
  const connId = id & 0x7
  const sizeId = (id >> 3) & 0x7
  return {
    connector: lookupId(CONNECTORS, connId, 'connector'),
    connectorSizeUSB: lookupId(CONNECTOR_SIZES, sizeId, 'connector size'),
  }
}
// ----------  SCREWS ----------
// screw type (3bit), size (3bit), countersink (1bit), clear screws (1bit)
const SCREW_TYPES: Cuttleform['screwType'][] = ['screw insert', 'tapered screw insert', 'expanding screw insert', 'tapped hole']
const SCREW_SIZES: Cuttleform['screwSize'][] = ['M3', 'M4', '#4-40', '#6-32']

interface ScrewFlags {
  screwType: Cuttleform['screwType']
  screwSize: Cuttleform['screwSize']
  screwCountersink: Cuttleform['screwCountersink']
  clearScrews: Cuttleform['clearScrews']
}

function encodeScrewFlags(flags: ScrewFlags) {
  return Number(flags.clearScrews)
    | (Number(flags.screwCountersink) << 1)
    | (calcId(SCREW_SIZES, flags.screwSize, 'screw size') << 2)
    | (calcId(SCREW_TYPES, flags.screwType, 'screw type') << 5)
}

function decodeScrewFlags(flags: number) {
  return {
    screwType: lookupId(SCREW_TYPES, (flags >> 5) & 0x1F, 'screw type'),
    screwSize: lookupId(SCREW_SIZES, (flags >> 2) & 0x1F, 'screw size'),
    screwCountersink: !!(flags & 0x3),
    clearScrews: !!(flags & 0x1),
  }
}

// ----------  MICROCONTROLLER ----------
const MICROCONTROLLERS: Cuttleform['microcontroller'][] = [
  null,
  'pi-pico',
  'promicro',
  'promicro-usb-c',
  'itsybitsy-adafruit',
  'kb2040-adafruit',
  'rp2040-black-usb-c-aliexpress',
  'nrfmicro-or-nicenano',
  'seeed-studio-xiao',
  'waveshare-rp2040-zero',
  'weact-studio-ch552t',
]
const encodeMicrocontrollerFlags = makeBooleanEncoder(['fastenMicrocontroller'])
const decodeMicrocontrollerFlags = makeBooleanDecoder(['fastenMicrocontroller'])

// ----------  ROUNDED ----------
// Two bits indicating booleans of type of rounding.
const encodeRoundedFlags = makeBooleanEncoder(['side', 'top'])
const decodeRoundedFlags = makeBooleanDecoder(['side', 'top'])

// ---------- WRIST REST ----------
const encodeWristRestFlags = makeBooleanEncoder(['enable'])
const decodeWristRestFlags = makeBooleanDecoder(['enable'])

// ---------- SHELLS ----------
const encodeBasicShellFlags = makeBooleanEncoder(['lip'])
const decodeBasicShellFlags = makeBooleanDecoder(['lip'])

const KEYBOARD_DEFAULTS: Keyboard = {
  keyProfile: encodeProfile({ profile: 'xda', row: 1 }),
  partType: encodePartType({ type: 'mx-better', aspect: 1 }),
  curvature: dominantCurvature([]),
  wallShrouding: 0,
  wallThickness: 40,
  keyBasis: encodeProfile({ profile: 'xda', row: 1 }),
  connector: encodeConnector({ connector: 'trrs', connectorSizeUSB: 'average' }),
  nScrews: 7,
  screwFlags: encodeScrewFlags({ screwSize: 'M3', screwType: 'screw insert', screwCountersink: true, clearScrews: true }),
  microcontroller: calcId(MICROCONTROLLERS, 'kb2040-adafruit', 'microcontroller'),
  microcontrollerFlags: encodeMicrocontrollerFlags({ fastenMicrocontroller: true }),
  roundedFlags: encodeRoundedFlags({ side: false, top: false }),
  wristRestFlags: encodeWristRestFlags({ enable: true }),
  cluster: [],
  shell: {
    oneofKind: 'basicShell',
    basicShell: {
      flags: encodeBasicShellFlags({ lip: false }),
    },
  },
}
const KEYBOARD_EXTRA_DEFAULTS: KeyboardExtra = {
  webMinThicknessFactor: 10 * DEFAULT_MWT_FACTOR,
  verticalClearance: 1,
  roundedSideDivisor: 30,
  roundedSideConcavity: 15,
  roundedTopHorizontal: 25,
  roundedTopVertical: 67,
}

export function decodeShell(shell: Keyboard['shell']): Cuttleform['shell'] {
  if (shell.oneofKind == 'basicShell') {
    return {
      type: 'basic',
      ...decodeBasicShellFlags(shell.basicShell.flags!),
    }
  }
  throw new Error('Shell type not supported')
}

interface FullKeyboard extends Required<Keyboard> {
  extra: Required<KeyboardExtra>
}

export function deserializeCosmosConfig(b64: string): FullKeyboard {
  const data = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  const keeb = {
    ...KEYBOARD_DEFAULTS,
    ...Keyboard.fromBinary(data),
  } as FullKeyboard
  if (!keeb.shell.oneofKind) keeb.shell = KEYBOARD_DEFAULTS.shell
  keeb.extra = { ...KEYBOARD_EXTRA_DEFAULTS, ...keeb.extra }
  return keeb
}

export function decodeConfig(b64: string): Cuttleform {
  const keeb = deserializeCosmosConfig(b64)
  const keebExtra = keeb.extra

  const roundedFlags = decodeRoundedFlags(keeb.roundedFlags)
  const conf: Cuttleform = {
    wallThickness: keeb.wallThickness / 10,
    wallShrouding: keeb.wallShrouding / 10,
    webThickness: 0,
    webMinThicknessFactor: keebExtra.webMinThicknessFactor / 10,
    verticalClearance: keebExtra.verticalClearance / 10,
    keys: [],
    keyBasis: decodeProfile(keeb.keyBasis).profile,
    screwIndices: new Array(keeb.nScrews).fill(-1),
    ...decodeScrewFlags(keeb.screwFlags),
    rounded: {
      top: roundedFlags.top ? { horizontal: keebExtra.roundedTopHorizontal / 100, vertical: keebExtra.roundedTopVertical / 100 } : undefined,
      side: roundedFlags.side ? { divisor: keebExtra.roundedSideDivisor / 10, concavity: keebExtra.roundedSideConcavity / 10 } : undefined,
    },
    ...decodeConnector(keeb.connector),
    connectorIndex: -1,
    microcontroller: lookupId(MICROCONTROLLERS, keeb.microcontroller, 'microcontroller'),
    ...decodeMicrocontrollerFlags(keeb.microcontroller),
    wristRest: undefined,
    wristRestOrigin: new ETrsf(),
    shell: decodeShell(keeb.shell),
  }
  for (const clusterA of keeb.cluster) {
    const trsfA = new ETrsf()
    if (clusterA.rotation) {
      const rot = tupleToRot(clusterA.rotation)
      trsfA.rotate(rot.alpha, [0, 0, 0], [1, 0, 0]).rotate(rot.beta, [0, 0, 0], [0, 1, 0]).rotate(rot.gamma, [0, 0, 0], [0, 0, 1])
    }
    if (clusterA.position) trsfA.translate(tupleToXYZ(clusterA.position))

    let lastCluster: Cluster | null = null
    for (const clusterB of clusterA.cluster) {
      let trsfB = trsfA
      if (clusterB.position || clusterB.rotation) {
        trsfB = new ETrsf()
        if (clusterB.rotation) {
          const rot = tupleToRot(clusterB.rotation)
          trsfB.rotate(rot.alpha, [0, 0, 0], [1, 0, 0]).rotate(rot.beta, [0, 0, 0], [0, 1, 0]).rotate(rot.gamma, [0, 0, 0], [0, 0, 1])
        }
        if (clusterB.position) trsfB.translate(tupleToXYZ(clusterB.position))
        trsfB.transformBy(trsfA)
      }

      if (typeof clusterB.column == 'undefined' && lastCluster) clusterB.column = (lastCluster.column || 0) + 10
      lastCluster = clusterB

      let lastKey: Required<Key> | null = null
      for (const key of clusterB.key) {
        const curvature = { ...keeb.curvature, ...clusterA.curvature, ...clusterB.curvature } as Required<Curvature>
        const fullKey = { ...keeb, ...clusterA, ...clusterB, ...key } as Required<Key>
        if (!key.position) fullKey.position = 0n
        if (!key.rotation) fullKey.rotation = 0n
        if (typeof fullKey.row == 'undefined' && lastKey) fullKey.row = (lastKey.row || 0) + 10
        if (fullKey.row2) fullKey.row = fullKey.row2 / 10
        if (fullKey.column2) fullKey.column = fullKey.column2 / 10
        if (!key.keyProfile && lastKey) {
          let expectedDiff = UNIFORM.includes(decodeProfile(lastKey.keyProfile).profile) ? 0x100 : 0x110
          if (!decodeProfile(lastKey.keyProfile).profile) expectedDiff &= 0x7F
          fullKey.keyProfile = lastKey.keyProfile + expectedDiff
        }
        lastKey = fullKey
        const cluster = { ...clusterA, ...clusterB } as Required<Cluster>
        conf.keys.push(decodeKey(fullKey, cluster, curvature, trsfB))
      }
    }
  }
  return conf
}

function dominantCurvature(keys: CuttleKey[]) {
  const horizontalSpacings = new TallyMap<number>()
  const verticalSpacings = new TallyMap<number>()
  const rowCurvatures = new TallyMap<number>()
  const columnCurvatures = new TallyMap<number>()
  const arcs = new TallyMap<number>()

  for (const key of keys) {
    for (const h of key.position.history) {
      if (h.name == 'placeOnMatrix') {
        const opts: any = 'merged' in h.args[0] ? h.args[0].merged : h.args[0]
        horizontalSpacings.incr(opts.spacingOfColumns)
        verticalSpacings.incr(opts.spacingOfRows)
        rowCurvatures.incr(opts.curvatureOfRow)
        columnCurvatures.incr(opts.curvatureOfColumn)
        arcs.incr(opts.arc || 0)
      }
    }
  }
  return {
    horizontalSpacing: horizontalSpacings.max(),
    verticalSpacing: verticalSpacings.max(),
    curvatureA: rowCurvatures.max(),
    curvatureB: columnCurvatures.max(),
    arc: arcs.max(),
  }
}

function dominantProfile(keys: CuttleKey[]) {
  const profiles = new TallyMap<Keycap['profile']>()
  for (const key of keys) {
    if ('keycap' in key && key.keycap) profiles.incr(key.keycap.profile)
  }
  return profiles.max()
}

function dominantPartType(keys: CuttleKey[]) {
  const types = new TallyMap<number>()
  for (const key of keys) {
    types.incr(encodePartType(key))
  }
  return types.max()
}

function dominantStagger(keys: CuttleKey[]) {
  const trsfs = new TallyMap<string>()
  for (const key of keys) {
    let hist = key.position.history
    let ind = hist.findIndex(h => h.name == 'placeOnMatrix' || h.name == 'placeOnSphere')
    if (ind >= 0) hist = hist.slice(ind + 1)
    ind = hist.findIndex(h => h.name == 'transformBy')
    if (ind >= 0) hist = hist.slice(0, ind)
    const trsf = new ETrsf(hist).evaluate({ flat: false }, new Trsf())
    const mat = trsf.matrix().join(',')
    trsfs.incr(mat)
  }
  const max = trsfs.max()
  // Only return if at least 2 keys share the same stagger
  if (!max || trsfs.get(max) <= 1) return new Trsf().matrix().join(',')
  return max
}

function dominantClusterType(keys: CuttleKey[]) {
  const clusterNames = new TallyMap<ClusterName>()
  const clusterTypes = new TallyMap<ClusterType>()
  for (const key of keys) {
    clusterNames.incr(key.cluster)
    if (key.position.history.find(h => h.name == 'placeOnMatrix')) clusterTypes.incr('matrix')
    if (key.position.history.find(h => h.name == 'placeOnSphere')) clusterTypes.incr('sphere')
  }
  return encodeClusterType({ type: clusterTypes.max() ?? 'matrix', name: clusterNames.max() ?? 'fingers', side: 'right' })
}

function collectByTransformBy(keys: CuttleKey[]) {
  const trsfs = new DefaultMap<string, CuttleKey[]>(() => [])
  const rest: CuttleKey[] = []
  for (const key of keys) {
    const transformBy = key.position.history.find(h => h.name == 'transformBy')
    if (transformBy) {
      // @ts-ignore
      const trsf = new ETrsf(transformBy.args[0].history)
      const mat = trsf.evaluate({ flat: false }, new Trsf()).matrix().join(',')
      trsfs.get(mat).push(key)
    } else {
      trsfs.get('').push(key)
    }
  }
  return trsfs
}

function collectByColumn(keys: CuttleKey[]) {
  const matrices = new DefaultMap<number, CuttleKey[]>(() => [])
  const spheres = new DefaultMap<number, CuttleKey[]>(() => [])
  const rest: CuttleKey[] = []
  for (const key of keys) {
    const matOp = key.position.history.find(h => h.name == 'placeOnMatrix')
    const sphereOp = key.position.history.find(h => h.name == 'placeOnSphere')
    if (matOp) {
      // @ts-check
      const opts: any = 'merged' in matOp.args[0] ? matOp.args[0].merged : matOp.args[0]
      matrices.get(opts.column).push(key)
    } else if (sphereOp) {
      // @ts-ignore
      const opts: any = 'merged' in sphereOp.args[0] ? sphereOp.args[0].merged : sphereOp.args[0]
      spheres.get(opts.angle).push(key)
    } else {
      rest.push(key)
    }
  }
  const results: [number | undefined, CuttleKey[]][] = [...matrices.entries(), ...spheres.entries()]
  if (rest.length) results.push([undefined, rest])
  return results
}

function diffCurvature(c: Curvature, parent: Curvature): Curvature {
  const trimmed = { ...c }
  for (const key of Object.keys(c)) {
    // @ts-ignore
    if (parent[key] == trimmed[key]) delete trimmed[key]
  }
  return trimmed
}
function diff<T>(n: T, parent: T) {
  if (n == parent) return undefined
  return n
}

function toPosRotation(m: Matrix4) {
  const translation = new Vector3().setFromMatrixPosition(m)
  const rpy = matrixToRPY(m)
  const pos = encodeTuple([Math.round(translation.x * 10), Math.round(translation.y * 10), Math.round(translation.z * 10)])
  const rot = encodeTuple([Math.round(rpy[0] * 45), Math.round(rpy[1] * 45), Math.round(rpy[2] * 45)])
  return {
    position: pos != 0n ? pos : undefined,
    rotation: rot != 0n ? rot : undefined,
  }
}

export function encodeClusterType(c: { type: ClusterType; name: ClusterName; side: ClusterSide }) {
  return calcId<ClusterSide>(CLUSTER_SIDE, c.side, 'cluster side')
    | (calcId<ClusterName>(CLUSTER_NAME, c.name, 'cluster name') << 1)
    | (calcId<ClusterType>(CLUSTER_TYPE, c.type, 'cluster type') << 2)
}
export function decodeClusterType(id: number) {
  return {
    side: lookupId<ClusterSide>(CLUSTER_SIDE, id & 1, 'cluster side'),
    name: lookupId<ClusterName>(CLUSTER_NAME, (id >> 1) & 1, 'cluster name'),
    type: lookupId<ClusterType>(CLUSTER_TYPE, (id >> 2) & 3, 'cluster type'),
  }
}

function decodeKey(key: Required<Key>, cluster: Required<Cluster>, curvature: Required<Curvature>, parentTrsf?: ETrsf): CuttleKey {
  const trsf = new ETrsf()
  const clusterType = decodeClusterType(cluster.idType)
  if (key.rotation) {
    const rot = tupleToRot(key.rotation)
    trsf.rotate(rot.alpha, [0, 0, 0], [1, 0, 0])
      .rotate(rot.beta, [0, 0, 0], [0, 1, 0])
      .rotate(rot.gamma, [0, 0, 0], [0, 0, 1])
  }
  if (key.position) trsf.translate(tupleToXYZ(key.position))
  if (key.column || key.row) {
    if (clusterType.type == 'matrix') {
      trsf.placeOnMatrix({
        column: key.column / 10,
        row: key.row / 10,
        spacingOfColumns: curvature.horizontalSpacing / 10,
        spacingOfRows: curvature.verticalSpacing / 10,
        curvatureOfRow: curvature.curvatureA / 45,
        curvatureOfColumn: curvature.curvatureB / 45,
      })
    }
  }
  if (parentTrsf) trsf.transformBy(parentTrsf)
  const cuttleKey: CuttleKey = {
    ...decodePartType(key.partType),
    cluster: clusterType.name,
    position: trsf,
  } as any
  if (PARTS_WITH_KEYCAPS.includes(cuttleKey.type)) {
    ;(cuttleKey as CuttleKeycapKey).keycap = decodeProfile(key.keyProfile)
  } else {
    cuttleKey.aspect = 1
  }
  if (cuttleKey.type == 'blank') cuttleKey.size = { width: key.sizeA / 10, height: key.sizeB / 10 }
  return cuttleKey
}

function encodeCorvature(c: Curvature): Curvature {
  return {
    horizontalSpacing: Math.round((c.horizontalSpacing ?? 20.5) * 10) / 10,
    verticalSpacing: Math.round((c.horizontalSpacing ?? 21.5) * 10) / 10,
    curvatureA: Math.round((c.horizontalSpacing ?? 5) * 45) / 45,
    curvatureB: Math.round((c.horizontalSpacing ?? 15) * 45) / 45,
    arc: Math.round((c.arc ?? 0) * 45) / 45,
  }
}

type CosmosCurvature = Curvature

type CosmosCluster = {
  name: ClusterName
  side: ClusterSide
  type: ClusterType
  curvature: CosmosCurvature
  profile: Keycap['profile'] | undefined
  partType: PartType
  clusters: CosmosCluster[]
  keys: CosmosKey[]
  position: bigint | undefined
  rotation: bigint | undefined
  column?: number
}
type CosmosKey = {
  profile: Keycap['profile'] | undefined
  partType: PartType
  row?: number
  column?: number
}
type CosmosKeyboard = {
  curvature: CosmosCurvature
  profile: Keycap['profile']
  partType: PartType
  wallShrouding: number
  wallThickness: number
  keyBasis: Keycap['profile']
  connector: Connector
  screwIndices: number[]
  microcontroller: string | null
  fastenMicrocontroller: boolean
  clusters: CosmosCluster[]
} & ScrewFlags

export function toComsosConfig(conf: Cuttleform): CosmosKeyboard {
  const globalCurvature = dominantCurvature(conf.keys)
  const globalProfile = dominantProfile(conf.keys) ?? 'xda'
  const globalPartType = decodePartType(dominantPartType(conf.keys) ?? encodePartType({ type: 'mx-better', aspect: 1 }))
  const wrOriginInv = conf.wristRestOrigin.evaluate({ flat: false }, new Trsf()).invert()

  const keyboard: CosmosKeyboard = {
    curvature: globalCurvature,
    profile: globalProfile,
    partType: globalPartType,
    wallShrouding: conf.wallShrouding,
    wallThickness: conf.wallThickness,
    keyBasis: conf.keyBasis,
    connector: {
      connector: conf.connector,
      connectorSizeUSB: conf.connectorSizeUSB,
    },
    screwIndices: conf.screwIndices,
    screwSize: conf.screwSize,
    screwType: conf.screwType,
    screwCountersink: conf.screwCountersink,
    clearScrews: conf.clearScrews,
    microcontroller: conf.microcontroller,
    fastenMicrocontroller: conf.fastenMicrocontroller,
    clusters: [],
  }
  for (const [trsf, trsfGrp] of collectByTransformBy(conf.keys).entries()) {
    const clusterCurvature = dominantCurvature(trsfGrp)
    const clusterProfile = dominantProfile(trsfGrp) ?? globalProfile
    const clusterPartType = decodePartType(dominantPartType(trsfGrp) ?? encodePartType(globalPartType))
    console.log('dominant cluster', dominantClusterType(trsfGrp))
    const clusterType = decodeClusterType(dominantClusterType(trsfGrp))
    const clusterTrsf = new Trsf().fromMatrix(trsf.split(',').map(Number))
    const clusterTrsfInv = clusterTrsf.inverted()
    const cluster: CosmosCluster = {
      ...clusterType,
      clusters: [],
      keys: [],
      partType: {
        type: clusterPartType.type != globalPartType.type ? clusterPartType.type : 'inherit',
        aspect: clusterPartType.aspect != globalPartType.aspect ? clusterPartType.aspect : 0,
      },
      curvature: diffCurvature(clusterCurvature, globalCurvature),
      profile: diff(clusterProfile, globalProfile),
      ...toPosRotation(clusterTrsf.premultiplied(wrOriginInv).Matrix4()),
    }
    keyboard.clusters.push(cluster)
    for (const [col, colGrp] of collectByColumn(trsfGrp)) {
      const columnCurvature = dominantCurvature(colGrp)
      const columnProfile = dominantProfile(colGrp) ?? clusterProfile
      const columnPartType = decodePartType(dominantPartType(colGrp) ?? encodePartType(clusterPartType))
      const columnStagger = dominantStagger(colGrp)
      const columnType = decodeClusterType(dominantClusterType(colGrp))
      const columnTrsf = new Trsf().fromMatrix(columnStagger.split(',').map(Number))
      const columnTrsfInv = columnTrsf.inverted()
      const column: CosmosCluster = {
        ...columnType,
        clusters: [],
        keys: [],
        partType: {
          type: columnPartType.type != clusterPartType.type ? columnPartType.type : 'inherit',
          aspect: columnPartType.aspect != clusterPartType.aspect ? columnPartType.aspect : 0,
        },
        column: col,
        curvature: diffCurvature(columnCurvature, clusterCurvature),
        profile: diff(columnProfile, clusterProfile ?? globalProfile),
        ...toPosRotation(columnTrsf.Matrix4()),
      }
      cluster.clusters.push(column)
      for (const colKey of colGrp) {
        let keyColumn = undefined
        let keyRow = undefined
        const matOp = colKey.position.history.find(h => h.name == 'placeOnMatrix')
        const sphereOp = colKey.position.history.find(h => h.name == 'placeOnSphere')

        let matsphTrsf = new Trsf()
        if (matOp) {
          // @ts-check
          const opts: any = 'merged' in matOp.args[0] ? matOp.args[0].merged : matOp.args[0]
          keyColumn = opts.column
          keyRow = opts.row
          matsphTrsf = new ETrsf([matOp]).evaluate({ flat: false }, new Trsf())
        } else if (sphereOp) {
          // @ts-ignore
          const opts: any = 'merged' in sphereOp.args[0] ? sphereOp.args[0].merged : sphereOp.args[0]
          keyRow = opts.row
          matsphTrsf = new ETrsf([sphereOp]).evaluate({ flat: false }, new Trsf())
        }

        const trsf = new ETrsf(colKey.position.history).evaluate({ flat: false }, new Trsf())
          .premultiply(clusterTrsfInv)
          .premultiply(columnTrsfInv)
          .premultiply(matsphTrsf.invert())

        const keyType = decodePartType(encodePartType(colKey))
        column.keys.push({
          partType: {
            type: keyType.type != columnPartType.type ? keyType.type : 'inherit',
            aspect: keyType.aspect != columnPartType.aspect ? keyType.aspect : 0,
          },
          profile: diff(colKey.keycap?.profile, columnProfile ?? clusterProfile ?? globalProfile),
          row: keyRow,
          ...toPosRotation(trsf.Matrix4()),
        })
      }
    }
  }
  return keyboard
}

export function encodeCosmosConfig(conf: CosmosKeyboard): Keyboard {
  const clusters: Cluster[] = []
  let lastCol = 0
  for (const clusterA of conf.clusters) {
    const cluster: Cluster = {
      idType: encodeClusterType(clusterA),
      cluster: [],
      key: [],
      partType: diff(encodePartType(clusterA.partType), encodePartType(conf.partType)),
    }
    for (const clusterB of clusterA.clusters) {
      const column: Cluster = {
        idType: diff(encodeClusterType(clusterB), cluster.idType),
        cluster: [],
        key: [],
        partType: diff(encodePartType(clusterA.partType), encodePartType(conf.partType)),
        column: typeof col != 'undefined' && Math.round(col * 10) != lastCol + 10 ? Math.round(col * 10) : undefined,
        curvature: diffCurvature(columnCurvature, clusterCurvature),
        keyProfile: columnProfile != clusterProfile ? columnEncodedProfile : undefined,
        ...toPosRotation(columnTrsf.Matrix4()),
        // typeof keyRow !== 'undefined' && Math.round(keyRow * 10) != lastRow + 10 ? Math.round(keyRow * 10) : undefined,
      }
      if (typeof col !== 'undefined') lastCol = Math.round(col * 10)

      let lastProfile = 0
      let lastExpectedDiff = 0
      let lastRow = 0
      for (const key of clusterB.keys) {
        let thisProfile = undefined
        if ('keycap' in colKey && colKey.keycap) {
          thisProfile = encodeProfile(colKey.keycap)
          if (thisProfile - lastProfile == lastExpectedDiff) {
            lastProfile = thisProfile
            thisProfile = undefined
          } else {
            lastProfile = thisProfile
          }
          lastExpectedDiff = UNIFORM.includes(colKey.keycap.profile) ? 0x100 : 0x110
          if (!colKey.keycap.letter) lastExpectedDiff &= 0x7F
        }
        if (typeof keyColumn !== 'undefined' && Math.round(keyColumn * 100) % 10 != 0) key.column2 = Math.round(keyColumn * 100)
        if (typeof keyRow !== 'undefined' && Math.round(keyRow * 100) % 10 != 0) {
          delete key.row
          key.row2 = Math.round(keyRow * 100)
        }
        column.key.push(key)
        if (typeof keyRow !== 'undefined') lastRow = Math.round(keyRow * 10)
      }
    }
  }

  return {
    keyProfile: encodeProfile({ profile: conf.profile, row: 1 }),
    partType: encodePartType(conf.partType),
    curvature: diffCurvature(encodeCorvature(conf.curvature), KEYBOARD_DEFAULTS.curvature!),
    wallShrouding: Math.round(conf.wallShrouding * 10),
    wallThickness: Math.round(conf.wallThickness * 10),
    keyBasis: encodeProfile({ profile: (conf.keyBasis || null), row: 1 }),
    connector: encodeConnector(conf.connector),
    nScrews: conf.screwIndices.length,
    screwFlags: encodeScrewFlags(conf),
    microcontroller: calcId(MICROCONTROLLERS, conf.microcontroller, 'microcontroller'),
    microcontrollerFlags: encodeMicrocontrollerFlags(conf),
    roundedFlags: encodeRoundedFlags({ side: false, top: false }),
    wristRestFlags: encodeWristRestFlags({ enable: true }),
    cluster: clusters,
    shell: {
      oneofKind: 'basicShell',
      basicShell: {
        flags: encodeBasicShellFlags({ lip: false }),
      },
    },
    extra: {
      verticalClearance: Math.round(conf.verticalClearance * 10),
    },
  }
}

export function serializeCosmosConfig(trimmed: Keyboard) {
  for (const key of Object.keys(trimmed) as (keyof Keyboard)[]) {
    if (trimmed[key] == KEYBOARD_DEFAULTS[key]) delete trimmed[key]
  }
  const trimmedExtra = trimmed.extra
  if (trimmedExtra) {
    for (const key of Object.keys(trimmedExtra) as (keyof KeyboardExtra)[]) {
      if (trimmedExtra[key] == KEYBOARD_EXTRA_DEFAULTS[key]) delete trimmedExtra[key]
    }
    if (Object.keys(trimmedExtra).length == 0) delete trimmed.extra
  }
  if (JSON.stringify(trimmed.shell) == JSON.stringify(KEYBOARD_DEFAULTS.shell)) trimmed.shell = {} as any
  // console.log(trimmed, '')
  const data = Keyboard.toBinary(trimmed)
  return btoa(String.fromCharCode(...data))
}

export function encodeConfig(conf: Cuttleform) {
  return serializeCosmosConfig(toCosmosConfig(conf))
}

// const test =
// 'cf:ChYIBRAFWAAYBCAFKL4BMLkBUAJAAEgAEhAIwgMYxgogowU4LihaMJAcWnsKEQjzkdyf8DMQkpPYjrGTiuQBEg8Ii4XQlhAQjYWAwN2NqwESDgjIkJYIEI2FvKC6jasBEg8IrYXkAxCbiYSe4NyQ5AESEAjig9DQARDrk5yXoPCR5AESDwjP5o84EIOPnJegvZLkARIRCPCFxJewARDhncyNwNiS5AFCUwgD4AEBeAbYAQEQAUgASABIAEgASABIAEgAYABoAHABGAAgASgAmAH0A6gB6AegAcgBsAEAkAGEB7gBAIABADAAOChYAYgBAcABAMgB2ATQAYQH'
const test =
  'expert:eJzlWt1P4zgQf+9fYfFyLGrcJukH9LQvcHcSOnGcFvYJ8eAmLvWRJpHt0HYR//vN2Gmaj3YpEnsbdBEKyXhsz/zmN5MwIUhipUmSagEXE3JtL8hn8twhZMmi6HYugseYKxj0u7nsZi6TLBTxw4T0jYxPS2ob0ZWIC+kfLNCJhDF6iqOPfH3OlADlo1XIjlCkAsmXl3EoAg7iO9ejwy7xfDwP8XSKpz6eXHMJ4/fFvNt1ymEtc01ErLjU20VvxDccvPK3ooskizWXSsSPE6JlxnEEfIpDHk7I8wveBkkcc2v1kZZSHVWEuOjXm3MYY09csgdeHQZH+GqCpo5QvhCBTGBQyySKOK6YysQInUxNncBMnjGleXxVV92YB9toEbDoIuJMsjgAn1yzJ97foFdqq6zmPIrAE6ItMlNAG3YhkUgnsFGkOHnpvHR6PfLX9e3vE2Lnkx7Rc771giyFnqNSzB+YFk8csDUBIkxykkYs4CFhmU4WzJgWrSlqX8ZmGbNnj4VPaGxINJt2UQ5bP7Eog0WWXPIJTqjHflCLvTc2ca9FH2fWAfd9Ou50AkPqIJNPTGdgqWVzcX89u0iibBEDgMNudeBLspwQI1QpC4DhRgRGuWcVoV0A5J5hO5MBcBsA7fROTjrkhHxVfJZFZAYYKq41zCGMhGI2A5fjkmmoi0qIVwpsXGNqKAriXu6FkV7UXKGUFkt097lWMud2bsIVc5IpDEVC0kQJTHWzc5amXBY7k0v9i4Js0EyD7nRtVICZ1os4JCs7CLNRG0ZhFWCkisoTvpFkNgPfjS8kd8Zs9Cfs87cx5jMQa0lupZodf0Kv7J7HEBVy14dsh597e+naS8PcimpV0y0ut5qFace5YjGI6JDf+EzEwla9TSRKeGwDAWoPUDImBOy/uwfb72B1DAbZJNli5Uwh2FyadDZVLmCQb1aJEMj5mYh4qejhIZFy3uYuMguAyvrISF7sAFMp0DzPeMz5TFm13Kp8tU1UJ1Vg8aAmXa/jK6alWB1vbGpyyR5BTiMH63AhNbY6bn7/UqzdwLg6ArguztfH1eijivHuvTD0GxjOW4thv50QDhoQxq2FsKUsbGZy1hII3Y+XyfNkgQoCH+5HDWD/aS2wHya9F62FsKXUbKa3aAmE/Tentwd/jBFn0IYMX4gwjHgzxR9bC+4rKf4TsW1mebe1KLaXoc1ET9qB4tvzvC2PcQnINFM8aiusH+YhTtuKYEt52Uzt9D9EsNrQacL49td0BxsmozZkuPGtmeK/threV/L856HbzPReq4F8V5p27g/tXup5tpiWOpchdvRAL1O27RpzJqemsVrM6xaNS9ukxKalAgoTtsAvA+X+q1n9WooHEe/rVzquS0/Lx9nurmRljjfAd5tdbc6ymj+gg8rRmIKz7muNTscfmhcnb0jH8GtM3aoCIF6jwh4i7Cr4NtSbu/JfcJ1S8F8Jb8XcUzoGZjj2l3kilCHoH+QyAOPA7EHe1UXKbPv/yWxLlE2a0FqI6y32+kcB0+ff0Wc38n3fBWofETzziaC06Vu6yXuz3a50QLLngHoeHe0naFnT8emoeuzpzDcmun16Ni4fTa4XUayxYYTWmeTw6XBntSil5KdaUa2XU8vWIZSTXbUZFg0epyyK3htiKAjegQWhEpkh7VfxPgzuM3paKRLNKO0D27cVwvXx1Ld14gC8lfmk+kwkC0VmiE3BRSVCbm72wP3jGN3/Pm57+f06cDvx7lPfrR4HA+64UKlG9lv27mfhu7H7h8Ht+9SvHIfCPaLj6sQDq8mg+nitp9P34B5SD6ltGwljevqukOM7iq3mSymU/sKV3vOm8D959PJVmkiNb2Asi/TmU3X+3yVodw0nFOFn1gm5A738tbWLcywn77udl38BMPpjNA=='
// 'expert:eJzlW91zmzgQf/dfseOX5joGGxwSh5u+NHcPnZs2N036lPGDDCLWBQMjiThux//7rQTGfDjxpZPG8lwmwbC7SLu//ZAwmyBNhIQ0kwxPfLgqTuAD/OgBLEkc38xZcJ9QgczTQUm7nvM0D1ly58NI0+isJqZJIuB0+SkJWUCRdGs5A9j8uWPbU2fTSu5mlVEf+vocWCIol/2Kec2+K+bn8ZZ0meaJpFyw5N4HyXOqOKhSEtLQhx8gWEjVZ8gemEi5D67twRrWSixIk4QGUlH7knPRbxDVZN+uPyKPPFBO7miTjQbRRx/GE3us6AsW8BSZkqdxTNWIGU810crFzAr0zRERkiaf26IRiYXWG+eRLCDxZUwJJ0mAmp/rSdX1tTJXbI0UcxrHyjRZQDYjguE0ELOsHBLWvXVvOIQvVzd/+lDcD0OQc7o1A5ZMzpVQQu+IZA8UQdeeAsIpZDEJaAgkl+mCaNXila2kPyV6GD3nkIQPStkQJJkNFB2nfiBxjoMsKae+uqEVBM65crw+uMXRVcexY3tTJd6G2bHdXi/QARrk/IHIHLUrIrO6voou0zhfJOhjd9BkfE2XPngatYwEGK2ahIo4F3aTXAyBHFfHLuEBRrGSWfd6w/fve/Aevgka5TFECJ6gUuJtQDC+oghtTWr6KVklpIDKMD5XcE9XwkbysDRFUy9b9ti2XQ0xeMq+mjo3c+2nhEIulA9SyFLBVO7qmfMso7yaGT7JdwLzQxKJsrOVFsGYLKxIQngsmHi3kkYujoKhKOL6Dd8hjSK0XdsCpTF6or9wnr+1Mh8wopZww0V08puyqpjzxJkM4HY0APU7LU6d4lSHbF3Ua0o61elWslLtpBSsmAod+INGLGFFGdt4oobH1hEododFxAfU/3aKut/i6MoZsMmuxaM1Q2dTrhMZ1AABwUQrhAAw2yMWK8nHkJQyqhBh3Dmbq1gPgCJnfU1ZFwwiMgz1Si6Ic1GIlVqVo2286jeBVT+2ztOr5DORnD2ebHTqxlLxE5RhZI23NK2p5ZbX62rkDsJNDqK6+Lg6afpeiWjbXgtBt4PgylQEHTMRHHcQnBuK4MhMAE87ACaGAmhoBHar4LkhALrtHD6aKpibiqChMVilyjxdKAGmNpf9Dqz/GArr0ZTGhaEAGhqW3dI4MQRAp53Y+0ujdWpGbWSmQrg/CA8DYbs4LlgYxrRbHe8NBXZ/dTwMrt3yODAUQVMj83gQNLU8dleYCzMQHL18gXHMWF9SQwHcn8QHAbC9unDEpbu2xGaCun9pOQim3bpom4mfoTF5NPgZWhS7q8roDfFrvjzpgviyZxf7TL2HHA/AkMeXzGQkn83nwyLZXme0bd2F5neD4X12tTksut2KOTQYSIPD9LiAPFjlbENY+tUMlF723uDtYXINhcngtOy+Jn1nUFq+6H3A28fbqZkoHSzcjgqlV65dvel/7U+S83wxq/UmhapnB+VyUTRWJZTwmW6dqu4bVK1JRRuSaksSuN0DslDdgPUOKz36FWd3LHmqI2nUaUhSz1PTuoh1sbsVqS4zdnc3NjXGcc6em22LuOWe2Tie5U7wMLEvmmyEvBULT0TCrqfM5pPb9lVZr+b9Pd5tqDqxzz2tpPrQr89atpwi19Oho3uyVDhsW/jSaBsEmxSwW+5rN8i1+/os3cG3o03Ocor+0yd6+1qtgO7I9lRbXW3mn2oI25323ibtt3leTNHfWQ1+MuubeHWzvvvSxD7fnfil82v58yrVz1AYrJE9/kU47N90eK1HVj1XY9uxDyzb2w9XVcpGr4Fg5xtS2zv3/oeR1Pn6HddKU4F4+yjpVptTQ7H5pUGyo9pMXgSD2k0Vy9KSMyG/UiF/fk9z/NsI+pilXKqdIsljuWmaL/9xRanUQkmRVMO3D7coV26vB5XnxHTQW/8LpL3jWg=='

// const state = deserialize(test, { options: {} })
// const keeb = Function('Trsf', 'mirror', state.content!.replace('export default', 'return').replace(/: [A-Z][a-z]+(\[\])?/g, ''))(ETrsf, mirror)
// console.log('re-encoded', toComsosConfig(keeb))

// console.log('original', test)

// function entropy(str) {
//   const len = str.length

//   // Build a frequency map from the string.
//   const frequencies = Array.from(str)
//     .reduce((freq, c) => (freq[c] = (freq[c] || 0) + 1) && freq, {})

//   // Sum the frequency of each character.
//   return Object.values(frequencies)
//     .reduce((sum, f) => sum - f / len * Math.log2(f / len), 0)
// }

// console.log('re-encoded entropy', entropy(encodeConfig(keeb)) / encodeConfig(keeb).length)
// console.log('original entropy', entropy(test) / test.length)
