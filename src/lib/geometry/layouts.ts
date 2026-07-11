import { parseBCP } from '$lib/bcp'
import type { Finger } from '$lib/hand'
import { type CosmosCluster, type CosmosKey, type CosmosKeyboard, mirrorCluster } from '$lib/worker/config.cosmos'
import { objEntries, objKeys, range } from '$lib/worker/util'
import type { Layout } from '$target/cosmosStructs'
import { PART_INFO } from './socketsParts'

export const DEFAULT_LAYOUT: Layout = 'qwerty'

export interface Language {
  /** English name of the language */
  name: string
  /** Name of associated QMK locale */
  qmk: string | null
  /** Name of associated ZMK locale */
  zmk: string | null
  /** If no direct maping to QMK, the ID of another layout that has all the same symbols */
  qmkCharset?: string
  /** If no direct maping to ZMK, the ID of another layout that has all the same symbols */
  zmkCharset?: string
  /** BCP 47 language tag. If multiple, separate with commas.
   * See https://developer.mozilla.org/en-US/docs/Glossary/BCP_47_language_tag */
  tag: string
}

export interface LayoutData {
  name: string
  languages: Language[]
  layout: string
}

export const LAYOUTS: Record<Layout, LayoutData> = {
  qwerty: {
    name: 'QWERTY',
    languages: [
      { name: 'English (QWERTY)', qmk: '', zmk: '', tag: 'en' },
      { name: 'Bulgarian (QWERTY)', qmk: '', zmk: 'bg_latin', tag: 'bg' },
      { name: 'Chinese (QWERTY)', qmk: '', zmk: '', tag: 'zh' },
      { name: 'Czech (QWERTY)', qmk: '', zmk: 'cs_programmers', tag: 'cs' },
      { name: 'Hausa (QWERTY)', qmk: '', zmk: 'ha', tag: 'ha' },
      { name: 'Igbo (QWERTY)', qmk: '', zmk: 'ig', tag: 'ig' },
      { name: 'Inuktitut (QWERTY)', qmk: '', zmk: 'iu_latin', tag: 'iu' },
      { name: 'Japanese (QWERTY)', qmk: '', zmk: '', tag: 'ja' },
      { name: 'Korean (QWERTY)', qmk: '', zmk: 'ko', tag: 'ko' },
      { name: 'Latvian (QWERTY)', qmk: '', zmk: 'lv_standard', tag: 'lv' },
      { name: 'Maori (QWERTY)', qmk: '', zmk: 'mi', tag: 'mi' },
      { name: 'Greek (QWERTY)', qmk: '', zmk: 'el_latin', tag: 'el' },
      { name: 'Pedi (QWERTY)', qmk: '', zmk: 'nso', tag: 'nso' },
      { name: 'Polish (QWERTY)', qmk: 'polish', zmk: 'pl_programmers', tag: 'pl' },
      { name: 'Romanian (QWERTY)', qmk: '', zmk: 'ro_programmers', tag: 'ro' },
      { name: 'Tswana (QWERTY)', qmk: '', zmk: 'tn', tag: 'tn' },
      { name: 'Yoruba (QWERTY)', qmk: '', zmk: 'yo', tag: 'yo' },
      { name: 'Yoruba (QWERTY)', qmk: '', zmk: 'yo', tag: 'yo' },
    ],
    layout: `\
\` 1 2 3 4 5 6 7 8 9 0 - =
q w e r t y u i o p [ ]
a s d f g h j k l ; ' \\
  z x c v b n m , . /
`,
  },
  qwerty_uk: {
    name: 'QWERTY (UK)',
    languages: [
      { name: 'English (UK)', qmk: 'uk', zmk: 'en_gb', tag: 'en-GB,en-IE' },
      { name: 'Irish Gaelic', qmk: 'irish', zmk: 'ga', tag: 'ga' },
      { name: 'Scottish Gaelic', qmk: 'irish', zmk: 'gd', tag: 'gd' },
    ],
    layout: `\
\` 1 2 3 4 5 6 7 8 9 0 - =
q w e r t y u i o p [ ]
a s d f g h j k l ; ' #
\\ z x c v b n m , . /
`,
  },
  serbian: {
    name: 'Serbian',
    languages: [
      { name: 'Bosnian', qmk: 'serbian', zmk: 'bs', tag: 'bs' },
      { name: 'Serbian', qmk: 'serbian', zmk: 'sr', tag: 'sr' },
    ],
    layout: `\
\` 1 2 3 4 5 6 7 8 9 0 ' +
љ њ е р т з у и о п ш ђ
а с д ф г х ј к л ч ћ ж
< ѕ џ ц в б н м , . -`,
  },
  qwerty_can_fr: {
    name: 'Canadian French',
    languages: [{ name: 'Canadian French', qmk: 'canadian_french', zmk: 'fr_canadian_french', tag: 'fr-CA' }],
    layout: `\
# 1 2 3 4 5 6 7 8 9 0 - =
q w e r t y u i o p ^ ¸
a s d f g h j k l ; \` <
« z x c v b n m , . é`,
  },
  azerty_fr: {
    name: 'French',
    languages: [
      { name: 'French', qmk: 'french', zmk: 'fr', tag: 'fr' },
      { name: 'Central Atlas Tamazight', qmk: 'french', zmk: 'tzm', tag: 'tzm' },
    ],
    layout: `\
² & é " ' ( - è _ ç à ) =
a z e r t y u i o p ^ $
q s d f g h j k l m ù *
< w x c v b n , ; : !
`,
  },
  qwertz_czech: {
    name: 'Czech',
    languages: [{ name: 'Czech', qmk: 'czech', zmk: 'cs', tag: 'cs' }],
    layout: `\
; + ě š č ř ž ý á í é = ´
q w e r t z u i o p ú )
a s d f g h j k l ů § ¨
\\ y x c v b n m , . -`,
  },
  qwerty_danish: {
    name: 'Danish',
    languages: [
      { name: 'Danish', qmk: 'danish', zmk: 'da', tag: 'da' },
      { name: 'Kalaallisut', qmk: 'danish', zmk: 'kl', tag: 'kl' },
    ],
    layout: `\
½ 1 2 3 4 5 6 7 8 9 0 + ´
q w e r t y u i o p å ¨
a s d f g h j k l æ ø '
< z x c v b n m , . -
`,
  },
  azerty_dutch: {
    name: 'Dutch/Belgian',
    languages: [
      { name: 'Dutch', qmk: 'belgian', zmk: 'nl', tag: 'nl' },
      { name: 'Belgian', qmk: 'belgian', zmk: 'fr_belgian', tag: 'nl-BE,fr-BE,de-BE' },
    ],
    layout: `\
² & é " ' ( § è ! ç à ) -
a z e r t y u i o p ^ $
q s d f g h j k l m ù µ
< w x c v b n , ; : =
`,
  },
  dvorak: {
    name: 'Dvorak',
    languages: [{ name: 'English (Dvorak)', qmk: 'dvorak', zmk: 'dvorak', tag: 'en' }],
    layout: `\
\` 1 2 3 4 5 6 7 8 9 0 [ ]
' , . p y f g c r l / =
a o e u i d h t n s - \\
  ; q j k x b m w v z`,
  },
  qwerty_estonian: {
    name: 'Estonian',
    languages: [{ name: 'Estonian', qmk: 'estonian', zmk: 'et', tag: 'et' }],
    layout: `\
ˇ 1 2 3 4 5 6 7 8 9 0 + ´
q w e r t y u i o p ü õ
a s d f g h j k l ö ä '
< z x c v b n m , . -`,
  },
  qwerty_nordic: {
    name: 'Nordic',
    languages: [
      { name: 'Finnish', qmk: 'finnish', zmk: 'fi', tag: 'fi' },
      { name: 'Swedish', qmk: 'swedish', zmk: 'sv', tag: 'sv' },
    ],
    layout: `\
§ 1 2 3 4 5 6 7 8 9 0 + ´
q w e r t y u i o p å ¨
a s d f g h j k l ö ä '
< z x c v b n m , . -`,
  },
  qwerty_can_ml: {
    name: 'Canadian Multilingual',
    languages: [{ name: 'Canadian Multilingual', qmk: 'canadian_multilingual', zmk: 'fr_canadian_standard', tag: 'fr-CA' }],
    layout: `\
/ 1 2 3 4 5 6 7 8 9 0 - =
q w e r t y u i o p ^ ç
a s d f g h j k l ; è à
ù z x c v b n m , . é`,
  },
  qwertz_ch_fr: {
    name: 'Swiss French',
    languages: [
      { name: 'Swiss French', qmk: 'swiss_fr', zmk: 'fr_swiss', tag: 'fr-CH' },
      { name: 'Luxembourgish', qmk: 'swiss_fr', zmk: 'lb', tag: 'lb' },
    ],
    layout: `\
§ 1 2 3 4 5 6 7 8 9 0 ' ^
q w e r t z u i o p è ¨
a s d f g h j k l é à $
< y x c v b n m , . -`,
  },
  qwertz_ch_de: {
    name: 'Swiss German',
    languages: [{ name: 'Swiss German', qmk: 'swiss_de', zmk: 'de_swiss', tag: 'de-CH' }],
    layout: `\
§ 1 2 3 4 5 6 7 8 9 0 ' ^
q w e r t z u i o p ü ¨
a s d f g h j k l ö ä $
< y x c v b n m , . -`,
  },
  qwertz_de: {
    name: 'German',
    languages: [
      { name: 'German', qmk: 'german', zmk: 'de', tag: 'de' },
      { name: 'Lower Sorbian', qmk: 'german', zmk: 'dsb', tag: 'dsb' },
    ],
    layout: `\
^ 1 2 3 4 5 6 7 8 9 0 ß ´
q w e r t z u i o p ü +
a s d f g h j k l ö ä #
< y x c v b n m , . -`,
  },
  qwerty_es_latam: {
    name: 'Spanish (LatAm)',
    languages: [
      { name: 'Spanish (Latin America)', qmk: 'spanish_latin_america', zmk: 'es_latin_american', tag: 'es' },
      { name: 'Guarani', qmk: 'spanish_latin_america', zmk: 'gn', tag: 'gn' },
    ],
    layout: `\
| 1 2 3 4 5 6 7 8 9 0 ' ¿
q w e r t y u i o p ´ +
a s d f g h j k l ñ { }
< z x c v b n m , . -`,
  },
  hebrew: {
    name: 'Hebrew',
    languages: [{ name: 'Hebrew', qmk: 'hebrew', zmk: 'he', tag: 'he' }],
    layout: `\
; 1 2 3 4 5 6 7 8 9 0 - =
/ ' ק ר א ט ו ן ם פ ] [
ש ד ג כ ע י ח ל ך ף , \\
  ז ס ב ה נ מ צ ת ץ .`,
  },
  qwertz_hu: {
    name: 'Hungarian',
    languages: [{ name: 'Hungarian', qmk: 'hungarian', zmk: 'hu', tag: 'hu' }],
    layout: `\
0 1 2 3 4 5 6 7 8 9 ö ü ó
q w e r t z u i o p ő ú
a s d f g h j k l é á ű
í y x c v b n m , . -`,
  },
  qwerty_is: {
    name: 'Icelandic',
    languages: [{ name: 'Icelandic', qmk: 'icelandic', zmk: 'is', tag: 'is' }],
    layout: `\
° 1 2 3 4 5 6 7 8 9 0 ö -
q w e r t y u i o p ð '
a s d f g h j k l æ ´ +
< z x c v b n m , . þ`,
  },
  qwerty_it: {
    name: 'Italian',
    languages: [{ name: 'Italian', qmk: 'italian', zmk: 'it', tag: 'it' }],
    layout: `\
\\ 1 2 3 4 5 6 7 8 9 0 ' ì
q w e r t y u i o p è +
a s d f g h j k l ò à ù
< z x c v b n m , . -`,
  },
  jcuken_ru: {
    name: 'Russian',
    languages: [
      { name: 'Russian', qmk: 'russian', zmk: 'ru', tag: 'ru' },
      { name: 'Kirghiz', qmk: 'russian', zmk: 'ky', tag: 'ky' },
    ],
    layout: `\
ё 1 2 3 4 5 6 7 8 9 0 - =
й ц у к е н г ш щ з х ъ
ф ы в а п р о л д ж э \\
  я ч с м и т ь б ю .`,
  },
  qwerty_lt: {
    name: 'Lithuanian (QWERTY)',
    languages: [{ name: 'Lithuanian (QWERTY)', qmk: 'lithuanian_qwerty', zmk: 'lt', tag: 'lt' }],
    layout: `\
\` ą č ę ė į š ų ū 9 0 - ž
q w e r t y u i o p [ ]
a s d f g h j k l ; ' \\
  z x c v b n m , . / `,
  },
  azerty_lt: {
    name: 'Lithuanian (AZERTY)',
    languages: [{ name: 'Lithuanian (AZERTY)', qmk: 'lithuanian_azerty', zmk: 'lt_standard', tag: 'lt' }],
    layout: `\
\` ! - / ; : , . = ( ) ? x
ą ž e r t y u i o p į w
a s d š g h j k l ų ė q
< z ū c v b n m č f ę`,
  },
  greek: {
    name: 'Greek',
    languages: [{ name: 'Greek', qmk: 'greek', zmk: 'el', tag: 'el' }],
    layout: `\
\` 1 2 3 4 5 6 7 8 9 0 - =
; ς ε ρ τ υ θ ι ο π [ ]
α σ δ φ γ η ξ κ λ ΄ ' \\
  ζ χ ψ ω β ν μ , . /`,
  },
  qwerty_no: {
    name: 'Norwegian',
    languages: [{ name: 'Norwegian', qmk: 'norwegian', zmk: 'nb', tag: 'no,nb,nn' }],
    layout: `\
| 1 2 3 4 5 6 7 8 9 0 + \\
q w e r t y u i o p å ¨
a s d f g h j k l ø æ '
< z x c v b n m , . -`,
  },
  farsi: {
    name: 'Persian',
    languages: [{ name: 'Persian', qmk: 'farsi', zmk: 'fa_standard', tag: 'fa' }],
    layout: `\
‍ ۱ ۲ ۳ ۴ ۵ ۶ ۷ ۸ ۹ ۰ - =
ض ص ث ق ف غ ع ه خ ح ج چ
ش س ی ب ل ا ت ن م ک گ \\
  ظ ط ز ر ذ د پ و . /`,
  },
  qwerty_pt: {
    name: 'Portuguese',
    languages: [{ name: 'Portuguese', qmk: 'portuguese', zmk: 'pt', tag: 'pt' }],
    layout: `\
\\ 1 2 3 4 5 6 7 8 9 0 ' «
q w e r t y u i o p + ´
a s d f g h j k l ç º ~
< z x c v b n m , . -`,
  },
  qwerty_ro: {
    name: 'Romanian',
    languages: [{ name: 'Romanian', qmk: 'romanian', zmk: 'ro', tag: 'ro' }],
    layout: `\
„ 1 2 3 4 5 6 7 8 9 0 - =
q w e r t y u i o p ă î
a s d f g h j k l ș ț â
\\ z x c v b n m , . /`,
  },
  qwertz_sr: {
    name: 'Serbian (QWERTZ)',
    languages: [{ name: 'Serbian (QWERTZ)', qmk: 'serbian_latin', zmk: 'sr_latin', tag: 'sr' }],
    layout: `\
‚ 1 2 3 4 5 6 7 8 9 0 ' +
q w e r t z u i o p š đ
a s d f g h j k l č ć ž
< y x c v b n m , . -`,
  },
  qwertz_sk: {
    name: 'Slovak',
    languages: [{ name: 'Slovak', qmk: 'slovak', zmk: 'sk', tag: 'sk' }],
    layout: `\
; + ľ š č ť ž ý á í é = ´
q w e r t z u i o p ú ä
a s d f g h j k l ô § ň
& y x c v b n m , . -`,
  },
  qwertz_sl: {
    name: 'Slovenian/Croatian',
    languages: [
      { name: 'Slovenian', qmk: 'slovenian', zmk: 'sl', tag: 'sl' },
      { name: 'Croatian', qmk: 'croatian', zmk: 'sl', tag: 'hr' },
    ],
    layout: `\
¸ 1 2 3 4 5 6 7 8 9 0 ' +
q w e r t z u i o p š đ
a s d f g h j k l č ć ž
< y x c v b n m , . -`,
  },
  qwerty_es: {
    name: 'Spanish (Spain)',
    languages: [{ name: 'Spanish (Spain)', qmk: 'spanish', zmk: 'es', tag: 'es-ES' }],
    layout: `\
º 1 2 3 4 5 6 7 8 9 0 ' ¡
q w e r t y u i o p \` +
a s d f g h j k l ñ ´ ç
< z x c v b n m , . -`,
  },
  turkish_q: {
    name: 'Turkish Q',
    languages: [{ name: 'Turkish Q', qmk: 'turkish_q', zmk: 'tr', tag: 'tr' }],
    layout: `\
" 1 2 3 4 5 6 7 8 9 0 * -
q w e r t y u ı o p ğ ü
a s d f g h j k l ş i ,
< z x c v b n m ö ç .`,
  },
  turkish_f: {
    name: 'Turkish F',
    languages: [{ name: 'Turkish F', qmk: 'turkish_f', zmk: 'tr_f', tag: 'tr' }],
    layout: `\
+ 1 2 3 4 5 6 7 8 9 0 / -
f g ğ ı o d r n h p q w
u i e a ü t k m l y ş x
< j ö v c ç z s b . ,`,
  },
  ukrainian: {
    name: 'Ukrainian',
    languages: [{ name: 'Ukrainian', qmk: 'ukrainian', zmk: 'uk_enhanced', tag: 'uk' }],
    layout: `\
' 1 2 3 4 5 6 7 8 9 0 - =
й ц у к е н г ш щ з х ї
ф і в а п р о л д ж є \\
  я ч с м и т ь б ю .`,
  },
}

