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
 *
 * Each layout also carries:
 *   `languages`     — ISO 639-1 codes the layout applies to. Drives the
 *                     dropdown's language grouping. Multi-entry for shared
 *                     layouts (e.g. Swedish/Finnish).
 *   `firmwareSafe`  — `true` when the alpha block is ASCII-only, so ZMK/QMK
 *                     export emits the right keycodes without locale-specific
 *                     keymap includes. `false` when the alpha block has
 *                     non-ASCII chars (ä, ö, ñ, etc.); export of those keys is
 *                     pending a follow-up PR adding `firmwareLocale` routing.
 */

export const LAYOUT = {
  QWERTY: 'qwerty',
  COLEMAK: 'colemak',
  COLEMAK_DH: 'colemak-dh',
  DVORAK: 'dvorak',
  WORKMAN: 'workman',
  HALMAK: 'halmak',
  NORMAN: 'norman',
  HANDS_DOWN: 'hands-down',
  ENGRAM: 'engram',
  QWERTZ: 'qwertz',
  AZERTY: 'azerty',
  QWERTY_ES: 'qwerty-es',
  QWERTY_IT: 'qwerty-it',
  QWERTY_PT_BR: 'qwerty-pt-br',
  QWERTY_NL: 'qwerty-nl',
  QWERTY_SV: 'qwerty-sv',
  QWERTY_DA: 'qwerty-da',
  QWERTY_NO: 'qwerty-no',
  QWERTY_PL: 'qwerty-pl',
  QWERTY_TR: 'qwerty-tr',
  /** User-edited layout that doesn't match any registered named layout.
   *  Has no rightRows/flipMap — `getLayout(CUSTOM)` falls back to QWERTY.
   *  Auto-detection no longer returns CUSTOM (best-fit always picks a named
   *  layout, with `kbd.layoutId` overriding when set); kept here for legacy
   *  callers and as a sentinel. */
  CUSTOM: 'custom',
} as const

export type LayoutId = (typeof LAYOUT)[keyof typeof LAYOUT]

/** Layouts with concrete letter mappings (everything except CUSTOM). */
export type NamedLayoutId = Exclude<LayoutId, 'custom'>

export const DEFAULT_LAYOUT: NamedLayoutId = LAYOUT.QWERTY

export interface KeyboardLayout {
  id: LayoutId
  name: string
  /** One- or two-sentence summary shown in the layout-picker tooltip. */
  description: string
  /** Right-side rows. Each string holds letters for columns 0..N. */
  rightRows: { 2: string; 3: string; 4: string }
  /** Right-side letter -> left-side letter mirror map. */
  flipMap: Record<string, string>
  /** ISO 639-1 codes the layout applies to. Drives dropdown grouping. */
  languages: readonly string[]
  /** True when the alpha block is ASCII-only (ZMK/QMK export works without
   *  locale-specific keymap includes). */
  firmwareSafe: boolean
}

// --- English (en) ----------------------------------------------------------

const QWERTY: KeyboardLayout = {
  id: LAYOUT.QWERTY,
  name: 'QWERTY',
  description: 'The standard layout shipped on virtually every keyboard. Familiar but not optimized — common letters are spread across rows.',
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
  languages: ['en'],
  firmwareSafe: true,
}

const COLEMAK: KeyboardLayout = {
  id: LAYOUT.COLEMAK,
  name: 'Colemak',
  description: 'Common letters concentrated on the home row, only 17 keys move from QWERTY. Easier to learn from QWERTY than Dvorak.',
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
  languages: ['en'],
  firmwareSafe: true,
}

const COLEMAK_DH: KeyboardLayout = {
  id: LAYOUT.COLEMAK_DH,
  name: 'Colemak-DH',
  description: 'A modern Colemak variant that swaps D/H to keep index-finger reach off the bottom-center keys. Popular on column-staggered ergo boards.',
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
  languages: ['en'],
  firmwareSafe: true,
}

const DVORAK: KeyboardLayout = {
  id: LAYOUT.DVORAK,
  name: 'Dvorak',
  description: 'Vowels under the left hand, common consonants under the right. Big departure from QWERTY (rebuilds muscle memory) but loved by long-time users.',
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
  languages: ['en'],
  firmwareSafe: true,
}

