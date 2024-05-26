<script lang="ts">
  import { interactivity } from '@threlte/extras'
  import { setContext } from 'svelte'

  const context = interactivity({
    filter: (hits, state) => {
      // Only return the first hit
      return hits.slice(0, 1)
    },
  })
  setContext('interactivity', context)
</script>

<slot />
