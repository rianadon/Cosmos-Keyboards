<script lang="ts">
  import { fade, fly } from 'svelte/transition'
  import { mmToPx, step } from '../store'

  export let showNext: boolean | string = false
  export let showPrevious: boolean | string = false
  const nextstep = () => $step++
  const prevstep = () => $step--
</script>

<div
  class="bg-slate-800 absolute left-0 right-0 top-0 bottom-0 rounded text-left pb-2 flex gap-12 gridlines"
  style="background-size: {10 * $mmToPx}px {10 * $mmToPx}px"
  in:fly={{ x: 100, delay: 100, duration: 300 }}
  out:fly={{ x: -100, delay: 100, duration: 300 }}
>
  <div class="flex-1 overflow-x-hidden">
    <div class="grid-hide px-8 pt-2 pb-8 rounded-t">
      <h2 class="my-4 text-3xl font-semibold"><slot name="title" /></h2>
      <div class="max-w-prose">
        <slot name="prose" />
      </div>
    </div>
    <div class="px-4" class:mr-40={showNext || showPrevious}><slot name="content" /></div>
  </div>
  {#if showNext || showPrevious}
    <div class="w-36 flex flex-col justify-center flex-none absolute top-0 bottom-0 right-[1rem]">
      {#if showNext}
        <button
          class="mt-10 bg-gradient-to-br from-purple-400 to-amber-600 text-xl p-1 rounded-2 shadow-lg shadow-pink/40 transition-all hover:shadow-pink/60 hover:scale-105 hover:-translate-y-0.5"
          on:click={nextstep}
        >
          <span class="block bg-slate-900 px-8 py-2 rounded-1.5 text-pink-200 font-semibold">
            {typeof showNext == 'boolean' ? 'Next' : showNext}
          </span>
        </button>
      {/if}
      {#if showPrevious}
        <button
          class="mt-10 bg-gradient-to-br from-purple-400 to-amber-600 text-xl p-1 rounded-2 shadow-lg shadow-pink/40 transition-all hover:shadow-pink/60 hover:scale-105 hover:-translate-y-0.5"
          on:click={prevstep}
        >
          <span class="block bg-slate-900 px-8 py-2 rounded-1.5 text-pink-200 font-semibold">
            {showPrevious}
          </span>
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .gridlines {
    --line-color: #334155;
    background-image: linear-gradient(to left, var(--line-color) 1px, transparent 1px),
      linear-gradient(to top, var(--line-color) 1px, transparent 1px);
  }
  .grid-hide {
    background-image: linear-gradient(to bottom, rgba(30, 41, 59, 0.8) 85%, transparent 100%);
  }
</style>
