import type { CuttleKey, Geometry } from '$lib/worker/config'
import type { Cuttleform } from 'target/proto/cuttleform'
import { type BufferAttribute, BufferGeometry, Group, Matrix4, Triangle, Vector3 } from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'
import sockets from '../../../target/sockets-simple.json'
import { ITriangle } from './simplekeys'

function socket(name: keyof typeof sockets) {
  const loader = new STLLoader()
  const data = Uint8Array.from(atob((sockets as any)[name]), c => c.charCodeAt(0))
  return loader.parse(data.buffer)
}

export function simpleSocketGeos(type: CuttleKey['type']): BufferGeometry[] {
  if (type == 'mx-pcb') return [socket('mx'), socket('amoeba-king')]
  if (type.startsWith('mx') || type.startsWith('old-mx')) return [socket('mx')]
  if (type == 'choc' || type == 'choc-hotswap') return [socket('choc')]
  return []
}

export function simpleSocketTris(type: CuttleKey['type'], position: Matrix4, index: number) {
  const geos = simpleSocketGeos(type)
  return geos.flatMap(geo => {
    const positions = geo.attributes.position as BufferAttribute
    const triangles: Triangle[] = []
    for (let i = 0; i < positions.array.length; i += 9) {
      triangles.push(
        new ITriangle(
          new Vector3().fromArray(positions.array, i).applyMatrix4(position),
          new Vector3().fromArray(positions.array, i + 3).applyMatrix4(position),
          new Vector3().fromArray(positions.array, i + 6).applyMatrix4(position),
          index,
        ),
      )
    }
    return triangles
  })
}
