<script lang="ts">
  import { onMount, setContext } from 'svelte'
  import { writable } from 'svelte/store'
  import * as THREE from 'three'

  /** Renderer options https://threejs.org/docs/?q=render#api/en/renderers/WebGLRenderer */

  export let precision: 'lowp' | 'mediump' | 'highp' = 'highp'

  export let powerPreference: 'default' | 'high-performance' | 'low-power' = 'default'

  export let alpha = false
  export let premultipliedAlpha = true
  export let antialias = false
  export let stencil = true
  export let preserveDrawingBuffer = false
  export let failIfMajorPerformanceCaveat = false
  export let depth = true
  export let logarithmicDepthBuffer = false

  export let autoClear = true
  export let autoClearColor = true
  export let autoClearDepth = true
  export let autoClearStencil = true
  export let checkShaderErrors = true
  export let localClippingEnabled = false
  export let physicallyCorrectLights = false

  export let outputEncoding: number | undefined = undefined

  export let clippingPlanes: THREE.Plane[] = []

  export let shadows:
    | boolean
    | typeof THREE.BasicShadowMap
    | typeof THREE.PCFShadowMap
    | typeof THREE.PCFSoftShadowMap
    | typeof THREE.VSMShadowMap
    | undefined = undefined

  export let toneMapping:
    | typeof THREE.NoToneMapping
    | typeof THREE.LinearToneMapping
    | typeof THREE.ReinhardToneMapping
    | typeof THREE.CineonToneMapping
    | typeof THREE.ACESFilmicToneMapping = THREE.NoToneMapping
  export let toneMappingExposure = 1

  let renderer: THREE.WebGLRenderer
  let canvas: HTMLCanvasElement
  const rendererStore = writable<THREE.WebGLRenderer>(undefined)
  setContext('renderer', rendererStore)

  export let pixelRatio = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1

  onMount(() => {
    canvas = document.createElement('canvas')
    canvas.style = 'position: absolute; left: 0; width: 100%; height: 100%; z-index: 100;'
    renderer = new THREE.WebGLRenderer({
      canvas,
      precision,
      powerPreference,
      alpha,
      premultipliedAlpha,
      antialias,
      stencil,
      preserveDrawingBuffer,
      failIfMajorPerformanceCaveat,
      depth,
      logarithmicDepthBuffer,
    })
    rendererStore.set(renderer)
    resize()

    document.body.prepend(canvas)

    return () => {
      canvas.remove()
      console.log('disposing of renderer')
      renderer!.forceContextLoss()
      renderer!.dispose()
    }
  })

  $: if (renderer) {
    renderer.autoClear = autoClear
    renderer.autoClearColor = autoClearColor
    renderer.autoClearDepth = autoClearDepth
    renderer.autoClearStencil = autoClearStencil
    renderer.debug.checkShaderErrors = checkShaderErrors
    renderer.localClippingEnabled = localClippingEnabled
    renderer.physicallyCorrectLights = physicallyCorrectLights
    if (outputEncoding != null) renderer.outputEncoding = outputEncoding
    renderer.clippingPlanes = clippingPlanes
    renderer.toneMapping = toneMapping
    renderer.toneMappingExposure = toneMappingExposure
    renderer.setPixelRatio(pixelRatio)

    if (shadows) {
      renderer.shadowMap.enabled = true
      renderer.shadowMap.autoUpdate = true // TODO allow some way to control this?
      renderer.shadowMap.type = shadows === true ? THREE.PCFShadowMap : shadows
    } else {
      renderer.shadowMap.enabled = false
    }
  }

  const resize = () => {
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    if (canvas.width !== width || canvas.height !== height) {
      renderer.setSize(width, height, false)
    }
  }
</script>

<svelte:window on:resize={resize} />

<canvas bind:this={canvas} />

<slot />

<style>
  canvas {
  }
</style>
