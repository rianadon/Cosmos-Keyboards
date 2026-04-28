<script lang="ts">
  /** Utility that gives you the color scheme. **/

  export let darkMode: boolean

  import { onMount } from 'svelte'

  const onChange = (e: any) => (darkMode = e.matches)

  onMount(() => {
    const matcher = window.matchMedia('(prefers-color-scheme: dark)')
    darkMode = matcher.matches

    matcher.addEventListener('change', onChange)
    return () => matcher.removeEventListener('change', onChange)
  })
</script>
