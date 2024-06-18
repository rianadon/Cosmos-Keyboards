<script lang="ts">
  import { onMount } from 'svelte/internal'
  import Step from '../lib/Step.svelte'
  import Pose from '../lib/Pose.svelte'
  import { remoteStream, step, stats, poseStats, mmToPx } from '../store'
  import calcStat, { INITIAL_STAT, statMedians } from '../lib/stats'
  import createDetector, { type Detector } from '../lib/detector'
  import {
    calculateJoints,
    makeHand,
    type Hand,
    type PoseHand,
    handOrientation,
    SolvedHand,
    type Joints,
  } from '../lib/hand'
  import { browser } from '$app/environment'
  import { Camera } from '../lib/camera'
  import { drawKeypoints } from '../lib/measurementHelpers'
  import { base } from '$app/paths'
  import { Euler, Matrix4, Quaternion } from 'three'

  let canvas: HTMLCanvasElement
  let transformation = 'none'

  let size = [0, 0]
  let fps = 0
  let hdetector: Detector
  let pHands: { Left?: PoseHand; Right?: PoseHand } = {}

  const GOAL = 150000
  const SGOAL = 5

  const PHASES = 3
  let phase = 0
  let curlPhase = false

  onMount(async () => {
    console.log('Remote stream', $remoteStream)

    if (browser) {
      const video = document.createElement('video')
      remoteStream.subscribe((stream) => {
        if (!stream) {
          console.error('No stream')
          return
        }
        console.log('Got stream!', stream)
        video.srcObject = stream!.stream
        video.play()
      })
      hdetector = await createDetector()

      const camera = new Camera(video, canvas)
      camera.ondetect = ondetect
      camera.ontick = ontick
      camera.onsize = (s) => (size = s)
      camera.onfps = (f) => (fps = f)
      camera.start()
      return () => camera.stop()
    }
  })

  async function ondetect(imageData: ImageData) {
    pHands = await hdetector.estimateHands(imageData as any, { flipHorizontal: true })
    if (pHands.Left) {
      hands.Left = makeHand(pHands.Left)
      $leftPoseStats = calcStat(hands.Left, $leftPoseStats)
      if (leftSuccess < SGOAL)
        leftQuality = curlPhase
          ? curlQuality(hands.Left, leftJoints)
          : scoreQuality(
              handOrientation(hands.Left).angleTo(leftReferences[phase] || new Quaternion())
            )
      if (leftQuality == 1) leftSuccess++
    }
    if (pHands.Right) {
      hands.Right = makeHand(pHands.Right)
      $rightPoseStats = calcStat(hands.Right, $rightPoseStats)
      if (rightSuccess < SGOAL)
        rightQuality = curlPhase
          ? curlQuality(hands.Right, rightJoints)
          : scoreQuality(
              handOrientation(hands.Right).angleTo(rightReferences[phase] || new Quaternion())
            )
      if (rightQuality == 1) rightSuccess++
    }
  }

  function ontick(context?: CanvasRenderingContext2D) {
    if (context) {
      if (pHands.Left) drawKeypoints(canvas, context, pHands.Left.keypoints, 'Left')
      if (pHands.Right) drawKeypoints(canvas, context, pHands.Right.keypoints, 'Right')
    }

    if (leftSuccess >= SGOAL && rightSuccess >= SGOAL && !queuedPhaseInc) {
      queuedPhaseInc = true
      setTimeout(() => {
        queuedPhaseInc = false
        leftSuccess = 0
        rightSuccess = 0

        // Advance to curl phase or the next phase
        if (curlPhase) {
          phase++
          curlPhase = false
        } else curlPhase = true
      }, 300)
    }

    if (phase >= leftReferences.length) {
      $step++
      return false
    }
    // if ($leftPoseStats.history.length > GOAL && $rightPoseStats.history.length) {
    // $step++
    // return false
    // }
    return true
  }

  let hands: { Left?: Hand; Right?: Hand } = {}
  $: leftHand = hands.Left
  $: rightHand = hands.Right

  const leftStats = stats.Left
  const rightStats = stats.Right
  const leftPoseStats = poseStats.Left
  const rightPoseStats = poseStats.Right
  $: leftMedians = statMedians($leftStats)
  $: leftJoints = calculateJoints(
    $leftPoseStats.history.length > 3 ? $leftPoseStats.history : $leftStats.history,
    leftMedians
  )
  $: rightMedians = statMedians($rightStats)
  $: rightJoints = calculateJoints(
    $rightPoseStats.history.length > 3 ? $rightPoseStats.history : $rightStats.history,
    rightMedians
  )
  $: nLeft = $leftPoseStats.history.length
  $: nRight = $rightPoseStats.history.length

  function scoreQuality(angle: number) {
    const closeness = 1 - angle / Math.PI
    return Math.min(1, closeness / 0.8) ** 3
  }

  function curlQuality(hand: Hand, joints: Joints) {
    const solved = new SolvedHand(joints, new Matrix4())
    solved.fromAllLimbs(hand.limbs, true)
    return Math.min(1, solved.approximateCurl() / 80)
  }

  let leftQuality = 0
  let rightQuality = 0

  const leftReferences = [
    new Quaternion().setFromEuler(new Euler(Math.PI, 0, 0)),
    new Quaternion().setFromEuler(new Euler(Math.PI, -Math.PI / 2, 0)),
    new Quaternion().setFromEuler(new Euler(Math.PI, -Math.PI / 2, -Math.PI / 2)),
  ]
  const rightReferences = [
    new Quaternion().setFromEuler(new Euler(Math.PI, Math.PI, 0)),
    new Quaternion().setFromEuler(new Euler(Math.PI, -Math.PI / 2, 0)),
    new Quaternion().setFromEuler(new Euler(Math.PI, -Math.PI / 2, -Math.PI / 2)),
  ]

  let leftSuccess = 0
  let rightSuccess = 0
  let queuedPhaseInc = false

  onMount(() => {
    $leftPoseStats = INITIAL_STAT()
    $rightPoseStats = INITIAL_STAT()
  })

  let column: HTMLElement
  let columnWidth = 0
  const resize = () => {
    columnWidth = Math.min(
      column.clientWidth,
      window.innerHeight - column.getBoundingClientRect().top - 32
    )
  }
  onMount(resize)
