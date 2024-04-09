import { closestAspect, UNIFORM } from '$lib/geometry/keycaps'
import { switchInfo } from '$lib/geometry/switches'
import type { CuttleKey } from '$lib/worker/config'
import Trsf from '$lib/worker/modeling/transformation'
import { type Writable, writable } from 'svelte/store'
import { type BufferAttribute, BufferGeometry, Matrix4, Triangle, Vector3 } from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'
import keys from '../../../target/keys-simple.json'

export class ITriangle extends Triangle {
  constructor(a: Vector3, b: Vector3, c: Vector3, public i: number) {
    super(a, b, c)
  }
}

export function simpleKeyPosition(key: CuttleKey, trsf: Trsf) {
  let position = trsf.pretranslated(0, 0, switchInfo(key.type).height)
  if (key.aspect < 1) position.multiply(new Trsf().rotate(90))
  return position
}

export function calcTravel(k: CuttleKey) {
  const swInfo = switchInfo(k.type)
  return swInfo.height - swInfo.pressedHeight
}

export function simpleKeyGeo(key: CuttleKey, addTravel: boolean): BufferGeometry | undefined {
  if (key.type == 'blank' || key.type == 'ec11' || 'trackball' in key || key.type === 'adafruit-mini-thumbstick') return
  if (!('keycap' in key)) return
  const { aspect } = key
  const { profile, row } = key.keycap

  const a = closestAspect(aspect)
  const name = UNIFORM.includes(profile) ? `${profile}-${a}` : `${profile}-${row}-${a}`
  if (name in keys) {
    const loader = new STLLoader()
    const data = Uint8Array.from(atob((keys as any)[name]), c => c.charCodeAt(0))
    const geo = loader.parse(data.buffer)
    if (addTravel) {
      const travel = calcTravel(key)
      const positions = (geo.attributes.position as BufferAttribute).array as number[]
      for (let i = 2; i < positions.length; i += 3) {
        if (positions[i] < 0) positions[i] = -travel
      }
    }
    return geo
  }
}

export function simpleKey(key: CuttleKey, position: Matrix4, index: number, addTravel: boolean) {
  const geo = simpleKeyGeo(key, addTravel)
  if (!geo) return undefined
  const positions = geo.attributes.position as BufferAttribute
  const triangles: Triangle[] = []
  for (let i = 0; i < positions.array.length; i += 9) {
    triangles.push(
      new ITriangle(
        new Vector3().fromArray(positions.array, i).applyMatrix4(position),
        new Vector3().fromArray(positions.array, i + 3).applyMatrix4(position),
        new Vector3().fromArray(positions.array, i + 6).applyMatrix4(position),
        index,
      ),
    )
  }

  return triangles
}
