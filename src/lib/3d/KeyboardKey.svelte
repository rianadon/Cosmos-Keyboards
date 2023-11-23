<script lang="ts">
  import * as defaults from 'svelte-cubed/utils/defaults'
  import { getContext, onDestroy, onMount } from 'svelte'
  import { hoveredKey, clickedKey } from '$lib/store'
  import KeyboardMesh from './KeyboardMesh.svelte'
  import type { KeyMesh, KeyStatus } from './keyboardKey'

  export let index: number
  export let geometry = defaults.geometry

  export let opacity = 1
  export let brightness = 1
  export let status: KeyStatus = undefined
  export let letter = undefined

  export let position = defaults.position
  export let rotation = defaults.rotation
  export let scale = defaults.scale
  export let castShadow = false
  export let receiveShadow = false
  export let frustumCulled = true
  export let renderOrder = 0

  const keys: Map<any, any> = getContext('keys')
  let self: KeyMesh

  onMount(() => {
    keys.set(self, index)
  })
  onDestroy(() => {
    keys.delete(self)
  })
</script>

<KeyboardMesh
  kind="key"
  {geometry}
  bind:self
  brightness={index === $hoveredKey || index === $clickedKey ? 0.3 : brightness}
  {opacity}
  {status}
  {letter}
  {position}
  {rotation}
  {scale}
  {castShadow}
  {receiveShadow}
  {frustumCulled}
  {renderOrder}
/>
