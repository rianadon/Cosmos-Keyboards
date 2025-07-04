import defaultConfig from '$assets/cuttleform.json' assert { type: 'json' }
import { expect, test } from 'bun:test'
import { Quaternion } from 'three'
import { toCode } from '../../../src/routes/beta/lib/editor/toCode'
import { deserialize, toCuttleformProto } from '../../../src/routes/beta/lib/serialize'
import { cuttleConf, type Cuttleform, type FullCuttleform } from './config'
import { type ConnectorMaybeCustom, type CosmosCluster, type CosmosKey, type CosmosKeyboard, fromCosmosConfig, toCosmosConfig, toFullCosmosConfig } from './config.cosmos'
import { decodeConfigIdk, decodeConnectors, encodeConnectors, encodeCosmosConfig, serializeCosmosConfig } from './config.serialize'
import Trsf from './modeling/transformation'
import ETrsf, { flipKeyLabels, mirror } from './modeling/transformation-ext'
import { trimUndefined } from './util'

// Empty urls are not possible, since there must always be a right finger and right thumb cluster.
// test('Empty config has empty URL', () => {
//   const keeb = fromCosmosConfig(decodeConfigIdk('')).right!
//   const cosmos = toCosmosConfig(keeb, 'right')
//   const reencoded = serializeCosmosConfig(encodeCosmosConfig(cosmos))
//   expect(reencoded).toBe('')
// })

test('Decode the default configuration', () => {
  const encoded =
    'Cn8KDxIFEIA/ICcSABIAEgA4MQoPEgUQgEsgJxIAEgASADgdChwSBRCAVyAnEgASABIDELAvEgMQsF84CUCE8LwCChcSBRCAYyAnEgASABIDELA7EgMQsGs4CgoVEgUQgG8gJxIAEgASADgeQJCGirAHGABA6IWgrvBVSNzwoqABCpIBChcSExDAwAJAgICYAkjCmaCVkLwBUEM4CAoVEhAQQECAgCBI0JWA3ZD1A1ALUJ4CChYSEhBAQICAzAJIwpmglZC8AVCGAVA6ChQSEBBAQICA+AFI5pn8p5ALUFdQfwoVEhAQQECAgKQDSPCZzLXQMFB0UJUBGAIiCgjIARDIARgAIABAy4uEpNAxSK2R3I3BkwZyAA=='
  const config = cuttleConf(defaultConfig.options as any)
  const cosmos = decodeConfigIdk(encoded)
  cosmos.wristRestPosition = 0n
  const decoded = fromCosmosConfig(cosmos).right!
  expect(preprocessCuttleform(decoded, config)).toMatchObject(preprocessCuttleform(config))
})

test('Encode then decode the default configuration', () => {
  const config = cuttleConf(defaultConfig.options as any)
  const cosmos = toCosmosConfig(config, 'right', true)
  cosmos.wristRestPosition = 0n
  const encoded = serializeCosmosConfig(encodeCosmosConfig(cosmos))
  console.log(encoded)
  // The decoded cosmosconf should match
  expect(decodeConfigIdk(encoded)).toMatchObject(cosmos)
  // The full encode then decode should match the configuration
  const decoded2 = fromCosmosConfig(decodeConfigIdk(encoded)).right!
  expect(preprocessCuttleform(decoded2, config)).toMatchObject(preprocessCuttleform(config))
})

