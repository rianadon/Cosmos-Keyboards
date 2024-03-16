<script lang="ts">
  import { base } from '$app/paths'
  import Icon from '$lib/presentation/Icon.svelte'
  import { mdiChevronRight, mdiEmail } from '@mdi/js'
  import Dialog from '$lib/presentation/Dialog.svelte'
  import { discordMsg } from '$lib/store'
  import Header from '$lib/Header.svelte'

  const discord = 'https://discord.gg/nXjqkfgtGy'
  const discordUsers = fetch('https://cosmos.ryanis.cool/discord/members', { method: 'POST' }).then(
    (r) => r.text()
  )

  let joining = false

  function join(ev: Event) {
    if ($discordMsg) {
      ev.preventDefault()
      joining = true
    }
  }

  function subbed(ev: Event) {
    $discordMsg = false
  }
</script>

<svelte:head>
  <title>Cosmos Keyboard</title>
  <link rel="canonical" href="https://ryanis.cool/cosmos/" />
  <link rel="icon" href="{base}/favicon.png" />
</svelte:head>

<svelte:body class="bg-brand-dark font-urbanist" />

<Header on:join={(e) => join(e.detail)} />

<section class="text-[#faeedc] text-center py-10 overflow-hidden">
  <div class="tracking-wide">
    <p class="uppercase sm:text-2xl">Custom-Build A Keyboard Fit To You</p>
    <p
      class="uppercase text-7xl sm:text-8xl bg-clip-text text-transparent bg-gradient-rct to-[#F368E9] from-[#E6B09F] font-semibold"
    >
      Don't Settle
    </p>
    <p class="uppercase text-2xl sm:text-4xl text-brand-pink font-medium">For One-Size-Fits-All</p>
  </div>
  <div class="relative">
    <img src="{base}/alien.svg" class="alien absolute" alt="" />
    <!-- <img src="mainpagegraphics.png" width="40%" class="mx-auto mt-8" /> -->
    <!-- <img src="canvas.svg" width="38%" class="mx-auto mt-8 opacity-50" /> -->
    <!-- <div class="text-brand-green absolute top-5% left-[33.5%] text-xl opacity-50">Cosmos</div> -->
    <!-- <img class="absolute top-20% left-45% w-64" src="verticalweb2.png" /> -->
    <video
      autoplay
      muted
      loop
      class="w-80% md:w-60% lg:w-50% mx-auto rounded my-8"
      poster="{base}/cosmos-cover.png"
    >
      <source type="video/mp4" src="{base}/cosmos.mp4" />
    </video>
    <img src="{base}/monster.svg" class="monster absolute bottom-[-40px]" alt="" />
  </div>
  <a
    href="{base}/beta"
    class="text-black bg-brand-green font-semibold sm:pt-1 sm:px-10 rounded sm:border-b-6 border-[#f57aec] inline-flex items-center gap-30 cta sm:text-xl my-4 sm:pb-0.5 px-6 border-b-4"
    on:click={join}
  >
    Join the beta
    <Icon path={mdiChevronRight} size="100%" class="w-[28px] sm:w-[32px]" />
  </a>
</section>
<section class="section">
  <img src="{base}/hand.svg" class="<sm:mx-auto sm:float-right w-72 ml-6 mb-6 mt--6" alt="" />
  <h2 class="heading">Scan Your Hand, Build a Keyboard</h2>
  <p class="font-system">
    Cosmos is the easiest way to design a keyboard around your one-of-a-kind hands. Scan your hand
    using just your phone camera, then fit a keyboard to the scan. The key positions align to your
    fingers' lengths and movement.
  </p>
</section>
<section class="section">
  <img src="{base}/all.svg" class="<sm:mx-auto sm:float-left w-72 ml-4 mr-6 mb-6 mt--6" alt="" />
  <h2 class="heading">Add All The Things</h2>
  <p class="font-system">
    Add a trackball, trackpad, encoder, or OLED display. There's support for MX, Choc, and Alps
    switches, and almost every type of keycap. Plus with 7 different microcontrollers, you can mix
    and match all you like.
  </p>
  <a
    href="{base}/parts"
    class="text-black font-semibold rounded inline-flex items-center gap-16 my-4 pl-6 pr-4 bg-brand-green <sm:ml-6 transition hover:shadow-lg shadow-teal/30"
  >
    Browse the Parts
    <Icon path={mdiChevronRight} size="100%" class="w-[28px] sm:w-[32px]" />
  </a>
