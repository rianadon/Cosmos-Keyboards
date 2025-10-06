<script lang="ts">
  // @ts-nocheck Unused file.

  import { SolvedHand, type Hand, type Joints, CONNECTIONS, type PoseHand, makeHand } from './hand'
  import { Vector3, type Vector3Tuple, Matrix4 } from 'three'
  import { cameraToMarkerPoint } from './reconstruction'
  import BigHandCanvas from './BigHandCanvasNew.svelte'

  export let hand: Hand | undefined
  export let handPts: PoseHand | undefined
  export let joints: Joints | undefined
  export let arTag: HTMLElement
  export let camera2AR: Matrix4
  export let size: [number, number]
  // export let corners: any
  let AR2Screen = new Matrix4()

  let lines2D: Vector3Tuple[][] = []
  let points2D: Vector3Tuple[] = []
  export let positions: Record<string, Vector3[]> = {}
  let info: { position: Vector3; text: string }[] = []

  let canvas: HTMLCanvasElement
  let scale = 0
  let solved: SolvedHand

  let handy: Hand
  let handySolved: SolvedHand

  export let tslu: number

  function to2D(x: number, v: Vector3) {
    return [v.x, v.y, 0] as Vector3Tuple
  }

  $: if (hand && joints && handPts && camera2AR) process()

  function process() {
    const AR2Screen2 = AR2Screen.clone().invert()
    solved = new SolvedHand(joints, new Matrix4().makeTranslation(-10, 0, 0))
    solved.fromAllLimbs(hand.limbs, false)
    positions = {}
    for (const [name, conns] of Object.entries(CONNECTIONS)) {
      positions[name] = []
      const already = new Set()
      for (const conn of conns.flat()) {
        if (already.has(conn)) continue
        already.add(conn)
        const kp = handPts.keypoints[conn]

        const pt = cameraToMarkerPoint(camera2AR, size, (1 - kp.x) * size[0], kp.y * size[1])
        const vec = new Vector3(pt.x * scale, -pt.y * scale, 0).applyMatrix4(AR2Screen2)
        console.log('vec', vec, pt)
        positions[name].push(vec)
      }
    }

    lines2D = Object.values(positions).map((p) => p.map((v) => to2D(0, v)))
    points2D = lines2D.flat()

    const keypoints = handPts.keypoints.map((kp) => {
      const pt = cameraToMarkerPoint(camera2AR, size, (1 - kp.x) * size[0], kp.y * size[1])
      return new Vector3(pt.x * scale, -pt.y * scale, 0).applyMatrix4(AR2Screen2)
    })
    handy = makeHand(
      {
        keypoints,
        keypoints3D: null as any,
        score: 0,
        handedness: hand!.handedness as any,
      },
      true
    )
    const newJoints = Object.fromEntries(
      Object.entries(joints).map(([name, e]) => {
        return [
          name,
          e.map((k, i) => ({
            ...k,
            length: handy.limbs[name][i].length(),
          })),
        ]
      })
    )
    console.log('themnew', newJoints)
    handySolved = new SolvedHand(newJoints, new Matrix4().makeTranslation(-10, 0, 0))
    handySolved.fromAllLimbs(handy.limbs, false)
    // if (canvas) draw()
  }

  $: console.log('tag', arTag)
  $: if (arTag && canvas) resize()

  let canvasWidth = 0
  let canvasHeight = 0
  function resize() {
    console.log('RESIZING')
    const br = canvas.getBoundingClientRect()
    canvasWidth = br.width
    canvasHeight = br.height

    const arbr = arTag.getBoundingClientRect()
    // The AR tag is 5 AR tags high
    scale = arbr.height / 5
    AR2Screen.setPosition(br.x - arbr.x, br.y - arbr.y - arbr.height, 0)
  }
</script>

<svelte:window on:resize={resize} />

<BigHandCanvas
  bind:canvas
  {lines2D}
  {positions}
  solved={handySolved}
  {handy}
  width={canvasWidth}
  height={canvasHeight}
  {AR2Screen}
  {tslu}
/>
