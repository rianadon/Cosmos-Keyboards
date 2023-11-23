<script>
  import { setup } from 'svelte-cubed/utils/context'
  import { Group, Matrix4 } from 'three'

  export let matrix = new Matrix4()
  export let renderOrder = 0

  const { root, self } = setup(new Group())

  $: {
    self.renderOrder = renderOrder
    matrix.decompose(self.position, self.quaternion, self.scale)
    root.invalidate()
  }
</script>

<slot />
