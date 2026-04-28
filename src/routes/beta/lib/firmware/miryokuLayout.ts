/**
 * Builds a MiryokuSlot → ZMK-position map from FullGeometry.
 *
 * ZMK position = index into logicalKeys(geo).filter(hasPinsInMatrix).
 * This avoids the CosmosKeyboard ↔ CuttleKey identity problem by operating
 * entirely in the FullGeometry world.
 */

import { PART_INFO } from '$lib/geometry/socketsParts'
import type { MiryokuSlot } from '$lib/keymap/miryoku'
import { hasPinsInMatrix } from '$lib/loaders/keycaps'
import { getRowColumn } from '$lib/worker/config.cosmos'
import type { CuttleKey } from '$target/cosmosStructs'
import type { FullGeometry } from '../viewers/viewer3dHelpers'
import { logicalKeys, type Matrix } from './firmwareHelpers'

const ALPHA_PROFILE_ROWS = new Set([2, 3, 4])
const MIRYOKU_ROW_MAP: Record<number, 0 | 1 | 2> = { 2: 0, 3: 1, 4: 2 }
const LETTERS_SET = new Set('abcdefghijklmnopqrstuvwxyz'.split(''))

interface KeyEntry {
  key: CuttleKey
  zmkPos: number
  row: number
  col: number
}

function isAlphaKey(key: CuttleKey): boolean {
  if (!('keycap' in key) || !key.keycap?.letter) return false
  return LETTERS_SET.has(key.keycap.letter.toLowerCase())
}

/** Find the 5 alpha column values from a list of finger keys, sorted ascending. */
function alphaColValues(keys: KeyEntry[]): number[] {
  const colLetters = new Map<number, number>()
  for (const { key, col } of keys) {
    if (isAlphaKey(key)) colLetters.set(col, (colLetters.get(col) ?? 0) + 1)
  }
  const cols = [...colLetters.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  return cols
    .map(([c]) => c)
    .sort((a, b) => a - b)
}

/**
 * Suggest a MiryokuSlot → ZMK-position mapping from the keyboard geometry.
 *
 * Side is determined by whether the key object appears in geo.left or geo.right.
 * Alpha columns are the 5 columns with the most letter-bearing keys.
 * Thumb ordering is outer→inner (LT0/RT0 = furthest from center).
 */
export function suggestMiryokuPositions(geo: FullGeometry): Partial<Record<MiryokuSlot, number>> {
  const leftSet = new Set<CuttleKey>(geo.left?.c.keys ?? [])
  const rightSet = new Set<CuttleKey>(geo.right?.c.keys ?? geo.unibody?.c.keys ?? [])

  const fingers: { left: KeyEntry[]; right: KeyEntry[] } = { left: [], right: [] }
  const thumbs: { left: KeyEntry[]; right: KeyEntry[] } = { left: [], right: [] }

  let zmkPos = 0
  for (const key of logicalKeys(geo)) {
    if (!hasPinsInMatrix(key)) {
      zmkPos++
      continue
    }
    const side = leftSet.has(key) ? 'left' : rightSet.has(key) ? 'right' : null
    if (side) {
      const { row, column } = getRowColumn(key.position)
      const entry: KeyEntry = { key, zmkPos, row, col: column }
      if (key.cluster === 'fingers') fingers[side].push(entry)
      else if (key.cluster === 'thumbs') thumbs[side].push(entry)
    }
    zmkPos++
  }

  const result: Partial<Record<MiryokuSlot, number>> = {}

  for (const side of ['left', 'right'] as const) {
    const sideChar = side === 'left' ? 'L' : 'R'
    const alphaCols = alphaColValues(fingers[side])

    for (const entry of fingers[side]) {
      if (!('keycap' in entry.key) || !entry.key.keycap?.letter) continue
      const miryokuColIdx = alphaCols.indexOf(entry.col)
      if (miryokuColIdx < 0) continue
      const profileRow = entry.key.keycap.row
      if (!ALPHA_PROFILE_ROWS.has(profileRow)) continue
      const miryokuRow = MIRYOKU_ROW_MAP[profileRow] as 0 | 1 | 2
      const slot = `${sideChar}${miryokuRow}${miryokuColIdx}` as MiryokuSlot
      result[slot] = entry.zmkPos
    }

    // Thumbs: sort by physical column, assign LT/RT outer→inner
    const thumbList = thumbs[side].sort((a, b) => a.col - b.col)
    const n = Math.min(thumbList.length, 3)
    for (let i = 0; i < n; i++) {
      const thumbIdx = (side === 'left' ? i : 2 - i) as 0 | 1 | 2
      const slot = `${sideChar}T${thumbIdx}` as MiryokuSlot
      result[slot] = thumbList[i].zmkPos
    }
  }

  return result
}
