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

export function boundingSize(geometry: THREE.BufferGeometry[]) {
  const size = new Vector3()
  const boundingBox = new Box3(new Vector3(-0.1, -0.1, -0.1), new Vector3(0.1, 0.1, 0.1))
  for (const g of geometry) {
    g.computeBoundingBox()
    boundingBox.union(g.boundingBox!)
  }
  boundingBox.getSize(size)
  return size
}
