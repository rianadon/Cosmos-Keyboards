<script lang="ts">
  import { mdiChevronDown } from '@mdi/js'
  import Icon from './Icon.svelte'
  import { createEventDispatcher } from 'svelte'

  export let value: string | undefined
  export let inherit: string
  export let small = false

  const dispatch = createEventDispatcher()
  $: val = value || inherit

  function onChange(e: Event) {
    value = (e.target! as any).value
    if (value == inherit) value = undefined
    dispatch('change')
  }
</script>

<div class="inline-block relative">
  <select
    class="s-input pl-2 pr-8"
    class:small
    value={val}
    on:change
    on:change={onChange}
    class:text-yellow!={typeof value === 'undefined'}
  >
    <slot />
  </select>
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
