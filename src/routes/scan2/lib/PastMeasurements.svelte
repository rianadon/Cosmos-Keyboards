<script lang="ts">
  import { download } from '$lib/browser'
  import type { HandData } from '$lib/handhelpers'
  import Icon from '$lib/presentation/Icon.svelte'
  import { mdiTrashCan } from '@mdi/js'

  let hands: HandData[] | undefined = undefined
  let sortedHands: HandData[] | undefined = undefined
  let active: HandData | undefined = undefined
  let fileSelector: HTMLInputElement
  try {
    const json = localStorage.getItem('cosmosHands')
    if (json) hands = JSON.parse(json)
  } catch (e) {}

  $: if (hands) {
    active = hands[0]
    sortedHands = hands.toSorted((a, b) => Date.parse(b.time) - Date.parse(a.time))
    localStorage.setItem('cosmosHands', JSON.stringify(hands))
  }

  function activate(hand: HandData) {
    const idx = hands!.indexOf(hand)
    if (idx >= 0) {
      hands!.splice(idx, 1)
      hands = [hand, ...hands!]
    }
  }

  function exportHand(hand: HandData) {
    const blob = new Blob([JSON.stringify(hand, null, 2)], {
      type: 'application/json',
    })
    download(blob, 'hands.json')
  }

  function deleteHand(hand: HandData) {
    const idx = hands!.indexOf(hand)
    if (idx >= 0) {
      hands!.splice(idx, 1)
      hands = hands
    }
  }

  function importHand() {
    const file = (fileSelector.files || [])[0]
    if (!file) return
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      const text = reader.result as string
      const file = JSON.parse(text)
      if (file.left && file.right) {
        const newHands = { time: new Date(), ...file }
        hands = hands ? [newHands, ...hands] : [newHands]
      }
    })
    reader.readAsText(file)
  }

  function copyScan() {
    if (!active) return
    console.log(active)
    const result = `Version: ${active.version}
Left  / thumb:  ${active.left.thumb.map((l: any) => l.length.toFixed(2)).join(', ')}
      / index:  ${active.left.indexFinger.map((l: any) => l.length.toFixed(2)).join(', ')}
      / middle: ${active.left.middleFinger.map((l: any) => l.length.toFixed(2)).join(', ')}
      / ring:   ${active.left.ringFinger.map((l: any) => l.length.toFixed(2)).join(', ')}
      / pinky:  ${active.left.pinky.map((l: any) => l.length.toFixed(2)).join(', ')}

Right / thumb:  ${active.right.thumb.map((l: any) => l.length.toFixed(2)).join(', ')}
      / index:  ${active.right.indexFinger.map((l: any) => l.length.toFixed(2)).join(', ')}
      / middle: ${active.right.middleFinger.map((l: any) => l.length.toFixed(2)).join(', ')}
      / ring:   ${active.right.ringFinger.map((l: any) => l.length.toFixed(2)).join(', ')}
      / pinky:  ${active.right.pinky.map((l: any) => l.length.toFixed(2)).join(', ')}
    `
    navigator.clipboard
      .writeText(result)
      .catch((e) => prompt('Unable to copy to clipboard. Please copy from here', result))
  }

  function deleteAll() {
    if (confirm('Are you sure you wish to remove all hand data from this device?')) {
      hands = []
    }
  }
</script>

{#if sortedHands && sortedHands.length}
  <h2 class="mt-10 text-3xl font-semibold text-purple">Past Scans</h2>
  <ul class="my-4 text-left">
    {#each sortedHands as hand}
      <li
        class="bg-slate-800 py-1 pl-4 pr-2 rounded-2 my-2 flex items-center"
        class:bg-purple-800!={hand == active}
      >
        <span class="text-gray-300 mr-4">{new Date(hand.time).toLocaleString()}</span>
        Hand Scan v{hand.version || '1'}
        {#if hand == active} (Active){/if}
        <div class="flex-1 flex justify-end gap-1">
          <button class="button" on:click={() => activate(hand)}>Activate</button>
          <button class="button" on:click={() => exportHand(hand)}>Export </button>
          <button class="button-thin" on:click={() => deleteHand(hand)}
            ><Icon path={mdiTrashCan} /></button
          >
        </div>
      </li>
    {/each}
    <div class="flex gap-2 justify-center">
      <button class="button2" on:click={() => fileSelector.click()}>Import</button>
      {#if active}
        <button class="button2" on:click={() => copyScan()}>Copy Active Scan</button>
      {/if}
      <button class="button2" on:click={deleteAll}>Delete All</button>
    </div>
  </ul>
{:else}
  <h2 class="mt-10 mb-4 text-3xl font-semibold text-purple">Past Scans</h2>
  <p class="text-gray-400 max-w-[44ch] mx-auto">
    If you've already scanned your hand on a different device, you can import it here.
  </p>
  <div class="flex justify-center my-6">
    <button class="button shadow-lg shadow-purple/30" on:click={() => fileSelector.click()}
      >Import An Existing Scan</button
    >
  </div>
{/if}
<input
  class="hidden"
  type="file"
  accept="application/json"
  on:change={importHand}
  bind:this={fileSelector}
/>

<style>
  .button {
    --at-apply: 'bg-gray-900  hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded focus:outline-none border border-transparent focus:border-pink-500 flex items-center gap-2';
  }
  .button2 {
    --at-apply: 'bg-purple-900  hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded focus:outline-none border border-transparent focus:border-pink-500 flex items-center gap-2';
  }
  .button-thin {
    --at-apply: 'bg-gray-900  hover:bg-indigo-700 text-white font-bold py-2 px-2 rounded focus:outline-none border border-transparent focus:border-pink-500 flex items-center gap-2';
  }
</style>
