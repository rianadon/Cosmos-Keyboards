import { PART_INFO } from '$lib/geometry/socketsParts'
import { approximateCosmosThumbOrigin, cosmosFingers, decodeTuple, encodeTuple, newGeometry } from '$lib/worker/config'
import { type ConnectorMaybeCustom, type CosmosCluster, type CosmosKey, type CosmosKeyboard, indexOfKey, mirrorCluster, type PartType, sideFromCosmosConfig } from '$lib/worker/config.cosmos'
import { decodeCosmosCluster, LETTERS } from '$lib/worker/config.serialize'
import { estimatedBB } from '$lib/worker/geometry'
import { Vector } from '$lib/worker/modeling/transformation'
import { mapObj, objKeys, sum } from '$lib/worker/util'
import { Cluster } from '../../../../../target/proto/cosmos'
import { addColumnInPlace } from '../viewers/viewer3dHelpers'

export function getSize(c: CosmosKeyboard, side: 'left' | 'right') {
  const fingers = c.clusters.find((c) => c.name == 'fingers' && c.side == side)
  if (!fingers) return undefined
  return {
    cols: fingers.clusters.length,
    rows: Math.max(0, ...fingers.clusters.map((c) => c.keys.length)),
  }
}

export function setClusterSize(keyboard: CosmosKeyboard, side: 'left' | 'right', rows: number, cols: number, addExtraRow: boolean) {
  const originalSize = getSize(keyboard, side)
  if (!originalSize) return
  const originalThumb = approximateCosmosThumbOrigin(originalSize.rows, originalSize.cols)
  if (side == 'left') originalThumb.x *= -1
  const fingers = keyboard.clusters.find((c) => c.name == 'fingers' && c.side == side)
  if (!fingers) return keyboard
  const tup = decodeTuple(fingers.position || 0n)
  const originalPosition = new Vector(tup[0] / 10, tup[1] / 10, tup[2] / 10)

  const newThumb = approximateCosmosThumbOrigin(rows, cols)
  if (side == 'left') newThumb.x *= -1
  const newPosition = originalPosition.add(originalThumb).sub(newThumb)
  const newTup = encodeTuple(newPosition.toArray().map((x) => Math.round(10 * x)))
  fingers.clusters = cosmosFingers(rows, cols, side, addExtraRow)
  fingers.position = newTup

  return keyboard
}

export function clusterSeparation(c: CosmosKeyboard) {
  const rightSide = sideFromCosmosConfig(c, 'right', false)
  const leftSide = sideFromCosmosConfig(c, 'left', false)
  if (!leftSide || !rightSide) return 0
  const rightBB = estimatedBB(newGeometry(rightSide), false, false)
  const leftBB = estimatedBB(newGeometry(leftSide), false, false)
  return rightBB[0] - leftBB[1]
}

export function setClusterSeparation(c: CosmosKeyboard, desiredSeparation: number) {
  const currentSeparation = clusterSeparation(c)
  const separationToAdd = (desiredSeparation - currentSeparation) / 2
  for (const cluster of c.clusters) {
    let [x, y, z] = decodeTuple(cluster.position ?? 0n)
    x += Math.round(10 * (cluster.side == 'left' ? -separationToAdd : separationToAdd))
    cluster.position = encodeTuple([x, y, z])
  }
  let [x, y, z] = decodeTuple(c.wristRestPosition)
  x += 10 * separationToAdd
  c.wristRestPosition = encodeTuple([x, y, z])
  return c
}

export function clusterAngle(c: CosmosKeyboard) {
  const rightFingerCluster = c.clusters.find(c => c.name == 'fingers' && c.side == 'right')!
  const leftFingerCluster = c.clusters.find(c => c.name == 'fingers' && c.side == 'left') || rightFingerCluster
  const rightAngle = decodeTuple(rightFingerCluster.rotation || 0n)[2]
  const leftAngle = decodeTuple(leftFingerCluster.rotation || 0n)[2]
  return (rightAngle + leftAngle) / 45
}

