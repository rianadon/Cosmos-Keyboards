<script lang="ts">
  import { view, noBase, noWall } from '$lib/store'
  import type { Geometry } from '$lib/worker/config'
  import GroupMatrix from './GroupMatrix.svelte'
  import Microcontroller from './Microcontroller.svelte'
  import KMesh from '$lib/3d/KeyboardMeshBetter.svelte'
  import type { KeyboardMeshes } from 'src/routes/beta/lib/viewers/viewer3dHelpers'

  export let microcontrollerGeometry: Geometry | undefined = undefined
  export let meshes: KeyboardMeshes
  export let transparency: number = 100
  export let side: 'left' | 'right' | 'unibody'

  export let noWeb = false

  export let hideWall: boolean = false
  export let showSupports: boolean = false

  export let caseColor: [any, number] | undefined = undefined
  export let plateColor: [any, number] | undefined = undefined

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

{#if !$noBase}<Microcontroller
    flip={side == 'left' || $view == 'left'}
    geometry={microcontrollerGeometry}
    {showSupports}
  />{/if}
{#each meshes.keyBufs || [] as key}
  <GroupMatrix matrix={key.matrix}>
    <KMesh
      kind="case"
      scale={key.flip && (side == 'left' || $view == 'left') ? [-1, 1, 1] : [1, 1, 1]}
      geometry={key.mesh}
      color={caseColor}
    />
  </GroupMatrix>
{/each}
{#if !$noWall && !hideWall}<KMesh
    kind="case"
    geometry={meshes.wallBuf}
    color={caseColor}
    castShadow={!!caseColor}
  />{/if}
{#if !noWeb}<KMesh kind="case" geometry={meshes.webBuf} color={caseColor} />{/if}
{#if !$noBase}
  <KMesh kind="case" geometry={meshes.screwBaseBuf} color={caseColor} />
  <KMesh
    kind="key"
    geometry={meshes.plateTopBuf}
    opacity={plateTopOpacity}
    renderOrder="10"
    color={plateColor}
  />
  <KMesh
    kind="key"
    geometry={meshes.plateBotBuf}
    opacity={Math.pow((cTransparency - 50) / 50, 3)}
    renderOrder="10"
    color={plateColor}
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
