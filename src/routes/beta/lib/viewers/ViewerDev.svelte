<script lang="ts">
  import Checkbox from '$lib/presentation/Checkbox.svelte'
  import { debugViewport, showTiming, showKeyInts, showGizmo, protoConfig, noStitch } from '$lib/store'
  import { stringifyCluster, type CosmosCluster } from '$lib/worker/config.cosmos'
  import { encodeCosmosCluster } from '$lib/worker/config.serialize'
  import { capitalize } from '$lib/worker/util'
  import { Cluster } from '../../../../../target/proto/cosmos'
  import type { FullGeometry } from './viewer3dHelpers'

  export let geometry: FullGeometry | null

  function clusterToB64(cluster: CosmosCluster | undefined) {
    if (!cluster) return 'error'
    return window.btoa(String.fromCharCode(...Cluster.toBinary(encodeCosmosCluster(cluster))))
  }
</script>

<!-- svelte-ignore a11y-label-has-associated-control -->
<div class="p-12">
  <label class="flex items-center my-2">
    <Checkbox basic bind:value={$showTiming} /> Timings Viewer
  </label>
  <!-- Hide base and hide walls are now editable from the view menu -->
  <!-- <label class="flex items-center my-2">
    <Checkbox basic bind:value={$noWall} /> Hide Wall
  </label>
  <label class="flex items-center my-2">
    <Checkbox basic bind:value={$noBase} /> Hide Base
  </label> -->
  <label class="flex items-center my-2">
    <Checkbox basic bind:value={$showKeyInts} /> Show Key Intersection Geometry
  </label>
  <label class="flex items-center my-2">
    <Checkbox basic bind:value={$showGizmo} /> Show Orientation Gizmo
  </label>
  <label class="flex items-center my-2">
    <Checkbox basic bind:value={$debugViewport} /> Viewport Debugging View
  </label>
  <label class="flex items-center my-2">
    <Checkbox basic bind:value={$noStitch} /> Disable Wall Stitching @ Export
  </label>
  {#if $protoConfig}
    <div class="mt-5">Encoded Right Thumb Cluster</div>
    <div class="code">
      {clusterToB64($protoConfig.clusters.find((c) => c.side == 'right' && c.name == 'thumbs'))}
    </div>
    <div class="code0">
      {stringifyCluster(
        $protoConfig.clusters.find((c) => c.side == 'right' && c.name == 'thumbs')
      ).substring(0, 290)}&hellip;
    </div>
  {/if}
  {#if geometry}
    <div class="mt-5">Key and Connector Positions</div>
    {#each Object.entries(geometry) as [kbd, geo]}
      <details class="text-sm">
        <summary>View {capitalize(kbd)} Side</summary>
        <div class="mt-2">Keys</div>
        <div class="code overflow-auto max-h-20">
          {JSON.stringify(geo.keyHolesTrsfs.map((t) => t.xyz()))}
        </div>
        <div class="mt-2">Connector</div>
        <div class="code">
          {JSON.stringify(geo.connectorOrigin?.xyz())}
        </div>
      </details>
    {/each}
  {/if}
</div>

<style>
  .code {
    --at-apply: 'break-all w-140 text-xs font-mono my-2 bg-gray-100 dark:bg-slate-900 rounded px-2 py-0.5';
  }
</style>