const WORKMAN: KeyboardLayout = {
  id: LAYOUT.WORKMAN,
  name: 'Workman',
  description: 'Tries to balance hand and finger usage by avoiding QWERTY/Colemak hot spots. Less mainstream but a good fit for staggered keyboards.',
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
  languages: ['en'],
  firmwareSafe: true,
}

const HALMAK: KeyboardLayout = {
  id: LAYOUT.HALMAK,
  name: 'Halmak',
  description: 'Genetically-optimized 30-key layout that places frequent letters under the strongest fingers. Includes punctuation in the alpha block.',
  rightRows: {
    2: ';qudj',
    3: '.aeoi',
    4: 'gpxky',
  },
  flipMap: {
    ';': 'z',
    q: 'b',
    u: 'r',
    d: 'l',
    j: 'w',
    '.': ',',
    a: 't',
    e: 'n',
    o: 'h',
    i: 's',
    g: '/',
    p: 'c',
    x: 'v',
    k: 'm',
    y: 'f',
  },
  languages: ['en'],
  firmwareSafe: true,
}

const NORMAN: KeyboardLayout = {
  id: LAYOUT.NORMAN,
  name: 'Norman',
  description: 'A QWERTY-friendly redesign that keeps Z/X/C/V positions for shortcut familiarity while moving the home row toward Colemak-like efficiency.',
  rightRows: {
    2: 'jurl;',
    3: 'ynioh',
    4: 'pm,./',
  },
  flipMap: {
    j: 'k',
    u: 'f',
    r: 'd',
    l: 'w',
    ';': 'q',
    y: 'g',
    n: 't',
    i: 'e',
    o: 's',
    h: 'a',
    p: 'b',
    m: 'v',
    ',': 'c',
    '.': 'x',
    '/': 'z',
  },
  languages: ['en'],
  firmwareSafe: true,
}

const HANDS_DOWN: KeyboardLayout = {
  id: LAYOUT.HANDS_DOWN,
  name: 'Hands Down',
  description: "Alan Reiser's ergonomic layout designed for column-staggered boards. Vowels on the right, consonants on the left, very low same-finger reuse.",
  rightRows: {
    2: 'kyoj/',
    3: 'wueia',
    4: 'zf,.;',
  },
  flipMap: {
    k: 'v',
    y: 'p',
    o: 'h',
    j: 'c',
    '/': 'q',
    w: 'g',
    u: 't',
    e: 'n',
    i: 's',
    a: 'r',
    z: 'b',
    f: 'd',
    ',': 'l',
    '.': 'm',
    ';': 'x',
  },
  languages: ['en'],
  firmwareSafe: true,
}

const ENGRAM: KeyboardLayout = {
  id: LAYOUT.ENGRAM,
  name: 'Engram',
  description: "Arno Klein's 2021 layout, designed via formal scoring over English text. Vowels on the left, balanced finger load.",
  rightRows: {
    2: 'ldwvz',
    3: '.htsn',
    4: 'rmfp/',
  },
  flipMap: {
    l: "'",
    d: 'u',
    w: 'o',
    v: 'y',
    z: 'b',
    '.': ',',
    h: 'a',
    t: 'e',
    s: 'i',
    n: 'c',
    r: '-',
    m: 'k',
    f: 'j',
    p: 'x',
    '/': 'g',
  },
  languages: ['en'],
  firmwareSafe: true,
}

// --- German (de) -----------------------------------------------------------

const QWERTZ: KeyboardLayout = {
  id: LAYOUT.QWERTZ,
  name: 'QWERTZ',
  description: 'The German-region standard. Y and Z are swapped from QWERTY; ä, ö, ü sit at the right pinky.',
  rightRows: {
    2: 'zuiopü',
    3: 'hjklöä',
    4: 'nm,.-',
  },
  flipMap: {
    z: 't',
    u: 'r',
    i: 'e',
    o: 'w',
    p: 'q',
    h: 'g',
    j: 'f',
    k: 'd',
    l: 's',
    'ö': 'a',
    n: 'b',
    m: 'v',
    ',': 'c',
    '.': 'x',
    '-': 'y',
  },
  languages: ['de'],
  firmwareSafe: false,
}

