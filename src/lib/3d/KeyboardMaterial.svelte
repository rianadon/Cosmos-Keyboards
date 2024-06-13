<script lang="ts">
  import { T } from '@threlte/core'
  import { COLORCONFIG, FRAGMENT_SHADER, VERTEX_SHADER, letterTexture } from './materials'
  import { statusColor, type KeyStatus } from './keyboardKey'
  import { flip as globalFlip, theme } from '$lib/store'
  import { Vector3 } from 'three'

  export let opacity = 1
  export let brightness = 1
  export let kind: 'key' | 'case'
  export let status: KeyStatus = undefined
  export let letter: string | undefined = undefined
  export let flip = false

  const saturation = new Vector3()
  const color = new Vector3()

  $: colorScheme = status ? statusColor(status) : $theme
  $: color.copy(COLORCONFIG[colorScheme][(kind + 'Color') as 'keyColor'])
  $: saturation.copy(COLORCONFIG[colorScheme][(kind + 'Saturation') as 'keySaturation'])
  $: letterTex = letter ? letterTexture(letter, flip || $globalFlip) : null
</script>

<T.ShaderMaterial
  fragmentShader={FRAGMENT_SHADER}
  vertexShader={VERTEX_SHADER}
  uniforms={{
    uOpacity: { value: 0 },
    uBrightness: { value: 1 },
    uSaturation: { value: saturation },
    uAmbient: { value: 0.8 },
    uColor: { value: color },
    tLetter: { value: null },
  }}
  uniforms.uOpacity.value={opacity}
  uniforms.uBrightness.value={brightness}
  uniforms.tLetter.value={letterTex}
  transparent={opacity < 1}
/>
