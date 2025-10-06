<script lang="ts">
  import Icon from '$lib/presentation/Icon.svelte'
  import { encodeVariant, PART_INFO } from '$lib/geometry/socketsParts'

  $: icon = PART_INFO[option.value as keyof typeof PART_INFO]?.icon

  export let option: any
</script>

<div class="flex items-center gap-2">
  <Icon
    name={icon || 'switch'}
    class="size-4 inline pointer-events-none light:color-black/60 flex-none"
  />
  <span class="flex-auto truncate">{option.label}</span>
</div>
