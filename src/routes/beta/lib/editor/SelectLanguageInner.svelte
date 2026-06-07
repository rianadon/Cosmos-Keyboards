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
    language: Language
  }

  export let option: Option

  $: layout = objKeys(LAYOUTS).find((l) => LAYOUTS[l].languages.some((g) => g.name === option.key))
  $: layoutRows = layout
    ? [
        LAYOUTS[layout].layout.substring(0, 26),
        LAYOUTS[layout].layout.substring(26, 50),
        LAYOUTS[layout].layout.substring(50, 74),
        LAYOUTS[layout].layout.substring(74, 96),
      ]
    : []

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
      {#if layout && layoutRows}
        <div class="flex flex-col items-start gap-1 mb-3" aria-hidden="true">
          {#each layoutRows as row, i}
            <div class="flex items-center">
              <div class="flex gap-1">
                {#if i == 1}<span class="scell w-9">tab</span>{/if}
                {#if i == 2}<span class="scell w-11">caps</span>{/if}
                {#if i == 3}<span class="scell w-7">sft</span>{/if}
                {#each range(0, Math.ceil(row.length / 2)) as col}
                  {@const ch = row.charAt(col * 2)}
                  {#if ch == ' '}
                    <span class="space" />
                  {:else}
                    <span class="ocell" class:home={i === 2 && col > 0}>{ch}</span>
                  {/if}
                {/each}
                {#if i == 0}<span class="scell w-12">bspc</span>{/if}
                {#if i == 1}<span class="scell w-9 iso">ret</span>{/if}
                {#if i == 3}<span class="scell w-18">sft</span>{/if}
              </div>
            </div>
          {/each}
        </div>
        <div class="flex justify-between text-sm">
          <div class="flex items-center">
            {#if LAYOUTS[layout].languages.some((l) => l.qmk || l.qmkCharset)}
              <Icon class="text-teal-600 mr-2" path={mdiCheckCircle} size="20px" />
              Supported in QMK
            {:else}
              <Icon class="text-amber-600 mr-2" path={mdiAlertCircle} size="20px" />
              Not supported in QMK
            {/if}
          </div>
          <div class="flex items-center">
            {#if LAYOUTS[layout].languages.some((l) => l.zmk || l.zmkCharset)}
              <Icon class="text-teal-600 mr-2" path={mdiCheckCircle} size="20px" />
              Supported in ZMK
            {:else}
              <Icon class="text-amber-600 mr-2" path={mdiAlertCircle} size="20px" />
              Not supported in ZMK
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .space {
    --at-apply: 'inline-flex w-6';
  }
  .ocell {
    --at-apply: 'inline-flex items-center justify-center w-6 h-6 rounded bg-pink-50 text-pink-900 font-mono text-xs border border-pink-300';
  }
  .ocell.home {
    --at-apply: 'bg-pink-200 border-pink-400';
  }
  .scell {
    --at-apply: 'inline-flex items-center justify-center h-6 rounded bg-pink-200 text-pink-900 font-mono text-xs border border-pink-100';
  }
  .iso {
    position: relative;
    border-bottom-right-radius: 0;
    padding-top: 2px;
  }
  .iso::after {
    content: ' ';
    --at-apply: 'absolute w-7 h-7 right--1px top-[calc(1.5rem-2px)] rounded bg-pink-200 border border-pink-100 border-t-pink-200';
    border-top-left-radius: 0;
    border-top-right-radius: 0;
  }
</style>
