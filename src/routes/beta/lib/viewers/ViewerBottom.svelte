<script lang="ts">
  import * as THREE from 'three'

  import Viewer from './Viewer.svelte'
  import {
    allScrewIndices,
    keyHolesTrsfs,
    possibleScrewIndices,
    screwOrigin,
  } from '$lib/worker/geometry'
  import { rectangle, drawWall, drawLinedWall, drawBezierWall, fullSizes } from './viewerHelpers'
  import { localHolderBounds } from '$lib/geometry/microcontrollers'

  import { isRenderable, type ConfError } from '$lib/worker/check'
  import Trsf from '$lib/worker/modeling/transformation'
  import { fullEstimatedCenter, type Cuttleform, type Geometry } from '$lib/worker/config'
  import { Vector } from '$lib/worker/modeling/transformation'
  import { CanvasTexture, Color, NearestFilter } from 'three'
  import { view } from '$lib/store'
  import { mapObj, objEntries } from '$lib/worker/util'
  import type { FullGeometry } from './viewer3dHelpers'
  import { T } from '@threlte/core'

  export let geometry: FullGeometry | null
  export let confError: ConfError | undefined
  export let style: string = ''
  export let darkMode: boolean

  interface Geo {
    geometry: THREE.BufferGeometry
    material: THREE.Material
  }

  $: centers = fullEstimatedCenter(geometry ?? undefined, false)
  $: center = centers[$view]

  $: hasError = confError && !isRenderable(confError)
  $: allGeometries =
    isRenderable(confError) && geometry ? drawStates(geometry) : ({} as ReturnType<typeof drawStates>)
  $: sizes = fullSizes(allGeometries)
  $: size = sizes[$view]

  function drawStates(geometry: FullGeometry) {
    return mapObj(geometry as Required<typeof geometry>, (g) => drawState(g!.c, g!))
  }

  function drawState(config: Cuttleform, geo: Geometry): Geo[] {
    const geos: Geo[] = []
    const keys = keyHolesTrsfs(config, new Trsf())
    const positions = keys.flat().map((k) => k.xyz())

    geos.push(
      ...positions.map((p) => ({
        geometry: rectangle(p[0], p[1]),
        material: new THREE.MeshBasicMaterial({
          color: darkMode ? 0xffffff : 0x000000,
          side: THREE.DoubleSide,
        }),
      }))
    )
    console.log('hello')

    const pts = geo.allKeyCriticalPoints
    const walls2 = geo.allWallCriticalPoints()
    // const walls = allWallCriticalPoints(config, pts, false)
    //
    // geo.push(...walls.map(w => ({
    //     geometry: rectangle(w.bi.xyz()[0], w.bi.xyz()[1], 0.5),
    //     material: new THREE.MeshBasicMaterial({ color: 0xff3333})
    // })))
    // geo.push({
    //     geometry: drawLinedWall(walls.map(w => w.mi.xy())),
    //     material: new THREE.MeshBasicMaterial({ color: 0xeeaa00 })
    // })
    // geo.push({
    //     geometry: drawLinedWall(walls.map(w => w.mo.xy())),
    //     material: new THREE.MeshBasicMaterial({ color: 0x3333ff })
    // })

    // const innerSurfaces = geo.allWallCriticalPoints().map(w => wallSurfacesInner(config, w))
    // const connOrigin = originForConnector(config, geo.allWallCriticalPoints(), innerSurfaces, geo.connectorIndex)

    geos.push({
      geometry: config.rounded.side
        ? drawBezierWall(
            config,
            walls2.map((w) => w.bi),
            walls2,
            geo.worldZ,
            geo.bottomZ
          )
        : drawLinedWall(walls2.map((w) => w.bi.xy())),
      material: new THREE.MeshBasicMaterial({ color: 0xeedd33 }),
    })
    // geo.push({
    //     geometry: drawLinedWall(walls2.map(w => w.mo.xy())),
    //     material: new THREE.MeshBasicMaterial({ color: 0xff3333 })
    // })

    // geo.push(...walls2.flatMap((w, i) => {
    //     const next = walls2[(i + 1) % walls2.length]
    //     const prev = walls2[(i - 1 + walls2.length) % walls2.length]
    //     return [{
    //         geometry: drawLinedWall([w.bo.xy(), makeTangent(w.bo, prev.bo, next.bo, 5).xy()]),
    //         material: new THREE.MeshBasicMaterial({ color: i == 0 ? 0x00ff00 : (i == 1 ? 0x0000ff : 0xeedd33) })
    //     },{
    //         geometry: drawLinedWall([w.bo.xy(), makeTangent(w.bo, prev.bo, next.bo, -5).xy()]),
    //         material: new THREE.MeshBasicMaterial({ color: 0xeeaa33 })
    //     }]
    // }))

    geos.push({
      geometry: config.rounded.side
        ? drawBezierWall(
            config,
            walls2.map((w) => w.bo),
            walls2,
            geo.worldZ,
            geo.bottomZ
          )
        : drawLinedWall(walls2.map((w) => w.bo.xy())),
      material: new THREE.MeshBasicMaterial({ color: 0xeedd33 }),
    })

    // geos.push(
    //   ...walls2.map((w) => ({
    //     geometry: rectangle(...w.bo.xy(), 0.3),
    //     material: new THREE.MeshBasicMaterial({ color: 0x000000 }),
    //   })),
    //   ...walls2.map((w) => ({
    //     geometry: rectangle(...w.bi.xy(), 0.3),
    //     material: new THREE.MeshBasicMaterial({ color: 0x000000 }),
    //   }))
    // )

    if (config.microcontroller && geo.connectorOrigin) {
      const connOrigin = geo.connectorOrigin

      const hBnd = localHolderBounds(config, false)
      const holderPts: [number, number][] = [
        new Vector(hBnd.minx, hBnd.miny, 0),
        new Vector(hBnd.minx, hBnd.maxy, 0),
        new Vector(hBnd.maxx, hBnd.maxy, 0),
        new Vector(hBnd.maxx, hBnd.miny, 0),
      ]
        .map((p) => connOrigin.apply(p))
        .map((p) => [p.x, p.y])

      geos.push({
        // geometry: drawLinedRectangle(hBnd.minx, hBnd.miny, hBnd.maxx - hBnd.minx, hBnd.maxy - hBnd.miny).applyMatrix4(connMatrix),
        geometry: drawLinedWall(holderPts),
        material: new THREE.MeshBasicMaterial({ color: 0x33dd33 }),
      })
      geos.push({
        // geometry: drawRectangle(hBnd.minx, hBnd.miny, hBnd.maxx - hBnd.minx, hBnd.maxy - hBnd.miny).applyMatrix4(connMatrix),
        geometry: drawWall(holderPts),
        material: new THREE.MeshBasicMaterial({ color: 0x33dd33, transparent: true, opacity: 0.2 }),
      })
    }

    const boardInd = geo.boardIndices
    const initialPos = [
      ...geo.boardIndicesThatAreScrewsToo.map((b) => boardInd[b]),
      ...config.screwIndices,
    ].filter((i) => i != -1)
    const allScrewInd = [
      ...allScrewIndices(
        config,
        walls2,
        geo.connectorOrigin,
        boardInd,
        initialPos,
        geo.worldZ,
        config.shell.type === 'stilts' ? -100 : geo.bottomZ
      ),
    ]
    const indices = new Set(possibleScrewIndices(geo.c, walls2))
    const screwInd = geo.screwIndices
    screwInd.forEach((i) => indices.add(i))
    allScrewInd.forEach((i) => indices.add(i))
    Object.values(boardInd).forEach((i) => indices.add(i))

    for (const i of indices) {
      let size = 1.5
      let color: number | number[] = 0xff0000

      if (Object.values(boardInd).includes(i) && config.microcontroller) {
        size = 3
        color = screwInd.includes(i) ? [0x33dd33, 0x0000ff] : 0x33dd33
      } else if (screwInd.includes(i)) {
        size = 3
        color = 0x0000ff
      } else if (allScrewInd.includes(i)) {
        color = 0xaaaaaa
      }

      const pos = screwOrigin(config, i, walls2)

      geos.push({
        geometry: new THREE.CircleGeometry(size, 32).translate(...pos.xy(), 0),
        material: new THREE.MeshBasicMaterial({ color: color as number }),
      })
      if (Array.isArray(color)) {
        const canvas = document.createElement('canvas')
        canvas.width = 2
        canvas.height = 2
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#' + new Color(color[0]).getHexString()
        ctx.fillRect(0, 0, 1, 2)
        ctx.fillStyle = '#' + new Color(color[1]).getHexString()
        ctx.fillRect(1, 0, 1, 2)
        const tex = new CanvasTexture(canvas)
        tex.magFilter = NearestFilter
        tex.minFilter = NearestFilter
        /* @ts-ignore */
        geos[geos.length - 1].material.map = tex
      }
    }

    geos.push({
      geometry: new THREE.CircleGeometry(2, 32).translate(...geo.plateArtOrigin.xy(), 0),
      material: new THREE.MeshBasicMaterial({ color: 0xff99cc }),
    })

    console.log('FEET', geo.footPositions)
    for (const pos of geo.footPositions) {
      geos.push({
        geometry: new THREE.CircleGeometry(2, 32).translate(...pos.xy(), 0),
        material: new THREE.MeshBasicMaterial({ color: 0xff99cc }),
      })
    }

    // const wristRestGeo = wristRestGeometry(conf, geo)
    // geos.push({
    //     geometry: rectangle(...wristRestGeo.left.xy()),
    //     material: new THREE.MeshBasicMaterial({ color: 0x33dd33, side: THREE.DoubleSide })
    // })
    // geos.push({
    //     geometry: rectangle(...wristRestGeo.right.xy()),
    //     material: new THREE.MeshBasicMaterial({ color: 0x33dd33, side: THREE.DoubleSide })
    // })
    // console.log(wristRestGeo.intermediatePoints)
    // geos.push(...wristRestGeo.intermediatePoints.map(p => ({
    //     geometry: rectangle(...p.xy()),
    //     material: new THREE.MeshBasicMaterial({ color: 0x33aa33, side: THREE.DoubleSide })
    // })))
    return geos
  }
