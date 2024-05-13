<script lang="ts">
  import 'uno.css'
  import '@unocss/reset/tailwind.css'
  import '$lib/fonts.css'
  import { browser } from '$app/environment'
  import { trackPageView } from '$lib/telemetry'

  if (browser) trackPageView()
</script>

<slot />

<style>
  :global(.bg-brand-dark) {
    background: #17171d;
  }
</style>
