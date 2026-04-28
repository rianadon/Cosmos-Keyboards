import { PART_INFO } from '$lib/geometry/socketsParts'
import { type CosmosCluster, type CosmosKeyboard, indexOfKey } from '$lib/worker/config.cosmos'
import { LETTERS } from '$lib/worker/config.serialize'
import type { MiryokuSlot } from './miryoku'

const ALPHA_PROFILE_ROWS = new Set([2, 3, 4])
const MIRYOKU_ROW: Record<number, 0 | 1 | 2> = { 2: 0, 3: 1, 4: 2 }

function alphaColumnIndices(kbd: CosmosKeyboard, cluster: CosmosCluster): number[] {
  const columns = cluster.clusters
    .map((col, index) => ({
      index,
      column: col.column ?? -1000,
      nLetters: col.keys.filter(
        k =>
          PART_INFO[k.partType.type || col.partType.type || kbd.partType.type!].keycap
          && LETTERS.includes(k.profile.letter!),
      ).length,
    }))
    .filter(c => c.nLetters > 0)
  columns.sort((a, b) => b.nLetters - a.nLetters)
  return columns
    .slice(0, 5)
    .sort((a, b) => a.column - b.column)
    .map(c => c.index)
}

/**
 * Suggest a mapping from every MiryokuSlot to a physical key (indexOfKey result).
 * Returns a partial map — slots with no corresponding key are omitted.
 *
 * Finger slot ordering matches alphaColumns convention: col 0 is leftmost physical
 * for both sides (left = pinky outer, right = index inner).
 *
 * Thumb ordering is outer → inner (LT0/RT0 = furthest from center).
 */
export function suggestMiryokuSlots(kbd: CosmosKeyboard): Partial<Record<MiryokuSlot, number>> {
  const result: Partial<Record<MiryokuSlot, number>> = {}

  for (const cluster of kbd.clusters) {
    const sideChar = cluster.side === 'left' ? 'L' : 'R'

    if (cluster.name === 'fingers') {
      const alphaIdxs = alphaColumnIndices(kbd, cluster)
      for (let miryokuCol = 0; miryokuCol < alphaIdxs.length; miryokuCol++) {
        const colCluster = cluster.clusters[alphaIdxs[miryokuCol]]
        if (!colCluster) continue
        for (const key of colCluster.keys) {
          const pr = key.profile.row
          if (!pr || !ALPHA_PROFILE_ROWS.has(pr)) continue
          const miryokuRow = MIRYOKU_ROW[pr] as 0 | 1 | 2
          const slot = `${sideChar}${miryokuRow}${miryokuCol}` as MiryokuSlot
          const idx = indexOfKey(kbd, key)
          if (idx !== null) result[slot] = idx
        }
      }
    } else if (cluster.name === 'thumbs') {
      // One key per thumb column, sorted by physical column position ascending.
      const thumbCols = cluster.clusters
        .filter(col => col.keys.length > 0)
        .map(col => ({ column: col.column ?? 0, key: col.keys[0] }))
        .sort((a, b) => a.column - b.column)

      const n = Math.min(thumbCols.length, 3)
      for (let i = 0; i < n; i++) {
        // Left: ascending position → LT0 (outer/leftmost) → LT2 (inner/rightmost)
        // Right: ascending position → RT2 (inner/leftmost) → RT0 (outer/rightmost)
        const thumbIdx = (cluster.side === 'left' ? i : 2 - i) as 0 | 1 | 2
        const slot = `${sideChar}T${thumbIdx}` as MiryokuSlot
        const idx = indexOfKey(kbd, thumbCols[i].key)
        if (idx !== null) result[slot] = idx
      }
    }
  }

  return result
}
