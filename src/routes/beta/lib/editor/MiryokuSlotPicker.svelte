<script lang="ts">
  import { type MiryokuSlot } from '$lib/keymap/miryoku'
  import { hasPinsInMatrix } from '$lib/loaders/keycaps'
  import { logicalKeys, type Matrix } from '../firmware/firmwareHelpers'
  import { suggestMiryokuPositions } from '../firmware/miryokuLayout'
  import type { FullGeometry } from '../viewers/viewer3dHelpers'

  export let geometry: FullGeometry
  /** Matrix from peaMK key-press (or test mode). Maps CuttleKey → [row, col].
   *  Used to display each slot's assignment as a `row,col` pair — matching the
   *  labels shown on the keyboard view — instead of an opaque ZMK position. */
  export let matrix: Matrix
  /** Slot → ZMK position. Includes both auto-suggestions and overrides. */
  export let slotToPosition: Partial<Record<MiryokuSlot, number>> = {}
  /** User overrides (subset of slotToPosition). Keys absent here use auto-suggestions. */
  export let overrides: Partial<Record<MiryokuSlot, number>> = {}

  $: suggestions = suggestMiryokuPositions(geometry)
  $: slotToPosition = { ...suggestions, ...overrides }

  // Build two lookups indexed by ZMK position (logicalKeys-filtered-by-pins):
  //   posToCoord: ZMK pos → "row,col" string for display
  //   coordToPos: "row,col" string → ZMK pos for parsing override input
  //   posToLetter: ZMK pos → keycap letter (uppercase) when present
  $: posMaps = (() => {
    const posToCoord = new Map<number, string>()
    const coordToPos = new Map<string, number>()
    const posToLetter = new Map<number, string>()
    let zmkPos = 0
    for (const key of logicalKeys(geometry)) {
      if (!hasPinsInMatrix(key)) {
        zmkPos++
        continue
      }
      const mc = matrix.get(key)
      if (mc) {
        const coord = `${mc[0]},${mc[1]}`
        posToCoord.set(zmkPos, coord)
        coordToPos.set(coord, zmkPos)
      }
      if ('keycap' in key && key.keycap?.letter) {
        posToLetter.set(zmkPos, key.keycap.letter.toUpperCase())
      }
      zmkPos++
    }
    return { posToCoord, coordToPos, posToLetter }
  })()

  function coordOf(pos: number | undefined): string {
    if (pos === undefined) return ''
    return posMaps.posToCoord.get(pos) ?? `#${pos}`
  }

  /** Parse a "row,col" or "row, col" override; clear the override if empty or invalid. */
  function setOverride(slot: MiryokuSlot, value: string) {
    const trimmed = value.replace(/\s+/g, '')
    const pos = trimmed === '' ? undefined : posMaps.coordToPos.get(trimmed)
    if (pos !== undefined) {
      overrides = { ...overrides, [slot]: pos }
    } else {
      const next = { ...overrides }
      delete next[slot]
      overrides = next
    }
  }

  function reset() {
    overrides = {}
  }

  // Layout: two halves separated by a visual gap. Slots in physical order so
  // each row reads like the keyboard from left pinky to right pinky.
  // Cosmos col index 0 = leftmost-physical, so:
  //   left half:  L<row>0 (pinky outer) … L<row>4 (inner reach near center)
  //   right half: R<row>0 (inner reach near center) … R<row>4 (pinky outer)
  type SlotRowDef = { label: string; left: MiryokuSlot[]; right: MiryokuSlot[]; thumbs?: boolean }
  const SLOT_ROWS: SlotRowDef[] = [
    {
      label: 'Top',
      left: ['L00', 'L01', 'L02', 'L03', 'L04'],
      right: ['R00', 'R01', 'R02', 'R03', 'R04'],
    },
    {
      label: 'Home',
      left: ['L10', 'L11', 'L12', 'L13', 'L14'],
      right: ['R10', 'R11', 'R12', 'R13', 'R14'],
    },
    {
      label: 'Bottom',
      left: ['L20', 'L21', 'L22', 'L23', 'L24'],
      right: ['R20', 'R21', 'R22', 'R23', 'R24'],
    },
    { label: 'Thumbs', left: ['LT0', 'LT1', 'LT2'], right: ['RT2', 'RT1', 'RT0'], thumbs: true },
  ]

  type Card = {
    slot: MiryokuSlot
    suggestedCoord: string
    overriddenCoord: string
    letter: string | null
  }

  $: rowCards = SLOT_ROWS.map((row) => {
    const build = (slot: MiryokuSlot): Card => {
      const suggested = suggestions[slot]
      const overridden = overrides[slot]
      const pos = overridden ?? suggested
      const letter = pos !== undefined ? posMaps.posToLetter.get(pos) ?? null : null
      return {
        slot,
        suggestedCoord: coordOf(suggested),
        overriddenCoord: coordOf(overridden),
        letter,
      }
    }
    return {
      label: row.label,
      thumbs: !!row.thumbs,
      left: row.left.map(build),
      right: row.right.map(build),
    }
  })

  $: assignedCount = Object.keys(slotToPosition).length
  $: overrideCount = Object.keys(overrides).length
