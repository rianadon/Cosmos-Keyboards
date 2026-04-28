<script lang="ts">
  import { createTooltip, melt } from '@melt-ui/svelte'
  import Icon from '$lib/presentation/Icon.svelte'
  import { fade } from 'svelte/transition'
  import { type PartInfo } from '$lib/geometry/socketsParts'
  import { mdiAlertCircleOutline } from '@mdi/js'
  import { pluralizeLastWord } from '$lib/worker/util'

  type Option = { key: string; label: string } & PartInfo

  export let option: Option

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

  $: requirements =
    'variants' in option
      ? {
          bomName: option.bomName({}),
          extraBomItems: option.extraBomItems ? option.extraBomItems({}) : {},
        }
      : {
          bomName: option.bomName,
          extraBomItems: option.extraBomItems ? option.extraBomItems : {},
        }
</script>

<div class="pl-6 py-0.25 pr-4 flex items-center gap-2" use:melt={$trigger}>
  <Icon name={option.icon || 'switch'} class="size-4 inline pointer-events-none light:text-black/60" />
  <span>{option.partName}</span>
</div>

{#if $tooltipOpen}
  <div
    use:melt={$content}
    transition:fade={{ duration: 50 }}
    class="z-100 rounded-md bg-pink-200 dark:text-pink-950 shadow"
    class:cosmos={option.soldByCosmos}
  >
    <div use:melt={$arrow} />
    <div class="px-6 py-4 max-w-400px cosmospartinfo">
      {#if option.soldByCosmos}
        <p
          class="bg-purple-900 text-white flex items-center px-4 py-0.5 gap-2 justify-end rounded mt--2 mb-6"
        >
          <img class="size-5" src="favicon.png" alt="" />
          Sold by Cosmos
        </p>
      {/if}
      {#if option.description}
        {#each option.description.split('\n') as desc}
          {#if desc.startsWith('[warn]')}
            <div
              class="text-sm mb-1 bg-pink-300 dark:border-gray-900 mx-[-0.5rem] px-2 py-2 rounded flex gap-3 relative"
            >
              <div>
                <Icon path={mdiAlertCircleOutline} size="20" class="text-pink-600" />
                <div
                  class="absolute top-9 left-[calc(7px+0.5rem)] bottom-2 w-[6px] bg-pink-400 dark:bg-pink-600 rounded"
                />
              </div>
              <div class="opacity-80 dark:opacity-100">
                {@html desc.substring(6)}
              </div>
            </div>
          {:else}
            <p>{@html desc}</p>
          {/if}
        {/each}
      {:else}
        <p>Some information on the part</p>
      {/if}
      {#if option.key !== 'blank'}
        <div class="requirements bg-pink-300 mx--4 mb--1 mt-3 px-4 pb-1 py-0.5 rounded">
          <p class="text-xs font-medium">Requirements</p>
          <li class="flex items-center gap-2 text-sm">
            <Icon name={option.bomIcon || option.icon || 'switch'} class="opacity-70 flex-none" />
            <div class="flex-start">1 {requirements.bomName}</div>
          </li>
          <ul>
            {#each Object.values(requirements.extraBomItems) as item}
              <li class="flex items-center gap-2 text-sm">
                <Icon name={item.icon} class="opacity-70 flex-none" />{Math.ceil(item.count)}
                <div class="flex-start">{item.count > 1 ? pluralizeLastWord(item.item) : item.item}</div>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  :global(.cosmospartinfo p) {
    --at-apply: 'mb-1';
  }
  :global(.cosmospartinfo a) {
    --at-apply: 'underline text-pink-700';
  }

  .cosmos {
    --at-apply: 'bg-purple-200';
  }

  .cosmos .requirements {
    --at-apply: 'bg-purple-300';
  }
</style>
