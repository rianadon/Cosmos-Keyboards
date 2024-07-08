import type { ShapeMesh } from 'replicad'
import { Box3, BufferAttribute, BufferGeometry, type Matrix4, Vector3 } from 'three'

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
  mesh: BufferGeometry
  matrix: Matrix4
}

export function boundingBox(geometry: (BufferGeometry | TransformedGeometry)[]) {
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
  return boundingBox
}

export function boundingSize(geometry: (BufferGeometry | TransformedGeometry)[]) {
  const size = new Vector3()
  return boundingBox(geometry).getSize(size)
}

/** Smooth shade a mesh to produce a "flashy" look. Used for displays. */
export function makeFlashy(g: BufferGeometry) {
  const geometry = g.toNonIndexed()
  const vertices: string[] = []
  const normals: Vector3[] = []
  const index: number[] = []
  const position = geometry.getAttribute('position')
  const v = new Vector3()
  for (let i = 0; i < position.count; i++) {
    const pos = v.fromBufferAttribute(position, i).toArray().join(',')
    if (!vertices.includes(pos)) {
      v.toArray(position.array, vertices.length * 3)
      vertices.push(pos)
      normals.push(new Vector3())
    }
    index.push(vertices.indexOf(pos))
    normals[vertices.indexOf(pos)].add(v)
  }
  const normal = new Float32Array(normals.length * 3)
  normals.forEach((n, i) => n.normalize().toArray(normal, i * 3))

  geometry.setAttribute('normal', new BufferAttribute(normal, 3))
  geometry.setAttribute('position', new BufferAttribute(position.array.slice(0, vertices.length * 3), 3))
  geometry.setIndex(new BufferAttribute(new Uint16Array(index), 1))
  return geometry
}
