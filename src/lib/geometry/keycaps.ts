import type { CuttleKey } from '$lib/worker/config'

export const UNIFORM = ['xda', 'dsa', 'choc', 'ma']

export function closestAspect(aspect: number) {
  if (aspect < 1) aspect = 1 / aspect
  if (aspect < 1.125) return 1
  if (aspect < 1.375) return 1.25
  if (aspect < 1.75) return 1.5
  return 2
}

export const KEY_INFO: Record<string, Record<number, { depth: number; tilt: number }>> = {
  mt3: {
    0: { depth: 14.7, tilt: -12.5 },
    1: { depth: 13.1, tilt: -6 },
    2: { depth: 10.7, tilt: -6 },
    3: { depth: 10.7, tilt: 6 },
    4: { depth: 11.6, tilt: 12 },
    5: { depth: 11.6, tilt: 0 },
  },
  dsa: {
    0: { depth: 7.9, tilt: 0 },
  },
  xda: {
    0: { depth: 11, tilt: 0 },
  },
  ma: {
    0: { depth: 11.9, tilt: 0 },
  },
  choc: {
    0: { depth: 4, tilt: 0 },
  },
  sa: {
    0: { depth: 14.89, tilt: -13 },
    1: { depth: 14.89, tilt: -13 },
    2: { depth: 12.925, tilt: -7 },
    3: { depth: 12.5, tilt: 0 },
    4: { depth: 12.925, tilt: 7 },
    5: { depth: 12.5, tilt: 0 },
  },
  oem: {
    0: { depth: 11.2, tilt: -3 },
    1: { depth: 9.45, tilt: 1 },
    2: { depth: 9, tilt: 6 },
    3: { depth: 9.25, tilt: 9 },
    4: { depth: 9.25, tilt: 10 },
    5: { depth: 11.2, tilt: -3 },
  },
  cherry: {
    0: { depth: 9.3, tilt: 0 },
    1: { depth: 9.3, tilt: 0 },
    2: { depth: 7, tilt: 2.5 },
    3: { depth: 6, tilt: 5 },
    4: { depth: 7, tilt: 11.5 },
    5: { depth: 7, tilt: 11.5 },
  },
  des: {
    0: { depth: 15, tilt: -20 },
    1: { depth: 15, tilt: -20 },
    2: { depth: 9.75, tilt: -13 },
    3: { depth: 8.75, tilt: 4 },
    4: { depth: 10.55, tilt: 9 },
    5: { depth: 11, tilt: -3 },
  },
}

export const KEY_NAMES: Record<string, string> = {
  mt3: 'MT3',
  dsa: 'DSA',
  xda: 'XDA',
  choc: 'Kailh Choc',
  sa: 'SA',
  oem: 'OEM',
  cherry: 'Cherry',
  des: 'DES',
  ma: 'MA',
}

export function keyInfo(k: CuttleKey) {
  if (!('keycap' in k) || !(k.keycap.profile in KEY_INFO)) {
    return { depth: 10, tilt: 0 }
  }
  if (UNIFORM.includes(k.keycap.profile)) {
    return KEY_INFO[k.keycap.profile][0]
  }
  if (k.keycap.row <= 0) return KEY_INFO[k.keycap.profile][0]
  if (k.keycap.row > 5) return KEY_INFO[k.keycap.profile][5]
  return KEY_INFO[k.keycap.profile][k.keycap.row]
}

// dprint-ignore
const FLIPPED_KEY: Record<string, string> = {
  0: '1', 9: '2', 8: '3', 7: '4', 6: '5',
  p: 'q', o: 'w', i: 'e', u: 'r', y: 't',
  ';': 'a', l: 's', k: 'd', j: 'f', h: 'g',
  '/': 'z', '.': 'x', ',': 'c', 'm': 'v', n: 'b',
  'F10': 'F1', 'F9': 'F2', 'F8': 'F3', 'F7': 'F4', 'F6': 'F5'
}
for (const k of Object.keys(FLIPPED_KEY)) FLIPPED_KEY[FLIPPED_KEY[k]] = k

export function flippedKey(letter: string | undefined) {
  if (!letter) return letter
  return FLIPPED_KEY[letter] ?? letter
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
