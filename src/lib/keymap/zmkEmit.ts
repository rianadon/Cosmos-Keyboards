/**
 * Converts KeyAction values to ZMK binding strings.
 *
 * Codes in the KeyAction union use ZMK mnemonics directly. Special codes
 * that don't map to &kp are handled here (e.g. BOOT → &bootloader).
 */

import type { KeyAction } from './index'

const SPECIAL_KP: Record<string, string> = {
  BOOT: '&bootloader',
  CAPS: '&caps_word',
}

/** Punctuation chars (typically a resolved __ALPHA__ where the keycap legend
 *  is `;`, `[`, `/`, etc.). Maps the literal char → ZMK keycode mnemonic.
 *  Mirrors the CHARS table in zmk.ts so the keycodes match what the regular
 *  generator emits. */
const ALPHA_PUNCT_TO_ZMK: Record<string, string> = {
  '!': 'EXCL',
  '@': 'AT',
  '#': 'HASH',
  '$': 'DLLR',
  '%': 'PRCNT',
  '^': 'CARET',
  '&': 'AMPS',
  '*': 'ASTRK',
  '(': 'LPAR',
  ')': 'RPAR',
  '-': 'MINUS',
  '_': 'UNDER',
  '=': 'EQUAL',
  '+': 'PLUS',
  '[': 'LBKT',
  '{': 'LBRC',
  ']': 'RBKT',
  '}': 'RBRC',
  '\\': 'BSLH',
  '|': 'PIPE',
  ';': 'SEMI',
  ':': 'COLON',
  "'": 'SQT',
  '"': 'DQT',
  ',': 'COMMA',
  '<': 'LT',
  '.': 'DOT',
  '>': 'GT',
  '/': 'FSLH',
  '?': 'QMARK',
  '`': 'GRAVE',
  '~': 'TILDE',
  ' ': 'SPACE',
}

/** Resolve a code (or __ALPHA__ placeholder) to a ZMK keycode mnemonic. */
function resolveCode(code: string, alpha?: string): string {
  const resolved = code === '__ALPHA__' ? (alpha ?? 'A') : code
  if (resolved.length === 1 && ALPHA_PUNCT_TO_ZMK[resolved]) {
    return ALPHA_PUNCT_TO_ZMK[resolved]
  }
  return resolved
}

function kpCode(code: string, alpha?: string): string {
  const resolved = code === '__ALPHA__' ? (alpha ?? 'A') : code
  if (SPECIAL_KP[resolved]) return SPECIAL_KP[resolved]
  return `&kp ${resolveCode(code, alpha)}`
}

/** Convert a single KeyAction to a ZMK binding string.
 * @param alpha - resolved letter for any __ALPHA__ placeholder in this action
 */
export function keyActionToZmk(action: KeyAction, alpha?: string): string {
  switch (action.kind) {
    case 'kp':
      return kpCode(action.code, alpha)
    case 'mt': {
      const tap = resolveCode(action.tap, alpha)
      return `&mt ${action.mod} ${tap}`
    }
    case 'lt':
      return `&lt ${action.layer} ${action.tap}`
    case 'osm':
      return `&sk ${action.mod}`
    case 'osl':
      return `&sl ${action.layer}`
    case 'trans':
      return '&trans'
    case 'none':
      return '&none'
  }
}
