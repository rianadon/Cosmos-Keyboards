<script lang="ts">
  import type { WorkerPool } from '../workerPool'
  import WorkerStatus from './ViewerTimingWorkerStatus.svelte'

  export let pool: WorkerPool<unknown>
  export let darkMode: boolean

  const history = pool.history

  $: start = Math.min(...$history.map((h) => h.start))
  $: end = Math.max(...$history.map((h) => h.end))
  $: range = end - start

  const HEIGHT = 6

  function color(i: number, oc: boolean, darkMode: boolean) {
    // LCG Random generator
    let random = 234
    for (let j = 0; j < i; j++) random = (1103515245 * random + 12345) % 2 ** 31

    const hue = (random % 220) + 140

    if (oc) {
      if (darkMode) return `hsl(${hue}, 60%, 50%)`
      return `hsl(${hue}, 100%, 82%)`
    } else {
      if (darkMode) return `hsl(${hue}, 40%, 45%)`
      return `hsl(${hue}, 90%, 88%)`
    }
  }
</script>

<div class="mb-10">
  {#each pool.workers as worker}
    <WorkerStatus {worker} />
  {/each}
</div>

<svg viewBox="0 0 100 100">
  <defs>
    <!-- Dots laid out in a hexagon pattern -->
    <pattern id="dotsPattern" y="0.4" width="2" height="1.73205" patternUnits="userSpaceOnUse">
      <g style="stroke: none; fill: {darkMode ? 'white' : 'black'}; fill-opacity: 0.4">
        <circle cx="0" cy="0" r="0.3" />
        <circle cx="1" cy="0" r="0.3" />
        <circle cx="2" cy="0" r="0.3" />
        <circle cx="0.5" cy="0.866025" r="0.3" />
        <circle cx="1.5" cy="0.866025" r="0.3" />
        <circle cx="0" cy="1.73205" r="0.3" />
        <circle cx="1" cy="1.73205" r="0.3" />
        <circle cx="2" cy="1.73205" r="0.3" />
      </g>
    </pattern>
  </defs>
  {#each $history as h, i}
    <rect
      fill={color(i, true, darkMode)}
      x={((h.start - start) / range) * 100}
      y={h.index * HEIGHT}
      width={(h.ocTime / range) * 100}
      height={HEIGHT}
    />
    <rect
      fill="url(#dotsPattern)"
      x={((h.start - start) / range) * 100}
      y={h.index * HEIGHT}
      width={(h.ocTime / range) * 100}
      height={HEIGHT}
    />
    <rect
      fill={color(i, false, darkMode)}
      x={((h.start + h.ocTime - start) / range) * 100}
      y={h.index * HEIGHT}
      width={((h.end - h.start) / range) * 100}
      height={HEIGHT}
    />
    <text
      x={((h.start - start) / range) * 100 + Math.max((h.ocTime / range) * 100, 1.5) + 0.5}
      y={h.index * HEIGHT + 4.3}>{h.name}</text
    >
  {/each}
</svg>

<style>
  text {
    font-size: 3px;
    fill: currentColor;
  }
</style>
