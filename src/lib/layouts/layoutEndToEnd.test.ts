/**
 * End-to-end tests for the layout feature: round-trips through serialization,
 * applyLayoutToKeys against a CosmosKeyboard, and ZMK/QMK keycode generation.
 */

import defaultConfig from '$assets/cuttleform.json' assert { type: 'json' }
import { expect, test } from 'bun:test'
import { applyLayoutToKeys } from '../../routes/beta/lib/editor/visualEditorHelpers'
import { keycode as qmkKeycode } from '../../routes/beta/lib/firmware/qmk'
import { keycode as zmkKeycode } from '../../routes/beta/lib/firmware/zmk'
import { cuttleConf } from '../worker/config'
import { type CosmosKeyboard, toCosmosConfig } from '../worker/config.cosmos'
import { decodeConfigIdk, encodeCosmosConfig, serializeCosmosConfig } from '../worker/config.serialize'
import { LAYOUT, LAYOUT_IDS, type LayoutId } from './index'

function buildDefaultCosmos(): CosmosKeyboard {
  const config = cuttleConf(defaultConfig.options as any)
  const cosmos = toCosmosConfig(config, 'right', true)
  cosmos.wristRestPosition = 0n
  return cosmos
}

test('layout round-trips through serialize/deserialize for every layout', () => {
  for (const layoutId of LAYOUT_IDS) {
    const cosmos = buildDefaultCosmos()
    cosmos.layout = layoutId
    const encoded = serializeCosmosConfig(encodeCosmosConfig(cosmos))
    const decoded = decodeConfigIdk(encoded)
    expect(decoded.layout).toBe(layoutId)
  }
})

test('omitted layout decodes as QWERTY (back-compat)', () => {
  // An older URL encoded before this feature has no layout field. Decoding it
  // should produce a QWERTY config so existing shared keyboards still work.
  const legacyEncoded =
    'Cn8KDxIFEIA/ICcSABIAEgA4MQoPEgUQgEsgJxIAEgASADgdChwSBRCAVyAnEgASABIDELAvEgMQsF84CUCE8LwCChcSBRCAYyAnEgASABIDELA7EgMQsGs4CgoVEgUQgG8gJxIAEgASADgeQJCGirAHGABA6IWgrvBVSNzwoqABCpIBChcSExDAwAJAgICYAkjCmaCVkLwBUEM4CAoVEhAQQECAgCBI0JWA3ZD1A1ALUJ4CChYSEhBAQICAzAJIwpmglZC8AVCGAVA6ChQSEBBAQICA+AFI5pn8p5ALUFdQfwoVEhAQQECAgKQDSPCZzLXQMFB0UJUBGAIiCgjIARDIARgAIABAy4uEpNAxSK2R3I3BkwZyAA=='
  const decoded = decodeConfigIdk(legacyEncoded)
  expect(decoded.layout).toBe(LAYOUT.QWERTY)
})

test('applyLayoutToKeys updates alpha-row letters per layout', () => {
  // The default Cosmos config has finger clusters with QWERTY letters baked
  // into key.profile.letter from cosmosFingers(). Applying Colemak should
  // rewrite the alpha-block letters and leave non-alpha rows alone.
  const baseline = buildDefaultCosmos()

  function letterAt(kbd: CosmosKeyboard, side: 'left' | 'right', row: number, alphaIdx: number) {
    const cluster = kbd.clusters.find(c => c.name === 'fingers' && c.side === side)
    if (!cluster) return undefined
    // Find the alphaIdx-th column in physical-position order that has letters,
    // then the key in that column with profile.row === row.
    const cols = cluster.clusters
      .map((col, idx) => ({ idx, column: col.column ?? -1000, hasLetters: col.keys.some(k => !!k.profile.letter) }))
      .filter(c => c.hasLetters)
      .sort((a, b) => a.column - b.column)
    const col = cluster.clusters[cols[alphaIdx]?.idx]
    if (!col) return undefined
    return col.keys.find(k => k.profile.row === row)?.profile.letter
  }

  // Sanity: baseline is QWERTY.
  expect(letterAt(baseline, 'right', 3, 0)).toBe('h') // home row, leftmost alpha (closest to center)
  expect(letterAt(baseline, 'right', 3, 1)).toBe('j')

  const colemakDH = applyLayoutToKeys(buildDefaultCosmos(), LAYOUT.COLEMAK_DH)
  expect(letterAt(colemakDH, 'right', 3, 0)).toBe('m')
  expect(letterAt(colemakDH, 'right', 3, 1)).toBe('n')

  const dvorak = applyLayoutToKeys(buildDefaultCosmos(), LAYOUT.DVORAK)
  expect(letterAt(dvorak, 'right', 3, 0)).toBe('d')
  expect(letterAt(dvorak, 'right', 3, 2)).toBe('t')
})