test('Encode then decode custom cf format models', () => {
  const models = [
    'ChYIBRAFWAAYBCAFKNIBMM0BUAJAAEgAWpUBChEIy4vMpdAxEI3FlK3is4rkARIRCKCDoIzACBDCmaCVkLyB5AESDwi8ieAwENCVgN2Q9YPkARIQCPSWiqgFEMKZoJWQvIHkARIPCP+DwI3ABxDmmfSnkItyEhEIq4Wcj7ANEPCZzLXQsIDkARIRCN6Sh5jfQBCOoZCdkpCC5AESEwiEhZSVsJeCARCim+CU8tCB5AE=',
    'ChYIBBAFWAAYBSAEKNcBMM0BUAJAAEgAWjkKEQjFjbSf4AEQl9HUvILTi+QBEhEIoIOgjMAIEMKZoJWQvIHkARIRCJ+FoI3ABxCsnbS8oL2A5AFCUwgD4AEBeAbYAQEQAUgASABIAEgASABIAEgAYABoAHABGAAgASgBmAHYBKgB8AagASewAcgBkAGEB7gBAIABADAAOChYCogBAcABAMgB2ATQAYQH',
    'ChYIBRAFWAAYASAFKM0BMM0BUAJAAEgAEhEIxgoYyhEg5Qg4jgIoWjC4CCoMCMEDEIMHGMgBIM0BUhQwJwgAEIDwTBiAzvABIAAoqO7BAkJTCAPgAQF4BtgBARABSABIAEgASABIAEgASABgAGgAcAEYACAAKACYAfQDqAHoB6AByAGwAQCQAYQHuAEAgAEAMAA4KFgBiAEBwAEAyAHYBNABhAc=',
    'ChYIBRAGWAAYBCAFKNcBMM0BUAJAAUgCIgIIAA==', // Orbyl
    'MgwIAxgAIAAoyAEwyAFyAggA', // Stilts mode
  ]
  for (const b64 of models) {
    const config = cuttleConf(toCuttleformProto(b64))
    const cosmos = toCosmosConfig(config, 'right', true)
    cosmos.wristRestPosition = 0n
    const encoded = serializeCosmosConfig(encodeCosmosConfig(cosmos))
    // The decoded cosmosconf should match
    expect(decodeConfigIdk(encoded)).toMatchObject(roundRows(cosmos))
    // The full encode then decode should match the configuration
    const decoded = fromCosmosConfig(decodeConfigIdk(encoded)).right!
    expect(preprocessCuttleform(decoded, config)).toMatchObject(preprocessCuttleform(config))
  }
})

test('Convert the default config to code then back', () => {
  const config = cuttleConf(defaultConfig.options as any)
  const cosmos = toCosmosConfig(config, 'right', true)
  const code = toCode(cosmos).replaceAll(': Key[]', '').replace(': Options', '')

  const confFn = Function('Trsf', 'mirror', 'flipKeyLabels', code.replace('export default', 'return'))
  const newConf = confFn(ETrsf, mirror, flipKeyLabels) as FullCuttleform

  // Check the cuttleform configs against each other
  newConf.right!.wristRestOrigin = new ETrsf()
  expect(preprocessCuttleform(newConf.right!, config)).toMatchObject(preprocessCuttleform(config))

  // Convert right back to cosmosconfs
  const secondCosmos = toFullCosmosConfig(newConf)
  expect(secondCosmos).toMatchObject(cosmos)
})

test('Convert unibody model to code then back', () => {
  const cosmos = decodeConfigIdk(
    'Cn8KDxIFEIA/ICcSABIAEgA4MQoPEgUQgEsgJxIAEgASADgdChwSBRCAVyAnEgASABIDELAvEgMQsF84CUCE8LwCChcSBRCAYyAnEgASABIDELA7EgMQsGs4CgoVEgUQgG8gJxIAEgASADgeQJCGirAHGABA9p2grvBVSNzwoqABCpIBChcSExDAwAJAgICYAkjCmaCVkLwBUEM4CAoVEhAQQECAgCBI0JWA3ZD1A1ALUJ4CChYSEhBAQICAzAJIwpmglZC8AVCGAVA6ChQSEBBAQICA+AFI5pn8p5ALUFdQfwoVEhAQQECAgKQDSPCZzLXQMFB0UJUBGAIiCgjIARDIARgAIABAwo2EpNAxSK2R3I3BkwZIDmgDeNSbvH4=',
  )
  const code = toCode(cosmos).replaceAll(': Key[]', '').replace(': Options', '')

  const confFn = Function('Trsf', 'mirror', 'flipKeyLabels', code.replace('export default', 'return'))
  const newConf = confFn(ETrsf, mirror, flipKeyLabels) as FullCuttleform

  // Convert right back to cosmosconfs
  const secondCosmos = toFullCosmosConfig(newConf)
  expect(encodeCosmosConfig(secondCosmos)).toMatchObject(encodeCosmosConfig(cosmos))
})

test('Ensure long letters are saved', () => {
  const cosmos = decodeConfigIdk(
    'CmIKDRIFEKBPIAkSADgTQAAKGBIFEKBbIAkSAxCwLxIDELBfOABAgPC8AgoVEgUQoGcgCRIDELA7EgMQsGs4FEAAChESBRCgcyAJEgA4KECAhorABxgAQJaD2J/wVUjc8KKgAQodGAIiCgjIARDIARgAIABAy4v8n9AxSK2R3I3BkwY=',
  )
  cosmos.clusters[0].clusters[0].keys[0].profile.letter = 'LOOOONG'
  const encoded = serializeCosmosConfig(encodeCosmosConfig(cosmos))
  const decoded = decodeConfigIdk(encoded)
  expect(decoded.clusters[0].clusters[0].keys[0].profile.letter).toEqual('LOOOONG')
})

