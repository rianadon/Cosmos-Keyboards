<script lang="ts">
  import { setup } from 'svelte-cubed/utils/context'
  import { PerspectiveCamera, Vector3 } from 'three'

  export let fov = 45
  export let near = 0.1
  export let far = 2000
  export let zoom = 1

  interface ViewOffset {
    fullWidth: number
    fullHeight: number
    x: number
    y: number
    width: number
    height: number
  }
  export let viewOffset: ViewOffset | undefined = undefined

  export let target = [0, 0, 0] // TODO accept an object/vector?

  export let { root, self } = setup(new PerspectiveCamera())

  const target_vector = new Vector3()

  root.camera.set(self, (w, h) => {
    self.aspect = w / h
    self.updateProjectionMatrix()
  })

  $: {
    self.fov = fov
    self.near = near
    self.far = far
    self.zoom = zoom

    if (viewOffset) {
      self.setViewOffset(
        viewOffset.fullWidth,
        viewOffset.fullHeight,
        viewOffset.x,
        viewOffset.y,
        viewOffset.width,
        viewOffset.height
      )
    }

    target_vector.set(target[0], target[1], target[2])
    self.lookAt(target_vector)

    self.updateProjectionMatrix()
    root.invalidate()
  }
</script>