</script>

<div class="absolute top-12 left-8 right-8 flex justify-between z-10">
  <table>
    <tr><td class="w-8"><div class="rounded-full bg-[#0000ff] w-4 h-4 mx-auto" /></td><td>Screw</td></tr>
    <tr
      ><td class="w-8"><div class="rounded-full bg-[#33dd33] w-4 h-4 mx-auto" /></td><td
        >Board Holder Screw</td
      ></tr
    >
  </table>
  <table>
    <tr
      ><td class="w-8"><div class="rounded-full bg-[#aaaaaa] w-2 h-2 mx-auto" /></td><td
        >Possible Screw Location</td
      ></tr
    >
    <tr
      ><td class="w-8"><div class="rounded-full bg-[#ff0000] w-2 h-2 mx-auto" /></td><td
        >Impossible Screw Location</td
      ></tr
    >
    <tr
      ><td /><td class="text-sm opacity-70 relative top-[-0.2em] leading-none"
        >Increase Vertical Part Clearance</td
      ></tr
    >
  </table>
</div>
<div class="relative w-full h-full mt-2">
  {#if hasError}
    <div class="bg-red-200 m-4 mt-24 rounded p-4 dark:bg-red-700">
      <div>Please fix the errors with your configuration first before using this viewer.</div>
    </div>
  {/if}
  <Viewer {size} {style} cameraPosition={[0, 0, 1]} enableRotate={false}>
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
  </Viewer>
</div>
