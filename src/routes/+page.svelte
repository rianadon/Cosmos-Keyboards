<script>
  import { base } from '$app/paths'
  import HorizontalFeature from '../lib/horizontal-feature.svelte'
  import VerticalFeature from '../lib/vertical-feature.svelte'

  const discord = 'https://discord.gg/nXjqkfgtGy'
</script>

<svelte:head>
  <title>Cosmos Keyboard</title>
  <link rel="canonical" href="https://ryanis.cool/cosmos/" />
  <link rel="icon" href="{base}/favicon.png" />
</svelte:head>

<header class="flex justify-end gap-4 px-8 pt-2">
  <a href="blog/">Blog</a>
  <a href="docs/">Docs</a>
  <a href="https://github.com/rianadon/Cosmos-Keyboards">GitHub</a>
</header>
<main class="text-center font-sans bg-slate-900 text-white">
  <div class="background mx-4 relative" style="background-image: url('{base}/keyboard2.png')">
    <h1
      class="capitalize absolute w-full text-2xl top-[min(calc(15vh-1.5em),4em)] text-purple font-semibold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-amber-600 tracking-tight"
    >
      A new ergonomic keyboard generator
    </h1>
    <h1 class="sr-only">Cosmos</h1>
  </div>
  <p class="mx-6">
    Cosmos is not yet ready for release. However, if you'd like to beta test, join the discord.
  </p>
  <p>
    <a
      class="inline-block font-sans font-semibold rounded-2 border-3 border-teal-500 px-8 py-2 m-2 mt-6 transition shadow-lg hover:shadow-teal-500/50 hover:scale-105 ease-in-out"
      href={discord}>Join the Discord</a
    >
    <a href="beta" class="green" data-sveltekit-preload-data="off">Or visit the beta...</a>
  </p>
  <img class="mt-8 h-[4vw]" src="{base}/bg2.png" alt="" />
  <div class="bg-[#003935] p-5">
    <h2 class="w-full text-2xl top-[min(calc(20vh-2em),4em)] font-semibold mb-4">
      See It In Action
    </h2>
    <video controls muted class="max-w-4xl w-full mx-auto rounded">
      <source type="video/mp4" src="{base}/cosmos.mp4" />
    </video>
    {#if false}
      <p class="m-auto font-sans max-w-4xl p-8">
        Early this year I printed and made my first keyboard, a Dactyl Manuform. I built <a
          href="https://ryanis.cool/dactyl">an online generator</a
        > to design more of them too. I've been overjoyed seeing the positive reception it's gotten since
        its release, but in building the generator I've seen so many opportunities for improvement. Cosmos
        is my answer to these ideas. A new generator built on a different set of principles, its aim
        is to let you build the most comfortable and beautiful keyboard and celebrate the joy of making
        yourself.
      </p>
      <div class="md:flex max-w-7xl gap-4 lg:gap-8 m-auto">
        <VerticalFeature src="/positions.mp4">
          <span slot="title"
            >Flexible In <span class="font-bold text-purple">All Dimensions</span></span
          >
          <p slot="content">
            Take control of every key's position. Designing a 3-key macropad? Cosmos will give you a
            fitting case.
          </p>
        </VerticalFeature>
        <VerticalFeature src="/keyboard.mp4">
          <span slot="title"
            >For <span class="font-bold text-emerald">First-Time Pioneers</span> and Seasoned Adventurers</span
          >
          <p slot="content">
            Cosmos will walk you through designing, wiring, and programming your keyboard.
          </p>
        </VerticalFeature>
        <VerticalFeature src="/curves.mp4">
          <span slot="title">As <span class="font-bold text-lightblue">Smooth</span> As Water</span>
          <p slot="content">
            Not only can you replace sharp edges with configurable curves, but the generator runs
            buttery smooth too.
          </p>
        </VerticalFeature>
      </div>
      <p class="text-xs text-white/70 my-6">
        Every frame of the animations above was created with the help of the Cosmos generator. You
        can make any one of these keyboards yourself.
      </p>
    {/if}
  </div>
  <img class="h-[4vw]" src="{base}/bg3.png" alt="" />
  <div
    class="features max-w-4xl mx-auto mt-24 mb-4 text-xl font-semibold sm:columns-2 md:columns-3 bg-clip-text text-transparent bg-gradient-to-br from-purple-300 to-amber-300"
  >
    <p>EC11 Encoders</p>
    <p>Amoeba PCB Holders</p>
    <p>Microcontroller Holder ¹</p>
    <p>Trackballs</p>
    <p>Choc Switches</p>
    <p>OLED Displays</p>
    <p>Smart Screw Hole Placement</p>
    <p>20% Less Filament ²</p>
    <p>Angular Key Spread</p>
    <p>Adapts to Keycap Tilt ³</p>
    <p>Automatic Model Height</p>
    <p>Uniform Wall Cross Sections</p>
    <p>Thin Surface Detection</p>
    <p>Key Intersection Detection</p>
    <p>Rounded Edges</p>
    <p>Hand Scanning</p>
    <p>BOM Generation</p>
    <p>And More!</p>
  </div>
  <div class="mb-18">
    <p class="text-slate-400">
      ¹ Integrated Board Holder supports Pro Micro, RP2040, and nRF5280-based boards.
    </p>
    <p class="text-slate-400">
      ² Comparing a 5x5-key model with the <a style="color: unset" href="https://ryanis.cool/dactyl"
        >Dactyl generator</a
      >.
    </p>
    <p class="text-slate-400">³ Compatible with XDA, DSA, SA, MT3—even OEM and Cherry!</p>
  </div>

  <div class="max-w-5xl m-auto">
    <HorizontalFeature src="/hand.mp4" reversed>
      <span slot="title">A Keyboard for Every Being In the Universe</span>
      <p slot="content">Measure your hand and use it to design the perfect keyboard</p>
      <p slot="description">
        A great ergonomic keyboard should fit your hand shape, but it's difficult iterating through
        prints and testing. Cosmos lets you measure your hand and place it in the editor, allowing
        you to put yourself in the design process.
      </p>
    </HorizontalFeature>
    <HorizontalFeature src="/cosmos.png">
      <span slot="title">Intuitive Controls, Everywhere</span>
      <p slot="content">Play with sliders or code, your choice</p>
      <p slot="description">
        If you've configured a Dactyl keyboard before, the Cosmos generator gives you a familiar set
        of options to adjust. But the true power of the editor lies in Expert mode, where you can
        adjust the position and rotation of every key. Alternatively, take over and code using
        TypeScript to programmatically generate the key layout.
      </p>
    </HorizontalFeature>
    <HorizontalFeature src="/cosmoboard.png" reversed>
      <span slot="title">The Galaxy is the Limit</span>
      <p slot="content">Design anything, as long as it's a keyboard</p>
      <p slot="description">
        The generator isn't limited to keyboards that fit a single adult human hand. Design
        keyboards for babies. Design keyboards for cats. Design keyboards that fit two hands... like
        a normal keyboard. Dream it and with some practice in Expert mode, you can design keyboards
        like the ones on the left in under 5 minutes.
      </p>
    </HorizontalFeature>
    <HorizontalFeature src="/cad.mp4">
      <span slot="title">Compatible With Your 3D Printer And Your CAD Software</span>
      <p slot="content">
        Generate high-quality STLs for printing or STEP files for further editing
      </p>
      <p slot="description">
        Cosmos uses the <a href="https://dev.opencascade.org/">OpenCascade</a> geometry kernel, the
        same kernel that powers <a href="https://www.freecad.org/">FreeCAD</a> and
        <a href="https://cadquery.readthedocs.io/en/latest/#">CadQuery</a>. It can export STEP
        files, making it easy to use Cosmos as a starting point and build your next keyboard in your
        favorite CAD software.
      </p>
    </HorizontalFeature>
  </div>

  <div class="faq my-20 max-w-xl mx-auto px-4">
    <h2
      class="w-full text-2xl top-[min(calc(20vh-2em),4em)] text-purple font-semibold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-amber-600 mb-4"
    >
      FAQ
    </h2>
    <h3 class="font-bold mb-1 mt-8">When is the generator being released?</h3>
    <p>By the end of this year (but hopefully sooner).</p>
    <p>
      If you don't mind buggy software, join the <a href={discord}>Discord</a> and try the beta!
    </p>
    <h3 class="font-bold mb-1 mt-8">Is the project Open Source?</h3>
    <p>
      Cosmos uses an open-core model. Everything you need to scan your hand to build and program a
      keyboard <a href="https://github.com/rianadon/Cosmos-Keyboards/">is open source</a>.
    </p>
    <p>
      Meanwhile some cosmetic features (such as rounded sides) are not open-source and available for
      a small fee so that I can recoup some of the costs buying keyboard parts.
    </p>
    <h3 class="font-bold mb-1 mt-8">Can I use the generator today?</h3>
    <p>
      If you're migrating from my <a href="https://ryanis.cool/dactyl">Dactyl generator</a>, you'll
      find Cosmos already produces more robust models, and I recommend you switch, as long as you're
      ok with a few breaking changes.
    </p>
    <p>
      New features like trackball support and OLED displays have been released, but I recommend
      waiting for Cosmos to mature before using these unless you like hot glue.
    </p>
  </div>
  <p class="text-sm mb-10">
    Brought to you by <a href="https://github.com/rianadon">@rianadon</a>.
  </p>
</main>
<img
  style="position: absolute; width: 0; height: 0;"
  alt=""
  aria-hidden="true"
  src="https://pageviews.ryanis.cool/by/cosmos"
/>

<style>
  :global(body) {
    background: rgb(15, 23, 42);
  }

  .background {
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
    height: calc(80vh - 170px);
    max-height: 600px;
  }

  a[href]:not(.inline-block) {
    color: #f0abfc;
  }

  a[href].green {
    color: #14b8a6;
  }

  a[href]:not(.inline-block):hover {
    text-decoration: underline;
  }

  .faq p {
    --at-apply: 'mb-1 <sm:text-sm';
  }

  .features p {
    --at-apply: 'mb-2 sm:mb-6';
  }

  :root header a[href] {
    color: #c28f80;
  }
</style>
