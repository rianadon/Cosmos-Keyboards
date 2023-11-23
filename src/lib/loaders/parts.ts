import type { CuttleKey } from '$lib/worker/config'
import type Trsf from '$lib/worker/modeling/transformation'
import { makeAsyncCacher } from './cacher'
import loadGLTF from './gltfLoader'

const PART_URLS = {
  'mx-snap-in': '/target/switch-cherry-mx.glb',
  'mx': '/target/switch-cherry-mx.glb',
  'mx-better': '/target/switch-cherry-mx.glb',
  'mx-original': '/target/switch-cherry-mx.glb',
  'mx-pcb': '/target/switch-cherry-mx.glb',
  'box': '/target/switch-cherry-mx.glb',
  'alps': '/src/assets/switch-alps.glb',
  'choc': '/src/assets/switch-choc.glb',
  'ec11': '/src/assets/switch-ec11.glb',
  'cirque-23mm': '/src/assets/switch-cirque-23mm.glb',
  'cirque-35mm': '/src/assets/switch-cirque-35mm.glb',
  'cirque-40mm': '/src/assets/switch-cirque-40mm.glb',
}

type Switch = CuttleKey['type']

const cacher = makeAsyncCacher(async (sw: Switch) => {
  if (!(sw in PART_URLS)) throw new Error(`No model for switch ${sw}`)
  // @ts-ignore
  const url = PART_URLS[sw]
  return await loadGLTF(url)
})

export async function partGeometries(trsfs: Trsf[], keys: CuttleKey[]) {
  return (await Promise.all(keys.map(async (k, i) => {
    if (!(k.type in PART_URLS)) return null
    return {
      i: i,
      geometry: await cacher(k.type, k.type),
      matrix: trsfs[keys.indexOf(k)].pretranslated(offsetPart(k.type)).Matrix4(),
    }
  }))).filter(k => k !== null)
}

export function offsetPart(sw: Switch): [number, number, number] {
  if (sw.startsWith('mx') || sw == 'box') return [0, 0, 10]
  return [0, 0, 0]
}
