<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  export let value: number
  export let small = false

  const dispatch = createEventDispatcher()

  $: degrees = Math.round((1800 * value) / 8100) / 10

  function onChange(e: Event) {
    value = Math.round((8100 * (e.target as any).value) / 180)
    dispatch('change')
  }
</script>

<div class="relative">
  <input
    class="input {small ? 'w-[4.35rem]' : 'w-44 mx-2 px-2'}"
    type="number"
    min="-179"
    max="180"
    value={degrees}
    step="1"
    on:change={onChange}
  /><span class="text-right absolute top-0 bottom-0 w-8 input-units" class:small>&deg;</span>
</div>

<style>
  .input {
    --at-apply: 'focus:border-teal-500 border border-transparent text-gray-700 focus:outline-none';
    --at-apply: 'border-gray-200 dark:border-transparent bg-gray-100 dark:bg-gray-700 dark:text-gray-100';
    --at-apply: 'appearance-none rounded ml-2.5 text-ellipsis px-2';
  }

  .input-units {
    --at-apply: 'pointer-events-none text-sm flex items-center';
    --at-apply: 'border-l border-gray-200 dark:border-gray-600 pl-1';
    --at-apply: 'text-gray-700 dark:text-gray-200';
    --at-apply: 'right-9';
  }
  .input-units.small {
    --at-apply: 'right-2 border-none';
  }

  .input:focus + .input-units {
    --at-apply: 'border-teal-500 text-teal-500';
  }
</style>
