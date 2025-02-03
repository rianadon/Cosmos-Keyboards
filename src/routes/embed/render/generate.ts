import { type FullCuttleform, fullEstimatedCenter, fullEstimatedSize, newFullGeometry } from '$lib/worker/config'
import { objEntriesNotNull, objKeys } from '$lib/worker/util'
import { Matrix4 } from 'three/src/math/Matrix4.js'
import { renderedModelsAsScene } from '../../beta/lib/modelGLTF'
import type { FullGeometry, FullKeyboardMeshes } from '../../beta/lib/viewers/viewer3dHelpers'
import type { WorkerPool } from '../../beta/lib/workerPool'

export async function generateScene(pool: WorkerPool<typeof import('$lib/worker/api')>, conf: FullCuttleform, geometry: FullGeometry) {
  const kbdNames = objKeys(conf)
    .filter((k) => !!conf[k])
    .sort((a, b) => b.localeCompare(a)) // Make sure right keyboard comes first

  const quickPromises = kbdNames.map((k) => pool.execute((w) => w.generateQuick(conf[k]!), 'Preview'))

  const quickResults = await Promise.all(quickPromises)
  const results: FullKeyboardMeshes = {}
  quickResults.forEach((prom, i) => {
    results[kbdNames[i]] = {
      ...results[kbdNames[i]],
      webBuf: prom.web.mesh,
      keyBufs: prom.keys.keys.map((k) => ({
        ...k,
        matrix: new Matrix4().copy(k.matrix),
      })),
      wallBuf: prom.wall.mesh,
      plateTopBuf: prom.plate.top.mesh,
      plateBotBuf: prom.plate.bottom.mesh || undefined,
      holderBuf: undefined,
      screwBaseBuf: undefined,
      screwPlateBuf: undefined,
    }
  })
  const meshes = objEntriesNotNull(results)
  const center = fullEstimatedCenter(geometry).both
  const scene = await renderedModelsAsScene(geometry, meshes, center, false)

  return scene
}