test('Encoding connectors', () => {
  const connectors: ConnectorMaybeCustom[] = [
    { preset: 'trrs' },
    { preset: 'usb', size: 'slim' },
    { preset: 'usb', size: 'average' },
    { preset: 'usb', size: 'big' },
    { width: 10, height: 7, x: 0, y: 10, radius: 2 },
    { preset: 'trrs', x: 30 },
    { preset: 'usb', size: 'slim', x: 30 },
    { preset: 'usb', size: 'average', x: 30 },
    { preset: 'usb', size: 'big', x: 30 },
  ]
  expect(decodeConnectors(encodeConnectors(connectors))).toMatchObject(connectors)
})

test('Complex keys', () => {
  const config = cuttleConf(defaultConfig.options as any)
  const cosmosConf = toCosmosConfig(config, 'right', true)

  cosmosConf.clusters = [cosmosConf.clusters[0]]
  cosmosConf.clusters[0].clusters = [cosmosConf.clusters[0].clusters[0]]
  cosmosConf.clusters[0].clusters[0].keys = [
    { partType: { type: 'oled-160x68-1.08in-niceview' }, profile: {}, row: -2.02, column: -2.86 },
    { partType: {}, profile: { row: 0, letter: 'j', home: 'index' }, row: -1 },
    { partType: {}, profile: { row: 1, letter: '7', home: null }, row: 0 },
  ]

  const encoded = encodeCosmosConfig(cosmosConf)
  const decoded = decodeConfigIdk(serializeCosmosConfig(encoded))

  expect(decoded).toMatchObject(cosmosConf)
})

// HELPER FUNCTIONS  HELPER FUNCTIONS  HELPER FUNCTIONS  HELPER FUNCTIONS  HELPER FUNCTIONS  HELPER
// FUNCTIONS  HELPER FUNCTIONS  HELPER FUNCTIONS  HELPER FUNCTIONS  HELPER FUNCTIONS HELPER FUNCTIONS
// HELPER FUNCTIONS  HELPER FUNCTIONS  HELPER FUNCTIONS  HELPER FUNCTIONS  HELPER FUNCTIONS  HELPER

/** Rounds rows and columns and curvatures to 2 decimal places */
function roundRows(keyboard: CosmosKeyboard) {
  const roundKey = (k: CosmosKey) => {
    if (k.row) k.row = Math.round(k.row * 100) / 100
    if (k.column) k.column = Math.round(k.column * 100) / 100
  }
  const roundCluster = (c: CosmosCluster) => {
    if (c.curvature.verticalSpacing) c.curvature.verticalSpacing = Math.round(c.curvature.verticalSpacing * 10) / 10
    if (c.curvature.horizontalSpacing) c.curvature.horizontalSpacing = Math.round(c.curvature.horizontalSpacing * 10) / 10
    c.keys.forEach(roundKey)
    c.clusters.forEach(roundCluster)
  }
  keyboard.clusters.forEach(roundCluster)
  return keyboard
}

/** Compare the position of keys in two keyboards. */
function comparePosition(c: Cuttleform, other: Cuttleform | undefined, i: number, flat: boolean) {
  if (!other) return 'ok'
  if (!other.keys[i]) return 'missing'
  const wrA = c.wristRestOrigin?.evaluate({ flat: false }, new Trsf()).invert() || new Trsf()
  const wrB = other.wristRestOrigin?.evaluate({ flat: false }, new Trsf()).invert() || new Trsf()
  const pA = c.keys[i].position.evaluate({ flat }, new Trsf()).premultiply(wrA)
  const pB = other.keys[i].position.evaluate({ flat }, new Trsf()).premultiply(wrB)
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
      const newKey = { ...k, position: comparePosition(c, other, i, false) }
      if ('keycap' in newKey && newKey.keycap) {
        newKey.keycap = { ...newKey.keycap }
        if (!newKey.keycap.letter) delete newKey.keycap.letter
        if (!newKey.keycap.home) delete newKey.keycap.home
      }
      // @ts-ignore
      if (!newKey.size) delete newKey.size
      if (!newKey.variant) delete newKey.variant
      return newKey
    }),
    wristRestOrigin: compareWRPosition(c, other),
    rounded: trimUndefined(c.rounded),
  }
}
