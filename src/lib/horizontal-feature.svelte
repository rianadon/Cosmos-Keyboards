<script lang="ts">
  import { base } from '$app/paths'

  export let src: string
  export let alt: string

  let video: HTMLVideoElement

  export let reversed = false
</script>

<div
  class="rounded-2 mx-4 my-12 md:my-6 text-left flex justify-between items-center <sm:flex-col-reverse"
  class:sm:flex-row-reverse={reversed}
>
  <div class="py-4 px-10 flex-1">
    <h2 class="font-semibold text-xl font-sans mb-2"><slot name="title" /></h2>
    <div class="font-semibold mb-2 text-teal"><slot name="content" /></div>
    <div class="text-sm"><slot name="description" /></div>
  </div>
  {#if src}
    <div class="bg flex-0 w-64 h-64 p-10 md:w-96 md:h-96 md:p-16 m-[-1em]">
      {#if src.endsWith('png')}
        <img class="rounded-4" src={base + src} {alt} />
      {:else}
        <video autoplay muted loop bind:this={video} class="rounded-6">
          <source src={base + src} />
        </video>
      {/if}
    </div>
  {/if}
</div>

<style>
  .bg {
    background: url('/bgsquare3.png') no-repeat center / cover;
  }

  video {
    /* Hack for firefox */
    clip-path: inset(1px 1px);
  }
</style>