</script>

<svelte:window on:resize={resize} />

<Step>
  <span slot="title" class="relative z-5">Measure Your Hand Poses</span>
  <div slot="prose">
    {#if nLeft == 0 && nRight == 0 && phase == 0}
      <p class="mb-2">
        Rest your phone on a vertical surface so that your hands are visible from the camera.
        Leaning it on a laptop screen or wall works well.
      </p>
      <p>With the phone in a stable position, place both hands in view of the camera.</p>
    {:else if curlPhase}
      <p class="mx--2 px-6 py-2 bg-pink-700 rounded text-lg">
        [{phase + 1}/{PHASES}] Now curl your fingers inwards.
      </p>
    {:else if phase == 0}
      <p class="mx--2 px-6 py-2 bg-pink-700 rounded text-lg">
        [1/{PHASES}] Stretch out your hands, point your fingertips towards each other, and rotate
        your palms downwards.
      </p>
    {:else if phase == 1}
      <p class="mx--2 px-6 py-2 bg-pink-700 rounded text-lg">
        [2/{PHASES}] Stretch out your hands and point your fingertips towards the camera, keeping
        your palms downwards.
      </p>
    {:else if phase == 2}
      <p class="mx--2 px-6 py-2 bg-pink-700 rounded text-lg">
        [3/{PHASES}] Stretch out your hands and point your fingertips upwardsand your palms towards
        the camera.
      </p>
    {/if}
  </div>
  <div slot="content">
    <div class="absolute top-0 right-0 shadow-lg shadow-slate-800">
      <div class="font-mono bg-black text-center text-sm">
        {size[0]} x {size[1]}, {fps.toFixed(0)} FPS
      </div>
      <canvas bind:this={canvas} style="height: 160px; transform: {transformation}" />
    </div>

    {#if nLeft == 0 && nRight == 0 && phase == 0}
      <div class="absolute left-0 right-0 mt-[calc(50vh-16rem)]">
        <img src="{base}/hands.png" width={$mmToPx * 100} class="mx-auto" />
      </div>
    {/if}

    <div class="flex">
      <div class="flex-1 overflow-hidden justify-center mx-4 text-center">
        <!-- <div
               class="mb-4 bg-slate-700 px-6 py-2 rounded inline-block w-64 font-mono relative overflow-hidden"
               >
               <div class="absolute inset-0 bg-pink-700" style="width: {(nLeft / GOAL) * 100}%" />
               <span class="relative">Left Hand: {nLeft} / {GOAL}</span>
               </div> -->
        <div class="w-full overflow-hidden flex justify-center" bind:this={column}>
          <div class="relative">
            <div
              class="absolute inset-0 rounded-45%"
              style="background: linear-gradient(#BE185D {50 * leftQuality}%, transparent {50 *
                leftQuality}%, transparent {100 - 50 * leftQuality}%, #BE185D {100 -
                50 * leftQuality}%)"
            />
            <div
              class="absolute inset-4 rounded-40%"
              class:bg-slate-800={leftSuccess < SGOAL}
              class:bg-pink-700={leftSuccess >= SGOAL}
            />
            <!-- <div style="height: {columnWidth}px; width: {columnWidth}px" /> -->
            <div class="relative">
              <Pose width={columnWidth} hand={leftHand} joints={leftJoints} />
            </div>
          </div>
        </div>
      </div>
      <div class="flex-1 overflow-hidden justify-center mx-4 text-center">
        <!-- <div
               class="mb-4 bg-slate-700 px-6 py-2 rounded inline-block w-64 font-mono relative overflow-hidden"
               >
               <div class="absolute inset-0 bg-pink-700" style="width: {(nRight / GOAL) * 100}%" />
               <span class="relative">Right Hand: {nRight} / {GOAL}</span>
               </div> -->
        <div class="w-full overflow-hidden flex justify-center">
          <div class="relative">
            <div
              class="absolute inset-0 rounded-45%"
              style="background: linear-gradient(#BE185D {50 * rightQuality}%, transparent {50 *
                rightQuality}%, transparent {100 - 50 * rightQuality}%, #BE185D {100 -
                50 * rightQuality}%)"
            />
            <div
              class="absolute inset-4 rounded-40%"
              class:bg-slate-800={rightSuccess < SGOAL}
              class:bg-pink-700={rightSuccess >= SGOAL}
            />
            <!-- <div style="height: {columnWidth}px; width: {columnWidth}px" /> -->
            <div class="relative">
              <Pose width={columnWidth} hand={rightHand} joints={rightJoints} />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</Step>