/** Returns all languages applicable to the user's navigator.langauge, then all others */
export function partitionLanguages(languages: readonly string[] | undefined): [Language[], Language[]] {
  if (!languages) languages = []
  const allLanguages = Object.values(LAYOUTS).flatMap(l => l.languages).sort((a, b) => a.name.localeCompare(b.name))
  let filtered: Language[] = []

  for (let i = 0; !filtered.length && i < languages.length; i++) {
    const parsed = parseBCP(languages[i])
    filtered = allLanguages.filter(l =>
      l.tag.split(',').some(option => {
        const region = option.indexOf('-')
        if (region == -1) return parsed.language == option
        return parsed.language == option.substring(0, region) && parsed.region == option.substring(region + 1)
      })
    )
  }

  return [filtered, allLanguages.filter(l => !filtered.includes(l))]
}

// Mapping right cells to left cells. dprint-ignore
const R2L: Record<number, number> = {
  12: 10, 14: 8, 16: 6, 18: 4, 20: 2, 22: 0,
  36: 34, 38: 32, 40: 30, 42: 28, 44: 26, 46: -1,
  60: 58, 62: 56, 64: 54, 66: 52, 68: 50, 70: -1,
  86: 84, 88: 82, 90: 80, 92: 78, 94: 76,
  48: 72, 24: 74,
}

