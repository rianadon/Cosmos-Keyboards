<script lang="ts">
  import { TransformControls } from '@threlte/extras'
  import { Matrix4, Quaternion, Vector3, type Vector4Tuple } from 'three'
  import { createEventDispatcher } from 'svelte'
  import { clickedKey, protoConfig, selectMode, transformMode, view } from '$lib/store'
  import { T } from '@threlte/core'
  import {
    flipMatrixX,
    shouldFlipKey,
    transformationCenter,
  } from '../../routes/beta/lib/viewers/viewer3dHelpers'
  import type { CosmosKeyboard } from '$lib/worker/config.cosmos'
  import { TransformControls as TC } from 'three/examples/jsm/controls/TransformControls.js'

  export let visible = true
  export let snap: boolean
  export let useAbsolute = false
  let controls: TC

  const dispatch = createEventDispatcher()
  const pos = new Vector3()
  const quat = new Quaternion()
  const sca = new Vector3()

  let position = pos.toArray()
  let quaternion = quat.toArray() as Vector4Tuple

  function conditionalFlip(
    mat: Matrix4,
    view: 'left' | 'right' | 'both',
    n: number | null,
    kbd: CosmosKeyboard
  ) {
    return shouldFlipKey(view, n, kbd) ? flipMatrixX(mat) : mat
  }

  $: if ($clickedKey != null) {
    const transformation = conditionalFlip(
      transformationCenter($clickedKey, $protoConfig, $selectMode).evaluate({ flat: false }).Matrix4(),
      $view,
      $clickedKey,
      $protoConfig
    )
    transformation.decompose(pos, quat, sca)
    position = pos.toArray()
    quaternion = quat.toArray() as Vector4Tuple
  }

  // const dispatchSnap = (_snap: boolean) => {
  //   // Force the controls to update themselves, therefore updating the controlled object
  //   // This causes the key to move when snap is enabled/disabled
  //   setTimeout(() => controls.dragging && controls.pointerMove(null), 5)
  // }
  // $: dispatchSnap(snap)
</script>

{#if ($transformMode == 'rotate' || $transformMode == 'translate') && $clickedKey != null && visible}
  <T.Object3D let:ref {position} {quaternion}>
    <TransformControls
      object={ref}
      size={0.9}
      space={($transformMode == 'translate' && $selectMode == 'cluster') ||
      (useAbsolute && $selectMode == 'key')
        ? 'world'
        : 'local'}
      mode={$transformMode}
      rotationSnap={snap ? Math.PI / 2 : undefined}
      bind:controls
      on:objectChange={() => {
        ref.updateMatrix()
        dispatch('move', conditionalFlip(ref.matrix, $view, $clickedKey, $protoConfig))
      }}
      on:mouseUp={(e) => {
        ref.updateMatrix()
        dispatch('change', conditionalFlip(ref.matrix, $view, $clickedKey, $protoConfig))
      }}
    />
  </T.Object3D>
{/if}
