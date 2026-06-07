/**
 * Tests for BCP 47 library.
 *
 * Adapted from https://github.com/wooorm/bcp-47
 *
 * MIT license:
 * Copyright (c) 2016 Titus Wormer <tituswormer@gmail.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * 'Software'), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import { expect, test } from 'bun:test'
import { parse } from './bcp'

test('.parse()', () => {
  expect(parse('i-klingon')).toEqual({
    language: 'tlh',
    extendedLanguageSubtags: [],
    script: null,
    region: null,
    variants: [],
    extensions: [],
    privateuse: [],
    irregular: null,
    regular: null,
  })

  expect(parse('i-klingon', { normalize: false })).toEqual({
    language: null,
    extendedLanguageSubtags: [],
    script: null,
    region: null,
    variants: [],
    extensions: [],
    privateuse: [],
    irregular: 'i-klingon',
    regular: null,
  })

  expect(parse('i-default')).toEqual({
    language: null,
    extendedLanguageSubtags: [],
    script: null,
    region: null,
    variants: [],
    extensions: [],
    privateuse: [],
    irregular: 'i-default',
    regular: null,
  })

  expect(parse('zh-min')).toEqual({
    language: null,
    extendedLanguageSubtags: [],
    script: null,
    region: null,
    variants: [],
    extensions: [],
    privateuse: [],
    irregular: null,
    regular: 'zh-min',
  })
})

test('Too long variant', () => {
  const fixture = 'en-GB-abcdefghi'

  expect(parse(fixture, { warning })).toEqual({
    language: null,
    extendedLanguageSubtags: [],
    script: null,
    region: null,
    variants: [],
    extensions: [],
    privateuse: [],
    irregular: null,
    regular: null,
  })

  function warning() {
    expect(arguments[0]).toBe(
      'Too long variant, expected at most 8 characters',
    )
    expect(arguments[1]).toBe(1)
    expect(arguments[2]).toBe(14)
    expect(arguments.length).toBe(3)
  }

  expect(parse(fixture, { forgiving: true })).toEqual({
    language: 'en',
    extendedLanguageSubtags: [],
    script: null,
    region: 'GB',
    variants: [],
    extensions: [],
    privateuse: [],
    irregular: null,
    regular: null,
  })
})

test('Too many subtags', () => {
  const fixture = 'aa-bbb-ccc-ddd-eee'

  expect(parse(fixture, { warning })).toEqual({
    language: null,
    extendedLanguageSubtags: [],
    script: null,
    region: null,
    variants: [],
    extensions: [],
    privateuse: [],
    irregular: null,
    regular: null,
  })

  function warning() {
    expect(arguments[0]).toBe(
      'Too many extended language subtags, expected at most 3 subtags',
    )
    expect(arguments[1]).toBe(3)
    expect(arguments[2]).toBe(14)
    expect(arguments.length).toBe(3)
  }

  expect(parse(fixture, { forgiving: true })).toEqual({
    language: 'aa',
    extendedLanguageSubtags: ['bbb', 'ccc', 'ddd'],
    script: null,
    region: null,
    variants: [],
    extensions: [],
    privateuse: [],
    irregular: null,
    regular: null,
  })
})

await test('Too long extension', () => {
  const fixture = 'en-i-abcdefghi'

  expect(parse(fixture, { warning })).toEqual({
    language: null,
    extendedLanguageSubtags: [],
    script: null,
    region: null,
    variants: [],
    extensions: [],
    privateuse: [],
    irregular: null,
    regular: null,
  })

  function warning() {
    expect(arguments[0]).toBe(
      'Too long extension, expected at most 8 characters',
    )
    expect(arguments[1]).toBe(2)
    expect(arguments[2]).toBe(13)
    expect(arguments.length).toBe(3)
  }

  expect(parse(fixture, { forgiving: true })).toEqual({
    language: 'en',
    extendedLanguageSubtags: [],
    script: null,
    region: null,
    variants: [],
    extensions: [],
    privateuse: [],
    irregular: null,
    regular: null,
  })
})

test('Empty extension', () => {
  const fixture = 'en-i-a'

  expect(parse(fixture, { warning })).toEqual({
    language: null,
    extendedLanguageSubtags: [],
    script: null,
    region: null,
    variants: [],
    extensions: [],
    privateuse: [],
    irregular: null,
    regular: null,
  })

  function warning() {
    expect(arguments[0]).toBe(
      'Empty extension, extensions must have at least 2 characters of content',
    )
    expect(arguments[1]).toBe(4)
    expect(arguments[2]).toBe(4)
    expect(arguments.length).toBe(3)
  }

  expect(parse(fixture, { forgiving: true })).toEqual({
    language: 'en',
    extendedLanguageSubtags: [],
    script: null,
    region: null,
    variants: [],
    extensions: [],
    privateuse: [],
    irregular: null,
    regular: null,
  })
})

test('Too long private-use', () => {
  const fixture = 'en-x-abcdefghi'

  expect(parse(fixture, { warning })).toEqual({
    language: null,
    extendedLanguageSubtags: [],
    script: null,
    region: null,
    variants: [],
    extensions: [],
    privateuse: [],
    irregular: null,
    regular: null,
  })

  function warning() {
    expect(arguments[0]).toBe(
      'Too long private-use area, expected at most 8 characters',
    )
    expect(arguments[1]).toBe(5)
    expect(arguments[2]).toBe(13)
    expect(arguments.length).toBe(3)
  }

  expect(parse(fixture, { forgiving: true })).toEqual({
    language: 'en',
    extendedLanguageSubtags: [],
    script: null,
    region: null,
    variants: [],
    extensions: [],
    privateuse: [],
    irregular: null,
    regular: null,
  })
})

test('Extra content', () => {
  const fixture = 'abcdefghijklmnopqrstuvwxyz'

  expect(parse(fixture, { warning })).toEqual({
    language: null,
    extendedLanguageSubtags: [],
    script: null,
    region: null,
    variants: [],
    extensions: [],
    privateuse: [],
    irregular: null,
    regular: null,
  })

  function warning() {
    expect(arguments[0]).toBe('Found superfluous content after tag')
    expect(arguments[1]).toBe(6)
    expect(arguments[2]).toBe(0)
    expect(arguments.length).toBe(3)
  }

  expect(parse(fixture, { forgiving: true })).toEqual({
    language: null,
    extendedLanguageSubtags: [],
    script: null,
    region: null,
    variants: [],
    extensions: [],
    privateuse: [],
    irregular: null,
    regular: null,
  })
})
