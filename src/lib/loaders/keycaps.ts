import { closestAspect, UNIFORM } from '$lib/geometry/keycaps'
import { switchInfo } from '$lib/geometry/switches'
import type { CuttleKey } from '$lib/worker/config'
import type Trsf from '$lib/worker/modeling/transformation'
import { notNull } from '$lib/worker/util'
import { BufferAttribute, BufferGeometry, Quaternion, SphereGeometry, Vector3 } from 'three'
import { makeAsyncCacher } from './cacher'
import loadGLTF from './gltfLoader'

const cacher = makeAsyncCacher(async (key: string, rotate: boolean) => {
  let geo = await loadGLTF(`/target/key-${key}.glb`)
  if (rotate) geo = geo.clone().applyQuaternion(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2))
  return makeUv(geo)
})

export function keyUrl(k: CuttleKey) {
  if (!('keycap' in k && k.keycap)) return null
  const profile = k.keycap.profile
  const row = k.keycap.row
  const rotate = k.aspect < 1
  const aspect = closestAspect(k.aspect)
  const url = UNIFORM.includes(profile) ? `${profile}-${aspect}` : `${profile}-${row}-${aspect}`
  return url + (rotate ? '-r' : '')
}

async function fetchKeyBy(profile: string, aspect: number, row: number, rotate: boolean) {
  const url = UNIFORM.includes(profile) ? `${profile}-${aspect}` : `${profile}-${row}-${aspect}`
  const cacheKey = url + (rotate ? '-r' : '')
  return cacher(cacheKey, url, rotate)
}

export function hasKeyGeometry(k: CuttleKey) {
  if (k.type == 'trackball') {
    return false
  } else if (k.type == 'ec11' || k.type == 'blank' || k.type === 'joystick-joycon-adafruit') {
    return false
  }
  return ('keycap' in k && !!k.keycap)
}

export async function keyGeometry(k: CuttleKey) {
  if (!hasKeyGeometry(k)) return null
  if ('keycap' in k && k.keycap) {
    const aspect = closestAspect(k.aspect)
    return await fetchKeyBy(k.keycap.profile, aspect, k.keycap.row, k.aspect < 1)
  }
  return null
}

export async function keyGeometries(trsfs: Trsf[], keys: CuttleKey[]) {
  const geos = await Promise.all(keys.map(keyGeometry))
  return notNull(trsfs.map((t, i) =>
    geos[i]
      ? {
        geometry: geos[i]!,
        key: keys[i],
        matrix: t.pretranslated(0, 0, switchInfo(keys[i].type).height).Matrix4(),
      }
      : null
  ))
}

function makeUv(geometry: BufferGeometry) {
  geometry.computeBoundingBox()

  // Find the minimum length of the key
  const bbm = geometry.boundingBox!.max
  const size = Math.min(bbm.x, bbm.y) * 2

  const position = geometry.getAttribute('position') as BufferAttribute

  // Project the 3D coordinates onto the Z plane.
  // Scale these values and use them as the UV.
  const uv = new Float32Array(position.count * 2)
  for (let i = 0; i < geometry.attributes.position.count; i++) {
    uv[2 * i] = position.getX(i) / size + 0.5
    uv[2 * i + 1] = position.getY(i) / size + 0.5
  }

  geometry.setAttribute('uv', new BufferAttribute(uv, 2))
  return geometry
}
