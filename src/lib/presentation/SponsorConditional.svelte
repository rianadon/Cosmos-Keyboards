<script lang="ts">
  export let userPromise: Promise<any>
</script>

{#await userPromise then user}
  {#if user.sponsor}
    <slot name="yes" />
  {:else}
    <slot name="no" />
  {/if}
{:catch err}
  <slot name="no" />
{/await}
