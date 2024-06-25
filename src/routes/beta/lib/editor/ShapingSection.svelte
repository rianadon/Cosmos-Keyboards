<script lang="ts">
  import type { FieldSchema } from '../schema'
  import FloatInput from './FloatInput.svelte'
  import Field from './Field.svelte'
  import ShapingTable from './ShapingTable.svelte'
  import presetDefault from '$assets/presets/manuthumb.default.json'
  import presetFive from '$assets/presets/manuthumb.five.json'
  import presetWacky from '$assets/presets/manuthumb.wacky.json'
  import manuform from '$assets/manuform.json'

  export let state: object
  export let schema: FieldSchema

  const ML_THUMBS = ['six', 'four', 'three', 'three-mini']
  const MR_THUMBS = ['six', 'five', 'four']
  const BL_THUMBS = ['six', 'five']
  const BR_THUMBS = ['six', 'five']

  function loadPreset(preset: object) {
    state.shaping = { ...state.shaping, ...preset }
  }

  $: cols = state.keys?.columns
  $: thumbs = state.keys?.thumbCount
  $: sEn = state.shaping?.stagger
  $: staggerEnabled = [true, sEn && cols > 1, sEn && cols > 2, sEn && cols > 3, sEn && cols > 4]
  $: staggerStyle = staggerEnabled.map((x) => (x ? '' : 'opacity-30'))
</script>

<div class="mt-4 lg:flex justify-between items-baseline">
  <div class="mb-2 mr-4">Shaping Preset</div>
  <div>
    <button class="preset" on:click={() => loadPreset(presetDefault)}>Default</button>
    <button class="preset" on:click={() => loadPreset(presetFive)}>5-Key</button>
    <button class="preset" on:click={() => loadPreset(presetWacky)}>Wacky?</button>
  </div>
</div>

{#each schema.fields.filter((f) => !f.special) as key}
  <Field defl={manuform.options.shaping[key.var]} schema={key} bind:value={state.shaping[key.var]} />
{/each}

<div class="w-full xs:w-[19rem] overflow-auto lg:w-full">
  <table class="mt-4">
    <thead>
      <tr>
        <th />
        <th
          colspan="4"
          class="text-left text-xl text-teal-500 dark:text-teal-300 font-semibold pb-1 pl-4">Stagger</th
        >
      </tr>
      <tr>
        <th />
        <th class="font-normal pb-0.5 pl-4 text-left {staggerStyle[0]}" :>Thumb</th>
        <th class="font-normal pb-0.5 pl-4 text-left {staggerStyle[1]}">Index</th>
        <th class="font-normal pb-0.5 pl-4 text-left {staggerStyle[2]}">Middle</th>
        <th class="font-normal pb-0.5 pl-4 text-left {staggerStyle[3]}">Ring</th>
        <th class="font-normal pb-0.5 pl-4 text-left {staggerStyle[4]}">Pinky</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th class="font-normal">X</th>
        <td class={staggerStyle[0]}
          ><FloatInput small bind:value={state.shaping.thumbClusterOffsetX} /></td
        >
        <td class="text-left px-5 {staggerStyle[1]}">0</td>
        <td class="text-left px-5 {staggerStyle[2]}">0</td>
        <td class="text-left px-5 {staggerStyle[3]}">0</td>
        <td class="text-left px-5 {staggerStyle[4]}">0</td>
      </tr>
      <tr>
        <th class="font-normal">Y</th>
        <td class={staggerStyle[0]}
          ><FloatInput small bind:value={state.shaping.thumbClusterOffsetY} /></td
        >
        <td class={staggerStyle[1]}><FloatInput small bind:value={state.shaping.staggerIndexY} /></td>
        <td class={staggerStyle[2]}><FloatInput small bind:value={state.shaping.staggerMiddleY} /></td>
        <td class={staggerStyle[3]}><FloatInput small bind:value={state.shaping.staggerRingY} /></td>
        <td class={staggerStyle[4]}><FloatInput small bind:value={state.shaping.staggerPinkyY} /></td>
      </tr>
      <tr>
        <th class="font-normal">Z</th>
        <td class={staggerStyle[0]}
          ><FloatInput small bind:value={state.shaping.thumbClusterOffsetZ} /></td
        >
        <td class={staggerStyle[1]}><FloatInput small bind:value={state.shaping.staggerIndexZ} /></td>
        <td class={staggerStyle[2]}><FloatInput small bind:value={state.shaping.staggerMiddleZ} /></td>
        <td class={staggerStyle[3]}><FloatInput small bind:value={state.shaping.staggerRingZ} /></td>
        <td class={staggerStyle[4]}><FloatInput small bind:value={state.shaping.staggerPinkyZ} /></td>
      </tr>
    </tbody>
  </table>

  {#if state.shaping.customThumbCluster}
    <ShapingTable level="Top" bind:states={state.shaping} />
    <ShapingTable
      level="Middle"
      bind:states={state.shaping}
      left={ML_THUMBS.includes(thumbs)}
      right={MR_THUMBS.includes(thumbs)}
    />
    <ShapingTable
      level="Bottom"
      bind:states={state.shaping}
      left={BL_THUMBS.includes(thumbs)}
      right={BR_THUMBS.includes(thumbs)}
    />
  {/if}
</div>

<style>
  .input-basic {
    --at-apply: 'focus:border-teal-500 border border-transparent text-gray-700 focus:outline-none';
    --at-apply: 'border-gray-200 dark:border-transparent bg-gray-100 dark:bg-gray-700 dark:text-gray-100';
  }

  .input {
    --at-apply: 'appearance-none w-[6.88rem] rounded ml-2.5';
    --at-apply: 'input-basic text-ellipsis';
  }

  .sinput {
    --at-apply: 'appearance-none w-[5.45rem] rounded ml-2.5';
    --at-apply: 'input-basic text-ellipsis';
  }

  input:focus + div > div {
    --at-apply: 'border-teal-500';
  }

  .preset {
    --at-apply: 'bg-[#99F0DC] dark:bg-gray-900 hover:bg-teal-500 dark:hover:bg-teal-700 dark:text-white py-1 px-4 rounded focus:outline-none border border-transparent focus:border-teal-500 mb-2';
  }
</style>
