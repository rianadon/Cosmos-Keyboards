import type { Cuttleform, FullCuttleform } from '$lib/worker/config'
import Trsf from '$lib/worker/modeling/transformation'
import { Vector } from '$lib/worker/modeling/transformation'
import { mirror, unibody } from '$lib/worker/modeling/transformation-ext'
import { clusterSeparation } from './editor/visualEditorHelpers'

const TRANSFORM = new Vector(1 / 19, -1 / 19, 0)

export function toKLE(fc: FullCuttleform, mir = true) {
  const c = fc.right || fc.unibody!
  const rawKeys = mir ? unibody(c.keys) : c.keys

  const keys = rawKeys
    .filter(k => 'keycap' in k && k.type != 'blank')
    .map(k => {
      const position = k.position.evaluate({ flat: false }, new Trsf())
      const x = position.axis(1, 0, 0)
      return {
        ...k,
        trsf: position,
        angle: -Math.round(Math.atan2(x.y, x.x) * 180 / Math.PI),
        vector: position.origin().multiply(TRANSFORM),
      }
    })
    .sort((a, b) => {
      if (!a.angle && b.angle) return -1
      if (a.angle && !b.angle) return 1
      return a.vector.y - b.vector.y
    })

  const minx = Math.min(...keys.map(o => o.vector.x)) - 0.5
  const miny = Math.min(...keys.map(o => o.vector.y)) - 0.5
  const offset = new Vector(-minx, -miny, 0)

  let lasty = 0
  return keys.map(k => {
    const round = (x: number) => Math.round(x * 100) / 100

    const position = k.vector.add(offset)
    const width = k.aspect > 1 ? k.aspect : 1
    const height = k.aspect < 1 ? 1 / k.aspect : 1

    const obj: any = {}
    if (width != 1) obj.w = width
    if (height != 1) obj.h = height

    if (k.angle == 0) {
      obj.x = round(position.x - 0.5)
      obj.y = round(position.y - lasty - 0.5)
      lasty = round(position.y + 0.5)
    } else {
      obj.x = -0.5
      obj.y = -0.5
      obj.r = k.angle
      obj.rx = round(position.x)
      obj.ry = round(position.y)
      lasty = 0.5
    }

    const label = 'keycap' in k && k.keycap.letter ? String(k.keycap.letter) : ''
    return [obj, label]
  }).map(s => JSON.stringify(s)).join(',\n')
}
