<script lang="ts">
  import Icon from '$lib/presentation/Icon.svelte'
  import { mdiChevronLeftCircle, mdiChevronRightCircle } from '@mdi/js'
  import Siema from 'siema'
  import { onMount } from 'svelte'

  export let perPage = 1
  export let loop = true
  export let duration = 200
  export let easing = 'ease-out'
  export let startIndex = 0
  export let draggable = true
  export let multipleDrag = true
  export let dots = true
  export let controls = true
  export let threshold = 20
  export let rtl = false
  let currentIndex = startIndex

  let siema: HTMLElement | undefined
  let controller: Siema

  $: pips = controller ? (controller as any).innerElements : []
  $: currentPerPage = controller ? controller.perPage : perPage
  $: totalDots = controller ? Math.ceil((controller as any).innerElements.length / currentPerPage) : []

  onMount(() => {
    controller = new Siema({
      selector: siema,
      perPage: typeof perPage === 'object' ? perPage : Number(perPage),
      loop,
      duration,
      easing,
      startIndex,
      draggable,
      multipleDrag,
      threshold,
      rtl,
      onChange: () => (currentIndex = controller.currentSlide),
    })

    return () => {
      controller.destroy()
    }
  })

  export function isDotActive(currentIndex: number, dotIndex: number) {
    if (currentIndex < 0) currentIndex = pips.length + currentIndex
    return (
      currentIndex >= dotIndex * currentPerPage &&
      currentIndex < dotIndex * currentPerPage + currentPerPage
    )
  }
</script>

<div class="color-black relative w-full justify-center items-center">
  <div class="slides" bind:this={siema}>
    <slot />
  </div>
  {#if controls}
    <button class="control left-[2vw]" on:click={() => controller.prev()} aria-label="left">
      <Icon path={mdiChevronLeftCircle} size={36} />
    </button>
    <button class="control right-[2vw]" on:click={() => controller.next()} aria-label="right">
      <Icon path={mdiChevronRightCircle} size={36} />
    </button>
  {/if}
  {#if dots}
    <div class="dots">
      {#each new Array(totalDots) as _, i}
        <button
          on:click={() => controller.goTo(i * currentPerPage)}
          class="p-1 m-0.5 rounded-full"
          class:active={isDotActive(currentIndex, i)}
        >
          <div class="dot" />
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .control {
    --at-apply: 'absolute opacity-70 rounded-full mt-[-18px] top-[50%] z-1 transition-opacity';
  }
  .control:hover {
    opacity: 1;
  }

  .dots {
    --at-apply: 'absolute flex justify-center w-full mt--30px';
  }
  .dot {
    --at-apply: 'w-3 h-3 bg-black rounded-full transition-opacity opacity-50';
  }

  .dots > button:hover > .dot {
    opacity: 0.85;
  }
  .dots > button.active > .dot {
    opacity: 1;
  }
</style>
