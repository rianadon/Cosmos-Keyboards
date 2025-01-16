<script lang="ts">
  import { base } from '$app/paths'
  import Step from '../lib/Step.svelte'
</script>

<Step showNext>
  <span slot="title">Measure Your Hand Poses</span>
  <div slot="prose">
    <p class="mb-2">
      The next step estimates the directions in which your fingers and thumb bend. If you're using a
      laptop, rest the camera against your screen, with the lens pointing towards you. Otherwise, rest
      the phone against a surface. Unlike the previous steps, the camera should be facing towards your
      torso. This test only works with AUTO ROTATE LOCK OFF. Your phone must be in landscape mode (A fix
      for this is in the works).
    </p>
    <p class="mb-2">
      As data is collected on each hand, the red circles will close. A fully red circle indicates your
      hand has been fully scanned for the specific pose.
    </p>
  </div>
  <div slot="content" class="text-center text-gray-200">
    <img
      class="mx-auto h-[calc(100vh-30rem)] max-w-full"
      src="{base}/scanguide2.jpg"
      alt="setup of the scan"
    />
  </div>
</Step>
