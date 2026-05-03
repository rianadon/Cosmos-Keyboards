<script lang="ts">
  // One alert popover. Positions itself below + slightly left of its anchor
  // element using getBoundingClientRect. Tracks a setTimeout for auto-dismiss
  // and pauses both the timer and the progress-bar animation while the
  // pointer is over the popover.

  import { type AlertItem, dismissAlert } from '$lib/store'
  import Icon from '$lib/presentation/Icon.svelte'
  import { mdiAlertCircleOutline, mdiAlertOutline, mdiClose, mdiInformationOutline } from '@mdi/js'
  import { fade } from 'svelte/transition'
  import { onDestroy, onMount, tick } from 'svelte'

  export let alert: AlertItem

  $: duration = alert.durationMs ?? 10000
  $: variant = alert.variant ?? 'info'
  $: iconPath =
    variant === 'warn'
      ? mdiAlertOutline
      : variant === 'error'
      ? mdiAlertCircleOutline
      : mdiInformationOutline

  let popoverEl: HTMLElement
  let top = 0
  let left = 0
  let visible = false
  let paused = false
  let dismissTimer: ReturnType<typeof setTimeout> | null = null
  // Initialize from the prop directly — `duration` is a reactive var that's
  // still undefined at script-init time.
  let remaining = alert.durationMs ?? 10000
  // `performance.now()` at the moment the current setTimeout was scheduled.
  // Lets us subtract the active (un-paused) time spent so far when the user
  // hovers, so resuming continues from where the dismiss timer left off.
  let timerStart = 0
  let onResize: (() => void) | null = null

  function reposition() {
    if (!alert.anchor || !popoverEl) {
      // Fallback: pin to top-right of viewport.
      top = 16
      left = window.innerWidth - popoverEl?.offsetWidth - 16
      return
    }
    const r = alert.anchor.getBoundingClientRect()
    const w = popoverEl.offsetWidth
    const h = popoverEl.offsetHeight
    // Default: place below the anchor, left-aligned. If the anchor is too low
    // for the popover to fit below, flip above instead. Then clamp to viewport
    // so the popover never lands off-screen.
    top = r.bottom + 8
    if (top + h > window.innerHeight - 8) top = r.top - h - 8
    if (top < 8) top = 8
    if (top + h > window.innerHeight - 8) top = window.innerHeight - 8 - h
    left = r.left
    if (left + w > window.innerWidth - 8) left = window.innerWidth - 8 - w
    if (left < 8) left = 8
  }

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
    visible = true
    // Wait for popoverEl to bind, then position + start timer + listeners.
    tick().then(() => {
      reposition()
      startTimer()

      onResize = () => reposition()
      window.addEventListener('resize', onResize)
      window.addEventListener('scroll', onResize, true)
    })
  })

  onDestroy(() => {
    if (dismissTimer) clearTimeout(dismissTimer)
    if (onResize) {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  })
</script>

{#if visible}
  <div
    bind:this={popoverEl}
    class="alert-popover {variant}"
    class:alert-paused={paused}
    style="top: {top}px; left: {left}px; --dur: {duration}ms;"
    on:pointerenter={onPointerEnter}
    on:pointerleave={onPointerLeave}
    transition:fade={{ duration: 120 }}
    role="status"
  >
    <div class="alert-body">
      <Icon path={iconPath} size="20" class="alert-icon flex-none" />
      <div class="text-sm">{alert.message}</div>
      <button class="alert-close ml-2" on:click={() => dismissAlert(alert.id)} aria-label="Dismiss">
        <Icon path={mdiClose} size="16" />
      </button>
    </div>
    {#if duration > 0}
      <div class="alert-progress" />
    {/if}
  </div>
{/if}

<style>
  .alert-popover {
    position: fixed;
    z-index: 100;
    max-width: 24rem;
    padding: 0.5rem 0.5rem 0.6rem 0.75rem;
    border-radius: 0.375rem;
    box-shadow: 0 4px 16px -4px rgba(0, 0, 0, 0.2);
    background: rgb(254 232 240);
    color: rgb(60 20 50);
    border: 1px solid rgb(244 200 220);
    overflow: hidden;
  }
  :global(.dark) .alert-popover {
    background: rgb(80 28 56);
    color: rgb(254 232 240);
    border-color: rgb(120 50 90);
  }
  .alert-popover.warn {
    background: rgb(254 240 220);
    border-color: rgb(240 200 140);
  }
  :global(.dark) .alert-popover.warn {
    background: rgb(96 56 12);
    border-color: rgb(140 90 30);
  }
  .alert-popover.error {
    background: rgb(254 226 226);
    border-color: rgb(248 180 180);
  }
  :global(.dark) .alert-popover.error {
    background: rgb(96 28 28);
    border-color: rgb(160 60 60);
  }

  .alert-body {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
  }

  :global(.alert-icon) {
    color: rgb(190 60 130);
    margin-top: 1px;
  }
  .warn :global(.alert-icon) {
    color: rgb(170 100 20);
  }
  .error :global(.alert-icon) {
    color: rgb(190 50 50);
  }

  .alert-close {
    appearance: none;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    opacity: 0.6;
    color: inherit;
  }
  .alert-close:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.05);
  }
  :global(.dark) .alert-close:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .alert-progress {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 3px;
    background: rgb(190 60 130);
    transform-origin: left;
    animation: alert-deplete var(--dur, 10s) linear forwards;
  }
  .warn .alert-progress {
    background: rgb(200 130 30);
  }
  .error .alert-progress {
    background: rgb(190 50 50);
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
