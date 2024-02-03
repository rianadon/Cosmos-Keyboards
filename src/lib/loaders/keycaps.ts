import { closestAspect, UNIFORM } from '$lib/geometry/keycaps'
import { switchInfo } from '$lib/geometry/switches'
import type { CuttleKey } from '$lib/worker/config'
import type Trsf from '$lib/worker/modeling/transformation'
import { notNull } from '$lib/worker/util'
import { BufferAttribute, Quaternion, SphereGeometry, Vector3 } from 'three'
import { makeAsyncCacher } from './cacher'
import loadGLTF from './gltfLoader'

const cacher = makeAsyncCacher(async (key: string, rotate: boolean) => {
  let geo = await loadGLTF(`/target/key-${key}.glb`)
  if (rotate) geo = geo.clone().applyQuaternion(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2))
  return makeUv(geo)
})

async function fetchKeyBy(profile: string, aspect: number, row: number, rotate: boolean) {
  const url = UNIFORM.includes(profile) ? `${profile}-${aspect}` : `${profile}-${row}-${aspect}`
  const cacheKey = url + (rotate ? '-r' : '')
  return cacher(cacheKey, url, rotate)
}

export async function keyGeometries(trsfs: Trsf[], keys: CuttleKey[]) {
  return notNull(
    await Promise.all(keys.map(async (k, i) => {
      const trsf = trsfs[keys.indexOf(k)]
      let key: THREE.BufferGeometry
      if (k.type == 'trackball') {
        return null
      } else if (k.type == 'ec11' || k.type == 'blank') {
        return null
      } else if ('keycap' in k && k.keycap) {
        const aspect = closestAspect(k.aspect)
        key = await fetchKeyBy(k.keycap.profile, aspect, k.keycap.row, k.aspect < 1)
      } else {
        return null
      }
      const switchHeight = switchInfo(k.type).height
      return {
        i,
        geometry: key,
        key: k,
        matrix: trsf.pretranslated(0, 0, k.type == 'trackball' ? -2.5 : switchHeight).Matrix4(),
      }
    })),
  )
}

function makeUv(geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox()

  // Find the minimum length of the key
  const bbm = geometry.boundingBox!.max
  const size = Math.min(bbm.x, bbm.y) * 2

  const position = geometry.getAttribute('position') as THREE.BufferAttribute

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
