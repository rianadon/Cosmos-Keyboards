<script lang="ts">
  import { createTooltip, melt } from '@melt-ui/svelte'
  import { fade } from 'svelte/transition'
  import { onDestroy } from 'svelte'

  type Placement =
    | 'top'
    | 'top-start'
    | 'top-end'
    | 'bottom'
    | 'bottom-start'
    | 'bottom-end'
    | 'left'
    | 'left-start'
    | 'left-end'
    | 'right'
    | 'right-start'
    | 'right-end'

  export let referenceElement: HTMLElement | undefined = undefined
  export let placement: Placement = 'top'
  export let spaceAway = 4
  export let inDuration = 100
  export let outDuration = 250
  export let open = false

  const {
    elements: { trigger, content },
    states: { open: openStore },
  } = createTooltip({
    positioning: { placement, gutter: spaceAway },
    openDelay: 0,
    closeDelay: 0,
    forceVisible: true,
    portal: null,
  })

  $: openStore.set(open)
  openStore.subscribe((v) => (open = v))

  let activeEl: HTMLElement | undefined
  let actionCleanup: (() => void) | undefined
  let appliedAttrs: string[] = []

  $: applyTrigger(referenceElement, $trigger)

  function applyTrigger(el: HTMLElement | undefined, t: typeof $trigger) {
    if (activeEl !== el) {
      detach()
      activeEl = el
      if (el) actionCleanup = t.action(el)?.destroy
    }
    if (!el) return
    for (const attr of appliedAttrs) el.removeAttribute(attr)
    appliedAttrs = []
    for (const [key, value] of Object.entries(t)) {
      if (key === 'action' || value === undefined || value === null) continue
      el.setAttribute(key, String(value))
      appliedAttrs.push(key)
    }
  }

  function detach() {
    actionCleanup?.()
    actionCleanup = undefined
    if (activeEl) {
      for (const attr of appliedAttrs) activeEl.removeAttribute(attr)
      appliedAttrs = []
    }
    activeEl = undefined
  }

  onDestroy(detach)
</script>

{#if open}
  <div
    use:melt={$content}
    class="tooltip-wrapper"
    in:fade={{ duration: inDuration }}
    out:fade={{ duration: outDuration }}
  >
    <slot />
  </div>
{/if}

<style>
  .tooltip-wrapper {
    z-index: var(--z-index, 1);
  }
</style>
