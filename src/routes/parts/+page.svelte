<script lang="ts">
  import { base } from '$app/paths'
  import { allVariants, PART_INFO, sortedCategories } from '$lib/geometry/socketsParts'
  import Checkbox from '$lib/presentation/Checkbox.svelte'
  import { developer } from '$lib/store'
  import Part from './Part.svelte'
  import SharedRenderer from '$lib/3d/SharedRenderer.svelte'
  import { notNull, objKeys } from '$lib/worker/util'
  import * as flags from '$lib/flags'
  import Dialog from '$lib/presentation/Dialog.svelte'
  import type { CuttleKey } from '$target/cosmosStructs'
  import Description from './Description.svelte'

  export let expanded: CuttleKey['type'] | null = null
</script>

<svelte:head>
  <title>Parts - Cosmos Keyboard Generator</title>
  <link rel="canonical" href="https://ryanis.cool/cosmos/parts/" />
  <link rel="icon" href="{base}/favicon.png" />
</svelte:head>

<svelte:body class="bg-slate-900 mx-4" />

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
    The <span class="text-teal">teal regions</span> represent the boundary around the socket (where the
    adjacent walls will be located), and the
    <span class="text-red">red regions</span> represent the boundaries of the mating part (which are used
    to prevent the part from hitting the ground).
  </div>
{/if}

<SharedRenderer>
  <main class="max-w-6xl mx-auto">
    {#each sortedCategories as cat}
      <h2>{cat}</h2>
      <section class="parts">
        {#each notNull(objKeys(PART_INFO)).filter((v) => PART_INFO[v].category == cat && (flags.draftuc || !PART_INFO[v].draft) && v != 'blank') as p}
          <Part
            name={PART_INFO[p].partName}
            part={p}
            dev={$developer}
            on:expand={() => (expanded = p)}
          />
        {/each}
      </section>
    {/each}
  </main>

  {#if expanded}
    {@const info = PART_INFO[expanded]}
    <Dialog forceDark big on:close={() => (expanded = null)}>
      <span slot="title" class="">{info.partName}</span>
      <div slot="content" class="text-center text-white">
        <div class="mx-auto mb-4 cosmospartinfo text-sm max-w-prose">
          <Description description={info.description || ''} />
        </div>
        <div class="grid grid-cols-2">
          {#each allVariants(expanded) as variant}
            <Part
              name={'variants' in info
                ? Object.keys(info.variants)
                    .map((v) => variant[v])
                    .join(', ')
                : ''}
              part={expanded}
              {variant}
              dev={$developer}
              editable={false}
            />
          {/each}
        </div>
      </div>
    </Dialog>
  {/if}
</SharedRenderer>

<style>
  h2 {
    --at-apply: 'text-teal-300 text-3xl mt-12 mx-2 mb-6';
  }
  .parts {
    --at-apply: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ';
  }

  :global(.cosmospartinfo p) {
    --at-apply: 'mb-1';
  }
  :global(.cosmospartinfo a) {
    --at-apply: 'underline text-pink-400';
  }
</style>