export function setClusterAngle(c: CosmosKeyboard, desiredAngle: number) {
  const currentAngle = clusterAngle(c)
  const angleToAdd = (desiredAngle - currentAngle) / 2

  const rightFingerCluster = c.clusters.find(c => c.name == 'fingers' && c.side == 'right')!
  const leftFingerCluster = c.clusters.find(c => c.name == 'fingers' && c.side == 'left') || rightFingerCluster

  const rightCenter = decodeTuple(rightFingerCluster.position ?? 0n)
  const leftCenter = decodeTuple(leftFingerCluster.position ?? 0n)

  for (const cluster of c.clusters) {
    let [x, y, z] = decodeTuple(cluster.rotation ?? 0n)
    let [tx, ty, tz] = decodeTuple(cluster.position ?? 0n)
    const center = cluster.side == 'left' ? leftCenter : rightCenter

    z += Math.round(45 * (cluster.side == 'left' ? -angleToAdd : angleToAdd))

    const rad = Math.PI / 180 * (cluster.side == 'left' ? -angleToAdd : angleToAdd)
    const newTx = Math.round((tx - center[0]) * Math.cos(rad) - (ty - center[1]) * Math.sin(rad) + center[0])
    const newTy = Math.round((tx - center[0]) * Math.sin(rad) + (ty - center[1]) * Math.cos(rad) + center[1])
    cluster.rotation = encodeTuple([x, y, z])
    cluster.position = encodeTuple([newTx, newTy, tz])
  }
  let [x, y, z] = decodeTuple(c.wristRestPosition)
  const rad = Math.PI / 180 * angleToAdd
  const newX = Math.round((x - leftCenter[0]) * Math.cos(rad) - (y - leftCenter[1]) * Math.sin(rad) + leftCenter[0])
  const newY = Math.round((x - leftCenter[0]) * Math.sin(rad) + (y - leftCenter[1]) * Math.cos(rad) + leftCenter[1])
  c.wristRestPosition = encodeTuple([newX, newY, z])
  c.wristRestProps.angle += angleToAdd
  return c
}

// export function setThumbCluster(c: CosmosKeyboard, type: 'carbonfet' | 'manuform' | 'orbyl' | 'curved', side: 'left' | 'right') {
//   // @ts-ignore
//   let cc: CuttleformProto = { ...cuttleform.options }

//   if (type == 'manuform') {
//     cc.thumbCluster = {
//       oneofKind: 'defaultThumb',
//       defaultThumb: {
//         thumbCount: Cuttleform_DefaultThumb_KEY_COUNT.SIX,
//         encoder: false,
//         encoderType: ENCODER.EC11,
//       },
//     }
//   } else if (type == 'curved') {
//     cc.thumbCluster = {
//       oneofKind: 'curvedThumb',
//       curvedThumb: {
//         thumbCount: Cuttleform_CurvedThumb_KEY_COUNT.FIVE,
//         rowCurve: 0,
//         columnCurve: 0,
//         horizontalSpacing: 200,
//         verticalSpacing: 200,
//         encoder: false,
//         encoderType: ENCODER.EC11,
//       },
//     }
//   } else if (type == 'orbyl') {
//     cc.thumbCluster = {
//       oneofKind: 'orbylThumb',
//       orbylThumb: {
//         curvature: 0,
//       },
//     }
//   } else if (type == 'carbonfet') {
//     cc.thumbCluster = {
//       oneofKind: 'carbonfetThumb',
//       carbonfetThumb: {
//         rowCurve: -225,
//         columnCurve: -450,
//         horizontalSpacing: 200,
//         verticalSpacing: 205,
//       },
//     }
//   }
//   const cosc = toCosmosConfig(cuttleConf(cc), side)
//   const coscthumb = cosc.clusters.find((c) => c.name == 'thumbs')!