export function leftCells(layout: Layout) {
  const l = LAYOUTS[layout].layout
  return [
    l[0] + l[2] + l[4] + l[6] + l[8] + l[10],
    ' ' + l[26] + l[28] + l[30] + l[32] + l[34],
    ' ' + l[50] + l[52] + l[54] + l[56] + l[58],
    ' ' + l[76] + l[78] + l[80] + l[82] + l[84],
    '  ' + l[74] + l[72] + '  ',
  ]
}

export function rightCells(layout: Layout) {
  const l = LAYOUTS[layout].layout
  return [
    l[12] + l[14] + l[16] + l[18] + l[20] + l[22],
    l[36] + l[38] + l[40] + l[42] + l[44] + l[46],
    l[60] + l[62] + l[64] + l[66] + l[68] + l[70],
    l[86] + l[88] + l[90] + l[92] + l[94] + ' ',
    '  ' + l[48] + l[24] + '  ',
  ]
}

export function transposeCells(cells: string[]) {
  return range(0, cells[0].length).map(i => cells.map(c => c.charAt(i)).join(''))
}

/** Returns the left-side mirror of `letter` in the given layout. */
export function flipLetter(letter: string | undefined, layout: Layout): string | undefined {
  if (!letter) return letter
  const layoutStr = LAYOUTS[layout].layout
  const index = R2L[layoutStr.indexOf(letter)]
  if (typeof index === 'undefined') return letter
  return layoutStr[index]
}

