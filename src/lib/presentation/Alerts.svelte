<script lang="ts">
  // Popover-style alerts. Mounted once in App.svelte; iterates the `alerts`
  // store and renders each as a positioned popover next to its anchor
  // element. Auto-dismisses after `durationMs` (default 10s) with a progress
  // bar at the bottom; pause-on-hover gives the user time to read longer
  // messages.

  import { alerts } from '$lib/store'
  import AlertPopover from './AlertPopover.svelte'
</script>

{#each $alerts as alert (alert.id)}
  <AlertPopover {alert} />
{/each}
