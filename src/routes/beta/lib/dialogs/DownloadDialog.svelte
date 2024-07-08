<script lang="ts">
  import { modelName, user } from '$lib/store'
  import { isPro } from '$lib/worker/check'
  import { newGeometry, type Cuttleform, type FullCuttleform } from '$lib/worker/config'
  import Dialog from '$lib/presentation/Dialog.svelte'
  import * as flags from '$lib/flags'
  import { createEventDispatcher } from 'svelte'
  import Icon from '$lib/presentation/Icon.svelte'
  import { mdiHandBackLeft, mdiHandBackRight, mdiKeyboard, mdiStarShooting } from '@mdi/js'
  import type { WorkerPool } from '../workerPool'
  import { download } from '$lib/browser'
  import { trackEvent } from '$lib/telemetry'
  import { hasPro } from '@pro'
  import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
  import * as THREE from 'three'
  import { fromGeometry } from '$lib/loaders/geometry'
  import { keyGeometries } from '$lib/loaders/keycaps'
  import { partGeometries } from '$lib/loaders/parts'
  import { drawLetter } from '$lib/3d/materials'
  import { objKeys } from '$lib/worker/util'

  const dispatch = createEventDispatcher()

  export let config: FullCuttleform
  export let pool: WorkerPool<typeof import('$lib/worker/api')>

  let showAllFormats = false
  let generatingSTEP = false
  let generatingSTL = false
  let generatingError: Error | undefined

  function downloadSTEP(side: 'left' | 'right' | 'unibody') {
    if (side != 'unibody' && !config[side!]?.bottomZ) {
      generatingError = new Error('Configuration has not yet been evaluated')
      return
    }
    const begin = window.performance.now()
    generatingSTEP = true
    pool
      .executeNow((w) => w.getSTEP(config[side]!, side == 'left', true) as Promise<Blob>)
      .then(addMetadataToSTEP)
      .then(
        (blob) => {
          trackEvent('cosmos-step', {
            model: 'keyboard',
            time: window.performance.now() - begin,
          })
          download(blob, $modelName + side + '.step')
          generatingError = undefined
          generatingSTEP = false
        },
        (e) => {
          generatingSTEP = false
          console.error(e)
          generatingError = e
        }
      )
  }

  function downloadSTL(model: string, side: 'left' | 'right' | 'unibody') {
    if (side != 'unibody' && !config[side!]?.bottomZ) {
      generatingError = new Error('Configuration has not yet been evaluated')
      return
    }
    const begin = window.performance.now()
    generatingSTL = true
    pool
      .executeNow((w) => w.getSTL(config[side]!, model, side) as Promise<Blob>)
      .then(addMetadataToSTL)
      .then(
        (blob) => {
          trackEvent('cosmos-stl', { model, time: window.performance.now() - begin })
          if (model == 'model') model = 'case'
          download(blob, $modelName + '-' + model + side + '.stl')
          generatingError = undefined
          generatingSTL = false
        },
        (e) => {
          generatingSTL = false
          console.error(e)
          generatingError = e
        }
      )
  }

  /** Embed the URL into the STEP file. */
  async function addMetadataToSTEP(blob: Blob) {
    const text = await blob.text()
    const replaced = text
      .replace("FILE_DESCRIPTION(('Open CASCADE Model')", "FILE_DESCRIPTION(('Cosmos Model')")
      .replace("FILE_NAME('Open CASCADE Shape Model'", `FILE_NAME('${location.href}'`)
    return new Blob([replaced], { type: blob.type })
  }

  /**
    Hide the URL in the attributes of the STL file.
    There are 84 bytes of header information, then attributes are in the
    last 2 bytes of every following 50-byte triangle.
    */
  async function addMetadataToSTL(blob: Blob) {
    const contents = await blob.arrayBuffer()
    const array = new Uint8Array(contents)
    if (132 + (location.href.length / 2) * 50 < array.length) {
      for (let i = 0; i < Math.ceil(location.href.length / 2); i++) {
        array[132 + i * 50] = location.href[i * 2].charCodeAt(0)
        array[132 + i * 50 + 1] = location.href[i * 2 + 1]?.charCodeAt(0)
      }
    }
    return new Blob([contents], { type: blob.type })
  }

  async function downloadGLB(side: 'left' | 'right' | 'unibody') {
    const conf = config[side]!
    const wall = pool.execute((p) => p.cutWall(conf))
    const web = pool.execute((p) => p.generateWeb(conf))
    const key = pool.execute((p) => p.generateKeysMesh(conf))
    const plate = pool.execute((p) => p.generatePlate(conf))

    const geo = newGeometry(conf)
    const keys = keyGeometries(geo.keyHolesTrsfs, conf.keys)
    const switches = partGeometries(geo.keyHolesTrsfs, conf.keys, false)

    function node(name: string, geometry: THREE.BufferGeometry, material: THREE.Material) {
      const mesh = new THREE.Mesh(geometry, material)
      mesh.name = name
      return mesh
    }

    const scene = new THREE.Scene()
    const group = new THREE.Group()
    group.rotation.set(-Math.PI / 2, 0, 0)
    group.scale.setScalar(1 / 10)
    group.position.setY(-geo.floorZ / 10)
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
    group.add(node('Sockets', fromGeometry(await key)!, kbMaterial))
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
    download(blob, $modelName + side + '.glb')
  }

  function iconPath(kbdName: 'left' | 'right' | 'unibody') {
    if (kbdName == 'left') return mdiHandBackLeft
    if (kbdName == 'right') return mdiHandBackRight
    return mdiKeyboard
  }

  function kbdName(kbdName: 'left' | 'right' | 'unibody', name = '') {
    if (name) {
      if (kbdName == 'left') return 'L / ' + name
      if (kbdName == 'right') return 'R / ' + name
      return name
    }
    if (kbdName == 'left') return 'Left'
    if (kbdName == 'right') return 'Right'
    return 'Unibody'
  }

  $: configKeys = objKeys(config).sort()