// --- French (fr) -----------------------------------------------------------

const AZERTY: KeyboardLayout = {
  id: LAYOUT.AZERTY,
  name: 'AZERTY',
  description: 'The French and Belgian standard. A/Q swap, Z/W swap, M moves to right of L; ù sits at the right pinky.',
  rightRows: {
    2: 'yuiop',
    3: 'hjklmù',
    4: 'n,;:!',
  },
  flipMap: {
    y: 't',
    u: 'r',
    i: 'e',
    o: 'z',
    p: 'a',
    h: 'g',
    j: 'f',
    k: 'd',
    l: 's',
    m: 'q',
    n: 'b',
    ',': 'v',
    ';': 'c',
    ':': 'x',
    '!': 'w',
  },
  languages: ['fr'],
  firmwareSafe: false,
}

// --- Spanish (es) ----------------------------------------------------------

const QWERTY_ES: KeyboardLayout = {
  id: LAYOUT.QWERTY_ES,
  name: 'QWERTY',
  description: 'The Spanish QWERTY. Same shape as US QWERTY plus ñ on the home-row pinky.',
  rightRows: {
    2: 'yuiop',
    3: 'hjklñ',
    4: 'nm,.-',
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
    'ñ': 'a',
    n: 'b',
    m: 'v',
    ',': 'c',
    '.': 'x',
    '-': 'z',
  },
  languages: ['es'],
  firmwareSafe: false,
}

// --- Italian (it) ----------------------------------------------------------

const QWERTY_IT: KeyboardLayout = {
  id: LAYOUT.QWERTY_IT,
  name: 'QWERTY',
  description: 'The Italian QWERTY. Same shape as US QWERTY plus ò on the home-row pinky.',
  rightRows: {
    2: 'yuiop',
    3: 'hjklò',
    4: 'nm,.-',
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
    'ò': 'a',
    n: 'b',
    m: 'v',
    ',': 'c',
    '.': 'x',
    '-': 'z',
  },
  languages: ['it'],
  firmwareSafe: false,
}

// --- Portuguese (pt-BR) ----------------------------------------------------

const QWERTY_PT_BR: KeyboardLayout = {
  id: LAYOUT.QWERTY_PT_BR,
  name: 'QWERTY',
  description: 'The Brazilian Portuguese QWERTY. Same shape as US QWERTY plus ç on the home-row pinky.',
  rightRows: {
    2: 'yuiop',
    3: 'hjklç',
    4: 'nm,.;',
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
    'ç': 'a',
    n: 'b',
    m: 'v',
    ',': 'c',
    '.': 'x',
    ';': 'z',
  },
  languages: ['pt-BR'],
  firmwareSafe: false,
}

// --- Dutch (nl) ------------------------------------------------------------

const QWERTY_NL: KeyboardLayout = {
  id: LAYOUT.QWERTY_NL,
  name: 'QWERTY',
  description: 'The Dutch QWERTY. Alpha block is identical to US QWERTY; locale-specific characters appear via AltGr.',
  rightRows: {
    2: 'yuiop',
    3: "hjkl;'",
    4: 'nm,./',
  },
  flipMap: { ...QWERTY.flipMap },
  languages: ['nl'],
  firmwareSafe: true,
}

// --- Swedish / Finnish (sv, fi) --------------------------------------------

const QWERTY_SV: KeyboardLayout = {
  id: LAYOUT.QWERTY_SV,
  name: 'QWERTY',
  description: 'The Swedish/Finnish QWERTY. Same shape as US QWERTY plus å, ä, ö at the right pinky.',
  rightRows: {
    2: 'yuiopå',
    3: 'hjklöä',
    4: 'nm,.-',
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
    'ö': 'a',
    n: 'b',
    m: 'v',
    ',': 'c',
    '.': 'x',
    '-': 'z',
  },
  languages: ['sv', 'fi'],
  firmwareSafe: false,
}

// --- Danish (da) -----------------------------------------------------------

