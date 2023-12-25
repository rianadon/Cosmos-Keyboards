import { exec } from 'child_process'
import { writeFile } from 'fs/promises'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { promisify } from 'util'
import * as modeling from './modeling'
import { setup } from './node-model'

// async function generateMXPCB() {
//     const ops = await parse("src/assets/key_hole.csg.scad")
//     console.log(stringifyOperation(ops))
//     const model = compute(ops)
//     const file = serialize("key_hole", model)
//     await writeFile(`target/key-mx-pcb.step`, file)
// }

// async function generateChoc() {
//     const ops = await parse("src/assets/choc_hole_final.csg")
//     console.log(stringifyOperation(ops))
//     const model = compute(ops)
//     const file = serialize("choc", model)
//     await writeFile(`target/key-choc.step`, file)
//     const file2 = serialize2("choc", model)
//     await writeFile(`target/key-choc.txt`, file2)
//     const file3 = serialize3("choc", model)
//     await writeFile(`target/key-choc.bin`, file3)
// }

async function generateKey(name: string, options: any) {
  const gen = await import('../../target/gen-keyholes.cjs')
  const inst = gen.singlePlate(modeling, options)
  // console.log(JSON.stringify(inst, null, 2))
  const model = modeling.compute(inst).translateZ(-5)
  const file = modeling.serialize(name, model)
  await writeFile(`target/key-${name}.step`, file)
}

async function main() {
  await setup()

  console.log('Compiling ClojureScript...')
  await promisify(exec)('lein cljsbuild once keyholes', {
    cwd: dirname(fileURLToPath(import.meta.url)),
  })

  await Promise.all([
    // generateMXPCB(),
    // generateChoc(),
    generateKey('box', { switchType: 'box' }),
    generateKey('mx', { switchType: 'mx' }),
    generateKey('mxSnapIn', { switchType: 'mxSnapIn' }),
    generateKey('alps', { switchType: 'alps' }),
    generateKey('choc', { switchType: 'choc' }),
    generateKey('box-hotswap', { switchType: 'box', useHotswap: true }),
    generateKey('mx-hotswap', { switchType: 'mx', useHotswap: true }),
    generateKey('mxSnapIn-hotswap', { switchType: 'mxSnapIn', useHotswap: true }),
    generateKey('choc-hotswap', { switchType: 'choc', useHotswap: true }),
  ])
}

main()
