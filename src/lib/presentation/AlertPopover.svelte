<script lang="ts">
  // One alert popover. Positions itself to the right of its anchor element
  // using getBoundingClientRect, falling back to below if the right edge
  // would clip the viewport. Tracks a setTimeout for auto-dismiss and pauses
  // both the timer and the progress-bar animation while the pointer is over
  // the popover.

  import { type AlertItem, dismissAlert } from '$lib/store'
  import { fade } from 'svelte/transition'
  import { onDestroy, onMount, tick } from 'svelte'

  export let alert: AlertItem

  $: duration = alert.durationMs ?? 10000

  let popoverEl: HTMLElement
  let top = 0
  let left = 0
  // Which side of the popover the tail/arrow points from. `right` means the
  // popover sits to the right of the anchor and the arrow points left back at
  // it; `below` is the narrow-viewport fallback where the popover sits below
  // and the arrow points up.
  let placement: 'right' | 'below' = 'right'
  // Arrow position along the cross-axis of `placement`, in px from the popover
  // edge. Aligned with the anchor's center so the arrow tip lands on the
  // dropdown / field that triggered the alert.
  let arrowOffset = 0
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
      // Fallback: pin to top-right of viewport. No anchor to point at, so hide
      // the arrow by clamping it off-popover.
      top = 16
      left = window.innerWidth - popoverEl?.offsetWidth - 16
      arrowOffset = -100
      return
    }
    const r = alert.anchor.getBoundingClientRect()
    const w = popoverEl.offsetWidth
    const h = popoverEl.offsetHeight
    // Default: place to the right of the anchor, top-aligned. If the right
    // edge would clip, fall back to placing below the anchor (so narrow
    // viewports still get a usable position). Then clamp to viewport.
    let nextPlacement: 'right' | 'below' = 'right'
    let l = r.right + 8
    let t = r.top
    if (l + w > window.innerWidth - 8) {
      nextPlacement = 'below'
      l = r.left
      t = r.bottom + 8
    }
    if (t + h > window.innerHeight - 8) t = window.innerHeight - 8 - h
    if (t < 8) t = 8
    if (l + w > window.innerWidth - 8) l = window.innerWidth - 8 - w
    if (l < 8) l = 8

    // Point the arrow tip at the anchor's center along the cross-axis.
    // Clamp away from the rounded corners so the arrow doesn't poke out.
    if (nextPlacement === 'right') {
      const anchorMidY = (r.top + r.bottom) / 2
      arrowOffset = Math.max(12, Math.min(h - 12, anchorMidY - t))
    } else {
      const anchorMidX = (r.left + r.right) / 2
      arrowOffset = Math.max(14, Math.min(w - 14, anchorMidX - l))
    }
    placement = nextPlacement
    top = t
    left = l
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
    class="alert-popover {placement}"
    class:alert-paused={paused}
    style="top: {top}px; left: {left}px; --dur: {duration}ms; --arrow: {arrowOffset}px;"
    on:pointerenter={onPointerEnter}
    on:pointerleave={onPointerLeave}
    transition:fade={{ duration: 120 }}
    role="status"
  >
    <div class="alert-body">
      <div class="text-sm">{alert.message}</div>
      <button class="alert-dismiss" on:click={() => dismissAlert(alert.id)}>Dismiss</button>
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
    max-width: 18rem;
    padding: 0.6rem 0.75rem 0.7rem 0.75rem;
    border-radius: 0.375rem;
    box-shadow: 0 4px 16px -4px rgba(0, 0, 0, 0.2);
    background: rgb(254 232 240);
    color: rgb(60 20 50);
    border: 1px solid rgb(244 200 220);
  }
  :global(.dark) .alert-popover {
    background: rgb(80 28 56);
    color: rgb(254 232 240);
    border-color: rgb(120 50 90);
  }

  /* Tail/arrow pointing back at the anchor. ::before draws the slightly
     larger border-color triangle, ::after the background-color fill on top.
     The 1px overlap hides the seam between the popover border and the arrow. */
  .alert-popover::before,
  .alert-popover::after {
    content: '';
    position: absolute;
    width: 0;
    height: 0;
  }
  .alert-popover.right::before,
  .alert-popover.right::after {
    top: var(--arrow);
    transform: translateY(-50%);
  }
  .alert-popover.right::before {
    left: -7px;
    border-top: 7px solid transparent;
    border-bottom: 7px solid transparent;
    border-right: 7px solid rgb(244 200 220);
  }
  .alert-popover.right::after {
    left: -6px;
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
    border-right: 6px solid rgb(254 232 240);
  }
  .alert-popover.below::before,
  .alert-popover.below::after {
    left: var(--arrow);
    transform: translateX(-50%);
  }
  .alert-popover.below::before {
    top: -7px;
    border-left: 7px solid transparent;
    border-right: 7px solid transparent;
    border-bottom: 7px solid rgb(244 200 220);
  }
  .alert-popover.below::after {
    top: -6px;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-bottom: 6px solid rgb(254 232 240);
  }
  :global(.dark) .alert-popover.right::before {
    border-right-color: rgb(120 50 90);
  }
  :global(.dark) .alert-popover.right::after {
    border-right-color: rgb(80 28 56);
  }
  :global(.dark) .alert-popover.below::before {
    border-bottom-color: rgb(120 50 90);
  }
  :global(.dark) .alert-popover.below::after {
    border-bottom-color: rgb(80 28 56);
  }

  .alert-body {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.35rem;
  }
  .alert-body .text-sm {
    align-self: stretch;
  }

  .alert-dismiss {
    appearance: none;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0;
    font-weight: 500;
    color: rgb(190 60 130);
  }
  .alert-dismiss:hover {
    text-decoration: underline;
  }
  :global(.dark) .alert-dismiss {
    color: rgb(244 160 200);
  }

  .alert-progress {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 3px;
    background: rgb(190 60 130);
    border-bottom-left-radius: 0.375rem;
    border-bottom-right-radius: 0.375rem;
    transform-origin: left;
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
