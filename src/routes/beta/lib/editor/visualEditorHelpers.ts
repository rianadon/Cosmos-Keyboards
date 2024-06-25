import cuttleform from '$assets/cuttleform.json'
import { approximateCosmosThumbOrigin, cosmosFingers, cuttleConf, decodeTuple, encodeTuple, newGeometry } from '$lib/worker/config'
import { type CosmosKey, type CosmosKeyboard, fromCosmosConfig, mirrorCluster, sideFromCosmosConfig, toCosmosConfig } from '$lib/worker/config.cosmos'
import { decodeCosmosCluster } from '$lib/worker/config.serialize'
import { estimatedBB } from '$lib/worker/geometry'
import { Vector } from '$lib/worker/modeling/transformation'
import { mapObj, objKeys, sum } from '$lib/worker/util'
import { Cluster } from '../../../../../target/proto/cosmos'

export function getSize(c: CosmosKeyboard, side: 'left' | 'right') {
  const fingers = c.clusters.find((c) => c.name == 'fingers' && c.side == side)
  if (!fingers) return undefined
  return {
    cols: fingers.clusters.length,
    rows: Math.max(0, ...fingers.clusters.map((c) => c.keys.length)),
  }
}

export function setClusterSize(keyboard: CosmosKeyboard, side: 'left' | 'right', rows: number, cols: number) {
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
  fingers.clusters = cosmosFingers(rows, cols, side)
  fingers.position = newTup

  return keyboard
}

export function clusterSeparation(c: CosmosKeyboard) {
  const rightBB = estimatedBB(newGeometry(sideFromCosmosConfig(c, 'right', false)!), false, false)
  const leftBB = estimatedBB(newGeometry(sideFromCosmosConfig(c, 'left', false)!), false, false)
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
      'Ci8SExDAjwJAgICYAkjCmaCVkLwBUEMSFhDApwJAgIDMAkjCmaCVkLwBUIYBWDo4CAoWEhEQwANAgIAgSNCVgN2Q9QNQC1CeAgorEhEQwBtAgID4AUjmmfynkAtQVxIUEMAzQICApANI8JnEtdAwUHRYlQFQfxgCIgoIyAEQyAEYACAAQMuL/J/QMUitkdyNwZMG',
    n: [2, 3, 4, 5],
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
