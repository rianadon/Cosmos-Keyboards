<script lang="ts">
  // @ts-nocheck Unused file

  import { ManuformSchema } from '../schema'
  import { cuttleConfFromManuform, type CuttleformThree, type Manuform } from '$lib/worker/config'
  import Field from './Field.svelte'
  import ShapingSection from './ShapingSection.svelte'
  import manuform from '$assets/manuform.json'

  import presetErgodox from '$assets/presets/manuform.ergodox.json'
  import presetOriginal from '$assets/presets/manuform.tshort.json'
  import presetCorne from '$assets/presets/manuform.corne.json'
  import presetSmallest from '$assets/presets/manuform.smallest.json'
  import { createEventDispatcher } from 'svelte'

  export let manuformConf: Manuform
  export let conf: CuttleformThree

  $: conf = cuttleConfFromManuform(manuformConf)

  const dispatch = createEventDispatcher()

  function loadPreset(preset: any) {
    dispatch(
      'preset',
      JSON.parse(
        JSON.stringify({
          ...manuform.options,
          ...preset.options,
        })
      )
    )
  }
</script>

<h2 class="text-2xl text-teal-500 dark:text-teal-300 font-semibold mb-2">Presets</h2>
<div class="lg:flex justify-between items-baseline w-64 md:w-auto">
  <div class="mb-2 mr-4">Manuform</div>
  <div>
    <button class="preset" on:click={() => loadPreset(presetCorne)}>Corne</button>
    <button class="preset" on:click={() => loadPreset(presetSmallest)}>Smallest</button>
    <button class="preset" on:click={() => loadPreset(presetErgodox)}>Ergodox</button>
    <button class="preset" on:click={() => loadPreset(presetOriginal)}>Original</button>
  </div>
</div>

{#each ManuformSchema as section}
  <div class="mt-8">
    <h2 class="text-2xl text-teal-500 dark:text-teal-300 font-semibold mb-2 capitalize">
      {section.name}
    </h2>
    {#if section.var == 'shaping'}
      {#if manuformConf.shaping}
        <!-- <ShapingSection state={manuformConf} schema={section} /> -->
      {/if}
    {:else}
      {#each section.fields as key}
        <Field
          defl={manuform.options[section.var][key.var]}
          schema={key}
          bind:value={manuformConf[section.var][key.var]}
        />
      {/each}
    {/if}
  </div>
{/each}

<style>
  .preset {
    --at-apply: 'bg-[#99F0DC] dark:bg-gray-900 hover:bg-teal-500 dark:hover:bg-teal-700 dark:text-white py-1 px-4 rounded focus:outline-none border border-transparent focus:border-teal-500 mb-2';
  }
</style>
