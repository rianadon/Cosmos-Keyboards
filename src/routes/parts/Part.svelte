<script lang="ts">
  import { partGeometry } from '$lib/loaders/parts'
  import loadGLTF from '$lib/loaders/gltfLoader'
  import {
    mdiAlertCircleOutline,
    mdiChevronDown,
    mdiFileEyeOutline,
    mdiLightningBoltOutline,
  } from '@mdi/js'
  import Icon from '$lib/presentation/Icon.svelte'
  import Popover from 'svelte-easy-popover/dist/ts/Popover.svelte'
  import { fade } from 'svelte/transition'
  import { browser } from '$app/environment'
  import {
    drawLinedCircleOutside,
    drawLinedRectangleOutside,
    makeBox,
  } from '../beta/lib/viewers/viewerHelpers'
  import { MeshBasicMaterial } from 'three'
  import {
    decodeVariant,
    PART_INFO,
    partBottom,
    socketSize,
    variantURL,
  } from '$lib/geometry/socketsParts'
  import CoopCanvas from '$lib/3d/CoopCanvas.svelte'
  import { T } from '@threlte/core'
  import { OrbitControls } from '@threlte/extras'
  import type { CuttleKey } from '$lib/worker/config'
  import KeyboardMaterial from '$lib/3d/KeyboardMaterial.svelte'
  import { pluralizeLastWord, trim } from '$lib/worker/util'
  import { createEventDispatcher } from 'svelte'
  import Description from './Description.svelte'

  export let name: string
  export let part: CuttleKey['type']
  export let dev = true
  export let variant: Record<string, any> = decodeVariant(part, 0) || {}
  export let editable = true
  let loading = true
  let ref: HTMLElement

  const NULL = Promise.resolve(undefined)
  const dispatch = createEventDispatcher()
  const updateVariant = (key: string, tg: EventTarget | null) =>
    (variant[key] = (tg as HTMLSelectElement).value)

  $: key = { type: part, variant } as any
  $: partPromise = browser ? partGeometry(part as any, variant) : NULL
  $: socketPromise = browser ? loadGLTF('/target/socket-' + part + variantURL(key) + '.glb') : NULL
  $: info = PART_INFO[part]
  $: path = info.stepFile
  $: source = path.startsWith('/src/assets')
    ? `https://github.com/rianadon/Cosmos-Keyboards/tree/main${path}`
    : null

  $: size = socketSize(key)
  $: width = 'radius' in size ? size.radius * 2 : size[0]
  $: length = 'radius' in size ? size.radius * 2 : size[1]
  $: height = 'radius' in size ? size.height : size[2]
  $: bottom = partBottom(key)

  $: Promise.all([partPromise, socketPromise]).then(() => (loading = false))

  $: trimmedDesc = trim(info.description || '', 200) || ''
  $: trimmed = true

  $: requirements =
    'variants' in info
      ? {
          bomName: info.bomName(editable ? {} : variant),
          extraBomItems: info.extraBomItems ? info.extraBomItems(editable ? {} : variant) : {},
        }
      : {
          bomName: info.bomName,
          extraBomItems: info.extraBomItems ? info.extraBomItems : {},
        }
</script>

<div
  class="text-white bg-gray-800 px-2 pt-4 rounded-2 shadow-lg shadow-pink/15 relative"
  class:opacity-50={loading}
>
  <div class="text-center text-lg mb-1">{name}</div>
  <div class="text-sm text-gray-400 text-center">
    <code class="tracking-tight">Expert Mode: {part}</code>
  </div>
  {#if !editable && Object.keys(variant).length}
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
  {:else}
    <div class="absolute top-[1.2em] right-[0.5em] color-gray-500 hover:color-teal-500" bind:this={ref}>
      <Icon path={mdiLightningBoltOutline} size="24" />
    </div>
    <Popover triggerEvents={['hover', 'focus']} referenceElement={ref} spaceAway={4}>
      <div
        class="bg-[#0F172A] shadow shadow-black py-1 px-2 rounded text-sm"
        in:fade={{ duration: 50 }}
        out:fade={{ duration: 150 }}
      >
        Parametrically Generated
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
        {#if dev}
          <T.Mesh
            geometry={makeBox(width / 2 + 5, 0, -height / 2, 10, length, height)}
            material={new MeshBasicMaterial({ color: 0x14b8a6 })}
          />
          <T.Mesh
            geometry={makeBox(-width / 2 - 5, 0, -height / 2, 10, length, height)}
            material={new MeshBasicMaterial({ color: 0x14b8a6 })}
          />
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
        {#if dev}
          <T.Mesh
            geometry={'radius' in size
              ? drawLinedCircleOutside(0, 0, size.radius, 0.8)
              : drawLinedRectangleOutside(-width / 2, -length / 2, width, length, 0.8)}
            material={new MeshBasicMaterial({ color: 0x14b8a6 })}
          />
        {/if}
        <T.OrthographicCamera makeDefault position={[0, 0, 100]} zoom={0.034}>
          <OrbitControls enableZoom={false} enablePan={false} />
        </T.OrthographicCamera>
      </CoopCanvas>
    </div>
  </div>
  {#if editable && 'variants' in info}
    <div class="flex justify-around flex-wrap">
      {#each Object.entries(info.variants) as [key, opt]}
        <select
          class="w-40 h-8 px-4 bg-pink-900/70 rounded-1 mb-2"
          class:w-30!={key == 'led'}
          class:w-34!={key == 'sensor'}
          value={variant[key]}
          on:change={(ev) => updateVariant(key, ev.target)}
        >
          {#each opt as part}
            <option value={part}>{part}</option>
          {/each}
        </select>
      {/each}
    </div>
  {/if}
  {#if editable}
    <div class="mx-2 mb-4 cosmospartinfo text-sm">
      <Description description={trimmed ? trimmedDesc : info.description || ''} />
      {#if trimmedDesc != info.description}
        {#if trimmed}<button on:click={() => (trimmed = !trimmed)}>[More...]</button>
        {:else}<button on:click={() => (trimmed = !trimmed)}>[...Less]</button>
        {/if}
      {/if}
    </div>
  {/if}

  {#if editable && 'variants' in info}
    <button
      class="requirements bg-pink-900/20 mt-3 px-4 py-2 rounded mx-auto block"
      on:click={() => dispatch('expand')}
    >
      [Expand all Variants and Requirements]
    </button>
  {:else}
    <div class="requirements bg-pink-900/20 mt-3 px-4 pb-2 py-0.5 rounded">
      <p class="text-xs font-medium">Requirements</p>
      <li class="flex items-center gap-2 text-sm">
        <Icon name={info.bomIcon || info.icon || 'switch'} class="opacity-70 flex-none" />
        <div class="text-start">1 {requirements.bomName}</div>
      </li>
      <ul>
        {#each Object.values(requirements.extraBomItems) as item}
          <li class="flex items-center gap-2 text-sm">
            <Icon name={item.icon} class="opacity-70 flex-none" />
            <div class="text-start">
              {Math.ceil(item.count)}
              {item.count > 1 ? pluralizeLastWord(item.item) : item.item}
            </div>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  :global(.cosmospartinfo p) {
    --at-apply: 'mb-1';
  }
  :global(.cosmospartinfo a) {
    --at-apply: 'underline text-pink-400';
  }
</style>