</script>

<div class="mt-4 mb-4 p-4 bg-gray-100 dark:bg-gray-800 rounded">
  <div class="flex items-center justify-between mb-2">
    <h3 class="font-bold">Miryoku Slot Assignment ({assignedCount}/36)</h3>
    <button
      type="button"
      class="text-pink-600 underline text-sm disabled:opacity-50 disabled:no-underline"
      on:click={reset}
      disabled={overrideCount === 0}
    >
      Reset overrides ({overrideCount})
    </button>
  </div>
  <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
    Each card maps a Miryoku slot to one physical key. The big letter is the keycap legend (or <span
      class="font-mono">—</span
    >
    when the key has no label, typically a thumb). The small <span class="font-mono">row,col</span> below
    is the matrix coordinate from your keyboard view; type a different
    <span class="font-mono">row,col</span> to override.
  </p>

  <div class="flex flex-col gap-3">
    {#each rowCards as row}
      <div>
        <div class="text-xs text-gray-500 mb-1 uppercase tracking-wide">{row.label}</div>
        <div class="grid gap-1" class:grid-fingers={!row.thumbs} class:grid-thumbs={row.thumbs}>
          {#if row.thumbs}<div class="col-span-2" />{/if}
          {#each row.left as card (card.slot)}
            <div class="slot-card" class:overridden={card.overriddenCoord !== ''}>
              <span class="slot-id">{card.slot}</span>
              {#if card.letter}
                <span class="slot-letter" class:slot-letter-long={card.letter.length > 2}>
                  {card.letter}
                </span>
              {:else}
                <span class="slot-letter slot-letter-empty">—</span>
              {/if}
              <input
                class="slot-pos"
                type="text"
                inputmode="numeric"
                placeholder={card.suggestedCoord || '—'}
                value={card.overriddenCoord}
                on:input={(e) => setOverride(card.slot, e.currentTarget.value)}
              />
            </div>
          {/each}
          <div class="slot-gap" />
          {#each row.right as card (card.slot)}
            <div class="slot-card" class:overridden={card.overriddenCoord !== ''}>
              <span class="slot-id">{card.slot}</span>
              {#if card.letter}
                <span class="slot-letter" class:slot-letter-long={card.letter.length > 2}>
                  {card.letter}
                </span>
              {:else}
                <span class="slot-letter slot-letter-empty">—</span>
              {/if}
              <input
                class="slot-pos"
                type="text"
                inputmode="numeric"
                placeholder={card.suggestedCoord || '—'}
                value={card.overriddenCoord}
                on:input={(e) => setOverride(card.slot, e.currentTarget.value)}
              />
            </div>
          {/each}
          {#if row.thumbs}<div class="col-span-2" />{/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .grid-fingers {
    grid-template-columns: repeat(5, minmax(0, 1fr)) 0.5rem repeat(5, minmax(0, 1fr));
  }
  .grid-thumbs {
    grid-template-columns:
      repeat(2, minmax(0, 1fr)) repeat(3, minmax(0, 1fr)) 0.5rem repeat(3, minmax(0, 1fr))
      repeat(2, minmax(0, 1fr));
  }
  .slot-card {
    --at-apply: 'flex flex-col items-center rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-1 py-1';
  }
  .slot-card.overridden {
    --at-apply: 'border-pink-500 border-2';
  }
  .slot-id {
    --at-apply: 'text-[10px] text-gray-400 leading-none';
  }
  .slot-letter {
    --at-apply: 'text-base font-bold text-gray-700 dark:text-gray-100 leading-tight';
  }
  .slot-letter-long {
    --at-apply: 'text-xs';
  }
  .slot-letter-empty {
    --at-apply: 'text-base font-normal text-gray-400 dark:text-gray-500';
  }
  .slot-pos {
    --at-apply: 'w-full text-[10px] text-center px-0.5 mt-0.5 rounded bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-0 focus:outline-pink-500 font-mono';
  }
</style>
