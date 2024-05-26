<script lang="ts">
  import { T } from '@threlte/core'
  import { hoveredKey, clickedKey } from '$lib/store'
  import type { BufferGeometry } from 'three'
  import KeyboardMaterial from './KeyboardMaterial.svelte'
  import type { KeyStatus } from './keyboardKey'
  import { getContext } from 'svelte'
  import type { InteractivityContext } from '@threlte/extras/dist/interactivity/context'

  export let geometry: BufferGeometry | undefined
  export let index: number

  export let opacity = 1
  export let brightness = 1
  export let status: KeyStatus = undefined
  export let letter: string | undefined = undefined

  const context: InteractivityContext = getContext('interactivity')
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
      brightness={index === $clickedKey ? 0.3 : index == $hoveredKey ? 0.5 : brightness}
    />
  </T.Mesh>
{/if}
