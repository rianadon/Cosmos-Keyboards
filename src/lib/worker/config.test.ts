import defaultConfig from '$assets/cuttleform.json' assert { type: 'json' }
import { decodeConfigIdk, encodeConfig, encodeCosmosConfig, serializeCosmosConfig } from '$lib/worker/config.serialize'
import { expect, test } from 'bun:test'
import { deserialize } from 'src/routes/beta/lib/serialize'
import { Quaternion } from 'three'
import { cuttleConf, type Cuttleform } from './config'
import { fromCosmosConfig, toCosmosConfig } from './config.cosmos'
import Trsf from './modeling/transformation'

test('Empty config has empty URL', () => {
  const keeb = fromCosmosConfig(decodeConfigIdk(''))
  const reencoded = encodeConfig(keeb)
  expect(reencoded).toBe('')
})

// test('Decode the default configuration', () => {
//   const encoded =
//     'CnMKDxIFEIUDICcSABIAEgA4MQoPEgUQhQ8gJxIAEgASADgdChYSBRCFGyAnEgASABIAEgA4CUCA8LwCChESBRCFJyAnEgASABIAEgA4CgoVEgUQhTMgJxIAEgASADgeQICGisAHGABA6IWgrvBVSNzwoqABCpoBChcSExCFwAFAgICQAkjCmaCVkLwBUEM4CAoXEhMQBUCAgBhI0JWA3ZD1A1ALWJ4COBwKGBIUEAVAgIDUAkjCmaCVkLwBUIYBWDo4BgoWEhIQBUCAgPABSOaZ9KeQC1BXWH84CwoXEhMQBUCAgKwDSPCZzLXQMFB0WJUBOA0YAiIKCMgBEMgBGAAgAEDLi4Sk0DFIrZHcjcGTBg=='
//   const config = cuttleConf(defaultConfig.options as any)
//   const decoded = decodeConfig(encoded)
//   expect(preprocessCuttleform(decoded, config)).toMatchObject(preprocessCuttleform(config))
// })

test('Encode then decode the default configuration', () => {
  const config = cuttleConf(defaultConfig.options as any)
  const cosmos = toCosmosConfig(config)
  const encoded = serializeCosmosConfig(encodeCosmosConfig(cosmos))
  console.log(encoded)
  // The decoded cosmosconf should match
  expect(decodeConfigIdk(encoded)).toMatchObject(cosmos)
  // The full encode then decode should match the configuration
  const decoded2 = fromCosmosConfig(decodeConfigIdk(encoded))
  expect(preprocessCuttleform(decoded2, config)).toMatchObject(preprocessCuttleform(config))
})

test('Encode then decode a custom thumb model', () => {
  const url =
    'cf:ChYIBRAFWAAYBCAFKNIBMM0BUAJAAEgAWpUBChEIy4vMpdAxEI3FlK3is4rkARIRCKCDoIzACBDCmaCVkLyB5AESDwi8ieAwENCVgN2Q9YPkARIQCPSWiqgFEMKZoJWQvIHkARIPCP+DwI3ABxDmmfSnkItyEhEIq4Wcj7ANEPCZzLXQsIDkARIRCN6Sh5jfQBCOoZCdkpCC5AESEwiEhZSVsJeCARCim+CU8tCB5AE='
  const config = cuttleConf(deserialize(url, {} as any).options as any)
  const cosmos = toCosmosConfig(config)
  const encoded = encodeConfig(config)
  expect(decodeConfigIdk(encoded)).toMatchObject(cosmos)
  const decoded = fromCosmosConfig(decodeConfigIdk(encoded))
  expect(preprocessCuttleform(decoded, config)).toMatchObject(preprocessCuttleform(config))
})

// HELPER FUNCTIONS  HELPER FUNCTIONS  HELPER FUNCTIONS  HELPER FUNCTIONS  HELPER FUNCTIONS  HELPER
// FUNCTIONS  HELPER FUNCTIONS  HELPER FUNCTIONS  HELPER FUNCTIONS  HELPER FUNCTIONS HELPER FUNCTIONS
// HELPER FUNCTIONS  HELPER FUNCTIONS  HELPER FUNCTIONS  HELPER FUNCTIONS  HELPER FUNCTIONS  HELPER

/** Compare the position of keys in two keyboards. */
function comparePosition(c: Cuttleform, other: Cuttleform | undefined, i: number) {
  if (!other) return 'ok'
  if (!other.keys[i]) return 'missing'
  const wrA = c.wristRestOrigin?.evaluate({ flat: false }, new Trsf()).invert() || new Trsf()
  const wrB = other.wristRestOrigin?.evaluate({ flat: false }, new Trsf()).invert() || new Trsf()
  const pA = c.keys[i].position.evaluate({ flat: false }, new Trsf()).premultiply(wrA)
  const pB = other.keys[i].position.evaluate({ flat: false }, new Trsf()).premultiply(wrB)
  const distance = pA.origin().distanceTo(pB.origin())
  const angle = new Quaternion().setFromRotationMatrix(pA.Matrix4()).angleTo(new Quaternion().setFromRotationMatrix(pB.Matrix4())) * 180 / Math.PI
  let error: string[] = []
  if (distance > 0.5) error.push(`distance error=${distance}`)
  if (angle > 1) error.push(`angle error=${angle}`)
  return error.length ? error.join(',') : 'ok'
}

function compareWRPosition(c: Cuttleform, other: Cuttleform | undefined) {
  if (!other) return 'ok'
  if (!other.wristRestOrigin) return 'missing'
  const wrA = c.wristRestOrigin?.evaluate({ flat: false }, new Trsf()).invert() || new Trsf()
  const wrB = other.wristRestOrigin?.evaluate({ flat: false }, new Trsf()).invert() || new Trsf()
  const pA = c.wristRestOrigin.evaluate({ flat: false }, new Trsf()).premultiply(wrA)
  const pB = other.wristRestOrigin.evaluate({ flat: false }, new Trsf()).premultiply(wrB)
  const distance = pA.origin().distanceTo(pB.origin())
  const angle = new Quaternion().setFromRotationMatrix(pA.Matrix4()).angleTo(new Quaternion().setFromRotationMatrix(pB.Matrix4())) * 180 / Math.PI
  let error: string[] = []
  if (distance > 0.5) error.push(`distance error=${distance}`)
  if (angle > 1) error.push(`angle error=${angle}`)
  return error.length ? error.join(',') : 'ok'
}

/** Ensure consistency when diffing. */
function preprocessCuttleform(c: Cuttleform, other?: Cuttleform) {
  return {
    ...c,
    keys: c.keys.map((k, i) => {
      const newKey = { ...k, position: comparePosition(c, other, i) }
      if ('keycap' in newKey && newKey.keycap) {
        newKey.keycap = { ...newKey.keycap }
        if (!newKey.keycap.letter) delete newKey.keycap.letter
        if (!newKey.keycap.home) delete newKey.keycap.home
      }
      // @ts-ignore
      if (!newKey.size) delete newKey.size
      return newKey
    }),
    wristRestOrigin: compareWRPosition(c, other),
  }
}
