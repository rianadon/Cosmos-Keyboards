<script lang="ts">
  import { base } from '$app/paths'

  export let src: string

  let video: HTMLVideoElement
  export let reversed = false
</script>

<div
  class="rounded-2 bg-slate-900 shadow-lg shadow-teal-800/20 mt-20 justify-between items-center flex-1 max-w-sm mx-auto"
  class:flex-row-reverse={reversed}
>
  {#if src}
    <div class="bg-slate-900 shadow-lg shadow-cyan-800/200 rounded-full w-52 h-52 p-8 mx-auto mt-[-3em]">
      <video autoplay muted loop bind:this={video} class="w-36">
        <source src={base + src.replace('mp4', 'mov')} type="video/quicktime" />
        <source src={base + src.replace('mp4', 'webm')} type="video/webm" />
        <source src={base + src} type="video/mp4" />
      </video>
    </div>
  {/if}
  <div class="px-10 pt-6 pb-10">
    <h2 class="font-semibold text-xl font-sans mb-2"><slot name="title" /></h2>
    <div class="text-sm"><slot name="content" /></div>
  </div>
</div>
