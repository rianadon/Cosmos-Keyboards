<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  export let value: any
  export let small = false
  export let inherit: number | undefined
  export let divisor = 45
  $: tempValue = value

  const dispatch = createEventDispatcher()

  $: degrees = Math.round((value ?? inherit!) * 10) / 10

  function onChange(e: Event) {
    value = Math.round(divisor * (e.target! as any).value) / divisor
    if (value == inherit) value = undefined
    tempValue = value
    dispatch('change')
  }

  function onInput(e: Event) {
    tempValue = Math.round(divisor * (e.target! as any).value) / divisor
    if (tempValue == inherit) tempValue = undefined
  }
</script>

<div class="relative">
  <input
    class="input {small ? 'w-[5.4rem]' : 'w-44 mx-2 px-2'}"
    class:text-yellow!={typeof tempValue === 'undefined'}
    type="number"
    min="-179"
    max="180"
    value={degrees}
    step="1"
    on:change={onChange}
    on:input={onInput}
  /><span class="text-right absolute top-0 bottom-0 w-8 input-units" class:small>&deg;</span>
</div>

<style>
  .input {
    --at-apply: 'focus:border-teal-500 border border-transparent text-gray-700 focus:outline-none border-gray-200 dark:border-transparent bg-gray-100 dark:bg-gray-700 dark:text-gray-100 appearance-none rounded ml-2.5 text-ellipsis px-2';
  }

  .input-units {
    --at-apply: 'pointer-events-none text-sm flex items-center border-l border-gray-200 dark:border-gray-600 pl-1 text-gray-700 dark:text-gray-200 right-9';
  }
  .input-units.small {
    --at-apply: 'right-2 border-none';
  }

  .input:focus + .input-units {
    --at-apply: 'border-teal-500 text-teal-500';
  }
</style>
