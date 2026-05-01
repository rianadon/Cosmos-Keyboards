<script lang="ts">
  import { createTooltip, melt } from '@melt-ui/svelte'
  import { fade } from 'svelte/transition'
  import {
    flipLetter,
    getLayout,
    isNamedLayoutId,
    LAYOUT,
    type LayoutId,
    type NamedLayoutId,
  } from '$lib/layouts'

  type Option = { key: LayoutId; label: string }

  export let option: Option

  const CUSTOM_DESCRIPTION =
    "Your own layout — Cosmos won't auto-fill or overwrite key legends. Click a key in the 3D view and edit the Letter field to set custom legends per key."

  $: description = isNamedLayoutId(option.key) ? getLayout(option.key).description : CUSTOM_DESCRIPTION
  $: rightRows = isNamedLayoutId(option.key) ? getLayout(option.key).rightRows : null

  // Render exactly the canonical 5-column alpha block per side. Some layouts
  // include a 6th outer-pinky character on the right (`'` in QWERTY/Colemak/
  // Workman, `/` and `-` in Dvorak) that has no symmetric left-side equivalent
  // in the flipMap, so showing it on the left would produce stray glyphs.
  const ALPHA_COLS = 5

  // The three alpha rows the layout defines (top, home, bottom). Typed as the
  // literal union the rightRows record actually has, so {#each} lookups index
  // it without TS complaining about `number`.
  const ALPHA_ROWS: (2 | 3 | 4)[] = [2, 3, 4]

  // Right side: first 5 chars in column-position order (index inner → pinky outer).
  function rightCells(row: string): string[] {
    return [...row.slice(0, ALPHA_COLS)]
  }

  // Left side: same 5 columns mirrored. Physical order is pinky outer → index
  // inner, i.e. the right row reversed and flipped through the layout's map.
  function leftCells(row: string, layoutId: NamedLayoutId): string[] {
    return [...row.slice(0, ALPHA_COLS)].reverse().map((ch) => flipLetter(ch, layoutId) ?? ch)
  }

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
    <div class="px-6 py-4 max-w-80 layoutinfo">
      {#if rightRows && isNamedLayoutId(option.key)}
        <!-- Split-ortholinear render: left and right alpha blocks side-by-side
             with a gap representing the split. Three rows shown (top alpha,
             home, bottom alpha); home row highlighted. -->
        <div class="ortho mb-3" aria-hidden="true">
          {#each ALPHA_ROWS as row}
            <div class="orow">
              <div class="oside">
                {#each leftCells(rightRows[row], option.key) as ch}
                  <span class="ocell" class:home={row === 3}>{ch}</span>
                {/each}
              </div>
              <div class="ogap" />
              <div class="oside">
                {#each rightCells(rightRows[row]) as ch}
                  <span class="ocell" class:home={row === 3}>{ch}</span>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {:else if option.key === LAYOUT.CUSTOM}
        <div class="ortho mb-3" aria-hidden="true">
          {#each [0, 1, 2] as r}
            <div class="orow">
              <div class="oside">
                {#each Array(5) as _}
                  <span class="ocell custom">?</span>
                {/each}
              </div>
              <div class="ogap" />
              <div class="oside">
                {#each Array(5) as _}
                  <span class="ocell custom">?</span>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}
      <p>{description}</p>
    </div>
  </div>
{/if}

<style>
  .ortho {
    --at-apply: 'flex flex-col items-center gap-1';
  }
  .orow {
    --at-apply: 'flex items-center';
  }
  .oside {
    --at-apply: 'flex gap-1';
  }
  .ogap {
    --at-apply: 'w-4';
  }
  .ocell {
    --at-apply: 'inline-flex items-center justify-center w-6 h-6 rounded bg-pink-50 dark:bg-pink-100 text-pink-900 font-mono text-xs border border-pink-300';
  }
  .ocell.home {
    --at-apply: 'bg-pink-300 dark:bg-pink-300 border-pink-500';
  }
  .ocell.custom {
    --at-apply: 'opacity-60 italic';
  }
  :global(.layoutinfo p) {
    --at-apply: 'mb-1';
  }
</style>
