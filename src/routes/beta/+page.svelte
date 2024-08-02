<script>
  import { base } from '$app/paths'
  import { browser } from '$app/environment'
  import App from './App.svelte'
  // import { hasPro } from '@pro/index'
  // import { getUser } from './lib/login'
  // import V3Dialog from './lib/dialogs/V3Dialog.svelte'
  // import { user } from '$lib/store'
</script>

<svelte:head>
  <title>Cosmos Keyboard Generator</title>
  <link rel="canonical" href="https://ryanis.cool/cosmos/" />
  <link rel="icon" href="{base}/favicon.png" />
</svelte:head>

<svelte:body class="bg-white dark:bg-gray-800 dark:text-white" />

{#if browser}
  <App />
{/if}