const QWERTY_DA: KeyboardLayout = {
  id: LAYOUT.QWERTY_DA,
  name: 'QWERTY',
  description: 'The Danish QWERTY. Same shape as US QWERTY plus å, æ, ø at the right pinky.',
  rightRows: {
    2: 'yuiopå',
    3: 'hjklæø',
    4: 'nm,.-',
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
    'æ': 'a',
    n: 'b',
    m: 'v',
    ',': 'c',
    '.': 'x',
    '-': 'z',
  },
  languages: ['da'],
  firmwareSafe: false,
}

// --- Norwegian (no) --------------------------------------------------------

const QWERTY_NO: KeyboardLayout = {
  id: LAYOUT.QWERTY_NO,
  name: 'QWERTY',
  description: 'The Norwegian QWERTY. Same shape as US QWERTY plus å, ø, æ at the right pinky.',
  rightRows: {
    2: 'yuiopå',
    3: 'hjkløæ',
    4: 'nm,.-',
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
    'ø': 'a',
    n: 'b',
    m: 'v',
    ',': 'c',
    '.': 'x',
    '-': 'z',
  },
  languages: ['no'],
  firmwareSafe: false,
}

// --- Polish (pl) -----------------------------------------------------------

const QWERTY_PL: KeyboardLayout = {
  id: LAYOUT.QWERTY_PL,
  name: "Programmer's QWERTY",
  description: "The Polish Programmer's QWERTY. Alpha block is identical to US QWERTY; ą, ę, ó, ł, ż, ź, ć, ń, ś appear via AltGr.",
  rightRows: {
    2: 'yuiop',
    3: "hjkl;'",
    4: 'nm,./',
  },
  flipMap: { ...QWERTY.flipMap },
  languages: ['pl'],
  firmwareSafe: true,
}

// --- Turkish (tr) ----------------------------------------------------------

const QWERTY_TR: KeyboardLayout = {
  id: LAYOUT.QWERTY_TR,
  name: 'Turkish-Q',
  description: 'The Turkish-Q QWERTY. ı (dotless i) replaces i on the top row; ş, ğ, ö, ç appear in the alpha block.',
  rightRows: {
    2: 'yuıopğ',
    3: 'hjklşi',
    4: 'nmöç.',
  },
  flipMap: {
    y: 't',
    u: 'r',
    'ı': 'e',
    o: 'w',
    p: 'q',
    h: 'g',
    j: 'f',
    k: 'd',
    l: 's',
    'ş': 'a',
    n: 'b',
    m: 'v',
    'ö': 'c',
    'ç': 'x',
    '.': 'z',
  },
  languages: ['tr'],
  firmwareSafe: false,
}

// --- Registry --------------------------------------------------------------

const REGISTRY: Record<NamedLayoutId, KeyboardLayout> = {
  [LAYOUT.QWERTY]: QWERTY,
  [LAYOUT.COLEMAK]: COLEMAK,
  [LAYOUT.COLEMAK_DH]: COLEMAK_DH,
  [LAYOUT.DVORAK]: DVORAK,
  [LAYOUT.WORKMAN]: WORKMAN,
  [LAYOUT.HALMAK]: HALMAK,
  [LAYOUT.NORMAN]: NORMAN,
  [LAYOUT.HANDS_DOWN]: HANDS_DOWN,
  [LAYOUT.ENGRAM]: ENGRAM,
  [LAYOUT.QWERTZ]: QWERTZ,
  [LAYOUT.AZERTY]: AZERTY,
  [LAYOUT.QWERTY_ES]: QWERTY_ES,
  [LAYOUT.QWERTY_IT]: QWERTY_IT,
  [LAYOUT.QWERTY_PT_BR]: QWERTY_PT_BR,
  [LAYOUT.QWERTY_NL]: QWERTY_NL,
  [LAYOUT.QWERTY_SV]: QWERTY_SV,
  [LAYOUT.QWERTY_DA]: QWERTY_DA,
  [LAYOUT.QWERTY_NO]: QWERTY_NO,
  [LAYOUT.QWERTY_PL]: QWERTY_PL,
  [LAYOUT.QWERTY_TR]: QWERTY_TR,
}

/** Concrete-mapping layouts (everything in the dropdown except CUSTOM).
 *  Order here is also the dropdown's within-language sort order and the
 *  registry-tiebreak order for best-fit detection. Append-only is *not*
 *  required (dropdown order can change freely); see LAYOUT_ENCODE for
 *  the wire-format-stable ordering. */
