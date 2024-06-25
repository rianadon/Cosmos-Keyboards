<script lang="ts">
  import { FINGERS, type Hand, type Joints } from './hand'
  import { Canvas, T } from '@threlte/core'
  import { DEG2RAD } from 'three/src/math/MathUtils'
  import { HTML, MeshLineGeometry, MeshLineMaterial } from '@threlte/extras'
  import { Vector3, type Vector3Tuple, Matrix4 } from 'three'
  import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial'

  export let hand: Hand | undefined = undefined
  export let otherHand: Hand | undefined = undefined
  export let joints: Joints | undefined
  export let otherJoints: Joints | undefined = undefined
  export let color: string
  export let width: number
  export let flipHand = false
  // export let ik = false

  let lines2D: Vector3Tuple[][] = []
  let points2D: Vector3Tuple[] = []
  let info: { position: Vector3; text: string }[] = []
  let maxSize = 1

  function to2D(x: number, v: Vector3) {
    return [x, v.x, v.z] as Vector3Tuple
  }

  const angles: Record<string, number[]> = {
    thumb: [156, 130, 115, 109],
    indexFinger: [105, 96, 95, 93],
    middleFinger: [90, 90, 91, 89],
    ringFinger: [75, 87, 90, 91],
    pinky: [60, 68, 71, 72],
  }

  function jointDirection(hand: Hand | undefined, limb: string, i: number, flip = false) {
    if (hand) {
      const b = hand.limbs[limb][i]
      return new Vector3(b.x, 0, flip ? -b.z : b.z).normalize()
    } else {
      const angle = (angles[limb][i] * Math.PI) / 180
      return new Vector3(Math.sin(angle), 0, flip ? -Math.cos(angle) : Math.cos(angle))
    }
  }

  $: if (joints) {
    // const solved = new SolvedHand(joints, new Matrix4().makeTranslation(-10, 0, 0))
    // if (ik) solved.fromAllLimbs(hand.limbs, false)
    // const positions = solved.worldAllPositions(0.5);

    const positions: Record<string, Vector3[]> = {}
    FINGERS.forEach((name) => {
      let pos = new Vector3()
      const posi = [pos]
      angles[name].forEach((_a, i) => {
        pos = pos.clone()
        const direction = jointDirection(hand, name, i, flipHand)
        pos.addScaledVector(direction, 0.1 * joints![name][i].length)
        posi.push(pos)

        // Figure out how big this is going to be
        const size = Math.max(Math.abs(pos.z) * 2, pos.x)
        if (size > maxSize) {
          maxSize = size
        }
      })
      positions[name] = posi
    })
    if (otherJoints) {
      FINGERS.forEach((name) => {
        let pos = new Vector3()
        angles[name].forEach((_a, i) => {
          const direction = jointDirection(otherHand, name, i, false)
          pos.addScaledVector(direction, 0.1 * otherJoints![name][i].length)
          const size = Math.max(Math.abs(pos.z) * 2, pos.x)
          if (size > maxSize) {
            maxSize = size
          }
        })
      })
    }

    console.log('max', maxSize)

    const offset = new Vector3(-maxSize / 2, 0, 0)

    lines2D = Object.values(positions).map((p) => p.map((v) => to2D(0, v.add(offset))))
    console.log('lines', lines2D)
    points2D = lines2D.flat()

    info = FINGERS.flatMap((limb) => {
      return angles[limb].map((_, i) => {
        const avg = new Vector3()
          .addScaledVector(positions[limb][i], 0.3)
          .addScaledVector(positions[limb][i + 1], 0.7)
        return {
          position: new Vector3(...to2D(1, avg)),
          text: (joints![limb][i].length * 0.1).toFixed(2) + 'cm',
        }
      })
    })
  }
</script>

<Canvas shadows={false} size={{ width, height: width }}>
  <T.OrthographicCamera
    makeDefault
    position={[100, 0, 0]}
    zoom={width / (maxSize + 2)}
    let:ref={cam}
    on:create={({ ref }) => {
      ref.lookAt(new Vector3(0, 0, 0))
    }}
  />

  <T.Group>
    {#each lines2D as line}
      <T.Mesh>
        <MeshLineGeometry points={line} />
        <MeshLineMaterial color="#1e293b" worldUnits={true} linewidth={0.5} />
      </T.Mesh>
    {/each}
    {#each points2D as pt}
      <T.Mesh position={pt}>
        <T.SphereGeometry args={[0.5]} />
        <T.MeshBasicMaterial {color} />
      </T.Mesh>
    {/each}
    {#each info as inf}
      <HTML position={inf.position} rotation={{ y: DEG2RAD * 90 }} transform>
        <div style="height: 1em; font-size: 1.8em; text-align: center; text-shadow: 1px 0 1px black">
          {inf.text}
        </div>
      </HTML>
    {/each}
  </T.Group>
</Canvas>
