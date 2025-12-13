/**
 * For now, the new serializationf format for Cosmos is kept in a separate file.
 */

import { BinaryReader, BinaryWriter } from '@protobuf-ts/runtime'
import {
  decodeBasicShellFlags,
  decodeClusterFlags,
  decodeConnector,
  decodeConnectorPreset,
  decodeKeyboardFlags,
  decodeKeycap,
  decodeMicrocontroller,
  decodePartVariant,
  decodePlateArt,
  decodeRoundedFlags,
  decodeScrewFlags,
  decodeStiltsShellFlags,
  decodeTiltShellFlags,
  encodeBasicShellFlags,
  encodeClusterFlags,
  encodeConnectorPreset,
  encodeKeyboardFlags,
  encodeKeycap,
  encodeMicrocontroller,
  encodePartVariant,
  encodePlateArt,
  encodeRoundedFlags,
  encodeScrewFlags,
  encodeStiltsShellFlags,
  encodeTiltShellFlags,
} from '../../../target/cosmosStructs'
import { Cluster, Curvature, Key, Keyboard, KeyboardExtra, TiltShell } from '../../../target/proto/cosmos'
import { convertToMaybeCustomConnectors, type Cuttleform, encodeTuple, tupletoRotOnly } from './config'
import { type ConnectorMaybeCustom, type CosmosCluster, type CosmosKeyboard, type PartType, type Profile } from './config.cosmos'
import { DEFAULT_MWT_FACTOR } from './geometry.thickWebs'
import { objKeys } from './util'

function lookupId<E>(items: readonly E[], id: number, msg: string) {
  if (id >= items.length || id < 0) throw new Error(`No ${msg} for id ${id}`)
  return items[id]
}

export function encodePartType(key: PartType) {
  let aspect = 0
  if (typeof key.aspect !== 'undefined') {
    if (key.aspect == 0) throw new Error('Key aspect must be nonzero')
    if (key.aspect >= 0) aspect = Math.round(key.aspect * 32)
    else aspect = 0x80 | Math.round(-key.aspect * 32)
  }
  const variant = typeof key.variant == 'undefined' ? 0 : key.variant + 1
  return encodePartVariant({ part: key.type ?? null, aspect, variant })
}

export function decodePartType(type: number): PartType {
  const { part, aspect, variant } = decodePartVariant(type)
  return {
    type: part ?? undefined,
    aspect: ((aspect & 0x80) ? -(aspect & 0x7F) / 32 : aspect / 32) || undefined,
    variant: variant == 0 ? undefined : variant - 1,
  }
}

export function encodeConnectors(connectors: ConnectorMaybeCustom[]) {
  const writer = new BinaryWriter()
  for (const conn of connectors) {
    if (typeof conn.preset == 'undefined') {
      writer.uint32(encodeConnectorPreset('custom'))
      writer.sint32(Math.round(conn.x * 10))
      writer.sint32(Math.round(conn.y * 10))
      writer.uint32(Math.round(conn.width * 10))
      writer.uint32(Math.round(conn.height * 10))
      writer.uint32(Math.round(conn.radius * 10))
    } else {
      let preset = 0
      if (conn.preset == 'usb') {
        if (conn.size == 'slim') preset = encodeConnectorPreset('usb-slim')
        if (conn.size == 'average') preset = encodeConnectorPreset('usb-average')
        if (conn.size == 'big') preset = encodeConnectorPreset('usb-big')
      } else preset = encodeConnectorPreset(conn.preset)
      if (typeof conn.x != 'undefined') {
        writer.uint32(preset | 0x80)
        writer.sint32(Math.round(conn.x * 10))
      } else {
        writer.uint32(preset)
      }
    }
  }
  return writer.finish()
}

export function decodeConnectors(arr: Uint8Array) {
  const reader = new BinaryReader(arr)
  const connectors: ConnectorMaybeCustom[] = []
  while (reader.pos < reader.len) {
    const presetEncoded = reader.uint32()
    const presetDecoded = decodeConnectorPreset(presetEncoded & 0x7F)
    if (presetDecoded == 'custom') {
      connectors.push({
        x: reader.sint32() / 10,
        y: reader.sint32() / 10,
        width: reader.uint32() / 10,
        height: reader.uint32() / 10,
        radius: reader.uint32() / 10,
      })
    } else {
      let connector: ConnectorMaybeCustom
      if (presetDecoded == 'usb-slim') connector = { preset: 'usb', size: 'slim' }
      else if (presetDecoded == 'usb-average') connector = { preset: 'usb', size: 'average' }
      else if (presetDecoded == 'usb-big') connector = { preset: 'usb', size: 'big' }
      else connector = { preset: presetDecoded }
      if (presetEncoded & 0x80) connector.x = reader.sint32() / 10
      connectors.push(connector)
    }
  }
  return connectors
}

function decodeConnectorsCompatible(connectors: Uint8Array, connector: number | undefined) {
  if (typeof connector !== 'undefined') {
    return convertToMaybeCustomConnectors(decodeConnector(connector) as any)
  }
  return decodeConnectors(connectors)
}

// ----------  PROFILES ----------
// dprint-ignore
export const LETTERS = [
  'F1', '1', 'q', 'a', 'z', '+',
  'F2', '2', 'w', 's', 'x', '-',
  'F3', '3', 'e', 'd', 'c', '=',
  'F4', '4', 'r', 'f', 'v', ',',
  'F5', '5', 't', 'g', 'b', '.',
  'F6', '6', 'y', 'h', 'n', '{',
  'F7', '7', 'u', 'j', 'm', '}',
  'F8', '8', 'i', 'k', ',', '[',
  'F9', '9', 'o', 'l', '.', ']',
  'F10', '0', 'p', ';', '/', '\\'
]
const INFERRED_HOMING = {
  [LETTERS.indexOf('f')]: 'index',
  [LETTERS.indexOf('d')]: 'middle',
  [LETTERS.indexOf('s')]: 'ring',
  [LETTERS.indexOf('a')]: 'pinky',
  [LETTERS.indexOf('j')]: 'index',
  [LETTERS.indexOf('k')]: 'middle',
  [LETTERS.indexOf('l')]: 'ring',
  [LETTERS.indexOf(';')]: 'pinky',
} as const

