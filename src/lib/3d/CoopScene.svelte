<script lang="ts">
  /**
   * A scene that uses a SharedRenderer to render itself.
   * This helps reduce the number of WebGL contexts.
   */

  import { set_root } from 'svelte-cubed/utils/context'
  import { getContext, onMount } from 'svelte'
  import * as THREE from 'three'
  import type { Writable } from 'svelte/store'

  /** Scene options https://threejs.org/docs/?q=scene#api/en/scenes/Scene */
  export let background: THREE.Color | THREE.Texture | null = null
  export let environment: THREE.Texture | null = null
  export let fog: THREE.FogBase | null = null
  export let overrideMaterial: THREE.Material | null = null

  /** additional props */
  export let width: number | undefined = undefined
  export let height: number | undefined = undefined

  let _width: number
  let _height: number

  let container: HTMLElement
  let frame: number | null = null

  const pixelRatio = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1
  const renderer: Writable<THREE.WebGLRenderer> = getContext('renderer')

  const invalidate = () => {
    if (frame) return

    frame = requestAnimationFrame(() => {
      frame = null
      if (!root.renderer) return

      root.renderer.setSize(_width, _height)
      root.renderer.render(root.scene, root.camera.object)
      if (!root.canvas) return
      const ctx = root.canvas.getContext('2d')!
      ctx.clearRect(0, 0, root.canvas.width, root.canvas.height)
      ctx.drawImage(root.renderer.domElement, 0, 0)
    })
  }

  const root = set_root({
    canvas: null as any,
    scene: null as any,
    renderer: null as any,

    camera: {
      object: null as any,
      callback: () => console.warn('no camera is set'),
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
      object: null as any,
      callback: null as any,
      set: (callback) => {
        root.controls.callback = callback
        if (root.camera.object) {
          root.controls.object = callback(root.camera.object, root.canvas)
        }
      },
    },

    before_render(_fn) {},
    invalidate,
  })

  $: root.renderer = $renderer

  onMount(() => {
    root.scene = new THREE.Scene()
    resize()
  })

  const resize = () => {
    if (width === undefined) {
      _width = container.clientWidth
    }

    if (height === undefined) {
      _height = container.clientHeight
    }

    root.camera.callback(_width, _height)
    root.canvas.width = _width * pixelRatio
    root.canvas.height = _height * pixelRatio
    invalidate()
  }

  $: if (root.scene) {
    root.scene.background = background
    root.scene.environment = environment
    root.scene.fog = fog
    root.scene.overrideMaterial = overrideMaterial
  }
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
