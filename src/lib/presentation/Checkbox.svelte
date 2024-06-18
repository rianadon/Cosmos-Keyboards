<script lang="ts">
  import { mdiCheck } from '@mdi/js'
  import Icon from './Icon.svelte'
  export let value: boolean
  export let basic = false
  export let small = false
  export let purple = false
</script>

<input class="opacity-0 absolute h-0 w-0" type="checkbox" bind:checked={value} on:change />
<div class="inline-block {basic ? '' : 'w-44'} text-left px-2 flex-none">
  <div
    class="input-basic rounded flex flex-shrink-0 justify-center items-center checkbox"
    class:purple
    class:small
  >
    <Icon
      path={mdiCheck}
      size="20px"
      class=" {purple
        ? 'text-purple-500 dark:text-pink-500'
        : 'text-teal-500'} pointer-events-none {value ? '' : 'invisible'}"
    />
  </div>
</div>

<style>
  .input-basic {
    --at-apply: 'border border-transparent text-gray-700 focus:outline-none';
    --at-apply: 'border-gray-200 dark:border-transparent bg-gray-100 dark:bg-gray-700 dark:text-gray-100';
  }

  input:focus + div > div {
    --at-apply: 'border-teal-500';
  }

  .checkbox {
    --at-apply: 'w-6 h-6';
  }
  .checkbox.small {
    --at-apply: 'w-5 h-5';
  }
  input:focus + div > div.purple {
    --at-apply: 'border-purple-500 dark:border-pink-500';
  }
</style>
