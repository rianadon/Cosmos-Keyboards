<script lang="ts">
  import { T, useThrelte } from '@threlte/core'
  import {
    COLORCONFIG,
    FRAGMENT_SHADER,
    FRAGMENT_SHADER_CUTOFF,
    FRAGMENT_SHADER_INSTANCED,
    VERTEX_SHADER,
    VERTEX_SHADER_CUTOFF,
    VERTEX_SHADER_INSTANCED,
    drawLetterToTex,
  } from './materials'
  import { statusColor, type KeyStatus } from './keyboardKey'
  import { theme } from '$lib/store'
  import { CanvasTexture, Vector3 } from 'three'
  import { onDestroy } from 'svelte'

  export let opacity = 1
  export let brightness = 1
  export let kind: 'key' | 'case'
  export let status: KeyStatus = undefined
  export let letter: string | undefined = undefined
  export let flip = false
  export let textured = false
  export let instanced = false
  export let useColors = false

  const { invalidate } = useThrelte()

  const saturation = new Vector3()
  const color = new Vector3()

  let texture = textured ? new CanvasTexture(new OffscreenCanvas(512, 512)) : null

  $: colorScheme = status ? statusColor(status) : $theme
  $: color.copy(COLORCONFIG[colorScheme][(kind + 'Color') as 'keyColor'])
  $: saturation.copy(COLORCONFIG[colorScheme][(kind + 'Saturation') as 'keySaturation'])

  $: if (texture) drawLetterToTex(letter, texture, flip)

  let lastTheme = $theme
  $: if ($theme != lastTheme) {
    lastTheme = $theme
    invalidate()
  }

  onDestroy(() => {
    if (texture) texture.dispose()
  })
</script>

<T.ShaderMaterial
  fragmentShader={useColors
    ? FRAGMENT_SHADER_CUTOFF
    : instanced
    ? FRAGMENT_SHADER_INSTANCED
    : FRAGMENT_SHADER}
  vertexShader={useColors ? VERTEX_SHADER_CUTOFF : instanced ? VERTEX_SHADER_INSTANCED : VERTEX_SHADER}
  uniforms={{
    uOpacity: { value: 0 },
    uBrightness: { value: 1 },
    uSaturation: { value: saturation },
    uAmbient: { value: 0.8 },
    uColor: { value: color },
    tLetter: { value: texture },
  }}
  uniforms.uOpacity.value={opacity}
  uniforms.uBrightness.value={brightness}
  transparent={opacity < 1}
/>
