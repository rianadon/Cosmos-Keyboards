<script lang="ts">
  import { createTooltip, melt } from '@melt-ui/svelte'
  import { fade, fly } from 'svelte/transition'
  import { notNull } from '$lib/worker/util'
  import { PROFILE, type Profile } from '$target/cosmosStructs'
  import { sortProfiles } from '../viewers/viewer3dHelpers'
  import { KEY_DESC } from '$lib/geometry/keycaps'
  import { lastKeycap } from '$lib/store'

  type Option = { key: Exclude<Profile, null>; label: string }

  export let option: Option

  const allProfiles = notNull(PROFILE).sort(sortProfiles)
  const profileURLs = import.meta.glob(['$target/keycap-*.png'], { query: '?url', eager: true })
  const profileURL = (p: Exclude<Profile, null>) =>
    (profileURLs[`/target/keycap-${p}.png`] as any)?.default as string
  const thumbURL = (p: Exclude<Profile, null>) =>
    (profileURLs[`/target/keycap-${p}-thumb.png`] as any)?.default as string
  $: profileIndex = allProfiles.indexOf(option.key)

  $: flyAmount = 0

  function updateFly(tooltipOpen: boolean) {
    if (!tooltipOpen) return
    flyAmount = (profileIndex - $lastKeycap) * 64
    $lastKeycap = profileIndex
  }

  $: updateFly($tooltipOpen)

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
  <img
    src={thumbURL(option.key)}
    class="size-4 inline mr-1 align-baseline pointer-events-none light:(filter-invert opacity-60)"
  />
  <span>{option.label}</span>
</div>

{#if $tooltipOpen}
  <div
    use:melt={$content}
    transition:fade={{ duration: 50 }}
    class="z-100 rounded-md bg-pink-200 dark:text-pink-950 shadow"
  >
    <div use:melt={$arrow} />
    <div class="px-6 py-4 max-w-108 cosmosprofileinfo">
      <div class="overflow-hidden mb-1">
        <div
          class="flex"
          style="margin-left: {-4 * profileIndex + 10}rem"
          transition:fly={{ x: flyAmount }}
        >
          {#each allProfiles as prof}
            <img src={profileURL(prof)} class="size-16" class:disable={prof != option.key} />
          {/each}
        </div>
      </div>
      {@html '<p>' + KEY_DESC[option.key].description.replaceAll('\n', '</p><p>') + '</p>'}
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
