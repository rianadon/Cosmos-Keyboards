<script lang="ts">
  import Dialog from '$lib/presentation/Dialog.svelte'
  import { base } from '$app/paths'
  import Icon from '$lib/presentation/Icon.svelte'
  import { mdiStarShooting } from '@mdi/js'
  import Login from '../Login.svelte'
  export let hasClose = true
  let goingPro = false
</script>

{#if goingPro}
  <Login bind:dialogOpen={goingPro} />
{:else}
  <Dialog {hasClose} dialogcls="top-12" big>
    <span slot="title"><span class="pro">PRO</span> Sponsors Get Early Access to Cosmos V3</span>
    <div slot="content" class="text-justify">
      <p class="mb-4">
        As a thank you to all the awesome sponsors who have purchased <span class="pro">PRO</span>, the
        V3 update will be open to sponsors only for the month of July. The changes will go public on
        August 1st. The updates have taken months of work, redesigning, and coding, and I hope you'll
        understand I need to balance delivering new features with keeping this project sustainable. Now,
        here's what included:
      </p>
      <div class="text-left flex gap-8">
        <div>
          <h2 class="text-teal-500 dark:text-teal-400 font-semibold text-lg">
            Preview Changes in Realtime
          </h2>
          <p>
            Thanks to a 30x faster preview renderer, you'll get visual feedback and you move keys around.
          </p>
        </div>
        <video playsinline autoplay muted loop class="h-22 my-1 rounded-2">
          <source type="video/mp4" src="{base}/v3clip1.mp4" />
        </video>
      </div>
      <div class="text-left flex gap-8">
        <div>
          <h2 class="text-teal-500 dark:text-teal-400 font-semibold text-lg">Move Any Key, Anywhere</h2>
          <p>
            Expert mode designs transfer to basic/advanced, key-per-key, where new controls make editing
            and moving keys easier.
          </p>
        </div>
        <video playsinline autoplay muted loop class="h-22 my-1 rounded-2">
          <source type="video/mp4" src="{base}/v3clip2.mp4" />
        </video>
      </div>
      <div class="text-left flex gap-8">
        <div>
          <h2 class="text-teal-500 dark:text-teal-400 font-semibold text-lg">
            Work on two Halves at Once
          </h2>
          <p>
            Fit each side of the keyboard independently to your hand, or give your keyboard unique thumb
            clusters on each half.
          </p>
        </div>
        <video playsinline autoplay muted loop class="h-22 my-1 rounded-2">
          <source type="video/mp4" src="{base}/v3clip3.mp4" />
        </video>
      </div>
      <p class="opacity-80 text-xs mb-2">
        Also: browser- and shortcut-based undo and redo, new trackball models, wrist rests fit to hand
        position, new download buttons for unibody, 6-button curved thumb cluster, faster previews for
        stilts and tilt modes, and more!
      </p>
      <p>
        Not only will you help support development and get early access to these new features with <span
          class="pro">PRO</span
        >, but you'll also get access to the rest of the PRO features, like downloading wrist rests
        (newly improved this update!) and rounded models.
      </p>
      <button
        class="flex items-center gap-2 border-2 px-3 py-1 rounded hover:shadow-md transition-shadow border-yellow-400 hover:bg-yellow-400/30 hover:shadow-yellow-400/30 mt-6 mx-auto"
        on:click={() => (goingPro = true)}
      >
        <Icon path={mdiStarShooting} size="20px" class="text-yellow-500 dark:text-yellow-300" />
        Get PRO
      </button>
    </div>
  </Dialog>
{/if}

<style>
  .pro {
    --at-apply: 'text-teal-500 dark:text-teal-400 font-bold';
  }
</style>
