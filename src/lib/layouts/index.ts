/**
 * Keyboard layout definitions for the Cosmos editor.
 *
 * A layout maps physical key positions (row, column) to printed legends. The
 * `row` value matches the row index used by `letterForKeycap()` in
 * `worker/config.ts`:
 *   row 0 = function row (F-keys)            — layout-independent
 *   row 1 = number row                       — layout-independent
 *   row 2 = top alpha row
 *   row 3 = home row
 *   row 4 = bottom alpha row
 *   row 5 = outer punctuation/wide pinky     — layout-independent
 *
 * Each layout supplies the right-side letters for rows 2/3/4. Number, F, and
 * pinky-punctuation rows are shared across all letter-swap layouts and live in
 * `letterForKeycap()`.
 *
 * `flipMap` mirrors a right-side letter to its left-side counterpart for split
 * keyboards. The map only needs to cover one direction; consumers handle the
 * inverse.
 */

export const LAYOUT = {
  QWERTY: 'qwerty',
  COLEMAK: 'colemak',
  COLEMAK_DH: 'colemak-dh',
  DVORAK: 'dvorak',
  WORKMAN: 'workman',
} as const

export type LayoutId = (typeof LAYOUT)[keyof typeof LAYOUT]

export const DEFAULT_LAYOUT: LayoutId = LAYOUT.QWERTY

export interface KeyboardLayout {
  id: LayoutId
  name: string
  /** Right-side rows. Each string holds letters for columns 0..N. */
  rightRows: { 2: string; 3: string; 4: string }
  /** Right-side letter -> left-side letter mirror map. */
  flipMap: Record<string, string>
}

const QWERTY: KeyboardLayout = {
  id: LAYOUT.QWERTY,
  name: 'QWERTY',
  rightRows: {
    2: 'yuiop',
    3: "hjkl;'",
    4: 'nm,./',
  },
  flipMap: {
    y: 't',
    u: 'r',
    i: 'e',
    o: 'w',
    p: 'q',
    h: 'g',
    j: 'f',
    k: 'd',
    l: 's',
    ';': 'a',
    n: 'b',
    m: 'v',
    ',': 'c',
    '.': 'x',
    '/': 'z',
  },
}

const COLEMAK: KeyboardLayout = {
  id: LAYOUT.COLEMAK,
  name: 'Colemak',
  rightRows: {
    2: 'jluy;',
    3: "hneio'",
    4: 'km,./',
  },
  flipMap: {
    j: 'g',
    l: 'p',
    u: 'f',
    y: 'w',
    ';': 'q',
    h: 'd',
    n: 't',
    e: 's',
    i: 'r',
    o: 'a',
    k: 'b',
    m: 'v',
    ',': 'c',
    '.': 'x',
    '/': 'z',
  },
}

const COLEMAK_DH: KeyboardLayout = {
  id: LAYOUT.COLEMAK_DH,
  name: 'Colemak-DH',
  rightRows: {
    2: 'jluy;',
    3: "mneio'",
    4: 'kh,./',
  },
  flipMap: {
    j: 'b',
    l: 'p',
    u: 'f',
    y: 'w',
    ';': 'q',
    m: 'g',
    n: 't',
    e: 's',
    i: 'r',
    o: 'a',
    k: 'z',
    h: 'x',
    ',': 'c',
    '.': 'd',
    '/': 'v',
  },
}

const DVORAK: KeyboardLayout = {
  id: LAYOUT.DVORAK,
  name: 'Dvorak',
  rightRows: {
    2: 'fgcrl/',
    3: 'dhtns-',
    4: 'bmwvz',
  },
  flipMap: {
    f: 'y',
    g: 'p',
    c: '.',
    r: ',',
    l: "'",
    d: 'i',
    h: 'u',
    t: 'e',
    n: 'o',
    s: 'a',
    b: 'x',
    m: 'q',
    w: 'j',
    v: 'k',
    z: ';',
  },
}

const WORKMAN: KeyboardLayout = {
  id: LAYOUT.WORKMAN,
  name: 'Workman',
  rightRows: {
    2: 'jfup;',
    3: "yneoi'",
    4: 'kl,./',
  },
  flipMap: {
    j: 'b',
    f: 'w',
    u: 'r',
    p: 'd',
    ';': 'q',
    y: 'g',
    n: 't',
    e: 'h',
    o: 's',
    i: 'a',
    k: 'v',
    l: 'c',
    ',': 'm',
    '.': 'x',
    '/': 'z',
  },
}

const REGISTRY: Record<LayoutId, KeyboardLayout> = {
  [LAYOUT.QWERTY]: QWERTY,
  [LAYOUT.COLEMAK]: COLEMAK,
  [LAYOUT.COLEMAK_DH]: COLEMAK_DH,
  [LAYOUT.DVORAK]: DVORAK,
  [LAYOUT.WORKMAN]: WORKMAN,
}

export const LAYOUT_IDS: readonly LayoutId[] = [
  LAYOUT.QWERTY,
  LAYOUT.COLEMAK,
  LAYOUT.COLEMAK_DH,
  LAYOUT.DVORAK,
  LAYOUT.WORKMAN,
]

export function getLayout(id: LayoutId | undefined | null): KeyboardLayout {
  return REGISTRY[id ?? DEFAULT_LAYOUT] ?? QWERTY
}

export function isLayoutId(value: unknown): value is LayoutId {
  return typeof value === 'string' && value in REGISTRY
}

const ALPHA_LETTERS: ReadonlySet<string> = new Set(
  LAYOUT_IDS.flatMap(id => {
    const layout = REGISTRY[id]
    return [
      ...layout.rightRows[2],
      ...layout.rightRows[3],
      ...layout.rightRows[4],
      ...Object.keys(layout.flipMap),
      ...Object.values(layout.flipMap),
    ]
  }),
)

/**
 * True iff `letter` is a legend that any registered layout places in its
 * alpha rows (right side or, after flipping, left side).
 *
 * Used to gate layout-swap operations so they don't touch outer punctuation
 * (`{`, `}`, `[`, `]`, `\` from row 5 — which `keycapInfo()` collapses to
 * `profile.row = 4` for MT3 keycap-profile reasons, defeating a row-based
 * filter).
 */
export function isAlphaLetter(letter: string | undefined): boolean {
  if (!letter) return false
  return ALPHA_LETTERS.has(letter)
}

/** Returns the right-side legend for (row, col) in the given layout, or undefined. */
export function rightSideLetter(row: number, col: number, layoutId: LayoutId = DEFAULT_LAYOUT): string | undefined {
  const layout = getLayout(layoutId)
  if (row === 2 || row === 3 || row === 4) {
    return layout.rightRows[row].charAt(col) || undefined
  }
  return undefined
}

/** Returns the left-side mirror of `letter` in the given layout. */
export function flipLetter(letter: string | undefined, layoutId: LayoutId = DEFAULT_LAYOUT): string | undefined {
  if (!letter) return letter
  const layout = getLayout(layoutId)
  if (letter in layout.flipMap) return layout.flipMap[letter]
  for (const [right, left] of Object.entries(layout.flipMap)) {
    if (left === letter) return right
  }
  return letter
}
