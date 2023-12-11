<script lang="ts">
  import KeyboardMesh from '$lib/3d/KeyboardMesh.svelte'
  import { partGeometry } from '$lib/loaders/parts'
  import { Mesh, OrbitControls, OrthographicCamera } from 'svelte-cubed'
  import loadGLTF from '$lib/loaders/gltfLoader'
  import { mdiFileEyeOutline } from '@mdi/js'
  import Icon from '$lib/presentation/Icon.svelte'
  import { KEY_URLS } from '$lib/worker/socketsLoader'
  import Popover from 'svelte-easy-popover/dist/ts/Popover.svelte'
  import { fade } from 'svelte/transition'
  import { browser } from '$app/environment'
  import { drawLinedRectangleOutside, makeBox } from '../beta/lib/viewers/viewerHelpers'
  import { MeshBasicMaterial } from 'three'
  import { partBottom, socketSize } from '$lib/geometry/socketsParts'
  import CoopScene from '$lib/3d/CoopScene.svelte'

  export let name: string
  export let part: string
  export let dev = true
  let loading = true
  let ref: HTMLElement

  const NULL = Promise.resolve(undefined)
  const partPromise = browser ? partGeometry(part as any) : NULL
  const socketPromise = browser ? loadGLTF('/target/socket-' + part + '.glb') : NULL
  const path = KEY_URLS[part]
  const source = path.startsWith('/src/assets')
    ? `https://github.com/rianadon/Cosmos-Keyboards/tree/main${path}`
    : null

  const size = socketSize({ type: part } as any)
  const bottom = partBottom(part as any)

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
      <CoopScene>
        {#await partPromise then partMesh}
          <KeyboardMesh geometry={partMesh} kind="key" brightness={0.7} />
        {/await}
        {#await socketPromise then socketMesh}
          <KeyboardMesh geometry={socketMesh} kind="case" />
        {/await}
        {#if dev && part !== 'trackball' && !part.includes('cirque')}
          <Mesh
            geometry={makeBox(size.x / 2 + 5, 0, -size.z / 2, 10, size.y, size.z)}
            material={new MeshBasicMaterial({ color: 0x14b8a6 })}
          />
          <Mesh
            geometry={makeBox(-size.x / 2 - 5, 0, -size.z / 2, 10, size.y, size.z)}
            material={new MeshBasicMaterial({ color: 0x14b8a6 })}
          />
        {/if}
        {#if dev}
          {#each bottom as b}
            <Mesh
              geometry={makeBox(0, 0, b[0][2] + 1, 2 * Math.abs(b[0][0]), 2 * Math.abs(b[0][1]), 2)}
              material={new MeshBasicMaterial({ color: 0xdc2626, transparent: true, opacity: 0.5 })}
            />
          {/each}
        {/if}
        <OrthographicCamera position={[0, -100, 0]} zoom={0.034} />
        <OrbitControls enableZoom={false} enablePan={false} />
      </CoopScene>
    </div>
    <div class="aspect-1 relative w-full">
      <CoopScene>
        {#await socketPromise then socketMesh}
          <KeyboardMesh geometry={socketMesh} kind="case" />
        {/await}
        {#if dev && part !== 'trackball' && !part.includes('cirque')}
          <Mesh
            geometry={drawLinedRectangleOutside(-size.x / 2, -size.y / 2, size.x, size.y, 0.8)}
            material={new MeshBasicMaterial({ color: 0x14b8a6 })}
          />
        {/if}
        <OrthographicCamera position={[0, 0, 100]} zoom={0.034} />
        <OrbitControls enableZoom={false} enablePan={false} />
      </CoopScene>
    </div>
  </div>
</div>