// Number-row and F-row mirror map (layout-independent for letter-swap layouts).
// dprint-ignore
const SHARED_FLIP: Record<string, string> = {
  'F10': 'F1', 'F9': 'F2', 'F8': 'F3', 'F7': 'F4', 'F6': 'F5',
}
for (const k of Object.keys(SHARED_FLIP)) SHARED_FLIP[SHARED_FLIP[k]] = k

export function flippedKey(letter: string | undefined, layout: Layout | undefined) {
  if (!letter) return letter
  if (letter in SHARED_FLIP) return SHARED_FLIP[letter]
  return flipLetter(letter, layout || DEFAULT_LAYOUT) ?? letter
}

const RIGHT_COLUMN_FINGERS: Finger[] = ['indexFinger', 'indexFinger', 'middleFinger', 'ringFinger', 'pinky', 'pinky']
const LEFT_COLUMN_FINGERS: Finger[] = [...RIGHT_COLUMN_FINGERS].reverse()

/** Mapping of which finger presses each letter in the layout. */
export function lettersToFingers(layout: Layout): Record<string, Finger> {
  const fingers: Record<string, Finger> = {}
  const assign = (cells: string[], columns: Finger[]) =>
    cells.forEach((row) =>
      Array.from(row).forEach((letter, c) => {
        if (letter && letter != ' ') fingers[letter] = columns[c]
      })
    )
  assign(leftCells(layout), LEFT_COLUMN_FINGERS)
  assign(rightCells(layout), RIGHT_COLUMN_FINGERS)
  return fingers
}