/** Determine if the legend is small enough to fit in the 7-bit key profile field. */
function shouldLegendGoInProfile(legend: string) {
  return legend.charCodeAt(0) < 128 && legend.length <= 1
}

export function encodeProfile(p: Partial<Profile>) {
  let row = p.row ?? 1
  if (typeof row !== 'undefined' && (row < 0 || row > 8)) throw new Error('Row out of bounds')
  if (row == 0) row = 8 // I messed up and made R1 encode to 0. So now R0 encodes to 7.
  let letter = 0
  let inferredHome: typeof INFERRED_HOMING[number] | undefined = undefined
  if (p.letter && p.letter.length) {
    if (LETTERS.includes(p.letter)) {
      letter = (LETTERS.indexOf(p.letter) << 1) | 1
      inferredHome = INFERRED_HOMING[letter >> 1]
    } else if (shouldLegendGoInProfile(p.letter)) {
      letter = p.letter.charCodeAt(0) << 1
    }
  }
  return encodeKeycap({
    profile: p.profile ?? null,
    row: row - 1,
    letter: letter,
    home: diff(p.home, inferredHome) ?? null,
  })
}

export function decodeProfile(flags: number, overrideLetter?: string): Profile {
  let { profile, row, letter: letterId, home } = decodeKeycap(flags)
  if (row == 7) row = -1 // I messed up and made R1 encode to 0. So now R0 encodes to 7.

  let letter = letterId > 0 ? String.fromCharCode(letterId >> 1) : undefined
  let inferredHoming = undefined
  if (letterId & 1) {
    try {
      letter = lookupId(LETTERS, letterId >> 1, 'letter')
    } catch (e) {
      console.error(e)
      letter = 'error'
    }
    inferredHoming = INFERRED_HOMING[letterId >> 1]
  }
  letter = overrideLetter ?? letter
  return { profile: profile ?? undefined, row: row + 1, letter, home: home || inferredHoming || null }
}

export const KEYBOARD_DEFAULTS: Keyboard = {
  keyProfile: encodeProfile({ profile: 'xda' }),
  partType: encodePartType({ type: 'mx-better', aspect: 1 }),
  curvature: {
    horizontalSpacing: Math.round(21.5 * 10),
    verticalSpacing: Math.round(20.5 * 10),
    curvatureA: Math.round(5 * 45),
    curvatureB: Math.round(15 * 45),
    arc: Math.round(0 * 45),
  },
  wallShrouding: 0,
  wallThickness: 40,
  wallXYOffset: 50,
  wallZOffset: 150,
  keyBasis: encodeProfile({ profile: 'xda' }),
  connectors: encodeConnectors([{ preset: 'trrs' }, { preset: 'usb', size: 'average' }]),
  nScrews: 7,
  screwFlags: encodeScrewFlags({ screwSize: 'M3', screwType: 'screw insert', screwCountersink: true, clearScrews: true }),
  microcontroller: encodeMicrocontroller({ microcontroller: 'kb2040-adafruit', fastenMicrocontroller: true }),
  roundedFlags: encodeRoundedFlags({ side: false, top: false }),
  keyboardFlags: encodeKeyboardFlags({ wrEnable: true, unibody: false, noMirrorConnectors: false }),
  wristRestPosition: encodeTuple([100, -1100, 0]),
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
  wristRestAngle: 0,
  wristRestTaper: 450,
  wristRestLeftMaxWidth: 1000,
  wristRestRightMaxWidth: 1000,
  wristRestTenting: 270,
  wristRestSlope: 225,
  wristRestLeftExtension: 80,
  wristRestRightExtension: 80,
  connectorLeftIndex: -10,
  connectorRightIndex: -10,
  screwIndices: [],
  microcontrollerAngle: 0,
  plateThickness: 30,
  plateArt: 0,
  footIndices: [],
  footDiameter: 100,
}

const TILT_DEFAULTS: TiltShell = {
  flags: encodeTiltShellFlags({ usePattern: true }),
  raiseBy: 100,
  tilt: 270,
  pattern: [10, 5],
}

export function decodeShell(shell: Keyboard['shell']): Cuttleform['shell'] {
  if (shell.oneofKind == 'basicShell') {
    return {
      type: 'basic',
      ...decodeBasicShellFlags(shell.basicShell.flags!),
    }
  } else if (shell.oneofKind == 'stiltsShell') {
    return {
      type: 'stilts',
      ...decodeStiltsShellFlags(shell.stiltsShell.flags!),
    }
  } else if (shell.oneofKind == 'tiltShell') {
    const opts = { ...TILT_DEFAULTS, ...shell.tiltShell } as Required<TiltShell>
    const flags = decodeTiltShellFlags(opts.flags)
    return {
      type: 'tilt',
      raiseBy: opts.raiseBy / 10,
      pattern: flags.usePattern ? opts.pattern.map(p => p / 10) : null,
      tilt: opts.tiltVector ? tupletoRotOnly(opts.tiltVector) : opts.tilt / 45,
    }
  }
  throw new Error(`Decoding shell type ${shell.oneofKind} not supported`)
}

