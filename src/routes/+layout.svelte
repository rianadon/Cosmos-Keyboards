<script lang="ts">
  import 'uno.css'
  import '@unocss/reset/tailwind.css'
  import { browser } from '$app/environment'

  if (browser)
    fetch('https://analytics.ryanis.cool', {
      method: 'POST',
      body: JSON.stringify({
        url: window.location.href,
        language: window.navigator.language,
        referrer: document.referrer,
      }),
    }).catch(() => {})
</script>

<slot />
