<script lang="ts">
  import { download } from '$lib/browser'
  import Field from '$lib/presentation/Field.svelte'
  import Select from '$lib/presentation/Select.svelte'
  import { modelName, storable } from '$lib/store'
  import type { FullCuttleform } from '$lib/worker/config'
  import { mapObj, mapObjNotNull } from '$lib/worker/util'
  import { toKLE } from '../kle'
  import { downloadQMKCode, type Matrix, type QMKOptions } from '../qmk'
  import type { FullGeometry } from '../viewers/viewer3dHelpers'
  import { downloadZMKCode, type ZMKOptions } from '../zmk'

  export let config: FullCuttleform
  export let geometry: FullGeometry
  export let matrix: Matrix

  type OptionsType = Omit<QMKOptions & ZMKOptions, 'keyboardName' | 'folderName' | 'peripherals'>
  const options = storable<OptionsType>('programmingOptions', {
    vid: '0x0001',
    pid: '0x0001',
    yourName: 'Tester',
    diodeDirection: 'COL2ROW',
    centralSide: 'left',
  })
  $: fullOptions = {
    ...$options,
    keyboardName: $modelName,
    folderName: $modelName.toLowerCase().replace(/[^0-9a-z_/]/g, ''),
    peripherals: mapObjNotNull(config, (c) => ({
      pmw3610: c.keys.some((k) => k.type == 'trackball' && k.variant.sensor == 'Skree (ZMK)'),
      cirque: c.keys.some((k) => k.type == 'trackpad-cirque'),
    })),
  } satisfies Partial<QMKOptions | ZMKOptions>

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

  $: anyConfig = config.right || config.unibody || { microcontroller: undefined }
  $: truncated = anyConfig.microcontroller == 'lemon-wireless' && $modelName.length > 16
</script>

<p class="mt-4 mb-2">Successfully made the matrix!</p>
<p class="mb-2">Now you can download code for your microcontroller.</p>

<div class="mt-8 text-gray-500 dark:text-gray-200" class:mb-4={!truncated}>
  Keyboard / File Name: <input class="input px-2" bind:value={$modelName} />
</div>
{#if truncated}
  <div class="text-red-500 mb-4">
    The keyboard name will be shortened to 16 characters, as this is the limit for BLE device names.
  </div>
{/if}

{#if anyConfig.microcontroller == 'lemon-wired'}
  <button class="button" on:click={() => downloadQMKCode(geometry, matrix, fullOptions)}
    >Download QMK code</button
  >
  <button class="button" on:click={() => downloadVia(fullOptions)}>Download Via code</button>
{/if}
{#if anyConfig.microcontroller == 'lemon-wireless'}
  <Field name="Diode Direction" icon="diode-direction">
    <Select bind:value={$options.diodeDirection}>
      <option value="COL2ROW">COL2ROW (Flex PCBs)</option>
      <option value="ROW2COL">ROW2COL (Plum Twists)</option>
    </Select>
  </Field>
  <Field name="Central (Plug into PC) Side" icon="pc">
    <Select bind:value={$options.centralSide}>
      <option value="left">Left</option>
      <option value="right">Right</option>
    </Select>
  </Field>

  <button class="button" on:click={() => downloadZMKCode(geometry, matrix, fullOptions)}
    >Download ZMK code</button
  >

  <div class="mt-4 text-gray-500 dark:text-gray-200">
    The downloaded code contains a <code class="font-mono text-0.9em">.github</code> directory that will automatically
    build your firmware once you push it to GitHub. If you're on Linux or Mac, you'll need to turn on hidden
    directories (ctrl+h in GNOME, alt+. in KDE, cmd+shift+. on Mac) to see it.
  </div>
  <div class="mt-4 text-gray-500 dark:text-gray-200">
    To enter bootloader mode, unplug then plug in your keyboard while pressing the <span
      class="text-brand-pink">bootmagic key</span
    >. If there is no bootmagic key, you will need to double-tap the reset button.
  </div>
{/if}

<style>
  .button {
    --at-apply: 'bg-purple-300 dark:bg-gray-900 hover:bg-purple-400 dark:hover:bg-pink-900 text-black dark:text-white font-bold py-2 px-4 rounded focus:outline-none border border-transparent focus:border-pink-500';
  }

  .input {
    --at-apply: 'focus:border-teal-500 border border-transparent text-gray-700 focus:outline-none border-gray-200 dark:border-transparent bg-gray-100 dark:bg-gray-700 dark:text-gray-100 appearance-none w-44 rounded mx-2 text-ellipsis';
  }
</style>