test('applyLayoutToKeys leaves number row untouched', () => {
  // Numbers and F-keys are layout-independent — applying any layout should
  // not change them. The default config has number keys with letters '6'..'0'.
  const before = buildDefaultCosmos()
  const numberKeysBefore = collectLetters(before, 1) // row 1 = number row
  expect(numberKeysBefore.length).toBeGreaterThan(0)

  const after = applyLayoutToKeys(before, LAYOUT.COLEMAK)
  const numberKeysAfter = collectLetters(after, 1)
  expect(numberKeysAfter).toEqual(numberKeysBefore)
})

function collectLetters(kbd: CosmosKeyboard, profileRow: number): string[] {
  const out: string[] = []
  for (const cluster of kbd.clusters) {
    if (cluster.name !== 'fingers') continue
    for (const col of cluster.clusters) {
      for (const key of col.keys) {
        if (key.profile.row === profileRow && key.profile.letter) out.push(key.profile.letter)
      }
    }
  }
  return out
}

const ZMK_LETTER_TO_KEYCODE: Record<string, string> = {
  a: '&kp A',
  h: '&kp H',
  n: '&kp N',
  m: '&kp M',
  t: '&kp T',
  e: '&kp E',
  i: '&kp I',
  d: '&kp D',
  s: '&kp S',
  r: '&kp R',
}
const QMK_LETTER_TO_KEYCODE: Record<string, string> = {
  a: 'KC_A',
  h: 'KC_H',
  n: 'KC_N',
  m: 'KC_M',
  t: 'KC_T',
  e: 'KC_E',
  i: 'KC_I',
  d: 'KC_D',
  s: 'KC_S',
  r: 'KC_R',
}

test('ZMK keycode emits letter-specific code for each alpha letter', () => {
  for (const [letter, code] of Object.entries(ZMK_LETTER_TO_KEYCODE)) {
    expect(zmkKeycode(letter)).toBe(code)
  }
})

test('QMK keycode emits letter-specific code for each alpha letter', () => {
  for (const [letter, code] of Object.entries(QMK_LETTER_TO_KEYCODE)) {
    expect(qmkKeycode(letter)).toBe(code)
  }
})

test('ZMK home-row keycodes change between QWERTY and Colemak DH', () => {
  // The same physical position (home row, index-finger column) emits different
  // keycodes depending on the layout. This is the end-to-end contract: change
  // the layout, the firmware sends a different key.
  const expectations: Array<{ layout: LayoutId; rightHomeFirstAlpha: string }> = [
    { layout: LAYOUT.QWERTY, rightHomeFirstAlpha: 'h' },
    { layout: LAYOUT.COLEMAK, rightHomeFirstAlpha: 'h' }, // Colemak keeps H here
    { layout: LAYOUT.COLEMAK_DH, rightHomeFirstAlpha: 'm' },
    { layout: LAYOUT.DVORAK, rightHomeFirstAlpha: 'd' },
    { layout: LAYOUT.WORKMAN, rightHomeFirstAlpha: 'y' },
  ]
  for (const { layout, rightHomeFirstAlpha } of expectations) {
    const kbd = applyLayoutToKeys(buildDefaultCosmos(), layout)
    const cluster = kbd.clusters.find(c => c.name === 'fingers' && c.side === 'right')!
    const homeKeys = cluster.clusters.flatMap(c => c.keys.filter(k => k.profile.row === 3 && k.profile.letter))
    const sortedByCol = homeKeys
      .map(k => ({ letter: k.profile.letter!, col: cluster.clusters.find(c => c.keys.includes(k))?.column ?? 0 }))
      .sort((a, b) => a.col - b.col)
    expect(sortedByCol[0].letter).toBe(rightHomeFirstAlpha)
    expect(zmkKeycode(sortedByCol[0].letter)).toBe(`&kp ${rightHomeFirstAlpha.toUpperCase()}`)
    expect(qmkKeycode(sortedByCol[0].letter)).toBe(`KC_${rightHomeFirstAlpha.toUpperCase()}`)
  }
})
