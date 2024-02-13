/**
 * Like socketsLoader in the worker/ direcotry, but returns meshes instead of parts.
 */

import { socketSize } from '$lib/geometry/socketsParts'
import masses from '$target/part-masses.json'
import { BoxGeometry, BufferAttribute, BufferGeometry, InterleavedBufferAttribute } from 'three'
import type { Cuttleform, CuttleKey } from '../worker/config'
import type Trsf from '../worker/modeling/transformation'
import { makeAsyncCacher } from './cacher'
import loadGLTF from './gltfLoader'

type Mesh = {
  mesh: BufferGeometry
  mass: number
}

function copyBufferAttribute(b: BufferAttribute, dest: Float32Array, offset: number) {
  const bInterleaved = b as unknown as InterleavedBufferAttribute
  if (bInterleaved.isInterleavedBufferAttribute) {
    const off = bInterleaved.offset
    const stride = bInterleaved.data.stride
    const arr = bInterleaved.data.array as Float32Array
    for (let i = 0; i < bInterleaved.data.count; i++) {
      dest.set(arr.slice(off + i * stride, off + i * stride + 3), offset + i * 3)
    }
    return
  }
  dest.set(b.array, offset)
}

function mergeBufferGeometries(geos: BufferGeometry[]) {
  let lenIndex = 0
  for (const g of geos) {
    if (g.index == null) throw new Error('All geometries must be indexed')
    lenIndex += g.index.count
  }

  const indices = new Uint16Array(lenIndex)
  const positions = new Float32Array(lenIndex * 3)
  const normals = new Float32Array(lenIndex * 3)

  let offset = 0
  for (const g of geos) {
    const index = g.index!
    copyBufferAttribute(g.attributes['position'] as BufferAttribute, positions, offset * 3)
    copyBufferAttribute(g.attributes['normal'] as BufferAttribute, normals, offset * 3)
    if (offset == 0) indices.set(index.array, 0)
    else {
      for (let i = 0; i < index.count; i++) {
        indices[offset + i] = index.array[i] + offset
      }
    }
    offset += index.count
  }

  const g = new BufferGeometry()
  g.attributes['position'] = new BufferAttribute(positions, 3)
  g.attributes['normal'] = new BufferAttribute(normals, 3)
  g.setIndex(new BufferAttribute(indices, 1))
  return g
}

function boxGeo(width: number, height: number, depth: number) {
  return new BoxGeometry(width, height, depth)
}

const keyCacher = makeAsyncCacher(async (key: CuttleKey) => {
  if (key.type == 'blank') {
    return {
      mesh: boxGeo(key.size?.width ?? 18.5, key.size?.height ?? 18.5, 5).translate(0, 0, -2.5),
      mass: (key.size?.width ?? 18.5) * (key.size?.height ?? 18.5) * 5,
    }
  }
  return {
    mesh: await loadGLTF('/target/socket-' + key.type + '.glb'),
    mass: masses[key.type] || 0,
  }
})

const extendedKeyCacher = makeAsyncCacher(async (key: CuttleKey) => {
  let cacheKey = key.type
  if (key.type == 'blank') cacheKey += `-${key.size?.width}x${key.size?.height}`
  return extendPlate(await keyCacher(cacheKey, key), key)
})

function extendPlate(plate: Mesh, key: CuttleKey) {
  const size = socketSize(key)
  if (key.aspect == 1) return plate
  if ('trackball' in key) return plate

  if (key.aspect > 1) {
    const pad = size.x * (key.aspect - 1) / 2
    console.log(plate.mesh.attributes)
    return {
      mesh: mergeBufferGeometries([
        plate.mesh,
        boxGeo(pad, size.y, size.z).translate((size.x + pad) / 2, 0, -size.z / 2),
        boxGeo(pad, size.y, size.z).translate(-(size.x + pad) / 2, 0, -size.z / 2),
      ]),
      mass: plate.mass + 2 * pad * size.z,
    }
  } else {
    const pad = size.y * (key.aspect - 1) / 2
    return {
      mesh: mergeBufferGeometries([
        plate.mesh,
        boxGeo(size.x, pad, size.z).translate(0, (size.y + pad) / 2, -size.z / 2),
        boxGeo(size.x, pad, size.z).translate(0, -(size.y + pad) / 2, -size.z / 2),
      ]),
      mass: plate.mass + 2 * pad * size.z,
    }
  }
}

export async function keyHole(key: CuttleKey, trsf: Trsf) {
  let cacheKey = key.type + ':' + key.aspect
  if (key.type == 'blank') cacheKey += `-${key.size?.width}x${key.size?.height}`
  const model = await extendedKeyCacher(cacheKey, key)
  return {
    mesh: model.mesh.clone().applyMatrix4(trsf.Matrix4()),
    mass: model.mass,
  }
}

export async function keyHoleMeshes(c: Cuttleform, transforms: Trsf[]) {
  const keys = await Promise.all(transforms.map((t, i) => keyHole(c.keys[i], t)))
  return {
    mesh: mergeBufferGeometries(keys.map(k => k.mesh)),
    mass: keys.map(k => k.mass).reduce((a, b) => a + b),
  }
}
