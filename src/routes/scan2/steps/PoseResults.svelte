<script lang="ts">
  import Step from '../lib/Step.svelte'
  import { calculateJoints, type Joints, SolvedHand } from '../lib/hand'
  import { stats, poseStats } from '../store'
  import { statMedians, type Statistics } from '../lib/stats'
  import { Matrix4 } from 'three'
  import { onMount } from 'svelte'
  import Stage from '../lib/Stage.svelte'
  import { download } from '$lib/browser'

  const leftStats = stats.Left
  const rightStats = stats.Right
  const leftPoseStats = poseStats.Left
  const rightPoseStats = poseStats.Right

  interface HandData {
    time: Date
    version: number
    left: Joints
    right: Joints
  }

  let leftJoints: Joints
  let rightJoints: Joints
  let handData: HandData
  onMount(() => {
    leftJoints = calculateJoints($leftPoseStats.history, statMedians($leftStats))
    rightJoints = calculateJoints($rightPoseStats.history, statMedians($rightStats))
    handData = {
      time: new Date(),
      version: 2,
      left: leftJoints,
      // leftHistory: poseHistory(leftJoints, $leftPoseStats),
      right: rightJoints,
      // rightHistory: poseHistory(rightJoints, $rightPoseStats),
    }
    try {
      // Try to prepend to the old hand data
      const oldJSON = localStorage.getItem('cosmosHands')
      if (!oldJSON) throw new Error('No old hands')
      const oldHands = JSON.parse(oldJSON)
      localStorage.setItem('cosmosHands', JSON.stringify([handData, ...oldHands]))
    } catch (e) {
      localStorage.setItem('cosmosHands', JSON.stringify([handData]))
    }
    resize()
  })

  function poseHistory(joints: Joints, stats: Statistics) {
    const solved = new SolvedHand(joints, new Matrix4())
    return stats.history.map((h) => {
      solved.fromAllLimbs(h.limbs, true)
      return solved.decomposeAllAngles()
    })
  }

  function downloadHands() {
    const blob = new Blob([JSON.stringify(handData, null, 2)], {
      type: 'application/json',
    })

    download(blob, 'hands.json')
  }
  let column: HTMLElement
  let columnWidth = 0
  const resize = () => {
    columnWidth = Math.min(
      column.clientWidth,
      window.innerHeight - column.getBoundingClientRect().top - 64
    )
  }
</script>

<svelte:window on:resize={resize} />
<Step showPrevious="Retake" showNext="Close">
  <span slot="title">Congratulations!</span>
  <div slot="prose">
    <p class="mb-2">
      You've successfully scanned your hand, and it's been automatically imported into the Cosmos
      generator. You can now close this tab.
    </p>
    <p class="mb-2">
      If you would like to use the hand data for your own projects, you can <button
        on:click={downloadHands}>download a JSON file</button
      >.
    </p>
    <p class="mb-2">
      Refer to the documentation to learn the format of this file and how you can use it.
    </p>
  </div>
  <div slot="content">
    <div class="flex">
      <div class="flex-1 overflow-hidden justify-center" bind:this={column}>
        <div class="w-full overflow-hidden relative">
          <Stage
            width={columnWidth}
            hand={$leftStats.history[$leftStats.history.length - 1]}
            otherHand={$rightStats.history[$rightStats.history.length - 1]}
            otherJoints={rightJoints}
            color="#A855F7"
            joints={leftJoints}
          />
        </div>
      </div>
      <div class="flex-1 overflow-hidden justify-center">
        <div class="w-full overflow-hidden relative">
          <Stage
            width={columnWidth}
            hand={$leftStats.history[$leftStats.history.length - 1]}
            flipHand
            otherHand={$leftStats.history[$leftStats.history.length - 1]}
            otherJoints={leftJoints}
            color="#D97706"
            joints={rightJoints}
          />
        </div>
      </div>
    </div>
  </div>
</Step>

<style>
  button {
    color: #f0abfc;
  }

  button:hover {
    text-decoration: underline;
  }
</style>
