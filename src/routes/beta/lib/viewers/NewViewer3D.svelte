<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import {
    BoxGeometry,
    BufferAttribute,
    BufferGeometry,
    Euler,
    Matrix4,
    Object3D,
    Quaternion,
    Triangle,
    Vector3,
    MeshBasicMaterial,
    MeshNormalMaterial,
  } from 'three'
  import * as SC from 'svelte-cubed'
  import {
    thumbOrigin,
    type CuttleformProto,
    matrixToConfig,
    type Cuttleform,
    type CuttleKey,
    findKeyByAttr,
    tupleToRot,
    tupleToXYZ,
    cuttleConf,
    thumbs,
    decodeTuple,
    encodeTuple,
    type Geometry,
    decodeCustomKey,
    switchType,
    keycapType,
  } from '$lib/worker/config'
  import type { ConfError } from '$lib/worker/check'
  import Viewer from './Viewer.svelte'
  import Trsf from '$lib/worker/modeling/transformation'
  import {
    debugViewport,
    protoConfig,
    transformMode,
    clickedKey,
    noBase,
    showKeyInts,
    selectMode,
    tempConfig,
  } from '$lib/store'
  import HandModel from '$lib/3d/HandModel.svelte'
  import { FINGERS, type Joints, objectFromFingers, SolvedHand } from '../hand'
  import { refine } from '../handoptim'
  import Keyboard from '$lib/3d/Keyboard.svelte'
  import AddButton from '$lib/3d/AddButton.svelte'
  import * as flags from '$lib/flags'
  import TransformControls from '$lib/3d/TransformControls.svelte'
  import AxesHelper from '$lib/3d/AxesHelper.svelte'
  import Raycaster from '$lib/3d/Raycaster.svelte'
  import ETrsf, { keyPosition, keyPositionTop } from '$lib/worker/modeling/transformation-ext'
  import { closestAspect, keyInfo } from '$lib/geometry/keycaps'
  import { switchInfo } from '$lib/geometry/switches'
  import { KeyMaterial } from '$lib/3d/materials'
  import { boardGeometries } from '$lib/loaders/boardElement'
  import {
    allKeyCriticalPoints,
    applyKeyAdjustment,
    keyHolesTrsfs,
    componentBoxes,
    componentGeometry,
    wristRestGeometry,
  } from '$lib/worker/geometry'
  import * as mdi from '@mdi/js'
  import Icon from '$lib/presentation/Icon.svelte'
  import KeyboardMesh from '$lib/3d/KeyboardMesh.svelte'
  import { Cuttleform_CustomThumb } from '$target/proto/cuttleform'
  import { mapObj } from '$lib/worker/util'
  import { readHands, type HandData } from '$lib/handhelpers'
  import Microcontroller from '$lib/3d/Microcontroller.svelte'
  import { simpleSocketGeos } from '$lib/loaders/simpleparts'
  import GroupMatrix from '$lib/3d/GroupMatrix.svelte'
  import { simpleKeyGeo, simpleKeyPosition } from '$lib/loaders/simplekeys'
  import { Canvas, T, extend, useThrelte } from '@threlte/core'
  import KeyboardMaterial from '$lib/3d/KeyboardMaterial.svelte'
  import Gizmo from '$lib/3d/ThrelteGizmo.svelte'
  import { HTML, OrbitControls, Stars } from '@threlte/extras'
  import NewViewer from './NewViewer.svelte'
  import {
    cosmosKeyPosition,
    nthKey,
    nthPartType,
    toPosRotation,
    type CosmosKey,
    type CosmosKeyboard,
  } from '$lib/worker/config.cosmos'

  export let showSupports = false
  export let style: string = ''
  export let center: [number, number, number]
  export let size: THREE.Vector3
  export let cameraPosition: [number, number, number] = [40, -240, 100]
  export let enableRotate = true
  export let enableZoom = false
  export let is3D = false
  export let isExpert: boolean
  export let transparency: number
  export let flip = true
  export let showHand = true
  export let showFit: boolean
  export let error: ConfError | undefined
  export let geometry: Geometry | null

  export let conf: Cuttleform | undefined

  $: floorZ = geometry?.floorZ ?? 0

  function copyCanvas() {
    document.querySelector('canvas')!.toBlob(function (blob) {
      const item = new ClipboardItem({ 'image/png': blob! })
      navigator.clipboard.write([item]).then(console.log, console.error)
    })
  }

  function removeKey() {
    protoConfig.update((proto) => {
      const { key, column, cluster } = nthKey(proto, $clickedKey!)
      column.keys.splice(column.keys.indexOf(key), 1)
      // If there are no keys left in the column, delete the column too
      if (column.keys.length == 0) cluster.clusters.splice(cluster.clusters.indexOf(column), 1)
      return proto
    })
    $clickedKey = null
  }

  function addKey(dx: number, dy: number) {
    console.log('ADDINg', $clickedKey)
    protoConfig.update((proto) => {
      const { key, column, cluster } = nthKey(proto, $clickedKey!)
      const col = key.column || column.column
      if (typeof col == 'undefined') return proto
      const columnCluster = cluster.clusters.find((c) => c.column == col + dx)
      if (dx == 0)
        column.keys.splice(column.keys.indexOf(key) + (dy == 1 ? 1 : 0), 0, {
          profile: {},
          partType: {},
          position: key.position,
          rotation: key.rotation,
          row: key.row! + dy,
        })
      else if (columnCluster)
        columnCluster.keys.push({
          profile: {},
          partType: {},
          position: undefined,
          rotation: undefined,
          row: key.row,
        })
      else
        cluster.clusters.push({
          type: cluster.type,
          name: cluster.name,
          side: cluster.side,
          partType: {},
          clusters: [],
          curvature: {},
          profile: undefined,
          position: column.position,
          rotation: column.rotation,
          column: col + dx,
          keys: [
            {
              profile: {},
              partType: {},
              position: undefined,
              rotation: undefined,
              row: key.row,
            },
          ],
        })
      return proto
    })
  }

  function changeKey() {
    protoConfig.update((proto) => {
      nthKey(proto, $clickedKey!).key.partType.type = 'ec11'
      return proto
    })
  }
  function onMove(obj: Matrix4, change: boolean) {
    ;(change ? protoConfig : tempConfig).update((proto) => {
      const oldPosition = transformationCenter($clickedKey!, proto, $selectMode, true)
      obj.premultiply(oldPosition.evaluate({ flat: false }, new Trsf()).Matrix4().invert())
      const { position, rotation } = toPosRotation(obj)

      const { key, column, cluster } = nthKey(proto, $clickedKey!)
      if ($selectMode == 'key') key.position = position
      if ($selectMode == 'column') column.position = position
      if ($selectMode == 'cluster') cluster.position = position
      // key.rotation = rotation
      console.log(position, rotation)
      return proto
    })
  }

  function mid(x: (number | undefined)[]) {
    const f = x.filter((v) => typeof v !== 'undefined') as number[]
    if (!f.length) return undefined
    return (Math.max(...f) + Math.min(...f)) / 2
  }

  function transformationCenter(
    n: number,
    kbd: CosmosKeyboard,
    mode: 'key' | 'column' | 'cluster',
    zeroPosition = false
  ) {
    let { key, column, cluster } = nthKey(kbd, n)
    if (mode != 'key' || zeroPosition) key = { ...key, position: 0n, rotation: 0n } // key position is almost always zeroed
    if (mode == 'column' && zeroPosition) column = { ...column, position: 0n, rotation: 0n }
    if (mode == 'cluster' && zeroPosition) cluster = { ...cluster, position: 0n, rotation: 0n }

    if (mode == 'column')
      key = {
        ...key,
        row: mid(column.keys.map((k) => k.row)),
        column: mid(column.keys.map((k) => k.column || column.column)),
      }
    if (mode == 'cluster')
      key = {
        ...key,
        row: mid(cluster.clusters.flatMap((col) => col.keys.map((k) => k.row))),
        column: mid(cluster.clusters.flatMap((col) => col.keys.map((k) => k.column || col.column))),
      }
    return cosmosKeyPosition(key, column, cluster, kbd)
  }

  function adjacentKey(kbd: CosmosKeyboard, n: number, dx: number, dy: number) {
    const { key, column, cluster } = nthKey(kbd, n)
    const k: CosmosKey = {
      ...key,
      column: (key.column || cluster.column || column.column!) + dx,
      row: key.row! + dy,
    }
    const pos = cosmosKeyPosition(k, cluster, column, kbd).evaluate({ flat: false }, new Trsf())
    return { dx, dy, pos }
  }

  function midColumnKey(kbd: CosmosKeyboard, n: number, dx: number) {
    const { key, column, cluster } = nthKey(kbd, n)
    const startIndex = n - column.keys.indexOf(key)
    const dy = (column.keys[column.keys.length - 1].row! - column.keys[0].row!) / 2
    return adjacentKey(kbd, startIndex, dx, dy)
  }

  function adjacentPositions(
    geo: Geometry | null,
    n: number | null,
    protoConfig: CosmosKeyboard,
    mode: 'key' | 'column' | 'cluster'
  ) {
    if (n == null || !geo || mode == 'cluster') return []
    const positions = geo.keyHolesTrsfs.map((t) => t.origin())
    return (
      mode == 'key'
        ? [
            adjacentKey(protoConfig, n, 1, 0),
            adjacentKey(protoConfig, n, 0, 1),
            adjacentKey(protoConfig, n, -1, 0),
            adjacentKey(protoConfig, n, 0, -1),
          ]
        : [midColumnKey(protoConfig, n, 1), midColumnKey(protoConfig, n, -1)]
    )
      .filter((a) => !positions.some((b) => a.pos.origin().distanceTo(b) < 15))
      .map(({ dx, dy, pos }) => ({ dx, dy, pos: pos.Matrix4() }))
  }
