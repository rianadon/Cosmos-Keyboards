<script lang="ts">
  import { browser } from '$app/environment'
  import { SceneGraphObject, createThrelteContext, watch, type Size } from '@threlte/core'
  import type { ThrelteInternalContext } from 'node_modules/@threlte/core/dist/lib/contexts'
  import { getContext, onDestroy, onMount } from 'svelte'
  import { writable } from 'svelte/store'
  import { ACESFilmicToneMapping, OrthographicCamera, PCFSoftShadowMap, WebGLRenderer } from 'three'

  export let size: Size | undefined = undefined
  export let autoRender = true

  let container: HTMLElement
  let canvas: HTMLCanvasElement
  let initialized = writable(false)
  const dpr = browser ? window.devicePixelRatio : 1

  // user size as a store
  const userSize = writable<Size | undefined>(size)
  $: userSize.set(size)

  // in case the user didn't define a fixed size, use the parent elements size
  // const { parentSize, parentSizeAction } = useParentSize()
  const parentSize = writable<Size>({ width: 100, height: 100 })

  const ctx = createThrelteContext({
    colorManagementEnabled: true,
    colorSpace: 'srgb',
    dpr: browser ? window.devicePixelRatio : 1,
    renderMode: 'on-demand',
    parentSize,
    autoRender,
    shadows: PCFSoftShadowMap,
    toneMapping: ACESFilmicToneMapping,
    useLegacyLights: false,
    userSize,
  })
  const internalCtx = getContext<ThrelteInternalContext>('threlte-internal-context')
  const renderer = getContext<WebGLRenderer>('renderer')

  watch([initialized, ctx.autoRender], ([initialized, autoRender]) => {
    if (initialized && autoRender) {
      ctx.autoRenderTask.start()
    } else {
      ctx.autoRenderTask.stop()
    }
    return () => {
      ctx.autoRenderTask.stop()
    }
  })

  onMount(() => {
    if (!browser) return
    ctx.renderer = {
      render(scene, camera) {
        const size = $parentSize
        renderer.setSize(size.width, size.height, false)
        const ortho = camera as OrthographicCamera
        if (ortho.isOrthographicCamera) {
          ortho.left = -1
          ortho.right = 1
          ortho.bottom = -1
          ortho.top = 1
          ortho.updateProjectionMatrix()
          ortho.updateMatrixWorld()
        }

        renderer.render(scene, camera)

        if (!canvas) return
        const ctx = canvas.getContext('2d')!
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(renderer.domElement, 0, 0)
      },
      setAnimationLoop(callback) {
        renderer.setAnimationLoop(callback)
      },
      domElement: canvas,
    } as WebGLRenderer

    // Some hacks
    const anyRenderer = renderer as any
    anyRenderer.internalCtx.push(internalCtx)
    anyRenderer.scheduler.push(ctx.scheduler)

    initialized.set(true)
    resize()
  })

  const resize = () => {
    parentSize.set({ width: container.clientWidth, height: container.clientHeight })
    if (canvas) {
      canvas.width = container.clientWidth * dpr
      canvas.height = container.clientHeight * dpr
    }
  }

  onDestroy(() => {
    internalCtx.dispose(true)
    ctx.scheduler.dispose()
  })
</script>

<svelte:window on:resize={resize} />

<div class="canvascont" bind:this={container}>
  <canvas bind:this={canvas}>
    {#if $initialized}
      <SceneGraphObject object={ctx.scene}>
        <slot />
      </SceneGraphObject>
    {/if}
  </canvas>
</div>

<style>
  .canvascont,
  canvas {
    position: absolute;
    width: 100%;
    height: 100%;
    left: 0;
    top: 0;
  }
</style>
