<script lang="ts">
  import { base } from '$app/paths'
  import Field from '$lib/presentation/Field.svelte'
  import Select from '$lib/presentation/Select.svelte'
  import { modelName, storable } from '$lib/store'
  import type { FullCuttleform } from '$lib/worker/config'
  import { mapObjNotNull } from '$lib/worker/util'
  import { downloadQMKCode, type QMKOptions } from '../firmware/qmk'
  import type { FullGeometry } from '../viewers/viewer3dHelpers'
  import { downloadZMKCode, type ZMKOptions } from '../firmware/zmk'
  import { downloadVia } from '../firmware/via'
  import Checkbox from '$lib/presentation/Checkbox.svelte'
  import { encoderKeys, type Matrix } from '../firmware/firmwareHelpers'
  import InfoBox from '$lib/presentation/InfoBox.svelte'

  export let config: FullCuttleform
  export let geometry: FullGeometry
  export let matrix: Matrix

  type OptionsType = Omit<QMKOptions & ZMKOptions, 'keyboardName' | 'folderName' | 'peripherals'>
  const options = storable<OptionsType>('programmingOptions', {
    vid: '0x0001',
    pid: '0x0001',
    yourName: 'Cosmos',
    diodeDirection: 'ROW2COL',
    centralSide: 'left',
    underGlowAtStart: true,
    enableConsole: true,
    enableStudio: true,
  })
  $: fullOptions = {
    ...$options,
    keyboardName: $modelName,
    folderName: $modelName.toLowerCase().replace(/[^0-9a-z_/]/g, ''),
    peripherals: mapObjNotNull(config, (c) => ({
      pmw3610: c.keys.some((k) => k.type == 'trackball' && k.variant.sensor == 'Skree (ZMK)'),
      cirque: c.keys.some((k) => k.type == 'trackpad-cirque'),
      encoder: !!encoderKeys(c).length,
    })),
  } satisfies Partial<QMKOptions | ZMKOptions>

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
  <Field name="Diode Direction" icon="diode-direction">
    <Select bind:value={$options.diodeDirection}>
      <option value="ROW2COL">ROW2COL (Pumpkin and Plum Twists)</option>
      <option value="COL2ROW">COL2ROW (Skree Flex PCBs)</option>
    </Select>
  </Field>
  <Field name="Manufacturer Name (for USB)" icon="person">
    <input class="input px-2" bind:value={$options.yourName} />
  </Field>
  <Field
    name="Enable Console Debugging"
    icon="debug"
    help="Shows matrix and split debug information when you run qmk console"
  >
    <Checkbox bind:value={$options.enableConsole} />
  </Field>
  <button class="button" on:click={() => downloadQMKCode(geometry, matrix, fullOptions)}
    >Download QMK code</button
  >
  <button class="button" on:click={() => downloadVia(geometry, matrix, fullOptions)}
    >Download Via config</button
  >

  <div class="mt-4 text-gray-500 dark:text-gray-200">
    Read the <a class="text-pink-600 underline" href="{base}/docs/firmware/" target="_blank"
      >Firmware Autogen documentation</a
    > to learn how to build and flash this code to your keyboard.
  </div>
  <div class="mt-4 text-gray-500 dark:text-gray-200">
    To enter bootloader mode, unplug then plug in your keyboard while pressing the <span
      class="text-brand-pink">bootmagic key</span
    >. If there is no bootmagic key, you will need to double-tap the reset button.
  </div>
{/if}
{#if anyConfig.microcontroller == 'lemon-wireless'}
  <Field name="Diode Direction" icon="diode-direction">
    <Select bind:value={$options.diodeDirection}>
      <option value="ROW2COL">ROW2COL (Pumpkin and Plum Twists)</option>
      <option value="COL2ROW">COL2ROW (Skree Flex PCBs)</option>
    </Select>
  </Field>
  <Field name="Central (Plug into PC) Side" icon="pc">
    <Select bind:value={$options.centralSide}>
      <option value="left">Left</option>
      <option value="right">Right</option>
    </Select>
  </Field>
  <Field
    name="Use RGB LEDs"
    icon="led"
    help="Turns on power to the LEDs when the keyboard is first plugged in"
  >
    <Checkbox bind:value={$options.underGlowAtStart} />
  </Field>
  <Field name="Enable ZMK Studio" icon="studio">
    <Checkbox bind:value={$options.enableStudio} />
  </Field>
  <Field name="Enable USB Logging" icon="debug" help="Writes debug information to a USB serial port">
    <Checkbox bind:value={$options.enableConsole} />
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
    Read the <a class="text-pink-600 underline" href="{base}/docs/firmware/" target="_blank"
      >Firmware Autogen documentation</a
    > to learn how to build and flash this code to your keyboard.
  </div>
  <div class="mt-4 text-gray-500 dark:text-gray-200">
    To enter bootloader mode, unplug then plug in your keyboard while pressing the <span
      class="text-brand-pink">bootmagic key</span
    >. If there is no bootmagic key, you will need to double-tap the reset button.
  </div>
  {#if $options.enableStudio}
    <InfoBox class="mt-4">
      The key configured as bootmagic key will be assigned the &studio_unlock binding. You can change the
      assignment after entering studio.
    </InfoBox>
  {/if}
{/if}

<style>
  .button {
    --at-apply: 'bg-purple-300 dark:bg-gray-900 hover:bg-purple-400 dark:hover:bg-pink-900 text-black dark:text-white font-bold py-2 px-4 rounded focus:outline-none border border-transparent focus:border-pink-500';
  }

  .input {
    --at-apply: 'focus:border-teal-500 border border-transparent text-gray-700 focus:outline-none border-gray-200 dark:border-transparent bg-gray-100 dark:bg-gray-700 dark:text-gray-100 appearance-none w-44 rounded mx-2 text-ellipsis';
  }
</style>
