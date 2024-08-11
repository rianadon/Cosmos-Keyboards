<script lang="ts">
  import { useFrame, T } from '@threlte/core'
  import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial'
  import { FINGERS, SolvedHand } from './hand'
  import HandModel from './HandModel.svelte'
  import { MeshStandardMaterial, Vector3, type BufferGeometry, type Vector3Tuple } from 'three'
  import { MeshLineGeometry, MeshLineMaterial } from '@threlte/extras'

  const COLORS: Record<string, number> = {
    thumb: 0xff0000,
    indexFinger: 0xffa500,
    middleFinger: 0x00ff00,
    ringFinger: 0x0000ff,
    pinky: 0x8b00ff,
  }

  export let pointCloud: Record<string, BufferGeometry | undefined>
  export let degPts: Record<string, Vector3Tuple[]>
  export let solved: SolvedHand
  export let reverse: boolean
  export let width: number
  let rotation = 0

  useFrame(() => {
    rotation = (performance.now() / 2000) * (reverse ? -1 : 1)
  })
</script>

<T.Group rotation.y={rotation}>
  <T.OrthographicCamera
    makeDefault
    position={[60, 0, 0]}
    zoom={width / 25}
    let:ref={cam}
    on:create={({ ref }) => {
      ref.lookAt(new Vector3(0, 0, 0))
    }}
  />
</T.Group>

<T.DirectionalLight position={[3, 10, 10]} />
<T.DirectionalLight position={[-3, 10, -10]} intensity={0.2} />
<T.AmbientLight intensity={0.4} />

{#if solved}
  <T.Group rotation={[0, 0, Math.PI / 2]} position={[0, -10, 0]}>
    <HandModel hand={solved} {reverse} />
  </T.Group>
{/if}
<T.Group>
  {#each FINGERS as limb}
    <T.Group>
      {#if pointCloud[limb]}
        <T.Mesh>
          <T is={pointCloud[limb]} />
          <T
            is={new MeshStandardMaterial({
              color: COLORS[limb],
              transparent: true,
              opacity: 0.5,
            })}
          />
        </T.Mesh>
      {/if}
      <T.Mesh>
        <MeshLineGeometry points={degPts[limb].map((p) => new Vector3(...p))} />
        <MeshLineMaterial attenuate={false} color={COLORS[limb]} width={20} toneMapped={false} />
      </T.Mesh>
    </T.Group>
  {/each}
</T.Group>
