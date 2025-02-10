<script lang="ts">
  import { Canvas, type ThrelteContext } from '@threlte/core'
  import WebGL from 'three/examples/jsm/capabilities/WebGL'
  import Render from './Render.svelte'
  import Loading from './Loading.svelte'

  import { deserialize } from '../../beta/lib/serialize'
  import { WorkerPool } from '../../beta/lib/workerPool'
  import { fromCosmosConfig } from '$lib/worker/config.cosmos'
  import { generateScene } from './generate'
  import { fullEstimatedCenter, fullEstimatedSize, newFullGeometry } from '$lib/worker/config'
  import { Vector3 } from 'three'
  import type { FullGeometry } from '../../beta/lib/viewers/viewer3dHelpers'

  const urlParams = new URLSearchParams(window.location.search)
  const configStr = urlParams.get('config')
  const config = deserialize(configStr)

  const pool = new WorkerPool<typeof import('$lib/worker/api')>(2, () => {
    return new Worker(new URL('$lib/worker?worker', import.meta.url), { type: 'module' })
  })

  let cameraPosition = [0.05, -0.96, 0.56]
  let models: any[] = []
  let center = {}
  let size = [0, 0, 0]
  let geometry: FullGeometry
  let floorZ = 0

  if (config && !config.error) {
    const conf = fromCosmosConfig(config.options as any)
    geometry = newFullGeometry(conf)
    floorZ = (geometry.right || geometry.unibody)?.floorZ || 0

    center = fullEstimatedCenter(geometry).both
    size = fullEstimatedSize(geometry).both

    const aspect = 1.5
    const fov = 45 * (Math.PI / 180)
    const fovh = 2 * Math.atan(Math.tan(fov / 2) * aspect)
    let dx = size[2] / 2 + Math.abs(size[0] / 2 / Math.tan(fovh / 2))
    let dy = size[2] / 2 + Math.abs(size[1] / 2 / Math.tan(fov / 2))

    cameraPosition = new Vector3(0.05, -0.96, 0.56)
      .normalize()
      .multiplyScalar(Math.max(dx, dy) * 1.1)
      .toArray()

    generateScene(pool, conf, geometry).then((model) => {
      models = model // [...model.children]
    })
  }
</script>

{#if WebGL.isWebGL2Available()}
  {#if !config}
    <div class="flex w-full h-full items-center justify-center">No model to render</div>
  {:else if config.error}
    <div class="flex w-full h-full items-center justify-center">{config.error}</div>
  {:else if models.length}
    <Canvas>
      <Render {cameraPosition} {models} {center} {geometry} {floorZ} />
    </Canvas>
  {:else}
    <Loading step={2} />
  {/if}
{:else}
  <p>The preview could not be loaded. This is because:</p>
  <p>{@html WebGL.getWebGL2ErrorMessage().innerHTML.replace('<a', '<a class="underline"')}.</p>
{/if}