</section>
<section class="max-w-240 mx-auto bg-gradient-rc-far from-[#f57aec]/15 to-transparent">
  <div class="lightbox lightbox-gradient">
    <h2 class="lightheading">Generate Stunning Keyboards</h2>
    <p class="font-system">
      Choose from 3 types of cases, split or unibody, and many customizations.
    </p>
    <img src="{base}/cases.png" alt="Keyboards generated with Cosmos" />
  </div>
  <div class="sm:flex">
    <div class="lightbox">
      <h2 class="lightheading">Print Worry-Free</h2>
      <p class="font-system">
        Cosmos catches errors before you print and automatically fixes common model issues.
      </p>
    </div>
    <div class="lightbox">
      <h2 class="lightheading">Take Control</h2>
      <p class="font-system">
        Custom Thumbs mode allows you to drag and drop keys and trackballs in the thumb cluster into
        place.
      </p>
    </div>
  </div>
  <div class="sm:flex">
    <div class="lightbox">
      <h2 class="lightheading">Mix and Match Keycaps</h2>
      <p class="font-system">
        Your artisans are now ergonomic. Whatever batch of keycaps you decide to use, Cosmos will
        arrange them to fit your desired curvature.
      </p>
      <img
        src="{base}/adaptive.png"
        class="pt-8"
        alt="Keys with different styles of keycaps with their tops lined up"
      />
    </div>
    <div class="lightbox lightbox-gradient">
      <h2 class="lightheading">RGB and Hotswap Ready</h2>
      <p class="font-system">
        Cosmos has first-class support for Amoeba King PCBs, which let you easily integrate per-key
        RGB and hotswap sockets. It also has high-quality built-in-hotswap and PCB-less options if
        you're on a budget.
      </p>
      <img src="{base}/hotswapsockets.png" alt="Hotswap sockets in Cosmos" />
    </div>
  </div>
</section>

<p class="text-center mt-20 text-lg text-white">And last but not least…</p>

<section class="section mb-0!">
  <img
    src="{base}/fusion-keyboard.png"
    class="<sm:mx-auto sm:float-left w-72 ml-4 mr-10 mb-6 pt-4"
    alt="Keyboard in Autodesk Fusion"
  />
  <h2 class="heading">Give it to your CAD friend</h2>
  <p class="font-system">
    Every model can export to STLs, which are meant to be sent to your 3D printer or an online
    printing service, or to STEP models, which can be modified in CAD programs. If you don't like
    the way your model looks, ask your closest CAD guru to make adjustments.
  </p>
  <a
    href="{base}/docs/cad/"
    class="text-black font-semibold rounded inline-flex items-center gap-16 my-4 pl-6 pr-4 bg-brand-green <sm:ml-6 transition hover:shadow-lg shadow-teal/30"
  >
    Learn About CAD Export
    <Icon path={mdiChevronRight} size="100%" class="w-[28px] sm:w-[32px]" />
  </a>
</section>

<section
  class="text-center bg-gradient-rc-close from-[#f57aec]/5 to-transparent py-30 px-6 my-5 sm:py-60"
