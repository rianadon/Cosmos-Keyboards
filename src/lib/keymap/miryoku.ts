/**
 * Miryoku keymap spec — 7 layers across 36 slots.
 *
 * Adapted from manna-harbour/miryoku_zmk default keymap. The BUTTON layer
 * (mouse buttons via simultaneous-thumb combos) is omitted — combos are
 * deferred to a later phase since they need separate firmware-side config.
 *
 * Slot naming is position-based and side-prefixed:
 *   `L<row><col>` / `R<row><col>` for finger keys (row in 0..2, col in 0..4)
 *   `LT<n>` / `RT<n>` for thumb keys (n in 0..2, ordered outer→inner)
 *
 * Cosmos rows differ: profile.row = 2/3/4 for top/home/bottom alpha. Slot
 * row 0 = top alpha (Cosmos profile.row 2), 1 = home (3), 2 = bottom (4).
 *
 * `cols` for a Miryoku slot follow the same physical-position ordering as
 * Phase 1's alphaColumns: 0 is leftmost-physical for the left side, leftmost
 * (= closest to center) for the right side.
 */

import type { KeyAction } from './index'

// Layer indices. Order matters — used as &lt LAYER target by mod-tap thumbs.
export const MIRYOKU_LAYERS = ['BASE', 'NAV', 'MOUSE', 'MEDIA', 'NUM', 'SYM', 'FUN'] as const
export type MiryokuLayer = (typeof MIRYOKU_LAYERS)[number]

const LAYER_INDEX: Record<MiryokuLayer, number> = MIRYOKU_LAYERS.reduce((acc, name, i) => {
  acc[name] = i
  return acc
}, {} as Record<MiryokuLayer, number>)

// All 36 slot ids. 30 finger + 6 thumb.
export type MiryokuSlot =
  | `L${0 | 1 | 2}${0 | 1 | 2 | 3 | 4}`
  | `R${0 | 1 | 2}${0 | 1 | 2 | 3 | 4}`
  | `LT${0 | 1 | 2}`
  | `RT${0 | 1 | 2}`

function fingers(side: 'L' | 'R'): MiryokuSlot[] {
  const out: MiryokuSlot[] = []
  for (const row of [0, 1, 2] as const) {
    for (const col of [0, 1, 2, 3, 4] as const) {
      out.push(`${side}${row}${col}` as MiryokuSlot)
    }
  }
  return out
}

export const MIRYOKU_SLOTS: readonly MiryokuSlot[] = [
  ...fingers('L'),
  'LT0',
  'LT1',
  'LT2',
  ...fingers('R'),
  'RT0',
  'RT1',
  'RT2',
]

// Helper: ZMK uses `&kp X`, but our KeyAction.code holds bare codes that
// get prefixed by the firmware emitter. Same code values work for QMK after
// translation. We use ZMK-style mnemonics here.
const kp = (code: string): KeyAction => ({ kind: 'kp', code })
const mt = (mod: string, tap: string): KeyAction => ({ kind: 'mt', mod, tap })
const lt = (layer: MiryokuLayer, tap: string): KeyAction => ({ kind: 'lt', layer: LAYER_INDEX[layer], tap })
const trans: KeyAction = { kind: 'trans' }

// "U_NP" in manna-harbour: "not present" — emits &none / KC_NO.
const np: KeyAction = { kind: 'none' }

/**
 * BASE layer: alpha + home-row mods + thumb layer-taps.
 *
 * The alpha letters in BASE are layout-driven: when generating the layer for a
 * specific keyboard, callers replace the placeholder `kp ALPHA` with the
 * letter from the active alpha layout (Phase 1 letters at that slot's row/col).
 * Mods come from the home row positions on each side.
 *
 * Convention: `kp '__ALPHA__'` is the placeholder. When materializing the layer
 * the generator looks up the alpha letter for that slot.
 */
const ALPHA: KeyAction = kp('__ALPHA__')

