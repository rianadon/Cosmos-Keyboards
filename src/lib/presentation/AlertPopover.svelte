<script lang="ts">
  import { createPopover, melt } from '@melt-ui/svelte'
  import { type AlertItem, dismissAlert } from '$lib/store'
  import { fade } from 'svelte/transition'
  import { onDestroy, onMount } from 'svelte'
  import { base } from '$app/paths'

  const DEFAULT_DURATION = 10000

  export let alert: AlertItem
  $: duration = alert.durationMs ?? DEFAULT_DURATION

  const {
    elements: { trigger, content, arrow },
  } = createPopover({
    positioning: { placement: 'right-start', gutter: 8 },
    forceVisible: true,
    portal: null,
    closeOnOutsideClick: false,
    disableFocusTrap: true,
    defaultOpen: true,
  })

  let alive = true
  let paused = false
  let dismissTimer: ReturnType<typeof setTimeout> | null = null
  let remaining = alert.durationMs ?? DEFAULT_DURATION
  let timerStart = 0
  let triggerCleanup: (() => void) | undefined

  function startTimer() {
    if (duration <= 0) return
    if (dismissTimer) clearTimeout(dismissTimer)
    timerStart = performance.now()
    dismissTimer = setTimeout(() => dismissAlert(alert.id), remaining)
  }

  function onPointerEnter() {
    paused = true
    if (dismissTimer) {
      clearTimeout(dismissTimer)
      dismissTimer = null
      remaining -= performance.now() - timerStart
      if (remaining < 0) remaining = 0
    }
  }

  function onPointerLeave() {
    paused = false
    startTimer()
  }

  onMount(() => {
    triggerCleanup = $trigger.action(alert.anchor)?.destroy
    startTimer()
  })

  onDestroy(() => {
    if (dismissTimer) clearTimeout(dismissTimer)
    triggerCleanup?.()
  })

  function dismiss() {
    alive = false // Cleans up more cleanly
    dismissAlert(alert.id)
  }
</script>

<div
  use:melt={$content}
  class="z-100 max-w-90 px-4 py-3 rounded-md bg-pink-200 dark:text-pink-950 shadow"
  class:alert-paused={paused}
  style="--dur: {duration}ms;"
  on:pointerenter={onPointerEnter}
  on:pointerleave={onPointerLeave}
  transition:fade={{ duration: 120 }}
  role="status"
>
  <div use:melt={$arrow} />
  <div class="flex flex-col items-end gap-[0.35rem]">
    {#if alert.message == '<customlayout>'}
      <p>
        To make your own layout in Cosmos, click a key in the 3D view and edit the Letter field to set
        custom legends per key.
      </p>
      <img
        alt="How to access the letter field: 1) Click a key. 2) CLick Edit key. 3) Click the letter field in the popup"
        src="{base}/help-letter.png"
      />
    {:else}
      <div>{alert.message}</div>
    {/if}
    <button class="font-medium text-pink-700 hover:text-pink-950" on:click={dismiss}> Dismiss </button>
  </div>
  {#if duration > 0 && alive}
    <div class="alert-progress" />
  {/if}
</div>

<style>
  .alert-progress {
    --at-apply: 'absolute inset-x-0 bottom-0 h-1 bg-pink-700 rounded-b-md origin-left';
    animation: alert-deplete var(--dur, 10s) linear forwards;
  }
  .alert-paused .alert-progress {
    animation-play-state: paused;
  }
  @keyframes alert-deplete {
    from {
      transform: scaleX(1);
    }
    to {
      transform: scaleX(0);
    }
  }
</style>
