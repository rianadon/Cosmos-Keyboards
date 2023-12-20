import { fromGeometry } from '$lib/loaders/geometry'
import type { Cuttleform } from '$lib/worker/config'
import { KEY_URLS } from '$lib/worker/socketsLoader'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { importSTEP, makeBaseBox } from 'replicad'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'
import { fileURLToPath } from 'url'
import { PART_NAMES } from '../lib/geometry/socketsParts'
import { exportGLTF } from './exportGLTF'
import { DEFAULT_PROPS, type Holes, type MicrocontrollerProps, ucModel } from './microcontroller-gen'
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

type Microcontroller = Exclude<Cuttleform['microcontroller'], null>
async function genUC(name: Microcontroller, opts: Partial<MicrocontrollerProps>, holes: Holes[]) {
  const glbName = join(targetDir, name + '.glb')
  const model = await ucModel(name, { ...DEFAULT_PROPS, ...opts }, holes)
  const mesh = model.mesh({ tolerance: 0.1, angularTolerance: 10 })
  model.delete()
  const geometry = fromGeometry(mesh)
  await exportGLTF(glbName, geometry!)
}

async function main() {
  await setup()

  const defaults = { spacing: 2.54, diameter: 0.9 }
  await genPart('switch-cherry-mx')
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
    { start: 1.59, align: { side: 'left', offset: 1.88 }, ...defaults },
    { start: 1.59, align: { side: 'right', offset: 1.88 }, ...defaults },
    // Castellated Pads
    { start: 1.59, align: { side: 'left', offset: 0 }, ...defaults },
    { start: 1.59, align: { side: 'right', offset: 0 }, ...defaults },
    // Bottom holes
    { start: 3.92, end: 3.92, align: { side: 'bottom', offset: 1.38 }, ...defaults },
    { start: 3.92, end: 3.92, align: { side: 'bottom', offset: 0 }, ...defaults },
  ])
  await genUC('weact-studio-ch552t', { connector_y_offset: -1.5 }, [
    { start: 1.48, align: { side: 'left', offset: 1.38 }, ...defaults },
    { start: 1.48, align: { side: 'right', offset: 1.38 }, ...defaults },
  ])
  for (const socket of Object.keys(PART_NAMES)) {
    try {
      await genSocket(socket)
    } catch (e) {
      console.log(`Warning: could not generate ${socket}`, e)
    }
  }
}

main()