//   const thumb = c.clusters.find((c) => c.name == 'thumbs' && c.side == side)!
//   thumb.clusters = coscthumb.clusters
//   thumb.rotation = coscthumb.rotation
//   thumb.position = coscthumb.position
//   return c
// }

type Thumb = 'curved' | 'carbonfet' | 'manuform' | 'orbyl'
const THUMB_CONFIG: Record<Thumb, { b64: string; n?: number[]; defaultN?: number }> = {
  curved: {
    b64:
      'Ci8SExDAjwJAgICYAkjCmaCVkLwBUEMSFhDApwJAgIDMAkjCmaCVkLwBUIYBWDo4CAoWEhEQwANAgIAgSNCVgN2Q9QNQC1CeAgorEhEQwBtAgID4AUjmmfynkAtQVxIUEMAzQICApANI8JnEtdAwUHRYlQFQfwoYEhMQgD9AkrbtDEj6mejs8PwCUIYBUIICGAIiCgjIARDIARgAIABAy4v8n9AxSK2R3I3BkwY=',
    n: [2, 3, 4, 5, 6],
    defaultN: 5,
  },
  carbonfet: {
    b64: 'ChASBhBAIA5AARIEIAVAATgTCiESEQiAMBDAgAJAAUiAgIz9A1ByEgoIgCAQQEABUIUBOAAKHBIPCIAwEEBAAUiAgIz9A1BaEgcIgCAgD0ABOBQYAiIKCMgBEMgBGAAgAEDXicymkDZIqY2AtvGXHA==',
  },
  manuform: {
    b64:
      'CoMBEhYIgDAQwMACIABAi4XYlhBIjYWAwN0NEhQIgDAQwAMgAECaxJYISI2FgMDdDRISEMAbIABArYXcA0iZiYSe4NwQEhMQwCcgAEDig9jQAUjpk5yXoPAREhIQwDMgAEDP4o84SIOPnJegvRISFBDAPyAAQPCFvJewAUjhncyNwNgSOAAYAiIKCMgBEMgBGAAgAECdjcys8DNIpqngxvCzCA==',
    n: [2, 3, 4, 6],
    defaultN: 6,
  },
  orbyl: {
    b64: 'CgoSBRBAUPICOMAMCgsSBhDAgAIgKDioFAoJEgQQQCAoOJAcCgsSBhBAIChAADj4IwoYEhIQQCAAMMgBQICAgA1IgICwrAEwFjgAGAoiCgjIARDIARgAIABA25GknPA3SISPlNageA==',
  },
}

export function setThumbCluster(c: CosmosKeyboard, type: Thumb, side: 'left' | 'right', howMany?: number) {
  const { b64, n, defaultN } = THUMB_CONFIG[type]
  let cluster = decodeCosmosCluster(Cluster.fromBinary(Uint8Array.from(atob(b64), c => c.charCodeAt(0))))
  if (n) {
    const limit = howMany ?? defaultN ?? Infinity
    cluster.clusters.forEach(c => c.keys = c.keys.filter(k => Number(k.profile.letter) <= limit))
  }
  // Erase all key labels
  cluster.clusters.forEach(c => c.keys.forEach(k => k.profile.letter = undefined))
  if (side == 'left') cluster = mirrorCluster(cluster)

  const thumb = c.clusters.find((c) => c.name == 'thumbs' && c.side == side)
  if (!thumb) return c
  if (thumb.type != cluster.type) thumb.curvature = cluster.curvature
  thumb.type = cluster.type
  thumb.clusters = cluster.clusters
  thumb.rotation = cluster.rotation
  thumb.position = cluster.position
  return c
}

const decodedClusters = mapObj(THUMB_CONFIG, ({ b64 }) => decodeCosmosCluster(Cluster.fromBinary(Uint8Array.from(atob(b64), c => c.charCodeAt(0)))))
const mirroredDecodedClusters = mapObj(decodedClusters, c => mirrorCluster(c))