>
  <h2 class="text-brand-pink text-4xl mb-4">Join us in revolutionizing keyboard design.</h2>

  <div class="max-w-[75ch] mx-auto">
    <p class="font-system mb-2">
      Cosmos is <a class="s-link" href="{base}/blog/category/technical/">made in the open</a>, and
      95% of
      <a class="s-link" href="https://github.com/rianadon/Cosmos-Keyboards">the code</a> is open-source.
      It's our firm belief everyone should have free access to technology to relieve and prevent typing
      pain.
    </p>
    <p class="font-system">
      Come see the unique keyboards we all are making on the Discord server.
    </p>
    <div class="bg-gray-800 inline-flex my-6 py-2 px-4 rounded items-center gap-4">
      <img src="{base}/cosmos-icon.png" class="w-12 h-12 rounded-4" />
      <div class="text-left mr-8">
        <p class="text-lg">Cosmos Keyboard</p>
        <p class="text-gray-400 mt--1">
          <span class="mr-1">●</span>
          {#await discordUsers then count}{count} members{/await}
        </p>
      </div>
      <a
        class="px-4 py-1 bg-brand-green text-black rounded font-semibold"
        href={discord}
        on:click={subbed}>Join</a
      >
    </div>
    <p class="font-system">
      Don't have an account? I send a few recaps per year to <a
        class="s-link"
        href="https://newsletter.ryanis.cool/subscribe/"
        on:click={subbed}>my newsletter <Icon class="inline relative top--0.3" path={mdiEmail} /></a
      >.
    </p>
    <p class="inline-block font-system text-sm opacity-50 max-w-60ch mt-6">
      The other 5% of code? That's for the Pro features, which add extra cosmetic options to your
      keyboard and help keep this project sustainable.
    </p>
  </div>
</section>

<section class="text-center">
  <h2 class="text-brand-green text-4xl mb-4">Sound fun?</h2>
  <a
    href="{base}/beta"
    class="text-black bg-brand-pink font-semibold sm:pt-1 sm:px-10 rounded sm:border-b-6 border-[#68e4a9] inline-flex items-center gap-30 cta sm:text-xl my-4 sm:pb-0.5 px-6 border-b-4"
    on:click={join}
  >
    Join the beta
    <Icon path={mdiChevronRight} size="100%" class="w-[28px] sm:w-[32px]" />
  </a>
  <p class="mt-6 max-w-prose mx-auto px-6 text-gray-200">
    Psst! Come here from my Dactyl generator? You should give Cosmos a try. It's changing a&nbsp;lot
    but it will give you a much better Dactyl-like case and microcontroller holder.
  </p>
</section>

<footer class="text-center mt-20 pb-8 text-gray-400">
  Brought to you by <a class="s-link" href="https://github.com/rianadon">@rianadon</a>.
</footer>

{#if joining}
  <Dialog forceDark center on:close={() => (joining = false)}>
    <span slot="title" class="font-urbanist">Before you leave…</span>
    <div slot="content" class="text-center text-white font-urbanist">
      <p class="font-system">
        Don't miss out on updates! The generator is in constant flux during the beta, and joining
        the Discord server will keep you up to date with the changes.
      </p>
      <div class="bg-gray-700 inline-flex my-6 py-2 px-4 rounded items-center gap-4">
        <img src="{base}/cosmos-icon.png" class="w-12 h-12 rounded-4" />
        <div class="text-left mr-8">
          <p class="text-lg">Cosmos Keyboard</p>
          <p class="text-gray-400 mt--1">
            <span class="mr-1">●</span>
            {#await discordUsers then count}{count} members{/await}
          </p>
        </div>
        <a
          class="px-4 py-1 bg-brand-green text-black rounded font-semibold"
          href={discord}
          on:click={subbed}>Join</a
        >
      </div>
      <p class="font-system">
        Don't have an account? I send a few recaps per year to <a
          class="s-link"
          href="https://newsletter.ryanis.cool/subscribe/"
          on:click={subbed}
          >my newsletter <Icon class="inline relative top--0.3" path={mdiEmail} /></a
        >.
      </p>
      <a
        href="beta"
        class="inline-block text-black bg-brand-pink rounded px-2 py-0.5 font-semibold mt-6"
        on:click={subbed}>Just take me to the beta already</a
      >
    </div>
  </Dialog>
{/if}

<style>
  section {
    --at-apply: 'text-white';
  }
  .section {
    --at-apply: 'max-w-240 mx-auto mt-20 mb-36';
  }
  .heading {
    --at-apply: 'uppercase text-2xl sm:text-4xl bg-clip-text text-transparent bg-gradient-to-r to-[#68e4a9] from-[#f3b068] font-medium mb-4';
  }
  .lightbox {
    --at-apply: 'bg-gradient-to-b from-[#2e272d]/50 to-[#17171d]/0 p-8 rounded-2 flex-basis-full m-2';
  }
  .bg-gradient-rc-close {
    --un-gradient-shape: closest-side ellipse at center;
    --un-gradient: var(--un-gradient-shape), var(--un-gradient-stops);
    background-image: radial-gradient(var(--un-gradient));
  }
  .bg-gradient-rc-far {
    --un-gradient-shape: farthest-side circle at center;
    --un-gradient: var(--un-gradient-shape), var(--un-gradient-stops);
    background-image: radial-gradient(var(--un-gradient));
  }
  .lightbox-gradient {
    --at-apply: 'pb-1';
  }
  .lightbox-gradient img {
    margin-top: 2rem;
    mask-image: linear-gradient(
      to top,
      rgba(0, 0, 0, 0),
      rgba(0, 0, 0, 0.55) 12%,
      rgba(0, 0, 0, 1) 30%
    );
  }
  .lightheading {
    --at-apply: 'uppercase text-xl sm:text-3xl text-[#68e4a9] font-medium mb-4';
  }
  .section p,
  .section .heading {
    --at-apply: 'mx-6';
  }
  .bg-gradient-rct {
    --un-gradient-shape: 600px 300px ellipse at center -80%;
    --un-gradient: var(--un-gradient-shape), var(--un-gradient-stops);
    background-image: radial-gradient(var(--un-gradient));
  }
  .cta {
    --at-apply: 'transition hover:scale-105 ease-in-out';
    box-shadow: 40px 10px 15px -5px rgba(243, 104, 233, 0.2),
      -40px 10px 15px -5px rgba(243, 104, 233, 0.2), 0 10px 15px 0 rgba(243, 104, 233, 0.2);
  }
  .cta:hover {
    box-shadow: 40px 12px 15px -5px rgba(243, 104, 233, 0.2),
      -40px 12px 15px -5px rgba(243, 104, 233, 0.2), 0 12px 15px 0 rgba(243, 104, 233, 0.2);
  }
  .alien {
    width: calc(hypot(20vw, 100px) - 3vw);
    left: min(hypot(20vw, 100px) - 200px, 50px);
    bottom: clamp(hypot(20vw, 100px) - 200px, -30px, 50px);
    animation: bounce-slow 5s ease-in-out alternate infinite;
  }
  .monster {
    width: calc(1.6 * ((hypot(20vw, 100px) - 3vw)));
    right: calc(0.1 * hypot(20vw, 100px) - 170px);
    transform-origin: 80% 95%;
    animation: rotate-slow 4s ease-in-out alternate infinite;
  }

  @keyframes bounce-slow {
    100% {
      transform: translateY(-6%);
    }
    0% {
      transform: translateY(0);
    }
  }

  @keyframes rotate-slow {
    100% {
      transform: rotate(-1deg);
    }
    0% {
      transform: rotate(1deg);
    }
  }
</style>
