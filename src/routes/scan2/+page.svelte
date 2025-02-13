<script lang="ts">
  import { base } from '$app/paths'
  import { fade } from 'svelte/transition'
  import Calibration from './steps/Calibration.svelte'
  import Pairing from './steps/Pairing.svelte'
  import MeasureLengths from './steps/MeasureLengths.svelte'
  import MeasurePose from './steps/MeasurePose.svelte'
  import LengthResults from './steps/LengthResults.svelte'
  import PoseResults from './steps/PoseResults.svelte'
  import { step } from './store'
  import PastMeasurements from './lib/PastMeasurements.svelte'
  import LengthInstructions from './steps/LengthInstructions.svelte'
  import PoseInstructions from './steps/PoseInstructions.svelte'

  $: if ($step == 11) setTimeout(() => window.close(), 300)
  let fullScreenErr = false

  function startScan() {
    document.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(
      () => {
        $step++
      },
      () => {
        fullScreenErr = true
      }
    )
  }
</script>

<svelte:body class="bg-slate-900 text-gray-50" />

<header class="flex items-center">
  <img
    src="{base}/cosmos-icon.png"
    class="w-12 rounded-4 mx-8 shadow-[0_2px_20px_-3px_rgba(0,0,0,0.3)] shadow-pink/50"
  />
  <h1
    class="my-8 capitalize text-4xl text-purple font-semibold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-amber-600 tracking-tight"
  >
    Cosmos Hand Scanning
  </h1>
</header>
<main class="mx-4 my-4 text-center relative h-[calc(100vh-8.5rem)]" class:overflow-hidden={$step > 0}>
  {#if $step == 0}
    <div class="max-w-prose mx-auto" transition:fade={{ duration: 300 }}>
      <p class="mb-10">
        To build the best possible computer model for your hand, Cosmos measures both the lengths of your
        limbs and the direction you naturally move your fingers.
      </p>
      {#if fullScreenErr}
        <div
          class="absolute bg-red text-black mx-[-1rem] px-4 py-1 rounded max-w-prose shadow-lg shadow-slate-800 z-100"
        >
          Please allow the page to go fullscreen. This enables accurate screen measurements and helps
          improve scanning accuracy.
        </div>
      {/if}
      <img class="max-w-lg mx-auto rounded mb-10" src="{base}/cosmos-hand-landing.png" />
      <p class="mb-2">
        This tool will use your smartphone camera and a large display (e.g. laptop or monitor) to analyze
        your hand entirely on-device.
      </p>
      <button
        class="mt-10 bg-gradient-to-br from-purple-400 to-amber-600 text-xl p-1 rounded-2 shadow-lg shadow-pink/40 transition-all hover:shadow-pink/60 hover:scale-105 hover:-translate-y-0.5"
        on:click={startScan}
      >
        <span class="block bg-slate-900 px-8 py-2 rounded-1.5 text-pink-200 font-semibold">
          Start Scan
        </span>
      </button>
      <p class="mt-5 text-purple-400/80 text-sm">Starting will full-screen this page</p>
      <PastMeasurements />
    </div>
  {:else if $step == 1}
    <Calibration />
  {:else if $step == 2}
    <Pairing />
  {:else if $step == 3}
    <LengthInstructions />
  {:else if $step == 4}
    <MeasureLengths desiredHand="Left" />
    <!-- <CameraCalibration /> -->
  {:else if $step == 5}
    <LengthResults desiredHand="Left" />
  {:else if $step == 6}
    <MeasureLengths desiredHand="Right" />
  {:else if $step == 7}
    <LengthResults desiredHand="Right" otherHand="Left" />
  {:else if $step == 8}
    <PoseInstructions />
  {:else if $step == 9}
    <MeasurePose />
  {:else if $step == 10}
    <PoseResults />
  {:else if $step == 11}
    You can safely close this tab.
  {/if}
</main>
