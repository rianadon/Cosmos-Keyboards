<script lang="ts">
  import { T, forwardEventHandlers } from '@threlte/core'
  import KeyboardMaterial from './KeyboardMaterial.svelte'
  import { Text, interactivity } from '@threlte/extras'
  import Icon from '$lib/presentation/Icon.svelte'
  import { mdiPlus } from '@mdi/js'
  import { MeshBasicMaterial } from 'three'

  const dispatchingComponent = forwardEventHandlers()

  let hovered = false
</script>

<T.Mesh
  position.z={5}
  bind:this={$dispatchingComponent}
  on:pointerenter={() => (hovered = true)}
  on:pointerleave={() => (hovered = false)}
>
  <T.SphereGeometry args={[8]} />
  <!-- <KeyboardMaterial kind="key" brightness={hovered ? 0.5 : 1.5} /> -->
  <T.MeshBasicMaterial color={hovered ? 'grey' : 'pink'} />
</T.Mesh>
