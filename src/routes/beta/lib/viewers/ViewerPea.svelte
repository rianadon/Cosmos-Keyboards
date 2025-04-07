<script lang="ts">
  import * as THREE from 'three'

  import Viewer from './Viewer.svelte'
  import { rectangle, drawLinedWall, drawWall, drawPath, fullSizes } from './viewerHelpers'

  import {
    fullEstimatedCenter,
    type Cuttleform,
    type CuttleKey,
    type Geometry,
  } from '$lib/worker/config'
  import { isRenderable, type ConfError } from '$lib/worker/check'
  import { keyLine } from '../matrixLayout'
  import { view } from '$lib/store'
  import { hasKeyGeometry } from '$lib/loaders/keycaps'
  import type { FullGeometry } from './viewer3dHelpers'
  import { mapObj, objEntries } from '$lib/worker/util'
  import { T } from '@threlte/core'
  import { HTML } from '@threlte/extras'

  export let geometry: FullGeometry
  export let style: string = ''
  export let confError: ConfError | undefined
  export let darkMode: boolean

  let activeIndex = 0
  $: possibleKeys = Object.values(geometry)
    .flatMap((g) => g.c.keys)
    .filter(hasKeyGeometry)
  $: activeKey = possibleKeys[activeIndex]
  let matrices = new Map<CuttleKey, [number, number]>()
  let matrixState: [typeof matrices, number] = [matrices, 0]
  export let fullMatrix: typeof matrices | undefined
  $: fullMatrix = activeKey ? undefined : matrices

  $: centers = fullEstimatedCenter(geometry, false)
  $: center = centers[$view]

  $: allGeometries =
    isRenderable(confError) && geometry
      ? drawStates(darkMode, confError, geometry)
      : ({} as ReturnType<typeof drawStates>)
  $: allGeometriesSize =
    isRenderable(confError) && geometry
      ? drawStatesForSizing(darkMode, confError, geometry)
      : ({} as ReturnType<typeof drawStates>)
  $: sizes = fullSizes(allGeometriesSize)
  $: size = sizes[$view]

  function drawStates(darkMode: boolean, confError: ConfError | undefined, geometry: FullGeometry) {
    return mapObj(geometry as Required<typeof geometry>, (g, kbd) =>
      drawState(g!.c, darkMode, confError?.side == kbd ? confError : undefined, g!)
    )
  }

  function drawStatesForSizing(
    darkMode: boolean,
    confError: ConfError | undefined,
    geometry: FullGeometry
  ) {
    return mapObj(geometry as Required<typeof geometry>, (g, kbd) =>
      drawStateForSizing(g!.c, darkMode, confError?.side == kbd ? confError : undefined, g!)
    )
  }

  /** Group keys by the cluster they belong to. */
  function splitByCluster(conf: Cuttleform) {
    const clusters: Record<string, CuttleKey[]> = {}
    for (const k of conf.keys) {
      if (!clusters.hasOwnProperty(k.cluster)) clusters[k.cluster] = []
      clusters[k.cluster].push(k)
    }
    return Object.values(clusters)
  }

  function drawStateForSizing(
    conf: Cuttleform,
    darkMode: boolean,
    confError: ConfError | undefined,
    geo: Geometry
  ) {
    const geos: { geometry: THREE.ShapeGeometry; material: THREE.Material }[] = []
    const pts = geo.allKeyCriticalPoints2D

    geos.push(
      ...pts.map((p) => ({
        geometry: drawLinedWall(p.map((p) => p.xy())),
        material: new THREE.MeshBasicMaterial({ color: 0xffcc33 }),
      }))
    )
    return geos
  }

  /** Computes matrix and renders Three.js geometry for displaying it and the keys. */
  function drawState(
    conf: Cuttleform,
    darkMode: boolean,
    confError: ConfError | undefined,
    geo: Geometry
  ) {
    const geos: { geometry: THREE.ShapeGeometry; material: THREE.Material }[] = []

    const keys = geo.keyHolesTrsfs2D

    const pts = geo.allKeyCriticalPoints2D

    if (confError?.type == 'intersection') {
      console.log(pts.map((po) => po.map((p) => p.xyz())))
      geos.push(
        ...pts.map((po) => ({
          geometry: drawLinedWall(po.map((p) => p.xy())),
          material: new THREE.MeshBasicMaterial({ color: 0xffcc33 }),
        }))
      )
      if (confError.i >= 0)
        geos.push({
          geometry: drawLinedWall(
            pts[confError.i].map((p) => p.xy()),
            0.5
          ),
          material: new THREE.MeshBasicMaterial({ color: 0xff0000 }),
        })
      if (confError.j >= 0)
        geos.push({
          geometry: drawLinedWall(
            pts[confError.j].map((p) => p.xy()),
            0.5
          ),
          material: new THREE.MeshBasicMaterial({ color: 0xff0000 }),
        })
      return geos
    }

    return geos
  }

  let recording = false
  let recorded = ''
  function handleKeydown(event: KeyboardEvent) {
    if (recording && event.key == ' ') {
      recording = false
      if (/^\d+,\d+$/.test(recorded)) {
        event.preventDefault()
        const [row, column] = recorded.split(',').map(Number)
        matrices.set(activeKey, [row, column])
        matrixState = [matrices, matrixState[1] + 1]
        activeIndex++
      }
      recorded = ''
    } else if (recording) recorded += event.key
    else if (event.key == '!') recording = true
  }

  function undo() {
    if (activeIndex == 0) return
    activeIndex -= 1
    matrices.delete(possibleKeys[activeIndex])
    matrixState = [matrices, matrixState[1] + 1]
  }

  function reset() {
    activeIndex = 0
    matrices.clear()
    matrixState = [matrices, matrixState[1] + 1]
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="absolute top-10 left-0 right-0">
  <div class="flex justify-center gap-2">
    <button class="button" on:click={() => undo()}>Undo</button>
    <button class="button" on:click={() => reset()}>Reset</button>
  </div>
</div>

<Viewer {size} {style} cameraPosition={[0, 0, 1]} enableRotate={false}>
  {#each objEntries(allGeometries) as [kbd, geos]}
    {@const geo = geometry[kbd]}
    {@const cent = center[kbd]}
    {#if cent}
      <T.Group position={[-cent[0], -cent[1], -cent[2]]} scale.x={kbd == 'left' ? -1 : 1}>
        {#each geos as geometry}
          <T.Mesh geometry={geometry.geometry} material={geometry.material} />
        {/each}
        {#if isRenderable(confError) && geometry}
          {#each geo.allKeyCriticalPoints2D as p, i}
            {@const active = geo.c.keys[i] == activeKey}
            {@const letter = hasKeyGeometry(geo.c.keys[i])}
            <T.Mesh geometry={drawWall(p.map((p) => p.xy()))}>
              <T.MeshBasicMaterial
                color={active ? 0x0000ff : letter ? 0xffcc33 : 0xcccccc}
                transparent={true}
                opacity={0.1}
              />
            </T.Mesh>
            <T.Mesh geometry={drawLinedWall(p.map((p) => p.xy()))}>
              <T.MeshBasicMaterial color={active ? 0x0000ff : letter ? 0xffcc33 : 0xcccccc} />
            </T.Mesh>
          {/each}
          {#each geo.keyHolesTrsfs2D.flat().map((k) => k.xyz()) as p, i}
            {@const key = geo.c.keys[i]}
            <HTML position={[p[0], p[1], 0]} center>
              <div class="leading-none text-center">
                {(hasKeyGeometry(key) && key.keycap?.letter) || ' '}
              </div>
              <div class="text-xs leading-none text-center opacity-70">
                {#if matrixState[0].has(key)} {matrixState[0].get(key).join(',')}{/if}
              </div>
            </HTML>
          {/each}
        {/if}
      </T.Group>
    {/if}
  {/each}
</Viewer>
{#if !activeKey}
  <div class="absolute inset-1/2">
    <div
      class="rounded text-center flex items-center justify-center w-48 h-16 absolute ml-[-6rem] mt-[-4rem] bg-white dark:bg-gray-800"
    >
      All done!
    </div>
  </div>
{/if}

<style>
  .button {
    z-index: 10;
    --at-apply: 'appearance-none bg-gray-200 dark:bg-gray-900 p-1 pr-2 m-1 rounded text-gray-800 dark:text-gray-200 flex gap-2';
  }
  .button:not(:disabled) {
    --at-apply: 'hover:bg-gray-400 dark:hover:bg-gray-700';
  }
  .button:disabled {
    --at-apply: 'opacity-40';
  }
</style>
