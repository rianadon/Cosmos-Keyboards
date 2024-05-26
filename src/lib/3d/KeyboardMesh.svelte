<script lang="ts">
  import type { BufferGeometry } from 'three'
  import KeyboardMaterial from './KeyboardMaterial.svelte'
  import type { KeyStatus } from './keyboardKey'
  import { T } from '@threlte/core'

  export let geometry: BufferGeometry | undefined

  export let opacity = 1
  export let brightness = 1
  export let kind: 'key' | 'case'
  export let status: KeyStatus = undefined
  export let letter: string | undefined = undefined
</script>

{#if geometry}
  <T.Mesh {geometry} {...$$restProps} visible={$$restProps.visible && opacity > 0}>
    <KeyboardMaterial {opacity} {brightness} {kind} {status} {letter} />
  </T.Mesh>
{/if}
