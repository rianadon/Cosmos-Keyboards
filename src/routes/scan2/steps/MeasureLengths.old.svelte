<script lang="ts">
  import { onMount } from 'svelte/internal'
  import Step from '../lib/Step.svelte'
  import { pc, remoteStream, mmToPx } from '../store'
  import ARTK from '@ar-js-org/artoolkit5-js'
  // import AR from '../lib/aruco/aruco.mjs';
  import POS from '../lib/aruco/posit1.mjs'
  import { Matrix4, Vector3, Vector4 } from 'three'
  import { spring } from 'svelte/motion'
  import calcStat, { INITIAL_STAT } from '../lib/stats'
  import createDetector, { type Detector } from '../lib/detector'
  import Stage from '../lib/Stage.svelte'
  import BigHand from '../lib/BigHand.svelte'
  import {
    calculateJoints,
    makeHand,
    type Hand,
    type Joints,
    calculateJoints2D,
    type PoseHand,
  } from '../lib/hand'
  import { browser } from '$app/environment'
  import { base } from '$app/paths'
  // import cv from "@mjyc/opencv.js";j
  //  import { CV } from "mirada";
  import cv from '../../../lib/opencv'

  console.log('opencv', cv.CV_64F, cv)

  const objPoints = cv.matFromArray(4, 3, cv.CV_64F, [1, 2, 0, 3, 4, 0, 1, 3, 0, 3, 5, 0])
  const corners = cv.matFromArray(4, 2, cv.CV_32F, [1, 2, 3, 4, 1, 3, 3, 5])
  const camMatrix = cv.matFromArray(3, 3, cv.CV_64F, [1, 0, 3, 0, 1, 5, 0, 0, 1])
  const distMatrix = new cv.Mat()
  const rvec = new cv.Mat(3, 1, cv.CV_64F)
  const tvec = new cv.Mat(3, 1, cv.CV_64F)
  try {
    const result = cv.solvePnP(objPoints, corners, camMatrix, distMatrix, rvec, tvec)
    console.log('result', result, rvec.data64F, tvec.data64F, objPoints.data64F)
    const axis = new Vector3().fromArray(rvec.data64F)
    const length = axis.length()
    const matrix = new Matrix4().makeRotationAxis(axis.normalize(), length)
    matrix.setPosition(new Vector3().fromArray(tvec.data64F))
    console.log(matrix)
  } catch (e) {
    console.log(cv.exceptionFromPtr(e))
  }

  export let desiredHand: 'Left' | 'Right'

  const video = browser ? document.createElement('video') : undefined
  let canvas: HTMLCanvasElement
  let rid: number
  let transformation = 'none'

  let hdetector: Detector
  let stat = INITIAL_STAT()

  let theHand: Hand
  let handPts: PoseHand
  let theJoints: Joints
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

  let controller: ARTK.ARController

  let lastSizeX = 0
  let cameraMatrix = new Matrix4()
  function setupController(size) {
    if (size[0] == lastSizeX) return
    lastSizeX = size[0]
    const opts = { orientation: portrait ? 'portrait' : 'landscape' }
    ARTK.ARController.initWithDimensions(
      portrait ? size[1] : size[0],
      portrait ? size[0] : size[1],
      base + '/camera_para.dat',
      opts
    ).then((c) => {
      controller = c
      controller.setPatternDetectionMode(artoolkit.AR_MATRIX_CODE_DETECTION)
      controller.setMatrixCodeType(artoolkit.AR_MATRIX_CODE_3x3_HAMMING63)
      cameraMatrix.fromArray(controller.getCameraMatrix())
      // controller.debugSetup()
    })
  }

  $: setupController(size)

  onMount(async () => {
    console.log($remoteStream)
    remoteStream.subscribe((stream) => {
      video.srcObject = stream.stream
      video.play()
    })

    hdetector = await createDetector()
    rid = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rid)
  })

  // const detector = new AR.Detector();

  async function tick() {
    if (video.readyState == video.HAVE_ENOUGH_DATA && video.videoWidth > 0 && canvas && cv) {
      const portrait = false //video.videoWidth < video.videoHeight
      canvas.width = portrait ? video.videoHeight : video.videoWidth
      canvas.height = portrait ? video.videoWidth : video.videoHeight
      size = [video.videoWidth, video.videoHeight]
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (portrait) {
        context.save()
        context.translate(canvas.width, 0)
        context.rotate(Math.PI / 2)
        context.drawImage(video, 0, 0, canvas.height, canvas.width)
        context.restore()
      } else {
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
      }

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
      // var markers = detector.detect(imageData);
      const markers = []
      const listener = (ev) => {
        if (ev.data.marker.idMatrix >= 1 && ev.data.marker.idMatrix <= 4) {
          const v = ev.data.marker.vertex
          const dir = ev.data.marker.dirMatrix
          markers.push({
            id: ev.data.marker.idMatrix,
            corners: [
              new Vector3(v[(4 - dir) % 4][0], v[(4 - dir) % 4][1]),
              new Vector3(v[(5 - dir) % 4][0], v[(5 - dir) % 4][1]),
              new Vector3(v[(6 - dir) % 4][0], v[(6 - dir) % 4][1]),
              new Vector3(v[(7 - dir) % 4][0], v[(7 - dir) % 4][1]),
            ],
            matrix: new Matrix4().fromArray(ev.data.matrix),
            marker: {
              ...ev.data.marker,
            },
          })
        }
      }
      if (controller) {
        // Make sure the controller is updated with the right size
        if (controller.width == canvas.width) {
          controller.addEventListener('getMarker', listener)
          controller.process(imageData)
          controller.removeEventListener('getMarker', listener)
          // for (let i = 0; i < controller.getMarkerNum(); i++) {
          // markers.push(controller.getMarker(i))
          // }
        }
      }

      message = undefined
      if (!markers.length) {
        rid = requestAnimationFrame(tick)
        return
      }
      const detectorPromise = hdetector.estimateHands(imageData, { flipHorizontal: true })

      context.lineWidth = 30
      for (const marker of markers) {
        // console.log(marker)
        const corners = marker.corners

        context.strokeStyle = 'red'
        context.beginPath()

        for (let j = 0; j < corners.length; ++j) {
          let corner = corners[j]
          context.moveTo(corner.x, corner.y)
          corner = corners[(j + 1) % corners.length]
          context.lineTo(corner.x, corner.y)
        }

        context.stroke()
        context.closePath()

        context.strokeStyle = 'green'
        context.strokeRect(corners[0].x - 2, corners[0].y - 2, 4, 4)

        context.strokeStyle = 'orange'
        context.strokeRect(corners[1].x - 2, corners[1].y - 2, 4, 4)
      }

      const hands = await detectorPromise

      let pose: any
      const minMarkers = 1
      if (markers.length >= minMarkers) {
        const half = (25 * $mmToPx) / 2

        const ar1 = arTag1.getBoundingClientRect()
        const ar2 = arTag2.getBoundingClientRect()
        const ar3 = arTag3.getBoundingClientRect()
        const ar4 = arTag4.getBoundingClientRect()

        const objPoints = []
        for (const marker of markers) {
          if (marker.id == 1)
            objPoints.push(
              [-half, half, 0.0],
              [half, half, 0.0],
              [half, -half, 0.0],
              [-half, -half, 0.0]
            )
          if (marker.id == 2)
            objPoints.push(
              [-half + ar2.left - ar1.left, half, 0.0],
              [half + ar2.left - ar1.left, half, 0.0],
              [half + ar2.left - ar1.left, -half, 0.0],
              [-half + ar2.left - ar1.left, -half, 0.0]
            )
          if (marker.id == 3)
            objPoints.push(
              [-half + ar3.left - ar1.left, half - ar3.top + ar1.top, 0.0],
              [half + ar3.left - ar1.left, half - ar3.top + ar1.top, 0.0],
              [half + ar3.left - ar1.left, -half - ar3.top + ar1.top, 0.0],
              [-half + ar3.left - ar1.left, -half - ar3.top + ar1.top, 0.0]
            )
          if (marker.id == 4)
            objPoints.push(
              [-half + ar4.left - ar1.left, half - ar4.top + ar1.top, 0.0],
              [half + ar4.left - ar1.left, half - ar4.top + ar1.top, 0.0],
              [half + ar4.left - ar1.left, -half - ar4.top + ar1.top, 0.0],
              [-half + ar4.left - ar1.left, -half - ar4.top + ar1.top, 0.0]
            )
        }

        const objPointsM = cv.matFromArray(objPoints.length, 3, cv.CV_64F, objPoints.flat())
        const corners = markers.flatMap((m) => m.corners.map((c) => [c.x, c.y]))
        const cornersM = cv.matFromArray(corners.length, 2, cv.CV_32F, corners.flat())
        const camMatrix = cv.matFromArray(3, 3, cv.CV_64F, [
          canvas.width,
          0,
          canvas.width / 2,
          0,
          canvas.height,
          canvas.height / 2,
          0,
          0,
          1,
        ])
        // const camMatrix = cv.matFromArray(3, 3, cv.CV_64F, [canvas.width, 0, 0, 0, canvas.height, 0, 0, 0, 1]);
        const distMatrix = new cv.Mat()
        const rvec = new cv.Mat(3, 1, cv.CV_64F)
        const tvec = new cv.Mat(3, 1, cv.CV_64F)
        let markermatrix: Matrix4
        let projected: Vector3[] = []
        try {
          const result = cv.solvePnP(objPointsM, cornersM, camMatrix, distMatrix, rvec, tvec)
          // console.log('result', result, rvec.data64F, tvec.data64F, objPointsM.data64F, cornersM.data32F, camMatrix.data64F)

          console.log(objPointsM.data64F)
          const projPoints = new cv.Mat(corners.length, 2, cv.CV_32F)
          const proj = cv.projectPoints(objPointsM, rvec, tvec, camMatrix, distMatrix, projPoints)
          for (let i = 0; i < corners.length; i++) {
            projected.push(new Vector3(projPoints.data32F[i * 2], projPoints.data32F[i * 2 + 1], 0))
          }
          console.log(projected)

          const axis = new Vector3().fromArray(rvec.data64F)
          const length = axis.length()
          // console.log(axis.normalize())
          markermatrix = new Matrix4().makeRotationAxis(axis.normalize(), length)
          markermatrix.setPosition(new Vector3().fromArray(tvec.data64F))
        } catch (e) {
          console.log(cv.exceptionFromPtr(e))
        }

        // const posit = new POS.Posit(25 * $mmToPx, canvas.width, objPoints);
        // let corners = markers.flatMap(m => m.corners)
        // for (const corner of corners) {
        //     corner.x = (corner.x - (canvas.width / 2))
        //     corner.y = ((canvas.height / 2) - corner.y)
        // }
        // corners = [corners[2], corners[3], corners[0], corners[1]]
        // theCorners = corners
        // console.log(objPoints.length, corners.length)
        // pose = posit.pose(corners)
        // const br = pose.bestRotation
        // const bt = pose.bestTranslation
        // const markermatrix = new Matrix4().set(br[0][0], br[0][1], br[0][2], bt[0],
        // br[1][0], br[1][1], br[1][2], bt[1],
        // br[2][0], br[2][1], br[2][2], bt[2],
        // 0, 0, 0, 1)

        // First argument is marker size
        // const s = Math.min(pose.bestTranslation[2] / canvas.width, 1.2)
        // const matrix = new Matrix4().set(br[0][0], br[0][1], br[0][2], 0,
        //                                  br[1][0], br[1][1], br[1][2], 0,
        //                                  br[2][0], br[2][1], br[2][2], 0,
        //                                  0, 0, 0, 1)
        // matrix.scale(new Vector3(s, s, s))
        // // matrix.invert()
        // transformation = `matrix3d(${matrix.elements.join(', ')})`
        if (hands[desiredHand]) {
          handPts = hands[desiredHand]
          camera2AR = markermatrix
          thePose = pose
        }
        const R01 = markermatrix.elements[4]
        const R00 = markermatrix.elements[0]
        const rotation = (Math.atan2(-R01, R00) * 180) / Math.PI
        transformation = `rotate(${rotation}deg)`

        context.fillStyle = 'purple'
        let first = true
        for (const pt of [
          new Vector3(-1, -1, 0),
          new Vector3(1, -1, 0),
          new Vector3(1, 1, 0),
          new Vector3(-1, 1, 0),
        ]) {
          // console.log(controller.getCameraMatrix())
          // const s = pt.multiplyScalar(0.5)
          // const v = new Vector4(s.x, s.y, s.z, 1).applyMatrix4(markers[0].matrix).applyMatrix4(cameraMatrix)
          // console.log(cameraMatrix)
          // v.x /= v.w
          // v.y /= v.w
          // console.log(v.x, v.y)
          const v = pt.multiplyScalar((25 * $mmToPx) / 2).applyMatrix4(markermatrix)
          // v.x *= canvas.width / v.z
          // v.y *= canvas.width / v.z
          v.x = (v.x * canvas.width) / v.z + canvas.width / 2
          v.y = (v.y * canvas.height) / v.z + canvas.height / 2
          // if (first) context.moveTo(v.x + canvas.width/2, -v.y + canvas.height/2)
          // else context.lineTo(v.x + canvas.width/2, -v.y + canvas.height/2)
          if (first) context.moveTo(v.x, v.y)
          else context.lineTo(v.x, v.y)
          // if (first) context.moveTo(-v.x*canvas.width/2 + canvas.width/2, -v.y*canvas.height/2 + canvas.height/2)
          // else context.lineTo(-v.x*canvas.width/2 + canvas.width/2, -v.y*canvas.height/2 + canvas.height/2)
          first = false
        }

        // for (const pt of objPoints) {
        //     const v = new Vector3().fromArray(pt).applyMatrix4(markermatrix)
        //     v.x = v.x * canvas.width / v.z + canvas.width/2
        //     v.y = v.y * canvas.height / v.z + canvas.height/2
        //     context.strokeStyle = "yellow";
        //     context.strokeRect(v.x - 2, v.y - 2, 4, 4);
        // }

        for (const v of projected) {
          context.strokeStyle = 'yellow'
          context.strokeRect(v.x - 2, v.y - 2, 4, 4)
        }

        context.closePath()
        context.fill()

        // context.strokeStyle = "blue";
        // const scale = pose.bestTranslation[2]/(25*$mmToPx)
        // context.strokeRect(canvas.width/2 - bt[0]/scale, canvas.height/2 - bt[1]/scale, 4, 4);

        if (hands.Left) drawKeypoints(context, hands.Left.keypoints, 'Left')
        if (hands.Right) drawKeypoints(context, hands.Right.keypoints, 'Right')
      } else {
        message = 'Position the marker in the camera view'
      }
      const hand = hands[desiredHand]
      if (!hand && (hands.Left || hands.Right)) {
        message = 'Wrong hand!'
      } else if (hand && markers.length >= minMarkers && hand.score > 1) {
        // const screenPX = 25 * $mmToPx
        // const cameraPX = screenPX * canvas.width / pose.bestTranslation[2]
        // const handMM = handPX / cameraPX * screenPX / $mmToPx

        // Convert marker-size in the translation to mm
        const scale = pose.bestTranslation[2] / 25
        // camera2Hand.makeScale(pose.bestTranslation[2]/(25*$mmToPx), pose.bestTranslation[2]/(25*$mmToPx), pose.bestTranslation[2]/(25*$mmToPx))
        theHand = makeHand(hand, true, scale)
        // camera2Hand.multiply(theHand.basis)
        const quality = Math.asin(pose.bestRotation[2][2]) / (Math.PI / 2)
        // console.log(quality)
        if (quality > 0.1) {
          stat = calcStat(theHand, stat)
          // count++
        } else {
          message = 'Position the camera parallel to the screen'
        }
        if (stat.history.length > 3) theJoints = calculateJoints(stat.history, stat.means)
      } else if (markers.length >= minMarkers) {
        message = 'Hand not clear enough'
      }
    }
    rid = requestAnimationFrame(tick)
  }

  const fingerLookupIndices: Record<string, number[]> = {
    thumb: [0, 1, 2, 3, 4],
    indexFinger: [0, 5, 6, 7, 8],
    middleFinger: [0, 9, 10, 11, 12],
    ringFinger: [0, 13, 14, 15, 16],
    pinky: [0, 17, 18, 19, 20],
  } // for rendering each finger as a polyline

  /**
   * Draw the keypoints on the video.
   * @param keypoints A list of keypoints.
   * @param handedness Label of hand (either Left or Right).
   */
  function drawKeypoints(
    ctx: CanvasRenderingContext2D,
    keypoints: NormalizedLandmarkList,
    handedness: string
  ) {
    const keypointsArray = keypoints
    ctx.fillStyle = handedness === 'Left' ? 'Red' : 'Blue'
    ctx.strokeStyle = 'White'
    ctx.lineWidth = 10

    for (let i = 0; i < keypointsArray.length; i++) {
      const x = (1 - keypointsArray[i].x) * canvas.width
      const y = keypointsArray[i].y * canvas.height
      drawPoint(ctx, x - 2, y - 2, 10)
    }

    const fingers = Object.keys(fingerLookupIndices)
    for (let i = 0; i < fingers.length; i++) {
      const finger = fingers[i]
      const points = fingerLookupIndices[finger].map((idx) => keypoints[idx])
      drawPath(ctx, points, false)
    }
  }

  function drawPath(ctx: CanvasRenderingContext2D, points: NormalizedLandmarkList, closePath: boolean) {
    const region = new Path2D()
    region.moveTo((1 - points[0].x) * canvas.width, points[0].y * canvas.height)
    for (let i = 1; i < points.length; i++) {
      const point = points[i]
      region.lineTo((1 - point.x) * canvas.width, point.y * canvas.height)
    }

    if (closePath) {
      region.closePath()
    }
    ctx.stroke(region)
  }

  function drawPoint(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, 2 * Math.PI)
    ctx.fill()
  }
