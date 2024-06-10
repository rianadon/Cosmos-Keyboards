<script lang="ts" generics="T">
  import Checkbox from './Checkbox.svelte'

  export let def: T
  export let value: T | undefined

  function onChange(e: Event) {
    value = (e.target as HTMLInputElement).checked ? def : undefined
  }
</script>

<Checkbox value={typeof value != 'undefined'} on:change={onChange} />
