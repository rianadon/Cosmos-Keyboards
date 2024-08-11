<script lang="ts">
  import { base } from '$app/paths'
  import Step from '../lib/Step.svelte'
</script>

<Step showNext>
  <span slot="title">Measure Your Hands</span>
  <div slot="prose">
    <p class="mb-2">
      The next steps will estimate the lengths of the bones in your hand by taking images of your hand
      against your screen. I recommend placing your hand on the screen first, then moving your camera
      into position so that your camera is facing your hand and the hand is fully visible within the
      camera. Your camera should be pointed away from you and towards your hand.
    </p>
  </div>
  <div slot="content" class="text-center text-gray-200">
    <img
      class="mx-auto h-[calc(100vh-30rem)] max-w-full"
      src="{base}/scanguide1.jpg"
      alt="setup of the scan"
    />
  </div>
</Step>
