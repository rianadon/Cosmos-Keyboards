<script lang="ts">
  import { createTooltip, melt } from '@melt-ui/svelte'
  import { fade } from 'svelte/transition'
  import { type MicrocontrollerName } from '$target/cosmosStructs'
  import { BOARD_PROPERTIES, numGPIO } from '$lib/geometry/microcontrollers'
  import Icon from '$lib/presentation/Icon.svelte'
  import { mdiAlertCircleOutline } from '@mdi/js'

  type Option = { key: Exclude<MicrocontrollerName, null>; label: string }

  export let option: Option

  const ucURLs = import.meta.glob(['$target/microcontroller-*.png'], { query: '?url', eager: true })
  const ucURL = (p: Exclude<MicrocontrollerName, null>) =>
    (ucURLs[`/target/microcontroller-${p}.png`] as any)?.default as string

  const {
    elements: { trigger, content, arrow },
    states: { open: tooltipOpen },
  } = createTooltip({
    positioning: {
      placement: 'right',
    },
    openDelay: 0,
    closeDelay: 0,
    closeOnPointerDown: false,
    forceVisible: true,
    group: 'selectThingy',
    escapeBehavior: 'defer-otherwise-close',
  })
</script>

<div class="pl-6 py-0.25 pr-4" use:melt={$trigger}>
  <span>{option.label}</span>
</div>

{#if $tooltipOpen && option.key !== null}
  <div
    use:melt={$content}
    transition:fade={{ duration: 50 }}
    class="z-100 rounded-md bg-pink-200 dark:text-pink-950 shadow"
    class:cosmos={BOARD_PROPERTIES[option.key].soldByCosmos}
  >
    <div use:melt={$arrow} />
    <div class="px-6 py-4 max-w-80 cosmosprofileinfo">
      <img src={ucURL(option.key)} class="w-72 h-36 mx-auto" />

      {#if BOARD_PROPERTIES[option.key].soldByCosmos}
        <p
          class="bg-purple-900 text-white flex items-center px-4 py-0.5 gap-2 justify-end rounded mt-1 mb-6"
        >
          <img class="size-5" src="favicon.png" alt="" />
          Sold by Cosmos
        </p>
      {/if}
      {#if option.key.includes('promicro')}
        <div
          class="max-w-[32rem] text-sm mb-1 bg-pink-300 dark:border-gray-900 mx-[-0.5rem] px-2 py-2 rounded flex gap-3 relative"
        >
          <div>
            <Icon path={mdiAlertCircleOutline} size="20" class="text-pink-600" />
            <div
              class="absolute top-9 left-[calc(7px+0.5rem)] bottom-2 w-[6px] bg-pink-400 dark:bg-pink-600 rounded"
            />
          </div>
          <div class="opacity-80 dark:opacity-100">
            Pro Micro boards are not recommended because they lack speed and program storage.
          </div>
        </div>
      {/if}
      {#if BOARD_PROPERTIES[option.key].description}
        {@html '<p>' + BOARD_PROPERTIES[option.key].description.replaceAll('\n', '</p><p>') + '</p>'}
      {/if}
      <p>{numGPIO(option.key)} I/O pins</p>
      <p>
        {BOARD_PROPERTIES[option.key].size.x.toFixed(1)} mm &times;
        {BOARD_PROPERTIES[option.key].size.y.toFixed(1)} mm
      </p>
    </div>
  </div>
{/if}

<style>
  :global(.cosmosprofileinfo p) {
    --at-apply: 'mb-1';
  }
  :global(.cosmosprofileinfo a) {
    --at-apply: 'underline text-pink-700';
  }

  .cosmos {
    --at-apply: 'bg-purple-200';
  }

  .cosmos .requirements {
    --at-apply: 'bg-purple-300';
  }

  img.disable {
    opacity: 40%;
  }
</style>
