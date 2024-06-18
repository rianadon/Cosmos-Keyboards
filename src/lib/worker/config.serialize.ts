/**
 * For now, the new serializationf format for Cosmos is kept in a separate file.
 */

import ETrsf from '$lib/worker/modeling/transformation-ext'
// import { deserialize } from 'src/routes/beta/lib/serialize'
import {
  decodeBasicShellFlags,
  decodeClusterFlags,
  decodeConnector,
  decodeKeyboardFlags,
  decodeKeycap,
  decodeMicrocontroller,
  decodePartVariant,
  decodeRoundedFlags,
  decodeScrewFlags,
  encodeBasicShellFlags,
  encodeClusterFlags,
  encodeConnector,
  encodeKeyboardFlags,
  encodeKeycap,
  encodeMicrocontroller,
  encodePartVariant,
  encodeRoundedFlags,
  encodeScrewFlags,
} from '../../../target/cosmosStructs'
import { Cluster, Curvature, Key, Keyboard, KeyboardExtra } from '../../../target/proto/cosmos'
import { type Cuttleform, type CuttleKey, type CuttleKeycapKey, encodeTuple, type Keycap, tupleToRot, tupleToXYZ } from './config'
import { type CosmosKey, type CosmosKeyboard, type PartType, type Profile, toCosmosConfig } from './config.cosmos'
import { DEFAULT_MWT_FACTOR } from './geometry.thickWebs'

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

// ----------  PROFILES ----------
// dprint-ignore
const LETTERS = [
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

export function encodeProfile(p: Partial<Profile>) {
  let row = p.row ?? 1
  if (typeof row !== 'undefined' && (row < 1 || row > 8)) throw new Error('Row out of bounds')
  let letter = 0
  let inferredHome: typeof INFERRED_HOMING[number] | undefined = undefined
  if (p.letter && p.letter.length) {
    if (LETTERS.includes(p.letter)) {
      letter = (LETTERS.indexOf(p.letter) << 1) | 1
      inferredHome = INFERRED_HOMING[letter >> 1]
    } else letter = p.letter.charCodeAt(0) << 1
  }
  return encodeKeycap({
    profile: p.profile ?? null,
    row: row - 1,
    letter: letter,
    home: diff(p.home, inferredHome) ?? null,
  })
}

export function decodeProfile(flags: number): Profile {
  const { profile, row, letter: letterId, home } = decodeKeycap(flags)

  let letter = letterId > 0 ? String.fromCharCode(letterId >> 1) : undefined
  let inferredHoming = undefined
  if (letterId & 1) {
    letter = lookupId(LETTERS, letterId >> 1, 'letter')
    inferredHoming = INFERRED_HOMING[letterId >> 1]
  }
  return { profile: profile ?? undefined, row: row + 1, letter, home: home || inferredHoming || null }
}

const KEYBOARD_DEFAULTS: Keyboard = {
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
  keyBasis: encodeProfile({ profile: 'xda' }),
  connector: encodeConnector({ connector: 'trrs', connectorSizeUSB: 'average' }),
  nScrews: 7,
  screwFlags: encodeScrewFlags({ screwSize: 'M3', screwType: 'screw insert', screwCountersink: true, clearScrews: true }),
  microcontroller: encodeMicrocontroller({ microcontroller: 'kb2040-adafruit', fastenMicrocontroller: true }),
  roundedFlags: encodeRoundedFlags({ side: false, top: false }),
  keyboardFlags: encodeKeyboardFlags({ wrEnable: true, unibody: false }),
  wristRestPosition: encodeTuple([1000, -1000, 0]),
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
  wristRestAngle: 450,
  wristRestMaxWidth: 1000,
  wristRestTenting: 270,
  wristRestSlope: 225,
  connectorIndex: -10,
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

export function decodeConfigIdk(b64: string): CosmosKeyboard {
  const keeb = deserializeCosmosConfig(b64)
  const keebExtra = keeb.extra

  const roundedFlags = decodeRoundedFlags(keeb.roundedFlags)
  let lastCluster: Cluster | null = null

  const conf: CosmosKeyboard = {
    partType: decodePartType(keeb.partType || 0),
    wallThickness: keeb.wallThickness / 10,
    wallShrouding: keeb.wallShrouding / 10,
    webMinThicknessFactor: keebExtra.webMinThicknessFactor / 10,
    verticalClearance: keebExtra.verticalClearance / 10,
    keyBasis: decodeProfile(keeb.keyBasis).profile!,
    profile: decodeProfile(keeb.keyProfile).profile!,
    screwIndices: new Array(keeb.nScrews).fill(-1),
    ...decodeScrewFlags(keeb.screwFlags),
    rounded: {
      top: roundedFlags.top ? { horizontal: keebExtra.roundedTopHorizontal / 100, vertical: keebExtra.roundedTopVertical / 100 } : undefined,
      side: roundedFlags.side ? { divisor: keebExtra.roundedSideDivisor / 10, concavity: keebExtra.roundedSideConcavity / 10 } : undefined,
    },
    curvature: decodeCurvature(keeb.curvature || {}),
    ...decodeConnector(keeb.connector),
    ...decodeMicrocontroller(keeb.microcontroller),
    shell: decodeShell(keeb.shell),
    wristRestEnable: decodeKeyboardFlags(keeb.keyboardFlags).wrEnable,
    unibody: decodeKeyboardFlags(keeb.keyboardFlags).unibody,
    wristRestProps: {
      angle: keebExtra.wristRestAngle / 45,
      maxWidth: keebExtra.wristRestMaxWidth / 10,
      tenting: keebExtra.wristRestTenting / 45,
      slope: keebExtra.wristRestSlope / 45,
    },
    wristRestPosition: keeb.wristRestPosition,
    connectorIndex: keebExtra.connectorIndex / 10,
    clusters: keeb.cluster.map(clusterA => {
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
              if (typeof key.row == 'undefined' && typeof key.row2 == 'undefined' && lastKey) key.row = (lastKey.row || 0) + 10
              if (key.column2) key.column = key.column2 / 10

              if (!key.keyProfile && lastKey && lastKey.keyProfile) {
                let expectedDiff = decodeProfile(lastKey.keyProfile).row! < 4 ? 0x110 : 0x100
                if (!decodeProfile(lastKey.keyProfile).letter) expectedDiff &= 0x7F
                key.keyProfile = lastKey.keyProfile + expectedDiff
              }
              lastKey = key
              return {
                partType: decodePartType(key.partType || 0),
                profile: decodeProfile(key.keyProfile || 0),
                row: typeof key.row2 !== 'undefined' ? key.row2 / 100 : (typeof key.row !== 'undefined' ? key.row / 10 : undefined),
                // column: key.column ? key.column / 10 : undefined,
                position: key.position,
                rotation: key.rotation,
                sizeA: typeof key.sizeA !== 'undefined' ? key.sizeA : undefined,
                sizeB: typeof key.sizeB !== 'undefined' ? key.sizeB : undefined,
              }
            }),
          }
        }),
      }
    }),
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

