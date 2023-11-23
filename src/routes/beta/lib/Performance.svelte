<script lang="ts">
  import { onMount } from 'svelte'

  let heap = 0

  onMount(() => {
    const interval = setInterval(() => {
      heap = performance.memory.totalJSHeapSize
    }, 1000)

    return () => clearInterval(interval)
  })
</script>

<div class="bg-white text-black fixed top-0 right-0 p-4 z-10 rounded">
  {(heap / 1e6).toFixed(2)} MB
</div>
