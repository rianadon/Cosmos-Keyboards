<script lang="ts">
  import * as THREE from 'three'

  import Viewer from './Viewer.svelte'
  import {
    allKeyCriticalPoints,
    estimatedCenter,
    solveTriangularization,
  } from '$lib/worker/geometry'
  import { rectangle, drawLinedWall, drawWall } from './viewerHelpers'
  import { boundingSize } from '$lib/loaders/geometry'

  import type { Cuttleform } from '$lib/worker/config'
  import type { ConfError } from '$lib/worker/check'
  import type { Geometry } from '$lib/worker/cachedGeometry'
  import { flip } from '$lib/store'

  export let conf: Cuttleform
  export let geometry: Geometry
  export let style: string = ''
  export let confError: ConfError
  export let darkMode: boolean

  let center: [number, number, number] = [0, 0, 0]

  $: geometries =
    (!confError || confError.type == 'intersection') && geometry
      ? drawState(conf, darkMode, confError, geometry)
      : []
  $: size = boundingSize(geometries.map((g) => g.geometry))

  function drawState(conf: Cuttleform, darkMode: boolean, confError: ConfError, geo: Geometry) {
    const geos: { geometry: THREE.ShapeGeometry; material: THREE.Material }[] = []

    const config = conf

    const keys = geo.keyHolesTrsfs2D.map((t) => {
      return t.pretranslated(0, 0, -18)
    })
    center = estimatedCenter(geo)

    const positions = keys.flat().map((k) => k.xyz().slice(0, 2))
    geos.push(
      ...positions.map((p) => ({
        geometry: rectangle(p[0], p[1]),
        material: new THREE.MeshBasicMaterial({ color: darkMode ? 0xffffff : 0x000000 }),
      }))
    )

    // const pts = geo.allKeyCriticalPoints2D
    // const allProj = pts.flat().map(p => p.xy())

    const height = 5
    const c = config
    const pts2DC = allKeyCriticalPoints(
      c,
      geo.keyHolesTrsfs2D.map((t) => {
        return t.pretranslated(0, 0, -18)
      })
    )
    console.log(pts2DC)

    const topPts = allKeyCriticalPoints(
      c,
      geo.keyHolesTrsfs.map((t) => {
        return t.pretranslated(0, 0, -18)
      })
    ).flat()
    const botCPts = allKeyCriticalPoints(
      c,
      geo.keyHolesTrsfs.map((t) => {
        return t.pretranslated(0, 0, -18 - height)
      })
    )
    const allProj = topPts.map((p) => p.xy())

    const { boundary: formerBoundary } = geo.solveTriangularization
    let { triangles, boundary, allPts } = solveTriangularization(
      c,
      pts2DC,
      geo.allKeyCriticalPoints,
      geo.keyHolesTrsfs,
      {
        noBadWalls: true,
        constrainKeys: false,
        noKeyTriangles: false,
        boundary: formerBoundary,
      }
    )

    geos.push(
      ...allProj.map((p) => ({
        geometry: rectangle(p[0], p[1], 0.7),
        material: new THREE.MeshBasicMaterial({ color: darkMode ? 0xff9966 : 0xff3333 }),
      }))
    )

    if (confError?.type == 'intersection') {
      return geos
    }

    // const pts3D = geo.allKeyCriticalPoints
    // console.log('B', triangles, boundary, pts.map(p => p[0].xyz()), pts3D.map(p => p[0].xyz()))

    geos.push(
      ...triangles.flatMap(([a, b, c]) => [
        {
          geometry: drawWall([allPts[a], allPts[b], allPts[c]]),
          material: new THREE.MeshBasicMaterial({
            color: 0xffcc33,
            transparent: true,
            opacity: 0.2,
          }),
        },
        {
          geometry: drawLinedWall([allPts[a], allPts[b], allPts[c]]),
          material: new THREE.MeshBasicMaterial({ color: 0xffcc33 }),
        },
      ])
    )

    geos.push({
      geometry: drawLinedWall(boundary.map((p) => allPts[p])),
      material: new THREE.MeshBasicMaterial({ color: darkMode ? 0x6699ff : 0x3333ff }),
    })

    // for (let i = 0; i < formerBoundary.length; i++) {
    //     geos.push({
    //         geometry: drawLinedWall([allProj[formerBoundary[i]], allProj[formerBoundary[(i + 1) % formerBoundary.length]]]),
    //         material: new THREE.MeshBasicMaterial({ color: 0x0000ff })
    //     })
    // }

    return geos
  }
</script>

<Viewer
  {geometries}
  {center}
  {size}
  {style}
  cameraPosition={[0, 0, 1]}
  enableRotate={false}
  flip={$flip}
/>
{#if !conf}
  <div class="bg-red-200 m-4 rounded p-4 dark:bg-red-700">
    Key layout will not be available until the configuration is evaluated.
  </div>
{/if}
