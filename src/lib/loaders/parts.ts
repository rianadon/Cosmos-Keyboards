import { variantURL } from '$lib/geometry/socketsParts'
import type { CuttleKey } from '$lib/worker/config'
import type Trsf from '$lib/worker/modeling/transformation'
import { notNull } from '$lib/worker/util'
import { BoxGeometry, CylinderGeometry, SphereGeometry, TetrahedronGeometry } from 'three'
import { makeAsyncCacher } from './cacher'
import loadGLTF from './gltfLoader'

// evqwgd001 encoder from https://grabcad.com/library/evqwgd001-2
const PART_URLS: Record<Switch, string | null> = {
  'old-mx-snap-in': '/target/switch-cherry-mx.glb',
  'old-mx-snap-in-hotswap': '/target/switch-cherry-mx.glb',
  'old-mx-hotswap': '/target/switch-cherry-mx.glb',
  'mx-better': '/target/switch-cherry-mx.glb',
  'old-mx': '/target/switch-cherry-mx.glb',
  'mx-hotswap': '/target/switch-cherry-mx.glb',
  'mx-pcb': '/target/switch-cherry-mx.glb',
  'mx-pcb-twist': '/target/switch-cherry-mx.glb',
  'old-box': '/target/switch-cherry-mx.glb',
  'alps': '/src/assets/switch-alps.glb',
  'choc': '/src/assets/switch-choc.glb',
  'choc-hotswap': '/src/assets/switch-choc.glb',
  'ec11': '/src/assets/switch-ec11.glb',
  'joystick-joycon-adafruit': '/target/switch-joystick-joycon-adafruit.glb',
  'evqwgd001': '/target/switch-evqwgd001.glb',
  'trackpad-cirque': '/src/assets/switch-cirque.glb',
  'oled-128x32-0.91in-dfrobot': '/target/switch-oled-128x32-0.91in-dfrobot.glb',
  'oled-128x32-0.91in-adafruit': null,
  'joystick-ps2-40x45': '/target/switch-joystick-ps2-40x45.glb',
  'trackball': null,
  'blank': null,
}

type Switch = CuttleKey['type']

const cacher = makeAsyncCacher(async (sw: Switch, variant: string) => {
  if (!(sw in PART_URLS)) throw new Error(`No model for switch ${sw}`)
  // @ts-ignore
  const url = PART_URLS[sw]
  if (!url) throw new Error(`No model for switch ${sw}`)
  return await loadGLTF(url.replace('.glb', variant + '.glb'))
})

export async function partGeometry(type: Switch, variant: Record<string, any> = {}) {
  if (type == 'trackball' && variant?.size == '34mm') return new SphereGeometry(17, 64, 32).translate(0, 0, -4)
  if (type == 'trackball' && variant?.size == '25mm') return new SphereGeometry(12.5, 64, 32).translate(0, 0, -4)
  if (!(type in PART_URLS) || !PART_URLS[type]) return undefined
  const varurl = variantURL({ type, variant } as any)
  let part = await cacher(type + varurl, type, varurl)
  return part
}

async function partGeometry2(trsf: Trsf, k: CuttleKey) {
  if (!(k.type in PART_URLS) || !PART_URLS[k.type]) return null
  return {
    geometry: await partGeometry(k.type, k.variant),
    matrix: trsf.Matrix4(),
  }
}

export async function partGeometries(trsfs: Trsf[], keys: CuttleKey[], flipped: boolean) {
  return notNull(
    await Promise.all(keys.map(async (k, i) => partGeometry2(trsfs[i], k))),
  )
}
