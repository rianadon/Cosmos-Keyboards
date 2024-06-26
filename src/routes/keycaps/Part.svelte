<script lang="ts">
  import KeyboardMesh from '$lib/3d/KeyboardMesh.svelte'
  import { keyGeometries } from '$lib/loaders/keycaps'
  import { KEY_NAMES, UNIFORM, keyInfo } from '$lib/geometry/keycaps'
  import { browser } from '$app/environment'
  import { drawLinedWall } from '../beta/lib/viewers/viewerHelpers'
  import { MeshBasicMaterial } from 'three'
  import CoopCanvas from '$lib/3d/CoopCanvas.svelte'
  import type { CuttleKey } from '$lib/worker/config'
  import Trsf from '$lib/worker/modeling/transformation'
  import { simpleKeyGeo } from '$lib/loaders/simplekeys'
  import { T } from '@threlte/core'
  import { OrbitControls } from '@threlte/extras'

  export let row: number
  export let part: string
  export let dev = true
  let loading = true
  const KEY_WIDTH = 9
  const ASPECT = 1

  const key: CuttleKey = {
    type: 'mx-better',
    position: null as any,
    aspect: ASPECT,
    cluster: 'idk',
    keycap: { profile: part as any, row },
  }

  async function keyGeometry() {
    const geo = await keyGeometries([new Trsf()], [key])
    return geo[0].geometry
  }

  const NULL = Promise.resolve(undefined)
  const partPromise = browser ? keyGeometry() : NULL
  const simpleGeo = browser ? simpleKeyGeo(key, false) : null

  const info = keyInfo(key)
  const depthDrawing: [number, number][] = [
    [KEY_WIDTH, 0],
    [KEY_WIDTH, info.depth + KEY_WIDTH * Math.tan((info.tilt * Math.PI) / 180)],
    [-KEY_WIDTH, info.depth - KEY_WIDTH * Math.tan((info.tilt * Math.PI) / 180)],
    [-KEY_WIDTH, 0],
  ]

  partPromise.then(() => (loading = false))
</script>

<div
  class="text-white bg-gray-800 px-2 pt-4 rounded-2 shadow-lg shadow-pink/15 relative"
  class:opacity-50={loading}
>
  <div class="text-center text-lg mb-1">
    {#if UNIFORM.includes(part)}
      {KEY_NAMES[part]}
    {:else}
      {KEY_NAMES[part]} <span class="opacity-70 ml-1">- <span class="ml-1">R{row}</span></span>
    {/if}
  </div>
  <div class="flex">
    <div class="aspect-1 relative w-full">
      <CoopCanvas>
        <T.Group rotation={[0, 0, Math.PI / 2]} position={[0, 0, -8]}>
          {#await partPromise then partMesh}
            <KeyboardMesh geometry={partMesh} kind="key" />
          {/await}
          {#if dev}
            <T.Mesh
              geometry={drawLinedWall(depthDrawing, 0.2)}
              material={new MeshBasicMaterial({ color: 0x14b8a6 })}
              rotation={[0, -Math.PI / 2, -Math.PI / 2]}
              position={[-10, 0, 0]}
            />
          {/if}
        </T.Group>
        <T.OrthographicCamera makeDefault position={[0, -100, 0]} zoom={0.08}>
          <OrbitControls enableDamping enableZoom={false} enablePan={false} dampingFactor={0.1} />
        </T.OrthographicCamera>
      </CoopCanvas>
    </div>
    {#if dev}
      <div class="aspect-1 relative w-full">
        <CoopCanvas>
          <T.Group rotation={[0, 0, Math.PI / 2]} position={[0, 0, -8]}>
            {#if simpleGeo}
              <T.Mesh
                geometry={simpleGeo}
                material={new MeshBasicMaterial({ color: 0xdc2626 })}
                scale={[0.8, 1, 1]}
              />
            {/if}
            {#await partPromise then partMesh}
              <KeyboardMesh geometry={partMesh} kind="key" />
            {/await}
          </T.Group>
          <T.OrthographicCamera makeDefault position={[0, -100, 0]} zoom={0.08}>
            <OrbitControls enableDamping enableZoom={false} enablePan={false} dampingFactor={0.1} />
          </T.OrthographicCamera>
        </CoopCanvas>
      </div>
    {/if}
  </div>
</div>
