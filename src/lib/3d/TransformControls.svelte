<script lang="ts">
  import { setup } from 'svelte-cubed/utils/context'
  import { TransformControls } from 'three/examples/jsm/controls/TransformControls'
  import {
    Camera,
    DoubleSide,
    Matrix4,
    Mesh,
    MeshNormalMaterial,
    Object3D,
    PlaneGeometry,
    Vector3,
  } from 'three'
  import { createEventDispatcher, getContext, onDestroy } from 'svelte'
  import { transformMode } from '$lib/store'
  import type { Writable } from 'svelte/store'

  export let transformation: THREE.Matrix4
  export let center: [number, number, number]
  export let plane: boolean | string
  export let flip: boolean
  export let fixed = false

  const camera: Writable<Camera> = getContext('camera')

  const dispatch = createEventDispatcher()

  const obj =
    plane === true
      ? new Mesh(new PlaneGeometry(40, 64.72), new MeshNormalMaterial({ side: DoubleSide }))
      : new Object3D()
  const { self, parent, root } = setup(obj)

  const controls = new TransformControls($camera, root.renderer.domElement)
  controls.size = plane ? 1.2 : 0.8
  controls.space = plane ? 'world' : 'local'
  controls.attach(self)

  parent.add(controls)
  root.invalidate()

  onDestroy(() => {
    parent.remove(controls)
    controls.dispose()
    root.invalidate()
  })

  controls.addEventListener('change', () => {
    root.invalidate()
  })

  controls.addEventListener('objectChange', () => {
    dispatch('move', new Matrix4().multiplyMatrices(worldTrInverse, self.matrixWorld))
  })

  controls.addEventListener('dragging-changed', (event) => {
    // (root.controls.object as any).enabled = ! event.value;
    if (event.value) (root.controls.object as any).enabled = false
    else requestAnimationFrame(() => ((root.controls.object as any).enabled = true))
  })

  controls.addEventListener('mouseUp', (event) => {
    dispatch('change', new Matrix4().multiplyMatrices(worldTrInverse, self.matrixWorld))
  })

  $: worldTr = new Matrix4()
    .makeTranslation(-center[0], -center[1], -center[2])
    .premultiply(new Matrix4().makeRotationAxis(new Vector3(1, 0, 0), -Math.PI / 2))
    .premultiply(new Matrix4().makeScale(flip ? -1 : 1, 1, 1))
  $: worldTrInverse = worldTr.clone().invert()

  $: {
    const trsf = new Matrix4().copy(transformation).premultiply(worldTr)

    trsf.decompose(self.position, self.quaternion, self.scale)
    root.invalidate()
  }

  $: if (!fixed && ($transformMode == 'translate' || $transformMode == 'rotate'))
    controls.setMode($transformMode)
</script>

<slot />
