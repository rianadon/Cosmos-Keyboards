<script lang="ts">
  import { T, Canvas, type ThrelteContext } from '@threlte/core'
  import WebGL from 'three/examples/jsm/capabilities/WebGL'
  import { OrbitControls } from '@threlte/extras'
  import { onMount } from 'svelte'
  import Interactivity from './Interactivity.svelte'
  import { Vector3, type PerspectiveCamera } from 'three'

  export let style: string = ''
  export let size: Vector3 | undefined = undefined
  export let suggestedSize: [number, number, number] | undefined = undefined
  export let cameraPosition: [number, number, number] = [0, 0.8, 1]
  export let enableRotate = true
  export let enableZoom = false
  export let enablePan = false
  let canvas: HTMLElement
  let ctx: ThrelteContext

  let cameraScale = 1
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
    if (!size || !ctx) return
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

  function updateSuggestedSize(size: [number, number, number]) {
    let aspect = canvas ? canvas.clientWidth / canvas.clientHeight : 1
    if (aspect == 0 || aspect == Infinity) aspect = 1
    const fov = cameraFOV * (Math.PI / 180)
    const fovh = 2 * Math.atan(Math.tan(fov / 2) * aspect)

    // Rotate bounding box by 30 degrees about x axis
    // This is more realistic as we typically view the keyboard ~30 degrees from the horizontal
    const theta = (30 / 180) * Math.PI
    const x = size[0]
    const y = size[1] * Math.cos(theta) + size[2] * Math.sin(theta)
    const z = size[1] * Math.sin(theta) + size[2] * Math.cos(theta)

    // Project the front of the bounding box onto the XZ plane using the camera's perspective
    const sizeXAtXZPlane = x + y * Math.tan(fovh / 2)
    const sizeZAtXZPlane = z + y * Math.tan(fov / 2)

    // Fit the bounding box at the XZ plane onto the canvas
    const widthScale = aspect / sizeXAtXZPlane
    const heightScale = 1 / aspect / sizeZAtXZPlane
    cameraScale = Math.min(widthScale, heightScale)
    console.log('scale', cameraScale, size, aspect)
  }

  $: if (size) resize()
  $: if (suggestedSize && canvas) updateSuggestedSize(suggestedSize)
</script>

<svelte:window on:resize={resize} />

{#if WebGL.isWebGLAvailable()}
  <div class="container" bind:this={canvas} {style}>
    <Canvas toneMapping={0} bind:ctx>
      <Interactivity>
        <T.Group scale={cameraScale}>
          <slot />
        </T.Group>

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
