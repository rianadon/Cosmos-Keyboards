import defaultConfig from '$assets/cuttleform.json' assert { type: 'json' }
import { describe, expect, test } from 'bun:test'
import { cuttleConf } from '../worker/config'
import { toCosmosConfig } from '../worker/config.cosmos'
import { objKeys } from '../worker/util'
import { DEFAULT_LAYOUT, detectLayout, LAYOUTS, lettersToFingers, monotoneMatching, relayout } from './layouts'

describe('Detect Layout', () => {
  test('Default configuration is qwerty', () => {
    const config = cuttleConf(defaultConfig.options as any)
    const cosmos = toCosmosConfig(config, 'right', true)
    const layout = detectLayout(cosmos)
    expect(layout).toBe('qwerty')
  })
})

describe('Relayout', () => {
  // The sentence the hand simulation types.
  const SENTENCE = 'pink,plum;youlhuminjoy.'

  test('is the identity on qwerty', () => {
    expect(relayout(SENTENCE, DEFAULT_LAYOUT, 'qwerty')).toBe(SENTENCE)
  })

  test('moves letters to whatever sits at the same physical key', () => {
    // On dvorak, the qwerty home keys j, k, l are lettered h, t, n.
    expect(relayout('jkl', DEFAULT_LAYOUT, 'dvorak')).toBe('htn')
    // Only the letters change on azerty: q and a swap places, w and z swap places.
    expect(relayout('qwaz', DEFAULT_LAYOUT, 'azerty_fr')).toBe('azqw')
    expect(relayout(SENTENCE, DEFAULT_LAYOUT, 'dvorak')).toBe('lcbtwlngmsfrgndgmcbhrfv')
  })

  test('presses the same physical keys, so the same fingers type in the same order', () => {
    const fingersOf = (layout: Parameters<typeof relayout>[1]) => {
      const fingers = lettersToFingers(layout)
      return Array.from(relayout(SENTENCE, DEFAULT_LAYOUT, layout)).map(letter => fingers[letter])
    }
    expect(fingersOf('dvorak')).toEqual(fingersOf('qwerty'))
    expect(fingersOf('azerty_fr')).toEqual(fingersOf('qwerty'))
    expect(fingersOf('turkish_f')).toEqual(fingersOf('qwerty'))
  })

  test('drops characters that name no physical key', () => {
    // é isn't on a qwerty board, and a space isn't a key of the layout grid at all.
    expect(relayout('h é', DEFAULT_LAYOUT, 'dvorak')).toBe('d')
  })

  test('translates every key of the grid, in every layout', () => {
    const keys = Array.from(LAYOUTS[DEFAULT_LAYOUT].layout).filter(l => l != ' ' && l != '\n')
    for (const layout of objKeys(LAYOUTS)) {
      expect([layout, relayout(keys.join(''), DEFAULT_LAYOUT, layout).length]).toEqual([layout, keys.length])
    }
  })
})

describe('Monotone Matching', () => {
  test('returns empty mapping for empty input', () => {
    expect(monotoneMatching([])).toEqual({})
  })

  test('matches optimal single best assignment (no forced full matching)', () => {
    expect(monotoneMatching([
      [10, 1],
      [1, 10],
    ])).toEqual({ 0: 0, 1: 1 })
  })

  test('chooses higher single match over full weak matching', () => {
    expect(monotoneMatching([
      [1, 100],
      [1000, 1],
    ])).toEqual({ 1: 0 })
  })

  test('skips items when beneficial', () => {
    expect(monotoneMatching([
      [1, 100, 1],
      [1, 1, 100],
    ])).toEqual({ 0: 1, 1: 2 })
  })

  test('skips categories when beneficial', () => {
    expect(monotoneMatching([
      [1, 1],
      [100, 1],
      [1, 100],
    ])).toEqual({ 1: 0, 2: 1 })
  })

  test('preserves monotonicity even when skipping is required', () => {
    const result = monotoneMatching([
      [1, 50, 1],
      [1, 1, 1],
      [1, 1, 100],
    ])

    const pairs = Object.entries(result)
      .map(([x, c]) => ({ x: Number(x), c }))
      .sort((a, b) => a.x - b.x)

    for (let i = 1; i < pairs.length; i++) {
      expect(pairs[i].c).toBeGreaterThan(pairs[i - 1].c)
    }

    expect(result).toEqual({ 0: 1, 2: 2 })
  })

  test('returns a valid monotone matching (not necessarily full)', () => {
    const result = monotoneMatching([
      [5, 1, 1, 1],
      [1, 5, 1, 1],
      [1, 1, 5, 1],
    ])

    const pairs = Object.entries(result)
      .map(([x, c]) => ({ x: Number(x), c }))
      .sort((a, b) => a.x - b.x)

    for (let i = 1; i < pairs.length; i++) {
      expect(pairs[i].c).toBeGreaterThan(pairs[i - 1].c)
    }
  })

  test('handles single category', () => {
    expect(monotoneMatching([[1, 10, 5]])).toEqual({ 0: 1 })
  })

  test('handles single item', () => {
    expect(monotoneMatching([[1], [10], [5]])).toEqual({ 1: 0 })
  })

  test('never produces crossing matches', () => {
    const result = monotoneMatching([
      [1, 100, 1, 1],
      [1, 1, 100, 1],
      [1, 1, 1, 100],
    ])

    const pairs = Object.entries(result)
      .map(([x, c]) => ({ x: Number(x), c }))
      .sort((a, b) => a.x - b.x)

    for (let i = 1; i < pairs.length; i++) {
      expect(pairs[i].c).toBeGreaterThan(pairs[i - 1].c)
    }
  })
})
