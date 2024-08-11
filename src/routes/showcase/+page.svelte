<script lang="ts">
  import { browser } from '$app/environment'
  import { base } from '$app/paths'
  import Header from '$lib/Header.svelte'
  import { keyboards } from './showcase'
</script>

<svelte:head>
  <title>Showcase • Cosmos Keyboard</title>
  <link rel="canonical" href="https://ryanis.cool/cosmos/showcase" />
  <link rel="icon" href="{base}/favicon.png" />
</svelte:head>

<svelte:body class="bg-brand-dark font-urbanist text-white" />

<Header />

<h1 class="uppercase text-xl sm:text-3xl text-[#68e4a9] font-medium text-center mt-10">
  Keyboards from the Community
</h1>
<p class="text-center mt-2">
  Psst! Click on any keyboard to import it into Cosmos or to view more information.
</p>
<div
  class="mx-8 my-6 grid sm:grid-cols-[repeat(2,18rem)] md:grid-cols-[repeat(2,21rem)] gap-2 justify-center"
>
  {#each keyboards as kbd}
    <a class="block bg-[#2e272d]/50 rounded-2 overflow-hidden citem" href="{base}/showcase/{kbd.key}">
      {#if browser}
        <div class="w-full aspect-[1.9/1] vignette">
          <img
            src={kbd.image}
            alt="Image of {kbd.author}'s keyboard"
            class="w-full h-full object-cover"
          />
        </div>
        <div class="flex gap-4 mx-2 my-2 items-center">
          <img src={kbd.authorImage} alt="Profile icon for {kbd.author}" class="h-6 w-6 rounded-full" />
          {kbd.author}
        </div>
      {:else}
        <div class="w-full aspect-[1.9/1] bg-slate-800" />
        <div class="my-2 h-6" />
      {/if}
    </a>
  {/each}
</div>

<p class="text-center opacity-50 mb-6">The order of keyboards is shuffled daily.</p>
