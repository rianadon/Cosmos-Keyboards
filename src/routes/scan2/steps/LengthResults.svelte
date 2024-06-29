<script lang="ts">
  import { download } from '$lib/browser'
  import Step from '../lib/Step.svelte'
  import { calculateJoints, FINGERS, type Hand, type Joints } from '../lib/hand'
  import { stats, debugImgs } from '../store'
  import Stage from '../lib/Stage.svelte'
  import { onMount } from 'svelte'
  import { developer } from '$lib/store'
  import { statMedians, type Statistics } from '../lib/stats'
  import { Zip, ZipPassThrough, type FlateError, strToU8 } from 'fflate'

  export let desiredHand: 'Left' | 'Right'
  export let otherHand: 'Left' | 'Right' | undefined = undefined

  let stat = stats[desiredHand]
  let hand: Hand
  let theJoints: Joints
  let medians: Statistics['means']

  let otherStat = otherHand ? stats[otherHand] : undefined
  let theOtherHand: Hand | undefined
  let theOtherJoints: Joints | undefined

  onMount(() => {
    hand = $stat.history[$stat.history.length - 1]
    theJoints = calculateJoints($stat.history, statMedians($stat))
    medians = statMedians($stat)

    if (otherHand) {
      theOtherHand = $otherStat!.history[$otherStat!.history.length - 1]
      theOtherJoints = calculateJoints($otherStat!.history, statMedians($otherStat!))
    }
    resize()
  })

  let canvasSize: number
  let column: HTMLElement
  const resize = () => {
    canvasSize = window.innerHeight - column.getBoundingClientRect().top - 64
  }

  function downloadZip() {
    const blocks: ArrayBuffer[] = []
    const zip = new Zip((_err, dat, final) => {
      blocks.push(dat.buffer)
      if (final) {
        const blob = new Blob(blocks, { type: 'application/x-zip' })
        download(blob, 'images.zip')
      }
    })
    $debugImgs.forEach(({ img }, i) => {
      const file = new ZipPassThrough(`img${i}.png`)
      const imgBase64 = atob(img.substring(img.indexOf(',') + 1))
      const data = Uint8Array.from(imgBase64, (c) => c.charCodeAt(0))
      zip.add(file)
      file.push(data, true)
      console.log('added', i)
    })
    const data = new ZipPassThrough('data.json')
    zip.add(data)
    data.push(strToU8(JSON.stringify($debugImgs.map((i) => i.data))), true)
    zip.end()
  }

  $: console.log('hand', hand)
</script>

<Step showNext showPrevious="Retake">
  <span slot="title">Check Your {desiredHand} Hand Scan</span>
  <div slot="prose">
    <p class="mb-2">
      These are the measurements Cosmos took of your {desiredHand.toLowerCase()} hand.
    </p>
    <p>If they look correct, click the Next button.</p>
  </div>
  <div slot="content">
    <div class="flex">
      <div class="relative opacity-20">
        {#if otherHand}
          <Stage
            width={canvasSize}
            otherJoints={theJoints}
            color={otherHand == 'Left' ? '#A855F7' : '#D97706'}
            joints={theOtherJoints}
            flipHand={otherHand == 'Right'}
          />
        {/if}
      </div>
      <div class="relative" bind:this={column}>
        <Stage
          width={canvasSize}
          otherJoints={theOtherJoints}
          color={desiredHand == 'Left' ? '#A855F7' : '#D97706'}
          joints={theJoints}
          flipHand={desiredHand == 'Right'}
        />
      </div>
    </div>
    {#if true && $stat.history.length > 0 && medians}
      <button class="underline" on:click={downloadZip}>Download Images</button>
      <details class="overflow-scroll">
        <summary class="text-gray-300 bg-slate-7 px-2 rounded">Detailed Measurements</summary>
        {#each FINGERS as f}
          {#each $stat.history[0].limbs[f] as _, i}
            <b class="bg-slate-9 px-2 inline-block rounded">{f}[{i}]</b>
            <span>Mean: {$stat.means[f][i].toFixed(1)},</span>
            <span>Median: {medians[f][i].toFixed(1)}</span>
            <span>Std: {$stat.stds[f][i].toFixed(1)},</span>
            <div class="text-gray-300 text-sm">
              Measurements: {$stat.history.map((h) => h.limbs[f][i].length().toFixed(1)).join(' ')}
            </div>
          {/each}
        {/each}
      </details>
    {/if}
  </div>
</Step>
