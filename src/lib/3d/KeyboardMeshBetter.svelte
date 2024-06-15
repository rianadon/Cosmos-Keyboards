<script lang="ts">
  import { Vector3, type BufferGeometry } from 'three'
  import KeyboardMaterial from './KeyboardMaterial.svelte'
  import type { KeyStatus } from './keyboardKey'
  import { T } from '@threlte/core'
  import type { ShapeMesh } from 'replicad'
  import { fromGeometry } from '$lib/loaders/geometry'
  import { onDestroy } from 'svelte'

  export let geometry: ShapeMesh | undefined
  let threeGeo: BufferGeometry | undefined = undefined

  $: onNewGeometry(geometry)
  function onNewGeometry(geo: ShapeMesh | undefined) {
    if (threeGeo) threeGeo.dispose()
    threeGeo = fromGeometry(geo)
  }

  onDestroy(() => threeGeo && threeGeo.dispose())

  export let opacity = 1
  export let brightness = 1
  export let kind: 'key' | 'case'
  export let status: KeyStatus = undefined
  export let letter: string | undefined = undefined
  export let debug = false
</script>

{#if threeGeo}
  <T.Mesh geometry={threeGeo} {...$$restProps} visible={$$restProps.visible && opacity > 0} let:ref>
    <KeyboardMaterial {opacity} {brightness} {kind} {status} {letter} />
    {debug &&
      setTimeout(() => {
        console.log('the matrix', new Vector3(100, -80, 200).applyMatrix4(ref.modelViewMatrix))
      }, 1000)}
  </T.Mesh>
{/if}
