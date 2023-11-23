<script lang="ts">
  import { setup } from 'svelte-cubed/utils/context'
  import { AxesHelper, Matrix4 } from 'three'

  export let size = 1
  export let matrix = new Matrix4()

  const { self, parent, root } = setup(new AxesHelper(size))

  $: {
    matrix.decompose(self.position, self.rotation, self.scale)
    root.invalidate()
  }
</script>
