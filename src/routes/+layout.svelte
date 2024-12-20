<script lang="ts">
  import '@unocss/reset/tailwind.css'
  import 'uno.css'
  import '$lib/fonts.css'
  import { browser } from '$app/environment'
  import { afterNavigate } from '$app/navigation'
  import { trackPageView } from '$lib/telemetry'

  afterNavigate(({ to, from }) => {
    if (from && from.url) {
      trackPageView(from.url.pathname)
    }
  })

  if (browser) trackPageView()
</script>

<slot />

<style>
  :global(.bg-brand-dark) {
    background: #17171d;
  }
</style>
