/**
 * BCP 47 parser
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

export const normal: Record<string, string | null> = {
  'en-gb-oed': 'en-GB-oxendict',
  'i-ami': 'ami',
  'i-bnn': 'bnn',
  'i-default': null,
  'i-enochian': null,
  'i-hak': 'hak',
  'i-klingon': 'tlh',
  'i-lux': 'lb',
  'i-mingo': null,
  'i-navajo': 'nv',
  'i-pwn': 'pwn',
  'i-tao': 'tao',
  'i-tay': 'tay',
  'i-tsu': 'tsu',
  'sgn-be-fr': 'sfb',
  'sgn-be-nl': 'vgt',
  'sgn-ch-de': 'sgg',
  'art-lojban': 'jbo',
  'cel-gaulish': null,
  'no-bok': 'nb',
  'no-nyn': 'nn',
  'zh-guoyu': 'cmn',
  'zh-hakka': 'hak',
  'zh-min': null,
  'zh-min-nan': 'nan',
  'zh-xiang': 'hsn',
}

export const regular: string[] = [
  'art-lojban',
  'cel-gaulish',
  'no-bok',
  'no-nyn',
  'zh-guoyu',
  'zh-hakka',
  'zh-min',
  'zh-min-nan',
  'zh-xiang',
]

const DASH = 45
const X = 120

const isNum = (code: number) => code >= 48 && code <= 57
const isAlpha = (code: number) => (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
const isAlphaNum = (code: number) => isAlpha(code) || isNum(code)

export interface Warning {
  (reason: string, code: number, offset: number): void
}

export interface Options {
  normalize?: boolean
  forgiving?: boolean
  warning?: Warning
}

export interface Extension {
  singleton: string
  extensions: string[]
}

export interface Schema {
  language: string | null
  extendedLanguageSubtags: string[]
  script: string | null
  region: string | null
  variants: string[]
  extensions: Extension[]
  privateuse: string[]
  regular: string | null
  irregular: string | null
}

export const emptyBCP = (): Schema => ({
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

class Cursor {
  constructor(readonly source: string, readonly value: string) {}

  index = 0

  peek(offset = 0): number {
    return this.value.charCodeAt(this.index + offset)
  }

  advance(count = 1): number {
    this.index += count
    return this.index
  }

  consume(count = 1): string {
    const result = this.source.slice(this.index, this.index + count)
    this.index += count
    return result
  }

  slice(start: number, end?: number): string {
    return this.source.slice(start, end)
  }
}

export function parseBCP(tag: string, options: Options = {}): Schema {
  const result = emptyBCP()
  const source = String(tag)
  const value = source.toLowerCase()

  if (Object.hasOwn(normal, value)) {
    const replacement = normal[value]
    if (options.normalize !== false && typeof replacement === 'string') return parseBCP(replacement)
    result[regular.includes(value) ? 'regular' : 'irregular'] = source
    return result
  }

  const cs = new Cursor(source, value)

  while (cs.index < 9 && isAlpha(cs.peek())) {
    cs.advance()
  }

  if (cs.index > 1 && cs.index < 9) {
    result.language = source.slice(0, cs.index)

    if (cs.index < 4) {
      let groups = 0

      while (cs.peek() === DASH && isAlpha(cs.peek(1)) && isAlpha(cs.peek(2)) && isAlpha(cs.peek(3)) && !isAlpha(cs.peek(4))) {
        if (groups > 2) return fail(cs.index, 3, 'Too many extended language subtags, expected at most 3 subtags')
        cs.advance()
        result.extendedLanguageSubtags.push(cs.consume(3))
        groups++
      }
    }

    if (cs.peek() === DASH && isAlpha(cs.peek(1)) && isAlpha(cs.peek(2)) && isAlpha(cs.peek(3)) && isAlpha(cs.peek(4)) && !isAlpha(cs.peek(5))) {
      cs.advance()
      result.script = cs.consume(4)
    }

    if (cs.peek() === DASH) {
      if (isAlpha(cs.peek(1)) && isAlpha(cs.peek(2)) && !isAlpha(cs.peek(3))) {
        cs.advance()
        result.region = cs.consume(2)
      } else if (isNum(cs.peek(1)) && isNum(cs.peek(2)) && isNum(cs.peek(3)) && !isNum(cs.peek(4))) {
        cs.advance()
        result.region = cs.consume(3)
      }
    }

    while (cs.peek() === DASH) {
      const start = cs.advance()

      while (isAlphaNum(cs.peek())) {
        if (cs.index - start > 7) return fail(cs.index, 1, 'Too long variant, expected at most 8 characters')
        cs.advance()
      }

      if (cs.index - start > 4 || (cs.index - start > 3 && isNum(value.charCodeAt(start)))) {
        result.variants.push(source.slice(start, cs.index))
      } else {
        cs.index = start - 1
        break
      }
    }

    while (cs.peek() === DASH) {
      if (cs.peek(1) === X || !isAlphaNum(cs.peek(1)) || cs.peek(2) !== DASH || !isAlphaNum(cs.peek(3))) break
      cs.advance()
      const singleton = cs.consume(1)
      const startExt = cs.index
      let groups = 0

      while (cs.peek() === DASH && isAlphaNum(cs.peek(1)) && isAlphaNum(cs.peek(2))) {
        const start = cs.advance()
        cs.advance(2)
        groups++

        while (isAlphaNum(cs.peek())) {
          if (cs.index - start > 7) return fail(cs.index, 2, 'Too long extension, expected at most 8 characters')
          cs.advance()
        }
      }

      if (!groups) return fail(cs.index, 4, 'Empty extension, extensions must have at least 2 characters of content')

      const extensions = source.slice(startExt, cs.index).split('-')
      result.extensions.push({ singleton, extensions })
    }
  } else {
    cs.index = 0
  }

  if ((cs.index === 0 && cs.peek() === X) || (cs.peek() === DASH && cs.peek(1) === X)) {
    cs.index = cs.index ? cs.index + 2 : 1
    while (cs.peek() === DASH && isAlphaNum(cs.peek(1))) {
      const start = cs.advance()
      while (isAlphaNum(cs.peek())) {
        if (cs.index - start > 7) return fail(cs.index, 5, 'Too long private-use area, expected at most 8 characters')
        cs.advance()
      }
      result.privateuse.push(source.slice(start, cs.index))
    }
  }

  if (cs.index !== source.length) {
    return fail(cs.index, 6, 'Found superfluous content after tag')
  }

  return result

  function fail(offset: number, code: number, reason: string): Schema {
    options.warning?.(reason, code, offset)
    return options.forgiving ? result : emptyBCP()
  }
}