export function getThumbN(c: CosmosKeyboard, side: 'left' | 'right') {
  const thumb = c.clusters.find((c) => c.name == 'thumbs' && c.side == side)
  if (!thumb) return
  const whichThumb = objKeys(THUMB_CONFIG).find(k => THUMB_CONFIG[k].n && isThumb(c, k, side))
  if (whichThumb) {
    return {
      which: whichThumb,
      options: THUMB_CONFIG[whichThumb].n!,
      n: sum(thumb?.clusters.map(c => c.keys.length)),
    }
  }
}

export function isThumb(c: CosmosKeyboard, type: Thumb, side: 'left' | 'right') {
  const cluster = (side == 'left' ? mirroredDecodedClusters : decodedClusters)[type]
  const thumb = c.clusters.find((c) => c.name == 'thumbs' && c.side == side)
  if (!thumb || thumb.clusters.length == 0) return false

  return thumb.clusters.every(c =>
    cluster.clusters.find(c2 =>
      c.column == c2.column && c.type == c2.type
      && c.position == c2.position && c.rotation == c2.rotation
      && c.keys.every(k =>
        c2.keys.find(k2 =>
          k.row == k2.row && k.column == k2.column
          && k.position == k2.position && k.rotation == k2.rotation
        )
      )
    )
  )
}

function connnectorString(connector: ConnectorMaybeCustom) {
  if (!connector.preset) return 'Custom'
  if (connector.preset == 'trrs') return 'TRRS'
  if (connector.preset == 'usb') {
    return { slim: 'Sm', average: 'M', big: 'Lg' }[connector.size] + '. USB'
  }
}

export function connectorsString(connectors: ConnectorMaybeCustom[]) {
  if (!connectors.length) return 'None'
  return connectors.map(connnectorString).join(', ')
}

export function getNKeys(kbd: CosmosKeyboard, type: PartType['type']) {
  let nKeys = 0
  for (const name of ['fingers', 'thumbs']) {
    const rightSide = kbd.clusters.find(c => c.side == 'right' && c.name == name)
    const leftSide = kbd.clusters.find(c => c.side == 'left' && c.name == name)

    const nRight = rightSide
      ? sum(rightSide.clusters.map(c => c.keys.filter(k => !type || (k.partType.type || c.partType.type || kbd.partType.type) == type).length))
      : 0
    const nLeft = leftSide
      ? sum(rightSide!.clusters.map(c => c.keys.filter(k => !type || (k.partType.type || c.partType.type || kbd.partType.type) == type).length))
      : nRight
    nKeys += nRight + nLeft
  }
  return nKeys
}

export const isNumKey = (k: CosmosKey) => ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(k.profile.letter!)
export const isFnKey = (k: CosmosKey) =>
  ['f0', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12', 'f13', 'f14'].includes(
    k.profile.letter?.toLowerCase() || '',
  )

/** Determines if any finger key matches the predicate */
export function hasKey(kbd: CosmosKeyboard, predicate: (k: CosmosKey) => boolean) {
  return kbd.clusters.some(cluster => cluster.name == 'fingers' && cluster.clusters.some(col => col.keys.some(predicate)))
}

function mapClusters<T extends CosmosCluster | CosmosKeyboard>(c: T, fn: (c: CosmosCluster, i: number) => CosmosCluster): T {
  return { ...c, clusters: c.clusters.map(fn) }
}
function filterClusters<T extends CosmosCluster | CosmosKeyboard>(c: T, fn: (c: CosmosCluster, i: number) => boolean): T {
  return { ...c, clusters: c.clusters.filter(fn) }
}

