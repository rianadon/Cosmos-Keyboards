import keyAlps from '$assets/key-alps.step?url'
import keyChoc from '$assets/key-choc.step?url'
import keyCirque23 from '$assets/key-cirque-23mm.step?url'
import keyCirque35 from '$assets/key-cirque-35mm.step?url'
import keyCirque40 from '$assets/key-cirque-40mm.step?url'
import keyEC11 from '$assets/key-ec11.step?url'
import keyMxBetter from '$assets/key-mx-better.step?url'
import keyMxPCB from '$assets/key-mx-pcb.step?url'
import keyOLED128x32 from '$assets/key-oled-128x32-0.91in-adafruit.step?url'
import trackballHolder from '$assets/trackball_holder.step?url'
import { socketSize } from '$lib/geometry/socketsParts'
import keyBoxHotswap from '$target/key-box-hotswap.step?url'
import keyBox from '$target/key-box.step?url'
import keyChocHotswap from '$target/key-choc-hotswap.step?url'
import keyMxHotswap from '$target/key-mx-hotswap.step?url'
import keyMx from '$target/key-mx.step?url'
import keyMxSnapInHotswap from '$target/key-mxSnapIn-hotswap.step?url'
import keyMxSnapIn from '$target/key-mxSnapIn.step?url'
import { drawRoundedRectangle, importSTEP, makeBaseBox, type Solid } from 'replicad'
import type { CuttleKey } from './config'
import { makeAsyncCacher } from './modeling/cacher'
import type Trsf from './modeling/transformation'

const KEY_URLS = {
  box: keyBox,
  mx: keyMx,
  'mx-original': keyMx,
  'mx-snap-in': keyMxSnapIn,
  alps: keyAlps,
  choc: keyChoc,
  'box-hotswap': keyBoxHotswap,
  'mx-hotswap': keyMxHotswap,
  'mx-snap-in-hotswap': keyMxSnapInHotswap,
  'mx-better': keyMxBetter,
  'mx-pcb': keyMxPCB,
  'choc-hotswap': keyChocHotswap,
  'trackball': trackballHolder,
  'ec11': keyEC11,
  'oled-128x32-0.91in-adafruit': keyOLED128x32,
  'cirque-23mm': keyCirque23,
  'cirque-35mm': keyCirque35,
  'cirque-40mm': keyCirque40,
  'blank': null,
}

const keyCacher = makeAsyncCacher(async (key: CuttleKey) => {
  if (key.type == 'blank') return makeBaseBox(18.5, 18.5, 5).translateZ(-5)
  const url = KEY_URLS[key.type]
  if (!url) throw new Error(`No model for key ${key.type}`)
  return await fetch(url).then(r => r.blob())
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
