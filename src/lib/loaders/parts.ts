import { PART_INFO, variantURL } from '$lib/geometry/socketsParts'
import type { CuttleKey } from '$lib/worker/config'
import type Trsf from '$lib/worker/modeling/transformation'
import { notNull } from '$lib/worker/util'
import { SphereGeometry } from 'three'
import loadGLTF from './gltfLoader'

// evqwgd001 encoder from https://grabcad.com/library/evqwgd001-2
const PART_URLS = Object.fromEntries(Object.entries(PART_INFO).map(([p, i]) => [p, i.partOverride]))

type Switch = CuttleKey['type']

export async function partGeometry(type: Switch, variant: Record<string, any> = {}) {
  if (type == 'trackball' && !(variant?.bearings.includes('BTU'))) {
    if (variant?.size == '55mm') return new SphereGeometry(27.5, 64, 32).translate(0, 0, -4)
    if (variant?.size == '43mm') return new SphereGeometry(21.5, 64, 32).translate(0, 0, -4)
    if (variant?.size == '34mm') return new SphereGeometry(17, 64, 32).translate(0, 0, -4)
    if (variant?.size == '25mm') return new SphereGeometry(12.5, 64, 32).translate(0, 0, -4)
  }

  const varurl = variantURL({ type, variant } as any)
  if ('partOverride' in PART_INFO[type]) {
    const url = PART_INFO[type].partOverride
    if (!url) throw new Error(`No model for switch ${type}`)
    return await loadGLTF(url.replace('.glb', (PART_INFO[type].singlePartForVariants ? '' : varurl) + '.glb'))
  } else {
    const splitUrl = '/target/splitpart-' + type + (PART_INFO[type].singlePartForVariants ? '' : varurl) + '.glb'
    console.log(splitUrl)
    return await loadGLTF(splitUrl)
  }
}

async function partGeometry2(trsf: Trsf, k: CuttleKey) {
  if (k.type == 'blank') return null
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
