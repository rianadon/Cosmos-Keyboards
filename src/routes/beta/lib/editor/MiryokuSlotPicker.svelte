<script lang="ts">
  import { type MiryokuSlot, MIRYOKU_SLOTS } from '$lib/keymap/miryoku'
  import { hasPinsInMatrix } from '$lib/loaders/keycaps'
  import { logicalKeys } from '../firmware/firmwareHelpers'
  import { suggestMiryokuPositions } from '../firmware/miryokuLayout'
  import type { FullGeometry } from '../viewers/viewer3dHelpers'

  export let geometry: FullGeometry
  /** Slot → ZMK position. Includes both auto-suggestions and overrides. */
  export let slotToPosition: Partial<Record<MiryokuSlot, number>> = {}
  /** User overrides (subset of slotToPosition). Keys absent here use auto-suggestions. */
  export let overrides: Partial<Record<MiryokuSlot, number>> = {}

  $: suggestions = suggestMiryokuPositions(geometry)
  $: slotToPosition = { ...suggestions, ...overrides }

  // Build a list of all positions with a label (letter or "key #N").
  $: positionLabels = (() => {
    const labels: { pos: number; label: string }[] = []
    let zmkPos = 0
    for (const key of logicalKeys(geometry)) {
      if (!hasPinsInMatrix(key)) {
        zmkPos++
        continue
      }
      const letter = 'keycap' in key && key.keycap?.letter ? key.keycap.letter.toUpperCase() : null
      labels.push({ pos: zmkPos, label: letter ? `${zmkPos} (${letter})` : `${zmkPos}` })
      zmkPos++
    }
    return labels
  })()

  function setOverride(slot: MiryokuSlot, value: string) {
    const pos = value === '' ? undefined : Number(value)
    if (pos === undefined || Number.isNaN(pos)) {
      const next = { ...overrides }
      delete next[slot]
      overrides = next
    } else {
      overrides = { ...overrides, [slot]: pos }
    }
  }

  function reset() {
    overrides = {}
  }

  // Group slots into rows for display: top/home/bottom alpha + thumbs.
  const SLOT_ROWS: { label: string; slots: MiryokuSlot[] }[] = [
    {
      label: 'Top',
      slots: ['L00', 'L01', 'L02', 'L03', 'L04', 'R04', 'R03', 'R02', 'R01', 'R00'] as MiryokuSlot[],
    },
    {
      label: 'Home',
      slots: ['L10', 'L11', 'L12', 'L13', 'L14', 'R14', 'R13', 'R12', 'R11', 'R10'] as MiryokuSlot[],
    },
    {
      label: 'Bottom',
      slots: ['L20', 'L21', 'L22', 'L23', 'L24', 'R24', 'R23', 'R22', 'R21', 'R20'] as MiryokuSlot[],
    },
    { label: 'Thumbs', slots: ['LT0', 'LT1', 'LT2', 'RT2', 'RT1', 'RT0'] as MiryokuSlot[] },
  ]

  $: assignedCount = Object.keys(slotToPosition).length
</script>

<div class="mt-4 mb-4 p-4 bg-gray-100 dark:bg-gray-800 rounded">
  <div class="flex items-center justify-between mb-2">
    <h3 class="font-bold">Miryoku Slot Assignment ({assignedCount}/36)</h3>
    <button
      type="button"
      class="text-pink-600 underline text-sm"
      on:click={reset}
      disabled={Object.keys(overrides).length === 0}
    >
      Reset overrides
    </button>
  </div>
  <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
    Auto-suggested mapping from physical keys to Miryoku slots. Empty inputs use the suggestion; type a
    key position number to override.
  </p>
  {#each SLOT_ROWS as row}
    <div class="flex flex-wrap gap-1 mb-2 items-center">
      <span class="w-16 text-sm text-gray-500">{row.label}</span>
      {#each row.slots as slot}
        {@const suggested = suggestions[slot]}
        {@const overridden = overrides[slot]}
        {@const value = overridden ?? suggested}
        <div class="flex flex-col items-center">
          <span class="text-xs text-gray-500">{slot}</span>
          <input
            class="slot-input"
            class:overridden={overridden !== undefined}
            type="number"
            min="0"
            placeholder={suggested !== undefined ? String(suggested) : '—'}
            value={overridden ?? ''}
            on:input={(e) => setOverride(slot, e.currentTarget.value)}
            title={value !== undefined
              ? positionLabels.find((p) => p.pos === value)?.label ?? `pos ${value}`
              : 'unassigned'}
          />
        </div>
      {/each}
    </div>
  {/each}
</div>

<style>
  .slot-input {
    --at-apply: 'w-12 px-1 text-center text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-100';
  }
  .slot-input.overridden {
    --at-apply: 'border-pink-500';
  }
</style>
