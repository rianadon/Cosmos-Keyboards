<script lang="ts">
  import { T } from '@threlte/core'
  import { hoveredKey, clickedKey, clickedVisualSide } from '$lib/store'
  import { getContext } from 'svelte'
  import type { interactivity } from '@threlte/extras'

  export let index: number | null
  export let side: 'left' | 'right' | 'unibody' = 'right'

  type InteractivityContext = ReturnType<typeof interactivity>
  const context: InteractivityContext = getContext('interactivity')

  function onClick() {
    $clickedKey = index
    $clickedVisualSide = side
  }
</script>

<T.Mesh
  {...$$restProps}
  on:pointerenter={() => ($hoveredKey = index)}
  on:pointerleave={() => ($hoveredKey = null)}
  on:click={onClick}
  on:pointermissed={() => {
    if (!context.initialHits.length) {
      $clickedKey = null
      $clickedVisualSide = null
    }
  }}
>
  <slot />
</T.Mesh>
