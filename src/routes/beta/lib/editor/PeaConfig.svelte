<script lang="ts">
  import { download } from '$lib/browser'
  import { modelName } from '$lib/store'
  import type { FullCuttleform } from '$lib/worker/config'
  import { toKLE } from '../kle'
  import { downloadQMKCode, type Matrix, type QMKOptions } from '../qmk'
  import type { FullGeometry } from '../viewers/viewer3dHelpers'
  import { downloadZMKCode } from '../zmk'

  export let config: FullCuttleform
  export let geometry: FullGeometry
  export let matrix: Matrix

  $: options = {
    vid: '0x0001',
    pid: '0x0001',
    keyboardName: $modelName,
    yourName: 'Tester',
    diodeDirection: 'COL2ROW',
  } satisfies QMKOptions

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

<div class="mt-8 mb-4 text-gray-500 dark:text-gray-200">
  File name for downloads: <input class="input px-2" bind:value={$modelName} />
</div>

{#if (config.right || config.unibody || {}).microcontroller == 'lemon-wired'}
  <button class="button" on:click={() => downloadQMKCode(geometry, matrix, options)}
    >Download QMK code</button
  >
  <button class="button" on:click={() => downloadVia(options)}>Download Via code</button>
{/if}
{#if (config.right || config.unibody || {}).microcontroller == 'lemon-wireless'}
  <button class="button" on:click={() => downloadZMKCode(geometry, matrix, options)}
    >Download ZMK code</button
  >
{/if}

<style>
  .button {
    --at-apply: 'bg-purple-300 dark:bg-gray-900 hover:bg-purple-400 dark:hover:bg-pink-900 text-black dark:text-white font-bold py-2 px-4 rounded focus:outline-none border border-transparent focus:border-pink-500';
  }

  .input {
    --at-apply: 'focus:border-teal-500 border border-transparent text-gray-700 focus:outline-none border-gray-200 dark:border-transparent bg-gray-100 dark:bg-gray-700 dark:text-gray-100 appearance-none w-44 rounded mx-2 text-ellipsis';
  }
</style>
