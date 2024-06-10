<script lang="ts">
  import { TransformControls } from '@threlte/extras'
  import { Quaternion, Vector3, type Vector4Tuple } from 'three'
  import { createEventDispatcher } from 'svelte'
  import { clickedKey, protoConfig, selectMode, transformMode } from '$lib/store'
  import { T } from '@threlte/core'
  import { transformationCenter } from '../../routes/beta/lib/viewers/viewer3dHelpers'

  export let visible = true

  const dispatch = createEventDispatcher()
  const pos = new Vector3()
  const quat = new Quaternion()
  const sca = new Vector3()

  let position = pos.toArray()
  let quaternion = quat.toArray() as Vector4Tuple

  $: if ($clickedKey != null) {
    const transformation = transformationCenter($clickedKey, $protoConfig, $selectMode)
      .evaluate({ flat: false })
      .Matrix4()
    transformation.decompose(pos, quat, sca)
    console.log(pos, quat)
    position = pos.toArray()
    quaternion = quat.toArray() as Vector4Tuple
  }
</script>

{#if ($transformMode == 'rotate' || $transformMode == 'translate') && $clickedKey != null && visible}
  <T.Object3D let:ref {position} {quaternion}>
    <TransformControls
      object={ref}
      size={0.9}
      space={$transformMode == 'translate' && $selectMode == 'cluster' ? 'world' : 'local'}
      mode={$transformMode}
      on:objectChange={() => {
        ref.updateMatrix()
        dispatch('move', ref.matrix)
      }}
      on:mouseUp={(e) => {
        ref.updateMatrix()
        dispatch('change', ref.matrix)
      }}
    />
  </T.Object3D>
{/if}
