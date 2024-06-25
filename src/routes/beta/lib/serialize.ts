import { Cuttleform } from '../../../../target/proto/cuttleform'
import { Lightcycle } from '../../../../target/proto/lightcycle'
import { Manuform } from '../../../../target/proto/manuform'

import cuttleform from '$assets/cuttleform.json' assert { type: 'json' }
import lightcycle from '$assets/lightcycle.json' assert { type: 'json' }
import manuform from '$assets/manuform.json' assert { type: 'json' }
import { cuttleConf, type CuttleformProto } from '$lib/worker/config'
import { toCosmosConfig } from '$lib/worker/config.cosmos'
import { decodeConfigIdk, encodeCosmosConfig, serializeCosmosConfig } from '$lib/worker/config.serialize'
import * as pako from 'pako'

export interface State {
  keyboard: string
  options: object
  content?: string
  upgradedFrom?: string
}

const SPLIT_CHAR = ':'

/** Return true if there is a difference between the two objects */
function areDifferent(data, reference) {
  return Object.keys(data).reduce((diff, key) => {
    if (Array.isArray(data[key])) {
      return (data[key].join(',') != reference[key].join(',')) || diff
    } else if (typeof data[key] === 'object' && data.oneofKind === reference.oneofKind) {
      return areDifferent(data[key], reference[key]) || diff
    }
    return (data[key] != reference[key]) || diff
  }, false)
}

/** Discard sub-dicts that are the same between two objects of objects. */
function difference2(data, reference, output) {
  return Object.keys(data).reduce((diff, key) => {
    if (areDifferent(data[key], reference[key])) {
      output[key] = data[key]
      return true
    }
    return diff
  }, false)
}

/** Fill in missing sections from a reference dictionary. */
function recreate2(data, reference) {
  return Object.keys(reference).reduce((diff, key) => {
    diff[key] = { ...reference[key], ...data[key] }
    if (!diff[key].oneofKind && reference[key].oneofKind) {
      diff[key].oneofKind = reference[key].oneofKind
    }
    return diff
  }, {})
}

export function serialize(state: State) {
  let data
  if (state.keyboard === 'manuform') {
    const diff = {}
    if (!difference2(state.options, manuform.options, diff)) return 'manuform'
    data = Manuform.toBinary(diff)
  } else if (state.keyboard === 'lightcycle') {
    const diff = {}
    if (!difference2(state.options, lightcycle.options, diff)) return 'lightcycle'
    data = Lightcycle.toBinary(diff)
  } else if (state.keyboard === 'cf') {
    let diff: any = {}
    if (!difference2(state.options, cuttleform.options, diff)) return 'cf'
    diff = { thumbCluster: {}, shell: {}, ...diff } // Avoids errors in toBinary
    console.log('ser', state, diff)
    data = Cuttleform.toBinary(diff)
  } else if (state.keyboard == 'cm') {
    const ser = serializeCosmosConfig(encodeCosmosConfig(state.options as any))
    return 'cm' + SPLIT_CHAR + ser
  } else {
    throw new Error(`Unknown keyboard type ${state.keyboard}`)
  }
  return state.keyboard + SPLIT_CHAR + window.btoa(String.fromCharCode(...data))
}

function clone(a: any) {
  return JSON.parse(JSON.stringify(a))
}

export function deserialize(str: string, fallback: () => State): State {
  if (str === 'manuform') return clone(manuform)
  if (str === 'lightcycle') return clone(lightcycle)
  if (str == 'cm') {
    return {
      keyboard: 'cm',
      // options: decodeConfigIdk(
      //   'CnMKDxIFEIADICcSABIAEgA4MQoPEgUQgA8gJxIAEgASADgdChYSBRCAGyAnEgASABIAEgA4CUCA8LwCChESBRCAJyAnEgASABIAEgA4CgoVEgUQgDMgJxIAEgASADgeQICGisAHGABA6IWgrvBVSNzwoqABCpIBChcSExDAwAFAgICQAkjCmaCVkLwBUEM4CAoVEhAQQECAgBhI0JWA3ZD1A1ALUJ4CChYSEhBAQICA1AJIwpmglZC8AVCGAVA6ChQSEBBAQICA8AFI5pn0p5ALUFdQfwoVEhAQQECAgKwDSPCZzLXQMFB0UJUBGAIiCgjIARDIARgAIABAy4uEpNAxSK2R3I3BkwY=',
      // ),
      options: toCosmosConfig(cuttleConf(cuttleform.options), 'right', true),
    }
  }

  const split = str.split(SPLIT_CHAR)
  if (split.length != 2) return fallback()

  const [keyboard, b64] = split
  const data = Uint8Array.from(atob(b64), c => c.charCodeAt(0))

  let options: object | null = null
  let content: string | undefined = undefined
  let upgradedFrom: string | undefined = undefined
  console.log('DECODE CM', keyboard)
  if (keyboard === 'manuform') {
    options = recreate2(Manuform.fromBinary(data), clone(manuform.options))
  }
  if (keyboard === 'lightcycle') {
    options = recreate2(Lightcycle.fromBinary(data), clone(lightcycle.options))
  }
  if (keyboard === 'cf') {
    options = toCosmosConfig(cuttleConf(recreate2(Cuttleform.fromBinary(data), clone(cuttleform.options)) as CuttleformProto), 'right', true)
    upgradedFrom = 'cf'
  }
  if (keyboard == 'cm') {
    options = decodeConfigIdk(
      b64,
    )
  }
  if (keyboard == 'expert') {
    options = fallback().options
    content = deserializeEditor(data)
  }
  if (!options) return fallback()

  return { keyboard, options, content, upgradedFrom }
}

export function toCuttleformProto(b64: string): CuttleformProto {
  const data = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  return recreate2(Cuttleform.fromBinary(data), clone(cuttleform.options)) as CuttleformProto
}

export function serializeEditor(content: string) {
  const data = pako.deflate(content)
  return 'expert' + SPLIT_CHAR + btoa(String.fromCharCode(...data))
}

function deserializeEditor(data: Uint8Array) {
  return pako.inflate(data, { to: 'string' })
}