/** Returns a copy of the config, where only keys matching the predicate are kept */
export function filterKeys(kbd: CosmosKeyboard, predicate: (k: CosmosKey, col: CosmosCluster, cl: CosmosCluster, index: number) => boolean): CosmosKeyboard {
  let i = 0
  return mapClusters(kbd, cluster =>
    mapClusters(cluster, col => ({
      ...col,
      keys: col.keys.filter(k => predicate(k, col, cluster, i++)),
    })))
}

/** Map over keys */
export function mapKeys<T>(kbd: CosmosKeyboard, predicate: (k: CosmosKey, col: CosmosCluster, cl: CosmosCluster, index: number) => T): T[] {
  let i = 0
  return kbd.clusters.flatMap(cluster => cluster.clusters.flatMap(col => col.keys.map(k => predicate(k, col, cluster, i++))))
}

/** Find the indices of the five alpha/letter columns.
 * These are determined by finding the 5 columns with the largest number of letters.
 * They are sorted by column position from smallest to largest
 */
function alphaColumns(kbd: CosmosKeyboard, cluster: CosmosCluster) {
  const columns = cluster.clusters.map((col, index) => ({
    index,
    column: col.column ?? -1000,
    nLetters: col.keys
      .filter(k => PART_INFO[k.partType.type || col.partType.type || kbd.partType.type!].keycap && LETTERS.includes(k.profile.letter!))
      .length,
  })).filter(c => c.nLetters > 0)
  columns.sort((a, b) => b.nLetters - a.nLetters)
  const topColumns = columns.slice(0, 5)
  return topColumns.sort((a, b) => a.column - b.column).map(c => c.index)
}

export function addRow(kbd: CosmosKeyboard, fn: (side: 'left' | 'right', alphas: number[], row: number, column: number) => string | null) {
  return mapClusters(kbd, cluster => {
    if (cluster.name !== 'fingers') return cluster // Only change fingers cluster
    const alphas = alphaColumns(kbd, cluster)
    return mapClusters(cluster, (col, i) => {
      const firstKey = col.keys.filter(a => !!a.row).sort((a, b) => a.row! - b.row!)[0]
      if (!firstKey) return col
      if (!PART_INFO[firstKey.partType.type || col.partType.type || kbd.partType.type!].keycap) return col // Skip if first key not a keycap
      const oldRow = firstKey?.profile.row
      const row = (firstKey?.row || 0) - 1
      const letter = fn(cluster.side, alphas, i, cluster.clusters.length)
      if (letter === null) return col // Skip adding key if fn returns null
      const key: CosmosKey = {
        profile: {
          letter,
          row: typeof oldRow != 'undefined' ? Math.max(0, Math.min(4, oldRow - 1)) : undefined,
          home: null,
        },
        partType: {},
        row: row,
        position: 0n,
        rotation: 0n,
      }
      return { ...col, keys: [key, ...col.keys] }
    })
  })
}

function numberKeyAdder(side: 'left' | 'right', alphas: number[], i: number, nColumns: number) {
  const ind = alphas.indexOf(i)
  if (ind < 0) return null
  if (side == 'right') {
    return ['6', '7', '8', '9', '0'][ind]
  } else {
    return ['1', '2', '3', '4', '5'][ind]
  }
}

function fnKeyAdder(side: 'left' | 'right', alphas: number[], i: number, nColumns: number) {
  let numKey = numberKeyAdder(side, alphas, i, nColumns)
  if (!numKey) return ''
  if (numKey == '0') numKey = '10'
  return 'F' + numKey
}

export function toggleNumRow(kbd: CosmosKeyboard) {
  if (hasKey(kbd, isNumKey)) {
    // Remove the number and function rows
    const maxRow = Math.max(...mapKeys(kbd, k => isNumKey(k) || isFnKey(k) ? k.row! : -Infinity))
    return filterKeys(kbd, k => k.row! > maxRow)
  } else {
    return addRow(kbd, numberKeyAdder)
  }
}