export function encodeCosmosConfig(conf: CosmosKeyboard): Keyboard {
  const clusters: Cluster[] = []
  let lastCol = 0
  for (const clusterA of conf.clusters) {
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
    clusters.push(cluster)
    for (const clusterB of clusterA.clusters) {
      const col = clusterB.column
      const column: Cluster = {
        idType: diff(encodeClusterFlags(clusterB), cluster.idType),
        cluster: [],
        key: [],
        partType: diff(encodePartType(clusterA.partType), 0),
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
          row: typeof key.row != 'undefined' && Math.round(key.row * 10) != lastRow + 10 ? Math.round(key.row * 10) : undefined,
          rotation: key.rotation,
          position: key.position,
        }

        let thisProfile: number | undefined = encodeProfile(key.profile)
        if (thisProfile - lastProfile != lastExpectedDiff) {
          cKey.keyProfile = thisProfile
        }
        lastProfile = thisProfile
        lastExpectedDiff = key.profile.letter ? 0x110 : 0x10
        if (!key.profile.row || key.profile.row >= 4) lastExpectedDiff = key.profile.letter ? 0x100 : 0

        if (typeof key.row !== 'undefined' && Math.round(key.row * 100) % 10 != 0) {
          delete cKey.row
          cKey.row2 = Math.round(key.row * 100)
        }
        column.key.push(cKey)
        if (typeof key.row !== 'undefined') lastRow = Math.round(key.row * 10)
      }
    }
  }

  return {
    keyProfile: encodeProfile({ profile: conf.profile, row: 1 }),
    partType: encodePartType(conf.partType),
    curvature: diffCurvature(encodeCurvature(conf.curvature), KEYBOARD_DEFAULTS.curvature!),
    wallShrouding: Math.round(conf.wallShrouding * 10),
    wallThickness: Math.round(conf.wallThickness * 10),
    keyBasis: encodeProfile({ profile: (conf.keyBasis || null), row: 1 }),
    connector: encodeConnector(conf),
    nScrews: conf.screwIndices.length,
    screwFlags: encodeScrewFlags(conf),
    microcontroller: encodeMicrocontroller(conf),
    roundedFlags: encodeRoundedFlags({ side: !!conf.rounded.side, top: !!conf.rounded.top }),
    keyboardFlags: encodeKeyboardFlags({ wrEnable: conf.wristRestEnable, unibody: conf.unibody }),
    wristRestPosition: conf.wristRestPosition,
    cluster: clusters,
    shell: {
      oneofKind: 'basicShell',
      basicShell: {
        flags: encodeBasicShellFlags({ lip: false }),
      },
    },
    extra: {
      verticalClearance: Math.round(conf.verticalClearance * 10),
      wristRestAngle: Math.round(conf.wristRestProps.angle * 45),
      wristRestTenting: Math.round(conf.wristRestProps.tenting * 45),
      wristRestMaxWidth: Math.round(conf.wristRestProps.maxWidth * 10),
      wristRestSlope: Math.round(conf.wristRestProps.slope * 45),
      connectorIndex: Math.round(conf.connectorIndex * 10),
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
  if (trimmed.curvature && Object.keys(trimmed.curvature!).length == 0) delete trimmed.curvature
  if (JSON.stringify(trimmed.shell) == JSON.stringify(KEYBOARD_DEFAULTS.shell)) trimmed.shell = {} as any
  // console.log(trimmed, '')
  const data = Keyboard.toBinary(trimmed)
  return btoa(String.fromCharCode(...data))
}

export function encodeConfig(conf: Cuttleform) {
  return serializeCosmosConfig(encodeCosmosConfig(toCosmosConfig(conf)))
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
