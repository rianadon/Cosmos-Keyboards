<script lang="ts">
  import { browser } from '$app/environment'
  import { setContext } from 'svelte'
  import { ACESFilmicToneMapping, ColorManagement, WebGLRenderer } from 'three'

  if (browser) {
    const canvas = new OffscreenCanvas(10, 10)
    const renderer = new WebGLRenderer({
      powerPreference: 'high-performance',
      canvas,
      antialias: true,
      alpha: true,
    })
    const anyRenderer = renderer as any
    anyRenderer.internalCtx = []
    anyRenderer.scheduler = []
    renderer.setAnimationLoop((time) => {
      anyRenderer.internalCtx.forEach((i: any) => i.dispose())
      anyRenderer.scheduler.forEach((s: any) => s.run(time))
      anyRenderer.internalCtx.forEach((i: any) => i.resetFrameInvalidation())
    })

    ColorManagement.enabled = true
    renderer.outputColorSpace = 'srgb'
    renderer.setPixelRatio(browser ? window.devicePixelRatio : 1)
    renderer.toneMapping = ACESFilmicToneMapping

    setContext('renderer', renderer)
  }
</script>

<slot />
