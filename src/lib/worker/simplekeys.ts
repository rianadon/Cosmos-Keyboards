import * as flags from '$lib/flags'
import { closestAspect, UNIFORM } from '$lib/geometry/keycaps'
import { type Writable, writable } from 'svelte/store'
import { type BufferAttribute, BufferGeometry, Matrix4, Triangle, Vector3 } from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'
import keys from '../../../target/keys-simple.json'

export class ITriangle extends Triangle {
  constructor(a: Vector3, b: Vector3, c: Vector3, public i: number) {
    super(a, b, c)
  }
}

export function simpleKey(profile: string, aspect: number, row: number, position: Matrix4, index: number, travel: number) {
  if (aspect < 1) position = new Matrix4().multiplyMatrices(position, new Matrix4().makeRotationAxis(new Vector3(0, 0, 1), Math.PI / 2))
  return simpleKeyTriangles(profile, aspect, row, position, index, travel)
}

export const simplekeyGeo: Writable<BufferGeometry[]> = writable([])
export const simpleTris: Writable<Triangle[]> = writable([])

export function simpleKeyGeo(profile: string, aspect: number, row: number): BufferGeometry | undefined {
  const a = closestAspect(aspect)
  const name = UNIFORM.includes(profile) ? `${profile}-${a}` : `${profile}-${row}-${a}`
  if (name in keys) {
    const loader = new STLLoader()
    const data = Uint8Array.from(atob((keys as any)[name]), c => c.charCodeAt(0))
    return loader.parse(data.buffer)
  }
}

function transformPoint(v: Vector3, travel: number, matrix: Matrix4) {
  if (v.z < 0) v.z = -travel
  return v.applyMatrix4(matrix)
}

function simpleKeyTriangles(profile: string, aspect: number, row: number, position: Matrix4, index: number, travel: number) {
  const geo = simpleKeyGeo(profile, aspect, row)
  if (!geo) return undefined
  const positions = geo.attributes.position as BufferAttribute
  const triangles: Triangle[] = []
  for (let i = 0; i < positions.array.length; i += 9) {
    triangles.push(
      new ITriangle(
        transformPoint(new Vector3().fromArray(positions.array, i), travel, position),
        transformPoint(new Vector3().fromArray(positions.array, i + 3), travel, position),
        transformPoint(new Vector3().fromArray(positions.array, i + 6), travel, position),
        index,
      ),
    )
  }
  if (flags.intersection) {
    for (let i = 2; i < positions.array.length; i += 3) {
      // @ts-ignore
      if (positions.array[i] < 0) positions.array[i] = -travel
    }
    // simplekeyGeo.update(v => [...v, geo.applyMatrix4(position)])
  }
  return triangles
}
