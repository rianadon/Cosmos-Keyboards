<script lang="ts">
  import { T } from '@threlte/core'
  import { createEventDispatcher, getContext, onMount } from 'svelte'
  import { tweened } from 'svelte/motion'
  import { bounceOut } from 'svelte/easing'
  import { TransformControls, type interactivity } from '@threlte/extras'
  import { type BufferGeometry, Matrix4, Quaternion, Vector3, type Vector4Tuple } from 'three'
  import KeyboardMaterial from './KeyboardMaterial.svelte'

  export let geometry: BufferGeometry
  export let matrix: Matrix4
  export let opacity: number
  export let selected: boolean
  export let hovered: boolean
  export let mode: 'translate' | 'rotate' | 'select'

  const dispatch = createEventDispatcher()

  type InteractivityContext = ReturnType<typeof interactivity>
  const context: InteractivityContext = getContext('interactivity')

  // Drop-and-bounce-in animation: the model falls from DROP_HEIGHT onto the floor and
  // bounces before settling. dropOffsetZ is added on top of the resting position.
  const DROP_HEIGHT = 60 // mm above the resting position to drop from

  const dropOffsetZ = tweened(DROP_HEIGHT, { duration: 700, easing: bounceOut })
  onMount(() => dropOffsetZ.set(0))

  const pos = new Vector3()
  const quat = new Quaternion()
  const sca = new Vector3()
  let position = pos.toArray()
  let quaternion = quat.toArray() as Vector4Tuple
  let scale = sca.toArray()
  $: {
    matrix.decompose(pos, quat, sca)
    position = [pos.x, pos.y, pos.z + $dropOffsetZ]
    quaternion = quat.toArray() as Vector4Tuple
    scale = sca.toArray()
  }

  $: brightness = selected ? 0.7 : hovered ? 0.9 : 1
</script>

<T.Group {position} {quaternion} {scale} let:ref>
  <T.Mesh
    visibility={opacity > 0}
    {geometry}
    on:click={() => dispatch('select')}
    on:pointerenter={() => dispatch('hover')}
    on:pointerleave={() => dispatch('unhover')}
    on:pointermissed={() => {
      if (!context.initialHits.length) dispatch('deselect')
    }}
  >
    <KeyboardMaterial kind="case" status="info" {opacity} {brightness} />
  </T.Mesh>
  {#if selected && (mode == 'translate' || mode == 'rotate')}
    <TransformControls
      object={ref}
      size={0.9}
      {mode}
      on:objectChange={() => {
        ref.updateMatrix()
        dispatch('change', ref.matrix.clone())
      }}
    />
  {/if}
</T.Group>
