import { expect, test } from 'bun:test'
import { isAlphaPlaceholder, MIRYOKU_KEYMAP, MIRYOKU_SLOTS } from './miryoku'
import { keyActionToQmk } from './qmkEmit'
import { keyActionToZmk } from './zmkEmit'

test('keyActionToZmk: kp', () => {
  expect(keyActionToZmk({ kind: 'kp', code: 'ESC' })).toBe('&kp ESC')
  expect(keyActionToZmk({ kind: 'kp', code: 'BOOT' })).toBe('&bootloader')
  expect(keyActionToZmk({ kind: 'kp', code: 'CAPS' })).toBe('&caps_word')
  expect(keyActionToZmk({ kind: 'kp', code: '__ALPHA__' }, 'Q')).toBe('&kp Q')
})

test('keyActionToZmk: mt', () => {
  expect(keyActionToZmk({ kind: 'mt', mod: 'LSHFT', tap: '__ALPHA__' }, 'A')).toBe('&mt LSHFT A')
})

test('keyActionToZmk: lt/osm/osl/trans/none', () => {
  expect(keyActionToZmk({ kind: 'lt', layer: 1, tap: 'SPACE' })).toBe('&lt 1 SPACE')
  expect(keyActionToZmk({ kind: 'osm', mod: 'LSHFT' })).toBe('&sk LSHFT')
  expect(keyActionToZmk({ kind: 'osl', layer: 2 })).toBe('&sl 2')
  expect(keyActionToZmk({ kind: 'trans' })).toBe('&trans')
  expect(keyActionToZmk({ kind: 'none' })).toBe('&none')
})

test('keyActionToQmk: kp codes', () => {
  expect(keyActionToQmk({ kind: 'kp', code: 'ESC' })).toBe('KC_ESC')
  expect(keyActionToQmk({ kind: 'kp', code: 'BSPC' })).toBe('KC_BSPC')
  expect(keyActionToQmk({ kind: 'kp', code: 'RET' })).toBe('KC_ENT')
  expect(keyActionToQmk({ kind: 'kp', code: 'SPACE' })).toBe('KC_SPC')
  expect(keyActionToQmk({ kind: 'kp', code: 'CAPS' })).toBe('KC_QK_CAPS_WORD_TOGGLE')
  expect(keyActionToQmk({ kind: 'kp', code: '__ALPHA__' }, 'Q')).toBe('KC_Q')
})

test('keyActionToQmk: mt/lt/osm/osl/trans/none', () => {
  expect(keyActionToQmk({ kind: 'mt', mod: 'LSHFT', tap: '__ALPHA__' }, 'A')).toBe('MT(MOD_LSFT, KC_A)')
  expect(keyActionToQmk({ kind: 'lt', layer: 1, tap: 'SPACE' })).toBe('LT(1, KC_SPC)')
  expect(keyActionToQmk({ kind: 'osm', mod: 'LSHFT' })).toBe('OSM(MOD_LSFT)')
  expect(keyActionToQmk({ kind: 'osl', layer: 2 })).toBe('OSL(2)')
  expect(keyActionToQmk({ kind: 'trans' })).toBe('KC_TRNS')
  expect(keyActionToQmk({ kind: 'none' })).toBe('KC_NO')
})

test('MIRYOKU_SLOTS has 36 entries', () => {
  expect(MIRYOKU_SLOTS.length).toBe(36)
})

test('MIRYOKU_KEYMAP BASE has all 36 slots', () => {
  expect(Object.keys(MIRYOKU_KEYMAP.BASE).length).toBe(36)
})

test('MIRYOKU_KEYMAP BASE alpha slots are placeholders', () => {
  expect(isAlphaPlaceholder(MIRYOKU_KEYMAP.BASE.L00!)).toBe(true)
  expect(isAlphaPlaceholder(MIRYOKU_KEYMAP.BASE.R00!)).toBe(true)
})

test('MIRYOKU_KEYMAP BASE home-row mods: right col0=alpha col1=LSHFT', () => {
  const base = MIRYOKU_KEYMAP.BASE
  expect(base.R10?.kind).toBe('kp') // inner index = plain alpha
  expect(base.R11?.kind).toBe('mt') // index home = LSHFT mod-tap
  if (base.R11?.kind === 'mt') expect(base.R11.mod).toBe('LSHFT')
})

test('MIRYOKU_KEYMAP BASE home-row mods: left col3=LSHFT col4=alpha', () => {
  const base = MIRYOKU_KEYMAP.BASE
  expect(base.L14?.kind).toBe('kp') // inner index = plain alpha
  expect(base.L13?.kind).toBe('mt') // index home = LSHFT
  if (base.L13?.kind === 'mt') expect(base.L13.mod).toBe('LSHFT')
})

