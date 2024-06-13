<script lang="ts">
  import { T } from '@threlte/core'
  import { hoveredKey, clickedKey, selectMode, protoConfig } from '$lib/store'
  import type { BufferGeometry } from 'three'
  import KeyboardMaterial from './KeyboardMaterial.svelte'
  import type { KeyStatus } from './keyboardKey'
  import { getContext } from 'svelte'
  import type { InteractivityContext } from '@threlte/extras/dist/interactivity/context'
  import { nthKey, type CosmosKeyboard } from '$lib/worker/config.cosmos'

  export let geometry: BufferGeometry | undefined
  export let index: number | null

  export let opacity = 1
  export let brightness = 1
  export let status: KeyStatus = undefined
  export let letter: string | undefined = undefined
  export let flip = false

  const context: InteractivityContext = getContext('interactivity')

  function isActive(c: CosmosKeyboard, mode: 'key' | 'column' | 'cluster', n: number | null) {
    if (index == null) return false
    if (n == null) {
      return false
    } else if (mode == 'key') {
      return index === n
    } else if (mode == 'column') {
      return nthKey(c, index).column == nthKey(c, n).column
    } else if (mode == 'cluster') {
      return nthKey(c, index).cluster == nthKey(c, n).cluster
    }
  }

  $: selected = isActive($protoConfig, $selectMode, $clickedKey)
  $: hovered = isActive($protoConfig, $selectMode, $hoveredKey)
</script>

{#if geometry}
  <T.Mesh
    {geometry}
    {...$$restProps}
    visible={$$restProps.visible && opacity > 0}
    on:pointerenter={() => ($hoveredKey = index)}
    on:pointerleave={() => ($hoveredKey = null)}
    on:click={() => ($clickedKey = index)}
    on:pointermissed={() => {
      if (!context.initialHits.length) $clickedKey = null
    }}
  >
    <KeyboardMaterial
      kind="key"
      {opacity}
      {status}
      {letter}
      {flip}
      brightness={selected ? 0.3 : hovered ? 0.5 : brightness}
    />
  </T.Mesh>
{/if}
