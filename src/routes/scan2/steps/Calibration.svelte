<script lang="ts">
  import { onMount } from 'svelte'
  import Step from '../lib/Step.svelte'
  import { mmToPx } from '../store'
  import { browser } from '$app/environment'
  import Icon from '$lib/presentation/Icon.svelte'
  import { mdiResizeBottomRight } from '@mdi/js'

  const CREDIT_CARD = { width: 85.6, height: 53.98, borderRadius: 3.18 }
  let moveTimeout = 0
  let rate = 1

  let cardEl: HTMLElement
  let startX: number, startY: number, startMmToPx: number
  let screenWidth = 0,
    screenHeight = 0

  onMount(refreshScreenSize)
  function refreshScreenSize() {
    screenWidth = Math.max(window.innerWidth, screenWidth)
    screenHeight = Math.max(window.innerHeight, screenHeight)
  }

  function initDrag(e: MouseEvent, r: number) {
    startMmToPx = $mmToPx
    startX = e.clientX
    startY = e.clientY
    rate = r
  }
  function startDrag(e: MouseEvent) {
    initDrag(e, 1)
    document.documentElement.addEventListener('mousemove', doDrag, false)
    document.documentElement.addEventListener('mouseup', stopDrag, false)
    document.documentElement.addEventListener('blur', stopDrag, false)
  }
  function doDrag(e: MouseEvent) {
    const toPxX = startMmToPx + (rate * (e.clientX - startX)) / CREDIT_CARD.width
    const toPxY = startMmToPx + (rate * (e.clientY - startY)) / CREDIT_CARD.height
    $mmToPx = Math.round(Math.max(toPxX, toPxY) * 10000) / 10000
    if (rate == 1)
      moveTimeout = setTimeout(() => {
        if (rate == 1 && Math.abs($mmToPx - Math.max(toPxX, toPxY)) < 0.1) initDrag(e, 0.1)
      }, 1000) as any
  }
  function stopDrag(_e: Event) {
    rate = 1
    clearTimeout(moveTimeout)
    document.documentElement.removeEventListener('mousemove', doDrag, false)
    document.documentElement.removeEventListener('mouseup', stopDrag, false)
    document.documentElement.removeEventListener('blur', stopDrag, false)
  }

  function keyDown({ key }: KeyboardEvent) {
    if (key == 'ArrowRight' || key == 'ArrowDown') $mmToPx = (Math.round($mmToPx * 100) + 1) / 100
    if (key == 'ArrowLeft' || key == 'ArrowUp') $mmToPx = (Math.round($mmToPx * 100) - 1) / 100
  }

  $: screenSize = browser ? Math.sqrt(screenWidth ** 2 + screenHeight ** 2) / $mmToPx / 25.4 : 0
</script>

<svelte:window on:resize={refreshScreenSize} />

<Step showNext>
  <span slot="title">Calibrate Your Display</span>
  <div slot="prose">
    <p class="mb-2">
      For the next step, the tool needs to know the size of your screen. Match a credit/debit/id card to
      one shown on screen or use a ruler to confirm the gridlines are spaced by 1 cm.
    </p>
    {#if !browser}
      <div class="absolute bg-amber text-black mx-[-0.5rem] px-2 py-1 rounded">
        Please wait for the page to finish loading...
      </div>
    {:else if screenSize < 11}
      <div
        class="absolute bg-red text-black mx-[-1rem] px-4 py-1 rounded max-w-prose shadow-lg shadow-slate-800 z-100"
      >
        Your screen size is too small. Please switch to a laptop or desktop computer.<br />Don't worry
        about camera quality! You'll connect your phone in the next step.
      </div>
    {/if}
    <p>
      For best results, you should be viewing this page on a large screen and should keep the page
      full-screened. Click "Next" when you are finished.
    </p>
  </div>
  <div slot="content">
    <div class="mb-4 bg-slate-700 px-6 py-2 rounded inline-block">
      <label>
        dot/mm
        <div class="relative inline-block mr-6">
          <input
            class="input w-36 text-black"
            type="number"
            min="1"
            max="8"
            bind:value={$mmToPx}
            step={0.001}
          />
          <span class="text-right absolute top-0 bottom-0 right-9.5 w-9 input-units">/mm</span>
        </div>
      </label>
      {#if browser}
        The size of your screen is probably <span class="inline-block w-20"
          >{screenSize.toFixed(2)} in.</span
        >
      {/if}
    </div>
    <div class="mx-8">
      <div
        bind:this={cardEl}
        class="bg-white card text-black relative overflow-hidden"
        class:slow={rate != 1}
        style="width: {CREDIT_CARD.width * $mmToPx}px; height: {CREDIT_CARD.height *
          $mmToPx}px; border-radius: {CREDIT_CARD.borderRadius * $mmToPx}px;"
      >
        <div class="absolute top-[10.25%] bottom-[70.92%] left-0 right-0 bg-gray-200" />
        <div class="absolute bottom-3 right-12 text-pink-500 text-cente text-3xl font-bold italic">
          Drag Me →
        </div>
        <div
          tabIndex="0"
          class="absolute bottom-0 right-0 select-none resize-label p-2 bg-pink-400 rounded-tl-2 cursor-nwse-resize"
          on:mousedown={startDrag}
          on:keydown={keyDown}
        >
          <Icon path={mdiResizeBottomRight} />
        </div>
      </div>
    </div>
    <!-- {#if browser}
      <div class="fixed bottom-2 right-4 text-gray-500 leading-4">
        {screenWidth} &times; {screenHeight}<br />
        Diag: {Math.sqrt(screenWidth ** 2 + screenHeight ** 2).toFixed(2)}<br />
        Size: {(Math.sqrt(screenWidth ** 2 + screenHeight ** 2) / $mmToPx / 25.4).toFixed(2)}
      </div>
    {/if} -->
  </div>
</Step>

<style>
  .resize-label:focus {
    --at-apply: 'outline outline-1 outline-teal';
  }

  .slow {
    box-shadow: 0 0 2rem #64748b, 0 0 0.5rem #64748b;
  }

  .input {
    --at-apply: 'focus:border-teal-500 border border-transparent focus:outline-none';
    --at-apply: 'border-gray-700 dark:border-transparent bg-gray-800 text-gray-100';
    --at-apply: 'appearance-none rounded ml-2.5 text-ellipsis px-2';
  }

  .input-units {
    --at-apply: 'pointer-events-none text-sm flex items-center';
    --at-apply: 'border-l border-gray-700 pl-1';
    --at-apply: 'text-gray-200';
  }

  .input:focus + .input-units {
    --at-apply: 'border-teal-500 text-teal-500';
  }
</style>
