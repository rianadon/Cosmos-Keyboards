<script lang="ts">
  import * as THREE from 'three'

  import Viewer from './Viewer.svelte'
  import { reinforceTriangles, flipAllTriangles } from '$lib/worker/geometry'
  import { rectangle, drawLinedWall, drawWall, fullSizes } from './viewerHelpers'

  import {
    fullEstimatedCenter,
    type Cuttleform,
    type FullCuttleform,
    type Geometry,
  } from '$lib/worker/config'
  import { isRenderable, type ConfError } from '$lib/worker/check'
  import type { FullGeometry } from './viewer3dHelpers'
  import { mapObj, objEntries, objKeys } from '$lib/worker/util'
  import { view } from '$lib/store'
  import { T } from '@threlte/core'

  export let conf: FullCuttleform
  export let geometry: FullGeometry
  export let style: string = ''
  export let confError: ConfError | undefined
  export let darkMode: boolean

  $: centers = fullEstimatedCenter(geometry, false)
  $: center = centers[$view]

  $: allGeometries =
    isRenderable(confError) && geometry
      ? drawStates(darkMode, confError, geometry)
      : ({} as ReturnType<typeof drawStates>)
  $: sizes = fullSizes(allGeometries)
  $: size = sizes[$view]

  function drawStates(darkMode: boolean, confError: ConfError | undefined, geometry: FullGeometry) {
    return mapObj(geometry as Required<typeof geometry>, (g, kbd) =>
      drawState(g!.c, darkMode, confError?.side == kbd ? confError : undefined, g!)
    )
  }

  function drawState(
    conf: Cuttleform,
    darkMode: boolean,
    confError: ConfError | undefined,
    geo: Geometry
  ) {
    const geos: { geometry: THREE.ShapeGeometry; material: THREE.Material }[] = []

    const keys = geo.keyHolesTrsfs2D
    const positions = keys.flat().map((k) => k.xyz().slice(0, 2))
    // Add key points
    geos.push(
      ...positions.map((p) => ({
        geometry: rectangle(p[0], p[1]),
        material: new THREE.MeshBasicMaterial({ color: darkMode ? 0xffffff : 0x000000 }),
      }))
    )

    const cPts = geo.allKeyCriticalPoints
    const otriangles = flipAllTriangles(geo.solveTriangularization.triangles, cPts.flat())
    const { triangles, allPts2D, boundary } = reinforceTriangles(conf, geo, otriangles, cPts)
    // const allPts2D = geo.allKeyCriticalPoints2D.flat()
    // const { triangles, boundary } = geo.solveTriangularization
    const allProj = allPts2D.map((p) => p.xy())
    // Add key critical points
    geos.push(
      ...allProj.map((p) => ({
        geometry: rectangle(p[0], p[1], 0.7),
        material: new THREE.MeshBasicMaterial({ color: darkMode ? 0xff9966 : 0xff3333 }),
      }))
    )

    // const pts3D = geo.allKeyCriticalPoints
    // const { triangles, boundary } = geo.solveTriangularization
    // console.log('B', triangles, boundary, pts.map(p => p[0].xyz()), pts3D.map(p => p[0].xyz()))

    geos.push(
      ...triangles.flatMap(([a, b, c]) => [
        {
          geometry: drawWall([allProj[a], allProj[b], allProj[c]]),
          material: new THREE.MeshBasicMaterial({
            color: 0xffcc33,
            transparent: true,
            opacity: 0.2,
          }),
        },
        {
          geometry: drawLinedWall([allProj[a], allProj[b], allProj[c]]),
          material: new THREE.MeshBasicMaterial({ color: 0xffcc33 }),
        },
      ])
    )

    geos.push({
      geometry: drawLinedWall(boundary.map((p) => allProj[p])),
      material: new THREE.MeshBasicMaterial({ color: darkMode ? 0x6699ff : 0x3333ff }),
    })

    if (confError?.type == 'intersection') {
      const pts = geo.allKeyCriticalPoints2D
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
    }
    if (confError?.type == 'wallBounds') {
      const pts = geo.allKeyCriticalPoints2D
      if (confError.i >= 0)
        geos.push({
          geometry: drawLinedWall(
            pts[confError.i].map((p) => p.xy()),
            0.5
          ),
          material: new THREE.MeshBasicMaterial({ color: 0xff0000 }),
        })
    }
    return geos
  }
</script>

<Viewer {size} {style} cameraPosition={[0, 0, 1]} enableRotate={false}>
  <T.Group>
    {#each objEntries(allGeometries) as [kbd, geos] (kbd)}
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
{#if !conf}
  <div class="bg-red-200 m-4 rounded p-4 dark:bg-red-700">
    Key layout will not be available until the configuration is evaluated.
  </div>
{/if}
