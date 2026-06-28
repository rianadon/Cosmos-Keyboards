import type { Language } from '$lib/geometry/layouts'
import type { FullGeometry } from '$lib/worker/config'
import { describe, expect, test } from 'bun:test'
import { keycode as zmkKeycode, unmappableKeys as zmkUnmappable } from './zmk'

const english: Language = { name: 'English', qmk: '', zmk: '', tag: 'en' }
const swedish: Language = { name: 'Swedish', qmk: 'swedish', zmk: 'sv', tag: 'sv' }
const german: Language = { name: 'German', qmk: 'german', zmk: 'de', tag: 'de' }

describe('ZMK Keycode', () => {
  test('Locale substitution prefixes &kp', () => {
    expect(zmkKeycode('y', german)).toBe('&kp DE_Y')
    expect(zmkKeycode('ß', german)).toBe('&kp DE_SHARP_S')
    expect(zmkKeycode('enter', german)).toBe('&kp ENTER')
  })

  test('No locale maps correctly', () => {
    expect(zmkKeycode('a')).toBe('&kp A')
    // Raw bindings pass through untouched.
    expect(zmkKeycode('&mo 1')).toBe('&mo 1')
    expect(zmkKeycode('ß', english)).toBe('&kp SPACE')
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
    expect(zmkUnmappable(geo, english)).toEqual(['ä'])
    expect(zmkUnmappable(geo, swedish)).toEqual([])
  })

  test('Returns distinct letters', () => {
    const geo = geoWith('ä', 'ä', 'a')
    expect(zmkUnmappable(geo, english)).toEqual(['ä'])
  })
})
