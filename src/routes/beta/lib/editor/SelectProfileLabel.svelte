<script lang="ts">
  import { type Profile } from '$target/cosmosStructs'

  const profileURLs = import.meta.glob(['$target/keycap-*.png'], { query: '?url', eager: true })

  const thumbURL = (p: Exclude<Profile, null>) =>
    (profileURLs[`/target/keycap-${p}-thumb.png`] as any)?.default as string

  export let option: any
</script>

<img
  src={thumbURL(option.value)}
  class="size-4 inline mr-0.5 align-baseline pointer-events-none light:(filter-invert opacity-60)"
/>
<span>{option.label}</span>