/** Re-letters `letters`, typed on a the source layout, to the letters sitting at the same physical
 *  positions in the arget layout. Positions the layout leaves blank are dropped. */
export function relayout(letters: string, sourceLayout: Layout, targetLayout: Layout) {
  const source = LAYOUTS[sourceLayout].layout
  const target = LAYOUTS[targetLayout].layout
  return Array.from(letters)
    .map(letter => target[source.indexOf(letter)])
    .filter(letter => letter && letter != ' ' && letter != '\n')
    .join('')
}

export function adjacentKeycapLetter(letter: string | undefined, dx: number, dy: number, layout: Layout) {
  if (!letter) return undefined
  if (letter.length > 1) return undefined

  const left = leftCells(layout)
  const right = rightCells(layout)
  const keyMatrix = left.map((l, i) => l + right[i])

  const row = keyMatrix.findIndex(r => r.includes(letter))
  if (row == -1) return undefined
  const column = keyMatrix[row].indexOf(letter)
  const newRow = row + dy
  if (newRow < -1 || newRow >= keyMatrix.length) return undefined
  const newColumn = column + dx

  // Special handling for function keys
  if (newRow == -1 && newColumn >= 1 && newColumn <= 10) return 'F' + newColumn
  if (newRow == -1) return undefined

  if (newColumn < 0 || newColumn >= keyMatrix[newRow].length) return undefined
  if ((column < 5) != (newColumn < 5)) return undefined
  return keyMatrix[newRow][newColumn]
}

