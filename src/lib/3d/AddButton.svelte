<script lang="ts">
  import { T, forwardEventHandlers } from '@threlte/core'
  import { CanvasTexture, Color } from 'three'

  export let darkMode: boolean

  function text(bgColor: string) {
    const scale = 16
    const padding = 160
    const canvas = new OffscreenCanvas(24 * scale + 2 * padding, 24 * scale + 2 * padding)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = new Color(bgColor).convertSRGBToLinear().getStyle()
    ctx.beginPath()
    ctx.arc(12 * scale + padding, 12 * scale + padding, 12 * scale + padding, 0, 2 * Math.PI)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = new Color('#333').convertSRGBToLinear().getStyle()
    ctx.fillRect(5 * scale + padding, 11 * scale + padding, 14 * scale, 2 * scale)
    ctx.fillRect(11 * scale + padding, 5 * scale + padding, 2 * scale, 14 * scale)
    return new CanvasTexture(canvas)
  }
  const darkTex = text('#f5d3ed')
  const darkHoverTex = text('#EC4899')
  const lightTex = text('#EFE8FF')
  const lightHoverTex = text('#D8B5FE')

  const dispatchingComponent = forwardEventHandlers()

  let hovered = false
</script>

<T.Mesh
  position.z={5}
  bind:this={$dispatchingComponent}
  on:pointerenter={() => (hovered = true)}
  on:pointerleave={() => (hovered = false)}
  visible={false}
>
  <T.SphereGeometry args={[8]} />
</T.Mesh>
<T.Sprite position.z={5} scale={16} renderOrder={100}>
  <T.SpriteMaterial
    map={darkMode ? (hovered ? darkHoverTex : darkTex) : hovered ? lightHoverTex : lightTex}
    depthTest={true}
    transparent
    alphaTest={0.5}
  />
</T.Sprite>
