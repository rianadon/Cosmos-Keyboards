<script lang="ts">
  import * as THREE from 'three'

  import Viewer from './Viewer.svelte'
  import { estimatedCenter } from '$lib/worker/geometry'
  import { rectangle, drawLinedWall, drawWall } from './viewerHelpers'
  import { boundingSize } from '$lib/loaders/geometry'

  import type { Cuttleform, Geometry } from '$lib/worker/config'
  import type { ConfError } from '$lib/worker/check'
  import { flip } from '$lib/store'

  export let conf: Cuttleform
  export let geometry: Geometry
  export let style: string = ''
  export let confError: ConfError | undefined
  export let darkMode: boolean

  let center: [number, number, number] = [0, 0, 0]

  $: geometries =
    (!confError || confError.type == 'intersection') && geometry
      ? drawState(conf, darkMode, confError, geometry)
      : []
  $: size = boundingSize(geometries.map((g) => g.geometry))

  function drawState(
    conf: Cuttleform,
    darkMode: boolean,
    confError: ConfError | undefined,
    geo: Geometry
  ) {
    const geos: { geometry: THREE.ShapeGeometry; material: THREE.Material }[] = []

    const config = conf

    const keys = geo.keyHolesTrsfs2D
    center = estimatedCenter(geo)

    const positions = keys.flat().map((k) => k.xyz().slice(0, 2))
    geos.push(
      ...positions.map((p) => ({
        geometry: rectangle(p[0], p[1]),
        material: new THREE.MeshBasicMaterial({ color: darkMode ? 0xffffff : 0x000000 }),
      }))
    )

    const pts = geo.allKeyCriticalPoints2D
    const allProj = pts.flat().map((p) => p.xy())

    geos.push(
      ...allProj.map((p) => ({
        geometry: rectangle(p[0], p[1], 0.7),
        material: new THREE.MeshBasicMaterial({ color: darkMode ? 0xff9966 : 0xff3333 }),
      }))
    )

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

    // const pts3D = geo.allKeyCriticalPoints
    const { triangles, boundary } = geo.solveTriangularization
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
