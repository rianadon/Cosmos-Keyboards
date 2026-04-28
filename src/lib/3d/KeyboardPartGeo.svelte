<script lang="ts">
  import { partGeometry } from '$lib/loaders/parts'
  import type { CuttleKey } from '$lib/worker/config'
  import { T, useTask } from '@threlte/core'
  import { BoxGeometry, InstancedBufferAttribute, DynamicDrawUsage, type BufferGeometry } from 'three'
  import { getContext } from 'svelte'

  export let part: CuttleKey['type']
  export let variant: Record<string, any> | undefined

  let geometry: BufferGeometry = new BoxGeometry()

  let brightnessAttribute: InstancedBufferAttribute

  const context = getContext<any>('threlte-instanced-mesh-default')
  const brightness = new Float32Array(1000).fill(1)
  if (context) {
    brightness[0] = 0.5
    brightness[1] = 0

    const { instances } = context

    useTask(() => {
      if (brightnessAttribute) brightnessAttribute.needsUpdate = true

      for (let i = 0; i < instances.current.length; i++) {
        const instance = instances.current[i]
        brightness[i] = (instance as any).brightness
      }
    })
  }

  $: {
    partGeometry(part, variant).then((p) => p && (geometry = p))
  }
</script>

<T is={geometry} attach="geometry">
  {#if context}
    <T.InstancedBufferAttribute
      bind:ref={brightnessAttribute}
      count={brightness.length}
      array={brightness}
      itemSize={1}
      usage={DynamicDrawUsage}
      attach={(parent, self) => {
        parent.setAttribute('instanceBrightness', self)
      }}
    />
  {/if}
  <slot />
</T>
