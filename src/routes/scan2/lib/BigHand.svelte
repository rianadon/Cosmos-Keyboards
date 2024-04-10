<script lang="ts">
  import { CONNECTIONS, type PoseHand } from './hand'
  import { Vector3, type Vector3Tuple, Matrix4 } from 'three'
  import { cameraToMarkerPoint } from './reconstruction'
  import { onMount } from 'svelte'
  import type ChessboardDetector from './chessboardDetector'

  export let handPts: PoseHand | undefined
  export let arTag: HTMLElement
  export let camera2AR: Matrix4
  export let size: [number, number]
  let AR2Screen = new Matrix4()

  let lines2D: Vector3Tuple[][] = []
  let points2D: Vector3Tuple[] = []

  let scale = 0
  let canvas: HTMLCanvasElement

  export let tslu: number
  export let detector: ChessboardDetector

  function to2D(x: number, v: Vector3) {
    return [v.x, v.y, 0] as Vector3Tuple
  }

  $: if (handPts && camera2AR) process()

  function process() {
    if (scale == 0) resize()
    const AR2Screen2 = AR2Screen.clone().invert()
    const positions: Record<string, Vector3[]> = {}
    for (const [name, conns] of Object.entries(CONNECTIONS)) {
      positions[name] = []
      const already = new Set()
      for (const conn of conns.flat()) {
        if (already.has(conn)) continue
        already.add(conn)
        const kp = handPts!.keypoints[conn]

        const pt = cameraToMarkerPoint(camera2AR, size, (1 - kp.x) * size[0], kp.y * size[1])
        const vec = new Vector3(pt.x * scale, -pt.y * scale, 0).applyMatrix4(AR2Screen2)
        positions[name].push(vec)
      }
    }

    lines2D = Object.values(positions).map((p) => p.map((v) => to2D(0, v)))
    points2D = lines2D.flat()
    if (canvas) draw()
  }

  onMount(() => resize())

  function resize() {
    const br = canvas.getBoundingClientRect()
    canvas.width = br.width
    canvas.height = br.height

    if (!arTag) return
    const arbr = arTag.getBoundingClientRect()
    // The AR tag is 5 AR tags high
    scale = Math.min(arbr.height / detector.boardHeight, arbr.width / detector.boardWidth)
    AR2Screen.setPosition(br.x - arbr.x, br.y - arbr.y - arbr.height, 0)
  }

  function draw() {
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.strokeStyle = 'white'
    ctx.lineWidth = 100
    ctx.fillStyle = 'blue'
    ctx.lineCap = 'round'
    for (const line of lines2D) {
      ctx.beginPath()
      ctx.moveTo(line[0][0], line[0][1])
      for (let i = 1; i < line.length; i++) {
        ctx.lineTo(line[i][0], line[i][1])
      }
      ctx.stroke()
    }
  }

  $: opacity = Math.min(Math.max(0, 1 - (tslu - 500) / 2000), 1)
</script>

<svelte:window on:resize={resize} />

<canvas
  class="fixed bottom-0 left-0 right-0 w-full h-full top-0"
  bind:this={canvas}
  style="opacity: {opacity * 100}%"
/>
