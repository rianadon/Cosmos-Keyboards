<script lang="ts">
  import { onDestroy, onMount } from 'svelte/internal'
  import Step from '../lib/Step.svelte'
  import { pc, remoteStream, mmToPx, step, stats } from '../store'
  // import ARTK from '@ar-js-org/artoolkit5-js'
  // import AR from '../lib/aruco/aruco.mjs';
  import { Matrix4, Vector3, Vector4 } from 'three'
  import calcStat, { INITIAL_STAT } from '../lib/stats'
  import createDetector, { type Detector } from '../lib/detector'
  import BigHand from '../lib/BigHand.svelte'
  import { calculateJoints, makeHand, type Hand, type Joints, type PoseHand } from '../lib/hand'
  import { browser } from '$app/environment'
  import { cameraToMarkerPoint } from '../lib/reconstruction'
  import { drawKeypoints } from '../lib/measurementHelpers'
  import { Camera } from '../lib/camera'
  import { mdiHandBackLeft, mdiHandBackRight } from '@mdi/js'
  import Icon from '$lib/presentation/Icon.svelte'
  import ChessboardDetector from '../lib/chessboardDetector'

  export let desiredHand: 'Left' | 'Right'

  let canvas: HTMLCanvasElement
  let transformation = 'none'
  let fps = 0

  let theHand: Hand
  let handPts: PoseHand
  let theJoints: Joints
  let outofViewport = false
  let size: [number, number] = [0, 0]
  let camera2AR = new Matrix4()
  let arTag1: HTMLElement
  let lastUpdate = 0
  let timeSinceLastUpdate = 0

  let hdetector: Detector
  let stat = stats[desiredHand]

  let boardUrl: string

  let detector: ChessboardDetector
  const GOAL = 50

  onMount(async () => {
    console.log('Remote stream', $remoteStream)

    $stat = INITIAL_STAT()

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
      const opencv = await import('$lib/opencv-contrib')
      detector = new ChessboardDetector(opencv.cv, 14, 5)
      boardUrl = detector.image()
      hdetector = await createDetector()
      const camera = new Camera(video, canvas)
      camera.ondetect = ondetect
      camera.ontick = ontick
      camera.onsize = (s) => {
        detector.setSize(s[0], s[1])
        size = s
      }
      camera.onfps = (f) => (fps = f)
      camera.start()
      setTimeout(() => resize(), 100)
      return () => camera.stop()
    }
  })

  /** Runs if a charuco board was detected */
  async function ondetect(imageData: ImageData) {
    try {
      if (await detector.detect(imageData, hdetector)) {
        const hand = detector.hands[desiredHand]
        if (hand && inFrame(hand)) {
          const arbr = arTag1.getBoundingClientRect()
          const arTagHeightPx = arbr.height / 5
          const arTagHeightMM = arTagHeightPx / $mmToPx

          theHand = makeHand(hand, true, (pt) =>
            cameraToMarkerPoint(
              detector.markermatrix,
              size,
              pt.x * size[0],
              pt.y * size[1]
            ).multiplyScalar(arTagHeightMM)
          )
          $stat = calcStat(theHand, $stat)
          if ($stat.history.length > 3) theJoints = calculateJoints($stat.history, $stat.means)

          handPts = detector.hands[desiredHand]!
          camera2AR = detector.markermatrix
          lastUpdate = performance.now()
        }
      }
    } catch (e) {
      if (typeof e == 'number') {
        console.log(detector.cv.exceptionFromPtr(e))
      }
      throw e
    }
  }

  /** Runs irregardless of whether a charuco board was detected */
  function ontick(context?: CanvasRenderingContext2D) {
    if (detector.valid && context) {
      detector.drawAxes(context)
      if (detector.hands.Left) drawKeypoints(canvas, context, detector.hands.Left.keypoints, 'Left')
      if (detector.hands.Right)
        drawKeypoints(canvas, context, detector.hands.Right.keypoints, 'Right')
    }

    timeSinceLastUpdate = performance.now() - lastUpdate
    if ($stat.history.length > GOAL) {
      $step++
      return false
    }
    return true
  }

  /**
   * Check that all keypoints are within the window.
   * This stops the model from guessing.
   */
  function inFrame(hand: PoseHand): boolean {
    return !hand.keypoints.some((k) => k.x < 0 || k.x > 1 || k.y < 0 || k.y > 1)
  }

  function resize() {
    if (!arTag1) return
    const rect = arTag1.getBoundingClientRect()
    const parent = arTag1.parentElement!.parentElement!.parentElement!.getBoundingClientRect()

    outofViewport =
      rect.top < 0 ||
      rect.left < 0 ||
      rect.bottom > document.documentElement.clientHeight ||
      rect.right > document.documentElement.clientWidth ||
      rect.top < parent.top ||
      rect.left < parent.left ||
      rect.bottom > parent.bottom ||
      rect.right > parent.right
  }

  $: nLeft = $stat.history.length
</script>

<svelte:window on:resize={resize} />

<Step>
  <span slot="title" class="relative z-5">Measure Your {desiredHand} Hand</span>
  <div slot="prose">
    Place your {desiredHand.toLowerCase()} hand on the screen, then position the phone camera in front
    of the screen so both the hand and screen are in view.
  </div>
  <div slot="content">
    {#if outofViewport}
      <div class="absolute top-10 left-0 right-0 text-center z-10">
        <div class="bg-red py-2 px-4 rounded inline-block relative shadow-lg shadow-black/30">
          Please resize the window so that the checkerboard is fully visible.
        </div>
      </div>
    {/if}
    <div
      class="mt-[-2rem] mb-2 bg-slate-700 px-6 py-2 rounded mx-auto w-64 font-mono relative overflow-hidden"
    >
      <div class="absolute inset-0 bg-pink-700" style="width: {(nLeft / GOAL) * 100}%" />
      <span class="relative">Measurements: {nLeft} / {GOAL}</span>
    </div>
    <div class="absolute top-0 right-0 shadow-lg shadow-slate-800">
      <div class="font-mono bg-black text-center text-sm">
        {size[0]} x {size[1]}, {fps.toFixed(0)} FPS
      </div>
      <canvas bind:this={canvas} style="height: 160px; transform: {transformation}" />
    </div>
    <img class="artag" bind:this={arTag1} alt="" src={boardUrl} />
    <div class="pointer-events-none">
      <div
        class="absolute top-0 bottom-0 left-0 right-0 flex items-center justify-center text-pink"
      >
        <Icon
          path={desiredHand == 'Left' ? mdiHandBackLeft : mdiHandBackRight}
          size={$mmToPx * 50}
        />
      </div>
      <BigHand {handPts} {size} {camera2AR} arTag={arTag1} tslu={timeSinceLastUpdate} />
    </div>
  </div>
</Step>

<style>
  .artag {
    width: 100%;
    image-rendering: crisp-edges;
    image-rendering: pixelated;
  }
</style>
