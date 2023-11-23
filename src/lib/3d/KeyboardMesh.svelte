<script lang="ts">
  import { setup } from 'svelte-cubed/utils/context'
  import { transform } from 'svelte-cubed/utils/object'
  import * as defaults from 'svelte-cubed/utils/defaults'
  import { type BufferGeometry, Mesh } from 'three'
  import { COLORCONFIG, KeyboardMaterial, letterTexture } from './materials'
  import { theme, flip } from '$lib/store'
  import { statusColor, type KeyStatus } from './keyboardKey'

  export let geometry: BufferGeometry | undefined = undefined
  export let position = defaults.position
  export let rotation = defaults.rotation
  export let scale = defaults.scale
  export let letter: string | undefined = undefined
  export let castShadow = false
  export let receiveShadow = false
  export let frustumCulled = true
  export let renderOrder = 0

  /* @ts-ignore */
  const material = new KeyboardMaterial({})
  const { root, self } = setup(new Mesh(geometry, material))
  export { self }

  export let opacity = 1
  export let brightness = 1
  export let kind: 'key' | 'case'
  export let status: KeyStatus = undefined
  export let visible = true

  $: colorScheme = status ? statusColor(status) : $theme
  $: color = COLORCONFIG[colorScheme][kind + 'Color']
  $: saturation = COLORCONFIG[colorScheme][kind + 'Saturation']
  $: letterTex = letter ? letterTexture(letter, $flip) : null

  $: {
    if (self.geometry && geometry !== self.geometry) {
      self.geometry.dispose()
    }

    self.geometry = geometry || defaults.geometry
    self.castShadow = castShadow
    self.receiveShadow = receiveShadow
    self.frustumCulled = frustumCulled
    self.renderOrder = renderOrder
    self.visible = opacity > 0 && visible

    material.uniforms.uOpacity.value = opacity
    material.uniforms.uBrightness.value = brightness
    material.uniforms.uSaturation.value = saturation
    material.uniforms.uColor.value = color
    material.uniforms.tLetter.value = letterTex
    material.transparent = opacity < 1

    transform(self, position, rotation, scale)
    root.invalidate()
  }
</script>
