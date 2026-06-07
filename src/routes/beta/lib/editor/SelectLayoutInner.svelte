<script lang="ts">
  import { createTooltip, melt } from '@melt-ui/svelte'
  import { fade } from 'svelte/transition'
  import { LAYOUTS, leftCells, rightCells, type Language } from '$lib/geometry/layouts'
  import { objKeys, range } from '$lib/worker/util'
  import Icon from '$lib/presentation/Icon.svelte'
  import { mdiAlertCircle, mdiCheckCircle, mdiCheckCircleOutline } from '@mdi/js'

  type Option = {
    key: string
    label: string
    language: Language | null
    diff: { missing: string[]; mismatched: string[] } | null
  }

  export let option: Option

  $: layout = objKeys(LAYOUTS).find((l) => LAYOUTS[l].languages.some((g) => g.name === option.key))

  $: diffSummary = (() => {
    if (!option.diff) return null
    const all = [...option.diff.missing, ...option.diff.mismatched]
    if (all.length === 0) return { kind: 'match' as const }
    if (all.length <= 14) return { kind: 'list' as const, letters: all }
    return { kind: 'count' as const, count: all.length }
  })()

  const {
    elements: { trigger, content, arrow },
    states: { open: tooltipOpen },
  } = createTooltip({
    positioning: { placement: 'right' },
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

{#if $tooltipOpen}
  <div
    use:melt={$content}
    transition:fade={{ duration: 50 }}
    class="z-100 rounded-md bg-pink-200 dark:text-pink-950 shadow"
  >
    <div use:melt={$arrow} />
    <div class="px-6 py-4">
      {#if option.key == 'custom'}
        <div class="max-w-40ch">
          <p class="mb-2">
            Did you know you can make your own layout in Cosmos? Click a key in the 3D view and edit the
            Letter field to set custom legends per key.
          </p>
          <p class="mb-2">
            The language list is incomplete as it's limited to languages that are easy to set up in both
            QMK and ZMK. However, even if your language has glyphs not represented in this set of
            languages, you can still program your keyboard to type your alphabet with these firmwares.
            See <a
              class="text-pink-600 underline"
              href="https://ryanis.cool/cosmos/blog/comparing-qmk-and-zmk-language-support/"
              >this blog post</a
            > for more on how the language set was chosen.
          </p>
        </div>
      {/if}
      {#if layout}
        <div class="flex flex-col items-center gap-1 mb-3" aria-hidden="true">
          {#each range(0, 5) as row}
            <div class="flex items-center">
              <div class="flex gap-1">
                {#each leftCells(layout)[row] as ch, i}
                  {#if ch == ' '}
                    <span class="space" />
                  {:else}
                    <span class="ocell" class:home={row === 2 && i > 0}>{ch}</span>
                  {/if}
                {/each}
              </div>
              <div class="w-4" />
              <div class="flex gap-1">
                {#each rightCells(layout)[row] as ch, i}
                  {#if ch == ' '}
                    <span class="space" />
                  {:else}
                    <span class="ocell" class:home={row === 2 && i < 5}>{ch}</span>
                  {/if}
                {/each}
              </div>
            </div>
          {/each}
        </div>
        <div class="flex justify-between text-sm">
          <div class="flex items-center">
            {#if LAYOUTS[layout].languages.some((l) => l.qmk)}
              <Icon class="text-teal-600 mr-2" path={mdiCheckCircle} size="20px" />
              Supported in QMK
            {:else}
              <Icon class="text-amber-600 mr-2" path={mdiAlertCircle} size="20px" />
              Not supported in QMK
            {/if}
          </div>
          <div class="flex items-center">
            {#if LAYOUTS[layout].languages.some((l) => l.zmk)}
              <Icon class="text-teal-600 mr-2" path={mdiCheckCircle} size="20px" />
              Supported in ZMK
            {:else}
              <Icon class="text-amber-600 mr-2" path={mdiAlertCircle} size="20px" />
              Not supported in ZMK
            {/if}
          </div>
        </div>
      {/if}
      {#if diffSummary}
        <p
          class="text-sm mt-1"
          class:text-teal-700={diffSummary.kind === 'match'}
          class:text-amber-700={diffSummary.kind !== 'match'}
        >
          {#if diffSummary.kind === 'match'}
            ✓ Matches your keyboard
          {:else if diffSummary.kind === 'list'}
            Differs in: {#each diffSummary.letters as l}<span class="key">{l}</span>{/each}
          {:else}
            Differs in {diffSummary.count} keys
          {/if}
        </p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .space {
    --at-apply: 'inline-flex w-6';
  }
  .ocell {
    --at-apply: 'inline-flex items-center justify-center w-6 h-6 rounded bg-pink-50 dark:bg-pink-100 text-pink-900 font-mono text-xs border border-pink-300';
  }
  .ocell.home {
    --at-apply: 'bg-pink-200 border-pink-400';
  }
  .key {
    --at-apply: 'font-mono bg-pink-300 px-1 py-0.5 mx-0.5 rounded';
  }
</style>
