<script lang="ts">
  import Icon from '$lib/presentation/Icon.svelte'
  import { mdiAlertCircleOutline } from '@mdi/js'

  export let description: string
</script>

{#each description.split('\n') as desc}
  {#if desc.startsWith('[warn]')}
    <div class="text-sm mb-1 bg-pink-900/50 mx-[-0.5rem] px-2 py-2 rounded flex gap-3 relative">
      <div>
        <Icon path={mdiAlertCircleOutline} size="20" class="text-pink-600" />
        <div class="absolute top-9 left-[calc(7px+0.5rem)] bottom-2 w-[6px] bg-pink-600 rounded" />
      </div>
      <div class="opacity-80 dark:opacity-100">
        {@html desc.substring(6)}
      </div>
    </div>
  {:else}
    <p class="opacity-80">{@html desc}</p>
  {/if}
{/each}
