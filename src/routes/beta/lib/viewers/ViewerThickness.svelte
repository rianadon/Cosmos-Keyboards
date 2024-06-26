<script lang="ts">
  import { BufferAttribute, Mesh, MeshBasicMaterial, Color } from 'three'
  import type { Center, Geometry } from '$lib/worker/config'
  import Viewer from './Viewer.svelte'
  import { T } from '@threlte/core'
  import type { FullGeometry } from './viewer3dHelpers'
  import { objEntries } from '$lib/worker/util'
  import { fromGeometry } from '$lib/loaders/geometry'
  import { webSolid } from '$lib/worker/model'

  export let style: string = ''
  export let center: Center
  export let size: [number, number, number]
  export let cameraPosition: [number, number, number] = [0.16, -0.96, 0.56]
  export let enableRotate = true
  export let enableZoom = false
  export let darkMode: boolean

  export let geometry: FullGeometry | undefined

  const hue = (t: number) => Math.min(Math.max(0, t - 1) / 4, 1) * 240

  function eqIndices<T>(x: T[], e: T): number[] {
    const ind: number[] = []
    x.forEach((a, i) => {
      if (a == e) ind.push(i)
    })
    return ind
  }

  function webMesh(geo: Geometry | undefined, darkMode: boolean) {
    if (!geo) return { topMesh: null, minThickness: 0, maxThickness: 0, thicknessRange: 0 }

    const { topReinf, botReinf } = geo.reinforcedTriangles

    const thicknesses: number[] = []
    const nTri = geo.solveTriangularization.triangles.length

    topReinf.triangles.forEach((triangle, i) => {
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

    const mesh = webSolid(geo.c, geo).toMesh()
    const colors = new Float32Array(mesh.vertices.length)

    console.log(thicknesses.length, mesh.triangles.length / 3, mesh.faceGroups.length)
    thicknesses.forEach((t, i) => {
      let color: number[]
      if (t < 0) {
        color = (darkMode ? new Color('#1F2937') : new Color('#E2E8F0')).convertSRGBToLinear().toArray()
      } else {
        color = new Color()
          .setHSL(hue(t) / 360, 1, 0.5)
          .convertSRGBToLinear()
          .toArray()
        // color = new Vector3(1, 0.15, 0.15).lerp(new Vector3(0.15, 0.39, 1), scaled).toArray()
      }
      const face = mesh.faceGroups[i]
      console.log(face)
      for (let j = face.start; j < face.start + face.count; j++) {
        colors.set(color, mesh.triangles[j * 3] * 3)
        colors.set(color, mesh.triangles[j * 3 + 1] * 3)
        colors.set(color, mesh.triangles[j * 3 + 2] * 3)
      }
    })

    const theMesh = new Mesh()
    theMesh.geometry = fromGeometry(mesh)!
    theMesh.geometry.setAttribute('color', new BufferAttribute(colors, 3))
    theMesh.material = new MeshBasicMaterial({ vertexColors: true, toneMapped: false })

    return { theMesh, minThickness, maxThickness, thicknessRange }
  }

  function webMeshAll(geometry: FullGeometry | undefined, darkMode: boolean) {
    if (!geometry) return { meshes: {}, minThickness: 0, maxThickness: 0, thicknessRange: 0 }
    if (geometry.unibody) {
      const result = webMesh(geometry.unibody, darkMode)
      return { meshes: { unibody: result }, ...result }
    } else {
      const left = webMesh(geometry.left, darkMode)
      const right = webMesh(geometry.right, darkMode)
      const minThickness = Math.min(left.minThickness, right.minThickness)
      const maxThickness = Math.max(left.maxThickness, right.maxThickness)
      const thicknessRange = maxThickness - minThickness
      return { meshes: { left, right }, minThickness, maxThickness, thicknessRange }
    }
  }

  $: meshResult = webMeshAll(geometry, darkMode)

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
<Viewer {style} suggestedSize={size} {cameraPosition} {enableRotate} {enableZoom} enablePan={true}>
  <T.Group>
    {#each objEntries(meshResult.meshes) as [kbd, result] (kbd)}
      {@const cent = center[kbd]}
      {#if result && result.theMesh && cent}
        <T.Group position={[-cent[0], -cent[1], -cent[2]]} scale.x={kbd == 'left' ? -1 : 1}>
          <T is={result.theMesh} />
        </T.Group>
      {/if}
    {/each}
    <slot />
  </T.Group>
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