</script>

<Dialog on:close>
  <span slot="title">Download Your Model</span>
  <div slot="content" class="text-center">
    {#if Object.values(config).some(isPro) && !($user.success && $user.sponsor)}
      <p class="mb-2">
        You're using some <span class="text-teal-500 dark:text-teal-400 font-bold">PRO</span> features in
        this model.
      </p>
      <p>To download this model, sign up for a Pro account.</p>
      {#if flags.login}
        <button
          class="flex items-center gap-2 border-2 px-3 py-1 rounded hover:shadow-md transition-shadow border-yellow-400 hover:bg-yellow-400/30 hover:shadow-yellow-400/30 mt-6 mx-auto"
          on:click={() => dispatch('gopro')}
        >
          <Icon path={mdiStarShooting} size="20px" class="text-yellow-500 dark:text-yellow-300" />
          Get PRO
        </button>
      {:else}
        <p class="mt-2">
          Since I have not rolled out Pro accounts, please ping me on Discord with a link to your model
          and I'll send you the files.
        </p>{/if}
    {:else}
      <div class="mt-[-0.5rem] mb-4 text-gray-500 dark:text-gray-200">
        File name for downloads: <input class="input px-2" bind:value={$modelName} />
      </div>
      <h2 class="mb-2 text-xl text-teal-500 dark:text-teal-300 font-semibold">
        STL Files: For 3D Printing
      </h2>
      <p class="mb-4 text-gray-500 dark:text-gray-200 max-w-lg mx-auto text-sm">
        Send these to a 3D printing service or use PrusaSlicer or Cura for slicing. If you're using a
        different slicer, ask in the <a
          class="text-teal-500 dark:text-teal-300 hover:underline"
          href="https://discord.gg/nXjqkfgtGy">Discord server</a
        > if it's been tested!
      </p>
      <div class="columns-2">
        <div class="break-inside-avoid">
          <h3 class="mb-2 text-lg semibold text-black dark:text-white">Case/Shell</h3>
          <div class="inline-flex items-center gap-2">
            {#each configKeys as kbd}
              <button class="button flex items-center gap-2" on:click={() => downloadSTL('model', kbd)}
                ><Icon path={iconPath(kbd)} />{kbdName(kbd)}</button
              >
            {/each}
          </div>
        </div>
        <div class="break-inside-avoid">
          <h3 class="mb-2 mt-4 text-lg semibold text-black dark:text-white">Plate</h3>
          {#if Object.values(config).some((c) => c.shell.type == 'tilt' || c.shell.type == 'stilts')}
            <div class="inline-flex items-center gap-2">
              {#each configKeys as kbd}
                <button
                  class="button flex items-center gap-2"
                  on:click={() => downloadSTL('platetop', kbd)}
                  ><Icon path={iconPath(kbd)} />{kbdName(kbd, 'Top')}</button
                >
              {/each}
            </div>
            <div class="inline-flex items-center gap-2 mt-2">
              {#each configKeys as kbd}
                <button
                  class="button flex items-center gap-2"
                  on:click={() => downloadSTL('platebottom', kbd)}
                  ><Icon path={iconPath(kbd)} />{kbdName(kbd, 'Bot')}</button
                >
              {/each}
            </div>
            <div class="text-sm opacity-70 text-center mt-2 pb-1">
              Download both the Top and Bot models
            </div>
          {:else}
            <div class="inline-flex items-center gap-2">
              {#each configKeys as kbd}
                <button class="button flex items-center gap-2" on:click={() => downloadSTL('plate', kbd)}
                  ><Icon path={iconPath(kbd)} />{kbdName(kbd)}</button
                >
              {/each}
            </div>
          {/if}
        </div>
        {#if Object.values(config).some((c) => c.microcontroller)}
          <div class="break-inside-avoid">
            <h3 class="mb-2 mt-4 text-lg semibold text-black dark:text-white">Microcontroller Holder</h3>
            <div class="inline-flex items-center gap-2">
              {#each configKeys as kbd}
                <button
                  class="button flex items-center gap-2"
                  on:click={() => downloadSTL('holder', kbd)}
                  ><Icon path={iconPath(kbd)} />{kbdName(kbd)}</button
                >
              {/each}
            </div>
          </div>
        {/if}
        {#if hasPro}
          <div class="break-inside-avoid">
            <h3 class="mb-2 mt-4 text-lg semibold text-black dark:text-white">Wrist Rest</h3>
            {#if $user.success && $user.sponsor}
              {#if Object.values(config).some((c) => c.wristRest)}
                <div class="inline-flex items-center gap-2">
                  {#each configKeys as kbd}
                    <button
                      class="button flex items-center gap-2"
                      on:click={() => downloadSTL('wristrest', kbd)}
                      ><Icon path={iconPath(kbd)} />{kbdName(kbd)}</button
                    >
                  {/each}
                </div>
              {:else}
                None configured
              {/if}
            {:else}
              <p class="mb-2">
                You need a <span class="text-teal-500 dark:text-teal-400 font-bold">PRO</span> account to
                download wrist rests.
              </p>
            {/if}
          </div>
        {/if}
      </div>
      <h2 class="mb-2 mt-8 text-xl text-teal-500 dark:text-teal-300 font-semibold">
        STEP Files: For CAD Programs
      </h2>
      <p class="mb-4 text-gray-500 dark:text-gray-200 max-w-lg mx-auto text-sm">
        These models are editable in Fusion and Onshape and include all parts. Unlike STL, these have
        infinite resolution and face info. <a
          class="text-teal-500 dark:text-teal-300 hover:underline"
          href="docs/cad/">[Importing Guide]</a
        >
      </p>
      <div class="inline-flex items-center gap-2">
        {#each configKeys as kbd}
          <button class="button flex items-center gap-2" on:click={() => downloadSTEP(kbd)}>
            <Icon path={iconPath(kbd)} />{kbdName(kbd)}
          </button>
        {/each}
      </div>
      {#if hasPro}
        {#if !($user.success && $user.sponsor)}
          <p class="mt-2">
            A <span class="text-teal-500 dark:text-teal-400 font-bold">PRO</span> account will add wrist rests
            will to this file.
          </p>
        {:else if !Object.values(config).some((c) => c.wristRest)}
          <p class="mt-2">
            Wrist rests will not be added to this assembly. Check "Show Wrists" rests in basic/advanced
            view to enable them or add them to your expert mode configuration.
          </p>
        {/if}
      {/if}
      {#if showAllFormats}
        <h2 class="mb-2 mt-8 text-xl text-teal-500 dark:text-teal-300 font-semibold">
          GLB Files: For Rendering
        </h2>
        <p class="text-gray-500 dark:text-gray-200 max-w-lg mx-auto text-sm">
          These models are editable in Blender and even include keycaps.
        </p>
        <div class="flex items-center justify-center mb-2 gap-1">
          <!-- svelte-ignore a11y-label-has-associated-control-->
        </div>
        <div class="inline-flex items-center gap-2">
          {#each configKeys as kbd}
            <button class="button flex items-center gap-2" on:click={() => downloadGLB(kbd)}>
              <Icon path={iconPath(kbd)} />{kbdName(kbd)}
            </button>
          {/each}
        </div>
      {:else}
        <p class="mt-6 mb-[-1rem]">
          <button
            on:click={() => (showAllFormats = true)}
            class="text-gray-700 dark:text-gray-400 hover:text-teal-500 hover:dark:text-teal-300 hover:underline"
            >More formats...</button
          >
        </p>
      {/if}
      {#if generatingSTEP || generatingSTL}
        <p class="mt-4">Generating... Please be patient.</p>
      {:else if generatingError}
        <div
          class="bg-red-200 m-4 mb-2 rounded p-4 dark:bg-red-700 font-mono text-sm whitespace-pre-wrap"
        >
          {generatingError.message}
        </div>
        <p>Check the browser console for more details.</p>
      {/if}
    {/if}
  </div>
</Dialog>

<style>
  .button {
    --at-apply: 'bg-purple-300 dark:bg-gray-900 hover:bg-purple-400 dark:hover:bg-pink-900 text-black dark:text-white font-bold py-2 px-4 rounded focus:outline-none border border-transparent focus:border-pink-500';
  }

  .input {
    --at-apply: 'focus:border-teal-500 border border-transparent text-gray-700 focus:outline-none border-gray-200 dark:border-transparent bg-gray-100 dark:bg-gray-700 dark:text-gray-100 appearance-none w-44 rounded mx-2 text-ellipsis';
  }
</style>
