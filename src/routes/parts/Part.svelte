<script lang="ts">
  import { partGeometry } from '$lib/loaders/parts'
  import loadGLTF from '$lib/loaders/gltfLoader'
  import { mdiFileEyeOutline } from '@mdi/js'
  import Icon from '$lib/presentation/Icon.svelte'
  import { KEY_URLS } from '$lib/worker/socketsLoader'
  import Popover from 'svelte-easy-popover/dist/ts/Popover.svelte'
  import { fade } from 'svelte/transition'
  import { browser } from '$app/environment'
  import { drawLinedRectangleOutside, makeBox } from '../beta/lib/viewers/viewerHelpers'
  import { MeshBasicMaterial } from 'three'
  import { partBottom, socketSize, variantURL } from '$lib/geometry/socketsParts'
  import CoopCanvas from '$lib/3d/CoopCanvas.svelte'
  import { T } from '@threlte/core'
  import { OrbitControls } from '@threlte/extras'
  import type { CuttleKey } from '$lib/worker/config'
  import KeyboardMaterial from '$lib/3d/KeyboardMaterial.svelte'

  export let name: string
  export let part: CuttleKey['type']
  export let dev = true
  export let variant: Record<string, any> = {}
  let loading = true
  let ref: HTMLElement
  const key = { type: part, variant } as any

  const NULL = Promise.resolve(undefined)
  const partPromise = browser ? partGeometry(part as any, variant) : NULL
  const socketPromise = browser ? loadGLTF('/target/socket-' + part + variantURL(key) + '.glb') : NULL
  const path = KEY_URLS[part]
  const source = path.startsWith('/src/assets')
    ? `https://github.com/rianadon/Cosmos-Keyboards/tree/main${path}`
    : null

  const size = socketSize({ type: part } as any)
  const bottom = partBottom(part, variant)

  Promise.all([partPromise, socketPromise]).then(() => (loading = false))
</script>

<div
  class="text-white bg-gray-800 px-2 pt-4 rounded-2 shadow-lg shadow-pink/15 relative"
  class:opacity-50={loading}
>
  <div class="text-center text-lg mb-1">{name}</div>
  <div class="text-sm text-gray-400 text-center">
    <code class="tracking-tight">Expert Mode: {part}</code>
  </div>
  {#if Object.keys(variant).length}
    <div class="text-sm text-gray-400 text-center">
      <code class="tracking-tight">Variant: {variantURL(key)}</code>
    </div>
  {/if}
  {#if source}
    <a
      href={source}
      class="absolute top-[1.2em] right-[0.5em] color-gray-500 hover:color-teal-500"
      bind:this={ref}
    >
      <Icon path={mdiFileEyeOutline} size="24" />
    </a>
    <Popover triggerEvents={['hover', 'focus']} referenceElement={ref} spaceAway={4}>
      <div
        class="bg-[#0F172A] shadow shadow-black py-1 px-2 rounded text-sm"
        in:fade={{ duration: 50 }}
        out:fade={{ duration: 150 }}
      >
        View Source on GitHub
      </div>
    </Popover>
  {/if}
  <div class="flex">
    <div class="aspect-1 relative w-full">
      <CoopCanvas>
        {#await partPromise then partMesh}
          <T.Mesh geometry={partMesh}><KeyboardMaterial kind="key" brightness={0.7} /></T.Mesh>
        {/await}
        {#await socketPromise then socketMesh}
          <T.Mesh geometry={socketMesh} kind="case"><KeyboardMaterial kind="case" /></T.Mesh>
        {/await}
        {#if dev && part !== 'trackball' && !part.includes('cirque')}
          <T.Mesh
            geometry={makeBox(size.x / 2 + 5, 0, -size.z / 2, 10, size.y, size.z)}
            material={new MeshBasicMaterial({ color: 0x14b8a6 })}
          />
          <T.Mesh
            geometry={makeBox(-size.x / 2 - 5, 0, -size.z / 2, 10, size.y, size.z)}
            material={new MeshBasicMaterial({ color: 0x14b8a6 })}
          />
        {/if}
        {#if dev}
          {#each bottom as b}
            <T.Mesh
              geometry={makeBox(0, 0, b[0][2] + 1, 2 * Math.abs(b[0][0]), 2 * Math.abs(b[0][1]), 2)}
              material={new MeshBasicMaterial({ color: 0xdc2626, transparent: true, opacity: 0.5 })}
            />
          {/each}
        {/if}
        <T.OrthographicCamera makeDefault position={[0, -100, 0]} zoom={0.034}>
          <OrbitControls enableZoom={false} enablePan={false} />
        </T.OrthographicCamera>
      </CoopCanvas>
    </div>
    <div class="aspect-1 relative w-full">
      <CoopCanvas>
        {#await socketPromise then socketMesh}
          <T.Mesh geometry={socketMesh}><KeyboardMaterial kind="case" /></T.Mesh>
        {/await}
        {#if dev && part !== 'trackball' && !part.includes('cirque')}
          <T.Mesh
            geometry={drawLinedRectangleOutside(-size.x / 2, -size.y / 2, size.x, size.y, 0.8)}
            material={new MeshBasicMaterial({ color: 0x14b8a6 })}
          />
        {/if}
        <T.OrthographicCamera makeDefault position={[0, 0, 100]} zoom={0.034}>
          <OrbitControls enableZoom={false} enablePan={false} />
        </T.OrthographicCamera>
      </CoopCanvas>
    </div>
  </div>
</div>
