<script lang="ts">
  import Recording from './Recording.svelte'
  import { base } from '$app/paths'

  async function hasCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return false
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.some((device) => device.kind === 'videoinput')
  }
</script>

<svelte:body class="bg-slate-900 text-gray-50" />

<main class="max-w-3xl mx-auto my-4 text-center">
  <div class="max-w-prose mx-auto">
    <h1
      class="my-10 capitalize text-4xl text-purple font-semibold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-amber-600 tracking-tight"
    >
      Cosmos Hand Scanning
    </h1>
    <p class="mb-10">
      To build the best possible computer model for your hand, Cosmos measures both the lengths of
      your limbs and the direction you naturally move your fingers.
    </p>
    <video autoplay muted loop class="max-w-lg mx-auto rounded mb-10">
      <source src="{base}/cosmoshand.mp4" type="video/mp4" />
    </video>
    <p class="mb-2">
      This tool will use your camera to analyze your hand entirely on-device. <span
        class="font-bold text-white"
        >Make sure to rotate your hand plenty for the most accurate scan.</span
      >
    </p>
  </div>
  {#await hasCamera() then camera}
    {#if camera}
      <Recording />
    {:else}
      <div class="mt-10 bg-red-400/30 text-white px-4 py-3 rounded-2" role="alert">
        <p class="mb-2">Sorry, you'll need a webcam for now to scan your hand.</p>
        <p>You can also run Cosmos through a tablet or laptop with a built-in camera.</p>
      </div>
    {/if}
  {/await}
</main>
