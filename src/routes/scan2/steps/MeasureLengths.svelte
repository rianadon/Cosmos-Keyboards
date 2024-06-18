<script lang="ts">
  import { onDestroy, onMount } from 'svelte/internal'
  import Step from '../lib/Step.svelte'
  import { pc, remoteStream, mmToPx, step, stats, debugImgs } from '../store'
  import { developer } from '$lib/store'
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
  import SVGHand from '../lib/SVGHand.svelte'
  import { board } from '$lib/flags'

  export let desiredHand: 'Left' | 'Right'

  let canvas: HTMLCanvasElement
  let transformation = 'none'
  let fps = 0

  let theHand: Hand
  let handPts: PoseHand
  let theJoints: Joints
  let viewportTooSmall = false
  let size: [number, number] = [0, 0]
  let camera2AR = new Matrix4()
  let arTag1: HTMLElement
  let lastUpdate = 0
  let timeSinceLastUpdate = 0

  let hdetector: Detector
  let stat = stats[desiredHand]

  let boardUrl: string

  let detector: ChessboardDetector
  let camera: Camera
  const MIN_TAG_SIZE = 18 // Minimum tag size in mm
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
      resize()
      hdetector = await createDetector()
      camera = new Camera(video, canvas)
      camera.ondetect = ondetect
      camera.ontick = ontick
      camera.onsize = (s) => {
        detector.setSize(s[0], s[1])
        size = s
      }
      camera.onfps = (f) => (fps = f)
      camera.start()
    }
  })

  onDestroy(() => {
    if (camera) camera.stop()
  })

  /** Runs if a charuco board was detected */
  async function ondetect(imageData: ImageData) {
    try {
      if (await detector.detect(imageData, hdetector)) {
        const hand = detector.hands[desiredHand]
        if (hand && inFrame(hand)) {
          const arbr = arTag1.getBoundingClientRect()
          const arTagHeightPx = Math.min(
            arbr.height / detector.boardHeight,
            arbr.width / detector.boardWidth
          )
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
      const hands = detector.hands
      if (hands.Left) drawKeypoints(canvas, context, hands.Left.keypoints, 'Left')
      if (hands.Right) drawKeypoints(canvas, context, hands.Right.keypoints, 'Right')
      if ($developer && (hands.Left || hands.Right))
        $debugImgs = [
          ...$debugImgs,
          { img: context.canvas.toDataURL(), data: detector.debugData() },
        ]
    }

    timeSinceLastUpdate = performance.now() - lastUpdate
    if ($stat.history.length > GOAL) {
      console.log('PROGRESSING')
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

  let resizeQueued = false
  function recomputeCheckers() {
    resizeQueued = false
    const rect = arTag1.getBoundingClientRect()
    // Limit to 14x7 because there are 100 codes max. 14x7 = 98
    const tagsW = Math.min(Math.floor(rect.width / (MIN_TAG_SIZE * $mmToPx)), 14)
    const tagsH = Math.min(Math.floor(rect.height / (MIN_TAG_SIZE * $mmToPx)), 7)
    viewportTooSmall = tagsW < 3 || tagsH < 3
    if (!viewportTooSmall && detector.resizeBoard(tagsW, tagsH)) boardUrl = detector.image()
  }

  function resize() {
    if (!arTag1 || resizeQueued) return
    resizeQueued = true
    requestAnimationFrame(recomputeCheckers)
  }

  $: nLeft = $stat.history.length
</script>

<svelte:window on:resize={resize} />

<Step>
  <span slot="title" class="relative z-5">Measure Your {desiredHand} Hand</span>
  <div slot="prose">
    Place your {desiredHand.toLowerCase()} hand on the screen within the guides. Once it's there, position
    the phone camera in front of the screen so both the hand and screen are in view.
  </div>
  <div slot="content" class="flex flex-col h-full">
    {#if viewportTooSmall}
      <div class="absolute top-10 left-0 right-0 text-center z-10">
        <div class="bg-red py-2 px-4 rounded inline-block relative shadow-lg shadow-black/30">
          Please make the window bigger to include more checkers.
        </div>
      </div>
    {/if}
    <div
      class="flex-none mt-[-2rem] mb-2 bg-slate-700 px-6 py-2 rounded mx-auto w-64 font-mono relative overflow-hidden"
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
    <!-- <div class="flex-1 bg-red"> -->
    <div class="flex h-0 flex-auto items-center justify-center">
      <img
        class="w-full h-full flex-auto artag object-contain object-center"
        bind:this={arTag1}
        alt=""
        src={boardUrl}
        style="max-height:{7 * 1.5 * MIN_TAG_SIZE * $mmToPx}px; max-width:{14 *
          1.5 *
          MIN_TAG_SIZE *
          $mmToPx}px"
      />
    </div>
    <!-- </div> -->
    <div class="pointer-events-none">
      <div class="fixed top-0 bottom-0 left-0 right-0 flex items-center justify-center">
        {#if nLeft < 5}
          <SVGHand side={desiredHand} />
        {/if}
      </div>
      <BigHand {detector} {handPts} {size} {camera2AR} arTag={arTag1} tslu={timeSinceLastUpdate} />
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
