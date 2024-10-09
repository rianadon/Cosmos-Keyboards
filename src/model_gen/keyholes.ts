import { exec } from 'child_process'
import { readFile, writeFile } from 'fs/promises'
import { dirname } from 'path'
import { basicFaceExtrusion, drawCircle, FaceFinder, importSTEP, makeBaseBox, makeCylinder, Sketch, Solid, Vector } from 'replicad'
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

/** The hotswap sockets combine the regular mx sockets with the generated
 *  hotswap plate. There is a small gap between these, so I "loft" the
 *  two parts together by extruding the bottom of the mx socket downwards.
 */
async function generateHotswapKey(name: string, ...options: any[]) {
  const topFile = await readFile(`src/assets/key-mx-better.step`)
  const top = await importSTEP(new Blob([topFile])) as Solid
  const moveFace = new FaceFinder().inPlane('XY', -4.7).find(top)[0]
  const extrude = basicFaceExtrusion(moveFace, new Vector([0, 0, -1.15]))

  const gen = await import('../../target/gen-keyholes.cjs')
  const inst = gen.makeHotswapHolder(modeling, ...options)
  const bottom = modeling.compute(inst).translateZ(-5)

  // Cylinders to provide a smooth transition to the diode hole
  const c1Top = drawCircle(0.45).translate(6.55, -1.5).sketchOnPlane('XY', -3.5) as Sketch
  const c1Bottom = drawCircle(0.75).translate(6.85, -1.5).sketchOnPlane('XY', -6.15) as Sketch
  const c1 = c1Bottom.loftWith(c1Top)
  const c2Top = drawCircle(0.5).translate(6.5, 6.5).sketchOnPlane('XY', -3.5) as Sketch
  const c2Bottom = drawCircle(0.75).translate(6.55, 6.75).sketchOnPlane('XY', -6.15) as Sketch
  const c2 = c2Bottom.loftWith(c2Top)

  const model = top.fuse(extrude).fuse(bottom).cut(c1).cut(c2).rotate(180, [0, 0, 1])
  const file = modeling.serialize(name, model)
  await writeFile(`target/key-${name}.step`, file)
}

async function main() {
  await setup()
  await modeling.loadManifold()

  console.log('Compiling ClojureScript...')
  // await promisify(exec)('lein cljsbuild once keyholes', {
  //   cwd: dirname(fileURLToPath(import.meta.url)),
  // })

  await Promise.all([
    // generateMXPCB(),
    // generateChoc(),

    generateHotswapKey('mx-hotswap-kailh', 4.1, 4.815, 6.1, 3.815), // For MX?
    generateHotswapKey('mx-hotswap-outemu', 4.6, 4.35, 4.6, 3.0), // For outemu
    generateHotswapKey('mx-hotswap-gateron', 4.5, 4.55, 6.0, 3.8), // For gateron
    generateKey('old-box', { switchType: 'box' }),
    generateKey('old-mx', { switchType: 'mx' }),
    generateKey('old-mxSnapIn', { switchType: 'mxSnapIn' }),
    generateKey('old-alps', { switchType: 'alps' }),
    generateKey('old-choc', { switchType: 'choc' }),
    generateKey('old-box-hotswap', { switchType: 'box', useHotswap: true }),
    generateKey('old-mx-hotswap', { switchType: 'mx', useHotswap: true }),
    generateKey('old-mxSnapIn-hotswap', { switchType: 'mxSnapIn', useHotswap: true }),
    generateKey('choc-hotswap', { switchType: 'choc', useHotswap: true }),
  ])
}

main()
