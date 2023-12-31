<script lang="ts">
  import type * as THREE from 'three'
  import * as SC from 'svelte-cubed'
  import PerspectiveCamera from '$lib/3d/PerspectiveCamera.svelte'
  import Canvas from '$lib/3d/Canvas.svelte'
  import WebGL from 'three/examples/jsm/capabilities/WebGL'
  import { setContext } from 'svelte'
  import { writable } from 'svelte/store'

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
  const camera = writable<THREE.PerspectiveCamera>()
  let root: any

  setContext('camera', camera)
  camera.subscribe(($camera) => {
    if (!$camera) return
    // Give the camera an initial position
    $camera.position.set(...cameraPosition)
    resize()
  })

  const cameraFOV = 45

  function resize() {
    // https://wejn.org/2020/12/cracking-the-threejs-object-fitting-nut/
    let aspect = canvas ? canvas.clientWidth / canvas.clientHeight : 1
    if (aspect == 0 || aspect == Infinity) aspect = 1
    const fov = cameraFOV * (Math.PI / 180)
    const fovh = 2 * Math.atan(Math.tan(fov / 2) * aspect)
    let dx = size.z / 2 + Math.abs(size.x / 2 / Math.tan(fovh / 2))
    let dy = size.z / 2 + Math.abs(size.y / 2 / Math.tan(fov / 2))
    if ($camera) {
      $camera.position.normalize()
      $camera.position.multiplyScalar(Math.max(dx, dy) * 1.2)
      $camera.updateProjectionMatrix()
      root.invalidate()
    }
  }
</script>

<svelte:window on:resize={resize} />

{#if WebGL.isWebGLAvailable()}
  <div class="container" bind:this={canvas} {style}>
    <Canvas antialias alpha={true}>
      {#if $camera}
        <SC.Group rotation={[is3D ? -Math.PI / 2 : 0, 0, 0]} scale={[flip ? -1 : 1, 1, 1]}>
          <SC.Group position={[-center[0], -center[1], -center[2]]}>
            {#each geometries as geometry}
              <SC.Mesh geometry={geometry.geometry} material={geometry.material} />
            {/each}
          </SC.Group>
          <slot name="geometry" />
        </SC.Group>
        <slot name="controls" />
      {/if}
      <PerspectiveCamera fov={cameraFOV} bind:self={$camera} bind:root />
      <SC.OrbitControls {enableZoom} {enableRotate} {enablePan} on:start on:end />
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
