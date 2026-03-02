import { BOARD_PROPERTIES } from '$lib/geometry/microcontrollers'
import { fetchBoardElement } from '$lib/loaders/boardElement'
import type { Cuttleform } from '$lib/worker/config'
import { objKeys } from '$lib/worker/util'

import * as model from './node-model'
model // just force the file to be imported so that paths are setup correctly

type Microcontroller = Exclude<Cuttleform['microcontroller'], null>
async function boundingBox(uc: Microcontroller) {
  const model = (await fetchBoardElement({ model: uc } as any))!
  model.computeBoundingBox()
  return model.boundingBox!
}

async function main() {
  const boards = objKeys(BOARD_PROPERTIES)
  const boundingBoxes = await Promise.all(boards.map(boundingBox))
  for (let i = 0; i < boards.length; i++) {
    const board = boards[i]
    const bb = boundingBoxes[i]
    const boundingZ = BOARD_PROPERTIES[board].boundingBoxZ

    if (Math.abs(bb.min.x + bb.max.x) > 0.01) {
      console.log(`[${board}]: not centered on the X axis. It's left side is ${bb.min.x} and right is ${bb.max.x}`)
    }
    if (Math.abs(boundingZ - bb.max.z) > 0.01) {
      console.log(`[${board}]: wrong bounding Z. Set to ${boundingZ} but true is ${bb.max.z}`)
    }
  }
}

main()
