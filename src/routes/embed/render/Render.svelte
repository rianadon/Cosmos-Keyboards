<script lang="ts">
  import { OrbitControls, Gizmo } from '@threlte/extras'
  import { T, useThrelte } from '@threlte/core'
  import KeyboardModel from '$lib/3d/KeyboardModel.svelte'
  import type { Center } from '$lib/worker/config'
  import type {
    FullGeometry,
    FullKeyboardMeshes,
    KeyboardMeshes,
  } from '../../beta/lib/viewers/viewer3dHelpers'
  import Keyboard from '$lib/3d/Keyboard.svelte'
  import { CASE_COLOR, KEY_COLOR, PLATE_COLOR, TRACKBALL_COLOR, SWITCH_COLOR } from './defaults'
  import { SoftShadows } from '@threlte/extras'

  export let models: [keyof FullKeyboardMeshes, KeyboardMeshes][]
  export let cameraPosition: any
  export let center: Center
  export let geometry: FullGeometry
  export let floorZ: number

  let caseColor: [any, number] = [CASE_COLOR, 1]
  let plateColor: [any, number] = [PLATE_COLOR, 1]
  let keyColor: [any, number] = [KEY_COLOR, 1]
  let trackballColor: [any, number] = [TRACKBALL_COLOR, 1]
  let switchColor: [any, number] = [SWITCH_COLOR, 1]

  window.addEventListener('message', (ev) => {
    if (
      !ev.origin.startsWith('http://localhost:') &&
      !ev.origin.endsWith('.myshopify.com') &&
      ev.origin != 'https://skree.us'
    )
      return
    if (typeof ev.data?.keyColor !== 'undefined' && ev.data.keyColor.length) keyColor = ev.data.keyColor
    if (typeof ev.data?.caseColor !== 'undefined' && ev.data.caseColor.length)
      caseColor = ev.data.caseColor
    if (typeof ev.data?.plateColor !== 'undefined' && ev.data.plateColor.length)
      plateColor = ev.data.plateColor
    if (typeof ev.data?.trackballColor !== 'undefined' && ev.data.trackballColor.length)
      trackballColor = ev.data.trackballColor
    if (typeof ev.data?.switchColor !== 'undefined' && ev.data.switchColor.length)
      switchColor = ev.data.switchColor
  })
</script>

<T.PerspectiveCamera
  makeDefault
  fov={45}
  position={cameraPosition}
  up={[0, 0, 1]}
  on:create={({ ref }) => {
    ref.lookAt(0, 0, 0)
  }}
>
  <OrbitControls
    enableDamping
    dampingFactor={0.1}
    minPolarAngle={0}
    maxPolarAngle={Math.PI / 2}
    minAzimuthAngle={-Math.PI / 2}
    maxAzimuthAngle={Math.PI / 2}
  />
</T.PerspectiveCamera>

{#each models as [kbd, meshes] (kbd)}
  {@const cent = center[kbd]}
  {#if cent}
    <T.Group position={[-cent[0], -cent[1], -cent[2]]} scale.x={kbd == 'left' ? -1 : 1}>
      <KeyboardModel side={kbd} {meshes} {caseColor} {plateColor} />
      <Keyboard
        geometry={geometry[kbd] || null}
        flip={kbd == 'left'}
        side={kbd}
        {keyColor}
        {switchColor}
        trackballColor={trackballColor[0]}
      />
    </T.Group>
  {/if}
{/each}

<T.DirectionalLight position={[0, 0, 10]} intensity={0.8} />
<T.DirectionalLight
  position={[-1, 5, 5]}
  intensity={0.8}
  shadow.camera.left={-400}
  shadow.camera.right={400}
  shadow.camera.top={400}
  shadow.camera.bottom={-400}
/>
<T.AmbientLight args={[0xffffff]} intensity={2} />

<!-- <T.Mesh
     receiveShadow
     position.z={floorZ}
     >
     <T.CircleGeometry args={[400, 40]} />
     <T.MeshStandardMaterial color={"white"} />
     </T.Mesh> -->

<!-- <SoftShadows
     focus={0}
     samples={10}
     size={25}
     /> -->
