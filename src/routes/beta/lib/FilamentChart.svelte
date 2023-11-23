<script lang="ts">
  import { tweened } from 'svelte/motion'
  import { cubicOut } from 'svelte/easing'

  export let fractionKeyboard: number
  export let size = '4em'

  const angle = tweened(0, { easing: cubicOut, duration: 400 })
  $: angle.update(() => 360 * fractionKeyboard)
</script>

<div class="text-left flex flex-col items-center">
  <div
    class="chart rounded-full mb-2"
    style:--angle={$angle + 'deg'}
    style:width={size}
    style:height={size}
  />
  <div class="text-sm text-gray-600 dark:text-gray-100">
    <p class="whitespace-nowrap flex items-center gap-2 mb-[-0.1em]">
      <span class="inline-block w-2 h-2 bg-teal-400" /> Keyboard
    </p>
    <p class="whitespace-nowrap flex items-center gap-2">
      <span class="inline-block w-2 h-2 bg-purple-400" /> Supports
    </p>
  </div>
</div>

<style>
  .chart {
    --hole: 45%;
    background: radial-gradient(
        theme('colors.gray.100') var(--hole),
        transparent calc(var(--hole) + 1%)
      ),
      conic-gradient(transparent 0deg var(--angle), theme('colors.purple.400') var(--angle) 360deg),
      theme('colors.teal.400');
  }

  @media (prefers-color-scheme: dark) {
    .chart {
      background: radial-gradient(
          theme('colors.gray.700') var(--hole),
          transparent calc(var(--hole) + 1%)
        ),
        conic-gradient(
          transparent 0deg var(--angle),
          theme('colors.purple.400') var(--angle) 360deg
        ),
        theme('colors.teal.500');
    }
  }
</style>
