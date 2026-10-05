<script lang="ts">
  import {
    BATTERY_FLOOR_THICKNESS,
    batteryDimensions,
    localBatteryBounds,
  } from '$lib/geometry/batteries'
  import type { Geometry } from '$lib/worker/config'
  import { T } from '@threlte/core'
  import type { Vector3Tuple } from 'three'
  import GroupMatrix from './GroupMatrix.svelte'

  export let geometry: Geometry | undefined
  export let showSupports: boolean

  $: cell = cellBox(geometry)

  /** Size and pose of the cell resting in its tray. Placement errors are reported by the worker, so they are ignored here. */
  function cellBox(geo: Geometry | undefined) {
    if (!geo?.c.battery) return null
    let placement: Geometry['batteryPlacement']
    try {
      placement = geo.batteryPlacement
    } catch (e) {
      return null
    }
    if (!placement) return null
    const { length, width, thickness } = batteryDimensions(geo.c.battery.cell)
    const bnd = localBatteryBounds(geo.c.battery.cell, placement.alongWall)
    const size: Vector3Tuple = placement.alongWall
      ? [length, width, thickness]
      : [width, length, thickness]
    const matrix = placement.origin
      .pretranslated(0, (bnd.miny + bnd.maxy) / 2, BATTERY_FLOOR_THICKNESS + thickness / 2)
      .Matrix4()
    return { size, matrix }
  }
</script>

{#if cell}
  <GroupMatrix matrix={cell.matrix}>
    <T.Mesh visible={!showSupports}>
      <T.BoxGeometry args={cell.size} />
      <T.MeshStandardMaterial color="#3b82f6" transparent opacity={0.4} depthWrite={false} />
    </T.Mesh>
  </GroupMatrix>
{/if}
