import { download } from '$lib/browser'
import type { FullGeometry } from '../viewers/viewer3dHelpers'
import { toKLE } from './kle'
import type { Matrix, QMKOptions } from './qmk'

export function downloadVia(geometry: FullGeometry, matrix: Matrix, options: QMKOptions) {
  const kle = toKLE(geometry, matrix)
    .split(',\n')
    .map((s) => JSON.parse(s))
  const via = {
    name: options.keyboardName,
    vendorId: options.vid,
    productId: options.pid,
    matrix: {
      rows: 14,
      cols: 7,
    },
    keycodes: ['qmk_lighting'],
    menus: ['qmk_rgblight'],
    layouts: {
      keymap: kle,
    },
  }
  const blob = new Blob([JSON.stringify(via, null, 2)], { type: 'application/json' })
  download(blob, `via-${options.keyboardName}.json`)
}
