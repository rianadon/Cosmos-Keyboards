<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  export let value: number
  export let small = false
  export let supersmall = false
  export let units = ''
  export let divisor = 10
  export let multiplier = 1
  let clazz = ''

  export { clazz as class }
  const dispatch = createEventDispatcher()

  $: rounding = divisor == 100 ? 100 : 10
  $: rounded = (Math.round(value * rounding) / rounding) * multiplier

  function onChange(e: Event) {
    value = Math.round((divisor * (e.target! as any).value) / multiplier) / divisor
    dispatch('change', value)
    console.log('change decima', value)
  }
</script>

{#if units}
  <div class="relative">
    <input
      class="input {clazz ? clazz : small ? 'w-[5.4rem]' : 'w-44'}"
      type="number"
      value={rounded}
      step={divisor == 1 ? 1 : 0.1}
      on:change={onChange}
    />
    <span class="text-right absolute top-0 bottom-0 right-9 w-8 input-units">{units}</span>
  </div>
{:else if supersmall}
  <input class="input appearance-none w-14 ml-1!" value={rounded} on:change={onChange} />
{:else}
  <input
    class="input {clazz ? clazz : small ? 'w-[5.4rem]' : 'w-44'}"
    type="number"
    value={rounded}
    step={divisor == 1 ? 1 : 0.1}
    on:change={onChange}
  />
{/if}

<style>
  .input {
    --at-apply: 'focus:border-teal-500 border border-transparent text-gray-700 focus:outline-none border-gray-200 dark:border-transparent bg-gray-100 dark:bg-gray-700 dark:text-gray-100 appearance-none rounded ml-2.5 text-ellipsis px-2';
  }

  .input-units {
    --at-apply: 'pointer-events-none text-sm flex items-center border-l border-gray-200 dark:border-gray-600 pl-1 text-gray-700 dark:text-gray-200';
  }

  .input:focus + .input-units {
    --at-apply: 'border-teal-500 text-teal-500';
  }
</style>