export function encodeShell(shell: Cuttleform['shell']): Keyboard['shell'] {
  if (shell.type == 'basic') {
    return {
      oneofKind: 'basicShell',
      basicShell: {
        flags: encodeBasicShellFlags({ lip: shell.lip }),
      },
    }
  } else if (shell.type == 'stilts') {
    return {
      oneofKind: 'stiltsShell',
      stiltsShell: {
        flags: encodeStiltsShellFlags({ inside: shell.inside }),
      },
    }
  } else if (shell.type == 'tilt') {
    const opts: Keyboard['shell'] = {
      oneofKind: 'tiltShell',
      tiltShell: {
        flags: encodeTiltShellFlags({ usePattern: !!shell.pattern }),
        raiseBy: Math.round(shell.raiseBy * 10),
        tilt: typeof shell.tilt == 'number' ? Math.round(shell.tilt * 45) : undefined,
        tiltVector: typeof shell.tilt != 'number' ? encodeTuple(shell.tilt.map(p => Math.round(p * 45))) : undefined,
        pattern: shell.pattern ? shell.pattern.map(p => Math.round(10 * p)) : [],
      },
    }
    if (JSON.stringify(opts.tiltShell.pattern) == JSON.stringify(TILT_DEFAULTS.pattern)) opts.tiltShell.pattern = []
    for (const key of objKeys(opts.tiltShell)) {
      if (opts.tiltShell[key] == TILT_DEFAULTS[key]) delete opts.tiltShell[key]
    }
    return opts
  }
  throw new Error(`Encoding shell type ${shell.type} not supported`)
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
  keeb.curvature = { ...KEYBOARD_DEFAULTS.curvature, ...keeb.curvature }
  return keeb
}

// export function decodeConfig(b64: string): Cuttleform {
//   const keeb = deserializeCosmosConfig(b64)
//   const keebExtra = keeb.extra

//   const roundedFlags = decodeRoundedFlags(keeb.roundedFlags)
//   const conf: Cuttleform = {
//     wallThickness: keeb.wallThickness / 10,
//     wallShrouding: keeb.wallShrouding / 10,
//     webThickness: 0,
//     webMinThicknessFactor: keebExtra.webMinThicknessFactor / 10,
//     verticalClearance: keebExtra.verticalClearance / 10,
//     keys: [],
//     keyBasis: decodeProfile(keeb.keyBasis).profile!,
//     screwIndices: new Array(keeb.nScrews).fill(-1),
//     ...decodeScrewFlags(keeb.screwFlags),
//     rounded: {
//       top: roundedFlags.top ? { horizontal: keebExtra.roundedTopHorizontal / 100, vertical: keebExtra.roundedTopVertical / 100 } : undefined,
//       side: roundedFlags.side ? { divisor: keebExtra.roundedSideDivisor / 10, concavity: keebExtra.roundedSideConcavity / 10 } : undefined,
//     },
//     ...decodeConnector(keeb.connector),
//     connectorIndex: -1,
//     microcontroller: decodeMicrocontroller(keeb.microcontroller),
//     ...decodeMicrocontrollerFlags(keeb.microcontroller),
//     wristRest: undefined,
//     wristRestOrigin: new ETrsf(),
//     shell: decodeShell(keeb.shell),
//   }
//   for (const clusterA of keeb.cluster) {
//     const trsfA = new ETrsf()
//     if (clusterA.rotation) {
//       const rot = tupleToRot(clusterA.rotation)
//       trsfA.rotate(rot.alpha, [0, 0, 0], [1, 0, 0]).rotate(rot.beta, [0, 0, 0], [0, 1, 0]).rotate(rot.gamma, [0, 0, 0], [0, 0, 1])
//     }
//     if (clusterA.position) trsfA.translate(tupleToXYZ(clusterA.position))

//     let lastCluster: Cluster | null = null
//     for (const clusterB of clusterA.cluster) {
//       if (clusterB.column2) clusterB.column = clusterB.column2 / 10

//       let trsfB = trsfA
//       if (clusterB.position || clusterB.rotation) {
//         trsfB = new ETrsf()
//         if (clusterB.rotation) {
//           const rot = tupleToRot(clusterB.rotation)
//           trsfB.rotate(rot.alpha, [0, 0, 0], [1, 0, 0]).rotate(rot.beta, [0, 0, 0], [0, 1, 0]).rotate(rot.gamma, [0, 0, 0], [0, 0, 1])
//         }
//         if (clusterB.position) trsfB.translate(tupleToXYZ(clusterB.position))
//         trsfB.transformBy(trsfA)
//       }

//       if (typeof clusterB.column == 'undefined' && lastCluster) clusterB.column = (lastCluster.column || 0) + 10
//       lastCluster = clusterB

//       let lastKey: Required<Key> | null = null
//       for (const key of clusterB.key) {
//         const curvature = { ...keeb.curvature, ...clusterA.curvature, ...clusterB.curvature } as Required<Curvature>
//         const fullKey = { ...keeb, ...clusterA, ...clusterB, ...key } as Required<Key>
//         if (!key.position) fullKey.position = 0n
//         if (!key.rotation) fullKey.rotation = 0n
//         if (typeof fullKey.row == 'undefined' && lastKey) fullKey.row = (lastKey.row || 0) + 10
//         if (fullKey.row2) fullKey.row = fullKey.row2 / 10
//         if (fullKey.column2) fullKey.column = fullKey.column2 / 10
//         if (!key.keyProfile && lastKey) {
//           let expectedDiff = decodeProfile(lastKey.keyProfile).row! < 4 ? 0x110 : 0x100
//           if (!decodeProfile(lastKey.keyProfile).letter) expectedDiff &= 0x7F
//           fullKey.keyProfile = lastKey.keyProfile + expectedDiff
//         }
//         lastKey = fullKey
//         const cluster = { ...clusterA, ...clusterB } as Required<Cluster>
//         fullKey.keyProfile = encodeProfile({
//           ...trimUndefined(decodeProfile(keeb.keyProfile || 0)),
//           ...trimUndefined(decodeProfile(clusterA.keyProfile || 0)),
//           ...trimUndefined(decodeProfile(clusterB.keyProfile || 0)),
//           ...trimUndefined(decodeProfile(fullKey.keyProfile || 0)),
//         })
//         conf.keys.push(decodeKey(fullKey, cluster, curvature, trsfB))
//       }
//     }
//   }
//   return conf
// }