/**
 * Home-row mod placement (manna-harbour / mod-DH).
 *
 * Cosmos's right-side col 0 is the column closest to the center = index inner
 * reach. Right col 4 = pinky outer. Left mirrors: col 0 = pinky outer, col 4 =
 * index inner reach. Mods sit on the four "outer" columns from each side's
 * pinky inward, with strongest mod (SHIFT) closest to home and weakest (GUI)
 * on the pinky.
 *
 *   Right cols: 0=plain, 1=SHIFT (index home), 2=CTRL, 3=ALT, 4=GUI (pinky)
 *   Left cols:  0=GUI (pinky), 1=ALT, 2=CTRL, 3=SHIFT (index home), 4=plain
 */
function homeMod(side: 'L' | 'R', col: number): KeyAction {
  if (side === 'R') {
    if (col === 0) return ALPHA
    const rightMods = [undefined, 'LSHFT', 'LCTRL', 'LALT', 'LGUI']
    return mt(rightMods[col]!, '__ALPHA__')
  } else {
    if (col === 4) return ALPHA
    const leftMods = ['LGUI', 'LALT', 'LCTRL', 'LSHFT', undefined]
    return mt(leftMods[col]!, '__ALPHA__')
  }
}

const BASE: Partial<Record<MiryokuSlot, KeyAction>> = {}
// Top + bottom alpha rows: plain alpha
for (const side of ['L', 'R'] as const) {
  for (const col of [0, 1, 2, 3, 4] as const) {
    BASE[`${side}0${col}` as MiryokuSlot] = ALPHA
    BASE[`${side}2${col}` as MiryokuSlot] = ALPHA
    BASE[`${side}1${col}` as MiryokuSlot] = homeMod(side, col)
  }
}
// Thumb cluster (outer → inner, indices 0..2)
BASE.LT0 = lt('MEDIA', 'ESC')
BASE.LT1 = lt('NAV', 'SPACE')
BASE.LT2 = lt('MOUSE', 'TAB')
BASE.RT0 = lt('SYM', 'RET')
BASE.RT1 = lt('NUM', 'BSPC')
BASE.RT2 = lt('FUN', 'DEL')

/**
 * Build a non-base layer from a 3-row × 10-col grid + thumbs.
 * Cells in `grid[row]` are 10 entries: left pinky..left index..right index..right pinky.
 */
function nonBaseLayer(
  grid: (KeyAction | undefined)[][],
  thumbs: { LT0?: KeyAction; LT1?: KeyAction; LT2?: KeyAction; RT0?: KeyAction; RT1?: KeyAction; RT2?: KeyAction },
): Partial<Record<MiryokuSlot, KeyAction>> {
  const out: Partial<Record<MiryokuSlot, KeyAction>> = {}
  for (let r = 0; r < 3; r++) {
    const cells = grid[r] || []
    for (let i = 0; i < 10; i++) {
      const cell = cells[i]
      if (!cell) continue
      if (i < 5) out[`L${r}${i}` as MiryokuSlot] = cell
      else out[`R${r}${(i - 5) as 0 | 1 | 2 | 3 | 4}` as MiryokuSlot] = cell
    }
  }
  Object.assign(out, thumbs)
  return out
}

// Per manna-harbour Miryoku default. Cells: physical L pinky → L index, then R index → R pinky.
// Codes are ZMK mnemonics; QMK translation happens at emit time.
const NAV = nonBaseLayer(
  [
    [kp('BOOT'), np, np, np, np, np, kp('PG_UP'), kp('HOME'), kp('UP'), kp('END')],
    [kp('LGUI'), kp('LALT'), kp('LCTRL'), kp('LSHFT'), np, kp('CAPS'), kp('PG_DN'), kp('LEFT'), kp('DOWN'), kp('RIGHT')],
    [np, kp('LC(LALT)'), kp('LA(LSHFT)'), kp('LCTRL'), np, np, kp('INS'), kp('DEL'), kp('TAB'), kp('CAPS')],
  ],
  { RT0: kp('RET'), RT1: kp('BSPC'), RT2: kp('DEL'), LT0: trans, LT1: trans, LT2: trans },
)

