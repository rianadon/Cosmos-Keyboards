import type { NormalizedLandmarkList } from '@mediapipe/hands'

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
export function drawKeypoints(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  keypoints: NormalizedLandmarkList,
  handedness: string,
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
    drawPath(canvas, ctx, points, false)
  }
}

function drawPath(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  points: NormalizedLandmarkList,
  closePath: boolean,
) {
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
