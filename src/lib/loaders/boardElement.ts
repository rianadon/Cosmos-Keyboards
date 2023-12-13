import { type BoardElement, boardElements, type Connector } from '$lib/geometry/microcontrollers'
import type { Cuttleform, Geometry } from '$lib/worker/config'
import type { BufferGeometry } from 'three'
import loadGLTF from './gltfLoader'

type Microcontroller = Exclude<Cuttleform['microcontroller'], null>
const MICROCONTROLLER_URLS: Record<Microcontroller, string> = {
  'pi-pico': '/src/assets/pico.glb',
  'rp2040-black-usb-c-aliexpress': '/target/rp2040-black-usb-c-aliexpress.glb',
  'promicro-usb-c': '/target/promicro-usb-c.glb',
  'promicro': '/target/promicro.glb',
  'itsybitsy-adafruit': '/src/assets/itsybitsy-adafruit.glb',
  'kb2040-adafruit': '/src/assets/kb2040-adafruit.glb',
  'nrfmicro-or-nicenano': '/src/assets/nrfmicro-or-nicenano.glb',
  'seeed-studio-xiao': '/src/assets/seeed-studio-xiao.glb',
  'waveshare-rp2040-zero': '/target/waveshare-rp2040-zero.glb',
}

const CONNECTOR_URLS: Record<Connector, string> = {
  'trrs': '/src/assets/pj320a.glb',
}

export async function fetchBoardElement(elem: BoardElement) {
  if (elem.model in CONNECTOR_URLS) {
    // @ts-ignore
    return await loadGLTF(CONNECTOR_URLS[elem.model])
  }
  if (elem.model in MICROCONTROLLER_URLS) {
    // @ts-ignore
    return await loadGLTF(MICROCONTROLLER_URLS[elem.model])
  }
  return null
}

export async function boardGeometries(config: Cuttleform, g: Geometry) {
  if (!config) return []
  const connOrigin = g.connectorOrigin

  if (!config.microcontroller) return []

  const elements = boardElements(config, false)
  const geo: BufferGeometry[] = []

  for (const elem of elements) {
    let board = await fetchBoardElement(elem)
    if (!board) continue
    const transformation = connOrigin.pretranslated(elem.offset.xyz())
    board = board.clone().applyMatrix4(transformation.Matrix4())
    geo.push(board)
  }

  return geo
}
