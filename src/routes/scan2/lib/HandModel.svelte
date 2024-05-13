<script lang="ts">
  import type { SolvedHand } from './hand'
  import { Three } from '@threlte/core'
  import { useGltf } from '@threlte/extras'
  import handModel from '../hand.glb?url'
  import { Euler, Matrix4, MeshStandardMaterial, type Vector3Tuple } from 'three'

  export let scale = 6.67
  export let reverse = false
  export let position: Vector3Tuple = [0, 0, 0]

  export let hand: SolvedHand

  const handMesh = useGltf(handModel).gltf

  $: if ($handMesh) {
    const baseMatrix = new Matrix4().makeRotationFromEuler(new Euler(-Math.PI / 2, 0, -Math.PI / 2))
    if (reverse) baseMatrix.premultiply(new Matrix4().makeScale(1, 1, -1))

    Object.entries(hand.localTransforms(baseMatrix, 0.1 / scale)).forEach(
      ([finger, transforms]) => {
        transforms.forEach((matrix, i) => {
          const node = $handMesh!.nodes[finger + i]
          matrix.decompose(node.position, node.quaternion, node.scale)
        })
      }
    )
  }
  $: if ($handMesh) $handMesh!.nodes.Hand.material = new MeshStandardMaterial({ color: 0x1e293b })
</script>

{#if $handMesh}
  <Three
    type={$handMesh.nodes['Hand_Armature']}
    scale={[scale, scale, reverse ? -scale : scale]}
    {position}
  />
{/if}