/**
 * Solves the maximum weight monotone matching problem in O(|X||C|).
 *
 * Let X be a totally ordered set of items and C a totally ordered set of categories.
 * The input is a weight matrix w where:
 *
 *   w[x][c] = score for assigning item x ∈ X to category c ∈ C.
 *
 * We seek an order-preserving partial matching M ⊆ X × C maximizing:
 *
 *   ∑(x,c)∈M w[x][c]
 *
 * subject to:
 *
 *   (x₁,c₁), (x₂,c₂) ∈ M  ⇒  x₁ < x₂ and c₁ < c₂
 *
 * (i.e., no crossing assignments; both indices must be strictly increasing).
 * Each item and category is used at most once; matches are not required to be exhaustive.
 */
export function monotoneMatching(weights: number[][]): Record<number, number> {
  const nItems = weights.length
  if (nItems === 0) return {}

  const nCats = weights[0].length

  // dp[i][j] = best score using items[i:] and categories[j:]
  const dp: number[][] = Array.from({ length: nItems + 1 }, () => Array(nCats + 1).fill(0))

  // Fill bottom-up
  for (let i = nItems - 1; i >= 0; i--) {
    for (let j = nCats - 1; j >= 0; j--) {
      const skipItem = dp[i + 1][j]
      const skipCat = dp[i][j + 1]
      const match = weights[i][j] + dp[i + 1][j + 1]

      dp[i][j] = Math.max(skipItem, skipCat, match)
    }
  }

  // Reconstruct mapping: category -> item
  const result: Record<number, number> = {}

  let i = 0 // item index
  let j = 0 // category index

  while (i < nItems && j < nCats) {
    const current = dp[i][j]

    if (dp[i + 1][j] === current) {
      i++ // skip item
    } else if (dp[i][j + 1] === current) {
      j++ // skip category
    } else {
      // match i <-> j
      result[i] = j
      i++
      j++
    }
  }

  return result
}

/** Find the indices of the alpha/letter columns within a finger cluster.
 *  Returns a mapping of layout column -> cluster column. */
export function alphaColumns(
  kbd: CosmosKeyboard,
  cluster: CosmosCluster,
) {
  const columns = cluster.clusters.map((col) => ({
    col: col,
    column: col.column ?? -1000,
    keys: col.keys,
    colType: col.partType.type,
  }))
  columns.sort((a, b) => a.column - b.column) // Sort by column

  const categories = transposeCells(cluster.side == 'left' ? leftCells(kbd.layout) : rightCells(kbd.layout))

  // Build weight matrix:
  // weights[x][c] = score(column x, category c)
  const weights = columns.map(col =>
    categories.map(letters =>
      col.keys.filter(k =>
        PART_INFO[k.partType.type || col.colType || kbd.partType.type!].keycap
        && k.profile.letter && letters.includes(k.profile.letter)
      ).length
    )
  )

  const matches = monotoneMatching(weights)
  return Object.fromEntries(Object.entries(matches).map(([x, c]) => [c, columns[Number(x)].col]))
}