export function decodeCosmosCluster(clusterA: Cluster): CosmosCluster {
  let lastCluster: Cluster | null = null

  return {
    ...decodeClusterFlags(clusterA.idType ?? 0),
    curvature: decodeCurvature(clusterA.curvature || {}),
    profile: decodeProfile(clusterA.keyProfile || 0).profile,
    partType: decodePartType(clusterA.partType || 0),
    position: clusterA.position,
    rotation: clusterA.rotation,
    keys: [],
    clusters: clusterA.cluster.map(clusterB => {
      // if (typeof clusterB.column2 != 'undefined') clusterB.column = clusterB.column2 / 10
      if (typeof clusterB.column == 'undefined' && typeof clusterB.column2 == 'undefined' && lastCluster) clusterB.column = (lastCluster.column || 0) + 10
      lastCluster = clusterB

      let lastKey: Key | null = null
      let lastKeyRow = 0
      return {
        ...decodeClusterFlags(clusterB.idType ?? clusterA.idType ?? 0),
        curvature: decodeCurvature(clusterB.curvature || {}),
        profile: decodeProfile(clusterB.keyProfile || 0).profile,
        partType: decodePartType(clusterB.partType || 0),
        position: clusterB.position,
        rotation: clusterB.rotation,
        column: clusterB.column2 ? clusterB.column2 / 100 : (typeof clusterB.column != 'undefined' ? clusterB.column / 10 : undefined),
        clusters: [],
        keys: clusterB.key.map(key => {
          if (key.column2) key.column = key.column2 / 10

          if (!key.keyProfile && lastKey) {
            let expectedDiff = decodeProfile(lastKey.keyProfile || 0).row! < 4 ? 0x110 : 0x100
            if (!decodeProfile(lastKey.keyProfile || 0).letter) expectedDiff &= 0x7F
            key.keyProfile = (lastKey.keyProfile || 0) + expectedDiff
          }
          lastKey = key
          if (typeof key.row == 'undefined' && typeof key.row2 == 'undefined') {
            lastKeyRow = lastKeyRow + 1 // Use 1 + previous row
          } else {
            lastKeyRow = typeof key.row2 !== 'undefined' ? key.row2 / 100 : key.row! / 10 //
          }
          return {
            partType: decodePartType(key.partType || 0),
            profile: decodeProfile(key.keyProfile || 0, key.letter),
            row: lastKeyRow,
            column: typeof key.column2 !== 'undefined' ? key.column2 / 100 : (typeof key.column !== 'undefined' ? key.column / 10 : undefined),
            position: key.position,
            rotation: key.rotation,
            sizeA: typeof key.sizeA !== 'undefined' ? key.sizeA / 10 : undefined,
            sizeB: typeof key.sizeB !== 'undefined' ? key.sizeB / 10 : undefined,
            marginX: typeof key.marginX !== 'undefined' ? key.marginX / 10 : undefined,
            marginY: typeof key.marginY !== 'undefined' ? key.marginY / 10 : undefined,
          }
        }),
      }
    }),
  }
}

export function decodeConfigIdk(b64: string): CosmosKeyboard {
  const keeb = deserializeCosmosConfig(b64)
  const keebExtra = keeb.extra

  // console.log('DECODE EXTRA', keebExtra)
  const hasSpecialPlate = keebExtra.plateArt || keebExtra.footIndices.length
  const roundedFlags = decodeRoundedFlags(keeb.roundedFlags)

  const conf: CosmosKeyboard = {
    partType: decodePartType(keeb.partType || 0) as Required<PartType>,
    wallThickness: keeb.wallThickness / 10,
    wallShrouding: keeb.wallShrouding / 10,
    wallXYOffset: keeb.wallXYOffset / 10,
    wallZOffset: keeb.wallZOffset / 10,
    webMinThicknessFactor: keebExtra.webMinThicknessFactor / 10,
    verticalClearance: keebExtra.verticalClearance / 10,
    plateThickness: keebExtra.plateThickness / 10,
    keyBasis: decodeProfile(keeb.keyBasis).profile!,
    profile: decodeProfile(keeb.keyProfile).profile!,
    screwIndices: keeb.extra.screwIndices?.length ? keeb.extra.screwIndices.map(i => i / 10 - 1) : new Array(keeb.nScrews).fill(-1),
    ...decodeScrewFlags(keeb.screwFlags),
    rounded: {
      top: roundedFlags.top ? { horizontal: keebExtra.roundedTopHorizontal / 100, vertical: keebExtra.roundedTopVertical / 100 } : undefined,
      side: roundedFlags.side ? { divisor: keebExtra.roundedSideDivisor / 10, concavity: keebExtra.roundedSideConcavity / 10 } : undefined,
    },
    // @ts-ignore
    curvature: decodeCurvature(keeb.curvature || {}),
    connectors: decodeConnectorsCompatible(keeb.connectors, keeb.connector),
    ...decodeMicrocontroller(keeb.microcontroller),
    microcontrollerAngle: keebExtra.microcontrollerAngle / 45,
    shell: decodeShell(keeb.shell),
    wristRestEnable: decodeKeyboardFlags(keeb.keyboardFlags).wrEnable,
    unibody: decodeKeyboardFlags(keeb.keyboardFlags).unibody,
    mirrorConnectors: !decodeKeyboardFlags(keeb.keyboardFlags).noMirrorConnectors,
    wristRestProps: {
      angle: keebExtra.wristRestAngle / 45,
      taper: keebExtra.wristRestTaper / 45,
      maxWidthLeft: keebExtra.wristRestLeftMaxWidth / 10,
      maxWidthRight: keebExtra.wristRestRightMaxWidth / 10,
      tenting: keebExtra.wristRestTenting / 45,
      slope: keebExtra.wristRestSlope / 45,
      extensionLeft: keebExtra.wristRestLeftExtension / 10,
      extensionRight: keebExtra.wristRestRightExtension / 10,
    },
    wristRestPosition: keeb.wristRestPosition,
    connectorLeftIndex: keebExtra.connectorLeftIndex / 10,
    connectorRightIndex: keebExtra.connectorRightIndex / 10,
    clusters: keeb.cluster.map(decodeCosmosCluster),
    plate: hasSpecialPlate
      ? {
        art: decodePlateArt(keebExtra.plateArt) || undefined,
        footIndices: keebExtra.footIndices.map(i => i / 10 - 1),
        footDiameter: keebExtra.footDiameter / 10,
      }
      : undefined,
  }
  return conf
}

