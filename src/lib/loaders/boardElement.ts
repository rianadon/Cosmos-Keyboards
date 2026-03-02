import { BOARD_PROPERTIES, type BoardElement, boardElements, type Connector } from '$lib/geometry/microcontrollers'
import type { Cuttleform, Geometry } from '$lib/worker/config'
import type { BufferGeometry, Matrix4 } from 'three'
import loadGLTF from './gltfLoader'

const CONNECTOR_URLS: Record<Connector, string> = {
  'trrs': '/src/assets/pj320a.glb',
}

export async function fetchBoardElement(elem: BoardElement) {
  if (elem.model in CONNECTOR_URLS) {
    // @ts-ignore
    return await loadGLTF(CONNECTOR_URLS[elem.model])
  }
  if (elem.model in BOARD_PROPERTIES) {
    // @ts-ignore
    return await loadGLTF(BOARD_PROPERTIES[elem.model].glbFile)
  }
  return null
}

export async function boardGeometries(config: Cuttleform, g: Geometry) {
  if (!config) return []
  const connOrigin = g.connectorOrigin

  if (!config.microcontroller || !connOrigin) return []

  const elements = boardElements(config, false)
  const geo: { board: BufferGeometry; matrix: Matrix4 }[] = []

  for (const elem of elements) {
    let board = await fetchBoardElement(elem)
    if (!board) continue
    const transformation = connOrigin.pretranslated(elem.offset.xyz())
    geo.push({ board, matrix: transformation.Matrix4() })
  }

  return geo
}
