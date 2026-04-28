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

function kpCode(code: string, alpha?: string): string {
  const resolved = code === '__ALPHA__' ? (alpha ?? 'A') : code
  if (SPECIAL_KP[resolved]) return SPECIAL_KP[resolved]
  return `&kp ${resolved}`
}

/** Convert a single KeyAction to a ZMK binding string.
 * @param alpha - resolved letter for any __ALPHA__ placeholder in this action
 */
export function keyActionToZmk(action: KeyAction, alpha?: string): string {
  switch (action.kind) {
    case 'kp':
      return kpCode(action.code, alpha)
    case 'mt': {
      const tap = action.tap === '__ALPHA__' ? (alpha ?? 'A') : action.tap
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
