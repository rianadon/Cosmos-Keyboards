import { approximateCosmosThumbOrigin, cosmosFingers, decodeTuple, encodeTuple } from '$lib/worker/config'
import type { CosmosKeyboard } from '$lib/worker/config.cosmos'
import { Vector } from '$lib/worker/modeling/transformation'

export function getSize(c: CosmosKeyboard, side: 'left' | 'right') {
  const fingers = c.clusters.find((c) => c.name == 'fingers' && c.side == side)
  if (!fingers) return undefined
  return {
    cols: fingers.clusters.length,
    rows: Math.max(0, ...fingers.clusters.map((c) => c.keys.length)),
  }
}

export function setClusterSize(keyboard: CosmosKeyboard, side: 'left' | 'right', rows: number, cols: number) {
  const originalSize = getSize(keyboard, side)!
  const originalThumb = approximateCosmosThumbOrigin(originalSize.rows, originalSize.cols)
  if (side == 'left') originalThumb.x *= -1
  const fingers = keyboard.clusters.find((c) => c.name == 'fingers' && c.side == side)
  if (!fingers) return keyboard
  const tup = decodeTuple(fingers.position || 0n)
  const originalPosition = new Vector(tup[0] / 10, tup[1] / 10, tup[2] / 10)

  const newThumb = approximateCosmosThumbOrigin(rows, cols)
  if (side == 'left') newThumb.x *= -1
  const newPosition = originalPosition.add(originalThumb).sub(newThumb)
  const newTup = encodeTuple(newPosition.toArray().map((x) => Math.round(10 * x)))
  fingers.clusters = cosmosFingers(rows, cols, side)
  fingers.position = newTup

  return keyboard
}
