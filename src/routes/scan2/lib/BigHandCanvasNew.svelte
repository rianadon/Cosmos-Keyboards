<script lang="ts">
  import {
    Vector3,
    type Mesh,
    type Object3D,
    type Vector3Tuple,
    BufferAttribute,
    SkinnedMesh,
    Matrix4,
    Euler,
  } from 'three'
  import handModel from '$assets/hand.glb?url'
  import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader'
  import type { Hand, SolvedHand } from 'src/routes/scan2/lib/hand'

  export let lines2D: Vector3Tuple[][] = []
  export let positions: Record<string, Vector3[]>

  export let AR2Screen: Matrix4
  export let canvas: HTMLCanvasElement
  export let width: number
  export let height: number
  export let solved: SolvedHand
  export let handy: Hand
  export let tslu: number

  $: if (canvas) canvas.width = width
  $: if (canvas) canvas.height = height

  $: if (canvas && lines2D && width && height) draw()
  //   $: if (canvas && lines2D && width && height && hand && solved) draw()

  const loader = new GLTFLoader()
  loader.loadAsync(handModel).then(process)

  let hand: SkinnedMesh
  let nodes: Record<string, Object3D>
  function process(g: GLTF) {
    nodes = {}
    g.scene.traverse((obj) => (nodes[obj.name] = obj))
    console.log(nodes.Hand)
    hand = nodes.Hand as SkinnedMesh
    console.log(hand)
  }

  function draw2() {
    const baseMatrix = new Matrix4().makeRotationFromEuler(new Euler(-Math.PI / 2, 0, -Math.PI / 2))
    Object.entries(solved.localTransforms(baseMatrix, 1 / 200)).forEach(([finger, transforms]) => {
      transforms.forEach((matrix, i) => {
        const node = nodes[finger + i]
        matrix.decompose(node.position, node.quaternion, node.scale)
        node.updateMatrixWorld()
      })
    })

    const vertices = hand.geometry.attributes.position as BufferAttribute
    const v = new Vector3()

    const collected: Vector3[] = []
    const bi = handy.basis.clone().invert()
    for (let i = 0; i < vertices.count; i++) {
      v.fromBufferAttribute(vertices, i)
      if (false || Math.abs(v.y) < 0.01) {
        hand.getVertexPosition(i, v).applyMatrix4(bi)
        collected.push(v.clone())
      }
    }

    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = 'red'
    console.log(handy.vectors[0])
    const center = handy.vectors[0]
    console.log(handy.vectors)
    console.log('cent', center)
    const AR2Screen2 = AR2Screen.clone().invert()
    for (const c of collected) {
      const vec = new Vector3(c.y * 200 + center.x, c.z * 200 - center.y, 0)
      console.log(vec.x, vec.y)
      //   console.log(vec.x, vec.y)
      ctx.fillRect(vec.x, vec.y, 10, 10)
    }

    // draw()
  }

  function draw() {
    console.log(positions, lines2D)
    console.log('DRAWING', lines2D)
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.strokeStyle = 'white'
    ctx.lineWidth = 100
    ctx.fillStyle = 'blue'
    ctx.lineCap = 'round'
    for (const line of lines2D) {
      ctx.beginPath()
      ctx.moveTo(line[0][0], line[0][1])
      for (let i = 1; i < line.length; i++) {
        ctx.lineTo(line[i][0], line[i][1])
      }
      ctx.stroke()
    }
  }

  $: opacity = Math.min(Math.max(0, 1 - (tslu - 500) / 2000), 1)
</script>

<canvas
  class="fixed bottom-0 left-0 right-0 w-full h-full top-0"
  bind:this={canvas}
  style="opacity: {opacity * 100}%"
/>
