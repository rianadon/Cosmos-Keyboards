<script lang="ts">
  import { base } from '$app/paths'
  import Header from '$lib/Header.svelte'
  import Icon from '$lib/presentation/Icon.svelte'
  import { mdiChevronRight } from '@mdi/js'
  import type { keyboards } from '../showcase'

  export let data: { keyboard: (typeof keyboards)[number] }
  $: kbd = data.keyboard
</script>

<svelte:head>
  <title>{kbd.name} • Showcase • Cosmos Keyboard</title>
  <link rel="canonical" href="https://ryanis.cool/cosmos/showcase" />
  <link rel="icon" href="{base}/favicon.png" />
</svelte:head>

<svelte:body class="bg-brand-dark font-urbanist text-white" />

<Header />

<div class="mx-auto container max-w-[calc(190vh-21rem)]">
  <div class="w-full aspect-[1.9/1]">
    <img
      src={kbd.largeImage}
      alt="Image of {kbd.author}'s keyboard"
      class="w-full h-full object-cover"
    />
  </div>
  <div class="flex mt-2 mx-2">
    <div class="w-full">
      <h1 class="uppercase text-xl sm:text-3xl text-[#68e4a9] font-medium">
        {kbd.name}
      </h1>
      <div class="flex gap-4 mx-0.5 my-2 items-center">
        <img src={kbd.authorImage} alt="Profile icon for {kbd.author}" class="h-6 w-6 rounded-full" />
        {kbd.author}
      </div>
      {#if kbd.details}
        <p class="mt-2 mb-4">{kbd.details}</p>
      {/if}
    </div>
    <div class="flex-none">
      {#if kbd.config}
        <a
          href="{base}/beta{kbd.config}"
          class="text-black font-semibold rounded inline-flex items-center gap-16 my-4 pl-6 pr-4 bg-brand-green <sm:ml-6 transition hover:shadow-lg shadow-teal/30"
        >
          Fit, Edit and Download
          <Icon path={mdiChevronRight} size="100%" class="w-[28px] sm:w-[32px]" />
        </a>
      {/if}
    </div>
  </div>
</div>

<style>
</style>
