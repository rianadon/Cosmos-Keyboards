<script lang="ts">
  // @ts-nocheck old file that's unused.

  import { onDestroy, onMount } from 'svelte/internal'
  import Step from '../lib/Step.svelte'
  import { pc, remoteStream, mmToPx, step } from '../store'
  // import ARTK from '@ar-js-org/artoolkit5-js'
  // import AR from '../lib/aruco/aruco.mjs';
  import POS from '../lib/aruco/posit1.mjs'
  import { Matrix3, Matrix4, Vector3, Vector4 } from 'three'
  import { spring } from 'svelte/motion'
  import calcStat, { INITIAL_STAT } from '../lib/stats'
  import Stage from '../lib/Stage.svelte'
  import BigHand from '../lib/BigHand.svelte'
  import { browser } from '$app/environment'
  import { base } from '$app/paths'
  // import cv from "@mjyc/opencv.js";j
  //  import { CV } from "mirada";
  // import cv from '../../../lib/opencv'
  // import { cv } from '@hpmason/opencv-contrib-wasm'

  let canvas: HTMLCanvasElement
  let rid: number
  let transformation = 'none'

  let stat = INITIAL_STAT()

  let message: string | undefined = undefined
  let size = [0, 0]
  $: portrait = false //size[0] < size[1]
  let camera2AR = new Matrix4()
  let camera2Hand = new Matrix4()
  let arTag1: HTMLElement
  let arTag2: HTMLElement
  let arTag3: HTMLElement
  let arTag4: HTMLElement
  let theCorners
  let thePose

  let boardUrl: string
  let reprojError = 0
  let nDetections = 0
  let cameraMatrix = new Matrix3()

  let lastPic = 0

  type OpenCV = typeof import('@hpmason/opencv-contrib-wasm')['cv']

  class ChessboardDetector {
    private size: any
    private corners: any
    private mat: any
    private mat3: any
    private gray: any
    private imageWidth = 0
    private imageHeight = 0
    private board: any
    private dictionary: any
    private chessboardCorners: number[][] = []

    public detections: { imageCorners: any; ids: any }[] = []

    constructor(public cv: OpenCV, private w: number, private h: number, private scale = 0.7) {
      this.size = new cv.Size(w, h)
      this.corners = new cv.Mat(w * h, 2, cv.CV_32F)
      this.mat = new cv.Mat()
      this.mat3 = new cv.Mat()
      this.gray = new cv.Mat()

      // const dict = Uint8Array.from(atob(DICTIONARY), c => c.charCodeAt(0))
      // const dictMat = new cv.Mat(50, 8, cv.CV_8U)
      // console.log(this.cv.aruco_Dictionary)
      this.dictionary = new this.cv.aruco_Dictionary(0)
      this.board = new this.cv.aruco_CharucoBoard(this.w, this.h, 1, this.scale, this.dictionary)

      // Populat the chessboard corners manually, since the OpenCV method for retrieving them isn't
      // exported in the WASM build
      for (let y = 1; y < h; y++) {
        for (let x = 1; x < w; x++) {
          this.chessboardCorners.push([x, y, 0])
        }
      }
    }

    image() {
      const arucoPts = 6
      const marginpts = (1 - this.scale) * arucoPts
      const ptsize = Math.round(arucoPts + marginpts) * 6
      const width = this.w * ptsize
      const height = this.h * ptsize

      const size = new this.cv.Size(width, height)
      const img = new this.cv.Mat(height, width, this.cv.CV_8UC1)
      this.board.draw(size, img)

      const canvas = document.createElement('canvas')
      this.cv.imshow(canvas, img)
      return canvas.toDataURL()
    }

    setSize(width: number, height: number) {
      this.imageWidth = width
      this.imageHeight = height
      this.mat.delete()
      this.gray.delete()
      this.mat = new this.cv.Mat(height, width, this.cv.CV_8UC4)
      this.mat3 = new this.cv.Mat(height, width, this.cv.CV_8UC3)
      this.gray = new this.cv.Mat(height, width, this.cv.CV_8UC1)
      this.detections = []
    }

    detect(imageData: ImageData): boolean {
      this.mat.data.set(imageData.data)
      this.cv.cvtColor(this.mat, this.gray, this.cv.COLOR_BGR2GRAY)
      // console.log(this.cv)
      // this.cv.imshow(canvas, this.gray)

      const corners = new this.cv.MatVector()
      const ids = new this.cv.Mat()

      this.cv.detectMarkers(this.gray, this.dictionary, corners, ids)

      this.cv.cvtColor(this.mat, this.mat3, this.cv.COLOR_RGBA2RGB)
      if (corners.size() > 0) {
        this.cv.drawDetectedMarkers(this.mat3, corners, ids)

        const charucoCorners = new this.cv.Mat()
        const charucoIds = new this.cv.Mat()
        this.cv.interpolateCornersCharuco(
          corners,
          ids,
          this.gray,
          this.board,
          charucoCorners,
          charucoIds
        )

        if (charucoCorners.rows > 3) {
          const width = this.mat.cols
          const height = this.mat.rows
          const cameraMatrix = this.cv.matFromArray(3, 3, this.cv.CV_64F, [
            1000,
            0,
            width / 2,
            0,
            1000,
            height / 2,
            0,
            0,
            1,
          ])
          const distCoeffs = new this.cv.Mat()
          const rvec = new this.cv.Mat(3, 1, this.cv.CV_64F)
          const tvec = new this.cv.Mat(3, 1, this.cv.CV_64F)

          this.cv.drawDetectedCornersCharuco(this.mat3, charucoCorners, charucoIds)
          const valid = this.cv.estimatePoseCharucoBoard(
            charucoCorners,
            charucoIds,
            this.board,
            cameraMatrix,
            distCoeffs,
            rvec,
            tvec
          )
          console.log(valid)
          if (valid) this.cv.drawFrameAxes(this.mat3, cameraMatrix, distCoeffs, rvec, tvec, 10, 3)

          this.detections.push({
            ids: charucoIds,
            imageCorners: charucoCorners,
          })
          return true
        }
        this.cv.imshow(canvas, this.mat3)
      }
      return false
    }

    calibrate() {
      const imSize = new this.cv.Size(this.imageWidth, this.imageHeight)

      const objPoints = new this.cv.MatVector()
      const imgPoints = new this.cv.MatVector()
      for (const { ids, imageCorners } of this.detections) {
        const objectCorners = new this.cv.Mat(ids.data32S.length, 3, this.cv.CV_32F)
        objectCorners.data32F.set([...ids.data32S].flatMap((id: number) => this.chessboardCorners[id]))
        imgPoints.push_back(imageCorners)
        objPoints.push_back(objectCorners)
      }

      const calibRvecs = new this.cv.MatVector()
      const calibTvecs = new this.cv.MatVector()
      const calibStdI = new this.cv.Mat()
      const calibStdE = new this.cv.Mat()
      const calibE = new this.cv.Mat()

      const camMatrix = this.cv.matFromArray(3, 3, this.cv.CV_64F, [
        1000,
        0,
        this.imageWidth / 2,
        0,
        1000,
        this.imageHeight / 2,
        0,
        0,
        1,
      ])
      const distCoeffs = new this.cv.Mat()
      const e = this.cv.calibrateCameraExtended(
        objPoints,
        imgPoints,
        imSize,
        camMatrix,
        distCoeffs,
        calibRvecs,
        calibTvecs,
        calibStdI,
        calibStdE,
        calibE,
        this.cv.CALIB_USE_INTRINSIC_GUESS
      )
      console.log(this.detections.length, 'done', e, camMatrix.data64F)
      // @ts-ignore
      cameraMatrix = cameraMatrix.set(...camMatrix.data64F)
      return e
    }
  }

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
        video.srcObject = stream.stream
        video.play()
      })
      const opencv = await import('$lib/opencv-contrib')
      const detector = new ChessboardDetector(opencv.cv, 14, 7)
      boardUrl = detector.image()
      rid = requestAnimationFrame(() => tick(video, detector))
    }
  })

  onDestroy(() => {
    if (browser) cancelAnimationFrame(rid)
  })

  // const detector = new AR.Detector();

  async function tick(video: HTMLVideoElement, detector: ChessboardDetector) {
    if (video.readyState == video.HAVE_ENOUGH_DATA && video.videoWidth > 0 && canvas) {
      if (video.videoWidth < video.videoHeight) transformation = 'rotate(-90deg)'
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      if (canvas.width != size[0]) detector.setSize(canvas.width, canvas.height)
      size = [video.videoWidth, video.videoHeight]
      const context = canvas.getContext('2d', { willReadFrequently: true })!
      context.drawImage(video, 0, 0, canvas.width, canvas.height)

      const time = performance.now()
      if (time - lastPic > 100) {
        try {
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
          if (detector.detect(imageData)) {
            lastPic = performance.now()
            nDetections = detector.detections.length
            if (
              detector.detections.length > 10 &&
              detector.detections.length <= 40 &&
              detector.detections.length % 20 == 0
            )
              reprojError = detector.calibrate()
          }
        } catch (e) {
          if (typeof e == 'number') {
            console.log(detector.cv.exceptionFromPtr(e))
          }
          throw e
        }
      }

      // var markers = detector.detect(imageData);
    }
    if (detector.detections.length >= 60) {
      $step++
    } else {
      rid = requestAnimationFrame(() => tick(video, detector))
    }
  }
