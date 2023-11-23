import { Document, Logger, NodeIO, Primitive } from '@gltf-transform/core'
import { reorder, weld } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'
import type { BufferGeometry } from 'three'

export default async function exportGLTF(glbName: string, geometry: BufferGeometry) {
  const io = new NodeIO()
  const doc = new Document()
  doc.setLogger(new Logger(Logger.Verbosity.ERROR))

  const attr = (name: string) => (geometry.attributes[name] as any).array

  const buffer = doc.createBuffer()
  const position = doc.createAccessor().setArray(attr('position')).setType('VEC3').setBuffer(buffer)
  const normal = doc.createAccessor().setArray(attr('normal')).setType('VEC3').setBuffer(buffer)
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', position)
    .setAttribute('NORMAL', normal)
    .setMode(Primitive.Mode.TRIANGLES)

  const mesh = doc.createMesh().addPrimitive(prim)
  const node = doc.createNode().setMesh(mesh)
  doc.createScene().addChild(node)
  doc.transform(
    weld(),
    reorder({ encoder: MeshoptEncoder, target: 'size' }),
  )

  await io.write(glbName, doc)
}
