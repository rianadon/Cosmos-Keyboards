<script lang="ts">
  export let value: number
  export let small = false
  export let units = ''
  let clazz = ''

  export { clazz as class }

  $: rounded = Math.round(value) / 10

  function onChange(e: Event) {
    value = Math.round(10 * (e.target! as any).value)
  }
</script>

{#if units}
  <div class="relative">
    <input
      class="input {clazz ? clazz : small ? 'w-[4.35rem]' : 'w-[6.88rem]'}"
      type="number"
      value={rounded}
      step="0.1"
      on:change={onChange}
    />
    <span class="text-right absolute top-0 bottom-0 right-9 w-8 input-units">{units}</span>
  </div>
{:else}
  <input
    class="input {clazz ? clazz : small ? 'w-[4.35rem]' : 'w-[6.88rem]'}"
    type="number"
    value={rounded}
    step="0.1"
    on:change={onChange}
  />
{/if}

<style>
  .input {
    --at-apply: 'focus:border-teal-500 border border-transparent text-gray-700 focus:outline-none';
    --at-apply: 'border-gray-200 dark:border-transparent bg-gray-100 dark:bg-gray-700 dark:text-gray-100';
    --at-apply: 'appearance-none rounded ml-2.5 text-ellipsis px-2;';
  }

  .input-units {
    --at-apply: 'pointer-events-none text-sm flex items-center';
    --at-apply: 'border-l border-gray-200 dark:border-gray-600 pl-1';
    --at-apply: 'text-gray-700 dark:text-gray-200';
  }

  .input:focus + .input-units {
    --at-apply: 'border-teal-500 text-teal-500';
  }
</style>
