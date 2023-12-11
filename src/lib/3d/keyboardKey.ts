import type { BufferGeometry, Mesh } from 'three'
import type { KeyMaterial } from './materials'

export type KeyStatus = 'error' | 'warning' | undefined
export type KeyMesh = Mesh<BufferGeometry, KeyMaterial>

export function statusColor(status: string) {
  if (status == 'warning') return 'orange'
  if (status == 'error') return 'red'
  throw new Error('invalid status')
}
