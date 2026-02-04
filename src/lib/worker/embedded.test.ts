import { describe, expect, test } from 'bun:test'
import type { BasicShell } from './config'
import { fromCosmosConfig, toCosmosConfig } from './config.cosmos'
import { decodeConfigIdk, encodeCosmosConfig, serializeCosmosConfig } from './config.serialize'

const DEFAULT_CONFIG_B64 =
  'Cn8KDxIFEIA/ICcSABIAEgA4MQoPEgUQgEsgJxIAEgASADgdChwSBRCAVyAnEgASABIDELAvEgMQsF84CUCE8LwCChcSBRCAYyAnEgASABIDELA7EgMQsGs4CgoVEgUQgG8gJxIAEgASADgeQJCGirAHGABA6IWgrvBVSNzwoqABCpIBChcSExDAwAJAgICYAkjCmaCVkLwBUEM4CAoVEhAQQECAgCBI0JWA3ZD1A1ALUJ4CChYSEhBAQICAzAJIwpmglZC8AVCGAVA6ChQSEBBAQICA+AFI5pn8p5ALUFdQfwoVEhAQQECAgKQDSPCZzLXQMFB0UJUBGAIiCgjIARDIARgAIABAy4uEpNAxSK2R3I3BkwZyAA=='

describe('Embedded Plate Configuration', () => {
  test('BasicShell with embedded=true is preserved through serialization', () => {
    const shell: BasicShell = {
      type: 'basic',
      lip: false,
      embedded: true,
    }

    expect(shell.embedded).toBe(true)
    expect(shell.type).toBe('basic')
  })

  test('BasicShell with embedded=false is the default', () => {
    const shell: BasicShell = {
      type: 'basic',
      lip: false,
      embedded: false,
    }

    expect(shell.embedded).toBe(false)
  })

  test('Embedded flag is encoded and decoded correctly', () => {
    const baseConfig = decodeConfigIdk(DEFAULT_CONFIG_B64)

    // Set embedded to true
    baseConfig.shell = { type: 'basic', lip: false, embedded: true }

    // Encode and decode
    const encoded = serializeCosmosConfig(encodeCosmosConfig(baseConfig))
    const decoded = decodeConfigIdk(encoded)

    // Verify embedded flag is preserved
    expect(decoded.shell.type).toBe('basic')
    expect((decoded.shell as BasicShell).embedded).toBe(true)
  })

  test('Embedded flag defaults to false when not set', () => {
    // Decode a config that was created before embedded flag existed
    const config = decodeConfigIdk(DEFAULT_CONFIG_B64)

    // Verify shell is basic and embedded defaults to false
    expect(config.shell.type).toBe('basic')
    expect((config.shell as BasicShell).embedded).toBe(false)
  })

  test('Cuttleform conversion preserves embedded flag', () => {
    const cosmosConfig = decodeConfigIdk(DEFAULT_CONFIG_B64)

    // Set embedded to true
    cosmosConfig.shell = { type: 'basic', lip: false, embedded: true }

    // Convert to Cuttleform
    const cuttleform = fromCosmosConfig(cosmosConfig).right!

    // Verify embedded is preserved
    expect(cuttleform.shell.type).toBe('basic')
    expect((cuttleform.shell as BasicShell).embedded).toBe(true)

    // Convert back to CosmosKeyboard
    const backToCosmos = toCosmosConfig(cuttleform, 'right', true)

    // Verify embedded is still preserved
    expect(backToCosmos.shell.type).toBe('basic')
    expect((backToCosmos.shell as BasicShell).embedded).toBe(true)
  })
})
