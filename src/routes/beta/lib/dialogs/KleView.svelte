<script lang="ts">
  import type { Cuttleform } from '$lib/worker/config'
  import { download } from '$lib/browser'
  import { toKLE } from '../kle'
  import { bomMultiplier as multiplier } from '$lib/store'
  import MultiplierDropdown from './MultiplierDropdown.svelte'

  export let conf: Cuttleform

  function downloadKLE() {
    const blob = new Blob([toKLE(conf, $multiplier == '2')], { type: 'application/json' })
    download(blob, 'kle.json')
  }
</script>

<div class="text-center">
  Exporting for <MultiplierDropdown />
</div>

<div class="text-left mt-6 max-w-prose mx-auto">
  <p class="mb-2">
    This dialog will export your 2D layout to the <a href="http://www.keyboard-layout-editor.com/"
      >Keyboard Layout Editor</a
    >. You'll need to use this site in order to use Via or Vial with your keyboard. Both of these
    softwares allow you to easily reprogram keys without having to re-flash your keyboard.
  </p>
  <p class="mb-2">
    To load the JSON file you download into KLE, in KLE click the "Raw Data" tab, then click the green
    "Upload JSON" button at the bottom. Both Via and Vial expect you to <a
      href="https://get.vial.today/docs/porting-to-via.html">rename the keys</a
    > according to their position in the matrix you define in code, so make sure you rename every key in KLE
    before using the data.
  </p>
  <p class="mb-2">
    Because Via and Vial define encoders differently, the encoder will be exported as a normal key.
    Please make sure you appropriately label the encoder.
  </p>
</div>
<div class="text-center mt-6">
  <p><button class="button" on:click={downloadKLE}>Download</button></p>
</div>

<style>
  a {
    --at-apply: 'font-bold text-teal-500 dark:text-teal-300 hover:text-teal-500 hover:underline';
  }

  .button {
    --at-apply: 'bg-purple-300 dark:bg-gray-900 hover:bg-purple-400 dark:hover:bg-pink-900 text-black dark:text-white font-bold py-2 px-4 rounded focus:outline-none border border-transparent focus:border-pink-500';
  }
</style>
