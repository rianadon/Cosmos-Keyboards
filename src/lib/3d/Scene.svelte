<script lang="ts">
  import { set_root } from 'svelte-cubed/utils/context'
  import { getContext, onDestroy, onMount } from 'svelte'
  import * as THREE from 'three'
  import type { Writable } from 'svelte/store'

  /** Scene options https://threejs.org/docs/?q=scene#api/en/scenes/Scene */

  export let background: THREE.Color | THREE.Texture | null = null

  export let environment: THREE.Texture | null = null

  export let fog: THREE.FogBase | null = null

  export let overrideMaterial: THREE.Material | null = null

  /** additional props */
  export let width: number = 0

  export let height: number = 0

  // public methods
  export function info() {
    return root.renderer.info
  }

  let _width: number

  let _height: number

  let container: HTMLElement

  let frame: number | null = null

  const run = (fn) => fn()

  const renderer: Writable<THREE.WebGLRenderer> = getContext('renderer')

  const invalidate = () => {
    if (frame) return

    frame = requestAnimationFrame(() => {
      frame = null
      if (!root.renderer) return

      root.renderer.setScissorTest(true)

      // set the viewport
      const rect = container.getBoundingClientRect()
      console.log(container, root.renderer.domElement.clientHeight, rect)
      const width = rect.right - rect.left
      const height = rect.bottom - rect.top
      const left = rect.left
      const bottom = root.renderer.domElement.clientHeight - rect.bottom

      root.renderer.domElement.style.transform = `translateY(${window.scrollY}px)`
      root.renderer.setViewport(left, bottom, width, height)
      root.renderer.setScissor(left, bottom, width, height)
      console.log('render', root.renderer, left, bottom, width, height)
      root.renderer.render(root.scene, root.camera.object)
    })
  }

  const root = set_root({
    canvas: null,
    scene: null,
    renderer: null,

    camera: {
      object: null,
      callback: () => {
        console.warn('no camera is set')
      },
      set: (camera, callback) => {
        root.camera.object = camera
        root.camera.callback = callback

        if (root.controls.callback) {
          root.controls.callback(root.camera.object, root.canvas)
        }

        invalidate()
      },
    },

    controls: {
      object: null,
      callback: null,
      set: (callback) => {
        root.controls.callback = callback

        if (root.camera.object) {
          root.controls.object = callback(root.camera.object, root.canvas)
        }
      },
    },

    before_render(fn) {},

    invalidate,
  })

  $: root.renderer = $renderer

  onMount(() => {
    root.scene = new THREE.Scene()

    resize()
  })

  const resize = () => {
    if (width === undefined) {
      _width = container.clientWidth / pixelRatio
    }

    if (height === undefined) {
      _height = container.clientHeight / pixelRatio
    }
  }

  $: if (root.scene) {
    root.scene.background = background
    root.scene.environment = environment
    root.scene.fog = fog
    root.scene.overrideMaterial = overrideMaterial
  }

  //   $: if (root.renderer) {
  //     const w = width !== undefined ? width : _width
  //     const h = height !== undefined ? height : _height

  //     root.renderer.setSize(w, h, false)
  //     root.camera.callback(w, h)
  //     root.renderer.setPixelRatio(pixelRatio)

  //     console.log('afdfa')
  //     invalidate()
  //   }
</script>

<svelte:window on:resize={resize} />

<div class="container" bind:this={container}>
  <canvas bind:this={root.canvas} />

  {#if root.scene}
    <slot />
  {/if}
</div>

<style>
  .container,
  canvas {
    position: absolute;
    width: 100%;
    height: 100%;
    left: 0;
    top: 0;
  }
</style>