/** Returns the best offset k so that the mapping keys[i] -> column[i + offset] yields the most similarities */
function bestColumnOffsetByFn<E>(kbd: CosmosKeyboard, col: CosmosCluster, column: E[], f: (key: CosmosKey) => E | null) {
  let bestMatches: E[] = []
  let bestOffset = 0
  for (let offset = -(column.length - 1); offset <= col.keys.length - 1; offset++) {
    let current: E[] = []
    for (let j = 0; j < Math.min(col.keys.length, column.length); j++) {
      const k = col.keys[j]
      if (j + offset < 0 || j + offset >= column.length) continue
      const result = f(k)
      if (result !== null && result == column[j + offset]) {
        current.push(result)
      }
    }
    if (current > bestMatches) {
      bestMatches = current
      bestOffset = offset
    }
  }
  return { offset: bestOffset, matches: bestMatches }
}

export const bestColumnOffsetByChar = (kbd: CosmosKeyboard, col: CosmosCluster, column: string) =>
  bestColumnOffsetByFn(kbd, col, column as any as string[], k =>
    PART_INFO[k.partType.type || col.partType.type || kbd.partType.type!].keycap && k.profile.letter && k.profile.letter !== ' '
      ? k.profile.letter
      : null)

export const bestColumnOffsetByRow = (kbd: CosmosKeyboard, col: CosmosCluster) =>
  bestColumnOffsetByFn(kbd, col, range(1, 6), k =>
    PART_INFO[k.partType.type || col.partType.type || kbd.partType.type!].keycap && typeof k.profile.row !== 'undefined'
      ? k.profile.row
      : null)

export function detectLayout(kbd: CosmosKeyboard): Layout {
  const fingerClusters = kbd.clusters.filter(c => c.name === 'fingers')
  if (fingerClusters.length === 0) return DEFAULT_LAYOUT

  const right = fingerClusters.find(c => c.side === 'right')
  const left = fingerClusters.find(c => c.side === 'left')
  const halves = [...fingerClusters]
  if (right && !left) halves.push(mirrorCluster(right, kbd))
  const alphas = halves.map(h => alphaColumns(kbd, h))

  let bestLayout = DEFAULT_LAYOUT
  let bestScore = -1

  for (const layout of objKeys(LAYOUTS)) {
    let score = 0
    halves.forEach((cluster, j) => {
      const categories = transposeCells(cluster.side == 'left' ? leftCells(layout) : rightCells(layout))
      for (const [k, col] of objEntries(alphas[j])) {
        const { matches } = bestColumnOffsetByChar(kbd, col, categories[k as number])
        score += matches.length
      }
    })
    // Prioritize matching the configured layout
    if (score > bestScore || (score == bestScore && layout == kbd.layout)) {
      bestScore = score
      bestLayout = layout
    }
  }
  return bestLayout
}

/** Per-position diff between the kbd and a target named layout. Used by the
 *  layout-completeness indicator next to the dropdown.
 *    `impossible` — the char's hypothetical position has no keycap socket on
 *                   this keyboard (e.g. an outer column or number row the user
 *                   removed), so the char can't be placed at all.
 *    `missing`    — the position *does* have a keycap socket, but no key there
 *                   carries the expected letter (it could be added).
 *    `mismatched` — the expected letter exists somewhere on the keyboard, just
 *                   not where this layout expects it.
 *  Mirror form synthesizes the left half so deleting one alpha key on a
 *  mirrored split surfaces both halves' letters. */
export function layoutDiff(kbd: CosmosKeyboard, layout: Layout) {
  const fingerClusters = kbd.clusters.filter(c => c.name === 'fingers')
  if (fingerClusters.length === 0) return { impossible: [], missing: [], mismatched: [] }

  const right = fingerClusters.find(c => c.side === 'right')
  const left = fingerClusters.find(c => c.side === 'left')
  const halves = [...fingerClusters]
  if (right && !left) halves.push(mirrorCluster(right, kbd))

  const alphas = halves.map(c => alphaColumns(kbd, c))
  return layoutDiffImpl(kbd, halves, alphas, layout)
}

