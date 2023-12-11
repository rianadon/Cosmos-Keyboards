import { Buffer, Document, Logger, NodeIO, Primitive } from '@gltf-transform/core'
import { reorder, weld } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'
import type { BufferGeometry } from 'three'

export function toGLTF(doc: Document, buffer: Buffer, geometry: BufferGeometry, name?: string) {
  const attr = (name: string) => (geometry.attributes[name] as any).array

  const position = doc.createAccessor().setArray(attr('position')).setType('VEC3').setBuffer(buffer)
  const normal = doc.createAccessor().setArray(attr('normal')).setType('VEC3').setBuffer(buffer)
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', position)
    .setAttribute('NORMAL', normal)
    .setMode(Primitive.Mode.TRIANGLES)

  if (geometry.index) {
    const indices = new Uint16Array(geometry.index.array)
    prim.setIndices(doc.createAccessor().setArray(indices).setType('SCALAR').setBuffer(buffer))
  }

  const mesh = doc.createMesh().addPrimitive(prim)
  const node = doc.createNode(name).setMesh(mesh)
  return node
}

export function newDoc() {
  const doc = new Document()
  doc.setLogger(new Logger(Logger.Verbosity.ERROR))
  return doc
}

export async function exportGLTF(glbName: string, geometry: BufferGeometry) {
  const io = new NodeIO()
  const doc = newDoc()
  const buf = doc.createBuffer()

  doc.createScene().addChild(toGLTF(doc, buf, geometry))
  doc.transform(
    weld(),
    reorder({ encoder: MeshoptEncoder, target: 'size' }),
  )

  await io.write(glbName, doc)
}
