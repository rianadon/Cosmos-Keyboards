import { getRowColumn } from '$lib/worker/config.cosmos'
import { DefaultMap, objEntriesNotNull } from '$lib/worker/util'
import type { CuttleKey } from '$target/cosmosStructs'
import { type AsyncZippable, unzip, type Unzipped, zip } from 'fflate'
import type { FullGeometry } from '../viewers/viewer3dHelpers'

/** Very simple function to process converting arrays and objects to YAML. */
function jsonToYaml(data: any, indent: number = 0): string {
  const indentation = '  '.repeat(indent)

  if (Array.isArray(data)) {
    return data
      .map(item => `${indentation}- ` + jsonToYaml(item, indent + 1).trim())
      .join('\n')
  } else if (typeof data === 'object' && data !== null) {
    return Object.entries(data)
      .map(([key, value]) => {
        const prefix = typeof value === 'object' && value !== null ? '\n' : ' '
        return `${indentation}${key}:${prefix}${jsonToYaml(value, indent + 1)}`
      })
      .join('\n')
  }
  return String(data)
}

/** Convert a json object to a YAML document. */
export function yamlFile(data: any, newDoc = false): string {
  if (newDoc) return '---\n' + jsonToYaml(data) + '\n'
  return jsonToYaml(data) + '\n'
}

export function jsonFile(json: any) {
  return JSON.stringify(json, null, 4) + '\n'
}
type ModifiedKey = { key: CuttleKey; offsetX: number }
function sortKeysFn(a: ModifiedKey, b: ModifiedKey) {
  const aPos = getRowColumn(a.key.position)
  const bPos = getRowColumn(b.key.position)
  const dy = bPos.row - aPos.row

  if (dy > 0.5) return -1
  if (dy < -0.5) return 1
  return aPos.column + a.offsetX - bPos.column - b.offsetX
}

export function sortKeysLogically(keys: ModifiedKey[]) {
  const clusterGroups = new DefaultMap<string, ModifiedKey[]>(() => [])
  for (const k of keys) clusterGroups.get(k.key.cluster).push(k)
  return Array.from(clusterGroups.values()).flatMap(keys => keys.sort(sortKeysFn))
}

export function logicalKeys(geo: FullGeometry): CuttleKey[] {
  return sortKeysLogically(
    objEntriesNotNull(geo).flatMap(
      ([kbd, g]) => g.c.keys.map(k => ({ key: k, offsetX: kbd == 'right' ? 1000 : 0 })),
    ),
  ).map(k => k.key)
}

export function zipPromise(arg: AsyncZippable): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zip(arg, (err, data) => {
      if (err) reject(err)
      else resolve(data)
    })
  })
}

export function unzipPromise(arg: Uint8Array): Promise<Unzipped> {
  return new Promise((resolve, reject) => {
    unzip(arg, (err, data) => {
      if (err) reject(err)
      else resolve(data)
    })
  })
}

export async function unzipURL(url: string): Promise<Unzipped> {
  const buffer = await (await fetch(url)).arrayBuffer()
  return await unzipPromise(new Uint8Array(buffer))
}
