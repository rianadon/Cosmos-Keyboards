/**
 * Keymap data model.
 *
 * A `Layer` maps a physical key (identified by its `indexOfKey()` result) to a
 * `KeyAction`. Keys without an entry fall back to layer 0; layer 0 keys
 * without an entry fall back to the visual `keycap.letter`. This means a
 * Phase 1 keyboard (no layers) keeps working unchanged.
 *
 * The action union covers what ZMK and QMK both support out of the box:
 * tap (kp), mod-tap (mt), layer-tap (lt), one-shot mod (osm), one-shot layer
 * (osl), transparent (trans, falls through to lower layer), and none (no-op).
 *
 * Tap-dance, combos, macros, and timing config are deferred to a later phase.
 */

export type KeyAction =
  | { kind: 'kp'; code: string }
  | { kind: 'mt'; mod: string; tap: string }
  | { kind: 'lt'; layer: number; tap: string }
  | { kind: 'osm'; mod: string }
  | { kind: 'osl'; layer: number }
  | { kind: 'trans' }
  | { kind: 'none' }

export interface Layer {
  /** Layer name as it should appear in firmware output (zmk: layer label; qmk: enum). */
  name: string
  /** Per-key overrides keyed by `indexOfKey()`. Missing keys inherit (layer 0 = letter, others = trans). */
  actions: Record<number, KeyAction>
}

/**
 * Identifies a built-in keymap preset. Phase 2 ships only `'miryoku'`. Phase 3
 * will likely add more (e.g., `'sturdy'`, `'seniply'`) and a `'custom'` mode
 * that backs onto a user-edited `layers` array.
 */
export const KEYMAP_PRESET = {
  MIRYOKU: 'miryoku',
} as const

export type KeymapPresetId = (typeof KEYMAP_PRESET)[keyof typeof KEYMAP_PRESET]

export const KEYMAP_PRESET_IDS: readonly KeymapPresetId[] = [KEYMAP_PRESET.MIRYOKU]

export function isKeymapPresetId(value: unknown): value is KeymapPresetId {
  return typeof value === 'string' && (KEYMAP_PRESET_IDS as readonly string[]).includes(value)
}

export type { MiryokuLayer, MiryokuSlot } from './miryoku'
