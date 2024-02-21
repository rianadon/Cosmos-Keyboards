<script lang="ts">
  import { boardGeometries } from '$lib/loaders/boardElement'
  import type { Cuttleform, Geometry } from '$lib/worker/config'
  import KeyboardMesh from './KeyboardMesh.svelte'

  export let conf: Cuttleform
  export let geometry: Geometry | null
  export let showSupports: boolean

  $: boardGeos =
    conf?.microcontroller && geometry ? boardGeometries(conf, geometry) : Promise.resolve([])
</script>

{#await boardGeos then boards}
  {#each boards as board}
    <KeyboardMesh kind="key" geometry={board} visible={!showSupports} />
  {/each}
{/await}
