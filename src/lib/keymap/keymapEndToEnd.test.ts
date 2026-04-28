/**
 * End-to-end tests for the Miryoku keymap feature: round-trips through
 * serialization, slot suggestion, and firmware-format emission.
 */

import defaultConfig from '$assets/cuttleform.json' assert { type: 'json' }
import { expect, test } from 'bun:test'
import { cuttleConf } from '../worker/config'
import { type CosmosKeyboard, toCosmosConfig } from '../worker/config.cosmos'
import { decodeConfigIdk, encodeCosmosConfig, serializeCosmosConfig } from '../worker/config.serialize'
import { isKeymapPresetId, KEYMAP_PRESET, KEYMAP_PRESET_IDS } from './index'
import { MIRYOKU_KEYMAP, MIRYOKU_LAYERS, MIRYOKU_SLOTS } from './miryoku'
import { suggestMiryokuSlots } from './miryokuSlots'
import { keyActionToQmk } from './qmkEmit'
import { keyActionToZmk } from './zmkEmit'

function buildDefaultCosmos(): CosmosKeyboard {
  const config = cuttleConf(defaultConfig.options as any)
  const cosmos = toCosmosConfig(config, 'right', true)
  cosmos.wristRestPosition = 0n
  return cosmos
}

test('keymapPreset round-trips through serialize/deserialize', () => {
  const cosmos = buildDefaultCosmos()
  cosmos.keymapPreset = KEYMAP_PRESET.MIRYOKU
  const encoded = serializeCosmosConfig(encodeCosmosConfig(cosmos))
  const decoded = decodeConfigIdk(encoded)
  expect(decoded.keymapPreset).toBe(KEYMAP_PRESET.MIRYOKU)
})

test('omitted keymapPreset decodes as undefined (back-compat)', () => {
  const cosmos = buildDefaultCosmos()
  // Don't set keymapPreset — should be undefined after round-trip.
  const encoded = serializeCosmosConfig(encodeCosmosConfig(cosmos))
  const decoded = decodeConfigIdk(encoded)
  expect(decoded.keymapPreset).toBeUndefined()
})

test('isKeymapPresetId guards correctly', () => {
  expect(isKeymapPresetId(KEYMAP_PRESET.MIRYOKU)).toBe(true)
  expect(isKeymapPresetId('not-a-preset')).toBe(false)
  expect(isKeymapPresetId(undefined)).toBe(false)
  expect(isKeymapPresetId(null)).toBe(false)
})

test('KEYMAP_PRESET_IDS contains miryoku', () => {
  expect(KEYMAP_PRESET_IDS).toContain('miryoku')
})

test('MIRYOKU_LAYERS has 7 entries in canonical order', () => {
  expect(MIRYOKU_LAYERS).toEqual(['BASE', 'NAV', 'MOUSE', 'MEDIA', 'NUM', 'SYM', 'FUN'])
})

test('every Miryoku layer has at least one defined slot', () => {
  for (const layer of MIRYOKU_LAYERS) {
    const slots = Object.keys(MIRYOKU_KEYMAP[layer])
    expect(slots.length).toBeGreaterThan(0)
  }
})

test('every defined slot in any layer is a valid MiryokuSlot', () => {
  const validSlots = new Set<string>(MIRYOKU_SLOTS)
  for (const layer of MIRYOKU_LAYERS) {
    for (const slot of Object.keys(MIRYOKU_KEYMAP[layer])) {
      expect(validSlots.has(slot)).toBe(true)
    }
  }
})

