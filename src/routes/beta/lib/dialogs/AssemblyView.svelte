<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'
  import { mdiChevronLeft, mdiChevronRight, mdiInformationOutline } from '@mdi/js'
  import Icon from '$lib/presentation/Icon.svelte'
  import type { FullGeometry, KeyboardMeshes } from '../viewers/viewer3dHelpers'
  import type { Center } from '$lib/worker/config'
  import * as THREE from 'three'
  import { renderedModelsAsScene } from '../modelGLTF'
  import { SORTED_VENDORS } from '@pro/assemblyService'
  import { trackEvent, sendError } from '$lib/telemetry'

  import Dialog from '$lib/presentation/Dialog.svelte'

  export let center: Center
  export let meshes: ['left' | 'right' | 'unibody', KeyboardMeshes][]
  export let geometry: FullGeometry
  export let size: [number, number, number]

  let dialogOpen = false

  $: vendorData = SORTED_VENDORS.map((v) => {
    try {
      const price = '$' + v.pricing(geometry).toFixed(2)
      const link =
        'https://skree.us/products/custom-cosmos-dactyl?selections=' +
        v.selections(geometry) +
        '&ref=cosmos'
      return { ...v, price, link, error: undefined }
    } catch (e: any) {
      sendError(e, 'Cosmos vendor')
      return { ...v, price: 'n/a', error: (e as Error).message, link: null }
    }
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
  onMount(() => trackEvent('assemblyservice-visit', {}))

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
    <button
      class="flex items-center font-bold my-8 hover:bg-teal-200/70 dark:hover:bg-pink-900/70 rounded pr-2 py-0.5"
      on:click={() => dispatch('close')}
    >
      <Icon size={24} path={mdiChevronLeft} />
      Back to Generator
    </button>
    <img src={modelImg} class="w-full" />
    <p class="my-8">
      Your Keyboard arrives pre-assembled, pre-programmed, and ready to immediately start typing on!
    </p>
    <p class="flex justify-center">
      <a
        href="docs/assembly-service/"
        target="_blank"
        class="flex gap-2 items-center bg-white dark:bg-slate-800 font-medium mb-4 hover:bg-teal-200/70 dark:hover:bg-pink-900/70 rounded px-4 py-1"
      >
        <Icon path={mdiInformationOutline} />
        About Assembly Service
      </a>
    </p>
  </div>
  <div class="flex-1 px-4">
    {#each vendorData as vendor}
      <button
        on:click={(e) => {
          e.preventDefault()
          dialogOpen = true
          trackEvent('assemblyservice-order', { vendor: vendor.name })
        }}
        class="flex items-center gap-10 p-4 pb-0 mb-2 rounded-2 <lg:flex-col overflow-hidden"
        class:hoverable={!vendor.error}
        class:opacity-50={vendor.error}
      >
        <div>
          <div class="flex items-center gap-4 my--1">
            <img src={vendor.logo} class="size-12 rounded-2 pointer-events-none flex-none" />
            <h2 class="text-2xl font-medium my-3 flex-shrink-0">Order from {vendor.name}</h2>
            <img src={vendor.banner} class="h-12 pointer-events-none flex-grow self-start flex-grow-0" />
          </div>
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
          class="rounded-full bg-teal-200 dark:bg-teal-600 flex items-center justify-center w-8 h-8 flex-none <lg:(w-full mb-2)"
        >
          <Icon size={24} path={mdiChevronRight} />
        </div>
      </button>
      {#if vendor.error}
        <div class="bg-amber-200 dark:bg-amber-800 mx-4 px-4 py-2 rounded-2 mb-2">
          <p class="mb-1">{vendor.error}.</p>
          <p>{@html vendor.contact}</p>
        </div>
      {/if}
      <div class="flex gap-2 text-sm mb-16 mx-4" class:opacity-50={vendor.error}>
        {#each vendor.testimonials as test}
          <div class="bg-slate-200/50 dark:bg-slate-900 rounded-2 px-3 py-2">
            <p class="mb-0.5 line-height-tight">{test[0]}</p>
            <p class="text-gray-600 dark:text-gray-400">
              {test[1]}
              <span class="mx-1">&bullet;</span>
              {test[2]}
            </p>
          </div>
        {/each}
        <a
          href="https://www.etsy.com/shop/TheBigSkree#reviews"
          target="_blank"
          class="bg-slate-200/50 dark:bg-slate-900 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-2 px-3 py-1 flex flex-col justify-center w-40 flex-basis-200"
        >
          <p class="font-medium line-height-tight">Read More Reviews on Skree's Etsy Store</p>
          <p class="text-gray-600 text-xs dark:text-gray-400 mt-2 line-height-tight">
            Skree owns both an Etsy shop and the offical skree.us site.
          </p>
        </a>
      </div>
    {/each}
  </div>
</main>

{#if dialogOpen}
  <Dialog on:close={() => (dialogOpen = false)}>
    <span slot="title">Help Preview the New Checkout Flow</span>
    <div slot="content">
      <p class="mb-2">
        Hey! I've been working hard on revising the checkout experience on TheBigSkree's website to make
        configuring more straightforward and intuitive. I've built a color option simulator, color
        palettes, and added more options.
      </p>
      <p class="mb-2">
        I recommend you use this button below to configure your keyboard on the mockup page before
        navigating to TheBigSkree's site.
      </p>
      <div class="text-center mb-2">
        <a
          class="mr-6 inline-flex items-center gap-2 border-2 px-3 py-1 rounded border-gray-500/20 hover:border-gray-500 transition-border-color text-gray-600 dark:text-gray-200"
          href="https://ryanis.cool/skreeShopify?config={encodeURIComponent(location.hash.substring(1))}"
          >Try the New Checkout</a
        >
      </div>
      <p class="mb-2">
        If you'd like the old experience, use <a
          href={vendorData[0].link}
          class="underline text-teal-600">This Link</a
        >.
      </p>
    </div>
  </Dialog>
{/if}

<style>
  .hoverable {
    --at-apply: 'hover:bg-teal-100/90 dark:hover:bg-teal-900/70';
  }
</style>
