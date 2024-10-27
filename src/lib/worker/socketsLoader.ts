import { PART_INFO, socketSize, variantURL } from '$lib/geometry/socketsParts'
import { drawRoundedRectangle, importSTEP, makeBaseBox, type Solid } from 'replicad'
import type { CuttleKey } from './config'
import { makeAsyncCacher } from './modeling/cacher'
import { getOC } from './modeling/index'
import type Trsf from './modeling/transformation'

let keyUrls: Record<string, { default: string }> = {}
try {
  keyUrls = import.meta.glob(['$target/*.step', '$assets/*.step'], { query: '?url', eager: true })
} catch (e) {
  keyUrls = undefined
}

const keyCacher = makeAsyncCacher(async (key: CuttleKey) => {
  if (key.type == 'blank') return makeBaseBox(key.size?.width ?? 18.5, key.size?.height ?? 18.5, 5).translateZ(-5)
  const url = 'partOverride' in PART_INFO[key.type]
    ? PART_INFO[key.type].stepFile.replace('.step', variantURL(key) + '.step')
    : `/target/splitsocket-${key.type}${variantURL(key)}.step`
  if (!url) throw new Error(`No model for key ${key.type}`)
  const urls = keyUrls || JSON.parse(process.env.SOCKET_URLS!)
  if (!urls[url]) throw new Error(`Model for url ${url} does not exist`)
  return keyUrls
    ? await fetch(urls[url].default).then(r => r.blob())
      .then(r => importSTEP(r) as Promise<Solid>)
    : (await import(process.env.FS!)).readFile(urls[url].default)
      .then(r => importSTEP(new Blob([r])) as Promise<Solid>)
})

const extendedKeyCacher = makeAsyncCacher(async (key: CuttleKey) => {
  let cacheKey = key.type + variantURL(key)
  if (key.type == 'blank') cacheKey += `-${key.size?.width}x${key.size?.height}`
  return extendPlate(await keyCacher(cacheKey, null, key), key)
})

function extendPlate(plate: Solid, key: CuttleKey) {
  const size = socketSize(key)
  if (key.aspect == 1) return plate
  if ('radius' in size) return plate

  const extension = drawRoundedRectangle(size[0] * Math.max(key.aspect, 1), size[1] * Math.max(1 / key.aspect, 1))
    .cut(drawRoundedRectangle(size[0], size[1]))
    .sketchOnPlane('XY')
    .extrude(-size[2]) as Solid

  const result = plate.fuse(extension)
  return result
}

export function keyHole(key: CuttleKey, trsf: Trsf) {
  let cacheKey = key.type + ':' + key.aspect
  if (key.type == 'blank') cacheKey += `-${key.size?.width}x${key.size?.height}`
  return extendedKeyCacher(cacheKey, trsf, key)
}
