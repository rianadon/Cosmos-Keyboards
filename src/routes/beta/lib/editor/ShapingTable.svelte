<script lang="ts">
  import AngleInput from './AngleInput.svelte'
  import FloatInput from './FloatInput.svelte'

  export let level: string
  export let states: object
  export let left = true
  export let right = true

  const COMPONENTS = ['X', 'Y', 'Z']

  $: leftStyle = left ? '' : 'opacity-30'
  $: rightStyle = right ? '' : 'opacity-30'
</script>

<table class="mt-4">
  <thead>
    <tr>
      <th />
      <th
        colspan="2"
        class="text-xl text-teal-500 dark:text-teal-300 font-semibold pb-1 text-left pl-4 {leftStyle}"
        >{level} Left</th
      >
      <th
        colspan="2"
        class="text-xl text-teal-500 dark:text-teal-300 font-semibold pb-1 text-left pl-4 {rightStyle}"
        >{level} Right</th
      >
    </tr><tr>
      <th />
      <th class="font-normal pb-0.5 pl-4 text-left {leftStyle}">Offset</th>
      <th class="font-normal pb-0.5 pl-4 text-left {leftStyle}">Tenting</th>
      <th class="font-normal pb-0.5 pl-4 text-left {rightStyle}">Offset</th>
      <th class="font-normal pb-0.5 pl-4 text-left {rightStyle}">Tenting</th>
    </tr>
  </thead>
  <tbody>
    {#each COMPONENTS as component}
      <tr>
        <th class="font-normal {leftStyle}">{component}</th>
        <td class={leftStyle}
          ><FloatInput bind:value={states['thumb' + level + 'LeftOffset' + component]} /></td
        >
        <td class={leftStyle}
          ><AngleInput small bind:value={states['thumb' + level + 'LeftTenting' + component]} /></td
        >
        <td class={rightStyle}
          ><FloatInput bind:value={states['thumb' + level + 'RightOffset' + component]} /></td
        >
        <td class={rightStyle}
          ><AngleInput
            small
            bind:value={states['thumb' + level + 'RightTenting' + component]}
          /></td
        >
      </tr>
    {/each}
  </tbody>
</table>

<style>
  .input-basic {
    --at-apply: 'focus:border-teal-500 border border-transparent text-gray-700 focus:outline-none';
    --at-apply: 'border-gray-200 dark:border-transparent bg-gray-100 dark:bg-gray-700 dark:text-gray-100';
  }

  .input {
    --at-apply: 'appearance-none w-[6.88rem] rounded ml-2.5';
    --at-apply: 'input-basic text-ellipsis';
  }
</style>
