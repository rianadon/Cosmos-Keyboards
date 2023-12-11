<script lang="ts">
  import { mdiChevronDown } from '@mdi/js'
  import Icon from '$lib/presentation/Icon.svelte'
  import { bomMultiplier as multiplier } from '$lib/store'
</script>

<div class="inline-block relative">
  <select class="input pl-2 pr-8" bind:value={$multiplier}>
    <option value="2">Two Keyboard Halves</option>
    <option value="1">Single Keyboard</option>
  </select>
  <div
    class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-700 dark:text-gray-100"
  >
    <Icon path={mdiChevronDown} size="20px" />
  </div>
</div>

<style>
  .input {
    --at-apply: 'focus:border-teal-500 border border-transparent text-gray-700 focus:outline-none';
    --at-apply: 'border-gray-200 dark:border-transparent bg-gray-100 dark:bg-gray-700 dark:text-gray-100';
    --at-apply: 'appearance-none w-52 rounded mx-2';
    --at-apply: 'text-ellipsis';
  }
</style>
