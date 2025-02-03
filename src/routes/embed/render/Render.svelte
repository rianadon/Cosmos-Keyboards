<script lang="ts">
  import { OrbitControls, Gizmo } from '@threlte/extras'
  import { T, useThrelte } from '@threlte/core'
  import { Color } from 'three'

  const { invalidate } = useThrelte()

  export let models: any[]
  export let cameraPosition: any

  let color = 'pink'
  let opacity = 1

  window.addEventListener('message', (ev) => {
    console.log('got message', ev)
    if (typeof ev.data?.color !== 'undefined' && ev.data.color.length) {
      color = ev.data.color[0]
      opacity = ev.data.color[1]
    }
  })

  $: console.log('coolor', color, opacity)

  $: {
    models.forEach((m) =>
      m.traverse((obj) => {
        if (obj.material) {
          if (obj.material.name == 'Keyboard') {
            obj.material.transparent = true
            obj.material.opacity = opacity
            obj.material.color.set(color)
          }
          if (obj.material.name == 'Switch Parts') obj.material.color.set(0.1, 0.1, 0.1)
        }
      })
    )
    invalidate()
  }
</script>

<T.PerspectiveCamera
  makeDefault
  fov={45}
  position={cameraPosition}
  up={[0, 0, 1]}
  on:create={({ ref }) => {
    ref.lookAt(0, 0, 0)
  }}
>
  <OrbitControls enableDamping dampingFactor={0.1} minPolarAngle={0} maxPolarAngle={Math.PI / 2} />
</T.PerspectiveCamera>

{#each models as model}
  <T is={model} />
{/each}

<T.DirectionalLight position={[0, 0, 10]} />
<T.DirectionalLight position={[0, 5, 5]} />
<T.AmbientLight args={[0xeeeeee]} />