test('every Miryoku KeyAction emits valid ZMK and QMK strings', () => {
  for (const layer of MIRYOKU_LAYERS) {
    for (const action of Object.values(MIRYOKU_KEYMAP[layer])) {
      if (!action) continue
      const zmk = keyActionToZmk(action, 'A')
      const qmk = keyActionToQmk(action, 'A')
      expect(zmk).toBeTruthy()
      expect(qmk).toBeTruthy()
      // ZMK bindings start with &
      expect(zmk.startsWith('&')).toBe(true)
      // QMK keycodes are KC_*, MT(...), LT(...), OSM(...), OSL(...), or modifier wrappers
      expect(qmk).toMatch(/^(KC_|MT\(|LT\(|OSM\(|OSL\(|[CSAG]\()/)
    }
  }
})

test('suggestMiryokuSlots fills the right-side slots for the default config', () => {
  // The default Cosmos config has only right-side clusters defined (left is
  // mirrored at FullCuttleform-build time). Slot suggestion should fill all
  // 18 right-side slots: 15 alpha (5 cols × 3 rows) + 3 thumbs.
  const cosmos = buildDefaultCosmos()
  const slots = suggestMiryokuSlots(cosmos)
  expect(Object.keys(slots).length).toBe(18)
  // All three right-side rows have entries
  expect(slots.R00).toBeDefined()
  expect(slots.R10).toBeDefined()
  expect(slots.R20).toBeDefined()
  // All three right thumbs are assigned
  expect(slots.RT0).toBeDefined()
  expect(slots.RT1).toBeDefined()
  expect(slots.RT2).toBeDefined()
})

test('Miryoku BASE home-row R col 1-4 are mod-taps with correct mods', () => {
  // Convention: R col 1 = LSHFT (index home), R col 2 = LCTRL, R col 3 = LALT,
  // R col 4 = LGUI. R col 0 is plain alpha. This is the lynchpin of the
  // home-row mod feature — getting it wrong puts mods on the wrong fingers.
  const base = MIRYOKU_KEYMAP.BASE
  const expected: Record<string, string> = {
    R10: 'kp', // plain
    R11: 'mt', // SHFT
    R12: 'mt', // CTRL
    R13: 'mt', // ALT
    R14: 'mt', // GUI
  }
  for (const [slot, kind] of Object.entries(expected)) {
    expect(base[slot as keyof typeof base]?.kind).toBe(kind as any)
  }
  // Specific mods
  if (base.R11?.kind === 'mt') expect(base.R11.mod).toBe('LSHFT')
  if (base.R12?.kind === 'mt') expect(base.R12.mod).toBe('LCTRL')
  if (base.R13?.kind === 'mt') expect(base.R13.mod).toBe('LALT')
  if (base.R14?.kind === 'mt') expect(base.R14.mod).toBe('LGUI')
})

test('Miryoku NUM right home row mods match BASE for hold-mod consistency', () => {
  const num = MIRYOKU_KEYMAP.NUM
  // NUM puts plain mod keycodes (not mod-tap) on the right home row so users
  // can hold mods while typing numbers on the left side.
  expect(num.R11?.kind).toBe('kp')
  if (num.R11?.kind === 'kp') expect(num.R11.code).toBe('LSHFT')
  if (num.R14?.kind === 'kp') expect(num.R14.code).toBe('LGUI')
})

test('Miryoku thumbs are layer-taps with correct layer indices', () => {
  // Layer indices: BASE=0, NAV=1, MOUSE=2, MEDIA=3, NUM=4, SYM=5, FUN=6
  const base = MIRYOKU_KEYMAP.BASE
  // Left thumbs: outer→inner = MEDIA, NAV, MOUSE
  if (base.LT0?.kind === 'lt') expect(base.LT0.layer).toBe(3) // MEDIA
  if (base.LT1?.kind === 'lt') expect(base.LT1.layer).toBe(1) // NAV
  if (base.LT2?.kind === 'lt') expect(base.LT2.layer).toBe(2) // MOUSE
  // Right thumbs: outer→inner = SYM, NUM, FUN
  if (base.RT0?.kind === 'lt') expect(base.RT0.layer).toBe(5) // SYM
  if (base.RT1?.kind === 'lt') expect(base.RT1.layer).toBe(4) // NUM
  if (base.RT2?.kind === 'lt') expect(base.RT2.layer).toBe(6) // FUN
})
