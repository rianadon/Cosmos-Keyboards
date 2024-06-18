<script lang="ts">
  import { SolvedHand, type Hand, type Joints } from './hand'
  import { Canvas, T } from '@threlte/core'
  import { DEG2RAD } from 'three/src/math/MathUtils'
  import { Vector3, Matrix4 } from 'three'
  import { HTML, MeshLineGeometry, MeshLineMaterial } from '@threlte/extras'

  export let hand: Hand | undefined
  export let joints: Joints | undefined
  export let color: string
  export let width: number

  let lines2D: Vector3[][] = []
  let points2D: Vector3[] = []
  let info: { position: Vector3; text: string }[] = []

  function to2D(x: number, v: Vector3) {
    return new Vector3(x, v.x, v.z)
  }

  $: if (hand && joints) {
    const solved = new SolvedHand(joints, new Matrix4().makeTranslation(-10, 0, 0))
    const positions = solved.worldAllPositions()

    lines2D = Object.values(positions).map((p) => p.map((v) => to2D(0, v)))
    points2D = lines2D.flat()

    info = Object.entries(hand.limbs).flatMap(([limb, vectors]) => {
      return vectors.map((_, i) => {
        const avg = new Vector3()
          .addScaledVector(positions[limb][i], 0.3)
          .addScaledVector(positions[limb][i + 1], 0.7)
        return {
          position: new Vector3(...to2D(1, avg)),
          text: (joints![limb][i].length * 100).toFixed(2) + 'cm',
        }
      })
    })
  }
</script>

<Canvas shadows={false}>
  <T.OrthographicCamera
    makeDefault
    position={[60, 0, 0]}
    zoom={width / 25}
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
      <T.Mesh position={pt.toArray()}>
        <T.SphereGeometry args={[0.5]} />
        <T.MeshBasicMaterial {color} />
      </T.Mesh>
    {/each}
    {#each info as inf}
      <HTML position={inf.position.toArray()} rotation.y={DEG2RAD * 90} transform>
        <div style="height: 1em; font-size: 2em; text-align: center">{inf.text}</div>
      </HTML>
    {/each}
  </T.Group>
</Canvas>
