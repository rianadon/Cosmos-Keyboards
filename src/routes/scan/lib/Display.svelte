<script lang="ts">
  import type { NormalizedLandmarkList } from '@mediapipe/hands'
  import type { Hands } from './hand'

  export let hands: Hands
  export let video: HTMLVideoElement

  export let width: number
  export let height: number

  let canvas: HTMLCanvasElement

  $: update(hands)

  const fingerLookupIndices: Record<string, number[]> = {
    thumb: [0, 1, 2, 3, 4],
    indexFinger: [0, 5, 6, 7, 8],
    middleFinger: [0, 9, 10, 11, 12],
    ringFinger: [0, 13, 14, 15, 16],
    pinky: [0, 17, 18, 19, 20],
  } // for rendering each finger as a polyline

  function update(hands: Hands) {
    if (!canvas) return

    const ctx = canvas.getContext('2d')!
    ctx.save()
    ctx.translate(width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, width, height)
    ctx.restore()
    if (hands.Left) drawKeypoints(ctx, hands.Left.hand.keypoints, 'Left')
    if (hands.Right) drawKeypoints(ctx, hands.Right.hand.keypoints, 'Right')
  }

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
    ctx.lineWidth = 2

    for (let i = 0; i < keypointsArray.length; i++) {
      const y = keypointsArray[i].x * width
      const x = keypointsArray[i].y * height
      drawPoint(ctx, x - 2, y - 2, 3)
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
    region.moveTo(points[0].x * width, points[0].y * height)
    for (let i = 1; i < points.length; i++) {
      const point = points[i]
      region.lineTo(point.x * width, point.y * height)
    }

    if (closePath) {
      region.closePath()
    }
    ctx.stroke(region)
  }

  function drawPoint(ctx: CanvasRenderingContext2D, y: number, x: number, r: number) {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, 2 * Math.PI)
    ctx.fill()
  }
</script>

<canvas {width} {height} bind:this={canvas} />

<style>
  canvas {
    width: 100%;
    height: 100%;
  }
</style>
