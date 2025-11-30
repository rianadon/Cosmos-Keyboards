<script lang="ts">
  import InfoBox from '$lib/presentation/InfoBox.svelte'
  import type { FullCuttleform } from '$lib/worker/config'
  import { groupBy, objEntriesNotNull } from '$lib/worker/util'
  import { qmkErrors, qmkInfo } from '../firmware/qmk'
  import { zmkErrors, zmkInfo } from '../firmware/zmk'
  import type { FullGeometry } from '../viewers/viewer3dHelpers'

  export let config: FullCuttleform
  export let geometry: FullGeometry

  $: anyConfig = config.right || config.unibody || { microcontroller: undefined }
  $: wireless = anyConfig.microcontroller == 'lemon-wireless'

  function collect(g: FullGeometry, f: typeof zmkInfo) {
    const entries = objEntriesNotNull(g).flatMap(([side, g]) =>
      Array.from(f(g)).map((v) => ({ side, message: v }))
    )
    return Array.from(groupBy(entries, (entry) => entry.message).entries()).map(
      ([message, entries]) => ({ message, sides: entries.map(({ side }) => side) })
    )
  }

  $: info = collect(geometry, wireless ? zmkInfo : qmkInfo)
  $: errors = collect(geometry, wireless ? zmkErrors : qmkErrors)
</script>

{#if errors.length}
  <InfoBox class="mt-4">
    <span class="text-[1rem] font-medium">Warnings</span>
    <ul class="mt-2">
      {#each errors as { sides, message }}
        <li>
          <span class="font-medium">On {sides.map((s) => s + ' side').join(', ')}</span>: {message}
        </li>
      {/each}
    </ul>
  </InfoBox>
{/if}

{#if info.length}
  <InfoBox class="mt-4">
    <span class="text-[1rem] font-medium">Information</span>
    <ul class="mt-2">
      {#each info as { sides, message }}
        <span class="font-medium">On {sides.map((s) => s + ' side').join(', ')}</span>: {message}
      {/each}
    </ul>
  </InfoBox>
{/if}
