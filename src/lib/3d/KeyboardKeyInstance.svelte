<script lang="ts">
  import { hoveredKey, clickedKey, selectMode, protoConfig } from '$lib/store'
  import { getContext } from 'svelte'
  import { nthKey, type CosmosKeyboard } from '$lib/worker/config.cosmos'
  import { Instance, interactivity } from '@threlte/extras'
  import type { Vector3Tuple, Vector4Tuple } from 'three'

  export let brightness: number
  export let index: number | null
  export let position: Vector3Tuple
  export let rotation: Vector4Tuple

  type InteractivityContext = ReturnType<typeof interactivity>
  const context: InteractivityContext = getContext('interactivity')

  function isActive(
    index: number | null,
    c: CosmosKeyboard,
    mode: 'key' | 'column' | 'cluster',
    n: number | null
  ) {
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

  $: selected = isActive(index, $protoConfig, $selectMode, $clickedKey)
  $: hovered = isActive(index, $protoConfig, $selectMode, $hoveredKey)
</script>

<Instance
  brightness={selected ? 0.3 : hovered ? 0.5 : brightness}
  {position}
  quaternion={rotation}
  on:pointerenter={() => ($hoveredKey = index)}
  on:pointerleave={() => ($hoveredKey = null)}
  on:click={() => ($clickedKey = index)}
  on:pointermissed={() => {
    if (!context.initialHits.length) $clickedKey = null
  }}
/>
