<script lang="ts">
  import type { SolvedHand } from '../hand'
  import { type GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
  import handModel from '$assets/hand.glb?url'
  import { Euler, Matrix4, Mesh, MeshNormalMaterial, Object3D, type Vector3Tuple } from 'three'
  import { T } from '@threlte/core'

  export let scale = 66.7
  export let reverse = false
  export let position: Vector3Tuple = [0, 0, 0]
  export let rotation: Vector3Tuple = [0, 0, 0]

  export let hand: SolvedHand
  let handNodes: Record<string, Object3D>

  const loader = new GLTFLoader()
  loader.loadAsync(handModel).then((m) => (handNodes = buildSceneGraph(m)))

  function buildSceneGraph(g: GLTF) {
    const nodes: Record<string, Object3D> = {}
    g.scene.traverse((obj) => (nodes[obj.name] = obj))
    return nodes
  }

  $: if (handNodes) {
    // console.log(handMesh.nodes.Hand.material)
    // handMesh.nodes.Hand.material = new KeyMaterial(1, 1, 'frost')
    // handMesh.nodes.Hand.material = new KeyMaterial(1, 1, 'frost')
    ;(handNodes.Hand as Mesh).material = new MeshNormalMaterial({ transparent: true, opacity: 0.9 })
    const baseMatrix = new Matrix4().makeRotationFromEuler(new Euler(-Math.PI / 2, 0, -Math.PI / 2))
    if (reverse) baseMatrix.premultiply(new Matrix4().makeScale(1, 1, -1))

    Object.entries(hand.localTransforms(baseMatrix, 1000 / scale)).forEach(
      ([finger, transforms]) => {
        transforms.forEach((matrix, i) => {
          const node = handNodes[finger + i]
          matrix.decompose(node.position, node.quaternion, node.scale)
        })
      }
    )
  }

  $: if (handNodes) {
    handNodes.Hand_Armature.rotation.set(rotation[0] || 0, rotation[1] || 0, rotation[2] || 0)
  }
</script>

{#if handNodes}
  <T is={handNodes['Hand_Armature']} scale={[scale, scale, reverse ? -scale : scale]} {position} />
{/if}
