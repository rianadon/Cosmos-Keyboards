<script lang="ts">
  import Checkbox from '$lib/presentation/Checkbox.svelte'
  import { debugViewport, showTiming, noBase, noWall, showKeyInts } from '$lib/store'
</script>

<!-- svelte-ignore a11y-label-has-associated-control -->
<div class="p-12">
  <label class="flex items-center my-2">
    <Checkbox basic bind:value={$showTiming} /> Timings Viewer
  </label>
  <label class="flex items-center my-2">
    <Checkbox basic bind:value={$noWall} /> Hide Wall
  </label>
  <label class="flex items-center my-2">
    <Checkbox basic bind:value={$noBase} /> Hide Base
  </label>
  <label class="flex items-center my-2">
    <Checkbox basic bind:value={$showKeyInts} /> Show Key Intersection Geometry
  </label>
  <label class="flex items-center my-2">
    <Checkbox basic bind:value={$debugViewport} /> Viewport Debugging View
  </label>
</div>
