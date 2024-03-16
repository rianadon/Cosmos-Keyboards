<script lang="ts">
  import { base } from '$app/paths'
  import { KEY_INFO, UNIFORM } from '$lib/geometry/keycaps'
  import Checkbox from '$lib/presentation/Checkbox.svelte'
  import { developer } from '$lib/store'
  import Part from './Part.svelte'
  import SharedRenderer from '$lib/3d/SharedRenderer.svelte'

  const entries = Object.entries(KEY_INFO)
  const uniformEntries = entries.filter((e) => UNIFORM.includes(e[0]))
  const nonuniformEntries = entries.filter((e) => !UNIFORM.includes(e[0]))
</script>

<svelte:head>
  <title>Keycaps - Cosmos Keyboard Generator</title>
  <link rel="canonical" href="https://ryanis.cool/cosmos/keycaps/" />
  <link rel="icon" href="{base}/favicon.png" />
</svelte:head>

<header class="block py-4 md:flex justify-between px-4">
  <a href="{base}/">
    <img
      alt="Cosmos Icon"
      src="{base}/cosmos-icon.png"
      class="v-middle inline w-12 rounded-4 mr-8 shadow-[0_2px_20px_-3px_rgba(0,0,0,0.3)] shadow-pink/50"
    />
    <h1
      class="v-middle inline my-8 capitalize text-4xl text-purple font-semibold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-amber-600 tracking-tight"
    >
      Cosmos Keyboard Generator
    </h1>
  </a>
  <!-- svelte-ignore a11y-label-has-associated-control -->
  <label class="text-white flex items-center mr-8 <md:mt-12">
    <Checkbox basic bind:value={$developer} />
    Developer Mode
  </label>
</header>

{#if $developer}
  <div class="text-white mx-auto max-w-prose mt-6">
    The <span class="text-teal">teal regions</span> represent the shape of the key and are used for
    curvature-preserving alignment. The <span class="text-red">red regions</span> represent the boundaries
    of the key and are used for detecting part intersections. They extend downwards to account for key
    travel.
  </div>
{/if}

<main class="max-w-6xl mx-auto">
  <SharedRenderer antialias alpha>
    <h2>Uniform Keycaps</h2>
    <section class="parts-grid" class:dev={$developer}>
      {#each uniformEntries as [part, rows]}
        {#each Object.keys(rows) as row}
          <Part {part} row={Number(row)} dev={$developer} />
        {/each}
      {/each}
    </section>
    <h2>Nonuniform Keycaps</h2>
    <section>
      {#each nonuniformEntries as [part, rows]}
        <div class="parts-grid parts-grid-pad" class:dev={$developer}>
          {#each Object.keys(rows) as row}
            <Part {part} row={Number(row)} dev={$developer} />
          {/each}
        </div>
      {/each}
    </section>
  </SharedRenderer>
</main>

<footer class="text-white max-w-prose mx-auto my-20">
  These keycaps are generated using the <a href="https://github.com/rsheldiii/KeyV2/">KeyV2</a> and
  <a href="https://github.com/pseudoku/PseudoMakeMeKeyCapProfiles">PseudoMakeMeKeyCapProfiles</a>
  generators. Many thanks to them for open-sourcing their high quality models!
</footer>

<style>
  :global(body) {
    background: rgb(15, 23, 42);
    margin: 0 1rem;
  }
  h2 {
    --at-apply: 'text-teal-300 text-3xl mt-12 mx-2 mb-6';
  }
  .parts-grid {
    --at-apply: 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 ';
  }
  .parts-grid.dev {
    --at-apply: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ';
  }
  .parts-grid-pad {
    --at-apply: 'mb-10';
  }
  .parts-grid-pad.dev {
    --at-apply: 'mb-20';
  }

  a[href]:not(.inline-block) {
    color: #f0abfc;
  }

  a[href]:not(.inline-block):hover {
    text-decoration: underline;
  }
</style>
