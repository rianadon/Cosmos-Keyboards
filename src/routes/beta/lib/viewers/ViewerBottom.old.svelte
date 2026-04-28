<script lang="ts">
  // @ts-nocheck unused file
  import * as THREE from 'three'

  import Viewer from './Viewer.svelte'
  import DarkTheme from '../DarkTheme.svelte'
  import {
    allKeyCriticalPoints,
    allWallCriticalPoints,
    estimatedCenter,
    keyHolesTrsfs,
    offsetBisector,
    wallBezier,
  } from '$lib/worker/geometry'
  import { rectangle, drawLinedWall, drawBezier } from './viewer2d'

  import loadOC, { type OpenCascadeInstance } from '$assets/replicad_single'
  import wasmUrl from '$assets/replicad_single.wasm?url'
  import { setOC } from 'replicad'
  import { cuttleConf, type Manuform } from '$lib/worker/config'
  import Trsf from '$lib/worker/transfoccmation'
  import { boundingSize } from '../geometry'

  export let state: any
  export let style: string = ''

  interface Geo {
    geometry: THREE.ShapeGeometry
    material: THREE.Material
  }

  let oc: OpenCascadeInstance
  let darkMode: boolean

  let center: [number, number, number] = [0, 0, 0]

  // @ts-ignore
  $: loadOC({
    locateFile: () => wasmUrl,
  }).then((o) => (oc = o))

  $: if (oc) setOC(oc)
  $: geometries = oc ? drawState(state) : []
  $: size = boundingSize(geometries.map((g) => g.geometry))

  function makeTangent(pt: Trsf, prev: Trsf, next: Trsf, magnitude: number) {
    const z = pt.axis(0, 0, 1)
    console.log(prev.xyz(), pt.xyz(), next.xyz())
    const normal = new Trsf().translate(1, 0, 0).preMultiply(offsetBisector(prev, pt, next, 1, z))
    console.log(normal.xyz())

    const tan = pt.originVec()
    tan.Subtract(normal.originVec())
    tan.Cross(z)
    tan.Normalize()
    tan.Multiply(magnitude)
    return pt.translated(tan)
  }

  function drawState(state: { options: Manuform }): Geo[] {
    const config = cuttleConf(state.options)

    const geo: Geo[] = []
    const keys = keyHolesTrsfs(config)
    const positions = keys.flat().map((k) => k.xyz())

    geo.push(
      ...positions.map((p) => ({
        geometry: rectangle(p[0], p[1]),
        material: new THREE.MeshBasicMaterial({ color: darkMode ? 0xffffff : 0x000000 }),
      }))
    )

    const pts = allKeyCriticalPoints(config, keys)
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

    const walls2 = allWallCriticalPoints(config, pts, true)
    geo.push({
      geometry: drawLinedWall(walls2.map((w) => w.mi.xy())),
      material: new THREE.MeshBasicMaterial({ color: 0x33dd33 }),
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

    geo.push(
      ...walls2.flatMap((w, i) => {
        const next = walls2[(i + 1) % walls2.length]
        const nnext = walls2[(i + 2) % walls2.length]
        const prev = walls2[(i - 1 + walls2.length) % walls2.length]
        return [
          {
            geometry: drawBezier(...wallBezier(prev.bo, w.bo, next.bo, nnext.bo)),
            material: new THREE.MeshBasicMaterial({ color: 0xeedd33 }),
          },
        ]
      })
    )

    center = estimatedCenter(keys.flat())
    return geo
  }
</script>

<DarkTheme bind:darkMode />
<Viewer {geometries} {center} {size} {style} cameraPosition={[0, 0, 1]} enableRotate={false} />
