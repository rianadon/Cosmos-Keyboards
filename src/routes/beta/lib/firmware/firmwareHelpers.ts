import { getRowColumn } from '$lib/worker/config.cosmos'
import { DefaultMap, objEntriesNotNull } from '$lib/worker/util'
import type { CuttleKey } from '$target/cosmosStructs'
import { type AsyncZippable, unzip, type Unzipped, zip } from 'fflate'
import type { FullGeometry } from '../viewers/viewer3dHelpers'

const YAML_INDENT = '  ' // 2 spaces
const DTS_INDENT = '    ' // 4 spaces

const MAX_ARR_LENGTH = 80 // For DTS

let rawNum = 0
export const raw = () => '/*' + (rawNum++) // For emitting raw things to DTS

function camelToSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase())
}

/** Very simple function to process converting arrays and objects to YAML. */
function jsonToYaml(data: any, indent: number = 0): string {
  const indentation = YAML_INDENT.repeat(indent)

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

export function dtsFile(json: any) {
  return formatDTSExpression(json)
}

/** Formats a DTS property like rows = <7> */
function formatDTSProperty(k: string, v: any, indent: number): string {
  if (v === true) return camelToSnakeCase(k) + ';'
  let joiner = typeof v == 'object' ? ' ' : ' = '
  if (Array.isArray(v)) joiner = v.join(', ').length < MAX_ARR_LENGTH ? ' = ' : '\n' + DTS_INDENT.repeat(indent + 1) + '= '
  if (!k.startsWith('/*')) return camelToSnakeCase(k) + joiner + formatDTSExpression(v, indent + 1) + ';'

  return v
}

/** Joines lines of a DTS file together, adding newlines when appropriate */
function joinDTSLines(lines: string[]) {
  let output = ''
  for (let i = 0; i < lines.length; i++) {
    output += lines[i] + '\n'

    if (!lines[i + 1]) continue
    const t = lines[i].trimStart()
    const tn = lines[i + 1].trimStart()

    if (t.startsWith('#include') && !tn.startsWith('#include')) {
      output += '\n' // Add newline after the includes
    } else if (t.startsWith('#define') && !tn.startsWith('#define') && !tn.startsWith('//')) {
      output += '\n' // Add newline after the definitions
    } else if (t.includes('\n') || tn.includes('\n')) {
      output += '\n' // Add newline after properties and blocks
    }
  }
  return output
}

/** Formats a DTS expression */
function formatDTSExpression(json: any, indent: number = 0): string {
  if (typeof json == 'string') return (json.startsWith('&')) ? json : '"' + json + '"'
  if (typeof json == 'number') return '<' + json + '>'

  const indentation = DTS_INDENT.repeat(indent)
  if (Array.isArray(json)) {
    const simpleJoin = json.join(', ')
    if (simpleJoin.length < MAX_ARR_LENGTH) return simpleJoin
    return json.map((l, i) => i == 0 ? l : indentation + ', ' + l).join('\n') + '\n' + indentation
  }

  if (typeof json == 'object') {
    return (indent ? '{\n' : '') + joinDTSLines(
      Object.entries(json).filter(([k, v]) => v !== false && v !== null && typeof v !== 'undefined').map(([k, v]) => (
        indentation + formatDTSProperty(k, v, indent)
      )),
    ) + (indent ? DTS_INDENT.repeat(indent - 1) + '}' : '')
  }
  throw new Error(`Cannot cast type ${typeof json} to DTS`)
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
