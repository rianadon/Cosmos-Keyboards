import { socketSize } from '$lib/geometry/socketsParts'
import { drawRoundedRectangle, importSTEP, makeBaseBox, type Solid } from 'replicad'
import type { CuttleKey } from './config'
import { makeAsyncCacher } from './modeling/cacher'
import type Trsf from './modeling/transformation'

const keyMxURL = '/target/key-mx.step'

const keyUrls = import.meta.glob(['$target/*.step', '$assets/*.step'], { as: 'url', eager: true })
const KEY_URLS = {
  box: '/target/key-box.step',
  mx: keyMxURL,
  'mx-original': keyMxURL,
  'mx-snap-in': '/target/key-mxSnapIn.step',
  alps: '/src/assets/key-alps.step',
  choc: '/src/assets/key-choc.step',
  'box-hotswap': '/target/key-box-hotswap.step',
  'mx-hotswap': '/target/key-mx-hotswap.step',
  'mx-snap-in-hotswap': '/target/key-mxSnapIn-hotswap.step',
  'mx-better': '/src/assets/key-mx-better.step',
  'mx-pcb': '/src/assets/key-mx-pcb.step',
  'choc-hotswap': '/target/key-choc-hotswap.step',
  'trackball': '/src/assets/trackball_holder.step',
  'ec11': '/src/assets/key-ec11.step',
  'oled-128x32-0.91in-adafruit': '/src/assets/key-oled-128x32-0.91in-adafruit.step',
  'cirque-23mm': '/src/assets/key-cirque-23mm.step',
  'cirque-35mm': '/src/assets/key-cirque-35mm.step',
  'cirque-40mm': '/src/assets/key-cirque-40mm.step',
  'blank': null,
}

const keyCacher = makeAsyncCacher(async (key: CuttleKey) => {
  if (key.type == 'blank') return makeBaseBox(18.5, 18.5, 5).translateZ(-5)
  const url = KEY_URLS[key.type]
  if (!url) throw new Error(`No model for key ${key.type}`)
  if (!keyUrls[url]) throw new Error(`Model for url ${url} does not exist`)
  return await fetch(keyUrls[url]).then(r => r.blob())
    .then(r => importSTEP(r) as Promise<Solid>)
})

const extendedKeyCacher = makeAsyncCacher(async (key: CuttleKey) => {
  return extendPlate(await keyCacher(key.type, null, key), key)
})

function extendPlate(plate: Solid, key: CuttleKey) {
  const size = socketSize(key)
  if (key.aspect == 1) return plate
  if ('trackball' in key) return plate

  const extension = drawRoundedRectangle(size.x * Math.max(key.aspect, 1), size.y * Math.max(1 / key.aspect, 1))
    .cut(drawRoundedRectangle(size.x, size.y))
    .sketchOnPlane('XY')
    .extrude(-size.z) as Solid

  const result = plate.fuse(extension)
  return result
}

export function keyHole(key: CuttleKey, trsf: Trsf) {
  const cacheKey = key.type + ':' + key.aspect
  return extendedKeyCacher(cacheKey, trsf, key)
}
