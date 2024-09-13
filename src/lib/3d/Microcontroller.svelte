<script lang="ts">
  import { boardGeometries } from '$lib/loaders/boardElement'
  import type { Cuttleform, Geometry } from '$lib/worker/config'
  import { T } from '@threlte/core'
  import KeyboardMaterial from './KeyboardMaterial.svelte'
  import GroupMatrix from './GroupMatrix.svelte'

  export let geometry: Geometry | undefined
  export let showSupports: boolean
  export let flip = false

  $: boardGeos = geometry?.c.microcontroller
    ? boardGeometries(geometry.c, geometry)
    : Promise.resolve([])
</script>

{#await boardGeos then boards}
  {#each boards as board}
    <GroupMatrix matrix={board.matrix}>
      <T.Mesh geometry={board.board} visible={!showSupports} scale={flip ? [-1, 1, 1] : [1, 1, 1]}>
        <KeyboardMaterial kind="key" />
      </T.Mesh>
    </GroupMatrix>
  {/each}
{/await}
