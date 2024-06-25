<script lang="ts">
  import { view, noBase, noWall } from '$lib/store'
  import type { Geometry } from '$lib/worker/config'
  import GroupMatrix from './GroupMatrix.svelte'
  import Microcontroller from './Microcontroller.svelte'
  import KMesh from '$lib/3d/KeyboardMeshBetter.svelte'
  import type { KeyboardMeshes } from 'src/routes/beta/lib/viewers/viewer3dHelpers'

  export let geometry: Geometry | undefined
  export let microcontrollerGeometry: Geometry | undefined
  export let meshes: KeyboardMeshes
  export let transparency: number
  export let side: 'left' | 'right' | 'unibody'

  export let noWeb = false

  export let hideWall: boolean
  export let showSupports: boolean

  $: cTransparency = showSupports ? 0 : transparency
  $: plateTopOpacity = Math.pow(
    meshes.plateBotBuf
      ? Math.min(cTransparency / 50, Math.pow(cTransparency / 100, 0.2))
      : cTransparency / 100,
    2
  )
  $: plateScrewOpacity = Math.pow(
    meshes.plateBotBuf ? Math.min(cTransparency / 50, 1) : cTransparency / 100,
    2
  )
</script>

{#if !$noBase}<Microcontroller geometry={microcontrollerGeometry} {showSupports} />{/if}
{#each meshes.keyBufs || [] as key}
  <GroupMatrix matrix={key.matrix}>
    <KMesh
      kind="case"
      scale={key.flip && (side == 'left' || $view == 'left') ? [-1, 1, 1] : [1, 1, 1]}
      geometry={key.mesh}
    />
  </GroupMatrix>
{/each}
{#if !$noWall && !hideWall}<KMesh kind="case" geometry={meshes.wallBuf} debug />{/if}
{#if !noWeb}<KMesh kind="case" geometry={meshes.webBuf} />{/if}
{#if !$noBase}
  <KMesh kind="case" geometry={meshes.screwBaseBuf} />
  <KMesh kind="key" geometry={meshes.plateTopBuf} opacity={plateTopOpacity} renderOrder="10" />
  <KMesh
    kind="key"
    geometry={meshes.plateBotBuf}
    opacity={Math.pow((cTransparency - 50) / 50, 3)}
    renderOrder="10"
  />
  <KMesh kind="key" geometry={meshes.screwPlateBuf} opacity={plateScrewOpacity} />
  <KMesh kind="key" geometry={meshes.wristBuf} opacity={cTransparency / 100} />
  <KMesh kind="key" geometry={meshes.secondWristBuf} opacity={cTransparency / 100} />
  <KMesh
    kind="case"
    geometry={meshes.holderBuf}
    brightness={0.5}
    opacity={0.9}
    visible={!showSupports}
  />
{/if}
{#if showSupports}
  {#each meshes.supportGeometries || [] as geo}
    <KMesh kind="case" geometry={geo} brightness={0.5} opacity={0.8} />
  {/each}
{/if}
