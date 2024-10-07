import type { OpenCascadeInstance } from '$assets/replicad_single'
import { fromGeometry, makeFlashy } from '$lib/loaders/geometry'
import type { Cuttleform, CuttleKey } from '$lib/worker/config'
import { objEntries, objKeys } from '$lib/worker/util'
import type { TrackballVariant } from '$target/cosmosStructs'
import { readFile, writeFile } from 'fs/promises'
import { basename, join } from 'path'
import { type AnyShape, getOC, importSTEP } from 'replicad'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { fileURLToPath } from 'url'
import { allVariants, PART_INFO, variantURL, variantURLs } from '../lib/geometry/socketsParts'
import { exportGLTF } from './exportGLTF'
import { importSTEPSpecifically, serialize } from './modeling'
import { setup } from './node-model'
import { displayModel, type DisplayProps, displaySocket } from './parametric/display-gen'
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

type Microcontroller = Exclude<Cuttleform['microcontroller'], null>

async function main() {
  await setup()

  const pool = new ProcessPool()

  const poolUC = (name: Microcontroller, opts: Partial<MicrocontrollerProps>, holes: Holes[]) =>
    pool.add(name, async () => {
      const glbName = join(targetDir, name + '.glb')
      await writeMesh(glbName, await ucModel(name, { ...DEFAULT_PROPS, ...opts }, holes))
    })
  const poolDisplayModel = (name: CuttleKey['type'], opts: DisplayProps, rounding: number) =>
    pool.add(name + ' model', async () => {
      const glbName = join(targetDir, 'switch-' + name + '.glb')
      await writeMesh(glbName, await displayModel(name, opts, 0, rounding))
    })
  const poolDisplaySocket = (name: CuttleKey['type'], opts: DisplayProps) =>
    pool.add(name + ' socket', async () => {
      const stepName = join(targetDir, 'key-' + name + '.step')
      await writeModel(stepName, displaySocket(name, opts))
    })

  pool.add('Cherry MX Switch', () => genPart('switch-cherry-mx'))
  pool.add('ECQWGD001 Encoder', () => genPart('switch-evqwgd001'))
  pool.add('Joycon Joystick', () => genPart('switch-joystick-joycon-adafruit'))

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
  const dfDisplayProps: DisplayProps = {
    pcbLongSideWidth: 41.08,
    pcbShortSideWidth: 11.5,
    offsetFromLeftLongSide: 0.29,
    offsetFromRightLongSide: 0.29,
    offsetFromTopShortSide: 4.85,
    offsetFromBottomShortSide: 5.23,
    displayThickness: 1.71,
    pcbThickness: 1.13,
  }

  poolDisplayModel('oled-128x32-0.91in-dfrobot', dfDisplayProps, 0.5)
  poolDisplaySocket('oled-128x32-0.91in-dfrobot', dfDisplayProps)

  const adafruitDisplayProps: DisplayProps = {
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
  }

  poolDisplayModel('oled-128x32-0.91in-spi-adafruit', adafruitDisplayProps, 0.5)
  poolDisplaySocket('oled-128x32-0.91in-spi-adafruit', adafruitDisplayProps)

  // Make all combinations of trackballs
  for (const v of allVariants('trackball') as TrackballVariant[]) {
    const url = variantURL({ type: 'trackball', variant: v } as any)
    pool.add(`${v.size} trackball, ${v.bearings}, ${v.sensor}`, async () => {
      const stepName = join(targetDir, `key-trackball${url}.step`.toLowerCase())
      await writeModel(stepName, trackballSocket({ diameter: parseFloat(v.size), bearings: v.bearings, sensor: v.sensor }))
    })
    if (v.bearings == 'BTU (7.5mm)' || v.bearings == 'BTU (9mm)') {
      pool.add(`${v.size} trackball BTU Part, ${v.bearings}, ${v.sensor}`, async () => {
        const glbName = join(targetDir, `switch-trackball${url}.glb`.toLowerCase())
        await writeMesh(glbName, trackballPart({ diameter: parseFloat(v.size), bearings: v.bearings, sensor: v.sensor }))
      })
    }
  }

  // Check that all STEP files that need to be split are split
  const toSplit: CuttleKey['type'][] = []
  for (const [socket, info] of objEntries(PART_INFO)) {
    if ('partOverride' in info) continue // Skip parts with a specified part model
    if ('variant' in info) continue // Variants not supported for now
    if (info.stepFile.startsWith('/target')) continue // Generated models not supported for now
    const contents = await readFile('.' + info.stepFile, { encoding: 'utf-8' })
    const names = [...contents.matchAll(/PRODUCT\('(.*?)'/g)].map(m => m[1])
    const hasSocket = names.includes('Socket')
    const hasPart = names.includes('Part')
    if (!hasSocket || !hasPart) {
      console.error(`The STEP file for part ${socket}, ${info.stepFile} does not a specify a partOverride,`)
      console.error('so the file will be split into part and socket models based on component names in the assembly.')
      console.error('The following names are missing:')
      if (!hasPart) console.error(' - "Socket" for the socket')
      if (!hasPart) console.error(' - "Part" for the part')
      console.error(`PLease rename the components ${JSON.stringify(names)} to "Part" and "Socket".`)
      console.error()
    } else {
      toSplit.push(socket)
    }
  }

  await pool.run()

  const masses: Record<string, number> = {}
  for (const socket of objKeys(PART_INFO)) {
    if (socket == 'blank') continue // These don't get a part
    for (const variantURL of variantURLs(socket)) {
      try {
        const glbName = join(targetDir, 'socket-' + socket + variantURL + '.glb')
        const file = await readFile('.' + PART_INFO[socket].stepFile.replace('.step', variantURL + '.step'))
        const blob = new Blob([file])
        if (toSplit.includes(socket)) {
          const socketModel = await importSTEPSpecifically(blob, 'Socket')
          const partModel = await importSTEPSpecifically(blob, 'Part')

          await writeModel(join(targetDir, 'splitsocket-' + socket + variantURL + '.step'), socketModel.clone())
          await writeMesh(join(targetDir, 'splitpart-' + socket + variantURL + '.glb'), partModel)
          masses[socket + variantURL] = await writeMesh(glbName, socketModel)
        } else {
          masses[socket + variantURL] = await writeMesh(glbName, await importSTEP(blob))
        }
      } catch (e) {
        if (e instanceof Error && 'code' in e && e.code === 'ENOENT') {
          console.log(`Warning: could not generate ${socket}${variantURL} since its file was not present in the filesystem`)
          console.log('This is OK as long as the models you generate do not include this part.')
        } else throw e
      }
    }
  }

  const filename = join(targetDir, `part-masses.json`)
  await writeFile(filename, JSON.stringify(masses))
}

main()
