<script lang="ts">
  import Icon from '$lib/presentation/Icon.svelte'
  import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
  import * as mdi from '@mdi/js'
  import * as THREE from 'three'
  import type { WorkerPool } from './workerPool'
  import { newGeometry, type Cuttleform } from '$lib/worker/config'
  import { newDoc, toGLTF } from '$lib/loaders/gltfExport'
  import { fromGeometry } from '$lib/loaders/geometry'
  import { WebIO } from '@gltf-transform/core'
  import { download } from './browser'
  import { keyGeometries } from '$lib/loaders/keycaps'
  import { partGeometries } from '$lib/loaders/parts'
  import { CaseMaterial, KeyMaterial, drawLetter } from '$lib/3d/materials'

  export let pool: WorkerPool<typeof import('$lib/worker/api')>
  export let config: Cuttleform
  async function downloadGLB() {
    const wall = pool.execute((p) => p.generateWalls(config))
    const web = pool.execute((p) => p.generateWeb(config))
    const key = pool.execute((p) => p.generateKeys(config))
    const plate = pool.execute((p) => p.generatePlate(config))

    const geo = newGeometry(config)
    const keys = keyGeometries(geo.keyHolesTrsfs, config.keys)
    const switches = partGeometries(geo.keyHolesTrsfs, config.keys)

    // Commented out since the keycap meshes are still not being processed correctly
    // By gltf-transform.

    // Anyways, this is the browser so the Three.js exporter works great.
    // const doc = newDoc()
    // const scene = doc.createScene()
    // const buf = doc.createBuffer()
    // scene.addChild(toGLTF(doc, buf, fromGeometry((await wall).mesh)!, 'Walls'))
    // scene.addChild(toGLTF(doc, buf, fromGeometry((await web).mesh)!, 'Web'))
    // scene.addChild(toGLTF(doc, buf, fromGeometry((await key).mesh)!, 'Keys'))
    // scene.addChild(toGLTF(doc, buf, fromGeometry((await plate).top.mesh)!, 'Plate'))
    //
    // ;(await keys).forEach(k => {
    //     const node = toGLTF(doc, buf, k.geometry, 'Key')
    //     node.setMatrix(k.matrix.elements)
    //     scene.addChild(node)
    // })
    // ;(await switches).forEach(k => {
    //     const node = toGLTF(doc, buf, k.geometry, 'Key')
    //     node.setMatrix(k.matrix.elements)
    //     scene.addChild(node)
    // })
    //
    // const io = new WebIO({credentials: 'include'})
    // const glb = await io.writeBinary(doc)
    // const blob = new Blob([glb], { type: 'model/gltf-binary' })
    // download(blob, 'keyboard.glb')

    function node(name: string, geometry: THREE.BufferGeometry, material: THREE.Material) {
      const mesh = new THREE.Mesh(geometry, material)
      mesh.name = name
      return mesh
    }

    const scene = new THREE.Scene()
    const group = new THREE.Group()
    group.rotation.set(-Math.PI / 2, 0, 0)
    group.scale.setScalar(1 / 100)
    group.position.setY(-geo.floorZ / 100)
    group.name = 'Keyboard'
    scene.add(group)

    const switchMaterial = new THREE.MeshStandardMaterial({ color: '#fff' })
    switchMaterial.name = 'Switch Parts'
    const kbMaterial = new THREE.MeshStandardMaterial({ color: '#ccc' })
    kbMaterial.name = 'Keyboard'
    const plateMaterial = new THREE.MeshStandardMaterial({ color: '#999' })
    plateMaterial.name = 'Plate'
    group.add(node('Wall', fromGeometry((await wall).mesh)!, kbMaterial))
    group.add(node('Web', fromGeometry((await web).mesh)!, kbMaterial))
    group.add(node('Sockets', fromGeometry((await key).mesh)!, kbMaterial))
    group.add(node('Plate', fromGeometry((await plate).top.mesh)!, plateMaterial))
    ;(await keys).forEach((k) => {
      const material = new THREE.MeshStandardMaterial()
      if ('keycap' in k.key && k.key.keycap.letter) {
        const canvas = document.createElement('canvas')
        canvas.width = 512
        canvas.height = 512
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, 512, 512)
        drawLetter(canvas, k.key.keycap.letter, false, 'black')
        material.map = new THREE.CanvasTexture(canvas)
      } else {
        material.color = new THREE.Color('white')
      }
      const n = node('Key', k.geometry, material)
      k.matrix.decompose(n.position, n.quaternion, n.scale)
      group.add(n)
    })
    ;(await switches).forEach((k) => {
      const n = node('Part', k.geometry, switchMaterial)
      k.matrix.decompose(n.position, n.quaternion, n.scale)
      group.add(n)
    })
    const exporter = new GLTFExporter()
    const result = await exporter.parseAsync(scene, { binary: true })
    const blob = new Blob([result as any], { type: 'model/gltf-binary' })
    download(blob, 'keyboard.glb')
  }
</script>

<h2 class="mb-2 mt-4 text-xl text-teal-500 dark:text-teal-300 font-semibold">
  GLB Files: For Rendering
</h2>
<p class="text-gray-500 dark:text-gray-200 max-w-lg mx-auto">
  These models are editable in Blender and even include keycaps.
</p>
<div class="flex items-center justify-center mb-2 gap-1">
  <!-- svelte-ignore a11y-label-has-associated-control-->
</div>
<div class="inline-flex items-center gap-2">
  <button class="button flex items-center gap-2" on:click={() => downloadGLB(true)}
    ><Icon path={mdi.mdiHandBackLeft} />Left</button
  >
  <button class="button flex items-center gap-2" on:click={() => downloadGLB(false)}
    ><Icon path={mdi.mdiHandBackRight} />Right</button
  >
</div>

<style>
  .button {
    --at-apply: 'bg-purple-300 dark:bg-gray-900 hover:bg-purple-400 dark:hover:bg-pink-900 text-black dark:text-white font-bold py-2 px-4 rounded focus:outline-none border border-transparent focus:border-pink-500';
  }
</style>
