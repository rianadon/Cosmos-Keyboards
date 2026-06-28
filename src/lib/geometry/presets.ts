import { type CosmosCluster, type CosmosKeyboard, mirrorCluster, sortClusters } from '$lib/worker/config.cosmos'
import { decodeCosmosCluster } from '$lib/worker/config.serialize'
import { mapObj, sum } from '$lib/worker/util'
import { Cluster } from '$target/proto/cosmos'

export type ThumbPreset = 'curved' | 'carbonfet' | 'manuform' | 'orbyl'
const THUMB_CONFIG: Record<ThumbPreset, { b64: string; n?: number[]; defaultN?: number }> = {
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

export type CenterPreset = 'display' | 'trackball'
const CENTER_CONFIG: Record<CenterPreset, { b64: string; n?: number[]; defaultN?: number }> = {
  display: {
    b64: 'CkwSFggIEDAgEyhkMPQDQIDmkBxIgICQ/QMSGAiRMBDAgAIgAECAvLgMSIC2qqH6B4gBUBILEEAgAECrhbyc8DgSCSAAQKyFvJzwODgAGAQiCgjIARDIARgAIABAgJAX',
  },
  trackball: {
    b64: 'CkcSFgiSMBDAgAIgAECA0JLgH0iA6tKg+gcSFQiWgBIQQCAAQICehugBSICGnqD6BxIJIABAq4Wcv/A4EgkgAECshZy/8Dg4AAoVEhEICBAwIAAoMjCgBkCsBUiEDzgUChUSEQgIEDAgACgyMKAGQKsFSIQPOBMYBCIKCMgBEMgBGAAgAECAkJfwBQ==',
  },
}

const decodedClusters = mapObj(THUMB_CONFIG, ({ b64 }) => decodeCosmosCluster(Cluster.fromBinary(Uint8Array.from(atob(b64), c => c.charCodeAt(0)))))
const mirroredDecodedClusters = mapObj(decodedClusters, c => mirrorCluster(c, undefined))
const decodedCenterClusters = mapObj(CENTER_CONFIG, ({ b64 }) => decodeCosmosCluster(Cluster.fromBinary(Uint8Array.from(atob(b64), c => c.charCodeAt(0)))))

export function setPreset(c: CosmosKeyboard, name: 'center', type: CenterPreset, side: 'center', howMany?: number): CosmosKeyboard
export function setPreset(c: CosmosKeyboard, name: 'thumbs', type: ThumbPreset, side: 'left' | 'right', howMany?: number): CosmosKeyboard
export function setPreset(c: CosmosKeyboard, name: 'thumbs' | 'center', type: ThumbPreset | CenterPreset, side: 'left' | 'right' | 'center', howMany?: number) {
  const { b64, n, defaultN } = name == 'thumbs' ? THUMB_CONFIG[type as ThumbPreset] : CENTER_CONFIG[type as CenterPreset]
  let cluster = decodeCosmosCluster(Cluster.fromBinary(Uint8Array.from(atob(b64), c => c.charCodeAt(0))))
  if (n) {
    const limit = howMany ?? defaultN ?? Infinity
    cluster.clusters.forEach(c => c.keys = c.keys.filter(k => Number(k.profile.letter) <= limit))
  }
  // Erase all key labels
  cluster.clusters.forEach(c => c.keys.forEach(k => k.profile.letter = undefined))
  if (side == 'left') cluster = mirrorCluster(cluster, c)

  const thumb = c.clusters.find((c) => c.name == name && c.side == side)
  if (thumb) {
    if (thumb.type != cluster.type) thumb.curvature = cluster.curvature
    thumb.type = cluster.type
    thumb.clusters = cluster.clusters
    thumb.rotation = cluster.rotation
    thumb.position = cluster.position
  } else if (side == 'center') {
    // Center clusters aren't included by default, so it needs to be added
    c.clusters.push(cluster)
    sortClusters(c.clusters)
  }
  return c
}

export function getPresetN(c: CosmosKeyboard, name: 'center', side: 'center'): { which: CenterPreset; options: number[]; n: number } | undefined
export function getPresetN(c: CosmosKeyboard, name: 'thumbs', side: 'left' | 'right'): { which: ThumbPreset; options: number[]; n: number } | undefined
export function getPresetN(c: CosmosKeyboard, name: 'thumbs' | 'center', side: 'left' | 'right' | 'center') {
  const thumb = c.clusters.find((c) => c.name == name && c.side == side)
  if (!thumb) return
  const whichThumb = Object.entries(name == 'thumbs' ? THUMB_CONFIG : CENTER_CONFIG) // @ts-ignore next line
    .find(([k, v]) => v.n && isPreset(c, name, k, side))

  if (whichThumb) {
    return {
      which: whichThumb[0] as CenterPreset | ThumbPreset,
      options: whichThumb[1].n!,
      n: sum(thumb?.clusters.map(c => c.keys.length)),
    }
  }
}

export function isPreset(c: CosmosKeyboard, name: 'center', type: CenterPreset, side: 'center'): boolean
export function isPreset(c: CosmosKeyboard, name: 'thumbs', type: ThumbPreset, side: 'left' | 'right'): boolean
export function isPreset(c: CosmosKeyboard, name: 'thumbs' | 'center', type: ThumbPreset | CenterPreset, side: 'left' | 'right' | 'center') {
  // @ts-ignore
  const cluster: CosmosCluster = { left: mirroredDecodedClusters, right: decodedClusters, center: decodedCenterClusters }[side][type]
  const thumb = c.clusters.find((c) => c.name == name && c.side == side)
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
