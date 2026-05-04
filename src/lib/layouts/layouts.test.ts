import { expect, test } from 'bun:test'
import { DEFAULT_LAYOUT, flipLetter, getLayout, isAlphaLetter, isLayoutId, isNamedLayoutId, LAYOUT, LAYOUT_IDS, LAYOUT_NAMES, NAMED_LAYOUT_IDS, rightSideLetter } from './index'

test('DEFAULT_LAYOUT is QWERTY', () => {
  expect(DEFAULT_LAYOUT).toBe(LAYOUT.QWERTY)
})

test('NAMED_LAYOUT_IDS contains all five concrete layouts (no CUSTOM)', () => {
  expect(NAMED_LAYOUT_IDS).toEqual([
    LAYOUT.QWERTY,
    LAYOUT.COLEMAK,
    LAYOUT.COLEMAK_DH,
    LAYOUT.DVORAK,
    LAYOUT.WORKMAN,
  ])
  expect(NAMED_LAYOUT_IDS).not.toContain(LAYOUT.CUSTOM)
})

test('LAYOUT_IDS includes CUSTOM as the last option', () => {
  expect(LAYOUT_IDS).toEqual([
    LAYOUT.QWERTY,
    LAYOUT.COLEMAK,
    LAYOUT.COLEMAK_DH,
    LAYOUT.DVORAK,
    LAYOUT.WORKMAN,
    LAYOUT.CUSTOM,
  ])
})

test('LAYOUT_NAMES has a label for every layout id', () => {
  for (const id of LAYOUT_IDS) {
    expect(LAYOUT_NAMES[id]).toBeTruthy()
  }
  expect(LAYOUT_NAMES[LAYOUT.CUSTOM]).toBe('Custom')
})

test('isNamedLayoutId distinguishes CUSTOM from real layouts', () => {
  expect(isNamedLayoutId(LAYOUT.QWERTY)).toBe(true)
  expect(isNamedLayoutId(LAYOUT.COLEMAK_DH)).toBe(true)
  expect(isNamedLayoutId(LAYOUT.CUSTOM)).toBe(false)
  expect(isNamedLayoutId(undefined)).toBe(false)
  expect(isNamedLayoutId(null)).toBe(false)
})

test('isLayoutId accepts CUSTOM', () => {
  expect(isLayoutId(LAYOUT.CUSTOM)).toBe(true)
  expect(isLayoutId('custom')).toBe(true)
})

test('getLayout(CUSTOM) falls back to QWERTY', () => {
  expect(getLayout(LAYOUT.CUSTOM).id).toBe(LAYOUT.QWERTY)
})

test('isLayoutId rejects unknown values', () => {
  expect(isLayoutId('qwerty')).toBe(true)
  expect(isLayoutId('colemak')).toBe(true)
  expect(isLayoutId('hjkl')).toBe(false)
  expect(isLayoutId(undefined)).toBe(false)
  expect(isLayoutId(null)).toBe(false)
})

test('getLayout falls back to QWERTY for invalid input', () => {
  expect(getLayout(undefined).id).toBe(LAYOUT.QWERTY)
  expect(getLayout(null).id).toBe(LAYOUT.QWERTY)
})

test('rightSideLetter returns correct QWERTY letters', () => {
  expect(rightSideLetter(2, 0, LAYOUT.QWERTY)).toBe('y')
  expect(rightSideLetter(3, 0, LAYOUT.QWERTY)).toBe('h')
  expect(rightSideLetter(3, 5, LAYOUT.QWERTY)).toBe("'")
  expect(rightSideLetter(4, 4, LAYOUT.QWERTY)).toBe('/')
})

test('rightSideLetter returns correct Colemak letters', () => {
  expect(rightSideLetter(2, 0, LAYOUT.COLEMAK)).toBe('j')
  expect(rightSideLetter(3, 1, LAYOUT.COLEMAK)).toBe('n')
  expect(rightSideLetter(3, 4, LAYOUT.COLEMAK)).toBe('o')
})

