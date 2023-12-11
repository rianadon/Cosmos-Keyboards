<script lang="ts">
  import { setup } from 'svelte-cubed/utils/context'
  import { Camera, Raycaster, Vector2 } from 'three'
  import { createEventDispatcher, getContext, setContext } from 'svelte'
  import { transformMode, hoveredKey } from '$lib/store'
  import type { Writable } from 'svelte/store'

  export let enabled = true

  const dispatcher = createEventDispatcher()

  const camera: Writable<Camera> = getContext('camera')
  const keys = new Map()
  setContext('keys', keys)

  const pointer = new Vector2()
  const { parent, root } = setup()

  const caster = new Raycaster()

  function updateCaster(e: MouseEvent) {
    const rect = root.canvas.getBoundingClientRect()

    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

    caster.setFromCamera(pointer, $camera)
  }

  function onPointerMove(e: MouseEvent) {
    if (!enabled) return
    if ($transformMode !== 'select') return
    updateCaster(e)
    if (pointer.x < -1 || pointer.x > 1 || pointer.y < -1 || pointer.y > 1) {
      $hoveredKey = null
      return
    }
    const intersects = caster.intersectObjects([...keys.keys()], false)
    if (intersects.length > 0) {
      $hoveredKey = keys.get(intersects[0].object)
    } else {
      $hoveredKey = null
    }
  }

  function onClick(e: MouseEvent) {
    if (!enabled) return
    if (!(root.controls.object as any).enabled) return
    updateCaster(e)
    if (pointer.x < -1 || pointer.x > 1 || pointer.y < -1 || pointer.y > 1) return
    const intersects = caster.intersectObjects([...keys.keys()], false)
    if (intersects.length > 0) {
      $hoveredKey = keys.get(intersects[0].object)
      dispatcher('click', keys.get(intersects[0].object))
    } else {
      // Do nothing
    }
  }
</script>

<svelte:window on:mousemove={onPointerMove} on:click={onClick} />

<slot />