export const NAMED_LAYOUT_IDS: readonly NamedLayoutId[] = [
  LAYOUT.QWERTY,
  LAYOUT.COLEMAK,
  LAYOUT.COLEMAK_DH,
  LAYOUT.DVORAK,
  LAYOUT.WORKMAN,
  LAYOUT.HALMAK,
  LAYOUT.NORMAN,
  LAYOUT.HANDS_DOWN,
  LAYOUT.ENGRAM,
  LAYOUT.QWERTZ,
  LAYOUT.AZERTY,
  LAYOUT.QWERTY_ES,
  LAYOUT.QWERTY_IT,
  LAYOUT.QWERTY_PT_BR,
  LAYOUT.QWERTY_NL,
  LAYOUT.QWERTY_SV,
  LAYOUT.QWERTY_DA,
  LAYOUT.QWERTY_NO,
  LAYOUT.QWERTY_PL,
  LAYOUT.QWERTY_TR,
]

/** Wire-format-stable layout id ordering. The 5 original layouts keep their
 *  original indices (0=QWERTY, 1=COLEMAK, 2=COLEMAK_DH, 3=DVORAK, 4=WORKMAN)
 *  so URLs serialized before the no-attribute interregnum decode unchanged.
 *  **Append-only** — never re-order, never delete; reserve indices for
 *  removed layouts if needed. */
export const LAYOUT_ENCODE: readonly NamedLayoutId[] = [
  LAYOUT.QWERTY,
  LAYOUT.COLEMAK,
  LAYOUT.COLEMAK_DH,
  LAYOUT.DVORAK,
  LAYOUT.WORKMAN,
  LAYOUT.HALMAK,
  LAYOUT.NORMAN,
  LAYOUT.HANDS_DOWN,
  LAYOUT.ENGRAM,
  LAYOUT.QWERTZ,
  LAYOUT.AZERTY,
  LAYOUT.QWERTY_ES,
  LAYOUT.QWERTY_IT,
  LAYOUT.QWERTY_PT_BR,
  LAYOUT.QWERTY_NL,
  LAYOUT.QWERTY_SV,
  LAYOUT.QWERTY_DA,
  LAYOUT.QWERTY_NO,
  LAYOUT.QWERTY_PL,
  LAYOUT.QWERTY_TR,
]

/** All layouts shown in the picker, including CUSTOM. */
export const LAYOUT_IDS: readonly LayoutId[] = [...NAMED_LAYOUT_IDS, LAYOUT.CUSTOM]

export const LAYOUT_NAMES: Record<LayoutId, string> = {
  [LAYOUT.QWERTY]: QWERTY.name,
  [LAYOUT.COLEMAK]: COLEMAK.name,
  [LAYOUT.COLEMAK_DH]: COLEMAK_DH.name,
  [LAYOUT.DVORAK]: DVORAK.name,
  [LAYOUT.WORKMAN]: WORKMAN.name,
  [LAYOUT.HALMAK]: HALMAK.name,
  [LAYOUT.NORMAN]: NORMAN.name,
  [LAYOUT.HANDS_DOWN]: HANDS_DOWN.name,
  [LAYOUT.ENGRAM]: ENGRAM.name,
  [LAYOUT.QWERTZ]: QWERTZ.name,
  [LAYOUT.AZERTY]: AZERTY.name,
  [LAYOUT.QWERTY_ES]: QWERTY_ES.name,
  [LAYOUT.QWERTY_IT]: QWERTY_IT.name,
  [LAYOUT.QWERTY_PT_BR]: QWERTY_PT_BR.name,
  [LAYOUT.QWERTY_NL]: QWERTY_NL.name,
  [LAYOUT.QWERTY_SV]: QWERTY_SV.name,
  [LAYOUT.QWERTY_DA]: QWERTY_DA.name,
  [LAYOUT.QWERTY_NO]: QWERTY_NO.name,
  [LAYOUT.QWERTY_PL]: QWERTY_PL.name,
  [LAYOUT.QWERTY_TR]: QWERTY_TR.name,
  [LAYOUT.CUSTOM]: 'Custom',
}

