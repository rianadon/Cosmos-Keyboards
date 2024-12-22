import type { CuttleKey } from '$lib/worker/config'
import type { Profile } from '$target/cosmosStructs'

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
    0: { depth: 9.9, tilt: 0 },
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

export interface KeyDescription {
  name: string
  description: string
}

export const KEY_DESC: Record<Exclude<Profile, null>, KeyDescription> = {
  mt3: {
    name: 'MT3',
    description: 'A tall sculpted keycap. A lot of these are sold on Drop.',
  },
  dsa: {
    name: 'DSA',
    description: 'A uniform keycap with lower profile than XDA but harder to find.',
  },
  xda: {
    name: 'XDA',
    description: "The easiest to find uniform keycap. It's the default for a reason.",
  },
  choc: {
    name: 'Kailh Choc',
    description:
      "A low-profile keycap that's just as thin as the choc switches it sits on.\nThey're approximately equal in size to MBK keycaps, which I recommend buying.\nIf you are looking into 3D-printing your own Choc keycaps, there are so many different options. This one should do a good job standing in for most keycaps",
  },
  sa: {
    name: 'SA',
    description: 'A tall sculpted keycap.',
  },
  oem: {
    name: 'OEM',
    description:
      "A bit of a wacky keycap due to its very aggressive tilting, but its irregularities are canceled out by Cosmos.\nThese go on sale on Drop often, so they're a good choice if you're on a budget.",
  },
  cherry: {
    name: 'Cherry',
    description:
      'The quintessential keycap profile. Like OEM keycaps, these have aggressive tilting but any irregularities are canceled out by Cosmos.\nYou can often buy these super cheap on AliExpress.',
  },
  des: {
    name: 'DES',
    description:
      "Perhaps the most comfortable keycap, but you've got to search online for them or print them yourself. The other keycaps have mostly flat tops, but DES keycaps are highly contoured, kind of like the keyboard you're designing.",
  },
  ma: {
    name: 'MA',
    description: 'A very tall and round keycap found on AliExpress.',
  },
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
