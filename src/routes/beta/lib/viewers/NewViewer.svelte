<script lang="ts">
  import { T, Canvas, type ThrelteContext } from '@threlte/core'
  import WebGL from 'three/examples/jsm/capabilities/WebGL'
  import { OrbitControls } from '@threlte/extras'
  import { onMount } from 'svelte'
  import Interactivity from './Interactivity.svelte'
  import type { Material, PerspectiveCamera, ShapeGeometry, Vector3 } from 'three'

  interface Geo {
    geometry: ShapeGeometry
    material: Material
  }
  export let geometries: Geo[]
  export let style: string = ''
  export let center: [number, number, number]
  export let size: Vector3 | undefined = undefined
  export let cameraPosition: [number, number, number] = [0, 0.8, 1]
  export let enableRotate = true
  export let enableZoom = false
  export let enablePan = false
  let canvas: HTMLElement
  let ctx: ThrelteContext

  const cameraFOV = 45

  onMount(() => {
    console.log('MOUNT VIEWER')
    resize()
  })

  function updateCameraPos() {
    cameraPosition = ctx.camera.current.position.clone().toArray()
  }

  function resize() {
    // https://wejn.org/2020/12/cracking-the-threejs-object-fitting-nut/
    if (!size) return
    let aspect = canvas ? canvas.clientWidth / canvas.clientHeight : 1
    if (aspect == 0 || aspect == Infinity) aspect = 1
    const fov = cameraFOV * (Math.PI / 180)
    const fovh = 2 * Math.atan(Math.tan(fov / 2) * aspect)
    let dx = size.z / 2 + Math.abs(size.x / 2 / Math.tan(fovh / 2))
    let dy = size.z / 2 + Math.abs(size.y / 2 / Math.tan(fov / 2))
    const camera = ctx.camera.current as PerspectiveCamera
    camera.position.normalize()
    camera.position.multiplyScalar(Math.max(dx, dy) * 1.2)
    updateCameraPos()
  }
</script>

<svelte:window on:resize={resize} />

{#if WebGL.isWebGLAvailable()}
  <div class="container" bind:this={canvas} {style}>
    <Canvas toneMapping={0} bind:ctx>
      <Interactivity>
        <T.Group position={[-center[0], -center[1], -center[2]]}>
          {#each geometries as geometry}
            <T.Mesh geometry={geometry.geometry} material={geometry.material} />
          {/each}
        </T.Group>
        <slot />

        <T.PerspectiveCamera makeDefault fov={cameraFOV} position={cameraPosition} up={[0, 0, 1]}>
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
