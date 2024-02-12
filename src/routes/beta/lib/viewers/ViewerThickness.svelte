<script lang="ts">
  import {
    BufferAttribute,
    BufferGeometry,
    DoubleSide,
    Group,
    Mesh,
    MeshBasicMaterial,
    Vector3,
    Color,
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
  export let darkMode: boolean

  export let conf: Cuttleform
  export let geometry: Geometry

  let pressedLetter: string | null = null

  const hue = (t: number) => Math.min(Math.max(0, t - 1) / 4, 1) * 240

  function eqIndices<T>(x: T[], e: T): number[] {
    const ind: number[] = []
    x.forEach((a, i) => {
      if (a == e) ind.push(i)
    })
    return ind
  }

  function webMesh(c: Cuttleform, geo: Geometry, darkMode: boolean) {
    if (!conf) return { group: null, minThickness: 0, maxThickness: 0, thicknessRange: 0 }

    const { topReinf, botReinf } = geo.reinforcedTriangles()

    const topGeo = new Float32Array(topReinf.triangles.length * 9)
    const botGeo = new Float32Array(botReinf.triangles.length * 9)
    const thicknesses: number[] = []
    const colors = new Float32Array(topGeo.length + botGeo.length)
    const nTri = geo.solveTriangularization.triangles.length

    topReinf.triangles.forEach((triangle, i) => {
      const pta = topReinf.allPts[triangle[0]].origin()
      const ptb = topReinf.allPts[triangle[1]].origin()
      const ptc = topReinf.allPts[triangle[2]].origin()
      topGeo.set(pta.xyz(), i * 9)
      topGeo.set(ptb.xyz(), i * 9 + 3)
      topGeo.set(ptc.xyz(), i * 9 + 6)
      let th = topReinf.thickness[i].thickness
      if (th < 0) {
        const eq = eqIndices(topReinf.thickness, topReinf.thickness[i])
          .filter((i) => i < nTri)
          .find((i) => botReinf.thickness[i].thickness >= 0)
        if (typeof eq != 'undefined') th = botReinf.thickness[eq]?.thickness
      }
      thicknesses.push(th)
    })

    botReinf.triangles.forEach((triangle, i) => {
      const pba = botReinf.allPts[triangle[0]].origin()
      const pbb = botReinf.allPts[triangle[1]].origin()
      const pbc = botReinf.allPts[triangle[2]].origin()
      botGeo.set(pbc.xyz(), i * 9)
      botGeo.set(pbb.xyz(), i * 9 + 3)
      botGeo.set(pba.xyz(), i * 9 + 6)
      let th = botReinf.thickness[i].thickness
      if (th < 0) {
        const eq = eqIndices(botReinf.thickness, botReinf.thickness[i])
          .filter((i) => i < nTri)
          .find((i) => topReinf.thickness[i].thickness >= 0)
        if (typeof eq != 'undefined') th = topReinf.thickness[eq]?.thickness
      }
      thicknesses.push(th)
    })

    const posThickness = thicknesses.filter((t) => t >= 0)
    const minThickness = Math.min(...posThickness)
    const maxThickness = Math.max(...posThickness)
    const thicknessRange = maxThickness - minThickness

    thicknesses.forEach((t, i) => {
      let color: number[]
      if (t < 0) {
        color = darkMode ? [31 / 255, 41 / 255, 55 / 255] : [226 / 255, 232 / 255, 240 / 255]
      } else {
        color = new Color().setHSL(hue(t) / 360, 1, 0.5).toArray()
        // color = new Vector3(1, 0.15, 0.15).lerp(new Vector3(0.15, 0.39, 1), scaled).toArray()
      }
      colors.set(color, i * 9)
      colors.set(color, i * 9 + 3)
      colors.set(color, i * 9 + 6)
    })

    const topMesh = new Mesh()
    topMesh.geometry = new BufferGeometry()
    topMesh.geometry.setAttribute('position', new BufferAttribute(topGeo, 3))
    topMesh.geometry.setAttribute('color', new BufferAttribute(colors.slice(0, topGeo.length), 3))
    topMesh.material = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide })

    const botMesh = new Mesh()
    botMesh.geometry = new BufferGeometry()
    botMesh.geometry.setAttribute('position', new BufferAttribute(botGeo, 3))
    botMesh.geometry.setAttribute('color', new BufferAttribute(colors.slice(topGeo.length), 3))
    botMesh.material = new MeshBasicMaterial({ vertexColors: true })

    const group = new Group()
    group.add(topMesh)
    group.add(botMesh)
    return { group, minThickness, maxThickness, thicknessRange }
  }

  $: meshResult = webMesh(conf, geometry, darkMode)

  $: mmin = meshResult.minThickness
  $: mmax = meshResult.maxThickness
  $: hsl = (f: number) => `hsl(${hue(mmin + f * (mmax - mmin))}deg, 100%, 50%)`

  // prettier-ignore
  $: gradStyle = `--un-gradient-stops: ${hsl(0)}, ${hsl(0.2)}, ${hsl(0.4)}, ${hsl(0.6)}, ${hsl(0.8)}, ${hsl(1)}`
</script>

<div class="absolute top-12 left-8 right-8 flex justify-end gap-8 text-gray-800 dark:text-gray-100">
  <div class="text-end">
    <span class="blue">Blue</span> is great, <span class="green">green</span> is good,
    <span class="red">red</span> is too thin.
  </div>
  <div class="flex gap-2">
    <div class="w-4 h-16 bg-gradient-to-t gradient" style={gradStyle} />
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

<style>
  .red {
    --at-apply: 'text-[hsl(0deg,100%,40%)] dark:text-[hsl(10deg,100%,60%)]';
  }

  .green {
    --at-apply: 'text-[hsl(120deg,100%,40%)] dark:text-[hsl(120deg,100%,60%)]';
  }

  .blue {
    --at-apply: 'text-[hsl(220deg,100%,40%)] dark:text-[hsl(215deg,100%,60%)]';
  }
</style>
