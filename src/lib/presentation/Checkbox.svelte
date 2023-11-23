<script lang="ts">
  import { mdiCheck } from '@mdi/js'
  import Icon from './Icon.svelte'
  export let value: boolean
  export let basic = false
</script>

<input class="opacity-0 absolute h-0 w-0" type="checkbox" bind:checked={value} on:change />
<div class="inline-block {basic ? '' : 'w-44'} text-left px-2 flex-none">
  <div class="input-basic rounded w-6 h-6 flex flex-shrink-0 justify-center items-center">
    <Icon
      path={mdiCheck}
      size="20px"
      class=" text-teal-500 pointer-events-none {value ? '' : 'invisible'}"
    />
  </div>
</div>

<style>
  .input-basic {
    --at-apply: 'focus:border-teal-500 border border-transparent text-gray-700 focus:outline-none';
    --at-apply: 'border-gray-200 dark:border-transparent bg-gray-100 dark:bg-gray-700 dark:text-gray-100';
  }

  input:focus + div > div {
    --at-apply: 'border-teal-500';
  }
</style>