test('rightSideLetter returns correct Colemak-DH letters', () => {
  expect(rightSideLetter(3, 0, LAYOUT.COLEMAK_DH)).toBe('m')
  expect(rightSideLetter(4, 0, LAYOUT.COLEMAK_DH)).toBe('k')
  expect(rightSideLetter(4, 1, LAYOUT.COLEMAK_DH)).toBe('h')
})

test('rightSideLetter returns correct Dvorak letters', () => {
  expect(rightSideLetter(2, 0, LAYOUT.DVORAK)).toBe('f')
  expect(rightSideLetter(3, 2, LAYOUT.DVORAK)).toBe('t')
  expect(rightSideLetter(4, 0, LAYOUT.DVORAK)).toBe('b')
})

test('rightSideLetter returns correct Workman letters', () => {
  expect(rightSideLetter(2, 1, LAYOUT.WORKMAN)).toBe('f')
  expect(rightSideLetter(3, 1, LAYOUT.WORKMAN)).toBe('n')
  expect(rightSideLetter(4, 0, LAYOUT.WORKMAN)).toBe('k')
})

test('rightSideLetter returns undefined for non-alpha rows', () => {
  expect(rightSideLetter(0, 0, LAYOUT.COLEMAK)).toBeUndefined()
  expect(rightSideLetter(1, 0, LAYOUT.COLEMAK)).toBeUndefined()
  expect(rightSideLetter(5, 0, LAYOUT.COLEMAK)).toBeUndefined()
})

test('flipLetter is bidirectional within a layout', () => {
  expect(flipLetter('y', LAYOUT.QWERTY)).toBe('t')
  expect(flipLetter('t', LAYOUT.QWERTY)).toBe('y')
  expect(flipLetter('h', LAYOUT.COLEMAK)).toBe('d')
  expect(flipLetter('d', LAYOUT.COLEMAK)).toBe('h')
})

test('flipLetter passes through letters not in the flip map', () => {
  expect(flipLetter('1', LAYOUT.QWERTY)).toBe('1')
  expect(flipLetter('F1', LAYOUT.QWERTY)).toBe('F1')
})

test('flipLetter handles undefined gracefully', () => {
  expect(flipLetter(undefined, LAYOUT.QWERTY)).toBeUndefined()
})

test('isAlphaLetter recognizes alpha-row letters across all layouts', () => {
  // QWERTY right rows
  expect(isAlphaLetter('y')).toBe(true)
  expect(isAlphaLetter('h')).toBe(true)
  expect(isAlphaLetter('n')).toBe(true)
  // QWERTY left (via flipMap values)
  expect(isAlphaLetter('t')).toBe(true)
  expect(isAlphaLetter('a')).toBe(true)
  expect(isAlphaLetter('z')).toBe(true)
  // Punctuation that participates in some layout's alpha row
  expect(isAlphaLetter(';')).toBe(true)
  expect(isAlphaLetter(',')).toBe(true)
  expect(isAlphaLetter('/')).toBe(true)
  expect(isAlphaLetter("'")).toBe(true)
})

test('isAlphaLetter rejects row-5 outer punctuation', () => {
  // The bug from PR #87: keycapInfo() collapses row 5 → 4 for keycap profile
  // reasons, so a row-based filter wrongly catches these letters.
  expect(isAlphaLetter('[')).toBe(false)
  expect(isAlphaLetter(']')).toBe(false)
  expect(isAlphaLetter('{')).toBe(false)
  expect(isAlphaLetter('}')).toBe(false)
  expect(isAlphaLetter('\\')).toBe(false)
})

test('isAlphaLetter rejects number-row and F-row legends', () => {
  expect(isAlphaLetter('1')).toBe(false)
  expect(isAlphaLetter('5')).toBe(false)
  expect(isAlphaLetter('F1')).toBe(false)
})

test('isAlphaLetter handles empty/undefined', () => {
  expect(isAlphaLetter(undefined)).toBe(false)
  expect(isAlphaLetter('')).toBe(false)
})
