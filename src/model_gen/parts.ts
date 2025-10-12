import type { OpenCascadeInstance } from '$assets/replicad_single'
import { fromGeometry, makeFlashy } from '$lib/loaders/geometry'
import type { Cuttleform, CuttleKey } from '$lib/worker/config'
import type { Assembly } from '$lib/worker/modeling/assembly'
import { filterObj, mapObjAsync, objKeys } from '$lib/worker/util'
import type { TrackballVariant } from '$target/cosmosStructs'
import { readFile, writeFile } from 'fs/promises'
import { basename, join } from 'path'
import { type AnyShape, drawRectangle, getOC, importSTEP, makeBaseBox, Solid } from 'replicad'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { fileURLToPath } from 'url'
import { allVariants, decodeVariant, PART_INFO, variantURL, variantURLs } from '../lib/geometry/socketsParts'
import type { PartInfo } from '../lib/geometry/socketsParts'
import { exportGLTF } from './exportGLTF'
import { importSTEPSpecifically, maybeStat, serialize } from './modeling'
import { setup } from './node-model'
import { type DisplayProps, displaySocketAndModel } from './parametric/display-gen'
import { DEFAULT_PROPS, type Holes, type MicrocontrollerProps, ucModel } from './parametric/microcontroller-gen'
import { trackballPart, trackballSocket } from './parametric/trackball-gen'
import { ProcessPool } from './processPool'

const assetsDir = fileURLToPath(new URL('../assets', import.meta.url))
const targetDir = fileURLToPath(new URL('../../target', import.meta.url))

async function genPart(name: string) {
  const stlName = join(assetsDir, name + '.stl')
  const glbName = join(targetDir, name + '.glb')

  const loader = new STLLoader()
  const stl = await readFile(stlName)
  const geometry = loader.parse(stl.buffer as ArrayBuffer)
  await exportGLTF(glbName, geometry)
}

async function writeModel(filename: string, model: AnyShape) {
  const step = serialize(basename(filename), model)
  model.delete()
  await writeFile(filename, step)
}

async function writeAssembly(filename: string, model: Assembly) {
  const step = await model.blobSTEP().arrayBuffer()
  model.delete()
  await writeFile(filename, new Uint8Array(step))
}

async function writeMesh(filename: string, model: AnyShape) {
  const oc = getOC() as OpenCascadeInstance
  const props = new oc.GProp_GProps_1()
  oc.BRepGProp.VolumeProperties_2(model.wrapped, props, 0.01, false, true)
  let mass = props.Mass()
  props.delete()
  // Flip all faces if mass is negative
  if (mass < 0) {
    mass = -mass
    model.wrapped.Reverse()
  }

  const mesh = model.mesh({ tolerance: 0.05, angularTolerance: 1 })
  model.delete()
  let geometry = fromGeometry(mesh)!
  if (filename.includes('oled') && (filename.includes('target/splitpart-') || filename.includes('target/switch-'))) {
    geometry = makeFlashy(geometry)
  }
  await exportGLTF(filename, geometry)
  return mass
}

function findStepFiles(socket: CuttleKey['type'], info: PartInfo): string[] {
  if (!('variants' in info)) return [info.stepFile]

  return variantURLs(socket).map(variantURL => info.stepFile.replace('.step', `${variantURL}.step`))
}

type Microcontroller = Exclude<Cuttleform['microcontroller'], null>

