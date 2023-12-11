<script>
  import { browser } from '$app/environment'
  import App from './App.svelte'
</script>

{#if browser}
  <App />
{/if}