</script>

<Step>
  <span slot="title" class="relative z-5">Calibrate Your Camera</span>
  <div slot="content" class="p-2 z-5">
    <!-- <div class="max-w-prose">
         <p class="mb-2">You'll use your phone to take pictures of your hand.</p>
         <p>This is because you'll still be needing your computer screen to orient the phone picture.</p>
         </div> -->
    <div class="relative z-5">
      {stat.history.length} / 100, {size[0]} x {size[1]}, {nDetections} -> {reprojError}<br />
      fx={cameraMatrix.elements[0]}, fy={cameraMatrix.elements[4]}, cx={cameraMatrix.elements[6]}, cy={cameraMatrix
        .elements[7]}
    </div>
    <div class="text-red relative z-5">
      {#if message}
        {message}
      {:else}
        &nbsp;
      {/if}
    </div>
    <div class="absolute z-2">
      <canvas
        bind:this={canvas}
        style="margin-top: 200px; height: 200px; transform: {transformation}"
        class="m-2"
      />
    </div>
    <!-- <img class="artag" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAHCAYAAADam2dgAAAAIElEQVQYV2NkYGD4DwQMjIyMIAZWmhGkAp8CsMahahIAKMpj+LIJUugAAAAASUVORK5CYII=" /> -->
    {#if boardUrl}
      <img class="artag" alt="" src={boardUrl} />
    {/if}
  </div>
</Step>

<style>
  .artag {
    width: 100%;
    image-rendering: crisp-edges;
    image-rendering: pixelated;
  }
</style>