async function gatherSTEPFilesToSplit(prefix: '/src/assets' | '/target', warn: boolean) {
  // Skip parts with a specified part model
  const relevantParts = filterObj(PART_INFO, (_socket, info) => !('partOverride' in info) && info.stepFile.startsWith(prefix))
  // Check that the STEP files for these parts all contain a socket and part
  const results = await mapObjAsync(relevantParts, (info, socket) =>
    Promise.all(
      findStepFiles(socket, info).map(async stepFile => {
        const contents = await readFile('.' + stepFile, { encoding: 'utf-8' })
        const names = [...contents.matchAll(/PRODUCT\('(.*?)'/g)].map(m => m[1])
        const hasSocket = names.includes('Socket')
        const hasPart = names.includes('Part')
        if (warn && !(hasSocket && hasPart)) {
          console.error(`The STEP file for part ${socket}, ${info.stepFile} does not a specify a partOverride,`)
          console.error('so the file will be split into part and socket models based on component names in the assembly.')
          console.error('The following names are missing:')
          if (!hasPart) console.error(' - "Socket" for the socket')
          if (!hasPart) console.error(' - "Part" for the part')
          console.error(`Please rename the components ${JSON.stringify(names)} to "Part" and "Socket".`)
          console.error()
        }
        return hasSocket && hasPart
      }),
    ).then(t => t.every(success => success)))
  return { success: Object.values(results).every(sucess => sucess), toSplit: objKeys(results) }
}

async function main() {
  await setup()

  const pool = new ProcessPool()

  const microcontrollerCode = fileURLToPath(new URL('./parametric/microcontroller-gen.ts', import.meta.url))
  const displayCode = fileURLToPath(new URL('./parametric/display-gen.ts', import.meta.url))
  const partsCode = fileURLToPath(import.meta.url)

  const poolUC = (name: Microcontroller, opts: Partial<MicrocontrollerProps>, holes: Holes[]) => {
    const glbName = join(targetDir, name + '.glb')
    pool.addIfModified(name, glbName, [microcontrollerCode], async () => {
      await writeMesh(glbName, await ucModel(name, { ...DEFAULT_PROPS, ...opts }, holes))
    })
  }
  const poolDisplay = (name: CuttleKey['type'], opts: DisplayProps) => {
    const stepName = join(targetDir, 'key-' + name + '.step')
    pool.addIfModified(name, stepName, [displayCode], async () => {
      await writeAssembly(stepName, displaySocketAndModel(name, opts, 0))
    })
  }
  /** Add task to generate both Choc V1 and Choc V2 variants of a part. It should work given either variant as input. */
  const poolChocV1 = (name: string, v1Name: CuttleKey['type'], v2Name: CuttleKey['type'], leds = false) =>
    pool.add(name + ' socket', async () => {
      const stepFile = await readFile(join(assetsDir, 'key-' + name + '.step')) as any as ArrayBuffer
      const model = await importSTEP(new Blob([stepFile])) as Solid
      const variantV1 = leds ? variantURL({ type: v1Name, variant: decodeVariant(v1Name, 0) } as any) : ''
      const variantV2 = leds ? variantURL({ type: v2Name, variant: decodeVariant(v2Name, 0) } as any) : ''
      const stepV1 = join(targetDir, `key-${v1Name + variantV1}.step`.toLowerCase())
      const stepV2 = join(targetDir, `key-${v2Name + variantV2}.step`.toLowerCase())
      await writeModel(stepV2, model.clone().fuse(drawRectangle(18, 18).cut(drawRectangle(17.5, 16.5)).sketchOnPlane('XY').extrude(-2.2) as Solid))
      await writeModel(stepV1, model.intersect(makeBaseBox(17.5, 16.5, 100).translateZ(-50)))
      if (leds) {
        const newModel = model.rotate(180)
        const variantV1 = variantURL({ type: v1Name, variant: { ...decodeVariant(v1Name, 0), led: 'South LED' } } as any)
        const variantV2 = variantURL({ type: v2Name, variant: { ...decodeVariant(v2Name, 0), led: 'South LED' } } as any)
        const stepV1 = join(targetDir, `key-${v1Name + variantV1}.step`.toLowerCase())
        const stepV2 = join(targetDir, `key-${v2Name + variantV2}.step`.toLowerCase())
        await writeModel(stepV2, newModel.clone().fuse(drawRectangle(18, 18).cut(drawRectangle(17.5, 16.5)).sketchOnPlane('XY').extrude(-2.2) as Solid))
        await writeModel(stepV1, newModel.intersect(makeBaseBox(17.5, 16.5, 100).translateZ(-50)))
      }
    })

  type VariantWork = [Record<string, string>, Solid]
  type VariantFn = (v: VariantWork) => VariantWork[]
  const variantFile = (n: CuttleKey['type'], v: Record<string, string>) => join(targetDir, `key-${n + variantURL({ type: n, variant: v } as any)}.step`.toLowerCase())
  const poolVariants = (name: CuttleKey['type'], ...transformations: VariantFn[]) => {
    const input = join(assetsDir, 'key-' + name + '.step')
    const outputs = allVariants(name).map(v => variantFile(name, v))
    pool.addIfModified(name + ' socket', outputs, [input, partsCode], async () => {
      const stepFile = await readFile(input) as any as ArrayBuffer
      const inp: VariantWork[] = [[{}, await importSTEP(new Blob([stepFile])) as Solid]]
      const results = transformations.reduce((work, f) => work.flatMap(f), inp)
      await Promise.all(results.map(([v, m]) => writeModel(variantFile(name, v), m)))
    })
  }

  /** Add task to generate both north-facing and south-facing variants. Assumes the STEP is north-facing. */
  const ledWork = (reversed = false) => ([v, m]: VariantWork) => ([
    [{ ...v, led: 'North LED' }, reversed ? m.clone().rotate(180) : m.clone()],
    [{ ...v, led: 'South LED' }, reversed ? m.clone() : m.clone().rotate(180)],
  ] satisfies VariantWork[])

  const plumMXWork: VariantFn = ([v, m]) => [
    [{ ...v, guides: 'Inner & Bottom Guides' }, m.clone()],
    [{ ...v, guides: 'Inner Guides' }, m.clone().intersect(makeBaseBox(100, 100, 100).translateZ(-6.1)) as Solid],
    [{ ...v, guides: 'Bottom Guides' }, m.clone().cut(makeBaseBox(14, 14, 100).translateZ(-50)) as Solid],
  ]

  pool.add('Cherry MX Switch', () => genPart('switch-cherry-mx'))
  pool.add('ECQWGD001 Encoder', () => genPart('switch-evqwgd001'))
  pool.add('Joycon Joystick', () => genPart('switch-joystick-joycon-adafruit'))

  poolChocV1('choc', 'choc-v1', 'choc-v2')
  poolChocV1('choc-hotswap', 'choc-v1-hotswap', 'choc-v2-hotswap', true)
  poolVariants('mx-pcb-plum', ledWork())
  poolVariants('mx-skree', ledWork())
  poolVariants('mx-pumpkin', plumMXWork, ledWork())
  poolVariants('choc-pumpkin', ledWork(true))

  const defaults = { spacing: 2.54, diameter: 0.9 }
  poolUC('rp2040-black-usb-c-aliexpress', {}, [
    { start: 2.54, align: { side: 'left', offset: 2.54 }, ...defaults },
    { start: 2.54, align: { side: 'right', offset: 2.54 }, ...defaults },
  ])
  poolUC('promicro', { connector: 'micro-usb' }, [
    { start: 3.81, align: { side: 'left', offset: 1.27 }, ...defaults },
    { start: 3.81, align: { side: 'right', offset: 1.27 }, ...defaults },
  ])
  poolUC('promicro-usb-c', {}, [
    { start: 5.25, align: { side: 'left', offset: 1.53 }, ...defaults },
    { start: 5.25, align: { side: 'right', offset: 1.53 }, ...defaults },
  ])
  poolUC('waveshare-rp2040-zero', { fillet: 1 }, [
    { start: 1.59, align: { side: 'left', offset: 1.88 + 0.05 }, ...defaults },
    { start: 1.59, align: { side: 'right', offset: 1.88 + 0.05 }, ...defaults },
    // Castellated Pads
    { start: 1.59, align: { side: 'left', offset: 0.05 }, ...defaults },
    { start: 1.59, align: { side: 'right', offset: 0.05 }, ...defaults },
    // Bottom holes
    { start: 3.92, end: 3.92, align: { side: 'bottom', offset: 1.38 + 0.05 }, ...defaults },
    { start: 3.92, end: 3.92, align: { side: 'bottom', offset: 0.05 }, ...defaults },
  ])
  poolUC('weact-studio-ch552t', { connector_y_offset: -1.5 }, [
    { start: 1.48, align: { side: 'left', offset: 1.38 }, ...defaults },
    { start: 1.48, align: { side: 'right', offset: 1.38 }, ...defaults },
  ])
  poolUC('elite-c', { connector: 'usb-c-midmount', connector_y_offset: 1.5 }, [
    { start: 3.24, align: { side: 'left', offset: 1.35 }, ...defaults },
    { start: 3.24, align: { side: 'right', offset: 1.35 }, ...defaults },
    { start: 4.12, end: 4.12, align: { side: 'bottom', offset: 1.35 }, ...defaults },
  ])

  poolDisplay('oled-128x32-0.91in-dfrobot', {
    pcbLongSideWidth: 41.08,
    pcbShortSideWidth: 11.5,
    offsetFromLeftLongSide: 0.29,
    offsetFromRightLongSide: 0.29,
    offsetFromTopShortSide: 4.85,
    offsetFromBottomShortSide: 5.23,
    displayThickness: 1.71,
    pcbThickness: 1.13,
    displayRounding: 0.5,
  })

  poolDisplay('oled-128x32-0.91in-spi-adafruit', {
    pcbLongSideWidth: 33, // Added 0.5mm to top and bottom each for the connector
    pcbShortSideWidth: 23.5, // Added 0.5mm on the left side to make the display symmetrical
    offsetFromLeftLongSide: 6,
    offsetFromRightLongSide: 6,
    offsetFromTopShortSide: 0.5,
    offsetFromBottomShortSide: 0.5,
    displayThickness: 1,
    pcbThickness: 1.5,
    alignmentRectangles: [
      [[-23.5 / 2, -33 / 2], [-6, -32 / 2]],
      [[6, -33 / 2], [23.5 / 2, -32 / 2]],
      [[-23.5 / 2, 32 / 2], [-6, 33 / 2]],
      [[6, 32 / 2], [23.5 / 2, 33 / 2]],
    ],
    displayRounding: 0.5,
  })

  poolDisplay('oled-168x144-1.26in-keydio-vista508', {
    pcbLongSideWidth: 36,
    pcbShortSideWidth: 24.75,
    offsetFromLeftLongSide: 0.1,
    offsetFromRightLongSide: 0.1,
    offsetFromTopShortSide: 3.4,
    offsetFromBottomShortSide: 4,
    displayThickness: 1,
    pcbThickness: 0.8,
    displayRounding: 0.5,
  })

  // Make all combinations of trackballs
  const trackballCode = fileURLToPath(new URL('./parametric/trackball-gen.ts', import.meta.url))
  for (const v of allVariants('trackball') as TrackballVariant[]) {
    const url = variantURL({ type: 'trackball', variant: v } as any)
    const stepName = join(targetDir, `key-trackball${url}.step`.toLowerCase())
    const glbName = join(targetDir, `switch-trackball${url}.glb`.toLowerCase())
    pool.addIfModified(`${v.size} trackball, ${v.bearings}, ${v.sensor}`, stepName, [trackballCode], async () => {
      await writeModel(stepName, trackballSocket({ diameter: parseFloat(v.size), bearings: v.bearings, sensor: v.sensor }))
    })
    if (v.bearings == 'BTU (7.5mm)' || v.bearings == 'BTU (9mm)') {
      pool.addIfModified(`${v.size} trackball BTU Part, ${v.bearings}, ${v.sensor}`, glbName, [trackballCode], async () => {
        await writeMesh(glbName, trackballPart({ diameter: parseFloat(v.size), bearings: v.bearings, sensor: v.sensor }))
      })
    }
  }

  // Check that all STEP files that need to be split are split
  const { success, toSplit } = await gatherSTEPFilesToSplit('/src/assets', !pool.isWorker)
  if (!success) return

  const skippedCount = await pool.skippedCount()
  if (!pool.isWorker && skippedCount) console.log(`Skipping re-generating ${skippedCount} models.`)
  await pool.run()

  // Add in generated files that need splitting
  toSplit.push(...(await gatherSTEPFilesToSplit('/target', !pool.isWorker)).toSplit)

  const masses: Record<string, number> = {}
  const partTasks: { socket: CuttleKey['type']; glbName: string; stepName: string; variantURL: string }[] = []

  // Record all the parts that need regenerating
  let nParts = 0
  for (const socket of objKeys(PART_INFO)) {
    if (socket == 'blank') continue // These don't get a part
    for (const variantURL of variantURLs(socket)) {
      nParts += 1
      const glbName = join(targetDir, 'socket-' + socket + variantURL + '.glb')
      const stepName = '.' + PART_INFO[socket].stepFile.replace('.step', variantURL + '.step')
      const partName = join(targetDir, 'splitpart-' + socket + variantURL + '.glb')
      const glbStat = await maybeStat(glbName)
      const stepStat = await maybeStat(stepName)
      const partStat = toSplit.includes(socket) && await maybeStat(partName)
      if (!stepStat) {
        console.log(`Warning: could not generate ${socket}${variantURL} since its file was not present in the filesystem`)
        console.log('This is OK as long as the models you generate do not include this part.')
      } else if (!glbStat || glbStat.mtime < stepStat.mtime) {
        partTasks.push({ socket, glbName, stepName, variantURL })
      } else if (toSplit.includes(socket) && (!partStat || partStat.mtime < stepStat.mtime)) {
        partTasks.push({ socket, glbName, stepName, variantURL })
      }
    }
  }

  console.log(`\nGenerating GLB files for ${partTasks.length} parts (skipped ${nParts - partTasks.length})...`)

  for (const { socket, variantURL, glbName, stepName } of partTasks) {
    const blob = new Blob([await readFile(stepName) as any])
    if (toSplit.includes(socket)) {
      const socketModel = await importSTEPSpecifically(blob, 'Socket')
      const partModel = await importSTEPSpecifically(blob, 'Part')

      await writeModel(join(targetDir, 'splitsocket-' + socket + variantURL + '.step'), socketModel.clone())
      await writeMesh(join(targetDir, 'splitpart-' + socket + variantURL + '.glb'), partModel)
      masses[socket + variantURL] = await writeMesh(glbName, socketModel)
    } else {
      masses[socket + variantURL] = await writeMesh(glbName, await importSTEP(blob))
    }
  }

  const filename = join(targetDir, `part-masses.json`)
  await writeFile(filename, JSON.stringify(masses))

  console.log('Done! Have fun playing with Cosmos.')
}

main()
