import type { ShapeMesh } from 'replicad'
import { Box3, BufferAttribute, BufferGeometry, Vector3 } from 'three'

export function fromGeometry(geometry: ShapeMesh | undefined | null) {
  if (!geometry) return undefined

  const geo = new BufferGeometry()

  const positions = new Float32Array(geometry.vertices)
  const normals = new Float32Array(geometry.normals)

  geo.setAttribute('position', new BufferAttribute(positions, 3))
  geo.setAttribute('normal', new BufferAttribute(normals, 3))

  if (geometry.triangles) {
    const indices = new Uint16Array(geometry.triangles)
    geo.setIndex(new BufferAttribute(indices, 1))
  }

  return geo
}

type TransformedGeometry = {
  mesh: THREE.BufferGeometry
  matrix: THREE.Matrix4
}

export function boundingSize(geometry: (THREE.BufferGeometry | TransformedGeometry)[]) {
  const size = new Vector3()
  const boundingBox = new Box3(new Vector3(-0.1, -0.1, -0.1), new Vector3(0.1, 0.1, 0.1))
  for (const g of geometry) {
    if ('matrix' in g) {
      g.mesh.computeBoundingBox()
      g.mesh.boundingBox!.applyMatrix4(g.matrix)
      boundingBox.union(g.mesh.boundingBox!)
    } else {
      g.computeBoundingBox()
      boundingBox.union(g.boundingBox!)
    }
  }
  boundingBox.getSize(size)
  return size
}
