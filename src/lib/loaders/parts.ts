import type { CuttleKey } from '$lib/worker/config'
import type Trsf from '$lib/worker/modeling/transformation'
import { notNull } from '$lib/worker/util'
import { SphereGeometry } from 'three'
import { makeAsyncCacher } from './cacher'
import loadGLTF from './gltfLoader'

// evqwgd001 encoder from https://grabcad.com/library/evqwgd001-2
const PART_URLS: Record<Switch, string> = {
  'mx-snap-in': '/target/switch-cherry-mx.glb',
  // 'mx': '/target/switch-cherry-mx.glb',
  'mx-better': '/target/switch-cherry-mx.glb',
  'mx-original': '/target/switch-cherry-mx.glb',
  'mx-pcb': '/target/switch-cherry-mx.glb',
  'box': '/target/switch-cherry-mx.glb',
  'alps': '/src/assets/switch-alps.glb',
  'choc': '/src/assets/switch-choc.glb',
  'ec11': '/src/assets/switch-ec11.glb',
  'evqwgd001': '/target/switch-evqwgd001.glb',
  'cirque-23mm': '/src/assets/switch-cirque-23mm.glb',
  'cirque-35mm': '/src/assets/switch-cirque-35mm.glb',
  'cirque-40mm': '/src/assets/switch-cirque-40mm.glb',
  'oled-128x32-0.91in-dfrobot': '/target/switch-oled-128x32-0.91in-dfrobot.glb',
}

type Switch = CuttleKey['type']

const cacher = makeAsyncCacher(async (sw: Switch) => {
  if (!(sw in PART_URLS)) throw new Error(`No model for switch ${sw}`)
  // @ts-ignore
  const url = PART_URLS[sw]
  return await loadGLTF(url)
})

export async function partGeometry(type: Switch) {
  if (type == 'trackball') return new SphereGeometry(17.5, 64, 32).translate(0, 0, -4)
  if (!(type in PART_URLS)) return undefined
  let part = await cacher(type, type)
  const offset = offsetPart(type)
  if (offset[2] != 0) part = part.clone().translate(...offset)
  return part
}

export async function partGeometries(trsfs: Trsf[], keys: CuttleKey[]) {
  return notNull(
    await Promise.all(keys.map(async (k, i) => {
      if (k.type == 'trackball') {
        return {
          i: i,
          geometry: new SphereGeometry(17.5, 64, 32),
          matrix: trsfs[keys.indexOf(k)].pretranslated(0, 0, -2.5).Matrix4(),
        }
      }
      if (!(k.type in PART_URLS)) return null
      return {
        i: i,
        geometry: await cacher(k.type, k.type),
        matrix: trsfs[keys.indexOf(k)].pretranslated(offsetPart(k.type)).Matrix4(),
      }
    })),
  )
}

export function offsetPart(sw: Switch): [number, number, number] {
  if (sw.startsWith('mx') || sw == 'box') return [0, 0, 10]
  return [0, 0, 0]
}
