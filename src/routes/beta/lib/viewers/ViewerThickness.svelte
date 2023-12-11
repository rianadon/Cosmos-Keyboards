<script lang="ts">
  import {
    BufferAttribute,
    BufferGeometry,
    DoubleSide,
    Group,
    Mesh,
    MeshBasicMaterial,
    Vector3,
  } from 'three'
  import * as SC from 'svelte-cubed'
  import type { Cuttleform, Geometry } from '$lib/worker/config'
  import Viewer from './Viewer.svelte'
  import { allKeyCriticalPoints, webThickness } from '$lib/worker/geometry'
  import { thickness } from '$lib/worker/thickness'

  export let style: string = ''
  export let center: [number, number, number]
  export let size: THREE.Vector3
  export let cameraPosition: [number, number, number] = [0, 0.8, 1]
  export let enableRotate = true
  export let enableZoom = false
  export let is3D = false
  export let flip = true

  export let conf: Cuttleform
  export let geometry: Geometry

  let pressedLetter: string | null = null

  function webMesh(c: Cuttleform, geo: Geometry) {
    if (!conf) return { group: null, minThickness: 0, maxThickness: 0, thicknessRange: 0 }

    const topCPts = geo.allKeyCriticalPoints
    const botCPts = allKeyCriticalPoints(
      c,
      geo.keyHolesTrsfs.map((t, i) => {
        return t.pretranslated(0, 0, -webThickness(c, c.keys[i]))
      })
    )
    const topPts = topCPts.flat()
    const botPts = botCPts.flat()

    const { triangles, boundary } = geo.solveTriangularization
    const topGeo = new Float32Array(triangles.length * 9)
    const botGeo = new Float32Array(triangles.length * 9)
    const thicknesses: number[] = []
    const colors = new Float32Array(triangles.length * 9)

    triangles.forEach((triangle, i) => {
      const pta = topPts[triangle[0]].origin()
      const ptb = topPts[triangle[1]].origin()
      const ptc = topPts[triangle[2]].origin()
      topGeo.set(pta.xyz(), i * 9)
      topGeo.set(ptb.xyz(), i * 9 + 3)
      topGeo.set(ptc.xyz(), i * 9 + 6)
      const pba = botPts[triangle[0]].origin()
      const pbb = botPts[triangle[1]].origin()
      const pbc = botPts[triangle[2]].origin()
      botGeo.set(pbc.xyz(), i * 9)
      botGeo.set(pbb.xyz(), i * 9 + 3)
      botGeo.set(pba.xyz(), i * 9 + 6)
      thicknesses.push(thickness(pta, ptb, ptc, pba, pbb, pbc))
    })

    const minThickness = Math.min(...thicknesses)
    const maxThickness = Math.max(...thicknesses)
    const thicknessRange = maxThickness - minThickness

    thicknesses.forEach((t, i) => {
      const scaled = (t - minThickness) / thicknessRange
      const color = new Vector3(1, 0.15, 0.15).lerp(new Vector3(0.15, 0.39, 1), scaled)
      colors.set(color.toArray(), i * 9)
      colors.set(color.toArray(), i * 9 + 3)
      colors.set(color.toArray(), i * 9 + 6)
    })

    const topMesh = new Mesh()
    topMesh.geometry = new BufferGeometry()
    topMesh.geometry.setAttribute('position', new BufferAttribute(topGeo, 3))
    topMesh.geometry.setAttribute('color', new BufferAttribute(colors, 3))
    topMesh.material = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide })

    const botMesh = new Mesh()
    botMesh.geometry = new BufferGeometry()
    botMesh.geometry.setAttribute('position', new BufferAttribute(botGeo, 3))
    botMesh.geometry.setAttribute('color', new BufferAttribute(colors, 3))
    botMesh.material = new MeshBasicMaterial({ vertexColors: true })

    const group = new Group()
    group.add(topMesh)
    group.add(botMesh)
    return { group, minThickness, maxThickness, thicknessRange }
  }

  $: meshResult = webMesh(conf, geometry)
</script>

<div class="absolute top-12 left-8 right-8 flex justify-end">
  <div class="flex gap-2">
    <div class="w-4 h-16 bg-gradient-to-t from-[#FF2626] to-[#2563FF]" />
    <div class="relative w-8">
      <div class="absolute top-[-0.3em]">{meshResult.maxThickness.toFixed(1)}&nbsp;mm</div>
      <div class="absolute top-[calc(50%-0.75em)]">
        {(meshResult.minThickness + meshResult.thicknessRange / 2).toFixed(1)}&nbsp;mm
      </div>
      <div class="absolute bottom-[-0.3em]">{meshResult.minThickness.toFixed(1)}&nbsp;mm</div>
    </div>
  </div>
</div>
<Viewer
  geometries={[]}
  {style}
  {center}
  {size}
  {cameraPosition}
  {flip}
  {enableRotate}
  {enableZoom}
  enablePan={true}
  {is3D}
>
  <svelte:fragment slot="geometry">
    <SC.Group position={[-center[0], -center[1], -center[2]]}>
      {#if meshResult.group}
        <SC.Primitive object={meshResult.group} />
      {/if}
      <slot />
    </SC.Group>
  </svelte:fragment>
  <svelte:fragment slot="controls" />
</Viewer>