export function toggleFnRow(kbd: CosmosKeyboard) {
  if (hasKey(kbd, isFnKey)) {
    // Remove the function row
    const maxRow = Math.max(...mapKeys(kbd, k => isFnKey(k) ? k.row! : -Infinity))
    return filterKeys(kbd, k => k.row! > maxRow)
  } else if (hasKey(kbd, isNumKey)) {
    // Add only Fn row
    return addRow(kbd, fnKeyAdder)
  } else {
    // Add both Fn and Num Rows
    return addRow(addRow(kbd, numberKeyAdder), fnKeyAdder)
  }
}

function addCol(kbd: CosmosKeyboard, direction: number) {
  for (const cluster of kbd.clusters) {
    if (cluster.name != 'fingers') continue
    const sign = direction * (cluster.side == 'right' ? -1 : 1)
    const minKey = cluster.clusters.sort((a, b) => sign * (a.column! - b.column!))[0].keys[0]
    if (!minKey) continue
    const keyIndex = indexOfKey(kbd, minKey)
    if (keyIndex === null) continue
    addColumnInPlace(kbd, keyIndex, -sign)
  }
  return kbd
}

function hasLeftCol(kbd: CosmosKeyboard, cluster: CosmosCluster) {
  const minCol = Math.min(...alphaColumns(kbd, cluster).map(i => cluster.clusters[i].column!))
  return cluster.clusters.some(c => c.column! < minCol)
}
function hasRightCol(kbd: CosmosKeyboard, cluster: CosmosCluster) {
  const maxCol = Math.max(...alphaColumns(kbd, cluster).map(i => cluster.clusters[i].column!))
  return cluster.clusters.some(c => c.column! > maxCol)
}
function withoutLeftCols(kbd: CosmosKeyboard, cluster: CosmosCluster) {
  const minCol = Math.min(...alphaColumns(kbd, cluster).map(i => cluster.clusters[i].column!))
  return filterClusters(cluster, c => !(c.column! < minCol))
}
function withoutRightCols(kbd: CosmosKeyboard, cluster: CosmosCluster) {
  const maxCol = Math.max(...alphaColumns(kbd, cluster).map(i => cluster.clusters[i].column!))
  return filterClusters(cluster, c => !(c.column! > maxCol))
}
export function hasInnerCol(kbd: CosmosKeyboard) {
  return kbd.clusters.some(cluster => {
    if (cluster.name !== 'fingers') return false
    return cluster.side == 'left' ? hasRightCol(kbd, cluster) : hasLeftCol(kbd, cluster)
  })
}
export function hasOuterCol(kbd: CosmosKeyboard) {
  return kbd.clusters.some(cluster => {
    if (cluster.name !== 'fingers') return false
    return cluster.side == 'left' ? hasLeftCol(kbd, cluster) : hasRightCol(kbd, cluster)
  })
}
function withoutInnerCols(kbd: CosmosKeyboard) {
  return mapClusters(kbd, cluster =>
    cluster.name !== 'fingers'
      ? cluster
      : (cluster.side == 'left' ? withoutRightCols(kbd, cluster) : withoutLeftCols(kbd, cluster)))
}
function withoutOuterCols(kbd: CosmosKeyboard) {
  return mapClusters(kbd, cluster =>
    cluster.name !== 'fingers'
      ? cluster
      : (cluster.side == 'left' ? withoutLeftCols(kbd, cluster) : withoutRightCols(kbd, cluster)))
}

export function toggleOuterCol(kbd: CosmosKeyboard) {
  if (hasOuterCol(kbd)) {
    return withoutOuterCols(kbd)
  } else {
    // Add the column
    return addCol(kbd, 1)
  }
}

export function toggleInnerCol(kbd: CosmosKeyboard) {
  if (hasInnerCol(kbd)) {
    return withoutInnerCols(kbd)
  } else {
    // Add the column
    return addCol(kbd, -1)
  }
}
