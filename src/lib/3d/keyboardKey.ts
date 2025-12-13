import { type CosmosKeyboard, nthKey } from '$lib/worker/config.cosmos'
import type { BufferGeometry, Material, Mesh } from 'three'

export type KeyStatus = 'error' | 'warning' | undefined
export type KeyMesh = Mesh<BufferGeometry, Material>

export function statusColor(status: string) {
  if (status == 'warning') return 'orange'
  if (status == 'error') return 'red'
  throw new Error('invalid status')
}

function isActive(
  index: number | null,
  c: CosmosKeyboard,
  mode: 'key' | 'column' | 'cluster',
  n: number | null,
) {
  if (index == null) return false
  if (n == null) {
    return false
  } else if (mode == 'key') {
    return index === n
  } else if (mode == 'column') {
    return nthKey(c, index).column == nthKey(c, n).column
  } else if (mode == 'cluster') {
    return nthKey(c, index).cluster == nthKey(c, n).cluster
  }
}

export function keyBrightness(
  index: number | null,
  c: CosmosKeyboard,
  selectMode: 'key' | 'column' | 'cluster',
  clicked: number | null,
  hovered: number | null,
  fallback: number,
) {
  const isSelected = isActive(index, c, selectMode, clicked)
  const isHovered = isActive(index, c, selectMode, hovered)
  return isSelected ? 0.3 : isHovered ? 0.5 : fallback
}
