<script lang="ts">
  import type { Statistics } from './stats'

  export let stat: Statistics

  $: means = Object.values(stat.means).flat()
  $: stds = Object.values(stat.stds).flat()
</script>

<pre>
<b>Distance / SD</b>
{means.map((x, i) => (x * 100).toFixed(2) + ' / ' + (stds[i] * 100).toFixed(2)).join('\n')}
</pre>
