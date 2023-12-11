import { fromGeometry } from '$lib/loaders/geometry'
import { KEY_URLS } from '$lib/worker/socketsLoader'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { importSTEP, makeBaseBox } from 'replicad'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'
import { fileURLToPath } from 'url'
import { PART_NAMES } from '../lib/geometry/socketsParts'
import { exportGLTF } from './exportGLTF'
import { setup } from './node-model'

const assetsDir = fileURLToPath(new URL('../assets', import.meta.url))
const targetDir = fileURLToPath(new URL('../../target', import.meta.url))

async function genPart(name: string) {
  const stlName = join(assetsDir, name + '.stl')
  const glbName = join(targetDir, name + '.glb')

  const loader = new STLLoader()
  const stl = await readFile(stlName)
  const geometry = loader.parse(stl.buffer)
  await exportGLTF(glbName, geometry)
}

async function loadSocket(name: string) {
  if (name == 'blank') return makeBaseBox(18.5, 18.5, 5).translateZ(-5)
  // @ts-ignore
  const file = await readFile('.' + KEY_URLS[name])
  return await importSTEP(new Blob([file]))
}

async function genSocket(name: string) {
  const glbName = join(targetDir, 'socket-' + name + '.glb')
  const model = await loadSocket(name)
  const mesh = model.mesh({ tolerance: 0.1, angularTolerance: 10 })
  model.delete()
  const geometry = fromGeometry(mesh)
  await exportGLTF(glbName, geometry!)
}

async function main() {
  await setup()

  await genPart('switch-cherry-mx')
  for (const socket of Object.keys(PART_NAMES)) {
    await genSocket(socket)
  }
}

main()