test('MIRYOKU_KEYMAP BASE thumbs are layer-taps', () => {
  const base = MIRYOKU_KEYMAP.BASE
  expect(base.LT0?.kind).toBe('lt')
  expect(base.LT1?.kind).toBe('lt')
  expect(base.LT2?.kind).toBe('lt')
  expect(base.RT0?.kind).toBe('lt')
  expect(base.RT1?.kind).toBe('lt')
  expect(base.RT2?.kind).toBe('lt')
})

test('MIRYOKU_KEYMAP NAV has bootloader on L00', () => {
  expect(MIRYOKU_KEYMAP.NAV.L00).toEqual({ kind: 'kp', code: 'BOOT' })
})

test('MIRYOKU_KEYMAP NUM/SYM/FUN home row has same RHS mods', () => {
  // Right home-row mods (cols 1-4, ascending = SHIFT, CTRL, ALT, GUI) appear on
  // every layer that has them, so layered hold-modifiers work consistently.
  for (const layerName of ['NUM', 'SYM', 'FUN'] as const) {
    const layer = MIRYOKU_KEYMAP[layerName]
    // Right pinky col (R14) on home row should be GUI on these layers
    expect(layer.R14).toEqual({ kind: 'kp', code: 'LGUI' })
    expect(layer.R13).toEqual({ kind: 'kp', code: 'LALT' })
    expect(layer.R12).toEqual({ kind: 'kp', code: 'LCTRL' })
    expect(layer.R11).toEqual({ kind: 'kp', code: 'LSHFT' })
  }
})

test('keyActionToZmk handles Miryoku NAV layer mt placeholder', () => {
  // Spot check: NAV row 1 col 0 should be plain LGUI tap
  const action = MIRYOKU_KEYMAP.NAV.L10!
  expect(keyActionToZmk(action)).toBe('&kp LGUI')
})

test('keyActionToQmk: combined modifier syntax LC(LALT)', () => {
  // ZMK: LC(LALT) → QMK: C(KC_LALT)
  expect(keyActionToQmk({ kind: 'kp', code: 'LC(LALT)' })).toBe('C(KC_LALT)')
})

test('keyActionToQmk: function keys pass through', () => {
  expect(keyActionToQmk({ kind: 'kp', code: 'F12' })).toBe('KC_F12')
  expect(keyActionToZmk({ kind: 'kp', code: 'F12' })).toBe('&kp F12')
})

test('keyActionToZmk: number codes (N0..N9)', () => {
  expect(keyActionToZmk({ kind: 'kp', code: 'N7' })).toBe('&kp N7')
})

test('keyActionToQmk: number codes translate N7 → 7', () => {
  expect(keyActionToQmk({ kind: 'kp', code: 'N7' })).toBe('KC_7')
})

test('keyActionToQmk: punctuation alpha → KC_<name>, never KC_<char>', () => {
  // The bug we hit shipping: when a slot resolves __ALPHA__ to `;` etc., the
  // generator emitted KC_; literally — invalid C. Each char must map to a
  // valid QMK keycode short-name.
  const cases: Record<string, string> = {
    ';': 'KC_SCLN',
    '/': 'KC_SLSH',
    '[': 'KC_LBRC',
    ']': 'KC_RBRC',
    "'": 'KC_QUOT',
    ',': 'KC_COMM',
    '.': 'KC_DOT',
    '`': 'KC_GRV',
    '-': 'KC_MINS',
    '=': 'KC_EQL',
    '\\': 'KC_BSLS',
  }
  for (const [char, expected] of Object.entries(cases)) {
    expect(keyActionToQmk({ kind: 'kp', code: '__ALPHA__' }, char)).toBe(expected)
    expect(keyActionToQmk({ kind: 'mt', mod: 'LSHFT', tap: '__ALPHA__' }, char)).toBe(`MT(MOD_LSFT, ${expected})`)
  }
})

test('keyActionToZmk: punctuation alpha → &kp <NAME>, never &kp <char>', () => {
  const cases: Record<string, string> = {
    ';': '&kp SEMI',
    '/': '&kp FSLH',
    '[': '&kp LBKT',
    ']': '&kp RBKT',
    "'": '&kp SQT',
    ',': '&kp COMMA',
    '.': '&kp DOT',
    '`': '&kp GRAVE',
    '-': '&kp MINUS',
    '=': '&kp EQUAL',
    '\\': '&kp BSLH',
  }
  for (const [char, expected] of Object.entries(cases)) {
    expect(keyActionToZmk({ kind: 'kp', code: '__ALPHA__' }, char)).toBe(expected)
  }
  // mt with punctuation tap
  expect(keyActionToZmk({ kind: 'mt', mod: 'LSHFT', tap: '__ALPHA__' }, ';')).toBe('&mt LSHFT SEMI')
})
