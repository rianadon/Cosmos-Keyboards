<script lang="ts">
  import { base } from '$app/paths'
  import Header from '$lib/Header.svelte'
  import Icon from '$lib/presentation/Icon.svelte'
  import {
    mdiBookOpenVariantOutline,
    mdiChevronRight,
    mdiKeyboardOutline,
    mdiPencilOutline,
    mdiWrench,
    mdiWrenchOutline,
  } from '@mdi/js'
  import type { PageData } from './$types'
  import Carousel from './Carousel.svelte'

  export let data: PageData
  $: kbd = data.keyboard
</script>

<svelte:head>
  <title>{kbd.name} • Showcase • Cosmos Keyboard</title>
  <link rel="canonical" href="https://ryanis.cool/cosmos/showcase" />
  <link rel="icon" href="{base}/favicon.png" />
</svelte:head>

<svelte:body class="bg-brand-dark font-urbanist text-white" />

<Header />

<div class="mx-auto container max-w-[calc(190vh-22rem)]">
  {#if kbd.images.length == 1}
    <div class="w-full aspect-[1.9/1]">
      <img
        src={kbd.largeImage}
        alt="Image of {kbd.author}'s keyboard"
        class="w-full h-full object-cover"
      />
    </div>
  {:else}
    <div class="w-full aspect-[1.9/1] overflow-hidden">
      <Carousel>
        {#each kbd.images as image}
          <div class="w-full aspect-[1.9/1]">
            <img
              src={image.largeImage}
              alt="Image of {kbd.author}'s keyboard"
              class="w-full h-full object-cover"
            />
          </div>
        {/each}
      </Carousel>
    </div>
  {/if}
  <div class="sm:flex mt-2 mx-2 gap-4 md:gap-12 justify-center mx-8">
    <div class="w-full mb-2 mt-3 max-w-prose">
      <h1 class="uppercase text-2xl sm:text-3xl text-[#68e4a9] font-medium">
        {kbd.name}
      </h1>
      <div class="flex gap-4 mx-0.5 my-2 items-center">
        <img src={kbd.authorImage} alt="Profile icon for {kbd.author}" class="h-6 w-6 rounded-full" />
        {kbd.author}
      </div>
      {#if kbd.projectLink}
        <div class="mt-2 mb-4 flex mx-0.5 items-center gap-4">
          <div class="w-6 flex justify-center opacity-80"><Icon path={mdiBookOpenVariantOutline} /></div>
          <a class="text-brand-green hover:underline" href={kbd.projectLink}>{kbd.projectLink}</a>
        </div>
      {/if}
      {#if kbd.details}
        <div class="mt-2 mb-4 showcasedetails">{@html kbd.details}</div>
      {/if}
      <div
        class="opacity-80 grid grid-cols-[4.8rem_1fr] line-height-tight gap-row-1 mt-4 mb-4 showcasedetails"
      >
        {#if kbd.resin}
          <span>Resin:</span> <span>{@html kbd.resin || 'Unknown'}</span>
        {:else}
          <span>Filament:</span> <span>{@html kbd.filament || 'Unknown'}</span>
        {/if}
        <span>Switches:</span> <span>{@html kbd.switches || 'Unknown'}</span>
        <span>Keycaps:</span> <span>{@html kbd.keycaps || 'Unknown'}</span>
      </div>
    </div>
    <div class="flex-none opacity-80 mb-4 <sm:mt-10">
      {#if kbd.config}
        <a
          href="{base}/beta{kbd.config}"
          class="text-black font-semibold rounded inline-flex items-center gap-16 my-4 pl-6 pr-4 bg-brand-green <sm:ml-6 transition hover:shadow-lg shadow-teal/30"
        >
          Fit, Edit and Download
          <Icon path={mdiChevronRight} size="100%" class="w-[28px] sm:w-[32px]" />
        </a>
      {/if}
      <div class="flex items-center gap-2 mb-1">
        <Icon path={mdiKeyboardOutline} size="16" />{data.name}
      </div>
      {#if kbd.modifiedInCAD}
        <div class="flex items-center gap-2 mb-1">
          <Icon path={mdiWrenchOutline} size="16" />Modified In CAD
        </div>
      {/if}
      <a
        href="https://github.com/rianadon/Cosmos-Keyboards/blob/v3/src/routes/showcase/showcase.ts"
        class="flex items-center gap-2 mb-1 mt-4 opacity-50"
      >
        <Icon path={mdiPencilOutline} size="16" />Edit this Page
      </a>
    </div>
  </div>
</div>

<style>
  :global(.showcasedetails p) {
    --at-apply: 'mb-2';
  }

  :global(.showcasedetails a) {
    --at-apply: 'hover:underline text-brand-green';
  }
</style>
