import { readFile } from 'fs/promises'
import { join } from 'path'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'
import { fileURLToPath } from 'url'
import exportGLTF from './exportGLTF'

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

async function main() {
  await genPart('switch-cherry-mx')
}

main()
