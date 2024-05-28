<script lang="ts">
  import { TransformControls } from '@threlte/extras'
  import type { TransformControls as TransformControlsThree } from 'three/examples/jsm/controls/TransformControls'
  import {
    BoxGeometry,
    Camera,
    Matrix4,
    MeshStandardMaterial,
    Object3D,
    Quaternion,
    Vector3,
    type Vector4Tuple,
  } from 'three'
  import { createEventDispatcher, getContext, onDestroy } from 'svelte'
  import { transformMode } from '$lib/store'
  import type { Writable } from 'svelte/store'
  import { T } from '@threlte/core'
  import GroupMatrix from './GroupMatrix.svelte'

  export let transformation: Matrix4
  export let center: [number, number, number]
  export let plane: boolean | string
  export let flip: boolean
  export let fixed = false

  let trsf: Matrix4 = new Matrix4()

  const dispatch = createEventDispatcher()

  function onObjectChange(e: Event) {
    const mat = (e.target as any).children[1].matrixWorld
    dispatch('move', new Matrix4().multiplyMatrices(worldTrInverse, mat))
  }

  // function onDraggingChanged(event: any) {
  //   if (event.value) (root.controls.object as any).enabled = false
  //   else requestAnimationFrame(() => ((root.controls.object as any).enabled = true))
  // })

  function onMouseUp(e: Event) {
    const mat = (e.target as any).children[1].matrixWorld
    dispatch('change', new Matrix4().multiplyMatrices(worldTrInverse, mat))
  }

  $: worldTr = new Matrix4()
    .makeTranslation(-center[0], -center[1], -center[2])
    // .premultiply(new Matrix4().makeRotationAxis(new Vector3(1, 0, 0), -Math.PI / 2))
    .premultiply(new Matrix4().makeScale(flip ? -1 : 1, 1, 1))
  $: worldTrInverse = worldTr.clone().invert()

  $: trsf = new Matrix4().copy(transformation).premultiply(worldTr)

  const pos = new Vector3()
  const quat = new Quaternion()
  const sca = new Vector3()

  let position = pos.toArray()
  let quaternion = quat.toArray() as Vector4Tuple

  $: {
    trsf.decompose(pos, quat, sca)
    position = pos.toArray()
    quaternion = quat.toArray() as Vector4Tuple
    console.log('position', position, quaternion)
  }

  // $: if (!fixed && ($transformMode == 'translate' || $transformMode == 'rotate'))
  //   controls.setMode($transformMode)
</script>

<!-- <TransformControls
  size={0.8}
  space="local"
  mode={$transformMode}
  on:objectChange={onObjectChange}
  on:mouseUp={onMouseUp}
>
  <GroupMatrix matrix={trsf} />
</TransformControls> -->

{#if $transformMode == 'rotate' || $transformMode == 'translate'}
  <TransformControls
    {position}
    {quaternion}
    size={0.8}
    space="local"
    mode={$transformMode}
    on:objectChange={onObjectChange}
    on:mouseUp={onMouseUp}
  >
    <T.Object3D />
  </TransformControls>
{/if}
