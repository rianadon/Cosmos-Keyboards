<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte'
  import { mdiClose } from '@mdi/js'
  import Icon from '$lib/presentation/Icon.svelte'

  export let big = false
  export let small = false
  export let dialogcls = ''
  export let forceDark = false
  export let hasClose = true
  const dispatch = createEventDispatcher()

  onMount(() => {
    document.body.classList.add('overflow-hidden')

    return () => document.body.classList.remove('overflow-hidden')
  })

  function close() {
    dispatch('close')
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="fixed inset-0 bg-gray-900/80 z-20" on:click={close}>
  <div
    class="absolute left-0 right-0 {dialogcls
      ? dialogcls
      : small
      ? 'top-4 md:top-48'
      : 'top-4 md:top-24'} bottom-4"
  >
    <div
      class="mx-auto {big
        ? 'w-[50rem]'
        : small
        ? 'w-[30rem]'
        : 'w-[40rem]'} max-w-full text-center px-4 {small
        ? 'md:px-4 pt-6'
        : 'md:px-8 py-8'} rounded-md {forceDark
        ? 'bg-gray-800'
        : 'bg-white dark:bg-gray-800'} max-h-full overflow-auto"
      on:click|stopPropagation
    >
      <div class="relative">
        <h3 class="text-2xl font-medium {forceDark ? 'text-white' : 'text-gray-900 dark:text-white'}">
          <slot name="title" />
        </h3>
        {#if hasClose}
          <button class="absolute right-0 top-1" on:click={close}>
            <Icon
              path={mdiClose}
              size="24"
              class={forceDark ? 'text-gray-100' : 'text-gray-800 dark:text-gray-100'}
            />
          </button>
        {/if}
      </div>
      <div class="mt-2 py-3 text-start">
        <slot name="content" />
      </div>
    </div>
  </div>
</div>
