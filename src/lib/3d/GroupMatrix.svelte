<script lang="ts">
  import { T } from '@threlte/core'
  import { Matrix4, Quaternion, Vector3, type Vector4Tuple } from 'three'

  export let matrix = new Matrix4()

  const pos = new Vector3()
  const quat = new Quaternion()
  const sca = new Vector3()

  let position = pos.toArray()
  let quaternion = quat.toArray() as Vector4Tuple
  let scale = sca.toArray()

  $: {
    matrix.decompose(pos, quat, sca)
    position = pos.toArray()
    quaternion = quat.toArray() as Vector4Tuple
    scale = sca.toArray()
  }
</script>

<T.Group {...$$restProps} {position} {quaternion} {scale}>
  <slot />
</T.Group>
