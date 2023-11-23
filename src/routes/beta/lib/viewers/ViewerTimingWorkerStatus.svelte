<script lang="ts">
  import type { PoolWorker } from '../workerPool'
  import Icon from '$lib/presentation/Icon.svelte'
  import * as mdi from '@mdi/js'

  export let worker: PoolWorker<unknown>

  const status = worker.availableStore
</script>

<Icon
  class="inline-block mx-2 mt-2 {$status ? 'text-green-500' : 'text-red-500'}"
  path={mdi.mdiCircle}
/>
