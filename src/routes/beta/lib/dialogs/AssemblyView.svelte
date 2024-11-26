<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte'
  import { mdiChevronLeft, mdiChevronRight } from '@mdi/js'
  import Icon from '$lib/presentation/Icon.svelte'
  import type { FullGeometry, KeyboardMeshes } from '../viewers/viewer3dHelpers'
  import type { Center } from '$lib/worker/config'
  import * as THREE from 'three'
  import { renderedModelsAsScene } from '../modelGLTF'
  import { skreeFirst } from './assemblyOrder'
  import { pricingSkree, selectionsSkree, VENDORS } from '@pro/assemblyService'

  export let center: Center
  export let meshes: ['left' | 'right' | 'unibody', KeyboardMeshes][]
  export let geometry: FullGeometry
  export let size: [number, number, number]

  const sortedVendors = skreeFirst ? [VENDORS.skree, VENDORS.tukon] : [VENDORS.tukon, VENDORS.skree]
  $: vendorData = sortedVendors.map((v) => {
    if (v.name == 'TheBigSkree')
      try {
        const price = '$' + pricingSkree(geometry).toFixed(2)
        const link =
          'https://skree.us/products/wireless-cosmos-dactyl?selections=' +
          selectionsSkree(geometry) +
          '&ref=cosmos'
        return { ...v, price, link, error: undefined }
      } catch (e) {
        return { ...v, price: 'n/a', error: (e as Error).message, link: null }
      }
    return { ...v, price: '€301.43', error: undefined, link: 'https://ryanis.cool/secret' }
  })

  let modelImg = ''

  const renderer = new THREE.WebGLRenderer({
    canvas: document.createElement('canvas'),
    powerPreference: 'high-performance',
    antialias: true,
    alpha: true,
  })
  renderer.setSize(1440, 800)
  const camera = new THREE.PerspectiveCamera(45, 1.8)
  onDestroy(() => renderer.dispose())

  $: {
    renderedModelsAsScene(geometry, meshes, center, true).then((model) => {
      const aspect = 1.8
      const fov = 45 * (Math.PI / 180)
      const fovh = 2 * Math.atan(Math.tan(fov / 2) * aspect)
      let dx = size[2] / 2 + Math.abs(size[0] / 2 / Math.tan(fovh / 2))
      let dy = size[2] / 2 + Math.abs(size[1] / 2 / Math.tan(fov / 2))
      camera.up.set(0, 0, 1)
      camera.position.set(0.05, -0.96, 0.56).normalize()
      camera.position.multiplyScalar(Math.max(dx, dy) * 1.1)
      camera.lookAt(new THREE.Vector3(0, 0, 0))
      console.log('new position', camera.position)
      console.log('center', center)
      console.log('size', size)
      renderer.render(model, camera)
      modelImg = renderer.domElement.toDataURL()
    })
  }

  const dispatch = createEventDispatcher()
</script>

<main class="dark:text-slate-100 flex flex-col xs:flex-row">
  <div class="xs:w-80 md:w-[24rem] xl:w-[32rem] bg-slate-100 dark:bg-slate-900 px-8 rounded-r-2">
    <button class="flex items-center font-bold my-8" on:click={() => dispatch('close')}>
      <Icon size={24} path={mdiChevronLeft} />
      Back to Generator
    </button>
    <img src={modelImg} class="w-full" />
    <p class="my-8">
      Your Keyboard arrives pre-assembled, pre-programmed, and ready to immediately start typing on!
    </p>
  </div>
  <div class="flex-1 px-4">
    {#each vendorData as vendor}
      <a
        href={vendor.link}
        class="flex items-center gap-10 p-4 pb-0 mb-2 rounded-2"
        class:hoverable={!vendor.error}
        class:opacity-50={vendor.error}
      >
        <div>
          <h2 class="text-2xl font-medium my-3">Order from {vendor.name}</h2>
          <p class="my-3 text-justify">{vendor.description}</p>
          <p class="my-3 text-gray-600 dark:text-gray-400">
            Ships globally in 1–2 weeks from {vendor.location}
            <Icon class="inline mt--1 ml-1 opacity-80" name="flag-{vendor.flag}" />
          </p>
        </div>
        <div class="flex-none relative min-w-16">
          <span class="absolute left-0 top--1.4em">Starts at</span>
          <span class="text-2xl font-bold">{vendor.price}</span>
        </div>
        <div
          class="rounded-full bg-teal-200 dark:bg-teal-600 flex items-center justify-center w-8 h-8 flex-none"
        >
          <Icon size={24} path={mdiChevronRight} />
        </div>
      </a>
      {#if vendor.error}
        <div class="bg-amber-200 dark:bg-amber-800 mx-4 px-4 py-2 rounded-2 mb-2">
          <p class="mb-1">{vendor.error}.</p>
          <p>{@html vendor.contact}</p>
        </div>
      {/if}
      <div class="flex gap-2 text-sm mb-16 mx-4" class:opacity-50={vendor.error}>
        {#each vendor.testimonials as test}
          <div class="bg-slate-200/50 dark:bg-slate-900 rounded-2 px-3 py-1">
            <p class="mb-0.5">{test[0]}</p>
            <p class="text-gray-600 dark:text-gray-400">{test[1]}</p>
          </div>
        {/each}
      </div>
    {/each}
  </div>
</main>

<style>
  .hoverable {
    --at-apply: 'hover:bg-slate-100 dark:hover:bg-slate-900';
  }
</style>