export function diffAllLayouts(kbd: CosmosKeyboard) {
  const fingerClusters = kbd.clusters.filter(c => c.name === 'fingers')
  if (fingerClusters.length === 0) return {}

  const right = fingerClusters.find(c => c.side === 'right')
  const left = fingerClusters.find(c => c.side === 'left')
  const halves = [...fingerClusters]
  if (right && !left) halves.push(mirrorCluster(right, kbd))

  const alphas = halves.map(c => alphaColumns(kbd, c))
  const results: Record<string, { impossible: string[]; missing: string[]; mismatched: string[] }> = {}
  for (const [layout, data] of objEntries(LAYOUTS)) {
    const result = layoutDiffImpl(kbd, halves, alphas, layout)
    for (const language of data.languages) {
      results[language.name] = result
    }
  }
  return results
}

/** Whether a keycap socket backs column-string position `idx` in `col`, given
 *  the alignment offset (keys[j] ↔ column[j + offset], so row idx ↔ keys[idx - offset]). */
function hasSocketAt(kbd: CosmosKeyboard, col: CosmosCluster | undefined, offset: number, idx: number): boolean {
  if (!col) return false
  const key = col.keys[idx - offset]
  if (!key) return false
  return !!PART_INFO[key.partType.type || col.partType.type || kbd.partType.type!].keycap
}

function layoutDiffImpl(kbd: CosmosKeyboard, halves: CosmosCluster[], alphas: Record<number, CosmosCluster>[], layout: Layout): { impossible: string[]; missing: string[]; mismatched: string[] } {
  const impossible = new Set<string>()
  const missing = new Set<string>()
  const mismatched = new Set<string>()

  halves.forEach((cluster, clIndex) => {
    let allMatches: string[] = []
    const allChars = new Set<string>()

    const categories = transposeCells(cluster.side == 'left' ? leftCells(layout) : rightCells(layout))
    for (const col of cluster.clusters) {
      for (const k of col.keys) {
        if (
          PART_INFO[k.partType.type || col.partType.type || kbd.partType.type!].keycap
          && k.profile.letter
        ) allChars.add(k.profile.letter)
      }
    }
    // Align each physical column with its layout column and remember the offset
    // so we can later tell whether a given row actually has a key behind it.
    const offsets: Record<number, number> = {}
    for (const [i, col] of objEntries(alphas[clIndex])) {
      const { offset, matches } = bestColumnOffsetByChar(kbd, col, categories[i])
      offsets[i] = offset
      allMatches = allMatches.concat(matches)
    }

    categories.forEach((col, i) => {
      for (let idx = 0; idx < col.length; idx++) {
        const char = col[idx]
        if (char == ' ') continue
        if (allMatches.includes(char)) continue
        if (allChars.has(char)) {
          mismatched.add(char)
        } else if (hasSocketAt(kbd, alphas[clIndex][i], offsets[i], idx)) {
          missing.add(char)
        } else {
          impossible.add(char)
        }
      }
    })
  })

  return { impossible: [...impossible], missing: [...missing], mismatched: [...mismatched] }
}

function mapClusters<T extends CosmosCluster | CosmosKeyboard>(c: T, fn: (c: CosmosCluster, i: number) => CosmosCluster): T {
  return { ...c, clusters: c.clusters.map(fn) }
}

export function applyLayoutToKeys(kbd: CosmosKeyboard, layoutId: Layout): CosmosKeyboard {
  const newKbd = mapClusters(kbd, cluster => {
    if (cluster.name !== 'fingers') return cluster
    const alphas = alphaColumns(kbd, cluster)
    const N = Object.keys(alphas).length
    if (N === 0) return cluster
    // Cells are side-aware: leftCells already holds the left-half letters, so
    // no flipping is needed (replaces the old rightCells + flipLetter hack).
    const cells = transposeCells(cluster.side === 'left' ? leftCells(layoutId) : rightCells(layoutId))
    return mapClusters(cluster, (col) => {
      const alphaEntry = Object.entries(alphas).find(([, v]) => v == col)
      if (!alphaEntry) return col
      const column = cells[Number(alphaEntry[0])]

      let { offset, matches } = bestColumnOffsetByChar(kbd, col, column)
      if (matches.length == 0) offset = bestColumnOffsetByRow(kbd, col).offset
      return {
        ...col,
        keys: col.keys.map((k, j) => {
          const idx = j + offset
          if (idx < 0 || idx >= column.length) return k
          const letter = column[idx]
          if (!letter || letter === ' ') return k
          return { ...k, profile: { ...k.profile, letter } }
        }),
      }
    })
  })
  newKbd.layout = layoutId
  return newKbd
}
