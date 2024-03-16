<script lang="ts">
  import Step from '../lib/Step.svelte'
  import { calculateJoints, FINGERS, type Hand, type Joints } from '../lib/hand'
  import { stats } from '../store'
  import Stage from '../lib/Stage.svelte'
  import { onMount } from 'svelte'
  import { developer } from '$lib/store'
  import { statMedians, type Statistics } from '../lib/stats'

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
    {#if $developer && $stat.history.length > 0 && medians}
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
