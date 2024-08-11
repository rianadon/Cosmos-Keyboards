<script lang="ts">
  import { mdiChevronDown } from '@mdi/js'
  import Icon from './Icon.svelte'

  export let value: any
  export let small = false
  let clazz: string | undefined = undefined

  export { clazz as class }
</script>

<div class="inline-block relative">
  <select class="s-input pl-2 pr-8 {clazz}" class:small bind:value on:change><slot /></select>
  <div
    class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-700 dark:text-gray-100"
  >
    <Icon path={mdiChevronDown} size="20px" />
  </div>
</div>

<style>
  .small {
    --at-apply: 'mx-0 w-[5.4rem]';
  }
</style>
