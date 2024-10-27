<script lang="ts">
  import Stage from './lib/Stage.svelte'
  import Pose from './lib/Pose.svelte'
  import { type Hand, calculateJoints, type Joints } from './lib/hand'
  import { onMount } from 'svelte'
  import createDetector, { type Detector } from './lib/detector'
  import Display from './lib/Display.svelte'
  import calcStat, { INITIAL_STAT } from './lib/stats'
  import { browser } from '$app/environment'
  import { recording } from './lib/state'

  const GOAL = 1000

  let hands: { Left?: Hand; Right?: Hand } = {}

  let stream: MediaStream
  let video: HTMLVideoElement
  let detector: Detector
  let container: HTMLElement, footer: HTMLElement, column: HTMLElement
  let columnWidth = 0
  let recordingStarted = false
  let error: Error

  let videoWidth: number, videoHeight: number

  let leftStat = INITIAL_STAT(),
    rightStat = INITIAL_STAT()
  let leftJoints: Joints | undefined = undefined,
    rightJoints: Joints | undefined = undefined

  function isOk() {
    return !browser || !!window.navigator.mediaDevices?.getUserMedia
  }

  function setup(video: HTMLVideoElement) {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Oof')
    ;(leftStat = INITIAL_STAT()), (rightStat = INITIAL_STAT())
    ;(leftJoints = undefined), (rightJoints = undefined)
    recordingStarted = true
    requestAnimationFrame(() => container.scrollIntoView({ behavior: 'smooth' }))
    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: { facingMode: 'user' },
      })
      .then(async (s) => {
        $recording = true
        stream = s
        video.srcObject = stream
        await new Promise((r) => (video.onloadedmetadata = r))
        video.play()
        videoWidth = video.videoWidth
        videoHeight = video.videoHeight
      })
      .catch((e) => {
        error = e
        console.error(e)
      })
  }

  function teardown() {
    $recording = false
    if (stream) stream.getTracks().forEach((t) => t.stop())
  }

  onMount(async () => {
    detector = await createDetector()
    let rid = requestAnimationFrame(function update() {
      if (video.readyState == 4) {
        detector
          .estimateHands(video, { flipHorizontal: true })
          .then((h) => (hands = h))
          .catch((e) => console.error(e))
      }
      rid = requestAnimationFrame(update)
    })
    return () => {
      cancelAnimationFrame(rid)
      stream.getTracks().forEach((t) => t.stop())
    }
  })

  function download(blob: Blob, filename: string) {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  function downloadHands() {
    const blob = new Blob([JSON.stringify({ left: leftJoints, right: rightJoints }, null, 2)], {
      type: 'application/json',
    })

    download(blob, 'hands.json')
  }

  $: leftHand = hands.Left
  $: rightHand = hands.Right
  $: progress =
    Math.min(leftStat.history.length / GOAL, 0.5) + Math.min(rightStat.history.length / GOAL, 0.5)
  $: if (progress >= 1) {
    teardown()
    requestAnimationFrame(() => footer.scrollIntoView({ block: 'end', behavior: 'smooth' }))
    localStorage.setItem(
      'cosmosHands',
      JSON.stringify([{ time: new Date(), left: leftJoints, right: rightJoints }])
    )
  }

  $: if (leftHand && leftHand.score > 0.7) {
    leftStat = calcStat(leftHand, leftStat)
    if (leftStat.history.length > 3) leftJoints = calculateJoints(leftStat.history, leftStat.means)
  }

  $: if (rightHand && rightHand.score > 0.7) {
    rightStat = calcStat(rightHand, rightStat)
    if (rightStat.history.length > 3) rightJoints = calculateJoints(rightStat.history, rightStat.means)
  }

  const resize = () => {
    columnWidth = column.clientWidth
  }
  onMount(resize)
</script>

<svelte:window on:resize={resize} />

<div bind:this={container}>
  {#if error}
    <div class="mt-10 bg-red-400/30 text-white px-4 py-3 rounded-2" role="alert">
      <p class="mb-2">
        Sorry, there was an error trying to enable your webcam. Please check your browser and system
        settings to make sure that camera access is allowed.
      </p>
      <p>Here is the error from your browser: "{error.message}"</p>
    </div>
  {:else if isOk()}
    {#if $recording}
      {#if progress == 0}<p class="pt-4">Please place both your hands in front of the camera.</p>
      {:else}
        <div
          class="mt-10 bg-gradient-to-br from-purple-400 to-amber-600 text-xl px-1 py-0.5 rounded-2 shadow-lg shadow-pink/40 flex justify-end"
        >
          <span
            class="block bg-slate-900 h-6 rounded-r-1.5 text-pink-200 font-semibold"
            style={`width: ${100 - progress * 100}%`}
          />
        </div>
      {/if}
    {:else}
      <button
        class="mt-10 bg-gradient-to-br from-purple-400 to-amber-600 text-xl p-1 rounded-2 shadow-lg shadow-pink/40 transition-all hover:shadow-pink/60 hover:scale-105 hover:-translate-y-0.5"
        on:click={() => setup(video)}
      >
        <span class="block bg-slate-900 px-8 py-2 rounded-1.5 text-pink-200 font-semibold">
          Start Scan
        </span>
      </button>
    {/if}
    {#if $recording}
      <div class="w-60 lg:w-80 fixed rounded border-white border-4 top-20 right-4 mx-auto">
        <Display {hands} width={videoWidth} height={videoHeight} {video} />
      </div>
    {/if}
    <!-- svelte-ignore a11y-media-has-caption -->
    <video bind:this={video} playsinline style="display: none;" />
    <div class="flex">
      <div class="flex-1 overflow-hidden" bind:this={column}>
        {#if recordingStarted}
          <div class="w-full aspect-square overflow-hidden">
            <Pose width={columnWidth} hand={leftHand} joints={leftJoints} />
          </div>
          <div class="w-full relative aspect-square overflow-hidden">
            <Stage width={columnWidth} hand={leftHand} color="#A855F7" joints={leftJoints} />
          </div>
        {/if}
      </div>
      <div class="flex-1 overflow-hidden">
        {#if recordingStarted}
          <div class="w-full aspect-square overflow-hidden">
            <Pose width={columnWidth} hand={rightHand} reverse joints={rightJoints} />
          </div>
          <div class="w-full relative aspect-square overflow-hidden">
            <Stage width={columnWidth} hand={rightHand} color="#D97706" joints={rightJoints} />
          </div>
        {/if}
      </div>
    </div>
    <div bind:this={footer} class="mt-10 pb-4">
      {#if progress >= 1}
        <p class="mb-2 font-bold text-white">Great job! You've successfully scanned your hand.</p>
        <p class="mb-2">
          Your hand has been saved to the browser. You can also <button
            class="hover:underline text-purple"
            on:click={downloadHands}>download the data.</button
          >
        </p>
        <p>
          If you are happy with the results, you can close this tab. Othwerise, click "Start Scan" again
          to rescan.
        </p>
      {/if}
    </div>
  {:else}
    <div class="mt-10 bg-red-400/30 text-white px-4 py-3 rounded-2" role="alert">
      Your browser does not support the APIs needed to analyze video.
    </div>
  {/if}
</div>
