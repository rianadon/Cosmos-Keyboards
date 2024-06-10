<script lang="ts">
  import * as THREE from 'three'
  import { T, Canvas } from '@threlte/core'
  import WebGL from 'three/examples/jsm/capabilities/WebGL'
  import { OrbitControls } from '@threlte/extras'
  import { onMount } from 'svelte'
  import Interactivity from './Interactivity.svelte'

  interface Geo {
    geometry: THREE.ShapeGeometry
    material: THREE.Material
  }
  export let geometries: Geo[]
  export let style: string = ''
  export let center: [number, number, number]
  export let size: THREE.Vector3
  export let cameraPosition: [number, number, number] = [0, 0.8, 1]
  export let enableRotate = true
  export let enableZoom = false
  export let enablePan = false
  export let is3D = false
  export let flip = false
  let canvas: HTMLElement

  const cameraFOV = 45

  onMount(() => {
    console.log('MOUNT VIEWER')
  })

  let camera: THREE.PerspectiveCamera
  function updateCameraPos() {
    cameraPosition = camera.position.clone().toArray()
    // console.log('new camera pos', camera.position.clone().normalize().toArray())
    // console.log(camera)
  }

  // function resize() {
  //   // https://wejn.org/2020/12/cracking-the-threejs-object-fitting-nut/
  //   let aspect = canvas ? canvas.clientWidth / canvas.clientHeight : 1
  //   if (aspect == 0 || aspect == Infinity) aspect = 1
  //   const fov = cameraFOV * (Math.PI / 180)
  //   const fovh = 2 * Math.atan(Math.tan(fov / 2) * aspect)
  //   let dx = size.z / 2 + Math.abs(size.x / 2 / Math.tan(fovh / 2))
  //   let dy = size.z / 2 + Math.abs(size.y / 2 / Math.tan(fov / 2))
  //   if ($camera) {
  //     $camera.position.normalize()
  //     $camera.position.multiplyScalar(Math.max(dx, dy) * 1.2)
  //     $camera.updateProjectionMatrix()
  //     root.invalidate()
  //   }
  // }
  console.log('position', cameraPosition)
</script>

<!-- <svelte:window on:resize={resize} /> -->

{#if WebGL.isWebGLAvailable()}
  <div class="container" bind:this={canvas} {style}>
    <Canvas toneMapping={0}>
      <Interactivity>
        <T.Group position={[-center[0], -center[1], -center[2]]}>
          {#each geometries as geometry}
            <T.Mesh geometry={geometry.geometry} material={geometry.material} />
          {/each}
        </T.Group>
        <slot />

        <T.PerspectiveCamera
          makeDefault
          fov={cameraFOV}
          position={cameraPosition}
          bind:ref={camera}
          up={[0, 0, 1]}
        >
          <OrbitControls
            enableDamping
            {enableZoom}
            {enableRotate}
            {enablePan}
            dampingFactor={0.1}
            on:change={updateCameraPos}
          />
        </T.PerspectiveCamera>
      </Interactivity>
    </Canvas>
  </div>
{:else}
  <div class="border-2 border-red-400 py-2 px-4 m-2 rounded bg-white dark:bg-gray-900">
    <p>The preview could not be loaded. This is because:</p>
    <p>{@html WebGL.getWebGLErrorMessage().innerHTML.replace('<a', '<a class="underline"')}.</p>
  </div>
{/if}

<style>
  .container {
    position: absolute;
    width: 100%;
    height: 100%;
    left: 0;
    top: 0;
  }
</style>
