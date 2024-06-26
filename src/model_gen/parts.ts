import type { OpenCascadeInstance } from '$assets/replicad_single'
import { fromGeometry } from '$lib/loaders/geometry'
import type { Cuttleform, CuttleKey } from '$lib/worker/config'
import { KEY_URLS } from '$lib/worker/socketsLoader'
import { for3, objKeys } from '$lib/worker/util'
import { readFile, writeFile } from 'fs/promises'
import { basename, join } from 'path'
import { type AnyShape, getOC, importSTEP, makeBaseBox, Solid } from 'replicad'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { fileURLToPath } from 'url'
import { PART_NAMES, variantURLs } from '../lib/geometry/socketsParts'
import { exportGLTF } from './exportGLTF'
import { serialize } from './modeling'
import { setup } from './node-model'
import { displayModel, type DisplayProps, displaySocket } from './parametric/display-gen'
import { DEFAULT_PROPS, type Holes, type MicrocontrollerProps, ucModel } from './parametric/microcontroller-gen'
import { type TrackballOptions, trackballSocket } from './parametric/trackball-gen'
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

async function loadSocket(name: string, variantURL: string) {
  if (name == 'blank') return makeBaseBox(18.5, 18.5, 5).translateZ(-5)
  // @ts-ignore
  const file = await readFile('.' + KEY_URLS[name].replace('.step', variantURL + '.step'))
  return await importSTEP(new Blob([file]))
}

async function writeModel(filename: string, model: AnyShape) {
  const step = serialize(basename(filename), model)
  model.delete()
  await writeFile(filename, step)
}

async function writeMesh(filename: string, model: AnyShape) {
  const mesh = model.mesh({ tolerance: 0.1, angularTolerance: 10 })
  const oc = getOC() as OpenCascadeInstance
  const props = new oc.GProp_GProps_1()
  oc.BRepGProp.VolumeProperties_2(model.wrapped, props, 0.01, false, true)
  const mass = props.Mass()
  props.delete()
  model.delete()
  const geometry = fromGeometry(mesh)
  await exportGLTF(filename, geometry!)
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
    offsetFromLongSide: 0.29,
    offsetFromTopShortSide: 4.85,
    offsetFromBottomShortSide: 5.23,
    displayThickness: 1.71,
    pcbThickness: 1.13,
  }

  poolDisplayModel('oled-128x32-0.91in-dfrobot', dfDisplayProps, 0.5)
  poolDisplaySocket('oled-128x32-0.91in-dfrobot', dfDisplayProps)

  // Make all combinations of trackballs
  // for3(
  //   [25, 34],
  //   ['Roller', 'Ball'] as TrackballOptions['bearings'][],
  //   ['Joe'] as TrackballOptions['sensor'][],
  // )(
  //   (diameter, bearings, sensor) => {
  //     pool.add(`${diameter}mm trackball, ${bearings}, ${sensor}`, async () => {
  //       const stepName = join(targetDir, `key-trackball-${diameter}mm-${bearings}-${sensor}.step`)
  //       await writeModel(stepName, trackballSocket({ diameter, bearings, sensor }))
  //     })
  //   },
  // )

  await pool.run()

  const masses: Record<string, number> = {}
  for (const socket of objKeys(PART_NAMES)) {
    for (const variantURL of variantURLs(socket)) {
      try {
        const glbName = join(targetDir, 'socket-' + socket + variantURL + '.glb')
        masses[socket + variantURL] = await writeMesh(glbName, await loadSocket(socket, variantURL))
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