</script>

<Step>
  <span slot="title" class="relative z-5">Measure Your {desiredHand} Hand</span>
  <div slot="content" class="p-2 z-5">
    <!-- <div class="max-w-prose">
         <p class="mb-2">You'll use your phone to take pictures of your hand.</p>
         <p>This is because you'll still be needing your computer screen to orient the phone picture.</p>
         </div> -->
    <div class="relative z-5">
      {stat.history.length} / 100, {size[0]} x {size[1]}
    </div>
    <div class="text-red relative z-5">
      {#if message}
        {message}
      {:else}
        &nbsp;
      {/if}
    </div>
    <div class="absolute overflow-hidden left-0 top-0 w-[400px] aspect-square z-5">
      {#if theHand && theJoints}
        <!-- <Stage ik width={400} hand={theHand} color="#A855F7" joints={theJoints} /> -->
      {/if}
    </div>
    <div class="relative z-2">
      <canvas bind:this={canvas} style="height: 320px; transform: {transformation}" class="m-2" />
    </div>

    <BigHand
      {handPts}
      {size}
      hand={theHand}
      joints={theJoints}
      {camera2AR}
      {camera2Hand}
      arTag={arTag1}
      corners={theCorners}
      pose={thePose}
    />

    <div class="flex justify-between">
      <div class="relative z-10 bg-white p-4">
        <img
          class="artag"
          bind:this={arTag1}
          width={25 * $mmToPx}
          height={25 * $mmToPx}
          src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMAQAAAAB+DmFKAAAAF0lEQVQI12NggAH2BhCSYAAhxgYQggEAKAwCQQ3fXqMAAAAASUVORK5CYII="
        />
      </div>
      <div class="relative z-10 bg-white p-4">
        <img
          class="artag"
          bind:this={arTag2}
          width={25 * $mmToPx}
          height={25 * $mmToPx}
          src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMAQAAAAB+DmFKAAAAFUlEQVQI12NggAE2MGJvACFGMIIBAB9mAh1MaKuaAAAAAElFTkSuQmCC"
        />
      </div>
    </div>

    <div class="flex justify-between absolute top-0 left-0 right-0">
      <div class="relative z-10 bg-white p-4">
        <img
          class="artag"
          bind:this={arTag3}
          width={25 * $mmToPx}
          height={25 * $mmToPx}
          src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMAQAAAAB+DmFKAAAAFElEQVQI12NggAE2MIIA9gYQggEADXkBGw+qF1kAAAAASUVORK5CYII="
        />
      </div>
      <div class="relative z-10 bg-white p-4">
        <img
          class="artag"
          bind:this={arTag4}
          width={25 * $mmToPx}
          height={25 * $mmToPx}
          src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMAQAAAAB+DmFKAAAAF0lEQVQI12NggAHGBhBiYwAh9gYQggEAJOICHQN/GLgAAAAASUVORK5CYII="
        />
      </div>
    </div>
  </div>
</Step>

<style>
  .artag {
    image-rendering: crisp-edges;
    image-rendering: pixelated;
  }
</style>
