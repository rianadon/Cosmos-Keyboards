<script lang="ts">
  import { base } from '$app/paths'
  import Icon from '$lib/presentation/Icon.svelte'
  import { discordMsg } from '$lib/store'
  import { createEventDispatcher } from 'svelte'

  const discord = 'https://discord.gg/nXjqkfgtGy'
  const dispatch = createEventDispatcher()

  function subbed(ev: Event) {
    $discordMsg = false
  }
  function join(ev: Event) {
    dispatch('join', ev)
  }
</script>

<header
  class="font-urbanist fixed top-0 left-0 right-0 flex items-center py-1 justify-between px-4 sm:px-6 lg:px-12 text-brand-amber max-w-[100rem] mx-auto z-10 backdrop-blur-lg bg-[#17171d]/50"
>
  <a href="{base}/" class="flex items-center gap-2 font-semibold md:flex-basis-60 justify-start">
    <div class="icon" />
    <h1 class="text-lg <sm:hidden">Cosmos</h1>
    <span class="relative inline-block text-black py-0.5 <sm:hidden">
      <span class="absolute inset-0 bg-brand-amber transform skew-x-10 rounded-0.5" />
      <span class="relative px-2">BETA</span>
    </span>
  </a>
  <ul class="flex gap-2 sm:gap-6 font-medium">
    <li><a href="{base}/docs/" class="li">Docs</a></li>
    <li><a href="{base}/showcase" class="li">Showcase</a></li>
    <li><a href="{base}/blog/" class="li">Blog</a></li>
  </ul>
  <div class="flex gap-4 sm:gap-8 items-center headers md:flex-basis-60 justify-end">
    <a class="headicon" href={discord} on:click={subbed}
      ><Icon name="discord" alt="Discord" size="22" /></a
    >
    <a class="headicon" href="https://github.com/rianadon/Cosmos-Keyboards"
      ><Icon name="github" alt="GitHub" size="22" /></a
    >
    <a
      href="{base}/beta"
      class="text-black bg-brand-amber rounded-0.8 px-2 py-0.5 font-semibold <md:hidden transition hover:shadow-lg shadow-amber/30"
      on:click={join}>Try the Beta</a
    >
  </div>
</header>
<div class="h-12" />

<style>
  .icon {
    background: url('/favicon.png');
    background-size: contain;
    --at-apply: 'w-7 h-7 sm:w-8 sm:h-8';
    margin-right: 1rem;
  }

  .headers > a:hover {
    transform: scale(1.05);
  }
  .headers > a.headicon:hover {
    transform: scale(1.1);
  }

  .li {
    --at-apply: 'relative block h-10 flex items-center px-1';
    transition: box-shadow 0.2s ease-out;
  }
  .li:hover {
    box-shadow: 0 8px 8px -8px #e3c28c;
  }
</style>
