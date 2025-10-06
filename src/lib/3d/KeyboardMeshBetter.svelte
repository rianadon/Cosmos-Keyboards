<script lang="ts">
  import { BufferGeometry } from 'three'
  import KeyboardMaterial from './KeyboardMaterial.svelte'
  import type { KeyStatus } from './keyboardKey'
  import { T } from '@threlte/core'
  import type { ShapeMesh } from '$lib/worker/modeling'
  import { fromGeometry } from '$lib/loaders/geometry'
  import { onDestroy } from 'svelte'

  export let geometry: ShapeMesh | undefined
  let threeGeo: BufferGeometry | undefined = undefined

  $: onNewGeometry(geometry)
  function onNewGeometry(geo: ShapeMesh | undefined) {
    if (threeGeo) threeGeo.dispose()
    threeGeo = fromGeometry(geo, useColors)
  }

  onDestroy(() => threeGeo && threeGeo.dispose())

  export let opacity = 1
  export let brightness = 1
  export let kind: 'key' | 'case'
  export let status: KeyStatus = undefined
  export let letter: string | undefined = undefined
  export let color: [any, number] | undefined = undefined
  export let useColors = false
</script>

{#if threeGeo}
  <T.Mesh geometry={threeGeo} {...$$restProps} visible={$$restProps.visible && opacity > 0}>
    {#if color}
      <T.MeshStandardMaterial color={color[0]} transparent={true} opacity={color[1]} />
    {:else}
      <KeyboardMaterial {opacity} {brightness} {kind} {status} {letter} {useColors} />
    {/if}
  </T.Mesh>
{/if}
