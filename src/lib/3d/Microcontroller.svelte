<script lang="ts">
  import { boardGeometries } from '$lib/loaders/boardElement'
  import type { Cuttleform, Geometry } from '$lib/worker/config'
  import { T } from '@threlte/core'
  import KeyboardMaterial from './KeyboardMaterial.svelte'

  export let conf: Cuttleform | undefined
  export let geometry: Geometry | null
  export let showSupports: boolean

  $: boardGeos =
    conf?.microcontroller && geometry ? boardGeometries(conf, geometry) : Promise.resolve([])
</script>

{#await boardGeos then boards}
  {#each boards as board}
    <T.Mesh geometry={board} visible={!showSupports}>
      <KeyboardMaterial kind="key" />
    </T.Mesh>
  {/each}
{/await}