</script>

<!-- <Viewer
  geometries={[]}
  {style}
  {center}
  {size}
  bind:cameraPosition
  {flip}
  {enableRotate}
  {enableZoom}
  enablePan={true}
  {is3D}
>
  <svelte:fragment slot="geometry">
    <SC.Group position={[-center[0], -center[1], -center[2]]}>
      {#if !$noBase}<Microcontroller {conf} {geometry} {showSupports} />{/if}
      <slot />
    </SC.Group>
  </svelte:fragment>
  <svelte:fragment slot="controls" />
</Viewer> -->

<div class="absolute top-10 left-0 right-0">
  <div class="flex flex-1 justify-around">
    <div class="flex justify-center">
      {#if $clickedKey !== null && $transformMode == 'select'}
        <button class="button" on:click|stopPropagation={changeKey}>
          <Icon size="24px" name="keycap" />
          {nthPartType($protoConfig, $clickedKey)}
        </button>
        <button class="button" on:click|stopPropagation={removeKey}>
          <Icon size="24px" path={mdi.mdiTrashCan} /> Remove
        </button>
      {/if}
    </div>
  </div>
</div>

<div class="absolute top-10 bottom-10 right-0 flex flex-col">
  <button
    class="button"
    class:selected={$transformMode == 'select'}
    on:click|stopPropagation={() => transformMode.set('select')}
    ><Icon size="24px" path={mdi.mdiCursorDefaultOutline} />q</button
  >
  <button
    class="button"
    class:selected={$transformMode == 'translate'}
    on:click|stopPropagation={() => transformMode.set('translate')}
    ><Icon path={mdi.mdiCursorMove} size="24px" />w g</button
  >
  <button
    class="button"
    class:selected={$transformMode == 'rotate'}
    on:click|stopPropagation={() => transformMode.set('rotate')}
    ><Icon path={mdi.mdiOrbitVariant} size="24px" />e r</button
  >
  <div class="my-4" />

  <button
    class="button"
    class:selected={$selectMode == 'key'}
    on:click|stopPropagation={() => selectMode.set('key')}
    ><Icon size="24px" name="keycap" />key</button
  >
  <button
    class="button"
    class:selected={$selectMode == 'column'}
    on:click|stopPropagation={() => selectMode.set('column')}
    ><Icon name="column" size="24px" />col</button
  >
  <button
    class="button"
    class:selected={$selectMode == 'cluster'}
    on:click|stopPropagation={() => selectMode.set('cluster')}
    ><Icon path={mdi.mdiKeyboard} size="24px" />clr</button
  >
</div>

<NewViewer
  geometries={[]}
  {style}
  {center}
  {size}
  bind:cameraPosition
  {flip}
  {enableRotate}
  {enableZoom}
  enablePan={true}
  {is3D}
>
  <T.Group position={[-center[0], -center[1], -center[2]]}>
    <Keyboard config={conf} {transparency} {flip} />
    {#if !$noBase}<Microcontroller {conf} {geometry} {showSupports} />{/if}
    <slot />
    {#if $transformMode == 'select'}
      {#each adjacentPositions(geometry, $clickedKey, $protoConfig, $selectMode) as adj}
        <GroupMatrix matrix={adj.pos}>
          <AddButton on:click={() => addKey(adj.dx, adj.dy)} />
        </GroupMatrix>
      {/each}
    {/if}
  </T.Group>
  <Gizmo verticalPlacement="top" horizontalPlacement="left" paddingX={50} paddingY={50} />
  <T.GridHelper args={[150, 10]} position.z={floorZ - center[2]} rotation={[-Math.PI / 2, 0, 0]} />
  {#if $clickedKey != null}
    <TransformControls
      {center}
      transformation={transformationCenter($clickedKey, $protoConfig, $selectMode)
        .evaluate({ flat: false }, new Trsf())
        .Matrix4()}
      plane={false}
      flip={false}
      on:move={(e) => onMove(e.detail, false)}
      on:change={(e) => onMove(e.detail, true)}
    />
  {/if}
</NewViewer>
{#if $debugViewport}
  <div
    class="absolute bottom-8 right-8 bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur-md rounded px-4 py-2 text-xs font-mono w-76 text-end"
  >
    <p>
      Camera Position: {new Vector3(...cameraPosition)
        .normalize()
        .toArray()
        .map((a) => Math.round(a * 100) / 100)
        .join(', ')}
    </p>
    <p><button class="inline-block!" on:click={copyCanvas}>Copy Canvas to clipboard</button></p>
  </div>
{/if}

<style>
  .button.selected {
    --at-apply: 'bg-gray-400 dark:bg-gray-700';
  }
  .button {
    z-index: 10;
    --at-apply: 'bg-gray-200 dark:bg-gray-900 p-1 pr-2 m-1 rounded text-gray-800 dark:text-gray-200 flex gap-2';
  }
  .button:not(:disabled) {
    --at-apply: 'hover:bg-gray-400 dark:hover:bg-gray-700';
  }
  .button:disabled {
    --at-apply: 'opacity-40';
  }
</style>
