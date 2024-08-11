<script lang="ts">
  import { T } from '@threlte/core'
  import { hoveredKey, clickedKey } from '$lib/store'
  import { getContext } from 'svelte'
  import type { interactivity } from '@threlte/extras'

  export let index: number | null

  type InteractivityContext = ReturnType<typeof interactivity>
  const context: InteractivityContext = getContext('interactivity')
</script>

<T.Mesh
  {...$$restProps}
  on:pointerenter={() => ($hoveredKey = index)}
  on:pointerleave={() => ($hoveredKey = null)}
  on:click={() => ($clickedKey = index)}
  on:pointermissed={() => {
    if (!context.initialHits.length) $clickedKey = null
  }}
>
  <slot />
</T.Mesh>