// --- Languages -------------------------------------------------------------

/** Languages registered for the dropdown grouping UI. The display name is
 *  shown as the group header in the dropdown; ISO 639-1 codes drive
 *  membership via `KeyboardLayout.languages`. The order here is the fallback
 *  order when `navigator.language` doesn't match any registered language. */
export const LANGUAGES: Record<string, { name: string }> = {
  en: { name: 'English' },
  de: { name: 'German' },
  fr: { name: 'French' },
  es: { name: 'Spanish' },
  it: { name: 'Italian' },
  'pt-BR': { name: 'Portuguese (Brazil)' },
  nl: { name: 'Dutch' },
  sv: { name: 'Swedish' },
  fi: { name: 'Finnish' },
  da: { name: 'Danish' },
  no: { name: 'Norwegian' },
  pl: { name: 'Polish' },
  tr: { name: 'Turkish' },
}

/** Order language codes with `userLang` first, then registry order. */
export function orderLanguages(languages: Record<string, { name: string }>, userLang: string | undefined): string[] {
  const codes = Object.keys(languages)
  if (!userLang) return codes
  const idx = codes.indexOf(userLang)
  if (idx < 0) {
    // Try the language family (e.g., 'en' for 'en-GB' if only 'en' is
    // registered). pt-BR-style entries match against the full 'pt-BR' code;
    // 'pt-PT' would still fall through to 'pt' if it existed, else the default.
    const family = userLang.split('-')[0]
    const familyIdx = codes.indexOf(family)
    if (familyIdx < 0) return codes
    return [codes[familyIdx], ...codes.filter((_, i) => i !== familyIdx)]
  }
  return [codes[idx], ...codes.filter((_, i) => i !== idx)]
}

// --- Helpers ---------------------------------------------------------------

export function isNamedLayoutId(id: LayoutId | undefined | null): id is NamedLayoutId {
  return typeof id === 'string' && id !== LAYOUT.CUSTOM && id in REGISTRY
}

export function getLayout(id: LayoutId | undefined | null): KeyboardLayout {
  if (id && id !== LAYOUT.CUSTOM && id in REGISTRY) return REGISTRY[id as NamedLayoutId]
  return QWERTY
}

export function isLayoutId(value: unknown): value is LayoutId {
  if (typeof value !== 'string') return false
  return value === LAYOUT.CUSTOM || value in REGISTRY
}

const ALPHA_LETTERS: ReadonlySet<string> = new Set(
  NAMED_LAYOUT_IDS.flatMap(id => {
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

// Number-row and F-row mirror map (layout-independent for letter-swap layouts).
// dprint-ignore
const SHARED_FLIP: Record<string, string> = {
  0: '1', 9: '2', 8: '3', 7: '4', 6: '5',
  'F10': 'F1', 'F9': 'F2', 'F8': 'F3', 'F7': 'F4', 'F6': 'F5',
}
for (const k of Object.keys(SHARED_FLIP)) SHARED_FLIP[SHARED_FLIP[k]] = k

export function flippedKey(letter: string | undefined, layout: LayoutId = DEFAULT_LAYOUT) {
  if (!letter) return letter
  if (letter in SHARED_FLIP) return SHARED_FLIP[letter]
  return flipLetter(letter, layout) ?? letter
}

const KEY_MATRIX = [
  '1234567890',
  'qwertyuiop',
  'asdfghjkl;',
  'zxcvbnm,./',
]

export function adjacentKeycapLetter(letter: string | undefined, dx: number, dy: number) {
  if (!letter) return undefined
  if (letter.length > 1) return undefined
  const row = KEY_MATRIX.findIndex(r => r.includes(letter))
  if (row == -1) return undefined
  const column = KEY_MATRIX[row].indexOf(letter)
  const newRow = row + dy
  if (newRow < 0 || newRow >= KEY_MATRIX.length) return undefined
  const newColumn = column + dx
  if (newColumn < 0 || newColumn >= KEY_MATRIX[newRow].length) return undefined
  if ((column < 5) != (newColumn < 5)) return undefined
  return KEY_MATRIX[newRow][newColumn]
}
