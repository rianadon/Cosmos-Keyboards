/**
 * Converts KeyAction values to QMK keycode strings.
 *
 * Codes in the KeyAction union use ZMK mnemonics; this module translates them
 * to QMK equivalents (KC_*, MT(), LT(), OSM(), OSL(), KC_TRNS, KC_NO).
 */

import type { KeyAction } from './index'

const ZMK_TO_QMK_CODE: Record<string, string> = {
  // Navigation
  RET: 'ENT',
  SPACE: 'SPC',
  BSPC: 'BSPC',
  DEL: 'DEL',
  TAB: 'TAB',
  ESC: 'ESC',
  INS: 'INS',
  HOME: 'HOME',
  END: 'END',
  PG_UP: 'PGUP',
  PG_DN: 'PGDN',
  UP: 'UP',
  DOWN: 'DOWN',
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
  // Punctuation / symbols
  LBKT: 'LBRC',
  RBKT: 'RBRC',
  SEMI: 'SCLN',
  EQUAL: 'EQL',
  GRAVE: 'GRV',
  BSLH: 'BSLS',
  MINUS: 'MINS',
  UNDER: 'UNDS',
  LBRC: 'LCBR',
  RBRC: 'RCBR',
  LPAR: 'LPRN',
  RPAR: 'RPRN',
  TILDE: 'TILD',
  COLON: 'COLN',
  AMPS: 'AMPR',
  STAR: 'ASTR',
  PRCNT: 'PERC',
  CARET: 'CIRC',
  DLLR: 'DLR',
  EXCL: 'EXLM',
  HASH: 'HASH',
  PIPE: 'PIPE',
  AT: 'AT',
  PLUS: 'PLUS',
  // Modifiers as keycodes
  LSHFT: 'LSFT',
  LCTRL: 'LCTL',
  LALT: 'LALT',
  LGUI: 'LGUI',
  RSHFT: 'RSFT',
  RCTRL: 'RCTL',
  RALT: 'RALT',
  RGUI: 'RGUI',
  // Numbers (ZMK prefixes with N)
  N0: '0',
  N1: '1',
  N2: '2',
  N3: '3',
  N4: '4',
  N5: '5',
  N6: '6',
  N7: '7',
  N8: '8',
  N9: '9',
  // Function keys are the same (F1..F12)
  // System / media
  BOOT: 'QK_BOOT',
  CAPS: 'QK_CAPS_WORD_TOGGLE',
  PSCRN: 'PSCR',
  SLCK: 'SCRL',
  PAUSE: 'PAUS',
  K_APP: 'APP',
  C_VOL_UP: 'VOLU',
  C_VOL_DN: 'VOLD',
  C_NEXT: 'MNXT',
  C_PREV: 'MPRV',
  C_PP: 'MPLY',
  C_STOP: 'MSTP',
  C_MUTE: 'MUTE',
}

/** Punctuation chars that may appear as a resolved alpha placeholder (e.g. when
 *  the keycap legend is `;`, `[`, `/`). Maps the literal char → QMK keycode
 *  suffix (KC_ prefix added by the caller). Mirrors the CHARS table in qmk.ts
 *  so the keycodes match what the regular generator emits. */
const ALPHA_PUNCT_TO_QMK: Record<string, string> = {
  '-': 'MINS',
  '_': 'UNDS',
  '=': 'EQL',
  '+': 'PLUS',
  '[': 'LBRC',
  '{': 'LCBR',
  ']': 'RBRC',
  '}': 'RCBR',
  '\\': 'BSLS',
  '|': 'PIPE',
  '#': 'HASH',
  '~': 'TILD',
  ';': 'SCLN',
  ':': 'COLN',
  "'": 'QUOT',
  '"': 'DQUO',
  '`': 'GRV',
  ',': 'COMM',
  '<': 'LABK',
  '.': 'DOT',
  '>': 'RABK',
  '/': 'SLSH',
  '?': 'QUES',
  '!': 'EXLM',
  '@': 'AT',
  '$': 'DLR',
  '%': 'PERC',
  '^': 'CIRC',
  '&': 'AMPR',
  '*': 'ASTR',
  '(': 'LPRN',
  ')': 'RPRN',
  ' ': 'SPC',
}

const ZMK_MOD_TO_QMK: Record<string, string> = {
  LSHFT: 'MOD_LSFT',
  LCTRL: 'MOD_LCTL',
  LALT: 'MOD_LALT',
  LGUI: 'MOD_LGUI',
  RSHFT: 'MOD_RSFT',
  RCTRL: 'MOD_RCTL',
  RALT: 'MOD_RALT',
  RGUI: 'MOD_RGUI',
}

function translateCode(zmkCode: string, alpha?: string): string {
  const code = zmkCode === '__ALPHA__' ? (alpha ?? 'A') : zmkCode
  if (ZMK_TO_QMK_CODE[code]) return 'KC_' + ZMK_TO_QMK_CODE[code]
  // Single letter
  if (/^[A-Z]$/.test(code)) return 'KC_' + code
  // Single digit
  if (/^[0-9]$/.test(code)) return 'KC_' + code
  // Function key (F1..F24)
  if (/^F[0-9]+$/.test(code)) return 'KC_' + code
  // Punctuation char (typically from a resolved __ALPHA__ placeholder where the
  // keycap legend is `;`, `[`, `/`, etc.). Lookup uses the lowercase form so
  // both `;` and `:` work after callers may have uppercased the alpha.
  if (code.length === 1 && ALPHA_PUNCT_TO_QMK[code]) {
    return 'KC_' + ALPHA_PUNCT_TO_QMK[code]
  }
  // ZMK key combos like LC(X) → C(KC_X)
  const combo = code.match(/^L([CSAG])\((\w+)\)$/)
  if (combo) {
    const [, mod, inner] = combo
    const qmkMod = { C: 'C', S: 'S', A: 'A', G: 'G' }[mod]!
    return `${qmkMod}(${translateCode(inner, alpha)})`
  }
  // Fallback: pass through as KC_
  return 'KC_' + code
}

function translateMod(zmkMod: string): string {
  return ZMK_MOD_TO_QMK[zmkMod] ?? ('MOD_' + zmkMod)
}

/** Convert a single KeyAction to a QMK keycode string.
 * @param alpha - resolved letter for any __ALPHA__ placeholder in this action
 */
export function keyActionToQmk(action: KeyAction, alpha?: string): string {
  switch (action.kind) {
    case 'kp':
      return translateCode(action.code, alpha)
    case 'mt': {
      const tap = translateCode(action.tap === '__ALPHA__' ? (alpha ?? 'A') : action.tap, alpha)
      return `MT(${translateMod(action.mod)}, ${tap})`
    }
    case 'lt':
      return `LT(${action.layer}, ${translateCode(action.tap, alpha)})`
    case 'osm':
      return `OSM(${translateMod(action.mod)})`
    case 'osl':
      return `OSL(${action.layer})`
    case 'trans':
      return 'KC_TRNS'
    case 'none':
      return 'KC_NO'
  }
}
