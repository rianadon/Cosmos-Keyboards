<script lang="ts">
  import type { CuttleformProto } from '$lib/worker/config'
  import type { FieldSchema } from './schema'
  import Field from './Field.svelte'

  export let name: string
</script>

<div class="mt-8">
  <h2 class="text-2xl text-teal-500 dark:text-teal-300 font-semibold mb-2 capitalize">{name}</h2>
  <slot name="preset" />
  <slot name="content" />
</div>
