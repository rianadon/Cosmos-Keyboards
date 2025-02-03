<script lang="ts">
  import { base } from '$app/paths'

  import Loading from './Loading.svelte'
</script>

<div class="w-full aspect-1.5">
  {#await import('./RenderWrapperInner.svelte')}
    <Loading step={1} />
  {:then render}
    <svelte:component this={render.default} />
  {:catch e}
    Error loading keyboard render module
  {/await}
</div>

<a
  href="{base}/"
  target="_parent"
  class="absolute right-4 bottom-1 font-urbanist flex items-center text-lg"
>
  <div class="icon" />
  Cosmos
</a>

<style>
  .icon {
    background: url('/favicon.png');
    background-size: contain;
    --at-apply: 'w-5 h-5';
    margin-right: 0.7rem;
    margin-top: -0.1rem;
  }
</style>