const MOUSE = nonBaseLayer(
  [
    [kp('BOOT'), np, np, np, np, np, np, np, np, np],
    [kp('LGUI'), kp('LALT'), kp('LCTRL'), kp('LSHFT'), np, np, np, np, np, np],
    [np, np, np, np, np, np, np, np, np, np],
  ],
  { LT0: trans, LT1: trans, LT2: trans, RT0: trans, RT1: trans, RT2: trans },
)

const MEDIA = nonBaseLayer(
  [
    [kp('BOOT'), np, np, np, np, np, np, np, np, np],
    [kp('LGUI'), kp('LALT'), kp('LCTRL'), kp('LSHFT'), np, np, kp('C_PREV'), kp('C_VOL_DN'), kp('C_VOL_UP'), kp('C_NEXT')],
    [np, np, np, np, np, np, np, np, np, np],
  ],
  { LT0: trans, LT1: trans, LT2: trans, RT0: kp('C_STOP'), RT1: kp('C_PP'), RT2: kp('C_MUTE') },
)

const NUM = nonBaseLayer(
  [
    [kp('LBKT'), kp('N7'), kp('N8'), kp('N9'), kp('RBKT'), np, np, np, np, kp('BOOT')],
    [kp('SEMI'), kp('N4'), kp('N5'), kp('N6'), kp('EQUAL'), np, kp('LSHFT'), kp('LCTRL'), kp('LALT'), kp('LGUI')],
    [kp('GRAVE'), kp('N1'), kp('N2'), kp('N3'), kp('BSLH'), np, np, np, np, np],
  ],
  { LT0: kp('DOT'), LT1: kp('N0'), LT2: kp('MINUS'), RT0: trans, RT1: trans, RT2: trans },
)

const SYM = nonBaseLayer(
  [
    [kp('LBRC'), kp('AMPS'), kp('STAR'), kp('LPAR'), kp('RBRC'), np, np, np, np, kp('BOOT')],
    [kp('COLON'), kp('DLLR'), kp('PRCNT'), kp('CARET'), kp('PLUS'), np, kp('LSHFT'), kp('LCTRL'), kp('LALT'), kp('LGUI')],
    [kp('TILDE'), kp('EXCL'), kp('AT'), kp('HASH'), kp('PIPE'), np, np, np, np, np],
  ],
  { LT0: kp('RPAR'), LT1: kp('UNDER'), LT2: kp('MINUS'), RT0: trans, RT1: trans, RT2: trans },
)

const FUN = nonBaseLayer(
  [
    [kp('F12'), kp('F7'), kp('F8'), kp('F9'), kp('PSCRN'), np, np, np, np, kp('BOOT')],
    [kp('F11'), kp('F4'), kp('F5'), kp('F6'), kp('SLCK'), np, kp('LSHFT'), kp('LCTRL'), kp('LALT'), kp('LGUI')],
    [kp('F10'), kp('F1'), kp('F2'), kp('F3'), kp('PAUSE'), np, np, np, np, np],
  ],
  { LT0: kp('K_APP'), LT1: kp('SPACE'), LT2: kp('TAB'), RT0: trans, RT1: trans, RT2: trans },
)

export const MIRYOKU_KEYMAP: Record<MiryokuLayer, Partial<Record<MiryokuSlot, KeyAction>>> = {
  BASE,
  NAV,
  MOUSE,
  MEDIA,
  NUM,
  SYM,
  FUN,
}

/** Sentinel used inside MIRYOKU_KEYMAP for "use the alpha letter for this slot". */
export const ALPHA_PLACEHOLDER = '__ALPHA__'

export function isAlphaPlaceholder(action: KeyAction): boolean {
  if (action.kind === 'kp') return action.code === ALPHA_PLACEHOLDER
  if (action.kind === 'mt') return action.tap === ALPHA_PLACEHOLDER
  return false
}
