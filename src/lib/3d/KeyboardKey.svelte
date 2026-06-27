<script lang="ts">
  import { T } from '@threlte/core'
  import { hoveredKey, clickedKey, clickedSide } from '$lib/store'
  import { getContext } from 'svelte'
  import type { interactivity } from '@threlte/extras'

  export let index: number | null
  export let side: 'left' | 'right' | 'unibody' | 'center' = 'right'

  type InteractivityContext = ReturnType<typeof interactivity>
  const context: InteractivityContext = getContext('interactivity')
</script>

<T.Mesh
  {...$$restProps}
  on:pointerenter={() => ($hoveredKey = index)}
  on:pointerleave={() => ($hoveredKey = null)}
  on:click={() => {
    $clickedKey = index
    $clickedSide = side
  }}
  on:pointermissed={() => {
    if (!context.initialHits.length) {
      $clickedKey = null
      $clickedSide = null
    }
  }}
>
  <slot />
</T.Mesh>
