<script lang="ts">
  export let name: string | undefined = undefined
  export let selected = false
  export let purple = false
  export let square = false
  export let gray = false

  export let button: HTMLButtonElement = undefined as any

  let clazz = ''
  export { clazz as class }
</script>

<button
  class="preset {clazz}"
  class:selected
  class:purple
  class:square
  class:gray
  on:click
  on:focus
  on:blur
  bind:this={button}><slot>{name}</slot></button
>

<style>
  .preset {
    --at-apply: 'bg-[#99F0DC] dark:bg-gray-900 hover:bg-teal-400 dark:hover:bg-teal-900 dark:text-white py-1 px-4 rounded focus:outline-none border border-transparent focus:border-teal-500';
  }
  .preset.selected {
    --at-apply: 'bg-teal-500 dark:bg-teal-700';
  }

  .purple {
    --at-apply: 'bg-purple-300 dark:bg-gray-900 hover:bg-purple-400 dark:hover:bg-pink-900 focus:border-pink-500';
  }
  .purple.selected {
    --at-apply: 'bg-purple-400 dark:bg-pink-700';
  }

  .gray {
    --at-apply: 'bg-slate-200 dark:bg-gray-900 hover:bg-slate-300 dark:hover:bg-gray-800';
  }

  .square {
    --at-apply: 'px-2';
  }
</style>
