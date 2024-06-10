<script lang="ts">
  import Popover from 'svelte-easy-popover'
  import Icon from '$lib/presentation/Icon.svelte'
  import * as mdi from '@mdi/js'
  import { fade } from 'svelte/transition'
  import { hasPro } from '@pro'

  export let name: string
  export let pro = false
  export let plusminus = false
  export let icon: string | undefined = undefined
  export let help: string | undefined = undefined
  export let small = false
  export let iconColor: string | undefined = undefined

  let referenceElement: HTMLElement
  let referenceElementPM: HTMLElement
</script>

{#if !pro || hasPro}
  <!-- svelte-ignore a11y-label-has-associated-control -->
  <label class="flex items-center" class:my-2={!small} class:min-h-6.8={small}>
    <div
      class="w-8 flex-none text-teal-700 dark:text-teal-100"
      style={iconColor ? 'color: ' + iconColor : undefined}
    >
      <Icon name={icon} />
    </div>
    <span class="block w-72"
      >{name}
      {#if help}
        <div class="s-help ml-1" bind:this={referenceElement}>
          <Icon path={mdi.mdiHelpCircle} size="20px" />
        </div>
        <Popover
          triggerEvents={['hover', 'focus']}
          {referenceElement}
          placement="top"
          spaceAway={4}
        >
          <div
            class="rounded bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 px-2 py-1 mx-2"
            in:fade={{ duration: 100 }}
            out:fade={{ duration: 250 }}
          >
            {help}
          </div>
        </Popover>
      {/if}
      {#if plusminus}
        <span class="text-teal-500 dark:text-teal-400" bind:this={referenceElementPM}>
          <Icon class="inline-block" size="16" path={mdi.mdiPlusMinus} />
        </span>
        <Popover
          triggerEvents={['hover', 'focus']}
          referenceElement={referenceElementPM}
          placement="top"
          spaceAway={4}
        >
          <div
            class="rounded bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 px-2 py-1 mx-2"
            in:fade={{ duration: 100 }}
            out:fade={{ duration: 250 }}
          >
            Setting this field positive or negative produces good designs
          </div>
        </Popover>
      {/if}
      {#if pro}
        <span class="text-teal-500 dark:text-teal-400 font-bold ml-2">PRO</span>
      {/if}
    </span>
    <slot />
  </label>
{/if}
