import { fromGeometry } from '$lib/loaders/geometry'
import type { Cuttleform, CuttleKey } from '$lib/worker/config'
import { KEY_URLS } from '$lib/worker/socketsLoader'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { getOC } from 'replicad'
import { importSTEP, makeBaseBox } from 'replicad'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'
import { fileURLToPath } from 'url'
import { PART_NAMES } from '../lib/geometry/socketsParts'
import { exportGLTF } from './exportGLTF'
import { serialize } from './modeling'
import { setup } from './node-model'
import { displayModel, type DisplayProps, displaySocket } from './parametric/display-gen'
import { DEFAULT_PROPS, type Holes, type MicrocontrollerProps, ucModel } from './parametric/microcontroller-gen'

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
  const oc = getOC()
  const props = new oc.GProp_GProps_1()
  oc.BRepGProp.VolumeProperties_2(model.wrapped, props, 0.01, false, true)
  const mass = props.Mass()
  props.delete()
  model.delete()
  const geometry = fromGeometry(mesh)
  await exportGLTF(glbName, geometry!)
  return mass
}

type Microcontroller = Exclude<Cuttleform['microcontroller'], null>
async function genUC(name: Microcontroller, opts: Partial<MicrocontrollerProps>, holes: Holes[]) {
  const glbName = join(targetDir, name + '.glb')
  const model = await ucModel(name, { ...DEFAULT_PROPS, ...opts }, holes)
  const mesh = model.mesh({ tolerance: 0.1, angularTolerance: 10 })
  model.delete()
  const geometry = fromGeometry(mesh)
  await exportGLTF(glbName, geometry!)
}

async function genDisplayModel(name: CuttleKey['type'], opts: DisplayProps, rounding: number) {
  const glbName = join(targetDir, 'switch-' + name + '.glb')
  const model = await displayModel(name, opts, 0, rounding)
  const mesh = model.mesh({ tolerance: 0.1, angularTolerance: 10 })
  model.delete()
  const geometry = fromGeometry(mesh)
  await exportGLTF(glbName, geometry!)
}

async function genDisplaySocket(name: CuttleKey['type'], opts: DisplayProps) {
  const stepName = join(targetDir, 'key-' + name + '.step')
  const model = await displaySocket(name, opts)
  const step = serialize(name, model)
  model.delete()
  await writeFile(stepName, step)
}

async function main() {
  await setup()

  const defaults = { spacing: 2.54, diameter: 0.9 }
  await genPart('switch-cherry-mx')
  await genPart('switch-evqwgd001')
  await genPart('switch-joystick-joycon-adafruit')
  await genUC('rp2040-black-usb-c-aliexpress', {}, [
    { start: 2.54, align: { side: 'left', offset: 2.54 }, ...defaults },
    { start: 2.54, align: { side: 'right', offset: 2.54 }, ...defaults },
  ])
  await genUC('promicro', { connector: 'micro-usb' }, [
    { start: 3.81, align: { side: 'left', offset: 1.27 }, ...defaults },
    { start: 3.81, align: { side: 'right', offset: 1.27 }, ...defaults },
  ])
  await genUC('promicro-usb-c', {}, [
    { start: 5.25, align: { side: 'left', offset: 1.53 }, ...defaults },
    { start: 5.25, align: { side: 'right', offset: 1.53 }, ...defaults },
  ])
  await genUC('waveshare-rp2040-zero', { fillet: 1 }, [
    { start: 1.59, align: { side: 'left', offset: 1.88 + 0.05 }, ...defaults },
    { start: 1.59, align: { side: 'right', offset: 1.88 + 0.05 }, ...defaults },
    // Castellated Pads
    { start: 1.59, align: { side: 'left', offset: 0.05 }, ...defaults },
    { start: 1.59, align: { side: 'right', offset: 0.05 }, ...defaults },
    // Bottom holes
    { start: 3.92, end: 3.92, align: { side: 'bottom', offset: 1.38 + 0.05 }, ...defaults },
    { start: 3.92, end: 3.92, align: { side: 'bottom', offset: 0.05 }, ...defaults },
  ])
  await genUC('weact-studio-ch552t', { connector_y_offset: -1.5 }, [
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
  await genDisplayModel('oled-128x32-0.91in-dfrobot', dfDisplayProps, 0.5)
  await genDisplaySocket('oled-128x32-0.91in-dfrobot', dfDisplayProps)
  const masses: Record<string, number> = {}
  for (const socket of Object.keys(PART_NAMES)) {
    try {
      masses[socket] = await genSocket(socket)
    } catch (e) {
      if (e instanceof Error && 'code' in e && e.code === 'ENOENT') {
        console.log(`Warning: could not generate ${socket} since its file was not present in the filesystem`)
        console.log('This is OK as long as the models you generate do not include this part.')
      } else throw e
    }
  }

  const filename = join(targetDir, `part-masses.json`)
  await writeFile(filename, JSON.stringify(masses))
}

main()
