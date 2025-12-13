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
  import { isRenderable, type ConfErrors } from '$lib/worker/check'
  import { keyLine } from '../matrixLayout'
  import { view } from '$lib/store'
  import type { FullGeometry } from './viewer3dHelpers'
  import { mapObj, objEntries } from '$lib/worker/util'
  import { T } from '@threlte/core'

  export let geometry: FullGeometry
  export let style: string = ''
  export let confError: ConfErrors
  export let darkMode: boolean

  $: centers = fullEstimatedCenter(geometry, false)
  $: center = centers[$view]

  $: allGeometries =
    isRenderable(confError) && geometry
      ? drawStates(darkMode, confError, geometry)
      : ({} as ReturnType<typeof drawStates>)
  $: sizes = fullSizes(mapObj(allGeometries, (l) => l.map((g) => g.geometry)))
  $: size = sizes[$view]

  function drawStates(darkMode: boolean, confErrors: ConfErrors, geometry: FullGeometry) {
    return mapObj(geometry as Required<typeof geometry>, (g, kbd) =>
      drawState(
        g.c,
        darkMode,
        confErrors.filter((e) => e.side == kbd),
        g
      )
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

  /** Computes matrix and renders Three.js geometry for displaying it and the keys. */
  function drawState(conf: Cuttleform, darkMode: boolean, confErrors: ConfErrors, geo: Geometry) {
    // How to use the optimizer
    // const { matRow, matCol } = findMatrix(conf)

    // All the computation happens in these 3 lines.
    const clusters = splitByCluster(conf)
    const matCol = clusters.flatMap((c) => keyLine(c, 'col'))
    const matRow = clusters.flatMap((c) => keyLine(c, 'row'))

    const geos: { geometry: THREE.ShapeGeometry; material: THREE.Material }[] = []

    const keys = geo.keyHolesTrsfs2D

    const positions = keys.flat().map((k) => k.xyz().slice(0, 2))
    geos.push(
      ...positions.map((p) => ({
        geometry: rectangle(p[0], p[1]),
        material: new THREE.MeshBasicMaterial({ color: darkMode ? 0xffffff : 0x000000 }),
      }))
    )

    const pts = geo.allKeyCriticalPoints2D
    // const allProj = pts.flat().map(p => p.xy())

    geos.push(
      ...pts.map((p) => ({
        geometry: drawWall(p.map((p) => p.xy())),
        material: new THREE.MeshBasicMaterial({ color: 0xffcc33, transparent: true, opacity: 0.1 }),
      }))
    )
    geos.push(
      ...pts.map((p) => ({
        geometry: drawLinedWall(p.map((p) => p.xy())),
        material: new THREE.MeshBasicMaterial({ color: 0xffcc33 }),
      }))
    )

    geos.push(
      ...matRow.map((row) => ({
        geometry: drawPath(
          row.map((k) => k.origin.xy()),
          1
        ),
        material: new THREE.MeshBasicMaterial({ color: 0x3333ff }),
      }))
    )
    geos.push(
      ...matCol.map((column) => ({
        geometry: drawPath(
          column.map((k) => k.origin.xy()),
          1
        ),
        material: new THREE.MeshBasicMaterial({ color: 0xff3333 }),
      }))
    )

    // for (const confError of confErrors) {
    //   if (confError?.type == 'intersection') {
    //     console.log(pts.map((po) => po.map((p) => p.xyz())))
    //     geos.push(
    //       ...pts.map((po) => ({
    //         geometry: drawLinedWall(po.map((p) => p.xy())),
    //         material: new THREE.MeshBasicMaterial({ color: 0xffcc33 }),
    //       }))
    //     )
    //     if (confError.i >= 0)
    //       geos.push({
    //         geometry: drawLinedWall(
    //           pts[confError.i].map((p) => p.xy()),
    //           0.5
    //         ),
    //         material: new THREE.MeshBasicMaterial({ color: 0xff0000 }),
    //       })
    //     if (confError.j >= 0)
    //       geos.push({
    //         geometry: drawLinedWall(
    //           pts[confError.j].map((p) => p.xy()),
    //           0.5
    //         ),
    //         material: new THREE.MeshBasicMaterial({ color: 0xff0000 }),
    //       })
    //     return geos
    //   }
    // }

    return geos
  }
</script>

<Viewer {size} {style} cameraPosition={[0, 0, 1]} enableRotate={false}>
  <T.Group scale.x={-1}>
    {#each objEntries(allGeometries) as [kbd, geos]}
      {@const cent = center[kbd]}
      {#if cent}
        {#each geos as geometry}
          <T.Group position={[-cent[0], -cent[1], -cent[2]]} scale.x={kbd == 'left' ? -1 : 1}>
            <T.Mesh geometry={geometry.geometry} material={geometry.material} />
          </T.Group>
        {/each}
      {/if}
    {/each}
  </T.Group>
</Viewer>
<div class="absolute inset-1/2">
  <div
    class="rounded text-center flex items-center justify-center w-48 h-16 absolute ml-[-6rem] mt-[-4rem] bg-white dark:bg-gray-800"
  >
    Wiring will improve<br />in the future!
  </div>
</div>
