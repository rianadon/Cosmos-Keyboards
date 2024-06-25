<script lang="ts">
  import type { CuttleKey } from '$lib/worker/config'
  import { T } from '@threlte/core'
  import { BoxGeometry, type BufferGeometry } from 'three'
  import { keyGeometry } from '$lib/loaders/keycaps'

  export let key: CuttleKey
  let geometry: BufferGeometry = new BoxGeometry()

  $: {
    keyGeometry(key).then((p) => p && (geometry = p))
  }
</script>

<T is={geometry} attach="geometry">
  <slot />
</T>
