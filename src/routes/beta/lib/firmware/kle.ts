import { hasKeyGeometry } from '$lib/loaders/keycaps'
import { fullEstimatedCenter } from '$lib/worker/config'
import Trsf from '$lib/worker/modeling/transformation'
import { Vector } from '$lib/worker/modeling/transformation'
import { objEntries } from '$lib/worker/util'
import type { FullGeometry } from '../viewers/viewer3dHelpers'
import type { Matrix } from './qmk'

const TRANSFORM = new Vector(1 / 19, -1 / 19, 0)

export function toKLE(geometry: FullGeometry, matrix?: Matrix) {
  const centers = fullEstimatedCenter(geometry, false)
  const center = centers.both

  const keys = objEntries(geometry).flatMap(([keyboard, conf]) =>
    conf!.c.keys
      .filter(hasKeyGeometry)
      .map(k => {
        const position = k.position.evaluate({ flat: false }, new Trsf())
        const scaleX = keyboard == 'left' ? -1 : 1
        const x = position.axis(1, 0, 0)
        return {
          ...k,
          key: k,
          angle: -Math.round(Math.atan2(x.y, x.x) * 180 / Math.PI) * scaleX,
          vector: position.origin()
            .multiply({ x: scaleX, y: 1, z: 1 })
            .addScaledVector(new Vector(...center[keyboard]!), -1)
            .multiply(TRANSFORM),
        }
      })
  ).sort((a, b) => {
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

    const label = matrix
      ? matrix.get(k.key)!.join(',')
      : ('keycap' in k && hasKeyGeometry(k) ? String(k.keycap?.letter) : '')
    return [obj, label]
  }).map(s => JSON.stringify(s)).join(',\n')
}