function diffCurvature(c: Curvature | undefined, parent: Curvature): Curvature | undefined {
  if (!c) return undefined
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

// function decodeKey(key: Required<Key>, cluster: Required<Cluster>, curvature: Required<Curvature>, parentTrsf?: ETrsf): CuttleKey {
//   const trsf = new ETrsf()
//   const clusterType = decodeClusterFlags(cluster.idType)
//   if (key.rotation) {
//     const rot = tupleToRot(key.rotation)
//     trsf.rotate(rot.alpha, [0, 0, 0], [1, 0, 0])
//       .rotate(rot.beta, [0, 0, 0], [0, 1, 0])
//       .rotate(rot.gamma, [0, 0, 0], [0, 0, 1])
//   }
//   if (key.position) trsf.translate(tupleToXYZ(key.position))
//   if (key.column || key.row) {
//     if (clusterType.type == 'matrix') {
//       trsf.placeOnMatrix({
//         column: key.column / 10,
//         row: key.row / 10,
//         spacingOfColumns: curvature.horizontalSpacing / 10,
//         spacingOfRows: curvature.verticalSpacing / 10,
//         curvatureOfRow: curvature.curvatureA / 45,
//         curvatureOfColumn: curvature.curvatureB / 45,
//       })
//     }
//   }
//   if (parentTrsf) trsf.transformBy(parentTrsf)
//   const cuttleKey: CuttleKey = {
//     ...decodePartType(key.partType),
//     cluster: clusterType.name,
//     position: trsf,
//   } as any
//   if (PARTS_WITH_KEYCAPS.includes(cuttleKey.type)) {
//     ;(cuttleKey as CuttleKeycapKey).keycap = decodeProfile(key.keyProfile)
//   } else {
//     cuttleKey.aspect = 1
//   }
//   if (cuttleKey.type == 'blank') cuttleKey.size = { width: key.sizeA / 10, height: key.sizeB / 10 }
//   return cuttleKey
// }

function encodeCurvature(c: Curvature): Curvature | undefined {
  const curv = {
    horizontalSpacing: typeof c.horizontalSpacing !== 'undefined' ? Math.round(c.horizontalSpacing * 10) : undefined,
    verticalSpacing: typeof c.verticalSpacing !== 'undefined' ? Math.round(c.verticalSpacing * 10) : undefined,
    curvatureA: typeof c.curvatureA !== 'undefined' ? Math.round(c.curvatureA * 45) : undefined,
    curvatureB: typeof c.curvatureB !== 'undefined' ? Math.round(c.curvatureB * 45) : undefined,
    arc: typeof c.arc !== 'undefined' ? Math.round(c.arc * 45) : undefined,
  }
  for (const elem of Object.keys(curv) as (keyof Curvature)[]) {
    if (typeof curv[elem] == 'undefined') delete curv[elem]
  }
  return Object.keys(curv).length > 0 ? curv : undefined
}
function decodeCurvature(c: Curvature): Curvature {
  const curv = {
    horizontalSpacing: typeof c.horizontalSpacing !== 'undefined' ? c.horizontalSpacing / 10 : undefined,
    verticalSpacing: typeof c.verticalSpacing !== 'undefined' ? c.verticalSpacing / 10 : undefined,
    curvatureA: typeof c.curvatureA !== 'undefined' ? c.curvatureA / 45 : undefined,
    curvatureB: typeof c.curvatureB !== 'undefined' ? c.curvatureB / 45 : undefined,
    arc: typeof c.arc !== 'undefined' ? c.arc / 45 : undefined,
  }
  for (const elem of Object.keys(curv) as (keyof Curvature)[]) {
    if (typeof curv[elem] == 'undefined') delete curv[elem]
  }
  return curv
}

export function encodeCosmosCluster(clusterA: CosmosCluster): Cluster {
  const cluster: Cluster = {
    idType: encodeClusterFlags(clusterA),
    cluster: [],
    key: [],
    partType: diff(encodePartType(clusterA.partType), 0),
    curvature: encodeCurvature(clusterA.curvature),
    keyProfile: diff(encodeProfile({ profile: clusterA.profile }), 0),
    position: clusterA.position,
    rotation: clusterA.rotation,
  }

  let lastCol = 0
  for (const clusterB of clusterA.clusters) {
    const col = clusterB.column
    const column: Cluster = {
      idType: diff(encodeClusterFlags(clusterB), cluster.idType),
      cluster: [],
      key: [],
      partType: diff(encodePartType(clusterB.partType), 0),
      // column: typeof col != 'undefined' && Math.round(col * 10) != lastCol + 10 ? Math.round(col * 10) : undefined,
      column: typeof col != 'undefined' ? Math.round(col * 10) : undefined,
      curvature: encodeCurvature(clusterB.curvature),
      keyProfile: diff(encodeProfile({ profile: clusterB.profile }), 0),
      position: clusterB.position,
      rotation: clusterB.rotation,
      // typeof keyRow !== 'undefined' && Math.round(keyRow * 10) != lastRow + 10 ? Math.round(keyRow * 10) : undefined,
    }
    if (typeof clusterB.column !== 'undefined' && Math.round(clusterB.column * 100) % 10 != 0) {
      delete column.column
      column.column2 = Math.round(clusterB.column * 100)
    }
    cluster.cluster.push(column)
    if (typeof col !== 'undefined') lastCol = Math.round(col * 10)

    let lastProfile = 0
    let lastExpectedDiff = 0
    let lastRow = 0
    for (const key of clusterB.keys) {
      const cKey: Key = {
        partType: diff(encodePartType(key.partType), 0),
        row: typeof key.row != 'undefined' && Math.round(key.row * 100) != lastRow + 100 ? Math.round(key.row * 10) : undefined,
        column: typeof key.column != 'undefined' ? Math.round(key.column * 10) : undefined,
        rotation: key.rotation,
        position: key.position,
        sizeA: typeof key.sizeA != 'undefined' ? Math.round(key.sizeA * 10) : undefined,
        sizeB: typeof key.sizeB != 'undefined' ? Math.round(key.sizeB * 10) : undefined,
        marginX: typeof key.marginX != 'undefined' ? Math.round(key.marginX * 10) : undefined,
        marginY: typeof key.marginY != 'undefined' ? Math.round(key.marginY * 10) : undefined,
        letter: key.profile.letter && !shouldLegendGoInProfile(key.profile.letter) ? key.profile.letter : undefined,
      }

      let thisProfile: number | undefined = encodeProfile(key.profile)
      if (thisProfile - lastProfile != lastExpectedDiff) {
        cKey.keyProfile = thisProfile
      }
      lastProfile = thisProfile
      lastExpectedDiff = key.profile.letter ? 0x110 : 0x10
      if (!key.profile.row || key.profile.row >= 4) lastExpectedDiff = key.profile.letter ? 0x100 : 0

      if (typeof key.column !== 'undefined' && Math.round(key.column * 100) % 10 != 0) {
        delete cKey.column
        cKey.column2 = Math.round(key.column * 100)
      }
      if (typeof key.row !== 'undefined' && Math.round(key.row * 100) % 10 != 0) {
        delete cKey.row
        cKey.row2 = Math.round(key.row * 100)
      }
      column.key.push(cKey)
      if (typeof key.row !== 'undefined') lastRow = Math.round(key.row * 10)
    }
  }
  return cluster
}

export function encodeCosmosConfig(conf: CosmosKeyboard): Keyboard {
  return {
    keyProfile: encodeProfile({ profile: conf.profile, row: 1 }),
    partType: encodePartType(conf.partType),
    curvature: diffCurvature(encodeCurvature(conf.curvature), KEYBOARD_DEFAULTS.curvature!),
    wallShrouding: Math.round(conf.wallShrouding * 10),
    wallThickness: Math.round(conf.wallThickness * 10),
    wallXYOffset: Math.round(conf.wallXYOffset * 10),
    wallZOffset: Math.round(conf.wallZOffset * 10),
    keyBasis: encodeProfile({ profile: (conf.keyBasis || null), row: 1 }),
    connectors: encodeConnectors(conf.connectors),
    nScrews: conf.screwIndices.length,
    screwFlags: encodeScrewFlags(conf),
    microcontroller: encodeMicrocontroller(conf),
    roundedFlags: encodeRoundedFlags({ side: !!conf.rounded.side, top: !!conf.rounded.top }),
    keyboardFlags: encodeKeyboardFlags({ wrEnable: conf.wristRestEnable, unibody: conf.unibody, noMirrorConnectors: !conf.mirrorConnectors }),
    wristRestPosition: conf.wristRestPosition,
    cluster: conf.clusters.map(encodeCosmosCluster),
    shell: encodeShell(conf.shell),
    extra: {
      verticalClearance: Math.round(conf.verticalClearance * 10),
      wristRestAngle: Math.round(conf.wristRestProps.angle * 45),
      wristRestTaper: Math.round(conf.wristRestProps.taper * 45),
      wristRestTenting: Math.round(conf.wristRestProps.tenting * 45),
      wristRestLeftMaxWidth: Math.round(conf.wristRestProps.maxWidthLeft * 10),
      wristRestRightMaxWidth: Math.round(conf.wristRestProps.maxWidthRight * 10),
      wristRestSlope: Math.round(conf.wristRestProps.slope * 45),
      wristRestLeftExtension: Math.round(conf.wristRestProps.extensionLeft * 10),
      wristRestRightExtension: Math.round(conf.wristRestProps.extensionRight * 10),
      connectorLeftIndex: Math.round(conf.connectorLeftIndex * 10),
      connectorRightIndex: Math.round(conf.connectorRightIndex * 10),
      screwIndices: conf.screwIndices.some(c => c >= 0) ? conf.screwIndices.map(i => Math.round(i * 10) + 10) : [],
      roundedSideConcavity: conf.rounded.side ? Math.round(conf.rounded.side.concavity * 10) : undefined,
      roundedSideDivisor: conf.rounded.side ? Math.round(conf.rounded.side.divisor * 10) : undefined,
      roundedTopHorizontal: conf.rounded.top ? Math.round(conf.rounded.top.horizontal * 100) : undefined,
      roundedTopVertical: conf.rounded.top ? Math.round(conf.rounded.top.vertical * 100) : undefined,
      webMinThicknessFactor: Math.round(conf.webMinThicknessFactor * 10),
      microcontrollerAngle: Math.round(conf.microcontrollerAngle * 45),
      plateThickness: Math.round(conf.plateThickness * 10),
      plateArt: encodePlateArt(conf.plate?.art || null),
      footIndices: conf.plate?.footIndices?.map(i => Math.round(i * 10) + 10) || [],
      footDiameter: conf.plate?.footDiameter ? Math.round(conf.plate.footDiameter * 10) : undefined,
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
      if (typeof trimmedExtra[key] == 'undefined') delete trimmedExtra[key]
    }
    const usedTrimmedKeys = Object.entries(trimmedExtra).filter(([k, v]) => !Array.isArray(v) || v.length > 0)
    if (usedTrimmedKeys.length == 0) delete trimmed.extra
  }
  if (trimmed.curvature && Object.keys(trimmed.curvature!).length == 0) delete trimmed.curvature
  if (JSON.stringify(trimmed.shell) == JSON.stringify(KEYBOARD_DEFAULTS.shell)) trimmed.shell = {} as any
  // console.log('trimmed', trimmed)
  const data = Keyboard.toBinary(trimmed)
  return btoa(String.fromCharCode(...data))
}

// const test =
// 'cf:ChYIBRAFWAAYBCAFKL4BMLkBUAJAAEgAEhAIwgMYxgogowU4LihaMJAcWnsKEQjzkdyf8DMQkpPYjrGTiuQBEg8Ii4XQlhAQjYWAwN2NqwESDgjIkJYIEI2FvKC6jasBEg8IrYXkAxCbiYSe4NyQ5AESEAjig9DQARDrk5yXoPCR5AESDwjP5o84EIOPnJegvZLkARIRCPCFxJewARDhncyNwNiS5AFCUwgD4AEBeAbYAQEQAUgASABIAEgASABIAEgAYABoAHABGAAgASgAmAH0A6gB6AegAcgBsAEAkAGEB7gBAIABADAAOChYAYgBAcABAMgB2ATQAYQH'
const test =
  'expert:eJzlWt1P4zgQf+9fYfFyLGrcJukH9LQvcHcSOnGcFvYJ8eAmLvWRJpHt0HYR//vN2Gmaj3YpEnsbdBEKyXhsz/zmN5MwIUhipUmSagEXE3JtL8hn8twhZMmi6HYugseYKxj0u7nsZi6TLBTxw4T0jYxPS2ob0ZWIC+kfLNCJhDF6iqOPfH3OlADlo1XIjlCkAsmXl3EoAg7iO9ejwy7xfDwP8XSKpz6eXHMJ4/fFvNt1ymEtc01ErLjU20VvxDccvPK3ooskizWXSsSPE6JlxnEEfIpDHk7I8wveBkkcc2v1kZZSHVWEuOjXm3MYY09csgdeHQZH+GqCpo5QvhCBTGBQyySKOK6YysQInUxNncBMnjGleXxVV92YB9toEbDoIuJMsjgAn1yzJ97foFdqq6zmPIrAE6ItMlNAG3YhkUgnsFGkOHnpvHR6PfLX9e3vE2Lnkx7Rc771giyFnqNSzB+YFk8csDUBIkxykkYs4CFhmU4WzJgWrSlqX8ZmGbNnj4VPaGxINJt2UQ5bP7Eog0WWXPIJTqjHflCLvTc2ca9FH2fWAfd9Ou50AkPqIJNPTGdgqWVzcX89u0iibBEDgMNudeBLspwQI1QpC4DhRgRGuWcVoV0A5J5hO5MBcBsA7fROTjrkhHxVfJZFZAYYKq41zCGMhGI2A5fjkmmoi0qIVwpsXGNqKAriXu6FkV7UXKGUFkt097lWMud2bsIVc5IpDEVC0kQJTHWzc5amXBY7k0v9i4Js0EyD7nRtVICZ1os4JCs7CLNRG0ZhFWCkisoTvpFkNgPfjS8kd8Zs9Cfs87cx5jMQa0lupZodf0Kv7J7HEBVy14dsh597e+naS8PcimpV0y0ut5qFace5YjGI6JDf+EzEwla9TSRKeGwDAWoPUDImBOy/uwfb72B1DAbZJNli5Uwh2FyadDZVLmCQb1aJEMj5mYh4qejhIZFy3uYuMguAyvrISF7sAFMp0DzPeMz5TFm13Kp8tU1UJ1Vg8aAmXa/jK6alWB1vbGpyyR5BTiMH63AhNbY6bn7/UqzdwLg6ArguztfH1eijivHuvTD0GxjOW4thv50QDhoQxq2FsKUsbGZy1hII3Y+XyfNkgQoCH+5HDWD/aS2wHya9F62FsKXUbKa3aAmE/Tentwd/jBFn0IYMX4gwjHgzxR9bC+4rKf4TsW1mebe1KLaXoc1ET9qB4tvzvC2PcQnINFM8aiusH+YhTtuKYEt52Uzt9D9EsNrQacL49td0BxsmozZkuPGtmeK/threV/L856HbzPReq4F8V5p27g/tXup5tpiWOpchdvRAL1O27RpzJqemsVrM6xaNS9ukxKalAgoTtsAvA+X+q1n9WooHEe/rVzquS0/Lx9nurmRljjfAd5tdbc6ymj+gg8rRmIKz7muNTscfmhcnb0jH8GtM3aoCIF6jwh4i7Cr4NtSbu/JfcJ1S8F8Jb8XcUzoGZjj2l3kilCHoH+QyAOPA7EHe1UXKbPv/yWxLlE2a0FqI6y32+kcB0+ff0Wc38n3fBWofETzziaC06Vu6yXuz3a50QLLngHoeHe0naFnT8emoeuzpzDcmun16Ni4fTa4XUayxYYTWmeTw6XBntSil5KdaUa2XU8vWIZSTXbUZFg0epyyK3htiKAjegQWhEpkh7VfxPgzuM3paKRLNKO0D27cVwvXx1Ld14gC8lfmk+kwkC0VmiE3BRSVCbm72wP3jGN3/Pm57+f06cDvx7lPfrR4HA+64UKlG9lv27mfhu7H7h8Ht+9SvHIfCPaLj6sQDq8mg+nitp9P34B5SD6ltGwljevqukOM7iq3mSymU/sKV3vOm8D959PJVmkiNb2Asi/TmU3X+3yVodw0nFOFn1gm5A738tbWLcywn77udl38BMPpjNA=='
// 'expert:eJzlW91zmzgQf/dfseOX5joGGxwSh5u+NHcPnZs2N036lPGDDCLWBQMjiThux//7rQTGfDjxpZPG8lwmwbC7SLu//ZAwmyBNhIQ0kwxPfLgqTuAD/OgBLEkc38xZcJ9QgczTQUm7nvM0D1ly58NI0+isJqZJIuB0+SkJWUCRdGs5A9j8uWPbU2fTSu5mlVEf+vocWCIol/2Kec2+K+bn8ZZ0meaJpFyw5N4HyXOqOKhSEtLQhx8gWEjVZ8gemEi5D67twRrWSixIk4QGUlH7knPRbxDVZN+uPyKPPFBO7miTjQbRRx/GE3us6AsW8BSZkqdxTNWIGU810crFzAr0zRERkiaf26IRiYXWG+eRLCDxZUwJJ0mAmp/rSdX1tTJXbI0UcxrHyjRZQDYjguE0ELOsHBLWvXVvOIQvVzd/+lDcD0OQc7o1A5ZMzpVQQu+IZA8UQdeeAsIpZDEJaAgkl+mCaNXila2kPyV6GD3nkIQPStkQJJkNFB2nfiBxjoMsKae+uqEVBM65crw+uMXRVcexY3tTJd6G2bHdXi/QARrk/IHIHLUrIrO6voou0zhfJOhjd9BkfE2XPngatYwEGK2ahIo4F3aTXAyBHFfHLuEBRrGSWfd6w/fve/Aevgka5TFECJ6gUuJtQDC+oghtTWr6KVklpIDKMD5XcE9XwkbysDRFUy9b9ti2XQ0xeMq+mjo3c+2nhEIulA9SyFLBVO7qmfMso7yaGT7JdwLzQxKJsrOVFsGYLKxIQngsmHi3kkYujoKhKOL6Dd8hjSK0XdsCpTF6or9wnr+1Mh8wopZww0V08puyqpjzxJkM4HY0APU7LU6d4lSHbF3Ua0o61elWslLtpBSsmAod+INGLGFFGdt4oobH1hEododFxAfU/3aKut/i6MoZsMmuxaM1Q2dTrhMZ1AABwUQrhAAw2yMWK8nHkJQyqhBh3Dmbq1gPgCJnfU1ZFwwiMgz1Si6Ic1GIlVqVo2286jeBVT+2ztOr5DORnD2ebHTqxlLxE5RhZI23NK2p5ZbX62rkDsJNDqK6+Lg6afpeiWjbXgtBt4PgylQEHTMRHHcQnBuK4MhMAE87ACaGAmhoBHar4LkhALrtHD6aKpibiqChMVilyjxdKAGmNpf9Dqz/GArr0ZTGhaEAGhqW3dI4MQRAp53Y+0ujdWpGbWSmQrg/CA8DYbs4LlgYxrRbHe8NBXZ/dTwMrt3yODAUQVMj83gQNLU8dleYCzMQHL18gXHMWF9SQwHcn8QHAbC9unDEpbu2xGaCun9pOQim3bpom4mfoTF5NPgZWhS7q8roDfFrvjzpgviyZxf7TL2HHA/AkMeXzGQkn83nwyLZXme0bd2F5neD4X12tTksut2KOTQYSIPD9LiAPFjlbENY+tUMlF723uDtYXINhcngtOy+Jn1nUFq+6H3A28fbqZkoHSzcjgqlV65dvel/7U+S83wxq/UmhapnB+VyUTRWJZTwmW6dqu4bVK1JRRuSaksSuN0DslDdgPUOKz36FWd3LHmqI2nUaUhSz1PTuoh1sbsVqS4zdnc3NjXGcc6em22LuOWe2Tie5U7wMLEvmmyEvBULT0TCrqfM5pPb9lVZr+b9Pd5tqDqxzz2tpPrQr89atpwi19Oho3uyVDhsW/jSaBsEmxSwW+5rN8i1+/os3cG3o03Ocor+0yd6+1qtgO7I9lRbXW3mn2oI25323ibtt3leTNHfWQ1+MuubeHWzvvvSxD7fnfil82v58yrVz1AYrJE9/kU47N90eK1HVj1XY9uxDyzb2w9XVcpGr4Fg5xtS2zv3/oeR1Pn6HddKU4F4+yjpVptTQ7H5pUGyo9pMXgSD2k0Vy9KSMyG/UiF/fk9z/NsI+pilXKqdIsljuWmaL/9xRanUQkmRVMO3D7coV26vB5XnxHTQW/8LpL3jWg=='

// const state = deserialize(test, { options: {} })
// const keeb = Function('Trsf', 'mirror', state.content!.replace('export default', 'return').replace(/: [A-Z][a-z]+(\[\])?/g, ''))(ETrsf, mirror)
// console.log('re-encoded', toCosmosConfig(keeb))
// console.log('re-encoded', encodeCosmosConfig(toCosmosConfig(keeb)))

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
