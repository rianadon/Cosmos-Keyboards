import type { Language } from '$lib/geometry/layouts'
import { describe, expect, test } from 'bun:test'
import type { FullGeometry } from '../viewers/viewer3dHelpers'
import { keycode as qmkKeycode, unmappableKeys as qmkUnmappable } from './qmk'

const english: Language = { name: 'English', qmk: '', zmk: '', tag: 'en' }
const swedish: Language = { name: 'Swedish', qmk: 'swedish', zmk: 'se', tag: 'sv' }

describe('QMK Keycode', () => {
  test('locale substitution', () => {
    // Basic letters and digits route through the locale table (non-US layouts remap them).
    expect(qmkKeycode('a', swedish)).toBe('SE_A')
    // Accented characters the locale defines.
    expect(qmkKeycode('ä', swedish)).toBe('SE_ADIA')
    // Special keys aren't in the locale table — they fall through to the generic mapping.
    expect(qmkKeycode('enter', swedish)).toBe('KC_ENTER')
  })

  test('No locale maps correctly', () => {
    expect(qmkKeycode('a')).toBe('KC_A')
    expect(qmkKeycode('a', english)).toBe('KC_A')
    // Raw codes pass through untouched.
    expect(qmkKeycode('KC_VOLU')).toBe('KC_VOLU')
    // A character that can't be represented without a locale falls back to a blank key.
    expect(qmkKeycode('ä', english)).toBe('KC_SPACE')
  })
})

/** Minimal geometry with three matrix keys on the right half. */
function geoWith(...letters: string[]): FullGeometry {
  const keys = letters.map((letter) => ({
    type: 'mx-better',
    cluster: 'fingers',
    position: { history: [] },
    aspect: 1,
    keycap: { profile: 'xda', row: 1, letter },
  }))
  return { right: { c: { keys } } } as unknown as FullGeometry
}

describe('Unmappable keys', () => {
  test('Flags characters with no representation', () => {
    const geo = geoWith('a', 'ä', 'enter')
    expect(qmkUnmappable(geo, english)).toEqual(['ä'])
    expect(qmkUnmappable(geo, swedish)).toEqual([])
  })

  test('Returns distinct letters', () => {
    const geo = geoWith('ä', 'ä', 'a')
    expect(qmkUnmappable(geo, english)).toEqual(['ä'])
  })
})
