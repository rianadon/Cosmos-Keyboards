<script lang="ts">
  import Icon from './Icon.svelte'
  import { mdiAlertCircleOutline } from '@mdi/js'
</script>

<div
  class="max-w-[32rem] text-sm mb-1 bg-pink-50 dark:bg-pink-400/10 dark:border-gray-900 mx-[-0.5rem] px-2 py-2 rounded flex gap-3 relative"
>
  <div>
    <Icon path={mdiAlertCircleOutline} size="20" class="text-pink-600" />
    <div
      class="absolute top-9 left-[calc(7px+0.5rem)] bottom-2 w-[6px] bg-pink-300 dark:bg-pink-600 rounded"
    />
  </div>
  <div class="opacity-80 dark:opacity-100">
    <slot />
  </div>
</div>
