<script lang="ts">
  export let value: number
  export let small = false
  let clazz = ''

  export { clazz as class }

  $: rounded = Math.round(value * 100) / 100

  function onChange(e) {
    value = Math.round(100 * e.target.value) / 100
  }
</script>

<input
  class="input {clazz ? clazz : small ? 'w-[5.45rem]' : 'w-[6.88rem]'}"
  type="number"
  value={rounded}
  step="0.1"
  on:change={onChange}
/>

<style>
  .input {
    --at-apply: 'focus:border-teal-500 border border-transparent text-gray-700 focus:outline-none';
    --at-apply: 'border-gray-200 dark:border-transparent bg-gray-100 dark:bg-gray-700 dark:text-gray-100';
    --at-apply: 'appearance-none rounded ml-2.5 text-ellipsis px-2';
  }
</style>
