<script lang="ts">
  import { FINGERS, SolvedHand, type Hand, type Joints } from './hand'
  import { Canvas } from '@threlte/core'
  import { Vector3, type Vector3Tuple, Matrix4, SphereGeometry, BufferGeometry, Vector4 } from 'three'
  import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils'
  import PoseCanvas from './PoseCanvas.svelte'
  import { recording } from './state'

  export let hand: Hand | undefined
  export let joints: Joints | undefined
  export let reverse = false
  export let width: number

  let pointCloud: Record<string, BufferGeometry | undefined> = Object.fromEntries(
    FINGERS.map((l) => [l, undefined])
  )
  let degPts: Record<string, Vector3Tuple[]> = Object.fromEntries(FINGERS.map((l) => [l, []]))

  let averageRotations = Object.fromEntries(FINGERS.map((l) => [l, new Vector4()]))

  let solved: SolvedHand

  // Clear the point cloud when recording starts
  recording.subscribe((r) => {
    if (r) pointCloud = Object.fromEntries(FINGERS.map((l) => [l, undefined]))
  })

  function decompose(v: Vector3) {
    return [-v.y, v.x, v.z] as Vector3Tuple
  }

  function pointCloudGeo(p: Vector3) {
    return new SphereGeometry(0.2, 6, 3).translate(-p.y, p.x, p.z)
  }

  $: if (hand && joints) {
    const solvedJ = new SolvedHand(joints, new Matrix4().makeTranslation(-10, 0, 0))
    if (hand.score > 0.9) {
      for (const finger of FINGERS) {
        solvedJ.fromLimbs(finger, hand.limbs[finger], false)

        const geometry = pointCloudGeo(solvedJ.worldPositions(finger, 0.1)[4])
        const prevCloud = pointCloud[finger]
        pointCloud[finger] = prevCloud ? mergeGeometries([prevCloud, geometry]) : geometry

        solvedJ.fromLimbs(finger, hand.limbs[finger], true)
        averageRotations[finger].add(new Vector4(...solvedJ.deg1Angles(finger)))
      }
      pointCloud = { ...pointCloud }
    }

    degPts = Object.fromEntries(
      FINGERS.map((finger) => {
        const ar = averageRotations[finger]
        const sum = ar.x + ar.y + ar.z + ar.w
        const extent = finger == 'thumb' ? Math.PI / 3 : Math.PI / 1.5
        const scale = new Vector4().addScaledVector(ar, extent / sum).toArray()
        const positions: Vector3Tuple[] = []
        for (let i = 0; i < 100; i++) {
          solvedJ.fkBy(finger, (j) => [(-scale[j] * i) / 100, 0])
          positions.push(decompose(solvedJ.worldPositions(finger, 0.1)[4]))
        }
        return [finger, positions]
      })
    )

    solved = new SolvedHand(joints, new Matrix4().makeTranslation(-10, 0, 0))
    solved.fromAllLimbs(hand.limbs, true)
  }
</script>

<Canvas size={{ width, height: width }}>
  <PoseCanvas {width} {pointCloud} {solved} {reverse} {degPts} />
</Canvas>
