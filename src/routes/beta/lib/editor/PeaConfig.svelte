<script lang="ts">
  import { download } from '$lib/browser'
  import type { FullCuttleform } from '$lib/worker/config'
  import { mapObj } from '$lib/worker/util'
  import { toKLE } from '../kle'
  import { downloadQMKCode, type Matrix, type QMKOptions } from '../qmk'
  import type { FullGeometry } from '../viewers/viewer3dHelpers'

  export let config: FullCuttleform
  export let geometry: FullGeometry
  export let matrix: Matrix

  const options: QMKOptions = {
    vid: '0x0001',
    pid: '0x0001',
    keyboardName: 'Test',
    yourName: 'Tester',
    diodeDirection: 'COL2ROW',
  }

  function downloadVia(options: QMKOptions) {
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
</script>

<p class="mt-4 mb-2">Successfully made the matrix!</p>
<p class="mb-2">Now you can download code for your microcontroller.</p>
<button class="button" on:click={() => downloadQMKCode(geometry, matrix, options)}
  >Download QMK code</button
>
<button class="button" on:click={() => downloadVia(options)}>Download Via code</button>

<style>
  .button {
    --at-apply: 'bg-purple-300 dark:bg-gray-900 hover:bg-purple-400 dark:hover:bg-pink-900 text-black dark:text-white font-bold py-2 px-4 rounded focus:outline-none border border-transparent focus:border-pink-500';
  }
</style>
